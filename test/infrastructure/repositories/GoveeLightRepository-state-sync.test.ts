import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoveeLightRepository } from "../../../src/backend/infrastructure/repositories/GoveeLightRepository";
import { Brightness } from "../../../src/backend/domain/value-objects/Brightness";
import { ColorRgb } from "../../../src/backend/domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../../src/backend/domain/value-objects/ColorTemperature";
import { SegmentColor } from "../../../src/backend/domain/value-objects/SegmentColor";
import { MusicModeConfig } from "../../../src/backend/domain/value-objects/MusicModeConfig";
import { DynamicSceneOption } from "../../../src/backend/domain/value-objects/DynamicSceneOption";
import { DiySceneOption } from "../../../src/backend/domain/value-objects/DiySceneOption";
import { SnapshotOption } from "../../../src/backend/domain/value-objects/SnapshotOption";
import { MusicModeOption } from "../../../src/backend/domain/value-objects/MusicModeOption";

const clientMocks = vi.hoisted(() => ({
  turnOn: vi.fn(),
  turnOff: vi.fn(),
  setBrightness: vi.fn(),
  setColor: vi.fn(),
  setColorTemperature: vi.fn(),
  setLightScene: vi.fn(),
  setDiyScene: vi.fn(),
  setSnapshot: vi.fn(),
  setSegmentColors: vi.fn(),
  setMusicMode: vi.fn(),
  setNightlightToggle: vi.fn(),
  setGradientToggle: vi.fn(),
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
    turnOn = clientMocks.turnOn;
    turnOff = clientMocks.turnOff;
    setBrightness = clientMocks.setBrightness;
    setColor = clientMocks.setColor;
    setColorTemperature = clientMocks.setColorTemperature;
    setLightScene = clientMocks.setLightScene;
    setDiyScene = clientMocks.setDiyScene;
    setSnapshot = clientMocks.setSnapshot;
    setSegmentColors = clientMocks.setSegmentColors;
    setMusicMode = clientMocks.setMusicMode;
    setNightlightToggle = clientMocks.setNightlightToggle;
    setGradientToggle = clientMocks.setGradientToggle;
    sendCommand = clientMocks.sendCommand;
  }

  return {
    GoveeClient: MockGoveeClient,
    Brightness: MockBrightness,
    ColorRgb: MockColorRgb,
    ColorTemperature: MockColorTemperature,
    LightScene: MockLightScene,
    DiyScene: MockDiyScene,
    Snapshot: MockSnapshot,
    MusicMode: MockMusicMode,
    SegmentColor: MockSegmentColor,
  };
});

describe("GoveeLightRepository cross-action state sync (regression #228)", () => {
  const createLight = () => ({
    deviceId: "AA:BB:CC:DD:EE:FF:00:11",
    model: "H1234",
    name: "Test Light",
    updateState: vi.fn(),
  } as any);

  let light: ReturnType<typeof createLight>;

  beforeEach(() => {
    vi.clearAllMocks();
    light = createLight();
  });

  describe("setBrightness", () => {
    it("sets isOn=true when brightness > 0", async () => {
      clientMocks.setBrightness.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.setBrightness(light, new Brightness(50));
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });

    it("sets isOn=false when brightness = 0", async () => {
      clientMocks.turnOff.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.setBrightness(light, new Brightness(0));
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: false }),
      );
    });
  });

  describe("setColor", () => {
    it("sets isOn=true after sending color", async () => {
      clientMocks.setColor.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.setColor(light, new ColorRgb(255, 0, 0));
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("setColorTemperature", () => {
    it("sets isOn=true after sending color temperature", async () => {
      clientMocks.setColorTemperature.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.setColorTemperature(light, new ColorTemperature(4000));
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("setLightScene", () => {
    it("sets isOn=true after applying scene", async () => {
      clientMocks.setLightScene.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      const scene = DynamicSceneOption.create(1, 1, "Sunrise");
      await repo.setLightScene(light, scene);
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("setDiyScene", () => {
    it("sets isOn=true after applying DIY scene", async () => {
      clientMocks.setDiyScene.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      const scene = DiySceneOption.create(1, 1, "Custom");
      await repo.setDiyScene(light, scene);
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("applySnapshot", () => {
    it("sets isOn=true after applying snapshot", async () => {
      clientMocks.setSnapshot.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      const snapshot = SnapshotOption.create(1, 1, "Reading");
      await repo.applySnapshot(light, snapshot);
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("setSegmentColors", () => {
    it("sets isOn=true after sending segment colors", async () => {
      clientMocks.setSegmentColors.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      const segments = [SegmentColor.create(0, new ColorRgb(255, 0, 0))];
      await repo.setSegmentColors(light, segments);
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("setMusicModeRaw", () => {
    it("sets isOn=true after setting music mode", async () => {
      clientMocks.setMusicMode.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      const mode = MusicModeOption.create(3, 50);
      await repo.setMusicModeRaw(light, mode);
      expect(light.updateState).toHaveBeenCalledWith(
        expect.objectContaining({ isOn: true }),
      );
    });
  });

  describe("toggleNightlight", () => {
    it("does NOT change isOn (feature toggle only)", async () => {
      clientMocks.setNightlightToggle.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.toggleNightlight(light, true);
      expect(light.updateState).not.toHaveBeenCalled();
    });
  });

  describe("toggleGradient", () => {
    it("does NOT change isOn (feature toggle only)", async () => {
      clientMocks.setGradientToggle.mockResolvedValue(undefined);
      const repo = new GoveeLightRepository("key");
      await repo.toggleGradient(light, true);
      expect(light.updateState).not.toHaveBeenCalled();
    });
  });
});
