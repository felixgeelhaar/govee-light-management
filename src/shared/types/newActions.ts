/**
 * Shared types for the new Elgato-style action architecture
 */

/**
 * Target type for actions - can control single lights or groups
 */
export type TargetType = "light" | "group";

/**
 * Base settings interface for all new actions
 * Extends JsonObject to satisfy Stream Deck SDK constraints
 * Note: API keys are stored in global settings for security (per Elgato best practices)
 */
export interface BaseActionSettings {
  // Target Selection
  targetType: TargetType;

  // Light Target (when targetType === 'light')
  lightId?: string;
  lightModel?: string;
  lightName?: string;

  // Group Target (when targetType === 'group')
  groupId?: string;
  groupName?: string;

  // Index signature for JsonObject compatibility
  [key: string]: any;
}

/**
 * Toggle action specific settings
 */
export interface ToggleActionSettings extends BaseActionSettings {
  // Operation mode for button press
  operation: "toggle" | "on" | "off";
}

/**
 * Brightness action specific settings
 */
export interface BrightnessActionSettings extends BaseActionSettings {
  // Current brightness value (1-100)
  brightness: number;

  // Step size for dial rotation
  stepSize: number;

  // Minimum/maximum brightness values
  minBrightness: number;
  maxBrightness: number;

  // Whether to turn on/off with dial push
  toggleOnPush: boolean;
}

/**
 * Color action specific settings
 */
export interface ColorActionSettings extends BaseActionSettings {
  // Current RGB color (hex format)
  color: string;

  // Color presets for quick access
  colorPresets: string[];

  // Whether to cycle through presets or use color wheel
  usePresets: boolean;

  // Current preset index (when using presets)
  currentPresetIndex: number;
}

/**
 * Color temperature action specific settings
 */
export interface WarmthActionSettings extends BaseActionSettings {
  // Current color temperature in Kelvin (2000-9000)
  colorTemperature: number;

  // Step size for dial rotation (in Kelvin)
  stepSize: number;

  // Temperature range limits
  minTemperature: number;
  maxTemperature: number;

  // Whether to turn on/off with dial push
  toggleOnPush: boolean;
}

/**
 * Action state for Stream Deck display
 */
export interface ActionState {
  isOn: boolean;
  isConnected: boolean;
  isLoading: boolean;
  errorMessage?: string;
}

/**
 * Target information for action execution
 */
export interface ActionTarget {
  type: TargetType;
  id: string;
  name: string;
  model?: string; // Only for lights
}

/**
 * Command payload for action execution
 */
export interface ActionCommand {
  target: ActionTarget;
  action: string;
  parameters: Record<string, any>;
}

/**
 * Stream Deck+ dial interaction types
 */
export type DialInteraction = "push" | "rotate" | "touch" | "longTouch";

/**
 * Trigger descriptions for Stream Deck+ actions
 */
export interface TriggerDescriptions {
  Push?: string;
  Rotate?: string;
  Touch?: string;
  LongTouch?: string;
}

/**
 * Layout feedback data for Stream Deck+ touchscreen
 */
export interface LayoutFeedback {
  title?: string;
  icon?: string;
  value?: string | number;
  indicator?: {
    value: number;
    color?: string;
  };
  "full-canvas"?: string; // Base64 image for full canvas
  canvas?: string; // Base64 image for canvas area
}
