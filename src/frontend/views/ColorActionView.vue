<template>
  <BaseActionView
    action-type="color"
    config-title="Color Settings"
    action-summary="Change Light Color"
    @light-selected="handleLightSelected"
    @settings-changed="handleSettingsChanged"
    ref="baseActionRef"
  >
    <template #action-config="{ selectedLight, lightInfo }">
      <!-- Color Settings -->
      <section class="config-section">
        <h2>Color Settings</h2>

        <!-- Color Selection Mode -->
        <div class="form-group">
          <label>Color Selection Mode</label>
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                v-model="usePresets"
                :value="true"
                name="colorMode"
              />
              <span>Color Presets</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                v-model="usePresets"
                :value="false"
                name="colorMode"
              />
              <span>Color Wheel</span>
            </label>
          </div>
          <small class="help-text">
            Presets cycle through predefined colors, Color Wheel adjusts hue
            continuously
          </small>
        </div>

        <!-- Current Color -->
        <div class="form-group">
          <label for="currentColor">Current Color</label>
          <div class="color-input-group">
            <input
              id="currentColor"
              v-model="color"
              type="color"
              class="color-input"
            />
            <input
              v-model="color"
              type="text"
              class="form-input color-hex"
              placeholder="#FF0000"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>

        <!-- Color Presets (when usePresets === true) -->
        <div v-if="usePresets" class="form-group">
          <label>Color Presets</label>
          <div class="color-presets">
            <div
              v-for="(preset, index) in colorPresets"
              :key="index"
              class="color-preset"
              :class="{ active: currentPresetIndex === index }"
              :style="{ backgroundColor: preset }"
              @click="selectPreset(index)"
              :title="preset"
            >
              <span v-if="currentPresetIndex === index" class="preset-check"
                >✓</span
              >
            </div>
            <button
              class="btn btn-small btn-secondary"
              @click="addCurrentColorToPresets"
              :disabled="colorPresets.includes(color)"
              title="Add current color to presets"
            >
              +
            </button>
          </div>
          <small class="help-text">
            Click a preset to select it, or use the + button to add the current
            color
          </small>
        </div>

        <!-- Preset Management -->
        <div v-if="usePresets" class="form-group">
          <div class="preset-controls">
            <button
              class="btn btn-small btn-secondary"
              @click="resetToDefaultPresets"
            >
              Reset to Defaults
            </button>
            <button
              class="btn btn-small btn-secondary"
              @click="removeCurrentPreset"
              :disabled="
                colorPresets.length <= 1 ||
                currentPresetIndex >= colorPresets.length
              "
            >
              Remove Selected
            </button>
          </div>
        </div>
      </section>
    </template>
  </BaseActionView>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { ColorActionSettings } from "@shared/types/newActions";
import { websocketService } from "../services/websocketService";
import BaseActionView from "../components/BaseActionView.vue";

// Default color presets - defined first to avoid hoisting issues
const defaultColorPresets = [
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#FFFFFF", // White
];

// Settings state
const color = ref<string>("#FF0000");
const colorPresets = ref<string[]>([...defaultColorPresets]);
const usePresets = ref<boolean>(true);
const currentPresetIndex = ref<number>(0);

// Component refs
const baseActionRef = ref<InstanceType<typeof BaseActionView>>();

// Event handlers for BaseActionView
const handleLightSelected = (
  lightId: string,
  lightModel: string,
  lightName: string,
) => {
  // BaseActionView handles this, we just need to save settings
  saveSettings();
};

const handleSettingsChanged = (settings: any) => {
  // Handle settings updates from BaseActionView
  console.log("Settings changed:", settings);
};

// Color preset actions
const selectPreset = (index: number) => {
  currentPresetIndex.value = index;
  color.value = colorPresets.value[index];
};

const addCurrentColorToPresets = () => {
  if (!colorPresets.value.includes(color.value)) {
    colorPresets.value.push(color.value);
    currentPresetIndex.value = colorPresets.value.length - 1;
  }
};

const removeCurrentPreset = () => {
  if (
    colorPresets.value.length > 1 &&
    currentPresetIndex.value < colorPresets.value.length
  ) {
    colorPresets.value.splice(currentPresetIndex.value, 1);
    currentPresetIndex.value = Math.min(
      currentPresetIndex.value,
      colorPresets.value.length - 1,
    );
    color.value = colorPresets.value[currentPresetIndex.value];
  }
};

const resetToDefaultPresets = () => {
  colorPresets.value = [...defaultColorPresets];
  currentPresetIndex.value = 0;
  color.value = colorPresets.value[0];
};

// Settings persistence
const saveSettings = () => {
  if (!baseActionRef.value) return;

  const settings: ColorActionSettings = {
    targetType: "light",
    color: color.value,
    colorPresets: colorPresets.value,
    usePresets: usePresets.value,
    currentPresetIndex: currentPresetIndex.value,
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
  [color, colorPresets, usePresets, currentPresetIndex],
  () => {
    saveSettings();
  },
  { deep: true },
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
          color.value = settings.color || "#FF0000";
          colorPresets.value = settings.colorPresets || [
            ...defaultColorPresets,
          ];
          usePresets.value =
            settings.usePresets !== undefined ? settings.usePresets : true;
          currentPresetIndex.value = settings.currentPresetIndex || 0;
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

.color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  width: 60px;
  height: 40px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: transparent;
  cursor: pointer;
}

.color-hex {
  flex: 1;
  font-family: monospace;
  text-transform: uppercase;
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.color-preset {
  width: 40px;
  height: 40px;
  border: 2px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
  transition: all 0.2s ease;
}

.color-preset:hover {
  transform: scale(1.1);
}

.color-preset.active {
  border-color: var(--sdpi-color-accent, #0099ff);
  border-width: 3px;
}

.preset-check {
  font-weight: bold;
  font-size: 16px;
}

.preset-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.radio-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
}

.radio-option input[type="radio"] {
  margin: 0;
}
</style>
