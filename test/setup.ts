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
      debug: vi.fn(),
      setLevel: vi.fn()
    },
    settings: {
      getGlobalSettings: vi.fn().mockResolvedValue({}),
      setGlobalSettings: vi.fn().mockResolvedValue(undefined)
    },
    ui: {
      current: null
    },
    actions: {
      registerAction: vi.fn()
    }
  },
  SingletonAction: class SingletonAction {
    constructor() {}
  },
  action: () => (target: any) => target,
  LogLevel: {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4
  }
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

  const MockColorRgb = function(this: any, r: number, g: number, b: number) {
    // Validate RGB components (matching real ColorRgb behavior)
    const validateComponent = (value: number, component: string) => {
      if (!Number.isFinite(value)) {
        throw new Error(`RGB ${component} component must be a finite number`);
      }
      const rounded = Math.round(value);
      if (rounded < 0 || rounded > 255) {
        throw new Error(`RGB ${component} component must be between 0 and 255, got ${value}`);
      }
    };

    validateComponent(r, 'red');
    validateComponent(g, 'green');
    validateComponent(b, 'blue');

    this.r = Math.round(r);
    this.g = Math.round(g);
    this.b = Math.round(b);
  };

  MockColorRgb.fromHex = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return new (MockColorRgb as any)(r, g, b);
  };

  // Mock LightScene class (matches placeholder in SceneMapper.ts)
  class MockLightScene {
    constructor(
      public readonly id: number,
      public readonly paramId: number,
      public readonly name: string
    ) {}

    static sunrise() { return new MockLightScene(3853, 4280, 'Sunrise'); }
    static sunset() { return new MockLightScene(3854, 4281, 'Sunset'); }
    static rainbow() { return new MockLightScene(3858, 4285, 'Rainbow'); }
    static aurora() { return new MockLightScene(3857, 4284, 'Aurora'); }
    static candlelight() { return new MockLightScene(3867, 4294, 'Candlelight'); }
    static nightlight() { return new MockLightScene(3868, 4295, 'Nightlight'); }
    static romantic() { return new MockLightScene(3869, 4296, 'Romantic'); }
    static blinking() { return new MockLightScene(3870, 4297, 'Blinking'); }
  }

  // Mock MusicMode class (matches placeholder in MusicModeMapper.ts)
  class MockMusicMode {
    constructor(
      public readonly modeId: number,
      public readonly sensitivity?: number
    ) {}
  }

  // Mock SegmentColor class (matches placeholder in SegmentColorMapper.ts)
  class MockSegmentColor {
    constructor(
      public readonly index: number,
      public readonly color: any,
      public readonly brightness?: any
    ) {}
  }

  return {
    GoveeApiClient: vi.fn().mockImplementation(() => ({
      getDevices: vi.fn().mockResolvedValue([]),
      getDeviceState: vi.fn().mockResolvedValue(null),
      controlDevice: vi.fn().mockResolvedValue(true)
    })),
    GoveeClient: vi.fn().mockImplementation(() => ({
      getDevices: vi.fn().mockResolvedValue([]),
      getDeviceState: vi.fn().mockResolvedValue(null),
      controlDevice: vi.fn().mockResolvedValue(true)
    })),
    Brightness: MockBrightness,
    ColorRgb: MockColorRgb,
    ColorTemperature: MockColorTemperature,
    LightScene: MockLightScene,
    MusicMode: MockMusicMode,
    SegmentColor: MockSegmentColor
  };
});

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});