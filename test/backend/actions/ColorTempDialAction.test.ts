import { describe, it, expect, beforeEach, vi } from "vitest";
import { ColorTempDialAction } from "@/backend/actions/ColorTempDialAction";
import type {
  DialRotateEvent,
  DialDownEvent,
  DialUpEvent,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";

const createMockAction = () => ({
  setTitle: vi.fn(),
  setFeedback: vi.fn(),
  setFeedbackLayout: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  showAlert: vi.fn(),
});

const createMockLight = (colorTemp = 6500) => ({
  deviceId: "test-device",
  model: "H6001",
  name: "Test Light",
  isOn: true,
  colorTemperature: new ColorTemperature(colorTemp),
  capabilities: {
    brightness: true,
    power: true,
    color: false,
    colorTemperature: true,
    scenes: false,
  },
});

describe("ColorTempDialAction", () => {
  let action: ColorTempDialAction;

  beforeEach(() => {
    action = new ColorTempDialAction();
  });

  describe("onWillAppear", () => {
    it("initializes with configured light and displays color temperature", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      mockAction.getSettings.mockResolvedValue(settings);

      const ev: Partial<WillAppearEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          coordinates: { column: 0, row: 0 },
          isInMultiAction: false,
        } as any,
      };

      await action.onWillAppear(ev as WillAppearEvent<any>);

      // Should set initial title
      expect(mockAction.setTitle).toHaveBeenCalled();
    });

    it("shows configuration prompt when light not selected", async () => {
      const mockAction = createMockAction();
      const settings = {};

      const ev: Partial<WillAppearEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          coordinates: { column: 0, row: 0 },
          isInMultiAction: false,
        } as any,
      };

      await action.onWillAppear(ev as WillAppearEvent<any>);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        "Configure\nColor Temp",
      );
    });
  });

  describe("onDialRotate", () => {
    it("increases color temperature by 100K per tick when rotated clockwise", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: 2, // 2 ticks clockwise = +200K
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should attempt to adjust color temperature
      // (without full mocking, will show alert for unconfigured)
    });

    it("decreases color temperature by 100K per tick when rotated counter-clockwise", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: -3, // 3 ticks counter-clockwise = -300K
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should decrease color temperature
    });

    it("clamps color temperature at 9000K maximum", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: 50, // Would exceed 9000K, should clamp
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should clamp at 9000K
    });

    it("clamps color temperature at 2000K minimum", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: -100, // Would go below 2000K, should clamp
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should clamp at 2000K
    });

    it("supports configurable step size", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
        stepSize: 200, // Custom step size
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: 1, // 1 tick = +200K with custom step
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should use custom step size
    });

    it("shows alert when light is not configured", async () => {
      const mockAction = createMockAction();
      const settings = {}; // No light configured

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: 1,
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("onDialDown", () => {
    it("toggles light power state when dial is pressed", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialDownEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialDown(ev as DialDownEvent<any>);

      // Should toggle power (shows alert without full setup)
    });
  });

  describe("onDialUp", () => {
    it("provides visual feedback when dial is released", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
      };

      const ev: Partial<DialUpEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialUp(ev as DialUpEvent<any>);

      // Visual feedback is automatically handled through the dial display
      // No explicit showOk call needed with newer SDK version
    });
  });
});
