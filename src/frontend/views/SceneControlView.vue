<template>
  <div class="scene-control-view">
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
          No scene-capable lights found. Make sure your lights support scene control.
        </small>
      </div>
    </section>

    <!-- Scene Selection Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Scene Selection</h2>

      <div class="form-group">
        <label for="sceneSelect">Select Scene</label>
        <select
          id="sceneSelect"
          v-model="selectedScene"
          class="form-select"
          @change="saveSettings"
        >
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
import { ref, computed, onMounted, watch } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import ApiConfigSection from "../components/ApiConfigSection.vue";

// API Connection composable
const apiConnection = useApiConnection();
const localApiKey = ref("");

// Light Discovery composable
const lightDiscovery = useLightDiscovery();
const selectedLight = ref("");

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Scene selection
const selectedScene = ref("");

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
  const scene = sceneMetadata[selectedScene.value];
  const settings = {
    apiKey: localApiKey.value,
    selectedDeviceId: updates.selectedDeviceId,
    selectedModel: updates.selectedModel,
    selectedLightName: updates.selectedLightName,
    selectedSceneId: scene?.id,
    selectedSceneName: scene?.name,
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

  if (settings.selectedSceneId) {
    selectedScene.value = settings.selectedSceneId;
  }
});

// Auto-save scene when changed
watch(selectedScene, () => {
  if (selectedLight.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.scene-control-view {
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
