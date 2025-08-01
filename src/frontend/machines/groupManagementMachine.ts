import { setup, assign, fromPromise } from "xstate";
import type { LightGroup, LightItem } from "@shared/types";
import { websocketService } from "../services/websocketService";

/**
 * Context for the group management state machine
 */
export interface GroupManagementContext {
  groups: LightGroup[];
  currentGroup: LightGroup | null;
  availableLights: LightItem[];
  selectedLights: string[];
  error: string | null;
  isLoading: boolean;
}

/**
 * Input for the group management machine
 */
export interface GroupManagementInput {
  shouldFailSave?: boolean;
  shouldFailDelete?: boolean;
  shouldFailLoad?: boolean;
}

/**
 * Events that can be sent to the group management machine
 */
export type GroupManagementEvent =
  | { type: "LOAD_GROUPS" }
  | { type: "CREATE_GROUP" }
  | { type: "EDIT_GROUP"; group: LightGroup }
  | { type: "SAVE_GROUP"; name: string; selectedLights: string[] }
  | { type: "DELETE_GROUP"; groupId: string }
  | { type: "CANCEL_EDIT" }
  | { type: "GROUPS_LOADED"; groups: LightGroup[] }
  | { type: "GROUP_SAVED"; group: LightGroup }
  | { type: "GROUP_DELETED"; groupId: string }
  | { type: "OPERATION_FAILED"; error: string }
  | { type: "SELECT_LIGHT"; lightId: string }
  | { type: "DESELECT_LIGHT"; lightId: string };

/**
 * State machine for managing light groups
 *
 * States:
 * - idle: Initial state, groups not loaded
 * - loading: Loading groups from storage
 * - ready: Groups loaded, ready for operations
 * - editing: Creating or editing a group
 * - saving: Saving group changes
 * - deleting: Deleting a group
 * - error: Operation failed
 */
export const groupManagementMachine = setup({
  types: {
    context: {} as GroupManagementContext,
    events: {} as GroupManagementEvent,
    input: {} as GroupManagementInput,
  },
  actions: {
    setGroups: assign({
      groups: ({ event }) => {
        if (event.type === "GROUPS_LOADED") {
          return event.groups;
        }
        return [];
      },
    }),

    setCurrentGroup: assign({
      currentGroup: ({ event }) => {
        if (event.type === "EDIT_GROUP") {
          return event.group;
        }
        return null;
      },
    }),

    clearCurrentGroup: assign({
      currentGroup: null,
      selectedLights: [],
    }),

    selectLight: assign({
      selectedLights: ({ context, event }) => {
        if (event.type === "SELECT_LIGHT") {
          if (!context.selectedLights.includes(event.lightId)) {
            return [...context.selectedLights, event.lightId];
          }
        }
        return context.selectedLights;
      },
    }),

    deselectLight: assign({
      selectedLights: ({ context, event }) => {
        if (event.type === "DESELECT_LIGHT") {
          return context.selectedLights.filter((id) => id !== event.lightId);
        }
        return context.selectedLights;
      },
    }),

    addOrUpdateGroup: assign({
      groups: ({ context, event }) => {
        if (event.type === "GROUP_SAVED") {
          const existingIndex = context.groups.findIndex(
            (g) => g.id === event.group.id,
          );
          if (existingIndex >= 0) {
            // Update existing group
            const newGroups = [...context.groups];
            newGroups[existingIndex] = event.group;
            return newGroups;
          } else {
            // Add new group
            return [...context.groups, event.group];
          }
        }
        return context.groups;
      },
    }),

    removeGroup: assign({
      groups: ({ context, event }) => {
        if (event.type === "GROUP_DELETED") {
          return context.groups.filter((g) => g.id !== event.groupId);
        }
        return context.groups;
      },
    }),

    setError: assign({
      error: ({ event }) => {
        if (event.type === "OPERATION_FAILED") {
          return event.error;
        }
        return null;
      },
    }),

    clearError: assign({
      error: null,
    }),

    startLoading: assign({
      isLoading: true,
    }),

    stopLoading: assign({
      isLoading: false,
    }),
  },

  actors: {
    loadGroups: fromPromise(
      async ({ input: _input }: { input: GroupManagementInput }) => {
        // Production-ready WebSocket-based group loading
        if (!websocketService.isConnected) {
          throw new Error("WebSocket not connected to Stream Deck");
        }

        return new Promise<LightGroup[]>((resolve, reject) => {
          const timeout = setTimeout(() => {
            websocketService.off("sendToPropertyInspector", responseHandler);
            reject(new Error("Group loading timeout"));
          }, 10000); // 10 second timeout

          const responseHandler = (message: any) => {
            if (message.payload?.event === "groupsReceived") {
              clearTimeout(timeout);
              websocketService.off("sendToPropertyInspector", responseHandler);

              if (message.payload.error) {
                reject(new Error(message.payload.error));
              } else {
                resolve(message.payload.groups || []);
              }
            }
          };

          // Listen for response
          websocketService.on("sendToPropertyInspector", responseHandler);

          // Send groups request
          websocketService.requestGroups();
        });
      },
    ),

    saveGroup: fromPromise(
      async ({
        input,
      }: {
        input: GroupManagementInput & {
          name: string;
          selectedLights: string[];
          groupId?: string;
        };
      }) => {
        // Production-ready WebSocket-based group saving
        if (!websocketService.isConnected) {
          throw new Error("WebSocket not connected to Stream Deck");
        }

        return new Promise<LightGroup>((resolve, reject) => {
          const timeout = setTimeout(() => {
            websocketService.off("sendToPropertyInspector", responseHandler);
            reject(new Error("Group save timeout"));
          }, 10000); // 10 second timeout

          const responseHandler = (message: any) => {
            if (message.payload?.event === "groupSaved") {
              clearTimeout(timeout);
              websocketService.off("sendToPropertyInspector", responseHandler);

              if (message.payload.error) {
                reject(new Error(message.payload.error));
              } else {
                resolve(message.payload.group);
              }
            }
          };

          // Listen for response
          websocketService.on("sendToPropertyInspector", responseHandler);

          // Send save request
          websocketService.saveGroup({
            name: input.name,
            lightIds: input.selectedLights,
          });
        });
      },
    ),

    deleteGroup: fromPromise(
      async ({
        input,
      }: {
        input: GroupManagementInput & { groupId: string };
      }) => {
        // Production-ready WebSocket-based group deletion
        if (!websocketService.isConnected) {
          throw new Error("WebSocket not connected to Stream Deck");
        }

        return new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            websocketService.off("sendToPropertyInspector", responseHandler);
            reject(new Error("Group delete timeout"));
          }, 10000); // 10 second timeout

          const responseHandler = (message: any) => {
            if (message.payload?.event === "groupDeleted") {
              clearTimeout(timeout);
              websocketService.off("sendToPropertyInspector", responseHandler);

              if (message.payload.error) {
                reject(new Error(message.payload.error));
              } else {
                resolve(message.payload.groupId);
              }
            }
          };

          // Listen for response
          websocketService.on("sendToPropertyInspector", responseHandler);

          // Send delete request
          websocketService.deleteGroup(input.groupId);
        });
      },
    ),
  },
}).createMachine({
  id: "groupManagement",
  initial: "idle",
  context: ({ input: _input }) => ({
    groups: [],
    currentGroup: null,
    availableLights: [],
    selectedLights: [],
    error: null,
    isLoading: false,
  }),

  states: {
    idle: {
      on: {
        LOAD_GROUPS: {
          target: "loading",
        },
      },
    },

    loading: {
      entry: ["startLoading", "clearError"],
      exit: "stopLoading",

      invoke: {
        src: "loadGroups",
        input: () => ({}),
        onDone: {
          target: "ready",
          actions: assign({
            groups: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Unknown error",
          }),
        },
      },

      on: {
        GROUPS_LOADED: {
          target: "ready",
          actions: "setGroups",
        },
        OPERATION_FAILED: {
          target: "error",
          actions: "setError",
        },
      },
    },

    ready: {
      on: {
        CREATE_GROUP: {
          target: "editing",
          actions: "clearCurrentGroup",
        },
        EDIT_GROUP: {
          target: "editing",
          actions: [
            "setCurrentGroup",
            assign({
              selectedLights: ({ event }) =>
                event.type === "EDIT_GROUP" ? event.group.lightIds || [] : [],
            }),
          ],
        },
        DELETE_GROUP: {
          target: "deleting",
        },
        LOAD_GROUPS: {
          target: "loading",
        },
      },
    },

    editing: {
      on: {
        SAVE_GROUP: {
          target: "saving",
        },
        CANCEL_EDIT: {
          target: "ready",
          actions: "clearCurrentGroup",
        },
        SELECT_LIGHT: {
          actions: "selectLight",
        },
        DESELECT_LIGHT: {
          actions: "deselectLight",
        },
      },
    },

    saving: {
      entry: ["startLoading", "clearError"],
      exit: "stopLoading",

      invoke: {
        src: "saveGroup",
        input: ({ context, event, self: _self }) => {
          if (event.type === "SAVE_GROUP") {
            return {
              name: event.name,
              selectedLights: event.selectedLights,
              groupId: context.currentGroup?.id,
            };
          }
          return {
            name: "",
            selectedLights: [],
          };
        },
        onDone: {
          target: "ready",
          actions: [
            assign({
              groups: ({ context, event }) => {
                const savedGroup = event.output;
                const existingIndex = context.groups.findIndex(
                  (g) => g.id === savedGroup.id,
                );
                if (existingIndex >= 0) {
                  // Update existing group
                  const newGroups = [...context.groups];
                  newGroups[existingIndex] = savedGroup;
                  return newGroups;
                } else {
                  // Add new group
                  return [...context.groups, savedGroup];
                }
              },
            }),
            "clearCurrentGroup",
          ],
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Unknown error",
          }),
        },
      },

      on: {
        GROUP_SAVED: {
          target: "ready",
          actions: ["addOrUpdateGroup", "clearCurrentGroup"],
        },
        OPERATION_FAILED: {
          target: "error",
          actions: "setError",
        },
      },
    },

    deleting: {
      entry: ["startLoading", "clearError"],
      exit: "stopLoading",

      invoke: {
        src: "deleteGroup",
        input: ({ event, self: _self }) => {
          if (event.type === "DELETE_GROUP") {
            return {
              groupId: event.groupId,
            };
          }
          return {
            groupId: "",
          };
        },
        onDone: {
          target: "ready",
          actions: assign({
            groups: ({ context, event }) =>
              context.groups.filter((g) => g.id !== event.output),
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Unknown error",
          }),
        },
      },

      on: {
        GROUP_DELETED: {
          target: "ready",
          actions: "removeGroup",
        },
        OPERATION_FAILED: {
          target: "error",
          actions: "setError",
        },
      },
    },

    error: {
      on: {
        LOAD_GROUPS: {
          target: "loading",
          actions: "clearError",
        },
        CREATE_GROUP: {
          target: "editing",
          actions: ["clearError", "clearCurrentGroup"],
        },
      },
    },
  },
});
