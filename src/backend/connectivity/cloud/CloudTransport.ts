import streamDeck from "@elgato/streamdeck";
import {
  Brightness,
  ColorRgb,
  ColorTemperature,
  GoveeClient,
} from "@felixgeelhaar/govee-api-client";

import type { LightItem, LightState } from "@shared/types";
import { UNSUPPORTED_CLOUD_GROUP_MODELS } from "@shared/cloud-groups";
import type { ITransport } from "../ITransport";
import {
  ControlCommand,
  DeviceDiscoveryResult,
  DeviceStateResult,
  TransportDescriptor,
  TransportHealth,
  TransportKind,
} from "../types";
import { globalSettingsService } from "../../services/GlobalSettingsService";
import { safeGetColorTemperature } from "../../infrastructure/utils/deviceStateUtils";

interface ClientFactory {
  create(apiKey: string): GoveeClient;
}

/** Govee Cloud endpoint listing every device on the account. */
const GOVEE_DEVICES_ENDPOINT =
  "https://openapi.api.govee.com/router/api/v1/user/devices";

/**
 * A single capability descriptor as advertised by the Govee `/user/devices`
 * endpoint. Kept structurally compatible with the client's `GoveeCapability`
 * so both discovery paths feed the same mapper.
 */
interface DeviceCapability {
  type: string;
  instance: string;
  parameters?: {
    range?: { min: number; max: number; precision?: number };
    fields?: Array<{
      fieldName: string;
      range?: { min: number; max: number; precision?: number };
    }>;
  };
}

/**
 * The subset of a device the discovery mapper needs. Both the typed client's
 * `GoveeDevice` entities and the lenient raw fetch produce this shape.
 */
interface NormalizedDevice {
  deviceId: string;
  model: string;
  deviceName: string;
  controllable: boolean;
  retrievable: boolean;
  supportedCmds: readonly string[];
  capabilities: ReadonlyArray<DeviceCapability>;
}

/**
 * Whether a device exposes any capability the plugin can actually drive.
 * Mirrors the govee-api-client's own `canControl()` derivation so the lenient
 * fallback classifies devices the same way the strict path would.
 */
function deriveControllable(
  capabilities: ReadonlyArray<DeviceCapability>,
): boolean {
  return capabilities.some(
    (cap) =>
      cap.type.includes("on_off") ||
      cap.type.includes("range") ||
      cap.type.includes("color_setting"),
  );
}

/**
 * Derive the API command list from a device's capabilities, mirroring the
 * govee-api-client's `deriveSupportedCommands` so raw-fetch devices carry the
 * same `supportedCommands` metadata the UI expects.
 */
function deriveSupportedCmds(
  capabilities: ReadonlyArray<DeviceCapability>,
): string[] {
  const commands = new Set<string>();
  for (const cap of capabilities) {
    if (cap.type.includes("on_off")) commands.add("turn");
    if (cap.type.includes("range") && cap.instance === "brightness")
      commands.add("brightness");
    if (cap.type.includes("color_setting")) {
      if (cap.instance === "colorRgb") commands.add("color");
      if (cap.instance === "colorTemperatureK") commands.add("colorTem");
    }
    if (cap.type.includes("dynamic_scene") && cap.instance === "lightScene")
      commands.add("lightScene");
    if (cap.type.includes("segment_color_setting")) {
      if (cap.instance === "segmentedColorRgb")
        commands.add("segmentedColorRgb");
      if (cap.instance === "segmentedBrightness")
        commands.add("segmentedBrightness");
    }
    if (cap.type.includes("music_setting") && cap.instance === "musicMode")
      commands.add("musicMode");
    if (cap.type.includes("toggle")) {
      if (cap.instance === "nightlightToggle") commands.add("nightlightToggle");
      if (cap.instance === "gradientToggle") commands.add("gradientToggle");
      if (cap.instance === "sceneStageToggle") commands.add("sceneStageToggle");
    }
  }
  return Array.from(commands);
}

/**
 * Normalize one raw `/user/devices` entry, returning null when required fields
 * (device id, sku, name, capabilities) are missing or malformed. Individual
 * bad capabilities are dropped rather than rejecting the whole device.
 */
function normalizeRawDevice(entry: unknown): NormalizedDevice | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const e = entry as Record<string, unknown>;
  const deviceId = typeof e.device === "string" ? e.device.trim() : "";
  const model = typeof e.sku === "string" ? e.sku.trim() : "";
  const deviceName =
    typeof e.deviceName === "string" ? e.deviceName.trim() : "";
  if (!deviceId || !model || !deviceName || !Array.isArray(e.capabilities)) {
    return null;
  }

  const capabilities: DeviceCapability[] = [];
  for (const cap of e.capabilities) {
    if (
      typeof cap === "object" &&
      cap !== null &&
      typeof (cap as { type?: unknown }).type === "string" &&
      (cap as { type: string }).type.trim().length > 0
    ) {
      const c = cap as { type: string; instance?: unknown };
      capabilities.push({
        type: c.type,
        instance: typeof c.instance === "string" ? c.instance : "",
        parameters: (cap as DeviceCapability).parameters,
      });
    }
  }

  return {
    deviceId,
    model,
    deviceName,
    controllable: deriveControllable(capabilities),
    retrievable: capabilities.length > 0,
    supportedCmds: deriveSupportedCmds(capabilities),
    capabilities,
  };
}

const factory: ClientFactory = {
  create(apiKey: string) {
    return new GoveeClient({
      apiKey,
      enableRetries: true,
      retryPolicy: "production",
    });
  },
};

export class CloudTransport implements ITransport {
  readonly descriptor: TransportDescriptor = {
    kind: TransportKind.Cloud,
    label: "Govee Cloud",
    priority: 10,
  };

  private client: GoveeClient | null = null;

  constructor(
    private readonly dependencies: { factory?: ClientFactory } = {},
  ) {}

  async checkHealth(): Promise<TransportHealth> {
    const started = Date.now();
    try {
      const client = await this.ensureClient();
      await client.getDevices();
      return {
        descriptor: this.descriptor,
        isHealthy: true,
        lastChecked: Date.now(),
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      streamDeck.logger?.warn("cloud.health.failed", error);
      return {
        descriptor: this.descriptor,
        isHealthy: false,
        lastChecked: Date.now(),
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async discoverDevices(): Promise<DeviceDiscoveryResult> {
    // Primary path: the strict, typed govee-api-client. It returns fully
    // validated GoveeDevice entities but is all-or-nothing — a single device
    // whose payload fails the client's Zod schema throws for the whole batch,
    // and its `canControl()` filter can silently drop every entry. Either can
    // zero the list even when the account has usable lights (issue #304).
    let primaryResult: DeviceDiscoveryResult | null = null;
    try {
      const client = await this.ensureClient();
      const allEntries = await client.getControllableDevices();
      primaryResult = this.buildDiscoveryResult(allEntries);
      if (primaryResult.lights.length > 0) {
        return primaryResult;
      }
      streamDeck.logger?.info(
        "cloud.discover.primary-empty; attempting lenient raw fallback",
      );
    } catch (error) {
      // Govee API may return group entries (BaseGroup, SameModeGroup, etc.)
      // or an odd device payload that fails strict schema validation.
      streamDeck.logger?.error("cloud.discover.failed", error);
    }

    // Fallback: parse /user/devices ourselves, dropping only the individual
    // malformed entries so one bad device can't hide every other light. This
    // mirrors the Connect button's lenient raw HTTP check, guaranteeing that
    // if Connect can see devices, discovery can too.
    const fallback = await this.discoverViaRawFetch();
    if (fallback && fallback.lights.length > 0) {
      return fallback;
    }

    // Fallback added no usable lights (it failed, or the account genuinely
    // has only uncontrollable cloud-group entries). Prefer the primary result
    // so its `unsupportedDevices` still reach the PI as disabled group
    // options, instead of dropping them and showing nothing.
    return primaryResult ?? fallback ?? { lights: [] };
  }

  /**
   * Map a normalized device (from either the typed client or the lenient raw
   * fetch) into the `DeviceDiscoveryResult` the UI consumes, splitting out the
   * Govee cloud-group pseudo-devices the plugin can't control.
   */
  private buildDiscoveryResult(
    entries: ReadonlyArray<NormalizedDevice>,
  ): DeviceDiscoveryResult {
    const unsupportedDevices = entries
      .filter((device) => UNSUPPORTED_CLOUD_GROUP_MODELS.has(device.model))
      .map((device) => ({
        deviceId: device.deviceId,
        model: device.model,
        name: device.deviceName,
      }));
    const lights: LightItem[] = entries
      .filter((device) => !UNSUPPORTED_CLOUD_GROUP_MODELS.has(device.model))
      .map((device) => this.mapDeviceToLightItem(device));
    return { lights, unsupportedDevices };
  }

  private mapDeviceToLightItem(device: NormalizedDevice): LightItem {
    // Detect advanced capabilities from the device's capability list
    const capInstances = new Set(device.capabilities.map((c) => c.instance));
    const capTypes = new Set(device.capabilities.map((c) => c.type));
    const colorTemperatureRange = this.extractColorTemperatureRange(
      device.capabilities,
    );

    return {
      deviceId: device.deviceId,
      model: device.model,
      name: device.deviceName,
      label: device.deviceName,
      value: `${device.deviceId}|${device.model}`,
      controllable: device.controllable,
      retrievable: device.retrievable,
      supportedCommands: [...device.supportedCmds],
      properties: colorTemperatureRange
        ? {
            colorTem: {
              range: {
                min: colorTemperatureRange.min,
                max: colorTemperatureRange.max,
                precision: colorTemperatureRange.precision,
              },
            },
          }
        : undefined,
      capabilities: {
        power: true,
        brightness: capInstances.has("brightness"),
        color: capInstances.has("colorRgb"),
        // A device can advertise its Kelvin range as either a top-level
        // `colorTemperatureK` instance or nested inside the `fields` of
        // another capability (seen on some scene-capable devices).
        // If a range was discovered via either path, treat that as proof
        // of color-temperature support; otherwise the UI would hide
        // color-temp controls even though the range metadata exists.
        colorTemperature:
          capInstances.has("colorTemperatureK") ||
          capInstances.has("colorTemInKelvin") ||
          colorTemperatureRange !== undefined,
        scenes: capInstances.has("lightScene"),
        segmentedColor: capInstances.has("segmentedColorRgb"),
        musicMode: capInstances.has("musicMode"),
        nightlight: capInstances.has("nightlightToggle"),
        gradient:
          capInstances.has("gradientToggle") || capTypes.has("gradientToggle"),
      },
    };
  }

  /**
   * Lenient recovery path used when the strict client returns zero devices or
   * throws. Fetches /user/devices directly and normalizes each entry on its
   * own, so a malformed device is skipped rather than hiding the whole list.
   * Returns null when the key is missing or the request fails, letting the
   * caller fall back to an empty result.
   */
  private async discoverViaRawFetch(): Promise<DeviceDiscoveryResult | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return null;
    }

    try {
      const res = await fetch(GOVEE_DEVICES_ENDPOINT, {
        headers: {
          "Content-Type": "application/json",
          "Govee-API-Key": apiKey,
        },
      });
      if (!res.ok) {
        streamDeck.logger?.warn(
          `cloud.discover.raw-fallback: HTTP ${res.status}`,
        );
        return null;
      }

      const body = (await res.json()) as { data?: unknown };
      const rawList = Array.isArray(body?.data) ? body.data : [];
      const normalized: NormalizedDevice[] = [];
      for (const entry of rawList) {
        const device = normalizeRawDevice(entry);
        if (device) {
          normalized.push(device);
        }
      }

      const skipped = rawList.length - normalized.length;
      streamDeck.logger?.info(
        `cloud.discover.raw-fallback: recovered ${normalized.length} device(s)` +
          (skipped > 0 ? ` (skipped ${skipped} malformed)` : ""),
      );
      return this.buildDiscoveryResult(normalized);
    } catch (error) {
      streamDeck.logger?.error("cloud.discover.raw-fallback failed", error);
      return null;
    }
  }

  async getLightState(
    deviceId: string,
    model: string,
  ): Promise<DeviceStateResult> {
    const client = await this.ensureClient();
    const state = await client.getDeviceState(deviceId, model);

    const power = state.getPowerState();
    const brightness = state.getBrightness();
    const color = state.getColor();
    const temperature = safeGetColorTemperature(
      state,
      `${deviceId} (${model})`,
    );

    const lightState: LightState = {
      deviceId,
      model,
      name: deviceId,
      isOnline: state.isOnline(),
      powerState: power ? power === "on" : undefined,
      brightness: brightness ? Math.round(brightness.asPercent()) : undefined,
      color: color ? color.toObject() : undefined,
      colorTemperature: temperature ? temperature.kelvin : undefined,
    };

    return { state: lightState, transport: this.descriptor.kind };
  }

  async sendCommand(command: ControlCommand): Promise<void> {
    const client = await this.ensureClient();

    switch (command.command) {
      case "power": {
        const turnOn = Boolean(command.payload?.on ?? command.payload?.value);
        if (turnOn) {
          await client.turnOn(command.deviceId, command.model);
        } else {
          await client.turnOff(command.deviceId, command.model);
        }
        return;
      }
      case "brightness": {
        const value = Number(command.payload?.value ?? command.payload);
        const percent = Number.isFinite(value) ? value : 0;
        await client.setBrightness(
          command.deviceId,
          command.model,
          Brightness.fromPercent(Math.max(0, Math.min(100, percent))),
        );
        return;
      }
      case "color": {
        const payload = (command.payload ?? {}) as {
          r?: number;
          g?: number;
          b?: number;
        };
        if (
          typeof payload.r !== "number" ||
          typeof payload.g !== "number" ||
          typeof payload.b !== "number"
        ) {
          throw new Error("Invalid color payload for cloud command");
        }
        await client.setColor(
          command.deviceId,
          command.model,
          ColorRgb.fromObject({ r: payload.r, g: payload.g, b: payload.b }),
        );
        return;
      }
      case "colorTemperature": {
        const value = Number(command.payload?.value ?? command.payload);
        const kelvin = Number.isFinite(value) ? value : 6500;
        const clamped = Math.max(2000, Math.min(9000, Math.round(kelvin)));
        await client.setColorTemperature(
          command.deviceId,
          command.model,
          new ColorTemperature(clamped),
        );
        return;
      }
      default:
        streamDeck.logger?.warn("Unsupported cloud command", command);
        throw new Error(`Unsupported command: ${command.command}`);
    }
  }

  async supports(
    _device: Pick<LightItem, "deviceId" | "model">,
  ): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return Boolean(apiKey);
  }

  private async ensureClient(): Promise<GoveeClient> {
    if (this.client) {
      return this.client;
    }

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("Govee API key is not configured");
    }

    const clientFactory = this.dependencies.factory ?? factory;
    this.client = clientFactory.create(apiKey);
    return this.client;
  }

  private async getApiKey(): Promise<string | undefined> {
    const settings = await globalSettingsService.getApiKey();
    return settings;
  }

  private extractColorTemperatureRange(
    capabilities: ReadonlyArray<DeviceCapability>,
  ): { min: number; max: number; precision?: number } | undefined {
    for (const capability of capabilities) {
      if (
        capability.instance === "colorTemperatureK" &&
        capability.parameters?.range
      ) {
        return capability.parameters.range;
      }
    }

    for (const capability of capabilities) {
      const fields = capability.parameters?.fields;
      if (!Array.isArray(fields)) {
        continue;
      }

      const colorTemperatureField = fields.find(
        (field) => field.fieldName === "colorTemperatureK" && field.range,
      );
      if (colorTemperatureField?.range) {
        return colorTemperatureField.range;
      }
    }

    return undefined;
  }
}
