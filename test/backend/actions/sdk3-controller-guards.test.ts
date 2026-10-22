import { describe, expect, it, vi } from "vitest";
import { OnOffAction } from "../../../src/backend/actions/OnOffAction";
import { RecallAction } from "../../../src/backend/actions/RecallAction";
import { ToggleAction } from "../../../src/backend/actions/ToggleAction";
import { MusicModeAction } from "../../../src/backend/actions/MusicModeAction";
import { SceneAction } from "../../../src/backend/actions/SceneAction";
import { SnapshotAction } from "../../../src/backend/actions/SnapshotAction";
import { ScheduleAction } from "../../../src/backend/actions/ScheduleAction";
import { SequenceAction } from "../../../src/backend/actions/SequenceAction";
import { CustomEffectAction } from "../../../src/backend/actions/CustomEffectAction";

describe("SDK 3 keypad controller boundaries", () => {
  it.each([
    OnOffAction,
    RecallAction,
    ToggleAction,
    MusicModeAction,
    SceneAction,
    SnapshotAction,
    ScheduleAction,
    SequenceAction,
    CustomEffectAction,
  ])(
    "%s ignores non-key appearance/settings without rendering or starting work",
    async (Action) => {
      const instance = new Action();
      const services = (
        instance as unknown as {
          services: { getApiKey: () => Promise<string | undefined> };
        }
      ).services;
      const getKey = vi.spyOn(services, "getApiKey");
      const action = { id: "neo", isKey: () => false };
      const event = {
        action,
        payload: { settings: { selectedDeviceId: "light:private|H6022" } },
      };
      await expect(
        instance.onWillAppear(event as never),
      ).resolves.toBeUndefined();
      await expect(
        instance.onDidReceiveSettings(event as never),
      ).resolves.toBeUndefined();
      expect(getKey).not.toHaveBeenCalled();
    },
  );
});
