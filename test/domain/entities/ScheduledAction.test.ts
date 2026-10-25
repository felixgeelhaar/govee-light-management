import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ScheduledAction } from "../../../src/backend/domain/entities/ScheduledAction";
import { Schedule } from "../../../src/backend/domain/value-objects/Schedule";

describe("ScheduledAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Creation", () => {
    it("should create a scheduled action with all required fields", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Evening lights",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });

      expect(action.id).toBe("action-1");
      expect(action.name).toBe("Evening lights");
      expect(action.targetId).toBe("device-123");
      expect(action.targetType).toBe("light");
      expect(action.command).toBe("on");
    });

    it("should support optional commandValue", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-2",
        name: "Dim lights",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "brightness",
        commandValue: 50,
      });
      expect(action.commandValue).toBe(50);
    });

    it("should support group targets", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-3",
        name: "Room off",
        schedule,
        targetId: "group-1",
        targetType: "group",
        command: "off",
      });
      expect(action.targetType).toBe("group");
    });

    it("should reject empty names", () => {
      const schedule = Schedule.daily(14, 30);
      expect(() =>
        ScheduledAction.create({
          id: "action-1",
          name: "",
          schedule,
          targetId: "device-123",
          targetType: "light",
          command: "on",
        }),
      ).toThrow("Name cannot be empty");
    });

    it("should reject empty ids", () => {
      const schedule = Schedule.daily(14, 30);
      expect(() =>
        ScheduledAction.create({
          id: "",
          name: "Test",
          schedule,
          targetId: "device-123",
          targetType: "light",
          command: "on",
        }),
      ).toThrow("ID cannot be empty");
    });
  });

  describe("Status", () => {
    it("should be enabled by default", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Test",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });
      expect(action.isEnabled()).toBe(true);
    });

    it("should report disabled when schedule is inactive", () => {
      const schedule = Schedule.daily(14, 30).disable();
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Test",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });
      expect(action.isEnabled()).toBe(false);
    });
  });

  describe("Next Trigger", () => {
    it("should return next trigger time from schedule", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Test",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });
      const next = action.nextTriggerAt();
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(14);
      expect(next!.getUTCMinutes()).toBe(30);
    });

    it("should return null when disabled", () => {
      const schedule = Schedule.daily(14, 30).disable();
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Test",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });
      expect(action.nextTriggerAt()).toBeNull();
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      const schedule = Schedule.daily(14, 30);
      const action = ScheduledAction.create({
        id: "action-1",
        name: "Evening lights",
        schedule,
        targetId: "device-123",
        targetType: "light",
        command: "brightness",
        commandValue: 75,
      });
      const json = action.toJSON();
      expect(json.id).toBe("action-1");
      expect(json.name).toBe("Evening lights");
      expect(json.targetId).toBe("device-123");
      expect(json.schedule.type).toBe("daily");
      expect(json.commandValue).toBe(75);
    });

    it("should deserialize from JSON", () => {
      const original = ScheduledAction.create({
        id: "action-1",
        name: "Test",
        schedule: Schedule.daily(14, 30),
        targetId: "device-123",
        targetType: "light",
        command: "on",
      });
      const restored = ScheduledAction.fromJSON(original.toJSON());
      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.nextTriggerAt()).toEqual(original.nextTriggerAt());
    });
  });
});
