import {
  action,
  type DialAction,
  type DialRotateEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { hsvToRgb, rgbToHue, rgbToSaturation } from "./shared/color-utils";
import { clamp } from "./shared/validation";

type SaturationDialSettings = BaseDialSettings;

/** Default bar colors from layouts/saturation.json (gbar grey→vivid) */
const DEFAULT_BAR_FILL = "#FFFFFF"; // white indicator
const DEFAULT_BAR_BG = "0:#6B7280,1:#EF4444"; // grey → vivid red

/**
 * Saturation is a perceptual scalar (0 = grey, 100 = vivid) just like
 * brightness (0 = off, 100 = full) and hue (0°–360° color wheel). Putting
 * it on its own dial lets the user pick a dim/pastel/deep variant of the
 * light's current color without opening the Property Inspector.
 *
 * Rotate   → adjust saturation 0–100% clamped (no wrap)
 * Push     → toggle power (delegated to BaseDialAction)
 * Touch    → not mapped (N/A in manifest TriggerDescription)
 *
 * The command sent is `setColor(hsvToRgb(currentHue, newSat, 100))`. The
 * hue is read from the light's last-known color in the snapshot; if the
 * snapshot does not carry a color (light was set via colorTemperature
 * or has never had its color read), the dial falls back to hue=0 so
 * rotating still produces a visible change (pure red at whatever
 * saturation the user dialled to).
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.saturation-dial" })
export class SaturationDialAction extends BaseDialAction<SaturationDialSettings> {
  private saturationMap = new Map<string, number>();
  private hueMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.saturationMap.has(ctx)) this.saturationMap.set(ctx, 100);
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.saturationMap.delete(ctx);
    this.hueMap.delete(ctx);
  }

  override async onDialRotate(
    ev: DialRotateEvent<SaturationDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || 5, 1, 25);
    const current = this.saturationMap.get(ctx) ?? 100;
    const next = clamp(current + ev.payload.ticks * step, 0, 100);
    this.saturationMap.set(ctx, next);

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
        const hue = this.hueMap.get(ctx) ?? 0;
        const saturation = this.saturationMap.get(ctx) ?? next;
        const color = hsvToRgb(hue, saturation, 100);
        await this.services.controlTarget(target, "color", color);
      },
      undefined,
      {
        action: ev.action,
        getRestoreValue: () => {
          const saturation = this.saturationMap.get(ctx) ?? 100;
          const isOn = this.powerMap.get(ctx) ?? true;
          return isOn ? saturation : 0;
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
    settings: SaturationDialSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const synced = await this.services.syncLightState(target.light);
        if (!synced) {
          return;
        }
        this.powerMap.set(ctx, target.light.isOn);
        // Govee only reports RGB state, not HSV. Derive both hue and
        // saturation from the snapshot so the dial reflects external
        // changes (Govee app, physical remote) within ~3 seconds:
        //  - hue keeps the next setColor aligned with what the user sees
        //  - saturation updates the dial title/bar to match reality
        // The value component is not recovered (setColor always emits
        // v=100), so the dial continues to drive saturation explicitly
        // against a full-value color.
        if (target.light.color) {
          this.hueMap.set(ctx, rgbToHue(target.light.color));
          this.saturationMap.set(ctx, rgbToSaturation(target.light.color));
        }
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<SaturationDialSettings & JsonObject>,
    _settings: SaturationDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const saturation = this.saturationMap.get(ctx) ?? 100;
    const isOn = this.powerMap.get(ctx) ?? true;
    const title = isOn ? `${saturation}%` : "Off";

    await action.setFeedback({
      label: "Saturation",
      value: title,
      bar: { value: isOn ? saturation : 0 },
    });
    await action.setTitle(title);
  }
}
