/**
 * Govee's LAN API (https://app-h5.govee.com/user-manual/wlan-guide): JSON
 * over UDP, enabled per light with "LAN Control" in the Govee app.
 */
export const LAN_MULTICAST_ADDRESS = "239.255.255.250";
/** Scans go to the multicast group on this port. */
export const LAN_SCAN_PORT = 4001;
/** Lights reply to scans and status requests on this port. */
export const LAN_LISTEN_PORT = 4002;
/** Commands and status requests go to a light's own address on this port. */
export const LAN_CONTROL_PORT = 4003;

export const SCAN_MESSAGE = JSON.stringify({
  msg: { cmd: "scan", data: { account_topic: "reserve" } },
});

export interface LanScanReply {
  ip: string;
  /** The same device id the cloud API reports, possibly in another case. */
  device: string;
  sku: string;
}

export type LanMessage = { cmd: "scan"; data: LanScanReply };

/** A recognised message from a light, or null for anything else. */
export function parseLanMessage(raw: string): LanMessage | null {
  try {
    const { msg } = JSON.parse(raw) as {
      msg?: { cmd?: unknown; data?: Record<string, unknown> };
    };
    const data = msg?.data;
    if (
      msg?.cmd === "scan" &&
      typeof data?.ip === "string" &&
      typeof data.device === "string" &&
      typeof data.sku === "string"
    )
      return {
        cmd: "scan",
        data: { ip: data.ip, device: data.device, sku: data.sku },
      };
  } catch {
    // Not JSON: another sender on the multicast group.
  }
  return null;
}
