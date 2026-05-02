/**
 * Segment Color — unified keypad + encoder action.
 *
 * Keypad press applies a preset (rainbow/solid/gradient) across a
 * configurable segment range. Encoder rotation adjusts the hue of a
 * single chosen segment; encoder press toggles power.
 *
 * Same UUID for both controllers. Legacy SegmentColorDialAction stays
 * registered for existing dial bindings.
 */
import {
  action,
  type DialAction,
  type DialRotateEvent,
  type KeyDownEvent,
  type SendToPluginEvent,
  type WillDisappearEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { SegmentColor } from "../domain/value-objects/SegmentColor";
import type { Light } from "../domain/entities/Light";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { hsvToRgb } from "./shared/color-utils";
import { clamp } from "./shared/validation";

type SegmentColorSettings = BaseDialSettings & {
  // Keypad-mode settings
  preset?: "rainbow" | "solid" | "gradient";
  segmentStart?: number;
  segmentEnd?: number;
  hue?: number;
  hueStart?: number;
  hueEnd?: number;
  // Encoder-mode settings
  segmentIndex?: number;
  saturation?: number;
};

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG =
  "0:#FF0000,0.17:#FFFF00,0.33:#00FF00,0.5:#00FFFF,0.67:#0000FF,0.83:#FF00FF,1:#FF0000";

@action({ UUID: "com.felixgeelhaar.govee-light-management.segment-color" })
export class SegmentColorAction extends BaseDialAction<SegmentColorSettings> {
  /** Per-context hue for the encoder-mode single-segment dial. */
  private hueMap = new Map<string, number>();

  protected initValueMaps(ctx: string): void {
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.hueMap.delete(ctx);
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SegmentColorSettings>,
  ): Promise<void> {
    await super.onWillDisappear(ev);
    this.services.clearPartialFailureBanner(ev.action.id);
  }

  // ── Keypad ─────────────────────────────────────────────────────

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
    if (!target) {
      await ev.action.showAlert();
      return;
    }

    try {
      const segments = this.buildSegments(settings);
      if (target.type === "light" && target.light) {
        await this.services.setSegmentColors(target.light, segments);
      } else if (target.type === "group" && target.group) {
        const members = target.group.getControllableLights();
        let anySucceeded = false;
        let failedCount = 0;
        for (const light of members) {
          try {
            await this.services.setSegmentColors(light, segments);
            anySucceeded = true;
          } catch (error) {
            failedCount++;
            streamDeck.logger.warn(
              `Segment color apply failed for group member ${light.name}:`,
              error,
            );
          }
        }
        if (!anySucceeded) {
          await ev.action.showAlert();
          return;
        }
        if (failedCount > 0 && members.length > 0) {
          this.services.showPartialFailureBanner(
            ev.action,
            ev.action.id,
            failedCount,
            members.length,
            this.getKeypadTitle(settings),
          );
        }
      }
      this.powerMap.set(ev.action.id, true);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to set segment colors:", error);
      await ev.action.showAlert();
    }
  }

  // ── Encoder rotate (single segment hue) ──────────────────────

  override async onDialRotate(
    ev: DialRotateEvent<SegmentColorSettings>,
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
        await this.applyToSegment(settings, this.hueMap.get(ctx) ?? next);
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

  // ── Live state sync ──────────────────────────────────────────

  protected async syncLiveState(
    ctx: string,
    settings: SegmentColorSettings,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      let probeLight: Light | undefined;
      if (target?.type === "light" && target.light) {
        probeLight = target.light;
      } else if (target?.type === "group" && target.group) {
        const allMembers = target.group.lights;
        const members = target.group.getControllableLights();
        this.hasOfflineMember.set(ctx, members.length < allMembers.length);
        probeLight =
          members.find((l) => l.supportsSegmentedColor()) ?? members[0];
      }
      if (probeLight) {
        const isOn = await this.services.getLivePowerState(probeLight);
        if (isOn !== undefined) {
          this.powerMap.set(ctx, isOn);
        }
      }
    } catch {
      // Best effort - keep defaults
    }
  }

  // ── Title / LCD render ───────────────────────────────────────

  protected async updateDisplay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: DialAction<SegmentColorSettings & JsonObject> | any,
    settings: SegmentColorSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const isOn = this.powerMap.get(ctx) ?? true;

    if (typeof action.setFeedback === "function") {
      // Encoder mode: show the dial-rotated single-segment hue.
      const hue = this.hueMap.get(ctx) ?? 0;
      const segmentDisplay = settings.segmentIndex ?? 1;
      try {
        await action.setFeedback({
          label: `Segment ${segmentDisplay}`,
          value: isOn ? `${hue} °` : "Off",
          bar: { value: isOn ? Math.round((hue / 360) * 100) : 0 },
        });
      } catch {
        // No-op if action disappeared mid-render.
      }
    } else if (typeof action.setTitle === "function") {
      try {
        if (typeof action.setState === "function") {
          await action.setState(isOn ? 0 : 1);
        }
        const glyph = isOn ? "●" : "○";
        await action.setTitle(`${this.getKeypadTitle(settings)}\n${glyph}`);
      } catch {
        // No-op if action disappeared mid-render.
      }
    }
  }

  protected override async handleCustomPIEvent(
    _ev: SendToPluginEvent<JsonValue, SegmentColorSettings>,
  ): Promise<void> {
    // No segment-specific PI events.
  }

  // ── Helpers ──────────────────────────────────────────────────

  private getKeypadTitle(settings: SegmentColorSettings): string {
    const preset = settings.preset ?? "rainbow";
    const start = settings.segmentStart ?? 1;
    const end = settings.segmentEnd ?? 15;
    const label = preset.charAt(0).toUpperCase() + preset.slice(1);
    return `${label}\n${start}-${end}`;
  }

  private buildSegments(settings: SegmentColorSettings): SegmentColor[] {
    const start = Math.max(0, Math.min(14, (settings.segmentStart ?? 1) - 1));
    const end = Math.max(start, Math.min(14, (settings.segmentEnd ?? 15) - 1));
    const count = end - start + 1;
    const preset = settings.preset ?? "rainbow";
    const segments: SegmentColor[] = [];

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

  /**
   * Encoder-mode apply: write the dialled hue at saturation/100 to the
   * single segment selected via `segmentIndex`. Mirrors the legacy
   * SegmentColorDialAction.applyToSegment so behaviour is unchanged
   * for existing users who migrate to the unified action.
   */
  private async applyToSegment(
    settings: SegmentColorSettings,
    hue: number,
  ): Promise<void> {
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) return;
    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target) return;

    const saturation = clamp(settings.saturation ?? 100, 0, 100);
    const color = hsvToRgb(hue, saturation, 100);
    const segmentIndex = clamp((settings.segmentIndex ?? 1) - 1, 0, 14);
    const segments = [
      SegmentColor.create(
        segmentIndex,
        new ColorRgb(color.r, color.g, color.b),
      ),
    ];

    if (target.type === "light" && target.light) {
      if (!target.light.supportsSegmentedColor()) {
        throw new Error("Selected light does not support segmented color");
      }
      await this.services.setSegmentColors(target.light, segments);
      return;
    }
    if (target.type === "group" && target.group) {
      const capable = target.group
        .getControllableLights()
        .filter((l) => l.supportsSegmentedColor());
      if (capable.length === 0) {
        throw new Error("Group has no segmented-color-capable lights");
      }
      let anySucceeded = false;
      for (const light of capable) {
        try {
          await this.services.setSegmentColors(light, segments);
          anySucceeded = true;
        } catch (error) {
          streamDeck.logger.warn(
            `Segment color: apply failed for group member ${light.name}:`,
            error,
          );
        }
      }
      if (!anySucceeded) {
        throw new Error("Segment color failed for all group members");
      }
    }
  }
}
