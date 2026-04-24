import { streamDeck } from "@elgato/streamdeck";
import { EffectPlayer } from "../domain/services/EffectPlayer";
import { EffectPresets } from "../domain/services/EffectPresets";
import { RgbEffect } from "../domain/entities/RgbEffect";
import { EffectFrame } from "../domain/value-objects/EffectFrame";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { SegmentColor } from "../domain/value-objects/SegmentColor";
import { ActionServices } from "../actions/shared/ActionServices";
import { globalSettingsService } from "./GlobalSettingsService";

/**
 * Plugin-level service coordinating RGB effect playback.
 * Converts EffectFrames to SegmentColor commands and sends to lights.
 */
class EffectServiceImpl {
  private actionServices = new ActionServices();
  private player: EffectPlayer;

  constructor() {
    this.player = new EffectPlayer((targetId, frame) =>
      this.renderFrame(targetId, frame),
    );
  }

  /**
   * Start playing an effect on a target light.
   */
  async playEffect(targetId: string, effect: RgbEffect): Promise<void> {
    const apiKey = await globalSettingsService.getApiKey();
    if (!apiKey) {
      throw new Error("No API key configured");
    }
    await this.actionServices.ensureServices(apiKey);
    await this.player.play(targetId, effect);
  }

  cancel(targetId: string): boolean {
    return this.player.cancel(targetId);
  }

  isPlaying(targetId: string): boolean {
    return this.player.isPlaying(targetId);
  }

  getPresets(): RgbEffect[] {
    return EffectPresets.getAll();
  }

  getPresetById(id: string): RgbEffect | undefined {
    return this.getPresets().find((p) => p.id === id);
  }

  /**
   * Apply a single frame to the target light by converting per-segment
   * colors to SegmentColor commands.
   */
  private async renderFrame(
    targetId: string,
    frame: EffectFrame,
  ): Promise<void> {
    const target = await this.actionServices.resolveTarget({
      selectedDeviceId: targetId,
    });
    if (!target || target.type !== "light" || !target.light) {
      streamDeck.logger?.warn(
        `Effect frame skipped: ${targetId} is not a valid light target`,
      );
      return;
    }

    const segments = frame.segmentColors.map((hex, index) =>
      SegmentColor.create(index, ColorRgb.fromHex(hex)),
    );

    try {
      await this.actionServices.setSegmentColors(target.light, segments);
    } catch (error) {
      streamDeck.logger?.warn("Failed to render effect frame:", error);
    }
  }
}

export const effectService = new EffectServiceImpl();
