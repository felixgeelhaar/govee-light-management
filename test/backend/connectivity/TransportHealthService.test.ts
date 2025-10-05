import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TransportHealthService } from "@/backend/connectivity/TransportHealthService";
import type { TransportHealth } from "@/backend/connectivity/types";
import { telemetryService } from "@/backend/services/TelemetryService";

const createHealth = (overrides: Partial<TransportHealth> = {}): TransportHealth => ({
  descriptor: {
    kind: "cloud",
    label: "Cloud",
    priority: 1,
  },
  isHealthy: true,
  lastChecked: Date.now(),
  ...overrides,
});

describe("TransportHealthService", () => {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const orchestrator = {
    refreshHealth: vi.fn<[], Promise<void>>(),
    getHealthSnapshot: vi.fn<[], TransportHealth[]>(),
  };
  let telemetrySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    telemetryService.reset();
    vi.clearAllMocks();
    telemetrySpy = vi.spyOn(telemetryService, "recordTransportHealth");
    orchestrator.refreshHealth.mockResolvedValue(undefined);
    orchestrator.getHealthSnapshot.mockReturnValue([createHealth()]);
  });

  afterEach(() => {
    telemetrySpy.mockRestore();
  });

  it("refreshes health and caches snapshots", async () => {
    const service = new TransportHealthService(orchestrator as any, logger);

    const first = await service.getHealth();
    expect(first).toHaveLength(1);
    expect(orchestrator.refreshHealth).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("transport.health.refresh", expect.any(Object));
    expect(telemetrySpy).toHaveBeenCalledTimes(1);

    const second = await service.getHealth();
    expect(orchestrator.refreshHealth).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    const third = await service.getHealth(true);
    expect(orchestrator.refreshHealth).toHaveBeenCalledTimes(2);
    expect(third).toBe(first);
  });

  it("emits updates to listeners", async () => {
    const service = new TransportHealthService(orchestrator as any, logger);
    const listener = vi.fn();

    service.on(listener);
    await service.getHealth(true);

    expect(listener).toHaveBeenCalledWith(expect.any(Array));
  });

  it("logs failures and records telemetry when refresh fails", async () => {
    const error = new Error("health failed");
    orchestrator.refreshHealth.mockRejectedValueOnce(error);
    orchestrator.getHealthSnapshot.mockReturnValue([createHealth({ isHealthy: false })]);

    const service = new TransportHealthService(orchestrator as any, logger);
    const snapshot = await service.getHealth(true);

    expect(logger.warn).toHaveBeenCalledWith("transport.health.refresh_failed", {
      name: "Error",
      message: "health failed",
    });
    expect(snapshot[0].isHealthy).toBe(false);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      {
        name: "Error",
        message: "health failed",
      },
    );
  });
});
