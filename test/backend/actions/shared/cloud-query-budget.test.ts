import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionServices } from "../../../../src/backend/actions/shared/ActionServices";
import { Light } from "../../../../src/backend/domain/entities/Light";

const internals = ActionServices as unknown as {
  _shared: Record<string, unknown>;
  lightStateSnapshots: Map<string, unknown>;
  lightStateSyncedAt: Map<string, number>;
  liveStateBlockedUntil: Map<string, number>;
  liveStateLogged: Set<string>;
};
const light = () =>
  Light.create("budget-device", "H6001", "Desk", {
    isOn: true,
    isOnline: true,
  });
let previous: Record<string, unknown>;
const repository = { getLightState: vi.fn() };
const transport = { getLightState: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  previous = { ...internals._shared };
  internals._shared.lightRepository = repository;
  internals._shared.deviceService = transport;
  repository.getLightState
    .mockReset()
    .mockImplementation(async (l: Light) => l.updateState({ isOn: true }));
  transport.getLightState
    .mockReset()
    .mockResolvedValue({
      state: { powerState: true, isOnline: true },
      transport: "cloud",
    });
});
afterEach(() => {
  Object.assign(internals._shared, previous);
  for (const key of ["lightRepository", "deviceService"])
    if (!(key in previous)) delete internals._shared[key];
  internals.lightStateSnapshots.clear();
  internals.lightStateSyncedAt.clear();
  internals.liveStateBlockedUntil.clear();
  internals.liveStateLogged.clear();
  vi.useRealTimers();
});
describe("#387 shared cloud query budget", () => {
  it("shares one 30-second state sample across keys, dials and groups", async () => {
    const a = new ActionServices();
    const b = new ActionServices();
    await a.syncLightState(light());
    for (let n = 0; n < 9; n++) {
      await vi.advanceTimersByTimeAsync(3000);
      await b.syncLightState(light());
    }
    expect(repository.getLightState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    await b.syncLightState(light());
    expect(repository.getLightState).toHaveBeenCalledTimes(2);
  });
  it.each(["Rate limit exceeded", "API returned error code 429"])(
    "does not bypass %s through the second cloud client",
    async (message) => {
      repository.getLightState.mockRejectedValue(new Error(message));
      const services = new ActionServices();
      await services.getLivePowerState(light());
      await vi.advanceTimersByTimeAsync(3000);
      await new ActionServices().getLivePowerState(light());
      expect(repository.getLightState).toHaveBeenCalledTimes(1);
      expect(transport.getLightState).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(57000);
      await services.getLivePowerState(light());
      expect(repository.getLightState).toHaveBeenCalledTimes(2);
    },
  );
});
