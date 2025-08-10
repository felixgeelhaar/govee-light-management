/**
 * Centralized error handling for Stream Deck actions
 * Provides consistent error reporting and recovery strategies
 */

import type { Action } from "@elgato/streamdeck";
import type { ExtendedAction } from "../../types/StreamDeckActionTypes";
import { getStreamDeck } from "../../utils/streamDeckInstance";
import type { ActionState } from "./BaseActionSettings";

export interface ErrorContext {
  action: string;
  operation: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class ActionErrorHandler {
  private static readonly MAX_ERROR_MESSAGE_LENGTH = 100;
  private static readonly ERROR_DISPLAY_DURATION = 3000; // 3 seconds

  /**
   * Handle action execution errors with consistent logging and user feedback
   */
  static async handleActionError(
    action: ExtendedAction,
    error: Error | unknown,
    context: ErrorContext,
    setStateCallback?: (state: Partial<ActionState>) => Promise<void>,
  ): Promise<void> {
    // Parse error details
    const errorDetails = this.parseError(error);

    // Log error with context
    this.logError(errorDetails, context);

    // Show user feedback
    await this.showUserFeedback(action, errorDetails);

    // Update action state if callback provided
    if (setStateCallback) {
      await setStateCallback({
        isLoading: false,
        errorMessage: errorDetails.userMessage,
      });
    }

    // Report telemetry if applicable
    this.reportTelemetry(errorDetails, context);
  }

  /**
   * Parse error into structured format
   */
  private static parseError(error: Error | unknown): {
    message: string;
    userMessage: string;
    code?: string;
    isRetryable: boolean;
    isNetworkError: boolean;
  } {
    if (error instanceof Error) {
      const message = error.message;
      const isNetworkError = this.isNetworkError(error);
      const isRetryable = this.isRetryableError(error);

      return {
        message,
        userMessage: this.getUserFriendlyMessage(error),
        code: (error as any).code,
        isRetryable,
        isNetworkError,
      };
    }

    return {
      message: String(error),
      userMessage: "An unexpected error occurred",
      isRetryable: false,
      isNetworkError: false,
    };
  }

  /**
   * Determine if error is network-related
   */
  private static isNetworkError(error: Error): boolean {
    const networkKeywords = [
      "network",
      "timeout",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "fetch failed",
      "Failed to fetch",
    ];

    const message = error.message.toLowerCase();
    return networkKeywords.some((keyword) =>
      message.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Determine if error can be retried
   */
  private static isRetryableError(error: Error): boolean {
    // Network errors are generally retryable
    if (this.isNetworkError(error)) {
      return true;
    }

    // Rate limit errors are retryable after delay
    if (error.message.includes("rate limit") || error.message.includes("429")) {
      return true;
    }

    // Temporary failures
    if (error.message.includes("temporary") || error.message.includes("503")) {
      return true;
    }

    return false;
  }

  /**
   * Convert technical error to user-friendly message
   */
  private static getUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase();

    // API Key errors
    if (
      message.includes("401") ||
      message.includes("unauthorized") ||
      message.includes("api key")
    ) {
      return "Invalid API key. Please check your configuration.";
    }

    // Network errors
    if (this.isNetworkError(error)) {
      return "Connection failed. Please check your internet connection.";
    }

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return "Too many requests. Please wait a moment.";
    }

    // Device offline
    if (message.includes("offline") || message.includes("not available")) {
      return "Device is offline or unreachable.";
    }

    // Invalid parameters
    if (message.includes("invalid") || message.includes("validation")) {
      return "Invalid settings. Please check your configuration.";
    }

    // Device not found
    if (message.includes("not found") || message.includes("404")) {
      return "Device not found. It may have been removed.";
    }

    // Capability errors
    if (message.includes("capability") || message.includes("not supported")) {
      return "This device doesn't support this operation.";
    }

    // Timeout errors
    if (message.includes("timeout")) {
      return "Operation timed out. Please try again.";
    }

    // Default message - truncate if too long
    if (error.message.length > this.MAX_ERROR_MESSAGE_LENGTH) {
      return error.message.substring(0, this.MAX_ERROR_MESSAGE_LENGTH) + "...";
    }

    return error.message;
  }

  /**
   * Log error with appropriate severity
   */
  private static logError(
    errorDetails: ReturnType<typeof ActionErrorHandler.parseError>,
    context: ErrorContext,
  ): void {
    const streamDeck = getStreamDeck();
    const logger = streamDeck?.logger;

    if (!logger) {
      console.error(
        `[${context.action}] ${context.operation} failed:`,
        errorDetails.message,
      );
      return;
    }

    const logMessage = `[${context.action}] ${context.operation} failed: ${errorDetails.message}`;

    if (errorDetails.isNetworkError || errorDetails.isRetryable) {
      logger.warn(logMessage);
    } else {
      logger.error(logMessage, {
        context: context.metadata,
        code: errorDetails.code,
      });
    }
  }

  /**
   * Show user feedback for error
   */
  private static async showUserFeedback(
    action: Action,
    errorDetails: ReturnType<typeof ActionErrorHandler.parseError>,
  ): Promise<void> {
    try {
      // Show alert to user
      await action.showAlert();

      // If retryable, show OK after delay
      if (errorDetails.isRetryable) {
        setTimeout(async () => {
          try {
            await (action as any).showOk();
          } catch {
            // Ignore errors in feedback
          }
        }, this.ERROR_DISPLAY_DURATION);
      }
    } catch {
      // Don't fail if we can't show feedback
    }
  }

  /**
   * Report error telemetry for monitoring
   */
  private static reportTelemetry(
    errorDetails: ReturnType<typeof ActionErrorHandler.parseError>,
    context: ErrorContext,
  ): void {
    // This could be extended to send to an analytics service
    // For now, just track in debug mode
    if (context.settings?.debugMode) {
      const streamDeck = getStreamDeck();
      streamDeck?.logger?.debug("Error telemetry", {
        action: context.action,
        operation: context.operation,
        error: errorDetails.message,
        code: errorDetails.code,
        isRetryable: errorDetails.isRetryable,
        isNetworkError: errorDetails.isNetworkError,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Create a retry handler for retryable operations
   */
  static createRetryHandler<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3,
    backoffMs: number = 1000,
  ): Promise<T> {
    return this.executeWithRetry(operation, context, maxRetries, backoffMs);
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number,
    backoffMs: number,
    attempt: number = 1,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorDetails = this.parseError(error);

      if (!errorDetails.isRetryable || attempt >= maxRetries) {
        throw error;
      }

      const streamDeck = getStreamDeck();
      streamDeck?.logger?.debug(
        `Retrying ${context.operation} (attempt ${attempt + 1}/${maxRetries})`,
      );

      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.executeWithRetry(
        operation,
        context,
        maxRetries,
        backoffMs,
        attempt + 1,
      );
    }
  }
}
