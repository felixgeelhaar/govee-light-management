import { ref, computed, onMounted, onUnmounted } from "vue";
import { createActor, type ActorRefFrom } from "xstate";
import { groupManagementMachine } from "../machines/groupManagementMachine";
import type { LightGroup, LightItem } from "@shared/types";

/**
 * useGroupManagement Composable
 *
 * A Vue composable for managing light groups using XState. Provides CRUD
 * operations for groups, light selection within groups, and edit state management.
 *
 * Features:
 * - XState-powered group management state machine
 * - Group CRUD operations (create, read, update, delete)
 * - Light selection for group membership
 * - Edit mode with cancel functionality
 * - Reactive computed properties for UI bindings
 * - Automatic cleanup on component unmount
 *
 * State Machine States:
 * - `idle` - Initial state, no groups loaded
 * - `loading` - Currently loading groups from storage
 * - `ready` - Groups loaded, ready for operations
 * - `editing` - In edit mode (creating new or editing existing)
 * - `saving` - Saving group changes
 * - `deleting` - Deleting a group
 * - `error` - Operation failed
 *
 * @example Basic Usage
 * ```typescript
 * const groupManagement = useGroupManagement();
 *
 * // Load existing groups
 * groupManagement.loadGroups();
 *
 * // Create a new group
 * groupManagement.createGroup();
 * groupManagement.selectLight("light-1");
 * groupManagement.selectLight("light-2");
 * groupManagement.saveGroup("Living Room", ["light-1", "light-2"]);
 *
 * // Edit an existing group
 * groupManagement.editGroup(existingGroup);
 * groupManagement.deselectLight("light-1");
 * groupManagement.saveGroup("Updated Name", newLightIds);
 *
 * // Delete a group
 * groupManagement.deleteGroup("group-id");
 * ```
 *
 * @example In a Group Editor Component
 * ```vue
 * <template>
 *   <div v-if="groupManagement.isEditing.value">
 *     <input v-model="groupName" />
 *     <div v-for="light in groupManagement.availableLights.value">
 *       <label>
 *         <input
 *           type="checkbox"
 *           :checked="groupManagement.selectedLights.value.includes(light.id)"
 *           @change="groupManagement.toggleLightSelection(light.id)"
 *         />
 *         {{ light.name }}
 *       </label>
 *     </div>
 *     <button @click="groupManagement.saveGroup(groupName, selectedLights)">Save</button>
 *     <button @click="groupManagement.cancelEdit">Cancel</button>
 *   </div>
 * </template>
 * ```
 *
 * @returns {Object} Group management state and actions
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
  /**
   * Loads all light groups from storage
   */
  const loadGroups = () => {
    if (actor.value) {
      actor.value.send({ type: "LOAD_GROUPS" });
    }
  };

  /**
   * Starts creating a new group
   * Transitions to editing state with no current group
   */
  const createGroup = () => {
    if (actor.value) {
      actor.value.send({ type: "CREATE_GROUP" });
    }
  };

  /**
   * Starts editing an existing group
   * @param group - The group to edit
   */
  const editGroup = (group: LightGroup) => {
    if (actor.value) {
      actor.value.send({ type: "EDIT_GROUP", group });
    }
  };

  /**
   * Saves the current group (creates new or updates existing)
   * @param name - The group name
   * @param lightIds - Array of light IDs to include in the group
   */
  const saveGroup = (name: string, lightIds: string[]) => {
    if (actor.value) {
      actor.value.send({ type: "SAVE_GROUP", name, selectedLights: lightIds });
    }
  };

  /**
   * Deletes a group by ID
   * @param groupId - The ID of the group to delete
   */
  const deleteGroup = (groupId: string) => {
    if (actor.value) {
      actor.value.send({ type: "DELETE_GROUP", groupId });
    }
  };

  /**
   * Cancels the current edit operation
   * Returns to ready state without saving changes
   */
  const cancelEdit = () => {
    if (actor.value) {
      actor.value.send({ type: "CANCEL_EDIT" });
    }
  };

  /**
   * Selects a light for inclusion in the current group
   * @param lightId - The ID of the light to select
   */
  const selectLight = (lightId: string) => {
    if (actor.value) {
      actor.value.send({ type: "SELECT_LIGHT", lightId });
    }
  };

  /**
   * Deselects a light from the current group
   * @param lightId - The ID of the light to deselect
   */
  const deselectLight = (lightId: string) => {
    if (actor.value) {
      actor.value.send({ type: "DESELECT_LIGHT", lightId });
    }
  };

  /**
   * Toggles a light's selection state
   * @param lightId - The ID of the light to toggle
   */
  const toggleLightSelection = (lightId: string) => {
    if (selectedLights.value.includes(lightId)) {
      deselectLight(lightId);
    } else {
      selectLight(lightId);
    }
  };

  /**
   * Returns a computed property indicating if a light is selected
   * @param lightId - The ID of the light to check
   * @returns Computed boolean indicating selection state
   */
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
