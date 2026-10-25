import { streamDeck } from "@elgato/streamdeck";
import { EffectPlayer } from "../domain/services/EffectPlayer";
import { EffectPresets } from "../domain/services/EffectPresets";
import { RgbEffect } from "../domain/entities/RgbEffect";
import { EffectFrame } from "../domain/value-objects/EffectFrame";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { SegmentColor } from "../domain/value-objects/SegmentColor";
import {
  ActionServices,
  registerEffectCanceller,
} from "../actions/shared/ActionServices";
import { globalSettingsService } from "./GlobalSettingsService";

/**
 * Plugin-level service coordinating RGB effect playback.
 * Converts EffectFrames to SegmentColor commands and sends to lights.
 */
class EffectServiceImpl {
  private actionServices = new ActionServices();
  private player: EffectPlayer;
  /**
   * Group effects play as one playback per member, keyed by the member's
   * light id, so a command to one light stops the effect on that light
   * only. This maps a group id to the member ids it started.
   */
  private groupMembers = new Map<string, string[]>();

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
    if (!targetId.startsWith("group:")) {
      await this.player.play(targetId, effect);
      return;
    }
    await this.cancelAndWait(targetId);
    const members = await this.segmentedMembers(targetId);
    if (members.length === 0)
      throw new Error("No light in this group has segments");
    this.groupMembers.set(targetId, members);
    try {
      await Promise.all(members.map((id) => this.player.play(id, effect)));
    } finally {
      if (this.groupMembers.get(targetId) === members)
        this.groupMembers.delete(targetId);
    }
  }

  /** Light ids of the group's members that can play effects (have segments). */
  async segmentedMembers(groupId: string): Promise<string[]> {
    const target = await this.actionServices.resolveTarget({
      selectedDeviceId: groupId,
    });
    if (target?.type !== "group" || !target.group) return [];
    const ids = target.group.lights.map(
      (light) => `light:${light.deviceId}|${light.model}`,
    );
    // Stored group members carry no capabilities; resolve each light.
    const capable = await Promise.all(
      ids.map(async (id) => {
        const member = await this.actionServices.resolveTarget({
          selectedDeviceId: id,
        });
        return (
          member?.type === "light" && member.light?.supportsSegmentedColor()
        );
      }),
    );
    return ids.filter((_, index) => capable[index]);
  }

  private playbackIds(targetId: string): string[] {
    return this.groupMembers.get(targetId) ?? [targetId];
  }

  cancel(targetId: string): boolean {
    return this.playbackIds(targetId)
      .map((id) => this.player.cancel(id))
      .some(Boolean);
  }

  /**
   * Cancel playback and wait for the play-loop to fully drain. Callers issuing
   * a follow-up device command (power off, color change, scene apply, etc.)
   * must await this so the last in-flight frame can't re-wake the light after
   * the follow-up has landed.
   */
  async cancelAndWait(targetId: string): Promise<boolean> {
    const stopped = await Promise.all(
      this.playbackIds(targetId).map((id) => this.player.cancelAndWait(id)),
    );
    return stopped.some(Boolean);
  }

  isPlaying(targetId: string): boolean {
    return this.playbackIds(targetId).some((id) => this.player.isPlaying(id));
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
   *
   * Bypasses `ActionServices.setSegmentColors` and goes straight to the repo
   * so the "cancel active effect before user command" guard on the public
   * setSegmentColors path doesn't self-cancel this very playback loop.
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

    const repo = this.actionServices.lightRepository;
    if (!repo) {
      streamDeck.logger?.warn(
        "Effect frame skipped: light repository not initialized",
      );
      return;
    }

    try {
      await repo.setSegmentColors(target.light, segments);
    } catch (error) {
      streamDeck.logger?.warn("Failed to render effect frame:", error);
    }
  }
}

export const effectService = new EffectServiceImpl();

// Register the late-bound cancel hook that ActionServices chokepoints call
// before issuing user commands, so in-flight effect frames drain before a
// follow-up power/color/scene/etc. command lands on the device.
registerEffectCanceller((targetId) => effectService.cancelAndWait(targetId));
