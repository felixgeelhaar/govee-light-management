import { Light } from "../entities/Light";
import { LightGroup } from "../entities/LightGroup";
import { ILightRepository } from "../repositories/ILightRepository";
import {
  ColorRgb,
  ColorTemperature,
  Brightness,
} from "@felixgeelhaar/govee-api-client";

export class LightControlService {
  constructor(private readonly lightRepository: ILightRepository) {}

  /**
   * Control a single light
   */
  async controlLight(
    light: Light,
    action: "on" | "off" | "brightness" | "color" | "colorTemperature",
    value?: Brightness | ColorRgb | ColorTemperature,
  ): Promise<void> {
    if (!light.canBeControlled()) {
      throw new Error(
        `Light ${light.name} is offline and cannot be controlled`,
      );
    }

    switch (action) {
      case "on":
        await this.lightRepository.setPower(light, true);
        light.updateState({ isOn: true });
        break;

      case "off":
        await this.lightRepository.setPower(light, false);
        light.updateState({ isOn: false });
        break;

      case "brightness":
        if (!(value instanceof Brightness)) {
          throw new Error("Brightness value is required for brightness action");
        }
        await this.lightRepository.setBrightness(light, value);
        light.updateState({ brightness: value });
        break;

      case "color":
        if (!(value instanceof ColorRgb)) {
          throw new Error("ColorRgb value is required for color action");
        }
        await this.lightRepository.setColor(light, value);
        light.updateState({ color: value, colorTemperature: undefined });
        break;

      case "colorTemperature":
        if (!(value instanceof ColorTemperature)) {
          throw new Error(
            "ColorTemperature value is required for colorTemperature action",
          );
        }
        await this.lightRepository.setColorTemperature(light, value);
        light.updateState({ colorTemperature: value, color: undefined });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Control multiple lights in a group
   */
  async controlGroup(
    group: LightGroup,
    action: "on" | "off" | "brightness" | "color" | "colorTemperature",
    value?: Brightness | ColorRgb | ColorTemperature,
  ): Promise<void> {
    if (!group.canBeControlled()) {
      throw new Error(`Group ${group.name} has no controllable lights`);
    }

    const controllableLights = group.getControllableLights();
    const promises = controllableLights.map((light) =>
      this.controlLight(light, action, value),
    );

    // Execute all control operations in parallel
    await Promise.all(promises);
  }

  /**
   * Turn on light with specific settings
   */
  async turnOnLightWithSettings(
    light: Light,
    settings: {
      brightness?: Brightness;
      color?: ColorRgb;
      colorTemperature?: ColorTemperature;
    },
  ): Promise<void> {
    if (!light.canBeControlled()) {
      throw new Error(
        `Light ${light.name} is offline and cannot be controlled`,
      );
    }

    const { brightness, color, colorTemperature } = settings;

    if (color && colorTemperature) {
      throw new Error(
        "Cannot set both color and color temperature simultaneously",
      );
    }

    if (color) {
      await this.lightRepository.turnOnWithColor(light, color, brightness);
      light.updateState({
        isOn: true,
        color,
        brightness,
        colorTemperature: undefined,
      });
    } else if (colorTemperature) {
      await this.lightRepository.turnOnWithColorTemperature(
        light,
        colorTemperature,
        brightness,
      );
      light.updateState({
        isOn: true,
        colorTemperature,
        brightness,
        color: undefined,
      });
    } else if (brightness) {
      await this.lightRepository.turnOnWithBrightness(light, brightness);
      light.updateState({ isOn: true, brightness });
    } else {
      await this.lightRepository.setPower(light, true);
      light.updateState({ isOn: true });
    }
  }

  /**
   * Turn on group with specific settings
   */
  async turnOnGroupWithSettings(
    group: LightGroup,
    settings: {
      brightness?: Brightness;
      color?: ColorRgb;
      colorTemperature?: ColorTemperature;
    },
  ): Promise<void> {
    if (!group.canBeControlled()) {
      throw new Error(`Group ${group.name} has no controllable lights`);
    }

    const controllableLights = group.getControllableLights();
    const promises = controllableLights.map((light) =>
      this.turnOnLightWithSettings(light, settings),
    );

    await Promise.all(promises);
  }

  // Convenience methods for dial actions and compatibility
  async toggle(light: Light): Promise<void> {
    const action = light.isOn ? "off" : "on";
    await this.controlLight(light, action);
  }

  async setBrightness(light: Light, brightness: Brightness): Promise<void> {
    await this.controlLight(light, "brightness", brightness);
  }

  async setColor(light: Light, color: ColorRgb): Promise<void> {
    await this.controlLight(light, "color", color);
  }

  async setColorTemperature(
    light: Light,
    temperature: ColorTemperature,
  ): Promise<void> {
    await this.controlLight(light, "colorTemperature", temperature);
  }

  /**
   * Toggle light by ID and model (for new action architecture)
   */
  async toggleLight(
    deviceId: string,
    model: string,
    operation: "toggle" | "on" | "off",
  ): Promise<boolean> {
    try {
      // Get light from repository by ID and model
      const light = await this.lightRepository.findLight(deviceId, model);
      if (!light) {
        throw new Error(
          `Light with ID ${deviceId} and model ${model} not found`,
        );
      }

      // Perform the operation
      switch (operation) {
        case "on":
          await this.controlLight(light, "on");
          break;
        case "off":
          await this.controlLight(light, "off");
          break;
        case "toggle":
        default:
          await this.toggle(light);
          break;
      }

      return true;
    } catch (error) {
      console.error(`Failed to ${operation} light ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Set brightness for light by ID and model (for new action architecture)
   */
  async setBrightnessById(
    deviceId: string,
    model: string,
    brightness: number,
  ): Promise<boolean> {
    try {
      const light = await this.lightRepository.findLight(deviceId, model);
      if (!light) {
        throw new Error(
          `Light with ID ${deviceId} and model ${model} not found`,
        );
      }

      const brightnessValue = new Brightness(brightness);
      await this.setBrightness(light, brightnessValue);
      return true;
    } catch (error) {
      console.error(`Failed to set brightness for light ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Set color for light by ID and model (for new action architecture)
   */
  async setColorById(
    deviceId: string,
    model: string,
    color: string,
  ): Promise<boolean> {
    try {
      const light = await this.lightRepository.findLight(deviceId, model);
      if (!light) {
        throw new Error(
          `Light with ID ${deviceId} and model ${model} not found`,
        );
      }

      // Convert hex color to RGB
      const rgb = this.hexToRgb(color);
      if (!rgb) {
        throw new Error(`Invalid color format: ${color}`);
      }

      const colorValue = new ColorRgb(rgb.r, rgb.g, rgb.b);
      await this.setColor(light, colorValue);
      return true;
    } catch (error) {
      console.error(`Failed to set color for light ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Set color temperature for light by ID and model (for new action architecture)
   */
  async setColorTemperatureById(
    deviceId: string,
    model: string,
    temperature: number,
  ): Promise<boolean> {
    try {
      const light = await this.lightRepository.findLight(deviceId, model);
      if (!light) {
        throw new Error(
          `Light with ID ${deviceId} and model ${model} not found`,
        );
      }

      const tempValue = new ColorTemperature(temperature);
      await this.setColorTemperature(light, tempValue);
      return true;
    } catch (error) {
      console.error(
        `Failed to set color temperature for light ${deviceId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Convert hex color to RGB values
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
}
