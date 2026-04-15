import {
  type DialAction,
  type DialRotateEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { hsvToRgb } from "./shared/color-utils";
import { clamp } from "./shared/validation";
import { SegmentColor } from "../domain/value-objects/SegmentColor";

type SegmentColorDialSettings = BaseDialSettings & {
  segmentIndex?: number;
  saturation?: number;
};

/** Default bar colors from layouts/segment.json (gbar) */
const DEFAULT_BAR_FILL = "#FFFFFF"; // white indicator
const DEFAULT_BAR_BG =
  "0:#FF0000,0.17:#FFFF00,0.33:#00FF00,0.5:#00FFFF,0.67:#0000FF,0.83:#FF00FF,1:#FF0000"; // rainbow

export class SegmentColorDialAction extends BaseDialAction<SegmentColorDialSettings> {
  override readonly manifestId =
    "com.felixgeelhaar.govee-light-management.segment-color-dial";
  private hueMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.hueMap.delete(ctx);
  }

  override async onDialRotate(
    ev: DialRotateEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    const step = clamp(settings.stepSize || 15, 1, 90);
    const current = this.hueMap.get(ctx) ?? 0;
    const next = (((current + ev.payload.ticks * step) % 360) + 360) % 360;
    this.hueMap.set(ctx, next);

    await this.updateDisplay(ev.action, settings);

    this.services.deferDialAction(
      ctx,
      async () => {
        const finalHue = this.hueMap.get(ctx) ?? next;
        await this.applyToSegment(settings, finalHue);
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

  private async applyToSegment(
    settings: SegmentColorDialSettings,
    hue: number,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      streamDeck.logger.warn(
        `Segment color: missing apiKey=${!!apiKey} deviceId=${settings.selectedDeviceId}`,
      );
      throw new Error("Missing API key or device ID");
    }
    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target || target.type !== "light" || !target.light) {
      streamDeck.logger.warn(
        `Segment color: could not resolve target for device ${settings.selectedDeviceId}`,
      );
      throw new Error("Could not resolve target device");
    }

    const saturation = clamp(settings.saturation ?? 100, 0, 100);
    const color = hsvToRgb(hue, saturation, 100);
    // UI stores 1-based index (1–15), translate to 0-based (0–14) for the API
    const segmentIndex = clamp((settings.segmentIndex ?? 1) - 1, 0, 14);
    await this.services.setSegmentColors(target.light, [
      SegmentColor.create(segmentIndex, color),
    ]);
  }

  /**
   * Sync power state only. The Govee API does not expose per-segment color
   * state, so hue always starts at the default (0 deg). Only power can be synced.
   */
  protected async syncLiveState(
    ctx: string,
    settings: SegmentColorDialSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const isOn = await this.services.getLivePowerState(target.light);
        if (isOn !== undefined) {
          this.powerMap.set(ctx, isOn);
        }
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  protected async updateDisplay(
    action: DialAction<SegmentColorDialSettings & JsonObject>,
    settings: SegmentColorDialSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const hue = this.hueMap.get(ctx) ?? 0;
    const isOn = this.powerMap.get(ctx) ?? true;
    // Display 1-based segment number to match the UI
    const segmentDisplay = settings.segmentIndex ?? 1;

    await action.setFeedback({
      label: `Segment ${segmentDisplay}`,
      value: isOn ? `${hue}°` : "Off",
      bar: { value: isOn ? Math.round((hue / 360) * 100) : 0 },
    });
  }
}
