import { describe, it, expect, beforeEach, vi } from "vitest";
import { SceneService } from "../../../src/backend/domain/services/SceneService";
import { Light, LightState } from "../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../src/backend/domain/entities/LightGroup";
import { Scene } from "../../../src/backend/domain/value-objects/Scene";
import { ILightRepository } from "../../../src/backend/domain/repositories/ILightRepository";

describe("SceneService", () => {
  let sceneService: SceneService;
  let mockRepository: ILightRepository;
  let testLight: Light;
  let testLightWithoutScenes: Light;
  let testGroup: LightGroup;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getAllLights: vi.fn(),
      findLight: vi.fn(),
      findLightsByName: vi.fn(),
      setPower: vi.fn(),
      setBrightness: vi.fn(),
      setColor: vi.fn(),
      setColorTemperature: vi.fn(),
      turnOnWithBrightness: vi.fn(),
      turnOnWithColor: vi.fn(),
      turnOnWithColorTemperature: vi.fn(),
      getLightState: vi.fn(),
      applyScene: vi.fn(),
      setSegmentColors: vi.fn(),
      setMusicMode: vi.fn(),
      toggleNightlight: vi.fn(),
      toggleGradient: vi.fn(),
    } as unknown as ILightRepository;

    sceneService = new SceneService(mockRepository);

    // Create test light with scene support
    const stateWithScenes: LightState = {
      isOn: true,
      isOnline: true,
      brightness: undefined,
      color: undefined,
      colorTemperature: undefined,
    };
    testLight = Light.create(
      "device-1",
      "H6143",
      "Test Light",
      stateWithScenes,
      {
        brightness: true,
        color: true,
        colorTemperature: true,
        scenes: true, // Supports scenes
        segmentedColor: false,
        musicMode: false,
        nightlight: false,
        gradient: false,
      }
    );

    // Create test light without scene support
    const stateWithoutScenes: LightState = {
      isOn: true,
      isOnline: true,
      brightness: undefined,
      color: undefined,
      colorTemperature: undefined,
    };
    testLightWithoutScenes = Light.create(
      "device-2",
      "H6102",
      "Basic Light",
      stateWithoutScenes,
      {
        brightness: true,
        color: false,
        colorTemperature: false,
        scenes: false, // No scene support
        segmentedColor: false,
        musicMode: false,
        nightlight: false,
        gradient: false,
      }
    );

    // Create test group with both lights
    testGroup = LightGroup.create("group-1", "Test Group", [
      testLight,
      testLightWithoutScenes,
    ]);
  });

  describe("applySceneToLight", () => {
    it("should apply a scene to a light that supports scenes", async () => {
      const scene = Scene.sunrise();

      await sceneService.applySceneToLight(testLight, scene);

      expect(mockRepository.applyScene).toHaveBeenCalledWith(testLight, scene);
    });

    it("should throw error if light is offline", async () => {
      const scene = Scene.sunset();
      testLight.updateState({ isOnline: false });

      await expect(
        sceneService.applySceneToLight(testLight, scene)
      ).rejects.toThrow("Test Light is offline and cannot be controlled");
    });

    it("should throw error if light does not support scenes", async () => {
      const scene = Scene.rainbow();

      await expect(
        sceneService.applySceneToLight(testLightWithoutScenes, scene)
      ).rejects.toThrow("Basic Light does not support scene control");
    });

    it("should apply dynamic scenes (sunrise, sunset, rainbow, aurora)", async () => {
      const scenes = [
        Scene.sunrise(),
        Scene.sunset(),
        Scene.rainbow(),
        Scene.aurora(),
      ];

      for (const scene of scenes) {
        await sceneService.applySceneToLight(testLight, scene);
        expect(mockRepository.applyScene).toHaveBeenCalledWith(
          testLight,
          scene
        );
      }
    });

    it("should apply preset scenes (movie, reading, nightlight)", async () => {
      const scenes = [
        Scene.movie(),
        Scene.reading(),
        Scene.nightlight(),
      ];

      for (const scene of scenes) {
        await sceneService.applySceneToLight(testLight, scene);
        expect(mockRepository.applyScene).toHaveBeenCalledWith(
          testLight,
          scene
        );
      }
    });

    it("should apply custom scenes", async () => {
      const customScene = Scene.create("custom-1", "My Custom Scene", "custom");

      await sceneService.applySceneToLight(testLight, customScene);

      expect(mockRepository.applyScene).toHaveBeenCalledWith(
        testLight,
        customScene
      );
    });
  });

  describe("applySceneToGroup", () => {
    it("should apply scene to all lights in group that support scenes", async () => {
      const scene = Scene.sunrise();

      await sceneService.applySceneToGroup(testGroup, scene);

      // Only testLight supports scenes, testLightWithoutScenes should be skipped
      expect(mockRepository.applyScene).toHaveBeenCalledTimes(1);
      expect(mockRepository.applyScene).toHaveBeenCalledWith(testLight, scene);
    });

    it("should throw error if group has no lights with scene support", async () => {
      const groupWithoutScenes = LightGroup.create(
        "group-2",
        "No Scenes Group",
        [testLightWithoutScenes]
      );
      const scene = Scene.rainbow();

      await expect(
        sceneService.applySceneToGroup(groupWithoutScenes, scene)
      ).rejects.toThrow("No Scenes Group has no lights with scene support");
    });

    it("should throw error when all lights with scene support are offline", async () => {
      testLight.updateState({ isOnline: false });
      const scene = Scene.sunset();

      await expect(
        sceneService.applySceneToGroup(testGroup, scene)
      ).rejects.toThrow("Test Group has no lights with scene support");

      // No repository calls should be made
      expect(mockRepository.applyScene).not.toHaveBeenCalled();
    });

    it("should apply scene to multiple lights in parallel", async () => {
      const light2 = Light.create(
        "device-3",
        "H6143",
        "Test Light 2",
        {
          isOn: true,
          isOnline: true,
          brightness: undefined,
          color: undefined,
          colorTemperature: undefined,
        },
        {
          brightness: true,
          color: true,
          colorTemperature: true,
          scenes: true,
          segmentedColor: false,
          musicMode: false,
          nightlight: false,
          gradient: false,
        }
      );

      const groupWithMultipleSceneLights = LightGroup.create(
        "group-3",
        "Multi Scene Group",
        [testLight, light2]
      );

      const scene = Scene.aurora();
      const applySceneSpy = vi.spyOn(mockRepository, "applyScene");

      await sceneService.applySceneToGroup(groupWithMultipleSceneLights, scene);

      expect(applySceneSpy).toHaveBeenCalledTimes(2);
      expect(applySceneSpy).toHaveBeenCalledWith(testLight, scene);
      expect(applySceneSpy).toHaveBeenCalledWith(light2, scene);
    });
  });

  describe("getAvailableScenes", () => {
    it("should return only API-supported scenes for a light with scene support", () => {
      const scenes = sceneService.getAvailableScenes(testLight);

      // Should return only the 5 scenes supported by the Govee API
      // (movie and reading are filtered out as they're not supported)
      expect(scenes).toHaveLength(5);
      expect(scenes.map((s) => s.id)).toEqual([
        "sunrise",
        "sunset",
        "rainbow",
        "aurora",
        "nightlight",
      ]);
    });

    it("should return empty array for light without scene support", () => {
      const scenes = sceneService.getAvailableScenes(testLightWithoutScenes);

      expect(scenes).toHaveLength(0);
    });

    it("should filter out unsupported scenes (movie, reading)", () => {
      const scenes = sceneService.getAvailableScenes(testLight);
      const sceneIds = scenes.map((s) => s.id);

      // Verify that unsupported scenes are not in the list
      expect(sceneIds).not.toContain("movie");
      expect(sceneIds).not.toContain("reading");
    });
  });

  describe("canApplyScene", () => {
    it("should return true if light supports scenes and is online", () => {
      expect(sceneService.canApplyScene(testLight)).toBe(true);
    });

    it("should return false if light does not support scenes", () => {
      expect(sceneService.canApplyScene(testLightWithoutScenes)).toBe(false);
    });

    it("should return false if light is offline", () => {
      testLight.updateState({ isOnline: false });
      expect(sceneService.canApplyScene(testLight)).toBe(false);
    });
  });
});
