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
    disable: vi.fn(),
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

describe("LanDiscovery.configure (local network control setting)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts scanning when turned on", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.configure(true);
    expect(registry.start).toHaveBeenCalledTimes(1);
    expect(registry.scan).toHaveBeenCalledTimes(1);
    await discovery.shutdown();
  });

  it("turning it off releases the port, stops scanning and reports the reason", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.configure(true);
    await discovery.configure(false);
    expect(registry.disable).toHaveBeenCalledTimes(1);
    registry.setStatus({ available: false, reason: "disabled" });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(registry.scan).toHaveBeenCalledTimes(1);
    expect(await discovery.connectionFor("AA")).toEqual({
      type: "cloud",
      reason: "disabled",
    });
    expect(registry.scan).toHaveBeenCalledTimes(1);
  });

  it("ignores a repeated value, so unrelated settings changes don't rescan", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.configure(true);
    await discovery.configure(true);
    expect(registry.start).toHaveBeenCalledTimes(1);
    await discovery.shutdown();
  });

  it("can be turned back on after being off", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    await discovery.configure(false);
    expect(registry.start).not.toHaveBeenCalled();
    await discovery.configure(true);
    expect(registry.start).toHaveBeenCalledTimes(1);
    expect(registry.scan).toHaveBeenCalledTimes(1);
    await discovery.shutdown();
  });

  it("makes ready() wait for the saved setting, then for the first scan", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    let load!: (enabled: boolean) => void;
    discovery.useSetting(new Promise<boolean>((resolve) => (load = resolve)));
    let settled = false;
    void discovery.ready().then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    load(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(registry.scan).toHaveBeenCalledTimes(1);
    await discovery.shutdown();
  });

  it("falls back to LAN on when the setting can't be read", async () => {
    const registry = fakeRegistry();
    const discovery = new LanDiscovery(registry);
    discovery.useSetting(Promise.reject(new Error("no settings")));
    await discovery.ready();
    expect(registry.start).toHaveBeenCalledTimes(1);
    await discovery.shutdown();
  });

  it("retries a taken port on the next lookup instead of staying off for good", async () => {
    const registry = fakeRegistry(false);
    const discovery = new LanDiscovery(registry);
    await discovery.start();
    await discovery.connectionFor("AA");
    expect(registry.scan).toHaveBeenCalledTimes(1);
  });
});
