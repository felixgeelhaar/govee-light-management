import {
  ColorRgb,
  ColorTemperature,
  Brightness,
} from "@felixgeelhaar/govee-api-client";
import { LightState } from "../value-objects/LightState";

/**
 * Capabilities supported by a Govee light device
 */
export interface LightCapabilities {
  // Basic control
  brightness: boolean;
  color: boolean;
  colorTemperature: boolean;

  // Advanced features (v1.1.0+)
  scenes: boolean; // Dynamic scene support (Sunrise, Sunset, Rainbow, etc.)
  segmentedColor: boolean; // RGB IC lights with per-segment control
  musicMode: boolean; // Music-reactive lighting
  nightlight: boolean; // Nightlight mode toggle
  gradient: boolean; // Gradient effect toggle
}

export class Light {
  private constructor(
    private readonly _deviceId: string,
    private readonly _model: string,
    private readonly _name: string,
    private _state: LightState,
    private readonly _capabilities: LightCapabilities = {
      // Basic capabilities (most lights support these)
      brightness: true,
      color: true,
      colorTemperature: true,
      // Advanced capabilities (default to false, detected from API)
      scenes: false,
      segmentedColor: false,
      musicMode: false,
      nightlight: false,
      gradient: false,
    },
  ) {}

  static create(
    deviceId: string,
    model: string,
    name: string,
    initialState: LightState,
    capabilities?: LightCapabilities,
  ): Light {
    if (!deviceId?.trim()) {
      throw new Error("Device ID is required");
    }
    if (!model?.trim()) {
      throw new Error("Model is required");
    }
    if (!name?.trim()) {
      throw new Error("Name is required");
    }

    return new Light(deviceId, model, name, initialState, capabilities);
  }

  get deviceId(): string {
    return this._deviceId;
  }

  get model(): string {
    return this._model;
  }

  get name(): string {
    return this._name;
  }

  get state(): LightState {
    return { ...this._state };
  }

  get isOnline(): boolean {
    return this._state.isOnline;
  }

  get isOn(): boolean {
    return this._state.isOn;
  }

  get brightness(): Brightness | undefined {
    return this._state.brightness;
  }

  get color(): ColorRgb | undefined {
    return this._state.color;
  }

  get colorTemperature(): ColorTemperature | undefined {
    return this._state.colorTemperature;
  }

  get capabilities(): LightCapabilities {
    return { ...this._capabilities };
  }

  updateState(newState: Partial<LightState>): void {
    this._state = {
      ...this._state,
      ...newState,
    };
  }

  canBeControlled(): boolean {
    return this._state.isOnline;
  }

  /**
   * Advanced capability checks (v1.1.0+)
   */
  supportsScenes(): boolean {
    return this._capabilities.scenes;
  }

  supportsSegmentedColor(): boolean {
    return this._capabilities.segmentedColor;
  }

  supportsMusicMode(): boolean {
    return this._capabilities.musicMode;
  }

  supportsNightlight(): boolean {
    return this._capabilities.nightlight;
  }

  supportsGradient(): boolean {
    return this._capabilities.gradient;
  }

  equals(other: Light): boolean {
    return this._deviceId === other._deviceId && this._model === other._model;
  }

  toString(): string {
    return `Light(${this._deviceId}, ${this._name}, online=${this._state.isOnline}, on=${this._state.isOn})`;
  }
}
