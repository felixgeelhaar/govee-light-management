import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudTransport } from "@/backend/connectivity/cloud/CloudTransport";
import { globalSettingsService } from "@/backend/services/GlobalSettingsService";

/** Build a raw `/user/devices` API entry (device/sku/deviceName shape). */
const buildRawEntry = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  device: "raw-1",
  sku: "H6001",
  deviceName: "Raw Light",
  capabilities: [
    { type: "devices.capabilities.on_off", instance: "powerSwitch" },
  ],
  ...overrides,
});

const mockDevicesFetch = (entries: unknown[], ok = true, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status,
    json: async () => ({ code: 200, message: "success", data: entries }),
  } as Response);

interface DeviceFixture {
  deviceId: string;
  model: string;
  deviceName: string;
  controllable: boolean;
  retrievable: boolean;
  supportedCmds: readonly string[];
  capabilities: ReadonlyArray<{
    type: string;
    instance: string;
    parameters?: Record<string, unknown>;
  }>;
}

const buildDevice = (
  overrides: Partial<DeviceFixture> = {},
): DeviceFixture => ({
  deviceId: "dev-1",
  model: "H6001",
  deviceName: "Test Light",
  controllable: true,
  retrievable: true,
  supportedCmds: [],
  capabilities: [],
  ...overrides,
});

describe("CloudTransport.discoverDevices", () => {
  beforeEach(() => {
    vi.spyOn(globalSettingsService, "getApiKey").mockResolvedValue("abcd1234");
  });

  it("exposes the device-specific color temperature range when advertised via capability.parameters.range", async () => {
    const device = buildDevice({
      capabilities: [
        { type: "devices.capabilities.color_setting", instance: "colorRgb" },
        {
          type: "devices.capabilities.color_setting",
          instance: "colorTemperatureK",
          parameters: {
            range: { min: 2700, max: 6500, precision: 50 },
          },
        },
      ],
    });

    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([device]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toHaveLength(1);
    expect(lights[0]?.properties?.colorTem?.range).toEqual({
      min: 2700,
      max: 6500,
      precision: 50,
    });
    expect(lights[0]?.capabilities?.colorTemperature).toBe(true);
  });

  it("falls back to nested parameters.fields when top-level range is absent", async () => {
    const device = buildDevice({
      capabilities: [
        {
          type: "devices.capabilities.dynamic_setting",
          instance: "dynamicScene",
          parameters: {
            fields: [
              {
                fieldName: "colorTemperatureK",
                range: { min: 3000, max: 6000, precision: 100 },
              },
            ],
          },
        },
      ],
    });

    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([device]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights[0]?.properties?.colorTem?.range).toEqual({
      min: 3000,
      max: 6000,
      precision: 100,
    });
    // When a range is discovered via nested fields, the capability must
    // still be advertised as supported so the UI does not hide it.
    expect(lights[0]?.capabilities?.colorTemperature).toBe(true);
  });

  it("omits the colorTem properties block when no capability advertises a range", async () => {
    const device = buildDevice({
      capabilities: [
        { type: "devices.capabilities.color_setting", instance: "colorRgb" },
      ],
    });

    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([device]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights[0]?.properties).toBeUndefined();
    expect(lights[0]?.capabilities?.colorTemperature).toBe(false);
  });

  it("treats either colorTemperatureK or colorTemInKelvin as a supported capability", async () => {
    const legacyDevice = buildDevice({
      deviceId: "legacy",
      capabilities: [
        {
          type: "devices.capabilities.color_setting",
          instance: "colorTemInKelvin",
        },
      ],
    });

    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([legacyDevice]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();
    expect(lights[0]?.capabilities?.colorTemperature).toBe(true);
  });

  it("filters unsupported cloud group pseudo-devices from discovery", async () => {
    const realLight = buildDevice({
      deviceId: "light-1",
      model: "H6001",
      deviceName: "Desk Light",
    });
    const sameModelGroup = buildDevice({
      deviceId: "group-1",
      model: "SameModelGroup",
      deviceName: "Bedroom Group",
    });
    const baseGroup = buildDevice({
      deviceId: "group-2",
      model: "BaseGroup",
      deviceName: "All Lights",
    });

    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi
              .fn()
              .mockResolvedValue([realLight, sameModelGroup, baseGroup]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toHaveLength(1);
    expect(lights[0]?.deviceId).toBe("light-1");
    expect(lights[0]?.model).toBe("H6001");
  });
});

describe("CloudTransport.discoverDevices lenient raw fallback (issue #304)", () => {
  beforeEach(() => {
    vi.spyOn(globalSettingsService, "getApiKey").mockResolvedValue("abcd1234");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recovers devices via raw fetch when the strict client throws", async () => {
    // Simulates the client rejecting the whole batch on a schema violation.
    mockDevicesFetch([buildRawEntry()]);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi
              .fn()
              .mockRejectedValue(new Error("API response validation failed")),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toHaveLength(1);
    expect(lights[0]?.deviceId).toBe("raw-1");
    expect(lights[0]?.controllable).toBe(true);
    expect(lights[0]?.supportedCommands).toContain("turn");
  });

  it("recovers devices via raw fetch when the strict client returns zero (over-aggressive canControl filter)", async () => {
    mockDevicesFetch([buildRawEntry()]);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toHaveLength(1);
    expect(lights[0]?.deviceId).toBe("raw-1");
  });

  it("skips only the malformed entry and keeps the rest", async () => {
    mockDevicesFetch([
      buildRawEntry({ device: "good-1", deviceName: "Good Light" }),
      // Malformed: missing deviceName — must not sink the whole list.
      buildRawEntry({ device: "bad-1", deviceName: "" }),
      buildRawEntry({ device: "good-2", deviceName: "Also Good" }),
    ]);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights.map((l) => l.deviceId).sort()).toEqual(["good-1", "good-2"]);
  });

  it("returns empty when the raw fallback request is not ok", async () => {
    mockDevicesFetch([], false, 500);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toEqual([]);
  });

  it("does not hit the raw fallback when the strict path already returns devices", async () => {
    const fetchSpy = mockDevicesFetch([buildRawEntry()]);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([
              {
                deviceId: "typed-1",
                model: "H6001",
                deviceName: "Typed Light",
                controllable: true,
                retrievable: true,
                supportedCmds: [],
                capabilities: [],
              },
            ]),
          }) as never,
      },
    });

    const { lights } = await transport.discoverDevices();

    expect(lights).toHaveLength(1);
    expect(lights[0]?.deviceId).toBe("typed-1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the primary unsupported cloud-group entries when the fallback fails", async () => {
    // Strict path found only an uncontrollable cloud group (0 lights, but a
    // populated unsupportedDevices list). The raw fallback then fails — the
    // primary result must survive so the PI still shows the disabled group,
    // rather than being dropped for an empty list. (Copilot review, PR #305)
    mockDevicesFetch([], false, 500);
    const transport = new CloudTransport({
      factory: {
        create: () =>
          ({
            getControllableDevices: vi.fn().mockResolvedValue([
              {
                deviceId: "group-1",
                model: "BaseGroup",
                deviceName: "All Lights",
                controllable: true,
                retrievable: true,
                supportedCmds: [],
                capabilities: [],
              },
            ]),
          }) as never,
      },
    });

    const { lights, unsupportedDevices } = await transport.discoverDevices();

    expect(lights).toEqual([]);
    expect(unsupportedDevices).toEqual([
      { deviceId: "group-1", model: "BaseGroup", name: "All Lights" },
    ]);
  });
});
