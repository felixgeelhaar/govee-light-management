/**
 * Shared light-related types for the Govee Light Management plugin
 */

/**
 * Represents a light item with its basic properties
 */
export interface LightItem {
  deviceId: string;
  model: string;
  name: string;
  controllable: boolean;
  retrievable: boolean;
  supportedCommands: string[];
  properties?: {
    colorTem?: {
      range: {
        min: number;
        max: number;
      };
    };
  };
}

/**
 * Represents a group of lights
 */
export interface LightGroup {
  id: string;
  name: string;
  lights: LightItem[];
  lightIds?: string[]; // For backward compatibility
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Light state information
 */
export interface LightState {
  deviceId: string;
  model: string;
  name: string;
  isOnline: boolean;
  powerState?: boolean;
  brightness?: number;
  color?: {
    r: number;
    g: number;
    b: number;
  };
  colorTemperature?: number;
}