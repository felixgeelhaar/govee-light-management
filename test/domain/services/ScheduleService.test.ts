import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ScheduleService } from "../../../src/backend/domain/services/ScheduleService";
import { ScheduledAction } from "../../../src/backend/domain/entities/ScheduledAction";
import { Schedule } from "../../../src/backend/domain/value-objects/Schedule";

function createAction(id: string, hour = 14, minute = 30): ScheduledAction {
  return ScheduledAction.create({
    id,
    name: `Action ${id}`,
    schedule: Schedule.daily(hour, minute),
    targetId: "device-1",
    targetType: "light",
    command: "on",
  });
}

describe("ScheduleService", () => {
  let service: ScheduleService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T10:00:00Z"));
    service = new ScheduleService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Registration", () => {
    it("should register a scheduled action", () => {
      const action = createAction("a1");
      service.register(action);
      expect(service.getAll()).toHaveLength(1);
    });

    it("should retrieve registered action by id", () => {
      const action = createAction("a1");
      service.register(action);
      expect(service.get("a1")?.id).toBe("a1");
    });

    it("should return undefined for unknown id", () => {
      expect(service.get("unknown")).toBeUndefined();
    });

    it("should reject duplicate IDs", () => {
      service.register(createAction("a1"));
      expect(() => service.register(createAction("a1"))).toThrow(
        "Action with ID 'a1' already exists",
      );
    });
  });

  describe("Removal", () => {
    it("should remove a scheduled action", () => {
      service.register(createAction("a1"));
      const removed = service.remove("a1");
      expect(removed).toBe(true);
      expect(service.getAll()).toHaveLength(0);
    });

    it("should return false for unknown id removal", () => {
      expect(service.remove("unknown")).toBe(false);
    });
  });

  describe("Update", () => {
    it("should update an existing action", () => {
      service.register(createAction("a1", 14, 30));
      const updated = createAction("a1", 16, 0);
      service.update(updated);
      const stored = service.get("a1")!;
      expect(stored.nextTriggerAt()!.getHours()).toBe(16);
    });

    it("should reject update for unknown id", () => {
      expect(() => service.update(createAction("unknown"))).toThrow(
        "Action with ID 'unknown' not found",
      );
    });
  });

  describe("Listing", () => {
    it("should return all actions", () => {
      service.register(createAction("a1"));
      service.register(createAction("a2"));
      service.register(createAction("a3"));
      expect(service.getAll()).toHaveLength(3);
    });

    it("should return enabled actions only", () => {
      service.register(createAction("a1"));
      const disabled = ScheduledAction.create({
        id: "a2",
        name: "disabled",
        schedule: Schedule.daily(12, 0).disable(),
        targetId: "device-1",
        targetType: "light",
        command: "on",
      });
      service.register(disabled);
      expect(service.getEnabled()).toHaveLength(1);
    });

    it("should sort upcoming actions by next trigger time", () => {
      service.register(createAction("later", 16, 0));
      service.register(createAction("earlier", 14, 0));
      service.register(createAction("latest", 20, 0));

      const upcoming = service.getUpcoming();
      expect(upcoming[0].id).toBe("earlier");
      expect(upcoming[1].id).toBe("later");
      expect(upcoming[2].id).toBe("latest");
    });
  });

  describe("Due Actions", () => {
    it("should return no due actions when none are ready", () => {
      service.register(createAction("a1", 14, 0));
      const due = service.getDueActions();
      expect(due).toHaveLength(0);
    });

    it("should return due one-time actions whose trigger time has passed", () => {
      // Create one-time schedule 10 minutes from now
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const oneTime = ScheduledAction.create({
        id: "one-time",
        name: "One time",
        schedule: Schedule.oneTime(futureDate),
        targetId: "device-1",
        targetType: "light",
        command: "on",
      });
      service.register(oneTime);

      // Not yet due
      expect(service.getDueActions()).toHaveLength(0);

      // Advance past trigger
      vi.setSystemTime(new Date(Date.now() + 15 * 60 * 1000));
      const due = service.getDueActions();
      expect(due).toHaveLength(1);
      expect(due[0].id).toBe("one-time");
    });
  });

  describe("Bulk Operations", () => {
    it("should clear all actions", () => {
      service.register(createAction("a1"));
      service.register(createAction("a2"));
      service.clear();
      expect(service.getAll()).toHaveLength(0);
    });

    it("should load actions from JSON", () => {
      const action = createAction("a1");
      service.loadFromJSON([action.toJSON()]);
      expect(service.get("a1")?.name).toBe("Action a1");
    });

    it("should export all actions to JSON", () => {
      service.register(createAction("a1"));
      service.register(createAction("a2"));
      const json = service.exportToJSON();
      expect(json).toHaveLength(2);
    });

    it("should round-trip JSON serialization", () => {
      service.register(createAction("a1", 14, 30));
      const exported = service.exportToJSON();

      const fresh = new ScheduleService();
      fresh.loadFromJSON(exported);

      expect(fresh.get("a1")?.nextTriggerAt()).toEqual(
        service.get("a1")?.nextTriggerAt(),
      );
    });
  });
});
