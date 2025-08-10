<template>
  <main class="light-control-view" role="main" aria-labelledby="main-heading">
    <!-- Feedback System for Toast Notifications -->
    <FeedbackSystem />
    
    <!-- Screen reader only main heading -->
    <h1 id="main-heading" class="sr-only">Govee Light Control Configuration</h1>
    
    <!-- API Configuration Section -->
    <section class="config-section" data-testid="api-key-section" role="region" aria-labelledby="api-config-heading">
      <h2 id="api-config-heading">API Configuration</h2>
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <div class="input-group">
          <input
            id="apiKey"
            v-model="localApiKey"
            :type="showApiKey ? 'text' : 'password'"
            class="form-input"
            placeholder="Enter your Govee API key"
            autocomplete="off"
            :disabled="apiConnection.isConnecting.value"
            @keyup.enter="connectToApi"
          />
          <button
            type="button"
            class="btn btn-icon"
            @click="showApiKey = !showApiKey"
            :aria-label="showApiKey ? 'Hide API key' : 'Show API key'"
            :aria-pressed="showApiKey"
            role="switch"
          >
            <span aria-hidden="true">{{ showApiKey ? "🙈" : "👁️" }}</span>
          </button>
          <button
            v-if="
              apiConnection.isDisconnected.value || apiConnection.hasError.value
            "
            class="btn btn-primary"
            :disabled="!localApiKey || apiConnection.isConnecting.value"
            :aria-describedby="apiConnection.isConnecting.value ? 'connecting-status' : undefined"
            @click="connectToApi"
          >
            <span v-if="apiConnection.isConnecting.value">
              <span class="spinner" aria-hidden="true"></span>
              Connecting...
            </span>
            <span v-else>Connect</span>
          </button>
          <button
            v-else-if="apiConnection.isConnected.value"
            class="btn btn-secondary"
            @click="apiConnection.disconnect"
            aria-describedby="api-connected-status"
          >
            Disconnect
          </button>
          
          <!-- Hidden status descriptions for screen readers -->
          <div id="connecting-status" class="sr-only" v-if="apiConnection.isConnecting.value">
            Attempting to connect to Govee API, please wait
          </div>
          <div id="api-connected-status" class="sr-only" v-if="apiConnection.isConnected.value">
            Successfully connected to Govee API
          </div>
        </div>

        <small class="help-text">
          Get your API key from the Govee Home app → Settings → About Us → Apply
          for API Key
        </small>
      </div>
    </section>

    <!-- Light Selection Section -->
    <section class="config-section" data-testid="light-selection-section" role="region" aria-labelledby="light-selection-heading">
      <h2 id="light-selection-heading">Light Selection</h2>

      <!-- Fetch Lights Button -->
      <div v-if="lightDiscovery.isIdle.value" class="form-group">
        <button
          class="btn btn-primary"
          :disabled="!apiConnection.isConnected.value"
          @click="lightDiscovery.fetchLights"
        >
          Discover Lights
        </button>
        <small class="help-text">
          Connect your API key first, then discover available lights
        </small>
      </div>

      <!-- Light Selection -->
      <div v-else-if="lightDiscovery.isReady.value" class="form-group">
        <!-- Light Selection -->
        <div class="form-group">
          <label for="lightSelect">Light</label>

          <!-- Simple dropdown for light selection -->
          <select
            id="lightSelect"
            v-model="selectedLight"
            class="form-select"
            :disabled="!lightDiscovery.hasFilteredLights.value"
          >
            <option value="" disabled>
              {{
                lightDiscovery.hasFilteredLights.value
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

          <!-- Search functionality -->
          <div
            v-if="lightDiscovery.hasFilteredLights.value"
            class="search-section"
          >
            <input
              v-model="searchQuery"
              type="text"
              class="form-input search-input"
              placeholder="Search lights..."
              @input="lightDiscovery.searchLights(searchQuery)"
              @keydown.escape="clearSearch"
            />
            <button
              v-if="searchQuery"
              class="btn-clear"
              @click="clearSearch"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="button-group">
          <button
            class="btn btn-secondary"
            @click="refreshLights"
            :disabled="lightDiscovery.isFetchingLights.value"
          >
            <span v-if="lightDiscovery.isFetchingLights.value"
              >Refreshing...</span
            >
            <span v-else>🔄 Refresh Lights</span>
          </button>
          <button
            class="btn btn-accent"
            @click="testSelectedLight"
            :disabled="!selectedLight || isTestingLight"
          >
            <span v-if="isTestingLight">Testing...</span>
            <span v-else>💡 Test Light</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Control Mode Section -->
    <section class="config-section" data-testid="control-mode-section" role="region" aria-labelledby="control-mode-heading">
      <h2 id="control-mode-heading">Control Mode</h2>
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
          step="1"
          class="form-range"
          :aria-valuetext="`${brightnessValue} percent brightness`"
          aria-describedby="brightness-value-display"
        />
        <span 
          id="brightness-value-display" 
          class="range-value" 
          role="status" 
          aria-live="polite"
        >{{ brightnessValue }}%</span>
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
          :aria-valuetext="`${colorTempValue} Kelvin, ${colorTempValue < 4000 ? 'warm' : colorTempValue > 6000 ? 'cool' : 'neutral'} white light`"
          aria-describedby="colortemp-value-display colortemp-description"
        />
        <div class="range-feedback-group">
          <span 
            id="colortemp-value-display" 
            class="range-value" 
            role="status" 
            aria-live="polite"
          >{{ colorTempValue }}K</span>
          <span 
            id="colortemp-description" 
            class="range-description"
          >{{ colorTempValue < 4000 ? 'Warm' : colorTempValue > 6000 ? 'Cool' : 'Neutral' }}</span>
        </div>
      </div>
    </section>

    <!-- Status Field for Stream Deck -->
    <div 
      v-if="statusMessage" 
      class="status-field" 
      :class="statusType"
      role="status"
      :aria-live="statusType === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
      :aria-label="`Status update: ${statusMessage}`"
    >
      <span class="status-icon" aria-hidden="true">{{ statusIcon }}</span>
      <span class="status-text">{{ statusMessage }}</span>
    </div>
    
    <!-- Screen reader status region (always present for announcements) -->
    <div 
      class="sr-only" 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
      ref="screenReaderStatus"
    ></div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from "vue";
import type { ControlMode } from "@shared/types";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useLightControlSettings } from "../composables/useSettings";
import { websocketService } from "../services/websocketService";

// Lazy load the FeedbackSystem component
const FeedbackSystem = defineAsyncComponent(() => 
  import("../components/FeedbackSystem.vue")
);

// XState composables
const apiConnection = useApiConnection();
const lightDiscovery = useLightDiscovery();

// Settings composable with persistence
const settingsManager = useLightControlSettings();

// Local reactive state for UI
const searchQuery = ref<string>("");
const isTestingLight = ref<boolean>(false);
const showApiKey = ref<boolean>(false);
const screenReaderStatus = ref<HTMLElement>();

// Status field for Stream Deck
const statusMessage = ref<string>("");
const statusType = ref<"info" | "success" | "error" | "warning">("info");
const statusIcon = computed(() => {
  const icons = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
  };
  return icons[statusType.value];
});

// Status helper functions
const showStatus = (
  message: string,
  type: "info" | "success" | "error" | "warning" = "info",
  duration = 3000,
) => {
  statusMessage.value = message;
  statusType.value = type;
  
  // Also announce to screen readers
  if (screenReaderStatus.value) {
    screenReaderStatus.value.textContent = message;
  }

  if (duration > 0) {
    setTimeout(() => {
      statusMessage.value = "";
      if (screenReaderStatus.value) {
        screenReaderStatus.value.textContent = "";
      }
    }, duration);
  }
};

const clearStatus = () => {
  statusMessage.value = "";
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

// Actions
const connectToApi = () => {
  if (localApiKey.value) {
    showStatus("Validating API key...", "info");
    apiConnection.connect(localApiKey.value);
  }
};

const clearSearch = () => {
  searchQuery.value = "";
  lightDiscovery.clearSearch();
};

const refreshLights = () => {
  showStatus("Refreshing lights...", "info");
  lightDiscovery.refreshLights();
};

const testSelectedLight = async () => {
  if (!selectedLight.value) {
    showStatus("Please select a light to test", "warning");
    return;
  }

  isTestingLight.value = true;

  try {
    // Show immediate feedback
    showStatus("Testing light...", "info", 0); // No auto-clear

    // Send test command to backend using sendToPlugin format (like other successful commands)
    await websocketService.sendToPlugin({
      event: "testLight",
    });


    // Add timeout as fallback in case backend doesn't respond
    setTimeout(() => {
      if (isTestingLight.value) {
        console.warn("Test light timeout reached, resetting state");
        isTestingLight.value = false;
        showStatus("Test timeout - light may have still blinked", "warning");
      }
    }, 5000);
  } catch (error) {
    console.error("Failed to send test light command:", error);
    isTestingLight.value = false;
    showStatus("Failed to send test command", "error");
  }
};

// Watch for API connection changes to automatically fetch lights
watch(
  () => apiConnection.isConnected.value,
  (isConnected, wasConnected) => {
    if (isConnected && !wasConnected) {
      showStatus("API connected successfully", "success");
      if (lightDiscovery.isIdle.value) {
        lightDiscovery.fetchLights();
      }
    }
  },
);

// Watch for API connection errors
watch(
  () => apiConnection.error.value,
  (error) => {
    if (error) {
      showStatus(`API connection failed: ${error}`, "error");
    }
  },
);

// Watch for light discovery state changes
watch(
  () => lightDiscovery.state.value,
  (newState, oldState) => {

    if (newState === "fetching" && oldState === "idle") {
      showStatus("Discovering lights...", "info", 0);
    } else if (newState === "success" && oldState === "fetching") {
      const lightCount = lightDiscovery.lights.value.length;
      if (lightCount > 0) {
        showStatus(
          `Found ${lightCount} light${lightCount !== 1 ? "s" : ""}`,
          "success",
        );
      } else {
        showStatus("No lights found - check connections", "warning");
      }
    } else if (newState === "error") {
      showStatus("Light discovery failed", "error");
    }
  },
);

// Watch for light discovery errors
watch(
  () => lightDiscovery.error.value,
  (error) => {
    if (error) {
      showStatus(`Discovery error: ${error}`, "error");
    }
  },
);

// Watch for settings save events
watch(
  () => settingsManager.lastSaved,
  (lastSaved) => {
    if (lastSaved) {
      showStatus("Settings saved", "success");
    }
  },
);

// Initialize on mount
onMounted(() => {
  // Enable auto-save with 500ms delay for responsive UI
  settingsManager.enableAutoSave(500);

  // Wait for WebSocket connection before loading settings
  const checkConnection = () => {
    if (websocketService.isConnected) {
      // Load existing settings once connected
      settingsManager.loadSettings();

      // Set up WebSocket event listeners
      websocketService.on("sendToPropertyInspector", (data: any) => {

        if (data.payload?.event === "testResult") {
          isTestingLight.value = false;

          if (data.payload.success) {
            showStatus(
              data.payload.message || "Light blinked successfully!",
              "success",
            );
          } else {
            showStatus(
              data.payload.message || "Failed to control the light",
              "error",
            );
          }
        }
      });
    } else {
      // Retry after a short delay
      setTimeout(checkConnection, 100);
    }
  };

  // Start checking for connection
  checkConnection();

  // Don't auto-connect on mount - let user click Connect button
  // This prevents showing "Connecting..." immediately when the PI opens
});
</script>

<style scoped>
@import "../assets/common.css";

.light-control-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-range {
  width: 100%;
  margin: 8px 0;
}

.form-color {
  width: 60px;
  height: 40px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  cursor: pointer;
}

.range-value {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  align-self: flex-end;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.search-section {
  position: relative;
  margin-top: 8px;
}

.search-input {
  width: 100%;
  padding-right: 30px; /* Make room for clear button */
}

.search-group {
  position: relative;
  display: flex;
  align-items: center;
}
</style>
