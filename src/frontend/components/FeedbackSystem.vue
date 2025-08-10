<template>
  <div>
    <!-- Toast Container -->
    <ToastContainer
      :toasts="toasts"
      :paused-toasts="pausedToastsSet"
      @dismiss="dismissToast"
      @pause="pauseToast"
      @resume="resumeToast"
      @action="handleToastAction"
      @click="handleToastClick"
    />

    <!-- Global Loading Overlay -->
    <GlobalLoadingOverlay
      :visible="globalLoading"
      :text="globalLoadingText"
      :progress="globalLoadingProgress"
    />

    <!-- Success Animation -->
    <SuccessAnimation
      :visible="showSuccessAnimation"
      :message="successMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from "vue";
import ToastContainer from "./ToastContainer.vue";
import GlobalLoadingOverlay from "./GlobalLoadingOverlay.vue";
import SuccessAnimation from "./SuccessAnimation.vue";
import type { Toast, ToastAction } from "./ToastNotification.vue";
import { useToastMachine } from "../composables/useToastMachine";

// State machine for managing toasts
const toastMachine = useToastMachine();

// Toast state
const toasts = ref<Toast[]>([]);
const toastTimeouts = new Map<string, NodeJS.Timeout>();
const progressIntervals = new Map<string, NodeJS.Timeout>();
const pausedToasts = new Set<string>();
const pausedToastsSet = computed(() => pausedToasts);

// Loading state
const globalLoading = ref(false);
const globalLoadingText = ref("Loading...");
const globalLoadingProgress = ref<number | undefined>(undefined);

// Success animation state
const showSuccessAnimation = ref(false);
const successMessage = ref("");

// Sync with toast machine state
const syncMachineState = () => {
  const machineToasts = toastMachine.activeToasts.value;
  
  toasts.value = machineToasts.map((t: any) => ({
    id: t.id,
    type: t.type || "info",
    title: t.title || "",
    message: t.message,
    duration: t.duration || 5000,
    persistent: t.persistent || false,
    actions: t.actions,
    progress: t.progress,
  }));
  
  // Set up auto-dismiss timers for non-persistent toasts
  toasts.value.forEach(toast => {
    const dismissDuration = toast.duration || 5000;
    
    if (!toast.persistent && !toastTimeouts.has(toast.id)) {
      setupProgressIndicator(toast.id, dismissDuration);
      
      const timeout = setTimeout(() => {
        if (!pausedToasts.has(toast.id)) {
          dismissToast(toast.id);
        }
      }, dismissDuration);
      toastTimeouts.set(toast.id, timeout);
    }
  });
  
  // Clean up timers for dismissed toasts
  Array.from(toastTimeouts.keys()).forEach(id => {
    if (!toasts.value.find(t => t.id === id)) {
      const timeout = toastTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        toastTimeouts.delete(id);
      }
    }
  });
};

// Toast management functions
const showToast = (toast: Omit<Toast, "id">): string => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newToast = { ...toast, id };
  
  toastMachine.showToast(toast);
  syncMachineState();
  
  return id;
};

const dismissToast = (id: string): void => {
  const interval = progressIntervals.get(id);
  if (interval) {
    clearInterval(interval);
    progressIntervals.delete(id);
  }
  
  const timeout = toastTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(id);
  }
  
  pausedToasts.delete(id);
  toastMachine.dismissToast(id);
  syncMachineState();
};

const updateToast = (id: string, updates: Partial<Omit<Toast, 'id'>>): void => {
  const toast = toasts.value.find(t => t.id === id);
  if (toast) {
    Object.assign(toast, updates);
    
    // Reset timer if duration changed
    if (updates.duration !== undefined && !toast.persistent) {
      const timeout = toastTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        toastTimeouts.delete(id);
      }
      
      const newTimeout = setTimeout(() => {
        if (!pausedToasts.has(id)) {
          dismissToast(id);
        }
      }, updates.duration);
      toastTimeouts.set(id, newTimeout);
    }
  }
};

const pauseToast = (id: string): void => {
  pausedToasts.add(id);
  
  const timeout = toastTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(id);
  }
  
  const interval = progressIntervals.get(id);
  if (interval) {
    clearInterval(interval);
    progressIntervals.delete(id);
  }
};

const resumeToast = (id: string): void => {
  pausedToasts.delete(id);
  
  const toast = toasts.value.find(t => t.id === id);
  if (toast && !toast.persistent) {
    const remainingTime = ((100 - (toast.progress || 0)) / 100) * (toast.duration || 5000);
    
    setupProgressIndicator(id, remainingTime, toast.progress || 0);
    
    const timeout = setTimeout(() => {
      if (!pausedToasts.has(id)) {
        dismissToast(id);
      }
    }, remainingTime);
    toastTimeouts.set(id, timeout);
  }
};

const handleToastAction = async (action: ToastAction, id: string): Promise<void> => {
  try {
    await action.action();
    dismissToast(id);
  } catch (error) {
    console.error("Toast action failed:", error);
  }
};

const handleToastClick = (toast: Toast): void => {
  if (toast.persistent) {
    dismissToast(toast.id);
  }
};

// Progress indicator setup
const setupProgressIndicator = (id: string, duration: number, startProgress = 0): void => {
  const interval = progressIntervals.get(id);
  if (interval) {
    clearInterval(interval);
  }
  
  const updateInterval = 100; // Update every 100ms
  const progressIncrement = (100 / duration) * updateInterval;
  let currentProgress = startProgress;
  
  const newInterval = setInterval(() => {
    currentProgress += progressIncrement;
    
    if (currentProgress >= 100) {
      clearInterval(newInterval);
      progressIntervals.delete(id);
      return;
    }
    
    const toast = toasts.value.find(t => t.id === id);
    if (toast) {
      toast.progress = currentProgress;
    } else {
      clearInterval(newInterval);
      progressIntervals.delete(id);
    }
  }, updateInterval);
  
  progressIntervals.set(id, newInterval);
};

// Loading overlay functions
const showGlobalLoading = (text = "Loading...", progress?: number) => {
  globalLoading.value = true;
  globalLoadingText.value = text;
  globalLoadingProgress.value = progress;
};

const hideGlobalLoading = () => {
  globalLoading.value = false;
  globalLoadingProgress.value = undefined;
};

const updateGlobalLoadingProgress = (progress: number, text?: string) => {
  globalLoadingProgress.value = progress;
  if (text) {
    globalLoadingText.value = text;
  }
};

// Success animation functions
const displaySuccessAnimation = (message: string, duration = 2000) => {
  successMessage.value = message;
  showSuccessAnimation.value = true;
  
  setTimeout(() => {
    showSuccessAnimation.value = false;
  }, duration);
};

const hideSuccessAnimation = () => {
  showSuccessAnimation.value = false;
};

// Convenience methods for common toast types
const showSuccessToast = (title: string, message?: string): string => {
  return showToast({ type: "success", title, message });
};

const showError = (
  error: unknown,
  title = "Error",
  persistent = false
): string => {
  let message = "An unexpected error occurred";
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }
  
  return showToast({
    type: "error",
    title,
    message,
    persistent,
    duration: persistent ? undefined : 8000,
  });
};

const showWarning = (title: string, message?: string): string => {
  return showToast({
    type: "warning",
    title,
    message,
    duration: 6000,
  });
};

const showInfo = (title: string, message?: string): string => {
  return showToast({
    type: "info",
    title,
    message,
    duration: 5000,
  });
};

const showConfirmation = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void
): string => {
  return showToast({
    type: "warning",
    title,
    message,
    persistent: true,
    actions: [
      {
        label: "Confirm",
        action: onConfirm,
        type: "primary",
      },
      {
        label: "Cancel",
        action: onCancel || (() => {}),
        type: "secondary",
      },
    ],
  });
};

// Lifecycle hooks
let unsubscribe: (() => void) | undefined;

onMounted(() => {
  syncMachineState();
  
  // The composable handles subscriptions internally, just sync initial state
  syncMachineState();
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
  
  // Clean up all timeouts and intervals
  toastTimeouts.forEach(timeout => clearTimeout(timeout));
  progressIntervals.forEach(interval => clearInterval(interval));
  toastTimeouts.clear();
  progressIntervals.clear();
});

// Provide feedback methods to child components
provide("feedback", {
  showToast,
  dismissToast,
  updateToast,
  showSuccessToast,
  showError,
  showWarning,
  showInfo,
  showConfirmation,
  showGlobalLoading,
  hideGlobalLoading,
  updateGlobalLoadingProgress,
  displaySuccessAnimation,
  hideSuccessAnimation,
});

// Export methods for external use
defineExpose({
  showToast,
  dismissToast,
  updateToast,
  showSuccessToast,
  showError,
  showWarning,
  showInfo,
  showConfirmation,
  showGlobalLoading,
  hideGlobalLoading,
  updateGlobalLoadingProgress,
  displaySuccessAnimation,
  hideSuccessAnimation,
});
</script>

<style scoped>
/* No component-specific styles needed - all styles are in child components */
</style>