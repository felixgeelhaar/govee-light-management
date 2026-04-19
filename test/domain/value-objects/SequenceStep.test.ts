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
