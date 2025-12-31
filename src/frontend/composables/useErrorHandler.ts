import { ref, type Ref } from "vue";
import {
  type AppError,
  createAppError,
  ErrorCodes,
  isRecoverableError,
  getUserFriendlyErrorMessage,
  logError,
} from "../utils/errorHandling";
import { useFeedbackHelpers } from "./useFeedback";

/**
 * Options for the error handler composable
 */
export interface UseErrorHandlerOptions {
  /** Whether to show error toast notifications automatically */
  showErrorToast?: boolean;
  /** Whether errors should be retryable */
  retryable?: boolean;
  /** Custom error handler callback */
  onError?: (error: AppError) => void;
  /** Custom success handler callback */
  onSuccess?: () => void;
}

/**
 * Return type for the error handler composable
 */
export interface UseErrorHandlerReturn {
  /** Execute an async operation with error handling */
  execute: <T>(
    operation: () => Promise<T>,
    context?: string,
  ) => Promise<T | null>;
  /** Current loading state */
  isLoading: Ref<boolean>;
  /** Current error state */
  error: Ref<AppError | null>;
  /** Clear the current error */
  clearError: () => void;
  /** Retry the last operation */
  retry: () => Promise<void>;
  /** Check if current error is recoverable */
  canRetry: Ref<boolean>;
}

/**
 * Composable for standardized async operation error handling
 *
 * Provides consistent error handling patterns across all views:
 * - Automatic loading state management
 * - Error capture and structured error creation
 * - Toast notifications for errors
 * - Retry mechanism for recoverable errors
 *
 * @example
 * ```typescript
 * const { execute, isLoading, error } = useErrorHandler({ showErrorToast: true });
 *
 * async function loadData() {
 *   const result = await execute(
 *     () => api.fetchData(),
 *     "Loading data"
 *   );
 *   if (result) {
 *     // Handle success
 *   }
 * }
 * ```
 */
export function useErrorHandler(
  options: UseErrorHandlerOptions = {},
): UseErrorHandlerReturn {
  const {
    showErrorToast = false,
    retryable = true,
    onError,
    onSuccess,
  } = options;

  const feedback = useFeedbackHelpers();

  const isLoading = ref(false);
  const error = ref<AppError | null>(null);
  const canRetry = ref(false);

  // Store the last operation for retry functionality
  let lastOperation: (() => Promise<unknown>) | null = null;
  let lastContext: string | undefined;

  /**
   * Execute an async operation with standardized error handling
   */
  async function execute<T>(
    operation: () => Promise<T>,
    context?: string,
  ): Promise<T | null> {
    // Store for potential retry
    lastOperation = operation;
    lastContext = context;

    isLoading.value = true;
    error.value = null;
    canRetry.value = false;

    try {
      const result = await operation();
      onSuccess?.();
      return result;
    } catch (err) {
      // Create structured error
      const appError =
        err instanceof Error && "code" in err
          ? (err as AppError)
          : createAppError(
              err instanceof Error ? err.message : String(err),
              ErrorCodes.SYSTEM_ERROR,
              { context, originalError: err },
            );

      error.value = appError;
      canRetry.value = retryable && isRecoverableError(appError);

      // Log error with context
      logError(appError, { context, retryable: canRetry.value });

      // Show toast if enabled
      if (showErrorToast) {
        const title = context || "Operation Failed";
        const message = getUserFriendlyErrorMessage(appError);

        if (canRetry.value) {
          feedback.showError(title, message, [
            {
              label: "Retry",
              type: "primary" as const,
              action: () => retry(),
            },
          ]);
        } else {
          feedback.showError(title, message);
        }
      }

      // Call custom error handler
      onError?.(appError);

      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Retry the last failed operation
   */
  async function retry(): Promise<void> {
    if (lastOperation && canRetry.value) {
      await execute(lastOperation, lastContext);
    }
  }

  /**
   * Clear the current error state
   */
  function clearError(): void {
    error.value = null;
    canRetry.value = false;
  }

  return {
    execute,
    isLoading,
    error,
    clearError,
    retry,
    canRetry,
  };
}

/**
 * Composable for handling multiple concurrent operations
 *
 * Useful when a view has multiple async operations that need
 * independent loading/error states.
 *
 * @example
 * ```typescript
 * const operations = useMultipleErrorHandlers({
 *   loadLights: { showErrorToast: true },
 *   saveSetting: { showErrorToast: true },
 * });
 *
 * await operations.loadLights.execute(() => api.getLights());
 * await operations.saveSetting.execute(() => api.saveSetting(value));
 * ```
 */
export function useMultipleErrorHandlers<
  T extends Record<string, UseErrorHandlerOptions>,
>(configs: T): { [K in keyof T]: UseErrorHandlerReturn } {
  const handlers = {} as { [K in keyof T]: UseErrorHandlerReturn };

  for (const key of Object.keys(configs) as (keyof T)[]) {
    handlers[key] = useErrorHandler(configs[key]);
  }

  return handlers;
}
