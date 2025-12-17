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
import { useApiConnection } from "../composables/useApiConnection";
import "../styles/property-inspector.css";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const apiConnection = useApiConnection();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}

async function connectToApi() {
  if (!props.modelValue) return;
  await apiConnection.connect(props.modelValue);
}
</script>

<style scoped>
/* All styles inherited from src/frontend/styles/property-inspector.css */
</style>
