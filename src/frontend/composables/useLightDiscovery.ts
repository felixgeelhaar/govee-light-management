import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createActor, type ActorRefFrom } from 'xstate'
import { lightDiscoveryMachine } from '../machines/lightDiscoveryMachine'
import type { LightItem } from '@shared/types'

/**
 * Vue composable for managing light discovery state with XState
 */
export function useLightDiscovery() {
  // Create the XState actor
  const actor = ref<ActorRefFrom<typeof lightDiscoveryMachine> | null>(null)
  
  // Reactive state from the machine
  const state = ref('idle')
  const lights = ref<LightItem[]>([])
  const filteredLights = ref<LightItem[]>([])
  const searchQuery = ref('')
  const error = ref<string | null>(null)
  const isFetching = ref(false)
  
  // Computed states for easier usage in templates
  const isIdle = computed(() => state.value === 'idle')
  const isFetchingLights = computed(() => state.value === 'fetching')
  const isReady = computed(() => state.value === 'success')
  const hasError = computed(() => state.value === 'error')
  const hasLights = computed(() => lights.value.length > 0)
  const hasFilteredLights = computed(() => filteredLights.value.length > 0)
  
  // Initialize the actor and subscribe to state changes
  onMounted(() => {
    actor.value = createActor(lightDiscoveryMachine, {})
    
    // Subscribe to state changes
    actor.value.subscribe((snapshot) => {
      state.value = snapshot.value as string
      lights.value = snapshot.context.lights
      filteredLights.value = snapshot.context.filteredLights
      searchQuery.value = snapshot.context.searchQuery
      error.value = snapshot.context.error
      isFetching.value = snapshot.context.isFetching
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
  const fetchLights = () => {
    if (actor.value) {
      actor.value.send({ type: 'FETCH' })
    }
  }
  
  const refreshLights = () => {
    if (actor.value) {
      actor.value.send({ type: 'REFRESH' })
    }
  }
  
  const retryFetch = () => {
    if (actor.value) {
      actor.value.send({ type: 'RETRY' })
    }
  }
  
  const searchLights = (query: string) => {
    if (actor.value) {
      actor.value.send({ type: 'SEARCH', query })
    }
  }
  
  const clearSearch = () => {
    if (actor.value) {
      actor.value.send({ type: 'SEARCH', query: '' })
    }
  }
  
  return {
    // State
    state: computed(() => state.value),
    lights: computed(() => lights.value),
    filteredLights: computed(() => filteredLights.value),
    searchQuery: computed(() => searchQuery.value),
    error: computed(() => error.value),
    isFetching: computed(() => isFetching.value),
    
    // Computed convenience states
    isIdle,
    isFetchingLights,
    isReady,
    hasError,
    hasLights,
    hasFilteredLights,
    
    // Actions
    fetchLights,
    refreshLights,
    retryFetch,
    searchLights,
    clearSearch,
  }
}