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

const MIN_KELVIN = 2000;
const MAX_KELVIN = 9000;
const DEFAULT_KELVIN = 4500;
const DEFAULT_STEP_KELVIN = 100;
const DEFAULT_KELVIN_RANGE: KelvinRange = {
  min: MIN_KELVIN,
  max: MAX_KELVIN,
  precision: DEFAULT_STEP_KELVIN,
};

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG = "0:#FFB347,1:#A8D8EA";

@action({ UUID: "com.felixgeelhaar.govee-light-management.colortemp-dial" })
export class ColorTempDialAction extends BaseDialAction<ColorTempDialSettings> {
  private tempMap = new Map<string, number>();
  private tempRangeMap = new Map<string, KelvinRange>();
  private displayModeMap = new Map<string, "single" | "group" | "mixed">();

  protected initValueMaps(ctx: string): void {
    if (!this.tempMap.has(ctx)) this.tempMap.set(ctx, DEFAULT_KELVIN);
    if (!this.displayModeMap.has(ctx)) this.displayModeMap.set(ctx, "single");
  }

  protected cleanupValueMaps(ctx: string): void {
    this.tempMap.delete(ctx);
    this.tempRangeMap.delete(ctx);
    this.displayModeMap.delete(ctx);
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
        this.displayModeMap.set(ctx, "single");
        if (target.light.colorTemperature) {
          this.tempMap.set(
            ctx,
            normalizeKelvin(target.light.colorTemperature.kelvin, range),
          );
        }
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          const fallbackKelvin = target.light.colorTemperature?.kelvin;
          if (
            typeof fallbackKelvin === "number" &&
            fallbackKelvin > 0 &&
            this.powerMap.get(ctx) === false
          ) {
            this.powerMap.set(ctx, true);
          }
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.colorTemperature) {
          this.tempMap.set(
            ctx,
            normalizeKelvin(target.light.colorTemperature.kelvin, range),
          );
        }
      } else if (target?.type === "group" && target.group) {
        const lights = target.group.getControllableLights();
        const kelvinValues: number[] = [];
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
          if (light.isOn && light.colorTemperature) {
            kelvinValues.push(
              normalizeKelvin(light.colorTemperature.kelvin, range),
            );
          }
        }

        this.powerMap.set(ctx, anyOn);
        if (kelvinValues.length > 0) {
          const average = Math.round(
            kelvinValues.reduce((sum, kelvin) => sum + kelvin, 0) /
              kelvinValues.length,
          );
          this.tempMap.set(ctx, normalizeKelvin(average, range));
        }

        const uniqueValues = new Set(
          kelvinValues.map((value) => Math.round(value)),
        );
        const mixed = (anyOn && anyOff) || uniqueValues.size > 1;
        this.displayModeMap.set(ctx, mixed ? "mixed" : "group");
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
    const displayMode = this.displayModeMap.get(ctx) ?? "single";
    const indicator =
      displayMode === "mixed" ? "🔀 " : displayMode === "group" ? "👥 " : "";
    const title = !isOn ? "Off" : `${indicator}${kelvin}K`;

    await action.setFeedback({
      label: "Temperature",
      value: title,
      bar: { value: isOn ? barValue : 0 },
    });
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
