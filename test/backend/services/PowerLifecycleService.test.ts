import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PowerLifecycleService } from "../../../src/backend/services/PowerLifecycleService";
import { normalizePowerRules } from "../../../src/shared/power-lifecycle";
import { Light } from "../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../src/backend/domain/entities/LightGroup";

const light = Light.create("dev-1", "H619A", "Desk", {
  isOn: false,
  isOnline: false,
});
const target = { type: "light" as const, light };
const rule = (patch = {}) => ({
  selectedDeviceId: "dev-1|H619A",
  enabled: true,
  onPluginStart: true,
  onWake: true,
  offBeforeSleep: true,
  offBeforeShutdown: true,
  ...patch,
});
const setup = () => {
  const deps = {
    getApiKey: vi.fn().mockResolvedValue("test-api-key"),
    resolveTarget: vi.fn().mockResolvedValue(target),
    setPower: vi.fn().mockResolvedValue({ total: 1, failed: [] }),
    log: vi.fn(),
    events: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
  };
  const service = new PowerLifecycleService(deps);
  return { service, deps };
};

describe("PowerLifecycleService", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("defaults to no automation or helper", async () => {
    const { service, deps } = setup();
    service.configure(undefined);
    await service.handle("startup");
    await service.handle("wake");
    expect(deps.setPower).not.toHaveBeenCalled();
    expect(deps.events.start).not.toHaveBeenCalled();
  });
  it.each(["startup", "wake", "sleep", "shutdown"] as const)(
    "dispatches explicit power for %s regardless of cloud offline flag",
    async (event) => {
      const { service, deps } = setup();
      service.configure([rule()]);
      await service.handle(event);
      expect(deps.setPower).toHaveBeenCalledWith(
        target,
        event === "startup" || event === "wake",
        expect.any(AbortSignal),
        "test-api-key",
      );
    },
  );
  it("records event receipt before credentials resolve and command dispatch before transport", async () => {
    const { service, deps } = setup();
    let releaseKey!: (key: string) => void;
    deps.getApiKey.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseKey = resolve;
        }),
    );
    service.configure([rule()]);
    const sleep = service.handle("sleep");
    expect(deps.log).toHaveBeenCalledWith({
      event: "sleep",
      category: "event_received",
    });
    expect(
      deps.log.mock.calls.some(
        ([record]) => record.category === "command_started",
      ),
    ).toBe(false);
    releaseKey("test-api-key");
    await sleep;
    const categories = deps.log.mock.calls.map(([record]) => record.category);
    expect(categories).toEqual(["event_received", "command_started", "ok"]);
    expect(deps.log).toHaveBeenCalledWith({
      event: "sleep",
      target: "light:dev-1|H619A",
      category: "command_started",
    });
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain("test-api-key");
    service.shutdown();
  });

  it("only enables the native hook for enabled off-event rules", () => {
    const { service, deps } = setup();
    service.configure([
      rule({ offBeforeSleep: false, offBeforeShutdown: false }),
    ]);
    expect(deps.events.start).not.toHaveBeenCalled();
    service.configure([rule()]);
    expect(deps.events.start).toHaveBeenCalledOnce();
    service.configure([]);
    expect(deps.events.stop).toHaveBeenCalled();
  });
  it("deduplicates equivalent targets and repeated startup/wake events", async () => {
    const { service, deps } = setup();
    service.configure([
      rule(),
      rule({ selectedDeviceId: "light:dev-1|H619A" }),
    ]);
    await service.handle("startup");
    await service.handle("wake");
    await service.handle("wake");
    expect(deps.setPower).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5001);
    await service.handle("wake");
    expect(deps.setPower).toHaveBeenCalledTimes(2);
  });
  it("does not confuse opposite power transitions with duplicates", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    await service.handle("wake");
    await service.handle("sleep");
    await service.handle("wake");
    expect(deps.setPower.mock.calls.map((call) => call[1])).toEqual([
      true,
      false,
      true,
    ]);
  });
  it("skips missing API keys and unavailable targets", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    deps.getApiKey.mockResolvedValue(undefined);
    await service.handle("wake");
    expect(deps.resolveTarget).not.toHaveBeenCalled();
    deps.getApiKey.mockResolvedValue("test-api-key");
    deps.resolveTarget.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(5001);
    await service.handle("wake");
    expect(deps.setPower).not.toHaveBeenCalled();
    expect(deps.log.mock.calls.map((call) => call[0].category)).toEqual(
      expect.arrayContaining(["missing_key", "missing_target"]),
    );
  });
  it("retries transient wake failure once and then succeeds", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    deps.setPower.mockRejectedValueOnce({ category: "network" });
    const task = service.handle("wake");
    await vi.advanceTimersByTimeAsync(3001);
    await task;
    expect(deps.setPower).toHaveBeenCalledTimes(2);
  });
  it("prepares sleep targets without commands and reuses them when discovery is unavailable", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    await service.prepareTargets();
    expect(deps.setPower).not.toHaveBeenCalled();
    deps.resolveTarget.mockRejectedValue(new Error("cloud-unavailable"));
    await service.handle("sleep");
    expect(deps.setPower).toHaveBeenCalledOnce();
  });

  it("pauses an automatic retry as soon as a matching key/dial is used", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    deps.setPower.mockRejectedValueOnce({ category: "network" });
    const task = service.handle("wake");
    await vi.advanceTimersByTimeAsync(1);
    service.manualOverrideSelection("dev-1|H619A");
    await vi.advanceTimersByTimeAsync(5000);
    await task;
    expect(deps.setPower).toHaveBeenCalledOnce();
  });

  it("a manual command cancels retry until the next event", async () => {
    const { service, deps } = setup();
    service.configure([rule()]);
    deps.setPower.mockRejectedValueOnce({ category: "network" });
    const task = service.handle("wake");
    await vi.advanceTimersByTimeAsync(1);
    service.manualOverride(target);
    await vi.advanceTimersByTimeAsync(5000);
    await task;
    expect(deps.setPower).toHaveBeenCalledOnce();
    await service.handle("wake");
    expect(deps.setPower).toHaveBeenCalledTimes(2);
  });
  it("manual control of a group member cancels the group's pending work", async () => {
    const { service, deps } = setup();
    const group = LightGroup.create("g1", "Desk", [light]);
    deps.resolveTarget.mockResolvedValue({ type: "group", group });
    service.configure([rule({ selectedDeviceId: "group:g1" })]);
    deps.setPower.mockRejectedValueOnce({ category: "network" });
    const task = service.handle("wake");
    await vi.advanceTimersByTimeAsync(1);
    service.manualOverride(target);
    await vi.advanceTimersByTimeAsync(5000);
    await task;
    expect(deps.setPower).toHaveBeenCalledOnce();
  });
  it("aborts pending work on settings change/unload and never dispatches after late resolution", async () => {
    const { service, deps } = setup();
    let resolve!: (value: typeof target) => void;
    deps.resolveTarget.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    service.configure([rule()]);
    const task = service.handle("wake");
    await vi.advanceTimersByTimeAsync(1);
    service.configure([]);
    resolve(target);
    await task;
    expect(deps.setPower).not.toHaveBeenCalled();
    service.shutdown();
    expect(deps.events.stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("discards a sleep command if wall-clock time advanced while resolution was suspended", async () => {
    const { service, deps } = setup();
    let resolve!: (value: typeof target) => void;
    deps.resolveTarget.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    service.configure([rule()]);
    const task = service.handle("sleep");
    await vi.advanceTimersByTimeAsync(1);
    vi.setSystemTime(Date.now() + 10_000);
    resolve(target);
    await task;
    expect(deps.setPower).not.toHaveBeenCalled();
  });

  it("bounds a sleep request and aborts the actual transport signal", async () => {
    const { service, deps } = setup();
    let signal!: AbortSignal;
    deps.setPower.mockImplementation((_target, _power, passed) => {
      signal = passed;
      return new Promise(() => {});
    });
    service.configure([rule()]);
    const task = service.handle("sleep");
    await vi.advanceTimersByTimeAsync(1501);
    await task;
    expect(signal.aborted).toBe(true);
    expect(deps.setPower).toHaveBeenCalledOnce();
  });
  it("wake cancels the previous sleep request", async () => {
    const { service, deps } = setup();
    let offSignal!: AbortSignal;
    deps.setPower.mockImplementation((_target, power, signal) =>
      power
        ? Promise.resolve({ total: 1, failed: [] })
        : ((offSignal = signal), new Promise(() => {})),
    );
    service.configure([rule()]);
    const sleep = service.handle("sleep");
    await vi.advanceTimersByTimeAsync(1);
    await service.handle("wake");
    await sleep;
    expect(offSignal.aborted).toBe(true);
  });
  it("does not retry auth, validation, rate limits, sleep errors or partial success", async () => {
    for (const [event, result] of [
      ["wake", "auth"],
      ["wake", "validation"],
      ["wake", "rate_limit"],
      ["sleep", "network"],
      ["wake", "partial"],
    ] as const) {
      const { service, deps } = setup();
      service.configure([rule()]);
      if (result === "partial")
        deps.setPower.mockResolvedValue({
          total: 2,
          failed: [{ light, error: new Error("private-api-key") }],
        });
      else
        deps.setPower.mockRejectedValue({
          category: result,
          config: { apiKey: "private-api-key" },
        });
      await service.handle(event);
      expect(deps.setPower).toHaveBeenCalledOnce();
      expect(JSON.stringify(deps.log.mock.calls)).not.toContain(
        "private-api-key",
      );
      service.shutdown();
    }
  });
  it("reports helper failure without breaking SDK wake commands", async () => {
    const { service, deps } = setup();
    deps.events.start.mockRejectedValue(new Error("private-helper-error"));
    service.configure([rule()]);
    await vi.advanceTimersByTimeAsync(1);
    await service.handle("wake");
    expect(service.helperStatus).toBe("unavailable");
    expect(deps.setPower).toHaveBeenCalledOnce();
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain(
      "private-helper-error",
    );
  });
});

describe("power lifecycle rule validation", () => {
  it("canonicalizes target IDs, keeps explicit opt-ins and drops unrelated settings", () => {
    expect(normalizePowerRules([rule({ apiKey: "secret" })])).toEqual([
      {
        selectedDeviceId: "light:dev-1|H619A",
        enabled: true,
        onPluginStart: true,
        onWake: true,
        offBeforeSleep: true,
        offBeforeShutdown: true,
      },
    ]);
  });
  it("rejects malformed targets and does not coerce truthy values into consent", () => {
    expect(
      normalizePowerRules([
        rule({ selectedDeviceId: "bad" }),
        rule({ enabled: "false", offBeforeSleep: "true" }),
      ]),
    ).toEqual([
      expect.objectContaining({ enabled: false, offBeforeSleep: false }),
    ]);
  });
});
