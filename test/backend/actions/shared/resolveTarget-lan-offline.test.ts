import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lan = vi.hoisted(() => ({
  knows: vi.fn((_deviceId: string, _model: string) => false),
}));
vi.mock("../../../../src/backend/services/LanDiscovery", () => ({
  lanDiscovery: lan,
}));

import { ActionServices } from "../../../../src/backend/actions/shared/ActionServices";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../../src/backend/domain/entities/LightGroup";

/** Swap services on the private static _shared, restoring afterwards. */
const installShared = (patch: Record<string, unknown>) => {
  const shared = (
    ActionServices as unknown as { _shared: Record<string, unknown> }
  )._shared;
  const original = Object.fromEntries(
    Object.keys(patch).map((key) => [key, shared[key]]),
  );
  Object.assign(shared, patch);
  return () => Object.assign(shared, original);
};

/** Cloud discovery failing: no internet, nothing cached. */
const offlineCloud = {
  discover: vi.fn().mockResolvedValue([]),
  knownLights: vi.fn().mockResolvedValue([]),
  getCachedLights: vi.fn().mockReturnValue(null),
};

/**
 * Without internet after a restart the cloud device list is empty, but
 * lights that answered the LAN scan can still be controlled locally
 * (docs/lan.html: "keep working when the internet is down").
 */
describe("resolveTarget without the cloud device list", () => {
  let restore: (() => void) | undefined;
  beforeEach(() => lan.knows.mockReset().mockReturnValue(false));
  afterEach(() => restore?.());

  it("resolves a light that answered the LAN scan, with what LAN can do", async () => {
    lan.knows.mockImplementation(
      (id, model) => id === "0B:5B" && model === "H6056",
    );
    restore = installShared({ deviceService: offlineCloud });
    const target = await new ActionServices().resolveTarget({
      selectedDeviceId: "0B:5B|H6056",
      selectedLightName: "Desk (H6056)",
    } as never);
    expect(target?.type).toBe("light");
    const light = target!.light!;
    expect([light.deviceId, light.model, light.name]).toEqual([
      "0B:5B",
      "H6056",
      "Desk",
    ]);
    expect(light.canBeControlled()).toBe(true);
    expect(light.capabilities).toMatchObject({
      brightness: true,
      color: true,
      colorTemperature: true,
      scenes: false,
      segmentedColor: false,
    });
  });

  it("still fails for a light the LAN scan doesn't know", async () => {
    restore = installShared({ deviceService: offlineCloud });
    const target = await new ActionServices().resolveTarget({
      selectedDeviceId: "0B:5B|H6056",
    } as never);
    expect(target).toBeNull();
  });

  it("keeps group members the LAN scan knows online", async () => {
    lan.knows.mockImplementation((id) => id === "0B:5B");
    const state = { isOn: false, isOnline: true };
    const desk = Light.create("0B:5B", "H6056", "Desk", state);
    const bulb = Light.create("AA:AA", "H6008", "Bulb", state);
    const group = LightGroup.create("g1", "Office", [desk, bulb]);
    restore = installShared({
      deviceService: offlineCloud,
      groupService: { findGroupById: vi.fn().mockResolvedValue(group) },
    });
    const target = await new ActionServices().resolveTarget({
      selectedDeviceId: "group:g1",
    } as never);
    expect(target?.group?.getControllableLights().map((l) => l.name)).toEqual([
      "Desk",
    ]);
  });
});
