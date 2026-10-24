import { afterEach, describe, expect, it, vi } from "vitest";
import { streamDeck } from "@elgato/streamdeck";
import { OnOffAction } from "../../../src/backend/actions/OnOffAction";
import { BrightnessAction } from "../../../src/backend/actions/BrightnessAction";
import { ColorAction } from "../../../src/backend/actions/ColorAction";
import { ColorTemperatureAction } from "../../../src/backend/actions/ColorTemperatureAction";
import { SegmentColorAction } from "../../../src/backend/actions/SegmentColorAction";
import { SaturationDialAction } from "../../../src/backend/actions/SaturationDialAction";
import { RecallAction } from "../../../src/backend/actions/RecallAction";
import { SceneAction } from "../../../src/backend/actions/SceneAction";
import { SnapshotAction } from "../../../src/backend/actions/SnapshotAction";
import { MusicModeAction } from "../../../src/backend/actions/MusicModeAction";
import { ToggleAction } from "../../../src/backend/actions/ToggleAction";
import { ScheduleAction } from "../../../src/backend/actions/ScheduleAction";
import { SequenceAction } from "../../../src/backend/actions/SequenceAction";
import { CustomEffectAction } from "../../../src/backend/actions/CustomEffectAction";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";

/**
 * Pressing an unconfigured key shows the host alert. On hardware (2026-10-24)
 * only On/Off also logged why; the other actions left nothing, so a user's
 * log could not tell "never pressed" from "pressed but not set up".
 */
describe("unconfigured key presses", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(
    [
      OnOffAction,
      BrightnessAction,
      ColorAction,
      ColorTemperatureAction,
      SegmentColorAction,
      SaturationDialAction,
      RecallAction,
      SceneAction,
      SnapshotAction,
      MusicModeAction,
      ToggleAction,
      ScheduleAction,
      SequenceAction,
      CustomEffectAction,
    ].map((Action) => [Action.name, Action] as const),
  )("%s logs why the press was ignored and alerts", async (_name, Action) => {
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      undefined,
    );
    const warn = vi.spyOn(streamDeck.logger, "warn");
    const action = {
      id: "ctx-1",
      manifestId: "com.felixgeelhaar.govee-light-management.test",
      isKey: () => true,
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      setImage: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn().mockResolvedValue(undefined),
    };

    await new Action().onKeyDown({
      action,
      payload: { settings: {} },
    } as never);

    expect(action.showAlert).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).startsWith("Key press ignored: not configured"),
      ),
    ).toBe(true);
  });
});
