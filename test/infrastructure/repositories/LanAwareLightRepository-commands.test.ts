import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@felixgeelhaar/govee-api-client", async (load) => ({
  ...(await load<object>()),
  GoveeClient: class {},
}));

import {
  LanAwareLightRepository,
  LAN_CONFIRM_DELAY_MS,
} from "../../../src/backend/infrastructure/repositories/LanAwareLightRepository";
import { GoveeLightRepository } from "../../../src/backend/infrastructure/repositories/GoveeLightRepository";
import { Light } from "../../../src/backend/domain/entities/Light";
import { Brightness } from "../../../src/backend/domain/value-objects/Brightness";
import { ColorRgb } from "../../../src/backend/domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../../src/backend/domain/value-objects/ColorTemperature";
import type { LanStatusReply } from "../../../src/backend/infrastructure/lan/LanProtocol";

const desk = () =>
  Light.create("0B:5B", "H6056", "Desk", {
    isOn: false,
    isOnline: true,
    brightness: undefined,
    color: undefined,
    colorTemperature: undefined,
  });

const reply = (overrides: Partial<LanStatusReply> = {}): LanStatusReply => ({
  onOff: 1,
  brightness: 50,
  color: { r: 0, g: 0, b: 0 },
  colorTemInKelvin: 0,
  ...overrides,
});

/**
 * Phase 3 of docs/design/lan-control.md: the common commands go to the
 * light over the local network, are confirmed with a status read, and fall
 * back to the cloud when the light didn't change.
 */
describe("LAN commands", () => {
  let lan: {
    readStatus: ReturnType<typeof vi.fn>;
    sendCommands: ReturnType<typeof vi.fn>;
  };
  let cloud: Record<string, ReturnType<typeof vi.spyOn>>;
  const messages = () =>
    lan.sendCommands.mock.calls.map(([, sent]) =>
      (sent as string[]).map((m) => JSON.parse(m).msg),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    lan = {
      readStatus: vi.fn().mockResolvedValue(reply()),
      sendCommands: vi.fn().mockResolvedValue(true),
    };
    cloud = Object.fromEntries(
      [
        "setPower",
        "setBrightness",
        "setColor",
        "setColorTemperature",
        "turnOnWithBrightness",
        "turnOnWithColor",
        "turnOnWithColorTemperature",
      ].map((name) => [
        name,
        vi
          .spyOn(GoveeLightRepository.prototype, name as "setPower")
          .mockResolvedValue(),
      ]),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const repo = () => new LanAwareLightRepository("key", lan);

  it("turns a LAN light on without the cloud", async () => {
    const repository = repo();
    const light = desk();
    await repository.setPower(light, true);
    expect(messages()).toEqual([[{ cmd: "turn", data: { value: 1 } }]]);
    expect(light.state.isOn).toBe(true);
    expect(cloud.setPower).not.toHaveBeenCalled();
    expect(repository.transportOf(light)).toBe("lan");
  });

  it("encodes brightness, colour and temperature as Govee documents them", async () => {
    const repository = repo();
    await repository.setBrightness(desk(), new Brightness(40));
    await repository.setBrightness(desk(), new Brightness(0));
    await repository.setColor(desk(), new ColorRgb(255, 120, 0));
    await repository.setColorTemperature(desk(), new ColorTemperature(4000));
    await repository.turnOnWithColor(
      desk(),
      new ColorRgb(0, 0, 255),
      new Brightness(80),
    );
    expect(messages()).toEqual([
      [{ cmd: "brightness", data: { value: 40 } }],
      [{ cmd: "turn", data: { value: 0 } }],
      [
        {
          cmd: "colorwc",
          data: { color: { r: 255, g: 120, b: 0 }, colorTemInKelvin: 0 },
        },
      ],
      [
        {
          cmd: "colorwc",
          data: { color: { r: 0, g: 0, b: 0 }, colorTemInKelvin: 4000 },
        },
      ],
      [
        { cmd: "turn", data: { value: 1 } },
        {
          cmd: "colorwc",
          data: { color: { r: 0, g: 0, b: 255 }, colorTemInKelvin: 0 },
        },
        { cmd: "brightness", data: { value: 80 } },
      ],
    ]);
    expect(
      Object.values(cloud).every((spy) => spy.mock.calls.length === 0),
    ).toBe(true);
  });

  it("uses the cloud for a light that isn't on the local network", async () => {
    lan.sendCommands.mockResolvedValue(false);
    const repository = repo();
    const light = desk();
    await repository.setPower(light, true);
    expect(cloud.setPower).toHaveBeenCalledWith(light, true);
    expect(repository.transportOf(light)).toBe("cloud");
  });

  it("resends over the cloud when the light didn't change, and stays on the cloud", async () => {
    lan.readStatus.mockResolvedValue(reply({ onOff: 0 }));
    const repository = repo();
    const light = desk();
    await repository.setPower(light, true);
    await vi.advanceTimersByTimeAsync(LAN_CONFIRM_DELAY_MS);
    expect(cloud.setPower).toHaveBeenCalledWith(light, true);
    await repository.setPower(light, false);
    expect(cloud.setPower).toHaveBeenCalledTimes(2);
    expect(lan.sendCommands).toHaveBeenCalledTimes(1);
  });

  it("accepts a confirmation that matches", async () => {
    lan.readStatus.mockResolvedValue(reply({ brightness: 40 }));
    const repository = repo();
    await repository.setBrightness(desk(), new Brightness(40));
    await vi.advanceTimersByTimeAsync(LAN_CONFIRM_DELAY_MS);
    expect(cloud.setBrightness).not.toHaveBeenCalled();
    expect(repository.transportOf(desk())).toBe("lan");
  });

  it("confirms only the newest command, so fast dial turns aren't mistaken for failures", async () => {
    // The light reports the last value, 42; the earlier 40 and 41 are stale.
    lan.readStatus.mockResolvedValue(reply({ brightness: 42 }));
    const repository = repo();
    const light = desk();
    for (const level of [40, 41, 42])
      await repository.setBrightness(light, new Brightness(level));
    await vi.advanceTimersByTimeAsync(LAN_CONFIRM_DELAY_MS);
    expect(lan.readStatus).toHaveBeenCalledTimes(1);
    expect(cloud.setBrightness).not.toHaveBeenCalled();
  });

  it("treats a temperature within 100 K as confirmed (lights round it)", async () => {
    lan.readStatus.mockResolvedValue(reply({ colorTemInKelvin: 3950 }));
    const repository = repo();
    await repository.setColorTemperature(desk(), new ColorTemperature(4000));
    await vi.advanceTimersByTimeAsync(LAN_CONFIRM_DELAY_MS);
    expect(cloud.setColorTemperature).not.toHaveBeenCalled();
  });
});
