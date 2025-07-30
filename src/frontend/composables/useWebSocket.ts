import { ref, onMounted, onUnmounted } from 'vue'
import { websocketService } from '../services/websocketService'

/**
 * Vue composable for WebSocket communication with Stream Deck
 */
export function useWebSocket() {
  const isConnected = ref(false)
  const lastMessage = ref<any>(null)
  const error = ref<string | null>(null)
  
  // Connection state handler
  const handleConnectionChange = (connected: boolean) => {
    isConnected.value = connected
    if (!connected) {
      error.value = 'Disconnected from Stream Deck'
    } else {
      error.value = null
    }
  }
  
  // Generic message handler
  const handleMessage = (message: any) => {
    lastMessage.value = message
    console.log('Received WebSocket message:', message)
  }
  
  // Initialize WebSocket listeners on mount
  onMounted(() => {
    websocketService.onConnectionChange(handleConnectionChange)
    websocketService.on('*', handleMessage)
    
    // Set initial connection state
    isConnected.value = websocketService.isConnected
  })
  
  // Clean up listeners on unmount
  onUnmounted(() => {
    websocketService.off('*', handleMessage)
  })
  
  // API methods
  const sendMessage = (message: any) => {
    try {
      websocketService.sendMessage(message)
    } catch (err) {
      error.value = `Failed to send message: ${err}`
    }
  }
  
  const sendSettings = (settings: Record<string, any>) => {
    try {
      websocketService.sendSettings(settings)
    } catch (err) {
      error.value = `Failed to send settings: ${err}`
    }
  }
  
  const requestLights = () => {
    try {
      websocketService.requestLights()
    } catch (err) {
      error.value = `Failed to request lights: ${err}`
    }
  }
  
  const requestGroups = () => {
    try {
      websocketService.requestGroups()
    } catch (err) {
      error.value = `Failed to request groups: ${err}`
    }
  }
  
  const saveGroup = (group: { name: string; lightIds: string[] }) => {
    try {
      websocketService.saveGroup(group)
    } catch (err) {
      error.value = `Failed to save group: ${err}`
    }
  }
  
  const deleteGroup = (groupId: string) => {
    try {
      websocketService.deleteGroup(groupId)
    } catch (err) {
      error.value = `Failed to delete group: ${err}`
    }
  }
  
  const validateApiKey = (apiKey: string) => {
    try {
      websocketService.validateApiKey(apiKey)
    } catch (err) {
      error.value = `Failed to validate API key: ${err}`
    }
  }
  
  // Event listener management
  const addEventListener = (event: string, handler: (data: any) => void) => {
    websocketService.on(event, handler)
  }
  
  const removeEventListener = (event: string, handler: (data: any) => void) => {
    websocketService.off(event, handler)
  }
  
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
  }
}