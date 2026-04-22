import {
  action,
  type DialAction,
  type DialRotateEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { hsvToRgb, rgbToHue } from "./shared/color-utils";
import { clamp } from "./shared/validation";

type ColorHueDialSettings = BaseDialSettings & {
  saturation?: number;
};

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG =
  "0:#FF0000,0.17:#FFFF00,0.33:#00FF00,0.5:#00FFFF,0.67:#0000FF,0.83:#FF00FF,1:#FF0000";

@action({ UUID: "com.felixgeelhaar.govee-light-management.colorhue-dial" })
export class ColorHueDialAction extends BaseDialAction<ColorHueDialSettings> {
  private hueMap = new Map<string, number>();
  private displayModeMap = new Map<string, "single" | "group" | "mixed">();

  protected initValueMaps(ctx: string): void {
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
    if (!this.displayModeMap.has(ctx)) this.displayModeMap.set(ctx, "single");
  }

  protected cleanupValueMaps(ctx: string): void {
    this.hueMap.delete(ctx);
    this.displayModeMap.delete(ctx);
  }

  override async onDialRotate(
    ev: DialRotateEvent<ColorHueDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || 15, 1, 90);
    const current = this.hueMap.get(ctx) ?? 0;
    const next = (((current + ev.payload.ticks * step) % 360) + 360) % 360;
    this.hueMap.set(ctx, next);
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
        const finalHue = this.hueMap.get(ctx) ?? next;
        const saturation = clamp(settings.saturation ?? 100, 0, 100);
        const color = hsvToRgb(finalHue, saturation, 100);
        await this.services.controlTarget(target, "color", color);
      },
      undefined,
      {
        action: ev.action,
        getRestoreValue: () => {
          const hue = this.hueMap.get(ctx) ?? 0;
          const isOn = this.powerMap.get(ctx) ?? true;
          return isOn ? Math.round((hue / 360) * 100) : 0;
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
    settings: ColorHueDialSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        this.displayModeMap.set(ctx, "single");
        if (target.light.color) {
          this.hueMap.set(ctx, rgbToHue(target.light.color));
        }
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          if (target.light.color && this.powerMap.get(ctx) === false) {
            this.powerMap.set(ctx, true);
          }
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        if (target.light.color) {
          this.hueMap.set(ctx, rgbToHue(target.light.color));
        }
      } else if (target?.type === "group" && target.group) {
        const lights = target.group.getControllableLights();
        const hueValues: number[] = [];
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
          if (light.isOn && light.color) {
            hueValues.push(rgbToHue(light.color));
          }
        }

        this.powerMap.set(ctx, anyOn);
        if (hueValues.length > 0) {
          this.hueMap.set(ctx, this.getAverageHue(hueValues));
        }

        const uniqueValues = new Set(
          hueValues.map((value) => Math.round(value)),
        );
        const mixed = (anyOn && anyOff) || uniqueValues.size > 1;
        this.displayModeMap.set(ctx, mixed ? "mixed" : "group");
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<ColorHueDialSettings & JsonObject>,
    _settings: ColorHueDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const hue = this.hueMap.get(ctx) ?? 0;
    const isOn = this.powerMap.get(ctx) ?? true;
    const displayMode = this.displayModeMap.get(ctx) ?? "single";
    const indicator =
      displayMode === "mixed" ? "🔀 " : displayMode === "group" ? "👥 " : "";
    const title = !isOn ? "Off" : `${indicator}${hue} °`;

    await action.setFeedback({
      label: "Color",
      value: title,
      bar: { value: isOn ? Math.round((hue / 360) * 100) : 0 },
    });
  }

  private getAverageHue(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const radians = values.map((value) => (value * Math.PI) / 180);
    const x = radians.reduce((sum, value) => sum + Math.cos(value), 0);
    const y = radians.reduce((sum, value) => sum + Math.sin(value), 0);

    if (x === 0 && y === 0) {
      return Math.round(values[0] ?? 0);
    }

    const angle = Math.atan2(y, x);
    return Math.round(((angle * 180) / Math.PI + 360) % 360);
  }
}
