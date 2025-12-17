<script setup lang="ts">
/**
 * ErrorBoundary Component
 *
 * A Vue error boundary that catches errors from child components and displays
 * a fallback UI. Integrates with FeedbackSystem for toast notifications and
 * provides error recovery functionality.
 *
 * Features:
 * - Catches errors using Vue's `onErrorCaptured` lifecycle hook
 * - Displays configurable fallback UI with error details
 * - Optional toast notifications via FeedbackSystem integration
 * - Reset/retry functionality to recover from errors
 * - Custom fallback component support
 * - Error logging with component context
 *
 * @example Basic Usage
 * ```vue
 * <ErrorBoundary>
 *   <ChildComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With Error Handling
 * ```vue
 * <ErrorBoundary
 *   title="Failed to load data"
 *   @error="(err, info) => console.error('Error in', info, err)"
 *   @reset="handleRetry"
 * >
 *   <DataComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example Custom Fallback Component
 * ```vue
 * <ErrorBoundary :fallback="{ component: CustomErrorDisplay, props: { theme: 'dark' } }">
 *   <ChildComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example Silent Error Handling (no toast)
 * ```vue
 * <ErrorBoundary :show-toast="false">
 *   <ChildComponent />
 * </ErrorBoundary>
 * ```
 */
import { ref, onErrorCaptured, type PropType } from "vue";
import { type AppError, logError, getUserFriendlyErrorMessage } from "../utils/errorHandling";
import { useFeedbackHelpers } from "../composables/useFeedback";

const props = defineProps({
  /** Custom title for the error display */
  title: {
    type: String,
    default: "Something went wrong",
  },
  /** Whether to show toast notification on error */
  showToast: {
    type: Boolean,
    default: true,
  },
  /** Custom fallback component/content */
  fallback: {
    type: Object as PropType<{ component?: unknown; props?: Record<string, unknown> }>,
    default: null,
  },
});

const emit = defineEmits<{
  /** Emitted when an error is caught */
  (e: "error", error: Error, info: string): void;
  /** Emitted when the error is reset */
  (e: "reset"): void;
}>();

const feedback = useFeedbackHelpers();

const hasError = ref(false);
const error = ref<Error | null>(null);
const errorInfo = ref<string>("");

/**
 * Vue's error capture hook
 * Returns false to prevent the error from propagating further
 */
onErrorCaptured((err: Error, instance, info: string) => {
  hasError.value = true;
  error.value = err;
  errorInfo.value = info;

  // Log the error with context
  logError(err as AppError, {
    component: instance?.$options?.name || "Unknown",
    info,
  });

  // Show toast notification if enabled
  if (props.showToast) {
    const message = getUserFriendlyErrorMessage(err as AppError);
    feedback.showError(props.title, message, [
      {
        label: "Retry",
        type: "primary" as const,
        action: () => reset(),
      },
    ]);
  }

  // Emit error event for parent handling
  emit("error", err, info);

  // Return false to prevent error propagation
  return false;
});

/**
 * Reset the error state and re-render children
 */
function reset(): void {
  hasError.value = false;
  error.value = null;
  errorInfo.value = "";
  emit("reset");
}

/**
 * Get user-friendly error message
 */
function getDisplayMessage(): string {
  if (error.value) {
    return getUserFriendlyErrorMessage(error.value as AppError);
  }
  return "An unexpected error occurred";
}

// Expose reset method for parent components
defineExpose({ reset, hasError, error });
</script>

<template>
  <div class="error-boundary">
    <!-- Error State -->
    <div v-if="hasError" class="error-boundary__fallback">
      <!-- Custom Fallback -->
      <component
        v-if="fallback?.component"
        :is="fallback.component"
        v-bind="fallback.props"
        :error="error"
        @reset="reset"
      />

      <!-- Default Fallback -->
      <div v-else class="error-boundary__default">
        <div class="error-boundary__icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 class="error-boundary__title">{{ title }}</h3>
        <p class="error-boundary__message">{{ getDisplayMessage() }}</p>
        <button class="error-boundary__button" @click="reset">
          Try Again
        </button>
      </div>
    </div>

    <!-- Normal State - Render Children -->
    <slot v-else />
  </div>
</template>

<style scoped>
.error-boundary {
  width: 100%;
}

.error-boundary__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 24px;
}

.error-boundary__default {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
}

.error-boundary__icon {
  color: var(--sdpi-color-error, #ff5555);
  margin-bottom: 16px;
}

.error-boundary__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--sdpi-color-text, #cccccc);
}

.error-boundary__message {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--sdpi-color-text-secondary, #999999);
  line-height: 1.5;
}

.error-boundary__button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background-color: var(--sdpi-color-accent, #0099ff);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.error-boundary__button:hover {
  background-color: var(--sdpi-color-accent-hover, #0077cc);
}

.error-boundary__button:active {
  background-color: var(--sdpi-color-accent-active, #005599);
}
</style>
