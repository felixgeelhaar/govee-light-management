import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  DialRotateEvent, 
  DialDownEvent, 
  TouchTapEvent,
  WillAppearEvent,
  type Action,
  type SendToPluginEvent
} from "@elgato/streamdeck";
import { ColorDialAction } from "../../../../src/backend/actions/dials/ColorDialAction";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { ColorRgb } from "@felixgeelhaar/govee-api-client";

// Mock the entire modules
vi.mock("../../../../src/backend/infrastructure/repositories/GoveeLightRepository", () => ({
  GoveeLightRepository: vi.fn().mockImplementation(() => ({
    getAllLights: vi.fn(),
  })),
}));

vi.mock("../../../../src/backend/domain/services/LightControlService", () => ({
  LightControlService: vi.fn().mockImplementation(() => ({
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

describe("ColorDialAction", () => {
  let action: ColorDialAction;
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock ColorRgb using the global mock
    const mockColorRgb = new ColorRgb(255, 0, 0); // Red color
    
    // Create mock light using factory method
    mockLight = Light.create("test-id", "test-model", "Test Light", {
      isOn: true,
      isOnline: true,
      brightness: undefined,
      color: mockColorRgb,
      colorTemperature: undefined,
    });

    // Create mock Stream Deck action
    mockStreamDeckAction = {
      setFeedback: vi.fn().mockResolvedValue(undefined),
      setImage: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn().mockResolvedValue(undefined),
    } as any;

    action = new ColorDialAction();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("should initialize with current light color", async () => {
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
      
      // Check that feedback was set with the correct structure
      const feedbackCall = mockStreamDeckAction.setFeedback.mock.calls[0][0];
      expect(feedbackCall).toHaveProperty('title');
      expect(feedbackCall).toHaveProperty('value');
      expect(feedbackCall).toHaveProperty('indicator');
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
      
      // Verify feedback shows no light selected
      const feedbackCall = mockStreamDeckAction.setFeedback.mock.calls[0][0];
      expect(feedbackCall.title).toBe("No Light Selected");
      expect(feedbackCall.indicator.enabled).toBe(false);
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
      
      const mockSetColor = vi.fn().mockResolvedValue(undefined);
      (LightControlService as any).mockImplementation(() => ({
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));
      
      // Initialize the action by setting up the current light
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
    });

    it("should adjust hue on rotation in hue mode", async () => {
      // The service is already set up and light is loaded from beforeEach
      // Now trigger a rotation
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 3,
          pressed: false,
          settings: { stepSize: 10 },
        },
      } as any;

      await action.onDialRotate(event);

      // Check that LightControlService was created and setColor was called
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColor).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });

    it("should show alert on error", async () => {
      // Get the mocked LightControlService instance and make it throw
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      if (instance?.setColor) {
        instance.setColor.mockRejectedValueOnce(new Error("API Error"));
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
    beforeEach(async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
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
    });

    it("should cycle through modes on press", async () => {
      const event: DialDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: { mode: "hue" },
        },
      } as any;

      await action.onDialDown(event);
      expect(mockStreamDeckAction.setTitle).toHaveBeenCalled();
    });
  });

  describe("onTouchTap", () => {
    beforeEach(async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setColor: vi.fn().mockResolvedValue(undefined),
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
    });

    it("should reset to white on long touch", async () => {
      const event: TouchTapEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          hold: true,
          settings: {},
        },
      } as any;

      await action.onTouchTap(event);

      // Check that LightControlService was created and setColor was called
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const instance = (LightControlService as any).mock.results[0]?.value;
      expect(instance?.setColor).toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
    
    it("should not react to short touch", async () => {
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      const mockSetColor = vi.fn();
      (LightControlService as any).mockImplementation(() => ({
        setColor: mockSetColor,
        toggle: vi.fn(),
      }));
      
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

      expect(mockSetColor).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("should send device list when requested", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
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
      await action.onWillAppear(initEvent);

      const event = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          event: "getDevices",
        },
      } as any;

      await action.onSendToPlugin(event);

      expect(mockGetAllLights).toHaveBeenCalled();
      expect(mockStreamDeckAction.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "devicesReceived",
        devices: [
          {
            deviceId: "test-id",
            model: "test-model",
            name: "Test Light",
            isOnline: true,
            supportsColor: true,
          },
        ],
      });
    });
  });
});