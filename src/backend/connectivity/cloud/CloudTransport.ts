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
    try {
      const client = await this.ensureClient();
      const allEntries = await client.getControllableDevices();
      const devices = allEntries.filter(
        (device) => !UNSUPPORTED_CLOUD_GROUP_MODELS.has(device.model),
      );
      const unsupportedDevices = allEntries
        .filter((device) => UNSUPPORTED_CLOUD_GROUP_MODELS.has(device.model))
        .map((device) => ({
          deviceId: device.deviceId,
          model: device.model,
          name: device.deviceName,
        }));
      const lights: LightItem[] = devices.map((device) => {
        // Detect advanced capabilities from the device's capability list
        const capInstances = new Set(
          device.capabilities.map((c) => c.instance),
        );
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
              capInstances.has("gradientToggle") ||
              capTypes.has("gradientToggle"),
          },
        };
      });

      return { lights, unsupportedDevices };
    } catch (error) {
      // Govee API may return group entries (BaseGroup, SameModeGroup, etc.)
      // that fail strict schema validation. Return empty rather than crashing.
      streamDeck.logger?.error("cloud.discover.failed", error);
      return { lights: [] };
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
    capabilities: ReadonlyArray<{
      type: string;
      instance: string;
      parameters?: {
        range?: { min: number; max: number; precision?: number };
        fields?: Array<{
          fieldName: string;
          range?: { min: number; max: number; precision?: number };
        }>;
      };
    }>,
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
