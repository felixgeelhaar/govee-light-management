import { Light } from '../entities/Light';
import { LightGroup } from '../entities/LightGroup';
import { ILightGroupRepository } from '../repositories/ILightGroupRepository';
import { ILightRepository } from '../repositories/ILightRepository';

export class LightGroupService {
  constructor(
    private readonly groupRepository: ILightGroupRepository,
    private readonly lightRepository: ILightRepository,
  ) {}

  /**
   * Create a new light group
   */
  async createGroup(name: string, lightIds: Array<{deviceId: string, model: string}>): Promise<LightGroup> {
    // Validate group name is available
    const isNameAvailable = await this.groupRepository.isGroupNameAvailable(name);
    if (!isNameAvailable) {
      throw new Error(`Group name "${name}" is already taken`);
    }

    // Fetch lights and validate they exist
    const lights: Light[] = [];
    for (const lightId of lightIds) {
      const light = await this.lightRepository.findLight(lightId.deviceId, lightId.model);
      if (!light) {
        throw new Error(`Light with device ID ${lightId.deviceId} and model ${lightId.model} not found`);
      }
      lights.push(light);
    }

    // Generate unique ID for the group
    const groupId = this.generateGroupId(name);
    
    // Create and save the group
    const group = LightGroup.create(groupId, name, lights);
    await this.groupRepository.saveGroup(group);

    return group;
  }

  /**
   * Add light to an existing group
   */
  async addLightToGroup(groupId: string, deviceId: string, model: string): Promise<void> {
    const group = await this.groupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    const light = await this.lightRepository.findLight(deviceId, model);
    if (!light) {
      throw new Error(`Light with device ID ${deviceId} and model ${model} not found`);
    }

    group.addLight(light);
    await this.groupRepository.saveGroup(group);
  }

  /**
   * Remove light from a group
   */
  async removeLightFromGroup(groupId: string, deviceId: string, model: string): Promise<void> {
    const group = await this.groupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    const light = await this.lightRepository.findLight(deviceId, model);
    if (!light) {
      throw new Error(`Light with device ID ${deviceId} and model ${model} not found`);
    }

    group.removeLight(light);
    
    if (group.isEmpty) {
      await this.groupRepository.deleteGroup(groupId);
    } else {
      await this.groupRepository.saveGroup(group);
    }
  }

  /**
   * Update group name
   */
  async updateGroupName(groupId: string, newName: string): Promise<void> {
    const group = await this.groupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    // Check if new name is available (excluding current group)
    const isNameAvailable = await this.groupRepository.isGroupNameAvailable(newName, groupId);
    if (!isNameAvailable) {
      throw new Error(`Group name "${newName}" is already taken`);
    }

    // Create new group with updated name (immutable entity pattern)
    const updatedGroup = LightGroup.create(groupId, newName, group.lights);
    await this.groupRepository.saveGroup(updatedGroup);
  }

  /**
   * Update group with new name and lights
   */
  async updateGroup(groupId: string, newName: string, lightIds: Array<{deviceId: string, model: string}>): Promise<LightGroup> {
    const group = await this.groupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    // Check if new name is available (excluding current group)
    const isNameAvailable = await this.groupRepository.isGroupNameAvailable(newName, groupId);
    if (!isNameAvailable) {
      throw new Error(`Group name "${newName}" is already taken`);
    }

    // Fetch lights and validate they exist
    const lights: Light[] = [];
    for (const lightId of lightIds) {
      const light = await this.lightRepository.findLight(lightId.deviceId, lightId.model);
      if (!light) {
        throw new Error(`Light with device ID ${lightId.deviceId} and model ${lightId.model} not found`);
      }
      lights.push(light);
    }

    // Create updated group
    const updatedGroup = LightGroup.create(groupId, newName, lights);
    await this.groupRepository.saveGroup(updatedGroup);

    return updatedGroup;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    const group = await this.groupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    await this.groupRepository.deleteGroup(groupId);
  }

  /**
   * Get all groups
   */
  async getAllGroups(): Promise<LightGroup[]> {
    return await this.groupRepository.getAllGroups();
  }

  /**
   * Find group by ID
   */
  async findGroupById(groupId: string): Promise<LightGroup | null> {
    return await this.groupRepository.findGroupById(groupId);
  }

  /**
   * Find groups containing a specific light
   */
  async findGroupsContainingLight(deviceId: string, model: string): Promise<LightGroup[]> {
    const allGroups = await this.groupRepository.getAllGroups();
    const light = await this.lightRepository.findLight(deviceId, model);
    
    if (!light) {
      return [];
    }

    return allGroups.filter(group => group.hasLight(light));
  }

  /**
   * Generate a unique ID for a new group
   */
  private generateGroupId(name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `group-${sanitizedName}-${timestamp}`;
  }
}