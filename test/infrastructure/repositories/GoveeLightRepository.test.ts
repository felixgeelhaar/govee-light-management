import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoveeLightRepository } from "../../../src/backend/infrastructure/repositories/GoveeLightRepository";

// The repository imports the Stream Deck SDK as a default export
// (`import streamDeck from "@elgato/streamdeck"`). The global test setup mocks
// only the named export, so provide a default with a logger for the code paths
// that log (e.g. the toggle-validation fallback warning).
vi.mock("@elgato/streamdeck", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
  };
  return { default: { logger }, streamDeck: { logger } };
});

const clientMocks = vi.hoisted(() => ({
  getDiyScenes: vi.fn(),
  setDiyScene: vi.fn(),
  getControllableDevices: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock("@felixgeelhaar/govee-api-client", () => {
  class MockBrightness {
    constructor(public readonly level: number) {}
  }

  class MockColorRgb {
    constructor(
      public readonly r: number,
      public readonly g: number,
      public readonly b: number,
    ) {}
  }

  class MockColorTemperature {
    constructor(public readonly kelvin: number) {}
  }

  class MockLightScene {
    constructor(
      public readonly id: number,
      public readonly paramId: number,
      public readonly name: string,
    ) {}
  }

  class MockDiyScene {
    constructor(
      public readonly id: number,
      public readonly paramId: number,
      public readonly name: string,
    ) {}
  }

  class MockSnapshot {
    constructor(
      public readonly id: number,
      public readonly paramId: number,
      public readonly name: string,
    ) {}
  }

  class MockMusicMode {
    constructor(
      public readonly modeId: number,
      public readonly sensitivity?: number,
    ) {}
  }

  class MockSegmentColor {
    constructor(
      public readonly index: number,
      public readonly color: unknown,
    ) {}
  }

  class MockGoveeClient {
    getDiyScenes = clientMocks.getDiyScenes;
    setDiyScene = clientMocks.setDiyScene;
    getControllableDevices = clientMocks.getControllableDevices;
    sendCommand = clientMocks.sendCommand;
  }

  return {
    GoveeClient: MockGoveeClient,
    Brightness: MockBrightness,
    ColorRgb: MockColorRgb,
    ColorTemperature: MockColorTemperature,
    GoveeDevice: class MockGoveeDevice {},
    LightScene: MockLightScene,
    DiyScene: MockDiyScene,
    Snapshot: MockSnapshot,
    MusicMode: MockMusicMode,
    SegmentColor: MockSegmentColor,
  };
});

describe("GoveeLightRepository DIY scene support", () => {
  const light = {
    deviceId: "30:36:D0:C8:05:46:4B:40",
    model: "H61E5",
    name: "Desk light",
    updateState: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates getDiyScenes to the API client with the light device id and model", async () => {
    const apiScenes = [{ id: 123, paramId: 123, name: "Custom Glow" }];
    clientMocks.getDiyScenes.mockResolvedValue(apiScenes);

    const repository = new GoveeLightRepository("api-key");
    const result = await repository.getDiyScenes(light);

    expect(clientMocks.getDiyScenes).toHaveBeenCalledWith(
      light.deviceId,
      light.model,
    );
    expect(result.map((item) => item.toJSON())).toEqual([
      { id: 123, paramId: 123, name: "Custom Glow" },
    ]);
  });

  it("delegates setDiyScene to the API client with the selected scene", async () => {
    const apiScene = { id: 456, paramId: 456, name: "DIY Sunset" };
    clientMocks.setDiyScene.mockResolvedValue(undefined);

    const repository = new GoveeLightRepository("api-key");
    await repository.setDiyScene(light, apiScene as any);

    expect(clientMocks.setDiyScene).toHaveBeenCalledWith(
      light.deviceId,
      light.model,
      expect.objectContaining({ id: 456, paramId: 456, name: "DIY Sunset" }),
    );
  });
});

describe("GoveeLightRepository multi-outlet socket toggles", () => {
  // HS5089 Smart Outlet Extender: each socket is its own toggle capability
  // instance (socketToggle1, socketToggle2, …). Regression coverage for #261,
  // where these surfaced in the picker but every press was rejected.
  const outlet = {
    deviceId: "AA:BB:CC:DD:EE:FF:00:11",
    model: "HS5089",
    name: "Smart Outlet Extender",
    updateState: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("labels indexed socket toggles as 'Socket N' in getToggleFeatures", async () => {
    clientMocks.getControllableDevices.mockResolvedValue([
      {
        deviceId: outlet.deviceId,
        model: outlet.model,
        capabilities: [
          { type: "devices.capabilities.toggle", instance: "socketToggle1" },
          { type: "devices.capabilities.toggle", instance: "socketToggle2" },
          { type: "devices.capabilities.on_off", instance: "powerSwitch" },
        ],
      },
    ]);

    const repository = new GoveeLightRepository("api-key");
    const features = await repository.getToggleFeatures(
      `light:${outlet.deviceId}|${outlet.model}`,
    );

    expect(features).toEqual([
      { name: "Socket 1", instance: "socketToggle1" },
      { name: "Socket 2", instance: "socketToggle2" },
    ]);
  });

  it("forwards a socketToggle command to the API client instead of rejecting it", async () => {
    clientMocks.sendCommand.mockResolvedValue(undefined);

    const repository = new GoveeLightRepository("api-key");
    await repository.toggleRaw(outlet, "socketToggle1", false);

    expect(clientMocks.sendCommand).toHaveBeenCalledWith(
      outlet.deviceId,
      outlet.model,
      expect.objectContaining({ name: "socketToggle1", value: 0 }),
    );
  });

  it("rejects an instance the device does not advertise (authoritative)", async () => {
    // When the capability list is available, validation is by-model: the
    // device advertises only socketToggle1/2, so anything else is rejected —
    // even something with a valid toggle shape.
    clientMocks.getControllableDevices.mockResolvedValue([
      {
        deviceId: outlet.deviceId,
        model: outlet.model,
        capabilities: [
          { type: "devices.capabilities.toggle", instance: "socketToggle1" },
          { type: "devices.capabilities.toggle", instance: "socketToggle2" },
        ],
      },
    ]);

    const repository = new GoveeLightRepository("api-key");

    await expect(
      repository.toggleRaw(outlet, "arbitraryCommand", true),
    ).rejects.toThrow(
      `Device ${outlet.model} does not advertise toggle instance: arbitraryCommand`,
    );
    // A shaped-but-unsupported instance is also rejected by-model.
    await expect(
      repository.toggleRaw(outlet, "ghostToggle", true),
    ).rejects.toThrow(
      `Device ${outlet.model} does not advertise toggle instance: ghostToggle`,
    );
    expect(clientMocks.sendCommand).not.toHaveBeenCalled();
  });

  it("falls back to the shape guard when the device list is unavailable", async () => {
    // Discovery failed / device not yet known: no capability list to validate
    // against. Degrade to the conservative *Toggle shape check rather than
    // block a possibly-valid press — a shaped instance forwards, garbage does not.
    clientMocks.getControllableDevices.mockRejectedValue(
      new Error("network down"),
    );
    clientMocks.sendCommand.mockResolvedValue(undefined);

    const repository = new GoveeLightRepository("api-key");

    await expect(
      repository.toggleRaw(outlet, "arbitraryCommand", true),
    ).rejects.toThrow("Rejected unknown toggle instance: arbitraryCommand");
    expect(clientMocks.sendCommand).not.toHaveBeenCalled();

    await repository.toggleRaw(outlet, "nightlightToggle", true);
    expect(clientMocks.sendCommand).toHaveBeenCalledWith(
      outlet.deviceId,
      outlet.model,
      expect.objectContaining({ name: "nightlightToggle", value: 1 }),
    );
  });

  it("invariant: every feature the picker offers is one toggleRaw accepts", async () => {
    // The #261 bug was a contract break between the two halves of the action:
    // getToggleFeatures surfaced socketToggle1, but toggleRaw rejected it, so
    // the press silently no-op'd. Lock the contract: anything the picker shows
    // must be forwardable.
    clientMocks.getControllableDevices.mockResolvedValue([
      {
        deviceId: outlet.deviceId,
        model: outlet.model,
        capabilities: [
          { type: "devices.capabilities.toggle", instance: "nightlightToggle" },
          { type: "devices.capabilities.toggle", instance: "socketToggle1" },
          { type: "devices.capabilities.toggle", instance: "socketToggle2" },
        ],
      },
    ]);
    clientMocks.sendCommand.mockResolvedValue(undefined);

    const repository = new GoveeLightRepository("api-key");
    const features = await repository.getToggleFeatures(
      `light:${outlet.deviceId}|${outlet.model}`,
    );
    expect(features.length).toBeGreaterThan(0);

    for (const feature of features) {
      await expect(
        repository.toggleRaw(outlet, feature.instance, true),
      ).resolves.not.toThrow();
    }
    expect(clientMocks.sendCommand).toHaveBeenCalledTimes(features.length);
  });
});

describe("GoveeLightRepository named lighting toggles (issue #270)", () => {
  // H60B0 Uplighter Floor Lamp advertises rippleLightToggle, sideLightToggle,
  // bottomLightToggle — named (non-indexed) toggles outside the old curated
  // set. They surfaced in the picker but every press was rejected before the
  // by-model validation. Lock the contract for this device class too.
  const lamp = {
    deviceId: "11:22:33:44:55:66:77:88",
    model: "H60B0",
    name: "Uplighter Floor Lamp",
    updateState: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards every advertised light toggle the picker offers", async () => {
    clientMocks.getControllableDevices.mockResolvedValue([
      {
        deviceId: lamp.deviceId,
        model: lamp.model,
        capabilities: [
          { type: "devices.capabilities.toggle", instance: "rippleLightToggle" },
          { type: "devices.capabilities.toggle", instance: "sideLightToggle" },
          { type: "devices.capabilities.toggle", instance: "bottomLightToggle" },
          { type: "devices.capabilities.on_off", instance: "powerSwitch" },
        ],
      },
    ]);
    clientMocks.sendCommand.mockResolvedValue(undefined);

    const repository = new GoveeLightRepository("api-key");

    const features = await repository.getToggleFeatures(
      `light:${lamp.deviceId}|${lamp.model}`,
    );
    expect(features).toEqual([
      { name: "Ripple Light", instance: "rippleLightToggle" },
      { name: "Side Light", instance: "sideLightToggle" },
      { name: "Bottom Light", instance: "bottomLightToggle" },
    ]);

    for (const feature of features) {
      await expect(
        repository.toggleRaw(lamp, feature.instance, true),
      ).resolves.not.toThrow();
    }
    expect(clientMocks.sendCommand).toHaveBeenCalledTimes(features.length);
    expect(clientMocks.sendCommand).toHaveBeenCalledWith(
      lamp.deviceId,
      lamp.model,
      expect.objectContaining({ name: "rippleLightToggle", value: 1 }),
    );
  });
});
