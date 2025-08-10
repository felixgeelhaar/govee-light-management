<template>
  <div :class="`${actionType}-action-view action-view`">
    <!-- Feedback System -->
    <FeedbackSystem />
    
    <!-- API Key Configuration -->
    <ApiKeyConfiguration 
      :connection="{
        isConnected: apiConnection.isConnected.value,
        isConnecting: apiConnection.isConnecting.value,
        hasError: apiConnection.hasError.value,
        connect: apiConnection.connect
      }"
      @api-key-changed="handleApiKeyChanged"
      @api-key-saved="handleApiKeySaved"
      @testing-connection="handleTestingConnection"
    />
    
    <!-- Light Selection -->
    <LightSelector
      :has-api-key="hasApiKey"
      v-model:selected-light="selectedLight"
      @light-selected="handleLightSelected"
    />
    
    <!-- Action-Specific Configuration -->
    <section class="config-section">
      <h2>{{ configTitle }}</h2>
      <slot name="action-config" :selectedLight="selectedLight" :lightInfo="selectedLightInfo"></slot>
    </section>
    
    <!-- Action Summary (Optional) -->
    <section v-if="showSummary && hasApiKey && selectedLight" class="config-section summary-section">
      <h2>Action Summary</h2>
      <div class="summary-card">
        <div class="summary-item">
          <span class="summary-label">Light:</span>
          <span class="summary-value">{{ selectedLightInfo?.label || 'Unknown' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Action:</span>
          <span class="summary-value">{{ actionSummary }}</span>
        </div>
        <slot name="summary-items" :selectedLight="selectedLight" :lightInfo="selectedLightInfo"></slot>
      </div>
    </section>
    
    <!-- Help Section (Optional) -->
    <section v-if="showHelp" class="config-section help-section">
      <details class="help-details">
        <summary class="help-summary">
          <span class="help-icon">❓</span>
          Need help?
        </summary>
        <div class="help-content">
          <slot name="help-content">
            <p>This action will control your selected Govee light when you press the Stream Deck button.</p>
          </slot>
        </div>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import FeedbackSystem from './FeedbackSystem.vue';
import ApiKeyConfiguration from './ApiKeyConfiguration.vue';
import LightSelector from './LightSelector.vue';
import { useApiConnection } from '../composables/useApiConnection';
import { useLightDiscovery } from '../composables/useLightDiscovery';
import { useToastMachine } from '../composables/useToastMachine';
import { websocketService } from '../services/websocketService';

// Props
interface Props {
  actionType: string;
  configTitle: string;
  actionSummary?: string;
  showSummary?: boolean;
  showHelp?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  actionSummary: 'Control Light',
  showSummary: true,
  showHelp: true
});

// Emits
const emit = defineEmits<{
  'settings-changed': [settings: any];
  'light-selected': [lightId: string, lightModel: string, lightName: string];
}>();

// Composables
const apiConnection = useApiConnection();
const lightDiscovery = useLightDiscovery();
const toast = useToastMachine();

// Local State
const hasApiKey = ref(false);
const selectedLight = ref('');
const isTestingConnection = ref(false);

// Computed
const selectedLightInfo = computed(() => {
  if (!selectedLight.value) return null;
  return lightDiscovery.filteredLights.value.find(
    light => light.value === selectedLight.value
  );
});

// Methods
const handleApiKeyChanged = (apiKey: string) => {
  hasApiKey.value = !!apiKey;
};

const handleApiKeySaved = (apiKey: string) => {
  hasApiKey.value = !!apiKey;
  if (apiKey && !apiConnection.isConnected.value) {
    apiConnection.connect(apiKey);
  }
};

const handleTestingConnection = (testing: boolean) => {
  isTestingConnection.value = testing;
};

const handleLightSelected = (lightId: string, lightModel: string, lightName: string) => {
  emit('light-selected', lightId, lightModel, lightName);
};

const saveSettings = (settings: any) => {
  emit('settings-changed', settings);
  websocketService.sendToPlugin({
    event: 'setSettings',
    settings
  });
};

const loadSettings = () => {
  websocketService.sendToPlugin({
    event: 'getSettings'
  });
};

// Watch for API connection changes
watch(
  () => apiConnection.isConnected.value,
  (isConnected, wasConnected) => {
    if (isConnected && !wasConnected && !isTestingConnection.value) {
      toast.showApiConnectionSuccess("Connected to Govee API successfully");
      if (lightDiscovery.isIdle.value) {
        lightDiscovery.fetchLights();
      }
    }
  }
);

// Watch for API errors
watch(
  () => apiConnection.error.value,
  (error) => {
    if (error) {
      toast.showApiConnectionError(error);
    }
  }
);

// Lifecycle
onMounted(() => {
  const checkConnection = () => {
    if (websocketService.isConnected) {
      // Request global API key and current settings
      websocketService.sendToPlugin({ event: 'getGlobalApiKey' });
      loadSettings();
      
      // Set up WebSocket event listeners
      websocketService.on("sendToPropertyInspector", (data: any) => {
        if (data.payload?.event === "globalApiKey") {
          const apiKey = data.payload.apiKey;
          hasApiKey.value = !!apiKey;
          if (apiKey && !apiConnection.isConnected.value) {
            apiConnection.connect(apiKey);
          }
        }
        
        if (data.payload?.event === "currentSettings") {
          const settings = data.payload.settings;
          // Let parent components handle their specific settings
          if (settings.lightId && settings.lightModel) {
            selectedLight.value = `${settings.lightId}|${settings.lightModel}`;
          }
          // Check if we need to connect to API
          if (hasApiKey.value && !apiConnection.isConnected.value) {
            websocketService.sendToPlugin({ event: 'getGlobalApiKey' });
          }
        }
      });
    } else {
      // Retry connection
      setTimeout(checkConnection, 100);
    }
  };

  checkConnection();
});

// Expose methods to parent
defineExpose({
  saveSettings,
  loadSettings,
  selectedLight,
  selectedLightInfo,
  hasApiKey
});
</script>

<style scoped>
.action-view {
  padding: 0;
  max-width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
}

/* Config Sections */
.config-section {
  margin-bottom: 16px;
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-bg-tertiary, #404040);
  border-radius: 6px;
  padding: 12px;
}

.config-section h2 {
  color: var(--sdpi-color-text, #cccccc);
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--sdpi-color-bg-tertiary, #404040);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Summary Section */
.summary-section {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.05);
}

.summary-card {
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-bg-tertiary, #404040);
  border-radius: 6px;
  padding: 12px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.summary-item:last-child {
  border-bottom: none;
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
  max-width: 60%;
  text-align: right;
  word-break: break-word;
}

/* Help Section */
.help-section {
  border-color: var(--sdpi-color-accent, #0099ff);
  background: rgba(0, 153, 255, 0.05);
}

.help-details {
  margin: 0;
}

.help-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  list-style: none;
}

.help-summary::-webkit-details-marker {
  display: none;
}

.help-summary::before {
  content: '▶';
  color: var(--sdpi-color-accent, #0099ff);
  transition: transform 0.2s ease;
  font-size: 10px;
}

.help-details[open] .help-summary::before {
  transform: rotate(90deg);
}

.help-summary:hover {
  background: rgba(255, 255, 255, 0.05);
}

.help-icon {
  font-size: 16px;
}

.help-content {
  padding: 12px 8px 0 24px;
  color: var(--sdpi-color-text-secondary, #999);
  font-size: 13px;
  line-height: 1.5;
}

.help-content p {
  margin: 0 0 12px 0;
}

.help-content p:last-child {
  margin-bottom: 0;
}

/* Responsive Design */
@media (max-width: 480px) {
  .action-view {
    padding: 0;
  }
  
  .config-section {
    margin-bottom: 16px;
    padding: 12px;
  }
  
  .summary-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .summary-value {
    max-width: 100%;
    text-align: left;
  }
}

/* Animation for smooth transitions */
.config-section {
  transition: all 0.3s ease;
}

.summary-section,
.help-section {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>