<template>
  <div class="colortemp-dial-view">
    <!-- API Configuration Section -->
    <ApiConfigSection v-model="localApiKey" />

    <!-- Light Selection Section -->
    <section class="config-section" data-testid="light-selection-section">
      <h2>Light Selection</h2>

      <!-- Fetch Lights Button -->
      <div v-if="lightDiscovery.isIdle" class="form-group">
        <button
          class="btn btn-primary"
          :disabled="!apiConnection.isConnected"
          @click="lightDiscovery.fetchLights"
        >
          Discover Color Temperature Lights
        </button>
        <small class="help-text">
          Only lights with color temperature control will be shown
        </small>
      </div>

      <!-- Loading State -->
      <div
        v-else-if="lightDiscovery.isFetchingLights"
        class="status-message status-loading"
      >
        <span class="status-icon">⏳</span>
        Discovering lights...
      </div>

      <!-- Error State -->
      <div
        v-else-if="lightDiscovery.hasError"
        class="status-message status-error"
      >
        <span class="status-icon">❌</span>
        {{ lightDiscovery.error }}
        <button class="btn-link" @click="lightDiscovery.retryFetch">
          Retry
        </button>
      </div>

      <!-- Light Selection -->
      <div v-else-if="lightDiscovery.isReady" class="form-group">
        <label for="lightSelect">Select Light</label>
        <select
          id="lightSelect"
          v-model="selectedLight"
          class="form-select"
          @change="onLightSelected"
        >
          <option value="">-- Select a light --</option>
          <option
            v-for="light in lightsArray"
            :key="light.value"
            :value="light.value"
          >
            {{ light.label }}
          </option>
        </select>
        <small v-if="!lightDiscovery.hasLights" class="help-text">
          No color temperature lights found. Make sure your lights support color temperature control.
        </small>
      </div>
    </section>

    <!-- Dial Configuration Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Dial Configuration</h2>

      <FormInput
        id="stepSize"
        v-model="stepSize"
        label="Temperature Step Size (Kelvin per tick)"
        type="number"
        :min="50"
        :max="500"
        :required="true"
        help-text="Each rotation tick will adjust color temperature by this amount (50-500K). Range: 2000K (warm) to 9000K (cool)"
        @update:model-value="() => saveSettings()"
      />

      <div class="help-section">
        <h3>How to Use:</h3>
        <ul class="help-list">
          <li><strong>Rotate Dial:</strong> Adjust color temperature (warm ↔ cool)</li>
          <li><strong>Press Dial:</strong> Toggle light power on/off</li>
          <li><strong>Display:</strong> Shows current temperature in Kelvin</li>
          <li><strong>Temperature Range:</strong> 2000K (warm white) to 9000K (cool white)</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import ApiConfigSection from "../components/ApiConfigSection.vue";
import FormInput from "../components/FormInput.vue";

// API Connection composable
const apiConnection = useApiConnection();
const localApiKey = ref("");

// Light Discovery composable
const lightDiscovery = useLightDiscovery();
const selectedLight = ref("");

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Dial configuration
const stepSize = ref(100);

// Handle light selection
function onLightSelected() {
  const [deviceId, model] = selectedLight.value.split("|");
  const light = lightDiscovery.lights.value.find((l) => l.value === selectedLight.value);

  if (light) {
    saveSettings({
      selectedDeviceId: deviceId,
      selectedModel: model,
      selectedLightName: light.label.split(" (")[0], // Remove model from label
    });
  }
}

// Save settings to Stream Deck
function saveSettings(updates: Record<string, any> = {}) {
  const settings = {
    apiKey: localApiKey.value,
    selectedDeviceId: updates.selectedDeviceId,
    selectedModel: updates.selectedModel,
    selectedLightName: updates.selectedLightName,
    stepSize: stepSize.value,
  };

  // Send to plugin
  window.$SD?.sendToPlugin?.({ event: "setSettings", settings });
}

// Initialize from Stream Deck settings
onMounted(async () => {
  // Wait for Stream Deck connection
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get current settings from Stream Deck
  const settings = window.$SD?.settings || {};

  if (settings.apiKey) {
    localApiKey.value = settings.apiKey;
    await apiConnection.connect(settings.apiKey);
  }

  if (settings.selectedDeviceId && settings.selectedModel) {
    selectedLight.value = `${settings.selectedDeviceId}|${settings.selectedModel}`;
  }

  if (settings.stepSize) {
    stepSize.value = settings.stepSize;
  }
});

// Auto-save step size when changed
watch(stepSize, () => {
  if (selectedLight.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.colortemp-dial-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px;
}

.config-section {
  padding: 16px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  background-color: var(--sdpi-color-bg-secondary, #2d2d30);
}

.config-section h2 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--sdpi-color-accent, #0099ff);
}

.config-section h3 {
  margin: 12px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--sdpi-color-text, #cccccc);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--sdpi-color-text, #cccccc);
}

.form-input,
.form-select {
  padding: 8px 12px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
  font-size: 14px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--sdpi-color-accent, #0099ff);
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group .form-input {
  flex: 1;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--sdpi-color-accent, #0099ff);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--sdpi-color-accent-hover, #0077cc);
}

.btn-secondary {
  background-color: var(--sdpi-color-bg-tertiary, #404040);
  color: var(--sdpi-color-text, #cccccc);
  border: 1px solid var(--sdpi-color-border, #333);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--sdpi-color-bg-hover, #505050);
}

.btn-link {
  background: none;
  border: none;
  color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
  padding: 0;
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
  margin: 8px 0;
}

.status-loading {
  background-color: var(--sdpi-color-bg-info, #1a3b5c);
  color: var(--sdpi-color-text-info, #79c7ff);
  border: 1px solid var(--sdpi-color-border-info, #0099ff);
}

.status-success {
  background-color: var(--sdpi-color-bg-success, #1a3b1a);
  color: var(--sdpi-color-text-success, #7dd87d);
  border: 1px solid var(--sdpi-color-border-success, #28a745);
}

.status-error {
  background-color: var(--sdpi-color-bg-error, #3b1a1a);
  color: var(--sdpi-color-text-error, #ff7979);
  border: 1px solid var(--sdpi-color-border-error, #dc3545);
}

.status-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.help-text {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.4;
}

.help-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--sdpi-color-border, #333);
}

.help-list {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.6;
}

.help-list li {
  margin-bottom: 4px;
}

.help-list strong {
  color: var(--sdpi-color-text, #cccccc);
  font-weight: 600;
}
</style>
