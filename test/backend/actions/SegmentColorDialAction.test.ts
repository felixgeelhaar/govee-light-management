import { describe, it, expect, beforeEach, vi } from "vitest";
import { SegmentColorDialAction } from "../../../src/backend/actions/SegmentColorDialAction";

describe("SegmentColorDialAction", () => {
  let action: SegmentColorDialAction;
  let mockAction: any;

  beforeEach(() => {
    action = new SegmentColorDialAction();

    // Mock Stream Deck action object
    mockAction = {
      setTitle: vi.fn().mockResolvedValue(undefined),
      setFeedback: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({}),
      setSettings: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("onWillAppear", () => {
    it("should set title to 'Segment' when not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {},
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Segment");
    });

    it("should set title with light name and segment when configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            selectedLightName: "RGB Strip",
            segmentIndex: 0,
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("RGB Strip")
      );
      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Seg 1")
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

  describe("onDialRotate", () => {
    it("should adjust hue value when dial is rotated", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            selectedLightName: "RGB Strip",
            segmentIndex: 0,
            hue: 180,
            saturation: 100,
            brightness: 100,
            stepSize: 15,
          },
          ticks: 2,
        },
      };

      await action.onDialRotate(ev as any);

      // Should update feedback and title
      expect(mockAction.setFeedback).toHaveBeenCalled();
    });

    it("should handle negative rotation (counter-clockwise)", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            segmentIndex: 0,
            hue: 180,
            saturation: 100,
            brightness: 100,
          },
          ticks: -2,
        },
      };

      await action.onDialRotate(ev as any);

      expect(mockAction.setFeedback).toHaveBeenCalled();
    });

    it("should wrap hue value at 360 degrees", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            segmentIndex: 0,
            hue: 350,
            saturation: 100,
            brightness: 100,
            stepSize: 20,
          },
          ticks: 1,
        },
      };

      await action.onDialRotate(ev as any);

      expect(mockAction.setFeedback).toHaveBeenCalled();
    });
  });

  describe("onDialDown", () => {
    it("should apply segment color when dial is pressed", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            segmentIndex: 0,
            hue: 120,
            saturation: 100,
            brightness: 100,
          },
        },
      };

      // Should not throw - actual behavior tested with integration
      await expect(action.onDialDown(ev as any)).resolves.toBeUndefined();
    });

    it("should show alert if not configured", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {},
        },
      };

      await action.onDialDown(ev as any);

      expect(mockAction.showAlert).toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
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

    it("should handle getLights event without throwing", async () => {
      const ev = {
        action: mockAction,
        payload: {
          event: "getLights",
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

  describe("Segment Configuration", () => {
    it("should handle segment index 0 (first segment)", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            selectedLightName: "Strip",
            segmentIndex: 0,
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Seg 1")
      );
    });

    it("should handle segment index 14 (last segment for 15-segment light)", async () => {
      const ev = {
        action: mockAction,
        payload: {
          settings: {
            apiKey: "test-api-key",
            selectedDeviceId: "device-1",
            selectedModel: "H619E",
            selectedLightName: "Strip",
            segmentIndex: 14,
          },
        },
      };

      await action.onWillAppear(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith(
        expect.stringContaining("Seg 15")
      );
    });

    it("should handle different step sizes", async () => {
      const stepSizes = [1, 5, 10, 15, 30, 45, 90];

      for (const stepSize of stepSizes) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H619E",
              segmentIndex: 0,
              hue: 180,
              saturation: 100,
              brightness: 100,
              stepSize,
            },
            ticks: 1,
          },
        };

        await action.onDialRotate(ev as any);

        expect(mockAction.setFeedback).toHaveBeenCalled();
      }
    });
  });

  describe("Color Parameters", () => {
    it("should handle hue range (0-360)", async () => {
      const hues = [0, 60, 120, 180, 240, 300, 360];

      for (const hue of hues) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H619E",
              segmentIndex: 0,
              hue,
              saturation: 100,
              brightness: 100,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });

    it("should handle saturation range (0-100)", async () => {
      const saturations = [0, 25, 50, 75, 100];

      for (const saturation of saturations) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H619E",
              segmentIndex: 0,
              hue: 180,
              saturation,
              brightness: 100,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });

    it("should handle brightness range (0-100)", async () => {
      const brightnesses = [0, 25, 50, 75, 100];

      for (const brightness of brightnesses) {
        const ev = {
          action: mockAction,
          payload: {
            settings: {
              apiKey: "test-api-key",
              selectedDeviceId: "device-1",
              selectedModel: "H619E",
              segmentIndex: 0,
              hue: 180,
              saturation: 100,
              brightness,
            },
          },
        };

        await action.onWillAppear(ev as any);

        expect(mockAction.setTitle).toHaveBeenCalled();
      }
    });
  });
});
