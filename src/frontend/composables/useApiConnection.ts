import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createActor, type ActorRefFrom } from 'xstate'
import { apiConnectionMachine } from '../machines/apiConnectionMachine'

/**
 * Vue composable for managing API connection state with XState
 */
export function useApiConnection() {
  // Create the XState actor
  const actor = ref<ActorRefFrom<typeof apiConnectionMachine> | null>(null)
  
  // Reactive state from the machine
  const state = ref('disconnected')
  const apiKey = ref('')
  const error = ref<string | null>(null)
  const isValidating = ref(false)
  
  // Computed states for easier usage in templates
  const isConnected = computed(() => state.value === 'connected')
  const isConnecting = computed(() => state.value === 'connecting')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const hasError = computed(() => state.value === 'error')
  
  // Initialize the actor and subscribe to state changes
  onMounted(() => {
    actor.value = createActor(apiConnectionMachine)
    
    // Subscribe to state changes
    actor.value.subscribe((snapshot) => {
      state.value = snapshot.value as string
      apiKey.value = snapshot.context.apiKey
      error.value = snapshot.context.error
      isValidating.value = snapshot.context.isValidating
    })
    
    actor.value.start()
  })
  
  // Clean up on unmount
  onUnmounted(() => {
    if (actor.value) {
      actor.value.stop()
    }
  })
  
  // Actions
  const connect = (newApiKey: string) => {
    if (actor.value) {
      actor.value.send({ type: 'CONNECT', apiKey: newApiKey })
    }
  }
  
  const disconnect = () => {
    if (actor.value) {
      actor.value.send({ type: 'DISCONNECT' })
    }
  }
  
  const retry = () => {
    if (actor.value) {
      actor.value.send({ type: 'RETRY' })
    }
  }
  
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
  }
}