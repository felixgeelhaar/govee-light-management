<template>
  <BaseActionView
    action-type="warmth"
    config-title="Warmth/Temperature Settings"
    action-summary="Adjust Light Warmth"
    @light-selected="handleLightSelected"
    @settings-changed="handleSettingsChanged"
    ref="baseActionRef"
  >
    <template #action-config="{ selectedLight, lightInfo }">
      <!-- Warmth Settings -->
      <section class="config-section">
        <h2>Warmth Settings</h2>

        <div class="form-group">
          <label for="temperature">Default Temperature</label>
          <div class="slider-container">
            <input
              id="temperature"
              type="range"
              v-model.number="colorTemperature"
              :min="minTemperature"
              :max="maxTemperature"
              :step="100"
              class="slider"
            />
            <span class="slider-value">{{ colorTemperature }}K</span>
          </div>
          <small class="help-text">
            {{ getTemperatureDescription(colorTemperature) }} - Set the color
            temperature when button is pressed
          </small>
        </div>

        <div class="form-group">
          <label for="stepSize">Step Size (for dial)</label>
          <div class="slider-container">
            <input
              id="stepSize"
              type="range"
              v-model.number="stepSize"
              min="50"
              max="1000"
              step="50"
              class="slider"
            />
            <span class="slider-value">{{ stepSize }}K</span>
          </div>
          <small class="help-text">
            Temperature change per dial rotation step
          </small>
        </div>

        <div class="form-group">
          <label for="toggleOnPush">
            <input
              id="toggleOnPush"
              type="checkbox"
              v-model="toggleOnPush"
              class="checkbox"
            />
            <span>Toggle on/off with dial push</span>
          </label>
        </div>
      </section>
    </template>
  </BaseActionView>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import type { WarmthActionSettings } from "@shared/types/newActions";
import { websocketService } from "../services/websocketService";
import BaseActionView from "../components/BaseActionView.vue";

// Settings state
const colorTemperature = ref<number>(5000);
const stepSize = ref<number>(200);
const minTemperature = ref<number>(2000);
const maxTemperature = ref<number>(9000);
const toggleOnPush = ref<boolean>(true);

// Component refs
const baseActionRef = ref<InstanceType<typeof BaseActionView>>();

// Event handlers for BaseActionView
const handleLightSelected = (
  _lightId: string,
  _lightModel: string,
  _lightName: string,
) => {
  // BaseActionView handles this, we just need to save settings
  saveSettings();
};

const handleSettingsChanged = (settings: any) => {
  // Handle settings updates from BaseActionView
  console.log("Settings changed:", settings);
};

// Helper function to get temperature description
const getTemperatureDescription = (temp: number): string => {
  if (temp <= 2500) return "Very Warm";
  if (temp <= 3000) return "Warm";
  if (temp <= 4000) return "Neutral Warm";
  if (temp <= 5000) return "Neutral";
  if (temp <= 6000) return "Cool";
  if (temp <= 7000) return "Very Cool";
  return "Extremely Cool";
};

// Settings persistence
const saveSettings = () => {
  if (!baseActionRef.value) return;

  const settings: WarmthActionSettings = {
    targetType: "light",
    colorTemperature: colorTemperature.value,
    stepSize: stepSize.value,
    minTemperature: minTemperature.value,
    maxTemperature: maxTemperature.value,
    toggleOnPush: toggleOnPush.value,
  };

  // Add light-specific settings from BaseActionView
  const selectedLightValue = baseActionRef.value.selectedLight;
  const lightInfo = baseActionRef.value.selectedLightInfo;

  if (selectedLightValue && lightInfo) {
    const [deviceId, model] = selectedLightValue.split("|");
    settings.lightId = deviceId;
    settings.lightModel = model;
    settings.lightName = lightInfo.label;
  }

  // Use BaseActionView's saveSettings method
  baseActionRef.value.saveSettings(settings);
};

// Watch for changes and auto-save
watch(
  [colorTemperature, stepSize, minTemperature, maxTemperature, toggleOnPush],
  () => {
    saveSettings();
  },
);

// Initialize on mount
onMounted(() => {
  const connectWebSocket = () => {
    if (websocketService.isConnected) {
      // Listen for messages from plugin
      websocketService.on("sendToPropertyInspector", (event: any) => {
        // Handle current settings
        if (event.payload?.event === "currentSettings") {
          const settings = event.payload.settings;
          colorTemperature.value = settings.colorTemperature || 5000;
          stepSize.value = settings.stepSize || 200;
          minTemperature.value = settings.minTemperature || 2000;
          maxTemperature.value = settings.maxTemperature || 9000;
          toggleOnPush.value = settings.toggleOnPush !== false;
        }
      });
    } else {
      setTimeout(connectWebSocket, 100);
    }
  };

  connectWebSocket();
});
</script>

<style scoped>
@import "../assets/common.css";

/* Slider styles */
.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 22px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-track {
  height: 6px;
  background: linear-gradient(
    to right,
    #ff6b35 0%,
    #f7931e 25%,
    #fff200 50%,
    #a8e6cf 75%,
    #88d8c0 100%
  );
  border: 1px solid var(--elgato-border, #404040);
  border-radius: 3px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  position: relative;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -7px;
  border: 2px solid var(--elgato-border, #404040);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 2;
}

.slider::-webkit-slider-thumb:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}

.slider::-webkit-slider-thumb:active {
  background: #e0e0e0;
  transform: scale(0.95);
}

/* Firefox support */
.slider::-moz-range-track {
  height: 6px;
  background: linear-gradient(
    to right,
    #ff6b35 0%,
    #f7931e 25%,
    #fff200 50%,
    #a8e6cf 75%,
    #88d8c0 100%
  );
  border: 1px solid var(--elgato-border, #404040);
  border-radius: 3px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  position: relative;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--elgato-border, #404040);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 2;
}

.slider::-moz-range-thumb:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}

.slider::-moz-range-thumb:active {
  background: #e0e0e0;
  transform: scale(0.95);
}

.slider-value {
  min-width: 50px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--elgato-text-secondary);
}

/* Checkbox styles */
.checkbox {
  margin-right: 8px;
  cursor: pointer;
}
</style>
