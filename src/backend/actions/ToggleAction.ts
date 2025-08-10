import {
  action,
  DialDownEvent,
  DialUpEvent,
  KeyDownEvent,
  KeyUpEvent,
  SendToPluginEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
  type JsonValue,
} from "@elgato/streamdeck";
import type {
  ToggleActionSettings,
  ActionTarget,
  ActionState,
} from "@shared/types/newActions";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { StreamDeckLightGroupRepository } from "../infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { GroupControlService } from "../domain/services/GroupControlService";
import { LightGroupService } from "../domain/services/LightGroupService";
import { streamDeck } from "../plugin";
import { MigrationHandler } from "../services/MigrationHandler";
import { globalSettingsService } from "../services/GlobalSettingsService";

// Debug logging removed for security - use Stream Deck logger instead

/**
 * Toggle On/Off Action - Simple power control for lights and groups
 * Supports both Stream Deck buttons and Stream Deck+ dials/touchscreen
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.toggle" })
export class ToggleAction extends SingletonAction<ToggleActionSettings> {
  constructor() {
    super();
    streamDeck.logger?.info("ToggleAction: Constructor called");
  }
  private lightRepository?: GoveeLightRepository;
  private groupRepository?: StreamDeckLightGroupRepository;
  private lightService?: LightControlService;
  private groupService?: GroupControlService;
  private lightGroupService?: LightGroupService;
  private apiKey?: string;

  /**
   * Cache of current states per action instance
   */
  private actionStates = new Map<string, ActionState>();

  /**
   * Initialize action when it appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ToggleActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    const settings = ev.payload.settings;
    streamDeck.logger?.info(
      `ToggleAction: onWillAppear called with context: ${context}`,
    );
    streamDeck.logger?.info(
      `ToggleAction: Settings: ${JSON.stringify(settings)}`,
    );
    streamDeck.logger?.info(
      `ToggleAction: UUID should be: com.felixgeelhaar.govee-light-management.toggle`,
    );

    // Initialize services if API key is available
    if (settings.apiKey) {
      this.initializeServices(settings.apiKey);
    }

    // Initialize default settings if needed
    if (!settings.operation) {
      await ev.action.setSettings({
        ...settings,
        operation: "toggle",
        targetType: "light",
      });
    }

    // Set up Stream Deck+ layout for dial/touchscreen
    if (ev.action.isDial()) {
      await ev.action.setFeedbackLayout("$X1"); // Icon layout with title
      await ev.action.setTriggerDescription({
        push: "Toggle Light",
        touch: "Toggle Light",
      });
    }

    // Initialize action state
    this.actionStates.set(context, {
      isOn: false,
      isConnected: false,
      isLoading: false,
    });

    // Services are already initialized with global API key above

    // Update display
    await this.updateActionDisplay(ev.action, settings);
  }

  /**
   * Initialize services with API key
   */
  private initializeServices(apiKey: string): void {
    this.apiKey = apiKey; // Cache the API key
    this.lightRepository = new GoveeLightRepository(apiKey, true);
    this.groupRepository = new StreamDeckLightGroupRepository(streamDeck);
    this.lightService = new LightControlService(this.lightRepository);
    this.lightGroupService = new LightGroupService(
      this.groupRepository,
      this.lightRepository,
    );
    this.groupService = new GroupControlService(
      this.groupRepository,
      this.lightService,
    );
  }

  /**
   * Clean up when action disappears
   */
  override async onWillDisappear(
    ev: WillDisappearEvent<ToggleActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    this.actionStates.delete(context);
  }

  /**
   * Handle button press on classic Stream Deck
   */
  override async onKeyDown(
    ev: KeyDownEvent<ToggleActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle button release on classic Stream Deck
   */
  override async onKeyUp(ev: KeyUpEvent<ToggleActionSettings>): Promise<void> {
    await this.executeToggle(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial press on Stream Deck+
   */
  override async onDialDown(
    ev: DialDownEvent<ToggleActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle dial release on Stream Deck+
   */
  override async onDialUp(
    ev: DialUpEvent<ToggleActionSettings>,
  ): Promise<void> {
    await this.executeToggle(ev.action, ev.payload.settings);
  }

  /**
   * Handle touchscreen tap on Stream Deck+
   */
  override async onTouchTap(
    ev: TouchTapEvent<ToggleActionSettings>,
  ): Promise<void> {
    await this.executeToggle(ev.action, ev.payload.settings);
  }

  /**
   * Execute the toggle operation
   */
  private async executeToggle(
    action: any,
    settings: ToggleActionSettings,
  ): Promise<void> {
    const context = action.id;

    try {
      // Initialize services if needed
      if (settings.apiKey && !this.lightService) {
        this.initializeServices(settings.apiKey);
      }

      // Validate services are initialized
      if (!this.lightService || !this.groupService) {
        await action.showAlert();
        await this.setActionState(action, {
          isLoading: false,
          errorMessage: "Please configure API key",
        });
        return;
      }

      // Validate settings
      if (!this.validateTarget(settings)) {
        await action.showAlert();
        await this.setActionState(action, {
          isLoading: false,
          errorMessage: "Please configure target light or group",
        });
        return;
      }

      await this.setActionState(action, { isLoading: true });

      const target = this.getTarget(settings);
      const success = await this.performToggleOperation(target, settings);

      if (success) {
        // Update state and display
        const currentState = this.actionStates.get(context);
        const newOnState = this.calculateNewState(
          currentState?.isOn || false,
          settings.operation,
        );

        await this.setActionState(action, {
          isOn: newOnState,
          isConnected: true,
          isLoading: false,
          errorMessage: undefined,
        });
      } else {
        await action.showAlert();
        await this.setActionState(action, {
          isLoading: false,
          errorMessage: "Failed to control light/group",
        });
      }
    } catch (error) {
      streamDeck.logger?.error("Toggle action failed:", error);
      await action.showAlert();
      await this.setActionState(action, {
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    streamDeck.logger?.info(
      `ToggleAction onSendToPlugin called with event: ${JSON.stringify(ev.payload)}`,
    );
    const event = (ev.payload as any).event;

    switch (event) {
      case "validateApiKey":
        streamDeck.logger?.info("ToggleAction: validateApiKey case reached");
        await this.handleValidateApiKey(ev);
        break;
      case "getApiKeyStatus":
        streamDeck.logger?.info("ToggleAction: getApiKeyStatus case reached");
        await this.handleGetApiKeyStatus(ev);
        break;
      case "getLights":
        streamDeck.logger?.info("ToggleAction: getLights case reached");
        await this.handleGetLights(ev);
        break;
      case "testLight":
        streamDeck.logger?.info("ToggleAction: testLight case reached");
        await this.handleTestLight(ev);
        break;
      case "getGlobalApiKey":
        streamDeck.logger?.info("ToggleAction: getGlobalApiKey case reached");
        await this.handleGetGlobalApiKey(ev);
        break;
      case "setGlobalApiKey":
        streamDeck.logger?.info("ToggleAction: setGlobalApiKey case reached");
        await this.handleSetGlobalApiKey(ev);
        break;
      case "clearGlobalApiKey":
        streamDeck.logger?.info("ToggleAction: clearGlobalApiKey case reached");
        await this.handleClearGlobalApiKey(ev);
        break;
      case "testApiConnection":
        streamDeck.logger?.info("ToggleAction: testApiConnection case reached");
        await this.handleTestApiConnection(ev);
        break;
      case "getMigrationRecommendations":
        await this.handleGetMigrationRecommendations(ev);
        break;
      case "dismissMigrationRecommendation":
        await this.handleDismissMigrationRecommendation(ev);
        break;
      case "dismissAllMigrationRecommendations":
        await this.handleDismissAllMigrationRecommendations(ev);
        break;
      default:
        streamDeck.logger?.warn(
          `ToggleAction: Unknown message event: ${event}`,
        );
    }
  }

  /**
   * Handle request for migration recommendations
   */
  private async handleGetMigrationRecommendations(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      const recommendations =
        await MigrationHandler.getMigrationRecommendations();

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "migrationRecommendations",
        recommendations,
      });
    } catch (error) {
      streamDeck.logger?.error(
        "Failed to get migration recommendations:",
        error,
      );
    }
  }

  /**
   * Handle dismissal of single migration recommendation
   */
  private async handleDismissMigrationRecommendation(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      // For now, we'll just acknowledge the dismissal
      // In a full implementation, we'd track dismissed recommendations per user
      streamDeck.logger?.info(
        "Migration recommendation dismissed:",
        (ev.payload as any).recommendationId,
      );
    } catch (error) {
      streamDeck.logger?.error(
        "Failed to dismiss migration recommendation:",
        error,
      );
    }
  }

  /**
   * Handle dismissal of all migration recommendations
   */
  private async handleDismissAllMigrationRecommendations(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      await MigrationHandler.clearMigrationRecommendations();
      streamDeck.logger?.info("All migration recommendations dismissed");
    } catch (error) {
      streamDeck.logger?.error(
        "Failed to dismiss all migration recommendations:",
        error,
      );
    }
  }

  /**
   * Handle get global API key request from property inspector
   */
  private async handleGetGlobalApiKey(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      const globalApiKey = await globalSettingsService.getApiKey();
      
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKey",
        apiKey: globalApiKey || null,
      });
      
      streamDeck.logger?.info(
        `ToggleAction: Sent global API key (exists: ${!!globalApiKey})`,
      );
    } catch (error) {
      streamDeck.logger?.error("Failed to get global API key:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKey",
        apiKey: null,
        error: "Failed to retrieve global API key",
      });
    }
  }

  /**
   * Handle set global API key request from property inspector
   */
  private async handleSetGlobalApiKey(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      const apiKey = (ev.payload as any)?.apiKey as string;
      
      if (!apiKey) {
        streamDeck.logger?.warn("ToggleAction: No API key provided to set");
        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "globalApiKeySaved",
          success: false,
          error: "API key is required",
        });
        return;
      }

      // Save API key globally
      await globalSettingsService.setApiKey(apiKey);
      
      // Initialize services with the new API key
      this.initializeServices(apiKey);
      
      streamDeck.logger?.info("ToggleAction: Global API key saved successfully");
      
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKeySaved",
        success: true,
      });
    } catch (error) {
      streamDeck.logger?.error("Failed to set global API key:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKeySaved",
        success: false,
        error: error instanceof Error ? error.message : "Failed to save API key",
      });
    }
  }

  /**
   * Handle clear global API key request from property inspector
   */
  private async handleClearGlobalApiKey(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      // Clear API key globally
      await globalSettingsService.clearApiKey();
      
      // Clear local references
      this.apiKey = undefined;
      this.lightRepository = undefined;
      this.lightService = undefined;
      this.groupService = undefined;
      this.lightGroupService = undefined;
      
      streamDeck.logger?.info("ToggleAction: Global API key cleared successfully");
      
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKeyCleared",
        success: true,
      });
    } catch (error) {
      streamDeck.logger?.error("Failed to clear global API key:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKeyCleared",
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear API key",
      });
    }
  }

  /**
   * Handle test API connection request from property inspector
   */
  private async handleTestApiConnection(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    try {
      const apiKey = (ev.payload as any)?.apiKey as string;
      
      if (!apiKey) {
        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "apiConnectionTested",
          success: false,
          error: "API key is required",
        });
        return;
      }

      // Test the API key by trying to fetch lights
      const testRepository = new GoveeLightRepository(apiKey, true);
      const lights = await testRepository.getAllLights();
      
      streamDeck.logger?.info(`ToggleAction: API test successful, found ${lights.length} lights`);
      
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiConnectionTested",
        success: true,
        message: `Connection successful! Found ${lights.length} light${lights.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      streamDeck.logger?.error("Failed to test API connection:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiConnectionTested",
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      });
    }
  }

  /**
   * Handle get lights request from property inspector
   */
  private async handleGetLights(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    streamDeck.logger?.info("ToggleAction: handleGetLights called");

    try {
      // Always use global API key per Elgato best practices
      const apiKey = await globalSettingsService.getApiKey();

      if (!apiKey) {
        streamDeck.logger?.warn(
          "ToggleAction: No API key configured in global settings",
        );
        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "lightsReceived",
          error: "API key is required",
        });
        return;
      }

      // Initialize repository if needed
      if (!this.lightRepository) {
        this.initializeServices(apiKey);
      }

      if (this.lightRepository) {
        streamDeck.logger?.info(
          "ToggleAction: Fetching lights from repository",
        );
        const lights = await this.lightRepository.getAllLights();
        streamDeck.logger?.info(
          `ToggleAction: Retrieved ${lights.length} lights from API`,
        );

        const lightItems = lights.map((light) => ({
          label: light.name,
          value: `${light.deviceId}|${light.model}`,
          name: light.name,
          deviceId: light.deviceId,
          model: light.model,
        }));

        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "lightsReceived",
          lights: lightItems,
        });
        streamDeck.logger?.info(
          "ToggleAction: Sent lights response to property inspector",
        );
      } else {
        throw new Error("Failed to initialize light repository");
      }
    } catch (error) {
      streamDeck.logger?.error("ToggleAction: getLights failed:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        error:
          error instanceof Error ? error.message : "Failed to fetch lights",
      });
    }
  }

  /**
   * Handle test light request from property inspector
   */
  private async handleTestLight(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    streamDeck.logger?.info("ToggleAction: handleTestLight called");

    try {
      const testData = ev.payload as any;
      streamDeck.logger?.info(
        `ToggleAction: Test data: ${JSON.stringify(testData)}`,
      );

      if (!testData.deviceId || !testData.model) {
        throw new Error("Device ID and model are required for light test");
      }

      // Always use global API key per Elgato best practices
      const apiKey = await globalSettingsService.getApiKey();
      if (!apiKey) {
        throw new Error("API key is required for light test - configure in global settings");
      }

      // Initialize repository if needed
      if (!this.lightRepository) {
        this.initializeServices(apiKey);
      }

      if (this.lightRepository) {
        // Find the target light
        const lights = await this.lightRepository.getAllLights();
        const targetLight = lights.find(
          (light) =>
            light.deviceId === testData.deviceId &&
            light.model === testData.model,
        );

        if (!targetLight) {
          throw new Error(
            `Light with device ID ${testData.deviceId} and model ${testData.model} not found`,
          );
        }

        streamDeck.logger?.info(
          `ToggleAction: Found target light: ${targetLight.name}`,
        );

        // Perform a quick blink test (toggle the light twice)
        const originalState = targetLight.isOn;

        // Get the client from the repository to perform direct API calls
        const client = (this.lightRepository as any).client;
        if (!client) {
          throw new Error("API client not available");
        }

        // Toggle once
        if (originalState) {
          await client.turnOff(targetLight.deviceId, targetLight.model);
        } else {
          await client.turnOn(targetLight.deviceId, targetLight.model);
        }

        // Wait a moment then toggle back
        setTimeout(async () => {
          try {
            if (originalState) {
              await client.turnOn(targetLight.deviceId, targetLight.model);
            } else {
              await client.turnOff(targetLight.deviceId, targetLight.model);
            }
            streamDeck.logger?.info(
              `ToggleAction: Light test completed for ${targetLight.name}`,
            );
          } catch (restoreError) {
            streamDeck.logger?.error(
              `ToggleAction: Failed to restore light state: ${(restoreError as Error)?.message}`,
            );
          }
        }, 1000);

        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "testResult",
          success: true,
          message: `Light test successful for ${targetLight.name}!`,
        });
        streamDeck.logger?.info(
          "ToggleAction: Sent test result to property inspector",
        );
      } else {
        throw new Error("Failed to initialize light repository");
      }
    } catch (error) {
      streamDeck.logger?.error("ToggleAction: testLight failed:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "testResult",
        success: false,
        message: error instanceof Error ? error.message : "Light test failed",
      });
    }
  }

  /**
   * Handle API key validation request from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    streamDeck.logger?.info("ToggleAction: handleValidateApiKey called");
    const apiKey = (ev.payload as any)?.apiKey as string;
    streamDeck.logger?.info(
      `ToggleAction: API key received: ${apiKey ? "present" : "missing"}`,
    );

    if (!apiKey) {
      streamDeck.logger?.warn("ToggleAction: No API key provided");
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "API key is required",
      });
      return;
    }

    // Proceed with actual API validation (removed UUID format check as Govee uses UUID-format keys)

    try {
      streamDeck.logger?.info(
        "ToggleAction: Initializing services with API key",
      );
      // Initialize services with the API key to test it
      this.initializeServices(apiKey);

      // Try to fetch lights as a validation test
      if (this.lightRepository) {
        streamDeck.logger?.info(
          "ToggleAction: Repository initialized, fetching lights",
        );
        const lights = await this.lightRepository.getAllLights();
        streamDeck.logger?.info(
          `ToggleAction: API key validated, found ${lights.length} lights`,
        );

        // Save API key globally for use across all actions
        try {
          await globalSettingsService.setApiKey(apiKey);
          streamDeck.logger?.info(
            "ToggleAction: API key saved to global settings",
          );
        } catch (error) {
          streamDeck.logger?.warn(
            "ToggleAction: Failed to save API key to global settings:",
            error,
          );
        }

        // Save API key globally on successful validation
        await globalSettingsService.setApiKey(apiKey);
        streamDeck.logger?.info(
          "ToggleAction: Saved API key globally",
        );

        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "apiKeyValidated",
          isValid: true,
        });
        streamDeck.logger?.info(
          "ToggleAction: Sent success response to property inspector",
        );
      } else {
        streamDeck.logger?.error(
          "ToggleAction: Repository not initialized after initializeServices",
        );
        throw new Error("Failed to initialize repository");
      }
    } catch (error) {
      streamDeck.logger?.error(
        "ToggleAction: API key validation failed:",
        error,
      );
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid API key",
      });
      streamDeck.logger?.info(
        "ToggleAction: Sent error response to property inspector",
      );
    }
  }

  /**
   * Handle API key status request
   */
  private async handleGetApiKeyStatus(
    ev: SendToPluginEvent<JsonValue, ToggleActionSettings>,
  ): Promise<void> {
    streamDeck.logger?.info("ToggleAction: handleGetApiKeyStatus called");

    try {
      const status = await globalSettingsService.getApiKeyStatus();
      const globalApiKey = await globalSettingsService.getApiKey();

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyStatus",
        hasApiKey: status.hasApiKey,
        apiKey: globalApiKey || "",
        lastValidated: status.lastValidated,
      });

      streamDeck.logger?.info(
        "ToggleAction: Sent API key status to property inspector",
      );
    } catch (error) {
      streamDeck.logger?.error(
        "ToggleAction: Failed to get API key status:",
        error,
      );
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyStatus",
        hasApiKey: false,
        apiKey: "",
        error:
          error instanceof Error ? error.message : "Failed to load API key",
      });
    }
  }

  /**
   * Perform the actual toggle operation
   */
  private async performToggleOperation(
    target: ActionTarget,
    settings: ToggleActionSettings,
  ): Promise<boolean> {
    try {
      if (target.type === "light") {
        return (
          (await this.lightService?.toggleLight(
            target.id,
            target.model!,
            settings.operation,
          )) || false
        );
      } else {
        return (
          (await this.groupService?.toggleGroup(
            target.id,
            settings.operation,
          )) || false
        );
      }
    } catch (error) {
      streamDeck.logger?.error(
        `Toggle operation failed for ${target.type} ${target.id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Calculate new on/off state based on operation
   */
  private calculateNewState(currentState: boolean, operation: string): boolean {
    switch (operation) {
      case "on":
        return true;
      case "off":
        return false;
      case "toggle":
      default:
        return !currentState;
    }
  }

  /**
   * Validate that target is properly configured
   */
  private validateTarget(settings: ToggleActionSettings): boolean {
    if (!settings.targetType) return false;

    if (settings.targetType === "light") {
      return !!(settings.lightId && settings.lightModel);
    } else {
      return !!settings.groupId;
    }
  }

  /**
   * Get target information from settings
   */
  private getTarget(settings: ToggleActionSettings): ActionTarget {
    if (settings.targetType === "light") {
      return {
        type: "light",
        id: settings.lightId!,
        name: settings.lightName || settings.lightId!,
        model: settings.lightModel,
      };
    } else {
      return {
        type: "group",
        id: settings.groupId!,
        name: settings.groupName || settings.groupId!,
      };
    }
  }

  /**
   * Update action state and refresh display
   */
  private async setActionState(
    action: any,
    newState: Partial<ActionState>,
  ): Promise<void> {
    const context = action.id;
    const currentState = this.actionStates.get(context) || {
      isOn: false,
      isConnected: false,
      isLoading: false,
    };

    const updatedState = { ...currentState, ...newState };
    this.actionStates.set(context, updatedState);

    await this.updateActionDisplay(action, await action.getSettings());
  }

  /**
   * Update the action's visual display
   */
  private async updateActionDisplay(
    action: any,
    settings: ToggleActionSettings,
  ): Promise<void> {
    const context = action.id;
    const state = this.actionStates.get(context);

    if (!state) return;

    // Update title based on target and state
    const targetName = this.getTargetDisplayName(settings);
    const statusText = state.isLoading ? "..." : state.isOn ? "ON" : "OFF";
    await action.setTitle(`${targetName}\n${statusText}`);

    // Update icon based on state
    const iconName = this.getIconName(settings, state);
    await action.setImage(`imgs/actions/toggle/${iconName}`);

    // Update Stream Deck+ touchscreen if applicable
    if (action.isDial()) {
      await action.setFeedback({
        title: targetName,
        icon: `imgs/actions/toggle/${iconName}`,
      });
    }
  }

  /**
   * Get display name for the target
   */
  private getTargetDisplayName(settings: ToggleActionSettings): string {
    if (settings.targetType === "light") {
      return settings.lightName || "Light";
    } else {
      return settings.groupName || "Group";
    }
  }

  /**
   * Get appropriate icon name based on settings and state
   */
  private getIconName(
    settings: ToggleActionSettings,
    state: ActionState,
  ): string {
    const baseIcon = settings.targetType === "light" ? "light" : "group";

    if (state.isLoading) {
      return `${baseIcon}-loading`;
    } else if (!state.isConnected) {
      return `${baseIcon}-disconnected`;
    } else if (state.isOn) {
      return `${baseIcon}-on`;
    } else {
      return `${baseIcon}-off`;
    }
  }
}
