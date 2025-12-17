<template>
  <div class="pi-view">
    <!-- API Configuration Section -->
    <ApiConfigSection v-model="localApiKey" />

    <section class="config-section diagnostics-section">
      <h2>Connectivity Diagnostics</h2>

      <div v-if="transportHealth.length" class="transport-health">
        <ul>
          <li v-for="health in transportHealth" :key="health.kind">
            <span class="transport-label">{{ health.label }}</span>
            <span
              class="transport-indicator"
              :class="{ healthy: health.isHealthy, unhealthy: !health.isHealthy }"
            >
              {{ health.isHealthy ? "Available" : "Unavailable" }}
              <span v-if="health.latencyMs !== undefined">
                • {{ health.latencyMs }} ms
              </span>
            </span>
          </li>
        </ul>
      </div>

      <DiagnosticsPanel
        :snapshot="telemetrySnapshot"
        @refresh="refreshDiagnostics"
        @reset="resetTelemetry"
      />
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
          Discover Lights
        </button>
        <small class="help-text">
          Connect your API key first, then discover available lights
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
        <!-- Search -->
        <div v-if="lightDiscovery.hasLights" class="search-group">
          <input
            v-model="searchQuery"
            type="text"
            class="form-input"
            placeholder="Search lights..."
            @input="lightDiscovery.searchLights(searchQuery)"
          />
          <button v-if="searchQuery" class="btn-clear" @click="clearSearch">
            ✕
          </button>
        </div>

        <!-- Light Dropdown -->
        <div class="form-group">
          <label for="lightSelect">Light</label>
          <select
            id="lightSelect"
            v-model="selectedLight"
            class="form-select"
            :disabled="!lightDiscovery.hasFilteredLights"
          >
            <option value="" disabled>
              {{
                lightDiscovery.hasFilteredLights
                  ? "Select a light..."
                  : "No lights found"
              }}
            </option>
            <option
              v-for="light in lightDiscovery.filteredLights.value"
              :key="light.value"
              :value="light.value"
            >
              {{ light.label }}
            </option>
          </select>
        </div>

        <!-- Refresh Button -->
        <button
          class="btn btn-secondary"
          @click="lightDiscovery.refreshLights"
          :disabled="lightDiscovery.isFetchingLights"
        >
          <span v-if="lightDiscovery.isFetchingLights">Refreshing...</span>
          <span v-else>Refresh Lights</span>
        </button>
      </div>
    </section>

    <!-- Control Mode Section -->
    <section class="config-section" data-testid="control-mode-section">
      <h2>Control Mode</h2>
      <div class="form-group">
        <label for="controlMode">Control Mode</label>
        <select id="controlMode" v-model="controlMode" class="form-select">
          <option value="toggle">Toggle On/Off</option>
          <option value="on">Turn On</option>
          <option value="off">Turn Off</option>
          <option value="brightness">Set Brightness</option>
          <option value="color">Set Color</option>
          <option value="colorTemp">Set Color Temperature</option>
        </select>
      </div>

      <!-- Brightness Control -->
      <div v-if="controlMode === 'brightness'" class="form-group">
        <label for="brightness">Brightness (%)</label>
        <input
          id="brightness"
          v-model.number="brightnessValue"
          type="range"
          min="1"
          max="100"
          class="form-range"
        />
        <span class="range-value">{{ brightnessValue }}%</span>
      </div>

      <!-- Color Control -->
      <div v-if="controlMode === 'color'" class="form-group">
        <label for="color">Color</label>
        <input
          id="color"
          v-model="colorValue"
          type="color"
          class="form-color"
        />
      </div>

      <!-- Color Temperature Control -->
      <div v-if="controlMode === 'colorTemp'" class="form-group">
        <label for="colorTemp">Color Temperature (K)</label>
        <input
          id="colorTemp"
          v-model.number="colorTempValue"
          type="range"
          min="2000"
          max="9000"
          step="100"
          class="form-range"
        />
        <span class="range-value">{{ colorTempValue }}K</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { ControlMode } from "@shared/types";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useLightControlSettings } from "../composables/useSettings";
import { useFeedbackHelpers } from "../composables/useFeedback";
import { websocketService } from "../services/websocketService";
import DiagnosticsPanel from "../components/DiagnosticsPanel.vue";
import ApiConfigSection from "../components/ApiConfigSection.vue";
import "../styles/property-inspector.css";

// XState composables
const apiConnection = useApiConnection();
const lightDiscovery = useLightDiscovery();

// Settings composable with persistence
const settingsManager = useLightControlSettings();

// Feedback system for user notifications
const feedback = useFeedbackHelpers();

// Local reactive state for UI
const searchQuery = ref<string>("");

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
      const lightName = lightDiscovery.filteredLights.value.find(
        (l) => l.value === value,
      )?.label;
      settingsManager.updateSettings({
        selectedDeviceId: deviceId,
        selectedModel: model,
        selectedLightName: lightName,
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

const controlMode = computed({
  get: () => settingsManager.settings.controlMode || "toggle",
  set: (value: ControlMode) =>
    settingsManager.updateSetting("controlMode", value),
});

const brightnessValue = computed({
  get: () => settingsManager.settings.brightnessValue || 100,
  set: (value: number) =>
    settingsManager.updateSetting("brightnessValue", value),
});

const colorValue = computed({
  get: () => settingsManager.settings.colorValue || "#ffffff",
  set: (value: string) => settingsManager.updateSetting("colorValue", value),
});

const colorTempValue = computed({
  get: () => settingsManager.settings.colorTempValue || 6500,
  set: (value: number) =>
    settingsManager.updateSetting("colorTempValue", value),
});

const transportHealth = ref<Array<{
  kind: string;
  label: string;
  isHealthy: boolean;
  latencyMs?: number;
  lastChecked?: number;
}>>([]);

const telemetrySnapshot = ref<any | null>(null);

// Actions
const connectToApi = () => {
  if (localApiKey.value) {
    feedback.showInfo("Connecting to API", "Validating your API key...");
    apiConnection.connect(localApiKey.value);
  }
};

const clearSearch = () => {
  searchQuery.value = "";
  lightDiscovery.clearSearch();
};

const refreshTransportHealth = () => {
  websocketService.requestTransportHealth();
};

const refreshTelemetry = () => {
  websocketService.requestTelemetrySnapshot();
};

const resetTelemetry = () => {
  websocketService.resetTelemetry();
};

const refreshDiagnostics = () => {
  refreshTransportHealth();
  refreshTelemetry();
};

// Watch for API connection changes to automatically fetch lights
watch(
  () => apiConnection.isConnected.value,
  (isConnected, wasConnected) => {
    if (isConnected && !wasConnected) {
      feedback.showSuccessToast(
        "API Connected",
        "Successfully connected to Govee API",
      );
      if (lightDiscovery.isIdle.value) {
        lightDiscovery.fetchLights();
      }
      refreshTransportHealth();
      refreshTelemetry();
    }
  },
);

// Watch for API connection errors
watch(
  () => apiConnection.error.value,
  (error) => {
    if (error) {
      feedback.showApiError({ message: error }, "API Connection Failed");
    }
  },
);

// Watch for light discovery success
watch(
  () => lightDiscovery.isReady.value,
  (isReady, wasReady) => {
    if (isReady && !wasReady && lightDiscovery.hasLights.value) {
      const lightCount = lightDiscovery.lights.value.length;
      feedback.showSuccessToast(
        "Lights Discovered",
        `Found ${lightCount} light${lightCount !== 1 ? "s" : ""}`,
      );
    }
  },
);

// Watch for light discovery errors
watch(
  () => lightDiscovery.error.value,
  (error) => {
    if (error) {
      feedback.showApiError({ message: error }, "Light Discovery Failed");
    }
  },
);

// Watch for API key changes in settings to update connection
watch(
  () => settingsManager.settings.apiKey,
  (newApiKey) => {
    if (newApiKey && !apiConnection.isConnected.value) {
      apiConnection.connect(newApiKey);
    }
  },
);

// Watch for settings save events
watch(
  () => settingsManager.lastSaved,
  (lastSaved) => {
    if (lastSaved) {
      feedback.showSuccessToast(
        "Settings Saved",
        "Your configuration has been saved",
      );
    }
  },
);

// Initialize on mount
onMounted(() => {
  // Enable auto-save with 500ms delay for responsive UI
  settingsManager.enableAutoSave(500);

  // Load existing settings
  settingsManager.loadSettings();

  // If we have an API key in settings, connect automatically
  if (settingsManager.settings.apiKey) {
    apiConnection.connect(settingsManager.settings.apiKey);
  }

  const piHandler = (message: any) => {
    if (message.payload?.event === "transportHealth") {
      transportHealth.value = message.payload.transports ?? [];
    }
    if (message.payload?.event === "telemetrySnapshot") {
      telemetrySnapshot.value = message.payload.snapshot ?? null;
    }
  };

  websocketService.on("sendToPropertyInspector", piHandler);

  onUnmounted(() => {
    websocketService.off("sendToPropertyInspector", piHandler);
  });
});
</script>

<style scoped>
/* All common styles moved to src/frontend/styles/property-inspector.css */

/* LightControlView-specific styles */
.form-color {
  width: 60px;
  height: 40px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  cursor: pointer;
}
</style>
