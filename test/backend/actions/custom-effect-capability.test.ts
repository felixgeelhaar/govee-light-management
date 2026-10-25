import { afterEach, describe, expect, it, vi } from "vitest";
import { streamDeck } from "@elgato/streamdeck";
import { CustomEffectAction } from "../../../src/backend/actions/CustomEffectAction";
import { ActionServices } from "../../../src/backend/actions/shared/ActionServices";
import { effectService } from "../../../src/backend/services/EffectService";
import { globalSettingsService } from "../../../src/backend/services/GlobalSettingsService";

/**
 * Custom effects colour individual segments, so they need an RGB IC light.
 * The inspector offered every light, including single-colour bulbs, and a
 * bulb key showed "Playing" while every frame failed.
 */
describe("Custom Effect needs a light with segments", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists lights with segments, and groups by how many members have them", async () => {
    const shared = (
      ActionServices as unknown as { _shared: Record<string, unknown> }
    )._shared;
    const original = shared.deviceService;
    const device = (id: string, segmentedColor: boolean) => ({
      deviceId: id,
      model: "H6056",
      name: id,
      capabilities: { power: true, segmentedColor },
    });
    shared.deviceService = {
      discover: vi
        .fn()
        .mockResolvedValue([device("strip", true), device("bulb", false)]),
      getCachedUnsupportedDevices: () => [],
    };
    const member = (id: string) => ({ deviceId: id, model: "H6056" });
    const originalGroups = shared.groupService;
    shared.groupService = {
      getAllGroups: async () => [
        {
          id: "both",
          name: "Both",
          size: 2,
          lights: [member("strip"), member("bulb")],
        },
        { id: "bulbs", name: "Bulbs", size: 1, lights: [member("bulb")] },
      ],
    };
    Object.assign(streamDeck.ui, { action: { id: "ctx" } });
    vi.spyOn(globalSettingsService, "getApiKey").mockResolvedValue("test-key");
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    try {
      await new CustomEffectAction().onSendToPlugin({
        action: { id: "ctx" },
        payload: { event: "getDevices" },
      } as never);
      expect(
        vi.mocked(streamDeck.ui.sendToPropertyInspector).mock.calls.at(-1)?.[0],
      ).toMatchObject({
        status: "ok",
        items: [
          { label: "Lights", children: [{ value: "light:strip|H6056" }] },
          {
            label: "Groups",
            children: [
              { value: "group:both", label: "Both (1 of 2 lights)" },
              {
                value: "group:bulbs",
                label: "Bulbs (no lights with segments)",
                disabled: true,
              },
            ],
          },
        ],
      });
      const groups = vi
        .mocked(streamDeck.ui.sendToPropertyInspector)
        .mock.calls.at(-1)?.[0] as { items: { children: object[] }[] };
      expect(groups.items[1].children[0]).not.toHaveProperty("disabled");
    } finally {
      shared.deviceService = original;
      shared.groupService = originalGroups;
    }
  });

  it("refuses a group none of whose lights have segments", async () => {
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      "test-key",
    );
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(effectService, "segmentedMembers").mockResolvedValue([]);
    const play = vi.spyOn(effectService, "playEffect").mockResolvedValue();
    const action = {
      id: "ctx",
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
    };
    await new CustomEffectAction().onKeyDown({
      action,
      payload: {
        settings: {
          selectedDeviceId: "group:bulbs",
          effectId: "preset-rainbow-wave",
        },
      },
    } as never);
    expect(play).not.toHaveBeenCalled();
    expect(action.setTitle).toHaveBeenCalledWith("⚠\nPick light");
  });

  it("plays on a group with at least one light that has segments", async () => {
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      "test-key",
    );
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(effectService, "segmentedMembers").mockResolvedValue([
      "light:desk|H6056",
    ]);
    const play = vi.spyOn(effectService, "playEffect").mockResolvedValue();
    const action = {
      id: "ctx",
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
    };
    await new CustomEffectAction().onKeyDown({
      action,
      payload: {
        settings: {
          selectedDeviceId: "group:office",
          effectId: "preset-rainbow-wave",
        },
      },
    } as never);
    expect(play).toHaveBeenCalledWith("group:office", expect.anything());
  });

  it("refuses to play on a saved light without segments", async () => {
    vi.spyOn(ActionServices.prototype, "getApiKey").mockResolvedValue(
      "test-key",
    );
    vi.spyOn(ActionServices.prototype, "ensureServices").mockResolvedValue();
    vi.spyOn(ActionServices.prototype, "resolveTarget").mockResolvedValue({
      type: "light",
      light: { name: "Head Light", supportsSegmentedColor: () => false },
    } as never);
    const play = vi.spyOn(effectService, "playEffect").mockResolvedValue();
    const warn = vi.spyOn(streamDeck.logger, "warn");
    const action = {
      id: "ctx",
      setTitle: vi.fn().mockResolvedValue(undefined),
      showAlert: vi.fn().mockResolvedValue(undefined),
      showOk: vi.fn().mockResolvedValue(undefined),
    };
    await new CustomEffectAction().onKeyDown({
      action,
      payload: {
        settings: {
          selectedDeviceId: "light:bulb|H600D",
          effectId: "preset-rainbow-wave",
        },
      },
    } as never);
    expect(play).not.toHaveBeenCalled();
    expect(action.showAlert).toHaveBeenCalled();
    expect(action.setTitle).toHaveBeenCalledWith("⚠\nPick light");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("segment"),
      expect.objectContaining({ light: "Head Light" }),
    );
  });
});
