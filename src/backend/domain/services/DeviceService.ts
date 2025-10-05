import type { LightCapabilities, LightItem } from "@shared/types";

import {
  type ControlCommand,
  type DeviceStateResult,
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
}

interface CacheEntry {
  lights: LightItem[];
  expiresAt: number;
  stale: boolean;
}

const DEFAULT_TTL_MS = 15_000;

export class DeviceService {
  private cache: CacheEntry | null = null;
  private readonly cacheTtl: number;
  private readonly logger?: Logger;

  constructor(
    private readonly orchestrator: TransportOrchestrator,
    options: DeviceServiceOptions = {},
  ) {
    this.logger = options.logger;
    this.cacheTtl = options.cacheTtlMs ?? DEFAULT_TTL_MS;
  }

  async discover(forceRefresh = false): Promise<LightItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cache.expiresAt) {
      return this.cache.lights;
    }

    const started = Date.now();
    const result = await this.orchestrator.discoverDevices();
    const normalized = result.lights.map((light) => this.normalize(light));

    const durationMs = Date.now() - started;
    const stale = Boolean(result.stale);

    this.cache = {
      lights: normalized,
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

  getCachedLights(): LightItem[] | null {
    if (!this.cache) return null;
    if (Date.now() > this.cache.expiresAt) return null;
    return this.cache.lights;
  }

  clearCache(): void {
    this.cache = null;
  }

  async getLightState(deviceId: string, model: string): Promise<DeviceStateResult> {
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
      const failure = error instanceof Error
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
      scenes: has("scene", "setscene"),
    };
  }
}
