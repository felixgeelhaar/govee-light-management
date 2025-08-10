import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  DialRotateEvent, 
  DialDownEvent, 
  TouchTapEvent,
  WillAppearEvent,
  type Action
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

// Mock streamDeck global
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

import { BrightnessDialAction } from "../../../../src/backend/actions/dials/BrightnessDialAction";
import { ColorTemperatureDialAction } from "../../../../src/backend/actions/dials/ColorTemperatureDialAction";
import { ColorDialAction } from "../../../../src/backend/actions/dials/ColorDialAction";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { Brightness, ColorRgb, ColorTemperature } from "@felixgeelhaar/govee-api-client";

describe("Dial Events Integration", () => {
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock light using factory method  
    mockLight = Light.create("test-id", "test-model", "Test Light", {
      isOn: true,
      isOnline: true,
      brightness: new Brightness(75),
      color: new ColorRgb(255, 128, 64),
      colorTemperature: new ColorTemperature(4000),
    });

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

  describe("Cross-action dial encoder sequences", () => {
    it("should handle rapid dial rotation across different actions", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      const mockSetColorTemperature = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        setColorTemperature: mockSetColorTemperature,
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));
      
      const brightnessAction = new BrightnessDialAction();
      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize both actions
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await Promise.all([
        brightnessAction.onWillAppear(initEvent),
        tempAction.onWillAppear(initEvent),
      ]);

      // Simulate rapid dial events
      const rapidEvents = Array.from({ length: 3 }, (_, i) => ({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: i % 2 === 0 ? 1 : -1, // Alternate direction
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as DialRotateEvent<any>));

      // Execute rapid events on both actions
      await Promise.all([
        ...rapidEvents.map(event => brightnessAction.onDialRotate(event)),
        ...rapidEvents.map(event => tempAction.onDialRotate(event)),
      ]);

      // Verify both actions handled events
      expect(mockSetBrightness).toHaveBeenCalled();
      expect(mockSetColorTemperature).toHaveBeenCalled();
    });

    it("should handle dial press and rotation combinations", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      
      const colorAction = new ColorDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            mode: "hue",
          },
        },
      } as any;

      await colorAction.onWillAppear(initEvent);

      // 1. Rotate dial (hue mode)
      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 3,
          pressed: false,
          settings: { mode: "hue", hueStepSize: 10 },
        },
      } as any;

      await colorAction.onDialRotate(rotateEvent);

      // 2. Press dial (switch to saturation mode)
      const pressEvent: DialDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: { mode: "hue" },
        },
      } as any;

      await colorAction.onDialDown(pressEvent);

      // Verify mode changes and color updates
      expect(mockSetColor).toHaveBeenCalled();
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalledWith("Saturation");
    });

    it("should handle touch tap with timing variations", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      const mockToggle = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: mockToggle,
      }));
      
      const brightnessAction = new BrightnessDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await brightnessAction.onWillAppear(initEvent);

      // Test short tap (should not trigger reset)
      const shortTapEvent: TouchTapEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          hold: false,
          settings: {},
        },
      } as any;

      await brightnessAction.onTouchTap(shortTapEvent);

      // Test long tap (should trigger reset)
      const longTapEvent: TouchTapEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          hold: true,
          settings: {},
        },
      } as any;

      await brightnessAction.onTouchTap(longTapEvent);

      // Verify only long tap triggered brightness reset
      expect(mockSetBrightness).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ level: 50 })
      );
    });
  });

  describe("Hardware encoder simulation", () => {
    it("should handle encoder detent precision", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      
      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            stepSize: 50, // 50K per detent
          },
        },
      } as any;

      await tempAction.onWillAppear(initEvent);

      // Test precise encoder detent values
      const detentValues = [1, 2, -1]; // Simulate encoder detent counts
      
      for (const ticks of detentValues) {
        const rotateEvent: DialRotateEvent<any> = {
          action: mockStreamDeckAction,
          context: "test-context",
          device: "test-device",
          payload: {
            ticks,
            pressed: false,
            settings: { stepSize: 50 },
          },
        } as any;

        await tempAction.onDialRotate(rotateEvent);
      }

      // Verify all detent movements were processed
      expect(mockSetColorTemperature).toHaveBeenCalledTimes(detentValues.length);
      
      // Check final temperature calculation: 4000 + (1+2-1)*50 = 4100K
      const lastCall = mockSetColorTemperature.mock.calls[mockSetColorTemperature.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ kelvin: 4100 }));
    });

    it("should handle encoder acceleration (pressed state)", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));
      
      const brightnessAction = new BrightnessDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            stepSize: 5,
          },
        },
      } as any;

      await brightnessAction.onWillAppear(initEvent);

      // Test normal speed (not pressed)
      const normalEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as any;

      await brightnessAction.onDialRotate(normalEvent);

      // Test accelerated speed (pressed)
      const acceleratedEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: true, // Should double speed
          settings: { stepSize: 5 },
        },
      } as any;

      await brightnessAction.onDialRotate(acceleratedEvent);

      // Verify different speeds were applied
      expect(mockSetBrightness).toHaveBeenCalledTimes(2);
      
      // Normal: 75 + (2 * 5) = 85%
      // Accelerated: 85 + (2 * 5 * 2) = 100% (clamped to max)
      const calls = mockSetBrightness.mock.calls;
      expect(calls[0][1]).toEqual(expect.objectContaining({ level: 85 }));
      expect(calls[1][1]).toEqual(expect.objectContaining({ level: 100 }));
    });

    it("should handle simultaneous encoder and touch events", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      
      const colorAction = new ColorDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await colorAction.onWillAppear(initEvent);

      // Create concurrent events
      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 5,
          pressed: false,
          settings: { mode: "hue" },
        },
      } as any;

      const touchEvent: TouchTapEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          hold: true, // Long touch - reset to white
          settings: {},
        },
      } as any;

      // Execute events concurrently
      await Promise.all([
        colorAction.onDialRotate(rotateEvent),
        colorAction.onTouchTap(touchEvent),
      ]);

      // Verify both events were processed
      expect(mockSetColor).toHaveBeenCalledTimes(2); // Once for rotate, once for reset
    });
  });

  describe("Error recovery and resilience", () => {
    it("should recover from network errors during dial events", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      // First call fails, second succeeds
      const mockSetBrightness = vi.fn()
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce(undefined);
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));
      
      const brightnessAction = new BrightnessDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await brightnessAction.onWillAppear(initEvent);

      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 1,
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as any;

      // First attempt should fail and show alert
      await brightnessAction.onDialRotate(rotateEvent);
      expect(mockStreamDeckAction.showAlert).toHaveBeenCalledTimes(1);

      // Second attempt should succeed
      await brightnessAction.onDialRotate(rotateEvent);
      expect(mockSetBrightness).toHaveBeenCalledTimes(2);
      expect(mockStreamDeckAction.showAlert).toHaveBeenCalledTimes(1); // No additional alert
    });

    it("should handle rapid event bursts without dropping commands", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      
      const tempAction = new ColorTemperatureDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await tempAction.onWillAppear(initEvent);

      // Create burst of rapid events (simulating fast dial spinning)
      const burstEvents = Array.from({ length: 5 }, () => ({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 1,
          pressed: false,
          settings: { stepSize: 100 },
        },
      } as DialRotateEvent<any>));

      // Execute all events rapidly
      const startTime = Date.now();
      await Promise.all(burstEvents.map(event => tempAction.onDialRotate(event)));
      const endTime = Date.now();

      // Verify all events were processed
      expect(mockSetColorTemperature).toHaveBeenCalledTimes(5);
      
      // Verify reasonable processing time (should be concurrent)
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe("Device state synchronization", () => {
    it("should maintain consistent state across multiple actions", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      const mockSetColor = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        setColorTemperature: vi.fn(),
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));
      
      const brightnessAction = new BrightnessDialAction();
      const colorAction = new ColorDialAction();
      
      // Initialize both actions with same light
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            selectedModel: "test-model",
            selectedLightName: "Test Light",
          },
        },
      } as any;

      await Promise.all([
        brightnessAction.onWillAppear(initEvent),
        colorAction.onWillAppear(initEvent),
      ]);

      // Modify brightness via brightness action
      const brightnessEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: false,
          settings: { stepSize: 10 },
        },
      } as any;

      await brightnessAction.onDialRotate(brightnessEvent);

      // Modify color via color action
      const colorEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 3,
          pressed: false,
          settings: { mode: "hue", hueStepSize: 15 },
        },
      } as any;

      await colorAction.onDialRotate(colorEvent);

      // Verify both actions made API calls
      expect(mockSetBrightness).toHaveBeenCalledTimes(1);
      expect(mockSetColor).toHaveBeenCalledTimes(1);
      
      // Verify feedback was updated on both actions
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });
});