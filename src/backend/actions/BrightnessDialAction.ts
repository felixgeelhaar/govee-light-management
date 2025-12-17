import {
  action,
  DialRotateEvent,
  DialDownEvent,
  DialUpEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { Light } from "../domain/entities/Light";
import { Brightness } from "@felixgeelhaar/govee-api-client";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { telemetryService } from "../services/TelemetryService";
import { globalSettingsService } from "../services/GlobalSettingsService";
import {
  ApiResponseValidator,
  BrightnessDialSettingsSchema,
} from "../infrastructure/validation";

type BrightnessDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  stepSize?: number; // Brightness change per tick (default: 5)
};

/**
 * Stream Deck+ encoder action for controlling light brightness with a dial
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness-dial" })
export class BrightnessDialAction extends SingletonAction<BrightnessDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;
  private currentBrightness: number = 50; // Track current brightness level

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<BrightnessDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    // Validate settings with Zod schema
    const validatedSettings = ApiResponseValidator.safeParse(
      BrightnessDialSettingsSchema,
      settings,
      "BrightnessDialSettings",
    );

    // Use validated settings or fall back to original (for backwards compatibility)
    const safeSettings = validatedSettings || settings;

    await this.ensureServices(safeSettings.apiKey);

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
          // Get current brightness
          await this.lightRepository.getLightState(this.currentLight);
          this.currentBrightness = this.currentLight.brightness
            ? this.currentLight.brightness.level
            : 50;

          // Update display
          await this.updateDisplay(ev.action, settings);
        } else {
          await ev.action.setTitle("Configure\nBrightness");
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
        await ev.action.setTitle("Configure\nBrightness");
      }
    } else {
      await ev.action.setTitle("Configure\nBrightness");
    }
  }

  /**
   * Handle dial rotation events
   */
  override async onDialRotate(
    ev: DialRotateEvent<BrightnessDialSettings>,
  ): Promise<void> {
    const { settings, ticks } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Brightness dial action not properly configured");
      return;
    }

    if (!this.currentLight || !this.lightControlService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    try {
      const stepSize = settings.stepSize || 5;
      const brightnessChange = ticks * stepSize;

      // Calculate new brightness, clamped between 1 and 100
      let newBrightness = this.currentBrightness + brightnessChange;
      newBrightness = Math.max(1, Math.min(100, newBrightness));

      // Only send command if brightness actually changed
      if (newBrightness !== this.currentBrightness) {
        this.currentBrightness = newBrightness;

        const brightness = new Brightness(newBrightness);
        const started = Date.now();

        try {
          await this.lightControlService.controlLight(
            this.currentLight,
            "brightness",
            brightness,
          );

          telemetryService.recordCommand({
            command: "brightness",
            durationMs: Date.now() - started,
            success: true,
          });

          // Update visual feedback
          await this.updateDisplay(ev.action, settings);
        } catch (error) {
          telemetryService.recordCommand({
            command: "brightness",
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
      streamDeck.logger.error("Failed to adjust brightness:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle dial press (toggle power)
   */
  override async onDialDown(
    ev: DialDownEvent<BrightnessDialSettings>,
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
    ev: DialUpEvent<BrightnessDialSettings>,
  ): Promise<void> {
    // Visual feedback is handled through the dial's brightness bar display
    // No additional action needed - the updated brightness value is shown automatically
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, BrightnessDialSettings>,
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
  private isConfigured(settings: BrightnessDialSettings): boolean {
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
    settings: BrightnessDialSettings,
  ): Promise<void> {
    // Update title
    const lightName = settings.selectedLightName || "Light";
    const displayName =
      lightName.length > 10 ? lightName.substring(0, 10) + "..." : lightName;
    await action.setTitle(`${displayName}\n${this.currentBrightness}%`);

    // Update feedback with bar indicator
    const feedbackPayload = {
      value: this.currentBrightness,
      opacity: this.currentLight?.isOn ? 1 : 0.3,
      bar: {
        value: this.currentBrightness,
        opacity: this.currentLight?.isOn ? 1 : 0.3,
        subtype: 0, // Solid bar
      },
    };

    await action.setFeedback(feedbackPayload);
  }

  /**
   * Handle API key validation from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, BrightnessDialSettings>,
  ): Promise<void> {
    const payload = ev.payload as { apiKey?: string };
    const apiKey = payload.apiKey;

    if (!apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
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

      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: true,
      });

      streamDeck.logger.info("API key validated successfully");
    } catch (error) {
      streamDeck.logger.error("API key validation failed:", error);
      await streamDeck.ui.sendToPropertyInspector({
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
    _ev: SendToPluginEvent<JsonValue, BrightnessDialSettings>,
    settings: BrightnessDialSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
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
        .filter((light) => light.capabilities?.brightness ?? false) // Only show lights with brightness control
        .map((light) => ({
          label: `${light.label ?? light.name} (${light.model})`,
          value: `${light.deviceId}|${light.model}`,
        }));

      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger.info(
        `Sent ${lightItems.length} brightness-capable lights to property inspector`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to fetch lights:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        error: "Failed to fetch lights. Check your API key and connection.",
      });
    }
  }

  /**
   * Handle settings update from property inspector
   */
  private async handleSetSettings(
    ev: SendToPluginEvent<JsonValue, BrightnessDialSettings>,
  ): Promise<void> {
    const payload = ev.payload as { settings?: BrightnessDialSettings };
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
            this.currentBrightness = this.currentLight.brightness
              ? this.currentLight.brightness.level
              : 50;
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
