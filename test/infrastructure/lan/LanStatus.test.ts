import { describe, expect, it, vi } from "vitest";
import { parseLanMessage } from "../../../src/backend/infrastructure/lan/LanProtocol";
import { LanDeviceRegistry } from "../../../src/backend/infrastructure/lan/LanDeviceRegistry";
import type { LanSocketPort } from "../../../src/backend/infrastructure/lan/LanSocket";

class FakeSocket implements LanSocketPort {
  sent: { message: string; host: string; port: number }[] = [];
  handler?: (message: string, from: string) => void;
  async open(onMessage: (message: string, from: string) => void) {
    this.handler = onMessage;
  }
  async send(message: string, host: string, port: number) {
    this.sent.push({ message, host, port });
  }
  close() {}
  from(ip: string, msg: object) {
    this.handler?.(JSON.stringify({ msg }), ip);
  }
}

const desk = { ip: "192.168.1.23", device: "0B:5B", sku: "H6056" };
const status = {
  onOff: 1,
  brightness: 64,
  color: { r: 255, g: 120, b: 0 },
  colorTemInKelvin: 0,
};

async function known(socket = new FakeSocket()) {
  const registry = new LanDeviceRegistry(socket, {
    replyWindowMs: 10,
    logger: { info: vi.fn(), warn: vi.fn() },
  });
  await registry.start();
  const scan = registry.scan();
  socket.from(desk.ip, { cmd: "scan", data: desk });
  await scan;
  socket.sent = [];
  return { socket, registry };
}

describe("LAN state reads", () => {
  it("parses a devStatus reply", () => {
    expect(
      parseLanMessage(
        JSON.stringify({ msg: { cmd: "devStatus", data: status } }),
      ),
    ).toEqual({ cmd: "devStatus", data: status });
    expect(
      parseLanMessage(
        JSON.stringify({ msg: { cmd: "devStatus", data: { onOff: "yes" } } }),
      ),
    ).toBeNull();
  });

  it("asks the light directly and returns its reply", async () => {
    const { socket, registry } = await known();
    const read = registry.requestStatus("0b:5b", 200);
    await Promise.resolve();
    expect(socket.sent).toEqual([
      {
        message: '{"msg":{"cmd":"devStatus","data":{}}}',
        host: "192.168.1.23",
        port: 4003,
      },
    ]);
    socket.from("192.168.1.99", {
      cmd: "devStatus",
      data: { ...status, onOff: 0 },
    });
    socket.from(desk.ip, { cmd: "devStatus", data: status });
    expect(await read).toEqual(status);
  });

  it("gives up after the timeout so the caller can use the cloud", async () => {
    const { registry } = await known();
    expect(await registry.requestStatus("0B:5B", 20)).toBeNull();
  });

  it("returns null for a light it doesn't know, without sending", async () => {
    const { socket, registry } = await known();
    expect(await registry.requestStatus("FF:FF", 20)).toBeNull();
    expect(socket.sent).toEqual([]);
  });
});

describe("LAN commands", () => {
  it("sends each command to the light's control port, in order", async () => {
    const { socket, registry } = await known();
    expect(await registry.sendCommands("0b:5b", ["a", "b"])).toBe(true);
    expect(socket.sent).toEqual([
      { message: "a", host: "192.168.1.23", port: 4003 },
      { message: "b", host: "192.168.1.23", port: 4003 },
    ]);
  });

  it("refuses a light it doesn't know, so the cloud is used", async () => {
    const { socket, registry } = await known();
    expect(await registry.sendCommands("FF:FF", ["a"])).toBe(false);
    expect(socket.sent).toEqual([]);
  });
});
