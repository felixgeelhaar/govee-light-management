/**
 * Test setup file for Vitest
 * 
 * This file configures global test environment and mocks common dependencies.
 * It's automatically loaded before each test file runs.
 */

import { beforeEach, vi } from 'vitest';

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
vi.mock('@elgato/streamdeck', () => ({
  streamDeck: {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    settings: {
      getGlobalSettings: vi.fn().mockResolvedValue({}),
      setGlobalSettings: vi.fn().mockResolvedValue(undefined)
    },
    ui: {
      current: null
    }
  },
  SingletonAction: class SingletonAction {
    constructor() {}
  },
  action: () => (target: any) => target
}));

// Mock Govee API client base class to avoid network calls in unit tests
vi.mock('@felixgeelhaar/govee-api-client', () => {
  // Create constructor functions that work with instanceof
  const MockBrightness = function(this: any, value: number) {
    this.level = value;
  };
  
  const MockColorTemperature = function(this: any, kelvin: number) {
    this.kelvin = kelvin;
  };
  
  const MockColorRgb = function(this: any, hex: string) {
    this.hex = hex;
  };
  
  MockColorRgb.fromHex = (hex: string) => new (MockColorRgb as any)(hex);
  
  return {
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