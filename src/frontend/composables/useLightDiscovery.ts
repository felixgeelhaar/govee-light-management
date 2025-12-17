import { ref, computed, onMounted, onUnmounted } from "vue";
import { createActor, type ActorRefFrom } from "xstate";
import { lightDiscoveryMachine } from "../machines/lightDiscoveryMachine";
import type { LightItem } from "@shared/types";

/**
 * useLightDiscovery Composable
 *
 * A Vue composable for discovering and managing Govee lights using XState.
 * Handles fetching lights from the API, filtering, and search functionality.
 *
 * Features:
 * - XState-powered discovery state machine (idle → fetching → success/error)
 * - Automatic light capability detection
 * - Real-time search and filtering
 * - Refresh and retry functionality
 * - Reactive computed properties for UI bindings
 * - Automatic cleanup on component unmount
 *
 * State Machine States:
 * - `idle` - Initial state, no lights loaded
 * - `fetching` - Currently fetching lights from API
 * - `success` - Lights successfully loaded
 * - `error` - Fetch failed, can retry
 *
 * @example Basic Usage
 * ```typescript
 * const lightDiscovery = useLightDiscovery();
 *
 * // Fetch lights from API
 * lightDiscovery.fetchLights();
 *
 * // Access discovered lights
 * const lights = lightDiscovery.lights.value;
 *
 * // Filter lights by search query
 * lightDiscovery.searchLights("Living Room");
 * const filtered = lightDiscovery.filteredLights.value;
 * ```
 *
 * @example In a Light Selection Component
 * ```vue
 * <template>
 *   <div v-if="lightDiscovery.isFetchingLights">Loading lights...</div>
 *   <div v-else-if="lightDiscovery.hasError">
 *     Error: {{ lightDiscovery.error.value }}
 *     <button @click="lightDiscovery.retryFetch">Retry</button>
 *   </div>
 *   <select v-else>
 *     <option v-for="light in lightDiscovery.filteredLights.value" :key="light.value">
 *       {{ light.label }}
 *     </option>
 *   </select>
 * </template>
 *
 * <script setup>
 * const lightDiscovery = useLightDiscovery();
 * onMounted(() => lightDiscovery.fetchLights());
 * </script>
 * ```
 *
 * @returns {Object} Discovery state and actions
 */
export function useLightDiscovery() {
  // Create the XState actor
  const actor = ref<ActorRefFrom<typeof lightDiscoveryMachine> | null>(null);

  // Reactive state from the machine
  const state = ref("idle");
  const lights = ref<LightItem[]>([]);
  const filteredLights = ref<LightItem[]>([]);
  const searchQuery = ref("");
  const error = ref<string | null>(null);
  const isFetching = ref(false);

  // Computed states for easier usage in templates
  const isIdle = computed(() => state.value === "idle");
  const isFetchingLights = computed(() => state.value === "fetching");
  const isReady = computed(() => state.value === "success");
  const hasError = computed(() => state.value === "error");
  const hasLights = computed(() => lights.value.length > 0);
  const hasFilteredLights = computed(() => filteredLights.value.length > 0);

  // Initialize the actor and subscribe to state changes
  onMounted(() => {
    actor.value = createActor(lightDiscoveryMachine, { input: {} });

    // Subscribe to state changes
    actor.value.subscribe((snapshot) => {
      state.value = snapshot.value as string;
      lights.value = snapshot.context.lights;
      filteredLights.value = snapshot.context.filteredLights;
      searchQuery.value = snapshot.context.searchQuery;
      error.value = snapshot.context.error;
      isFetching.value = snapshot.context.isFetching;
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
   * Fetches lights from the Govee API
   * Transitions from idle to fetching state
   */
  const fetchLights = () => {
    if (actor.value) {
      actor.value.send({ type: "FETCH" });
    }
  };

  /**
   * Refreshes the light list from the API
   * Can be called from any state to get updated light data
   */
  const refreshLights = () => {
    if (actor.value) {
      actor.value.send({ type: "REFRESH" });
    }
  };

  /**
   * Retries fetching lights after an error
   * Only effective when in error state
   */
  const retryFetch = () => {
    if (actor.value) {
      actor.value.send({ type: "RETRY" });
    }
  };

  /**
   * Filters lights by search query
   * Updates filteredLights with matching results
   * @param query - Search string to filter lights by name
   */
  const searchLights = (query: string) => {
    if (actor.value) {
      actor.value.send({ type: "SEARCH", query });
    }
  };

  /**
   * Clears the current search filter
   * Resets filteredLights to show all lights
   */
  const clearSearch = () => {
    if (actor.value) {
      actor.value.send({ type: "SEARCH", query: "" });
    }
  };

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
  };
}
