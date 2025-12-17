import { EventEmitter } from "node:events";

import type { LightItem } from "@shared/types";
import type { ITransport, TransportMap } from "./ITransport";
import {
  ControlCommand,
  DeviceDiscoveryResult,
  DeviceStateResult,
  NoHealthyTransportError,
  TransportHealth,
  TransportKind,
} from "./types";

export interface TransportEvents {
  "transport:health": TransportHealth;
}

export class TransportOrchestrator {
  private readonly transports: TransportMap;
  private readonly health = new Map<TransportKind, TransportHealth>();
  private readonly emitter = new EventEmitter();

  constructor(transports: TransportMap) {
    this.transports = transports;
  }

  on<TEvent extends keyof TransportEvents>(
    event: TEvent,
    listener: (payload: TransportEvents[TEvent]) => void,
  ): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  async discoverDevices(): Promise<DeviceDiscoveryResult> {
    const results = await Promise.all(
      Object.values(this.transports)
        .filter((transport): transport is ITransport => Boolean(transport))
        .map(async (transport) => transport.discoverDevices()),
    );

    const lights = new Map<string, LightItem>();
    for (const result of results) {
      for (const light of result.lights) {
        lights.set(`${light.deviceId}|${light.model}`, light);
      }
    }

    return {
      lights: Array.from(lights.values()),
      stale: results.every((result) => result.stale),
    };
  }

  async getLightState(
    deviceId: string,
    model: string,
  ): Promise<DeviceStateResult> {
    const transport = await this.resolveTransport({ deviceId, model });
    return transport.getLightState(deviceId, model);
  }

  async sendCommand(command: ControlCommand): Promise<void> {
    const transport = await this.resolveTransport({
      deviceId: command.deviceId,
      model: command.model,
    });
    await transport.sendCommand(command);
  }

  async refreshHealth(): Promise<void> {
    await Promise.all(
      Object.entries(this.transports).map(async ([kind, transport]) => {
        if (!transport) return;
        const status = await transport.checkHealth();
        this.health.set(kind as TransportKind, status);
        this.emitter.emit("transport:health", status);
      }),
    );
  }

  getHealthSnapshot(): TransportHealth[] {
    return Array.from(this.health.values());
  }

  private async resolveTransport(device: {
    deviceId: string;
    model: string;
  }): Promise<ITransport> {
    const candidates = await Promise.all(
      Object.entries(this.transports).map(async ([kind, transport]) => {
        if (!transport) return null;
        const supports = await transport.supports(device);
        if (!supports) return null;
        const health = this.health.get(kind as TransportKind);
        return { transport, health } as const;
      }),
    );

    const available: Array<{
      transport: ITransport;
      health?: TransportHealth;
    }> = [];
    for (const candidate of candidates) {
      if (candidate) {
        available.push(candidate);
      }
    }

    available.sort(
      (a, b) => this.scoreHealth(a.health) - this.scoreHealth(b.health),
    );

    if (!available.length) {
      throw new NoHealthyTransportError(Array.from(this.health.values()));
    }

    return available[0].transport;
  }

  private scoreHealth(health?: TransportHealth): number {
    if (!health) return Number.POSITIVE_INFINITY;
    if (!health.isHealthy) return Number.POSITIVE_INFINITY - 1;
    return typeof health.latencyMs === "number" ? health.latencyMs : 0;
  }
}
