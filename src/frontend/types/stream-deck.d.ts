/**
 * Stream Deck Property Inspector global type definitions
 */

interface StreamDeckConnection {
  sendToPlugin?(payload: any): void;
  setSettings?(settings: any): void;
  getSettings?(): void;
}

interface StreamDeckGlobal {
  connection?: StreamDeckConnection;
  settings?: Record<string, any>;
  sendToPlugin?(payload: any): void;
  setSettings?(settings: any): void;
  getSettings?(): void;
}

declare global {
  interface Window {
    $SD?: StreamDeckGlobal;
  }
}

export {};
