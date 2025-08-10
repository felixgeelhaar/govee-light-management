/**
 * Provides access to the Stream Deck instance without importing plugin.ts
 * This avoids circular dependencies and test issues
 */

let streamDeckInstance: any = null;

/**
 * Set the Stream Deck instance (called from plugin.ts)
 */
export function setStreamDeckInstance(instance: any): void {
  streamDeckInstance = instance;
}

/**
 * Get the Stream Deck instance
 */
export function getStreamDeck(): any {
  if (!streamDeckInstance) {
    // During tests or when not initialized, import directly
    try {
      const sdk = require("@elgato/streamdeck");
      streamDeckInstance = sdk.default || sdk.streamDeck || sdk;
    } catch (e) {
      console.warn("Stream Deck SDK not available:", e);
    }
  }
  return streamDeckInstance;
}
