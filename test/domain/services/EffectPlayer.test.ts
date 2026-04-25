import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EffectPlayer } from "../../../src/backend/domain/services/EffectPlayer";
import { RgbEffect, LoopMode } from "../../../src/backend/domain/entities/RgbEffect";
import { EffectFrame } from "../../../src/backend/domain/value-objects/EffectFrame";

describe("EffectPlayer", () => {
  let frameHandler: ReturnType<typeof vi.fn>;
  let player: EffectPlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    frameHandler = vi.fn().mockResolvedValue(undefined);
    player = new EffectPlayer(frameHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Once Mode", () => {
    it("should play all frames once", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Test",
        frames: [
          EffectFrame.uniform(0, "#FF0000"),
          EffectFrame.uniform(100, "#00FF00"),
          EffectFrame.uniform(200, "#0000FF"),
        ],
        loopMode: LoopMode.Once,
      });

      const promise = player.play("target-1", effect);
      await vi.runAllTimersAsync();
      await promise;

      expect(frameHandler).toHaveBeenCalledTimes(3);
    });

    it("should pass target and frame to handler", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Test",
        frames: [EffectFrame.uniform(0, "#FF0000")],
        loopMode: LoopMode.Once,
      });

      const promise = player.play("device-xyz", effect);
      await vi.runAllTimersAsync();
      await promise;

      const [targetId, frame] = frameHandler.mock.calls[0];
      expect(targetId).toBe("device-xyz");
      expect(frame.segmentColors[0]).toBe("#FF0000");
    });
  });

  describe("Loop Mode", () => {
    it("should loop until cancelled", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Loop",
        frames: [
          EffectFrame.uniform(0, "#FF0000"),
          EffectFrame.uniform(100, "#00FF00"),
        ],
        loopMode: LoopMode.Loop,
      });

      const promise = player.play("target-1", effect);
      await vi.advanceTimersByTimeAsync(500);

      // After 500ms and 100ms loop duration, should have played multiple iterations
      expect(frameHandler.mock.calls.length).toBeGreaterThan(2);

      player.cancel("target-1");
      await vi.runAllTimersAsync();
      await promise;
    });
  });

  describe("Cancellation", () => {
    it("should stop playback when cancelled", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Test",
        frames: [
          EffectFrame.uniform(0, "#FF0000"),
          EffectFrame.uniform(1000, "#00FF00"),
          EffectFrame.uniform(2000, "#0000FF"),
        ],
        loopMode: LoopMode.Once,
      });

      const promise = player.play("target-1", effect);
      await vi.advanceTimersByTimeAsync(100);
      player.cancel("target-1");
      await vi.runAllTimersAsync();
      await promise;

      expect(frameHandler).toHaveBeenCalledTimes(1);
    });

    it("should report running state", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Test",
        frames: [
          EffectFrame.uniform(0, "#FF0000"),
          EffectFrame.uniform(5000, "#00FF00"),
        ],
        loopMode: LoopMode.Once,
      });

      expect(player.isPlaying("target-1")).toBe(false);
      const promise = player.play("target-1", effect);
      await vi.advanceTimersByTimeAsync(100);
      expect(player.isPlaying("target-1")).toBe(true);

      player.cancel("target-1");
      await vi.runAllTimersAsync();
      await promise;
      expect(player.isPlaying("target-1")).toBe(false);
    });
  });

  describe("cancelAndWait drain", () => {
    it("resolves only after the play loop fully exits", async () => {
      const effect = RgbEffect.create({
        id: "e1",
        name: "Loop",
        frames: [
          EffectFrame.uniform(0, "#FF0000"),
          EffectFrame.uniform(200, "#00FF00"),
        ],
        loopMode: LoopMode.Loop,
      });

      const playPromise = player.play("target-1", effect);
      // Let a couple of iterations dispatch so the play loop is deep inside.
      await vi.advanceTimersByTimeAsync(500);

      const cancelPromise = player.cancelAndWait("target-1");
      // Before draining: target is still marked as playing.
      expect(player.isPlaying("target-1")).toBe(true);

      await vi.runAllTimersAsync();
      const result = await cancelPromise;
      await playPromise;

      // After drain: target is fully stopped, no further frames could land.
      expect(result).toBe(true);
      expect(player.isPlaying("target-1")).toBe(false);
    });

    it("resolves immediately with false when nothing is playing", async () => {
      const result = await player.cancelAndWait("nothing-here");
      expect(result).toBe(false);
    });
  });

  describe("Independent Targets", () => {
    it("should play different effects on different targets", async () => {
      const effectA = RgbEffect.create({
        id: "eA",
        name: "A",
        frames: [EffectFrame.uniform(0, "#FF0000")],
      });
      const effectB = RgbEffect.create({
        id: "eB",
        name: "B",
        frames: [EffectFrame.uniform(0, "#00FF00")],
      });

      const a = player.play("target-A", effectA);
      const b = player.play("target-B", effectB);
      await vi.runAllTimersAsync();
      await Promise.all([a, b]);

      const callsA = frameHandler.mock.calls.filter(
        (c) => c[0] === "target-A",
      );
      const callsB = frameHandler.mock.calls.filter(
        (c) => c[0] === "target-B",
      );
      expect(callsA).toHaveLength(1);
      expect(callsB).toHaveLength(1);
    });
  });
});
