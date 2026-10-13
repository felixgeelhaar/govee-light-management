import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnOffAction } from "../../../src/backend/actions/OnOffAction";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";
import { Light } from "../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../src/backend/domain/entities/LightGroup";
import type { WillAppearEvent } from "@elgato/streamdeck";

const key = () => ({
  id: "key-1",
  setState: vi.fn().mockResolvedValue(undefined),
  setImage: vi.fn().mockResolvedValue(undefined),
  setTitle: vi.fn().mockResolvedValue(undefined),
  showOk: vi.fn().mockResolvedValue(undefined),
  showAlert: vi.fn().mockResolvedValue(undefined),
});
const event = (action: ReturnType<typeof key>, operation = "toggle") =>
  ({
    action,
    payload: { settings: { selectedDeviceId: "dev-1|H619A", operation } },
  }) as unknown as WillAppearEvent;
const light = (id = "dev-1") =>
  Light.create(id, "H619A", "Desk", { isOn: true, isOnline: true });

describe("OnOff native artwork states (#375)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      "test-key",
    );
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "light",
      light: light(),
    });
    vi.spyOn(ActionServices.prototype, "getLivePowerState").mockResolvedValue(
      true,
    );
    vi.spyOn(ActionServices.prototype, "controlTarget").mockResolvedValue({
      total: 1,
      failed: [],
    });
    vi.spyOn(
      ActionServices.prototype,
      "verifyLivePowerState",
    ).mockResolvedValue(true);
    vi.spyOn(ActionServices.prototype, "showSpinner").mockReturnValue(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("selects On→Off→On without changing settings or loading user artwork", async () => {
    const subject = new OnOffAction();
    const action = key();
    await subject.onWillAppear(event(action));
    expect(action.setState).toHaveBeenLastCalledWith(0);
    await subject.onKeyDown(event(action) as never);
    expect(action.setState).toHaveBeenLastCalledWith(1);
    vi.mocked(ActionServices.prototype.getLivePowerState).mockResolvedValue(
      false,
    );
    await subject.onKeyDown(event(action) as never);
    expect(action.setState).toHaveBeenLastCalledWith(0);
  });

  it("follows a state refresh and restarts from live state", async () => {
    const action = key();
    const subject = new OnOffAction();
    await subject.onWillAppear(event(action));
    vi.mocked(ActionServices.prototype.getLivePowerState).mockResolvedValue(
      false,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(action.setState).toHaveBeenLastCalledWith(1);
    await subject.onWillDisappear(event(action));
    await new OnOffAction().onWillAppear(event(action));
    expect(action.setState).toHaveBeenLastCalledWith(1);
  });

  it("uses On for mixed groups and preserves the group count", async () => {
    const first = light();
    const second = light("dev-2");
    const group = LightGroup.create("g1", "Office", [first, second]);
    vi.mocked(ActionServices.prototype.resolveTarget).mockResolvedValue({
      type: "group",
      group,
    });
    vi.mocked(ActionServices.prototype.getLivePowerState).mockImplementation(
      async (item) => item === first,
    );
    const action = key();
    await new OnOffAction().onWillAppear(event(action));
    expect(action.setState).toHaveBeenLastCalledWith(0);
    expect(action.setTitle).toHaveBeenLastCalledWith("1/2");
  });

  it("keeps the previous artwork state and alerts on command rejection", async () => {
    const action = key();
    const subject = new OnOffAction();
    await subject.onWillAppear(event(action));
    vi.mocked(ActionServices.prototype.controlTarget).mockRejectedValue(
      new Error("API rejection"),
    );
    await subject.onKeyDown(event(action) as never);
    expect(action.setState).toHaveBeenLastCalledWith(0);
    expect(action.showAlert).toHaveBeenCalledOnce();
  });

  it("retains the existing off fallback when no power sample is available", async () => {
    vi.mocked(ActionServices.prototype.getLivePowerState).mockResolvedValue(
      undefined,
    );
    const action = key();
    await new OnOffAction().onWillAppear(event(action));
    expect(action.setState).toHaveBeenLastCalledWith(1);
  });

  it.each([
    ["on", 0],
    ["off", 1],
  ])("preserves fixed %s command semantics", async (operation, state) => {
    const action = key();
    const subject = new OnOffAction();
    await subject.onWillAppear(event(action, operation as string));
    expect(action.setState).toHaveBeenLastCalledWith(state);
    await subject.onKeyDown(event(action, operation as string) as never);
    expect(ActionServices.prototype.controlTarget).toHaveBeenCalledWith(
      expect.anything(),
      operation,
    );
  });
});
