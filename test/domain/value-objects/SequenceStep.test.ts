import { describe, it, expect } from "vitest";
import {
  SequenceStep,
  StepType,
} from "../../../src/backend/domain/value-objects/SequenceStep";

describe("SequenceStep", () => {
  describe("Action Step", () => {
    it("should create a basic action step", () => {
      const step = SequenceStep.action({
        targetId: "device-1",
        targetType: "light",
        command: "on",
      });
      expect(step.type).toBe(StepType.Action);
      expect(step.targetId).toBe("device-1");
      expect(step.command).toBe("on");
    });

    it("should support action with value", () => {
      const step = SequenceStep.action({
        targetId: "device-1",
        targetType: "light",
        command: "brightness",
        commandValue: 75,
      });
      expect(step.commandValue).toBe(75);
    });

    it("should support group targets", () => {
      const step = SequenceStep.action({
        targetId: "group-1",
        targetType: "group",
        command: "off",
      });
      expect(step.targetType).toBe("group");
    });

    it("should reject empty targetId", () => {
      expect(() =>
        SequenceStep.action({
          targetId: "",
          targetType: "light",
          command: "on",
        }),
      ).toThrow("Target ID cannot be empty");
    });
  });

  describe("Delay Step", () => {
    it("should create a delay step", () => {
      const step = SequenceStep.delay(2000);
      expect(step.type).toBe(StepType.Delay);
      expect(step.durationMs).toBe(2000);
    });

    it("should reject negative delays", () => {
      expect(() => SequenceStep.delay(-1)).toThrow(
        "Delay duration must be positive",
      );
    });

    it("should reject zero delays", () => {
      expect(() => SequenceStep.delay(0)).toThrow(
        "Delay duration must be positive",
      );
    });

    it("should accept max delay of 5 minutes", () => {
      const step = SequenceStep.delay(300_000);
      expect(step.durationMs).toBe(300_000);
    });

    it("should reject delays over 5 minutes", () => {
      expect(() => SequenceStep.delay(300_001)).toThrow(
        "Delay duration must be 5 minutes or less",
      );
    });
  });

  describe("Serialization", () => {
    it("should serialize action step", () => {
      const step = SequenceStep.action({
        targetId: "device-1",
        targetType: "light",
        command: "brightness",
        commandValue: 50,
      });
      const json = step.toJSON();
      expect(json.type).toBe("action");
      expect(json.targetId).toBe("device-1");
      expect(json.commandValue).toBe(50);
    });

    it("should serialize delay step", () => {
      const step = SequenceStep.delay(2000);
      const json = step.toJSON();
      expect(json.type).toBe("delay");
      expect(json.durationMs).toBe(2000);
    });

    it("should round-trip action step", () => {
      const original = SequenceStep.action({
        targetId: "device-1",
        targetType: "light",
        command: "color",
        commandValue: "#FF0000",
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.type).toBe(original.type);
      expect(restored.targetId).toBe(original.targetId);
      expect(restored.commandValue).toBe(original.commandValue);
    });

    it("should round-trip delay step", () => {
      const original = SequenceStep.delay(3000);
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.type).toBe(original.type);
      expect(restored.durationMs).toBe(original.durationMs);
    });
  });

  describe("Scene Step (#199 groundwork)", () => {
    it("creates a dynamic scene step with its payload", () => {
      const step = SequenceStep.scene("light:dev|H6159", "light", {
        kind: "dynamic",
        id: 3853,
        paramId: 4280,
        name: "Sunrise",
      });
      expect(step.type).toBe(StepType.Action);
      expect(step.command).toBe("scene");
      expect(step.scenePayload?.kind).toBe("dynamic");
      expect(step.scenePayload?.id).toBe(3853);
      expect(step.scenePayload?.name).toBe("Sunrise");
    });

    it("creates a DIY scene step distinctly from dynamic", () => {
      const step = SequenceStep.scene("light:dev|H6159", "light", {
        kind: "diy",
        id: 7001,
        paramId: 7001,
        name: "My Custom Glow",
      });
      expect(step.scenePayload?.kind).toBe("diy");
    });

    it("rejects unknown scene kind", () => {
      expect(() =>
        SequenceStep.scene("light:dev|H6159", "light", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          kind: "bogus" as any,
          id: 1,
          paramId: 1,
          name: "x",
        }),
      ).toThrow(/Invalid scene kind/);
    });

    it("rejects non-positive scene id", () => {
      expect(() =>
        SequenceStep.scene("light:dev|H6159", "light", {
          kind: "dynamic",
          id: 0,
          paramId: 1,
          name: "x",
        }),
      ).toThrow(/Invalid scene id/);
    });

    it("direct action(command:'scene') without payload throws", () => {
      expect(() =>
        SequenceStep.action({
          targetId: "light:dev|H6159",
          targetType: "light",
          command: "scene",
        }),
      ).toThrow(/Scene step requires scenePayload/);
    });

    it("round-trips scene step via JSON preserving payload", () => {
      const original = SequenceStep.scene("group:g1", "group", {
        kind: "diy",
        id: 12345,
        paramId: 67890,
        name: "Sparkles",
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.command).toBe("scene");
      expect(restored.targetType).toBe("group");
      expect(restored.scenePayload).toEqual({
        kind: "diy",
        id: 12345,
        paramId: 67890,
        name: "Sparkles",
      });
    });
  });

  describe("Snapshot Step (#199 groundwork)", () => {
    it("creates a snapshot step with its payload", () => {
      const step = SequenceStep.snapshot("light:dev|H60B0", "light", {
        id: 501,
        paramId: 502,
        name: "Reading",
      });
      expect(step.type).toBe(StepType.Action);
      expect(step.command).toBe("snapshot");
      expect(step.snapshotPayload?.id).toBe(501);
      expect(step.snapshotPayload?.name).toBe("Reading");
    });

    it("rejects non-positive snapshot id", () => {
      expect(() =>
        SequenceStep.snapshot("light:dev|H60B0", "light", {
          id: 0,
          paramId: 1,
          name: "x",
        }),
      ).toThrow(/Invalid snapshot id/);
    });

    it("direct action(command:'snapshot') without payload throws", () => {
      expect(() =>
        SequenceStep.action({
          targetId: "light:dev|H60B0",
          targetType: "light",
          command: "snapshot",
        }),
      ).toThrow(/Snapshot step requires snapshotPayload/);
    });

    it("round-trips snapshot step via JSON preserving payload", () => {
      const original = SequenceStep.snapshot("light:dev|H60B0", "light", {
        id: 501,
        paramId: 502,
        name: "Movie Night",
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.command).toBe("snapshot");
      expect(restored.snapshotPayload).toEqual({
        id: 501,
        paramId: 502,
        name: "Movie Night",
      });
    });
  });

  describe("Music Mode Step (#199)", () => {
    it("creates a music-mode step with payload", () => {
      const step = SequenceStep.musicMode("light:dev|H6159", "light", {
        modeId: 3,
        name: "Rhythm",
        sensitivity: 70,
      });
      expect(step.type).toBe(StepType.Action);
      expect(step.command).toBe("music-mode");
      expect(step.musicModePayload?.modeId).toBe(3);
      expect(step.musicModePayload?.sensitivity).toBe(70);
    });

    it("rejects non-positive mode id", () => {
      expect(() =>
        SequenceStep.musicMode("light:dev|H6159", "light", {
          modeId: 0,
          name: "x",
          sensitivity: 50,
        }),
      ).toThrow(/Invalid music mode id/);
    });

    it("rejects out-of-range sensitivity", () => {
      expect(() =>
        SequenceStep.musicMode("light:dev|H6159", "light", {
          modeId: 3,
          name: "Rhythm",
          sensitivity: 150,
        }),
      ).toThrow(/sensitivity must be 0-100/);
    });

    it("direct action(command:'music-mode') without payload throws", () => {
      expect(() =>
        SequenceStep.action({
          targetId: "light:dev|H6159",
          targetType: "light",
          command: "music-mode",
        }),
      ).toThrow(/Music mode step requires musicModePayload/);
    });

    it("round-trips music-mode step via JSON preserving payload", () => {
      const original = SequenceStep.musicMode("group:g1", "group", {
        modeId: 5,
        name: "Energic",
        sensitivity: 80,
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.command).toBe("music-mode");
      expect(restored.musicModePayload).toEqual({
        modeId: 5,
        name: "Energic",
        sensitivity: 80,
      });
    });
  });

  describe("Feature Toggle Step (#199)", () => {
    it("creates a feature-toggle step with payload", () => {
      const step = SequenceStep.featureToggle("light:dev|H6159", "light", {
        instance: "gradientToggle",
        name: "Gradient",
        enabled: true,
      });
      expect(step.command).toBe("feature-toggle");
      expect(step.togglePayload?.instance).toBe("gradientToggle");
      expect(step.togglePayload?.enabled).toBe(true);
    });

    it("rejects empty instance", () => {
      expect(() =>
        SequenceStep.featureToggle("light:dev|H6159", "light", {
          instance: "",
          name: "x",
          enabled: false,
        }),
      ).toThrow(/instance cannot be empty/);
    });

    it("round-trips feature-toggle step via JSON", () => {
      const original = SequenceStep.featureToggle("light:dev|H6159", "light", {
        instance: "nightlightToggle",
        name: "Nightlight",
        enabled: false,
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.togglePayload).toEqual({
        instance: "nightlightToggle",
        name: "Nightlight",
        enabled: false,
      });
    });
  });

  describe("Segment Color Step (#199)", () => {
    it("creates a segment-color step with per-segment hex overrides", () => {
      const step = SequenceStep.segmentColor("light:dev|H6159", "light", {
        segments: [
          { index: 0, hex: "#FF0000" },
          { index: 1, hex: "#00FF00" },
        ],
      });
      expect(step.command).toBe("segment-color");
      expect(step.segmentColorPayload?.segments).toHaveLength(2);
    });

    it("rejects empty segment list", () => {
      expect(() =>
        SequenceStep.segmentColor("light:dev|H6159", "light", {
          segments: [],
        }),
      ).toThrow(/at least one segment/);
    });

    it("rejects out-of-range segment index", () => {
      expect(() =>
        SequenceStep.segmentColor("light:dev|H6159", "light", {
          segments: [{ index: 15, hex: "#FF0000" }],
        }),
      ).toThrow(/Segment index must be an integer 0-14/);
    });

    it("rejects invalid hex color", () => {
      expect(() =>
        SequenceStep.segmentColor("light:dev|H6159", "light", {
          segments: [{ index: 0, hex: "red" }],
        }),
      ).toThrow(/Segment hex color invalid/);
    });

    it("round-trips segment-color step via JSON", () => {
      const original = SequenceStep.segmentColor("light:dev|H6159", "light", {
        segments: [
          { index: 0, hex: "#FF0000" },
          { index: 14, hex: "#0000FF" },
        ],
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.segmentColorPayload?.segments).toEqual([
        { index: 0, hex: "#FF0000" },
        { index: 14, hex: "#0000FF" },
      ]);
    });
  });

  describe("Effect Step (#199)", () => {
    it("creates an effect step with preset id", () => {
      const step = SequenceStep.effect("light:dev|H6159", "light", {
        presetId: "rainbow-wave",
        name: "Rainbow Wave",
      });
      expect(step.command).toBe("effect");
      expect(step.effectPayload?.presetId).toBe("rainbow-wave");
    });

    it("rejects empty preset id", () => {
      expect(() =>
        SequenceStep.effect("light:dev|H6159", "light", {
          presetId: "",
          name: "x",
        }),
      ).toThrow(/preset id/);
    });

    it("round-trips effect step via JSON", () => {
      const original = SequenceStep.effect("light:dev|H6159", "light", {
        presetId: "pulse",
        name: "Pulse",
      });
      const restored = SequenceStep.fromJSON(original.toJSON());
      expect(restored.effectPayload).toEqual({
        presetId: "pulse",
        name: "Pulse",
      });
    });
  });

  describe("Backwards-compat: legacy JSON (no new fields) still deserializes", () => {
    it("action step without scenePayload/snapshotPayload fields loads cleanly", () => {
      // Persisted settings from pre-#199 versions never had these fields.
      // fromJSON must not require them for non-scene/non-snapshot commands.
      const legacy = {
        type: StepType.Action,
        targetId: "light:dev|H6159",
        targetType: "light" as const,
        command: "brightness" as const,
        commandValue: 50,
      };
      const step = SequenceStep.fromJSON(legacy);
      expect(step.command).toBe("brightness");
      expect(step.commandValue).toBe(50);
      expect(step.scenePayload).toBeUndefined();
      expect(step.snapshotPayload).toBeUndefined();
    });
  });
});
