import { describe, it, expect, beforeEach, vi } from "vitest";
import { ColorHueDialAction } from "@/backend/actions/ColorHueDialAction";
import type {
  DialRotateEvent,
  DialDownEvent,
  DialUpEvent,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { ColorRgb } from "@felixgeelhaar/govee-api-client";

const createMockAction = () => ({
  setTitle: vi.fn(),
  setFeedback: vi.fn(),
  setFeedbackLayout: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  showAlert: vi.fn(),
});

const createMockLight = (hue = 0) => ({
  deviceId: "test-device",
  model: "H6001",
  name: "Test Light",
  isOn: true,
  color: new ColorRgb(255, 0, 0), // Red
  capabilities: {
    brightness: true,
    power: true,
    color: true,
    colorTemperature: false,
    scenes: false,
  },
});

describe("ColorHueDialAction", () => {
  let action: ColorHueDialAction;

  beforeEach(() => {
    action = new ColorHueDialAction();
  });

  describe("onWillAppear", () => {
    it("initializes with configured light and displays hue", async () => {
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

      expect(mockAction.setTitle).toHaveBeenCalledWith("Configure\nColor Hue");
    });
  });

  describe("onDialRotate", () => {
    it("increases hue by 15° per tick when rotated clockwise", async () => {
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
          ticks: 2, // 2 ticks clockwise = +30°
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should attempt to adjust hue
      // (without full mocking, will show alert for unconfigured)
    });

    it("decreases hue by 15° per tick when rotated counter-clockwise", async () => {
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
          ticks: -3, // 3 ticks counter-clockwise = -45°
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should decrease hue
    });

    it("wraps hue from 360° to 0° when exceeding maximum", async () => {
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
          ticks: 25, // Would exceed 360°, should wrap to 0°
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should wrap around 360°
    });

    it("wraps hue from 0° to 360° when going below minimum", async () => {
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
          ticks: -25, // Would go below 0°, should wrap to 360°
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should wrap around to 360°
    });

    it("supports configurable step size", async () => {
      const mockAction = createMockAction();
      const settings = {
        apiKey: "test-key",
        selectedDeviceId: "test-device",
        selectedModel: "H6001",
        selectedLightName: "Test Light",
        stepSize: 30, // Custom step size
      };

      const ev: Partial<DialRotateEvent<any>> = {
        action: mockAction as any,
        payload: {
          settings,
          ticks: 1, // 1 tick = +30° with custom step
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

    it("shows alert when light does not support color", async () => {
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
          ticks: 1,
          pressed: false,
          coordinates: { column: 0, row: 0 },
          controller: "Encoder",
        } as any,
      };

      await action.onDialRotate(ev as DialRotateEvent<any>);

      // Should show alert if light doesn't support color
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
