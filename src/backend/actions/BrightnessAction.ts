/**
 * Brightness — unified keypad + encoder action.
 *
 * Keypad press sets brightness to a fixed `brightnessValue` from
 * settings (the original Brightness keypad behaviour).
 * Encoder rotation adjusts brightness by `stepSize` per tick.
 * Encoder press toggles power (BaseDialAction default).
 *
 * Both controllers share the same UUID + state tracking + status
 * glyph, so a user no longer needs to pick "Brightness" vs
 * "Brightness Dial" — Stream Deck routes the right handler based on
 * which controller they drag the action onto. The legacy
 * BrightnessDialAction (different UUID) remains registered to keep
 * existing user bindings working; new users only see "Brightness".
 */
import {
  action,
  type DialAction,
  type DialRotateEvent,
  type KeyDownEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { Brightness } from "../domain/value-objects/Brightness";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { clamp } from "./shared/validation";
import { powerGlyph, valuePrefix } from "./shared/power-state";
import { telemetryService } from "../services/TelemetryService";

type BrightnessSettings = BaseDialSettings & {
  brightnessValue?: number;
};

const DEFAULT_BAR_FILL = "0:#7B2CBF,1:#3A86FF";
const DEFAULT_BAR_BG = "#1F2937";

@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness" })
export class BrightnessAction extends BaseDialAction<BrightnessSettings> {
  private brightnessMap = new Map<string, number>();
  private displayModeMap = new Map<string, "single" | "group" | "mixed">();

  protected initValueMaps(ctx: string): void {
    if (!this.brightnessMap.has(ctx)) this.brightnessMap.set(ctx, 50);
    if (!this.displayModeMap.has(ctx)) this.displayModeMap.set(ctx, "single");
  }

  protected cleanupValueMaps(ctx: string): void {
    this.brightnessMap.delete(ctx);
    this.displayModeMap.delete(ctx);
  }

  // ── Keypad ──────────────────────────────────────────────────────

  override async onKeyDown(
    ev: KeyDownEvent<BrightnessSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      await ev.action.showAlert();
      return;
    }

    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const started = Date.now();
    try {
      const brightness = new Brightness(settings.brightnessValue ?? 50);
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        await this.services.ensurePreparedForTarget(ev.action.id, target);
        await this.services.controlTarget(target, "brightness", brightness);
      } finally {
        stopSpinner();
      }
      // Optimistic local state so the next live-sync doesn't briefly
      // revert to a stale brightness value.
      this.brightnessMap.set(ev.action.id, brightness.level);
      this.powerMap.set(ev.action.id, brightness.level > 0);
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.brightness`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set brightness:", error);
      await ev.action.showAlert();
    }
  }

  // ── Encoder rotate ─────────────────────────────────────────────

  override async onDialRotate(
    ev: DialRotateEvent<BrightnessSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || 5, 1, 25);
    const current = this.brightnessMap.get(ctx) ?? 50;
    const next = clamp(current + ev.payload.ticks * step, 0, 100);
    this.brightnessMap.set(ctx, next);
    this.suppressLiveSync(ctx);

    await this.updateDisplay(ev.action, settings);

    this.services.deferDialAction(
      ctx,
      async () => {
        const apiKey = await this.services.getApiKey(settings);
        if (!apiKey || !settings.selectedDeviceId) return;
        await this.services.ensureServices(apiKey);
        const target = await this.services.resolveTarget(settings);
        if (!target) return;
        await this.services.ensurePreparedForTarget(ctx, target);
        const finalValue = this.brightnessMap.get(ctx) ?? next;
        await this.services.controlTarget(
          target,
          "brightness",
          new Brightness(finalValue),
        );
      },
      undefined,
      {
        action: ev.action,
        getRestoreValue: () => {
          const brightness = this.brightnessMap.get(ctx) ?? 50;
          const isOn = this.powerMap.get(ctx) ?? true;
          return isOn ? brightness : 0;
        },
        loadingFillColor: "#FFFFFF",
        loadingBgColor: DEFAULT_BAR_BG,
        restoreFillColor: DEFAULT_BAR_FILL,
        restoreBgColor: DEFAULT_BAR_BG,
      },
    );
  }

  // ── Live state sync ────────────────────────────────────────────

  protected async syncLiveState(
    ctx: string,
    settings: BrightnessSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        this.displayModeMap.set(ctx, "single");
        this.groupSummaryMap.delete(ctx);
        if (target.light.brightness) {
          this.brightnessMap.set(ctx, target.light.brightness.level);
        }
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          const fallbackBrightness = target.light.brightness?.level;
          if (
            typeof fallbackBrightness === "number" &&
            fallbackBrightness > 0 &&
            this.powerMap.get(ctx) === false
          ) {
            this.powerMap.set(ctx, true);
          }
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.brightness) {
          this.brightnessMap.set(ctx, target.light.brightness.level);
        }
      } else if (target?.type === "group" && target.group) {
        const allMembers = target.group.lights;
        const lights = target.group.getControllableLights();
        this.hasOfflineMember.set(ctx, lights.length < allMembers.length);
        const brightnessValues: number[] = [];
        let onCount = 0;
        let anyOff = false;

        for (const light of lights) {
          try {
            await this.services.syncLightState(light);
          } catch {
            // Best effort per light.
          }
          if (light.isOn) {
            onCount++;
            if (light.brightness) {
              brightnessValues.push(light.brightness.level);
            }
          } else {
            anyOff = true;
          }
        }

        this.powerMap.set(ctx, onCount > 0);
        this.groupSummaryMap.set(ctx, {
          onCount,
          totalCount: lights.length,
        });
        if (brightnessValues.length > 0) {
          const average = Math.round(
            brightnessValues.reduce((sum, level) => sum + level, 0) /
              brightnessValues.length,
          );
          this.brightnessMap.set(ctx, average);
        }

        const uniqueValues = new Set(
          brightnessValues.map((value) => Math.round(value)),
        );
        const mixed = (onCount > 0 && anyOff) || uniqueValues.size > 1;
        this.displayModeMap.set(ctx, mixed ? "mixed" : "group");
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  // ── Title / LCD render ─────────────────────────────────────────

  protected async updateDisplay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: DialAction<BrightnessSettings & JsonObject> | any,
    _settings: BrightnessSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const brightness = this.brightnessMap.get(ctx) ?? 50;
    const isOn = this.powerMap.get(ctx) ?? true;
    const displayMode = this.displayModeMap.get(ctx) ?? "single";
    const value = !isOn ? "Off" : `${valuePrefix(displayMode)}${brightness}%`;

    // Encoder gets the LCD layout (label + value + bar). Keypad just
    // gets a setTitle since it has no LCD strip. setFeedback is only
    // available on DialAction; branch by capability so a single class
    // can serve both controller types.
    if (typeof action.setFeedback === "function") {
      try {
        await action.setFeedback({
          label: "Brightness",
          value,
          bar: { value: isOn ? brightness : 0 },
        });
      } catch {
        // No-op if action disappeared mid-render.
      }
    } else if (typeof action.setTitle === "function") {
      // Keypad: switch state image (0=on, 1=off) so the icon visually
      // reflects power state, and append a status glyph badge below
      // the value so groups show ◐ for mixed.
      try {
        if (typeof action.setState === "function") {
          await action.setState(isOn ? 0 : 1);
        }
        const glyph = powerGlyph(this.groupSummaryMap.get(ctx), isOn);
        await action.setTitle(`${value}\n${glyph}`);
      } catch {
        // No-op if action disappeared mid-render.
      }
    }
  }

  // ── PI dispatch ────────────────────────────────────────────────
  // BaseDialAction.onSendToPlugin already routes the standard events
  // (getDevices, getDeviceDebug, getGroups, saveGroup, deleteGroup,
  // refreshState). Brightness has no extra datasource, so no override
  // needed here.

  /**
   * Subclasses extend this to handle PI events beyond the standard
   * set. Brightness has none — kept here as documentation of the hook
   * contract.
   */
  protected override async handleCustomPIEvent(_ev: {
    payload: JsonValue;
  }): Promise<void> {
    // No-op
  }
}
