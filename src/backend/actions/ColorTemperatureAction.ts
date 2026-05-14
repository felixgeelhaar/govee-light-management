/**
 * Color Temperature — unified keypad + encoder action.
 *
 * Keypad press sets a fixed colour temperature mapped from a percent
 * value (`colorTempValue`) to the device's advertised Kelvin range.
 * Encoder rotation adjusts Kelvin by `stepSize` per tick. Encoder
 * press toggles power.
 *
 * Same UUID for both controllers. Legacy ColorTempDialAction stays
 * registered for existing dial bindings.
 */
import {
  action,
  type DialAction,
  type DialRotateEvent,
  type KeyDownEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { ColorTemperature } from "../domain/value-objects/ColorTemperature";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import {
  type KelvinRange,
  kelvinFromPercent,
  kelvinToBarValue,
  normalizeKelvin,
} from "./shared/kelvin-utils";
import { clamp } from "./shared/validation";
import { powerGlyph, valuePrefix } from "./shared/power-state";
import { telemetryService } from "../services/TelemetryService";

type ColorTemperatureSettings = BaseDialSettings & {
  colorTempValue?: number;
};

const MIN_KELVIN = 2000;
const MAX_KELVIN = 9000;
const DEFAULT_KELVIN = 4500;
const DEFAULT_STEP_KELVIN = 100;
const DEFAULT_KELVIN_RANGE: KelvinRange = {
  min: MIN_KELVIN,
  max: MAX_KELVIN,
  precision: DEFAULT_STEP_KELVIN,
};
const FALLBACK_RANGE: KelvinRange = { min: 2700, max: 6500, precision: 100 };

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG = "0:#FFB347,1:#A8D8EA";

@action({ UUID: "com.felixgeelhaar.govee-light-management.colortemp" })
export class ColorTemperatureAction extends BaseDialAction<ColorTemperatureSettings> {
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

  // ── Keypad ─────────────────────────────────────────────────────

  override async onKeyDown(
    ev: KeyDownEvent<ColorTemperatureSettings>,
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
      const tempPercent = settings.colorTempValue ?? 50;
      const range = await this.resolveKelvinRange(settings);
      const kelvin = normalizeKelvin(
        kelvinFromPercent(tempPercent, range),
        range,
      );
      const colorTemp = new ColorTemperature(kelvin);
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        await this.services.ensurePreparedForTarget(ev.action.id, target);
        await this.services.controlTarget(
          target,
          "colorTemperature",
          colorTemp,
        );
      } finally {
        stopSpinner();
      }
      this.tempMap.set(ev.action.id, kelvin);
      this.powerMap.set(ev.action.id, true);
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.colorTemperature`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set color temperature:", error);
      await ev.action.showAlert();
    }
  }

  // ── Encoder rotate ────────────────────────────────────────────

  override async onDialRotate(
    ev: DialRotateEvent<ColorTemperatureSettings>,
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

  // ── Live state sync ──────────────────────────────────────────

  protected async syncLiveState(
    ctx: string,
    settings: ColorTemperatureSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const range = await this.getTemperatureRange(settings, ctx);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        this.displayModeMap.set(ctx, "single");
        this.groupSummaryMap.delete(ctx);
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
        const allMembers = target.group.lights;
        const lights = target.group.getControllableLights();
        this.hasOfflineMember.set(ctx, lights.length < allMembers.length);
        const kelvinValues: number[] = [];
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
            if (light.colorTemperature) {
              kelvinValues.push(
                normalizeKelvin(light.colorTemperature.kelvin, range),
              );
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
        const mixed = (onCount > 0 && anyOff) || uniqueValues.size > 1;
        this.displayModeMap.set(ctx, mixed ? "mixed" : "group");
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  // ── Title / LCD render ───────────────────────────────────────

  protected async updateDisplay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: DialAction<ColorTemperatureSettings & JsonObject> | any,
    settings: ColorTemperatureSettings,
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
    const value = !isOn ? "Off" : `${valuePrefix(displayMode)}${kelvin}K`;

    if (typeof action.setFeedback === "function") {
      try {
        await action.setFeedback({
          label: "Temperature",
          value,
          bar: { value: isOn ? barValue : 0 },
        });
      } catch {
        // No-op if action disappeared mid-render.
      }
    } else if (typeof action.setTitle === "function") {
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

  private async getTemperatureRange(
    settings: ColorTemperatureSettings,
    ctx: string,
  ): Promise<KelvinRange> {
    const cached = this.tempRangeMap.get(ctx);
    if (cached) return cached;

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

  /** Keypad-only range resolver — falls back to a safer 2700-6500K window
   * (per #167) when the device hasn't advertised a range. */
  private async resolveKelvinRange(
    settings: ColorTemperatureSettings,
  ): Promise<KelvinRange> {
    const lightItem = await this.services.getLightItem(settings);
    const declared = lightItem?.properties?.colorTem?.range;
    if (!declared) {
      return FALLBACK_RANGE;
    }
    return {
      min: declared.min,
      max: declared.max,
      precision: Math.max(1, declared.precision ?? FALLBACK_RANGE.precision),
    };
  }

  private getDefaultKelvinForRange(range: KelvinRange): number {
    return normalizeKelvin(DEFAULT_KELVIN, range);
  }
}
