import { describe, expect, it, vi } from "vitest";
import { LanFirstPowerClient } from "../../src/backend/infrastructure/LanFirstPowerClient";
import { BoundedPowerClient } from "../../src/backend/infrastructure/BoundedPowerClient";

const desk = { deviceId: "0B:5B", model: "H6056" };
const status = (onOff: number) => ({
  onOff,
  brightness: 50,
  color: { r: 0, g: 0, b: 0 },
  colorTemInKelvin: 0,
});

function setup(lan: {
  sent: boolean;
  reply: ReturnType<typeof status> | null;
}) {
  const source = {
    sendCommands: vi.fn().mockResolvedValue(lan.sent),
    readStatus: vi.fn().mockResolvedValue(lan.reply),
  };
  const cloud = new BoundedPowerClient();
  const cloudSet = vi.spyOn(cloud, "setPower").mockResolvedValue();
  return { source, cloudSet, client: new LanFirstPowerClient(source, cloud) };
}

/**
 * #377: "Off before sleep" failed because the cloud request didn't finish
 * before the computer slept. Automation now switches LAN lights directly
 * and uses the cloud only when the light didn't confirm.
 */
describe("LanFirstPowerClient", () => {
  const signal = new AbortController().signal;

  it("switches a LAN light off without the cloud once it confirms", async () => {
    const { source, cloudSet, client } = setup({
      sent: true,
      reply: status(0),
    });
    expect(await client.setPower(desk, false, "key", signal)).toBe("lan");
    expect(JSON.parse(source.sendCommands.mock.calls[0][1][0]).msg).toEqual({
      cmd: "turn",
      data: { value: 0 },
    });
    expect(source.readStatus).toHaveBeenCalledWith("0B:5B", 500);
    expect(cloudSet).not.toHaveBeenCalled();
  });

  it("waits for the first LAN scan, so a startup rule doesn't miss it", async () => {
    const { source, cloudSet, client } = setup({
      sent: true,
      reply: status(1),
    });
    let finishScan = () => {};
    const order: string[] = [];
    Object.assign(source, {
      ready: () =>
        new Promise<void>((resolve) => {
          finishScan = () => {
            order.push("scanned");
            resolve();
          };
        }),
    });
    source.sendCommands.mockImplementation(async () => {
      order.push("sent");
      return true;
    });
    const pending = client.setPower(desk, true, "key", signal);
    await Promise.resolve();
    finishScan();
    expect(await pending).toBe("lan");
    expect(order).toEqual(["scanned", "sent"]);
    expect(cloudSet).not.toHaveBeenCalled();
  });

  it("uses the cloud when the light reports the old state", async () => {
    const { cloudSet, client } = setup({ sent: true, reply: status(1) });
    expect(await client.setPower(desk, false, "key", signal)).toBe("cloud");
    expect(cloudSet).toHaveBeenCalledWith(desk, false, "key", signal);
  });

  it("uses the cloud when the light doesn't answer", async () => {
    const { cloudSet, client } = setup({ sent: true, reply: null });
    expect(await client.setPower(desk, true, "key", signal)).toBe("cloud");
    expect(cloudSet).toHaveBeenCalledWith(desk, true, "key", signal);
  });

  it("uses the cloud for a light that isn't on the local network", async () => {
    const { source, cloudSet, client } = setup({ sent: false, reply: null });
    expect(await client.setPower(desk, true, "key", signal)).toBe("cloud");
    expect(source.readStatus).not.toHaveBeenCalled();
    expect(cloudSet).toHaveBeenCalled();
  });

  it("doesn't fall back after the automation was cancelled", async () => {
    const controller = new AbortController();
    const { source, cloudSet, client } = setup({ sent: true, reply: null });
    source.readStatus.mockImplementation(async () => {
      controller.abort();
      return null;
    });
    await expect(
      client.setPower(desk, true, "key", controller.signal),
    ).rejects.toThrow();
    expect(cloudSet).not.toHaveBeenCalled();
  });
});
