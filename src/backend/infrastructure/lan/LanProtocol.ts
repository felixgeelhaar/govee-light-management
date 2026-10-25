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

export const STATUS_MESSAGE = JSON.stringify({
  msg: { cmd: "devStatus", data: {} },
});

/** A light's reply to `devStatus`; it names no device, only its address. */
export interface LanStatusReply {
  /** 1 on, 0 off. */
  onOff: number;
  /** 0–100. */
  brightness: number;
  color: { r: number; g: number; b: number };
  /** 0 while the light is in colour mode. */
  colorTemInKelvin: number;
}

export type LanMessage =
  | { cmd: "scan"; data: LanScanReply }
  | { cmd: "devStatus"; data: LanStatusReply };

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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
    const color = data?.color as Record<string, unknown> | undefined;
    if (
      msg?.cmd === "devStatus" &&
      isNumber(data?.onOff) &&
      isNumber(data.brightness) &&
      isNumber(data.colorTemInKelvin) &&
      isNumber(color?.r) &&
      isNumber(color.g) &&
      isNumber(color.b)
    )
      return {
        cmd: "devStatus",
        data: {
          onOff: data.onOff,
          brightness: data.brightness,
          color: { r: color.r, g: color.g, b: color.b },
          colorTemInKelvin: data.colorTemInKelvin,
        },
      };
  } catch {
    // Not JSON: another sender on the multicast group.
  }
  return null;
}
