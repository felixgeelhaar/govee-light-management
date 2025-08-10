import { ILightGroupRepository } from "../../domain/repositories/ILightGroupRepository";
import { LightGroup } from "../../domain/entities/LightGroup";
import { Light } from "../../domain/entities/Light";
// StreamDeck type will be inferred from the parameter

interface SerializedLightGroup {
  id: string;
  name: string;
  lights: Array<{
    deviceId: string;
    model: string;
    name: string;
  }>;
}

interface LightGroupStorage {
  groups: SerializedLightGroup[];
  version: string;
  [key: string]: unknown; // Allow additional properties for JsonObject compatibility
}

export class StreamDeckLightGroupRepository implements ILightGroupRepository {
  private static readonly STORAGE_KEY = "lightGroups";
  private static readonly STORAGE_VERSION = "1.0";

  private streamDeck: any;

  constructor(streamDeckInstance: any) {
    this.streamDeck = streamDeckInstance;
  }

  /**
   * Get all saved light groups from Stream Deck settings
   */
  async getAllGroups(): Promise<LightGroup[]> {
    try {
      const storage = await this.getStorage();
      const groups: LightGroup[] = [];

      for (const serializedGroup of storage.groups) {
        try {
          const group = await this.deserializeGroup(serializedGroup);
          groups.push(group);
        } catch (error) {
          this.streamDeck?.logger?.warn(
            `Failed to deserialize group ${serializedGroup.id}:`,
            error,
          );
          // Continue with other groups
        }
      }

      return groups;
    } catch (error) {
      this.streamDeck?.logger?.error("Failed to get all groups:", error);
      return [];
    }
  }

  /**
   * Find a group by its ID
   */
  async findGroupById(id: string): Promise<LightGroup | null> {
    try {
      const storage = await this.getStorage();
      const serializedGroup = storage.groups.find((g) => g.id === id);

      if (!serializedGroup) {
        return null;
      }

      return await this.deserializeGroup(serializedGroup);
    } catch (error) {
      this.streamDeck?.logger?.error(
        `Failed to find group by ID ${id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Find groups by name (case-insensitive search)
   */
  async findGroupsByName(name: string): Promise<LightGroup[]> {
    try {
      const allGroups = await this.getAllGroups();
      return allGroups.filter((group) =>
        group.name.toLowerCase().includes(name.toLowerCase()),
      );
    } catch (error) {
      this.streamDeck?.logger?.error(
        `Failed to find groups by name ${name}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Save a light group to Stream Deck settings
   */
  async saveGroup(group: LightGroup): Promise<void> {
    try {
      const storage = await this.getStorage();
      const serializedGroup = this.serializeGroup(group);

      // Replace existing group or add new one
      const existingIndex = storage.groups.findIndex((g) => g.id === group.id);
      if (existingIndex >= 0) {
        storage.groups[existingIndex] = serializedGroup;
      } else {
        storage.groups.push(serializedGroup);
      }

      await this.saveStorage(storage);
      this.streamDeck?.logger?.info(
        `Saved group ${group.name} with ${group.size} lights`,
      );
    } catch (error) {
      this.streamDeck?.logger?.error(
        `Failed to save group ${group.name}:`,
        error,
      );
      throw new Error(
        `Failed to save group: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete a light group from Stream Deck settings
   */
  async deleteGroup(groupId: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      const initialCount = storage.groups.length;

      storage.groups = storage.groups.filter((g) => g.id !== groupId);

      if (storage.groups.length === initialCount) {
        this.streamDeck?.logger?.warn(
          `Group ${groupId} not found for deletion`,
        );
        return;
      }

      await this.saveStorage(storage);
      this.streamDeck?.logger?.info(`Deleted group ${groupId}`);
    } catch (error) {
      this.streamDeck?.logger?.error(
        `Failed to delete group ${groupId}:`,
        error,
      );
      throw new Error(
        `Failed to delete group: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Check if a group name is available
   */
  async isGroupNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    try {
      const storage = await this.getStorage();
      return !storage.groups.some(
        (g) =>
          g.name.toLowerCase() === name.toLowerCase() && g.id !== excludeId,
      );
    } catch (error) {
      this.streamDeck?.logger?.error(
        `Failed to check name availability for ${name}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get storage from file system or Stream Deck settings
   */
  private async getStorage(): Promise<LightGroupStorage> {
    // Try file system first
    try {
      const storage = await this.getFromFileSystem();
      if (
        storage &&
        storage.version === StreamDeckLightGroupRepository.STORAGE_VERSION
      ) {
        return storage;
      }
    } catch (error) {
      this.streamDeck?.logger?.warn(
        "Failed to get storage from file system:",
        error,
      );
    }

    // Try Stream Deck settings as fallback
    if (this.streamDeck?.settings?.getGlobalSettings) {
      try {
        const settings = await this.streamDeck.settings.getGlobalSettings();
        const storageData =
          settings[StreamDeckLightGroupRepository.STORAGE_KEY];
        const storage = storageData as unknown as LightGroupStorage;

        if (
          storage &&
          storage.version === StreamDeckLightGroupRepository.STORAGE_VERSION
        ) {
          return storage;
        }
      } catch (error) {
        this.streamDeck?.logger?.warn(
          "Failed to get storage from Stream Deck settings:",
          error,
        );
      }
    }

    // Return default storage if both methods fail
    return {
      groups: [],
      version: StreamDeckLightGroupRepository.STORAGE_VERSION,
    };
  }

  /**
   * Get storage from file system
   */
  private async getFromFileSystem(): Promise<LightGroupStorage | null> {
    const fs = require("fs").promises;
    const path = require("path");

    const pluginDir = process.cwd();
    const storageFile = path.join(pluginDir, "light-groups.json");

    try {
      const data = await fs.readFile(storageFile, "utf8");
      const storage = JSON.parse(data) as LightGroupStorage;
      this.streamDeck?.logger?.info(
        `Loaded group storage from file: ${storageFile}`,
      );
      return storage;
    } catch (error) {
      // File doesn't exist or is invalid - this is normal for first run
      return null;
    }
  }

  /**
   * Save storage with fallback methods
   */
  private async saveStorage(storage: LightGroupStorage): Promise<void> {
    this.streamDeck?.logger?.info("Attempting to save group storage:", {
      groupCount: storage.groups.length,
      version: storage.version,
      sdkAvailable: !!this.streamDeck,
      settingsAvailable: !!this.streamDeck?.settings,
    });

    // Try file system storage first (more reliable)
    try {
      await this.saveToFileSystem(storage);
      this.streamDeck?.logger?.info(
        "Successfully saved group storage to file system",
      );
      return;
    } catch (fileError) {
      this.streamDeck?.logger?.warn(
        "File system save failed, trying Stream Deck settings:",
        fileError,
      );
    }

    // Fallback to Stream Deck settings if available
    if (this.streamDeck?.settings?.setGlobalSettings) {
      try {
        await this.saveToStreamDeckSettings(storage);
        this.streamDeck?.logger?.info(
          "Successfully saved group storage to Stream Deck settings",
        );
        return;
      } catch (sdError) {
        this.streamDeck?.logger?.error(
          "Stream Deck settings save also failed:",
          sdError,
        );
      }
    }

    throw new Error("All storage methods failed - unable to save group");
  }

  /**
   * Save to file system as primary storage method
   */
  private async saveToFileSystem(storage: LightGroupStorage): Promise<void> {
    const fs = require("fs").promises;
    const path = require("path");

    // Save to plugin directory
    const pluginDir = process.cwd();
    const storageFile = path.join(pluginDir, "light-groups.json");

    try {
      await fs.writeFile(storageFile, JSON.stringify(storage, null, 2), "utf8");
      this.streamDeck?.logger?.info(
        `Saved group storage to file: ${storageFile}`,
      );
    } catch (error) {
      throw new Error(
        `Failed to save to file system: ${error instanceof Error ? error.message : "Unknown file error"}`,
      );
    }
  }

  /**
   * Save to Stream Deck settings API (fallback method)
   */
  private async saveToStreamDeckSettings(
    storage: LightGroupStorage,
  ): Promise<void> {
    if (!this.streamDeck?.settings?.setGlobalSettings) {
      throw new Error("Stream Deck settings API not available");
    }

    // Get existing settings
    let settings;
    try {
      settings = await this.streamDeck.settings.getGlobalSettings();
    } catch (getError) {
      this.streamDeck?.logger?.warn(
        "Failed to get global settings, using empty object:",
        getError,
      );
      settings = {};
    }

    settings[StreamDeckLightGroupRepository.STORAGE_KEY] = storage as any;
    await this.streamDeck.settings.setGlobalSettings(settings);
  }

  /**
   * Serialize a LightGroup for storage
   */
  private serializeGroup(group: LightGroup): SerializedLightGroup {
    return {
      id: group.id,
      name: group.name,
      lights: group.lights.map((light) => ({
        deviceId: light.deviceId,
        model: light.model,
        name: light.name,
      })),
    };
  }

  /**
   * Deserialize a stored group back to LightGroup
   * Note: This creates Light entities with default state - actual state should be fetched separately
   */
  private async deserializeGroup(
    serializedGroup: SerializedLightGroup,
  ): Promise<LightGroup> {
    const lights = serializedGroup.lights.map((lightData) =>
      Light.create(lightData.deviceId, lightData.model, lightData.name, {
        isOn: false,
        isOnline: true,
        brightness: undefined,
        color: undefined,
        colorTemperature: undefined,
      }),
    );

    return LightGroup.create(serializedGroup.id, serializedGroup.name, lights);
  }
}
