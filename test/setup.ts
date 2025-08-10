/**
 * Test setup file for Vitest
 * 
 * This file configures global test environment and mocks common dependencies.
 * It's automatically loaded before each test file runs.
 */

import { beforeEach, vi } from 'vitest';

// Mock fs module for plugin.ts debug logging and Stream Deck logger
vi.mock('fs', () => ({
  default: {
    appendFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true), // Return true to prevent file operations
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(), // For Stream Deck log rotation
    unlinkSync: vi.fn(), // For Stream Deck log cleanup
    statSync: vi.fn().mockReturnValue({ size: 0 }) // For Stream Deck log size checks
  },
  appendFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(''),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 0 }),
  promises: {
    rename: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 0 })
  }
}));

// Mock fs/promises separately for Stream Deck logger
vi.mock('fs/promises', () => ({
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 })
}));

// Mock browser globals for frontend tests
global.WebSocket = vi.fn().mockImplementation(() => ({
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));

// Mock Stream Deck socket connection function
global.connectElgatoStreamDeckSocket = vi.fn();

// Ensure window object has the connectElgatoStreamDeckSocket function
Object.defineProperty(window, 'connectElgatoStreamDeckSocket', {
  value: vi.fn(),
  writable: true
});

// Mock Stream Deck SDK for testing
vi.mock('@elgato/streamdeck', () => {
  const mockStreamDeck = {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      setLevel: vi.fn()
    },
    settings: {
      getGlobalSettings: vi.fn().mockResolvedValue({}),
      setGlobalSettings: vi.fn().mockResolvedValue(undefined)
    },
    ui: {
      current: {
        sendToPropertyInspector: vi.fn().mockResolvedValue(undefined)
      },
      sendToPropertyInspector: vi.fn().mockResolvedValue(undefined)
    },
    actions: {
      registerAction: vi.fn().mockImplementation(() => {
        // Mock successful registration without needing manifest.json
        return Promise.resolve();
      })
    },
    system: {
      onDidConnect: vi.fn(),
      onDidDisconnect: vi.fn()
    },
    connect: vi.fn()
  };
  
  return {
    default: mockStreamDeck,
    streamDeck: mockStreamDeck,
    LogLevel: {
      TRACE: 0,
      DEBUG: 1,
      INFO: 2,
      WARN: 3,
      ERROR: 4
    },
    SingletonAction: class SingletonAction {
      constructor() {}
      onWillAppear = vi.fn();
      onWillDisappear = vi.fn();
      onKeyDown = vi.fn();
      onKeyUp = vi.fn();
      onDialRotate = vi.fn();
      onDialDown = vi.fn();
      onDialUp = vi.fn();
      onTouchTap = vi.fn();
      onPropertyInspectorDidAppear = vi.fn();
      onPropertyInspectorDidDisappear = vi.fn();
      onSendToPlugin = vi.fn();
      onDidReceiveSettings = vi.fn();
    },
    action: () => (target: any) => target,
    KeyAction: class KeyAction {
      constructor() {}
    },
    DialAction: class DialAction {
      constructor() {}
    }
  };
});

// Mock Govee API client base class to avoid network calls in unit tests
vi.mock('@felixgeelhaar/govee-api-client', () => {
  // Create constructor functions that work with instanceof
  const MockBrightness = function(this: any, value: number) {
    this.value = value;
    this.level = value;
  };
  
  const MockColorTemperature = function(this: any, kelvin: number) {
    this.kelvin = kelvin;
  };
  
  const MockColorRgb = function(this: any, r: number | string, g?: number, b?: number) {
    // Handle both constructor signatures: (hex: string) and (r: number, g: number, b: number)
    if (typeof r === 'string') {
      this.hex = r;
      // Parse hex to RGB
      const hex = r.replace('#', '');
      this.r = parseInt(hex.substr(0, 2), 16);
      this.g = parseInt(hex.substr(2, 2), 16);
      this.b = parseInt(hex.substr(4, 2), 16);
    } else {
      this.r = r;
      this.g = g || 0;
      this.b = b || 0;
      this.hex = `#${r.toString(16).padStart(2, '0')}${(g || 0).toString(16).padStart(2, '0')}${(b || 0).toString(16).padStart(2, '0')}`;
    }
    this.red = this.r;
    this.green = this.g;
    this.blue = this.b;
  };
  
  MockColorRgb.fromHex = (hex: string) => new (MockColorRgb as any)(hex);
  
  return {
    GoveeClient: vi.fn().mockImplementation(() => ({
      getDevices: vi.fn().mockResolvedValue([]),
      getDeviceState: vi.fn().mockResolvedValue(null),
      controlDevice: vi.fn().mockResolvedValue(true),
      setBrightness: vi.fn().mockResolvedValue({}),
      setColor: vi.fn().mockResolvedValue({}),
      setColorTemperature: vi.fn().mockResolvedValue({}),
      setPowerState: vi.fn().mockResolvedValue({})
    })),
    GoveeApiClient: vi.fn().mockImplementation(() => ({
      getDevices: vi.fn().mockResolvedValue([]),
      getDeviceState: vi.fn().mockResolvedValue(null),
      controlDevice: vi.fn().mockResolvedValue(true)
    })),
    Brightness: MockBrightness,
    ColorRgb: MockColorRgb,
    ColorTemperature: MockColorTemperature
  };
});

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});