/**
 * Base settings interface for all Govee Light Management actions
 * Provides common properties for target selection and API configuration
 */

export type TargetType = "light" | "group";

export interface BaseActionSettings {
  // API Configuration
  apiKey?: string;
  
  // Target Selection
  targetType?: TargetType;
  
  // Light-specific settings
  lightId?: string;
  lightModel?: string;
  lightName?: string;
  
  // Group-specific settings
  groupId?: string;
  groupName?: string;
  
  // Common settings
  showStatus?: boolean;
  debugMode?: boolean;
  
  // Index signature to satisfy JsonObject constraint
  [key: string]: unknown;
}

export interface ActionTarget {
  type: TargetType;
  id: string;
  name: string;
  model?: string;
}

export interface ActionState {
  isLoading: boolean;
  isOn?: boolean;
  brightness?: number;
  color?: string;
  temperature?: number;
  errorMessage?: string;
  lastUpdate?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}