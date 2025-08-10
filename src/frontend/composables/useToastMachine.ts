import { ref, onUnmounted, Ref } from "vue";
import {
  toastService,
  ToastContext,
  ToastType,
} from "../machines/toastMachine";

export interface UseToastMachine {
  // Reactive state
  activeToasts: Ref<ToastContext[]>;
  queueLength: Ref<number>;
  isIdle: Ref<boolean>;

  // Core methods
  showToast: (toast: Omit<ToastContext, "id">) => string;
  updateToast: (id: string, updates: Partial<ToastContext>) => void;
  dismissToast: (id: string) => void;
  dismissCategory: (category: string) => void;
  clearAll: () => void;

  // Convenience methods
  showSuccess: (title: string, message?: string, category?: string) => string;
  showError: (title: string, message?: string, category?: string) => string;
  showWarning: (title: string, message?: string, category?: string) => string;
  showInfo: (title: string, message?: string, category?: string) => string;

  // API-specific methods
  showApiConnectionTesting: (category?: string) => string;
  showApiConnectionSuccess: (message?: string, category?: string) => string;
  showApiConnectionError: (message?: string, category?: string) => string;

  // Light testing methods
  showLightTestStart: (lightName?: string) => string;
  showLightTestSuccess: (lightName?: string) => string;
  showLightTestError: (error?: string, lightName?: string) => string;

  // Light discovery methods
  showLightDiscovery: () => string;
  showLightDiscoverySuccess: (count: number) => string;
  showLightDiscoveryError: (error?: string) => string;
}

/**
 * Vue composable for the toast state machine
 * Provides reactive state and methods for managing toasts
 */
export function useToastMachine(): UseToastMachine {
  // Reactive state
  const activeToasts = ref<ToastContext[]>([]);
  const queueLength = ref(0);
  const isIdle = ref(true);

  // Update reactive state when machine state changes
  const unsubscribe = toastService.subscribe((state) => {
    const newActiveToasts = toastService.getActiveToasts();
    activeToasts.value = newActiveToasts;
    queueLength.value = toastService.getQueueLength();
    isIdle.value = state.matches("idle");
  });

  // Initialize reactive state
  activeToasts.value = toastService.getActiveToasts();
  queueLength.value = toastService.getQueueLength();

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe();
  });

  // Core methods - direct delegation to service
  const showToast = (toast: Omit<ToastContext, "id">): string => {
    return toastService.showToast(toast);
  };

  const updateToast = (id: string, updates: Partial<ToastContext>): void => {
    toastService.updateToast(id, updates);
  };

  const dismissToast = (id: string): void => {
    toastService.dismissToast(id);
  };

  const dismissCategory = (category: string): void => {
    toastService.dismissCategory(category);
  };

  const clearAll = (): void => {
    toastService.clearAll();
  };

  // Convenience methods
  const showSuccess = (
    title: string,
    message?: string,
    category?: string,
  ): string => {
    return toastService.showSuccess(title, message, category);
  };

  const showError = (
    title: string,
    message?: string,
    category?: string,
  ): string => {
    return toastService.showError(title, message, category);
  };

  const showWarning = (
    title: string,
    message?: string,
    category?: string,
  ): string => {
    return toastService.showWarning(title, message, category);
  };

  const showInfo = (
    title: string,
    message?: string,
    category?: string,
  ): string => {
    return toastService.showInfo(title, message, category);
  };

  // API-specific methods
  const showApiConnectionTesting = (category = "api-connection"): string => {
    return toastService.showApiConnectionTesting(category);
  };

  const showApiConnectionSuccess = (
    message?: string,
    category = "api-connection",
  ): string => {
    // Dismiss any existing API connection toasts (like "Testing Connection")
    dismissCategory(category);
    return toastService.showApiConnectionSuccess(message, category);
  };

  const showApiConnectionError = (
    message?: string,
    category = "api-connection",
  ): string => {
    return toastService.showApiConnectionError(message, category);
  };

  // Light testing methods
  const showLightTestStart = (lightName?: string): string => {
    const message = lightName
      ? `Testing ${lightName}...`
      : "Sending command to light";
    return showToast({
      type: "info",
      title: "Testing Light",
      message,
      category: "light-test",
      priority: 6,
    });
  };

  const showLightTestSuccess = (lightName?: string): string => {
    // Dismiss any existing light test toasts
    dismissCategory("light-test");

    const message = lightName
      ? `${lightName} blinked successfully!`
      : "Light blinked successfully!";

    return showToast({
      type: "success",
      title: "Light Test Successful",
      message,
      category: "light-test",
      priority: 5,
      duration: 5000,
    });
  };

  const showLightTestError = (error?: string, lightName?: string): string => {
    const message =
      error ||
      (lightName
        ? `Failed to control ${lightName}`
        : "Failed to control the light");
    return showToast({
      type: "error",
      title: "Light Test Failed",
      message,
      category: "light-test",
      priority: 8,
      duration: 6000,
    });
  };

  // Light discovery methods
  const showLightDiscovery = (): string => {
    return showToast({
      type: "info",
      title: "Discovering Lights",
      message: "Searching for Govee devices...",
      category: "light-discovery",
      priority: 4,
      duration: 3000, // Show for 3 seconds
    });
  };

  const showLightDiscoverySuccess = (count: number): string => {
    // Dismiss any existing light discovery toasts
    dismissCategory("light-discovery");

    const message =
      count > 0
        ? `Found ${count} light${count !== 1 ? "s" : ""}`
        : "No lights found";
    const type: ToastType = count > 0 ? "success" : "warning";

    return showToast({
      type,
      title: type === "success" ? "Lights Discovered" : "No Lights Found",
      message: count === 0 ? "Check connections and try again" : message,
      category: "light-discovery",
      priority: 5,
      duration: 5000,
    });
  };

  const showLightDiscoveryError = (error?: string): string => {
    return showToast({
      type: "error",
      title: "Light Discovery Failed",
      message: error || "Failed to discover lights",
      category: "light-discovery",
      priority: 8,
      duration: 6000,
    });
  };

  return {
    // Reactive state
    activeToasts,
    queueLength,
    isIdle,

    // Subscribe method for components (readonly)
    // subscribe: (callback: (state: any) => void) => toastService.subscribe(callback),

    // Core methods
    showToast,
    updateToast,
    dismissToast,
    dismissCategory,
    clearAll,

    // Convenience methods
    showSuccess,
    showError,
    showWarning,
    showInfo,

    // API-specific methods
    showApiConnectionTesting,
    showApiConnectionSuccess,
    showApiConnectionError,

    // Light testing methods
    showLightTestStart,
    showLightTestSuccess,
    showLightTestError,

    // Light discovery methods
    showLightDiscovery,
    showLightDiscoverySuccess,
    showLightDiscoveryError,
  };
}

// Legacy compatibility - maps old feedback system to new toast machine
export function useFeedback() {
  const toast = useToastMachine();

  return {
    // Map old methods to new ones for backward compatibility
    showInfo: (title: string, message?: string) =>
      toast.showInfo(title, message),
    showSuccessToast: (title: string, message?: string) =>
      toast.showSuccess(title, message),
    showErrorToast: (title: string, message?: string) =>
      toast.showError(title, message),
    showWarningToast: (title: string, message?: string) =>
      toast.showWarning(title, message),
    updateToast: toast.updateToast,
    dismissToast: toast.dismissToast,

    // Expose new machine methods without duplication
    activeToasts: toast.activeToasts,
    queueLength: toast.queueLength,
    isIdle: toast.isIdle,
    showToast: toast.showToast,
    dismissCategory: toast.dismissCategory,
    clearAll: toast.clearAll,
    showSuccess: toast.showSuccess,
    showApiConnectionTesting: toast.showApiConnectionTesting,
    showApiConnectionSuccess: toast.showApiConnectionSuccess,
    showApiConnectionError: toast.showApiConnectionError,
    showLightTestStart: toast.showLightTestStart,
    showLightTestSuccess: toast.showLightTestSuccess,
    showLightTestError: toast.showLightTestError,
    showLightDiscovery: toast.showLightDiscovery,
    showLightDiscoverySuccess: toast.showLightDiscoverySuccess,
    showLightDiscoveryError: toast.showLightDiscoveryError,
  };
}
