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
}
