import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrightnessAction } from "../../../src/backend/actions/BrightnessAction";
import { BrightnessDialAction } from "../../../src/backend/actions/BrightnessDialAction";
import { Light } from "../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../src/backend/domain/entities/LightGroup";
import { Brightness } from "../../../src/backend/domain/value-objects/Brightness";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";
import type {
  WillAppearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";

const light = (name: string) =>
  Light.create("dev-1", "H619A", name, {
    isOn: true,
    isOnline: false,
    brightness: new Brightness(60),
  });
const dial = (id = "dial-1") => ({
  id,
  setFeedback: vi.fn().mockResolvedValue(undefined),
});
const event = (action: ReturnType<typeof dial>, selectedDeviceId?: string) =>
  ({
    action,
    payload: { settings: { selectedDeviceId } },
  }) as unknown as WillAppearEvent;

describe.each([
  { name: "Brightness", Action: BrightnessAction },
  { name: "Legacy brightness", Action: BrightnessDialAction },
])("$name target identification", ({ Action }) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      "test-key",
    );
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(ActionServices.prototype, "syncLightState").mockResolvedValue(
      true,
    );
    vi.spyOn(
      ActionServices.prototype,
      "isDialInteractionActive",
    ).mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("identifies a light while preserving brightness and bar", async () => {
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "light",
      light: light("Desk"),
    });
    const action = dial();
    await new Action().onWillAppear(event(action, "dev-1|H619A"));
    expect(action.setFeedback).toHaveBeenLastCalledWith({
      title: "Desk",
      value: "60%",
      bar: { value: 60 },
    });
  });

  it("identifies a mixed group without replacing its value", async () => {
    const group = LightGroup.create("g1", "Office", []);
    const desk = light("Desk");
    desk.updateState({ isOnline: true });
    group.addLight(desk);
    const off = light("Wall");
    off.updateState({ isOn: false, isOnline: true });
    group.addLight(off);
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "group",
      group,
    });
    const action = dial();
    await new Action().onWillAppear(event(action, "group:g1"));
    expect(action.setFeedback).toHaveBeenLastCalledWith({
      title: "Office",
      value: "≠ 60%",
      bar: { value: 60 },
    });
  });

  it("shows a clear unconfigured fallback", async () => {
    const action = dial();
    await new Action().onWillAppear(event(action));
    expect(action.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Select a light" }),
    );
  });

  it("bounds long names with an ellipsis", async () => {
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "light",
      light: light("A".repeat(40)),
    });
    const action = dial();
    await new Action().onWillAppear(event(action, "dev-1|H619A"));
    expect(action.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "A".repeat(23) + "…" }),
    );
  });

  it("refreshes a renamed target and skips unchanged feedback", async () => {
    const resolve = vi
      .spyOn(ActionServices.prototype, "resolveTarget")
      .mockResolvedValue({ type: "light", light: light("Desk") });
    const action = dial();
    const subject = new Action();
    await subject.onWillAppear(event(action, "dev-1|H619A"));
    await vi.advanceTimersByTimeAsync(3000);
    expect(action.setFeedback).toHaveBeenCalledTimes(1);
    resolve.mockResolvedValue({ type: "light", light: light("New name") });
    await vi.advanceTimersByTimeAsync(3000);
    expect(action.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "New name" }),
    );
  });

  it("clears the previous name when settings select an unavailable target", async () => {
    const resolve = vi
      .spyOn(ActionServices.prototype, "resolveTarget")
      .mockResolvedValue({ type: "light", light: light("Desk") });
    const action = dial();
    const subject = new Action();
    await subject.onWillAppear(event(action, "dev-1|H619A"));
    resolve.mockResolvedValue(null);
    await subject.onDidReceiveSettings(
      event(action, "dev-2|H619A") as unknown as DidReceiveSettingsEvent,
    );
    expect(action.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Light unavailable" }),
    );
  });

  it("preserves rotation and press feedback with the target title", async () => {
    const target = light("Desk");
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "light",
      light: target,
    });
    vi.spyOn(ActionServices.prototype, "deferDialAction").mockImplementation(
      () => {},
    );
    vi.spyOn(ActionServices.prototype, "getLivePowerState").mockResolvedValue(
      true,
    );
    vi.spyOn(ActionServices.prototype, "controlTarget").mockResolvedValue({
      total: 1,
      failed: 0,
    });
    vi.spyOn(
      ActionServices.prototype,
      "verifyLivePowerState",
    ).mockResolvedValue(false);
    const action = dial();
    const subject = new Action();
    await subject.onWillAppear(event(action, "dev-1|H619A"));
    await subject.onDialRotate({
      action,
      payload: { settings: { selectedDeviceId: "dev-1|H619A" }, ticks: 1 },
    } as never);
    expect(action.setFeedback).toHaveBeenLastCalledWith({
      title: "Desk",
      value: "65%",
      bar: { value: 65 },
    });
    await subject.onDialDown(event(action, "dev-1|H619A") as never);
    expect(action.setFeedback).toHaveBeenLastCalledWith({
      title: "Desk",
      value: "Off",
      bar: { value: 0 },
    });
  });

  it("keeps separate stack contexts and re-sends on reappearance", async () => {
    const resolve = vi
      .spyOn(ActionServices.prototype, "resolveTarget")
      .mockResolvedValue({ type: "light", light: light("Desk") });
    const first = dial();
    const second = dial("dial-2");
    const subject = new Action();
    await subject.onWillAppear(event(first, "dev-1|H619A"));
    resolve.mockResolvedValue({ type: "light", light: light("Wall") });
    await subject.onWillAppear(event(second, "dev-2|H619A"));
    expect(first.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Desk" }),
    );
    expect(second.setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Wall" }),
    );
    await subject.onWillDisappear(event(first, "dev-1|H619A"));
    resolve.mockResolvedValue({ type: "light", light: light("Desk") });
    await subject.onWillAppear(event(first, "dev-1|H619A"));
    expect(first.setFeedback).toHaveBeenCalledTimes(2);
  });
});
