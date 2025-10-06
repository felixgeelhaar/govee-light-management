<template>
  <div class="music-mode-view">
    <!-- API Configuration Section -->
    <section class="config-section" data-testid="api-key-section">
      <h2>API Configuration</h2>
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <div class="input-group">
          <input
            id="apiKey"
            v-model="localApiKey"
            type="password"
            class="form-input"
            placeholder="Enter your Govee API key"
            autocomplete="off"
            :disabled="apiConnection.isConnecting.value"
            @keyup.enter="connectToApi"
          />
          <button
            v-if="apiConnection.isDisconnected || apiConnection.hasError"
            class="btn btn-primary"
            :disabled="!localApiKey || apiConnection.isConnecting.value"
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
        >
          <span class="status-icon">⏳</span>
          Validating API key...
        </div>
        <div
          v-else-if="apiConnection.isConnected"
          class="status-message status-success"
        >
          <span class="status-icon">✅</span>
          API key validated successfully
        </div>
        <div
          v-else-if="apiConnection.hasError"
          class="status-message status-error"
        >
          <span class="status-icon">❌</span>
          {{ apiConnection.error }}
          <button class="btn-link" @click="apiConnection.retry">Retry</button>
        </div>

        <small class="help-text">
          Get your API key from the Govee Home app → Settings → About Us → Apply
          for API Key
        </small>
      </div>
    </section>

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
          Discover Music Mode-Capable Lights
        </button>
        <small class="help-text">
          Only lights with music mode support will be shown
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
          No music mode-capable lights found. Make sure your lights support music mode.
        </small>
      </div>
    </section>

    <!-- Music Mode Configuration Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Music Mode Configuration</h2>

      <div class="form-group">
        <label for="musicModeSelect">Music Mode</label>
        <select
          id="musicModeSelect"
          v-model="musicMode"
          class="form-select"
          @change="saveSettings"
        >
          <option value="">-- Select a mode --</option>
          <option value="rhythm">🎵 Rhythm - Steady pulse with music beat</option>
          <option value="energic">⚡ Energic - Dynamic high-energy effects</option>
          <option value="spectrum">🌈 Spectrum - Full color frequency visualization</option>
          <option value="rolling">🌊 Rolling - Smooth flowing color waves</option>
        </select>
        <small class="help-text">
          Select the music visualization mode
        </small>
      </div>

      <div class="form-group">
        <label for="sensitivity">
          Sensitivity: {{ sensitivity }}%
        </label>
        <input
          id="sensitivity"
          v-model.number="sensitivity"
          type="range"
          min="0"
          max="100"
          step="5"
          class="form-range"
          @input="saveSettings"
        />
        <small class="help-text">
          Adjust how responsive the lights are to music (0-100%)
        </small>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input
            id="autoColor"
            v-model="autoColor"
            type="checkbox"
            class="form-checkbox"
            @change="saveSettings"
          />
          <span>Auto Color Mode</span>
        </label>
        <small class="help-text">
          Automatically cycle through colors based on music
        </small>
      </div>

      <div class="help-section">
        <h3>How to Use:</h3>
        <ul class="help-list">
          <li><strong>Press Button:</strong> Activate music mode with current settings</li>
          <li><strong>Rhythm:</strong> Best for steady music with clear beats</li>
          <li><strong>Energic:</strong> Best for fast, high-energy music</li>
          <li><strong>Spectrum:</strong> Full frequency visualization</li>
          <li><strong>Rolling:</strong> Smooth, flowing color effects</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";

// API Connection composable
const apiConnection = useApiConnection();
const localApiKey = ref("");

// Light Discovery composable
const lightDiscovery = useLightDiscovery();
const selectedLight = ref("");

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Music mode configuration
const musicMode = ref("");
const sensitivity = ref(50);
const autoColor = ref(true);

// Connect to API
async function connectToApi() {
  if (!localApiKey.value) return;
  await apiConnection.connect(localApiKey.value);
}

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
    musicMode: musicMode.value,
    sensitivity: sensitivity.value,
    autoColor: autoColor.value,
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

  if (settings.musicMode) {
    musicMode.value = settings.musicMode;
  }

  if (settings.sensitivity !== undefined) {
    sensitivity.value = settings.sensitivity;
  }

  if (settings.autoColor !== undefined) {
    autoColor.value = settings.autoColor;
  }
});

// Auto-save settings when changed
watch([musicMode, sensitivity, autoColor], () => {
  if (selectedLight.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.music-mode-view {
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

.form-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  outline: none;
  -webkit-appearance: none;
}

.form-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
}

.form-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  border: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--sdpi-color-accent, #0099ff);
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
