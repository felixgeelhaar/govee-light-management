import { Light } from "../entities/Light";
import { LightGroup } from "../entities/LightGroup";
import { ILightRepository } from "../repositories/ILightRepository";
import { Brightness } from "../value-objects/Brightness";
import { ColorRgb } from "../value-objects/ColorRgb";
import { ColorTemperature } from "../value-objects/ColorTemperature";

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
    // Attempt control regardless of the device's reported online status. The
    // Govee cloud API's `online` flag is unreliable and frequently reports
    // reachable devices (e.g. H619A string lights) as offline (#311), so
    // pre-blocking here refuses a working device. Instead we send the command
    // and let the transport/repository surface a real error if it genuinely
    // fails. `isOnline` is retained only as a display hint.
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
    /**
     * Optional per-light override. Devices in one group can advertise
     * different accepted ranges, so callers may narrow the value to what
     * each member individually supports instead of sending one value the
     * group's narrowest member would reject.
     */
    perLightValue?: (
      light: Light,
    ) => Brightness | ColorRgb | ColorTemperature | undefined,
  ): Promise<{ failed: Light[] }> {
    const lights = group.lights;
    if (lights.length === 0) {
      throw new Error(`Group ${group.name} has no lights`);
    }

    // Attempt every member regardless of its reported online flag (see
    // controlLight): offline-flagged members are no longer pre-filtered out,
    // because that flag is unreliable (#311).
    // Nothing is awaited before controlLight, so every member's request
    // leaves at the same moment rather than after the ones before it.
    const promises = lights.map((light) =>
      this.controlLight(light, action, perLightValue?.(light) ?? value),
    );

    // Settle rather than race to the first rejection. One unreachable
    // member (a lamp dropped off Wi-Fi, say) must not discard the work
    // that succeeded on every other light — previously `Promise.all`
    // turned a single offline lamp into a failed group command, so the
    // action showed an error even though the rest of the group had
    // already changed.
    const results = await Promise.allSettled(promises);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    // Only a total failure is a failed command.
    if (failures.length === lights.length) {
      throw failures[0].reason;
    }

    return {
      failed: lights.filter((_, index) => results[index].status === "rejected"),
    };
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
    // Attempt regardless of the reported online status (see controlLight): the
    // Govee `online` flag is unreliable and must not pre-block a working
    // device (#311).
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
    const lights = group.lights;
    if (lights.length === 0) {
      throw new Error(`Group ${group.name} has no lights`);
    }

    // Attempt every member regardless of the reported online flag (see
    // controlLight); the flag is unreliable (#311).
    const promises = lights.map((light) =>
      this.turnOnLightWithSettings(light, settings),
    );

    await Promise.all(promises);
  }
}
