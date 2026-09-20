import { ILightGroupRepository } from "../../domain/repositories/ILightGroupRepository";
import { LightGroup } from "../../domain/entities/LightGroup";
import { Light } from "../../domain/entities/Light";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

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
  private static readonly STORAGE_KEY = "govee_v1_lightGroups";
  private static readonly STORAGE_VERSION = "1.1";
  /** Previous versions to migrate from (oldest first). */
  private static readonly LEGACY_VERSIONS = ["1.0"];

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
          streamDeck.logger.warn(
            `Failed to deserialize group ${serializedGroup.id}:`,
            error,
          );
          // Continue with other groups
        }
      }

      return groups;
    } catch (error) {
      streamDeck.logger.error("Failed to get all groups:", error);
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
      streamDeck.logger.error(`Failed to find group by ID ${id}:`, error);
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
      streamDeck.logger.error(`Failed to find groups by name ${name}:`, error);
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
      streamDeck.logger.info(
        `Saved group ${group.name} with ${group.size} lights`,
      );
    } catch (error) {
      streamDeck.logger.error(`Failed to save group ${group.name}:`, error);
      throw new Error(
        `Failed to save group: ${error instanceof Error ? error.message : "Unknown error"}`,
        { cause: error },
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
        streamDeck.logger.warn(`Group ${groupId} not found for deletion`);
        return;
      }

      await this.saveStorage(storage);
      streamDeck.logger.info(`Deleted group ${groupId}`);
    } catch (error) {
      streamDeck.logger.error(`Failed to delete group ${groupId}:`, error);
      throw new Error(
        `Failed to delete group: ${error instanceof Error ? error.message : "Unknown error"}`,
        { cause: error },
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
      streamDeck.logger.error(
        `Failed to check name availability for ${name}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get storage from Stream Deck global settings
   */
  private async getStorage(): Promise<LightGroupStorage> {
    try {
      const settings = await streamDeck.settings.getGlobalSettings();
      const storageData = settings[StreamDeckLightGroupRepository.STORAGE_KEY];
      const storage = storageData as unknown as LightGroupStorage;

      if (!storage) {
        return {
          groups: [],
          version: StreamDeckLightGroupRepository.STORAGE_VERSION,
        };
      }

      // Migrate from a previous version: keep existing groups, bump version
      if (
        storage.version !== StreamDeckLightGroupRepository.STORAGE_VERSION &&
        StreamDeckLightGroupRepository.LEGACY_VERSIONS.includes(storage.version)
      ) {
        streamDeck.logger.info(
          `Migrating light group storage from v${storage.version} to v${StreamDeckLightGroupRepository.STORAGE_VERSION}`,
        );
        storage.version = StreamDeckLightGroupRepository.STORAGE_VERSION;
        try {
          await this.saveStorage(storage);
        } catch (error) {
          // The read succeeded; only persisting the bumped version failed.
          // Returning the migrated groups is still right — the next write
          // will carry the new version with it.
          streamDeck.logger.warn(
            "Migrated light group storage could not be persisted:",
            error,
          );
        }
      }

      if (storage.version !== StreamDeckLightGroupRepository.STORAGE_VERSION) {
        // Unknown version — start fresh rather than corrupt data
        return {
          groups: [],
          version: StreamDeckLightGroupRepository.STORAGE_VERSION,
        };
      }

      return storage;
    } catch (error) {
      // Rethrow. This used to return an empty store, which made "the settings
      // API is unavailable" indistinguishable from "you have no groups" — and
      // saveGroup builds the envelope it writes from this result, so one
      // transient read failure before a save replaced every saved group with
      // the single new one.
      //
      // Every caller already carries the fail-safe it wants: getAllGroups
      // returns none, findGroupById null, isGroupNameAvailable false ("assume
      // taken" — a guard that could never run while this swallowed the
      // error), and the writers abort with the cause attached.
      streamDeck.logger.error("Failed to get storage:", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to read light group storage", { cause: error });
    }
  }

  /**
   * Save storage to Stream Deck global settings
   */
  private async saveStorage(storage: LightGroupStorage): Promise<void> {
    try {
      const settings = await streamDeck.settings.getGlobalSettings();
      settings[StreamDeckLightGroupRepository.STORAGE_KEY] =
        storage as unknown as JsonValue;
      await streamDeck.settings.setGlobalSettings(settings);
    } catch (error) {
      streamDeck.logger.error("Failed to save storage:", error);
      throw new Error("Failed to save group storage", { cause: error });
    }
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
