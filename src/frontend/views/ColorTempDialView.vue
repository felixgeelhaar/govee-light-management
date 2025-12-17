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
          No color temperature lights found. Make sure your lights support color
          temperature control.
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
          <li>
            <strong>Rotate Dial:</strong> Adjust color temperature (warm ↔ cool)
          </li>
          <li><strong>Press Dial:</strong> Toggle light power on/off</li>
          <li><strong>Display:</strong> Shows current temperature in Kelvin</li>
          <li>
            <strong>Temperature Range:</strong> 2000K (warm white) to 9000K
            (cool white)
          </li>
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
import "../styles/property-inspector.css";

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
  const light = lightDiscovery.lights.value.find(
    (l) => l.value === selectedLight.value,
  );

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
/* All common styles moved to src/frontend/styles/property-inspector.css */
/* Add view-specific styles here if needed */
</style>
