import {
  action,
  DialDownEvent,
  DialRotateEvent,
  TouchTapEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  type JsonValue,
} from "@elgato/streamdeck";
import { GoveeLightRepository } from "../../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../../domain/services/LightControlService";
import { GroupManagementService } from "../../domain/services/GroupManagementService";
import { LightGroup } from "../../domain/entities/LightGroup";
import { Light } from "../../domain/entities/Light";
import { Brightness } from "@felixgeelhaar/govee-api-client";

type GroupDialSettings = {
  apiKey?: string;
  groupName?: string;
  selectedLightIds?: string[];
  controlMode?: "brightness" | "color" | "temperature";
  stepSize?: number;
  syncDelay?: number;
  event?: string;
  presetId?: string;
  settings?: any;
};

interface GroupPreset {
  name: string;
  brightness?: number;
  color?: { r: number; g: number; b: number };
  temperature?: number;
}

const DEFAULT_PRESETS: GroupPreset[] = [
  { name: "Movie Night", brightness: 20, color: { r: 128, g: 0, b: 255 } },
  { name: "Reading", brightness: 80, temperature: 4000 },
  { name: "Party", brightness: 100, color: { r: 255, g: 0, b: 128 } },
  { name: "Relax", brightness: 40, temperature: 2700 },
];

/**
 * Stream Deck Plus dial action for group control
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.group-dial" })
export class GroupDialAction extends SingletonAction<GroupDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private groupManagementService?: GroupManagementService;
  private currentGroup?: LightGroup;
  private groupBrightness: number = 50;
  private activePreset: number = -1;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<GroupDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (settings.apiKey && !this.lightRepository) {
      this.initializeServices(settings.apiKey);
    }
    
    if (settings.apiKey && this.lightRepository) {
      await this.loadGroup(settings);
    }

    // Set initial feedback
    await this.updateFeedback(ev.action);
  }

  /**
   * Handle dial rotation for group brightness control
   */
  override async onDialRotate(
    ev: DialRotateEvent<GroupDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const { ticks, pressed } = ev.payload;

    if (!this.currentGroup || !this.lightControlService) {
      return;
    }

    // Calculate brightness change
    const stepSize = settings.stepSize || 5;
    const delta = ticks * stepSize * (pressed ? 2 : 1);

    // Update brightness
    this.groupBrightness = Math.max(
      0,
      Math.min(100, this.groupBrightness + delta),
    );

    try {
      // Apply brightness to all lights in group with delay
      const brightness = new Brightness(this.groupBrightness);
      const delay = settings.syncDelay || 50;

      for (const light of this.currentGroup.lights) {
        await this.lightControlService.setBrightness(light, brightness);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Update feedback display
      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to set group brightness:", error);
    }
  }

  /**
   * Handle dial press to toggle entire group
   */
  override async onDialDown(
    ev: DialDownEvent<GroupDialSettings>,
  ): Promise<void> {
    if (!this.currentGroup || !this.groupManagementService) {
      return;
    }

    try {
      // Toggle all lights in group
      await this.groupManagementService.toggleGroup(this.currentGroup);

      // Update group state
      await this.loadGroup(ev.payload.settings);
      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to toggle group:", error);
    }
  }

  /**
   * Handle touch tap for preset selection
   */
  override async onTouchTap(
    ev: TouchTapEvent<GroupDialSettings>,
  ): Promise<void> {
    const { hold } = ev.payload;

    if (!hold) {
      // Short tap - show preset menu
      await (ev.action as any).sendToPropertyInspector({
        event: "showPresets",
        presets: DEFAULT_PRESETS.map((preset, index) => ({
          ...preset,
          id: index,
          active: index === this.activePreset,
        })),
      });
    } else {
      // Long tap - reset to default
      if (this.currentGroup && this.groupManagementService) {
        try {
          this.groupBrightness = 50;
          const brightness = new Brightness(50);

          for (const light of this.currentGroup.lights) {
            await this.lightControlService!.setBrightness(light, brightness);
          }

          this.activePreset = -1;
          await this.updateFeedback(ev.action);
        } catch (error) {
          await ev.action.showAlert();
        }
      }
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, GroupDialSettings>,
  ): Promise<void> {
    const { payload, action } = ev;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return;
    }

    const data = payload as any;

    if (data.event === "getDevices" && this.lightRepository) {
      try {
        const lights = await this.lightRepository.getAllLights();
        await (action as any).sendToPropertyInspector({
          event: "devicesReceived",
          devices: lights.map((light) => ({
            deviceId: light.deviceId,
            model: light.model,
            name: light.name,
            isOnline: light.isOnline,
          })),
        });
      } catch (error) {
        await (action as any).sendToPropertyInspector({
          event: "devicesReceived",
          error: error instanceof Error ? error.message : "Unknown error",
          devices: [],
        });
      }
    } else if (
      data.event === "applyPreset" &&
      typeof data.presetId === "number"
    ) {
      // Apply selected preset
      const preset = DEFAULT_PRESETS[data.presetId];
      if (preset && this.currentGroup && this.groupManagementService) {
        try {
          await this.applyPreset(preset);
          this.activePreset = data.presetId;
          await this.updateFeedback(action);
        } catch (error) {
          await action.showAlert();
        }
      }
    } else if (data.event === "updateGroup") {
      // Update group configuration
      await this.loadGroup((action as any).settings);
      await this.updateFeedback(action);
    }
  }

  /**
   * Initialize Govee services
   */
  private initializeServices(apiKey: string): void {
    this.lightRepository = new GoveeLightRepository(apiKey);
    this.lightControlService = new LightControlService(this.lightRepository);
    this.groupManagementService = new GroupManagementService(
      this.lightRepository,
      this.lightControlService,
    );
  }

  /**
   * Load group from settings
   */
  private async loadGroup(settings: GroupDialSettings): Promise<void> {
    if (!settings.selectedLightIds || !this.lightRepository) {
      return;
    }

    try {
      const allLights = await this.lightRepository.getAllLights();
      const groupLights = allLights.filter((light) =>
        settings.selectedLightIds!.includes(light.deviceId),
      );

      if (groupLights.length > 0) {
        this.currentGroup = LightGroup.create(
          `group-${Date.now()}`, // Generate unique ID
          settings.groupName || "My Group",
          groupLights,
        );

        // Calculate average brightness
        const brightnesses = groupLights
          .filter((light) => light.brightness)
          .map((light) => light.brightness!.level);

        if (brightnesses.length > 0) {
          this.groupBrightness = Math.round(
            brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length,
          );
        }
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    }
  }

  /**
   * Apply preset to group
   */
  private async applyPreset(preset: GroupPreset): Promise<void> {
    if (!this.currentGroup || !this.lightControlService) {
      return;
    }

    for (const light of this.currentGroup.lights) {
      if (preset.brightness !== undefined) {
        const brightness = new Brightness(preset.brightness);
        await this.lightControlService.setBrightness(light, brightness);
      }

      if (preset.color) {
        const { ColorRgb } = await import("@felixgeelhaar/govee-api-client");
        const color = new ColorRgb(
          preset.color.r,
          preset.color.g,
          preset.color.b,
        );
        await this.lightControlService.setColor(light, color);
      }

      if (preset.temperature) {
        const { ColorTemperature } = await import(
          "@felixgeelhaar/govee-api-client"
        );
        const temp = new ColorTemperature(preset.temperature);
        await this.lightControlService.setColorTemperature(light, temp);
      }
    }

    if (preset.brightness !== undefined) {
      this.groupBrightness = preset.brightness;
    }
  }

  /**
   * Update dial feedback display
   */
  private async updateFeedback(action: any): Promise<void> {
    const groupName = this.currentGroup?.name || "No Group";
    const lightCount = this.currentGroup?.lights.length || 0;
    const onlineCount =
      this.currentGroup?.lights.filter((l) => l.isOnline).length || 0;
    const onCount = this.currentGroup?.lights.filter((l) => l.isOn).length || 0;

    await action.setFeedback({
      title: groupName,
      value: `${Math.round(this.groupBrightness)}%`,
      indicator: {
        value: this.groupBrightness,
        enabled: onCount > 0,
      },
      icon:
        onCount === 0
          ? "imgs/actions/group-dial/off"
          : "imgs/actions/group-dial/on",
    });

    // Update title with group status
    await action.setTitle(`${onCount}/${lightCount} On`);
  }
}
