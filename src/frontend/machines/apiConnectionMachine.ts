import { setup, assign, fromPromise } from "xstate";
import { websocketService } from "../services/websocketService";
import { apiCacheService } from "../services/cacheService";
import { performanceService } from "../services/performanceService";

/**
 * Context for the API connection state machine
 */
export interface ApiConnectionContext {
  apiKey: string;
  error: string | null;
  isValidating: boolean;
}

/**
 * Events that can be sent to the API connection machine
 */
export type ApiConnectionEvent =
  | { type: "CONNECT"; apiKey: string }
  | { type: "DISCONNECT" }
  | { type: "RETRY" }
  | { type: "VALIDATION_SUCCESS" }
  | { type: "VALIDATION_FAILED"; error: string };

/**
 * State machine for managing API connection state
 *
 * States:
 * - disconnected: No API key configured
 * - connecting: Validating API key
 * - connected: API key validated and ready
 * - error: API key validation failed
 */
export const apiConnectionMachine = setup({
  types: {
    context: {} as ApiConnectionContext,
    events: {} as ApiConnectionEvent,
  },
  actions: {
    setApiKey: assign({
      apiKey: ({ event }) => {
        if (event.type === "CONNECT") {
          return event.apiKey;
        }
        return "";
      },
    }),

    clearApiKey: assign({
      apiKey: "",
      error: null,
    }),

    setError: assign({
      error: ({ event }) => {
        if (event.type === "VALIDATION_FAILED") {
          return event.error;
        }
        return null;
      },
    }),

    clearError: assign({
      error: null,
    }),

    startValidation: assign({
      isValidating: true,
    }),

    stopValidation: assign({
      isValidating: false,
    }),
  },

  actors: {
    validateApiKey: fromPromise(
      async ({ input }: { input: { apiKey: string } }) => {
        const operationId = `apikey-validation-${Date.now()}`;

        return performanceService.timeAsync(
          operationId,
          "API Key Validation",
          async () => {
            // Check cache first for faster validation
            const cachedResult = apiCacheService.getCachedApiKeyValidation(
              input.apiKey,
            );
            if (cachedResult !== null) {
              console.log("API key validation result retrieved from cache");
              return cachedResult;
            }

            // Production-ready WebSocket-based API key validation
            if (!websocketService.isConnected) {
              throw new Error("WebSocket not connected to Stream Deck");
            }

            return new Promise<boolean>((resolve, reject) => {
              console.log("ApiConnectionMachine: Starting API key validation");

              const timeout = setTimeout(() => {
                console.log(
                  "ApiConnectionMachine: Validation timeout after 10 seconds",
                );
                websocketService.off(
                  "sendToPropertyInspector",
                  responseHandler,
                );
                reject(new Error("API key validation timeout"));
              }, 10000); // 10 second timeout for network operations

              const responseHandler = (message: any) => {
                console.log(
                  "ApiConnectionMachine: Received message:",
                  JSON.stringify(message),
                );
                if (message.payload?.event === "apiKeyValidated") {
                  console.log(
                    "ApiConnectionMachine: Received apiKeyValidated response",
                  );
                  clearTimeout(timeout);
                  websocketService.off(
                    "sendToPropertyInspector",
                    responseHandler,
                  );

                  if (message.payload.isValid) {
                    console.log(
                      "ApiConnectionMachine: API key validation successful",
                    );
                    // Cache successful validation
                    apiCacheService.cacheApiKeyValidation(input.apiKey, true);
                    resolve(true);
                  } else {
                    console.log(
                      "ApiConnectionMachine: API key validation failed:",
                      message.payload.error,
                    );
                    // Don't cache failures as they might be temporary network issues
                    reject(
                      new Error(message.payload.error || "Invalid API key"),
                    );
                  }
                } else {
                  console.log(
                    "ApiConnectionMachine: Received non-validation message:",
                    message.payload?.event,
                  );
                }
              };

              console.log("ApiConnectionMachine: Setting up response handler");
              // Listen for response
              websocketService.on("sendToPropertyInspector", responseHandler);

              console.log("ApiConnectionMachine: Sending validation request");
              // Send validation request
              websocketService.validateApiKey(input.apiKey);
            });
          },
          { operation: "api-validation" },
        );
      },
    ),
  },
}).createMachine({
  id: "apiConnection",
  initial: "disconnected",
  context: {
    apiKey: "",
    error: null,
    isValidating: false,
  },

  states: {
    disconnected: {
      on: {
        CONNECT: {
          target: "connecting",
          actions: ["setApiKey", "clearError"],
        },
      },
    },

    connecting: {
      entry: "startValidation",
      exit: "stopValidation",

      invoke: {
        src: "validateApiKey",
        input: ({ context }) => ({ apiKey: context.apiKey }),
        onDone: {
          target: "connected",
          actions: "clearError",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : String(event.error),
          }),
        },
      },

      on: {
        VALIDATION_SUCCESS: {
          target: "connected",
          actions: "clearError",
        },
        VALIDATION_FAILED: {
          target: "error",
          actions: "setError",
        },
        DISCONNECT: {
          target: "disconnected",
          actions: "clearApiKey",
        },
      },
    },

    connected: {
      on: {
        DISCONNECT: {
          target: "disconnected",
          actions: "clearApiKey",
        },
      },
    },

    error: {
      on: {
        RETRY: {
          target: "connecting",
          actions: "clearError",
        },
        CONNECT: {
          target: "connecting",
          actions: ["setApiKey", "clearError"],
        },
        DISCONNECT: {
          target: "disconnected",
          actions: "clearApiKey",
        },
      },
    },
  },
});
