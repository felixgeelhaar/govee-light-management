import type { LightItem, LightState } from "@shared/types";
import type {
  ControlCommand,
  DeviceDiscoveryResult,
  DeviceStateResult,
  TransportDescriptor,
  TransportHealth,
  TransportKind,
} from "./types";

export interface ITransport {
  readonly descriptor: TransportDescriptor;

  checkHealth(): Promise<TransportHealth>;
  discoverDevices(): Promise<DeviceDiscoveryResult>;
  getLightState(deviceId: string, model: string): Promise<DeviceStateResult>;
  sendCommand(command: ControlCommand): Promise<void>;
  supports(device: Pick<LightItem, "deviceId" | "model">): Promise<boolean>;
  subscribe?(
    deviceId: string,
    model: string,
    onState: (state: LightState) => void,
  ): () => void;
}

export type TransportMap = Record<TransportKind, ITransport | undefined>;
