import {
  GoveeClient,
  ColorRgb,
  ColorTemperature,
  Brightness,
  GoveeDevice,
  LightScene,
  Snapshot,
  MusicMode,
  SegmentColor as ApiSegmentColor,
} from "@felixgeelhaar/govee-api-client";
import { ILightRepository } from "../../domain/repositories/ILightRepository";
import { Light, LightState } from "../../domain/entities";
import { Scene } from "../../domain/value-objects/Scene";
import { SegmentColor } from "../../domain/value-objects/SegmentColor";
import { SceneMapper } from "../mappers/SceneMapper";
import { MusicModeMapper } from "../mappers/MusicModeMapper";
import { MusicModeConfig } from "../../domain/value-objects/MusicModeConfig";
import {
  isIgnorableLiveStateError,
  isValidationError,
  VALID_TOGGLE_INSTANCES,
} from "../../actions/shared/validation";
import { safeGetColorTemperature } from "../utils/deviceStateUtils";
import streamDeck from "@elgato/streamdeck";

export class GoveeLightRepository implements ILightRepository {
  private client: GoveeClient;

  constructor(apiKey: string, enableRetries = true) {
    this.client = new GoveeClient({
      apiKey,
      enableRetries,
      retryPolicy: "production",
      // Note: Stream Deck logger is not compatible with Pino logger interface
      // The client will use its default silent logger
    });
  }

  async getAllLights(): Promise<Light[]> {
    try {
      const devices = await this.client.getControllableDevices();
      return devices.map((device) => this.mapDeviceToLight(device));
    } catch (error) {
      streamDeck.logger.error("Failed to fetch lights from Govee API:", error);
      throw new Error(
        `Failed to fetch lights: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async findLight(deviceId: string, model: string): Promise<Light | null> {
    try {
      const devices = await this.client.getControllableDevices();
      const device = devices.find(
        (d) => d.deviceId === deviceId && d.model === model,
      );

      if (!device) {
        return null;
      }

      return this.mapDeviceToLight(device);
    } catch (error) {
      streamDeck.logger.error(`Failed to find light ${deviceId}:`, error);
      throw new Error(
        `Failed to find light: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async findLightsByName(name: string): Promise<Light[]> {
    try {
      const devices = await this.client.getControllableDevices();
      const matchingDevices = devices.filter((device) =>
        device.deviceName.toLowerCase().includes(name.toLowerCase()),
      );

      return matchingDevices.map((device) => this.mapDeviceToLight(device));
    } catch (error) {
      streamDeck.logger.error(`Failed to find lights by name ${name}:`, error);
      throw new Error(
        `Failed to find lights by name: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setPower(light: Light, isOn: boolean): Promise<void> {
    try {
      if (isOn) {
        await this.client.turnOn(light.deviceId, light.model);
      } else {
        await this.client.turnOff(light.deviceId, light.model);
      }

      light.updateState({ isOn });
    } catch (error) {
      // Govee API may return responses that fail strict Zod validation
      // but the command was still executed successfully
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Power command sent but response validation failed for ${light.name} - command likely succeeded`,
        );
        light.updateState({ isOn });
        return;
      }
      streamDeck.logger.error(
        `Failed to set power for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to control light power: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setBrightness(light: Light, brightness: Brightness): Promise<void> {
    try {
      // Govee API requires brightness 1-100; treat 0 as "turn off"
      if (brightness.level === 0) {
        await this.client.turnOff(light.deviceId, light.model);
        light.updateState({ isOn: false, brightness });
        return;
      }
      await this.client.setBrightness(light.deviceId, light.model, brightness);
      light.updateState({ brightness });
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Brightness command sent but response validation failed for ${light.name}`,
        );
        light.updateState({ brightness });
        return;
      }
      streamDeck.logger.error(
        `Failed to set brightness for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set brightness: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setColor(light: Light, color: ColorRgb): Promise<void> {
    try {
      await this.client.setColor(light.deviceId, light.model, color);
      light.updateState({ color, colorTemperature: undefined });
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Color command sent but response validation failed for ${light.name}`,
        );
        light.updateState({ color, colorTemperature: undefined });
        return;
      }
      streamDeck.logger.error(
        `Failed to set color for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set color: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
  ): Promise<void> {
    try {
      await this.client.setColorTemperature(
        light.deviceId,
        light.model,
        colorTemperature,
      );
      light.updateState({ colorTemperature, color: undefined });
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Color temperature command sent but response validation failed for ${light.name}`,
        );
        light.updateState({ colorTemperature, color: undefined });
        return;
      }
      streamDeck.logger.error(
        `Failed to set color temperature for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set color temperature: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async turnOnWithBrightness(
    light: Light,
    brightness: Brightness,
  ): Promise<void> {
    try {
      await this.client.turnOnWithBrightness(
        light.deviceId,
        light.model,
        brightness,
      );
      light.updateState({ isOn: true, brightness });
      streamDeck.logger.info(
        `Light ${light.name} turned on with brightness ${brightness.level}%`,
      );
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Turn on with brightness command sent but response validation failed for ${light.name}`,
        );
        light.updateState({ isOn: true, brightness });
        return;
      }
      streamDeck.logger.error(
        `Failed to turn on light ${light.name} with brightness:`,
        error,
      );
      throw new Error(
        `Failed to turn on with brightness: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async turnOnWithColor(
    light: Light,
    color: ColorRgb,
    brightness?: Brightness,
  ): Promise<void> {
    try {
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
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Turn on with color command sent but response validation failed for ${light.name}`,
        );
        light.updateState({
          isOn: true,
          color,
          brightness: brightness || light.state.brightness,
          colorTemperature: undefined,
        });
        return;
      }
      streamDeck.logger.error(
        `Failed to turn on light ${light.name} with color:`,
        error,
      );
      throw new Error(
        `Failed to turn on with color: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async turnOnWithColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
    brightness?: Brightness,
  ): Promise<void> {
    try {
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
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Turn on with color temperature command sent but response validation failed for ${light.name}`,
        );
        light.updateState({
          isOn: true,
          colorTemperature,
          brightness: brightness || light.state.brightness,
          color: undefined,
        });
        return;
      }
      streamDeck.logger.error(
        `Failed to turn on light ${light.name} with color temperature:`,
        error,
      );
      throw new Error(
        `Failed to turn on with color temperature: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getLightState(light: Light): Promise<void> {
    try {
      const deviceState = await this.client.getDeviceState(
        light.deviceId,
        light.model,
      );

      const newState: Partial<LightState> = {
        isOn: deviceState.getPowerState() === "on",
        isOnline: deviceState.isOnline(),
      };

      // Extract brightness if available
      const brightness = deviceState.getBrightness();
      if (brightness) {
        newState.brightness = brightness;
      }

      // Extract color if available
      const color = deviceState.getColor();
      if (color) {
        newState.color = color;
        newState.colorTemperature = undefined;
      }

      // Extract color temperature if available (tolerates malformed 0K payloads)
      const colorTemperature = safeGetColorTemperature(deviceState, light.name);
      if (colorTemperature) {
        newState.colorTemperature = colorTemperature;
        newState.color = undefined;
      }

      light.updateState(newState);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `State query response validation failed for ${light.name} - using cached state`,
        );
        return;
      }
      // Malformed payloads (e.g. 0K color temperature, invalid ID payloads)
      // propagate so that ActionServices.syncLightState can apply its backoff
      // policy. Log at debug to avoid flooding the error log on the
      // 30-second retry cadence — the WARN banner from ActionServices
      // already surfaces the condition once.
      if (isIgnorableLiveStateError(error)) {
        streamDeck.logger.debug(
          `Ignorable live-state payload from ${light.name}, bubbling for backoff:`,
          error,
        );
        throw error;
      }
      streamDeck.logger.error(
        `Failed to get state for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to get light state: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async applyScene(light: Light, scene: Scene): Promise<void> {
    try {
      const apiScene = SceneMapper.toApiLightScene(scene);
      await this.client.setLightScene(light.deviceId, light.model, apiScene);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Scene command sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to apply scene for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to apply scene: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setLightScene(light: Light, scene: LightScene): Promise<void> {
    try {
      await this.client.setLightScene(light.deviceId, light.model, scene);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Scene command sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to set light scene for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set light scene: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getDynamicScenes(light: Light): Promise<LightScene[]> {
    try {
      return await this.client.getDynamicScenes(light.deviceId, light.model);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Dynamic scenes fetch validation failed for ${light.name}`,
        );
        return [];
      }
      streamDeck.logger.error(
        `Failed to get dynamic scenes for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to get dynamic scenes: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getSnapshots(light: Light): Promise<Snapshot[]> {
    try {
      return await this.client.getSnapshots(light.deviceId, light.model);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Snapshots fetch validation failed for ${light.name}`,
        );
        return [];
      }
      streamDeck.logger.error(
        `Failed to get snapshots for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to get snapshots: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async applySnapshot(light: Light, snapshot: Snapshot): Promise<void> {
    try {
      await this.client.setSnapshot(light.deviceId, light.model, snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Snapshot command sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to apply snapshot for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to apply snapshot: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setSegmentColors(
    light: Light,
    segments: SegmentColor[],
  ): Promise<void> {
    if (segments.length === 0) {
      throw new Error("At least one segment color must be provided");
    }
    try {
      // Govee API accepts one color per segmentedColorRgb call.
      // Group segments by color and send one call per unique color.
      const colorGroups = new Map<string, ApiSegmentColor[]>();
      for (const seg of segments) {
        const key = `${seg.color.r},${seg.color.g},${seg.color.b}`;
        const group = colorGroups.get(key) ?? [];
        group.push(new ApiSegmentColor(seg.segmentIndex, seg.color));
        colorGroups.set(key, group);
      }
      for (const apiSegments of colorGroups.values()) {
        await this.client.setSegmentColors(
          light.deviceId,
          light.model,
          apiSegments,
        );
      }
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger?.warn(
          "Segment colors set (ignored validation error)",
          error,
        );
        return;
      }
      throw error;
    }
  }

  async setMusicMode(light: Light, config: MusicModeConfig): Promise<void> {
    try {
      const apiMode = MusicModeMapper.toApiMusicMode(config);
      await this.client.setMusicMode(light.deviceId, light.model, apiMode);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Music mode command sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to set music mode for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set music mode: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async toggleNightlight(light: Light, enabled: boolean): Promise<void> {
    try {
      await this.client.setNightlightToggle(
        light.deviceId,
        light.model,
        enabled,
      );
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Nightlight toggle sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to toggle nightlight for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to toggle nightlight: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async toggleGradient(light: Light, enabled: boolean): Promise<void> {
    try {
      await this.client.setGradientToggle(light.deviceId, light.model, enabled);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Gradient toggle sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to toggle gradient for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to toggle gradient: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setMusicModeRaw(light: Light, musicMode: MusicMode): Promise<void> {
    try {
      await this.client.setMusicMode(light.deviceId, light.model, musicMode);
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Music mode command sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to set music mode for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to set music mode: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMusicModes(
    selectedDeviceId: string,
  ): Promise<Array<{ name: string; value: number }>> {
    try {
      const cleanId = selectedDeviceId.startsWith("light:")
        ? selectedDeviceId.substring(6)
        : selectedDeviceId;
      const [deviceId, model] = cleanId.split("|");
      if (!deviceId || !model) return [];

      const devices = await this.client.getControllableDevices();
      const device = devices.find(
        (d) => d.deviceId === deviceId && d.model === model,
      );
      if (!device) return [];

      for (const cap of device.capabilities) {
        if (cap.instance === "musicMode") {
          const params = cap.parameters as any;
          if (params?.fields) {
            const modeField = params.fields.find(
              (f: any) => f.fieldName === "musicMode",
            );
            if (modeField?.options) {
              return modeField.options.map((o: any) => ({
                name: String(o.name),
                value: Number(o.value),
              }));
            }
          }
        }
      }
      return [];
    } catch (error) {
      streamDeck.logger.error("Failed to get music modes:", error);
      return [];
    }
  }

  async toggleRaw(
    light: Light,
    instance: string,
    enabled: boolean,
  ): Promise<void> {
    if (!VALID_TOGGLE_INSTANCES.has(instance)) {
      throw new Error(`Rejected unknown toggle instance: ${instance}`);
    }
    try {
      const command = {
        name: instance,
        value: enabled ? 1 : 0,
        toObject: () => ({ name: instance, value: enabled ? 1 : 0 }),
      };
      await this.client.sendCommand(
        light.deviceId,
        light.model,
        command as any,
      );
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Toggle ${instance} sent but response validation failed for ${light.name}`,
        );
        return;
      }
      streamDeck.logger.error(
        `Failed to toggle ${instance} for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to toggle ${instance}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getToggleState(
    light: Light,
    instance: string,
  ): Promise<boolean | undefined> {
    try {
      const deviceState = await this.client.getDeviceState(
        light.deviceId,
        light.model,
      );

      switch (instance) {
        case "nightlightToggle":
          return deviceState.getNightlightToggle() ?? false;
        case "gradientToggle":
          return deviceState.getGradientToggle() ?? false;
        case "sceneStageToggle":
          return deviceState.getSceneStageToggle() ?? false;
        default:
          streamDeck.logger.warn(
            `No live toggle-state reader for ${instance} on ${light.name}`,
          );
          return undefined;
      }
    } catch (error) {
      if (isValidationError(error)) {
        streamDeck.logger.warn(
          `Toggle state query response validation failed for ${light.name} (${instance})`,
        );
        return undefined;
      }
      streamDeck.logger.error(
        `Failed to get toggle state ${instance} for ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to get toggle state ${instance}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getToggleFeatures(
    selectedDeviceId: string,
  ): Promise<Array<{ name: string; instance: string }>> {
    try {
      const cleanId = selectedDeviceId.startsWith("light:")
        ? selectedDeviceId.substring(6)
        : selectedDeviceId;
      const [deviceId, model] = cleanId.split("|");
      if (!deviceId || !model) return [];

      const devices = await this.client.getControllableDevices();
      const device = devices.find(
        (d) => d.deviceId === deviceId && d.model === model,
      );
      if (!device) return [];

      const TOGGLE_LABELS: Record<string, string> = {
        nightlightToggle: "Nightlight",
        gradientToggle: "Gradient",
        dreamViewToggle: "DreamView (requires equipment)",
        sceneStageToggle: "Scene Stage",
      };

      return device.capabilities
        .filter((cap) => cap.type.includes("toggle"))
        .map((cap) => ({
          name: TOGGLE_LABELS[cap.instance] ?? cap.instance,
          instance: cap.instance,
        }));
    } catch (error) {
      streamDeck.logger.error("Failed to get toggle features:", error);
      return [];
    }
  }

  /**
   * Map Govee device to domain Light entity
   */
  private mapDeviceToLight(device: GoveeDevice): Light {
    const initialState: LightState = {
      isOn: false,
      isOnline: device.canControl ? device.canControl() : true,
      brightness: undefined,
      color: undefined,
      colorTemperature: undefined,
    };

    // Detect capabilities from the device's capability list
    const capInstances = new Set(device.capabilities.map((c) => c.instance));

    return Light.create(
      device.deviceId,
      device.model,
      device.deviceName,
      initialState,
      {
        brightness: capInstances.has("brightness"),
        color: capInstances.has("colorRgb"),
        colorTemperature: capInstances.has("colorTemInKelvin"),
        scenes: capInstances.has("lightScene"),
        segmentedColor: capInstances.has("segmentedColorRgb"),
        musicMode: capInstances.has("musicMode"),
        nightlight: capInstances.has("nightlightToggle"),
        gradient: capInstances.has("gradientToggle"),
      },
    );
  }

  /**
   * Get rate limiter and retry statistics
   */
  getServiceStats() {
    return this.client.getServiceStats();
  }
}
