import {
  LAN_CONTROL_PORT,
  LAN_MULTICAST_ADDRESS,
  LAN_SCAN_PORT,
  SCAN_MESSAGE,
  STATUS_MESSAGE,
  parseLanMessage,
  type LanStatusReply,
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
      reason:
        | "not-started"
        | "disabled"
        | "port-in-use"
        | "network-blocked"
        | "error";
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
  /**
   * The LAN port is held only while it is in use: the socket closes after
   * this long without traffic and reopens on demand, so another Govee app
   * on the same computer can use the port in between.
   */
  idleMs?: number;
  /** After the socket failed to open, wait this long before trying again. */
  portRetryMs?: number;
  now?: () => number;
  logger: Logger;
}

/** Scan packets per scan, spread across the reply window. */
const SCAN_REPEATS = 3;

const BLOCKED = new Set([
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EADDRNOTAVAIL",
  "EACCES",
  "EPERM",
]);

/**
 * Which lights answer on the local network, and at which address. Any
 * failure (port taken, permission denied, firewall) leaves the registry
 * empty with a status saying why, so callers fall back to the cloud.
 */
export class LanDeviceRegistry {
  private readonly devices = new Map<string, LanDevice>();
  private readonly replyWindowMs: number;
  private readonly maxAgeMs: number;
  private readonly idleMs: number;
  private readonly portRetryMs: number;
  private readonly now: () => number;
  private readonly logger: Logger;
  private current: LanStatus = { available: false, reason: "not-started" };
  private enabled = true;
  private isOpen = false;
  private opening?: Promise<boolean>;
  private lastOpenFailure = -Infinity;
  private idleTimer?: NodeJS.Timeout;
  /** Scans and status reads that still need the socket open. */
  private inFlight = 0;
  /** Status requests waiting for a reply, by the light's address. */
  private readonly pending = new Map<
    string,
    ((reply: LanStatusReply) => void)[]
  >();

  constructor(
    private readonly socket: LanSocketPort,
    options: Options,
  ) {
    this.replyWindowMs = options.replyWindowMs ?? 2_000;
    this.maxAgeMs = options.maxAgeMs ?? 30 * 60_000;
    this.idleMs = options.idleMs ?? 30_000;
    this.portRetryMs = options.portRetryMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.logger = options.logger;
  }

  get status(): LanStatus {
    return this.current;
  }

  /** Enables LAN and opens the socket; false (logged once) when it can't be. */
  async start(): Promise<boolean> {
    this.enabled = true;
    return this.ensureOpen();
  }

  /** Turns LAN off: closes the socket and forgets every light. */
  disable(): void {
    this.enabled = false;
    this.closeSocket();
    this.devices.clear();
    this.current = { available: false, reason: "disabled" };
  }

  /** Sends one scan and returns the lights that answered within the window. */
  async scan(): Promise<(LanDevice & { device: string })[]> {
    if (!(await this.ensureOpen())) return [];
    this.inFlight++;
    try {
      return await this.runScan();
    } finally {
      this.inFlight--;
      this.touch();
    }
  }

  private async runScan(): Promise<(LanDevice & { device: string })[]> {
    const started = this.now();
    // UDP has no delivery guarantee and a single scan missed a light on
    // hardware (2026-10-25), so the scan is repeated within the window.
    const gap = this.replyWindowMs / SCAN_REPEATS;
    for (let attempt = 0; attempt < SCAN_REPEATS; attempt++) {
      try {
        await this.socket.send(
          SCAN_MESSAGE,
          LAN_MULTICAST_ADDRESS,
          LAN_SCAN_PORT,
        );
      } catch (error) {
        this.markFailure(error);
        return [];
      }
      if (!this.current.available) {
        this.logger.info("lan.available", { after: this.current.reason });
        this.current = { available: true };
      }
      await new Promise((resolve) => setTimeout(resolve, gap));
    }
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

  /**
   * The light's current state, asked directly over the local network; null
   * when the light isn't known here or doesn't answer in time. Status
   * replies carry no device id, so they are matched by address.
   */
  async requestStatus(
    deviceId: string,
    timeoutMs = 800,
  ): Promise<LanStatusReply | null> {
    const device = this.get(deviceId);
    if (!device || !(await this.ensureOpen())) return null;
    this.inFlight++;
    return new Promise((resolve) => {
      const waiting = this.pending.get(device.ip) ?? [];
      const settle = (reply: LanStatusReply | null) => {
        clearTimeout(timer);
        this.inFlight--;
        this.touch();
        const list = this.pending.get(device.ip) ?? [];
        const rest = list.filter((entry) => entry !== settle);
        if (rest.length) this.pending.set(device.ip, rest);
        else this.pending.delete(device.ip);
        resolve(reply);
      };
      const timer = setTimeout(() => settle(null), timeoutMs);
      this.pending.set(device.ip, [...waiting, settle]);
      this.socket
        .send(STATUS_MESSAGE, device.ip, LAN_CONTROL_PORT)
        .catch(() => settle(null));
    });
  }

  /**
   * Sends commands to the light in order; false when it isn't known here
   * or a send fails, so the caller can use the cloud. Delivery isn't
   * confirmed: UDP has no acknowledgement.
   */
  async sendCommands(deviceId: string, messages: string[]): Promise<boolean> {
    const device = this.get(deviceId);
    if (!device || !(await this.ensureOpen())) return false;
    try {
      for (const message of messages)
        await this.socket.send(message, device.ip, LAN_CONTROL_PORT);
      this.touch();
      return true;
    } catch {
      return false;
    }
  }

  get(deviceId: string): LanDevice | undefined {
    return this.devices.get(deviceId.toUpperCase());
  }

  stop(): void {
    this.enabled = false;
    this.closeSocket();
    this.current = { available: false, reason: "not-started" };
  }

  /** Opens the socket if it isn't open; false when LAN can't be used now. */
  private ensureOpen(): Promise<boolean> {
    if (!this.enabled) return Promise.resolve(false);
    if (this.isOpen) {
      this.touch();
      return Promise.resolve(true);
    }
    if (this.now() - this.lastOpenFailure < this.portRetryMs)
      return Promise.resolve(false);
    this.opening ??= this.openSocket().finally(() => {
      this.opening = undefined;
    });
    return this.opening;
  }

  private async openSocket(): Promise<boolean> {
    try {
      await this.socket.open((message, from) => this.receive(message, from));
    } catch (error) {
      this.lastOpenFailure = this.now();
      this.markFailure(error);
      return false;
    }
    this.isOpen = true;
    this.current = { available: true };
    this.touch();
    return true;
  }

  /** Restarts the idle clock: the socket closes when nothing uses it. */
  private touch(): void {
    clearTimeout(this.idleTimer);
    if (!this.isOpen || !Number.isFinite(this.idleMs)) return;
    this.idleTimer = setTimeout(() => this.release(), this.idleMs);
    this.idleTimer.unref?.();
  }

  private release(): void {
    if (this.inFlight > 0) return this.touch();
    this.closeSocket();
  }

  private closeSocket(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    this.socket.close();
    this.isOpen = false;
  }

  private receive(message: string, from: string): void {
    const parsed = parseLanMessage(message);
    if (parsed?.cmd === "devStatus") {
      // Copy: each settle removes itself from the list.
      for (const settle of [...(this.pending.get(from) ?? [])])
        settle(parsed.data);
      return;
    }
    if (parsed?.cmd !== "scan") return;
    const { device, ip, sku } = parsed.data;
    this.devices.set(device.toUpperCase(), { ip, sku, lastSeen: this.now() });
  }

  private markFailure(error: unknown): void {
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
    // A blocked network is often temporary, so known lights are kept (they
    // expire by maxAgeMs); a socket that couldn't open knows nothing.
    if (reason === "port-in-use") this.devices.clear();
    this.logger.warn("lan.unavailable", { reason, code });
  }
}
