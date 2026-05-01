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

/**
 * Lightweight descriptor for cloud-side group entries that the plugin
 * cannot control via the Govee API (BaseGroup, SameModelGroup,
 * SameModeGroup). Exposed alongside `lights` so the PI can render them
 * disabled with an explanation, instead of silently filtering them and
 * leaving users wondering why their Govee app groups don't show up.
 */
export interface UnsupportedDevice {
  deviceId: string;
  model: string;
  name: string;
}

export interface DeviceDiscoveryResult {
  lights: LightItem[];
  /** Cloud groups returned by Govee that we deliberately do not control. */
  unsupportedDevices?: UnsupportedDevice[];
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
