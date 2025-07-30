import type { PropertyInspectorMessages, PluginMessages } from '@shared/types/messages'
import { createAppError, ErrorCodes, logError } from '../utils/errorHandling'

/**
 * WebSocket service for Stream Deck Property Inspector communication
 * Handles bidirectional communication between Property Inspector and Plugin
 */
export class WebSocketService {
  private websocket: WebSocket | null = null
  private port: number | null = null
  private uuid: string | null = null
  private registerEvent: string | null = null
  private info: Record<string, any> | null = null
  private actionInfo: Record<string, any> | null = null
  
  // Event handlers
  private messageHandlers = new Map<string, ((data: any) => void)[]>()
  private connectionHandlers: ((connected: boolean) => void)[] = []
  
  /**
   * Initialize WebSocket connection with Stream Deck
   */
  initialize(
    port: number,
    uuid: string,
    registerEvent: string,
    info: string,
    actionInfo: string
  ): void {
    this.port = port
    this.uuid = uuid
    this.registerEvent = registerEvent
    
    try {
      this.info = JSON.parse(info)
      this.actionInfo = JSON.parse(actionInfo)
    } catch (error) {
      console.error('Failed to parse Stream Deck initialization data:', error)
    }
    
    this.connect()
  }
  
  /**
   * Connect to Stream Deck WebSocket
   */
  private connect(): void {
    if (!this.port || !this.uuid || !this.registerEvent) {
      const error = createAppError(
        'WebSocket service not properly initialized',
        ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
        { port: this.port, uuid: this.uuid, registerEvent: this.registerEvent },
        false
      )
      logError(error)
      return
    }
    
    try {
      this.websocket = new WebSocket(`ws://localhost:${this.port}`)
      
      this.websocket.onopen = this.handleOpen.bind(this)
      this.websocket.onmessage = this.handleMessage.bind(this)
      this.websocket.onclose = this.handleClose.bind(this)
      this.websocket.onerror = this.handleError.bind(this)
    } catch (error) {
      const appError = createAppError(
        'Failed to create WebSocket connection',
        ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
        { port: this.port, originalError: error }
      )
      logError(appError)
    }
  }
  
  /**
   * Handle WebSocket connection open
   */
  private handleOpen(): void {
    console.log('WebSocket connected to Stream Deck')
    
    // Register with Stream Deck
    if (this.websocket && this.uuid && this.registerEvent) {
      const registerMessage = {
        event: this.registerEvent,
        uuid: this.uuid
      }
      this.websocket.send(JSON.stringify(registerMessage))
    }
    
    // Notify connection handlers
    this.connectionHandlers.forEach(handler => handler(true))
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data)
      
      // Handle settings updates specifically
      if (message.event === 'didReceiveSettings' && message.payload?.settings) {
        // Update stored action info with new settings
        if (this.actionInfo) {
          this.actionInfo.payload = {
            ...this.actionInfo.payload,
            settings: message.payload.settings
          }
        }
      }
      
      // Handle different message types
      if (message.event) {
        const handlers = this.messageHandlers.get(message.event)
        if (handlers) {
          handlers.forEach(handler => handler(message))
        }
        
        // Also trigger generic message handlers
        const genericHandlers = this.messageHandlers.get('*')
        if (genericHandlers) {
          genericHandlers.forEach(handler => handler(message))
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }
  
  /**
   * Handle WebSocket connection close
   */
  private handleClose(): void {
    console.log('WebSocket disconnected from Stream Deck')
    this.connectionHandlers.forEach(handler => handler(false))
    
    // Attempt to reconnect after delay
    setTimeout(() => {
      if (this.port && this.uuid && this.registerEvent) {
        this.connect()
      }
    }, 1000)
  }
  
  /**
   * Handle WebSocket errors
   */
  private handleError(error: Event): void {
    const appError = createAppError(
      'WebSocket connection error',
      ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
      { originalError: error, port: this.port }
    )
    logError(appError)
  }
  
  /**
   * Send message to Stream Deck plugin
   */
  sendMessage(message: PropertyInspectorMessages.BaseMessage): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }
  
  /**
   * Send settings to Stream Deck plugin
   */
  sendSettings(settings: Record<string, any>): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'setSettings',
        settings
      }
    })
  }
  
  /**
   * Request lights from plugin
   */
  requestLights(): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'getLights'
      }
    })
  }
  
  /**
   * Request groups from plugin
   */
  requestGroups(): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'getGroups'
      }
    })
  }
  
  /**
   * Save group via plugin
   */
  saveGroup(group: { name: string; lightIds: string[] }): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'saveGroup',
        group
      }
    })
  }
  
  /**
   * Delete group via plugin
   */
  deleteGroup(groupId: string): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'deleteGroup',
        groupId
      }
    })
  }
  
  /**
   * Validate API key via plugin
   */
  validateApiKey(apiKey: string): void {
    this.sendMessage({
      event: 'sendToPlugin',
      context: this.uuid || '',
      payload: {
        event: 'validateApiKey',
        apiKey
      }
    })
  }
  
  /**
   * Request current settings from plugin
   */
  requestSettings(): void {
    this.sendMessage({
      event: 'getSettings',
      context: this.uuid || ''
    })
  }
  
  /**
   * Add event listener for specific message types
   */
  on(event: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event)!.push(handler)
  }
  
  /**
   * Remove event listener
   */
  off(event: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  /**
   * Add connection state listener
   */
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler)
  }
  
  /**
   * Get connection state
   */
  get isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN
  }
  
  /**
   * Get action information
   */
  get getActionInfo(): Record<string, any> | null {
    return this.actionInfo
  }
  
  /**
   * Get current settings from action info
   */
  getCurrentSettings(): Record<string, any> | null {
    if (this.actionInfo?.payload?.settings) {
      return this.actionInfo.payload.settings
    }
    return null
  }
  
  /**
   * Get Stream Deck information
   */
  get getInfo(): Record<string, any> | null {
    return this.info
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }
}

// Singleton instance
export const websocketService = new WebSocketService()

// Global initialization function for Stream Deck
declare global {
  interface Window {
    connectElgatoStreamDeckSocket: (
      port: number,
      uuid: string,
      registerEvent: string,
      info: string,
      actionInfo: string
    ) => void
  }
}

// Stream Deck initialization callback
window.connectElgatoStreamDeckSocket = (
  port: number,
  uuid: string,
  registerEvent: string,
  info: string,
  actionInfo: string
) => {
  websocketService.initialize(port, uuid, registerEvent, info, actionInfo)
}