/**
 * Migration Handler for Plugin Startup
 *
 * Handles detection and migration of legacy settings during plugin initialization
 */

import { streamDeck } from "../plugin";
import {
  SettingsMigrationService,
  LegacySettings,
  MigrationResult,
} from "./SettingsMigrationService";

/**
 * Migration status stored in global settings
 */
interface MigrationStatus {
  version: string;
  migratedAt: string;
  legacyActionsFound: string[];
  newActionsCreated: string[];
  userNotified: boolean;
}

export class MigrationHandler {
  private static readonly MIGRATION_KEY = "govee_migration_status";
  private static readonly CURRENT_VERSION = "2.0.0";

  /**
   * Check for legacy settings and perform migration if needed
   */
  public static async checkAndMigrate(): Promise<void> {
    try {
      streamDeck?.logger?.info("Checking for legacy settings to migrate...");

      // Check if migration has already been performed
      const migrationStatus = await this.getMigrationStatus();
      if (migrationStatus && migrationStatus.version === this.CURRENT_VERSION) {
        streamDeck?.logger?.info(
          "Migration already completed for version",
          this.CURRENT_VERSION,
        );
        return;
      }

      // Scan for legacy action instances
      const legacySettings = await this.scanForLegacySettings();

      if (this.hasLegacySettings(legacySettings)) {
        streamDeck?.logger?.info(
          "Legacy settings found, performing migration...",
        );
        const migrationResult = await this.performMigration(legacySettings);
        await this.saveMigrationStatus(migrationResult);
        await this.notifyUserOfMigration(migrationResult);
      } else {
        streamDeck?.logger?.info(
          "No legacy settings found, skipping migration",
        );
        await this.saveMigrationStatus({
          migrated: { toggle: [], brightness: [], color: [], warmth: [] },
          recommendations: [],
          warnings: [],
        });
      }
    } catch (error) {
      streamDeck?.logger?.error("Migration failed:", error);
      // Don't fail plugin startup due to migration issues
    }
  }

  /**
   * Scan Stream Deck for legacy action instances and their settings
   */
  private static async scanForLegacySettings(): Promise<LegacySettings> {
    const legacySettings: LegacySettings = {};

    try {
      // Try to get global settings that might contain legacy data
      const globalSettings = await this.getGlobalSettings();

      // Check if there are any saved light control or group control settings
      if (globalSettings) {
        // Look for keys that indicate legacy settings
        for (const [key, value] of Object.entries(globalSettings)) {
          if (key.includes("lightControl") || key.includes("lights")) {
            legacySettings.lightControl = value as any;
          }
          if (key.includes("groupControl") || key.includes("groups")) {
            legacySettings.groupControl = value as any;
          }
        }
      }

      // Also check for any action-specific settings that might be stored
      // This is a best-effort attempt since we can't directly query all action instances
    } catch (error) {
      streamDeck?.logger?.warn("Error scanning for legacy settings:", error);
    }

    return legacySettings;
  }

  /**
   * Perform the actual migration
   */
  private static async performMigration(
    legacySettings: LegacySettings,
  ): Promise<MigrationResult> {
    const migrationResult =
      SettingsMigrationService.migrateLegacySettings(legacySettings);

    // Log migration results
    streamDeck?.logger?.info("Migration completed:", {
      toggleActions: migrationResult.migrated.toggle?.length || 0,
      brightnessActions: migrationResult.migrated.brightness?.length || 0,
      colorActions: migrationResult.migrated.color?.length || 0,
      warmthActions: migrationResult.migrated.warmth?.length || 0,
      recommendations: migrationResult.recommendations.length,
      warnings: migrationResult.warnings.length,
    });

    return migrationResult;
  }

  /**
   * Notify user of migration results through Stream Deck notifications
   */
  private static async notifyUserOfMigration(
    migrationResult: MigrationResult,
  ): Promise<void> {
    try {
      const totalActions =
        (migrationResult.migrated.toggle?.length || 0) +
        (migrationResult.migrated.brightness?.length || 0) +
        (migrationResult.migrated.color?.length || 0) +
        (migrationResult.migrated.warmth?.length || 0);

      if (totalActions > 0) {
        // Show notification about successful migration
        // Note: system.showAlert() not available in this context, use logger instead

        const message =
          `Govee Light Management: Migrated to new Elgato-style actions! ` +
          `Found settings for ${totalActions} action${totalActions > 1 ? "s" : ""}. ` +
          `Check the plugin's property inspectors for migration recommendations.`;

        streamDeck?.logger?.info(message);

        // Store recommendations for display in property inspectors
        await this.storeRecommendations(migrationResult.recommendations);
      }
    } catch (error) {
      streamDeck?.logger?.warn("Failed to notify user of migration:", error);
    }
  }

  /**
   * Store migration recommendations for property inspectors to display
   */
  private static async storeRecommendations(
    recommendations: string[],
  ): Promise<void> {
    try {
      const globalSettings = (await this.getGlobalSettings()) || {};
      globalSettings.migrationRecommendations = recommendations;
      globalSettings.migrationRecommendationsTimestamp =
        new Date().toISOString();

      await streamDeck?.settings.setGlobalSettings(globalSettings);
    } catch (error) {
      streamDeck?.logger?.warn(
        "Failed to store migration recommendations:",
        error,
      );
    }
  }

  /**
   * Save migration status to prevent repeat migrations
   */
  private static async saveMigrationStatus(
    migrationResult: MigrationResult,
  ): Promise<void> {
    try {
      const status: MigrationStatus = {
        version: this.CURRENT_VERSION,
        migratedAt: new Date().toISOString(),
        legacyActionsFound: this.extractLegacyActionIds(migrationResult),
        newActionsCreated: this.extractNewActionIds(migrationResult),
        userNotified: true,
      };

      const globalSettings = (await this.getGlobalSettings()) || {};
      globalSettings[this.MIGRATION_KEY] = status;

      await streamDeck?.settings.setGlobalSettings(globalSettings);
      streamDeck?.logger?.info("Migration status saved");
    } catch (error) {
      streamDeck?.logger?.error("Failed to save migration status:", error);
    }
  }

  /**
   * Get migration status from global settings
   */
  private static async getMigrationStatus(): Promise<MigrationStatus | null> {
    try {
      const globalSettings = await this.getGlobalSettings();
      return globalSettings?.[this.MIGRATION_KEY] || null;
    } catch (error) {
      streamDeck?.logger?.warn("Failed to get migration status:", error);
      return null;
    }
  }

  /**
   * Get global settings with error handling
   */
  private static async getGlobalSettings(): Promise<any> {
    try {
      if (streamDeck?.settings?.getGlobalSettings) {
        return await streamDeck.settings.getGlobalSettings();
      }
      return null;
    } catch (error) {
      streamDeck?.logger?.warn("Failed to get global settings:", error);
      return null;
    }
  }

  /**
   * Check if legacy settings exist
   */
  private static hasLegacySettings(legacySettings: LegacySettings): boolean {
    return !!(
      legacySettings.lightControl?.selectedDeviceId ||
      legacySettings.groupControl?.selectedGroupId
    );
  }

  /**
   * Extract legacy action identifiers from migration result
   */
  private static extractLegacyActionIds(
    migrationResult: MigrationResult,
  ): string[] {
    const ids: string[] = [];

    // This would be populated with actual legacy action UUIDs if we could detect them
    // For now, we'll use a generic identifier
    if (migrationResult.migrated.toggle?.length)
      ids.push("legacy-light-control");
    if (migrationResult.migrated.brightness?.length)
      ids.push("legacy-group-control");

    return ids;
  }

  /**
   * Extract new action identifiers from migration result
   */
  private static extractNewActionIds(
    migrationResult: MigrationResult,
  ): string[] {
    const ids: string[] = [];

    if (migrationResult.migrated.toggle?.length)
      ids.push("com.felixgeelhaar.govee-light-management.toggle");
    if (migrationResult.migrated.brightness?.length)
      ids.push("com.felixgeelhaar.govee-light-management.brightness");
    if (migrationResult.migrated.color?.length)
      ids.push("com.felixgeelhaar.govee-light-management.color");
    if (migrationResult.migrated.warmth?.length)
      ids.push("com.felixgeelhaar.govee-light-management.warmth");

    return ids;
  }

  /**
   * Get migration recommendations for display in property inspectors
   */
  public static async getMigrationRecommendations(): Promise<string[]> {
    try {
      const globalSettings = await this.getGlobalSettings();
      return globalSettings?.migrationRecommendations || [];
    } catch (error) {
      streamDeck?.logger?.warn(
        "Failed to get migration recommendations:",
        error,
      );
      return [];
    }
  }

  /**
   * Clear migration recommendations after user has seen them
   */
  public static async clearMigrationRecommendations(): Promise<void> {
    try {
      const globalSettings = (await this.getGlobalSettings()) || {};
      delete globalSettings.migrationRecommendations;
      delete globalSettings.migrationRecommendationsTimestamp;

      await streamDeck?.settings.setGlobalSettings(globalSettings);
    } catch (error) {
      streamDeck?.logger?.warn(
        "Failed to clear migration recommendations:",
        error,
      );
    }
  }

  /**
   * Generate default settings for a new action type
   */
  public static generateDefaultActionSettings(
    actionType: "toggle" | "brightness" | "color" | "warmth",
    targetType: "light" | "group",
    targetId: string,
    targetName: string,
    apiKey?: string,
  ): any {
    return SettingsMigrationService.generateDefaultSettings(
      actionType,
      targetType,
      targetId,
      targetName,
      apiKey,
    );
  }
}
