import {
  action,
  type DialAction,
  type DialDownEvent,
  type DialRotateEvent,
  streamDeck,
  type TouchTapEvent,
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

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG =
  "0:#FF0000,0.17:#FFFF00,0.33:#00FF00,0.5:#00FFFF,0.67:#0000FF,0.83:#FF00FF,1:#FF0000";

@action({
  UUID: "com.felixgeelhaar.govee-light-management.segment-color-dial",
})

/**
 * Govee's cloud API does not expose per-segment color state, so the
 * last selected hue is remembered in this static cache keyed by
 * `deviceId|segmentIndex`. This lets the dial restore the user's
 * prior hue when it reappears on a different page/context, since
 * `ActionServices.lightStateSnapshots` (which caches whole-light
 * state) cannot answer segment-level queries.
 */
export class SegmentColorDialAction extends BaseDialAction<SegmentColorDialSettings> {
  private static segmentHueCache = new Map<
    string,
    { hue: number; isOn: boolean }
  >();
  private hueMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.hueMap.delete(ctx);
  }

  override async onDialDown(
    ev: DialDownEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    await this.applyCurrentSegmentColor(ev.action, ev.payload.settings);
  }

  override async onTouchTap(
    ev: TouchTapEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    await this.applyCurrentSegmentColor(ev.action, ev.payload.settings);
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
    const cacheKey = this.getCacheKey(settings);
    if (cacheKey) {
      SegmentColorDialAction.segmentHueCache.set(cacheKey, {
        hue: next,
        isOn: this.powerMap.get(ctx) ?? true,
      });
    }
    this.suppressLiveSync(ctx);

    await this.updateDisplay(ev.action, settings);

    this.services.deferDialAction(
      ctx,
      async () => {
        const currentSettings = this.getCurrentSettings(ctx, settings);
        const finalHue = this.hueMap.get(ctx) ?? next;
        await this.applyToSegment(currentSettings, finalHue);
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
    if (!target.light.supportsSegmentedColor()) {
      streamDeck.logger.warn(
        `Segment color: selected light ${target.light.name} (${target.light.model}) does not support segmented color`,
      );
      throw new Error("Selected light does not support segmented color");
    }

    const saturation = clamp(settings.saturation ?? 100, 0, 100);
    const color = hsvToRgb(hue, saturation, 100);
    const segmentIndex = clamp((settings.segmentIndex ?? 1) - 1, 0, 14);
    streamDeck.logger.trace("segment.dial.apply", {
      deviceId: target.light.deviceId,
      model: target.light.model,
      segmentIndex,
      hue,
      saturation,
    });
    await this.services.setSegmentColors(target.light, [
      SegmentColor.create(segmentIndex, color),
    ]);
  }

  private async applyCurrentSegmentColor(
    action: DialAction<SegmentColorDialSettings & JsonObject>,
    fallbackSettings: SegmentColorDialSettings,
  ): Promise<void> {
    const ctx = action.id;
    const settings = this.getCurrentSettings(ctx, fallbackSettings);
    const hue = this.hueMap.get(ctx) ?? 0;

    try {
      await this.applyToSegment(settings, hue);
    } catch (error) {
      streamDeck.logger.error("Failed to apply segment color:", error);
      await action.showAlert();
    }
  }

  /**
   * Sync power state only. The Govee API does not expose per-segment color
   * state, so hue always starts at the default (0 °). Only power can be synced.
   */
  protected async syncLiveState(
    ctx: string,
    settings: SegmentColorDialSettings,
  ): Promise<void> {
    const cacheKey = this.getCacheKey(settings);
    if (cacheKey) {
      const cached = SegmentColorDialAction.segmentHueCache.get(cacheKey);
      if (cached) {
        this.powerMap.set(ctx, cached.isOn);
        this.hueMap.set(ctx, cached.hue);
      }
    }

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const isOn = await this.services.getLivePowerState(target.light);
        if (isOn !== undefined) {
          this.powerMap.set(ctx, isOn);
          if (cacheKey) {
            SegmentColorDialAction.segmentHueCache.set(cacheKey, {
              hue: this.hueMap.get(ctx) ?? 0,
              isOn,
            });
          }
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
    const segmentDisplay = settings.segmentIndex ?? 1;

    await action.setFeedback({
      label: `Segment ${segmentDisplay}`,
      value: isOn ? `${hue} °` : "Off",
      bar: { value: isOn ? Math.round((hue / 360) * 100) : 0 },
    });
  }

  private getCacheKey(settings: SegmentColorDialSettings): string | null {
    if (!settings.selectedDeviceId) {
      return null;
    }
    return `${settings.selectedDeviceId}|segment:${settings.segmentIndex ?? 1}`;
  }
}
