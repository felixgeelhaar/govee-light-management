import { describe, it, expect, beforeEach } from "vitest";
import { telemetryService } from "@/backend/services/TelemetryService";

describe("TelemetryService", () => {
  beforeEach(() => {
    telemetryService.reset();
  });

  it("records transport health snapshots and failures", () => {
    telemetryService.recordTransportHealth(
      [
        {
          kind: "cloud",
          label: "Cloud API",
          isHealthy: true,
          latencyMs: 120,
          lastChecked: Date.now(),
        },
      ],
      45,
    );

    let snapshot = telemetryService.getSnapshot();
    expect(snapshot.transport.checks).toBe(1);
    expect(snapshot.transport.lastDurationMs).toBe(45);
    expect(snapshot.transport.lastSnapshot).toHaveLength(1);
    expect(snapshot.transport.lastFailure).toBeUndefined();

    telemetryService.recordTransportHealth(
      [
        {
          kind: "cloud",
          label: "Cloud API",
          isHealthy: false,
        },
      ],
      60,
      { name: "TimeoutError", message: "Request timed out" },
    );

    snapshot = telemetryService.getSnapshot();
    expect(snapshot.transport.checks).toBe(2);
    expect(snapshot.transport.lastDurationMs).toBe(60);
    expect(snapshot.transport.lastSnapshot[0].isHealthy).toBe(false);
    expect(snapshot.transport.lastFailure).toEqual({
      name: "TimeoutError",
      message: "Request timed out",
    });
  });

  it("tracks discovery performance and stale responses", () => {
    telemetryService.recordDiscovery({
      durationMs: 120,
      count: 4,
      stale: false,
    });

    telemetryService.recordDiscovery({
      durationMs: 80,
      count: 2,
      stale: true,
    });

    const snapshot = telemetryService.getSnapshot();
    expect(snapshot.discovery.total).toBe(2);
    expect(snapshot.discovery.stale).toBe(1);
    expect(snapshot.discovery.totalDurationMs).toBe(200);
    expect(snapshot.discovery.lastDurationMs).toBe(80);
    expect(snapshot.discovery.lastCount).toBe(2);
  });

  it("aggregates command metrics and captures failures", () => {
    telemetryService.recordCommand({
      command: "power",
      durationMs: 50,
      success: true,
    });

    telemetryService.recordCommand({
      command: "power",
      durationMs: 70,
      success: false,
      error: { name: "ApiError", message: "Something went wrong" },
    });

    telemetryService.recordCommand({
      command: "color",
      durationMs: 30,
      success: true,
    });

    const snapshot = telemetryService.getSnapshot();
    expect(snapshot.commands.total).toBe(3);
    expect(snapshot.commands.failures).toBe(1);
    expect(snapshot.commands.totalDurationMs).toBe(150);
    expect(snapshot.commands.byCommand.power.total).toBe(2);
    expect(snapshot.commands.byCommand.power.failures).toBe(1);
    expect(snapshot.commands.byCommand.power.lastError).toEqual({
      name: "ApiError",
      message: "Something went wrong",
    });
    expect(snapshot.commands.byCommand.color.total).toBe(1);
    expect(snapshot.commands.byCommand.color.failures).toBe(0);
  });

  it("returns defensive snapshot copies and resets state", () => {
    telemetryService.recordTransportHealth(
      [
        {
          kind: "cloud",
          label: "Cloud API",
          isHealthy: true,
        },
      ],
      25,
    );

    const snapshot = telemetryService.getSnapshot();
    snapshot.transport.lastSnapshot.push({
      kind: "mutation",
      label: "Mutation",
      isHealthy: false,
    });

    const nextSnapshot = telemetryService.getSnapshot();
    expect(nextSnapshot.transport.lastSnapshot).toHaveLength(1);

    telemetryService.reset();
    const resetSnapshot = telemetryService.getSnapshot();
    expect(resetSnapshot.transport.checks).toBe(0);
    expect(resetSnapshot.discovery.total).toBe(0);
    expect(resetSnapshot.commands.total).toBe(0);
  });
});
