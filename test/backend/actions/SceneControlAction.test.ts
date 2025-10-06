import { describe, it, expect, beforeEach, vi } from "vitest";
import { SceneControlAction } from "../../../src/backend/actions/SceneControlAction";

describe("SceneControlAction", () => {
  let action: SceneControlAction;
  let mockAction: any;

  beforeEach(() => {
    action = new SceneControlAction();

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
    it("should set title to 'Scene Control' when not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {},
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Scene Control");
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
            selectedSceneId: "sunrise",
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Living Room")
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
            selectedSceneId: "sunrise",
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
            selectedSceneId: "sunrise",
            // Missing selectedDeviceId and selectedModel
          },
        },
      };

      await action.onKeyDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });

    it("should show alert if scene is not selected", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            // Missing selectedSceneId
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

      // Should not throw when handling getLights
      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should handle getScenes event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getScenes",
          deviceId: "device-1",
          model: "H6143",
        },
      };

      // Should not throw when handling getScenes
      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should ignore invalid event payloads", async () => {
      const ev = {
        action: mockAction,
        payload: "invalid",
      };

      // Should not throw when ignoring invalid payload
      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });

    it("should ignore events without event property", async () => {
      const ev = {
        action: mockAction,
        payload: {
          someOtherProperty: "value",
        },
      };

      // Should not throw when ignoring invalid event
      await expect(action.onSendToPlugin(ev as any)).resolves.toBeUndefined();
    });
  });


  describe("Title Generation", () => {
    it("should show scene name in title when configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom",
            selectedSceneId: "sunset",
            selectedSceneName: "Sunset",
          },
        },
      };

      await action.onWillAppear(ev as any);

      // Title should contain both light name and scene name
      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Sunset")
      );
    });

    it("should handle missing scene name gracefully", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H6143",
            selectedLightName: "Bedroom",
            selectedSceneId: "custom-scene",
            // Missing selectedSceneName
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalled();
    });
  });
});
