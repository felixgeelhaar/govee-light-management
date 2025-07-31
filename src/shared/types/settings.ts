/**
 * Shared type definitions for Stream Deck settings
 * These types are used by both the backend plugin and frontend Property Inspector
 */

/**
 * Control modes available for both individual lights and groups
 */
export type ControlMode =
  | "toggle"
  | "on"
  | "off"
  | "brightness"
  | "color"
  | "colorTemp";

/**
 * Base settings shared by all action types
 */
export interface BaseActionSettings {
  /** Govee API key for authentication */
  apiKey?: string;
  /** Control mode for the action */
  controlMode?: ControlMode;
  /** Brightness value (1-100) */
  brightnessValue?: number;
  /** Color value as hex string (e.g., "#FF0000") */
  colorValue?: string;
  /** Color temperature in Kelvin (2000-9000) */
  colorTempValue?: number;
}

/**
 * Settings for individual light control actions
 */
export interface LightControlSettings extends BaseActionSettings {
  /** Selected device ID from Govee API */
  selectedDeviceId?: string;
  /** Selected device model */
  selectedModel?: string;
  /** Human-readable light name for display */
  selectedLightName?: string;
}

/**
 * Settings for group control actions
 */
export interface GroupControlSettings extends BaseActionSettings {
  /** Unique identifier for the selected group */
  selectedGroupId?: string;
  /** Human-readable group name for display */
  selectedGroupName?: string;
}
