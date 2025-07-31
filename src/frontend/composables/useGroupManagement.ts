import { ref, computed, onMounted, onUnmounted } from "vue";
import { createActor, type ActorRefFrom } from "xstate";
import { groupManagementMachine } from "../machines/groupManagementMachine";
import type { LightGroup, LightItem } from "@shared/types";

/**
 * Vue composable for managing light groups state with XState
 */
export function useGroupManagement() {
  // Create the XState actor
  const actor = ref<ActorRefFrom<typeof groupManagementMachine> | null>(null);

  // Reactive state from the machine
  const state = ref("idle");
  const groups = ref<LightGroup[]>([]);
  const currentGroup = ref<LightGroup | null>(null);
  const availableLights = ref<LightItem[]>([]);
  const selectedLights = ref<string[]>([]);
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  // Computed states for easier usage in templates
  const isIdle = computed(() => state.value === "idle");
  const isLoadingGroups = computed(() => state.value === "loading");
  const isReady = computed(() => state.value === "ready");
  const isEditing = computed(() => state.value === "editing");
  const isSaving = computed(() => state.value === "saving");
  const isDeleting = computed(() => state.value === "deleting");
  const hasError = computed(() => state.value === "error");
  const hasGroups = computed(() => groups.value.length > 0);
  const isCreatingNew = computed(
    () => isEditing.value && currentGroup.value === null,
  );
  const isEditingExisting = computed(
    () => isEditing.value && currentGroup.value !== null,
  );

  // Initialize the actor and subscribe to state changes
  onMounted(() => {
    actor.value = createActor(groupManagementMachine, { input: {} });

    // Subscribe to state changes
    actor.value.subscribe((snapshot) => {
      state.value = snapshot.value as string;
      groups.value = snapshot.context.groups;
      currentGroup.value = snapshot.context.currentGroup;
      availableLights.value = snapshot.context.availableLights;
      selectedLights.value = snapshot.context.selectedLights;
      error.value = snapshot.context.error;
      isLoading.value = snapshot.context.isLoading;
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
  const loadGroups = () => {
    if (actor.value) {
      actor.value.send({ type: "LOAD_GROUPS" });
    }
  };

  const createGroup = () => {
    if (actor.value) {
      actor.value.send({ type: "CREATE_GROUP" });
    }
  };

  const editGroup = (group: LightGroup) => {
    if (actor.value) {
      actor.value.send({ type: "EDIT_GROUP", group });
    }
  };

  const saveGroup = (name: string, lightIds: string[]) => {
    if (actor.value) {
      actor.value.send({ type: "SAVE_GROUP", name, selectedLights: lightIds });
    }
  };

  const deleteGroup = (groupId: string) => {
    if (actor.value) {
      actor.value.send({ type: "DELETE_GROUP", groupId });
    }
  };

  const cancelEdit = () => {
    if (actor.value) {
      actor.value.send({ type: "CANCEL_EDIT" });
    }
  };

  const selectLight = (lightId: string) => {
    if (actor.value) {
      actor.value.send({ type: "SELECT_LIGHT", lightId });
    }
  };

  const deselectLight = (lightId: string) => {
    if (actor.value) {
      actor.value.send({ type: "DESELECT_LIGHT", lightId });
    }
  };

  const toggleLightSelection = (lightId: string) => {
    if (selectedLights.value.includes(lightId)) {
      deselectLight(lightId);
    } else {
      selectLight(lightId);
    }
  };

  const isLightSelected = (lightId: string) => {
    return computed(() => selectedLights.value.includes(lightId));
  };

  return {
    // State
    state: computed(() => state.value),
    groups: computed(() => groups.value),
    currentGroup: computed(() => currentGroup.value),
    availableLights: computed(() => availableLights.value),
    selectedLights: computed(() => selectedLights.value),
    error: computed(() => error.value),
    isLoading: computed(() => isLoading.value),

    // Computed convenience states
    isIdle,
    isLoadingGroups,
    isReady,
    isEditing,
    isSaving,
    isDeleting,
    hasError,
    hasGroups,
    isCreatingNew,
    isEditingExisting,

    // Actions
    loadGroups,
    createGroup,
    editGroup,
    saveGroup,
    deleteGroup,
    cancelEdit,
    selectLight,
    deselectLight,
    toggleLightSelection,
    isLightSelected,
  };
}
