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
import { SceneService } from "../domain/services/SceneService";
import { Light } from "../domain/entities/Light";
import { Scene } from "../domain/value-objects/Scene";
import { DeviceService } from "../domain/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  TransportHealthService,
  CloudTransport,
} from "../connectivity";
import { globalSettingsService } from "../services/GlobalSettingsService";
import { SceneMapper } from "../infrastructure/mappers/SceneMapper";

type SceneControlSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  selectedSceneId?: string;
  selectedSceneName?: string;
};

/**
 * Stream Deck action for applying scenes to Govee lights
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.scene-control" })
export class SceneControlAction extends SingletonAction<SceneControlSettings> {
  private lightRepository?: GoveeLightRepository;
  private sceneService?: SceneService;
  private currentLight?: Light;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private healthService?: TransportHealthService;
  private deviceService?: DeviceService;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<SceneControlSettings>,
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
   * Handle key press events - apply the selected scene
   */
  override async onKeyDown(
    ev: KeyDownEvent<SceneControlSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Scene control action not properly configured");
      return;
    }

    if (!this.currentLight || !this.sceneService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Light not available or service not initialized");
      return;
    }

    // Check if light supports scenes
    if (!this.currentLight.supportsScenes()) {
      await ev.action.showAlert();
      streamDeck.logger.warn(
        `Light ${this.currentLight.name} does not support scenes`,
      );
      return;
    }

    try {
      const scene = this.getSceneFromSettings(settings);
      if (!scene) {
        await ev.action.showAlert();
        streamDeck.logger.error("Invalid scene configuration");
        return;
      }

      await this.sceneService.applySceneToLight(this.currentLight, scene);
      await ev.action.showOk();
      streamDeck.logger.info(
        `Applied scene ${scene.name} to ${this.currentLight.name}`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to apply scene:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SceneControlSettings>,
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
      case "getScenes":
        await this.handleGetScenes(ev, settings);
        break;
    }
  }

  /**
   * Initialize repositories and services
   */
  private async ensureServices(apiKey?: string): Promise<void> {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.lightRepository = new GoveeLightRepository(apiKey, true);
      this.sceneService = new SceneService(this.lightRepository);
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
  private isConfigured(settings: SceneControlSettings): boolean {
    return !!(
      settings.apiKey &&
      settings.selectedDeviceId &&
      settings.selectedModel &&
      settings.selectedSceneId
    );
  }

  /**
   * Get action title based on configuration
   */
  private getActionTitle(settings: SceneControlSettings): string {
    if (!settings.selectedLightName && !settings.selectedSceneName) {
      return "Scene Control";
    }

    const parts: string[] = [];
    if (settings.selectedLightName) {
      parts.push(settings.selectedLightName);
    }
    if (settings.selectedSceneName) {
      parts.push(settings.selectedSceneName);
    }

    return parts.join("\n");
  }

  /**
   * Create Scene instance from settings with validation
   */
  private getSceneFromSettings(settings: SceneControlSettings): Scene | null {
    if (!settings.selectedSceneId) {
      return null;
    }

    // Map predefined scene IDs to Scene instances
    let scene: Scene | null = null;
    switch (settings.selectedSceneId) {
      case "sunrise":
        scene = Scene.sunrise();
        break;
      case "sunset":
        scene = Scene.sunset();
        break;
      case "rainbow":
        scene = Scene.rainbow();
        break;
      case "aurora":
        scene = Scene.aurora();
        break;
      case "movie":
        scene = Scene.movie();
        break;
      case "reading":
        scene = Scene.reading();
        break;
      case "nightlight":
        scene = Scene.nightlight();
        break;
      default:
        // Custom scene
        if (settings.selectedSceneName) {
          scene = Scene.create(
            settings.selectedSceneId,
            settings.selectedSceneName,
            "custom",
          );
        }
        break;
    }

    // Validate that the scene is supported by the Govee API
    if (scene && !SceneMapper.isSupported(scene)) {
      streamDeck.logger.warn(
        `Scene "${scene.name}" is not supported by Govee API. ` +
        `Supported scenes: ${SceneMapper.getSupportedSceneCodes().join(', ')}`
      );
      return null;
    }

    return scene;
  }

  /**
   * Handle API key validation
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, SceneControlSettings>,
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
    ev: SendToPluginEvent<JsonValue, SceneControlSettings>,
    settings: SceneControlSettings,
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
      // Only return lights that support scenes
      const sceneLights = allLights.filter((light) => light.supportsScenes());

      await streamDeck.ui.sendToPropertyInspector({
        event: "lights",
        lights: sceneLights.map((light) => ({
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
   * Handle get scenes request
   */
  private async handleGetScenes(
    ev: SendToPluginEvent<JsonValue, SceneControlSettings>,
    settings: SceneControlSettings,
  ): Promise<void> {
    await this.ensureServices(settings.apiKey);

    if (!this.sceneService || !this.lightRepository) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "scenes",
        scenes: [],
        error: "Service not initialized",
      });
      return;
    }

    // Get device info from payload
    if (
      !(ev.payload instanceof Object) ||
      !("deviceId" in ev.payload) ||
      !("model" in ev.payload) ||
      typeof ev.payload.deviceId !== "string" ||
      typeof ev.payload.model !== "string"
    ) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "scenes",
        scenes: [],
        error: "Invalid device information",
      });
      return;
    }

    try {
      const light = await this.lightRepository.findLight(
        ev.payload.deviceId,
        ev.payload.model,
      );

      if (!light) {
        await streamDeck.ui.sendToPropertyInspector({
          event: "scenes",
          scenes: [],
          error: "Light not found",
        });
        return;
      }

      const scenes = this.sceneService.getAvailableScenes(light);

      await streamDeck.ui.sendToPropertyInspector({
        event: "scenes",
        scenes: scenes.map((scene) => ({
          id: scene.id,
          name: scene.name,
          type: scene.type,
        })),
      });
    } catch (error) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "scenes",
        scenes: [],
        error: error instanceof Error ? error.message : "Failed to get scenes",
      });
    }
  }
}
