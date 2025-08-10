import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  DialRotateEvent, 
  DialDownEvent, 
  TouchTapEvent,
  WillAppearEvent,
  type Action,
  type SendToPluginEvent
} from "@elgato/streamdeck";
import { ColorTemperatureDialAction } from "../../../../src/backend/actions/dials/ColorTemperatureDialAction";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";

// Mock the entire modules
vi.mock("../../../../src/backend/infrastructure/repositories/GoveeLightRepository", () => ({
  GoveeLightRepository: vi.fn().mockImplementation(() => ({
    getAllLights: vi.fn(),
  })),
}));

vi.mock("../../../../src/backend/domain/services/LightControlService", () => ({
  LightControlService: vi.fn().mockImplementation(() => ({
    setColorTemperature: vi.fn(),
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

describe("ColorTemperatureDialAction", () => {
  let action: ColorTemperatureDialAction;
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock light using factory method  
    mockLight = Light.create("test-id", "test-model", "Test Light", {
      isOn: true,
      isOnline: true,
      brightness: undefined,
      color: undefined,
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

    action = new ColorTemperatureDialAction();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("should initialize with current light temperature", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));

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

      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });

    it("should not initialize without API key", async () => {
      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {},
        },
      } as any;

      await action.onWillAppear(event);

      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("onDialRotate", () => {
    beforeEach(async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setColorTemperature: vi.fn().mockResolvedValue(undefined),
        toggle: vi.fn(),
      }));

      // Initialize the action first
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            stepSize: 100,
          },
        },
      } as any;
      await action.onWillAppear(initEvent);
    });

    it("should increase temperature on positive rotation", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 3,
          pressed: false,
          settings: { stepSize: 100 },
        },
      } as any;

      await action.onDialRotate(event);

      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 4300 }) // 4000 + (3 * 100)
      );
    });

    it("should decrease temperature on negative rotation", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: -2,
          pressed: false,
          settings: { stepSize: 100 },
        },
      } as any;

      await action.onDialRotate(event);

      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 3800 }) // 4000 - (2 * 100)
      );
    });

    it("should double step size when pressed", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: true,
          settings: { stepSize: 100 },
        },
      } as any;

      await action.onDialRotate(event);

      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 4400 }) // 4000 + (2 * 100 * 2)
      );
    });

    it("should clamp temperature at minimum", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: -30, // Would go to 1000K without clamping
          pressed: false,
          settings: { stepSize: 100, minTemperature: 2000 },
        },
      } as any;

      await action.onDialRotate(event);

      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 2000 })
      );
    });

    it("should clamp temperature at maximum", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 60, // Would go to 10000K without clamping
          pressed: false,
          settings: { stepSize: 100, maxTemperature: 9000 },
        },
      } as any;

      await action.onDialRotate(event);

      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 9000 })
      );
    });

    it("should show alert on error", async () => {
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      if (instance?.setColorTemperature) {
        instance.setColorTemperature.mockRejectedValueOnce(new Error("API Error"));
      }

      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 1,
          pressed: false,
          settings: {},
        },
      } as any;

      await action.onDialRotate(event);

      expect(mockStreamDeckAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("onDialDown", () => {
    it("should cycle through temperature presets on dial press", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColorTemperature = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setColorTemperature: mockSetColorTemperature,
        toggle: vi.fn(),
      }));

      // Initialize the action first
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

      const event: DialDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {},
        },
      } as any;

      await action.onDialDown(event);

      expect(mockSetColorTemperature).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ kelvin: 2700 }) // Next preset after 2000
      );
    });
  });

  describe("onTouchTap", () => {
    it("should send preset options to property inspector on touch tap", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      const mockSetColorTemperature = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setColorTemperature: mockSetColorTemperature,
        toggle: vi.fn(),
      }));

      // Initialize the action
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

      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "showPresets",
          presets: expect.any(Array)
        })
      );
    });

    it("should not send presets without light selected", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      // Don't initialize - test without light selected

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

      expect(mockStreamDeckAction.sendToPropertyInspector).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("should send device list when requested", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setColorTemperature: vi.fn(),
        toggle: vi.fn(),
      }));

      const testAction = new ColorTemperatureDialAction();

      // Initialize first
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
          },
        },
      } as any;
      await testAction.onWillAppear(initEvent);

      const event = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await testAction.onSendToPlugin(event);

      // May be called 1 or 2 times depending on initialization path
      expect(mockGetAllLights).toHaveBeenCalledTimes(1); // Called in onSendToPlugin
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "devicesReceived",
          devices: expect.arrayContaining([
            expect.objectContaining({
              deviceId: "test-id",
              model: "test-model",
              name: "Test Light",
              isOnline: true,
            }),
          ]),
        })
      );
    });
  });
});