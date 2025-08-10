import { inject, type Ref } from "vue";
import type FeedbackSystem from "../components/FeedbackSystem.vue";

/**
 * Composable for accessing the global feedback system
 * Provides toast notifications, loading overlays, and success animations
 */
export function useFeedback() {
  const feedbackSystem =
    inject<Ref<InstanceType<typeof FeedbackSystem>>>("feedbackSystem");

  if (!feedbackSystem) {
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
      updateToast: () => {},
      showGlobalLoading: () => {},
      hideGlobalLoading: () => {},
      updateGlobalLoadingProgress: () => {},
      showSuccessAnimation: () => {},
    };
  }

  return {
    // Toast methods
    showToast: (toast: any) => feedbackSystem.value?.showToast(toast) ?? "",
    showSuccessToast: (title: string, message?: string) =>
      feedbackSystem.value?.showSuccessToast(title, message) ?? "",
    showError: (title: string, message?: string, actions?: any[]) =>
      feedbackSystem.value?.showError(title, message) ?? "",
    showWarning: (title: string, message?: string) =>
      feedbackSystem.value?.showWarning(title, message) ?? "",
    showInfo: (title: string, message?: string) =>
      feedbackSystem.value?.showInfo(title, message) ?? "",
    dismissToast: (id: string) => feedbackSystem.value?.dismissToast(id),
    // updateToastProgress method is not available in current FeedbackSystem implementation
    updateToastProgress: (id: string, progress: number) => {
      console.warn(
        "updateToastProgress is not implemented in current FeedbackSystem",
      );
    },
    updateToast: (id: string, updates: any) =>
      feedbackSystem.value?.updateToast(id, updates),

    // Global loading methods
    showGlobalLoading: (text: string, progress?: number) =>
      feedbackSystem.value?.showGlobalLoading(text, progress),
    hideGlobalLoading: () => feedbackSystem.value?.hideGlobalLoading(),
    updateGlobalLoadingProgress: (progress: number, text?: string) =>
      feedbackSystem.value?.updateGlobalLoadingProgress(progress, text),

    // Success animation
    showSuccessAnimation: (message: string) =>
      feedbackSystem.value?.displaySuccessAnimation(message),
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
  };
}
