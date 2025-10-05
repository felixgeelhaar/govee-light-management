import { describe, it, expect, beforeEach, vi } from "vitest";
import { TransportOrchestrator } from "@/backend/connectivity/TransportOrchestrator";
import type {
  ITransport,
  TransportMap,
} from "@/backend/connectivity/ITransport";
import type {
  DeviceDiscoveryResult,
  TransportHealth,
} from "@/backend/connectivity/types";
import { NoHealthyTransportError, TransportKind } from "@/backend/connectivity/types";

const createTransport = (
  kind: TransportKind | (string & {}),
  overrides: Partial<ITransport> = {},
): ITransport => ({
  descriptor: {
    kind: kind as TransportKind,
    label: `${String(kind)} transport`,
    priority: 1,
  },
  checkHealth: vi.fn(),
  discoverDevices: vi.fn(),
  getLightState: vi.fn(),
  sendCommand: vi.fn(),
  supports: vi.fn(),
  ...overrides,
});

describe("TransportOrchestrator", () => {
  let primary: ITransport;
  let secondary: ITransport;
  let orchestrator: TransportOrchestrator;

  beforeEach(() => {
    primary = createTransport(TransportKind.Cloud);
    secondary = createTransport("local" as TransportKind);

    const transports = {
      [TransportKind.Cloud]: primary,
      local: secondary,
    } as unknown as TransportMap;

    orchestrator = new TransportOrchestrator(transports);
  });

  it("merges discovery results across transports without duplicates", async () => {
    const lightA = {
      deviceId: "dev-1",
      model: "H6001",
      name: "Living Room",
      label: "Living Room",
      value: "dev-1|H6001",
      controllable: true,
      retrievable: true,
      supportedCommands: [],
    };
    const lightB = {
      deviceId: "dev-2",
      model: "H6002",
      name: "Kitchen",
      label: "Kitchen",
      value: "dev-2|H6002",
      controllable: true,
      retrievable: true,
      supportedCommands: [],
    };
    const lightBOverride = { ...lightB, label: "Kitchen (LAN)" };

    (primary.discoverDevices as any).mockResolvedValue({
      lights: [lightA, lightB],
      stale: false,
    } satisfies DeviceDiscoveryResult);
    (secondary.discoverDevices as any).mockResolvedValue({
      lights: [lightBOverride],
      stale: true,
    } satisfies DeviceDiscoveryResult);

    const result = await orchestrator.discoverDevices();

    expect(result.lights).toHaveLength(2);
    const kitchen = result.lights.find((light) => light.deviceId === "dev-2");
    expect(kitchen?.label).toBe("Kitchen (LAN)");
    expect(result.stale).toBe(false);
  });

  it("refreshes transport health and exposes snapshots", async () => {
    const healthPrimary: TransportHealth = {
      descriptor: primary.descriptor,
      isHealthy: true,
      lastChecked: Date.now(),
      latencyMs: 40,
    };
    const healthSecondary: TransportHealth = {
      descriptor: secondary.descriptor,
      isHealthy: false,
      lastChecked: Date.now(),
      latencyMs: 100,
      error: new Error("offline"),
    };

    (primary.checkHealth as any).mockResolvedValue(healthPrimary);
    (secondary.checkHealth as any).mockResolvedValue(healthSecondary);

    const listener = vi.fn();
    orchestrator.on("transport:health", listener);

    await orchestrator.refreshHealth();

    expect(listener).toHaveBeenCalledTimes(2);
    const snapshot = orchestrator.getHealthSnapshot();
    expect(snapshot).toContainEqual(healthPrimary);
    expect(snapshot).toContainEqual(healthSecondary);
  });

  it("delegates commands to a supporting transport", async () => {
    (primary.supports as any).mockResolvedValue(false);
    (secondary.supports as any).mockResolvedValue(true);
    (secondary.sendCommand as any).mockResolvedValue(undefined);
    (primary.checkHealth as any).mockResolvedValue({
      descriptor: primary.descriptor,
      isHealthy: false,
      lastChecked: Date.now(),
    });

    // Seed health information so orchestrator considers transports
    (secondary.checkHealth as any).mockResolvedValue({
      descriptor: secondary.descriptor,
      isHealthy: true,
      lastChecked: Date.now(),
    });
    await orchestrator.refreshHealth();

    await orchestrator.sendCommand({
      deviceId: "dev-1",
      model: "H6001",
      command: "power",
    });

    expect(secondary.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("throws when no transport supports the requested device", async () => {
    (primary.supports as any).mockResolvedValue(false);
    (secondary.supports as any).mockResolvedValue(false);
    (primary.checkHealth as any).mockResolvedValue({
      descriptor: primary.descriptor,
      isHealthy: false,
      lastChecked: Date.now(),
    });
    (secondary.checkHealth as any).mockResolvedValue({
      descriptor: secondary.descriptor,
      isHealthy: false,
      lastChecked: Date.now(),
    });

    await orchestrator.refreshHealth();

    await expect(
      orchestrator.getLightState("dev-404", "unknown"),
    ).rejects.toBeInstanceOf(NoHealthyTransportError);
  });
});
