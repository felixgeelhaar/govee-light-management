import { ref, computed, onMounted, onUnmounted } from "vue";
import { createActor, type ActorRefFrom } from "xstate";
import { apiConnectionMachine } from "../machines/apiConnectionMachine";

/**
 * useApiConnection Composable
 *
 * A Vue composable for managing Govee API connection state using XState.
 * Provides reactive state for connection status, validation, and error handling.
 *
 * Features:
 * - XState-powered connection state machine (disconnected → connecting → connected)
 * - Automatic API key validation during connection
 * - Error state with retry capability
 * - Reactive computed properties for easy template bindings
 * - Automatic cleanup on component unmount
 *
 * State Machine States:
 * - `disconnected` - Not connected, awaiting API key
 * - `connecting` - Validating API key
 * - `connected` - Successfully connected to Govee API
 * - `error` - Connection failed, can retry
 *
 * @example Basic Usage
 * ```typescript
 * const apiConnection = useApiConnection();
 *
 * // Connect to API
 * apiConnection.connect("your-govee-api-key");
 *
 * // Check connection status
 * if (apiConnection.isConnected.value) {
 *   // API is ready to use
 * }
 *
 * // Handle errors
 * watch(() => apiConnection.hasError.value, (hasError) => {
 *   if (hasError) {
 *     console.error(apiConnection.error.value);
 *   }
 * });
 * ```
 *
 * @example In a Component with ApiConfigSection
 * ```vue
 * <template>
 *   <ApiConfigSection v-model="apiKey" />
 *   <div v-if="apiConnection.isConnected">
 *     <LightSelector />
 *   </div>
 * </template>
 *
 * <script setup>
 * const apiConnection = useApiConnection();
 * const apiKey = ref("");
 * </script>
 * ```
 *
 * @returns {Object} Connection state and actions
 */
export function useApiConnection() {
  // Create the XState actor
  const actor = ref<ActorRefFrom<typeof apiConnectionMachine> | null>(null);

  // Reactive state from the machine
  const state = ref("disconnected");
  const apiKey = ref("");
  const error = ref<string | null>(null);
  const isValidating = ref(false);

  // Computed states for easier usage in templates
  const isConnected = computed(() => state.value === "connected");
  const isConnecting = computed(() => state.value === "connecting");
  const isDisconnected = computed(() => state.value === "disconnected");
  const hasError = computed(() => state.value === "error");

  // Initialize the actor and subscribe to state changes
  onMounted(() => {
    actor.value = createActor(apiConnectionMachine);

    // Subscribe to state changes
    actor.value.subscribe((snapshot) => {
      state.value = snapshot.value as string;
      apiKey.value = snapshot.context.apiKey;
      error.value = snapshot.context.error;
      isValidating.value = snapshot.context.isValidating;
    });

    actor.value.start();
  });

  // Clean up on unmount
  onUnmounted(() => {
    if (actor.value) {
      actor.value.stop();
    }
  });

  // Actions
  /**
   * Initiates connection to Govee API with the provided API key
   * @param newApiKey - The Govee API key to validate and connect with
   */
  const connect = (newApiKey: string) => {
    if (actor.value) {
      actor.value.send({ type: "CONNECT", apiKey: newApiKey });
    }
  };

  /**
   * Disconnects from the Govee API and resets state
   */
  const disconnect = () => {
    if (actor.value) {
      actor.value.send({ type: "DISCONNECT" });
    }
  };

  /**
   * Retries the last connection attempt using the stored API key
   * Only works when in error state
   */
  const retry = () => {
    if (actor.value) {
      actor.value.send({ type: "RETRY" });
    }
  };

  return {
    // State
    state: computed(() => state.value),
    apiKey: computed(() => apiKey.value),
    error: computed(() => error.value),
    isValidating: computed(() => isValidating.value),

    // Computed convenience states
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,

    // Actions
    connect,
    disconnect,
    retry,
  };
}
