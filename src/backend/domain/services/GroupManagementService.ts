import { ILightRepository } from "../repositories/ILightRepository";
import { LightControlService } from "./LightControlService";
import { LightGroup } from "../entities/LightGroup";
import { Light } from "../entities/Light";

/**
 * Service for managing groups of lights
 */
export class GroupManagementService {
  constructor(
    private readonly lightRepository: ILightRepository,
    private readonly lightControlService: LightControlService,
  ) {}

  /**
   * Toggle all lights in a group
   */
  async toggleGroup(group: LightGroup): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    // Determine if we should turn on or off
    // If any light is on, turn all off. Otherwise, turn all on.
    const anyLightOn = group.lights.some((light) => light.isOn);

    for (const light of group.lights) {
      try {
        if (anyLightOn && light.isOn) {
          // Turn off lights that are on
          await this.lightControlService.controlLight(light, "off");
        } else if (!anyLightOn && !light.isOn) {
          // Turn on lights that are off
          await this.lightControlService.controlLight(light, "on");
        }
      } catch (error) {
        console.error(`Failed to toggle light ${light.name}:`, error);
        // Continue with other lights even if one fails
      }
    }
  }

  /**
   * Set brightness for all lights in a group
   */
  async setGroupBrightness(
    group: LightGroup,
    brightness: number,
  ): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    const { Brightness } = await import("@felixgeelhaar/govee-api-client");
    const brightnessValue = new Brightness(brightness);

    for (const light of group.lights) {
      try {
        await this.lightControlService.controlLight(
          light,
          "brightness",
          brightnessValue,
        );
      } catch (error) {
        console.error(`Failed to set brightness for ${light.name}:`, error);
        // Continue with other lights
      }
    }
  }

  /**
   * Set color for all lights in a group
   */
  async setGroupColor(
    group: LightGroup,
    r: number,
    g: number,
    b: number,
  ): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    const { ColorRgb } = await import("@felixgeelhaar/govee-api-client");
    const color = new ColorRgb(r, g, b);

    for (const light of group.lights) {
      try {
        await this.lightControlService.controlLight(light, "color", color);
      } catch (error) {
        console.error(`Failed to set color for ${light.name}:`, error);
        // Continue with other lights
      }
    }
  }

  /**
   * Set color temperature for all lights in a group
   */
  async setGroupColorTemperature(
    group: LightGroup,
    kelvin: number,
  ): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    const { ColorTemperature } = await import(
      "@felixgeelhaar/govee-api-client"
    );
    const temperature = new ColorTemperature(kelvin);

    for (const light of group.lights) {
      try {
        await this.lightControlService.controlLight(
          light,
          "colorTemperature",
          temperature,
        );
      } catch (error) {
        console.error(
          `Failed to set color temperature for ${light.name}:`,
          error,
        );
        // Continue with other lights
      }
    }
  }

  /**
   * Create a new group of lights
   */
  async createGroup(name: string, lightIds: string[]): Promise<LightGroup> {
    const allLights = await this.lightRepository.getAllLights();
    const groupLights = allLights.filter((light) =>
      lightIds.includes(light.deviceId),
    );

    if (groupLights.length === 0) {
      throw new Error("No valid lights found for the group");
    }

    return LightGroup.create(`group-${Date.now()}`, name, groupLights);
  }

  /**
   * Apply a scene to a group
   */
  async applyScene(
    group: LightGroup,
    scene: {
      brightness?: number;
      color?: { r: number; g: number; b: number };
      colorTemperature?: number;
    },
  ): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    // Apply scene settings to all lights
    const promises: Promise<void>[] = [];

    if (scene.brightness !== undefined) {
      promises.push(this.setGroupBrightness(group, scene.brightness));
    }

    if (scene.color) {
      promises.push(
        this.setGroupColor(group, scene.color.r, scene.color.g, scene.color.b),
      );
    }

    if (scene.colorTemperature !== undefined) {
      promises.push(
        this.setGroupColorTemperature(group, scene.colorTemperature),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get average brightness of a group
   */
  getAverageBrightness(group: LightGroup): number {
    if (!group || group.lights.length === 0) {
      return 0;
    }

    const brightnesses = group.lights
      .filter((light) => light.brightness)
      .map((light) => light.brightness!.level);

    if (brightnesses.length === 0) {
      return 50; // Default brightness
    }

    return Math.round(
      brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length,
    );
  }

  /**
   * Get group status summary
   */
  getGroupStatus(group: LightGroup): {
    totalLights: number;
    onlineLights: number;
    onLights: number;
    averageBrightness: number;
  } {
    if (!group) {
      return {
        totalLights: 0,
        onlineLights: 0,
        onLights: 0,
        averageBrightness: 0,
      };
    }

    return {
      totalLights: group.lights.length,
      onlineLights: group.lights.filter((l) => l.isOnline).length,
      onLights: group.lights.filter((l) => l.isOn).length,
      averageBrightness: this.getAverageBrightness(group),
    };
  }

  /**
   * Sync lights in a group with a delay between each
   */
  async syncGroupWithDelay(
    group: LightGroup,
    operation: (light: Light) => Promise<void>,
    delayMs: number = 50,
  ): Promise<void> {
    if (!group || group.lights.length === 0) {
      return;
    }

    for (let i = 0; i < group.lights.length; i++) {
      const light = group.lights[i];

      try {
        await operation(light);

        // Add delay between lights (except for the last one)
        if (i < group.lights.length - 1 && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`Failed to sync light ${light.name}:`, error);
        // Continue with other lights
      }
    }
  }
}
