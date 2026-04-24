import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { hsvToRgb } from "./shared/color-utils";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { SegmentColor } from "../domain/value-objects/SegmentColor";

type SegmentColorSettings = BaseSettings & {
  preset?: "rainbow" | "solid" | "gradient";
  segmentStart?: number;
  segmentEnd?: number;
  hue?: number; // used for solid
  hueStart?: number; // used for gradient
  hueEnd?: number; // used for gradient
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.segment-color" })
export class SegmentColorAction extends SingletonAction<SegmentColorSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<SegmentColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SegmentColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(
    ev: KeyDownEvent<SegmentColorSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      await ev.action.showAlert();
      return;
    }

    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target || target.type !== "light" || !target.light) {
      await ev.action.showAlert();
      return;
    }

    try {
      const segments = this.buildSegments(settings);
      await this.services.setSegmentColors(target.light, segments);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to set segment colors:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SegmentColorSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;
    switch (ev.payload.event) {
      case "getDevices":
        await this.services.handleGetDevices(ev.action.id);
        break;
      case "getDeviceDebug":
        await this.services.handleGetDeviceDebug(
          ev.action.id,
          typeof ev.payload.selectedDeviceId === "string"
            ? ev.payload.selectedDeviceId
            : undefined,
        );
        break;
      case "getGroups":
        await this.services.handleGetGroups(ev.action.id);
        break;
      case "saveGroup":
        await this.services.handleSaveGroup(ev.action.id, ev.payload);
        break;
      case "deleteGroup":
        await this.services.handleDeleteGroup(ev.action.id, ev.payload);
        break;
      case "refreshState":
        await this.services.handleRefreshState();
        break;
    }
  }

  private buildSegments(settings: SegmentColorSettings): SegmentColor[] {
    // UI stores 1-based indices (1–15), translate to 0-based (0–14) for the API
    const start = Math.max(0, Math.min(14, (settings.segmentStart ?? 1) - 1));
    const end = Math.max(start, Math.min(14, (settings.segmentEnd ?? 15) - 1));
    const count = end - start + 1;
    const preset = settings.preset ?? "rainbow";
    const segments: SegmentColor[] = [];

    // Limit unique colors to stay within Govee API rate limits (10 req/min).
    const maxColors = preset === "solid" ? 1 : Math.min(count, 5);

    for (let i = 0; i < count; i++) {
      const band = Math.floor((i * maxColors) / count);
      let hue: number;
      switch (preset) {
        case "solid":
          hue = settings.hue ?? 0;
          break;
        case "gradient": {
          const hStart = settings.hueStart ?? 0;
          const hEnd = settings.hueEnd ?? 360;
          hue = hStart + ((hEnd - hStart) * band) / Math.max(1, maxColors - 1);
          break;
        }
        case "rainbow":
        default:
          hue = (360 * band) / maxColors;
          break;
      }
      const color = hsvToRgb(hue, 100, 100);
      segments.push(
        SegmentColor.create(start + i, new ColorRgb(color.r, color.g, color.b)),
      );
    }
    return segments;
  }

  private getTitle(settings: SegmentColorSettings): string {
    const preset = settings.preset ?? "rainbow";
    // Display 1-based segment numbers to match the UI
    const start = settings.segmentStart ?? 1;
    const end = settings.segmentEnd ?? 15;
    const label = preset.charAt(0).toUpperCase() + preset.slice(1);
    return `${label}\n${start}-${end}`;
  }
}
