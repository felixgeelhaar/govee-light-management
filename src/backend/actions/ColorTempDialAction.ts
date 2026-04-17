import {
  action,
  type DialAction,
  type DialRotateEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { clamp } from "./shared/validation";
import {
  type KelvinRange,
  kelvinToBarValue,
  normalizeKelvin,
} from "./shared/kelvin-utils";

type ColorTempDialSettings = BaseDialSettings;

/** Color temperature range in Kelvin */
const MIN_KELVIN = 2000;
const MAX_KELVIN = 9000;
const DEFAULT_KELVIN = 4500;
const DEFAULT_STEP_KELVIN = 100;
const DEFAULT_KELVIN_RANGE: KelvinRange = {
  min: MIN_KELVIN,
  max: MAX_KELVIN,
  precision: DEFAULT_STEP_KELVIN,
};

/** Default bar colors from layouts/color-temp.json (gbar) */
const DEFAULT_BAR_FILL = "#FFFFFF"; // white indicator
const DEFAULT_BAR_BG = "0:#FFB347,1:#A8D8EA"; // warm→cool gradient

@action({ UUID: "com.felixgeelhaar.govee-light-management.colortemp-dial" })
export class ColorTempDialAction extends BaseDialAction<ColorTempDialSettings> {
  private tempMap = new Map<string, number>();
  private tempRangeMap = new Map<string, KelvinRange>();

  protected initValueMaps(ctx: string): void {
    if (!this.tempMap.has(ctx)) this.tempMap.set(ctx, DEFAULT_KELVIN);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.tempMap.delete(ctx);
    this.tempRangeMap.delete(ctx);
  }

  override async onDialRotate(
    ev: DialRotateEvent<ColorTempDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || DEFAULT_STEP_KELVIN, 50, 500);
    const range = await this.getTemperatureRange(settings, ctx);
    const current =
      this.tempMap.get(ctx) ?? this.getDefaultKelvinForRange(range);
    const next = normalizeKelvin(current + ev.payload.ticks * step, range);
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
        // Clear overlay modes for single lights and groups (see #170).
        await this.services.ensurePreparedForTarget(ctx, target);
        const finalKelvin = normalizeKelvin(
          this.tempMap.get(ctx) ?? next,
          range,
        );
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
          const localRange = this.tempRangeMap.get(ctx) ?? DEFAULT_KELVIN_RANGE;
          const kelvin =
            this.tempMap.get(ctx) ?? this.getDefaultKelvinForRange(localRange);
          const isOn = this.powerMap.get(ctx) ?? true;
          const barValue = kelvinToBarValue(
            kelvin,
            localRange.min,
            localRange.max,
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
      const range = await this.getTemperatureRange(settings, ctx);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.colorTemperature) {
          this.tempMap.set(
            ctx,
            normalizeKelvin(target.light.colorTemperature.kelvin, range),
          );
        }
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<ColorTempDialSettings & JsonObject>,
    settings: ColorTempDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const range =
      this.tempRangeMap.get(ctx) ??
      (await this.getTemperatureRange(settings, ctx));
    const kelvin =
      this.tempMap.get(ctx) ?? this.getDefaultKelvinForRange(range);
    const isOn = this.powerMap.get(ctx) ?? true;
    const barValue = kelvinToBarValue(kelvin, range.min, range.max);
    const title = isOn ? `${kelvin}K` : "Off";

    await action.setFeedback({
      label: "Temperature",
      value: title,
      bar: { value: isOn ? barValue : 0 },
    });
    await action.setTitle(title);
  }

  private async getTemperatureRange(
    settings: ColorTempDialSettings,
    ctx: string,
  ): Promise<KelvinRange> {
    const cached = this.tempRangeMap.get(ctx);
    if (cached) {
      return cached;
    }

    const lightItem = await this.services.getLightItem(settings);
    const min = lightItem?.properties?.colorTem?.range?.min ?? MIN_KELVIN;
    const max = lightItem?.properties?.colorTem?.range?.max ?? MAX_KELVIN;
    const precision =
      lightItem?.properties?.colorTem?.range?.precision ?? DEFAULT_STEP_KELVIN;
    const range: KelvinRange = {
      min,
      max,
      precision: Math.max(1, precision),
    };
    this.tempRangeMap.set(ctx, range);
    return range;
  }

  private getDefaultKelvinForRange(range: KelvinRange): number {
    return normalizeKelvin(DEFAULT_KELVIN, range);
  }
}
