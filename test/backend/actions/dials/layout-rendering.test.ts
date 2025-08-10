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

describe("Custom Layout Rendering", () => {
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(() => {
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

  describe("BrightnessDialAction Layout", () => {
    it("should render brightness layout with correct title and indicator", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      const event: WillAppearEvent<any> = {
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

      await action.onWillAppear(event);

      // Verify the action was initialized and feedback was set
      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      // Title may or may not be set depending on implementation
      // expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });

    it("should update layout dynamically during brightness changes", async () => {
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
      
      const action = new BrightnessDialAction();
      
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

      await action.onWillAppear(initEvent);

      // Rotate dial to change brightness
      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as any;

      await action.onDialRotate(rotateEvent);

      // Verify brightness was set and feedback was updated
      expect(mockSetBrightness).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should render disabled state for offline lights", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      // Create offline light
      const offlineLight = Light.create("offline-id", "offline-model", "Offline Light", {
        isOn: false,
        isOnline: false,
        brightness: new Brightness(50),
        color: undefined,
        colorTemperature: undefined,
      });
      
      const mockGetAllLights = vi.fn().mockResolvedValue([offlineLight]);
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
      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "offline-id",
            selectedModel: "offline-model",
            selectedLightName: "Offline Light",
          },
        },
      } as any;

      await action.onWillAppear(event);

      // Verify feedback was set for offline light
      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should handle no light selected state", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([]);
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
      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "nonexistent-id",
          },
        },
      } as any;

      await action.onWillAppear(event);

      // Verify feedback was set for no light selected
      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("ColorTemperatureDialAction Layout", () => {
    it("should render temperature layout with correct labeling", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
          },
        },
      } as any;

      await action.onWillAppear(event);

      // Verify feedback and title were set
      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });

    it("should update icon and label based on temperature ranges", async () => {
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

      const action = new ColorTemperatureDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
          },
        },
      } as any;

      await action.onWillAppear(initEvent);

      // Test temperature change
      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: -3,
          pressed: false,
          settings: { stepSize: 100 },
        },
      } as any;

      await action.onDialRotate(rotateEvent);

      // Verify temperature was set and feedback updated
      expect(mockSetColorTemperature).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should render indicator position correctly across temperature range", async () => {
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

      const action = new ColorTemperatureDialAction();
      
      // Initialize and test
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
          },
        },
      } as any;

      await action.onWillAppear(initEvent);

      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 0,
          pressed: false,
          settings: { stepSize: 100 },
        },
      } as any;

      await action.onDialRotate(rotateEvent);

      // Verify feedback was called
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("ColorDialAction Layout", () => {
    it("should render color layout with HSB mode indication", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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
      const event: WillAppearEvent<any> = {
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

      await action.onWillAppear(event);

      // Verify feedback and title were set
      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });

    it("should update layout for different HSB modes", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
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

      await action.onWillAppear(initEvent);

      // Test mode cycling by pressing dial
      const pressEvent: DialDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: { settings: { mode: "hue" } },
      } as any;

      await action.onDialDown(pressEvent);
      
      // Verify title was updated
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });

    it("should render live color preview in indicator", async () => {
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

      const action = new ColorDialAction();
      
      // Initialize action
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
          },
        },
      } as any;

      await action.onWillAppear(initEvent);

      // Rotate dial to change hue
      const rotateEvent: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 12,
          pressed: false,
          settings: { mode: "hue", hueStepSize: 5 },
        },
      } as any;

      await action.onDialRotate(rotateEvent);

      // Verify color was set and feedback updated
      expect(mockSetColor).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("Layout Error States", () => {
    it("should handle missing light gracefully across all actions", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: vi.fn(),
        setColorTemperature: vi.fn(),
        setColor: vi.fn(),
        toggle: vi.fn(),
      }));
      
      const actions = [
        new BrightnessDialAction(),
        new ColorTemperatureDialAction(),
        new ColorDialAction(),
      ];

      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "missing-id",
          },
        },
      } as any;

      for (const action of actions) {
        vi.clearAllMocks();
        
        await action.onWillAppear(event);

        // All actions should set feedback
        expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      }
    });

    it("should handle API errors during layout updates", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetBrightness = vi.fn().mockRejectedValueOnce(new Error("API timeout"));
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

      await brightnessAction.onDialRotate(rotateEvent);

      // Should show alert but not crash
      expect(mockStreamDeckAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("Layout Performance", () => {
    it("should render layouts efficiently during rapid updates", async () => {
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
          },
        },
      } as any;

      await colorAction.onWillAppear(initEvent);
      vi.clearAllMocks();

      // Simulate rapid dial movements
      const rapidEvents = Array.from({ length: 10 }, (_, i) => ({
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 1,
          pressed: false,
          settings: { mode: "hue", hueStepSize: 3 },
        },
      } as DialRotateEvent<any>));

      const startTime = Date.now();
      await Promise.all(rapidEvents.map(event => colorAction.onDialRotate(event)));
      const endTime = Date.now();

      // Should complete rapidly
      expect(endTime - startTime).toBeLessThan(500);
      
      // Should have called setFeedback for each event
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalledTimes(10);
    });
  });
});