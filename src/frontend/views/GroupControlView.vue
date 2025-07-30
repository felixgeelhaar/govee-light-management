<template>
  <div class="group-control-view">
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
            :disabled="apiConnection.isConnecting.value"
            @keyup.enter="connectToApi"
          />
          <button
            v-if="apiConnection.isDisconnected || apiConnection.hasError"
            class="btn btn-primary"
            :disabled="!localApiKey || apiConnection.isConnecting.value"
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

    <!-- Group Management Section -->
    <section class="config-section" data-testid="group-management-section">
      <h2>Group Management</h2>
      
      <!-- Loading Groups -->
      <div v-if="groupManagement.isIdle" class="form-group">
        <button
          class="btn btn-primary"
          :disabled="!apiConnection.isConnected"
          @click="groupManagement.loadGroups"
        >
          Load Groups
        </button>
        <small class="help-text">
          Connect your API key first, then load your light groups
        </small>
      </div>
      
      <!-- Loading State -->
      <div v-else-if="groupManagement.isLoadingGroups" class="status-message status-loading">
        <span class="status-icon">⏳</span>
        Loading groups...
      </div>
      
      <!-- Error State -->
      <div v-else-if="groupManagement.hasError" class="status-message status-error">
        <span class="status-icon">❌</span>
        {{ groupManagement.error }}
        <button class="btn-link" @click="groupManagement.loadGroups">Retry</button>
      </div>
      
      <!-- Ready State - Group Selection -->
      <div v-else-if="groupManagement.isReady" class="form-group">
        <div class="form-group">
          <label for="groupSelect">Light Group</label>
          <select
            id="groupSelect"
            v-model="selectedGroup"
            class="form-select"
            :disabled="!groupManagement.hasGroups"
          >
            <option value="" disabled>
              {{ groupManagement.hasGroups ? 'Select a light group...' : 'No groups found' }}
            </option>
            <option
              v-for="group in groupManagement.groups.value"
              :key="group.id"
              :value="group.id"
            >
              {{ group.name }} ({{ group.lightIds?.length || 0 }} lights)
            </option>
          </select>
        </div>

        <div class="group-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="!selectedGroup || groupManagement.isLoading.value"
            @click="editGroup"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="!selectedGroup || groupManagement.isLoading.value"
            @click="deleteGroup"
          >
            <span v-if="groupManagement.isDeleting">Deleting...</span>
            <span v-else>🗑️ Delete</span>
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="groupManagement.isLoading.value"
            @click="createNewGroup"
          >
            + Create New Group
          </button>
        </div>
      </div>
    </section>

    <!-- Group Creation/Edit Form -->
    <section
      v-if="showCreateForm || showEditForm"
      class="config-section"
      data-testid="group-creation-form"
    >
      <h2>{{ showEditForm ? 'Edit Group' : 'Create New Group' }}</h2>
      
      <!-- Saving State -->
      <div v-if="groupManagement.isSaving" class="status-message status-loading">
        <span class="status-icon">⏳</span>
        {{ showEditForm ? 'Updating group...' : 'Creating group...' }}
      </div>
      
      <div v-else>
        <div class="form-group">
          <label for="groupName">Group Name</label>
          <input
            id="groupName"
            v-model="groupName"
            type="text"
            class="form-input"
            placeholder="Enter group name"
            :disabled="groupManagement.isLoading.value"
          />
        </div>

        <div class="form-group">
          <label>Select Lights</label>
          
          <!-- Lights not loaded yet -->
          <div v-if="lightDiscovery.isIdle" class="status-message status-loading">
            <span class="status-icon">⏳</span>
            Loading available lights...
          </div>
          
          <!-- Lights loading -->
          <div v-else-if="lightDiscovery.isFetchingLights" class="status-message status-loading">
            <span class="status-icon">⏳</span>
            Discovering lights...
          </div>
          
          <!-- Light discovery error -->
          <div v-else-if="lightDiscovery.hasError" class="status-message status-error">
            <span class="status-icon">❌</span>
            {{ lightDiscovery.error }}
            <button class="btn-link" @click="lightDiscovery.retryFetch">Retry</button>
          </div>
          
          <!-- Light selection -->
          <div v-else-if="lightDiscovery.isReady && lightDiscovery.hasLights" class="light-selection">
            <div
              v-for="light in lightDiscovery.lights.value"
              :key="light.value"
              class="light-checkbox"
            >
              <input
                :id="`light-${light.value}`"
                :checked="isLightSelected(light.value)"
                type="checkbox"
                class="checkbox"
                @change="toggleLightSelection(light.value)"
              />
              <label :for="`light-${light.value}`" class="checkbox-label">
                {{ light.label }}
              </label>
            </div>
          </div>
          
          <!-- No lights found -->
          <div v-else class="status-message status-error">
            <span class="status-icon">ℹ️</span>
            No lights available. Make sure your API key is connected and lights are discoverable.
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="groupManagement.isLoading.value"
            @click="cancelGroupForm"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!groupName || selectedLights.length === 0 || groupManagement.isLoading.value"
            @click="saveGroup"
          >
            {{ showEditForm ? 'Update Group' : 'Create Group' }}
          </button>
        </div>
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

      <!-- Dynamic control inputs (same as LightControlView) -->
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

      <div v-if="controlMode === 'color'" class="form-group">
        <label for="color">Color</label>
        <input
          id="color"
          v-model="colorValue"
          type="color"
          class="form-color"
        />
      </div>

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
import type { ControlMode, LightGroup } from '@shared/types'
import { useApiConnection } from '../composables/useApiConnection'
import { useLightDiscovery } from '../composables/useLightDiscovery'
import { useGroupManagement } from '../composables/useGroupManagement'
import { useGroupControlSettings } from '../composables/useSettings'

// XState composables
const apiConnection = useApiConnection()
const lightDiscovery = useLightDiscovery()
const groupManagement = useGroupManagement()

// Settings composable with persistence
const settingsManager = useGroupControlSettings()

// Group form state
const groupName = ref<string>('')

// Computed state helpers
const showCreateForm = computed(() => groupManagement.isCreatingNew.value)
const showEditForm = computed(() => groupManagement.isEditingExisting.value)
const selectedLights = computed(() => groupManagement.selectedLights.value)

// Computed values bound to settings
const localApiKey = computed({
  get: () => settingsManager.settings.apiKey || '',
  set: (value: string) => settingsManager.updateSetting('apiKey', value || undefined)
})

const selectedGroup = computed({
  get: () => settingsManager.settings.selectedGroupId || '',
  set: (value: string) => {
    settingsManager.updateSetting('selectedGroupId', value || undefined)
    
    // Update group name in settings for display
    if (value) {
      const group = groupManagement.groups.value.find(g => g.id === value)
      if (group) {
        settingsManager.updateSetting('selectedGroupName', group.name)
      }
    } else {
      settingsManager.updateSetting('selectedGroupName', undefined)
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
    apiConnection.connect(localApiKey.value)
  }
}

const editGroup = () => {
  const group = groupManagement.groups.value.find(g => g.id === selectedGroup.value)
  if (group) {
    groupManagement.editGroup(group)
    groupName.value = group.name
  }
}

const deleteGroup = () => {
  if (selectedGroup.value) {
    const confirmDelete = confirm('Are you sure you want to delete this group?')
    if (confirmDelete) {
      groupManagement.deleteGroup(selectedGroup.value)
      selectedGroup.value = ''
    }
  }
}

const saveGroup = () => {
  if (groupName.value && selectedLights.value.length > 0) {
    groupManagement.saveGroup(groupName.value, selectedLights.value)
    groupName.value = ''
  }
}

const cancelGroupForm = () => {
  groupManagement.cancelEdit()
  groupName.value = ''
}

const createNewGroup = () => {
  groupManagement.createGroup()
  groupName.value = ''
}

// Light selection methods for form
const toggleLightSelection = (lightId: string) => {
  groupManagement.toggleLightSelection(lightId)
}

const isLightSelected = (lightId: string) => {
  return groupManagement.isLightSelected(lightId).value
}

// Watch for API connection changes to load groups and lights
watch(
  () => apiConnection.isConnected.value,
  (isConnected) => {
    if (isConnected) {
      if (lightDiscovery.isIdle.value) {
        lightDiscovery.fetchLights()
      }
      if (groupManagement.isIdle.value) {
        groupManagement.loadGroups()
      }
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
  
  // Load groups if already connected
  if (apiConnection.isConnected.value) {
    if (groupManagement.isIdle.value) {
      groupManagement.loadGroups()
    }
  }
})
</script>

<style scoped>
.group-control-view {
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

.group-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--sdpi-color-accent, #0099ff);
  color: white;
  border-color: var(--sdpi-color-accent, #0099ff);
}

.btn-primary:hover:not(:disabled) {
  background-color: #0077cc;
  border-color: #0077cc;
}

.btn-secondary {
  background-color: transparent;
  color: var(--sdpi-color-text, #cccccc);
  border-color: var(--sdpi-color-border, #333);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--sdpi-color-bg, #1e1e1e);
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #c82333;
}

.light-selection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: var(--sdpi-color-bg, #1e1e1e);
}

.light-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox {
  width: 16px;
  height: 16px;
}

.checkbox-label {
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
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