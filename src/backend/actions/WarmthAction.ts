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
  WarmthActionSettings,
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
 * Color Temperature (Warmth) Control Action - Adjust color temperature for lights and groups
 * Supports both Stream Deck buttons and Stream Deck+ dials/touchscreen
 * Dial rotation adjusts color temperature between warm and cool
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.warmth" })
export class WarmthAction extends SingletonAction<WarmthActionSettings> {
  private lightRepository?: GoveeLightRepository;
  private groupRepository?: StreamDeckLightGroupRepository;
  private lightService?: LightControlService;
  private groupService?: GroupControlService;
  private lightGroupService?: LightGroupService;

  /**
   * Cache of current states per action instance
   */
  private actionStates = new Map<
    string,
    ActionState & { colorTemperature: number }
  >();

  /**
   * Initialize action when it appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<WarmthActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    const settings = ev.payload.settings;

    // Initialize services with global API key
    const apiKey = await globalSettingsService.getApiKey();
    if (apiKey) {
      this.initializeServices(apiKey);
    }

    // Initialize default settings if needed
    if (!settings.stepSize) {
      await ev.action.setSettings({
        ...settings,
        colorTemperature: 5000, // Neutral white
        stepSize: 200,
        minTemperature: 2000, // Warm
        maxTemperature: 9000, // Cool
        toggleOnPush: true,
        targetType: "light",
      });
    }

    // Set up Stream Deck+ layout for dial/touchscreen
    if (ev.action.isDial()) {
      await ev.action.setFeedbackLayout("$A0"); // Arc layout with progress indicator
      await ev.action.setTriggerDescription({
        push: "Set Temperature",
        touch: "Set Temperature",
        rotate: "Adjust Warmth",
      });
    }

    // Initialize action state
    this.actionStates.set(context, {
      isOn: false,
      isConnected: false,
      isLoading: false,
      colorTemperature: settings.colorTemperature || 5000,
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
    ev: WillDisappearEvent<WarmthActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    this.actionStates.delete(context);
  }

  /**
   * Handle button press on classic Stream Deck
   */
  override async onKeyDown(
    ev: KeyDownEvent<WarmthActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle button release on classic Stream Deck
   */
  override async onKeyUp(ev: KeyUpEvent<WarmthActionSettings>): Promise<void> {
    await this.executeWarmthControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial press on Stream Deck+
   */
  override async onDialDown(
    ev: DialDownEvent<WarmthActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle dial release on Stream Deck+
   */
  override async onDialUp(
    ev: DialUpEvent<WarmthActionSettings>,
  ): Promise<void> {
    await this.executeWarmthControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial rotation on Stream Deck+
   */
  override async onDialRotate(
    ev: DialRotateEvent<WarmthActionSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const ticks = ev.payload.ticks;
    const step = settings.stepSize || 200;

    // Adjust color temperature based on rotation
    const currentState = this.actionStates.get(ev.action.id);
    const currentTemp =
      currentState?.colorTemperature || settings.colorTemperature || 5000;
    const minTemp = settings.minTemperature || 2000;
    const maxTemp = settings.maxTemperature || 9000;
    const newTemp = Math.max(
      minTemp,
      Math.min(maxTemp, currentTemp + ticks * step),
    );

    // Update local state immediately for responsive feedback
    await this.setActionState(ev.action, { colorTemperature: newTemp });

    // Update settings
    await ev.action.setSettings({
      ...settings,
      colorTemperature: newTemp,
    });

    // Apply temperature change
    await this.setColorTemperature(ev.action, settings, newTemp);
  }

  /**
   * Handle touchscreen tap on Stream Deck+
   */
  override async onTouchTap(
    ev: TouchTapEvent<WarmthActionSettings>,
  ): Promise<void> {
    await this.executeWarmthControl(ev.action, ev.payload.settings);
  }

  /**
   * Execute warmth control operation
   */
  private async executeWarmthControl(
    action: any,
    settings: WarmthActionSettings,
  ): Promise<void> {
    const context = action.id;

    try {
      // Initialize services if needed
      const apiKey = await globalSettingsService.getApiKey();
      if (apiKey && !this.lightService) {
        this.initializeServices(apiKey);
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
        // Set color temperature to current setting
        const currentState = this.actionStates.get(context);
        const temperature =
          currentState?.colorTemperature || settings.colorTemperature || 5000;
        const success = await this.setColorTemperature(
          action,
          settings,
          temperature,
        );

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
            errorMessage: "Failed to set color temperature",
          });
        }
      }
    } catch (error) {
      streamDeck.logger?.error("Warmth action failed:", error);
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
   * Set color temperature for the target
   */
  private async setColorTemperature(
    action: any,
    settings: WarmthActionSettings,
    temperature: number,
  ): Promise<boolean> {
    try {
      const target = this.getTarget(settings);

      if (target.type === "light") {
        return (
          (await this.lightService?.setColorTemperatureById(
            target.id,
            target.model!,
            temperature,
          )) || false
        );
      } else {
        return (
          (await this.groupService?.setColorTemperatureById(
            target.id,
            temperature,
          )) || false
        );
      }
    } catch (error) {
      streamDeck.logger?.error(
        `Color temperature control failed for ${settings.targetType}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Validate that target is properly configured
   */
  private validateTarget(settings: WarmthActionSettings): boolean {
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
  private getTarget(settings: WarmthActionSettings): ActionTarget {
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
    newState: Partial<ActionState & { colorTemperature: number }>,
  ): Promise<void> {
    const context = action.id;
    const currentState = this.actionStates.get(context) || {
      isOn: false,
      isConnected: false,
      isLoading: false,
      colorTemperature: 5000,
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
    settings: WarmthActionSettings,
  ): Promise<void> {
    const context = action.id;
    const state = this.actionStates.get(context);

    if (!state) return;

    // Update title based on target and temperature
    const targetName = this.getTargetDisplayName(settings);
    const tempText = state.isLoading ? "..." : `${state.colorTemperature}K`;
    await action.setTitle(`${targetName}\n${tempText}`);

    // Update icon based on temperature range
    const iconName = this.getIconName(settings, state);
    await action.setImage(`imgs/actions/warmth/${iconName}`);

    // Update Stream Deck+ touchscreen and dial feedback if applicable
    if (action.isDial()) {
      // Calculate progress percentage for arc display
      const minTemp = settings.minTemperature || 2000;
      const maxTemp = settings.maxTemperature || 9000;
      const progress =
        ((state.colorTemperature - minTemp) / (maxTemp - minTemp)) * 100;

      await action.setFeedback({
        title: targetName,
        icon: `imgs/actions/warmth/${iconName}`,
        value: progress,
      });
    }
  }

  /**
   * Get display name for the target
   */
  private getTargetDisplayName(settings: WarmthActionSettings): string {
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
    settings: WarmthActionSettings,
    state: ActionState & { colorTemperature: number },
  ): string {
    const baseIcon = settings.targetType === "light" ? "light" : "group";

    if (state.isLoading) {
      return `${baseIcon}-loading`;
    } else if (!state.isConnected) {
      return `${baseIcon}-disconnected`;
    } else if (state.colorTemperature <= 3000) {
      return `${baseIcon}-warm`; // Warm/yellow light
    } else if (state.colorTemperature >= 6500) {
      return `${baseIcon}-cool`; // Cool/blue light
    } else {
      return `${baseIcon}-neutral`; // Neutral white
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<any, WarmthActionSettings>,
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
    ev: SendToPluginEvent<any, WarmthActionSettings>,
  ): Promise<void> {
    try {
      const globalApiKey = await globalSettingsService.getApiKey();

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKey",
        apiKey: globalApiKey || null,
      });

      streamDeck.logger?.info(
        `WarmthAction: Sent global API key (exists: ${!!globalApiKey})`,
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
    ev: SendToPluginEvent<any, WarmthActionSettings>,
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
        `WarmthAction: API test successful, found ${lights.length} lights`,
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
    ev: SendToPluginEvent<any, WarmthActionSettings>,
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
        streamDeck.logger?.info("WarmthAction: Saved API key globally");

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
    ev: SendToPluginEvent<any, WarmthActionSettings>,
  ): Promise<void> {
    try {
      // Always use global API key per Elgato best practices
      const apiKey = await globalSettingsService.getApiKey();

      if (!apiKey) {
        await streamDeck.ui.current?.sendToPropertyInspector({
          event: "lightsReceived",
          lights: [],
          error: "No API key configured",
        });
        return;
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
        supportsColorTemperature:
          light.capabilities?.includes("colorTemperature") ?? true,
      }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger?.info(
        `WarmthAction: Sent ${lightItems.length} lights to property inspector`,
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
    ev: SendToPluginEvent<any, WarmthActionSettings>,
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
        `WarmthAction: Sent ${groupItems.length} groups to property inspector`,
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
}
