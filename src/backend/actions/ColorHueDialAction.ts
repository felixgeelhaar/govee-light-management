import {
  action,
  DialRotateEvent,
  DialDownEvent,
  DialUpEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  type JsonValue,
  streamDeck,
} from "@elgato/streamdeck";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { Light } from "../domain/entities/Light";
import { ColorRgb } from "@felixgeelhaar/govee-api-client";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { telemetryService } from "../services/TelemetryService";
import { globalSettingsService } from "../services/GlobalSettingsService";

type ColorHueDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  stepSize?: number; // Hue change per tick in degrees (default: 15)
  saturation?: number; // Saturation percentage (default: 100)
};

/**
 * Stream Deck+ encoder action for controlling color hue with a dial
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.colorhue-dial" })
export class ColorHueDialAction extends SingletonAction<ColorHueDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;
  private currentHue: number = 0; // Track current hue in degrees (0-360)

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ColorHueDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

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
          // Get current color state
          await this.lightRepository.getLightState(this.currentLight);
          if (this.currentLight.color) {
            // Convert RGB to HSV to get current hue
            this.currentHue = this.rgbToHue(this.currentLight.color);
          } else {
            this.currentHue = 0; // Default to red
          }

          // Update display
          await this.updateDisplay(ev.action, settings);
        } else {
          await ev.action.setTitle("Configure\nColor Hue");
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
        await ev.action.setTitle("Configure\nColor Hue");
      }
    } else {
      await ev.action.setTitle("Configure\nColor Hue");
    }
  }

  /**
   * Handle dial rotation events
   */
  override async onDialRotate(
    ev: DialRotateEvent<ColorHueDialSettings>,
  ): Promise<void> {
    const { settings, ticks } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Color hue dial action not properly configured");
      return;
    }

    if (!this.currentLight || !this.lightControlService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    // Check if light supports color
    if (!this.currentLight.capabilities.color) {
      await ev.action.showAlert();
      streamDeck.logger.warn(
        "Selected light does not support color control",
      );
      return;
    }

    try {
      const stepSize = settings.stepSize || 15; // Default 15° per tick
      const hueChange = ticks * stepSize;

      // Calculate new hue with wrapping (0-360)
      let newHue = this.currentHue + hueChange;

      // Wrap around 360°
      while (newHue < 0) newHue += 360;
      while (newHue >= 360) newHue -= 360;

      // Only send command if hue actually changed
      if (newHue !== this.currentHue) {
        this.currentHue = newHue;

        // Convert HSV to RGB
        const saturation = settings.saturation || 100;
        const rgb = this.hsvToRgb(newHue, saturation, 100);
        const color = new ColorRgb(rgb.r, rgb.g, rgb.b);
        const started = Date.now();

        try {
          await this.lightControlService.controlLight(
            this.currentLight,
            "color",
            color,
          );

          telemetryService.recordCommand({
            command: "color",
            durationMs: Date.now() - started,
            success: true,
          });

          // Update visual feedback
          await this.updateDisplay(ev.action, settings);
        } catch (error) {
          telemetryService.recordCommand({
            command: "color",
            durationMs: Date.now() - started,
            success: false,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: "UnknownError", message: String(error) },
          });
          throw error;
        }
      } else {
        // Just update feedback to show current state
        await this.updateDisplay(ev.action, settings);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to adjust hue:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle dial press (toggle power)
   */
  override async onDialDown(
    ev: DialDownEvent<ColorHueDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      return;
    }

    if (!this.currentLight || !this.lightControlService) {
      await ev.action.showAlert();
      return;
    }

    try {
      const nextState = this.currentLight.isOn ? "off" : "on";
      const started = Date.now();

      try {
        await this.lightControlService.controlLight(
          this.currentLight,
          nextState,
        );

        telemetryService.recordCommand({
          command: `power.${nextState}`,
          durationMs: Date.now() - started,
          success: true,
        });

        // Update display to reflect new power state
        await this.updateDisplay(ev.action, settings);
      } catch (error) {
        telemetryService.recordCommand({
          command: `power.${nextState}`,
          durationMs: Date.now() - started,
          success: false,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: "UnknownError", message: String(error) },
        });
        throw error;
      }
    } catch (error) {
      streamDeck.logger.error("Failed to toggle power:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle dial release
   */
  override async onDialUp(
    ev: DialUpEvent<ColorHueDialSettings>,
  ): Promise<void> {
    // Provide visual feedback that operation completed
    await ev.action.showOk();
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorHueDialSettings>,
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
      case "setSettings":
        await this.handleSetSettings(ev);
        break;
    }
  }

  /**
   * Initialize repositories and services
   */
  private async ensureServices(apiKey?: string): Promise<void> {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.lightRepository = new GoveeLightRepository(apiKey, true);
      this.lightControlService = new LightControlService(this.lightRepository);
      this.currentApiKey = apiKey;
      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger?.warn("Failed to persist API key globally", error);
      }
    }

    if (!this.transportOrchestrator) {
      const cloudTransport = new CloudTransport();
      this.transportOrchestrator = new TransportOrchestrator({
        [TransportKind.Cloud]: cloudTransport,
      });
      this.healthService = new TransportHealthService(
        this.transportOrchestrator,
        streamDeck.logger,
      );
      this.deviceService = new DeviceService(this.transportOrchestrator, {
        logger: streamDeck.logger,
      });
    }
  }

  /**
   * Check if action is properly configured
   */
  private isConfigured(settings: ColorHueDialSettings): boolean {
    return !!(
      settings.apiKey &&
      settings.selectedDeviceId &&
      settings.selectedModel
    );
  }

  /**
   * Update visual display (title and feedback)
   */
  private async updateDisplay(
    action: any,
    settings: ColorHueDialSettings,
  ): Promise<void> {
    // Update title with light name and hue
    const lightName = settings.selectedLightName || "Light";
    const displayName =
      lightName.length > 10 ? lightName.substring(0, 10) + "..." : lightName;
    await action.setTitle(`${displayName}\n${Math.round(this.currentHue)}°`);

    // Get RGB color for current hue
    const saturation = settings.saturation || 100;
    const rgb = this.hsvToRgb(this.currentHue, saturation, 100);

    // Calculate normalized value for feedback bar (hue position on color wheel)
    const normalizedValue = Math.round((this.currentHue / 360) * 100);

    // Update feedback with color indicator
    const feedbackPayload = {
      value: normalizedValue,
      opacity: this.currentLight?.isOn ? 1 : 0.3,
      bar: {
        value: normalizedValue,
        opacity: this.currentLight?.isOn ? 1 : 0.3,
        subtype: 2, // Rainbow gradient bar
        // Custom color feedback (current color)
        color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      },
    };

    await action.setFeedback(feedbackPayload);
  }

  /**
   * Convert RGB to Hue (in degrees)
   */
  private rgbToHue(color: ColorRgb): number {
    const r = color.red / 255;
    const g = color.green / 255;
    const b = color.blue / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return 0;

    let hue: number;
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }

    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;

    return hue;
  }

  /**
   * Convert HSV to RGB
   */
  private hsvToRgb(
    hue: number,
    saturation: number,
    value: number,
  ): { r: number; g: number; b: number } {
    const s = saturation / 100;
    const v = value / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = v - c;

    let r = 0,
      g = 0,
      b = 0;

    if (hue >= 0 && hue < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (hue >= 60 && hue < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (hue >= 120 && hue < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (hue >= 180 && hue < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (hue >= 240 && hue < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (hue >= 300 && hue < 360) {
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
   * Handle API key validation from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, ColorHueDialSettings>,
  ): Promise<void> {
    const payload = ev.payload as { apiKey?: string };
    const apiKey = payload.apiKey;

    if (!apiKey) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "API key is required",
      });
      return;
    }

    try {
      const testRepository = new GoveeLightRepository(apiKey, true);
      await testRepository.getAllLights();

      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger.warn("Failed to persist API key globally", error);
      }

      await this.ensureServices(apiKey);

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: true,
      });

      streamDeck.logger.info("API key validated successfully");
    } catch (error) {
      streamDeck.logger.error("API key validation failed:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "Invalid API key or network error",
      });
    }
  }

  /**
   * Handle request for available lights from property inspector
   */
  private async handleGetLights(
    _ev: SendToPluginEvent<JsonValue, ColorHueDialSettings>,
    settings: ColorHueDialSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        error: "API key required to fetch lights",
      });
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      if (!this.deviceService) {
        throw new Error("Device service unavailable");
      }

      const lights = await this.deviceService.discover(true);
      const lightItems = lights
        .filter((light) => light.capabilities.color) // Only show lights with color control
        .map((light) => ({
          label: `${light.label ?? light.name} (${light.model})`,
          value: `${light.deviceId}|${light.model}`,
        }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger.info(
        `Sent ${lightItems.length} color-capable lights to property inspector`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to fetch lights:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        error: "Failed to fetch lights. Check your API key and connection.",
      });
    }
  }

  /**
   * Handle settings update from property inspector
   */
  private async handleSetSettings(
    ev: SendToPluginEvent<JsonValue, ColorHueDialSettings>,
  ): Promise<void> {
    const payload = ev.payload as { settings?: ColorHueDialSettings };
    const newSettings = payload.settings;

    if (!newSettings) {
      return;
    }

    try {
      await ev.action.setSettings(newSettings);

      if (newSettings.apiKey) {
        await this.ensureServices(newSettings.apiKey);
      }

      // Update current light if selection changed
      if (
        newSettings.selectedDeviceId &&
        newSettings.selectedModel &&
        this.lightRepository
      ) {
        try {
          const foundLight = await this.lightRepository.findLight(
            newSettings.selectedDeviceId,
            newSettings.selectedModel,
          );
          this.currentLight = foundLight || undefined;
          if (this.currentLight) {
            await this.lightRepository.getLightState(this.currentLight);
            if (this.currentLight.color) {
              this.currentHue = this.rgbToHue(this.currentLight.color);
            } else {
              this.currentHue = 0;
            }
          }
        } catch (error) {
          streamDeck.logger.error("Failed to load selected light:", error);
        }
      }

      streamDeck.logger.info("Settings updated successfully");
    } catch (error) {
      streamDeck.logger.error("Failed to update settings:", error);
    }
  }
}
