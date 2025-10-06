import {
  action,
  DialRotateEvent,
  DialDownEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  type JsonValue,
  streamDeck,
} from "@elgato/streamdeck";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { Light } from "../domain/entities/Light";
import { SegmentColor } from "../domain/value-objects/SegmentColor";
import { ColorRgb } from "@felixgeelhaar/govee-api-client";
import { globalSettingsService } from "../services/GlobalSettingsService";

type SegmentColorDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  segmentIndex?: number; // 0-14 for 15-segment lights
  hue?: number; // 0-360 degrees
  saturation?: number; // 0-100
  brightness?: number; // 0-100
  stepSize?: number; // Degrees per tick (default: 15)
};

/**
 * Stream Deck+ encoder action for controlling individual segment colors on RGB IC lights
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.segment-color-dial" })
export class SegmentColorDialAction extends SingletonAction<SegmentColorDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private currentLight?: Light;
  private currentApiKey?: string;
  private currentHue: number = 0;
  private currentSaturation: number = 100;
  private currentBrightness: number = 100;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

    // Initialize color values from settings
    this.currentHue = settings.hue ?? 0;
    this.currentSaturation = settings.saturation ?? 100;
    this.currentBrightness = settings.brightness ?? 100;

    // Set initial title based on configuration
    await this.updateDisplay(ev.action, settings);

    // Load current light if configured
    if (
      settings.selectedDeviceId &&
      settings.selectedModel &&
      this.lightRepository
    ) {
      try {
        const foundLight = await this.lightRepository.findLight(
          settings.selectedDeviceId,
          settings.selectedModel,
        );
        this.currentLight = foundLight || undefined;
        if (this.currentLight) {
          await this.lightRepository.getLightState(this.currentLight);
          await this.updateDisplay(ev.action, settings);
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
      }
    }
  }

  /**
   * Handle dial rotation - adjust hue value
   */
  override async onDialRotate(
    ev: DialRotateEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    const { settings, ticks } = ev.payload;

    if (!this.isConfigured(settings)) {
      return;
    }

    const stepSize = settings.stepSize || 15;
    const change = ticks * stepSize;

    // Update hue with wrapping at 360 degrees
    this.currentHue = (this.currentHue + change + 360) % 360;

    // Update settings
    await ev.action.setSettings({
      ...settings,
      hue: this.currentHue,
    });

    // Update display with new color
    await this.updateDisplay(ev.action, settings);
  }

  /**
   * Handle dial press - apply segment color to light
   */
  override async onDialDown(
    ev: DialDownEvent<SegmentColorDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Segment color action not properly configured");
      return;
    }

    if (!this.currentLight || !this.lightRepository) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    // Check if light supports segment colors
    if (!this.currentLight.supportsSegmentedColor()) {
      await ev.action.showAlert();
      streamDeck.logger.warn(
        `Light ${this.currentLight.name} does not support segment colors`,
      );
      return;
    }

    try {
      const rgb = this.hsvToRgb(
        this.currentHue,
        this.currentSaturation,
        this.currentBrightness,
      );
      const color = new ColorRgb(rgb.r, rgb.g, rgb.b);
      const segmentIndex = settings.segmentIndex ?? 0;
      const segment = SegmentColor.create(segmentIndex, color);

      await this.lightRepository.setSegmentColors(this.currentLight, [segment]);
      streamDeck.logger.info(
        `Applied color to segment ${segmentIndex + 1} on ${this.currentLight.name}`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to apply segment color:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SegmentColorDialSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) {
      return;
    }

    const settings = await ev.action.getSettings();

    switch (ev.payload.event) {
      case "validateApiKey":
        await this.handleValidateApiKey(ev);
        break;
      case "getLights":
        await this.handleGetLights(ev, settings);
        break;
    }
  }

  /**
   * Initialize repositories
   */
  private async ensureServices(apiKey?: string): Promise<void> {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.lightRepository = new GoveeLightRepository(apiKey, true);
      this.currentApiKey = apiKey;
      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger?.warn("Failed to persist API key globally", error);
      }
    }
  }

  /**
   * Check if action is properly configured
   */
  private isConfigured(settings: SegmentColorDialSettings): boolean {
    return !!(
      settings.apiKey &&
      settings.selectedDeviceId &&
      settings.selectedModel &&
      settings.segmentIndex !== undefined
    );
  }

  /**
   * Update action display with current color and segment info
   */
  private async updateDisplay(
    action: any,
    settings: SegmentColorDialSettings,
  ): Promise<void> {
    const title = this.getActionTitle(settings);
    await action.setTitle(title);

    // Set feedback bar with current color
    const rgb = this.hsvToRgb(
      this.currentHue,
      this.currentSaturation,
      this.currentBrightness,
    );
    const hexColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

    await action.setFeedback({
      bar: {
        value: Math.round((this.currentHue / 360) * 100),
        subtype: 2, // Rainbow gradient
        bar_bg_c: hexColor,
      },
    });
  }

  /**
   * Get action title based on configuration
   */
  private getActionTitle(settings: SegmentColorDialSettings): string {
    if (!settings.selectedLightName) {
      return "Segment";
    }

    const segmentNumber = (settings.segmentIndex ?? 0) + 1;
    const lightName =
      settings.selectedLightName.length > 10
        ? settings.selectedLightName.substring(0, 7) + "..."
        : settings.selectedLightName;

    return `${lightName}\nSeg ${segmentNumber}`;
  }

  /**
   * Convert HSV to RGB
   */
  private hsvToRgb(
    h: number,
    s: number,
    v: number,
  ): { r: number; g: number; b: number } {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const vNorm = v / 100;

    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
    const m = vNorm - c;

    let r = 0,
      g = 0,
      b = 0;
    const hSextant = Math.floor(hNorm * 6);

    if (hSextant === 0) {
      r = c;
      g = x;
      b = 0;
    } else if (hSextant === 1) {
      r = x;
      g = c;
      b = 0;
    } else if (hSextant === 2) {
      r = 0;
      g = c;
      b = x;
    } else if (hSextant === 3) {
      r = 0;
      g = x;
      b = c;
    } else if (hSextant === 4) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  /**
   * Convert RGB to hex color string
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Handle API key validation
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, SegmentColorDialSettings>,
  ): Promise<void> {
    if (
      !(ev.payload instanceof Object) ||
      !("apiKey" in ev.payload) ||
      typeof ev.payload.apiKey !== "string"
    ) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: false,
        error: "Invalid API key format",
      });
      return;
    }

    try {
      await this.ensureServices(ev.payload.apiKey);
      if (this.lightRepository) {
        await this.lightRepository.getAllLights();
      }
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: true,
      });
    } catch (error) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handle get lights request
   */
  private async handleGetLights(
    ev: SendToPluginEvent<JsonValue, SegmentColorDialSettings>,
    settings: SegmentColorDialSettings,
  ): Promise<void> {
    await this.ensureServices(settings.apiKey);

    if (!this.lightRepository) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lights",
        lights: [],
        error: "API key not configured",
      });
      return;
    }

    try {
      const allLights = await this.lightRepository.getAllLights();
      // Only return lights that support segment colors
      const segmentLights = allLights.filter((light) =>
        light.supportsSegmentedColor(),
      );

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lights",
        lights: segmentLights.map((light) => ({
          deviceId: light.deviceId,
          model: light.model,
          name: light.name,
          isOnline: light.isOnline,
        })),
      });
    } catch (error) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lights",
        lights: [],
        error: error instanceof Error ? error.message : "Failed to get lights",
      });
    }
  }
}
