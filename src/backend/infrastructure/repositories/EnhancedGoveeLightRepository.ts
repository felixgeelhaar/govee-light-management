import {
  GoveeClient,
  ColorRgb,
  ColorTemperature,
  Brightness,
  GoveeDevice,
} from "@felixgeelhaar/govee-api-client";
import { ILightRepository } from "../../domain/repositories/ILightRepository";
import { Light, LightState } from "../../domain/entities";
import { Scene } from "../../domain/value-objects/Scene";
import { SegmentColor } from "../../domain/value-objects/SegmentColor";
import { MusicModeConfig } from "../../domain/value-objects/MusicModeConfig";
import streamDeck from "@elgato/streamdeck";
import { ErrorBoundaries } from "../errors/ErrorBoundaries";
import { ApiResponseValidator } from "../validation/ApiResponseValidator";
import { GoveeDeviceStateSchema } from "../validation/goveeApiSchemas";
import {
  CircuitBreaker,
  CircuitBreakerFactory,
} from "../resilience/CircuitBreaker";
import { SceneMapper, MusicModeMapper, SegmentColorMapper } from "../mappers";

/**
 * Enhanced Govee Light Repository with comprehensive error handling,
 * validation, and resilience patterns
 */
export class EnhancedGoveeLightRepository implements ILightRepository {
  private client: GoveeClient;
  private apiCircuitBreaker: CircuitBreaker;
  private deviceCircuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(apiKey: string, enableRetries = true) {
    this.client = new GoveeClient({
      apiKey,
      enableRetries,
      retryPolicy: "production",
      // Note: Stream Deck logger is not compatible with Pino logger interface
      // The client will use its default silent logger
    });

    // Initialize circuit breaker for API calls
    this.apiCircuitBreaker =
      CircuitBreakerFactory.createApiCircuitBreaker("govee-api");
  }

  async getAllLights(): Promise<Light[]> {
    return ErrorBoundaries.wrapApiCall(
      async () => {
        return this.apiCircuitBreaker.execute(async () => {
          const devices = await this.client.getControllableDevices();

          // Basic validation - ensure devices is an array
          if (!Array.isArray(devices)) {
            throw new Error("Govee API returned invalid device list format");
          }

          return devices
            .filter((device) => this.isValidDevice(device))
            .map((device) => this.mapDeviceToLight(device));
        });
      },
      { action: "getAllLights" },
      "Get All Lights",
    );
  }

  async findLight(deviceId: string, model: string): Promise<Light | null> {
    return ErrorBoundaries.wrapApiCall(
      async () => {
        return this.apiCircuitBreaker.execute(async () => {
          const devices = await this.client.getControllableDevices();

          // Basic validation - ensure devices is an array
          if (!Array.isArray(devices)) {
            throw new Error("Govee API returned invalid device list format");
          }

          const device = devices.find(
            (d) =>
              this.isValidDevice(d) &&
              d.deviceId === deviceId &&
              d.model === model,
          );

          if (!device) {
            return null;
          }

          return this.mapDeviceToLight(device);
        });
      },
      { deviceId, metadata: { model } },
      "Find Light",
    );
  }

  async findLightsByName(name: string): Promise<Light[]> {
    return ErrorBoundaries.wrapApiCall(
      async () => {
        return this.apiCircuitBreaker.execute(async () => {
          const devices = await this.client.getControllableDevices();

          // Basic validation - ensure devices is an array
          if (!Array.isArray(devices)) {
            throw new Error("Govee API returned invalid device list format");
          }

          const matchingDevices = devices.filter(
            (device) =>
              this.isValidDevice(device) &&
              device.deviceName.toLowerCase().includes(name.toLowerCase()),
          );

          return matchingDevices.map((device) => this.mapDeviceToLight(device));
        });
      },
      { metadata: { searchName: name } },
      "Find Lights by Name",
    );
  }

  async setPower(light: Light, isOn: boolean): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          if (isOn) {
            await this.client.turnOn(light.deviceId, light.model);
          } else {
            await this.client.turnOff(light.deviceId, light.model);
          }

          light.updateState({ isOn });
          streamDeck.logger.info(
            `Light ${light.name} power set to ${isOn ? "ON" : "OFF"}`,
          );
        });
      },
      light.deviceId,
      light.name,
      `Set Power ${isOn ? "ON" : "OFF"}`,
    );
  }

  async setBrightness(light: Light, brightness: Brightness): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.setBrightness(
            light.deviceId,
            light.model,
            brightness,
          );
          light.updateState({ brightness });
          streamDeck.logger.info(
            `Light ${light.name} brightness set to ${brightness.level}%`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Set Brightness",
    );
  }

  async setColor(light: Light, color: ColorRgb): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.setColor(light.deviceId, light.model, color);
          light.updateState({ color, colorTemperature: undefined });
          streamDeck.logger.info(
            `Light ${light.name} color set to ${color.toString()}`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Set Color",
    );
  }

  async setColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
  ): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.setColorTemperature(
            light.deviceId,
            light.model,
            colorTemperature,
          );
          light.updateState({ colorTemperature, color: undefined });
          streamDeck.logger.info(
            `Light ${light.name} color temperature set to ${colorTemperature.kelvin}K`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Set Color Temperature",
    );
  }

  async turnOnWithBrightness(
    light: Light,
    brightness: Brightness,
  ): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.turnOnWithBrightness(
            light.deviceId,
            light.model,
            brightness,
          );
          light.updateState({ isOn: true, brightness });
          streamDeck.logger.info(
            `Light ${light.name} turned on with brightness ${brightness.level}%`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Turn On with Brightness",
    );
  }

  async turnOnWithColor(
    light: Light,
    color: ColorRgb,
    brightness?: Brightness,
  ): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.turnOnWithColor(
            light.deviceId,
            light.model,
            color,
            brightness,
          );
          light.updateState({
            isOn: true,
            color,
            brightness: brightness || light.state.brightness,
            colorTemperature: undefined,
          });
          streamDeck.logger.info(
            `Light ${light.name} turned on with color ${color.toString()}`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Turn On with Color",
    );
  }

  async turnOnWithColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
    brightness?: Brightness,
  ): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.turnOnWithColorTemperature(
            light.deviceId,
            light.model,
            colorTemperature,
            brightness,
          );
          light.updateState({
            isOn: true,
            colorTemperature,
            brightness: brightness || light.state.brightness,
            color: undefined,
          });
          streamDeck.logger.info(
            `Light ${light.name} turned on with color temperature ${colorTemperature.kelvin}K`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Turn On with Color Temperature",
    );
  }

  async getLightState(light: Light): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          const deviceState = await this.client.getDeviceState(
            light.deviceId,
            light.model,
          );

          // Validate device state response
          const validatedState = ApiResponseValidator.validate(
            GoveeDeviceStateSchema,
            deviceState,
            "Device state response",
          );

          const newState: Partial<LightState> = {
            isOn: validatedState.getPowerState() === "on",
            isOnline: validatedState.isOnline(),
          };

          // Extract brightness if available
          const brightness = validatedState.getBrightness?.();
          if (brightness) {
            newState.brightness = brightness;
          }

          // Extract color if available
          const color = validatedState.getColor?.();
          if (color) {
            newState.color = color;
            newState.colorTemperature = undefined;
          }

          // Extract color temperature if available
          const colorTemperature = validatedState.getColorTemperature?.();
          if (colorTemperature) {
            newState.colorTemperature = colorTemperature;
            newState.color = undefined;
          }

          light.updateState(newState);
        });
      },
      light.deviceId,
      light.name,
      "Get Light State",
    );
  }

  async applyScene(light: Light, scene: Scene): Promise<void> {
    // Validate scene is supported before attempting to apply
    if (!SceneMapper.isSupported(scene)) {
      throw new Error(
        `Scene "${scene.name}" is not supported by Govee API. ` +
          `Supported scenes: ${SceneMapper.getSupportedSceneCodes().join(", ")}`,
      );
    }

    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          const apiScene = SceneMapper.toApiLightScene(scene);
          await this.client.setLightScene(
            light.deviceId,
            light.model,
            apiScene,
          );
          streamDeck.logger.info(
            `Light ${light.name} scene set to ${scene.name}`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Apply Scene",
    );
  }

  async setSegmentColors(
    light: Light,
    segments: SegmentColor[],
  ): Promise<void> {
    if (segments.length === 0) {
      throw new Error("At least one segment color must be provided");
    }

    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          const apiSegments = SegmentColorMapper.toApiSegmentColors(segments);
          await this.client.setSegmentColors(
            light.deviceId,
            light.model,
            apiSegments,
          );
          streamDeck.logger.info(
            `Light ${light.name} segment colors set (${segments.length} segments)`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Set Segment Colors",
    );
  }

  async setMusicMode(light: Light, config: MusicModeConfig): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          const apiMusicMode = MusicModeMapper.toApiMusicMode(config);
          await this.client.setMusicMode(
            light.deviceId,
            light.model,
            apiMusicMode,
          );
          streamDeck.logger.info(
            `Light ${light.name} music mode set to ${config.mode} (sensitivity: ${config.sensitivity}%)`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Set Music Mode",
    );
  }

  async toggleNightlight(light: Light, enabled: boolean): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.setNightlightToggle(
            light.deviceId,
            light.model,
            enabled,
          );
          streamDeck.logger.info(
            `Light ${light.name} nightlight ${enabled ? "enabled" : "disabled"}`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Toggle Nightlight",
    );
  }

  async toggleGradient(light: Light, enabled: boolean): Promise<void> {
    return ErrorBoundaries.wrapDeviceControl(
      async () => {
        const deviceCircuitBreaker = this.getDeviceCircuitBreaker(
          light.deviceId,
        );

        return deviceCircuitBreaker.execute(async () => {
          await this.client.setGradientToggle(
            light.deviceId,
            light.model,
            enabled,
          );
          streamDeck.logger.info(
            `Light ${light.name} gradient ${enabled ? "enabled" : "disabled"}`,
          );
        });
      },
      light.deviceId,
      light.name,
      "Toggle Gradient",
    );
  }

  /**
   * Get or create circuit breaker for a specific device
   */
  private getDeviceCircuitBreaker(deviceId: string): CircuitBreaker {
    if (!this.deviceCircuitBreakers.has(deviceId)) {
      const circuitBreaker =
        CircuitBreakerFactory.createDeviceCircuitBreaker(deviceId);
      this.deviceCircuitBreakers.set(deviceId, circuitBreaker);
    }
    const circuitBreaker = this.deviceCircuitBreakers.get(deviceId);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for device ${deviceId}`);
    }
    return circuitBreaker;
  }

  /**
   * Map Govee device to domain Light entity with validation
   */
  private isValidDevice(device: unknown): device is GoveeDevice {
    return (
      device !== null &&
      typeof device === "object" &&
      "deviceId" in device &&
      "model" in device &&
      "deviceName" in device &&
      typeof (device as any).deviceId === "string" &&
      (device as any).deviceId.trim() !== "" &&
      typeof (device as any).model === "string" &&
      (device as any).model.trim() !== "" &&
      typeof (device as any).deviceName === "string" &&
      (device as any).deviceName.trim() !== ""
    );
  }

  private mapDeviceToLight(device: GoveeDevice): Light {
    const initialState: LightState = {
      isOn: false,
      isOnline:
        typeof device.canControl === "function" ? device.canControl() : true,
      brightness: undefined,
      color: undefined,
      colorTemperature: undefined,
    };

    return Light.create(
      device.deviceId,
      device.model,
      device.deviceName,
      initialState,
    );
  }

  /**
   * Get comprehensive service statistics including circuit breaker status
   */
  getServiceStats() {
    const clientStats = this.client.getServiceStats();
    const apiCircuitBreakerStats = this.apiCircuitBreaker.getStats();

    const deviceCircuitBreakerStats = Array.from(
      this.deviceCircuitBreakers.entries(),
    ).map(([deviceId, breaker]) => ({
      deviceId,
      ...breaker.getStats(),
    }));

    return {
      client: clientStats,
      circuitBreakers: {
        api: apiCircuitBreakerStats,
        devices: deviceCircuitBreakerStats,
      },
    };
  }

  /**
   * Reset all circuit breakers (for testing or recovery)
   */
  resetCircuitBreakers(): void {
    this.apiCircuitBreaker.reset();
    this.deviceCircuitBreakers.forEach((breaker) => breaker.reset());
    streamDeck.logger.info("All circuit breakers reset");
  }
}
