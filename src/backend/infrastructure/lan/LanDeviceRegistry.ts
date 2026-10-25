import {
  LAN_MULTICAST_ADDRESS,
  LAN_SCAN_PORT,
  SCAN_MESSAGE,
  parseLanMessage,
} from "./LanProtocol";
import type { LanSocketPort } from "./LanSocket";

export interface LanDevice {
  ip: string;
  sku: string;
  /** Epoch ms of the last scan reply. */
  lastSeen: number;
}

export type LanStatus =
  | { available: true }
  | {
      available: false;
      reason: "not-started" | "port-in-use" | "network-blocked" | "error";
    };

interface Logger {
  info(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
}

interface Options {
  /** How long a scan collects replies. */
  replyWindowMs?: number;
  /** A light that hasn't answered for this long is forgotten. */
  maxAgeMs?: number;
  now?: () => number;
  logger: Logger;
}

const BLOCKED = new Set(["EHOSTUNREACH", "ENETUNREACH", "EACCES", "EPERM"]);

/**
 * Which lights answer on the local network, and at which address. Any
 * failure (port taken, permission denied, firewall) leaves the registry
 * empty with a status saying why, so callers fall back to the cloud.
 */
export class LanDeviceRegistry {
  private readonly devices = new Map<string, LanDevice>();
  private readonly replyWindowMs: number;
  private readonly maxAgeMs: number;
  private readonly now: () => number;
  private readonly logger: Logger;
  private current: LanStatus = { available: false, reason: "not-started" };

  constructor(
    private readonly socket: LanSocketPort,
    options: Options,
  ) {
    this.replyWindowMs = options.replyWindowMs ?? 2_000;
    this.maxAgeMs = options.maxAgeMs ?? 30 * 60_000;
    this.now = options.now ?? Date.now;
    this.logger = options.logger;
  }

  get status(): LanStatus {
    return this.current;
  }

  /** Opens the socket; false (and logged once) when LAN can't be used. */
  async start(): Promise<boolean> {
    try {
      await this.socket.open((message) => this.receive(message));
      this.current = { available: true };
      return true;
    } catch (error) {
      this.disable(error);
      return false;
    }
  }

  /** Sends one scan and returns the lights that answered within the window. */
  async scan(): Promise<(LanDevice & { device: string })[]> {
    if (!this.current.available) return [];
    const started = this.now();
    try {
      await this.socket.send(
        SCAN_MESSAGE,
        LAN_MULTICAST_ADDRESS,
        LAN_SCAN_PORT,
      );
    } catch (error) {
      this.disable(error);
      return [];
    }
    await new Promise((resolve) => setTimeout(resolve, this.replyWindowMs));
    for (const [id, device] of this.devices)
      if (this.now() - device.lastSeen > this.maxAgeMs) this.devices.delete(id);
    const found = [...this.devices]
      .filter(([, device]) => device.lastSeen >= started)
      .map(([device, entry]) => ({ device, ...entry }));
    this.logger.info("lan.discover", {
      found: found.length,
      known: this.devices.size,
      durationMs: this.now() - started,
      lights: found.map(({ device, sku }) => `${device}|${sku}`),
    });
    return found;
  }

  get(deviceId: string): LanDevice | undefined {
    return this.devices.get(deviceId.toUpperCase());
  }

  stop(): void {
    this.socket.close();
    this.current = { available: false, reason: "not-started" };
  }

  private receive(message: string): void {
    const parsed = parseLanMessage(message);
    if (parsed?.cmd !== "scan") return;
    const { device, ip, sku } = parsed.data;
    this.devices.set(device.toUpperCase(), { ip, sku, lastSeen: this.now() });
  }

  private disable(error: unknown): void {
    const code = (error as NodeJS.ErrnoException)?.code ?? "";
    const reason =
      code === "EADDRINUSE"
        ? "port-in-use"
        : BLOCKED.has(code)
          ? "network-blocked"
          : "error";
    if (this.current.available === false && this.current.reason === reason)
      return;
    this.current = { available: false, reason };
    this.devices.clear();
    this.logger.warn("lan.unavailable", { reason, code });
  }
}
