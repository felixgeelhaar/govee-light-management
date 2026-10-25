import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Schedule,
  ScheduleType,
  DayOfWeek,
} from "../../../src/backend/domain/value-objects/Schedule";

describe("Schedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed time: 2026-04-17 10:00:00 UTC (Friday)
    vi.setSystemTime(new Date("2026-04-17T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("OneTime Schedule", () => {
    it("should create a one-time schedule with a future date", () => {
      const triggerAt = new Date("2026-04-18T12:00:00Z");
      const schedule = Schedule.oneTime(triggerAt);
      expect(schedule.type).toBe(ScheduleType.OneTime);
      expect(schedule.nextTriggerAt()).toEqual(triggerAt);
    });

    it("should reject a one-time schedule with a past date", () => {
      const pastDate = new Date("2026-04-16T12:00:00Z");
      expect(() => Schedule.oneTime(pastDate)).toThrow(
        "One-time schedule must be in the future",
      );
    });

    it("should return null for nextTriggerAt after firing", () => {
      const triggerAt = new Date("2026-04-18T12:00:00Z");
      const schedule = Schedule.oneTime(triggerAt);
      const fired = schedule.markFired();
      expect(fired.nextTriggerAt()).toBeNull();
    });
  });

  describe("Delay Schedule", () => {
    it("should create a delay schedule with seconds", () => {
      const schedule = Schedule.delay(60);
      expect(schedule.type).toBe(ScheduleType.Delay);
      const next = schedule.nextTriggerAt();
      expect(next).not.toBeNull();
      expect(next!.getTime()).toBe(Date.now() + 60_000);
    });

    it("should reject negative delays", () => {
      expect(() => Schedule.delay(-1)).toThrow("Delay must be positive");
    });

    it("should reject zero delays", () => {
      expect(() => Schedule.delay(0)).toThrow("Delay must be positive");
    });

    it("should accept delays up to 24 hours", () => {
      const schedule = Schedule.delay(86_400);
      expect(schedule.nextTriggerAt()).not.toBeNull();
    });

    it("should reject delays over 24 hours", () => {
      expect(() => Schedule.delay(86_401)).toThrow(
        "Delay must be less than 24 hours",
      );
    });
  });

  describe("Daily Schedule", () => {
    it("should create a daily schedule at specific hour/minute", () => {
      const schedule = Schedule.daily(14, 30);
      expect(schedule.type).toBe(ScheduleType.Daily);
    });

    it("should calculate next trigger for today if time is in future", () => {
      // Current time: 10:00, schedule for 14:30 today
      const schedule = Schedule.daily(14, 30, "utc");
      const next = schedule.nextTriggerAt()!;
      expect(next.getUTCHours()).toBe(14);
      expect(next.getUTCMinutes()).toBe(30);
      expect(next.getUTCDate()).toBe(17);
    });

    it("should calculate next trigger for tomorrow if time has passed", () => {
      // Current time: 10:00, schedule for 08:00 - should be tomorrow
      const schedule = Schedule.daily(8, 0, "utc");
      const next = schedule.nextTriggerAt()!;
      expect(next.getUTCHours()).toBe(8);
      expect(next.getUTCDate()).toBe(18);
    });

    it("should reject invalid hours", () => {
      expect(() => Schedule.daily(24, 0)).toThrow("Invalid hour");
      expect(() => Schedule.daily(-1, 0)).toThrow("Invalid hour");
    });

    it("should reject invalid minutes", () => {
      expect(() => Schedule.daily(12, 60)).toThrow("Invalid minute");
      expect(() => Schedule.daily(12, -1)).toThrow("Invalid minute");
    });
  });

  describe("Weekly Schedule", () => {
    it("should create weekly schedule for specific days", () => {
      // Monday, Wednesday, Friday at 09:00
      const days = [DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday];
      const schedule = Schedule.weekly(days, 9, 0);
      expect(schedule.type).toBe(ScheduleType.Weekly);
    });

    it("should reject empty days array", () => {
      expect(() => Schedule.weekly([], 9, 0)).toThrow(
        "Weekly schedule requires at least one day",
      );
    });

    it("should find next matching day", () => {
      // Current: Friday 10:00
      // Schedule: Friday at 14:00 - should be today
      const schedule = Schedule.weekly([DayOfWeek.Friday], 14, 0, "utc");
      const next = schedule.nextTriggerAt()!;
      expect(next.getUTCDate()).toBe(17);
      expect(next.getUTCHours()).toBe(14);
    });

    it("should skip to next week if day has passed", () => {
      // Current: Friday 10:00
      // Schedule: Friday at 08:00 - should be next Friday
      const schedule = Schedule.weekly([DayOfWeek.Friday], 8, 0, "utc");
      const next = schedule.nextTriggerAt()!;
      expect(next.getUTCDate()).toBe(24);
      expect(next.getUTCHours()).toBe(8);
    });

    it("should find next occurrence across days", () => {
      // Current: Friday 10:00
      // Schedule: Monday, Wednesday at 09:00 - should be next Monday
      const schedule = Schedule.weekly(
        [DayOfWeek.Monday, DayOfWeek.Wednesday],
        9,
        0,
        "utc",
      );
      const next = schedule.nextTriggerAt()!;
      expect(next.getUTCDay()).toBe(DayOfWeek.Monday);
      expect(next.getUTCDate()).toBe(20);
    });
  });

  describe("Local clock", () => {
    const zone = process.env.TZ;
    beforeEach(() => {
      // UTC+2 in April; 2026-04-17T10:00Z is 12:00 local (Friday).
      process.env.TZ = "Europe/Berlin";
    });
    afterEach(() => {
      process.env.TZ = zone;
    });

    it("reads daily times in the computer's local time by default", () => {
      const next = Schedule.daily(14, 30).nextTriggerAt()!;
      expect(next.toISOString()).toBe("2026-04-17T12:30:00.000Z");
    });

    it("moves a local time that has passed today to tomorrow", () => {
      const next = Schedule.daily(11, 0).nextTriggerAt()!;
      expect(next.toISOString()).toBe("2026-04-18T09:00:00.000Z");
    });

    it("matches weekdays in local time", () => {
      // 01:00 local Saturday is still Friday 23:00 UTC.
      const next = Schedule.weekly([DayOfWeek.Saturday], 1, 0).nextTriggerAt()!;
      expect(next.toISOString()).toBe("2026-04-17T23:00:00.000Z");
    });

    it("keeps the local time across a daylight-saving change", () => {
      vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
      const next = Schedule.weekly([DayOfWeek.Sunday], 9, 0).nextTriggerAt()!;
      // CEST ends 2026-10-25; 09:00 CET is 08:00 UTC.
      expect(next.toISOString()).toBe("2026-10-25T08:00:00.000Z");
    });

    it("restores schedules persisted without a clock as UTC", () => {
      const json = Schedule.daily(14, 30).toJSON();
      delete json.clock;
      const next = Schedule.fromJSON(json).nextTriggerAt()!;
      expect(next.toISOString()).toBe("2026-04-17T14:30:00.000Z");
    });

    it("round-trips the local clock", () => {
      const original = Schedule.daily(14, 30);
      expect(Schedule.fromJSON(original.toJSON()).nextTriggerAt()).toEqual(
        original.nextTriggerAt(),
      );
    });
  });

  describe("Schedule Status", () => {
    it("should be active by default", () => {
      const schedule = Schedule.daily(12, 0);
      expect(schedule.isActive).toBe(true);
    });

    it("should be inactive after disabling", () => {
      const schedule = Schedule.daily(12, 0);
      const disabled = schedule.disable();
      expect(disabled.isActive).toBe(false);
    });

    it("should return null nextTriggerAt when disabled", () => {
      const schedule = Schedule.daily(12, 0).disable();
      expect(schedule.nextTriggerAt()).toBeNull();
    });

    it("should re-enable a disabled schedule", () => {
      const schedule = Schedule.daily(12, 0).disable().enable();
      expect(schedule.isActive).toBe(true);
      expect(schedule.nextTriggerAt()).not.toBeNull();
    });
  });

  describe("Schedule Serialization", () => {
    it("should serialize one-time schedule", () => {
      const triggerAt = new Date("2026-04-18T12:00:00Z");
      const schedule = Schedule.oneTime(triggerAt);
      const json = schedule.toJSON();
      expect(json.type).toBe(ScheduleType.OneTime);
      expect(json.triggerAt).toBe(triggerAt.toISOString());
    });

    it("should serialize daily schedule", () => {
      const schedule = Schedule.daily(14, 30);
      const json = schedule.toJSON();
      expect(json.type).toBe(ScheduleType.Daily);
      expect(json.hour).toBe(14);
      expect(json.minute).toBe(30);
    });

    it("should deserialize from JSON", () => {
      const original = Schedule.daily(14, 30);
      const restored = Schedule.fromJSON(original.toJSON());
      expect(restored.type).toBe(original.type);
      expect(restored.nextTriggerAt()).toEqual(original.nextTriggerAt());
    });

    it("should deserialize weekly schedule", () => {
      const original = Schedule.weekly([DayOfWeek.Monday], 9, 0);
      const restored = Schedule.fromJSON(original.toJSON());
      expect(restored.type).toBe(ScheduleType.Weekly);
      expect(restored.nextTriggerAt()).toEqual(original.nextTriggerAt());
    });
  });
});
