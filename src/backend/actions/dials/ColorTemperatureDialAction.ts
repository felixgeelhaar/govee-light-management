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
import { Light } from "../../domain/entities/Light";
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";

type ColorTemperatureDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  minTemperature?: number;
  maxTemperature?: number;
  stepSize?: number;
  presets?: number[];
};

// Common color temperature presets
const DEFAULT_PRESETS = [
  2000, // Candlelight
  2700, // Warm White
  3000, // Soft White
  4000, // Cool White
  5000, // Daylight
  6500, // Cool Daylight
  9000, // Blue Sky
];

/**
 * Stream Deck Plus dial action for controlling color temperature
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.temperature-dial" })
export class ColorTemperatureDialAction extends SingletonAction<ColorTemperatureDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentTemperature: number = 4000;
  private presetIndex: number = 0;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ColorTemperatureDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (settings.apiKey) {
      this.initializeServices(settings.apiKey);
      await this.loadSelectedLight(settings);
    }

    // Set initial feedback
    await this.updateFeedback(ev.action);
  }

  /**
   * Handle dial rotation for temperature adjustment
   */
  override async onDialRotate(
    ev: DialRotateEvent<ColorTemperatureDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const { ticks, pressed } = ev.payload;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    // Calculate temperature change
    const stepSize = settings.stepSize || 100;
    const delta = ticks * stepSize * (pressed ? 2 : 1); // Double speed when pressed
    
    // Update temperature
    const minTemp = settings.minTemperature || 2000;
    const maxTemp = settings.maxTemperature || 9000;
    this.currentTemperature = Math.max(
      minTemp,
      Math.min(maxTemp, this.currentTemperature + delta),
    );

    try {
      // Apply color temperature to light
      const colorTemp = new ColorTemperature(this.currentTemperature);
      await this.lightControlService.setColorTemperature(this.currentLight, colorTemp);

      // Update feedback display
      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to set color temperature:", error);
    }
  }

  /**
   * Handle dial press to cycle through presets
   */
  override async onDialDown(
    ev: DialDownEvent<ColorTemperatureDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    try {
      // Get presets
      const presets = settings.presets || DEFAULT_PRESETS;
      
      // Cycle to next preset
      this.presetIndex = (this.presetIndex + 1) % presets.length;
      this.currentTemperature = presets[this.presetIndex];

      // Apply preset temperature
      const colorTemp = new ColorTemperature(this.currentTemperature);
      await this.lightControlService.setColorTemperature(this.currentLight, colorTemp);

      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to apply preset:", error);
    }
  }

  /**
   * Handle touch tap to show preset menu
   */
  override async onTouchTap(
    ev: TouchTapEvent<ColorTemperatureDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    // Send preset options to property inspector
    await ev.action.sendToPropertyInspector({
      event: "showPresets",
      presets: (settings.presets || DEFAULT_PRESETS).map((temp) => ({
        value: temp,
        label: this.getTemperatureLabel(temp),
        current: temp === this.currentTemperature,
      })),
    });
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<ColorTemperatureDialSettings, JsonValue>,
  ): Promise<void> {
    const { payload, action } = ev;

    if (payload.event === "getDevices" && this.lightRepository) {
      try {
        const lights = await this.lightRepository.getAllLights();
        await action.sendToPropertyInspector({
          event: "devicesReceived",
          devices: lights.map((light) => ({
            deviceId: light.id,
            model: light.model,
            name: light.name,
            isOnline: light.isOnline,
            supportsColorTemp: light.capabilities?.colorTemperature || false,
          })),
        });
      } catch (error) {
        await action.sendToPropertyInspector({
          event: "devicesReceived",
          error: error instanceof Error ? error.message : "Unknown error",
          devices: [],
        });
      }
    } else if (payload.event === "selectPreset" && typeof payload.temperature === "number") {
      // Apply selected preset
      this.currentTemperature = payload.temperature;
      
      if (this.currentLight && this.lightControlService) {
        try {
          const colorTemp = new ColorTemperature(this.currentTemperature);
          await this.lightControlService.setColorTemperature(this.currentLight, colorTemp);
          await this.updateFeedback(action);
        } catch (error) {
          await action.showAlert();
        }
      }
    }
  }

  /**
   * Initialize Govee services
   */
  private initializeServices(apiKey: string): void {
    this.lightRepository = new GoveeLightRepository(apiKey);
    this.lightControlService = new LightControlService(this.lightRepository);
  }

  /**
   * Load selected light from settings
   */
  private async loadSelectedLight(
    settings: ColorTemperatureDialSettings,
  ): Promise<void> {
    if (!settings.selectedDeviceId || !this.lightRepository) {
      return;
    }

    try {
      const lights = await this.lightRepository.getAllLights();
      this.currentLight = lights.find(
        (light) => light.id === settings.selectedDeviceId,
      );

      if (this.currentLight && this.currentLight.colorTemperature) {
        // Get current temperature
        this.currentTemperature = this.currentLight.colorTemperature.kelvin;
      }
    } catch (error) {
      console.error("Failed to load selected light:", error);
    }
  }

  /**
   * Get human-readable label for temperature
   */
  private getTemperatureLabel(kelvin: number): string {
    if (kelvin <= 2000) return "Candlelight";
    if (kelvin <= 2700) return "Warm White";
    if (kelvin <= 3000) return "Soft White";
    if (kelvin <= 4000) return "Cool White";
    if (kelvin <= 5000) return "Daylight";
    if (kelvin <= 6500) return "Cool Daylight";
    return "Blue Sky";
  }

  /**
   * Update dial feedback display
   */
  private async updateFeedback(action: any): Promise<void> {
    const lightName = this.currentLight?.name || "No Light Selected";
    const isOn = this.currentLight?.isOn || false;
    const isOnline = this.currentLight?.isOnline || false;

    // Calculate position on warm-cool scale (0-100)
    const minTemp = 2000;
    const maxTemp = 9000;
    const position = ((this.currentTemperature - minTemp) / (maxTemp - minTemp)) * 100;

    await action.setFeedback({
      title: lightName,
      value: `${this.currentTemperature}K`,
      indicator: {
        value: position,
        enabled: isOn && isOnline,
      },
      icon: this.getTemperatureIcon(this.currentTemperature),
    });

    // Update title with temperature label
    await action.setTitle(this.getTemperatureLabel(this.currentTemperature));
  }

  /**
   * Get icon based on temperature
   */
  private getTemperatureIcon(kelvin: number): string {
    if (kelvin <= 3000) return "imgs/actions/temperature-dial/warm";
    if (kelvin <= 5000) return "imgs/actions/temperature-dial/neutral";
    return "imgs/actions/temperature-dial/cool";
  }
}