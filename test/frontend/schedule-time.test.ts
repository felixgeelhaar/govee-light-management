import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

type ScheduleTime = {
  timeText: (hour?: number, minute?: number) => string;
  localTimeFields: (
    text: string,
  ) => { hour: number; minute: number; clock: string } | null;
  toLocalSchedule: (
    settings: Record<string, unknown>,
    now?: Date,
  ) => Record<string, unknown> | null;
};

const script = readFileSync(
  "com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/schedule-time.js",
  "utf8",
);

describe("schedule time helpers", () => {
  let helpers: ScheduleTime;
  const zone = process.env.TZ;
  beforeAll(() => {
    window.eval(script);
    helpers = (window as unknown as { GoveeScheduleTime: ScheduleTime })
      .GoveeScheduleTime;
  });
  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
  });
  afterEach(() => {
    process.env.TZ = zone;
  });
  const april = new Date("2026-04-17T10:00:00Z");

  it("formats and parses picker values", () => {
    expect(helpers.timeText(7, 5)).toBe("07:05");
    expect(helpers.timeText(undefined, 5)).toBe("");
    expect(helpers.localTimeFields("18:30")).toEqual({
      hour: 18,
      minute: 30,
      clock: "local",
    });
    expect(helpers.localTimeFields("")).toBeNull();
    expect(helpers.localTimeFields("25:00")).toBeNull();
  });

  it("converts a legacy UTC time to local once", () => {
    expect(helpers.toLocalSchedule({ hour: 14, minute: 30 }, april)).toEqual({
      hour: 16,
      minute: 30,
      clock: "local",
    });
    expect(
      helpers.toLocalSchedule({ hour: 16, minute: 30, clock: "local" }, april),
    ).toBeNull();
    expect(
      helpers.toLocalSchedule({ scheduleType: "delay" }, april),
    ).toBeNull();
  });

  it("moves weekdays when the UTC time is on the next local day", () => {
    // Friday 23:00 UTC is Saturday 01:00 in Berlin.
    expect(
      helpers.toLocalSchedule({ hour: 23, minute: 0, days: [5, 0] }, april),
    ).toEqual({ hour: 1, minute: 0, clock: "local", days: [1, 6] });
  });
});
