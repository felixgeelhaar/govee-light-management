import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  KeyDownEvent,
  WillAppearEvent,
  WillDisappearEvent,
  type Action,
  type SendToPluginEvent,
  streamDeck
} from "@elgato/streamdeck";
import { LightControlAction } from "../../../src/backend/actions/LightControlAction";
import { Light } from "../../../src/backend/domain/entities/Light";
import { Brightness, ColorRgb, ColorTemperature } from "@felixgeelhaar/govee-api-client";

// Mock services
const mockGetAllLights = vi.fn();
const mockFindLight = vi.fn();
const mockGetLightState = vi.fn();
const mockControlLight = vi.fn();
const mockTurnOnLightWithSettings = vi.fn();

// Mock streamDeck
vi.mock("@elgato/streamdeck", async () => {
  const actual = await vi.importActual("@elgato/streamdeck");
  return {
    ...actual,
    streamDeck: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      ui: {
        current: {
          sendToPropertyInspector: vi.fn(),
        },
      },
    },
  };
});

// Mock the Govee API client
vi.mock("@felixgeelhaar/govee-api-client", () => {
  class MockBrightness {
    value: number;
    
    constructor(value: number) {
      this.value = value;
    }
    
    get level() {
      return this.value;
    }
  }

  class MockColorRgb {
    r: number;
    g: number;
    b: number;
    red: number;
    green: number;
    blue: number;
    hex: string;
    
    constructor(r: number, g: number, b: number) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.red = r;
      this.green = g;
      this.blue = b;
      this.hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    toString() {
      return `rgb(${this.r}, ${this.g}, ${this.b})`;
    }
    
    static fromHex(hex: string) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return new MockColorRgb(r, g, b);
    }
  }

  class MockColorTemperature {
    kelvin: number;
    
    constructor(kelvin: number) {
      this.kelvin = kelvin;
    }
  }

  class MockGoveeClient {
    constructor(config: any) {
      // Mock constructor
    }
    
    async getDevices() {
      return [];
    }
    
    async setPower(device: any, powerOn: boolean) {
      return {};
    }
    
    async setBrightness(device: any, brightness: any) {
      return {};
    }
    
    async setColor(device: any, color: any) {
      return {};
    }
    
    async setColorTemperature(device: any, temperature: any) {
      return {};
    }
  }
  
  return {
    Brightness: MockBrightness,
    ColorRgb: MockColorRgb,
    ColorTemperature: MockColorTemperature,
    GoveeClient: MockGoveeClient,
  };
});

// Mock the repository and services
vi.mock("../../../src/backend/infrastructure/repositories/EnhancedGoveeLightRepository", () => ({
  EnhancedGoveeLightRepository: vi.fn().mockImplementation(() => ({
    getAllLights: mockGetAllLights,
    findLight: mockFindLight,
    getLightState: mockGetLightState,
  })),
}));

vi.mock("../../../src/backend/domain/services/LightControlService", () => ({
  LightControlService: vi.fn().mockImplementation(() => ({
    controlLight: mockControlLight,
    turnOnLightWithSettings: mockTurnOnLightWithSettings,
  })),
}));

describe("LightControlAction", () => {
  let action: LightControlAction;
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock light
    mockLight = Light.create("test-device-id", "H6159", "Test Light", {
      isOn: true,
      isOnline: true,
      brightness: new Brightness(75),
      color: new ColorRgb(255, 0, 0),
      colorTemperature: new ColorTemperature(4000),
    });

    // Create mock Stream Deck action
    mockStreamDeckAction = {
      setFeedback: vi.fn().mockResolvedValue(undefined),
      setImage: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({}),
      setSettings: vi.fn().mockResolvedValue(undefined),
    } as any;

    action = new LightControlAction();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("should set title and load light when properly configured", async () => {
      mockFindLight.mockResolvedValue(mockLight);
      mockGetLightState.mockResolvedValue(undefined);

      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            selectedLightName: "Test Light",
            controlMode: "toggle",
          },
        },
      } as any;

      await action.onWillAppear(event);

      expect(mockStreamDeckAction.setTitle).toHaveBeenCalledWith("Toggle\nTest Light");
      expect(mockFindLight).toHaveBeenCalledWith("test-device-id", "H6159");
      expect(mockGetLightState).toHaveBeenCalledWith(mockLight);
    });

    it("should handle missing configuration gracefully", async () => {
      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {},
        },
      } as any;

      await action.onWillAppear(event);

      expect(mockStreamDeckAction.setTitle).toHaveBeenCalledWith("Configure\nLight");
      expect(mockFindLight).not.toHaveBeenCalled();
    });

    it("should handle light loading errors", async () => {
      mockFindLight.mockRejectedValue(new Error("Light not found"));

      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
          },
        },
      } as any;

      await action.onWillAppear(event);

      expect(streamDeck.logger.error).toHaveBeenCalledWith("Failed to load light state:", expect.any(Error));
    });
  });

  describe("onKeyDown", () => {
    beforeEach(async () => {
      // Setup the action with a valid light
      mockFindLight.mockResolvedValue(mockLight);
      mockGetLightState.mockResolvedValue(undefined);

      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
          },
        },
      } as any;
      await action.onWillAppear(initEvent);
    });

    it("should toggle light when controlMode is toggle", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "toggle",
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(mockLight, "off"); // Light is on, so should turn off
    });

    it("should turn on light when controlMode is on", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "on",
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(mockLight, "on");
    });

    it("should turn off light when controlMode is off", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "off",
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(mockLight, "off");
    });

    it("should set brightness when controlMode is brightness", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "brightness",
            brightnessValue: 50,
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(
        mockLight,
        "brightness",
        expect.objectContaining({ level: 50 })
      );
    });

    it("should set color when controlMode is color", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "color",
            colorValue: "#00ff00", // Green
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(
        mockLight,
        "color",
        expect.objectContaining({ r: 0, g: 255, b: 0 })
      );
    });

    it("should set color temperature when controlMode is colorTemp", async () => {
      mockControlLight.mockResolvedValue(undefined);

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "colorTemp",
            colorTempValue: 5000,
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockControlLight).toHaveBeenCalledWith(
        mockLight,
        "colorTemperature",
        expect.objectContaining({ kelvin: 5000 })
      );
    });

    it("should show alert when not configured", async () => {
      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            controlMode: "toggle",
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockStreamDeckAction.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.warn).toHaveBeenCalledWith("Light control action not properly configured");
    });

    it("should show alert on control error", async () => {
      mockControlLight.mockRejectedValue(new Error("API Error"));

      const event: KeyDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-device-id",
            selectedModel: "H6159",
            controlMode: "toggle",
          },
        },
      } as any;

      await action.onKeyDown(event);

      expect(mockStreamDeckAction.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalledWith("Failed to control light:", expect.any(Error));
    });
  });

  describe("onSendToPlugin", () => {
    it("should handle validateApiKey event", async () => {
      mockGetAllLights.mockResolvedValue([mockLight]);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "validateApiKey",
          apiKey: "test-api-key",
        },
      } as any;

      await action.onSendToPlugin(event);

      expect(streamDeck.ui.current?.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "apiKeyValidated",
        isValid: true,
      });
    });

    it("should handle getLights event", async () => {
      mockGetAllLights.mockResolvedValue([mockLight]);
      mockStreamDeckAction.getSettings.mockResolvedValue({
        apiKey: "test-api-key",
      });

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getLights",
        },
      } as any;

      await action.onSendToPlugin(event);

      expect(streamDeck.ui.current?.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "lightsReceived",
        lights: [
          {
            label: "Test Light",
            value: "test-device-id|H6159",
          },
        ],
      });
    });

    it("should handle invalid API key validation", async () => {
      mockGetAllLights.mockRejectedValue(new Error("Invalid API key"));

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "validateApiKey",
          apiKey: "invalid-key",
        },
      } as any;

      await action.onSendToPlugin(event);

      expect(streamDeck.ui.current?.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "apiKeyValidated",
        isValid: false,
        error: "Invalid API key",
      });
    });

    it("should handle getLights without API key", async () => {
      mockStreamDeckAction.getSettings.mockResolvedValue({});

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getLights",
        },
      } as any;

      await action.onSendToPlugin(event);

      expect(streamDeck.ui.current?.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "lightsReceived",
        error: "API key required to fetch lights",
      });
    });

    it("should handle malformed payload", async () => {
      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: "invalid-payload",
      } as any;

      await action.onSendToPlugin(event);

      // Should not throw or call any methods
      expect(streamDeck.ui.current?.sendToPropertyInspector).not.toHaveBeenCalled();
    });
  });
});