/**
 * Production-ready error handling utilities
 */

export interface AppError extends Error {
  code?: string;
  context?: Record<string, any>;
  timestamp?: number;
  recoverable?: boolean;
}

/**
 * Create a structured application error
 */
export function createAppError(
  message: string,
  code?: string,
  context?: Record<string, any>,
  recoverable: boolean = true,
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.context = context;
  error.timestamp = Date.now();
  error.recoverable = recoverable;
  return error;
}

/**
 * Error codes for different types of failures
 */
export const ErrorCodes = {
  // WebSocket errors
  WEBSOCKET_CONNECTION_FAILED: "WEBSOCKET_CONNECTION_FAILED",
  WEBSOCKET_TIMEOUT: "WEBSOCKET_TIMEOUT",
  WEBSOCKET_DISCONNECTED: "WEBSOCKET_DISCONNECTED",

  // API errors
  API_KEY_INVALID: "API_KEY_INVALID",
  API_KEY_VALIDATION_FAILED: "API_KEY_VALIDATION_FAILED",
  API_RATE_LIMITED: "API_RATE_LIMITED",

  // Light discovery errors
  LIGHTS_DISCOVERY_FAILED: "LIGHTS_DISCOVERY_FAILED",
  LIGHTS_DISCOVERY_TIMEOUT: "LIGHTS_DISCOVERY_TIMEOUT",
  NO_LIGHTS_FOUND: "NO_LIGHTS_FOUND",

  // Group management errors
  GROUP_LOAD_FAILED: "GROUP_LOAD_FAILED",
  GROUP_SAVE_FAILED: "GROUP_SAVE_FAILED",
  GROUP_DELETE_FAILED: "GROUP_DELETE_FAILED",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",

  // Validation errors
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // System errors
  SYSTEM_ERROR: "SYSTEM_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
} as const;

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: Error | AppError): boolean {
  if ("recoverable" in error) {
    return error.recoverable !== false;
  }

  // Default recovery rules
  const message = error.message.toLowerCase();

  // Non-recoverable errors
  if (
    message.includes("invalid api key") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("malformed")
  ) {
    return false;
  }

  // Recoverable errors (network, timeout, temporary failures)
  return true;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error | AppError): string {
  const code = "code" in error ? error.code : undefined;
  const message = error.message || "An unexpected error occurred";

  switch (code) {
    case ErrorCodes.WEBSOCKET_CONNECTION_FAILED:
      return "Cannot connect to Stream Deck. Please ensure Stream Deck is running.";

    case ErrorCodes.WEBSOCKET_TIMEOUT:
      return "Request timed out. Please check your connection and try again.";

    case ErrorCodes.API_KEY_INVALID:
      return "Invalid API key. Please check your Govee API key in the app settings.";

    case ErrorCodes.API_KEY_VALIDATION_FAILED:
      return "Unable to validate API key. Please check your internet connection.";

    case ErrorCodes.LIGHTS_DISCOVERY_FAILED:
      return "Failed to discover lights. Please check your Govee account and network connection.";

    case ErrorCodes.LIGHTS_DISCOVERY_TIMEOUT:
      return "Light discovery timed out. Please try again.";

    case ErrorCodes.NO_LIGHTS_FOUND:
      return "No lights found. Make sure your Govee lights are connected and visible in the Govee app.";

    case ErrorCodes.GROUP_LOAD_FAILED:
      return "Failed to load groups. Please try refreshing.";

    case ErrorCodes.GROUP_SAVE_FAILED:
      return "Failed to save group. Please try again.";

    case ErrorCodes.GROUP_DELETE_FAILED:
      return "Failed to delete group. Please try again.";

    case ErrorCodes.NETWORK_ERROR:
      return "Network error. Please check your internet connection.";

    case ErrorCodes.TIMEOUT_ERROR:
      return "Request timed out. Please try again.";

    default:
      // Handle common error patterns
      if (message.includes("timeout")) {
        return "Request timed out. Please try again.";
      }
      if (message.includes("network") || message.includes("connection")) {
        return "Connection error. Please check your network and try again.";
      }
      if (message.includes("not found")) {
        return "Requested item was not found.";
      }

      return message;
  }
}

/**
 * Log error with context for debugging
 */
export function logError(
  error: Error | AppError,
  context?: Record<string, any>,
): void {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: "code" in error ? error.code : undefined,
    timestamp: "timestamp" in error ? error.timestamp : Date.now(),
    context: {
      ...("context" in error ? error.context : {}),
      ...context,
    },
  };

  console.error("Application Error:", errorInfo);

  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or similar
}

/**
 * Retry mechanism for recoverable operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoffFactor: number = 2,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-recoverable errors
      if (!isRecoverableError(lastError)) {
        throw lastError;
      }

      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffFactor, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Create a timeout promise that rejects after specified time
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out",
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(createAppError(errorMessage, ErrorCodes.TIMEOUT_ERROR));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}
