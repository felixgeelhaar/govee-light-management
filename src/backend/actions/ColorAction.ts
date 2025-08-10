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
  ColorActionSettings,
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
 * Color Control Action - Set and cycle through colors for lights and groups
 * Supports both Stream Deck buttons and Stream Deck+ dials/touchscreen
 * Dial rotation cycles through color presets or adjusts hue
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.color" })
export class ColorAction extends SingletonAction<ColorActionSettings> {
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
    ActionState & { currentColor: string; currentPresetIndex: number }
  >();

  /**
   * Default color presets
   */
  private readonly defaultColorPresets = [
    "#FF0000", // Red
    "#00FF00", // Green
    "#0000FF", // Blue
    "#FFFF00", // Yellow
    "#FF00FF", // Magenta
    "#00FFFF", // Cyan
    "#FFA500", // Orange
    "#800080", // Purple
    "#FFFFFF", // White
  ];

  /**
   * Initialize action when it appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ColorActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    const settings = ev.payload.settings;

    // Initialize services with global API key
    const apiKey = await globalSettingsService.getApiKey();
    if (apiKey) {
      this.initializeServices(apiKey);
    }

    // Initialize default settings if needed
    if (!settings.colorPresets) {
      await ev.action.setSettings({
        ...settings,
        color: "#FF0000",
        colorPresets: this.defaultColorPresets,
        usePresets: true,
        currentPresetIndex: 0,
        targetType: "light",
      });
    }

    // Set up Stream Deck+ layout for dial/touchscreen
    if (ev.action.isDial()) {
      await ev.action.setFeedbackLayout("$B1"); // Canvas layout for color display
      await ev.action.setTriggerDescription({
        push: "Set Color",
        touch: "Set Color",
        rotate: "Cycle Colors",
      });
    }

    // Initialize action state
    this.actionStates.set(context, {
      isOn: false,
      isConnected: false,
      isLoading: false,
      currentColor: settings.color || "#FF0000",
      currentPresetIndex: settings.currentPresetIndex || 0,
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
    ev: WillDisappearEvent<ColorActionSettings>,
  ): Promise<void> {
    const context = ev.action.id;
    this.actionStates.delete(context);
  }

  /**
   * Handle button press on classic Stream Deck
   */
  override async onKeyDown(
    ev: KeyDownEvent<ColorActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle button release on classic Stream Deck
   */
  override async onKeyUp(ev: KeyUpEvent<ColorActionSettings>): Promise<void> {
    await this.executeColorControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial press on Stream Deck+
   */
  override async onDialDown(
    ev: DialDownEvent<ColorActionSettings>,
  ): Promise<void> {
    // Visual feedback - show pressed state
    await this.setActionState(ev.action, { isLoading: true });
  }

  /**
   * Handle dial release on Stream Deck+
   */
  override async onDialUp(ev: DialUpEvent<ColorActionSettings>): Promise<void> {
    await this.executeColorControl(ev.action, ev.payload.settings);
  }

  /**
   * Handle dial rotation on Stream Deck+
   */
  override async onDialRotate(
    ev: DialRotateEvent<ColorActionSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings;
    const ticks = ev.payload.ticks;

    if (settings.usePresets) {
      // Cycle through color presets
      await this.cycleColorPresets(ev.action, settings, ticks);
    } else {
      // Adjust hue continuously
      await this.adjustHue(ev.action, settings, ticks);
    }
  }

  /**
   * Handle touchscreen tap on Stream Deck+
   */
  override async onTouchTap(
    ev: TouchTapEvent<ColorActionSettings>,
  ): Promise<void> {
    await this.executeColorControl(ev.action, ev.payload.settings);
  }

  /**
   * Cycle through color presets based on dial rotation
   */
  private async cycleColorPresets(
    action: any,
    settings: ColorActionSettings,
    ticks: number,
  ): Promise<void> {
    const currentState = this.actionStates.get(action.id);
    const currentIndex = currentState?.currentPresetIndex || 0;
    const presets = settings.colorPresets || this.defaultColorPresets;

    // Calculate new preset index
    const newIndex = Math.max(
      0,
      Math.min(presets.length - 1, currentIndex + ticks),
    );
    const newColor = presets[newIndex];

    // Update local state immediately for responsive feedback
    await this.setActionState(action, {
      currentColor: newColor,
      currentPresetIndex: newIndex,
    });

    // Update settings
    await action.setSettings({
      ...settings,
      color: newColor,
      currentPresetIndex: newIndex,
    });

    // Apply color change
    await this.setColor(action, settings, newColor);
  }

  /**
   * Adjust hue continuously based on dial rotation
   */
  private async adjustHue(
    action: any,
    settings: ColorActionSettings,
    ticks: number,
  ): Promise<void> {
    const currentState = this.actionStates.get(action.id);
    const currentColor =
      currentState?.currentColor || settings.color || "#FF0000";

    // Convert current color to HSL
    const hsl = this.hexToHsl(currentColor);

    // Adjust hue by ticks (each tick = 10 degrees)
    const hueStep = 10;
    const newHue = (hsl.h + ticks * hueStep + 360) % 360;

    // Convert back to hex
    const newColor = this.hslToHex({ h: newHue, s: hsl.s, l: hsl.l });

    // Update local state immediately for responsive feedback
    await this.setActionState(action, { currentColor: newColor });

    // Update settings
    await action.setSettings({
      ...settings,
      color: newColor,
    });

    // Apply color change
    await this.setColor(action, settings, newColor);
  }

  /**
   * Execute color control operation
   */
  private async executeColorControl(
    action: any,
    settings: ColorActionSettings,
  ): Promise<void> {
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

      const currentState = this.actionStates.get(action.id);
      const color = currentState?.currentColor || settings.color || "#FF0000";
      const success = await this.setColor(action, settings, color);

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
          errorMessage: "Failed to set color",
        });
      }
    } catch (error) {
      streamDeck.logger?.error("Color action failed:", error);
      await action.showAlert();
      await this.setActionState(action, {
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Set color for the target
   */
  private async setColor(
    action: any,
    settings: ColorActionSettings,
    color: string,
  ): Promise<boolean> {
    try {
      const target = this.getTarget(settings);

      if (target.type === "light") {
        return (
          (await this.lightService?.setColorById(
            target.id,
            target.model!,
            color,
          )) || false
        );
      } else {
        return (
          (await this.groupService?.setColorById(target.id, color)) || false
        );
      }
    } catch (error) {
      streamDeck.logger?.error(
        `Color control failed for ${settings.targetType}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Validate that target is properly configured
   */
  private validateTarget(settings: ColorActionSettings): boolean {
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
  private getTarget(settings: ColorActionSettings): ActionTarget {
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
    newState: Partial<
      ActionState & { currentColor: string; currentPresetIndex: number }
    >,
  ): Promise<void> {
    const context = action.id;
    const currentState = this.actionStates.get(context) || {
      isOn: false,
      isConnected: false,
      isLoading: false,
      currentColor: "#FF0000",
      currentPresetIndex: 0,
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
    settings: ColorActionSettings,
  ): Promise<void> {
    const context = action.id;
    const state = this.actionStates.get(context);

    if (!state) return;

    // Update title based on target and color
    const targetName = this.getTargetDisplayName(settings);
    const colorName = this.getColorName(state.currentColor);
    await action.setTitle(`${targetName}\n${colorName}`);

    // Update icon based on current color
    const iconName = this.getIconName(settings, state);
    await action.setImage(`imgs/actions/color/${iconName}`);

    // Update Stream Deck+ touchscreen if applicable
    if (action.isDial()) {
      // Create a color canvas for the touchscreen
      const canvas = this.createColorCanvas(state.currentColor);
      await action.setFeedback({
        title: targetName,
        canvas: canvas,
      });
    }
  }

  /**
   * Get display name for the target
   */
  private getTargetDisplayName(settings: ColorActionSettings): string {
    if (settings.targetType === "light") {
      return settings.lightName || "Light";
    } else {
      return settings.groupName || "Group";
    }
  }

  /**
   * Get color name from hex value
   */
  private getColorName(hex: string): string {
    const colorNames: Record<string, string> = {
      "#FF0000": "Red",
      "#00FF00": "Green",
      "#0000FF": "Blue",
      "#FFFF00": "Yellow",
      "#FF00FF": "Magenta",
      "#00FFFF": "Cyan",
      "#FFA500": "Orange",
      "#800080": "Purple",
      "#FFFFFF": "White",
      "#000000": "Black",
    };

    return colorNames[hex.toUpperCase()] || hex.toUpperCase();
  }

  /**
   * Get appropriate icon name based on settings and state
   */
  private getIconName(
    settings: ColorActionSettings,
    state: ActionState,
  ): string {
    const baseIcon = settings.targetType === "light" ? "light" : "group";

    if (state.isLoading) {
      return `${baseIcon}-loading`;
    } else if (!state.isConnected) {
      return `${baseIcon}-disconnected`;
    } else {
      return `${baseIcon}-color`;
    }
  }

  /**
   * Create a colored canvas for Stream Deck+ touchscreen
   */
  private createColorCanvas(color: string): string {
    // Create a simple 144x144 canvas with the current color
    // This is a simplified implementation - in a real app you might use a proper canvas library
    const canvas = document.createElement("canvas");
    canvas.width = 144;
    canvas.height = 144;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Fill with the current color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 144, 144);

      // Add a subtle border
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 142, 142);
    }

    return canvas.toDataURL().split(",")[1]; // Return base64 without data URL prefix
  }

  /**
   * Convert hex color to HSL
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        default:
          h = 0;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  /**
   * Convert HSL to hex color
   */
  private hslToHex(hsl: { h: number; s: number; l: number }): string {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<any, ColorActionSettings>,
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
    ev: SendToPluginEvent<any, ColorActionSettings>,
  ): Promise<void> {
    try {
      const globalApiKey = await globalSettingsService.getApiKey();

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "globalApiKey",
        apiKey: globalApiKey || null,
      });

      streamDeck.logger?.info(
        `ColorAction: Sent global API key (exists: ${!!globalApiKey})`,
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
    ev: SendToPluginEvent<any, ColorActionSettings>,
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
        `ColorAction: API test successful, found ${lights.length} lights`,
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
    ev: SendToPluginEvent<any, ColorActionSettings>,
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
        streamDeck.logger?.info("ColorAction: Saved API key globally");

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
    ev: SendToPluginEvent<any, ColorActionSettings>,
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
        supportsColor: light.capabilities?.includes("color") ?? true,
      }));

      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "lightsReceived",
        lights: lightItems,
      });

      streamDeck.logger?.info(
        `ColorAction: Sent ${lightItems.length} lights to property inspector`,
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
    ev: SendToPluginEvent<any, ColorActionSettings>,
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
        `ColorAction: Sent ${groupItems.length} groups to property inspector`,
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
