import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";
import { RecallAction } from "../../../src/backend/actions/RecallAction";
import { KeypadStateTracker } from "../../../src/backend/actions/shared/KeypadStateTracker";
import { OnOffAction } from "../../../src/backend/actions/OnOffAction";
import { BrightnessAction } from "../../../src/backend/actions/BrightnessAction";
import { BrightnessDialAction } from "../../../src/backend/actions/BrightnessDialAction";
import { ColorAction } from "../../../src/backend/actions/ColorAction";
import { ColorTemperatureAction } from "../../../src/backend/actions/ColorTemperatureAction";
import { ColorTempDialAction } from "../../../src/backend/actions/ColorTempDialAction";
import { ColorHueDialAction } from "../../../src/backend/actions/ColorHueDialAction";
import { SaturationDialAction } from "../../../src/backend/actions/SaturationDialAction";
import { SegmentColorAction } from "../../../src/backend/actions/SegmentColorAction";
import { SegmentColorDialAction } from "../../../src/backend/actions/SegmentColorDialAction";
import { Light } from "../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../src/backend/domain/entities/LightGroup";
const group = () =>
  LightGroup.create("g", "Desk", [
    Light.create("a", "H619A", "Desk", { isOn: true, isOnline: false }),
    Light.create("b", "H607C", "Wall", { isOn: true, isOnline: false }),
  ]);
const action = () => ({
  id: "ctx",
  setTitle: vi.fn().mockResolvedValue(undefined),
  setFeedback: vi.fn().mockResolvedValue(undefined),
  setImage: vi.fn().mockResolvedValue(undefined),
  setState: vi.fn().mockResolvedValue(undefined),
  showOk: vi.fn().mockResolvedValue(undefined),
  showAlert: vi.fn().mockResolvedValue(undefined),
});
const event = (action: ReturnType<typeof action>) =>
  ({ action, payload: { settings: { selectedDeviceId: "group:g" } } }) as never;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue("test-key");
  vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
  vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
    type: "group",
    group: group(),
  });
  vi.spyOn(ActionServices.prototype, "getLivePowerState").mockResolvedValue(
    true,
  );
  vi.spyOn(ActionServices.prototype, "syncLightState").mockResolvedValue(true);
  vi.spyOn(ActionServices.prototype, "controlTarget").mockResolvedValue({
    total: 2,
    failed: [],
  });
  vi.spyOn(ActionServices.prototype, "showSpinner").mockReturnValue(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("#311 offline hints must not gate group power or sampling", () => {
  it("On/Off toggles an on group off even when every cloud online flag is false", async () => {
    await new OnOffAction().onKeyDown(event(action()));
    expect(ActionServices.prototype.getLivePowerState).toHaveBeenCalledTimes(2);
    expect(ActionServices.prototype.controlTarget).toHaveBeenCalledWith(
      expect.anything(),
      "off",
    );
  });
  it("the dial press samples an offline-flagged group and chooses Off", async () => {
    await new BrightnessAction().onDialDown(event(action()));
    expect(ActionServices.prototype.getLivePowerState).toHaveBeenCalled();
    expect(ActionServices.prototype.controlTarget).toHaveBeenCalledWith(
      expect.anything(),
      "off",
    );
  });
  it("On/Off keeps known on state when a live group sample is unavailable", async () => {
    vi.mocked(ActionServices.prototype.getLivePowerState).mockResolvedValue(
      undefined,
    );
    await new OnOffAction().onKeyDown(event(action()));
    expect(ActionServices.prototype.controlTarget).toHaveBeenCalledWith(
      expect.anything(),
      "off",
    );
  });
  it("On/Off live display counts reachable members regardless of their online hint", async () => {
    const key = action();
    await new OnOffAction().onWillAppear(event(key));
    expect(key.setTitle).toHaveBeenLastCalledWith("2/2");
  });
  it("Recall counts the members actually commanded, including offline-flagged lights", async () => {
    vi.spyOn(ActionServices.prototype, "applySnapshot").mockResolvedValue();
    const key = action();
    await new RecallAction().onKeyDown({
      action: key,
      payload: {
        settings: {
          selectedDeviceId: "group:g",
          selectedRecall: JSON.stringify({
            kind: "snapshot",
            id: 0,
            paramId: 0,
            name: "Desk",
          }),
        },
      },
    } as never);
    expect(key.setTitle).toHaveBeenLastCalledWith(
      expect.stringContaining("2/2"),
    );
  });
  it("shared keypad sampling preserves known state when live reads are unavailable", async () => {
    vi.mocked(ActionServices.prototype.getLivePowerState).mockResolvedValue(
      undefined,
    );
    const tracker = new KeypadStateTracker();
    tracker.attach(action() as never, { selectedDeviceId: "group:g" });
    await vi.advanceTimersByTimeAsync(1);
    expect(tracker.getGroupCount("ctx")).toBe("2/2");
    tracker.detach("ctx");
  });
  it.each([
    { name: "Brightness", Action: BrightnessAction },
    { name: "Brightness Dial", Action: BrightnessDialAction },
    { name: "Color", Action: ColorAction },
    { name: "Temperature", Action: ColorTemperatureAction },
    { name: "Temperature Dial", Action: ColorTempDialAction },
    { name: "Hue Dial", Action: ColorHueDialAction },
    { name: "Saturation", Action: SaturationDialAction },
    { name: "Segment", Action: SegmentColorAction },
    { name: "Segment Dial", Action: SegmentColorDialAction },
  ])(
    "$name samples the group's power without an online-hint filter",
    async ({ Action }) => {
      const subject = new Action();
      await subject.onWillAppear(event(action()));
      if (Action === SegmentColorDialAction)
        expect(ActionServices.prototype.getLivePowerState).toHaveBeenCalled();
      expect(
        (subject as unknown as { powerMap: Map<string, boolean> }).powerMap.get(
          "ctx",
        ),
      ).toBe(true);
    },
  );
});
