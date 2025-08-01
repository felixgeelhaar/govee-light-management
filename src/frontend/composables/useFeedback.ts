import { inject, type Ref } from "vue";
import type FeedbackSystem from "../components/FeedbackSystem.vue";

/**
 * Composable for accessing the global feedback system
 * Provides toast notifications, loading overlays, and success animations
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
 * Helper functions for common feedback patterns
 */
export function useFeedbackHelpers() {
  const feedback = useFeedback();

  return {
    ...feedback,

    // Common patterns
    showApiError: (error: unknown, title = "API Error") => {
      const message = (error as { message?: string })?.message || "An unexpected error occurred";
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
  };
}
