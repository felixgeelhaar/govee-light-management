import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/backend/actions/shared/ActionServices", async (load) => {
  const actual =
    await load<
      typeof import("../../../src/backend/actions/shared/ActionServices")
    >();
  return { ...actual, sendToPI: vi.fn().mockResolvedValue(undefined) };
});

import {
  ActionServices,
  sendToPI,
} from "../../../src/backend/actions/shared/ActionServices";
import { ScheduleAction } from "../../../src/backend/actions/ScheduleAction";
import { SequenceAction } from "../../../src/backend/actions/SequenceAction";
import { CustomEffectAction } from "../../../src/backend/actions/CustomEffectAction";
import { schedulerService } from "../../../src/backend/services/SchedulerService";
import { ScheduledAction } from "../../../src/backend/domain/entities/ScheduledAction";
import {
  DayOfWeek,
  Schedule,
} from "../../../src/backend/domain/value-objects/Schedule";

const scheduled = (id: string, name: string, schedule: Schedule) =>
  ScheduledAction.create({
    id,
    name,
    schedule,
    targetId: "light:dev-1|H6056",
    targetType: "light",
    command: "on",
  });

const send =
  (
    Action:
      typeof ScheduleAction | typeof SequenceAction | typeof CustomEffectAction,
  ) =>
  (payload: Record<string, unknown>, settings: Record<string, unknown> = {}) =>
    new Action().onSendToPlugin({
      action: { id: "ctx-1", getSettings: async () => settings },
      payload,
    } as never);

/**
 * Stream Deck sends no event when a key is deleted, so a deleted Schedule
 * key's schedule kept running with nothing to show or stop it (hardware
 * run 2026-10-25). The inspector lists every saved schedule instead.
 */
describe("Schedule inspector: manage schedules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T10:00:00Z"));
    const service = schedulerService.getService();
    service.clear();
    service.register(scheduled("own", "Evening", Schedule.daily(18, 30)));
    service.register(
      scheduled(
        "orphan",
        "Wake up",
        Schedule.weekly([DayOfWeek.Monday], 7, 0).disable(),
      ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(sendToPI).mockClear();
    vi.restoreAllMocks();
  });

  const lastList = () =>
    vi.mocked(sendToPI).mock.calls.at(-1)?.[1] as {
      event: string;
      schedules: Record<string, unknown>[];
    };

  it("lists every saved schedule and marks the one this key owns", async () => {
    await send(ScheduleAction)(
      { event: "getSchedules" },
      { scheduleId: "own" },
    );
    const list = lastList();
    expect(list.event).toBe("schedulesReceived");
    expect(list.schedules).toEqual([
      expect.objectContaining({
        id: "own",
        name: "Evening",
        own: true,
        enabled: true,
        type: "daily",
        hour: 18,
        minute: 30,
        clock: "local",
        targetId: "light:dev-1|H6056",
        command: "on",
        nextAt: expect.any(String),
      }),
      expect.objectContaining({
        id: "orphan",
        own: false,
        enabled: false,
        type: "weekly",
        days: [DayOfWeek.Monday],
        nextAt: null,
      }),
    ]);
  });

  it("deletes another key's schedule and sends the updated list", async () => {
    await send(ScheduleAction)(
      { event: "deleteSchedule", scheduleId: "orphan" },
      { scheduleId: "own" },
    );
    expect(schedulerService.getService().get("orphan")).toBeUndefined();
    expect(lastList().schedules.map((s) => s.id)).toEqual(["own"]);
  });

  it("keeps this key's own schedule: the key would only add it back", async () => {
    await send(ScheduleAction)(
      { event: "deleteSchedule", scheduleId: "own" },
      { scheduleId: "own" },
    );
    expect(schedulerService.getService().get("own")).toBeDefined();
  });
});

describe("group manager events", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["ScheduleAction", ScheduleAction],
    ["SequenceAction", SequenceAction],
    ["CustomEffectAction", CustomEffectAction],
  ] as const)("%s saves and deletes groups", async (_name, Action) => {
    const save = vi
      .spyOn(ActionServices.prototype, "handleSaveGroup")
      .mockResolvedValue(undefined);
    const remove = vi
      .spyOn(ActionServices.prototype, "handleDeleteGroup")
      .mockResolvedValue(undefined);
    await send(Action)({ event: "saveGroup", name: "Desk pair" });
    await send(Action)({ event: "deleteGroup", groupId: "g1" });
    expect(save).toHaveBeenCalledWith(
      "ctx-1",
      expect.objectContaining({ event: "saveGroup" }),
    );
    expect(remove).toHaveBeenCalledWith(
      "ctx-1",
      expect.objectContaining({ event: "deleteGroup" }),
    );
  });
});

describe("group manager coverage", () => {
  it("every action answers the group manager's events", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "src/backend/actions";
    for (const file of readdirSync(dir).filter((f) =>
      f.endsWith("Action.ts"),
    )) {
      const source = readFileSync(`${dir}/${file}`, "utf8");
      // BaseDialAction routes getGroups/saveGroup/deleteGroup itself.
      if (source.includes("extends BaseDialAction")) continue;
      for (const event of ["getGroups", "saveGroup", "deleteGroup"])
        expect(source, `${file} ${event}`).toContain(`"${event}"`);
    }
  });
});
