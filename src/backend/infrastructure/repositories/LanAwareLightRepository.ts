import streamDeck from "@elgato/streamdeck";
import type { Light } from "../../domain/entities";
import { Brightness } from "../../domain/value-objects/Brightness";
import { ColorRgb } from "../../domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../domain/value-objects/ColorTemperature";
import {
  brightnessCommand,
  colorCommand,
  colorTemperatureCommand,
  turnCommand,
  type LanStatusReply,
} from "../lan/LanProtocol";
import { GoveeLightRepository } from "./GoveeLightRepository";
import { stateSamples } from "./StateSampleLog";

export interface LanSource {
  readStatus(deviceId: string): Promise<LanStatusReply | null>;
  /** False when the light isn't reachable on the local network. */
  sendCommands(deviceId: string, messages: string[]): Promise<boolean>;
}

/** How long after a LAN command the light is asked whether it changed. */
export const LAN_CONFIRM_DELAY_MS = 1_500;
/** A light that missed a LAN command uses the cloud for this long. */
const CLOUD_FALLBACK_MS = 10 * 60_000;
/** Lights round temperatures to their own precision. */
const KELVIN_TOLERANCE = 100;

type Expected = (reply: LanStatusReply) => boolean;

/**
 * The cloud repository, with state reads and the common commands sent over
 * the local network for lights that respond there
 * (docs/design/lan-control.md, phases 2 and 3). UDP has no delivery
 * guarantee, so each LAN command is confirmed with a status read; a light
 * that didn't change gets the command again over the cloud and stays on
 * the cloud for a while. LAN traffic doesn't count against Govee's cloud
 * rate limit.
 */
export class LanAwareLightRepository extends GoveeLightRepository {
  /** Lights whose first LAN read was logged, once per session. */
  private readonly announced = new Set<string>();
  /** Last transport a command used, by device id. */
  private readonly transports = new Map<string, "lan" | "cloud">();
  /** Lights on the cloud after a missed LAN command, until this time. */
  private readonly cloudUntil = new Map<string, number>();
  /** The pending confirmation per light; a newer command replaces it. */
  private readonly confirmations = new Map<string, NodeJS.Timeout>();

  constructor(
    apiKey: string,
    private readonly lan: LanSource,
    enableRetries = true,
  ) {
    super(apiKey, enableRetries);
  }

  override async getLightState(light: Light): Promise<void> {
    const started = Date.now();
    const reply = await this.lan.readStatus(light.deviceId).catch(() => null);
    if (reply && this.applyLanState(light, reply)) {
      stateSamples.record(light, "lan");
      if (!this.announced.has(light.deviceId)) {
        this.announced.add(light.deviceId);
        streamDeck.logger.info("lan.state", {
          light: `${light.deviceId}|${light.model}`,
          name: light.name,
          durationMs: Date.now() - started,
        });
      }
      return;
    }
    await super.getLightState(light);
  }

  /** Which transport the light's last command went over. */
  transportOf(light: Light): "lan" | "cloud" {
    return this.transports.get(light.deviceId) ?? "cloud";
  }

  override async setPower(light: Light, isOn: boolean): Promise<void> {
    await this.command(
      light,
      [turnCommand(isOn)],
      (r) => r.onOff === (isOn ? 1 : 0),
      { isOn },
      () => super.setPower(light, isOn),
    );
  }

  override async setBrightness(
    light: Light,
    brightness: Brightness,
  ): Promise<void> {
    // Matches the cloud path: 0 % means off.
    const off = brightness.level === 0;
    await this.command(
      light,
      [off ? turnCommand(false) : brightnessCommand(brightness.level)],
      off ? (r) => r.onOff === 0 : (r) => r.brightness === brightness.level,
      off ? { isOn: false, brightness } : { brightness },
      () => super.setBrightness(light, brightness),
    );
  }

  override async setColor(light: Light, color: ColorRgb): Promise<void> {
    await this.command(
      light,
      [colorCommand(color)],
      sameColor(color),
      { isOn: true, color, colorTemperature: undefined },
      () => super.setColor(light, color),
    );
  }

  override async setColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
  ): Promise<void> {
    await this.command(
      light,
      [colorTemperatureCommand(colorTemperature.kelvin)],
      sameKelvin(colorTemperature),
      { isOn: true, colorTemperature, color: undefined },
      () => super.setColorTemperature(light, colorTemperature),
    );
  }

  override async turnOnWithBrightness(
    light: Light,
    brightness: Brightness,
  ): Promise<void> {
    await this.command(
      light,
      [turnCommand(true), brightnessCommand(brightness.level)],
      (r) => r.onOff === 1 && r.brightness === brightness.level,
      { isOn: true, brightness },
      () => super.turnOnWithBrightness(light, brightness),
    );
  }

  override async turnOnWithColor(
    light: Light,
    color: ColorRgb,
    brightness?: Brightness,
  ): Promise<void> {
    const matches = sameColor(color);
    await this.command(
      light,
      withBrightness([turnCommand(true), colorCommand(color)], brightness),
      (r) => r.onOff === 1 && matches(r) && sameLevel(r, brightness),
      {
        isOn: true,
        color,
        colorTemperature: undefined,
        ...(brightness && { brightness }),
      },
      () => super.turnOnWithColor(light, color, brightness),
    );
  }

  override async turnOnWithColorTemperature(
    light: Light,
    colorTemperature: ColorTemperature,
    brightness?: Brightness,
  ): Promise<void> {
    const matches = sameKelvin(colorTemperature);
    await this.command(
      light,
      withBrightness(
        [turnCommand(true), colorTemperatureCommand(colorTemperature.kelvin)],
        brightness,
      ),
      (r) => r.onOff === 1 && matches(r) && sameLevel(r, brightness),
      {
        isOn: true,
        colorTemperature,
        color: undefined,
        ...(brightness && { brightness }),
      },
      () =>
        super.turnOnWithColorTemperature(light, colorTemperature, brightness),
    );
  }

  /**
   * Sends over LAN when the light answers there, else runs the cloud call.
   * A LAN send returns as soon as the datagrams leave; the confirmation
   * runs afterwards so the key reacts at LAN speed.
   */
  private async command(
    light: Light,
    messages: string[],
    expected: Expected,
    state: Parameters<Light["updateState"]>[0],
    cloud: () => Promise<void>,
  ): Promise<void> {
    const id = light.deviceId;
    const onCloud = (this.cloudUntil.get(id) ?? 0) > Date.now();
    const sent =
      !onCloud &&
      (await this.lan.sendCommands(id, messages).catch(() => false));
    if (!sent) {
      this.transports.set(id, "cloud");
      await cloud();
      return;
    }
    this.transports.set(id, "lan");
    light.updateState(state);
    this.confirmLater(light, expected, cloud);
  }

  private confirmLater(
    light: Light,
    expected: Expected,
    cloud: () => Promise<void>,
  ): void {
    const id = light.deviceId;
    clearTimeout(this.confirmations.get(id));
    const timer = setTimeout(async () => {
      if (this.confirmations.get(id) !== timer) return;
      this.confirmations.delete(id);
      const reply = await this.lan.readStatus(id).catch(() => null);
      // A newer command was sent while this one was being checked.
      if (this.confirmations.has(id) || (reply && expected(reply))) return;
      this.cloudUntil.set(id, Date.now() + CLOUD_FALLBACK_MS);
      this.transports.set(id, "cloud");
      streamDeck.logger.warn("lan.command.unconfirmed", {
        light: `${id}|${light.model}`,
        name: light.name,
        replied: reply !== null,
      });
      await cloud().catch((error) =>
        streamDeck.logger.error("Cloud resend after LAN command failed", error),
      );
    }, LAN_CONFIRM_DELAY_MS);
    timer.unref?.();
    this.confirmations.set(id, timer);
  }

  /** False for a reply the domain rejects; the cloud read then decides. */
  private applyLanState(light: Light, reply: LanStatusReply): boolean {
    try {
      const kelvin = reply.colorTemInKelvin;
      light.updateState({
        isOn: reply.onOff === 1,
        isOnline: true,
        brightness: new Brightness(reply.brightness),
        // The light reports a temperature, or 0 while in colour mode.
        color:
          kelvin > 0
            ? undefined
            : new ColorRgb(reply.color.r, reply.color.g, reply.color.b),
        colorTemperature: kelvin > 0 ? new ColorTemperature(kelvin) : undefined,
      });
      return true;
    } catch (error) {
      streamDeck.logger.debug("lan.state rejected, using the cloud", {
        light: light.name,
        error: String(error),
      });
      return false;
    }
  }
}

function withBrightness(messages: string[], brightness?: Brightness): string[] {
  return brightness
    ? [...messages, brightnessCommand(brightness.level)]
    : messages;
}

function sameLevel(reply: LanStatusReply, brightness?: Brightness): boolean {
  return !brightness || reply.brightness === brightness.level;
}

function sameColor(color: ColorRgb): Expected {
  return (r) =>
    r.colorTemInKelvin === 0 &&
    r.color.r === color.r &&
    r.color.g === color.g &&
    r.color.b === color.b;
}

function sameKelvin(temperature: ColorTemperature): Expected {
  return (r) =>
    Math.abs(r.colorTemInKelvin - temperature.kelvin) <= KELVIN_TOLERANCE;
}
