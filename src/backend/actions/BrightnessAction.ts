import {
  action,
  DialDownEvent,
  DialUpEvent,
  DialRotateEvent,
  KeyDownEvent,
  KeyUpEvent,
  SendToPluginEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import type {
  BrightnessActionSettings,
  ActionTarget,
  ActionState,
} from "@shared/types/newActions";
import { GoveeLightRepository } from "../infrastructure/repositories/GoveeLightRepository";
import { StreamDeckLightGroupRepository } from "../infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { GroupControlService } from "../domain/services/GroupControlService";
import { LightGroupService } from "../domain/services/LightGroupService";
import { streamDeck } from "../plugin";
import { globalSettingsService } from "../services/GlobalSettingsService";

/**
 * Brightness Control Action - Adjust brightness for lights and groups
 * Supports both Stream Deck buttons and Stream Deck+ dials/touchscreen
 * Dial rotation adjusts brightness incrementally
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness" })
export class BrightnessAction extends SingletonAction<BrightnessActionSettings> {
  private lightRepository?: GoveeLightRepository;
  private groupRepository?: StreamDeckLightGroupRepository;
  private lightService?: LightControlService;
  private groupService?: GroupControlService;
  private lightGroupService?: LightGroupService;
  private apiKey?: string; // Cache API key for reuse

  /**
   * Cache of current states per action instance
   */
  private actionStates = new Map<
    string,
    ActionState & { brightness: number }
  >();

  /**
   * Initialize action when it appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<BrightnessActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    const settings = ev.payload.settings;

    // Initialize services if API key is available
    if (settings.apiKey) {
      this.initializeServices(settings.apiKey);
    }

    // Initialize default settings if needed
    if (!settings.stepSize) {
      await ev.action.setSettings({
        ...settings,
        stepSize: 10,
        brightness: 50,
        minBrightness: 1,
        maxBrightness: 100,
        toggleOnPush: true,
        targetType: "light",
      });
    }

    // Set up Stream Deck+ layout for dial/touchscreen
    if (ev.action.isDial()) {
      await ev.action.setFeedbackLayout("$A0"); // Arc layout with progress
      await ev.action.setTriggerDescription({
        push: "Set Brightness",
        touch: "Set Brightness",
        rotate: "Adjust Brightness",
      });
    }

    // Initialize action state
    this.actionStates.set(context, {
      isOn: false,
      isConnected: false,
      isLoading: false,
      brightness: settings.brightness || 50,
    });

    // Update display
    await this.updateActionDisplay(ev.action, settings);
  }

  /**
   * Initialize services with API key
   */
  private initializeServices(apiKey: string): void {
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
    ev: WillDisappearEvent<BrightnessActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    this.actionStates.delete(context);
  }

  /**
   * Handle button press on classic Stream Deck
   */
  override async onKeyDown(
    ev: KeyDownEvent<BrightnessActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle button release on classic Stream Deck
   */
  override async onKeyUp(
    ev: KeyUpEvent<BrightnessActionSettings>,
  ): Promise<void> {
    await this.executeBrightnessControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial press on Stream Deck+
   */
  override async onDialDown(
    ev: DialDownEvent<BrightnessActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle dial release on Stream Deck+
   */
  override async onDialUp(
    ev: DialUpEvent<BrightnessActionSettings>,
  ): Promise<void> {
    await this.executeBrightnessControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial rotation on Stream Deck+
   */
  override async onDialRotate(
    ev: DialRotateEvent<BrightnessActionSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const ticks = ev.payload.ticks;
    const step = settings.stepSize || 10;

    // Adjust brightness based on rotation
    const currentState = this.actionStates.get(ev.action.id);
    const currentBrightness = currentState?.brightness || 50;
    const minBrightness = settings.minBrightness || 1;
    const maxBrightness = settings.maxBrightness || 100;
    const newBrightness = Math.max(
      minBrightness,
      Math.min(maxBrightness, currentBrightness + ticks * step),
    );

    // Update local state immediately for responsive feedback
    await this.setActionState(ev.action, { brightness: newBrightness });

    // Apply brightness change
    await this.setBrightness(ev.action, settings, newBrightness);
  }

  /**
   * Handle touchscreen tap on Stream Deck+
   */
  override async onTouchTap(
    ev: TouchTapEvent<BrightnessActionSettings>,
  ): Promise<void> {
    await this.executeBrightnessControl(ev.action, ev.payload.settings);
  }

  /**
   * Execute brightness control operation
   */
  private async executeBrightnessControl(
    action: any,
    settings: BrightnessActionSettings,
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

      // Handle push action based on toggleOnPush setting
      if (settings.toggleOnPush) {
        // Toggle the light/group on/off
        const success = await this.toggleTarget(target);
        if (success) {
          const currentState = this.actionStates.get(context);
          await this.setActionState(action, {
            isOn: !currentState?.isOn,
            isConnected: true,
            isLoading: false,
            errorMessage: undefined,
          });
        } else {
          await action.showAlert();
          await this.setActionState(action, {
            isLoading: false,
            errorMessage: "Failed to toggle light/group",
          });
        }
      } else {
        // Set brightness to current setting
        const currentState = this.actionStates.get(context);
        const brightness =
          currentState?.brightness || settings.brightness || 50;
        const success = await this.setBrightness(action, settings, brightness);

        if (success) {
          await this.setActionState(action, {
            isConnected: true,
            isLoading: false,
            errorMessage: undefined,
          });
        } else {
          await action.showAlert();
          await this.setActionState(action, {
            isLoading: false,
            errorMessage: "Failed to set brightness",
          });
        }
      }
    } catch (error) {
      streamDeck.logger?.error("Brightness action failed:", error);
      await action.showAlert();
      await this.setActionState(action, {
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Toggle target on/off
   */
  private async toggleTarget(target: ActionTarget): Promise<boolean> {
    try {
      if (target.type === "light") {
        return (
          (await this.lightService?.toggleLight(
            target.id,
            target.model!,
            "toggle",
          )) || false
        );
      } else {
        return (
          (await this.groupService?.toggleGroup(target.id, "toggle")) || false
        );
      }
    } catch (error) {
      streamDeck.logger?.error(
        `Toggle failed for ${target.type} ${target.id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Set brightness for the target
   */
  private async setBrightness(
    action: any,
    settings: BrightnessActionSettings,
    brightness: number,
  ): Promise<boolean> {
    try {
      const target = this.getTarget(settings);

      if (target.type === "light") {
        return (
          (await this.lightService?.setBrightnessById(
            target.id,
            target.model!,
            brightness,
          )) || false
        );
      } else {
        return (
          (await this.groupService?.setBrightnessGroup(
            target.id,
            brightness,
          )) || false
        );
      }
    } catch (error) {
      streamDeck.logger?.error(
        `Brightness control failed for ${settings.targetType}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Validate that target is properly configured
   */
  private validateTarget(settings: BrightnessActionSettings): boolean {
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
  private getTarget(settings: BrightnessActionSettings): ActionTarget {
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
    newState: Partial<ActionState & { brightness: number }>,
  ): Promise<void> {
    const context = action.id;
    const currentState = this.actionStates.get(context) || {
      isOn: false,
      isConnected: false,
      isLoading: false,
      brightness: 50,
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
    settings: BrightnessActionSettings,
  ): Promise<void> {
    const context = action.id;
    const state = this.actionStates.get(context);

    if (!state) return;

    // Update title based on target and brightness
    const targetName = this.getTargetDisplayName(settings);
    const brightnessText = state.isLoading ? "..." : `${state.brightness}%`;
    await action.setTitle(`${targetName}\n${brightnessText}`);

    // Update icon based on brightness level
    const iconName = this.getIconName(settings, state);
    await action.setImage(`imgs/actions/brightness/${iconName}`);

    // Update Stream Deck+ touchscreen and dial feedback if applicable
    if (action.isDial()) {
      await action.setFeedback({
        title: targetName,
        icon: `imgs/actions/brightness/${iconName}`,
        value: state.brightness,
      });
    }
  }

  /**
   * Get display name for the target
   */
  private getTargetDisplayName(settings: BrightnessActionSettings): string {
    if (settings.targetType === "light") {
      return settings.lightName || "Light";
    } else {
      return settings.groupName || "Group";
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
  ): Promise<void> {
    const { event } = ev.payload;

    switch (event) {
      case "validateApiKey":
        await this.handleValidateApiKey(ev);
        break;
      case "getGlobalApiKey":
        await this.handleGetGlobalApiKey(ev);
        break;
      case "testApiConnection":
        await this.handleTestApiConnection(ev);
        break;
      case "getLights":
        await this.handleGetLights(ev);
        break;
      case "getGroups":
        await this.handleGetGroups(ev);
        break;
      default:
        streamDeck.logger?.debug(`Unknown message event: ${event}`);
    }
  }

  /**
   * Handle get global API key request from property inspector
   */
  private async handleGetGlobalApiKey(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
  ): Promise<void> {
    try {
      const globalApiKey = await globalSettingsService.getApiKey();

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKey",
        apiKey: globalApiKey || null,
      });

      streamDeck.logger?.info(
        `BrightnessAction: Sent global API key (exists: ${!!globalApiKey})`,
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
   * Handle test API connection request from property inspector
   */
  private async handleTestApiConnection(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
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

      streamDeck.logger?.info(
        `BrightnessAction: API test successful, found ${lights.length} lights`,
      );

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiConnectionTested",
        success: true,
        message: `Connection successful! Found ${lights.length} light${lights.length !== 1 ? "s" : ""}`,
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
   * Handle API key validation request from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
  ): Promise<void> {
    const apiKey = (ev.payload as any)?.apiKey as string;

    if (!apiKey) {
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "API key is required",
      });
      return;
    }

    try {
      // Initialize services with the API key to test it
      this.initializeServices(apiKey);

      // Try to fetch lights as a validation test
      if (this.lightRepository) {
        const lights = await this.lightRepository.getAllLights();
        streamDeck.logger?.info(
          `API key validated, found ${lights.length} lights`,
        );

        // Save API key globally on successful validation
        await globalSettingsService.setApiKey(apiKey);
        streamDeck.logger?.info("BrightnessAction: Saved API key globally");

        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "apiKeyValidated",
          isValid: true,
        });
      } else {
        throw new Error("Failed to initialize repository");
      }
    } catch (error) {
      streamDeck.logger?.error("API key validation failed:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid API key",
      });
    }
  }

  /**
   * Handle get lights request from property inspector
   */
  private async handleGetLights(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
  ): Promise<void> {
    try {
      // Use cached API key or try to get it from settings/global
      let apiKey = this.apiKey;

      if (!apiKey) {
        const settings = ev.payload.settings;
        apiKey = settings?.apiKey;

        if (!apiKey) {
          apiKey = await globalSettingsService.getApiKey();
        }

        if (!apiKey) {
          await streamDeck.ui.current?.sendToPropertyInspector({
            event: "lightsReceived",
            lights: [],
            error: "No API key configured",
          });
          return;
        }

        // Cache the API key and initialize services
        this.initializeServices(apiKey);
      }

      // Initialize repository if needed
      if (!this.lightRepository) {
        this.initializeServices(apiKey);
      }

      // Fetch lights
      const lights = await this.lightRepository!.getAllLights();

      // Convert to property inspector format
      const lightItems = lights.map((light) => ({
        value: `${light.deviceId}|${light.model}`,
        label: light.name,
        isOnline: light.isOnline,
        supportsBrightness: light.capabilities?.includes("brightness") ?? true,
      }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger?.info(
        `BrightnessAction: Sent ${lightItems.length} lights to property inspector`,
      );
    } catch (error) {
      streamDeck.logger?.error("Failed to get lights:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch lights",
      });
    }
  }

  /**
   * Handle get groups request from property inspector
   */
  private async handleGetGroups(
    ev: SendToPluginEvent<any, BrightnessActionSettings>,
  ): Promise<void> {
    try {
      // Initialize repository if needed
      if (!this.groupRepository) {
        this.groupRepository = new StreamDeckLightGroupRepository(streamDeck);
      }

      // Fetch groups
      const groups = await this.groupRepository.getAllGroups();

      // Convert to property inspector format
      const groupItems = groups.map((group) => ({
        value: group.id,
        label: group.name,
        lightCount: group.lights.length,
      }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "groupsReceived",
        groups: groupItems,
      });

      streamDeck.logger?.info(
        `BrightnessAction: Sent ${groupItems.length} groups to property inspector`,
      );
    } catch (error) {
      streamDeck.logger?.error("Failed to get groups:", error);
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "groupsReceived",
        groups: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch groups",
      });
    }
  }

  /**
   * Get appropriate icon name based on settings and state
   */
  private getIconName(
    settings: BrightnessActionSettings,
    state: ActionState & { brightness: number },
  ): string {
    const baseIcon = settings.targetType === "light" ? "light" : "group";

    if (state.isLoading) {
      return `${baseIcon}-loading`;
    } else if (!state.isConnected) {
      return `${baseIcon}-disconnected`;
    } else if (state.brightness === 0) {
      return `${baseIcon}-off`;
    } else if (state.brightness <= 25) {
      return `${baseIcon}-low`;
    } else if (state.brightness <= 75) {
      return `${baseIcon}-medium`;
    } else {
      return `${baseIcon}-high`;
    }
  }
}
