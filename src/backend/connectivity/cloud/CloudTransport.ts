import streamDeck from "@elgato/streamdeck";
import {
  Brightness,
  ColorRgb,
  ColorTemperature,
  GoveeClient,
} from "@felixgeelhaar/govee-api-client";

import type { LightItem, LightState } from "@shared/types";
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

interface ClientFactory {
  create(apiKey: string): GoveeClient;
}

const factory: ClientFactory = {
  create(apiKey: string) {
    return new GoveeClient({ apiKey, enableRetries: true, retryPolicy: "production" });
  },
};

export class CloudTransport implements ITransport {
  readonly descriptor: TransportDescriptor = {
    kind: TransportKind.Cloud,
    label: "Govee Cloud",
    priority: 10,
  };

  private client: GoveeClient | null = null;

  constructor(private readonly dependencies: { factory?: ClientFactory } = {}) {}

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
    const client = await this.ensureClient();
    const devices = await client.getControllableDevices();
    const lights: LightItem[] = devices.map((device) => ({
      deviceId: device.deviceId,
      model: device.model,
      name: device.deviceName,
      label: device.deviceName,
      value: `${device.deviceId}|${device.model}`,
      controllable: device.controllable,
      retrievable: device.retrievable,
      supportedCommands: [...device.supportedCmds],
    }));

    return { lights };
  }

  async getLightState(deviceId: string, model: string): Promise<DeviceStateResult> {
    const client = await this.ensureClient();
    const state = await client.getDeviceState(deviceId, model);

    const power = state.getPowerState();
    const brightness = state.getBrightness();
    const color = state.getColor();
    const temperature = state.getColorTemperature();

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

  async supports(device: Pick<LightItem, "deviceId" | "model">): Promise<boolean> {
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
}
