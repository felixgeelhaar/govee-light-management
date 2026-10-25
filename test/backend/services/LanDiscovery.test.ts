import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanDiscovery } from "../../../src/backend/services/LanDiscovery";
import type { LanStatus } from "../../../src/backend/infrastructure/lan/LanDeviceRegistry";

function fakeRegistry(started = true) {
  const known = new Map<
    string,
    { ip: string; sku: string; lastSeen: number }
  >();
  let status: LanStatus = started
    ? { available: true }
    : { available: false, reason: "port-in-use" };
  return {
    known,
    start: vi.fn(async () => started),
    scan: vi.fn(async () => []),
    stop: vi.fn(),
    requestStatus: vi.fn(async () => null),
    sendCommands: vi.fn(async () => false),
    get: (id: string) => known.get(id.toUpperCase()),
    get status() {
      return status;
    },
    setStatus(next: LanStatus) {
      status = next;
    },
  };
}

describe("LanDiscovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("scans at start and every 10 minutes until shutdown", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.start();
    expect(registry.scan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(registry.scan).toHaveBeenCalledTimes(2);
    await discovery.shutdown();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(registry.scan).toHaveBeenCalledTimes(2);
    expect(registry.stop).toHaveBeenCalled();
  });

  it("does not scan when LAN can't be used", async () => {
    const registry = fakeRegistry(false);
    await new LanDiscovery(registry).start();
    expect(registry.scan).not.toHaveBeenCalled();
  });

  it("reports LAN for a light that answered, with its address", async () => {
    const registry = fakeRegistry();
    registry.known.set("0B:5B", {
      ip: "192.168.1.23",
      sku: "H6056",
      lastSeen: 0,
    });
    const discovery = new LanDiscovery(registry);
    await discovery.start();
    expect(await discovery.connectionFor("0b:5b")).toEqual({
      type: "lan",
      ip: "192.168.1.23",
    });
  });

  it("rescans once a minute at most for a light it doesn't know yet", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.start();
    expect(await discovery.connectionFor("AA")).toEqual({
      type: "cloud",
      reason: "not-found",
    });
    expect(registry.scan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(61_000);
    await discovery.connectionFor("AA");
    expect(registry.scan).toHaveBeenCalledTimes(2);
  });

  it("explains why everything is on the cloud when LAN is unavailable", async () => {
    const registry = fakeRegistry(false);
    const discovery = new LanDiscovery(registry);
    await discovery.start();
    expect(await discovery.connectionFor("AA")).toEqual({
      type: "cloud",
      reason: "port-in-use",
    });
  });
});

describe("LanDiscovery.ready", () => {
  it("settles after the first scan, and at once when never started", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await expect(discovery.ready()).resolves.toBeUndefined();
    let scanned = false;
    registry.scan.mockImplementation(async () => {
      scanned = true;
      return [];
    });
    const starting = discovery.start();
    await discovery.ready();
    expect(scanned).toBe(true);
    await starting;
    await discovery.shutdown();
  });
});
