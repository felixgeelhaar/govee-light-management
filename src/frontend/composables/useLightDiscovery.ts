import { ref, computed, readonly, onMounted, onUnmounted } from "vue";
import { createActor, type ActorRefFrom } from "xstate";
import { lightDiscoveryMachine } from "../machines/lightDiscoveryMachine";
import type { LightItem } from "@shared/types";

/**
 * Vue composable for managing light discovery state with XState
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
      console.log("useLightDiscovery: State change detected");
      console.log("  State:", snapshot.value);
      console.log("  Lights count:", snapshot.context.lights.length);
      console.log(
        "  Filtered lights count:",
        snapshot.context.filteredLights.length,
      );
      console.log("  Error:", snapshot.context.error);
      console.log("  Is fetching:", snapshot.context.isFetching);

      state.value = snapshot.value as string;
      lights.value = snapshot.context.lights;
      filteredLights.value = snapshot.context.filteredLights;
      searchQuery.value = snapshot.context.searchQuery;
      error.value = snapshot.context.error;
      isFetching.value = snapshot.context.isFetching;

      console.log("useLightDiscovery: Vue refs updated");
      console.log("  isReady computed:", snapshot.value === "success");
      console.log("  hasLights computed:", snapshot.context.lights.length > 0);
      console.log(
        "  hasFilteredLights computed:",
        snapshot.context.filteredLights.length > 0,
      );
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
  const fetchLights = () => {
    console.log("useLightDiscovery: fetchLights called");
    console.log("Actor exists:", !!actor.value);
    if (actor.value) {
      console.log("useLightDiscovery: Sending FETCH event to actor");
      actor.value.send({ type: "FETCH" });
      console.log("useLightDiscovery: FETCH event sent");
    } else {
      console.error(
        "useLightDiscovery: Actor is null, cannot send FETCH event",
      );
    }
  };

  const refreshLights = () => {
    if (actor.value) {
      actor.value.send({ type: "REFRESH" });
    }
  };

  const retryFetch = () => {
    if (actor.value) {
      actor.value.send({ type: "RETRY" });
    }
  };

  const searchLights = (query: string) => {
    if (actor.value) {
      actor.value.send({ type: "SEARCH", query });
    }
  };

  const clearSearch = () => {
    if (actor.value) {
      actor.value.send({ type: "SEARCH", query: "" });
    }
  };

  return {
    // State - return the reactive refs directly, not double-wrapped
    state: readonly(state),
    lights: readonly(lights),
    filteredLights: readonly(filteredLights),
    searchQuery: readonly(searchQuery),
    error: readonly(error),
    isFetching: readonly(isFetching),

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
