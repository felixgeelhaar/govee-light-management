/**
 * SceneMapper - Maps domain Scene value objects to govee-api-client LightScene
 *
 * Handles conversion between domain layer scene representations (code-based)
 * and Govee API LightScene objects (ID-based).
 */

import { Scene } from "../../domain/value-objects/Scene";
import { LightScene } from "@felixgeelhaar/govee-api-client";

/**
 * Maps domain Scene to govee-api-client LightScene
 *
 * @param scene - Domain scene value object
 * @returns LightScene instance for Govee API
 * @throws Error if scene code is not supported by Govee API
 *
 * @example
 * const domainScene = Scene.sunrise();
 * const apiScene = SceneMapper.toApiLightScene(domainScene);
 * // Returns: LightScene with id=3853, paramId=4280
 */
export class SceneMapper {
  /**
   * Convert domain Scene to API LightScene
   */
  static toApiLightScene(scene: Scene): LightScene {
    switch (scene.id) {
      case "sunrise":
        return LightScene.sunrise();

      case "sunset":
        return LightScene.sunset();

      case "rainbow":
        return LightScene.rainbow();

      case "aurora":
        return LightScene.aurora();

      case "nightlight":
        return LightScene.nightlight();

      // Unsupported scenes from domain layer
      case "movie":
        throw new Error(
          'Scene "movie" is not supported by Govee API. ' +
            'Consider using "candlelight" (LightScene.candlelight()) as an alternative.',
        );

      case "reading":
        throw new Error(
          'Scene "reading" is not supported by Govee API. ' +
            "Consider using warm white color temperature instead.",
        );

      default:
        throw new Error(`Unknown scene ID: ${scene.id}`);
    }
  }

  /**
   * Get all supported API scenes
   *
   * Returns factory methods for all LightScene presets available in govee-api-client.
   * This includes scenes not currently in the domain layer.
   *
   * @returns Array of all available LightScene instances
   */
  static getAllApiScenes(): LightScene[] {
    return [
      LightScene.sunrise(),
      LightScene.sunset(),
      LightScene.rainbow(),
      LightScene.aurora(),
      LightScene.candlelight(),
      LightScene.nightlight(),
      LightScene.romantic(),
      LightScene.blinking(),
    ];
  }

  /**
   * Check if a domain scene is supported by the API
   *
   * @param scene - Domain scene to check
   * @returns true if scene can be mapped to API, false otherwise
   */
  static isSupported(scene: Scene): boolean {
    const supportedIds = [
      "sunrise",
      "sunset",
      "rainbow",
      "aurora",
      "nightlight",
    ];
    return supportedIds.includes(scene.id);
  }

  /**
   * Get supported domain scene IDs
   *
   * @returns Array of scene IDs that can be mapped to API
   */
  static getSupportedSceneCodes(): string[] {
    return ["sunrise", "sunset", "rainbow", "aurora", "nightlight"];
  }
}
