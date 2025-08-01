import streamDeck from "@elgato/streamdeck";
import { ApiValidationError } from "../validation/ApiResponseValidator";

/**
 * Comprehensive error boundary system for the Govee Light Management plugin
 */

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  API_ERROR = "api_error",
  VALIDATION_ERROR = "validation_error",
  NETWORK_ERROR = "network_error",
  DEVICE_ERROR = "device_error",
  CONFIGURATION_ERROR = "configuration_error",
  INTERNAL_ERROR = "internal_error",
}

export interface ErrorContext {
  userId?: string;
  deviceId?: string;
  action?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class PluginError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly context: ErrorContext,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "PluginError";
  }

  /**
   * Get user-friendly message for display in Stream Deck
   */
  getUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.API_ERROR:
        return "Unable to communicate with Govee service. Please check your API key and internet connection.";
      case ErrorCategory.VALIDATION_ERROR:
        return "Invalid data received. Please try refreshing or contact support.";
      case ErrorCategory.NETWORK_ERROR:
        return "Network connection issue. Please check your internet connection and try again.";
      case ErrorCategory.DEVICE_ERROR:
        return "Device is not responding. Please check if the device is online and try again.";
      case ErrorCategory.CONFIGURATION_ERROR:
        return "Configuration error. Please check your settings and try again.";
      case ErrorCategory.INTERNAL_ERROR:
        return "An unexpected error occurred. Please try again or restart the plugin.";
      default:
        return "An error occurred. Please try again.";
    }
  }

  /**
   * Get recovery suggestions for the user
   */
  getRecoverySuggestions(): string[] {
    switch (this.category) {
      case ErrorCategory.API_ERROR:
        return [
          "Verify your Govee API key is correct",
          "Check your internet connection",
          "Try again in a few moments",
        ];
      case ErrorCategory.NETWORK_ERROR:
        return [
          "Check your internet connection",
          "Ensure firewall is not blocking the connection",
          "Try again later",
        ];
      case ErrorCategory.DEVICE_ERROR:
        return [
          "Check if the device is powered on",
          "Ensure the device is connected to WiFi",
          "Try controlling the device through the Govee app first",
        ];
      case ErrorCategory.CONFIGURATION_ERROR:
        return [
          "Review your plugin settings",
          "Re-enter your API key",
          "Reconfigure the affected lights or groups",
        ];
      default:
        return [
          "Try the action again",
          "Restart the Stream Deck software",
          "Contact support if the issue persists",
        ];
    }
  }
}

/**
 * Error boundary utilities for different parts of the application
 */
export class ErrorBoundaries {
  /**
   * Wrap API calls with comprehensive error handling
   */
  static async wrapApiCall<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    operationName: string,
  ): Promise<T> {
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      action: operationName,
    };

    try {
      streamDeck.logger.debug(`Starting API operation: ${operationName}`);
      const result = await operation();
      streamDeck.logger.debug(
        `API operation completed successfully: ${operationName}`,
      );
      return result;
    } catch (error) {
      return this.handleApiError(error, fullContext, operationName);
    }
  }

  /**
   * Handle API-specific errors with proper categorization
   */
  private static handleApiError(
    error: unknown,
    context: ErrorContext,
    operationName: string,
  ): never {
    streamDeck.logger.error(`API operation failed: ${operationName}`, error);

    if (error instanceof ApiValidationError) {
      throw new PluginError(
        `Validation failed for ${operationName}: ${error.getUserFriendlyMessage()}`,
        ErrorCategory.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        context,
        error,
      );
    }

    if (error instanceof Error) {
      // Check for common API error patterns
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("invalid api key")
      ) {
        throw new PluginError(
          "Invalid API key or unauthorized access",
          ErrorCategory.CONFIGURATION_ERROR,
          ErrorSeverity.HIGH,
          context,
          error,
        );
      }

      if (
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("enotfound")
      ) {
        throw new PluginError(
          "Network connection error",
          ErrorCategory.NETWORK_ERROR,
          ErrorSeverity.MEDIUM,
          context,
          error,
        );
      }

      if (
        errorMessage.includes("device") ||
        errorMessage.includes("not found")
      ) {
        throw new PluginError(
          "Device not found or unavailable",
          ErrorCategory.DEVICE_ERROR,
          ErrorSeverity.MEDIUM,
          context,
          error,
        );
      }

      if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many requests")
      ) {
        throw new PluginError(
          "Rate limit exceeded. Please wait before trying again.",
          ErrorCategory.API_ERROR,
          ErrorSeverity.LOW,
          context,
          error,
        );
      }
    }

    // Generic API error
    throw new PluginError(
      `API operation failed: ${operationName}`,
      ErrorCategory.API_ERROR,
      ErrorSeverity.MEDIUM,
      context,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  /**
   * Handle device control errors specifically
   */
  static async wrapDeviceControl<T>(
    operation: () => Promise<T>,
    deviceId: string,
    deviceName: string,
    controlType: string,
  ): Promise<T> {
    return this.wrapApiCall(
      operation,
      { deviceId, metadata: { deviceName, controlType } },
      `Device Control: ${controlType} on ${deviceName}`,
    );
  }

  /**
   * Handle validation errors specifically
   */
  static validateAndHandle<T>(
    validationFn: () => T,
    context: Partial<ErrorContext>,
    operationName: string,
  ): T {
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      action: operationName,
    };

    try {
      return validationFn();
    } catch (error) {
      if (error instanceof ApiValidationError) {
        streamDeck.logger.error(
          `Validation failed for ${operationName}:`,
          error,
        );
        throw new PluginError(
          error.getUserFriendlyMessage(),
          ErrorCategory.VALIDATION_ERROR,
          ErrorSeverity.MEDIUM,
          fullContext,
          error,
        );
      }
      throw error;
    }
  }

  /**
   * Log error with appropriate level based on severity
   */
  static logError(error: PluginError): void {
    const logData = {
      category: error.category,
      severity: error.severity,
      context: error.context,
      message: error.message,
      originalError: error.originalError?.message,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        streamDeck.logger.error("CRITICAL ERROR:", logData);
        break;
      case ErrorSeverity.HIGH:
        streamDeck.logger.error("HIGH SEVERITY ERROR:", logData);
        break;
      case ErrorSeverity.MEDIUM:
        streamDeck.logger.warn("MEDIUM SEVERITY ERROR:", logData);
        break;
      case ErrorSeverity.LOW:
        streamDeck.logger.info("LOW SEVERITY ERROR:", logData);
        break;
    }
  }
}
