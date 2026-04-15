import { beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
  logger: {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  },
}));

vi.mock("@elgato/streamdeck", () => ({
  default: {
    logger,
  },
}));

vi.mock("@/backend/services/GlobalSettingsService", () => ({
  globalSettingsService: {
    getApiKey: vi.fn(async () => "test-api-key"),
  },
}));

import { CloudTransport } from "@/backend/connectivity/cloud/CloudTransport";

describe("CloudTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters malformed discovery entries instead of throwing", async () => {
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn(async () => [
              {
                deviceId: "dev-1",
                model: "H6001",
                deviceName: "Kitchen",
                controllable: true,
                retrievable: true,
                supportedCmds: ["Power", "Brightness"],
                capabilities: [{ instance: "brightness", type: "devices.capabilities.range" }],
              },
              {
                model: "BaseGroup",
                deviceName: "Upstairs",
              },
            ]),
          }) as any,
      },
    });

    const result = await transport.discoverDevices();

    expect(result.lights).toHaveLength(1);
    expect(result.lights[0]).toMatchObject({
      deviceId: "dev-1",
      model: "H6001",
      name: "Kitchen",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "cloud.discover.skipping-device",
      expect.objectContaining({ reason: "missing-light-fields" }),
    );
  });

  it("treats missing capabilities as an empty list", async () => {
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn(async () => [
              {
                deviceId: "dev-2",
                model: "H6002",
                deviceName: "Hallway",
                controllable: true,
                retrievable: false,
                supportedCmds: ["Power"],
              },
            ]),
          }) as any,
      },
    });

    const result = await transport.discoverDevices();

    expect(result.lights).toHaveLength(1);
    expect(result.lights[0]?.capabilities).toEqual({
      power: true,
      brightness: false,
      color: false,
      colorTemperature: false,
      scenes: false,
      segmentedColor: false,
      musicMode: false,
      nightlight: false,
      gradient: false,
    });
  });
});
