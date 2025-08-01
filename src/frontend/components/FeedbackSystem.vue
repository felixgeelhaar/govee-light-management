<template>
  <Teleport to="body">
    <!-- Toast Notifications -->
    <Transition name="toast-container">
      <div v-if="toasts.length > 0" class="toast-container">
        <TransitionGroup name="toast" tag="div">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :class="[
              'toast',
              `toast-${toast.type}`,
              { 'toast-persistent': toast.persistent },
            ]"
            @click="dismissToast(toast.id)"
          >
            <div class="toast-icon">
              <component :is="getToastIcon(toast.type)" />
            </div>
            <div class="toast-content">
              <div class="toast-title">{{ toast.title }}</div>
              <div v-if="toast.message" class="toast-message">
                {{ toast.message }}
              </div>
              <div v-if="toast.actions" class="toast-actions">
                <button
                  v-for="action in toast.actions"
                  :key="action.label"
                  :class="[
                    'toast-action',
                    `toast-action-${action.type || 'primary'}`,
                  ]"
                  @click.stop="handleToastAction(action, toast.id)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
            <button
              v-if="!toast.persistent"
              class="toast-close"
              @click.stop="dismissToast(toast.id)"
            >
              ✕
            </button>
            <div v-if="toast.progress !== undefined" class="toast-progress">
              <div
                class="toast-progress-bar"
                :style="{ width: `${toast.progress}%` }"
              ></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Transition>

    <!-- Loading Overlay -->
    <Transition name="loading-overlay">
      <div v-if="globalLoading" class="loading-overlay">
        <div class="loading-content">
          <LoadingSpinner :size="48" />
          <div class="loading-text">{{ globalLoadingText }}</div>
          <div
            v-if="globalLoadingProgress !== undefined"
            class="loading-progress"
          >
            <div class="loading-progress-bar">
              <div
                class="loading-progress-fill"
                :style="{ width: `${globalLoadingProgress}%` }"
              ></div>
            </div>
            <div class="loading-progress-text">
              {{ Math.round(globalLoadingProgress) }}%
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Success Animations -->
    <Transition name="success-overlay">
      <div
        v-if="showSuccessAnimation"
        class="success-overlay"
        @click="hideSuccessAnimation"
      >
        <div class="success-content">
          <div class="success-icon">
            <svg viewBox="0 0 50 50" class="success-checkmark">
              <circle
                class="success-circle"
                cx="25"
                cy="25"
                r="23"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
              <path
                class="success-check"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                d="M14 27l7 7 16-16"
              />
            </svg>
          </div>
          <div class="success-text">{{ successMessage }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from "vue";
import LoadingSpinner from "./LoadingSpinner.vue";

// Toast notification interface
interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  progress?: number;
  actions?: Array<{
    label: string;
    type?: "primary" | "secondary" | "danger";
    action: () => void | Promise<void>;
  }>;
}

// Reactive state
const toasts = ref<Toast[]>([]);
const globalLoading = ref(false);
const globalLoadingText = ref("Loading...");
const globalLoadingProgress = ref<number | undefined>(undefined);
const showSuccessAnimation = ref(false);
const successMessage = ref("");

// Toast management
const showToast = (toast: Omit<Toast, "id">) => {
  const id = `toast-${Date.now()}-${Math.random()}`;
  const newToast: Toast = {
    ...toast,
    id,
    duration: toast.duration ?? (toast.persistent ? undefined : 5000),
  };

  toasts.value.push(newToast);

  // Auto-dismiss non-persistent toasts
  if (!newToast.persistent && newToast.duration) {
    window.setTimeout(() => {
      dismissToast(id);
    }, newToast.duration);
  }

  return id;
};

const dismissToast = (id: string) => {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

const updateToastProgress = (id: string, progress: number) => {
  const toast = toasts.value.find((t) => t.id === id);
  if (toast) {
    toast.progress = Math.max(0, Math.min(100, progress));
  }
};

const handleToastAction = async (
  action: NonNullable<Toast["actions"]>[0],
  toastId: string,
) => {
  if (action.action) {
    try {
      await action.action();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Toast action failed:", error);
    }
  }
  dismissToast(toastId);
};

// Global loading management
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
  globalLoadingProgress.value = Math.max(0, Math.min(100, progress));
  if (text) {
    globalLoadingText.value = text;
  }
};

// Success animation
const displaySuccessAnimation = (message: string, duration = 2000) => {
  successMessage.value = message;
  showSuccessAnimation.value = true;

  window.setTimeout(() => {
    hideSuccessAnimation();
  }, duration);
};

const hideSuccessAnimation = () => {
  showSuccessAnimation.value = false;
};

// Helper functions
const getToastIcon = (type: Toast["type"]) => {
  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };
  return icons[type] || icons.info;
};

// Quick helper methods for common toast types
const showSuccessToast = (title: string, message?: string) => {
  return showToast({ type: "success", title, message });
};

const showError = (
  title: string,
  message?: string,
  actions?: Toast["actions"],
) => {
  return showToast({ type: "error", title, message, actions, duration: 8000 });
};

const showWarning = (title: string, message?: string) => {
  return showToast({ type: "warning", title, message, duration: 6000 });
};

const showInfo = (title: string, message?: string) => {
  return showToast({ type: "info", title, message });
};

// Expose methods to parent components
defineExpose({
  showToast,
  dismissToast,
  updateToastProgress,
  showGlobalLoading,
  hideGlobalLoading,
  updateGlobalLoadingProgress,
  showSuccessToast,
  showError,
  showWarning,
  showInfo,
  showSuccessAnimation: displaySuccessAnimation,
});
</script>

<script lang="ts">
// Component registration for icons (simple text-based icons for Stream Deck compatibility)
export default {
  name: "FeedbackSystem",
};
</script>

<style scoped>
/* Toast Container */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  max-width: 400px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
  min-width: 320px;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.toast-success {
  border-left: 4px solid #28a745;
}

.toast-error {
  border-left: 4px solid #dc3545;
}

.toast-warning {
  border-left: 4px solid #ffc107;
}

.toast-info {
  border-left: 4px solid var(--sdpi-color-accent, #0099ff);
}

.toast-icon {
  font-size: 18px;
  font-weight: bold;
  min-width: 20px;
  text-align: center;
  margin-top: 2px;
}

.toast-success .toast-icon {
  color: #28a745;
}
.toast-error .toast-icon {
  color: #dc3545;
}
.toast-warning .toast-icon {
  color: #ffc107;
}
.toast-info .toast-icon {
  color: var(--sdpi-color-accent, #0099ff);
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
  margin-bottom: 4px;
}

.toast-message {
  font-size: 13px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.4;
  word-wrap: break-word;
}

.toast-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.toast-action {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.toast-action-primary {
  background: var(--sdpi-color-accent, #0099ff);
  color: white;
}

.toast-action-secondary {
  background: var(--sdpi-color-bg-tertiary, #404040);
  color: var(--sdpi-color-text, #cccccc);
}

.toast-action-danger {
  background: #dc3545;
  color: white;
}

.toast-close {
  background: none;
  border: none;
  color: var(--sdpi-color-text-secondary, #999);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.toast-close:hover {
  color: var(--sdpi-color-text, #cccccc);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.toast-progress-bar {
  height: 100%;
  background: var(--sdpi-color-accent, #0099ff);
  transition: width 0.3s ease;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  text-align: center;
  color: var(--sdpi-color-text, #cccccc);
}

.loading-text {
  margin-top: 16px;
  font-size: 16px;
  font-weight: 500;
}

.loading-progress {
  margin-top: 20px;
  min-width: 200px;
}

.loading-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.loading-progress-fill {
  height: 100%;
  background: var(--sdpi-color-accent, #0099ff);
  transition: width 0.3s ease;
}

.loading-progress-text {
  margin-top: 8px;
  font-size: 14px;
  color: var(--sdpi-color-text-secondary, #999);
}

/* Success Animation */
.success-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.success-content {
  text-align: center;
  color: #28a745;
}

.success-icon {
  margin-bottom: 16px;
}

.success-checkmark {
  width: 80px;
  height: 80px;
  color: #28a745;
}

.success-circle {
  stroke-dasharray: 144;
  stroke-dashoffset: 144;
  animation: success-circle 0.6s ease-in-out forwards;
}

.success-check {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: success-check 0.4s ease-in-out 0.6s forwards;
}

.success-text {
  font-size: 18px;
  font-weight: 600;
}

/* Animations */
@keyframes success-circle {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes success-check {
  to {
    stroke-dashoffset: 0;
  }
}

/* Transitions */
.toast-container-enter-active,
.toast-container-leave-active {
  transition: all 0.3s ease;
}

.toast-container-enter-from,
.toast-container-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-move {
  transition: transform 0.3s ease;
}

.loading-overlay-enter-active,
.loading-overlay-leave-active {
  transition: all 0.3s ease;
}

.loading-overlay-enter-from,
.loading-overlay-leave-to {
  opacity: 0;
}

.success-overlay-enter-active,
.success-overlay-leave-active {
  transition: all 0.4s ease;
}

.success-overlay-enter-from,
.success-overlay-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .toast-container {
    left: 20px;
    right: 20px;
    max-width: none;
  }

  .toast {
    min-width: auto;
  }
}
</style>
