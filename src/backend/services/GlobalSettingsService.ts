import { streamDeck } from "@elgato/streamdeck";

export interface GlobalPluginSettings {
  apiKey?: string;
  apiKeyLastValidated?: number;
  pluginVersion?: string;
  [key: string]: unknown;
}

export class GlobalSettingsService {
  private static instance: GlobalSettingsService;
  private cache: GlobalPluginSettings | null = null;
  private lastFetched = 0;
  private readonly cacheTtl = 30_000;

  static getInstance(): GlobalSettingsService {
    if (!GlobalSettingsService.instance) {
      GlobalSettingsService.instance = new GlobalSettingsService();
    }
    return GlobalSettingsService.instance;
  }

  async getSettings(): Promise<GlobalPluginSettings> {
    const now = Date.now();
    if (this.cache && now - this.lastFetched < this.cacheTtl) {
      return this.cache;
    }

    try {
      const settings = await streamDeck.settings.getGlobalSettings?.();
      this.cache = settings ?? {};
      this.lastFetched = now;
      return this.cache;
    } catch (error) {
      streamDeck.logger?.error("Failed to read global settings", error);
      this.cache = {};
      this.lastFetched = now;
      return this.cache;
    }
  }

  async getApiKey(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.apiKey?.toString().trim() || undefined;
  }

  async setApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    const settings = await this.getSettings();
    const updated: GlobalPluginSettings = {
      ...settings,
      apiKey: trimmed,
      apiKeyLastValidated: Date.now(),
    };
    await this.save(updated);
  }

  async clearApiKey(): Promise<void> {
    const settings = await this.getSettings();
    const updated: GlobalPluginSettings = {
      ...settings,
      apiKey: undefined,
      apiKeyLastValidated: undefined,
    };
    await this.save(updated);
  }

  async save(settings: GlobalPluginSettings): Promise<void> {
    await streamDeck.settings.setGlobalSettings?.(settings as any);
    this.cache = { ...settings };
    this.lastFetched = Date.now();
  }

  clearCache(): void {
    this.cache = null;
    this.lastFetched = 0;
  }
}

export const globalSettingsService = GlobalSettingsService.getInstance();
