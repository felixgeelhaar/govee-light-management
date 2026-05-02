/**
 * Color — unified keypad + encoder action.
 *
 * Keypad press sets the colour to a fixed `colorValue` (hex) from
 * settings. Encoder rotation adjusts hue by `stepSize` (with the
 * configured saturation). Encoder press toggles power.
 *
 * Same UUID for both controllers — Stream Deck routes the right
 * handler based on placement. Legacy ColorHueDialAction (different
 * UUID) stays registered so existing dial bindings keep working.
 */
import {
  action,
  type DialAction,
  type DialRotateEvent,
  type KeyDownEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { BaseDialAction, type BaseDialSettings } from "./shared/BaseDialAction";
import { hsvToRgb, rgbToHue } from "./shared/color-utils";
import { clamp } from "./shared/validation";
import { telemetryService } from "../services/TelemetryService";
import { ColorPaletteService } from "../domain/services/ColorPaletteService";
import { ColorPreset } from "../domain/value-objects/ColorPalette";
import { globalSettingsService } from "../services/GlobalSettingsService";

type ColorSettings = BaseDialSettings & {
  colorValue?: string;
  colorName?: string;
  saturation?: number;
};

const DEFAULT_BAR_FILL = "#FFFFFF";
const DEFAULT_BAR_BG =
  "0:#FF0000,0.17:#FFFF00,0.33:#00FF00,0.5:#00FFFF,0.67:#0000FF,0.83:#FF00FF,1:#FF0000";

@action({ UUID: "com.felixgeelhaar.govee-light-management.color" })
export class ColorAction extends BaseDialAction<ColorSettings> {
  private hueMap = new Map<string, number>();
  private displayModeMap = new Map<string, "single" | "group" | "mixed">();
  private paletteService = new ColorPaletteService();
  private paletteLoaded = false;

  protected initValueMaps(ctx: string): void {
    if (!this.hueMap.has(ctx)) this.hueMap.set(ctx, 0);
    if (!this.displayModeMap.has(ctx)) this.displayModeMap.set(ctx, "single");
  }

  protected cleanupValueMaps(ctx: string): void {
    this.hueMap.delete(ctx);
    this.displayModeMap.delete(ctx);
  }

  private async ensurePaletteLoaded(): Promise<void> {
    if (this.paletteLoaded) return;
    const stored = await globalSettingsService.getRecentColors();
    this.paletteService.loadRecentColors(stored);
    this.paletteLoaded = true;
  }

  // ── Keypad ─────────────────────────────────────────────────────

  override async onKeyDown(ev: KeyDownEvent<ColorSettings>): Promise<void> {
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
      const hex = settings.colorValue || "#ffffff";
      // Govee's setColor rejects RGB(0,0,0) — black isn't a colour the
      // device can produce, it's the absence of light. Treat hex
      // `#000000` (or hex/whitespace equivalents) as "turn off" so
      // users who pick black in the colour picker get the intuitive
      // result instead of a silent rate-limited rejection.
      const normalizedHex = hex.replace(/[^0-9a-f]/gi, "").toLowerCase();
      const isBlack =
        normalizedHex === "000000" ||
        normalizedHex === "000" ||
        normalizedHex === "";
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        if (isBlack) {
          await this.services.controlTarget(target, "off");
          this.powerMap.set(ev.action.id, false);
        } else {
          const color = ColorRgb.fromHex(hex);
          await this.services.ensurePreparedForTarget(ev.action.id, target);
          await this.services.controlTarget(target, "color", color);
          // Optimistic local hue + on so the next sync doesn't briefly flip.
          this.hueMap.set(ev.action.id, rgbToHue(color));
          this.powerMap.set(ev.action.id, true);
        }
      } finally {
        stopSpinner();
      }
      await ev.action.showOk();

      if (!isBlack) {
        await this.trackRecentColor(hex, settings.colorName);
      }

      telemetryService.recordCommand({
        command: `${target.type}.${isBlack ? "off" : "color"}`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set color:", error);
      await ev.action.showAlert();
    }
  }

  // ── Encoder rotate ────────────────────────────────────────────

  override async onDialRotate(
    ev: DialRotateEvent<ColorSettings>,
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
        await this.services.controlTarget(
          target,
          "color",
          new ColorRgb(color.r, color.g, color.b),
        );
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

  // ── Live state sync ───────────────────────────────────────────

  protected async syncLiveState(
    ctx: string,
    settings: ColorSettings,
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
        const allMembers = target.group.lights;
        const lights = target.group.getControllableLights();
        this.hasOfflineMember.set(ctx, lights.length < allMembers.length);
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

  // ── Title / LCD render ────────────────────────────────────────

  protected async updateDisplay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: DialAction<ColorSettings & JsonObject> | any,
    _settings: ColorSettings,
  ): Promise<void> {
    const ctx = action.id || "default";
    const hue = this.hueMap.get(ctx) ?? 0;
    const isOn = this.powerMap.get(ctx) ?? true;
    const displayMode = this.displayModeMap.get(ctx) ?? "single";
    const indicator =
      displayMode === "mixed" ? "🔀 " : displayMode === "group" ? "👥 " : "";
    const value = !isOn ? "Off" : `${indicator}${hue} °`;

    if (typeof action.setFeedback === "function") {
      try {
        await action.setFeedback({
          label: "Color",
          value,
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
        const glyph = displayMode === "mixed" ? "◐" : isOn ? "●" : "○";
        await action.setTitle(`${value}\n${glyph}`);
      } catch {
        // No-op if action disappeared mid-render.
      }
    }
  }

  // ── PI dispatch ───────────────────────────────────────────────

  protected override async handleCustomPIEvent(
    ev: SendToPluginEvent<JsonValue, ColorSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

    switch (ev.payload.event) {
      case "getColorPalettes":
        await this.handleGetColorPalettes(ev.action.id);
        break;
      case "getRecentColors":
        await this.handleGetRecentColors(ev.action.id);
        break;
      case "clearRecentColors":
        await this.handleClearRecentColors(ev.action.id);
        break;
    }
  }

  private async handleGetColorPalettes(actionId: string): Promise<void> {
    const palettes = this.paletteService.getPresetPalettes().map((palette) => ({
      name: palette.name,
      colors: palette.colors.map((c) => ({ hex: c.hex, name: c.name })),
    }));
    await streamDeck.ui.sendToPropertyInspector({
      event: "colorPalettes",
      items: palettes,
    });
    void actionId;
  }

  private async handleGetRecentColors(actionId: string): Promise<void> {
    await this.ensurePaletteLoaded();
    const recent = this.paletteService
      .getRecentColors()
      .map((c) => ({ hex: c.hex, name: c.name }));
    await streamDeck.ui.sendToPropertyInspector({
      event: "recentColors",
      items: recent,
    });
    void actionId;
  }

  private async handleClearRecentColors(actionId: string): Promise<void> {
    await this.ensurePaletteLoaded();
    this.paletteService.clearRecentColors();
    await globalSettingsService.setRecentColors([]);
    await streamDeck.ui.sendToPropertyInspector({
      event: "recentColors",
      items: [],
    });
    void actionId;
  }

  private async trackRecentColor(hex: string, name?: string): Promise<void> {
    try {
      await this.ensurePaletteLoaded();
      this.paletteService.addRecentColor(
        new ColorPreset(hex, name ?? "Custom"),
      );
      await globalSettingsService.setRecentColors(
        this.paletteService.exportRecentColors(),
      );
    } catch (error) {
      streamDeck.logger.error("Failed to track recent color:", error);
    }
  }

  private getAverageHue(values: number[]): number {
    if (values.length === 0) return 0;
    const radians = values.map((value) => (value * Math.PI) / 180);
    const x = radians.reduce((sum, value) => sum + Math.cos(value), 0);
    const y = radians.reduce((sum, value) => sum + Math.sin(value), 0);
    if (x === 0 && y === 0) return Math.round(values[0] ?? 0);
    const angle = Math.atan2(y, x);
    return Math.round(((angle * 180) / Math.PI + 360) % 360);
  }
}
