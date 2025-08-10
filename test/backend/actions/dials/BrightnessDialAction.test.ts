import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  DialRotateEvent, 
  DialDownEvent, 
  TouchTapEvent,
  WillAppearEvent,
  type Action 
} from "@elgato/streamdeck";
import { BrightnessDialAction } from "../../../../src/backend/actions/dials/BrightnessDialAction";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { Brightness } from "@felixgeelhaar/govee-api-client";

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

  class MockGoveeClient {
    constructor(config: any) {
      // Mock constructor
    }
    
    async getDevices() {
      return [];
    }
    
    async setBrightness(device: any, brightness: any) {
      return {};
    }
  }
  
  return {
    Brightness: MockBrightness,
    GoveeClient: MockGoveeClient,
  };
});

// Mock the entire modules
vi.mock("../../../../src/backend/infrastructure/repositories/GoveeLightRepository", () => ({
  GoveeLightRepository: vi.fn().mockImplementation(() => ({
    getAllLights: vi.fn(),
  })),
}));

vi.mock("../../../../src/backend/domain/services/LightControlService", () => ({
  LightControlService: vi.fn().mockImplementation(() => ({
    setBrightness: vi.fn(),
    toggle: vi.fn(),
    controlLight: vi.fn(),
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

describe("BrightnessDialAction", () => {
  let action: BrightnessDialAction;
  let mockStreamDeckAction: vi.Mocked<Action>;
  let mockLight: Light;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock light using factory method
    mockLight = Light.create("test-id", "test-model", "Test Light", {
      isOn: true,
      isOnline: true,
      brightness: new Brightness(50),
      color: undefined,
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

    action = new BrightnessDialAction();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("should initialize and update feedback when API key is provided", async () => {
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
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalledWith({
        title: "Test Light",
        value: "50%",
        indicator: {
          value: 50,
          enabled: true,
        },
      });
    });

    it("should not initialize without API key", async () => {
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const mockGetAllLights = vi.fn();
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));

      const event: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {},
        },
      } as any;

      await action.onWillAppear(event);

      expect(mockGetAllLights).not.toHaveBeenCalled();
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalledWith({
        title: "No Light Selected",
        value: "50%",
        indicator: {
          value: 50,
          enabled: false,
        },
      });
    });
  });

  describe("onDialRotate", () => {
    let mockSetBrightness: vi.Mock;
    let mockToggle: vi.Mock;

    beforeEach(async () => {
      // Setup all mocks before initialization
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      mockToggle = vi.fn().mockResolvedValue(undefined);
      
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        toggle: mockToggle,
      }));

      // Initialize the action with all mocks in place
      const initEvent: WillAppearEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "test-id",
            stepSize: 5,
          },
        },
      } as any;
      await action.onWillAppear(initEvent);
    });

    it("should increase brightness on positive rotation", async () => {
      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 2,
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as any;

      await action.onDialRotate(event);

      expect(mockSetBrightness).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ level: 60 }) // 50 + (2 * 5)
      );
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "60%",
        })
      );
    });

    it("should show alert on error", async () => {
      // Make the brightness setter throw an error for this test
      mockSetBrightness.mockRejectedValueOnce(new Error("API Error"));

      const event: DialRotateEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          ticks: 1,
          pressed: false,
          settings: { stepSize: 5 },
        },
      } as any;

      await action.onDialRotate(event);

      expect(mockStreamDeckAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("onDialDown", () => {
    let mockSetBrightness: vi.Mock;
    let mockToggle: vi.Mock;

    beforeEach(async () => {
      // Setup all mocks before initialization
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      mockToggle = vi.fn().mockResolvedValue(undefined);
      
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        toggle: mockToggle,
      }));

      // Initialize the action with all mocks in place
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

    it("should toggle light on dial press", async () => {
      const event: DialDownEvent<any> = {
        action: mockStreamDeckAction,
        context: "test-context",
        device: "test-device",
        payload: {
          settings: {},
        },
      } as any;

      await action.onDialDown(event);

      expect(mockToggle).toHaveBeenCalledWith(mockLight);
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("onTouchTap", () => {
    let mockSetBrightness: vi.Mock;
    let mockToggle: vi.Mock;

    beforeEach(async () => {
      // Setup all mocks before initialization
      const { GoveeLightRepository } = await import("../../../../src/backend/infrastructure/repositories/GoveeLightRepository");
      const { LightControlService } = await import("../../../../src/backend/domain/services/LightControlService");
      
      const mockGetAllLights = vi.fn().mockResolvedValue([mockLight]);
      mockSetBrightness = vi.fn().mockResolvedValue(undefined);
      mockToggle = vi.fn().mockResolvedValue(undefined);
      
      (GoveeLightRepository as any).mockImplementation(() => ({
        getAllLights: mockGetAllLights,
      }));
      
      (LightControlService as any).mockImplementation(() => ({
        setBrightness: mockSetBrightness,
        toggle: mockToggle,
      }));

      // Initialize the action with all mocks in place
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

    it("should reset brightness to 50% on long touch", async () => {
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

      expect(mockSetBrightness).toHaveBeenCalledWith(
        mockLight,
        expect.objectContaining({ level: 50 })
      );
      expect(mockStreamDeckAction.setFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "50%",
        })
      );
    });

    it("should not react to short touch", async () => {
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

      expect(mockSetBrightness).not.toHaveBeenCalled();
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
          },
        ],
      });
    });
  });
});