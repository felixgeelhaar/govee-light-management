import {
  GoveeClient,
  ColorRgb,
  ColorTemperature,
  Brightness,
  GoveeDevice,
} from "@felixgeelhaar/govee-api-client";
import { ILightRepository } from "../../domain/repositories/ILightRepository";
import { Light, LightState } from "../../domain/entities";
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
      streamDeck?.logger?.error(
        "Failed to fetch lights from Govee API:",
        error,
      );
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
      streamDeck?.logger?.error(`Failed to find light ${deviceId}:`, error);
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
      streamDeck?.logger?.error(
        `Failed to find lights by name ${name}:`,
        error,
      );
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
      streamDeck?.logger?.error(
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
      await this.client.setBrightness(light.deviceId, light.model, brightness);
      light.updateState({ brightness });
      streamDeck?.logger?.info(
        `Light ${light.name} brightness set to ${brightness.level}%`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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
      streamDeck?.logger?.info(
        `Light ${light.name} color set to ${color.toString()}`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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
      streamDeck?.logger?.info(
        `Light ${light.name} color temperature set to ${colorTemperature.kelvin}K`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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
      streamDeck?.logger?.info(
        `Light ${light.name} turned on with brightness ${brightness.level}%`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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
      streamDeck?.logger?.info(
        `Light ${light.name} turned on with color ${color.toString()}`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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
      streamDeck?.logger?.info(
        `Light ${light.name} turned on with color temperature ${colorTemperature.kelvin}K`,
      );
    } catch (error) {
      streamDeck?.logger?.error(
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

      // Extract color temperature if available
      const colorTemperature = deviceState.getColorTemperature();
      if (colorTemperature) {
        newState.colorTemperature = colorTemperature;
        newState.color = undefined;
      }

      light.updateState(newState);
    } catch (error) {
      streamDeck?.logger?.error(
        `Failed to get state for light ${light.name}:`,
        error,
      );
      throw new Error(
        `Failed to get light state: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

    return Light.create(
      device.deviceId,
      device.model,
      device.deviceName,
      initialState,
    );
  }

  /**
   * Get rate limiter and retry statistics
   */
  getServiceStats() {
    return this.client.getServiceStats();
  }
}
