import { afterEach, describe, expect, it, vi } from "vitest";

// The cloud client is never called here: the cloud path is spied on.
vi.mock("@felixgeelhaar/govee-api-client", async (load) => ({
  ...(await load<object>()),
  GoveeClient: class {},
}));
import { LanAwareLightRepository } from "../../../src/backend/infrastructure/repositories/LanAwareLightRepository";
import { GoveeLightRepository } from "../../../src/backend/infrastructure/repositories/GoveeLightRepository";
import { Light } from "../../../src/backend/domain/entities/Light";
import { stateSamples } from "../../../src/backend/infrastructure/repositories/StateSampleLog";
import streamDeck from "@elgato/streamdeck";

const desk = () =>
  Light.create("0B:5B", "H6056", "Desk", {
    isOn: false,
    isOnline: false,
    brightness: undefined,
    color: undefined,
    colorTemperature: undefined,
  });

/**
 * Phase 2 of docs/design/lan-control.md: state reads go to the light over
 * the local network when it answers, and to the cloud otherwise.
 */
describe("LanAwareLightRepository.getLightState", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads a LAN light directly, without a cloud query", async () => {
    const cloud = vi
      .spyOn(GoveeLightRepository.prototype, "getLightState")
      .mockResolvedValue();
    const record = vi.spyOn(stateSamples, "record");
    const info = vi.spyOn(streamDeck.logger, "info");
    const lan = {
      sendCommands: vi.fn(),
      readStatus: vi.fn().mockResolvedValue({
        onOff: 1,
        brightness: 64,
        color: { r: 0, g: 0, b: 0 },
        colorTemInKelvin: 4000,
      }),
    };
    const light = desk();
    await new LanAwareLightRepository("key", lan).getLightState(light);
    expect(lan.readStatus).toHaveBeenCalledWith("0B:5B");
    expect(cloud).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(light, "lan");
    expect(light.state.isOn).toBe(true);
    expect(light.state.isOnline).toBe(true);
    expect(light.state.brightness?.level).toBe(64);
    expect(light.state.colorTemperature?.kelvin).toBe(4000);
    expect(light.state.color).toBeUndefined();
    expect(info).toHaveBeenCalledWith(
      "lan.state",
      expect.objectContaining({ name: "Desk" }),
    );
  });

  it("reports colour when the light is in colour mode", async () => {
    vi.spyOn(
      GoveeLightRepository.prototype,
      "getLightState",
    ).mockResolvedValue();
    const lan = {
      sendCommands: vi.fn(),
      readStatus: vi.fn().mockResolvedValue({
        onOff: 0,
        brightness: 10,
        color: { r: 255, g: 120, b: 0 },
        colorTemInKelvin: 0,
      }),
    };
    const light = desk();
    await new LanAwareLightRepository("key", lan).getLightState(light);
    expect(light.state.isOn).toBe(false);
    const color = light.state.color;
    expect([color?.r, color?.g, color?.b]).toEqual([255, 120, 0]);
    expect(light.state.colorTemperature).toBeUndefined();
  });

  it("falls back to the cloud when the light doesn't answer on LAN", async () => {
    const cloud = vi
      .spyOn(GoveeLightRepository.prototype, "getLightState")
      .mockResolvedValue();
    const lan = {
      readStatus: vi.fn().mockResolvedValue(null),
      sendCommands: vi.fn(),
    };
    const light = desk();
    await new LanAwareLightRepository("key", lan).getLightState(light);
    expect(cloud).toHaveBeenCalledWith(light);
  });

  it("falls back to the cloud for a reply it can't map", async () => {
    const cloud = vi
      .spyOn(GoveeLightRepository.prototype, "getLightState")
      .mockResolvedValue();
    const lan = {
      sendCommands: vi.fn(),
      readStatus: vi.fn().mockResolvedValue({
        onOff: 1,
        brightness: 250,
        color: { r: 0, g: 0, b: 0 },
        colorTemInKelvin: 0,
      }),
    };
    await new LanAwareLightRepository("key", lan).getLightState(desk());
    expect(cloud).toHaveBeenCalled();
  });
});
