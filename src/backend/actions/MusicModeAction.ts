import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { Light } from "../domain/entities/Light";
import {
  MusicModeConfig,
  MusicModeType,
} from "../domain/value-objects/MusicModeConfig";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { globalSettingsService } from "../services/GlobalSettingsService";

type MusicModeSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  musicMode?: MusicModeType;
  sensitivity?: number;
  autoColor?: boolean;
};

/**
 * Stream Deck action for configuring music mode on Govee lights
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.music-mode" })
export class MusicModeAction extends SingletonAction<MusicModeSettings> {
  private lightRepository?: GoveeLightRepository;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<MusicModeSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

    // Set initial title based on configuration
    const title = this.getActionTitle(settings);
    await ev.action.setTitle(title);

    // Load current light if configured
    if (
      settings.selectedDeviceId &&
      settings.selectedModel &&
      this.lightRepository
    ) {
      try {
        const foundLight = await this.lightRepository.findLight(
          settings.selectedDeviceId,
          settings.selectedModel,
        );
        this.currentLight = foundLight || undefined;
        if (this.currentLight) {
          // Refresh light state
          await this.lightRepository.getLightState(this.currentLight);
          // Update action appearance based on configuration
          const title = this.getActionTitle(settings);
          await ev.action.setTitle(title);
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load light state:", error);
      }
    }
  }

  /**
   * Handle key press events - apply the configured music mode
   */
  override async onKeyDown(ev: KeyDownEvent<MusicModeSettings>): Promise<void> {
    const { settings } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Music mode action not properly configured");
      return;
    }

    if (!this.currentLight || !this.lightRepository) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    // Check if light supports music mode
    if (!this.currentLight.supportsMusicMode()) {
      await ev.action.showAlert();
      streamDeck.logger.warn(
        `Light ${this.currentLight.name} does not support music mode`,
      );
      return;
    }

    try {
      const musicModeConfig = this.getMusicModeFromSettings(settings);
      if (!musicModeConfig) {
        await ev.action.showAlert();
        streamDeck.logger.error("Invalid music mode configuration");
        return;
      }

      await this.lightRepository.setMusicMode(
        this.currentLight,
        musicModeConfig,
      );
      await ev.action.showOk();
      streamDeck.logger.info(
        `Applied music mode ${musicModeConfig.mode} to ${this.currentLight.name}`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to apply music mode:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, MusicModeSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) {
      return;
    }

    const settings = await ev.action.getSettings();

    switch (ev.payload.event) {
      case "validateApiKey":
        await this.handleValidateApiKey(ev);
        break;
      case "getLights":
        await this.handleGetLights(ev, settings);
        break;
      case "getMusicModes":
        await this.handleGetMusicModes(ev);
        break;
    }
  }

  /**
   * Initialize repositories and services
   */
  private async ensureServices(apiKey?: string): Promise<void> {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.lightRepository = new GoveeLightRepository(apiKey, true);
      this.currentApiKey = apiKey;
      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger?.warn("Failed to persist API key globally", error);
      }
    }

    if (!this.transportOrchestrator) {
      const cloudTransport = new CloudTransport();
      this.transportOrchestrator = new TransportOrchestrator({
        [TransportKind.Cloud]: cloudTransport,
      });
      this.healthService = new TransportHealthService(
        this.transportOrchestrator,
        streamDeck.logger,
      );
      this.deviceService = new DeviceService(this.transportOrchestrator, {
        logger: streamDeck.logger,
      });
    }
  }

  /**
   * Check if action is properly configured
   */
  private isConfigured(settings: MusicModeSettings): boolean {
    return !!(
      settings.apiKey &&
      settings.selectedDeviceId &&
      settings.selectedModel &&
      settings.musicMode
    );
  }

  /**
   * Get action title based on configuration
   */
  private getActionTitle(settings: MusicModeSettings): string {
    if (!settings.selectedLightName && !settings.musicMode) {
      return "Music Mode";
    }

    const parts: string[] = [];
    if (settings.selectedLightName) {
      parts.push(settings.selectedLightName);
    }
    if (settings.musicMode) {
      // Capitalize first letter of mode
      const modeName =
        settings.musicMode.charAt(0).toUpperCase() +
        settings.musicMode.slice(1);
      parts.push(modeName);
    }

    return parts.join("\n");
  }

  /**
   * Create MusicModeConfig instance from settings
   */
  private getMusicModeFromSettings(
    settings: MusicModeSettings,
  ): MusicModeConfig | null {
    if (!settings.musicMode) {
      return null;
    }

    const sensitivity = settings.sensitivity ?? 50;
    const autoColor = settings.autoColor ?? true;

    return MusicModeConfig.create(sensitivity, settings.musicMode, autoColor);
  }

  /**
   * Handle API key validation
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, MusicModeSettings>,
  ): Promise<void> {
    if (
      !(ev.payload instanceof Object) ||
      !("apiKey" in ev.payload) ||
      typeof ev.payload.apiKey !== "string"
    ) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: false,
        error: "Invalid API key format",
      });
      return;
    }

    try {
      await this.ensureServices(ev.payload.apiKey);
      if (this.lightRepository) {
        await this.lightRepository.getAllLights();
      }
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: true,
      });
    } catch (error) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handle get lights request
   */
  private async handleGetLights(
    ev: SendToPluginEvent<JsonValue, MusicModeSettings>,
    settings: MusicModeSettings,
  ): Promise<void> {
    await this.ensureServices(settings.apiKey);

    if (!this.lightRepository) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "lights",
        lights: [],
        error: "API key not configured",
      });
      return;
    }

    try {
      const allLights = await this.lightRepository.getAllLights();
      // Only return lights that support music mode
      const musicLights = allLights.filter((light) =>
        light.supportsMusicMode(),
      );

      await streamDeck.ui.sendToPropertyInspector({
        event: "lights",
        lights: musicLights.map((light) => ({
          deviceId: light.deviceId,
          model: light.model,
          name: light.name,
          isOnline: light.isOnline,
        })),
      });
    } catch (error) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "lights",
        lights: [],
        error: error instanceof Error ? error.message : "Failed to get lights",
      });
    }
  }

  /**
   * Handle get music modes request
   */
  private async handleGetMusicModes(
    ev: SendToPluginEvent<JsonValue, MusicModeSettings>,
  ): Promise<void> {
    // Return all available music modes
    const modes: Array<{ id: MusicModeType; name: string }> = [
      { id: "rhythm", name: "Rhythm" },
      { id: "energic", name: "Energic" },
      { id: "spectrum", name: "Spectrum" },
      { id: "rolling", name: "Rolling" },
    ];

    await streamDeck.ui.sendToPropertyInspector({
      event: "musicModes",
      modes,
    });
  }
}
