<template>
  <section class="config-section" data-testid="api-key-section">
    <h2>API Configuration</h2>
    <div class="form-group">
      <label for="apiKey">API Key</label>
      <div class="input-group">
        <input
          id="apiKey"
          :value="modelValue"
          type="password"
          class="form-input"
          placeholder="Enter your Govee API key"
          autocomplete="off"
          :disabled="apiConnection.isConnecting.value"
          @input="handleInput"
          @keyup.enter="connectToApi"
        />
        <button
          v-if="apiConnection.isDisconnected || apiConnection.hasError"
          class="btn btn-primary"
          :disabled="!modelValue || apiConnection.isConnecting.value"
          @click="connectToApi"
        >
          <span v-if="apiConnection.isConnecting">Connecting...</span>
          <span v-else>Connect</span>
        </button>
        <button
          v-else-if="apiConnection.isConnected"
          class="btn btn-secondary"
          @click="apiConnection.disconnect"
        >
          Disconnect
        </button>
      </div>

      <!-- Connection Status -->
      <div
        v-if="apiConnection.isConnecting"
        class="status-message status-loading"
        role="status"
        aria-live="polite"
      >
        <span class="status-icon" aria-hidden="true">⏳</span>
        Validating API key...
      </div>
      <div
        v-else-if="apiConnection.isConnected"
        class="status-message status-success"
        role="status"
        aria-live="polite"
      >
        <span class="status-icon" aria-hidden="true">✅</span>
        API key validated successfully
      </div>
      <div
        v-else-if="apiConnection.hasError"
        class="status-message status-error"
        role="alert"
        aria-live="assertive"
      >
        <span class="status-icon" aria-hidden="true">❌</span>
        {{ apiConnection.error }}
        <button class="btn-link" @click="apiConnection.retry">Retry</button>
      </div>

      <small class="help-text">
        Get your API key from the Govee Home app → Settings → About Us → Apply
        for API Key
      </small>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * ApiConfigSection Component
 *
 * A reusable section for managing Govee API key configuration in Property Inspectors.
 * Provides input field, connection/disconnection controls, and real-time status feedback.
 *
 * Features:
 * - Secure password input for API key entry
 * - Connect/Disconnect button with loading state
 * - Real-time connection status indicators (loading, success, error)
 * - Error recovery with retry functionality
 * - Accessible with proper ARIA attributes and live regions
 *
 * @example Basic Usage
 * ```vue
 * <ApiConfigSection v-model="apiKey" />
 * ```
 *
 * @example With Settings Integration
 * ```typescript
 * // In your component setup:
 * const { settings } = useSettings<MySettings>();
 * // Template: <ApiConfigSection v-model="settings.apiKey" />
 * ```
 */
import { useApiConnection } from "../composables/useApiConnection";
import { useFeedbackHelpers } from "../composables/useFeedback";
import "../styles/property-inspector.css";

/**
 * Component props
 * @interface Props
 */
const props = defineProps<{
  /** The API key value (v-model binding) */
  modelValue: string;
}>();

/**
 * Component events
 */
const emit = defineEmits<{
  /** Emitted when the API key value changes */
  (e: "update:modelValue", value: string): void;
}>();

/** API connection state management */
const apiConnection = useApiConnection();
/** Feedback helpers for showing toasts and errors */
const feedback = useFeedbackHelpers();

/**
 * Handles input changes and emits the updated value
 * @param event - The input event from the API key field
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}

/**
 * Attempts to connect to the Govee API using the current API key.
 * Shows error toast for unexpected errors (connection errors are handled by apiConnection).
 * @async
 */
async function connectToApi() {
  if (!props.modelValue) return;

  try {
    await apiConnection.connect(props.modelValue);
  } catch (error) {
    // Show error toast for unexpected errors (connection errors are handled by apiConnection)
    feedback.showApiError(error, "Connection Failed");
  }
}
</script>

<style scoped>
/* All styles inherited from src/frontend/styles/property-inspector.css */
</style>
