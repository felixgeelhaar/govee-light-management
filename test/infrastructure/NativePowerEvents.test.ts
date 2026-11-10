import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { NativePowerEvents } from "../../src/backend/infrastructure/power/NativePowerEvents";
const child = () =>
  Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    kill: vi.fn(),
  });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("native power event adapter", () => {
  it.each(["darwin", "win32"])(
    "starts the packaged %s hook without credentials or a shell",
    async (platform) => {
      const process = child();
      const spawn = vi.fn().mockReturnValue(process);
      const source = new NativePowerEvents({
        platform: platform as NodeJS.Platform,
        spawn: spawn as never,
      });
      const event = vi.fn();
      const failure = vi.fn();
      const ready = source.start(event, failure);
      process.stdout.write("rea");
      process.stdout.write("dy\nsleep\nwake\nshutdown\n");
      await ready;
      expect(event.mock.calls.map((call) => call[0])).toEqual([
        "sleep",
        "wake",
        "shutdown",
      ]);
      expect(spawn.mock.calls[0][2]).toMatchObject({
        shell: false,
        windowsHide: true,
      });
      source.stop();
      expect(process.stdin.writableEnded).toBe(true);
    },
  );
  it("registers macOS observers with a nil object filter, not NSNull", () => {
    // JXA bridges `null` to an NSNull instance, so an observer registered with
    // object `null` only matches notifications posted by NSNull: never sleep.
    const script = readFileSync(
      "com.felixgeelhaar.govee-light-management.sdPlugin/power-hooks/macos.js",
      "utf8",
    );
    const registrations = script.match(
      /addObserverSelectorNameObject\([^;]*?\);/g,
    );
    expect(registrations).toHaveLength(4);
    for (const call of registrations ?? [])
      expect(call).not.toMatch(/\bnull\b/);
  });
  it("runs the Windows hook on a pumped STA thread so SystemEvents can fire", async () => {
    // .NET Framework SystemEvents shares an STA caller's thread for its hidden
    // window; if that thread blocks on stdin, Suspend/SessionEnding never arrive.
    const process = child();
    const spawn = vi.fn().mockReturnValue(process);
    const source = new NativePowerEvents({
      platform: "win32",
      spawn: spawn as never,
    });
    const ready = source.start(vi.fn(), vi.fn());
    process.stdout.write("ready\n");
    await ready;
    const args: string[] = spawn.mock.calls[0][1];
    expect(args).toContain("-STA");
    const script = args[args.length - 1];
    expect(script).toContain("System.Windows.Forms.Application.Run()");
    expect(script).not.toMatch(
      /^\s*while \(Console\.ReadLine\(\) != null\) \{\}\s*$/m,
    );
    source.stop();
  });
  it("reports helper readiness, accepted events and exit to the diagnostic log", async () => {
    const process = child();
    const log = vi.fn();
    const source = new NativePowerEvents({
      platform: "win32",
      spawn: vi.fn().mockReturnValue(process) as never,
      log,
    });
    const ready = source.start(vi.fn(), vi.fn());
    process.stdout.write("ready\nsleep\nnot-an-event\nwake\n");
    await ready;
    process.emit("exit", 1, null);
    expect(log.mock.calls.map((call) => call[0])).toEqual([
      { category: "helper_ready" },
      { category: "helper_event", event: "sleep" },
      { category: "helper_ignored" },
      { category: "helper_event", event: "wake" },
      { category: "helper_exit", code: 1 },
    ]);
  });
  it("does not accept arbitrary helper messages and bounds oversized output", async () => {
    const process = child();
    const spawn = vi.fn().mockReturnValue(process);
    const source = new NativePowerEvents({
      platform: "darwin",
      spawn: spawn as never,
    });
    const event = vi.fn();
    const failure = vi.fn();
    const ready = source.start(event, failure);
    process.stdout.write("ready\nsecret-looking-message\n");
    await ready;
    expect(event).not.toHaveBeenCalled();
    process.stdout.write("x".repeat(2048));
    expect(failure).toHaveBeenCalledOnce();
    source.stop();
  });
  it("fails on unavailable platforms or a helper startup timeout", async () => {
    await expect(
      new NativePowerEvents({ platform: "linux" }).start(vi.fn(), vi.fn()),
    ).rejects.toBeDefined();
    vi.useFakeTimers();
    const process = child();
    const source = new NativePowerEvents({
      platform: "darwin",
      spawn: vi.fn().mockReturnValue(process) as never,
    });
    const ready = source.start(vi.fn(), vi.fn());
    const rejected = expect(ready).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(30001);
    await rejected;
    source.stop();
  });
  it("handles process errors/exits and force-kills an unresponsive helper", async () => {
    vi.useFakeTimers();
    const process = child();
    const source = new NativePowerEvents({
      platform: "darwin",
      spawn: vi.fn().mockReturnValue(process) as never,
    });
    const fail = vi.fn();
    const ready = source.start(vi.fn(), fail);
    process.stdout.write("ready\n");
    await ready;
    process.emit("exit", 1);
    expect(fail).toHaveBeenCalledOnce();
    const second = child();
    const next = new NativePowerEvents({
      platform: "darwin",
      spawn: vi.fn().mockReturnValue(second) as never,
    });
    const started = next.start(vi.fn(), vi.fn());
    second.stdout.write("ready\n");
    await started;
    next.stop();
    await vi.advanceTimersByTimeAsync(1001);
    expect(second.kill).toHaveBeenCalledWith("SIGKILL");
  });
});
