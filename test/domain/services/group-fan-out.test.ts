import { describe, expect, it, vi } from "vitest";
import { fanOutToLights } from "../../../src/backend/domain/services/group-fan-out";
import { Light } from "../../../src/backend/domain/entities/Light";
import type { LightState } from "../../../src/backend/domain/value-objects/LightState";

const makeLight = (deviceId: string, name = deviceId) =>
  Light.create(deviceId, "H6001", name, {
    isOn: false,
    isOnline: true,
  } as LightState);

describe("fanOutToLights", () => {
  it("sends to every light before any of them has answered", async () => {
    const lights = [makeLight("a"), makeLight("b"), makeLight("c")];
    let inFlight = 0;
    let peak = 0;
    const apply = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
    });

    await fanOutToLights(lights, apply);

    expect(apply).toHaveBeenCalledTimes(3);
    expect(peak).toBe(3);
  });

  it("reports every light as succeeded when none fail", async () => {
    const lights = [makeLight("a"), makeLight("b")];

    const outcome = await fanOutToLights(lights, async () => {});

    expect(outcome).toEqual({ total: 2, failed: [] });
  });

  it("keeps the lights that succeeded when one member fails", async () => {
    const lights = [makeLight("a"), makeLight("b"), makeLight("c")];
    const unreachable = new Error("device offline");

    const outcome = await fanOutToLights(lights, async (light) => {
      if (light.deviceId === "b") throw unreachable;
    });

    expect(outcome.total).toBe(3);
    expect(outcome.failed).toEqual([{ light: lights[1], error: unreachable }]);
  });

  it("rejects with the first error when every light fails", async () => {
    const lights = [makeLight("a"), makeLight("b")];

    await expect(
      fanOutToLights(lights, async (light) => {
        throw new Error(`failed ${light.deviceId}`);
      }),
    ).rejects.toThrow("failed a");
  });

  it("captures an operation that throws before returning a promise", async () => {
    const lights = [makeLight("a"), makeLight("b")];

    const outcome = await fanOutToLights(lights, (light) => {
      if (light.deviceId === "a") throw new Error("sync failure");
      return Promise.resolve();
    });

    expect(outcome.failed.map((f) => f.light.deviceId)).toEqual(["a"]);
  });

  it("rejects when there is no light to send to", async () => {
    await expect(fanOutToLights([], async () => {})).rejects.toThrow(
      "No lights to control",
    );
  });
});
