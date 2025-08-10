/**
 * Centralized validation service for all Stream Deck actions
 * Provides consistent validation logic across the application
 */

import { GoveeClient } from "@felixgeelhaar/govee-api-client";
import type {
  BaseActionSettings,
  ValidationResult,
  TargetType,
} from "./BaseActionSettings";

export class ActionValidationService {
  /**
   * Validate target selection (light or group)
   */
  static validateTarget(settings: BaseActionSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!settings.targetType) {
      errors.push("No target type selected");
      return { isValid: false, errors, warnings };
    }

    if (settings.targetType === "light") {
      if (!settings.lightId) {
        errors.push("No light device selected");
      }
      if (!settings.lightModel) {
        warnings.push("Light model not specified");
      }
    } else if (settings.targetType === "group") {
      if (!settings.groupId) {
        errors.push("No group selected");
      }
    } else {
      errors.push(`Invalid target type: ${settings.targetType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate brightness settings
   */
  static validateBrightness(
    value: number,
    min: number = 0,
    max: number = 100,
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== "number" || isNaN(value)) {
      errors.push("Brightness must be a number");
    } else if (value < min || value > max) {
      errors.push(`Brightness must be between ${min} and ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate color temperature settings
   */
  static validateColorTemperature(kelvin: number): ValidationResult {
    const errors: string[] = [];
    const MIN_TEMP = 2000;
    const MAX_TEMP = 9000;

    if (typeof kelvin !== "number" || isNaN(kelvin)) {
      errors.push("Color temperature must be a number");
    } else if (kelvin < MIN_TEMP || kelvin > MAX_TEMP) {
      errors.push(
        `Color temperature must be between ${MIN_TEMP}K and ${MAX_TEMP}K`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate color RGB values
   */
  static validateColor(hex: string): ValidationResult {
    const errors: string[] = [];
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;

    if (!hex || typeof hex !== "string") {
      errors.push("Color must be a valid hex string");
    } else if (!hexPattern.test(hex)) {
      errors.push("Color must be in format #RRGGBB");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate step size for incremental adjustments
   */
  static validateStepSize(
    step: number,
    min: number = 1,
    max: number = 50,
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof step !== "number" || isNaN(step)) {
      errors.push("Step size must be a number");
    } else if (step < min || step > max) {
      errors.push(`Step size must be between ${min} and ${max}`);
    } else if (!Number.isInteger(step)) {
      errors.push("Step size must be a whole number");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate API key format (basic check)
   */
  static validateApiKeyFormat(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!apiKey || typeof apiKey !== "string") {
      errors.push("API key is required");
    } else {
      const trimmed = apiKey.trim();
      if (trimmed.length < 10) {
        errors.push("API key appears to be too short");
      }
      if (trimmed !== apiKey) {
        warnings.push("API key contains whitespace");
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
        warnings.push("API key contains unusual characters");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate API key by testing connection to Govee API
   */
  static async validateApiKey(apiKey: string): Promise<ValidationResult> {
    const formatValidation = this.validateApiKeyFormat(apiKey);
    if (!formatValidation.isValid) {
      return formatValidation;
    }

    try {
      const client = new GoveeClient({ apiKey: apiKey.trim() });
      const devices = await client.getDevices();

      if (!devices || !Array.isArray(devices)) {
        return {
          isValid: false,
          errors: ["API returned invalid response"],
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings:
          devices.length === 0 ? ["No devices found on account"] : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        isValid: false,
        errors: [`API validation failed: ${errorMessage}`],
      };
    }
  }

  /**
   * Validate complete action settings
   */
  static validateSettings(settings: BaseActionSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check API key format
    if (settings.apiKey) {
      const apiValidation = this.validateApiKeyFormat(settings.apiKey);
      errors.push(...apiValidation.errors);
      if (apiValidation.warnings) {
        warnings.push(...apiValidation.warnings);
      }
    } else {
      errors.push("API key is required");
    }

    // Check target selection
    const targetValidation = this.validateTarget(settings);
    errors.push(...targetValidation.errors);
    if (targetValidation.warnings) {
      warnings.push(...targetValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate device capabilities for specific operations
   */
  static validateDeviceCapability(
    capabilities: string[],
    requiredCapability: "color" | "colorTem" | "brightness",
  ): ValidationResult {
    const errors: string[] = [];

    if (!capabilities || !Array.isArray(capabilities)) {
      errors.push("Device capabilities not available");
    } else if (!capabilities.includes(requiredCapability)) {
      const capabilityName = {
        color: "color control",
        colorTem: "color temperature",
        brightness: "brightness control",
      }[requiredCapability];

      errors.push(`Device does not support ${capabilityName}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
