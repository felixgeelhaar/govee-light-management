/**
 * Abstract base class for all Stream Deck actions
 * Provides common functionality and enforces consistent patterns
 */

import {
  SingletonAction,
  type Action,
  type WillAppearEvent,
  type WillDisappearEvent,
  type SendToPluginEvent,
  type DidReceiveSettingsEvent,
  type JsonValue,
  type JsonObject,
} from "@elgato/streamdeck";
import type { ExtendedAction } from "../../types/StreamDeckActionTypes";
import { GoveeLightRepository } from "../../infrastructure/repositories/GoveeLightRepository";
import { StreamDeckLightGroupRepository } from "../../infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightControlService } from "../../domain/services/LightControlService";
import { GroupControlService } from "../../domain/services/GroupControlService";
import { LightGroupService } from "../../domain/services/LightGroupService";
import { ActionValidationService } from "./ActionValidationService";
import { ActionErrorHandler } from "./ActionErrorHandler";
import { getStreamDeck } from "../../utils/streamDeckInstance";
import type {
  BaseActionSettings,
  ActionTarget,
  ActionState,
  ValidationResult,
} from "./BaseActionSettings";

export abstract class AbstractStreamDeckAction<
  TSettings extends BaseActionSettings & JsonObject,
> extends SingletonAction<TSettings> {
  // Repositories
  protected lightRepository?: GoveeLightRepository;
  protected groupRepository?: StreamDeckLightGroupRepository;

  // Services
  protected lightService?: LightControlService;
  protected groupService?: GroupControlService;
  protected lightGroupService?: LightGroupService;

  // State management
  protected actionStates = new Map<string, ActionState>();

  // Abstract methods that must be implemented by subclasses
  protected abstract getActionName(): string;
  protected abstract executeAction(
    action: ExtendedAction<TSettings>,
    settings: TSettings,
  ): Promise<void>;
  protected abstract updateDisplay(
    action: ExtendedAction<TSettings>,
    state: ActionState,
  ): Promise<void>;

  /**
   * Handle action appearance
   */
  override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
    const { action, payload } = ev;
    const { settings } = payload;
    const extendedAction = action as unknown as ExtendedAction<TSettings>;

    try {
      // Initialize state
      await this.setActionState(extendedAction, {
        isLoading: false,
        errorMessage: undefined,
      });

      // Validate and initialize if we have settings
      if (settings) {
        await this.handleInitialization(extendedAction, settings);
      }

      // Let subclass do specific initialization
      await this.onActionWillAppear?.(ev);
    } catch (error) {
      await ActionErrorHandler.handleActionError(
        extendedAction,
        error,
        {
          action: this.getActionName(),
          operation: "onWillAppear",
          settings: settings as any,
        },
        (state) => this.setActionState(extendedAction, state),
      );
    }
  }

  /**
   * Optional hook for subclasses to implement custom appearance logic
   */
  protected onActionWillAppear?(ev: WillAppearEvent<TSettings>): Promise<void>;

  /**
   * Handle action disappearance
   */
  override async onWillDisappear(
    ev: WillDisappearEvent<TSettings>,
  ): Promise<void> {
    const { action } = ev;
    const extendedAction = action as unknown as ExtendedAction<TSettings>;

    // Clean up state
    this.actionStates.delete(action.id);

    // Let subclass do specific cleanup
    await this.onActionWillDisappear?.(ev);
  }

  /**
   * Optional hook for subclasses to implement custom disappearance logic
   */
  protected onActionWillDisappear?(
    ev: WillDisappearEvent<TSettings>,
  ): Promise<void>;

  /**
   * Handle settings changes
   */
  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    const { action, payload } = ev;
    const { settings } = payload;
    const extendedAction = action as unknown as ExtendedAction<TSettings>;

    try {
      // Validate new settings
      const validation = ActionValidationService.validateSettings(settings);
      if (!validation.isValid) {
        await this.handleValidationErrors(extendedAction, validation);
        return;
      }

      // Reinitialize with new settings
      await this.handleInitialization(extendedAction, settings);

      // Let subclass handle specific settings
      await this.onActionDidReceiveSettings?.(ev);
    } catch (error) {
      await ActionErrorHandler.handleActionError(
        extendedAction,
        error,
        {
          action: this.getActionName(),
          operation: "onDidReceiveSettings",
          settings: settings as any,
        },
        (state) => this.setActionState(extendedAction, state),
      );
    }
  }

  /**
   * Optional hook for subclasses to implement custom settings logic
   */
  protected onActionDidReceiveSettings?(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void>;

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, TSettings>,
  ): Promise<void> {
    const { action, payload } = ev;
    const extendedAction = action as unknown as ExtendedAction<TSettings>;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return;
    }

    const data = payload as any;

    try {
      // Handle common messages
      switch (data.event) {
        case "validateApiKey":
          await this.handleValidateApiKey(extendedAction, data.apiKey);
          break;

        case "getDevices":
          await this.handleGetDevices(extendedAction);
          break;

        case "testDevice":
          await this.handleTestDevice(
            extendedAction,
            data.deviceId,
            data.model,
          );
          break;

        case "getGroups":
          await this.handleGetGroups(extendedAction);
          break;

        default:
          // Let subclass handle custom messages
          await this.onActionSendToPlugin?.(ev);
      }
    } catch (error) {
      await ActionErrorHandler.handleActionError(
        extendedAction,
        error,
        {
          action: this.getActionName(),
          operation: `onSendToPlugin:${data.event}`,
          settings: (ev.payload as any).settings,
          metadata: { event: data.event },
        },
        (state) => this.setActionState(extendedAction, state),
      );
    }
  }

  /**
   * Optional hook for subclasses to handle custom property inspector messages
   */
  protected onActionSendToPlugin?(
    ev: SendToPluginEvent<JsonValue, TSettings>,
  ): Promise<void>;

  /**
   * Initialize services with API key
   */
  protected initializeServices(apiKey: string): void {
    this.lightRepository = new GoveeLightRepository(apiKey);
    this.groupRepository = new StreamDeckLightGroupRepository(getStreamDeck());
    this.lightService = new LightControlService(this.lightRepository);
    this.groupService = new GroupControlService(
      this.groupRepository,
      this.lightService,
    );
    this.lightGroupService = new LightGroupService(
      this.groupRepository,
      this.lightRepository,
    );
  }

  /**
   * Handle initialization with settings
   */
  private async handleInitialization(
    action: ExtendedAction<TSettings>,
    settings: TSettings,
  ): Promise<void> {
    // Validate settings
    const validation = ActionValidationService.validateSettings(settings);
    if (!validation.isValid) {
      await this.handleValidationErrors(action, validation);
      return;
    }

    // Initialize services if we have an API key
    if (settings.apiKey) {
      this.initializeServices(settings.apiKey);
    }

    // Update display
    const state = this.getActionState(action);
    await this.updateDisplay(action, state);
  }

  /**
   * Handle validation errors
   */
  private async handleValidationErrors(
    action: ExtendedAction<TSettings>,
    validation: ValidationResult,
  ): Promise<void> {
    await action.showAlert();
    await this.setActionState(action, {
      isLoading: false,
      errorMessage: validation.errors.join(", "),
    });

    // Send validation result to property inspector
    await action.sendToPropertyInspector({
      event: "validationError",
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  /**
   * Handle API key validation request
   */
  private async handleValidateApiKey(
    action: ExtendedAction<TSettings>,
    apiKey: string,
  ): Promise<void> {
    // Show loading state
    await this.setActionState(action, { isLoading: true });

    try {
      const validation = await ActionValidationService.validateApiKey(apiKey);

      await action.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      });

      if (validation.isValid) {
        // Initialize services with validated key
        this.initializeServices(apiKey);

        // Save to global settings
        const streamDeck = getStreamDeck();
        const globalSettings =
          (await streamDeck?.settings?.getGlobalSettings()) || {};
        await streamDeck?.settings?.setGlobalSettings({
          ...globalSettings,
          apiKey: apiKey.trim(),
        });

        await action.showOk();
      } else {
        await action.showAlert();
      }
    } finally {
      await this.setActionState(action, { isLoading: false });
    }
  }

  /**
   * Handle device list request
   */
  private async handleGetDevices(
    action: ExtendedAction<TSettings>,
  ): Promise<void> {
    if (!this.lightRepository) {
      await action.sendToPropertyInspector({
        event: "devicesReceived",
        error: "API not initialized",
        devices: [],
      });
      return;
    }

    try {
      const lights = await this.lightRepository.getAllLights();
      await action.sendToPropertyInspector({
        event: "devicesReceived",
        devices: lights.map((light) => ({
          deviceId: light.deviceId,
          model: light.model,
          name: light.name,
          isOnline: light.isOnline,
          capabilities: light.capabilities,
        })),
      });
    } catch (error) {
      await action.sendToPropertyInspector({
        event: "devicesReceived",
        error: error instanceof Error ? error.message : "Unknown error",
        devices: [],
      });
    }
  }

  /**
   * Handle device test request
   */
  private async handleTestDevice(
    action: ExtendedAction<TSettings>,
    deviceId: string,
    model: string,
  ): Promise<void> {
    if (!this.lightService) {
      await action.sendToPropertyInspector({
        event: "deviceTestResult",
        success: false,
        error: "API not initialized",
      });
      return;
    }

    try {
      // Flash the device to test it
      const light = await this.lightRepository!.findLight(deviceId, model);
      if (!light) {
        throw new Error(`Light not found: ${deviceId}`);
      }
      const currentState = light.isOn;

      // Toggle twice to flash
      await this.lightRepository!.setPower(light, !currentState);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await this.lightRepository!.setPower(light, currentState);

      await action.sendToPropertyInspector({
        event: "deviceTestResult",
        success: true,
      });
    } catch (error) {
      await action.sendToPropertyInspector({
        event: "deviceTestResult",
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      });
    }
  }

  /**
   * Handle group list request
   */
  private async handleGetGroups(
    action: ExtendedAction<TSettings>,
  ): Promise<void> {
    if (!this.groupRepository) {
      await action.sendToPropertyInspector({
        event: "groupsReceived",
        error: "Storage not initialized",
        groups: [],
      });
      return;
    }

    try {
      const groups = await this.groupRepository.getAllGroups();
      await action.sendToPropertyInspector({
        event: "groupsReceived",
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          deviceCount: group.lights.length,
        })),
      });
    } catch (error) {
      await action.sendToPropertyInspector({
        event: "groupsReceived",
        error: error instanceof Error ? error.message : "Unknown error",
        groups: [],
      });
    }
  }

  /**
   * Get target from settings
   */
  protected getTarget(settings: TSettings): ActionTarget | null {
    const validation = ActionValidationService.validateTarget(settings);
    if (!validation.isValid) {
      return null;
    }

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
   * Get action state
   */
  protected getActionState(action: ExtendedAction<TSettings>): ActionState {
    return (
      this.actionStates.get(action.id) || {
        isLoading: false,
        errorMessage: undefined,
      }
    );
  }

  /**
   * Set action state
   */
  protected async setActionState(
    action: ExtendedAction<TSettings>,
    state: Partial<ActionState>,
  ): Promise<void> {
    const currentState = this.getActionState(action);
    const newState = { ...currentState, ...state, lastUpdate: Date.now() };
    this.actionStates.set(action.id, newState);
    await this.updateDisplay(action, newState);
  }
}
