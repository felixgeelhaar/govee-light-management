import {
  action,
  DialDownEvent,
  DialRotateEvent,
  DialUpEvent,
  TouchTapEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  type JsonValue,
} from "@elgato/streamdeck";
import { GoveeLightRepository } from "../../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../../domain/services/LightControlService";
import { Light } from "../../domain/entities/Light";
import { Brightness } from "@felixgeelhaar/govee-api-client";

type BrightnessDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  minBrightness?: number;
  maxBrightness?: number;
  stepSize?: number;
};

/**
 * Stream Deck Plus dial action for controlling light brightness
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness-dial" })
export class BrightnessDialAction extends SingletonAction<BrightnessDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentBrightness: number = 50;
  private isPressed: boolean = false;

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<BrightnessDialSettings>,
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
   * Handle dial rotation for brightness adjustment
   */
  override async onDialRotate(
    ev: DialRotateEvent<BrightnessDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const { ticks, pressed } = ev.payload;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    // Calculate brightness change
    const stepSize = settings.stepSize || 5;
    const delta = ticks * stepSize * (pressed ? 2 : 1); // Double speed when pressed
    
    // Update brightness
    this.currentBrightness = Math.max(
      settings.minBrightness || 0,
      Math.min(settings.maxBrightness || 100, this.currentBrightness + delta),
    );

    try {
      // Apply brightness to light
      const brightness = new Brightness(this.currentBrightness);
      await this.lightControlService.setBrightness(this.currentLight, brightness);

      // Update feedback display
      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to set brightness:", error);
    }
  }

  /**
   * Handle dial press to toggle light
   */
  override async onDialDown(
    ev: DialDownEvent<BrightnessDialSettings>,
  ): Promise<void> {
    this.isPressed = true;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    try {
      // Toggle light on/off
      await this.lightControlService.toggle(this.currentLight);
      
      // If turning on, restore previous brightness
      if (!this.currentLight.isOn) {
        this.currentBrightness = 50; // Default when turning on
      }

      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to toggle light:", error);
    }
  }

  /**
   * Handle dial release
   */
  override async onDialUp(
    ev: DialUpEvent<BrightnessDialSettings>,
  ): Promise<void> {
    this.isPressed = false;
  }

  /**
   * Handle touch tap for reset
   */
  override async onTouchTap(
    ev: TouchTapEvent<BrightnessDialSettings>,
  ): Promise<void> {
    const { hold } = ev.payload;

    if (hold && this.currentLight && this.lightControlService) {
      // Long press - reset to 50%
      this.currentBrightness = 50;
      
      try {
        const brightness = new Brightness(50);
        await this.lightControlService.setBrightness(this.currentLight, brightness);
        await this.updateFeedback(ev.action);
      } catch (error) {
        await ev.action.showAlert();
        console.error("Failed to reset brightness:", error);
      }
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<BrightnessDialSettings, JsonValue>,
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
    settings: BrightnessDialSettings,
  ): Promise<void> {
    if (!settings.selectedDeviceId || !this.lightRepository) {
      return;
    }

    try {
      const lights = await this.lightRepository.getAllLights();
      this.currentLight = lights.find(
        (light) => light.id === settings.selectedDeviceId,
      );

      if (this.currentLight) {
        // Get current brightness
        this.currentBrightness = this.currentLight.brightness?.value || 50;
      }
    } catch (error) {
      console.error("Failed to load selected light:", error);
    }
  }

  /**
   * Update dial feedback display
   */
  private async updateFeedback(action: any): Promise<void> {
    const lightName = this.currentLight?.name || "No Light Selected";
    const isOn = this.currentLight?.isOn || false;
    const isOnline = this.currentLight?.isOnline || false;

    await action.setFeedback({
      title: lightName,
      value: `${Math.round(this.currentBrightness)}%`,
      indicator: {
        value: this.currentBrightness,
        enabled: isOn && isOnline,
      },
    });

    // Update image based on state
    await action.setImage(
      isOn
        ? "imgs/actions/brightness-dial/on"
        : "imgs/actions/brightness-dial/off",
    );
  }
}