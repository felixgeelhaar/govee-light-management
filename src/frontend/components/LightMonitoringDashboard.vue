<template>
  <div class="monitoring-dashboard">
    <div class="dashboard-header">
      <h3>Light Monitoring</h3>
      <div class="dashboard-controls">
        <button
          v-if="!monitoring.isMonitoring.value"
          class="btn btn-primary"
          :disabled="monitoredLightIds.length === 0"
          @click="startMonitoring"
        >
          Start Monitoring
        </button>
        <button v-else class="btn btn-secondary" @click="stopMonitoring">
          Stop Monitoring
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!monitoring.isMonitoring.value"
          @click="syncStates"
        >
          Sync Now
        </button>
      </div>
    </div>

    <!-- Monitoring Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.monitoredCount }}</div>
        <div class="stat-label">Monitored</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.onlineCount }}</div>
        <div class="stat-label">Online</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.offlineCount }}</div>
        <div class="stat-label">Offline</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.changeCount }}</div>
        <div class="stat-label">Changes</div>
      </div>
    </div>

    <!-- Light Selection -->
    <div class="monitoring-section">
      <h4>Monitored Lights</h4>
      <div class="light-selection">
        <div
          v-for="light in availableLights"
          :key="light.value"
          class="light-checkbox"
        >
          <label>
            <input
              v-model="monitoredLightIds"
              type="checkbox"
              :value="light.value"
            />
            <span class="checkmark"></span>
            {{ light.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- Light States -->
    <div v-if="monitoring.isMonitoring.value" class="monitoring-section">
      <h4>Current States</h4>
      <div class="light-states">
        <div
          v-for="state in lightStates"
          :key="state.deviceId"
          :class="['light-state-card', { offline: !state.isOnline }]"
        >
          <div class="light-state-header">
            <span class="light-name">{{ state.name }}</span>
            <div class="light-status">
              <span
                :class="[
                  'status-indicator',
                  state.isOnline ? 'online' : 'offline',
                ]"
              ></span>
              <span class="status-text">
                {{ state.isOnline ? "Online" : "Offline" }}
              </span>
            </div>
          </div>

          <div v-if="state.isOnline" class="light-state-details">
            <div class="state-row">
              <span class="state-label">Power:</span>
              <span :class="['power-state', state.powerState ? 'on' : 'off']">
                {{ state.powerState ? "On" : "Off" }}
              </span>
            </div>

            <div v-if="state.brightness !== undefined" class="state-row">
              <span class="state-label">Brightness:</span>
              <span class="state-value">{{ state.brightness }}%</span>
            </div>

            <div v-if="state.color" class="state-row">
              <span class="state-label">Color:</span>
              <div
                class="color-preview"
                :style="{
                  backgroundColor: `rgb(${state.color.r}, ${state.color.g}, ${state.color.b})`,
                }"
              ></div>
            </div>

            <div v-if="state.colorTemperature" class="state-row">
              <span class="state-label">Temperature:</span>
              <span class="state-value">{{ state.colorTemperature }}K</span>
            </div>

            <div class="state-row">
              <span class="state-label">Last Updated:</span>
              <span class="state-value">{{
                formatTime(state.lastUpdated)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Changes -->
    <div
      v-if="monitoring.isMonitoring.value && recentChanges.length > 0"
      class="monitoring-section"
    >
      <h4>Recent Changes</h4>
      <div class="changes-list">
        <div
          v-for="change in recentChanges.slice(0, 10)"
          :key="`${change.deviceId}-${change.timestamp}`"
          class="change-item"
        >
          <div class="change-light">{{ getLightName(change.deviceId) }}</div>
          <div class="change-details">
            <span class="change-property">{{
              formatProperty(change.property)
            }}</span>
            changed from
            <span class="change-old">{{ formatValue(change.oldValue) }}</span>
            to
            <span class="change-new">{{ formatValue(change.newValue) }}</span>
          </div>
          <div class="change-time">
            {{ formatRelativeTime(change.timestamp) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration -->
    <div class="monitoring-section">
      <h4>Configuration</h4>
      <div class="config-grid">
        <div class="config-item">
          <label for="pollInterval">Poll Interval (seconds)</label>
          <input
            id="pollInterval"
            v-model.number="configPollInterval"
            type="number"
            min="10"
            max="300"
            class="form-input"
            @change="updateConfig"
          />
        </div>
        <div class="config-item">
          <label>
            <input
              v-model="configChangeDetection"
              type="checkbox"
              @change="updateConfig"
            />
            Enable Change Detection
          </label>
        </div>
        <div class="config-item">
          <label>
            <input
              v-model="configAutoSync"
              type="checkbox"
              @change="updateConfig"
            />
            Enable Auto Sync
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * LightMonitoringDashboard Component
 *
 * A comprehensive dashboard for monitoring Govee light states in real-time.
 * Provides light selection, state tracking, change detection, and configuration
 * for polling intervals and synchronization.
 *
 * Features:
 * - Real-time light state monitoring with configurable poll intervals
 * - Light selection with multi-select checkboxes
 * - Current state display showing power, brightness, color, and temperature
 * - Change detection and recent changes log
 * - Online/offline status indicators
 * - Configurable auto-sync and change detection settings
 * - Color preview for RGB values
 *
 * @example Basic Usage
 * ```vue
 * <template>
 *   <LightMonitoringDashboard />
 * </template>
 * ```
 *
 * @example In a Property Inspector
 * ```vue
 * <template>
 *   <ApiConfigSection v-model="settings.apiKey" />
 *   <LightMonitoringDashboard v-if="apiConnection.isConnected" />
 * </template>
 * ```
 */
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  useLightMonitoring,
  type LightStateChange,
} from "../services/lightMonitoringService";
import { useLightDiscovery } from "../composables/useLightDiscovery";
import { useFeedbackHelpers } from "../composables/useFeedback";

// Composables
/** Light monitoring service for state tracking */
const monitoring = useLightMonitoring();
/** Light discovery composable for fetching available lights */
const lightDiscovery = useLightDiscovery();
/** Feedback helpers for toast notifications */
const feedback = useFeedbackHelpers();

// Local state
/** Array of light IDs currently selected for monitoring */
const monitoredLightIds = ref<string[]>([]);
/** Poll interval in seconds (10-300) */
const configPollInterval = ref(30);
/** Whether to detect and report state changes */
const configChangeDetection = ref(true);
/** Whether to automatically sync states periodically */
const configAutoSync = ref(true);

// Computed values
/** Aggregated monitoring statistics (monitored count, online/offline counts, changes) */
const stats = computed(() => monitoring.monitoringStats.value);
/** Current state of all monitored lights */
const lightStates = computed(() =>
  Object.values(monitoring.getAllLightStates()),
);
/** List of recent state changes for change log */
const recentChanges = computed(() => monitoring.getRecentChanges());
/** Available lights from discovery for selection */
const availableLights = computed(() => lightDiscovery.filteredLights.value);

// Change subscriptions
/** Map of device IDs to their change subscription unsubscribe functions */
const changeUnsubscribers = new Map<string, () => void>();

// Methods
/**
 * Starts monitoring the selected lights
 * Sets up state polling and change detection subscriptions
 * @async
 */
const startMonitoring = async () => {
  if (monitoredLightIds.value.length === 0) {
    feedback.showWarning(
      "No Lights Selected",
      "Please select lights to monitor",
    );
    return;
  }

  try {
    await monitoring.startMonitoring(monitoredLightIds.value, {
      pollInterval: configPollInterval.value * 1000,
      enableChangeDetection: configChangeDetection.value,
      enableAutoSync: configAutoSync.value,
    });

    // Subscribe to changes for each monitored light
    monitoredLightIds.value.forEach((lightId) => {
      const deviceId = lightId.split("|")[0];
      const unsubscribe = monitoring.onStateChange(deviceId, handleStateChange);
      changeUnsubscribers.set(deviceId, unsubscribe);
    });

    feedback.showSuccessToast(
      "Monitoring Started",
      `Started monitoring ${monitoredLightIds.value.length} lights`,
    );
  } catch (error) {
    feedback.showApiError(error, "Failed to Start Monitoring");
  }
};

/**
 * Stops all active monitoring
 * Cleans up change subscriptions and resets state
 */
const stopMonitoring = () => {
  monitoring.stopMonitoring();

  // Unsubscribe from change notifications
  changeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  changeUnsubscribers.clear();

  feedback.showInfo("Monitoring Stopped", "Light monitoring has been stopped");
};

/**
 * Manually synchronizes all monitored light states
 * @async
 */
const syncStates = async () => {
  try {
    await monitoring.syncLightStates();
    feedback.showSuccessToast(
      "States Synced",
      "Light states have been synchronized",
    );
  } catch (error) {
    feedback.showApiError(error, "Failed to Sync States");
  }
};

/**
 * Updates monitoring configuration with current settings
 */
const updateConfig = () => {
  monitoring.updateConfig({
    pollInterval: configPollInterval.value * 1000,
    enableChangeDetection: configChangeDetection.value,
    enableAutoSync: configAutoSync.value,
  });
};

/**
 * Handles state change events and shows notification
 * @param change - The state change event details
 */
const handleStateChange = (change: LightStateChange) => {
  const lightName = getLightName(change.deviceId);
  const property = formatProperty(change.property);
  const newValue = formatValue(change.newValue);

  feedback.showInfo(
    "Light State Changed",
    `${lightName}: ${property} changed to ${newValue}`,
  );
};

// Utility methods
/**
 * Gets the display name for a light by device ID
 * @param deviceId - The device ID to look up
 * @returns The light's display name or the device ID if not found
 */
const getLightName = (deviceId: string): string => {
  const light = availableLights.value.find((l) => l.value.startsWith(deviceId));
  return light ? light.label.split(" (")[0] : deviceId;
};

/**
 * Formats a property name for display
 * @param property - The raw property name
 * @returns Human-readable property name
 */
const formatProperty = (property: string): string => {
  const propertyMap: Record<string, string> = {
    powerState: "Power",
    brightness: "Brightness",
    color: "Color",
    colorTemperature: "Color Temperature",
    isOnline: "Online Status",
  };
  return propertyMap[property] || property;
};

/**
 * Formats a value for display, handling various types
 * @param value - The value to format
 * @returns Formatted string representation
 */
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "object" && value.r !== undefined) {
    return `RGB(${value.r}, ${value.g}, ${value.b})`;
  }
  return String(value);
};

/**
 * Formats a timestamp for display
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

/**
 * Formats a timestamp as relative time (e.g., "5m ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

// Watch for light discovery
watch(
  () => lightDiscovery.isReady.value,
  (isReady) => {
    if (isReady && !lightDiscovery.isFetchingLights.value) {
      // Auto-fetch lights if not already loaded
      if (lightDiscovery.lights.value.length === 0) {
        lightDiscovery.fetchLights();
      }
    }
  },
  { immediate: true },
);

// Lifecycle
onMounted(() => {
  // Load lights if not already loaded
  if (lightDiscovery.isIdle.value) {
    lightDiscovery.fetchLights();
  }
});

onUnmounted(() => {
  // Clean up monitoring
  if (monitoring.isMonitoring.value) {
    monitoring.stopMonitoring();
  }

  // Clean up subscriptions
  changeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  changeUnsubscribers.clear();
});
</script>

<style scoped>
.monitoring-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sdpi-color-border, #333);
}

.dashboard-header h3 {
  margin: 0;
  color: var(--sdpi-color-accent, #0099ff);
}

.dashboard-controls {
  display: flex;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.stat-card {
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--sdpi-color-accent, #0099ff);
}

.stat-label {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  margin-top: 4px;
}

.monitoring-section {
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  padding: 16px;
}

.monitoring-section h4 {
  margin: 0 0 16px 0;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 14px;
  font-weight: 600;
}

.light-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.light-checkbox {
  display: flex;
  align-items: center;
}

.light-checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
}

.light-checkbox input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sdpi-color-border, #333);
  border-radius: 3px;
  position: relative;
  transition: all 0.2s ease;
}

.light-checkbox input[type="checkbox"]:checked + .checkmark {
  background: var(--sdpi-color-accent, #0099ff);
  border-color: var(--sdpi-color-accent, #0099ff);
}

.light-checkbox input[type="checkbox"]:checked + .checkmark:after {
  content: "✓";
  position: absolute;
  top: -2px;
  left: 2px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.light-states {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.light-state-card {
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 6px;
  padding: 12px;
}

.light-state-card.offline {
  opacity: 0.6;
  border-color: var(--sdpi-color-border-error, #dc3545);
}

.light-state-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.light-name {
  font-weight: 600;
  color: var(--sdpi-color-text, #cccccc);
}

.light-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #28a745;
}

.status-indicator.offline {
  background: #dc3545;
}

.status-text {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
}

.light-state-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.state-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.state-label {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
}

.state-value {
  font-size: 12px;
  color: var(--sdpi-color-text, #cccccc);
}

.power-state.on {
  color: #28a745;
  font-weight: 500;
}

.power-state.off {
  color: #dc3545;
}

.color-preview {
  width: 20px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--sdpi-color-border, #333);
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.change-item {
  padding: 8px;
  background: var(--sdpi-color-bg, #1e1e1e);
  border-radius: 4px;
  border-left: 3px solid var(--sdpi-color-accent, #0099ff);
}

.change-light {
  font-weight: 500;
  font-size: 12px;
  color: var(--sdpi-color-text, #cccccc);
}

.change-details {
  font-size: 11px;
  color: var(--sdpi-color-text-secondary, #999);
  margin: 2px 0;
}

.change-property {
  font-weight: 500;
  color: var(--sdpi-color-accent, #0099ff);
}

.change-old {
  color: #dc3545;
}

.change-new {
  color: #28a745;
  font-weight: 500;
}

.change-time {
  font-size: 10px;
  color: var(--sdpi-color-text-secondary, #999);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.config-item label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--sdpi-color-text, #cccccc);
}

.config-item input[type="checkbox"] {
  width: auto;
}

/* Button styles */
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
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
  color: white;
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

.form-input {
  padding: 6px 8px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
  font-size: 12px;
}

.form-input:focus {
  outline: none;
  border-color: var(--sdpi-color-accent, #0099ff);
}
</style>
