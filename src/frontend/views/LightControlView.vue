<template>
  <div class="light-control-view">
    <!-- API Configuration Section -->
    <section class="config-section" data-testid="api-key-section">
      <h2>API Configuration</h2>
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <div class="input-group">
          <input
            id="apiKey"
            v-model="localApiKey"
            type="password"
            class="form-input"
            placeholder="Enter your Govee API key"
            autocomplete="off"
            :disabled="apiConnection.isConnecting"
            @keyup.enter="connectToApi"
          />
          <button
            v-if="apiConnection.isDisconnected || apiConnection.hasError"
            class="btn btn-primary"
            :disabled="!localApiKey || apiConnection.isConnecting"
            @click="connectToApi"
          >
            <span v-if="apiConnection.isConnecting">Connecting...</span>
            <span v-else>Connect</span>
          </button>
          <button
            v-else-if="apiConnection.isConnected"
            class="btn btn-secondary"
            @click="apiConnection.disconnect"
          >
            Disconnect
          </button>
        </div>
        
        <!-- Connection Status -->
        <div v-if="apiConnection.isConnecting" class="status-message status-loading">
          <span class="status-icon">⏳</span>
          Validating API key...
        </div>
        <div v-else-if="apiConnection.isConnected" class="status-message status-success">
          <span class="status-icon">✅</span>
          API key validated successfully
        </div>
        <div v-else-if="apiConnection.hasError" class="status-message status-error">
          <span class="status-icon">❌</span>
          {{ apiConnection.error }}
          <button class="btn-link" @click="apiConnection.retry">Retry</button>
        </div>
        
        <small class="help-text">
          Get your API key from the Govee Home app → Settings → About Us → Apply for API Key
        </small>
      </div>
    </section>

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
          Discover Lights
        </button>
        <small class="help-text">
          Connect your API key first, then discover available lights
        </small>
      </div>
      
      <!-- Loading State -->
      <div v-else-if="lightDiscovery.isFetchingLights" class="status-message status-loading">
        <span class="status-icon">⏳</span>
        Discovering lights...
      </div>
      
      <!-- Error State -->
      <div v-else-if="lightDiscovery.hasError" class="status-message status-error">
        <span class="status-icon">❌</span>
        {{ lightDiscovery.error }}
        <button class="btn-link" @click="lightDiscovery.retryFetch">Retry</button>
      </div>
      
      <!-- Light Selection -->
      <div v-else-if="lightDiscovery.isReady" class="form-group">
        <!-- Search -->
        <div v-if="lightDiscovery.hasLights" class="search-group">
          <input
            v-model="searchQuery"
            type="text"
            class="form-input"
            placeholder="Search lights..."
            @input="lightDiscovery.searchLights(searchQuery)"
          />
          <button
            v-if="searchQuery"
            class="btn-clear"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>
        
        <!-- Light Dropdown -->
        <div class="form-group">
          <label for="lightSelect">Light</label>
          <select
            id="lightSelect"
            v-model="selectedLight"
            class="form-select"
            :disabled="!lightDiscovery.hasFilteredLights"
          >
            <option value="" disabled>
              {{ lightDiscovery.hasFilteredLights ? 'Select a light...' : 'No lights found' }}
            </option>
            <option
              v-for="light in lightDiscovery.filteredLights"
              :key="light.value"
              :value="light.value"
            >
              {{ light.label }}
            </option>
          </select>
        </div>
        
        <!-- Refresh Button -->
        <button
          class="btn btn-secondary"
          @click="lightDiscovery.refreshLights"
          :disabled="lightDiscovery.isFetchingLights"
        >
          <span v-if="lightDiscovery.isFetchingLights">Refreshing...</span>
          <span v-else>Refresh Lights</span>
        </button>
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
import { ref, computed, watch, onMounted } from 'vue'
import type { ControlMode } from '@shared/types'
import { useApiConnection } from '../composables/useApiConnection'
import { useLightDiscovery } from '../composables/useLightDiscovery'
import { useLightControlSettings } from '../composables/useSettings'
import { useFeedbackHelpers } from '../composables/useFeedback'

// XState composables
const apiConnection = useApiConnection()
const lightDiscovery = useLightDiscovery()

// Settings composable with persistence
const settingsManager = useLightControlSettings()

// Feedback system for user notifications
const feedback = useFeedbackHelpers()

// Local reactive state for UI
const searchQuery = ref<string>('')

// Computed values bound to settings
const localApiKey = computed({
  get: () => settingsManager.settings.apiKey || '',
  set: (value: string) => settingsManager.updateSetting('apiKey', value || undefined)
})

const selectedLight = computed({
  get: () => {
    const deviceId = settingsManager.settings.selectedDeviceId
    const model = settingsManager.settings.selectedModel
    return deviceId && model ? `${deviceId}|${model}` : ''
  },
  set: (value: string) => {
    if (value) {
      const [deviceId, model] = value.split('|')
      const lightName = lightDiscovery.filteredLights.value.find(l => l.value === value)?.label
      settingsManager.updateSettings({
        selectedDeviceId: deviceId,
        selectedModel: model,
        selectedLightName: lightName
      })
    } else {
      settingsManager.updateSettings({
        selectedDeviceId: undefined,
        selectedModel: undefined,
        selectedLightName: undefined
      })
    }
  }
})

const controlMode = computed({
  get: () => settingsManager.settings.controlMode || 'toggle',
  set: (value: ControlMode) => settingsManager.updateSetting('controlMode', value)
})

const brightnessValue = computed({
  get: () => settingsManager.settings.brightnessValue || 100,
  set: (value: number) => settingsManager.updateSetting('brightnessValue', value)
})

const colorValue = computed({
  get: () => settingsManager.settings.colorValue || '#ffffff',
  set: (value: string) => settingsManager.updateSetting('colorValue', value)
})

const colorTempValue = computed({
  get: () => settingsManager.settings.colorTempValue || 6500,
  set: (value: number) => settingsManager.updateSetting('colorTempValue', value)
})

// Actions
const connectToApi = () => {
  if (localApiKey.value) {
    feedback.showInfo('Connecting to API', 'Validating your API key...')
    apiConnection.connect(localApiKey.value)
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  lightDiscovery.clearSearch()
}

// Watch for API connection changes to automatically fetch lights
watch(
  () => apiConnection.isConnected.value,
  (isConnected, wasConnected) => {
    if (isConnected && !wasConnected) {
      feedback.showSuccessToast('API Connected', 'Successfully connected to Govee API')
      if (lightDiscovery.isIdle.value) {
        lightDiscovery.fetchLights()
      }
    }
  }
)

// Watch for API connection errors
watch(
  () => apiConnection.error.value,
  (error) => {
    if (error) {
      feedback.showApiError({ message: error }, 'API Connection Failed')
    }
  }
)

// Watch for light discovery success
watch(
  () => lightDiscovery.isReady.value,
  (isReady, wasReady) => {
    if (isReady && !wasReady && lightDiscovery.hasLights.value) {
      const lightCount = lightDiscovery.lights.value.length
      feedback.showSuccessToast(
        'Lights Discovered', 
        `Found ${lightCount} light${lightCount !== 1 ? 's' : ''}`
      )
    }
  }
)

// Watch for light discovery errors
watch(
  () => lightDiscovery.error.value,
  (error) => {
    if (error) {
      feedback.showApiError({ message: error }, 'Light Discovery Failed')
    }
  }
)

// Watch for API key changes in settings to update connection
watch(
  () => settingsManager.settings.apiKey,
  (newApiKey) => {
    if (newApiKey && !apiConnection.isConnected.value) {
      apiConnection.connect(newApiKey)
    }
  }
)

// Watch for settings save events
watch(
  () => settingsManager.lastSaved.value,
  (lastSaved) => {
    if (lastSaved) {
      feedback.showSuccessToast('Settings Saved', 'Your configuration has been saved')
    }
  }
)

// Initialize on mount
onMounted(() => {
  // Enable auto-save with 500ms delay for responsive UI
  settingsManager.enableAutoSave(500)
  
  // Load existing settings
  settingsManager.loadSettings()
  
  // If we have an API key in settings, connect automatically
  if (settingsManager.settings.apiKey) {
    apiConnection.connect(settingsManager.settings.apiKey)
  }
})
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

/* Button Styles */
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

/* Input Group */
.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-group .form-input {
  flex: 1;
}

/* Search Group */
.search-group {
  position: relative;
  display: flex;
  align-items: center;
}

.btn-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--sdpi-color-text-secondary, #999);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-clear:hover {
  color: var(--sdpi-color-text, #cccccc);
}

/* Status Messages */
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
</style>