import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";
import { EffectPlayer } from "../../../src/backend/domain/services/EffectPlayer";
import { effectService } from "../../../src/backend/services/EffectService";
import { globalSettingsService } from "../../../src/backend/services/GlobalSettingsService";

const DESK = "light:desk|H6056";
const BACK = "light:back|H61B5";
const BULB = "light:bulb|H600D";

const light = (id: string, segments: boolean) => {
  const [deviceId, model] = id.slice("light:".length).split("|");
  return {
    deviceId,
    model,
    name: deviceId,
    supportsSegmentedColor: () => segments,
  };
};

/**
 * A group effect plays on each member with segments and skips the rest.
 * Each member runs under its own light id, so a command to one member
 * stops the effect there without touching the others.
 */
describe("custom effects on groups", () => {
  const effect = effectService.getPresets()[0];
  let playing: Map<string, () => void>;
  // Like the real player: play() runs until the effect is cancelled.
  const stop = (id: string) => {
    const finish = playing.get(id);
    playing.delete(id);
    finish?.();
    return Boolean(finish);
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    playing = new Map();
    vi.spyOn(globalSettingsService, "getApiKey").mockResolvedValue("test-key");
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockImplementation(
      async ({ selectedDeviceId }) => {
        if (selectedDeviceId === "group:office")
          return {
            type: "group",
            group: {
              id: "office",
              lights: [
                light(DESK, true),
                light(BACK, true),
                light(BULB, false),
              ],
            },
          } as never;
        if (selectedDeviceId === "group:bulbs")
          return {
            type: "group",
            group: { id: "bulbs", lights: [light(BULB, false)] },
          } as never;
        const id = selectedDeviceId ?? "";
        return { type: "light", light: light(id, id !== BULB) } as never;
      },
    );
    vi.spyOn(EffectPlayer.prototype, "play").mockImplementation(
      (id: string) => new Promise<void>((resolve) => playing.set(id, resolve)),
    );
    vi.spyOn(EffectPlayer.prototype, "isPlaying").mockImplementation((id) =>
      playing.has(id),
    );
    vi.spyOn(EffectPlayer.prototype, "cancelAndWait").mockImplementation(
      async (id) => stop(id),
    );
    vi.spyOn(EffectPlayer.prototype, "cancel").mockImplementation(stop);
  });
  afterEach(() => vi.restoreAllMocks());

  it("plays on every member with segments and skips the others", async () => {
    const run = effectService.playEffect("group:office", effect);
    await flush();
    expect([...playing.keys()].sort()).toEqual([BACK, DESK].sort());
    expect(effectService.isPlaying("group:office")).toBe(true);
    effectService.cancel("group:office");
    await run;
  });

  it("lists the members that can play an effect", async () => {
    expect(await effectService.segmentedMembers("group:office")).toEqual([
      DESK,
      BACK,
    ]);
    expect(await effectService.segmentedMembers("group:bulbs")).toEqual([]);
  });

  it("refuses a group with no light that has segments", async () => {
    await expect(
      effectService.playEffect("group:bulbs", effect),
    ).rejects.toThrow(/segments/);
    expect(playing.size).toBe(0);
  });

  it("stops one member on a command to that light, and all on the group", async () => {
    const run = effectService.playEffect("group:office", effect);
    await flush();
    await effectService.cancelAndWait(DESK);
    expect([...playing.keys()]).toEqual([BACK]);
    expect(effectService.isPlaying("group:office")).toBe(true);
    expect(effectService.cancel("group:office")).toBe(true);
    await run;
    expect(playing.size).toBe(0);
    expect(effectService.isPlaying("group:office")).toBe(false);
  });
});
