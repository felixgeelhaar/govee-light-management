/**
 * Global type definitions for frontend browser environment
 */

declare global {
  interface Window {
    connectElgatoStreamDeckSocket?: (inPort: number, inPropertyInspectorUUID: string, inRegisterEvent: string, inInfo: string, inActionInfo: string) => void;
    dispatchEvent: (event: Event) => boolean;
    location: Location;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  }

  var connectElgatoStreamDeckSocket: (inPort: number, inPropertyInspectorUUID: string, inRegisterEvent: string, inInfo: string, inActionInfo: string) => void;

  interface Navigator {
    userAgent: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
    };
    hardwareConcurrency?: number;
    deviceMemory?: number;
  }

  interface Performance {
    now(): number;
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  class WebSocket {
    constructor(url: string, protocols?: string | string[]);
    readonly readyState: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
    send(data: string | ArrayBuffer | Blob): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  }

  class MessageEvent extends Event {
    readonly data: any;
    constructor(type: string, eventInitDict?: MessageEventInit);
  }

  interface MessageEventInit extends EventInit {
    data?: any;
  }

  class CustomEvent<T = any> extends Event {
    readonly detail: T;
    constructor(type: string, eventInitDict?: CustomEventInit<T>);
  }

  interface CustomEventInit<T = any> extends EventInit {
    detail?: T;
  }

  interface EventListener {
    (evt: Event): void;
  }

  const window: Window;
  const navigator: Navigator;
  const performance: Performance;
}

export {};