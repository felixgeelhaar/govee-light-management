/**
 * Settings Migration Service
 *
 * Handles migration from old combined action architecture to new Elgato-style focused actions
 */

import {
  LightControlSettings,
  GroupControlSettings,
} from "../../shared/types/settings";
import {
  ToggleActionSettings,
  BrightnessActionSettings,
  ColorActionSettings,
  WarmthActionSettings,
  TargetType,
} from "../../shared/types/newActions";

/**
 * Legacy settings that need migration
 */
export interface LegacySettings {
  lightControl?: LightControlSettings;
  groupControl?: GroupControlSettings;
}

/**
 * Migrated settings for new actions
 */
export interface MigratedSettings {
  toggle?: ToggleActionSettings[];
  brightness?: BrightnessActionSettings[];
  color?: ColorActionSettings[];
  warmth?: WarmthActionSettings[];
}

/**
 * Migration result with recommendations
 */
export interface MigrationResult {
  migrated: MigratedSettings;
  recommendations: string[];
  warnings: string[];
}

export class SettingsMigrationService {
  /**
   * Migrate legacy settings to new action structure
   */
  public static migrateLegacySettings(legacy: LegacySettings): MigrationResult {
    const migrated: MigratedSettings = {
      toggle: [],
      brightness: [],
      color: [],
      warmth: [],
    };

    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Migrate light control settings
    if (legacy.lightControl) {
      const result = this.migrateLightControlSettings(legacy.lightControl);
      this.mergeMigrationResults(migrated, result);

      if (legacy.lightControl.selectedDeviceId) {
        recommendations.push(
          `Light "${legacy.lightControl.selectedLightName || legacy.lightControl.selectedDeviceId}" has been migrated to new focused actions`,
        );
      }
    }

    // Migrate group control settings
    if (legacy.groupControl) {
      const result = this.migrateGroupControlSettings(legacy.groupControl);
      this.mergeMigrationResults(migrated, result);

      if (legacy.groupControl.selectedGroupId) {
        recommendations.push(
          `Group "${legacy.groupControl.selectedGroupName || legacy.groupControl.selectedGroupId}" has been migrated to new focused actions`,
        );
      }
    }

    // Add general recommendations
    if (
      migrated.toggle?.length ||
      migrated.brightness?.length ||
      migrated.color?.length ||
      migrated.warmth?.length
    ) {
      recommendations.push(
        "Consider adding the new focused actions to your Stream Deck for better control",
      );
      recommendations.push(
        "The old combined actions can be removed once you've added the new focused actions",
      );
    }

    return { migrated, recommendations, warnings };
  }

  /**
   * Migrate individual light control settings
   */
  private static migrateLightControlSettings(
    settings: LightControlSettings,
  ): MigratedSettings {
    const migrated: MigratedSettings = {
      toggle: [],
      brightness: [],
      color: [],
      warmth: [],
    };

    if (!settings.selectedDeviceId || !settings.selectedModel) {
      return migrated;
    }

    const baseSettings = {
      apiKey: settings.apiKey,
      targetType: "light" as TargetType,
      lightId: settings.selectedDeviceId,
      lightModel: settings.selectedModel,
      lightName: settings.selectedLightName || settings.selectedDeviceId,
    };

    // Create actions based on control mode or create all if no specific mode
    const controlMode = settings.controlMode || "toggle";

    switch (controlMode) {
      case "toggle":
      case "on":
      case "off":
        migrated.toggle!.push({
          ...baseSettings,
          operation: controlMode === "toggle" ? "toggle" : controlMode,
        });
        break;

      case "brightness":
        migrated.brightness!.push({
          ...baseSettings,
          brightness: settings.brightnessValue || 100,
          stepSize: 10,
          minBrightness: 1,
          maxBrightness: 100,
          toggleOnPush: true,
        });
        break;

      case "color":
        migrated.color!.push({
          ...baseSettings,
          color: settings.colorValue || "#ffffff",
          colorPresets: [
            "#ff0000",
            "#00ff00",
            "#0000ff",
            "#ffff00",
            "#ff00ff",
            "#00ffff",
          ],
          usePresets: false,
          currentPresetIndex: 0,
        });
        break;

      case "colorTemp":
        migrated.warmth!.push({
          ...baseSettings,
          colorTemperature: settings.colorTempValue || 6500,
          stepSize: 100,
          minTemperature: 2000,
          maxTemperature: 9000,
          toggleOnPush: true,
        });
        break;
    }

    // If no specific control mode, create a toggle action as default
    if (!settings.controlMode) {
      migrated.toggle!.push({
        ...baseSettings,
        operation: "toggle",
      });
    }

    return migrated;
  }

  /**
   * Migrate group control settings
   */
  private static migrateGroupControlSettings(
    settings: GroupControlSettings,
  ): MigratedSettings {
    const migrated: MigratedSettings = {
      toggle: [],
      brightness: [],
      color: [],
      warmth: [],
    };

    if (!settings.selectedGroupId) {
      return migrated;
    }

    const baseSettings = {
      apiKey: settings.apiKey,
      targetType: "group" as TargetType,
      groupId: settings.selectedGroupId,
      groupName: settings.selectedGroupName || settings.selectedGroupId,
    };

    // Create actions based on control mode or create all if no specific mode
    const controlMode = settings.controlMode || "toggle";

    switch (controlMode) {
      case "toggle":
      case "on":
      case "off":
        migrated.toggle!.push({
          ...baseSettings,
          operation: controlMode === "toggle" ? "toggle" : controlMode,
        });
        break;

      case "brightness":
        migrated.brightness!.push({
          ...baseSettings,
          brightness: settings.brightnessValue || 100,
          stepSize: 10,
          minBrightness: 1,
          maxBrightness: 100,
          toggleOnPush: true,
        });
        break;

      case "color":
        migrated.color!.push({
          ...baseSettings,
          color: settings.colorValue || "#ffffff",
          colorPresets: [
            "#ff0000",
            "#00ff00",
            "#0000ff",
            "#ffff00",
            "#ff00ff",
            "#00ffff",
          ],
          usePresets: false,
          currentPresetIndex: 0,
        });
        break;

      case "colorTemp":
        migrated.warmth!.push({
          ...baseSettings,
          colorTemperature: settings.colorTempValue || 6500,
          stepSize: 100,
          minTemperature: 2000,
          maxTemperature: 9000,
          toggleOnPush: true,
        });
        break;
    }

    // If no specific control mode, create a toggle action as default
    if (!settings.controlMode) {
      migrated.toggle!.push({
        ...baseSettings,
        operation: "toggle",
      });
    }

    return migrated;
  }

  /**
   * Merge migration results
   */
  private static mergeMigrationResults(
    target: MigratedSettings,
    source: MigratedSettings,
  ): void {
    if (source.toggle?.length) {
      target.toggle = [...(target.toggle || []), ...source.toggle];
    }
    if (source.brightness?.length) {
      target.brightness = [...(target.brightness || []), ...source.brightness];
    }
    if (source.color?.length) {
      target.color = [...(target.color || []), ...source.color];
    }
    if (source.warmth?.length) {
      target.warmth = [...(target.warmth || []), ...source.warmth];
    }
  }

  /**
   * Create settings suggestions for new actions
   */
  public static createActionSuggestions(migrated: MigratedSettings): string[] {
    const suggestions: string[] = [];

    if (migrated.toggle?.length) {
      suggestions.push(
        `Add ${migrated.toggle.length} Toggle action${migrated.toggle.length > 1 ? "s" : ""} to your Stream Deck`,
      );
    }

    if (migrated.brightness?.length) {
      suggestions.push(
        `Add ${migrated.brightness.length} Brightness action${migrated.brightness.length > 1 ? "s" : ""} for dial control`,
      );
    }

    if (migrated.color?.length) {
      suggestions.push(
        `Add ${migrated.color.length} Color action${migrated.color.length > 1 ? "s" : ""} for color control`,
      );
    }

    if (migrated.warmth?.length) {
      suggestions.push(
        `Add ${migrated.warmth.length} Warmth action${migrated.warmth.length > 1 ? "s" : ""} for color temperature`,
      );
    }

    return suggestions;
  }

  /**
   * Generate default settings for a new action
   */
  public static generateDefaultSettings(
    actionType: string,
    targetType: TargetType,
    targetId: string,
    targetName: string,
    apiKey?: string,
  ): any {
    const baseSettings = {
      apiKey,
      targetType,
      ...(targetType === "light"
        ? {
            lightId: targetId,
            lightName: targetName,
          }
        : {
            groupId: targetId,
            groupName: targetName,
          }),
    };

    switch (actionType) {
      case "toggle":
        return {
          ...baseSettings,
          operation: "toggle",
        } as ToggleActionSettings;

      case "brightness":
        return {
          ...baseSettings,
          brightness: 100,
          stepSize: 10,
          minBrightness: 1,
          maxBrightness: 100,
          toggleOnPush: true,
        } as BrightnessActionSettings;

      case "color":
        return {
          ...baseSettings,
          color: "#ffffff",
          colorPresets: [
            "#ff0000",
            "#00ff00",
            "#0000ff",
            "#ffff00",
            "#ff00ff",
            "#00ffff",
          ],
          usePresets: false,
          currentPresetIndex: 0,
        } as ColorActionSettings;

      case "warmth":
        return {
          ...baseSettings,
          colorTemperature: 6500,
          stepSize: 100,
          minTemperature: 2000,
          maxTemperature: 9000,
          toggleOnPush: true,
        } as WarmthActionSettings;

      default:
        return baseSettings;
    }
  }
}
