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
          :disabled="!apiConnection.isConnected.value || apiConnection.isConnecting.value"
          @click="lightDiscovery.fetchLights"
        >
          {{ apiConnection.isConnecting.value ? "Connecting..." : "Discover RGB IC Segment Lights" }}
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
          No RGB IC segment lights found. Make sure your lights support segment
          color control.
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
          <span
            class="color-preview"
            :style="{ backgroundColor: currentColorHex }"
          ></span>
        </label>
        <input
          id="hue"
          v-model.number="hue"
          type="range"
          min="0"
          max="360"
          step="1"
          class="form-range"
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
        />
        <small class="help-text"> Overall brightness (0-100%) </small>
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
      />

      <div class="help-section">
        <h3>How to Use:</h3>
        <ul class="help-list">
          <li>
            <strong>Rotate Dial:</strong> Adjust hue (color) of the segment
          </li>
          <li>
            <strong>Press Dial:</strong> Apply current color to selected segment
          </li>
          <li>
            <strong>Display:</strong> Shows rainbow gradient and current color
          </li>
          <li>
            <strong>Full Spectrum:</strong> 360° hue range covers all colors
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useApiConnection } from "../composables/useApiConnection";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useSegmentColorDialSettings } from "../composables/useSettings";
import { useFeedbackHelpers } from "../composables/useFeedback";
import ApiConfigSection from "../components/ApiConfigSection.vue";
import FormInput from "../components/FormInput.vue";
import "../styles/property-inspector.css";

// Settings management with auto-save
const settingsManager = useSegmentColorDialSettings();

// API Connection composable
const apiConnection = useApiConnection();

// Light Discovery composable
const lightDiscovery = useLightDiscovery();

// Feedback system for user notifications
const feedback = useFeedbackHelpers();

// Explicitly extract lights array for template (helps TypeScript)
const lightsArray = computed(() => lightDiscovery.lights.value);

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

const segmentIndex = computed({
  get: () => settingsManager.settings.segmentIndex ?? 0,
  set: (value: number) => settingsManager.updateSetting("segmentIndex", value),
});

const hue = computed({
  get: () => settingsManager.settings.hue ?? 0,
  set: (value: number) => settingsManager.updateSetting("hue", value),
});

const saturation = computed({
  get: () => settingsManager.settings.saturation ?? 100,
  set: (value: number) => settingsManager.updateSetting("saturation", value),
});

const brightness = computed({
  get: () => settingsManager.settings.brightness ?? 100,
  set: (value: number) => settingsManager.updateSetting("brightness", value),
});

const stepSize = computed({
  get: () => settingsManager.settings.stepSize ?? 15,
  set: (value: number) => settingsManager.updateSetting("stepSize", value),
});

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

  let r = 0,
    g = 0,
    b = 0;
  const hSextant = Math.floor(hNorm * 6);

  if (hSextant === 0) {
    r = c;
    g = x;
    b = 0;
  } else if (hSextant === 1) {
    r = x;
    g = c;
    b = 0;
  } else if (hSextant === 2) {
    r = 0;
    g = c;
    b = x;
  } else if (hSextant === 3) {
    r = 0;
    g = x;
    b = c;
  } else if (hSextant === 4) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

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
  // Trigger the setter which will auto-save via the composable
  selectedLight.value = selectedLight.value;
}

// Watch for API connection success
watch(
  () => apiConnection.isConnected.value,
  (isConnected, wasConnected) => {
    if (isConnected && !wasConnected) {
      feedback.showConnectionSuccess("Govee API");
      // Auto-fetch lights when connected
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
      feedback.showConnectionError(
        { message: error },
        () => apiConnection.retry(),
      );
    }
  },
);

// Watch for light discovery success
watch(
  () => lightDiscovery.isReady.value,
  (isReady, wasReady) => {
    if (isReady && !wasReady && lightDiscovery.hasLights.value) {
      feedback.showDiscoverySuccess(lightDiscovery.lights.value.length);
    }
  },
);

// Watch for light discovery errors
watch(
  () => lightDiscovery.error.value,
  (error) => {
    if (error) {
      feedback.showDiscoveryError(
        { message: error },
        () => lightDiscovery.retryFetch(),
      );
    }
  },
);

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

/* SegmentColorDialView-specific styles */
.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid var(--sdpi-color-border, #333);
  display: inline-block;
}
</style>
