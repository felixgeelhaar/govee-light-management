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

/**
 * Settings for scene control actions
 */
export interface SceneControlSettings extends BaseActionSettings {
  /** Selected device ID from Govee API */
  selectedDeviceId?: string;
  /** Selected device model */
  selectedModel?: string;
  /** Human-readable light name for display */
  selectedLightName?: string;
  /** Selected scene ID */
  selectedSceneId?: string;
  /** Human-readable scene name for display */
  selectedSceneName?: string;
}

/**
 * Settings for music mode actions
 */
export interface MusicModeSettings extends BaseActionSettings {
  /** Selected device ID from Govee API */
  selectedDeviceId?: string;
  /** Selected device model */
  selectedModel?: string;
  /** Human-readable light name for display */
  selectedLightName?: string;
  /** Selected music mode */
  musicMode?: string;
  /** Sensitivity level (0-100) */
  sensitivity?: number;
  /** Auto color mode enabled */
  autoColor?: boolean;
}

/**
 * Settings for segment color dial actions
 */
export interface SegmentColorDialSettings extends BaseActionSettings {
  /** Selected device ID from Govee API */
  selectedDeviceId?: string;
  /** Selected device model */
  selectedModel?: string;
  /** Human-readable light name for display */
  selectedLightName?: string;
  /** Segment index (0-14) */
  segmentIndex?: number;
  /** Hue value (0-360) */
  hue?: number;
  /** Saturation percentage (0-100) */
  saturation?: number;
  /** Brightness percentage (0-100) */
  brightness?: number;
  /** Dial step size (1-90) */
  stepSize?: number;
}
