import { ref, onMounted, onUnmounted } from "vue";
import { websocketService } from "../services/websocketService";

/**
 * useWebSocket Composable
 *
 * A Vue composable for managing WebSocket communication with the Stream Deck
 * backend. Provides methods for sending messages, settings, and handling
 * real-time bidirectional communication.
 *
 * Features:
 * - Reactive connection state tracking
 * - Message sending and receiving
 * - Settings synchronization with Stream Deck
 * - Light and group data requests
 * - API key validation
 * - Event listener management
 * - Automatic cleanup on component unmount
 *
 * @example Basic Usage
 * ```typescript
 * const ws = useWebSocket();
 *
 * // Check connection status
 * if (ws.isConnected.value) {
 *   // Request lights
 *   ws.requestLights();
 * }
 *
 * // Listen for events
 * ws.addEventListener("lightsReceived", (data) => {
 *   console.log("Lights:", data.lights);
 * });
 *
 * // Send settings to Stream Deck
 * ws.sendSettings({ apiKey: "your-key", selectedDeviceId: "device-123" });
 * ```
 *
 * @example Event Handling
 * ```typescript
 * const ws = useWebSocket();
 *
 * // Add event listener
 * const handleApiValidation = (data) => {
 *   if (data.valid) {
 *     console.log("API key is valid");
 *   }
 * };
 *
 * ws.addEventListener("apiKeyValidated", handleApiValidation);
 *
 * // Remove event listener when done
 * ws.removeEventListener("apiKeyValidated", handleApiValidation);
 * ```
 *
 * @returns {Object} WebSocket state and methods
 */
export function useWebSocket() {
  const isConnected = ref(false);
  const lastMessage = ref<any>(null);
  const error = ref<string | null>(null);

  // Connection state handler
  const handleConnectionChange = (connected: boolean) => {
    isConnected.value = connected;
    if (!connected) {
      error.value = "Disconnected from Stream Deck";
    } else {
      error.value = null;
    }
  };

  // Generic message handler
  const handleMessage = (message: any) => {
    lastMessage.value = message;
    console.log("Received WebSocket message:", message);
  };

  // Initialize WebSocket listeners on mount
  onMounted(() => {
    websocketService.onConnectionChange(handleConnectionChange);
    websocketService.on("*", handleMessage);

    // Set initial connection state
    isConnected.value = websocketService.isConnected;
  });

  // Clean up listeners on unmount
  onUnmounted(() => {
    websocketService.off("*", handleMessage);
  });

  // API methods
  /**
   * Sends a raw message through the WebSocket connection
   * @param message - The message object to send
   */
  const sendMessage = (message: any) => {
    try {
      websocketService.sendMessage(message);
    } catch (err) {
      error.value = `Failed to send message: ${err}`;
    }
  };

  /**
   * Sends action settings to Stream Deck for persistence
   * @param settings - Settings object to save
   */
  const sendSettings = (settings: Record<string, any>) => {
    try {
      websocketService.sendSettings(settings);
    } catch (err) {
      error.value = `Failed to send settings: ${err}`;
    }
  };

  /**
   * Requests the list of available lights from the backend
   * Response received via "lightsReceived" event
   */
  const requestLights = () => {
    try {
      websocketService.requestLights();
    } catch (err) {
      error.value = `Failed to request lights: ${err}`;
    }
  };

  /**
   * Requests the list of light groups from the backend
   * Response received via "groupsReceived" event
   */
  const requestGroups = () => {
    try {
      websocketService.requestGroups();
    } catch (err) {
      error.value = `Failed to request groups: ${err}`;
    }
  };

  /**
   * Saves a new or updated light group
   * @param group - Group object with name and light IDs
   */
  const saveGroup = (group: { name: string; lightIds: string[] }) => {
    try {
      websocketService.saveGroup(group);
    } catch (err) {
      error.value = `Failed to save group: ${err}`;
    }
  };

  /**
   * Deletes a light group by ID
   * @param groupId - The ID of the group to delete
   */
  const deleteGroup = (groupId: string) => {
    try {
      websocketService.deleteGroup(groupId);
    } catch (err) {
      error.value = `Failed to delete group: ${err}`;
    }
  };

  /**
   * Sends an API key to the backend for validation
   * Response received via "apiKeyValidated" event
   * @param apiKey - The Govee API key to validate
   */
  const validateApiKey = (apiKey: string) => {
    try {
      websocketService.validateApiKey(apiKey);
    } catch (err) {
      error.value = `Failed to validate API key: ${err}`;
    }
  };

  // Event listener management
  /**
   * Adds an event listener for WebSocket events
   * @param event - Event name to listen for (or "*" for all events)
   * @param handler - Callback function to handle the event
   */
  const addEventListener = (event: string, handler: (data: any) => void) => {
    websocketService.on(event, handler);
  };

  /**
   * Removes an event listener for WebSocket events
   * @param event - Event name to stop listening for
   * @param handler - The handler function to remove
   */
  const removeEventListener = (event: string, handler: (data: any) => void) => {
    websocketService.off(event, handler);
  };

  return {
    // State
    isConnected,
    lastMessage,
    error,

    // Methods
    sendMessage,
    sendSettings,
    requestLights,
    requestGroups,
    saveGroup,
    deleteGroup,
    validateApiKey,

    // Event management
    addEventListener,
    removeEventListener,

    // Service access
    service: websocketService,
  };
}
