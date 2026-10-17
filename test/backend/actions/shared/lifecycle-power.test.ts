import { streamDeck } from "@elgato/streamdeck";
import { globalSettingsService } from "../../../../src/backend/services/GlobalSettingsService";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionServices,
  registerPowerLifecycleOverride,
} from "../../../../src/backend/actions/shared/ActionServices";
import { BoundedPowerClient } from "../../../../src/backend/infrastructure/BoundedPowerClient";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../../src/backend/domain/entities/LightGroup";
const first = () =>
  Light.create("a", "H619A", "Desk", { isOn: false, isOnline: false });
afterEach(() => {
  registerPowerLifecycleOverride(null);
  vi.restoreAllMocks();
});
describe("lifecycle power dispatch integration", () => {
  it("attempts offline group members and retains successful updates", async () => {
    const reached = first();
    const missed = Light.create("b", "H607C", "Wall", {
      isOn: false,
      isOnline: false,
    });
    vi.spyOn(BoundedPowerClient.prototype, "setPower").mockImplementation(
      async (light) => {
        if (light === missed) throw { category: "network" };
      },
    );
    const services = new ActionServices();
    const target = {
      type: "group" as const,
      group: LightGroup.create("g", "Desk", [reached, missed]),
    };
    const notify = vi.fn();
    registerPowerLifecycleOverride(notify);
    const outcome = await services.controlLifecyclePower(
      target,
      true,
      new AbortController().signal,
      "private-key",
    );
    expect(BoundedPowerClient.prototype.setPower).toHaveBeenCalledTimes(2);
    expect(outcome.failed[0]?.light).toBe(missed);
    expect(reached.isOn).toBe(true);
    expect(missed.isOn).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
  it("notifies manual override even when no effect is running", async () => {
    const notify = vi.fn();
    registerPowerLifecycleOverride(notify);
    const target = { type: "light" as const, light: first() };
    await new ActionServices().cancelActiveEffectForTarget(target);
    expect(notify).toHaveBeenCalledWith(target);
  });
  it("advanced group commands also pause pending lifecycle automation", async () => {
    const notify = vi.fn();
    registerPowerLifecycleOverride(notify);
    const target = { type: "light" as const, light: first() };
    await new ActionServices().applyToTarget(
      target,
      "Scene",
      vi.fn().mockResolvedValue(undefined),
    );
    expect(notify).toHaveBeenCalledWith(target);
  });
  it("does not issue power after effect cancellation if the lifecycle signal expired", async () => {
    const controller = new AbortController();
    const services = new ActionServices();
    vi.spyOn(services, "cancelActiveEffectForTarget").mockImplementation(
      async () => {
        controller.abort();
      },
    );
    const send = vi.spyOn(BoundedPowerClient.prototype, "setPower");
    await expect(
      services.controlLifecyclePower(
        { type: "light", light: first() },
        true,
        controller.signal,
        "private-key",
      ),
    ).rejects.toBeDefined();
    expect(send).not.toHaveBeenCalled();
  });
});

it("the On/Off datasource excludes known unsupported power targets", async () => {
  const shared = (
    ActionServices as unknown as { _shared: Record<string, unknown> }
  )._shared;
  const original = shared.deviceService;
  const device = (id: string, power: boolean) => ({
    deviceId: id,
    model: "H619A",
    name: id,
    capabilities: { power },
  });
  shared.deviceService = {
    discover: vi
      .fn()
      .mockResolvedValue([device("power", true), device("no-power", false)]),
    getCachedUnsupportedDevices: () => [],
  };
  const services = new ActionServices();
  Object.assign(streamDeck.ui, { action: { id: "ctx" } });
  vi.spyOn(globalSettingsService, "getApiKey").mockResolvedValue("test-key");
  vi.spyOn(services, "ensureServices").mockResolvedValue();
  try {
    await services.handleGetDevices("ctx", { powerOnly: true });
    expect(
      vi.mocked(streamDeck.ui.sendToPropertyInspector).mock.calls.at(-1)?.[0],
    ).toMatchObject({
      status: "ok",
      items: [{ label: "Lights", children: [{ value: "light:power|H619A" }] }],
    });
  } finally {
    shared.deviceService = original;
  }
});

it("resolves stored power targets without cloud discovery or credential writes", async () => {
  const holder = ActionServices as unknown as {
    _shared: Record<string, unknown>;
  };
  const original = holder._shared;
  const discover = vi.fn().mockRejectedValue(new Error("Network unavailable"));
  holder._shared = { deviceService: { discover, getCachedLights: () => null } };
  const persist = vi
    .spyOn(globalSettingsService, "setApiKey")
    .mockResolvedValue();
  try {
    const target = await new ActionServices().resolveLifecycleTarget(
      "light:dev-1|H619A",
    );
    expect(target?.light?.deviceId).toBe("dev-1");
    expect(discover).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  } finally {
    holder._shared = original;
  }
});
