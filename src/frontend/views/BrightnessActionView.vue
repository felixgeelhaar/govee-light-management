<template>
  <BaseActionView
    action-type="brightness"
    config-title="Brightness Settings"
    :action-summary="actionSummary"
    @light-selected="handleLightSelected"
    @settings-changed="handleSettingsChanged"
  >
    <template #action-config="{ selectedLight }">
      <div class="form-group">
        <label for="brightness">Default Brightness</label>
        <div class="slider-container">
          <input
            id="brightness"
            v-model.number="brightness"
            type="range"
            min="1"
            max="100"
            step="1"
            class="slider"
          />
          <div class="slider-value">{{ brightness }}%</div>
        </div>
        <small class="help-text">
          Set the brightness level when this action is triggered
        </small>
      </div>

      <div class="form-group">
        <label for="operation">Action Type</label>
        <select id="operation" v-model="operation" class="form-select">
          <option value="set">Set Specific Brightness</option>
          <option value="increase">Increase Brightness</option>
          <option value="decrease">Decrease Brightness</option>
        </select>
        <small class="help-text">
          Choose how this action affects the light brightness
        </small>
      </div>

      <div v-if="operation !== 'set'" class="form-group">
        <label for="increment"
          >{{
            operation === "increase" ? "Increase" : "Decrease"
          }}
          Amount</label
        >
        <div class="slider-container">
          <input
            id="increment"
            v-model.number="increment"
            type="range"
            min="5"
            max="50"
            step="5"
            class="slider"
          />
          <div class="slider-value">{{ increment }}%</div>
        </div>
        <small class="help-text">
          How much to
          {{ operation === "increase" ? "increase" : "decrease" }} brightness by
        </small>
      </div>
    </template>

    <template #summary-items>
      <div class="summary-item">
        <span class="summary-label">Operation:</span>
        <span class="summary-value">{{ operationLabel }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{
          operation === "set" ? "Brightness:" : "Amount:"
        }}</span>
        <span class="summary-value">{{
          operation === "set" ? `${brightness}%` : `${increment}%`
        }}</span>
      </div>
    </template>

    <template #help-content>
      <p>This action controls the brightness of your Govee light.</p>
      <ul>
        <li>
          <strong>Set Specific:</strong> Sets the light to an exact brightness
          level
        </li>
        <li>
          <strong>Increase:</strong> Makes the light brighter by the specified
          amount
        </li>
        <li>
          <strong>Decrease:</strong> Makes the light dimmer by the specified
          amount
        </li>
      </ul>
      <p><em>Tips:</em></p>
      <ul>
        <li>
          Brightness values range from 1% (very dim) to 100% (maximum
          brightness)
        </li>
        <li>If the light is off, setting brightness will turn it on</li>
        <li>Increase/decrease actions won't exceed the 1-100% range</li>
      </ul>
    </template>
  </BaseActionView>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import BaseActionView from "../components/BaseActionView.vue";

// Local state
const operation = ref<"set" | "increase" | "decrease">("set");
const brightness = ref(75);
const increment = ref(20);
const selectedLightId = ref("");
const selectedLightModel = ref("");
const selectedLightName = ref("");

// Computed properties
const actionSummary = computed(() => {
  let action = "";
  switch (operation.value) {
    case "set":
      action = `Set brightness to ${brightness.value}%`;
      break;
    case "increase":
      action = `Increase brightness by ${increment.value}%`;
      break;
    case "decrease":
      action = `Decrease brightness by ${increment.value}%`;
      break;
  }
  return selectedLightName.value
    ? `${action} on ${selectedLightName.value}`
    : action;
});

const operationLabel = computed(() => {
  switch (operation.value) {
    case "set":
      return "Set Specific Brightness";
    case "increase":
      return "Increase Brightness";
    case "decrease":
      return "Decrease Brightness";
    default:
      return "Set Specific Brightness";
  }
});

// Event handlers
const handleLightSelected = (
  lightId: string,
  lightModel: string,
  lightName: string,
) => {
  selectedLightId.value = lightId;
  selectedLightModel.value = lightModel;
  selectedLightName.value = lightName;
  saveSettings();
};

const handleSettingsChanged = (settings: any) => {
  // Settings are automatically saved by BaseActionView
};

const saveSettings = () => {
  const settings: any = {
    operation: operation.value,
    brightness: brightness.value,
    increment: increment.value,
  };

  if (selectedLightId.value && selectedLightModel.value) {
    settings.lightId = selectedLightId.value;
    settings.lightModel = selectedLightModel.value;
    settings.lightName = selectedLightName.value;
  }

  // Emit to BaseActionView for saving
  handleSettingsChanged(settings);
};

// Watch for changes to save settings
watch([operation, brightness, increment], () => {
  if (selectedLightId.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.form-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-bg-tertiary, #404040);
  border-radius: 6px;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 13px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: var(--sdpi-color-accent, #0099ff);
  box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.1);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--sdpi-color-bg-tertiary, #404040);
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: #0088cc;
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider-value {
  min-width: 45px;
  text-align: center;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 14px;
  font-weight: 600;
  background: var(--sdpi-color-bg-tertiary, #404040);
  padding: 6px 8px;
  border-radius: 4px;
}

.help-text {
  color: var(--sdpi-color-text-secondary, #999);
  font-size: 12px;
  margin-top: 6px;
  line-height: 1.4;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.summary-label {
  color: var(--sdpi-color-text-secondary, #999);
  font-size: 12px;
  font-weight: 500;
}

.summary-value {
  color: var(--sdpi-color-text, #cccccc);
  font-size: 13px;
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .slider-container {
    gap: 8px;
  }

  .slider-value {
    min-width: 40px;
    font-size: 13px;
    padding: 5px 6px;
  }
}
</style>
