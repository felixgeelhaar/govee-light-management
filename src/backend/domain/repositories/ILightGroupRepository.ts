import { LightGroup } from "../entities/LightGroup";

export interface ILightGroupRepository {
  /**
   * Get all saved light groups
   */
  getAllGroups(): Promise<LightGroup[]>;

  /**
   * Find a group by its ID
   */
  findGroupById(id: string): Promise<LightGroup | null>;

  /**
   * Find groups by name (case-insensitive search)
   */
  findGroupsByName(name: string): Promise<LightGroup[]>;

  /**
   * Save a light group
   */
  saveGroup(group: LightGroup): Promise<void>;

  /**
   * Delete a light group
   */
  deleteGroup(groupId: string): Promise<void>;

  /**
   * Check if a group name is available
   */
  isGroupNameAvailable(name: string, excludeId?: string): Promise<boolean>;
}
