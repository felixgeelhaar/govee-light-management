<template>
  <div class="segment-color-dial-view">
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
          Discover RGB IC Segment Lights
        </button>
        <small class="help-text">
          Only RGB IC lights with segment control will be shown
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
          No RGB IC segment lights found. Make sure your lights support segment color control.
        </small>
      </div>
    </section>

    <!-- Segment Configuration Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Segment Configuration</h2>

      <div class="form-group">
        <label for="segmentIndex">Segment Number</label>
        <select
          id="segmentIndex"
          v-model.number="segmentIndex"
          class="form-select"
          @change="saveSettings"
        >
          <option :value="0">Segment 1</option>
          <option :value="1">Segment 2</option>
          <option :value="2">Segment 3</option>
          <option :value="3">Segment 4</option>
          <option :value="4">Segment 5</option>
          <option :value="5">Segment 6</option>
          <option :value="6">Segment 7</option>
          <option :value="7">Segment 8</option>
          <option :value="8">Segment 9</option>
          <option :value="9">Segment 10</option>
          <option :value="10">Segment 11</option>
          <option :value="11">Segment 12</option>
          <option :value="12">Segment 13</option>
          <option :value="13">Segment 14</option>
          <option :value="14">Segment 15</option>
        </select>
        <small class="help-text">
          Select which segment (1-15) to control with this dial
        </small>
      </div>
    </section>

    <!-- Color Configuration Section -->
    <section v-if="selectedLight" class="config-section">
      <h2>Color Configuration</h2>

      <div class="form-group">
        <label for="hue">
          Hue: {{ hue }}°
          <span class="color-preview" :style="{ backgroundColor: currentColorHex }"></span>
        </label>
        <input
          id="hue"
          v-model.number="hue"
          type="range"
          min="0"
          max="360"
          step="1"
          class="form-range"
          @input="saveSettings"
        />
        <small class="help-text">
          Initial hue value (0-360°) - can be adjusted via dial rotation
        </small>
      </div>

      <div class="form-group">
        <label for="saturation">Saturation: {{ saturation }}%</label>
        <input
          id="saturation"
          v-model.number="saturation"
          type="range"
          min="0"
          max="100"
          step="5"
          class="form-range"
          @input="saveSettings"
        />
        <small class="help-text">
          Color intensity (0-100%) - 0% = white, 100% = full color
        </small>
      </div>

      <div class="form-group">
        <label for="brightness">Brightness: {{ brightness }}%</label>
        <input
          id="brightness"
          v-model.number="brightness"
          type="range"
          min="0"
          max="100"
          step="5"
          class="form-range"
          @input="saveSettings"
        />
        <small class="help-text">
          Overall brightness (0-100%)
        </small>
      </div>

      <FormInput
        id="stepSize"
        v-model="stepSize"
        label="Dial Step Size (° per tick)"
        type="number"
        :min="1"
        :max="90"
        :required="true"
        help-text="Each rotation tick will adjust hue by this amount (1-90°)"
        @update:model-value="() => saveSettings()"
      />

      <div class="help-section">
        <h3>How to Use:</h3>
        <ul class="help-list">
          <li><strong>Rotate Dial:</strong> Adjust hue (color) of the segment</li>
          <li><strong>Press Dial:</strong> Apply current color to selected segment</li>
          <li><strong>Display:</strong> Shows rainbow gradient and current color</li>
          <li><strong>Full Spectrum:</strong> 360° hue range covers all colors</li>
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

// API Connection composable
const apiConnection = useApiConnection();
const localApiKey = ref("");

// Light Discovery composable
const lightDiscovery = useLightDiscovery();
const selectedLight = ref("");

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

// Segment configuration
const segmentIndex = ref(0);

// Color configuration
const hue = ref(0);
const saturation = ref(100);
const brightness = ref(100);
const stepSize = ref(15);

// Compute current color for preview
const currentColorHex = computed(() => {
  return hsvToHex(hue.value, saturation.value, brightness.value);
});

// HSV to RGB to Hex conversion
function hsvToHex(h: number, s: number, v: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const vNorm = v / 100;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;
  const hSextant = Math.floor(hNorm * 6);

  if (hSextant === 0) { r = c; g = x; b = 0; }
  else if (hSextant === 1) { r = x; g = c; b = 0; }
  else if (hSextant === 2) { r = 0; g = c; b = x; }
  else if (hSextant === 3) { r = 0; g = x; b = c; }
  else if (hSextant === 4) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const rInt = Math.round((r + m) * 255);
  const gInt = Math.round((g + m) * 255);
  const bInt = Math.round((b + m) * 255);

  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(rInt)}${toHex(gInt)}${toHex(bInt)}`;
}

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
  const settings = {
    apiKey: localApiKey.value,
    selectedDeviceId: updates.selectedDeviceId,
    selectedModel: updates.selectedModel,
    selectedLightName: updates.selectedLightName,
    segmentIndex: segmentIndex.value,
    hue: hue.value,
    saturation: saturation.value,
    brightness: brightness.value,
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

  if (settings.segmentIndex !== undefined) {
    segmentIndex.value = settings.segmentIndex;
  }

  if (settings.hue !== undefined) {
    hue.value = settings.hue;
  }

  if (settings.saturation !== undefined) {
    saturation.value = settings.saturation;
  }

  if (settings.brightness !== undefined) {
    brightness.value = settings.brightness;
  }

  if (settings.stepSize !== undefined) {
    stepSize.value = settings.stepSize;
  }
});

// Auto-save settings when changed
watch([segmentIndex, hue, saturation, brightness, stepSize], () => {
  if (selectedLight.value) {
    saveSettings();
  }
});
</script>

<style scoped>
.segment-color-dial-view {
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
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--sdpi-color-text, #cccccc);
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid var(--sdpi-color-border, #333);
  display: inline-block;
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
  height: 6px;
  border-radius: 3px;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  outline: none;
  -webkit-appearance: none;
}

.form-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
}

.form-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--sdpi-color-accent, #0099ff);
  cursor: pointer;
  border: none;
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
