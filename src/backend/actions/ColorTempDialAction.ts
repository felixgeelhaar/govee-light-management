import {
  type DialAction,
  type DialRotateEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { clamp } from "./shared/validation";

type ColorTempDialSettings = BaseDialSettings;

/** Color temperature range in Kelvin */
const MIN_KELVIN = 2000;
const MAX_KELVIN = 9000;
const DEFAULT_KELVIN = 4500;
const DEFAULT_STEP_KELVIN = 100;

/** Default bar colors from layouts/color-temp.json (gbar) */
const DEFAULT_BAR_FILL = "#FFFFFF"; // white indicator
const DEFAULT_BAR_BG = "0:#FFB347,1:#A8D8EA"; // warm→cool gradient

export class ColorTempDialAction extends BaseDialAction<ColorTempDialSettings> {
  override readonly manifestId =
    "com.felixgeelhaar.govee-light-management.colortemp-dial";
  private tempMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.tempMap.has(ctx)) this.tempMap.set(ctx, DEFAULT_KELVIN);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.tempMap.delete(ctx);
  }

  override async onDialRotate(
    ev: DialRotateEvent<ColorTempDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || DEFAULT_STEP_KELVIN, 50, 500);
    const current = this.tempMap.get(ctx) ?? DEFAULT_KELVIN;
    const next = clamp(
      current + ev.payload.ticks * step,
      MIN_KELVIN,
      MAX_KELVIN,
    );
    this.tempMap.set(ctx, next);

    await this.updateDisplay(ev.action, settings);

    this.services.deferDialAction(
      ctx,
      async () => {
        const apiKey = await this.services.getApiKey(settings);
        if (!apiKey || !settings.selectedDeviceId) return;
        await this.services.ensureServices(apiKey);
        const target = await this.services.resolveTarget(settings);
        if (!target) return;
        const finalKelvin = this.tempMap.get(ctx) ?? next;
        await this.services.controlTarget(
          target,
          "colorTemperature",
          new ColorTemperature(finalKelvin),
        );
      },
      undefined,
      {
        action: ev.action,
        getRestoreValue: () => {
          const kelvin = this.tempMap.get(ctx) ?? DEFAULT_KELVIN;
          const isOn = this.powerMap.get(ctx) ?? true;
          const barValue = Math.round(
            ((kelvin - MIN_KELVIN) / (MAX_KELVIN - MIN_KELVIN)) * 100,
          );
          return isOn ? barValue : 0;
        },
        loadingFillColor: DEFAULT_BAR_FILL,
        loadingBgColor: "#FFFFFF",
        restoreFillColor: DEFAULT_BAR_FILL,
        restoreBgColor: DEFAULT_BAR_BG,
      },
    );
  }

  protected async syncLiveState(
    ctx: string,
    settings: ColorTempDialSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        await this.services.syncLightState(target.light);
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.colorTemperature) {
          this.tempMap.set(ctx, target.light.colorTemperature.kelvin);
        }
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<ColorTempDialSettings & JsonObject>,
    _settings: ColorTempDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const kelvin = this.tempMap.get(ctx) ?? DEFAULT_KELVIN;
    const isOn = this.powerMap.get(ctx) ?? true;
    const barValue = Math.round(
      ((kelvin - MIN_KELVIN) / (MAX_KELVIN - MIN_KELVIN)) * 100,
    );

    await action.setFeedback({
      label: "Temperature",
      value: isOn ? `${kelvin}K` : "Off",
      bar: { value: isOn ? barValue : 0 },
    });
  }
}
