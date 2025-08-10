<template>
  <BaseActionView
    action-type="toggle"
    config-title="Button Action"
    :action-summary="actionSummary"
    @light-selected="handleLightSelected"
    @settings-changed="handleSettingsChanged"
  >
    <template #action-config="{ selectedLight }">
      <div class="form-group">
        <label for="operation">When Pressed</label>
        <select id="operation" v-model="operation" class="form-select">
          <option value="toggle">Toggle On/Off</option>
          <option value="on">Always Turn On</option>
          <option value="off">Always Turn Off</option>
        </select>
        <small class="help-text">
          Choose what happens when the Stream Deck button is pressed
        </small>
      </div>
    </template>

    <template #summary-items>
      <div class="summary-item">
        <span class="summary-label">Operation:</span>
        <span class="summary-value">{{ operationLabel }}</span>
      </div>
    </template>

    <template #help-content>
      <p>
        This action controls your Govee light when you press the Stream Deck
        button.
      </p>
      <ul>
        <li>
          <strong>Toggle:</strong> Switches the light on/off based on current
          state
        </li>
        <li>
          <strong>Always Turn On:</strong> Ensures the light is always turned on
        </li>
        <li>
          <strong>Always Turn Off:</strong> Ensures the light is always turned
          off
        </li>
      </ul>
      <p>
        <em>Note:</em> The light will show a brief flash when tested to confirm
        connectivity.
      </p>
    </template>
  </BaseActionView>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import BaseActionView from "../components/BaseActionView.vue";

// Local state
const operation = ref<"toggle" | "on" | "off">("toggle");
const selectedLightId = ref("");
const selectedLightModel = ref("");
const selectedLightName = ref("");

// Computed properties
const actionSummary = computed(() => {
  const operationText = operationLabel.value;
  return selectedLightName.value
    ? `${operationText} ${selectedLightName.value}`
    : operationText;
});

const operationLabel = computed(() => {
  switch (operation.value) {
    case "toggle":
      return "Toggle On/Off";
    case "on":
      return "Always Turn On";
    case "off":
      return "Always Turn Off";
    default:
      return "Toggle On/Off";
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

const handleSettingsChanged = (_settings: any) => {
  // Settings are automatically saved by BaseActionView
};

const saveSettings = () => {
  const settings: any = {
    operation: operation.value,
    targetType: "light",
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
watch([operation], () => {
  if (selectedLightId.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.form-group {
  margin-bottom: 16px;
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
</style>
