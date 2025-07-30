import { setup, assign, fromPromise } from 'xstate'
import { websocketService } from '../services/websocketService'

/**
 * Context for the API connection state machine
 */
export interface ApiConnectionContext {
  apiKey: string
  error: string | null
  isValidating: boolean
}

/**
 * Events that can be sent to the API connection machine
 */
export type ApiConnectionEvent =
  | { type: 'CONNECT'; apiKey: string }
  | { type: 'DISCONNECT' }
  | { type: 'RETRY' }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'VALIDATION_FAILED'; error: string }

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
        if (event.type === 'CONNECT') {
          return event.apiKey
        }
        return ''
      }
    }),
    
    clearApiKey: assign({
      apiKey: '',
      error: null,
    }),
    
    setError: assign({
      error: ({ event }) => {
        if (event.type === 'VALIDATION_FAILED') {
          return event.error
        }
        return null
      }
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
    validateApiKey: fromPromise(async ({ input }: { input: { apiKey: string } }) => {
      // Production-ready WebSocket-based API key validation
      if (!websocketService.isConnected) {
        throw new Error('WebSocket not connected to Stream Deck')
      }
      
      return new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          websocketService.off('sendToPropertyInspector', responseHandler)
          reject(new Error('API key validation timeout'))
        }, 10000) // 10 second timeout for network operations
        
        const responseHandler = (message: any) => {
          if (message.payload?.event === 'apiKeyValidated') {
            clearTimeout(timeout)
            websocketService.off('sendToPropertyInspector', responseHandler)
            
            if (message.payload.isValid) {
              resolve(true)
            } else {
              reject(new Error(message.payload.error || 'Invalid API key'))
            }
          }
        }
        
        // Listen for response
        websocketService.on('sendToPropertyInspector', responseHandler)
        
        // Send validation request
        websocketService.validateApiKey(input.apiKey)
      })
    }),
  },
}).createMachine({
  id: 'apiConnection',
  initial: 'disconnected',
  context: {
    apiKey: '',
    error: null,
    isValidating: false,
  },
  
  states: {
    disconnected: {
      on: {
        CONNECT: {
          target: 'connecting',
          actions: ['setApiKey', 'clearError'],
        },
      },
    },
    
    connecting: {
      entry: 'startValidation',
      exit: 'stopValidation',
      
      invoke: {
        src: 'validateApiKey',
        input: ({ context }) => ({ apiKey: context.apiKey }),
        onDone: {
          target: 'connected',
          actions: 'clearError',
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error.message,
          }),
        },
      },
      
      on: {
        VALIDATION_SUCCESS: {
          target: 'connected',
          actions: 'clearError',
        },
        VALIDATION_FAILED: {
          target: 'error',
          actions: 'setError',
        },
        DISCONNECT: {
          target: 'disconnected',
          actions: 'clearApiKey',
        },
      },
    },
    
    connected: {
      on: {
        DISCONNECT: {
          target: 'disconnected',
          actions: 'clearApiKey',
        },
      },
    },
    
    error: {
      on: {
        RETRY: {
          target: 'connecting',
          actions: 'clearError',
        },
        CONNECT: {
          target: 'connecting',
          actions: ['setApiKey', 'clearError'],
        },
        DISCONNECT: {
          target: 'disconnected',
          actions: 'clearApiKey',
        },
      },
    },
  },
})