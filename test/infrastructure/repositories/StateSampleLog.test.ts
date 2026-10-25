import { describe, expect, it, vi } from "vitest";
import { StateSampleLog } from "../../../src/backend/infrastructure/repositories/StateSampleLog";

const desk = { deviceId: "dev-1", model: "H6056", name: "Desk" };
const backlight = { deviceId: "dev-2", model: "H61B5", name: "Backlight" };

describe("StateSampleLog", () => {
  const setup = () => {
    let time = 0;
    const emit = vi.fn();
    const log = new StateSampleLog(600_000, () => time, emit);
    return { log, emit, advance: (ms: number) => (time += ms) };
  };

  it("logs nothing until the window has passed", () => {
    const { log, emit, advance } = setup();
    log.record(desk);
    advance(599_999);
    log.record(desk);
    expect(emit).not.toHaveBeenCalled();
  });

  it("summarises queries per light once per window, then starts a new count", () => {
    const { log, emit, advance } = setup();
    log.record(desk);
    log.record(desk);
    log.record(backlight);
    advance(600_000);
    log.record(desk);
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith({
      windowMinutes: 10,
      total: 3,
      lights: [
        { light: "dev-1|H6056", name: "Desk", count: 2 },
        { light: "dev-2|H61B5", name: "Backlight", count: 1 },
      ],
    });
    advance(600_000);
    log.record(backlight);
    expect(emit).toHaveBeenLastCalledWith({
      windowMinutes: 10,
      total: 1,
      lights: [{ light: "dev-1|H6056", name: "Desk", count: 1 }],
    });
  });

  it("reports the real window length after an idle gap", () => {
    const { log, emit, advance } = setup();
    log.record(desk);
    advance(45 * 60_000);
    log.record(desk);
    expect(emit.mock.calls[0][0]).toMatchObject({
      windowMinutes: 45,
      total: 1,
    });
  });
});
