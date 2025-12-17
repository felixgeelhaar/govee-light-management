<template>
  <div class="pi-view">
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
          No music mode-capable lights found. Make sure your lights support
          music mode.
        </small>
      </div>
    </section>

    <!-- Music Mode Configuration Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Music Mode Configuration</h2>

      <div class="form-group">
        <label for="musicModeSelect">Music Mode</label>
        <select id="musicModeSelect" v-model="musicMode" class="form-select">
          <option value="">-- Select a mode --</option>
          <option value="rhythm">
            🎵 Rhythm - Steady pulse with music beat
          </option>
          <option value="energic">
            ⚡ Energic - Dynamic high-energy effects
          </option>
          <option value="spectrum">
            🌈 Spectrum - Full color frequency visualization
          </option>
          <option value="rolling">
            🌊 Rolling - Smooth flowing color waves
          </option>
        </select>
        <small class="help-text"> Select the music visualization mode </small>
      </div>

      <div class="form-group">
        <label for="sensitivity"> Sensitivity: {{ sensitivity }}% </label>
        <input
          id="sensitivity"
          v-model.number="sensitivity"
          type="range"
          min="0"
          max="100"
          step="5"
          class="form-range"
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
          <li>
            <strong>Press Button:</strong> Activate music mode with current
            settings
          </li>
          <li>
            <strong>Rhythm:</strong> Best for steady music with clear beats
          </li>
          <li><strong>Energic:</strong> Best for fast, high-energy music</li>
          <li><strong>Spectrum:</strong> Full frequency visualization</li>
          <li><strong>Rolling:</strong> Smooth, flowing color effects</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useMusicModeSettings } from "../composables/useSettings";
import ApiConfigSection from "../components/ApiConfigSection.vue";
import "../styles/property-inspector.css";

// Settings management with auto-save
const settingsManager = useMusicModeSettings();

// API Connection composable
const apiConnection = useApiConnection();

// Light Discovery composable
const lightDiscovery = useLightDiscovery();

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Computed values bound to settings
const localApiKey = computed({
  get: () => settingsManager.settings.apiKey || "",
  set: (value: string) =>
    settingsManager.updateSetting("apiKey", value || undefined),
});

const selectedLight = computed({
  get: () => {
    const deviceId = settingsManager.settings.selectedDeviceId;
    const model = settingsManager.settings.selectedModel;
    return deviceId && model ? `${deviceId}|${model}` : "";
  },
  set: (value: string) => {
    if (value) {
      const [deviceId, model] = value.split("|");
      const light = lightDiscovery.lights.value.find((l) => l.value === value);
      settingsManager.updateSettings({
        selectedDeviceId: deviceId,
        selectedModel: model,
        selectedLightName: light?.label.split(" (")[0], // Remove model from label
      });
    } else {
      settingsManager.updateSettings({
        selectedDeviceId: undefined,
        selectedModel: undefined,
        selectedLightName: undefined,
      });
    }
  },
});

const musicMode = computed({
  get: () => settingsManager.settings.musicMode || "",
  set: (value: string) =>
    settingsManager.updateSetting("musicMode", value || undefined),
});

const sensitivity = computed({
  get: () => settingsManager.settings.sensitivity ?? 50,
  set: (value: number) => settingsManager.updateSetting("sensitivity", value),
});

const autoColor = computed({
  get: () => settingsManager.settings.autoColor ?? true,
  set: (value: boolean) => settingsManager.updateSetting("autoColor", value),
});

// Handle light selection
function onLightSelected() {
  // Trigger the setter which will auto-save via the composable
  selectedLight.value = selectedLight.value;
}

// Initialize
onMounted(async () => {
  // Enable auto-save with 500ms debounce
  settingsManager.enableAutoSave(500);

  // Wait for Stream Deck connection
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Load settings (will be automatically handled by composable)
  if (settingsManager.settings.apiKey) {
    await apiConnection.connect(settingsManager.settings.apiKey);
  }
});
</script>

<style scoped>
/* All common styles moved to src/frontend/styles/property-inspector.css */
/* Add view-specific styles here if needed */
</style>
