import { Light } from "../entities/Light";
import {
  ColorRgb,
  ColorTemperature,
  Brightness,
} from "@felixgeelhaar/govee-api-client";
import { Scene } from "../value-objects/Scene";
import { SegmentColor } from "../value-objects/SegmentColor";
import { MusicModeConfig } from "../value-objects/MusicModeConfig";

export interface ILightRepository {
  /**
   * Get all available lights from the Govee API
   */
  getAllLights(): Promise<Light[]>;

  /**
   * Find a light by its device ID and model
   */
  findLight(deviceId: string, model: string): Promise<Light | null>;

  /**
   * Find lights by name (case-insensitive search)
   */
  findLightsByName(name: string): Promise<Light[]>;

  /**
   * Turn a light on or off
   */
  setPower(light: Light, isOn: boolean): Promise<void>;

  /**
   * Set brightness of a light
   */
  setBrightness(light: Light, brightness: Brightness): Promise<void>;

  /**
   * Set color of a light
   */
  setColor(light: Light, color: ColorRgb): Promise<void>;

  /**
   * Set color temperature of a light
   */
  setColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
  ): Promise<void>;

  /**
   * Turn on light with specific brightness
   */
  turnOnWithBrightness(light: Light, brightness: Brightness): Promise<void>;

  /**
   * Turn on light with specific color
   */
  turnOnWithColor(
    light: Light,
    color: ColorRgb,
    brightness?: Brightness,
  ): Promise<void>;

  /**
   * Turn on light with specific color temperature
   */
  turnOnWithColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
    brightness?: Brightness,
  ): Promise<void>;

  /**
   * Get current state of a light
   */
  getLightState(light: Light): Promise<void>;

  /**
   * Apply a scene to a light (dynamic, preset, or custom)
   */
  applyScene(light: Light, scene: Scene): Promise<void>;

  /**
   * Set colors for individual segments on RGB IC lights
   */
  setSegmentColors(light: Light, segments: SegmentColor[]): Promise<void>;

  /**
   * Configure music mode for a light
   */
  setMusicMode(light: Light, config: MusicModeConfig): Promise<void>;

  /**
   * Toggle nightlight mode
   */
  toggleNightlight(light: Light, enabled: boolean): Promise<void>;

  /**
   * Toggle gradient effect
   */
  toggleGradient(light: Light, enabled: boolean): Promise<void>;
}
