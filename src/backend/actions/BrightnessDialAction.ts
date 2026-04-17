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
const DEFAULT_BAR_FILL = "0:#7B2CBF,1:#3A86FF"; // purple→blue gradient
const DEFAULT_BAR_BG = "#1F2937"; // dark gray

@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness-dial" })
export class BrightnessDialAction extends BaseDialAction<BrightnessDialSettings> {
  private brightnessMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.brightnessMap.has(ctx)) this.brightnessMap.set(ctx, 50);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.brightnessMap.delete(ctx);
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

    await this.updateDisplay(ev.action, settings);

    this.services.deferDialAction(
      ctx,
      async () => {
        const apiKey = await this.services.getApiKey(settings);
        if (!apiKey || !settings.selectedDeviceId) return;
        await this.services.ensureServices(apiKey);
        const target = await this.services.resolveTarget(settings);
        if (!target) return;
        // Clear overlay modes for single lights and groups (see #170).
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
      // resolveTarget hydrates the domain Light from the shared state
      // snapshot, so a fresh snapshot renders immediately without a
      // network round-trip.
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.brightness) {
          this.brightnessMap.set(ctx, target.light.brightness.level);
        }
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
    const title = isOn ? `${brightness}%` : "Off";

    await action.setFeedback({
      label: "Brightness",
      value: title,
      bar: { value: isOn ? brightness : 0 },
    });
    await action.setTitle(title);
  }
}
