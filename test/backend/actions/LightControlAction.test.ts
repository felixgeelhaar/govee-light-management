import { describe, it, expect, beforeEach, vi } from "vitest";
import { LightControlAction } from "../../../src/backend/actions/LightControlAction";

describe("LightControlAction", () => {
  let action: LightControlAction;
  let mockAction: any;

  beforeEach(() => {
    action = new LightControlAction();

    // Mock Stream Deck action object
    mockAction = {
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({}),
      setSettings: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("onWillAppear", () => {
    it("should set title to 'Configure\\nLight' when not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {},
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Configure\nLight");
    });

    it("should set title with light name when configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Living Room",
            controlMode: "toggle",
          },
        },
      };

      await action.onWillAppear(ev as any);

      // "Living Room" is 11 chars, gets truncated to "Living Roo..."
      expect(mockAction.setTitle).toHaveBeenCalledWith("Toggle\nLiving Roo...");
    });

    it("should handle missing API key gracefully", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            selectedDeviceId: "device-1",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("should show alert if action is not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {}, // Not configured
        },
      };

      await action.onKeyDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });

    it("should show alert if no API key is provided", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            controlMode: "toggle",
            // Missing apiKey
          },
        },
      };

      await action.onKeyDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });

    it("should show alert if light is not selected", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            controlMode: "toggle",
            // Missing selectedDeviceId and selectedModel
          },
        },
      };

      await action.onKeyDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("should handle getLights event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getLights",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should handle validateApiKey event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "validateApiKey",
          apiKey: "test-key",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should ignore invalid event payloads", async () => {
      const ev = {
        action: mockAction,
        payload: "invalid",
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should ignore events without event property", async () => {
      const ev = {
        action: mockAction,
        payload: {
          someOtherProperty: "value",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });
  });

  describe("Title Generation", () => {
    it("should generate correct title for toggle mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom",
            controlMode: "toggle",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Toggle\nBedroom");
    });

    it("should generate correct title for on mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Kitchen",
            controlMode: "on",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("On\nKitchen");
    });

    it("should generate correct title for off mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Office",
            controlMode: "off",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Off\nOffice");
    });

    it("should generate correct title for brightness mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Hallway",
            controlMode: "brightness",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Bright\nHallway");
    });

    it("should generate correct title for color mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Garage",
            controlMode: "color",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Color\nGarage");
    });

    it("should generate correct title for colorTemp mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Basement",
            controlMode: "colorTemp",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Temp\nBasement");
    });

    it("should truncate long light names", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Very Long Light Name That Should Be Truncated",
            controlMode: "toggle",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("...")
      );
    });
  });

  describe("Nightlight Control Mode", () => {
    it("should generate correct title for nightlight-on mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom",
            controlMode: "nightlight-on",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        "Night On\nBedroom"
      );
    });

    it("should generate correct title for nightlight-off mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom",
            controlMode: "nightlight-off",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        "Night Off\nBedroom"
      );
    });
  });

  describe("Gradient Control Mode", () => {
    it("should generate correct title for gradient-on mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Living Room",
            controlMode: "gradient-on",
          },
        },
      };

      await action.onWillAppear(ev as any);

      // "Living Room" is 11 chars, gets truncated to "Living Roo..."
      expect(mockAction.setTitle).toHaveBeenCalledWith(
        "Grad On\nLiving Roo..."
      );
    });

    it("should generate correct title for gradient-off mode", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Living Room",
            controlMode: "gradient-off",
          },
        },
      };

      await action.onWillAppear(ev as any);

      // "Living Room" is 11 chars, gets truncated to "Living Roo..."
      expect(mockAction.setTitle).toHaveBeenCalledWith(
        "Grad Off\nLiving Roo..."
      );
    });
  });

  describe("Control Mode Configuration", () => {
    it("should handle all predefined control modes", async () => {
      const modes = [
        "toggle",
        "on",
        "off",
        "brightness",
        "color",
        "colorTemp",
        "nightlight-on",
        "nightlight-off",
        "gradient-on",
        "gradient-off",
      ];

      for (const mode of modes) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H6143",
              selectedLightName: "Test Light",
              controlMode: mode,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });
  });

  describe("Telemetry Event Handling", () => {
    it("should handle getTransportHealth event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getTransportHealth",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should handle getTelemetrySnapshot event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getTelemetrySnapshot",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should handle resetTelemetry event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "resetTelemetry",
        },
      };

      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });
  });
});
