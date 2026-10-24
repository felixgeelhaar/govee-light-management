import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuspensionDetector } from "../../src/backend/infrastructure/power/SuspensionDetector";

// A suspended process runs no timers, so the wall clock moves on while the
// event loop does not. Fake timers model that with setSystemTime alone.
const suspendFor = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe("SuspensionDetector", () => {
  let detector: SuspensionDetector;
  beforeEach(() => {
    vi.useFakeTimers();
    detector = new SuspensionDetector();
    detector.start();
  });
  afterEach(() => {
    detector.stop();
    vi.useRealTimers();
  });

  it("reports no suspension while the process keeps running", async () => {
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(detector.recentlySuspended()).toBe(false);
  });

  it("detects a suspension when asked before the late tick has run", () => {
    suspendFor(10 * 60_000);
    expect(detector.recentlySuspended()).toBe(true);
  });

  it("still reports a suspension detected by the tick that ran after resume", async () => {
    suspendFor(60_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(detector.recentlySuspended()).toBe(true);
  });

  it("forgets a suspension once the wake window has passed", async () => {
    suspendFor(60_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(detector.recentlySuspended()).toBe(false);
  });

  it("does not mistake a briefly blocked event loop for a suspension", () => {
    suspendFor(8_000);
    expect(detector.recentlySuspended()).toBe(false);
  });

  it("stops sampling when stopped", () => {
    detector.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
