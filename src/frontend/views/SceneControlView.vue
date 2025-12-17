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
          Discover Scene-Capable Lights
        </button>
        <small class="help-text">
          Only lights with scene support will be shown
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
          No scene-capable lights found. Make sure your lights support scene
          control.
        </small>
      </div>
    </section>

    <!-- Scene Selection Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Scene Selection</h2>

      <div class="form-group">
        <label for="sceneSelect">Select Scene</label>
        <select id="sceneSelect" v-model="selectedScene" class="form-select">
          <option value="">-- Select a scene --</option>
          <optgroup label="Dynamic Scenes">
            <option value="sunrise">🌅 Sunrise</option>
            <option value="sunset">🌇 Sunset</option>
          </optgroup>
          <optgroup label="Color Scenes">
            <option value="rainbow">🌈 Rainbow</option>
            <option value="aurora">🌌 Aurora</option>
          </optgroup>
          <optgroup label="Activity Scenes">
            <option value="movie">🎬 Movie</option>
            <option value="reading">📖 Reading</option>
            <option value="nightlight">🌙 Nightlight</option>
          </optgroup>
        </select>
        <small class="help-text">
          Select a scene to apply when the action is triggered
        </small>
      </div>

      <div class="help-section">
        <h3>How to Use:</h3>
        <ul class="help-list">
          <li><strong>Press Button:</strong> Apply selected scene to light</li>
          <li><strong>Dynamic Scenes:</strong> Gradual color transitions</li>
          <li><strong>Color Scenes:</strong> Vibrant color effects</li>
          <li><strong>Activity Scenes:</strong> Task-optimized lighting</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useSceneControlSettings } from "../composables/useSettings";
import ApiConfigSection from "../components/ApiConfigSection.vue";
import "../styles/property-inspector.css";

// Settings management with auto-save
const settingsManager = useSceneControlSettings();

// API Connection composable
const apiConnection = useApiConnection();

// Light Discovery composable
const lightDiscovery = useLightDiscovery();

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Scene metadata mapping
const sceneMetadata: Record<string, { id: string; name: string }> = {
  sunrise: { id: "sunrise", name: "Sunrise" },
  sunset: { id: "sunset", name: "Sunset" },
  rainbow: { id: "rainbow", name: "Rainbow" },
  aurora: { id: "aurora", name: "Aurora" },
  movie: { id: "movie", name: "Movie" },
  reading: { id: "reading", name: "Reading" },
  nightlight: { id: "nightlight", name: "Nightlight" },
};

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

const selectedScene = computed({
  get: () => settingsManager.settings.selectedSceneId || "",
  set: (value: string) => {
    const scene = sceneMetadata[value];
    settingsManager.updateSettings({
      selectedSceneId: scene?.id,
      selectedSceneName: scene?.name,
    });
  },
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
