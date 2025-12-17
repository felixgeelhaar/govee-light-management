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
import { StreamDeckLightGroupRepository } from "../infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightControlService } from "../domain/services/LightControlService";
import { LightGroupService } from "../domain/services/LightGroupService";
import { LightGroup } from "../domain/entities/LightGroup";
import {
  Brightness,
  ColorRgb,
  ColorTemperature,
} from "@felixgeelhaar/govee-api-client";
import {
  TransportOrchestrator,
  TransportKind,
  CloudTransport,
  TransportHealthService,
} from "../connectivity";
import { DeviceService } from "../domain/services/DeviceService";
import { globalSettingsService } from "../services/GlobalSettingsService";
import { telemetryService } from "../services/TelemetryService";

type GroupControlSettings = {
  apiKey?: string;
  selectedGroupId?: string;
  selectedGroupName?: string;
  controlMode?: "toggle" | "on" | "off" | "brightness" | "color" | "colorTemp";
  brightnessValue?: number;
  colorValue?: string; // hex color
  colorTempValue?: number; // Kelvin
};

/**
 * Stream Deck action for controlling Govee light groups
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.groups" })
export class GroupControlAction extends SingletonAction<GroupControlSettings> {
  private lightRepository?: GoveeLightRepository;
  private groupRepository?: StreamDeckLightGroupRepository;
  private lightControlService?: LightControlService;
  private groupService?: LightGroupService;
  private currentGroup?: LightGroup;
  private currentApiKey?: string;
  private transportOrchestrator?: TransportOrchestrator;
  private deviceService?: DeviceService;
  private healthService?: TransportHealthService;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<GroupControlSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

    // Set initial title based on configuration
    const title = this.getActionTitle(settings);
    await ev.action.setTitle(title);

    // Load current group if configured
    if (settings.selectedGroupId && this.groupService) {
      try {
        const foundGroup = await this.groupService.findGroupById(
          settings.selectedGroupId,
        );
        this.currentGroup = foundGroup || undefined;
        if (this.currentGroup) {
          // Refresh light states for all lights in group
          await this.refreshGroupLightStates(this.currentGroup);
          // Update action appearance based on group state
          const title = this.getActionTitle(settings);
          await ev.action.setTitle(title);
        }
      } catch (error) {
        streamDeck.logger.error("Failed to load group:", error);
      }
    }
  }

  /**
   * Handle key press events
   */
  override async onKeyDown(
    ev: KeyDownEvent<GroupControlSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    await this.ensureServices(settings.apiKey);

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
      streamDeck.logger.warn("Group control action not properly configured");
      return;
    }

    if (!this.currentGroup || !this.lightControlService) {
      await ev.action.showAlert();
      streamDeck.logger.error("Group not available or service not initialized");
      return;
    }

    try {
      await this.executeGroupControl(this.currentGroup, settings);
      // Update action appearance after control with state indicators
      const stateSummary = this.currentGroup.getStateSummary();
      const baseTitle = this.getActionTitle(settings);
      let stateIndicator = "";
      if (stateSummary.allOn) {
        stateIndicator = " ●"; // All on
      } else if (stateSummary.allOff) {
        stateIndicator = " ○"; // All off
      } else if (stateSummary.mixedState) {
        stateIndicator = " ◐"; // Mixed state
      }
      await ev.action.setTitle(baseTitle + stateIndicator);
    } catch (error) {
      streamDeck.logger.error("Failed to control group:", error);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) {
      return;
    }

    const settings = await ev.action.getSettings();

    if (ev.payload.event !== "validateApiKey") {
      await this.ensureServices(settings.apiKey);
    }

    switch (ev.payload.event) {
      case "validateApiKey":
        await this.handleValidateApiKey(ev);
        break;
      case "getGroups":
        await this.handleGetGroups(ev, settings);
        break;
      case "getLights":
        await this.handleGetLights(ev, settings);
        break;
      case "saveGroup":
        await this.handleSaveGroup(ev, settings);
        break;
      case "deleteGroup":
        await this.handleDeleteGroup(ev, settings);
        break;
      case "getTransportHealth":
        await this.handleGetTransportHealth();
        break;
      case "getTelemetrySnapshot":
        await this.handleGetTelemetrySnapshot();
        break;
      case "resetTelemetry":
        await this.handleResetTelemetry();
        break;
      case "setSettings":
        await this.handleSetSettings(ev, settings);
        break;
      case "testGroup":
        await this.handleTestGroup(ev, settings);
        break;
      case "refreshState":
        await this.handleRefreshState(ev, settings);
        break;
    }
  }

  /**
   * Ensure repositories and services are ready for the requested API key
   */
  private async ensureServices(apiKey?: string): Promise<void> {
    if (!this.groupRepository) {
      this.groupRepository = new StreamDeckLightGroupRepository();
    }

    if (apiKey && apiKey !== this.currentApiKey) {
      this.lightRepository = new GoveeLightRepository(apiKey, true);
      this.lightControlService = new LightControlService(this.lightRepository);
      this.groupService = new LightGroupService(
        this.groupRepository,
        this.lightRepository,
      );
      this.currentApiKey = apiKey;

      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger?.warn(
          "Failed to persist API key globally",
          error,
        );
      }
    }

    if (this.lightRepository && !this.lightControlService) {
      this.lightControlService = new LightControlService(this.lightRepository);
    }

    if (
      this.groupRepository &&
      this.lightRepository &&
      !this.groupService
    ) {
      this.groupService = new LightGroupService(
        this.groupRepository,
        this.lightRepository,
      );
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
    }

    if (this.transportOrchestrator && !this.deviceService) {
      this.deviceService = new DeviceService(this.transportOrchestrator, {
        logger: streamDeck.logger,
      });
    }
  }

  private clearApiServices(): void {
    this.lightRepository = undefined;
    this.lightControlService = undefined;
    this.groupService = undefined;
    this.transportOrchestrator = undefined;
    this.deviceService = undefined;
    this.healthService = undefined;
    this.currentApiKey = undefined;
    this.currentGroup = undefined;
  }

  /**
   * Check if action is properly configured
   */
  private isConfigured(settings: GroupControlSettings): boolean {
    return !!(settings.apiKey && settings.selectedGroupId);
  }

  /**
   * Execute the configured control action on the group
   */
  private async executeGroupControl(
    group: LightGroup,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!this.lightControlService) {
      throw new Error("Light control service not initialized");
    }

    const mode = settings.controlMode || "toggle";
    const stateSummary = group.getStateSummary();
    const started = Date.now();
    let commandName = `group.${mode}`;

    try {
      switch (mode) {
        case "toggle": {
          const targetState = stateSummary.allOn ? "off" : "on";
          commandName = targetState === "on"
            ? "group.power.on"
            : "group.power.off";
          await this.lightControlService.controlGroup(group, targetState);
          break;
        }

        case "on":
          commandName = "group.power.on";
          if (
            settings.brightnessValue !== undefined ||
            settings.colorValue ||
            settings.colorTempValue
          ) {
            const controlSettings = this.parseControlSettings(settings);
            await this.lightControlService.turnOnGroupWithSettings(
              group,
              controlSettings,
            );
          } else {
            await this.lightControlService.controlGroup(group, "on");
          }
          break;

        case "off":
          commandName = "group.power.off";
          await this.lightControlService.controlGroup(group, "off");
          break;

        case "brightness":
          if (settings.brightnessValue !== undefined) {
            commandName = "group.brightness";
            const brightness = new Brightness(settings.brightnessValue);
            await this.lightControlService.controlGroup(
              group,
              "brightness",
              brightness,
            );
          }
          break;

        case "color":
          if (settings.colorValue) {
            commandName = "group.color";
            const color = ColorRgb.fromHex(settings.colorValue);
            await this.lightControlService.controlGroup(group, "color", color);
          }
          break;

        case "colorTemp":
          if (settings.colorTempValue) {
            commandName = "group.colorTemperature";
            const colorTemp = new ColorTemperature(settings.colorTempValue);
            await this.lightControlService.controlGroup(
              group,
              "colorTemperature",
              colorTemp,
            );
          }
          break;
      }

      telemetryService.recordCommand({
        command: commandName,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      const failure = error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: String(error) };

      telemetryService.recordCommand({
        command: commandName,
        durationMs: Date.now() - started,
        success: false,
        error: failure,
      });

      throw error;
    }
  }

  /**
   * Parse control settings from action configuration
   */
  private parseControlSettings(settings: GroupControlSettings) {
    const result: {
      brightness?: Brightness;
      color?: ColorRgb;
      colorTemperature?: ColorTemperature;
    } = {};

    if (settings.brightnessValue !== undefined) {
      result.brightness = new Brightness(settings.brightnessValue);
    }

    if (settings.colorValue) {
      result.color = ColorRgb.fromHex(settings.colorValue);
    } else if (settings.colorTempValue) {
      result.colorTemperature = new ColorTemperature(settings.colorTempValue);
    }

    return result;
  }

  /**
   * Get appropriate title for the action
   */
  private getActionTitle(settings: GroupControlSettings): string {
    if (!settings.selectedGroupName) {
      return "Configure\nGroup";
    }

    const mode = settings.controlMode || "toggle";
    const groupName =
      settings.selectedGroupName.length > 10
        ? settings.selectedGroupName.substring(0, 10) + "..."
        : settings.selectedGroupName;

    switch (mode) {
      case "toggle":
        return `Toggle\n${groupName}`;
      case "on":
        return `On\n${groupName}`;
      case "off":
        return `Off\n${groupName}`;
      case "brightness":
        return `Bright\n${groupName}`;
      case "color":
        return `Color\n${groupName}`;
      case "colorTemp":
        return `Temp\n${groupName}`;
      default:
        return groupName;
    }
  }

  /**
   * Refresh light states for all lights in the group
   */
  private async refreshGroupLightStates(group: LightGroup): Promise<void> {
    if (!this.lightRepository) return;

    const refreshPromises = group.lights.map(async (light) => {
      try {
        if (this.lightRepository) {
          await this.lightRepository.getLightState(light);
        }
      } catch (error) {
        streamDeck.logger.warn(
          `Failed to refresh state for light ${light.name}:`,
          error,
        );
      }
    });

    await Promise.all(refreshPromises);
  }

  private mapGroupForInspector(group: LightGroup) {
    const lights = group.lights.map((light) => ({
      deviceId: light.deviceId,
      model: light.model,
      name: light.name,
      label: light.name,
      value: `${light.deviceId}|${light.model}`,
      controllable: light.canBeControlled(),
      retrievable: light.isOnline,
      supportedCommands: [],
    }));

    return {
      id: group.id,
      name: group.name,
      lightIds: group.lights.map(
        (light) => `${light.deviceId}|${light.model}`,
      ),
      lightCount: group.size,
      lights,
    };
  }

  /**
   * Handle request for available groups from property inspector
   */
  private async handleGetGroups(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupsReceived",
        error: "API key required to fetch groups",
      });
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);
      if (!this.groupService) {
        return;
      }
      const groups = await this.groupService.getAllGroups();
      const serialized = groups.map((group) => this.mapGroupForInspector(group));

      await streamDeck.ui.sendToPropertyInspector({
        event: "groupsReceived",
        groups: serialized,
      });

      streamDeck.logger.info(
        `Sent ${serialized.length} groups to property inspector`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to fetch groups:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupsReceived",
        error: "Failed to fetch groups. Check your API key and connection.",
      });
    }
  }

  /**
   * Handle request for available lights from property inspector
   */
  private async handleGetLights(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        error: "API key required to fetch lights",
      });
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      const lights = this.deviceService
        ? await this.deviceService.discover(true)
        : await this.lightRepository?.getAllLights();

      if (!lights) {
        throw new Error("Light discovery service unavailable");
      }

      const lightItems = lights.map((light) => {
        const isLightItem = "label" in light && "value" in light;
        return {
          label: isLightItem ? light.label : `${light.name} (${light.model})`,
          value: isLightItem ? light.value : `${light.deviceId}|${light.model}`,
        };
      });

      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger.info(
        `Sent ${lightItems.length} lights to property inspector`,
      );
    } catch (error) {
      streamDeck.logger.error("Failed to fetch lights:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "lightsReceived",
        error: "Failed to fetch lights. Check your API key and connection.",
      });
    }
  }

  /**
   * Handle create group request from property inspector
   */
  private async handleCreateGroup(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      return;
    }

    const payload = ev.payload as {
      groupName?: string;
      selectedLightIds?: string[];
    };
    if (!payload.groupName || !payload.selectedLightIds) {
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      if (!this.groupService) {
        throw new Error("Group service unavailable");
      }

      // Parse light IDs from the format "deviceId|model"
      const lightIds = payload.selectedLightIds.map((id: string) => {
        const [deviceId, model] = id.split("|");
        return { deviceId, model };
      });

      const group = await this.groupService.createGroup(
        payload.groupName,
        lightIds,
      );

      await streamDeck.ui.sendToPropertyInspector({
        event: "groupCreated",
        success: true,
        group: this.mapGroupForInspector(group),
      });

      // Refresh the groups list
      await this.handleGetGroups(ev, settings);
    } catch (error) {
      streamDeck.logger.error("Failed to create group:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupCreated",
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create group",
      });
    }
  }

  /**
   * Handle get group details request from property inspector
   */
  private async handleGetGroupDetails(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    _settings: GroupControlSettings,
  ): Promise<void> {
    const payload = ev.payload as { groupId?: string };
    if (!payload.groupId) {
      return;
    }

    try {
      await this.ensureServices(this.currentApiKey);

      if (!this.groupService) {
        throw new Error("Group service unavailable");
      }

      const group = await this.groupService.findGroupById(payload.groupId);
      if (group) {
        await streamDeck.ui.sendToPropertyInspector({
          event: "groupDetails",
          group: this.mapGroupForInspector(group),
        });
      } else {
        await streamDeck.ui.sendToPropertyInspector({
          event: "error",
          message: "Group not found",
        });
      }
    } catch (error) {
      streamDeck.logger.error("Failed to get group details:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "error",
        message: "Failed to get group details",
      });
    }
  }

  /**
   * Handle edit group request from property inspector
   */
  private async handleEditGroup(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      return;
    }

    const payload = ev.payload as {
      groupId?: string;
      groupName?: string;
      selectedLightIds?: string[];
    };
    if (!payload.groupId || !payload.groupName || !payload.selectedLightIds) {
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      if (!this.groupService) {
        throw new Error("Group service unavailable");
      }

      // Parse light IDs from the format "deviceId|model"
      const lightIds = payload.selectedLightIds.map((id: string) => {
        const [deviceId, model] = id.split("|");
        return { deviceId, model };
      });

      // Update the group using the service method
      const updatedGroup = await this.groupService.updateGroup(
        payload.groupId,
        payload.groupName,
        lightIds,
      );

      await streamDeck.ui.sendToPropertyInspector({
        event: "groupEdited",
        success: true,
        group: this.mapGroupForInspector(updatedGroup),
      });

      // Refresh the groups list
      await this.handleGetGroups(ev, settings);
    } catch (error) {
      streamDeck.logger.error("Failed to edit group:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupEdited",
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to edit group",
      });
    }
  }

  /**
   * Handle delete group request from property inspector
   */
  private async handleDeleteGroup(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    const payload = ev.payload as { groupId?: string };
    if (!payload.groupId) {
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      if (!this.groupService) {
        throw new Error("Group service unavailable");
      }

      await this.groupService.deleteGroup(payload.groupId);

      await streamDeck.ui.sendToPropertyInspector({
        event: "groupDeleted",
        success: true,
        message: "Group deleted successfully",
        groupId: payload.groupId,
      });

      // Refresh the groups list
      await this.handleGetGroups(ev, settings);
    } catch (error) {
      streamDeck.logger.error("Failed to delete group:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupDeleted",
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete group",
        groupId: payload.groupId,
      });
    }
  }

  /**
   * Handle test group request from property inspector
   */
  private async handleTestGroup(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.selectedGroupId) {
      return;
    }

    await this.ensureServices(settings.apiKey);

    if (!this.groupService || !this.lightControlService) {
      return;
    }

    const started = Date.now();
    let recorded = false;

    try {
      const group = await this.groupService.findGroupById(
        settings.selectedGroupId,
      );

      if (group) {
        // Quick blink test for all lights in group
        const stateSummary = group.getStateSummary();
        const targetState = stateSummary.allOn ? "off" : "on";
        await this.lightControlService.controlGroup(group, targetState);

        global.setTimeout(async () => {
          if (this.lightControlService && group) {
            const newTargetState = targetState === "on" ? "off" : "on";
            await this.lightControlService.controlGroup(group, newTargetState);
          }
        }, 1500);

        telemetryService.recordCommand({
          command: "group.test",
          durationMs: Date.now() - started,
          success: true,
        });
        recorded = true;

        await streamDeck.ui.sendToPropertyInspector({
          event: "testResult",
          success: true,
          message: `Group test successful! Controlled ${group.getControllableLights().length} lights.`,
        });
      }
    } catch (error) {
      streamDeck.logger.error("Group test failed:", error);
      if (!recorded) {
        telemetryService.recordCommand({
          command: "group.test",
          durationMs: Date.now() - started,
          success: false,
          error: error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: String(error) },
        });
      }
      await streamDeck.ui.sendToPropertyInspector({
        event: "testResult",
        success: false,
        message: "Group test failed. Check connections.",
      });
    }
  }

  /**
   * Handle refresh state request from property inspector
   */
  private async handleRefreshState(
    _ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    _settings: GroupControlSettings,
  ): Promise<void> {
    if (this.currentGroup && this.lightRepository) {
      try {
        await this.refreshGroupLightStates(this.currentGroup);
        // Update action appearance
        // Note: setTitle may not be available in SendToPluginEvent context
        // const title = this.getActionTitle(settings);
        // await ev.action.setTitle(title);
      } catch (error) {
        streamDeck.logger.error("Failed to refresh group state:", error);
      }
    }
  }

  private async handleGetTransportHealth(): Promise<void> {
    await this.ensureServices(this.currentApiKey);

    if (!this.healthService) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "transportHealth",
        transports: [],
      });
      return;
    }

    const snapshot = await this.healthService.getHealth(true);
    await streamDeck.ui.sendToPropertyInspector({
      event: "transportHealth",
      transports: snapshot.map((health) => ({
        kind: health.descriptor.kind,
        label: health.descriptor.label,
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
        lastChecked: health.lastChecked,
      })),
    });
  }

  private async handleGetTelemetrySnapshot(): Promise<void> {
    const snapshot = telemetryService.getSnapshot();
    await streamDeck.ui.sendToPropertyInspector({
      event: "telemetrySnapshot",
      snapshot: JSON.parse(JSON.stringify(snapshot)),
    });
  }

  private async handleResetTelemetry(): Promise<void> {
    telemetryService.reset();
    await this.handleGetTelemetrySnapshot();
  }

  /**
   * Handle API key validation from property inspector
   */
  private async handleValidateApiKey(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
  ): Promise<void> {
    const payload = ev.payload as { apiKey?: string };
    const apiKey = payload.apiKey;

    if (!apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "API key is required",
      });
      return;
    }

    try {
      // Test API key by attempting to create repository and fetch lights
      const testRepository = new GoveeLightRepository(apiKey, true);
      await testRepository.getAllLights();

      try {
        await globalSettingsService.setApiKey(apiKey);
      } catch (error) {
        streamDeck.logger.warn("Failed to persist API key globally", error);
      }

      await this.ensureServices(apiKey);

      // If successful, API key is valid
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: true,
      });

      streamDeck.logger.info("API key validated successfully");
    } catch (error) {
      streamDeck.logger.error("API key validation failed:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "apiKeyValidated",
        isValid: false,
        error: "Invalid API key or network error",
      });
    }
  }

  /**
   * Handle save group request from property inspector
   */
  private async handleSaveGroup(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    settings: GroupControlSettings,
  ): Promise<void> {
    if (!settings.apiKey) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupSaved",
        success: false,
        error: "API key required to save group",
      });
      return;
    }

    const payload = ev.payload as {
      group?: { name: string; lightIds: string[] };
    };
    const group = payload.group;

    if (!group || !group.name || !group.lightIds) {
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupSaved",
        success: false,
        error: "Invalid group data",
      });
      return;
    }

    try {
      await this.ensureServices(settings.apiKey);

      // Parse light IDs from the format "deviceId|model"
      const lightIds = group.lightIds.map((id: string) => {
        const [deviceId, model] = id.split("|");
        return { deviceId, model };
      });

      if (!this.groupService) {
        throw new Error("Group service unavailable");
      }

      const savedGroup = await this.groupService.createGroup(
        group.name,
        lightIds,
      );

      await streamDeck.ui.sendToPropertyInspector({
        event: "groupSaved",
        success: true,
        group: this.mapGroupForInspector(savedGroup),
      });

      streamDeck.logger.info(`Group "${group.name}" saved successfully`);
    } catch (error) {
      streamDeck.logger.error("Failed to save group:", error);
      await streamDeck.ui.sendToPropertyInspector({
        event: "groupSaved",
        success: false,
        error: "Failed to save group. Please try again.",
      });
    }
  }

  /**
   * Handle settings update from property inspector
   */
  private async handleSetSettings(
    ev: SendToPluginEvent<JsonValue, GroupControlSettings>,
    previousSettings: GroupControlSettings,
  ): Promise<void> {
    const payload = ev.payload as { settings?: GroupControlSettings };
    const newSettings = payload.settings;

    if (!newSettings) {
      return;
    }

    try {
      // Update action settings
      await ev.action.setSettings(newSettings);

      if (newSettings.apiKey && newSettings.apiKey !== previousSettings.apiKey) {
        await this.ensureServices(newSettings.apiKey);
      } else if (!newSettings.apiKey && previousSettings.apiKey) {
        try {
          await globalSettingsService.clearApiKey();
        } catch (error) {
          streamDeck.logger?.warn("Failed to clear API key globally", error);
        }
        this.clearApiServices();
      } else {
        await this.ensureServices(newSettings.apiKey ?? this.currentApiKey);
      }

      // Update current group if selection changed
      if (newSettings.selectedGroupId && this.groupService) {
        try {
          const foundGroup = await this.groupService.findGroupById(
            newSettings.selectedGroupId,
          );
          this.currentGroup = foundGroup || undefined;
          if (this.currentGroup) {
            await this.refreshGroupLightStates(this.currentGroup);
            // Update action appearance
            // Note: setTitle may not be available in SendToPluginEvent context
            // const title = this.getActionTitle(newSettings);
            // await ev.action.setTitle(title);
          }
        } catch (error) {
          streamDeck.logger.error("Failed to load selected group:", error);
        }
      }

      // Update action title
      // Note: setTitle may not be available in SendToPluginEvent context
      // const title = this.getActionTitle(newSettings);
      // await ev.action.setTitle(title);

      streamDeck.logger.info("Settings updated successfully");
    } catch (error) {
      streamDeck.logger.error("Failed to update settings:", error);
    }
  }
}
