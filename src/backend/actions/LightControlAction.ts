import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { Light } from "../domain/entities/Light";
import {
  Brightness,
  ColorRgb,
  ColorTemperature,
} from "@felixgeelhaar/govee-api-client";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { telemetryService } from "../services/TelemetryService";
import { globalSettingsService } from "../services/GlobalSettingsService";

type LightControlSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  controlMode?:
    | "toggle"
    | "on"
    | "off"
    | "brightness"
    | "color"
    | "colorTemp"
    | "nightlight-on"
    | "nightlight-off"
    | "gradient-on"
    | "gradient-off";
  brightnessValue?: number;
  colorValue?: string; // hex color
  colorTempValue?: number; // Kelvin
};

/**
 * Stream Deck action for controlling individual Govee lights
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.lights" })
export class LightControlAction extends SingletonAction<LightControlSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<LightControlSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

    // Set initial title based on configuration
    const title = this.getActionTitle(settings);
    await ev.action.setTitle(title);

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
          // Refresh light state
          await this.lightRepository.getLightState(this.currentLight);
          // Update action appearance based on light state
          const title = this.getActionTitle(settings);
          await ev.action.setTitle(title);
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
      }
    }
  }

  /**
   * Handle key press events
   */
  override async onKeyDown(
    ev: KeyDownEvent<LightControlSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Light control action not properly configured");
      return;
    }

    if (!this.currentLight || !this.lightControlService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    try {
      await this.executeControl(this.currentLight, settings);
      // Update action appearance after control
      const title = this.getActionTitle(settings);
      await ev.action.setTitle(title);
    } catch (error) {
      streamDeck.logger.error("Failed to control light:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
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
      case "getTransportHealth":
        await this.handleGetTransportHealth();
        break;
      case "getTelemetrySnapshot":
        await this.handleGetTelemetrySnapshot();
        break;
      case "resetTelemetry":
        await this.handleResetTelemetry();
        break;
      case "getLightStates":
        await this.handleGetLightStates(ev, settings);
        break;
      case "testLight":
        await this.handleTestLight(ev, settings);
        break;
      case "refreshState":
        await this.handleRefreshState(ev, settings);
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
  private isConfigured(settings: LightControlSettings): boolean {
    return !!(
      settings.apiKey &&
      settings.selectedDeviceId &&
      settings.selectedModel
    );
  }

  /**
   * Execute the configured control action
   */
  private async executeControl(
    light: Light,
    settings: LightControlSettings,
  ): Promise<void> {
    if (!this.lightControlService) {
      throw new Error("Light control service not initialized");
    }

    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }

    const mode = settings.controlMode || "toggle";
    const started = Date.now();
    let commandName: string = mode;

    try {
      switch (mode) {
        case "toggle": {
          const next = light.isOn ? "off" : "on";
          commandName = next === "on" ? "power.on" : "power.off";
          await this.lightControlService.controlLight(light, next);
          break;
        }

        case "on": {
          commandName = "power.on";
          if (
            settings.brightnessValue !== undefined ||
            settings.colorValue ||
            settings.colorTempValue
          ) {
            const controlSettings = this.parseControlSettings(settings);
            await this.lightControlService.turnOnLightWithSettings(
              light,
              controlSettings,
            );
          } else {
            await this.lightControlService.controlLight(light, "on");
          }
          break;
        }

        case "off": {
          commandName = "power.off";
          await this.lightControlService.controlLight(light, "off");
          break;
        }

        case "brightness": {
          if (settings.brightnessValue === undefined) {
            throw new Error("Brightness value required");
          }
          commandName = "brightness";
          const brightness = new Brightness(settings.brightnessValue);
          await this.lightControlService.controlLight(
            light,
            "brightness",
            brightness,
          );
          break;
        }

        case "color": {
          if (!settings.colorValue) {
            throw new Error("Color value required");
          }
          commandName = "color";
          const color = ColorRgb.fromHex(settings.colorValue);
          await this.lightControlService.controlLight(light, "color", color);
          break;
        }

        case "colorTemp": {
          if (!settings.colorTempValue) {
            throw new Error("Color temperature value required");
          }
          commandName = "colorTemperature";
          const colorTemp = new ColorTemperature(settings.colorTempValue);
          await this.lightControlService.controlLight(
            light,
            "colorTemperature",
            colorTemp,
          );
          break;
        }

        case "nightlight-on": {
          commandName = "nightlight.on";
          await this.lightRepository.toggleNightlight(light, true);
          break;
        }

        case "nightlight-off": {
          commandName = "nightlight.off";
          await this.lightRepository.toggleNightlight(light, false);
          break;
        }

        case "gradient-on": {
          commandName = "gradient.on";
          await this.lightRepository.toggleGradient(light, true);
          break;
        }

        case "gradient-off": {
          commandName = "gradient.off";
          await this.lightRepository.toggleGradient(light, false);
          break;
        }

        default:
          throw new Error(`Unknown control mode: ${mode}`);
      }

      telemetryService.recordCommand({
        command: commandName,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      const failure =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: String(error) };

      telemetryService.recordCommand({
        command: commandName,
        durationMs: Date.now() - started,
        success: false,
        error: failure,
      });

      throw error;
    }
  }

  /**
   * Parse control settings from action configuration
   */
  private parseControlSettings(settings: LightControlSettings) {
    const result: {
      brightness?: Brightness;
      color?: ColorRgb;
      colorTemperature?: ColorTemperature;
    } = {};

    if (settings.brightnessValue !== undefined) {
      result.brightness = new Brightness(settings.brightnessValue);
    }

    if (settings.colorValue) {
      result.color = ColorRgb.fromHex(settings.colorValue);
    } else if (settings.colorTempValue) {
      result.colorTemperature = new ColorTemperature(settings.colorTempValue);
    }

    return result;
  }

  /**
   * Get appropriate title for the action
   */
  private getActionTitle(settings: LightControlSettings): string {
    if (!settings.selectedLightName) {
      return "Configure\nLight";
    }

    const mode = settings.controlMode || "toggle";
    const lightName =
      settings.selectedLightName.length > 10
        ? settings.selectedLightName.substring(0, 10) + "..."
        : settings.selectedLightName;

    switch (mode) {
      case "toggle":
        return `Toggle\n${lightName}`;
      case "on":
        return `On\n${lightName}`;
      case "off":
        return `Off\n${lightName}`;
      case "brightness":
        return `Bright\n${lightName}`;
      case "color":
        return `Color\n${lightName}`;
      case "colorTemp":
        return `Temp\n${lightName}`;
      case "nightlight-on":
        return `Night On\n${lightName}`;
      case "nightlight-off":
        return `Night Off\n${lightName}`;
      case "gradient-on":
        return `Grad On\n${lightName}`;
      case "gradient-off":
        return `Grad Off\n${lightName}`;
      default:
        return lightName;
    }
  }

  /**
   * Handle API key validation from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
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
      // Test API key by attempting to create repository and fetch lights
      const testRepository = new GoveeLightRepository(apiKey, true);
      await testRepository.getAllLights();

      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger.warn("Failed to persist API key globally", error);
      }

      await this.ensureServices(apiKey);

      // If successful, API key is valid
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
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
    settings: LightControlSettings,
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
      const lightItems = lights.map((light) => ({
        label: `${light.label ?? light.name} (${light.model})`,
        value: `${light.deviceId}|${light.model}`,
      }));

      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger.info(
        `Sent ${lightItems.length} lights to property inspector`,
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
   * Handle light states request for monitoring from property inspector
   */
  private async handleGetLightStates(
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
    settings: LightControlSettings,
  ): Promise<void> {
    const payload = ev.payload as { deviceIds?: string[] };
    const deviceIds = payload.deviceIds;

    if (!settings.apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightStatesReceived",
        error: "API key required to fetch light states",
      });
      return;
    }

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightStatesReceived",
        error: "Device IDs are required",
      });
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      if (!this.lightRepository) {
        streamDeck.logger.warn("Light repository not initialized");
        return;
      }
      const allLights = await this.lightRepository.getAllLights();
      const requestedLights = allLights.filter((light) =>
        deviceIds.some((deviceId) => {
          const [id, model] = deviceId.includes("|")
            ? deviceId.split("|")
            : [deviceId, ""];
          return (
            light.deviceId === id && (model === "" || light.model === model)
          );
        }),
      );

      // Get current states for requested lights
      const states = await Promise.all(
        requestedLights.map(async (light) => {
          try {
            if (this.lightRepository) {
              await this.lightRepository.getLightState(light);
            }
            return {
              deviceId: light.deviceId,
              model: light.model,
              name: light.name,
              isOnline: true, // If we can get state, it's online
              powerState: light.isOn,
              brightness: light.brightness ? light.brightness.level : undefined,
              color: light.color
                ? {
                    r: light.color.r,
                    g: light.color.g,
                    b: light.color.b,
                  }
                : undefined,
              colorTemperature: light.colorTemperature
                ? light.colorTemperature.kelvin
                : undefined,
            };
          } catch (error) {
            streamDeck.logger.warn(
              `Failed to get state for light ${light.deviceId}:`,
              error,
            );
            return {
              deviceId: light.deviceId,
              model: light.model,
              name: light.name,
              isOnline: false,
              powerState: false,
            };
          }
        }),
      );

      await streamDeck.ui.sendToPropertyInspector({
        event: "lightStatesReceived",
        states,
      });

      streamDeck.logger.info(
        `Sent states for ${states.length} lights to property inspector`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to fetch light states:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightStatesReceived",
        error:
          "Failed to fetch light states. Check your API key and connection.",
      });
    }
  }

  /**
   * Handle settings update from property inspector
   */
  private async handleSetSettings(
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
  ): Promise<void> {
    const payload = ev.payload as { settings?: LightControlSettings };
    const newSettings = payload.settings;

    if (!newSettings) {
      return;
    }

    try {
      // Update action settings
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
            // Update action appearance
            // Note: setTitle may not be available in SendToPluginEvent context
            // const title = this.getActionTitle(newSettings);
            // await ev.action.setTitle(title);
          }
        } catch (error) {
          streamDeck.logger.error("Failed to load selected light:", error);
        }
      }

      // Update action title
      // Note: setTitle may not be available in SendToPluginEvent context
      // const title = this.getActionTitle(newSettings);
      // await ev.action.setTitle(title);

      streamDeck.logger.info("Settings updated successfully");
    } catch (error) {
      streamDeck.logger.error("Failed to update settings:", error);
    }
  }

  /**
   * Handle test light request from property inspector
   */
  private async handleTestLight(
    ev: SendToPluginEvent<JsonValue, LightControlSettings>,
    settings: LightControlSettings,
  ): Promise<void> {
    const started = Date.now();
    let success = false;

    if (
      !settings.selectedDeviceId ||
      !settings.selectedModel ||
      !this.lightRepository
    ) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "testResult",
        success: false,
        message: "Select a light before testing",
      });
      telemetryService.recordCommand({
        command: "testLight",
        durationMs: Date.now() - started,
        success: false,
        error: { name: "InvalidConfiguration", message: "Light not selected" },
      });
      return;
    }

    try {
      const light = await this.lightRepository.findLight(
        settings.selectedDeviceId,
        settings.selectedModel,
      );

      if (light && this.lightControlService) {
        const nextState = light.isOn ? "off" : "on";
        await this.lightControlService.controlLight(light, nextState);
        setTimeout(async () => {
          try {
            if (this.lightControlService && light) {
              await this.lightControlService.controlLight(light, nextState);
            }
          } catch (error) {
            streamDeck.logger.error("Light reset after test failed", error);
          }
        }, 1000);

        await streamDeck.ui.sendToPropertyInspector({
          event: "testResult",
          success: true,
          message: "Light test successful!",
        });
        success = true;
      }
    } catch (error) {
      streamDeck.logger.error("Light test failed:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "testResult",
        success: false,
        message: "Light test failed. Check connection.",
      });
    } finally {
      const failure = success
        ? undefined
        : { name: "TestFailed", message: "Light test failed" };

      telemetryService.recordCommand({
        command: "testLight",
        durationMs: Date.now() - started,
        success,
        error: failure,
      });
    }
  }

  /**
   * Handle refresh state request from property inspector
   */
  private async handleRefreshState(
    _ev: SendToPluginEvent<JsonValue, LightControlSettings>,
    _settings: LightControlSettings,
  ): Promise<void> {
    if (this.currentLight && this.lightRepository) {
      try {
        await this.lightRepository.getLightState(this.currentLight);
        // Update action appearance
        // Note: setTitle may not be available in SendToPluginEvent context
        // const title = this.getActionTitle(settings);
        // await ev.action.setTitle(title);
      } catch (error) {
        streamDeck.logger.error("Failed to refresh light state:", error);
      }
    }
  }

  private async handleGetTransportHealth(): Promise<void> {
    await this.ensureServices(this.currentApiKey);

    if (!this.healthService) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "transportHealth",
        transports: [],
      });
      return;
    }

    const snapshot = await this.healthService.getHealth(true);
    await streamDeck.ui.sendToPropertyInspector({
      event: "transportHealth",
      transports: snapshot.map((health) => ({
        kind: health.descriptor.kind,
        label: health.descriptor.label,
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
        lastChecked: health.lastChecked,
      })),
    });
  }

  private async handleGetTelemetrySnapshot(): Promise<void> {
    const snapshot = telemetryService.getSnapshot();
    await streamDeck.ui.sendToPropertyInspector({
      event: "telemetrySnapshot",
      snapshot: JSON.parse(JSON.stringify(snapshot)),
    });
  }

  private async handleResetTelemetry(): Promise<void> {
    telemetryService.reset();
    await this.handleGetTelemetrySnapshot();
  }
}
