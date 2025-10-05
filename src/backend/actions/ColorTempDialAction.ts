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
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { telemetryService } from "../services/TelemetryService";
import { globalSettingsService } from "../services/GlobalSettingsService";

type ColorTempDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  stepSize?: number; // Color temperature change per tick in Kelvin (default: 100)
};

/**
 * Stream Deck+ encoder action for controlling color temperature with a dial
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.colortemp-dial" })
export class ColorTempDialAction extends SingletonAction<ColorTempDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;
  private currentColorTemp: number = 6500; // Track current color temperature in Kelvin

  // Color temperature range for Govee lights
  private readonly MIN_COLOR_TEMP = 2000; // Warm white
  private readonly MAX_COLOR_TEMP = 9000; // Cool white

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ColorTempDialSettings>,
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
          // Get current color temperature
          await this.lightRepository.getLightState(this.currentLight);
          this.currentColorTemp = this.currentLight.colorTemperature
            ? this.currentLight.colorTemperature.kelvin
            : 6500;

          // Update display
          await this.updateDisplay(ev.action, settings);
        } else {
          await ev.action.setTitle("Configure\nColor Temp");
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
        await ev.action.setTitle("Configure\nColor Temp");
      }
    } else {
      await ev.action.setTitle("Configure\nColor Temp");
    }
  }

  /**
   * Handle dial rotation events
   */
  override async onDialRotate(
    ev: DialRotateEvent<ColorTempDialSettings>,
  ): Promise<void> {
    const { settings, ticks } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn(
        "Color temperature dial action not properly configured",
      );
      return;
    }

    if (!this.currentLight || !this.lightControlService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    try {
      const stepSize = settings.stepSize || 100; // Default 100K per tick
      const colorTempChange = ticks * stepSize;

      // Calculate new color temperature, clamped between 2000K and 9000K
      let newColorTemp = this.currentColorTemp + colorTempChange;
      newColorTemp = Math.max(
        this.MIN_COLOR_TEMP,
        Math.min(this.MAX_COLOR_TEMP, newColorTemp),
      );

      // Only send command if color temperature actually changed
      if (newColorTemp !== this.currentColorTemp) {
        this.currentColorTemp = newColorTemp;

        const colorTemp = new ColorTemperature(newColorTemp);
        const started = Date.now();

        try {
          await this.lightControlService.controlLight(
            this.currentLight,
            "colorTemperature",
            colorTemp,
          );

          telemetryService.recordCommand({
            command: "colorTemperature",
            durationMs: Date.now() - started,
            success: true,
          });

          // Update visual feedback
          await this.updateDisplay(ev.action, settings);
        } catch (error) {
          telemetryService.recordCommand({
            command: "colorTemperature",
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
        // Just update feedback to show we're at min/max
        await this.updateDisplay(ev.action, settings);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to adjust color temperature:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle dial press (toggle power)
   */
  override async onDialDown(
    ev: DialDownEvent<ColorTempDialSettings>,
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
    ev: DialUpEvent<ColorTempDialSettings>,
  ): Promise<void> {
    // Visual feedback is handled through the dial's temperature gradient bar display
    // No additional action needed - the updated temperature value is shown automatically
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorTempDialSettings>,
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
  private isConfigured(settings: ColorTempDialSettings): boolean {
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
    settings: ColorTempDialSettings,
  ): Promise<void> {
    // Update title with light name and color temperature
    const lightName = settings.selectedLightName || "Light";
    const displayName =
      lightName.length > 10 ? lightName.substring(0, 10) + "..." : lightName;
    await action.setTitle(`${displayName}\n${this.currentColorTemp}K`);

    // Calculate normalized value for feedback bar (0-100)
    const normalizedValue = Math.round(
      ((this.currentColorTemp - this.MIN_COLOR_TEMP) /
        (this.MAX_COLOR_TEMP - this.MIN_COLOR_TEMP)) *
        100,
    );

    // Update feedback with color gradient indicator
    const feedbackPayload = {
      value: normalizedValue,
      opacity: this.currentLight?.isOn ? 1 : 0.3,
      bar: {
        value: normalizedValue,
        opacity: this.currentLight?.isOn ? 1 : 0.3,
        subtype: 1, // Gradient bar (warm to cool)
      },
    };

    await action.setFeedback(feedbackPayload);
  }

  /**
   * Handle API key validation from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, ColorTempDialSettings>,
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
    _ev: SendToPluginEvent<JsonValue, ColorTempDialSettings>,
    settings: ColorTempDialSettings,
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
        .filter((light) => light.capabilities?.colorTemperature ?? false) // Only show lights with color temp control
        .map((light) => ({
          label: `${light.label ?? light.name} (${light.model})`,
          value: `${light.deviceId}|${light.model}`,
        }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger.info(
        `Sent ${lightItems.length} color-temperature-capable lights to property inspector`,
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
    ev: SendToPluginEvent<JsonValue, ColorTempDialSettings>,
  ): Promise<void> {
    const payload = ev.payload as { settings?: ColorTempDialSettings };
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
            this.currentColorTemp = this.currentLight.colorTemperature
              ? this.currentLight.colorTemperature.kelvin
              : 6500;
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
