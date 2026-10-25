import { BoundedPowerClient } from "./BoundedPowerClient";
import { turnCommand, type LanStatusReply } from "./lan/LanProtocol";

export interface LanPowerSource {
  /** False when the light isn't reachable on the local network. */
  sendCommands(deviceId: string, messages: string[]): Promise<boolean>;
  readStatus(
    deviceId: string,
    timeoutMs?: number,
  ): Promise<LanStatusReply | null>;
  /** Settles once the first scan finished (or LAN couldn't start). */
  ready?(): Promise<void>;
}

/** Lights answer status requests in 20–200 ms on the local network. */
const CONFIRM_TIMEOUT_MS = 500;
/**
 * The startup event arrives before the first scan has finished (about
 * 2 s); waiting this long lets a "Plugin starts" rule use LAN.
 */
const READY_TIMEOUT_MS = 3_000;

/**
 * Automation power (#377): over the local network first, confirmed with a
 * status read, then the bounded cloud request. Before sleep the cloud
 * round trip often didn't finish in time; a LAN light is switched in
 * milliseconds, and a light that didn't confirm costs at most
 * CONFIRM_TIMEOUT_MS before the cloud attempt starts.
 */
export class LanFirstPowerClient {
  constructor(
    private readonly lan: LanPowerSource,
    private readonly cloud = new BoundedPowerClient(),
  ) {}

  async setPower(
    light: { deviceId: string; model: string },
    isOn: boolean,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<"lan" | "cloud"> {
    signal.throwIfAborted();
    await this.waitForScan(signal);
    signal.throwIfAborted();
    const sent = await this.lan
      .sendCommands(light.deviceId, [turnCommand(isOn)])
      .catch(() => false);
    if (sent) {
      const reply = await this.lan
        .readStatus(light.deviceId, CONFIRM_TIMEOUT_MS)
        .catch(() => null);
      if (reply?.onOff === (isOn ? 1 : 0)) return "lan";
    }
    signal.throwIfAborted();
    await this.cloud.setPower(light, isOn, apiKey, signal);
    return "cloud";
  }

  private async waitForScan(signal: AbortSignal): Promise<void> {
    if (!this.lan.ready) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.lan.ready().catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, READY_TIMEOUT_MS);
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
    ]);
    clearTimeout(timer);
  }
}
