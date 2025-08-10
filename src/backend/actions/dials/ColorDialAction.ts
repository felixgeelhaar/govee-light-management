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
import { ColorRgb } from "@felixgeelhaar/govee-api-client";

type ColorDialSettings = {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  stepSize?: number;
  event?: string;
  color?: { h: number; s: number; b: number };
};

type ColorMode = "hue" | "saturation" | "brightness";

interface HSB {
  hue: number; // 0-360
  saturation: number; // 0-100
  brightness: number; // 0-100
}

/**
 * Stream Deck Plus dial action for RGB color control
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.color-dial" })
export class ColorDialAction extends SingletonAction<ColorDialSettings> {
  private lightRepository?: GoveeLightRepository;
  private lightControlService?: LightControlService;
  private currentLight?: Light;
  private currentHSB: HSB = { hue: 0, saturation: 100, brightness: 100 };
  private colorMode: ColorMode = "hue";

  // Allow dependency injection for testing
  constructor(
    lightRepository?: GoveeLightRepository,
    lightControlService?: LightControlService
  ) {
    super();
    this.lightRepository = lightRepository;
    this.lightControlService = lightControlService;
  }

  /**
   * Initialize services when action appears
   */
  override async onWillAppear(
    ev: WillAppearEvent<ColorDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    // Initialize services if not already injected (for production use)
    if (settings.apiKey && !this.lightRepository) {
      this.initializeServices(settings.apiKey);
    }
    
    // Load selected light if we have repository (whether from injection or initialization)
    if (this.lightRepository && settings.selectedDeviceId) {
      await this.loadSelectedLight(settings);
    }

    // Set initial feedback
    await this.updateFeedback(ev.action);
  }

  /**
   * Handle dial rotation for color adjustment
   */
  override async onDialRotate(
    ev: DialRotateEvent<ColorDialSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;
    const { ticks, pressed } = ev.payload;

    if (!this.currentLight || !this.lightControlService) {
      return;
    }

    // Calculate change based on current mode
    const stepSize = settings.stepSize || 5;
    const delta = ticks * stepSize * (pressed ? 2 : 1);

    switch (this.colorMode) {
      case "hue":
        this.currentHSB.hue = (this.currentHSB.hue + delta + 360) % 360;
        break;
      case "saturation":
        this.currentHSB.saturation = Math.max(
          0,
          Math.min(100, this.currentHSB.saturation + delta),
        );
        break;
      case "brightness":
        this.currentHSB.brightness = Math.max(
          0,
          Math.min(100, this.currentHSB.brightness + delta),
        );
        break;
    }

    try {
      // Convert HSB to RGB and apply
      const rgb = this.hsbToRgb(this.currentHSB);
      const color = new ColorRgb(rgb.r, rgb.g, rgb.b);
      await this.lightControlService.setColor(this.currentLight, color);

      // Update feedback display
      await this.updateFeedback(ev.action);
    } catch (error) {
      await ev.action.showAlert();
      console.error("Failed to set color:", error);
    }
  }

  /**
   * Handle dial press to switch color mode
   */
  override async onDialDown(
    ev: DialDownEvent<ColorDialSettings>,
  ): Promise<void> {
    // Cycle through color modes
    const modes: ColorMode[] = ["hue", "saturation", "brightness"];
    const currentIndex = modes.indexOf(this.colorMode);
    this.colorMode = modes[(currentIndex + 1) % modes.length];

    await this.updateFeedback(ev.action);

    // Show mode change notification
    await ev.action.setTitle(`Mode: ${this.colorMode.toUpperCase()}`);
    setTimeout(() => this.updateFeedback(ev.action), 1500);
  }

  /**
   * Handle long touch tap to reset to white
   */
  override async onTouchTap(
    ev: TouchTapEvent<ColorDialSettings>,
  ): Promise<void> {
    const { hold } = ev.payload;

    if (hold && this.currentLight && this.lightControlService) {
      // Long press - reset to white
      this.currentHSB = { hue: 0, saturation: 0, brightness: 100 };

      try {
        const color = new ColorRgb(255, 255, 255);
        await this.lightControlService.setColor(this.currentLight, color);
        await this.updateFeedback(ev.action);
      } catch (error) {
        await ev.action.showAlert();
        console.error("Failed to reset color:", error);
      }
    }
  }

  /**
   * Handle messages from property inspector
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorDialSettings>,
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
            supportsColor: true, // Assume color support
          })),
        });
      } catch (error) {
        await (action as any).sendToPropertyInspector({
          event: "devicesReceived",
          error: error instanceof Error ? error.message : "Unknown error",
          devices: [],
        });
      }
    } else if (data.event === "setColor" && data.color) {
      // Apply color from color picker in property inspector
      const colorData = data.color as any;
      const { r, g, b } = colorData as { r: number; g: number; b: number };
      this.currentHSB = this.rgbToHsb({ r, g, b });

      if (this.currentLight && this.lightControlService) {
        try {
          const color = new ColorRgb(r, g, b);
          await this.lightControlService.setColor(this.currentLight, color);
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
  private async loadSelectedLight(settings: ColorDialSettings): Promise<void> {
    if (!settings.selectedDeviceId || !this.lightRepository) {
      return;
    }

    try {
      const lights = await this.lightRepository.getAllLights();
      this.currentLight = lights.find(
        (light) => light.deviceId === settings.selectedDeviceId,
      );

      if (this.currentLight && this.currentLight.color) {
        // Get current color and convert to HSB
        const { r, g, b } = this.currentLight.color;
        this.currentHSB = this.rgbToHsb({ r, g, b });
      }
    } catch (error) {
      console.error("Failed to load selected light:", error);
    }
  }

  /**
   * Convert HSB to RGB using a simpler, more reliable algorithm
   */
  private hsbToRgb(hsb: HSB): { r: number; g: number; b: number } {
    const h = hsb.hue;
    const s = hsb.saturation / 100;
    const v = hsb.brightness / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (300 <= h && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  /**
   * Convert RGB to HSB
   */
  private rgbToHsb(rgb: { r: number; g: number; b: number }): HSB {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    const v = max;

    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
      } else {
        h = ((r - g) / delta + 4) / 6;
      }
    }

    return {
      hue: Math.round(h * 360),
      saturation: Math.round(s * 100),
      brightness: Math.round(v * 100),
    };
  }

  /**
   * Update dial feedback display
   */
  private async updateFeedback(action: any): Promise<void> {
    const lightName = this.currentLight?.name || "No Light Selected";
    const isOn = this.currentLight?.isOn || false;
    const isOnline = this.currentLight?.isOnline || false;

    // Get current value based on mode
    let value: string;
    let indicatorValue: number;

    switch (this.colorMode) {
      case "hue":
        value = `${Math.round(this.currentHSB.hue)}°`;
        indicatorValue = (this.currentHSB.hue / 360) * 100;
        break;
      case "saturation":
        value = `${Math.round(this.currentHSB.saturation)}%`;
        indicatorValue = this.currentHSB.saturation;
        break;
      case "brightness":
        value = `${Math.round(this.currentHSB.brightness)}%`;
        indicatorValue = this.currentHSB.brightness;
        break;
    }

    // Get current RGB color
    const rgb = this.hsbToRgb(this.currentHSB);

    await action.setFeedback({
      title: lightName,
      value: value,
      indicator: {
        value: indicatorValue,
        enabled: isOn && isOnline,
        color: `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`,
      },
    });

    // Set title to show current mode
    await action.setTitle(
      `${this.colorMode.charAt(0).toUpperCase()}${this.colorMode.slice(1)}`,
    );
  }
}
