import { LoopMode, RgbEffect } from "../entities/RgbEffect";
import { EffectFrame } from "../value-objects/EffectFrame";

export type EffectFrameHandler = (
  targetId: string,
  frame: EffectFrame,
) => Promise<void>;

interface PlaybackState {
  cancelled: boolean;
  currentTimer?: NodeJS.Timeout;
  resolveDelay?: () => void;
}

interface PlaybackEntry {
  state: PlaybackState;
  /** Resolves once the play-loop for this target has fully exited. */
  done: Promise<void>;
}

/**
 * Plays RGB effects on target lights frame-by-frame.
 * Supports concurrent playback on different targets.
 * Handles Once and Loop modes with cancellation support.
 */
export class EffectPlayer {
  private playing = new Map<string, PlaybackEntry>();

  constructor(private readonly frameHandler: EffectFrameHandler) {}

  /**
   * Play an effect on a target. Cancels any existing playback on that target first
   * and waits for it to drain so the new effect doesn't race with the old one.
   */
  async play(targetId: string, effect: RgbEffect): Promise<void> {
    // Cancel any existing playback on this target and wait for it to fully stop.
    await this.cancelAndWait(targetId);

    const state: PlaybackState = { cancelled: false };
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    this.playing.set(targetId, { state, done });

    try {
      do {
        await this.playOnce(targetId, effect, state);
      } while (!state.cancelled && effect.loopMode === LoopMode.Loop);
    } finally {
      this.playing.delete(targetId);
      resolveDone();
    }
  }

  /**
   * Cancel playback on a specific target. Returns true if a playback was running.
   * Fire-and-forget: the play-loop exits on its next iteration. Use
   * {@link cancelAndWait} if you need to know when the last in-flight frame
   * has finished.
   */
  cancel(targetId: string): boolean {
    const entry = this.playing.get(targetId);
    if (!entry) return false;

    entry.state.cancelled = true;
    if (entry.state.currentTimer) {
      clearTimeout(entry.state.currentTimer);
      entry.state.currentTimer = undefined;
    }
    if (entry.state.resolveDelay) {
      entry.state.resolveDelay();
      entry.state.resolveDelay = undefined;
    }
    return true;
  }

  /**
   * Cancel playback and await the play-loop fully exiting. Resolves immediately
   * if nothing is playing on the target. Returns true when a playback was cancelled.
   *
   * Needed because in-flight frames can still land on the device after a plain
   * cancel() — if a user then turns the light off, that trailing frame can
   * re-wake the light. Callers that issue a follow-up command (power, color,
   * scene, etc.) should await this so the effect fully drains first.
   */
  async cancelAndWait(targetId: string): Promise<boolean> {
    const entry = this.playing.get(targetId);
    if (!entry) return false;
    this.cancel(targetId);
    await entry.done;
    return true;
  }

  isPlaying(targetId: string): boolean {
    return this.playing.has(targetId);
  }

  /**
   * Play one iteration of the effect.
   */
  private async playOnce(
    targetId: string,
    effect: RgbEffect,
    state: PlaybackState,
  ): Promise<void> {
    let previousTiming = 0;
    for (const frame of effect.frames) {
      if (state.cancelled) return;

      const waitMs = frame.timingMs - previousTiming;
      if (waitMs > 0) {
        await this.waitFor(state, waitMs);
      }
      if (state.cancelled) return;

      await this.dispatchFrame(targetId, frame);
      previousTiming = frame.timingMs;
    }
  }

  private async dispatchFrame(
    targetId: string,
    frame: EffectFrame,
  ): Promise<void> {
    try {
      await this.frameHandler(targetId, frame);
    } catch {
      // Swallow frame errors — continue animation
    }
  }

  private waitFor(state: PlaybackState, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (state.cancelled) {
        resolve();
        return;
      }
      state.resolveDelay = resolve;
      state.currentTimer = setTimeout(() => {
        state.currentTimer = undefined;
        state.resolveDelay = undefined;
        resolve();
      }, ms);
    });
  }
}
