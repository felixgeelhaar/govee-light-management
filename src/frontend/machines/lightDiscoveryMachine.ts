import { setup, assign, fromPromise } from 'xstate'
import type { LightItem } from '@shared/types'
import { websocketService } from '../services/websocketService'

/**
 * Context for the light discovery state machine
 */
export interface LightDiscoveryContext {
  lights: LightItem[]
  filteredLights: LightItem[]
  searchQuery: string
  error: string | null
  isFetching: boolean
}

/**
 * Input for the light discovery machine
 */
export interface LightDiscoveryInput {
  shouldFail?: boolean
}

/**
 * Events that can be sent to the light discovery machine
 */
export type LightDiscoveryEvent =
  | { type: 'FETCH' }
  | { type: 'REFRESH' }
  | { type: 'RETRY' }
  | { type: 'SEARCH'; query: string }
  | { type: 'FETCH_SUCCESS'; lights: LightItem[] }
  | { type: 'FETCH_FAILED'; error: string }

/**
 * State machine for discovering and managing available lights
 * 
 * States:
 * - idle: Initial state, no lights fetched
 * - fetching: Loading lights from API
 * - success: Lights loaded successfully
 * - error: Failed to load lights
 */
export const lightDiscoveryMachine = setup({
  types: {
    context: {} as LightDiscoveryContext,
    events: {} as LightDiscoveryEvent,
    input: {} as LightDiscoveryInput,
  },
  actions: {
    setLights: assign({
      lights: ({ event }) => {
        if (event.type === 'FETCH_SUCCESS') {
          return event.lights
        }
        return []
      },
      filteredLights: ({ event, context }) => {
        if (event.type === 'FETCH_SUCCESS') {
          // Apply existing search filter if any
          if (context.searchQuery) {
            return event.lights.filter(light => 
              light.label.toLowerCase().includes(context.searchQuery.toLowerCase())
            )
          }
          return event.lights
        }
        return []
      },
    }),
    
    setSearchQuery: assign({
      searchQuery: ({ event }) => {
        if (event.type === 'SEARCH') {
          return event.query
        }
        return ''
      },
      filteredLights: ({ event, context }) => {
        if (event.type === 'SEARCH') {
          const query = event.query.toLowerCase()
          return context.lights.filter(light => 
            light.label.toLowerCase().includes(query)
          )
        }
        return context.lights
      },
    }),
    
    setError: assign({
      error: ({ event }) => {
        if (event.type === 'FETCH_FAILED') {
          return event.error
        }
        return null
      },
    }),
    
    clearError: assign({
      error: null,
    }),
    
    startFetching: assign({
      isFetching: true,
    }),
    
    stopFetching: assign({
      isFetching: false,
    }),
  },
  
  actors: {
    fetchLights: fromPromise(async ({ input }: { input: LightDiscoveryInput }) => {
      // Production-ready WebSocket-based light discovery
      if (!websocketService.isConnected) {
        throw new Error('WebSocket not connected to Stream Deck')
      }
      
      return new Promise<LightItem[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          websocketService.off('sendToPropertyInspector', responseHandler)
          reject(new Error('Light discovery timeout'))
        }, 15000) // 15 second timeout for light discovery
        
        const responseHandler = (message: any) => {
          if (message.payload?.event === 'lightsReceived') {
            clearTimeout(timeout)
            websocketService.off('sendToPropertyInspector', responseHandler)
            
            if (message.payload.error) {
              reject(new Error(message.payload.error))
            } else {
              resolve(message.payload.lights || [])
            }
          }
        }
        
        // Listen for response
        websocketService.on('sendToPropertyInspector', responseHandler)
        
        // Send lights request
        websocketService.requestLights()
      })
    }),
  },
}).createMachine({
  id: 'lightDiscovery',
  initial: 'idle',
  context: ({ input }) => ({
    lights: [],
    filteredLights: [],
    searchQuery: '',
    error: null,
    isFetching: false,
  }),
  
  states: {
    idle: {
      on: {
        FETCH: {
          target: 'fetching',
        },
      },
    },
    
    fetching: {
      entry: ['startFetching', 'clearError'],
      exit: 'stopFetching',
      
      invoke: {
        src: 'fetchLights',
        input: ({ self }) => self._parent?.input || {},
        onDone: {
          target: 'success',
          actions: [
            assign({
              lights: ({ event }) => event.output,
              filteredLights: ({ event }) => event.output,
            }),
          ],
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error.message,
          }),
        },
      },
      
      on: {
        FETCH_SUCCESS: {
          target: 'success',
          actions: 'setLights',
        },
        FETCH_FAILED: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    
    success: {
      on: {
        REFRESH: {
          target: 'fetching',
        },
        SEARCH: {
          actions: 'setSearchQuery',
        },
      },
    },
    
    error: {
      on: {
        RETRY: {
          target: 'fetching',
        },
      },
    },
  },
})