import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  DeviceDiscoveryResult,
  DeviceStateResult,
} from "@/backend/connectivity/types";
import { DeviceService } from "@/backend/domain/services/DeviceService";
import { telemetryService } from "@/backend/services/TelemetryService";

const createOrchestratorMock = () => ({
  discoverDevices: vi.fn<[], Promise<DeviceDiscoveryResult>>(),
  getLightState: vi.fn<
    [string, string],
    Promise<DeviceStateResult>
  >(),
  sendCommand: vi.fn(),
});

describe("DeviceService", () => {
  beforeEach(() => {
    telemetryService.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("discovers lights, normalizes capabilities, and caches results", async () => {
    const orchestrator = createOrchestratorMock();
    orchestrator.discoverDevices.mockResolvedValue({
      lights: [
        {
          deviceId: "dev-1",
          model: "H6001",
          name: "Living Room",
          label: "Living Room",
          value: "dev-1|H6001",
          controllable: true,
          retrievable: true,
          supportedCommands: [
            "Power",
            "Brightness",
            "Color",
            "ColorTemperature",
            "Scene",
          ],
        },
      ],
      stale: false,
    });

    const service = new DeviceService(orchestrator as any, {
      cacheTtlMs: 1000,
    });

    const first = await service.discover();
    expect(orchestrator.discoverDevices).toHaveBeenCalledTimes(1);
    expect(first[0]?.capabilities).toEqual({
      power: true,
      brightness: true,
      color: true,
      colorTemperature: true,
      scenes: true,
    });

    // telemetry snapshot updated
    const snapshotAfterFirst = telemetryService.getSnapshot();
    expect(snapshotAfterFirst.discovery.total).toBe(1);
    expect(snapshotAfterFirst.discovery.lastCount).toBe(1);
    expect(snapshotAfterFirst.discovery.stale).toBe(0);

    // Cached call should not hit orchestrator
    const second = await service.discover();
    expect(orchestrator.discoverDevices).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    // Advance beyond TTL to force refresh
    vi.advanceTimersByTime(1001);
    const third = await service.discover();
    expect(orchestrator.discoverDevices).toHaveBeenCalledTimes(2);
    expect(third).toEqual(first);

    // Force refresh ignores cache
    await service.discover(true);
    expect(orchestrator.discoverDevices).toHaveBeenCalledTimes(3);
  });

  it("returns cached lights when available", () => {
    const orchestrator = createOrchestratorMock();
    const service = new DeviceService(orchestrator as any);

    expect(service.getCachedLights()).toBeNull();

    orchestrator.discoverDevices.mockResolvedValue({
      lights: [
        {
          deviceId: "dev-1",
          model: "H6001",
          name: "Living Room",
          label: "Living Room",
          value: "dev-1|H6001",
          controllable: true,
          retrievable: true,
          supportedCommands: [],
        },
      ],
    });

    return service.discover().then(() => {
      expect(service.getCachedLights()).not.toBeNull();
      service.clearCache();
      expect(service.getCachedLights()).toBeNull();
    });
  });

  it("delegates state lookups and propagates transport response", async () => {
    const orchestrator = createOrchestratorMock();
    const stateResult: DeviceStateResult = {
      transport: "cloud",
      state: {
        deviceId: "dev-1",
        model: "H6001",
        name: "Living Room",
        isOnline: true,
        powerState: true,
      },
    } as DeviceStateResult;
    orchestrator.getLightState.mockResolvedValue(stateResult);

    const service = new DeviceService(orchestrator as any);
    const result = await service.getLightState("dev-1", "H6001");

    expect(orchestrator.getLightState).toHaveBeenCalledWith("dev-1", "H6001");
    expect(result).toBe(stateResult);
  });

  it("records telemetry for commands and surfaces errors", async () => {
    const orchestrator = createOrchestratorMock();
    orchestrator.sendCommand.mockResolvedValue(undefined);

    const service = new DeviceService(orchestrator as any);
    await service.sendCommand({
      deviceId: "dev-1",
      model: "H6001",
      command: "power",
      payload: { value: true },
    });

    expect(orchestrator.sendCommand).toHaveBeenCalledTimes(1);
    let snapshot = telemetryService.getSnapshot();
    expect(snapshot.commands.byCommand.power.total).toBe(1);
    expect(snapshot.commands.byCommand.power.failures).toBe(0);

    orchestrator.sendCommand.mockRejectedValueOnce(new Error("Boom"));

    await expect(
      service.sendCommand({
        deviceId: "dev-1",
        model: "H6001",
        command: "power",
      }),
    ).rejects.toThrow("Boom");

    snapshot = telemetryService.getSnapshot();
    expect(snapshot.commands.byCommand.power.total).toBe(2);
    expect(snapshot.commands.byCommand.power.failures).toBe(1);
    expect(snapshot.commands.byCommand.power.lastError).toEqual({
      name: "Error",
      message: "Boom",
    });
  });
});
