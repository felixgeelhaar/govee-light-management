import { EventEmitter } from "node:events";

import type { TransportOrchestrator } from "./TransportOrchestrator";
import type { TransportHealth } from "./types";
import { telemetryService } from "../services/TelemetryService";

interface Logger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

export class TransportHealthService {
  private cache: { expiresAt: number; data: TransportHealth[] } | null = null;
  private inFlight: Promise<TransportHealth[]> | null = null;
  private readonly emitter = new EventEmitter();
  private readonly cacheTtl: number;

  constructor(
    private readonly orchestrator: TransportOrchestrator,
    private readonly logger?: Logger,
    options: { cacheTtlMs?: number } = {},
  ) {
    this.cacheTtl = options.cacheTtlMs ?? 10_000;
  }

  on(listener: (snapshot: TransportHealth[]) => void): () => void {
    this.emitter.on("health", listener);
    return () => this.emitter.off("health", listener);
  }

  async getHealth(forceRefresh = false): Promise<TransportHealth[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cache.expiresAt) {
      return this.cache.data;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.refresh();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async refresh(): Promise<TransportHealth[]> {
    const started = Date.now();
    let failure: { name: string; message: string } | undefined;

    try {
      await this.orchestrator.refreshHealth();
    } catch (error) {
      failure =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: String(error) };
      this.logger?.warn?.("transport.health.refresh_failed", failure);
    }

    const snapshot = this.orchestrator.getHealthSnapshot();
    this.cache = {
      data: snapshot,
      expiresAt: Date.now() + this.cacheTtl,
    };

    const durationMs = Date.now() - started;
    this.emitter.emit("health", snapshot);
    this.logger?.info?.("transport.health.refresh", {
      durationMs,
      transports: snapshot.map((health) => ({
        kind: health.descriptor.kind,
        label: health.descriptor.label,
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
      })),
    });

    telemetryService.recordTransportHealth(
      snapshot.map((health) => ({
        kind: health.descriptor.kind,
        label: health.descriptor.label,
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
        lastChecked: health.lastChecked,
      })),
      durationMs,
      failure,
    );

    return snapshot;
  }
}
