import { LightGroup } from "../entities/LightGroup";
import { ILightGroupRepository } from "../repositories/ILightGroupRepository";
import { LightControlService } from "./LightControlService";

/**
 * Service for controlling light groups (power, brightness, color, etc.)
 * Separate from LightGroupService which handles group management
 */
export class GroupControlService {
  constructor(
    private readonly groupRepository: ILightGroupRepository,
    private readonly lightControlService?: LightControlService,
  ) {}

  /**
   * Toggle group by ID (for new action architecture)
   */
  async toggleGroup(
    groupId: string,
    operation: "toggle" | "on" | "off",
  ): Promise<boolean> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      if (!group.canBeControlled()) {
        throw new Error(`Group ${group.name} has no controllable lights`);
      }

      const controllableLights = group.getControllableLights();
      const promises = controllableLights.map(async (light) => {
        switch (operation) {
          case "on":
            return this.lightControlService?.controlLight(light, "on");
          case "off":
            return this.lightControlService?.controlLight(light, "off");
          case "toggle":
          default:
            return this.lightControlService?.toggle(light);
        }
      });

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error(`Failed to ${operation} group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Set brightness for all lights in group (alias for setBrightnessById)
   */
  async setBrightnessGroup(
    groupId: string,
    brightness: number,
  ): Promise<boolean> {
    return this.setBrightnessById(groupId, brightness);
  }

  /**
   * Set brightness for all lights in group
   */
  async setBrightnessById(
    groupId: string,
    brightness: number,
  ): Promise<boolean> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      if (!group.canBeControlled()) {
        throw new Error(`Group ${group.name} has no controllable lights`);
      }

      const controllableLights = group.getControllableLights();
      const promises = controllableLights.map((light) =>
        this.lightControlService?.setBrightnessById(
          light.deviceId,
          light.model,
          brightness,
        ),
      );

      const results = await Promise.all(promises);
      return results.every((result) => result === true);
    } catch (error) {
      console.error(`Failed to set brightness for group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Set color for all lights in group
   */
  async setColorById(groupId: string, color: string): Promise<boolean> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      if (!group.canBeControlled()) {
        throw new Error(`Group ${group.name} has no controllable lights`);
      }

      const controllableLights = group.getControllableLights();
      const promises = controllableLights.map((light) =>
        this.lightControlService?.setColorById(
          light.deviceId,
          light.model,
          color,
        ),
      );

      const results = await Promise.all(promises);
      return results.every((result) => result === true);
    } catch (error) {
      console.error(`Failed to set color for group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Set color temperature for all lights in group
   */
  async setColorTemperatureById(
    groupId: string,
    temperature: number,
  ): Promise<boolean> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      if (!group.canBeControlled()) {
        throw new Error(`Group ${group.name} has no controllable lights`);
      }

      const controllableLights = group.getControllableLights();
      const promises = controllableLights.map((light) =>
        this.lightControlService?.setColorTemperatureById(
          light.deviceId,
          light.model,
          temperature,
        ),
      );

      const results = await Promise.all(promises);
      return results.every((result) => result === true);
    } catch (error) {
      console.error(
        `Failed to set color temperature for group ${groupId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Test group by making all lights flash
   */
  async testGroup(groupId: string): Promise<boolean> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      if (!group.canBeControlled()) {
        throw new Error(`Group ${group.name} has no controllable lights`);
      }

      const controllableLights = group.getControllableLights();

      // Flash sequence: turn off, wait, turn on, wait, restore original states
      const originalStates = controllableLights.map((light) => light.isOn);

      // Turn all lights off
      await Promise.all(
        controllableLights.map((light) =>
          this.lightControlService?.controlLight(light, "off"),
        ),
      );

      // Wait 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Turn all lights on
      await Promise.all(
        controllableLights.map((light) =>
          this.lightControlService?.controlLight(light, "on"),
        ),
      );

      // Wait 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restore original states
      await Promise.all(
        controllableLights.map((light, index) => {
          const wasOn = originalStates[index];
          return this.lightControlService?.controlLight(
            light,
            wasOn ? "on" : "off",
          );
        }),
      );

      return true;
    } catch (error) {
      console.error(`Failed to test group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Get group state information
   */
  async getGroupState(groupId: string): Promise<{
    isOn: boolean;
    isConnected: boolean;
    lightCount: number;
    controllableLightCount: number;
  } | null> {
    try {
      const group = await this.groupRepository.findGroupById(groupId);
      if (!group) {
        return null;
      }

      const controllableLights = group.getControllableLights();
      const onLights = controllableLights.filter((light) => light.isOn);

      return {
        isOn: onLights.length > 0, // Group is "on" if any lights are on
        isConnected: controllableLights.length > 0, // Group is "connected" if any lights are controllable
        lightCount: group.lights.length,
        controllableLightCount: controllableLights.length,
      };
    } catch (error) {
      console.error(`Failed to get group state for ${groupId}:`, error);
      return null;
    }
  }
}
