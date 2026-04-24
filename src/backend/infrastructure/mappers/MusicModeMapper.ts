/**
 * MusicModeMapper - Maps domain MusicModeConfig to govee-api-client MusicMode
 *
 * Handles conversion between domain layer music mode configuration (string-based modes)
 * and Govee API MusicMode objects (numeric mode IDs).
 *
 * Official Govee API Mode IDs (from developer.govee.com):
 * - Rhythm: 3
 * - Energic: 5
 * - Spectrum: 4
 * - Rolling: 6
 */

import {
  MusicModeConfig,
  MusicModeType,
} from "../../domain/value-objects/MusicModeConfig";
import { MusicMode } from "@felixgeelhaar/govee-api-client";

/**
 * Maps domain MusicModeConfig to govee-api-client MusicMode
 *
 * @param config - Domain music mode configuration
 * @returns MusicMode instance for Govee API
 *
 * @example
 * const config = MusicModeConfig.rhythm();
 * const apiMode = MusicModeMapper.toApiMusicMode(config);
 * // Returns: MusicMode with modeId=3, sensitivity=50
 */
export class MusicModeMapper {
  /**
   * Official Govee API mode ID mapping
   * Source: developer.govee.com/reference/control-you-devices
   */
  private static readonly MODE_ID_MAP: Record<MusicModeType, number> = {
    rhythm: 3,
    energic: 5,
    spectrum: 4,
    rolling: 6,
  };

  /**
   * Convert domain MusicModeConfig to API MusicMode
   *
   * Note: The autoColor property from MusicModeConfig is not included in the
   * MusicMode constructor. According to official Govee API documentation,
   * autoColor is a separate field in the capability payload (0 or 1).
   * This should be handled at the repository level when constructing the
   * full API request.
   */
  static toApiMusicMode(config: MusicModeConfig): MusicMode {
    const modeId = this.MODE_ID_MAP[config.mode];

    if (modeId === undefined) {
      throw new Error(`Unknown music mode: ${config.mode}`);
    }

    return new MusicMode(modeId, config.sensitivity);
  }
}
