import { websocketService } from '../services/websocketService'

/**
 * Initialize Property Inspector with settings persistence
 */
export function initializePropertyInspector() {
  // Add global initialization function for Stream Deck
  if (typeof window !== 'undefined') {
    // Stream Deck will call this function when the Property Inspector loads
    window.connectElgatoStreamDeckSocket = (
      port: number,
      uuid: string,
      registerEvent: string,
      info: string,
      actionInfo: string
    ) => {
      console.log('Initializing Stream Deck connection:', {
        port,
        uuid,
        registerEvent,
        info: JSON.parse(info),
        actionInfo: JSON.parse(actionInfo)
      })
      
      websocketService.initialize(port, uuid, registerEvent, info, actionInfo)
      
      // Set up settings persistence
      setupSettingsPersistence()
    }
  }
}

/**
 * Set up automatic settings persistence
 */
function setupSettingsPersistence() {
  // Listen for settings updates from the plugin
  websocketService.on('didReceiveSettings', (message) => {
    console.log('Received settings from plugin:', message.payload?.settings)
    
    // Dispatch custom event for components to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('streamDeckSettingsReceived', {
          detail: message.payload?.settings || {}
        })
      )
    }
  })
  
  // Listen for property inspector events
  websocketService.on('sendToPropertyInspector', (message) => {
    console.log('Received message from plugin:', message.payload)
    
    // Handle different message types
    switch (message.payload?.event) {
      case 'lightsReceived':
        window.dispatchEvent(
          new CustomEvent('streamDeckLightsReceived', {
            detail: message.payload.lights || []
          })
        )
        break
        
      case 'groupsReceived':
        window.dispatchEvent(
          new CustomEvent('streamDeckGroupsReceived', {
            detail: message.payload.groups || []
          })
        )
        break
        
      case 'apiKeyValidated':
        window.dispatchEvent(
          new CustomEvent('streamDeckApiKeyValidated', {
            detail: { 
              isValid: message.payload.isValid,
              error: message.payload.error 
            }
          })
        )
        break
        
      case 'groupSaved':
        window.dispatchEvent(
          new CustomEvent('streamDeckGroupSaved', {
            detail: message.payload.group
          })
        )
        break
        
      case 'groupDeleted':
        window.dispatchEvent(
          new CustomEvent('streamDeckGroupDeleted', {
            detail: { groupId: message.payload.groupId }
          })
        )
        break
        
      case 'error':
        window.dispatchEvent(
          new CustomEvent('streamDeckError', {
            detail: { 
              error: message.payload.error,
              operation: message.payload.operation 
            }
          })
        )
        break
    }
  })
}

/**
 * Auto-save settings when they change
 */
export function autoSaveSettings(settings: Record<string, any>) {
  // Debounce settings saves to avoid overwhelming the plugin
  if (typeof window !== 'undefined') {
    if ((window as any).settingsSaveTimeout) {
      clearTimeout((window as any).settingsSaveTimeout)
    }
    
    (window as any).settingsSaveTimeout = setTimeout(() => {
      websocketService.sendSettings(settings)
      console.log('Auto-saved settings:', settings)
    }, 500)
  }
}

/**
 * Listen to Stream Deck custom events
 */
export function addStreamDeckEventListener<T = any>(
  eventType: string,
  handler: (detail: T) => void
) {
  if (typeof window !== 'undefined') {
    const wrappedHandler = (event: CustomEvent<T>) => {
      handler(event.detail)
    }
    
    window.addEventListener(eventType, wrappedHandler as EventListener)
    
    // Return cleanup function
    return () => {
      window.removeEventListener(eventType, wrappedHandler as EventListener)
    }
  }
  
  return () => {} // No-op cleanup for SSR
}

// Declare global types for TypeScript
declare global {
  interface Window {
    connectElgatoStreamDeckSocket: (
      port: number,
      uuid: string,
      registerEvent: string,
      info: string,
      actionInfo: string
    ) => void
    
    settingsSaveTimeout?: number
  }
  
  interface WindowEventMap {
    streamDeckSettingsReceived: CustomEvent<Record<string, any>>
    streamDeckLightsReceived: CustomEvent<Array<{ label: string; value: string }>>
    streamDeckGroupsReceived: CustomEvent<Array<{ id: string; name: string; lightIds: string[] }>>
    streamDeckApiKeyValidated: CustomEvent<{ isValid: boolean; error?: string }>
    streamDeckGroupSaved: CustomEvent<{ id: string; name: string; lightIds: string[] }>
    streamDeckGroupDeleted: CustomEvent<{ groupId: string }>
    streamDeckError: CustomEvent<{ error: string; operation?: string }>
  }
}