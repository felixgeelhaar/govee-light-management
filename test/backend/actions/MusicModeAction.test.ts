import { describe, it, expect, beforeEach, vi } from "vitest";
import { MusicModeAction } from "../../../src/backend/actions/MusicModeAction";

describe("MusicModeAction", () => {
  let action: MusicModeAction;
  let mockAction: any;

  beforeEach(() => {
    action = new MusicModeAction();

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
    it("should set title to 'Music Mode' when not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {},
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Music Mode");
    });

    it("should set title with light name and mode when configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom Strip",
            musicMode: "rhythm",
            sensitivity: 50,
            autoColor: true,
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Bedroom Strip")
      );
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
            musicMode: "rhythm",
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
            musicMode: "rhythm",
            // Missing selectedDeviceId and selectedModel
          },
        },
      };

      await action.onKeyDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });

    it("should show alert if music mode is not selected", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            // Missing musicMode
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

    it("should handle getMusicModes event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getMusicModes",
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
    it("should show music mode name in title when configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Living Room",
            musicMode: "energic",
            sensitivity: 75,
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Energic")
      );
    });

    it("should handle missing mode name gracefully", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Living Room",
            // Missing musicMode
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalled();
    });
  });

  describe("Music Mode Configuration", () => {
    it("should handle all predefined music modes", async () => {
      const modes = ["rhythm", "energic", "spectrum", "rolling"];

      for (const mode of modes) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H6143",
              selectedLightName: "Test Light",
              musicMode: mode,
              sensitivity: 50,
              autoColor: true,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });

    it("should handle different sensitivity levels", async () => {
      const sensitivities = [0, 25, 50, 75, 100];

      for (const sensitivity of sensitivities) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H6143",
              musicMode: "rhythm",
              sensitivity,
              autoColor: true,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });

    it("should handle auto-color toggle", async () => {
      for (const autoColor of [true, false]) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H6143",
              musicMode: "rhythm",
              sensitivity: 50,
              autoColor,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });
  });
});
