<template>
  <section class="api-key-section">
    <!-- Collapsed State - Status Card -->
    <div class="api-status-card" :class="{ connected: isConnected }">
      <div class="status-header">
        <div class="status-info">
          <span class="status-label">API Connection</span>
          <span class="status-indicator" :class="statusClass">
            <span class="status-dot"></span>
            {{ statusText }}
          </span>
        </div>
        <button
          @click="isExpanded = !isExpanded"
          class="edit-button"
          type="button"
          :title="
            isExpanded ? 'Hide API Configuration' : 'Edit API Configuration'
          "
        >
          {{ isExpanded ? "✕" : "✏️" }}
        </button>
      </div>

      <!-- Help text when not connected and collapsed -->
      <div v-if="!hasApiKey && !isExpanded" class="status-message">
        <small class="help-text">
          Click the edit button to configure your Govee API key
        </small>
      </div>
    </div>

    <!-- Expanded State - Configuration Form -->
    <transition name="expand">
      <div v-if="isExpanded" class="api-config-expanded">
        <div class="form-group">
          <label for="apiKey">Govee API Key</label>
          <div class="api-key-container">
            <input
              :type="showApiKey ? 'text' : 'password'"
              id="apiKey"
              v-model="apiKeyInput"
              @input="onApiKeyChange"
              placeholder="Enter your Govee API key"
              class="form-input"
              autocomplete="off"
            />
            <button
              @click="showApiKey = !showApiKey"
              class="password-toggle"
              type="button"
              :title="showApiKey ? 'Hide API Key' : 'Show API Key'"
            >
              {{ showApiKey ? "🙈" : "👁️" }}
            </button>
          </div>
          <small class="help-text">
            Get your API key from: Govee Home app → Settings → About Us → Apply
            for API Key
          </small>

          <!-- Action buttons -->
          <div class="api-action-buttons">
            <button
              @click="testConnection"
              class="btn btn-secondary btn-small"
              :disabled="!apiKeyInput || isTesting"
            >
              {{ isTesting ? "Testing..." : "🔌 Test Connection" }}
            </button>
            <button
              v-if="apiKeyInput && apiKeyInput !== originalApiKey"
              @click="saveApiKey"
              class="btn btn-primary btn-small"
              :disabled="isSaving"
            >
              {{ isSaving ? "Saving..." : "💾 Save" }}
            </button>
            <button
              v-if="hasApiKey"
              @click="clearApiKey"
              class="btn btn-danger btn-small"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { websocketService } from "../services/websocketService";
import { useToastMachine } from "../composables/useToastMachine";

// Props
interface Props {
  connection: {
    isConnected: boolean;
    isConnecting: boolean;
    hasError: boolean;
    connect: (apiKey: string) => void;
  };
}

const props = defineProps<Props>();

// Emit events
const emit = defineEmits<{
  "api-key-changed": [apiKey: string];
  "api-key-saved": [apiKey: string];
  "testing-connection": [isTesting: boolean];
}>();

// Toast system
const toast = useToastMachine();

// Feedback system is now properly integrated

// State
const isExpanded = ref(false);
const hasApiKey = ref(false);
const apiKeyInput = ref("");
const originalApiKey = ref("");
const showApiKey = ref(false);
const isTesting = ref(false);
const isSaving = ref(false);
let saveTimeout: NodeJS.Timeout | null = null;
let testToastId: string | null = null;
let testStartTime: number | null = null;

// Computed
const isConnected = computed(() => props.connection.isConnected);

const statusClass = computed(() => {
  if (!hasApiKey.value) return "disconnected";
  if (props.connection.isConnected) return "connected";
  if (props.connection.isConnecting) return "connecting";
  if (props.connection.hasError) return "error";
  return "disconnected";
});

const statusText = computed(() => {
  if (!hasApiKey.value) return "Not Configured";
  if (props.connection.isConnected) return "Connected";
  if (props.connection.isConnecting) return "Connecting...";
  if (props.connection.hasError) return "Connection Failed";
  return "Disconnected";
});

// Methods
const onApiKeyChange = () => {
  // Clear any existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Don't auto-save, wait for explicit save button click
  emit("api-key-changed", apiKeyInput.value);
};

const saveApiKey = async () => {
  const trimmedKey = apiKeyInput.value.trim();
  if (!trimmedKey || isSaving.value) return;

  isSaving.value = true;

  try {
    // Send API key to plugin to save globally
    await websocketService.sendToPlugin({
      event: "setGlobalApiKey",
      apiKey: trimmedKey,
    });

    originalApiKey.value = trimmedKey;
    hasApiKey.value = true;
    toast.showSuccess(
      "API Key Saved",
      "Your API key has been saved successfully",
    );
    emit("api-key-saved", trimmedKey);

    // Try to connect with the new API key
    if (!props.connection.isConnected) {
      props.connection.connect(trimmedKey);
    }

    // Collapse after successful save
    setTimeout(() => {
      isExpanded.value = false;
    }, 1500);
  } catch (error) {
    toast.showError("Save Failed", "Failed to save API key. Please try again.");
  } finally {
    isSaving.value = false;
  }
};

const testConnection = async () => {
  const trimmedKey = apiKeyInput.value.trim();
  if (!trimmedKey || isTesting.value) return;

  isTesting.value = true;
  testStartTime = Date.now();
  emit("testing-connection", true);

  try {
    // Dismiss any existing API connection toasts and show new testing toast
    toast.dismissCategory("api-connection");
    testToastId = toast.showApiConnectionTesting();

    // Send test request to plugin
    await websocketService.sendToPlugin({
      event: "testApiConnection",
      apiKey: trimmedKey,
    });
  } catch (error) {
    console.error("Error in testConnection:", error);
    toast.showError(
      "Connection Test Failed",
      "Failed to send test request. Please try again.",
      "api-connection",
    );
    isTesting.value = false;
    testToastId = null;
    testStartTime = null;
    emit("testing-connection", false);
  }
};

const clearApiKey = async () => {
  if (!confirm("Are you sure you want to clear the API key?")) return;

  try {
    await websocketService.sendToPlugin({
      event: "clearGlobalApiKey",
    });

    apiKeyInput.value = "";
    originalApiKey.value = "";
    hasApiKey.value = false;
    toast.showInfo("API Key Cleared", "Your API key has been removed");
    emit("api-key-changed", "");
  } catch (error) {
    toast.showError(
      "Clear Failed",
      "Failed to clear API key. Please try again.",
    );
  }
};

// Load API key on mount
const loadApiKey = async () => {
  try {
    await websocketService.sendToPlugin({
      event: "getGlobalApiKey",
    });
  } catch (error) {
    console.error("Failed to load API key:", error);
  }
};

// Listen for API key from plugin
onMounted(() => {
  const connectWebSocket = () => {
    if (websocketService.isConnected) {
      loadApiKey();

      // Listen for API key response
      websocketService.on("sendToPropertyInspector", (event: any) => {
        if (event.payload?.event === "globalApiKey") {
          const apiKey = event.payload.apiKey;
          if (apiKey) {
            apiKeyInput.value = apiKey;
            originalApiKey.value = apiKey;
            hasApiKey.value = true;
            if (!props.connection.isConnected) {
              props.connection.connect(apiKey);
            }
          }
        }

        // Handle save response
        if (event.payload?.event === "globalApiKeySaved") {
          // Don't show duplicate toasts - already shown in saveApiKey method
          if (!event.payload.success) {
            toast.showError(
              "Save Failed",
              event.payload.error || "Failed to save API key",
            );
          }
          isSaving.value = false;
        }

        // Handle test response
        if (event.payload?.event === "apiConnectionTested") {
          // Calculate how long the test has been running
          const elapsedTime = testStartTime ? Date.now() - testStartTime : 0;
          const minimumDisplayTime = 1500; // Show "Testing..." for at least 1.5 seconds
          const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);

          // Delay the update if the test completed too quickly
          setTimeout(() => {
            isTesting.value = false;
            emit("testing-connection", false);

            // Use the state machine to handle the result
            if (testToastId) {
              if (event.payload.success) {
                // Update the existing toast to show success
                toast.updateToast(testToastId, {
                  type: "success",
                  title: "Test Successful",
                  message:
                    event.payload.message || "API key validated successfully!",
                  duration: 5000,
                });
              } else {
                // Update the existing toast to show error
                toast.updateToast(testToastId, {
                  type: "error",
                  title: "Connection Failed",
                  message:
                    event.payload.error ||
                    "Failed to connect to the Govee API. Please check your API key and try again.",
                  duration: 8000,
                });
              }
              // Important: Clear the toast ID and start time
              testToastId = null;
              testStartTime = null;
            } else {
              // Fallback: show appropriate toast via state machine
              console.warn(
                "ApiKeyConfiguration: Test toast ID was lost, showing new toast",
              );
              if (event.payload.success) {
                toast.showApiConnectionSuccess(
                  event.payload.message || "API key validated successfully!",
                );
              } else {
                toast.showApiConnectionError(
                  event.payload.error ||
                    "Failed to connect to the Govee API. Please check your API key and try again.",
                );
              }
              testStartTime = null;
            }
          }, remainingTime);
        }
      });
    } else {
      setTimeout(connectWebSocket, 100);
    }
  };

  connectWebSocket();
});
</script>

<style scoped>
.api-key-section {
  margin-bottom: 12px;
}

/* Status Card */
.api-status-card {
  background: var(--elgato-bg-section);
  border: 1px solid var(--elgato-border);
  border-radius: 6px;
  padding: 10px;
  transition: all 0.2s ease;
}

.api-status-card.connected {
  border-color: var(--elgato-status-success-bg);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.status-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--elgato-text-secondary);
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 3px;
  background: var(--elgato-bg-input);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--elgato-text-tertiary);
  transition: all 0.3s ease;
}

.status-indicator.connected .status-dot {
  background: var(--elgato-status-success-text);
  box-shadow: 0 0 4px var(--elgato-status-success-text);
}

.status-indicator.connecting .status-dot {
  background: var(--elgato-status-info-text);
  animation: pulse 1.5s infinite;
}

.status-indicator.error .status-dot {
  background: var(--elgato-status-error-text);
}

.edit-button {
  background: var(--elgato-bg-input);
  border: 1px solid var(--elgato-border);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--elgato-text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
  line-height: 1;
}

.edit-button:hover {
  background: var(--elgato-bg-hover);
  color: var(--elgato-text-primary);
  border-color: var(--elgato-blue);
}

.status-message {
  margin-top: 6px;
}

/* Expanded Configuration */
.api-config-expanded {
  margin-top: 10px;
  padding: 12px;
  background: var(--elgato-bg-section);
  border: 1px solid var(--elgato-border);
  border-radius: 6px;
}

.api-key-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.api-key-container input {
  flex: 1;
  padding-right: 36px;
}

.password-toggle {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--elgato-text-secondary);
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  transition: color 0.15s ease;
}

.password-toggle:hover {
  color: var(--elgato-text-primary);
}

.api-action-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.btn-small {
  padding: 6px 12px;
  font-size: 11px;
  min-height: 28px;
}

.btn-danger {
  background: var(--elgato-status-error-bg);
  color: var(--elgato-status-error-text);
}

.btn-danger:hover:not(:disabled) {
  background: #ff5555;
}

/* Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
