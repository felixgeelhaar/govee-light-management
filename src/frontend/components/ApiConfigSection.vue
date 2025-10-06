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
.config-section {
  padding: 16px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  background-color: var(--sdpi-color-bg-secondary, #2d2d30);
  margin-bottom: 16px;
}

.config-section h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sdpi-color-text-primary, #ffffff);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--sdpi-color-text-primary, #ffffff);
}

.input-group {
  display: flex;
  gap: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: var(--sdpi-color-bg-primary, #1e1e1e);
  color: var(--sdpi-color-text-primary, #ffffff);
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: 2px solid var(--sdpi-color-accent, #0099ff);
  outline-offset: 2px;
  border-color: var(--sdpi-color-accent, #0099ff);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--sdpi-color-text-secondary, #999);
}

.btn {
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:focus {
  outline: 2px solid var(--sdpi-color-accent, #0099ff);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--sdpi-color-primary, #0099ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--sdpi-color-primary-hover, #0077cc);
}

.btn-secondary {
  background-color: var(--sdpi-color-secondary, #4a4a4a);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--sdpi-color-secondary-hover, #5a5a5a);
}

.btn-link {
  background: none;
  border: none;
  color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  text-decoration: underline;
  margin-left: 8px;
}

.btn-link:hover {
  color: var(--sdpi-color-accent-hover, #0077cc);
}

.status-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.status-loading {
  background-color: rgba(0, 153, 255, 0.1);
  color: var(--sdpi-color-info, #0099ff);
  border: 1px solid rgba(0, 153, 255, 0.3);
}

.status-success {
  background-color: rgba(76, 175, 80, 0.1);
  color: var(--sdpi-color-success, #4caf50);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.status-error {
  background-color: rgba(244, 67, 54, 0.1);
  color: var(--sdpi-color-error, #f44336);
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.status-icon {
  font-size: 16px;
  line-height: 1;
}

.help-text {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.4;
}
</style>
