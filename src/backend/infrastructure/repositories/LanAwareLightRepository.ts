import streamDeck from "@elgato/streamdeck";
import type { Light } from "../../domain/entities";
import { Brightness } from "../../domain/value-objects/Brightness";
import { ColorRgb } from "../../domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../domain/value-objects/ColorTemperature";
import type { LanStatusReply } from "../lan/LanProtocol";
import { GoveeLightRepository } from "./GoveeLightRepository";
import { stateSamples } from "./StateSampleLog";

export interface LanStateSource {
  readStatus(deviceId: string): Promise<LanStatusReply | null>;
}

/**
 * The cloud repository, with state reads answered over the local network
 * for lights that respond there (docs/design/lan-control.md, phase 2).
 * LAN reads don't count against Govee's cloud rate limit. Commands still
 * go through the cloud.
 */
export class LanAwareLightRepository extends GoveeLightRepository {
  /** Lights whose first LAN read was logged, once per session. */
  private readonly announced = new Set<string>();

  constructor(
    apiKey: string,
    private readonly lan: LanStateSource,
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
