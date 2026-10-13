import { afterEach, describe, expect, it, vi } from "vitest";
import { streamDeck } from "@elgato/streamdeck";
import { ActionServices } from "../../../../src/backend/actions/shared/ActionServices";
import { DeviceService } from "../../../../src/backend/application/services/DeviceService";
import { LightControlService } from "../../../../src/backend/domain/services/LightControlService";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../../src/backend/domain/entities/LightGroup";
import { Brightness } from "../../../../src/backend/domain/value-objects/Brightness";
import { ColorRgb } from "../../../../src/backend/domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../../../src/backend/domain/value-objects/ColorTemperature";
import type { ILightRepository } from "../../../../src/backend/domain/repositories/ILightRepository";
import type { TransportOrchestrator } from "../../../../src/backend/connectivity/TransportOrchestrator";

const light = (id = "dev-1") =>
  Light.create(id, "H619A", "Desk", { isOn: false, isOnline: false });
const commands = [
  { command: "on", method: "setPower", value: undefined },
  { command: "off", method: "setPower", value: undefined },
  { command: "brightness", method: "setBrightness", value: new Brightness(60) },
  { command: "color", method: "setColor", value: ColorRgb.fromHex("#FFFFFF") },
  {
    command: "colorTemperature",
    method: "setColorTemperature",
    value: new ColorTemperature(3000),
  },
] as const;
const repo = () => ({
  setPower: vi.fn().mockResolvedValue(undefined),
  setBrightness: vi.fn().mockResolvedValue(undefined),
  setColor: vi.fn().mockResolvedValue(undefined),
  setColorTemperature: vi.fn().mockResolvedValue(undefined),
});
const shared = (
  ActionServices as unknown as { _shared: Record<string, unknown> }
)._shared;
let restore: (() => void) | undefined;
const install = (key: string, value: unknown) => {
  const before = shared[key];
  shared[key] = value;
  restore = () => {
    shared[key] = before;
  };
};
afterEach(() => {
  restore?.();
  restore = undefined;
  vi.restoreAllMocks();
});

describe("#311 current control invariants (no speculative production change)", () => {
  it.each(commands)(
    "attempts $command for an offline-flagged single light",
    async ({ command, method, value }) => {
      const repository = repo();
      const service = new LightControlService(
        repository as unknown as ILightRepository,
      );
      await service.controlLight(light(), command, value);
      expect(repository[method]).toHaveBeenCalledOnce();
    },
  );
  it.each(commands)(
    "attempts every offline-flagged group member for $command",
    async ({ command, method, value }) => {
      const repository = repo();
      const service = new LightControlService(
        repository as unknown as ILightRepository,
      );
      const group = LightGroup.create("g1", "Desk group", [
        light(),
        light("dev-2"),
      ]);
      expect(await service.controlGroup(group, command, value)).toEqual({
        total: 2,
        failed: [],
      });
      expect(repository[method]).toHaveBeenCalledTimes(2);
    },
  );
  it("preserves successful member updates when another offline-flagged member rejects", async () => {
    const repository = repo();
    const reached = light();
    const missed = light("dev-2");
    repository.setPower.mockImplementation(async (item) => {
      if (item === missed) throw new Error("API rejection");
    });
    const service = new LightControlService(
      repository as unknown as ILightRepository,
    );
    const outcome = await service.controlGroup(
      LightGroup.create("g1", "Desk group", [reached, missed]),
      "on",
    );
    expect(outcome.total).toBe(2);
    expect(outcome.failed[0]?.light).toBe(missed);
    expect(reached.isOn).toBe(true);
    expect(missed.isOn).toBe(false);
  });
  it("applies advanced operations to every member without an online gate", async () => {
    const group = LightGroup.create("g1", "Desk group", [
      light(),
      light("dev-2"),
    ]);
    const apply = vi.fn().mockResolvedValue(undefined);
    expect(
      await new ActionServices().applyToTarget(
        { type: "group", group },
        "Scene",
        apply,
      ),
    ).toEqual({ total: 2, failed: [] });
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it("resolves the saved selection using stale discovery data after a cloud failure", async () => {
    const discoverDevices = vi.fn().mockResolvedValue({
      lights: [
        {
          deviceId: "dev-1",
          model: "H619A",
          name: "Desk",
          controllable: true,
          supportedCommands: ["Power", "Brightness"],
        },
      ],
    });
    const service = new DeviceService({
      discoverDevices,
    } as unknown as TransportOrchestrator);
    await service.discover();
    discoverDevices.mockRejectedValue(new Error("network unavailable"));
    install("deviceService", service);
    const target = await new ActionServices().resolveTarget(
      { selectedDeviceId: "dev-1|H619A" },
      true,
    );
    expect(target?.light?.deviceId).toBe("dev-1");
    expect(discoverDevices).toHaveBeenCalledTimes(2);
  });
  it("diagnoses a model mismatch using allowlisted fields without serializing secret settings", async () => {
    install("deviceService", {
      discover: vi.fn().mockResolvedValue([
        {
          deviceId: "dev-1",
          model: "H607C",
          name: "Desk",
          controllable: true,
        },
      ]),
    });
    expect(
      await new ActionServices().resolveTarget({
        selectedDeviceId: "dev-1|H619A",
        apiKey: "secret-api-key",
        authToken: "secret-token",
      }),
    ).toBeNull();
    expect(streamDeck.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("selected device model differs from discovery"),
      expect.objectContaining({
        wantDeviceId: "dev-1",
        wantModel: "H619A",
        matchingDeviceModels: ["H607C"],
      }),
    );
    const logs = JSON.stringify(vi.mocked(streamDeck.logger.warn).mock.calls);
    expect(logs).not.toContain("secret-api-key");
    expect(logs).not.toContain("secret-token");
  });
});
