import { Light } from "../entities/Light";
import { LightGroup } from "../entities/LightGroup";
import { Scene } from "../value-objects/Scene";
import { ILightRepository } from "../repositories/ILightRepository";
import { SceneMapper } from "../../infrastructure/mappers/SceneMapper";

/**
 * Domain service for scene-related operations
 */
export class SceneService {
  constructor(private readonly lightRepository: ILightRepository) {}

  /**
   * Apply a scene to a single light
   */
  async applySceneToLight(light: Light, scene: Scene): Promise<void> {
    if (!light.canBeControlled()) {
      throw new Error(
        `${light.name} is offline and cannot be controlled`
      );
    }

    if (!light.supportsScenes()) {
      throw new Error(
        `${light.name} does not support scene control`
      );
    }

    await this.lightRepository.applyScene(light, scene);
  }

  /**
   * Apply a scene to all lights in a group that support scenes
   */
  async applySceneToGroup(group: LightGroup, scene: Scene): Promise<void> {
    const sceneLights = group.lights.filter(
      (light) => light.supportsScenes() && light.canBeControlled()
    );

    if (sceneLights.length === 0) {
      throw new Error(
        `${group.name} has no lights with scene support`
      );
    }

    const promises = sceneLights.map((light) =>
      this.lightRepository.applyScene(light, scene)
    );

    await Promise.all(promises);
  }

  /**
   * Get all available predefined scenes for a light
   * Only returns scenes that are supported by the Govee API
   */
  getAvailableScenes(light: Light): Scene[] {
    if (!light.supportsScenes()) {
      return [];
    }

    // Get all predefined scenes and filter to only API-supported ones
    const allScenes = [
      Scene.sunrise(),
      Scene.sunset(),
      Scene.rainbow(),
      Scene.aurora(),
      Scene.movie(),
      Scene.reading(),
      Scene.nightlight(),
    ];

    return allScenes.filter((scene) => SceneMapper.isSupported(scene));
  }

  /**
   * Check if a scene can be applied to a light
   */
  canApplyScene(light: Light): boolean {
    return light.supportsScenes() && light.canBeControlled();
  }
}
