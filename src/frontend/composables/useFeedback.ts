import { inject, type Ref } from "vue";
import type FeedbackSystem from "../components/FeedbackSystem.vue";

/**
 * useFeedback Composable
 *
 * A Vue composable for accessing the global FeedbackSystem component.
 * Provides methods for displaying toast notifications, loading overlays,
 * and success animations to give users visual feedback during operations.
 *
 * Features:
 * - Toast notifications (success, error, warning, info) with action buttons
 * - Global loading overlay with progress tracking
 * - Success animations for completed operations
 * - Graceful fallback when FeedbackSystem is not available
 *
 * Requirements:
 * - FeedbackSystem component must be mounted in App.vue
 * - FeedbackSystem ref must be provided via Vue's provide/inject
 *
 * @example Setup in App.vue
 * ```vue
 * <template>
 *   <FeedbackSystem ref="feedbackRef" />
 *   <RouterView />
 * </template>
 *
 * <script setup>
 * import { provide, ref } from "vue";
 * const feedbackRef = ref(null);
 * provide("feedbackSystem", feedbackRef);
 * </script>
 * ```
 *
 * @example Usage in Components
 * ```typescript
 * const feedback = useFeedback();
 *
 * // Show success toast
 * feedback.showSuccessToast("Saved!", "Your settings have been saved");
 *
 * // Show error with retry action
 * feedback.showError("Error", "Operation failed", [
 *   { label: "Retry", type: "primary", action: () => retryOperation() }
 * ]);
 *
 * // Show loading overlay
 * feedback.showGlobalLoading("Loading...", 50);
 * // ... do work ...
 * feedback.hideGlobalLoading();
 * ```
 *
 * @returns {Object} FeedbackSystem methods or no-op fallbacks
 */
export function useFeedback() {
  const feedbackSystem =
    inject<Ref<InstanceType<typeof FeedbackSystem>>>("feedbackSystem");

  if (!feedbackSystem?.value) {
    console.warn("Feedback system not available - ensure App.vue provides it");
    // Return no-op functions to prevent errors
    return {
      showToast: () => "",
      showSuccessToast: () => "",
      showError: () => "",
      showWarning: () => "",
      showInfo: () => "",
      dismissToast: () => {},
      updateToastProgress: () => {},
      showGlobalLoading: () => {},
      hideGlobalLoading: () => {},
      updateGlobalLoadingProgress: () => {},
      showSuccessAnimation: () => {},
    };
  }

  return {
    // Toast methods
    showToast: feedbackSystem.value.showToast,
    showSuccessToast: feedbackSystem.value.showSuccessToast,
    showError: feedbackSystem.value.showError,
    showWarning: feedbackSystem.value.showWarning,
    showInfo: feedbackSystem.value.showInfo,
    dismissToast: feedbackSystem.value.dismissToast,
    updateToastProgress: feedbackSystem.value.updateToastProgress,

    // Global loading methods
    showGlobalLoading: feedbackSystem.value.showGlobalLoading,
    hideGlobalLoading: feedbackSystem.value.hideGlobalLoading,
    updateGlobalLoadingProgress:
      feedbackSystem.value.updateGlobalLoadingProgress,

    // Success animation
    showSuccessAnimation: feedbackSystem.value.showSuccessAnimation,
  };
}

/**
 * useFeedbackHelpers Composable
 *
 * An extended version of useFeedback that provides helper functions for
 * common feedback patterns used throughout the application. Simplifies
 * showing API errors, validation errors, save confirmations, and more.
 *
 * Features:
 * - All base useFeedback methods
 * - Pre-configured API error handler with retry action
 * - Validation error helper
 * - Save success notification
 * - Loading with progress tracking
 * - Connection and discovery error handlers with recovery actions
 *
 * @example API Error Handling
 * ```typescript
 * const feedback = useFeedbackHelpers();
 *
 * try {
 *   await api.fetchData();
 * } catch (error) {
 *   feedback.showApiError(error, "Failed to load data");
 * }
 * ```
 *
 * @example Progress-Based Loading
 * ```typescript
 * const feedback = useFeedbackHelpers();
 *
 * const loading = feedback.showLoadingWithProgress("Uploading...");
 * loading.updateProgress(25, "Processing...");
 * loading.updateProgress(75, "Almost done...");
 * loading.complete();
 * ```
 *
 * @example Connection Error with Recovery
 * ```typescript
 * const feedback = useFeedbackHelpers();
 *
 * watch(() => apiConnection.hasError.value, (hasError) => {
 *   if (hasError) {
 *     feedback.showConnectionError(
 *       apiConnection.error.value,
 *       () => apiConnection.retry()
 *     );
 *   }
 * });
 * ```
 *
 * @returns {Object} Extended feedback methods with helper functions
 */
export function useFeedbackHelpers() {
  const feedback = useFeedback();

  return {
    ...feedback,

    // Common patterns
    showApiError: (error: unknown, title = "API Error") => {
      const message =
        (error as { message?: string })?.message ||
        "An unexpected error occurred";
      return feedback.showError(title, message, [
        {
          label: "Retry",
          type: "primary" as const,
          action: () => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          },
        },
      ]);
    },

    showValidationError: (message: string) => {
      return feedback.showError("Validation Error", message);
    },

    showSaveSuccess: (itemName = "Settings") => {
      return feedback.showSuccessToast(
        `${itemName} Saved`,
        "Your changes have been saved successfully",
      );
    },

    showLoadingWithProgress: (text: string) => {
      feedback.showGlobalLoading(text, 0);

      return {
        updateProgress: (progress: number, newText?: string) => {
          feedback.updateGlobalLoadingProgress(progress, newText);
        },
        complete: () => {
          feedback.hideGlobalLoading();
        },
      };
    },

    showOperationSuccess: (operation: string) => {
      feedback.showSuccessAnimation(`${operation} completed successfully!`);
    },

    /**
     * Show connection error with retry and settings actions
     */
    showConnectionError: (error: unknown, retryAction?: () => void) => {
      const message =
        (error as { message?: string })?.message || "Connection failed";
      return feedback.showError("Connection Error", message, [
        {
          label: "Retry",
          type: "primary" as const,
          action: retryAction || (() => window.location.reload()),
        },
        {
          label: "Check Settings",
          type: "secondary" as const,
          action: () => {
            const apiSection = document.querySelector(
              '[data-testid="api-config-section"]',
            );
            apiSection?.scrollIntoView({ behavior: "smooth" });
          },
        },
      ]);
    },

    /**
     * Show light discovery error with retry action
     */
    showDiscoveryError: (error: unknown, retryAction?: () => void) => {
      const message =
        (error as { message?: string })?.message || "Light discovery failed";
      return feedback.showError("Discovery Failed", message, [
        {
          label: "Retry Discovery",
          type: "primary" as const,
          action: retryAction || (() => window.location.reload()),
        },
      ]);
    },

    /**
     * Show success toast for connection established
     */
    showConnectionSuccess: (service = "API") => {
      return feedback.showSuccessToast(
        `${service} Connected`,
        `Successfully connected to ${service}`,
      );
    },

    /**
     * Show success toast for light discovery
     */
    showDiscoverySuccess: (count: number) => {
      const message =
        count === 1 ? "1 light discovered" : `${count} lights discovered`;
      return feedback.showSuccessToast("Discovery Complete", message);
    },
  };
}
