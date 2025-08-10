import { streamDeck } from "../plugin";

/**
 * Interface for global plugin settings shared across all actions
 */
export interface GlobalPluginSettings {
  apiKey?: string;
  apiKeyLastValidated?: number; // timestamp
  pluginVersion?: string;
  [key: string]: any; // Allow for future settings
}

/**
 * Service for managing global plugin settings that persist across all actions
 * Uses Stream Deck's global settings storage
 */
export class GlobalSettingsService {
  private static instance: GlobalSettingsService;
  private cachedSettings: GlobalPluginSettings | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private lastCacheUpdate = 0;

  private constructor() {}

  /**
   * Get singleton instance of GlobalSettingsService
   */
  static getInstance(): GlobalSettingsService {
    if (!GlobalSettingsService.instance) {
      GlobalSettingsService.instance = new GlobalSettingsService();
    }
    return GlobalSettingsService.instance;
  }

  /**
   * Get all global settings with caching
   */
  async getGlobalSettings(): Promise<GlobalPluginSettings> {
    const now = Date.now();

    // Return cached settings if still valid
    if (
      this.cachedSettings &&
      now - this.lastCacheUpdate < this.CACHE_DURATION
    ) {
      return this.cachedSettings;
    }

    try {
      if (streamDeck?.settings?.getGlobalSettings) {
        const settings = await streamDeck.settings.getGlobalSettings();
        this.cachedSettings = settings || {};
        this.lastCacheUpdate = now;
        return this.cachedSettings || {};
      }
    } catch (error) {
      console.error("Failed to get global settings:", error);
    }

    // Return empty object if unable to fetch
    this.cachedSettings = {};
    this.lastCacheUpdate = now;
    return this.cachedSettings;
  }

  /**
   * Set global settings with cache invalidation
   */
  async setGlobalSettings(settings: GlobalPluginSettings): Promise<void> {
    try {
      if (streamDeck?.settings?.setGlobalSettings) {
        await streamDeck.settings.setGlobalSettings(settings);

        // Update cache
        this.cachedSettings = { ...settings };
        this.lastCacheUpdate = Date.now();

        console.log("Global settings updated successfully");
      }
    } catch (error) {
      console.error("Failed to set global settings:", error);
      throw error;
    }
  }

  /**
   * Get the global API key
   */
  async getApiKey(): Promise<string | undefined> {
    const settings = await this.getGlobalSettings();
    return settings.apiKey;
  }

  /**
   * Set the global API key with validation timestamp
   */
  async setApiKey(apiKey: string): Promise<void> {
    const settings = await this.getGlobalSettings();
    const updatedSettings: GlobalPluginSettings = {
      ...settings,
      apiKey,
      apiKeyLastValidated: Date.now(),
    };

    await this.setGlobalSettings(updatedSettings);
    console.log("Global API key updated");
  }

  /**
   * Clear the global API key
   */
  async clearApiKey(): Promise<void> {
    const settings = await this.getGlobalSettings();
    const updatedSettings: GlobalPluginSettings = {
      ...settings,
      apiKey: undefined,
      apiKeyLastValidated: undefined,
    };

    await this.setGlobalSettings(updatedSettings);
    console.log("Global API key cleared");
  }

  /**
   * Check if API key exists and when it was last validated
   */
  async getApiKeyStatus(): Promise<{
    hasApiKey: boolean;
    lastValidated?: number;
  }> {
    const settings = await this.getGlobalSettings();
    return {
      hasApiKey: Boolean(settings.apiKey),
      lastValidated: settings.apiKeyLastValidated,
    };
  }

  /**
   * Update a specific global setting
   */
  async updateSetting<K extends keyof GlobalPluginSettings>(
    key: K,
    value: GlobalPluginSettings[K],
  ): Promise<void> {
    const settings = await this.getGlobalSettings();
    const updatedSettings: GlobalPluginSettings = {
      ...settings,
      [key]: value,
    };

    await this.setGlobalSettings(updatedSettings);
  }

  /**
   * Clear cache to force fresh fetch on next access
   */
  clearCache(): void {
    this.cachedSettings = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if API key is fresh (validated within last hour)
   */
  async isApiKeyFresh(): Promise<boolean> {
    const status = await this.getApiKeyStatus();
    if (!status.hasApiKey || !status.lastValidated) {
      return false;
    }

    const oneHour = 60 * 60 * 1000;
    return Date.now() - status.lastValidated < oneHour;
  }
}

// Export singleton instance
export const globalSettingsService = GlobalSettingsService.getInstance();
