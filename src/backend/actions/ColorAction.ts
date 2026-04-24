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
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { telemetryService } from "../services/TelemetryService";
import { ColorPaletteService } from "../domain/services/ColorPaletteService";
import { ColorPreset } from "../domain/value-objects/ColorPalette";
import { globalSettingsService } from "../services/GlobalSettingsService";

type ColorSettings = BaseSettings & {
  colorValue?: string;
  colorName?: string;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.color" })
export class ColorAction extends SingletonAction<ColorSettings> {
  private services = new ActionServices();
  private paletteService = new ColorPaletteService();
  private paletteLoaded = false;

  private async ensurePaletteLoaded(): Promise<void> {
    if (this.paletteLoaded) return;
    const stored = await globalSettingsService.getRecentColors();
    this.paletteService.loadRecentColors(stored);
    this.paletteLoaded = true;
  }

  override async onWillAppear(
    ev: WillAppearEvent<ColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

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
      const color = ColorRgb.fromHex(hex);
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        // Clear overlay modes for single lights and groups (see #170).
        await this.services.ensurePreparedForTarget(ev.action.id, target);
        await this.services.controlTarget(target, "color", color);
      } finally {
        stopSpinner();
      }
      await ev.action.setTitle(this.getTitle(settings));
      await ev.action.showOk();

      // Track recent color usage
      await this.trackRecentColor(hex, settings.colorName);

      telemetryService.recordCommand({
        command: `${target.type}.color`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set color:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorSettings>,
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

  private getTitle(_settings: ColorSettings): string {
    return "";
  }
}
