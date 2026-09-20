import type { LightCapabilities, LightItem } from "@shared/types";

import {
  type ControlCommand,
  type DeviceStateResult,
  type UnsupportedDevice,
  TransportOrchestrator,
} from "../../connectivity";
import { telemetryService } from "../../services/TelemetryService";

interface Logger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

interface DeviceServiceOptions {
  logger?: Logger;
  cacheTtlMs?: number;
  discoveryTimeoutMs?: number;
}

interface CacheEntry {
  lights: LightItem[];
  unsupportedDevices: UnsupportedDevice[];
  expiresAt: number;
  stale: boolean;
}

const DEFAULT_TTL_MS = 30_000;

/**
 * A discovery that has not answered by now is not going to. The transport
 * issues a plain fetch with no AbortSignal, so without this a hung
 * connection stalls the caller — and the callers are the live-sync loops,
 * which then queue behind it tick after tick.
 */
const DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000;

export class DeviceService {
  private cache: CacheEntry | null = null;
  private inFlight: Promise<LightItem[]> | null = null;
  private readonly cacheTtl: number;
  private readonly discoveryTimeout: number;
  private readonly logger?: Logger;

  constructor(
    private readonly orchestrator: TransportOrchestrator,
    options: DeviceServiceOptions = {},
  ) {
    this.logger = options.logger;
    this.cacheTtl = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    this.discoveryTimeout =
      options.discoveryTimeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  }

  /**
   * The account's device list, cached for `cacheTtlMs`.
   *
   * Concurrent callers share one round trip. Discovery answers a question
   * about the account, not about the caller, and every visible key asks it:
   * the dial live-sync every 3s, the keypad tracker every 30s, and
   * `resolveTarget` on each cache miss. Without coalescing, the moment the
   * cache lapses each key issues its own request at a rate-limited API.
   *
   * A `forceRefresh` that arrives while a discovery is already running
   * joins it rather than starting a second: that request began after the
   * cache lapsed, so its answer is already the fresh one being asked for.
   */
  async discover(forceRefresh = false): Promise<LightItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cache.expiresAt) {
      return this.cache.lights;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const run = this.runDiscovery().finally(() => {
      // Identity-checked: only the run that installed itself may clear the
      // slot, so a later discovery's promise is never dropped by an
      // earlier one finishing.
      if (this.inFlight === run) {
        this.inFlight = null;
      }
    });
    this.inFlight = run;
    return run;
  }

  private async runDiscovery(): Promise<LightItem[]> {
    const now = Date.now();
    const started = Date.now();
    let result: Awaited<ReturnType<TransportOrchestrator["discoverDevices"]>>;
    try {
      result = await this.withDiscoveryTimeout(
        this.orchestrator.discoverDevices(),
      );
    } catch (error) {
      this.logger?.error?.("device.discover.failed", error);
      // Return cached data if available, otherwise empty
      if (this.cache) return this.cache.lights;
      return [];
    }
    const normalized = result.lights.map((light) => this.normalize(light));

    const durationMs = Date.now() - started;
    const stale = Boolean(result.stale);

    this.cache = {
      lights: normalized,
      unsupportedDevices: result.unsupportedDevices ?? [],
      expiresAt: now + this.cacheTtl,
      stale,
    };

    this.logger?.info?.("device.discover", {
      durationMs,
      total: normalized.length,
      stale,
    });

    telemetryService.recordDiscovery({
      durationMs,
      count: normalized.length,
      stale,
    });

    return normalized;
  }

  /**
   * Reject once `discoveryTimeout` elapses, so the caller takes the same
   * path a transport error takes: cached lights if there are any, an empty
   * list otherwise. The timer is always cleared, including on success.
   */
  private withDiscoveryTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const expiry = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Device discovery timed out after ${this.discoveryTimeout}ms`,
            ),
          ),
        this.discoveryTimeout,
      );
    });
    return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
  }

  getCachedLights(): LightItem[] | null {
    if (!this.cache) return null;
    if (Date.now() > this.cache.expiresAt) return null;
    return this.cache.lights;
  }

  /**
   * Cloud groups returned by Govee that the plugin deliberately does
   * not control (BaseGroup, SameModelGroup, SameModeGroup). Surfaced so
   * the PI can render them disabled with an explanation rather than
   * silently dropping them — see issues #161, #186, #188.
   */
  getCachedUnsupportedDevices(): UnsupportedDevice[] {
    if (!this.cache) return [];
    if (Date.now() > this.cache.expiresAt) return [];
    return this.cache.unsupportedDevices;
  }

  clearCache(): void {
    this.cache = null;
  }

  async getLightState(
    deviceId: string,
    model: string,
  ): Promise<DeviceStateResult> {
    return this.orchestrator.getLightState(deviceId, model);
  }

  async sendCommand(command: ControlCommand): Promise<void> {
    const started = Date.now();
    try {
      await this.orchestrator.sendCommand(command);
      const durationMs = Date.now() - started;
      telemetryService.recordCommand({
        command: command.command,
        durationMs,
        success: true,
      });
      this.logger?.info?.("device.command.execute", {
        durationMs,
        command: command.command,
        deviceId: command.deviceId,
        model: command.model,
      });
    } catch (error) {
      const durationMs = Date.now() - started;
      const failure =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: String(error) };

      telemetryService.recordCommand({
        command: command.command,
        durationMs,
        success: false,
        error: failure,
      });

      this.logger?.warn?.("device.command.failed", {
        durationMs,
        command: command.command,
        deviceId: command.deviceId,
        model: command.model,
        error: failure,
      });

      throw error;
    }
  }

  private normalize(light: LightItem): LightItem {
    if (light.capabilities) {
      return light;
    }

    const capabilities = this.buildCapabilities(light.supportedCommands ?? []);
    return { ...light, capabilities };
  }

  private buildCapabilities(commands: string[]): LightCapabilities {
    const normalized = new Set(commands.map((cmd) => cmd.toLowerCase()));
    const has = (...keys: string[]) => keys.some((key) => normalized.has(key));

    return {
      power: true,
      brightness: has("brightness", "turnonwithbrightness"),
      color: has("color", "turnonwithcolor"),
      colorTemperature: has("colortemperature", "turnonwithcolortemperature"),
      scenes: has("scene", "setscene", "lightscene"),
      segmentedColor: has("segmentedcolorrgb"),
      musicMode: has("musicmode"),
      nightlight: has("nightlighttoggle"),
      gradient: has("gradienttoggle"),
    };
  }
}
