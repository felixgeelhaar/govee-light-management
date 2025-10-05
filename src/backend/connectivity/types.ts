import type { LightItem, LightState } from "@shared/types";

export enum TransportKind {
  Cloud = "cloud",
}

export interface TransportDescriptor {
  kind: TransportKind;
  label: string;
  priority: number;
}

export interface TransportHealth {
  descriptor: TransportDescriptor;
  isHealthy: boolean;
  lastChecked: number;
  latencyMs?: number;
  error?: Error;
}

export interface DeviceDiscoveryResult {
  lights: LightItem[];
  stale?: boolean;
}

export interface DeviceStateResult {
  state: LightState;
  transport: TransportKind;
}

export interface ControlCommand {
  deviceId: string;
  model: string;
  command: string;
  payload?: Record<string, unknown>;
}

export class NoHealthyTransportError extends Error {
  constructor(public readonly attempted: TransportHealth[]) {
    super("No healthy transport available for the requested operation");
    this.name = "NoHealthyTransportError";
  }
}
