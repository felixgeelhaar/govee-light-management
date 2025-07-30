<template>
  <div class="light-control-view">
    <!-- API Configuration Section -->
    <section class="config-section" data-testid="api-key-section">
      <h2>API Configuration</h2>
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <input
          id="apiKey"
          v-model="apiKey"
          type="password"
          class="form-input"
          placeholder="Enter your Govee API key"
          autocomplete="off"
        />
        <small class="help-text">
          Get your API key from the Govee Home app → Settings → About Us → Apply for API Key
        </small>
      </div>
    </section>

    <!-- Light Selection Section -->
    <section class="config-section" data-testid="light-selection-section">
      <h2>Light Selection</h2>
      <div class="form-group">
        <label for="lightSelect">Light</label>
        <select
          id="lightSelect"
          v-model="selectedLight"
          class="form-select"
          :disabled="!apiKey"
        >
          <option value="" disabled>Select a light...</option>
          <option
            v-for="light in availableLights"
            :key="light.value"
            :value="light.value"
          >
            {{ light.label }}
          </option>
        </select>
      </div>
    </section>

    <!-- Control Mode Section -->
    <section class="config-section" data-testid="control-mode-section">
      <h2>Control Mode</h2>
      <div class="form-group">
        <label for="controlMode">Control Mode</label>
        <select
          id="controlMode"
          v-model="controlMode"
          class="form-select"
        >
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
import { ref, computed } from 'vue'
import type { LightControlSettings, ControlMode } from '@shared/types'

// Reactive state
const apiKey = ref<string>('')
const selectedLight = ref<string>('')
const controlMode = ref<ControlMode>('toggle')
const brightnessValue = ref<number>(100)
const colorValue = ref<string>('#ffffff')
const colorTempValue = ref<number>(6500)

// Mock data for now - will be replaced with actual API calls
const availableLights = ref([
  { label: 'Living Room Light (H6054)', value: 'device1|H6054' },
  { label: 'Bedroom Strip (H6072)', value: 'device2|H6072' },
])

// Computed settings object
const settings = computed<LightControlSettings>(() => ({
  apiKey: apiKey.value || undefined,
  selectedDeviceId: selectedLight.value.split('|')[0] || undefined,
  selectedModel: selectedLight.value.split('|')[1] || undefined,
  controlMode: controlMode.value,
  brightnessValue: controlMode.value === 'brightness' ? brightnessValue.value : undefined,
  colorValue: controlMode.value === 'color' ? colorValue.value : undefined,
  colorTempValue: controlMode.value === 'colorTemp' ? colorTempValue.value : undefined,
}))

// TODO: Implement WebSocket communication with Stream Deck plugin
// TODO: Implement API key validation
// TODO: Implement light discovery
// TODO: Implement settings persistence
</script>

<style scoped>
.light-control-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  padding: 16px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  background-color: var(--sdpi-color-bg-secondary, #2d2d30);
}

.config-section h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sdpi-color-accent, #0099ff);
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

.help-text {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.4;
}
</style>