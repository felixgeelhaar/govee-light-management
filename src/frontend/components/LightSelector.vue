<template>
  <section class="config-section">
    <h2>Light Selection</h2>

    <div class="form-group">
      <label for="lightSelect">Select Light</label>

      <!-- No API Key State -->
      <div v-if="!hasApiKey" class="state-message">
        <div class="state-icon">🔑</div>
        <p class="help-text">Configure API key first to discover lights</p>
      </div>

      <!-- Initial Discovery State -->
      <div v-else-if="lightDiscovery.isIdle.value" class="state-message">
        <div class="discovery-actions">
          <button
            class="btn btn-primary btn-discover"
            @click="handleDiscoverLights"
            :disabled="isDiscovering"
          >
            <span v-if="isDiscovering" class="loading-spinner-sm"></span>
            {{ isDiscovering ? "Discovering..." : "🔍 Discover Lights" }}
          </button>
          <p class="help-text">Find your Govee lights on the network</p>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-else-if="lightDiscovery.isFetchingLights.value"
        class="state-message"
      >
        <div class="loading-state">
          <div class="loading-spinner-sm"></div>
          <p class="loading-text">Searching for lights...</p>
        </div>
      </div>

      <!-- Light Selection State -->
      <div v-else-if="lightDiscovery.isReady.value" class="selection-state">
        <select
          id="lightSelect"
          :value="selectedLight"
          @input="handleLightSelection($event)"
          class="form-select"
          :disabled="!lightDiscovery.hasFilteredLights.value"
          :class="{ 'has-selection': selectedLight }"
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

        <!-- Action Buttons -->
        <div class="button-group">
          <button
            class="btn btn-secondary btn-small"
            @click="handleRefreshLights"
            :disabled="lightDiscovery.isFetchingLights.value"
            title="Refresh light list"
          >
            <span v-if="lightDiscovery.isFetchingLights.value"
              >Refreshing...</span
            >
            <span v-else>🔄 Refresh</span>
          </button>

          <button
            v-if="selectedLight"
            class="btn btn-accent btn-small"
            @click="handleTestLight"
            :disabled="isTestingLight"
            title="Test selected light"
          >
            <span v-if="isTestingLight">Testing...</span>
            <span v-else>💡 Test Light</span>
          </button>
        </div>

        <!-- Light Count Indicator -->
        <div v-if="lightDiscovery.lights.value.length > 0" class="light-count">
          Found {{ lightDiscovery.lights.value.length }} light{{
            lightDiscovery.lights.value.length !== 1 ? "s" : ""
          }}
        </div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="lightDiscovery.hasError.value"
        class="state-message error-state"
      >
        <div class="state-icon error">⚠️</div>
        <p class="error-text">Failed to discover lights</p>
        <button
          class="btn btn-secondary btn-small"
          @click="handleRetryDiscovery"
        >
          Try Again
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useToastMachine } from "../composables/useToastMachine";
import { websocketService } from "../services/websocketService";

// Props
interface Props {
  hasApiKey: boolean;
  selectedLight: string;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  "update:selectedLight": [value: string];
  lightSelected: [lightId: string, lightModel: string, lightName: string];
}>();

// Composables
const lightDiscovery = useLightDiscovery();
const toast = useToastMachine();

// Local state
const isDiscovering = ref(false);
const isTestingLight = ref(false);

// Computed
const selectedLightInfo = computed(() => {
  if (!props.selectedLight) return null;
  return lightDiscovery.filteredLights.value.find(
    (light) => light.value === props.selectedLight,
  );
});

// Handlers
const handleDiscoverLights = async () => {
  isDiscovering.value = true;
  try {
    toast.showLightDiscovery();
    await lightDiscovery.fetchLights();
  } finally {
    isDiscovering.value = false;
  }
};

const handleRefreshLights = () => {
  toast.showInfo(
    "Refreshing Lights",
    "Discovering available devices...",
    "light-discovery",
  );
  lightDiscovery.refreshLights();
};

const handleRetryDiscovery = () => {
  lightDiscovery.retryFetch();
};

const handleLightSelection = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  emit("update:selectedLight", value);

  if (value) {
    const [lightId, lightModel] = value.split("|");
    const lightName = selectedLightInfo.value?.label || "Unknown Light";
    emit("lightSelected", lightId, lightModel, lightName);
  }
};

const handleTestLight = async () => {
  if (!props.selectedLight || isTestingLight.value) return;

  const [deviceId, model] = props.selectedLight.split("|");
  if (!deviceId || !model) {
    toast.showError(
      "Invalid Light Selection",
      "Please select a valid light from the list",
      "light-test",
    );
    return;
  }

  const lightName = selectedLightInfo.value?.label;
  isTestingLight.value = true;

  let testToastId: string | null = null;

  try {
    toast.dismissCategory("light-test");
    testToastId = toast.showLightTestStart(lightName);

    await websocketService.sendToPlugin({
      event: "testLight",
      deviceId,
      model,
    });

    // Add timeout fallback
    setTimeout(() => {
      if (isTestingLight.value) {
        isTestingLight.value = false;
        if (testToastId) {
          toast.updateToast(testToastId, {
            type: "warning",
            title: "Test Timeout",
            message: "Light test timed out, but light may have still blinked",
            duration: 3000,
          });
        }
      }
    }, 5000);
  } catch (error) {
    isTestingLight.value = false;
    toast.showLightTestError("Failed to send test command", lightName);
  }
};

// Watch for light discovery state changes
watch(
  () => lightDiscovery.state.value,
  (newState, oldState) => {
    if (newState === "fetching" && oldState === "idle") {
      toast.showLightDiscovery();
    } else if (newState === "success" && oldState === "fetching") {
      const lightCount = lightDiscovery.lights.value.length;
      toast.showLightDiscoverySuccess(lightCount);
    } else if (newState === "error") {
      toast.showLightDiscoveryError("Failed to discover lights");
    }
  },
);

// Listen for test results
websocketService.on("sendToPropertyInspector", (data: any) => {
  if (data.payload?.event === "testResult") {
    isTestingLight.value = false;
    const lightName = selectedLightInfo.value?.label;

    if (data.payload.success) {
      toast.showLightTestSuccess(lightName);
    } else {
      toast.showLightTestError(
        data.payload.message || "Failed to control the light",
        lightName,
      );
    }
  }
});
</script>

<style scoped>
/* Light Selector Styles */
.config-section {
  margin-bottom: 24px;
}

.config-section h2 {
  color: var(--sdpi-color-text, #cccccc);
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--sdpi-color-bg-tertiary, #404040);
}

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

/* State Messages */
.state-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-bg-tertiary, #404040);
  border-radius: 8px;
  margin-bottom: 12px;
}

.state-message.error-state {
  border-color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.state-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.state-icon.error {
  color: #dc3545;
}

.help-text {
  color: var(--sdpi-color-text-secondary, #999);
  font-size: 12px;
  margin: 0;
  line-height: 1.4;
}

.error-text {
  color: #dc3545;
  font-size: 13px;
  margin: 0;
  font-weight: 500;
}

/* Discovery Actions */
.discovery-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.btn-discover {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.loading-text {
  color: var(--sdpi-color-text, #cccccc);
  font-size: 13px;
  margin: 0;
}

.loading-spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid var(--sdpi-color-accent, #0099ff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Selection State */
.selection-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-select {
  /* Inherit all form-select styling from common.css */
}

.form-select.has-selection {
  border-color: #28a745;
}

/* Button Group */
.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.btn-primary {
  background: var(--sdpi-color-accent, #0099ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0088cc;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--sdpi-color-bg-tertiary, #404040);
  color: var(--sdpi-color-text, #cccccc);
}

.btn-secondary:hover:not(:disabled) {
  background: #505050;
  transform: translateY(-1px);
}

.btn-accent {
  background: #28a745;
  color: white;
}

.btn-accent:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.btn-small {
  padding: 6px 12px;
  font-size: 11px;
  min-height: 32px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Light Count */
.light-count {
  color: var(--sdpi-color-text-secondary, #999);
  font-size: 11px;
  text-align: center;
  padding: 4px 8px;
  background: var(--sdpi-color-bg-tertiary, #404040);
  border-radius: 4px;
  align-self: center;
}

/* Mobile Responsive */
@media (max-width: 480px) {
  .state-message {
    padding: 12px;
    gap: 8px;
  }

  .button-group {
    justify-content: center;
  }

  .btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
