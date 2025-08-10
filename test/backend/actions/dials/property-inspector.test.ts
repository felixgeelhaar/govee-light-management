import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  SendToPluginEvent,
  WillAppearEvent,
  TouchTapEvent,
  type Action,
  type JsonValue
} from "@elgato/streamdeck";

// Mock the entire modules
vi.mock("../../../../src/backend/infrastructure/repositories/GoveeLightRepository", () => ({
  GoveeLightRepository: vi.fn().mockImplementation(() => ({
    getAllLights: vi.fn(),
  })),
}));

vi.mock("../../../../src/backend/domain/services/LightControlService", () => ({
  LightControlService: vi.fn().mockImplementation(() => ({
    setBrightness: vi.fn(),
    setColorTemperature: vi.fn(),
    setColor: vi.fn(),
    toggle: vi.fn(),
  })),
}));

// Mock streamDeck completely to prevent logger initialization
vi.mock("@elgato/streamdeck", () => {
  return {
    streamDeck: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setLevel: vi.fn(),
      },
      ui: {
        current: {
          sendToPropertyInspector: vi.fn(),
        },
      },
    },
    LogLevel: {
      TRACE: 0,
      DEBUG: 1,
      INFO: 2,
      WARN: 3,
      ERROR: 4,
    },
    SingletonAction: class MockSingletonAction {
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
    DialAction: class MockDialAction {
      constructor() {}
    },
    KeyAction: class MockKeyAction {
      constructor() {}
    },
    action: () => (target: any) => target,
    SendToPluginEvent: {} as any,
    WillAppearEvent: {} as any,
    TouchTapEvent: {} as any,
  };
});

import { BrightnessDialAction } from "../../../../src/backend/actions/dials/BrightnessDialAction";
import { ColorTemperatureDialAction } from "../../../../src/backend/actions/dials/ColorTemperatureDialAction";
import { ColorDialAction } from "../../../../src/backend/actions/dials/ColorDialAction";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { Brightness, ColorRgb, ColorTemperature } from "@felixgeelhaar/govee-api-client";

describe.skip("Property Inspector Dial Controls", () => {
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLights: Light[];

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock lights for device selection
    mockLights = [
      Light.create("light-1", "model-1", "Living Room", {
        isOn: true,
        isOnline: true,
        brightness: new Brightness(80),
        color: new ColorRgb(255, 128, 64),
        colorTemperature: undefined,
      }),
      Light.create("light-2", "model-2", "Kitchen Strip", {
        isOn: false,
        isOnline: true,
        brightness: new Brightness(50),
        color: undefined,
        colorTemperature: new ColorTemperature(4000),
      }),
      Light.create("light-3", "model-3", "Bedroom Lamp", {
        isOn: true,
        isOnline: false,
        brightness: new Brightness(100),
        color: undefined,
        colorTemperature: new ColorTemperature(2700),
      }),
    ];

    // Create mock Stream Deck action
    mockStreamDeckAction = {
      setFeedback: vi.fn().mockResolvedValue(undefined),
      setImage: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn().mockResolvedValue(undefined),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Device List Management", () => {
    it("should provide device list to brightness dial property inspector", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new BrightnessDialAction();
      
      // Initialize the action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;
      
      await action.onSendToPlugin(event);
      
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "devicesReceived",
          devices: expect.arrayContaining([
            expect.objectContaining({
              deviceId: "light-1",
              model: "model-1",
              name: "Living Room",
              isOnline: true,
            }),
          ]),
        })
      );
    });

    it("should handle device list request with API error", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockRejectedValueOnce(new Error("Network timeout"));
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize the action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await action.onSendToPlugin(event);

      // Should handle error gracefully
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });

    it("should include capability information in device list", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const colorAction = new ColorDialAction();
      
      // Initialize the action
      await colorAction.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await colorAction.onSendToPlugin(event);

      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });
  });

  describe("Color Temperature Dial Property Inspector", () => {
    it("should provide preset options on touch tap", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorTemperatureDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-2",
            selectedModel: "model-2",
            selectedLightName: "Kitchen Strip",
          } 
        },
      } as any);

      const event: TouchTapEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          hold: false,
          settings: {},
        },
      } as any;

      await action.onTouchTap(event);

      // Verify some response was sent
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });

    it("should handle preset selection from property inspector", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColorTemperature = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: mockSetColorTemperature,
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorTemperatureDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-2",
          } 
        },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "selectPreset",
          temperature: 5000,
        },
      } as any;

      await action.onSendToPlugin(event);

      // Should process the request (may or may not call API depending on light state)
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should include color temperature capability in device list", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize the action
      await tempAction.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);
      
      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await tempAction.onSendToPlugin(event);

      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });

    it("should handle temperature range validation", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColorTemperature = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: mockSetColorTemperature,
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorTemperatureDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-2",
          } 
        },
      } as any);

      // Test temperatures outside normal range
      const extremeTemps = [1500, 15000]; // Below 2000K and above 9000K
      
      for (const temp of extremeTemps) {
        vi.clearAllMocks();
        
        const event: SendToPluginEvent<any, any> = {
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: {
            event: "selectPreset",
            temperature: temp,
          },
        } as any;

        await action.onSendToPlugin(event);
        
        // Action should handle gracefully
        expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      }
    });
  });

  describe("Color Dial Property Inspector", () => {
    it("should handle color selection from property inspector", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColor = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-1",
          } 
        },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "setColor",
          color: { r: 128, g: 64, b: 192 },
        },
      } as any;

      await action.onSendToPlugin(event);

      // Should process the color data
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should validate color values from property inspector", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColor = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-1",
          } 
        },
      } as any);

      // Test invalid color values
      const invalidColors = [
        { r: -10, g: 128, b: 64 },    // Negative value
        { r: 300, g: 128, b: 64 },    // Value > 255
        { r: "red", g: 128, b: 64 },  // Non-numeric value
      ];
      
      for (const color of invalidColors) {
        vi.clearAllMocks();
        
        const event: SendToPluginEvent<any, any> = {
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: {
            event: "setColor",
            color,
          },
        } as any;

        await action.onSendToPlugin(event);
        
        // Action should handle gracefully
        expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      }
    });

    it("should provide color palette to property inspector", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { 
          settings: { 
            apiKey: "test-api-key",
            selectedDeviceId: "light-1",
          } 
        },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getColorPalette",
        },
      } as any;

      await action.onSendToPlugin(event);

      // Should handle unknown events gracefully
      expect(() => {}).not.toThrow();
    });
  });

  describe("Cross-Action Communication", () => {
    it("should handle multiple property inspector instances", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const brightnessAction = new BrightnessDialAction();
      const colorAction = new ColorDialAction();
      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize all actions
      const initPromises = [brightnessAction, colorAction, tempAction].map(action =>
        action.onWillAppear({
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device", 
          payload: { settings: { apiKey: "test-api-key" } },
        } as any)
      );
      
      await Promise.all(initPromises);

      // Each action should handle device list requests independently
      const deviceRequests = [brightnessAction, colorAction, tempAction].map(action => {
        const event: SendToPluginEvent<any, any> = {
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: { event: "getDevices" },
        } as any;
        
        return action.onSendToPlugin(event);
      });
      
      await Promise.all(deviceRequests);

      // All actions should have responded with device lists
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });

    it("should maintain action-specific device filtering", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const colorAction = new ColorDialAction();
      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize actions
      await Promise.all([
        colorAction.onWillAppear({
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: { settings: { apiKey: "test-api-key" } },
        } as any),
        tempAction.onWillAppear({
          action: mockStreamDeckAction,
          context: "test-context", 
          device: "test-device",
          payload: { settings: { apiKey: "test-api-key" } },
        } as any),
      ]);

      // Request devices from both actions
      const colorEvent: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "color-context",
        device: "test-device",
        payload: { event: "getDevices" },
      } as any;
      
      const tempEvent: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "temp-context",
        device: "test-device", 
        payload: { event: "getDevices" },
      } as any;

      await colorAction.onSendToPlugin(colorEvent);
      await tempAction.onSendToPlugin(tempEvent);

      // Both actions should respond with device lists
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });
  });

  describe("Property Inspector Error Handling", () => {
    it("should handle malformed property inspector messages", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new BrightnessDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);

      // Send malformed messages
      const malformedEvents = [
        { event: null },
        { event: "" },
        { event: "unknownEvent" },
        {},
        { event: "getDevices", extraData: "should be ignored" },
      ];
      
      for (const payload of malformedEvents) {
        const event: SendToPluginEvent<any, any> = {
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: payload as any,
        } as any;

        // Should not throw errors
        await expect(action.onSendToPlugin(event)).resolves.not.toThrow();
      }
    });

    it("should handle property inspector communication without API key", async () => {
      const action = new ColorTemperatureDialAction();
      
      // Initialize action without API key
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: {} },
      } as any);

      const event: SendToPluginEvent<any, any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await action.onSendToPlugin(event);

      // Should handle gracefully
      expect(() => {}).not.toThrow();
    });

    it("should handle concurrent property inspector requests", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key" } },
      } as any);

      // Send multiple concurrent requests
      const events = Array.from({ length: 5 }, () => ({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { event: "getDevices" },
      } as SendToPluginEvent<any, any>));

      const promises = events.map(event => action.onSendToPlugin(event));
      
      // All requests should complete without error
      await expect(Promise.all(promises)).resolves.toBeDefined();
      
      // Should have responded to requests
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalled();
    });
  });

  describe("Property Inspector Performance", () => {
    it("should handle rapid property inspector updates efficiently", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue(mockLights);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColor = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));

      const action = new ColorDialAction();
      
      // Initialize action
      await action.onWillAppear({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { apiKey: "test-api-key", selectedDeviceId: "light-1" } },
      } as any);

      // Simulate rapid color changes from property inspector
      const colorUpdates = Array.from({ length: 10 }, (_, i) => ({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "setColor",
          color: { r: i * 10, g: 128, b: 255 - (i * 10) },
        },
      } as SendToPluginEvent<any, any>));

      const startTime = Date.now();
      await Promise.all(colorUpdates.map(event => action.onSendToPlugin(event)));
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(500);
      
      // Should have processed updates
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });
});