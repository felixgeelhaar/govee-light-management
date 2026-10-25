import { streamDeck } from "@elgato/streamdeck";
import {
  LanDeviceRegistry,
  type LanStatus,
} from "../infrastructure/lan/LanDeviceRegistry";
import { DgramLanSocket } from "../infrastructure/lan/LanSocket";
import type { LanStatusReply } from "../infrastructure/lan/LanProtocol";

export type LightConnection =
  | { type: "lan"; ip: string }
  | {
      type: "cloud";
      reason: "not-found" | Extract<LanStatus, { available: false }>["reason"];
    };

type Registry = Pick<
  LanDeviceRegistry,
  | "start"
  | "scan"
  | "stop"
  | "get"
  | "status"
  | "requestStatus"
  | "sendCommands"
>;

/** Matches the device inventory's idle refresh: a list up to 10 min old. */
const SCAN_INTERVAL_MS = 10 * 60_000;
/** A light not found yet triggers at most one extra scan per minute. */
const RESCAN_GAP_MS = 60_000;

/**
 * Finds lights that answer Govee's LAN API, reads their state and sends
 * them commands (phases 1–3 of docs/design/lan-control.md).
 */
export class LanDiscovery {
  private timer?: NodeJS.Timeout;
  private lastScan = 0;

  constructor(private readonly registry: Registry) {}

  async start(): Promise<void> {
    if (!(await this.registry.start())) return;
    await this.scan();
    this.timer = setInterval(() => void this.scan(), SCAN_INTERVAL_MS);
    this.timer.unref?.();
  }

  async shutdown(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    this.registry.stop();
  }

  /**
   * How the plugin can reach a light. An unknown light gets one fresh scan
   * (at most once a minute), so turning on LAN Control in the Govee app
   * shows up without waiting for the next periodic scan.
   */
  async connectionFor(deviceId: string): Promise<LightConnection> {
    const status = this.registry.status;
    if (!status.available) return { type: "cloud", reason: status.reason };
    let device = this.registry.get(deviceId);
    if (!device && Date.now() - this.lastScan > RESCAN_GAP_MS) {
      await this.scan();
      device = this.registry.get(deviceId);
    }
    return device
      ? { type: "lan", ip: device.ip }
      : { type: "cloud", reason: "not-found" };
  }

  /** Whether this light answered the LAN scan with this model. */
  knows(deviceId: string, model: string): boolean {
    return this.registry.get(deviceId)?.sku === model;
  }

  /** The light's state over the local network, or null to use the cloud. */
  readStatus(deviceId: string): Promise<LanStatusReply | null> {
    return this.registry.requestStatus(deviceId);
  }

  /** Sends commands over the local network; false to use the cloud. */
  sendCommands(deviceId: string, messages: string[]): Promise<boolean> {
    return this.registry.sendCommands(deviceId, messages);
  }

  private async scan(): Promise<void> {
    this.lastScan = Date.now();
    await this.registry.scan();
  }
}

export const lanDiscovery = new LanDiscovery(
  new LanDeviceRegistry(new DgramLanSocket(), { logger: streamDeck.logger }),
);
