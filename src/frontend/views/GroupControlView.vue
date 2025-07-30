<template>
  <div class="group-control-view">
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

    <!-- Group Management Section -->
    <section class="config-section" data-testid="group-management-section">
      <h2>Group Management</h2>
      
      <div class="form-group">
        <label for="groupSelect">Light Group</label>
        <select
          id="groupSelect"
          v-model="selectedGroup"
          class="form-select"
          :disabled="!apiKey"
        >
          <option value="" disabled>Select a light group...</option>
          <option
            v-for="group in availableGroups"
            :key="group.value"
            :value="group.value"
          >
            {{ group.label }}
          </option>
        </select>
      </div>

      <div class="group-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!selectedGroup"
          @click="editGroup"
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="!selectedGroup"
          @click="deleteGroup"
        >
          🗑️ Delete
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!apiKey"
          @click="showCreateForm = true"
        >
          + Create New Group
        </button>
      </div>
    </section>

    <!-- Group Creation/Edit Form -->
    <section
      v-if="showCreateForm || showEditForm"
      class="config-section"
      data-testid="group-creation-form"
    >
      <h2>{{ showEditForm ? 'Edit Group' : 'Create New Group' }}</h2>
      
      <div class="form-group">
        <label for="groupName">Group Name</label>
        <input
          id="groupName"
          v-model="groupName"
          type="text"
          class="form-input"
          placeholder="Enter group name"
        />
      </div>

      <div class="form-group">
        <label>Select Lights</label>
        <div class="light-selection">
          <div
            v-for="light in availableLights"
            :key="light.value"
            class="light-checkbox"
          >
            <input
              :id="`light-${light.value}`"
              v-model="selectedLights"
              type="checkbox"
              :value="light.value"
              class="checkbox"
            />
            <label :for="`light-${light.value}`" class="checkbox-label">
              {{ light.label }}
            </label>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary"
          @click="cancelGroupForm"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!groupName || selectedLights.length === 0"
          @click="saveGroup"
        >
          {{ showEditForm ? 'Update Group' : 'Create Group' }}
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
import { ref, computed } from 'vue'
import type { GroupControlSettings, ControlMode } from '@shared/types'

// Reactive state
const apiKey = ref<string>('')
const selectedGroup = ref<string>('')
const controlMode = ref<ControlMode>('toggle')
const brightnessValue = ref<number>(100)
const colorValue = ref<string>('#ffffff')
const colorTempValue = ref<number>(6500)

// Group management state
const showCreateForm = ref<boolean>(false)
const showEditForm = ref<boolean>(false)
const groupName = ref<string>('')
const selectedLights = ref<string[]>([])

// Mock data for now - will be replaced with actual API calls
const availableGroups = ref([
  { label: 'Living Room (3 lights)', value: 'group1' },
  { label: 'Bedroom Setup (2 lights)', value: 'group2' },
])

const availableLights = ref([
  { label: 'Living Room Light (H6054)', value: 'device1|H6054' },
  { label: 'Bedroom Strip (H6072)', value: 'device2|H6072' },
  { label: 'Kitchen Under Cabinet (H6056)', value: 'device3|H6056' },
])

// Methods
const editGroup = () => {
  // TODO: Load group details and populate form
  showEditForm.value = true
  groupName.value = 'Living Room' // Mock data
  selectedLights.value = ['device1|H6054', 'device2|H6072'] // Mock data
}

const deleteGroup = () => {
  // TODO: Show confirmation dialog and delete group
  console.log('Delete group:', selectedGroup.value)
}

const saveGroup = () => {
  // TODO: Save group via WebSocket message
  console.log('Save group:', {
    name: groupName.value,
    lights: selectedLights.value
  })
  cancelGroupForm()
}

const cancelGroupForm = () => {
  showCreateForm.value = false
  showEditForm.value = false
  groupName.value = ''
  selectedLights.value = []
}

// Computed settings object
const settings = computed<GroupControlSettings>(() => ({
  apiKey: apiKey.value || undefined,
  selectedGroupId: selectedGroup.value || undefined,
  controlMode: controlMode.value,
  brightnessValue: controlMode.value === 'brightness' ? brightnessValue.value : undefined,
  colorValue: controlMode.value === 'color' ? colorValue.value : undefined,
  colorTempValue: controlMode.value === 'colorTemp' ? colorTempValue.value : undefined,
}))

// TODO: Implement WebSocket communication with Stream Deck plugin
// TODO: Implement API key validation
// TODO: Implement group CRUD operations
// TODO: Implement settings persistence
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
</style>