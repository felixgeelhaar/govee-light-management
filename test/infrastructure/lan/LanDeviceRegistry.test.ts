import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAN_CONTROL_PORT,
  LAN_MULTICAST_ADDRESS,
  LAN_SCAN_PORT,
  parseLanMessage,
} from "../../../src/backend/infrastructure/lan/LanProtocol";
import { LanDeviceRegistry } from "../../../src/backend/infrastructure/lan/LanDeviceRegistry";
import type { LanSocketPort } from "../../../src/backend/infrastructure/lan/LanSocket";

class FakeSocket implements LanSocketPort {
  sent: { message: string; host: string; port: number }[] = [];
  private handler?: (message: string, from: string) => void;
  openError?: NodeJS.ErrnoException;
  sendError?: NodeJS.ErrnoException;
  closed = false;
  opens = 0;
  async open(onMessage: (message: string, from: string) => void) {
    if (this.openError) throw this.openError;
    this.opens++;
    this.closed = false;
    this.handler = onMessage;
  }
  async send(message: string, host: string, port: number) {
    if (this.sendError) throw this.sendError;
    this.sent.push({ message, host, port });
  }
  close() {
    this.closed = true;
  }
  reply(data: Record<string, unknown>, from = String(data.ip)) {
    this.handler?.(JSON.stringify({ msg: { cmd: "scan", data } }), from);
  }
}

const errno = (code: string) =>
  Object.assign(new Error(code), { code }) as NodeJS.ErrnoException;

const desk = {
  ip: "192.168.1.23",
  device: "0b:5b:cf:32:34:38:3b:50",
  sku: "H6056",
};

function setup(socket = new FakeSocket()) {
  let time = 1_000;
  const log = { info: vi.fn(), warn: vi.fn() };
  const registry = new LanDeviceRegistry(socket, {
    replyWindowMs: 50,
    maxAgeMs: 60_000,
    idleMs: 30_000,
    portRetryMs: 60_000,
    now: () => time,
    logger: log,
  });
  return { socket, registry, log, advance: (ms: number) => (time += ms) };
}

describe("Govee LAN protocol", () => {
  it("uses Govee's documented addresses", () => {
    expect([LAN_MULTICAST_ADDRESS, LAN_SCAN_PORT, LAN_CONTROL_PORT]).toEqual([
      "239.255.255.250",
      4001,
      4003,
    ]);
  });

  it("parses scan replies and ignores anything else", () => {
    expect(
      parseLanMessage(JSON.stringify({ msg: { cmd: "scan", data: desk } })),
    ).toEqual({ cmd: "scan", data: desk });
    expect(parseLanMessage("not json")).toBeNull();
    expect(
      parseLanMessage(
        JSON.stringify({ msg: { cmd: "scan", data: { ip: 1 } } }),
      ),
    ).toBeNull();
  });
});

describe("LanDeviceRegistry", () => {
  it("scans the multicast group and records lights that answer", async () => {
    const { socket, registry, log } = setup();
    expect(await registry.start()).toBe(true);
    const scan = registry.scan();
    socket.reply(desk);
    const found = await scan;
    // UDP drops packets: one scan missed a light on hardware, so each scan
    // is sent three times within the reply window.
    const scanPacket = {
      message: '{"msg":{"cmd":"scan","data":{"account_topic":"reserve"}}}',
      host: "239.255.255.250",
      port: 4001,
    };
    expect(socket.sent).toEqual([scanPacket, scanPacket, scanPacket]);
    expect(found.map((d) => d.ip)).toEqual(["192.168.1.23"]);
    // The cloud API reports the same id in upper case.
    expect(registry.get("0B:5B:CF:32:34:38:3B:50")).toMatchObject({
      ip: "192.168.1.23",
      sku: "H6056",
    });
    expect(log.info).toHaveBeenCalledWith(
      "lan.discover",
      expect.objectContaining({ found: 1 }),
    );
  });

  it("forgets a light that has not answered for longer than the max age", async () => {
    const { socket, registry, advance } = setup();
    await registry.start();
    const scan = registry.scan();
    socket.reply(desk);
    await scan;
    advance(60_001);
    await registry.scan();
    expect(registry.get(desk.device)).toBeUndefined();
  });

  it("stays on the cloud when another app holds the LAN port", async () => {
    const socket = new FakeSocket();
    socket.openError = errno("EADDRINUSE");
    const { registry, log } = setup(socket);
    expect(await registry.start()).toBe(false);
    expect(await registry.scan()).toEqual([]);
    expect(registry.status).toEqual({
      available: false,
      reason: "port-in-use",
    });
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("reports a blocked local network (permission denied or firewall)", async () => {
    const socket = new FakeSocket();
    socket.sendError = errno("EHOSTUNREACH");
    const { registry } = setup(socket);
    await registry.start();
    expect(await registry.scan()).toEqual([]);
    expect(registry.status).toEqual({
      available: false,
      reason: "network-blocked",
    });
  });

  it("closes the socket on stop", async () => {
    const { socket, registry } = setup();
    await registry.start();
    registry.stop();
    expect(socket.closed).toBe(true);
  });
});

describe("LanDeviceRegistry after a network outage", () => {
  it("scans again after a send failed, e.g. while Wi-Fi reconnects after wake", async () => {
    const socket = new FakeSocket();
    const { registry } = setup(socket);
    await registry.start();
    socket.sendError = errno("ENETUNREACH");
    expect(await registry.scan()).toEqual([]);
    expect(registry.status).toEqual({
      available: false,
      reason: "network-blocked",
    });
    socket.sendError = undefined;
    const scan = registry.scan();
    socket.reply(desk);
    expect((await scan).map((d) => d.ip)).toEqual(["192.168.1.23"]);
    expect(registry.status).toEqual({ available: true });
  });

  it("stays off when another app holds the port", async () => {
    const socket = new FakeSocket();
    socket.openError = errno("EADDRINUSE");
    const { registry } = setup(socket);
    await registry.start();
    await registry.scan();
    expect(socket.sent).toEqual([]);
  });
});

describe("LanDeviceRegistry releases the LAN port when idle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function scanned() {
    const ctx = setup();
    await ctx.registry.start();
    const scan = ctx.registry.scan();
    ctx.socket.reply(desk);
    await vi.advanceTimersByTimeAsync(100);
    await scan;
    return ctx;
  }

  it("closes the socket after the idle period but remembers the lights", async () => {
    const { socket, registry } = await scanned();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(socket.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(socket.closed).toBe(true);
    expect(registry.get(desk.device)).toMatchObject({ ip: desk.ip });
  });

  it("reopens the socket when a command or status read needs it", async () => {
    const { socket, registry } = await scanned();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await registry.sendCommands(desk.device, ["{}"])).toBe(true);
    expect(socket.opens).toBe(2);
    expect(socket.closed).toBe(false);
  });

  it("stays open while traffic keeps arriving", async () => {
    const { socket, registry } = await scanned();
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      await registry.sendCommands(desk.device, ["{}"]);
    }
    expect(socket.closed).toBe(false);
    expect(socket.opens).toBe(1);
  });

  it("does not close under a status request that is waiting for its reply", async () => {
    const { socket, registry } = await scanned();
    await vi.advanceTimersByTimeAsync(29_000);
    const reading = registry.requestStatus(desk.device, 5_000);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(socket.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    await reading;
  });

  it("tries a taken port again after the retry gap, not before", async () => {
    const socket = new FakeSocket();
    socket.openError = errno("EADDRINUSE");
    const { registry, advance } = setup(socket);
    expect(await registry.start()).toBe(false);
    socket.openError = undefined;
    advance(30_000);
    expect(await registry.sendCommands(desk.device, ["{}"])).toBe(false);
    expect(socket.opens).toBe(0);
    advance(31_000);
    const scan = registry.scan();
    socket.reply(desk);
    await vi.advanceTimersByTimeAsync(100);
    expect((await scan).map((d) => d.ip)).toEqual([desk.ip]);
    expect(registry.status).toEqual({ available: true });
  });

  it("stays off after disable until started again, and forgets lights", async () => {
    const { socket, registry } = await scanned();
    registry.disable();
    expect(socket.closed).toBe(true);
    expect(registry.status).toEqual({ available: false, reason: "disabled" });
    expect(registry.get(desk.device)).toBeUndefined();
    expect(await registry.sendCommands(desk.device, ["{}"])).toBe(false);
    expect(await registry.scan()).toEqual([]);
    expect(socket.opens).toBe(1);
    expect(await registry.start()).toBe(true);
    expect(socket.opens).toBe(2);
  });
});
