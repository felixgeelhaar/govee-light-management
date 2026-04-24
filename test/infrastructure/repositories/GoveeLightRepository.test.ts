import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoveeLightRepository } from "../../../src/backend/infrastructure/repositories/GoveeLightRepository";

const clientMocks = vi.hoisted(() => ({
  getDiyScenes: vi.fn(),
  setDiyScene: vi.fn(),
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
