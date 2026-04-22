import {
  action,
  type DialAction,
  type DialRotateEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { Brightness } from "@felixgeelhaar/govee-api-client";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { clamp } from "./shared/validation";

type BrightnessDialSettings = BaseDialSettings;

/** Default bar colors from layouts/brightness.json */
const DEFAULT_BAR_FILL = "0:#7B2CBF,1:#3A86FF"; // purple->blue gradient
const DEFAULT_BAR_BG = "#1F2937"; // dark gray

@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness-dial" })
export class BrightnessDialAction extends BaseDialAction<BrightnessDialSettings> {
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

  override async onDialRotate(
    ev: DialRotateEvent<BrightnessDialSettings>,
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

  protected async syncLiveState(
    ctx: string,
    settings: BrightnessDialSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        this.displayModeMap.set(ctx, "single");
        if (target.light.brightness) {
          this.brightnessMap.set(ctx, target.light.brightness.level);
        }
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          // Some devices can leave us with a stale cached power bit while still
          // exposing a usable brightness value. Avoid rendering a false "Off"
          // state on the dial when we have a non-zero brightness reading.
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
        const lights = target.group.getControllableLights();
        const brightnessValues: number[] = [];
        let anyOn = false;
        let anyOff = false;

        for (const light of lights) {
          try {
            await this.services.syncLightState(light);
          } catch {
            // Best effort per light.
          }
          if (light.isOn) anyOn = true;
          else anyOff = true;
          if (light.isOn && light.brightness) {
            brightnessValues.push(light.brightness.level);
          }
        }

        this.powerMap.set(ctx, anyOn);
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
        const mixed = (anyOn && anyOff) || uniqueValues.size > 1;
        this.displayModeMap.set(ctx, mixed ? "mixed" : "group");
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<BrightnessDialSettings & JsonObject>,
    _settings: BrightnessDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const brightness = this.brightnessMap.get(ctx) ?? 50;
    const isOn = this.powerMap.get(ctx) ?? true;
    const displayMode = this.displayModeMap.get(ctx) ?? "single";
    const indicator =
      displayMode === "mixed" ? "🔀 " : displayMode === "group" ? "👥 " : "";
    const title = !isOn ? "Off" : `${indicator}${brightness}%`;

    await action.setFeedback({
      label: "Brightness",
      value: title,
      bar: { value: isOn ? brightness : 0 },
    });
  }
}
