/**
 * BaseDialAction — the lifecycle every Stream Deck+ dial inherits.
 *
 * Three contracts are exercised here:
 *   1. appearing renders the dial and starts a 3 s live-sync loop;
 *   2. disappearing stops that loop and forgets everything held for the
 *      context, including the partial-failure banner's pending timer;
 *   3. onSendToPlugin routes the Property Inspector's events to the
 *      matching ActionServices handler, and anything unrecognised to the
 *      subclass hook.
 *
 * The base class is an application-layer adapter, so the boundary faked
 * here is Stream Deck itself (the dial action object and its events). The
 * ActionServices instance is the real one; only the handlers that reach
 * out to the Govee API or the Property Inspector are spied on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DialAction,
  SendToPluginEvent,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import {
  BaseDialAction,
  type BaseDialSettings,
} from "../../../../src/backend/actions/shared/BaseDialAction";

const LIVE_SYNC_INTERVAL_MS = 3000;

type Settings = BaseDialSettings;

/**
 * A minimal concrete dial. It records what the base class asks of it
 * instead of talking to a device.
 */
class TestDialAction extends BaseDialAction<Settings> {
  readonly initialised: string[] = [];
  readonly cleanedUp: string[] = [];
  readonly synced: Array<{ ctx: string; settings: Settings }> = [];
  readonly displayed: Array<{ id: string; settings: Settings }> = [];
  readonly customEvents: unknown[] = [];
  syncBehaviour: (ctx: string) => void = () => {};

  protected initValueMaps(ctx: string): void {
    this.initialised.push(ctx);
  }

  protected cleanupValueMaps(ctx: string): void {
    this.cleanedUp.push(ctx);
  }

  protected async syncLiveState(ctx: string, settings: Settings): Promise<void> {
    this.synced.push({ ctx, settings });
    this.syncBehaviour(ctx);
  }

  protected async updateDisplay(
    action: DialAction<Settings & JsonObject>,
    settings: Settings,
  ): Promise<void> {
    this.displayed.push({ id: action.id, settings });
  }

  protected async handleCustomPIEvent(
    ev: SendToPluginEvent<JsonValue, Settings>,
  ): Promise<void> {
    this.customEvents.push(ev.payload);
  }

  // Test-only windows onto protected state the base class owns.
  get powerState() {
    return this.powerMap;
  }
  get offlineState() {
    return this.hasOfflineMember;
  }
  get groupState() {
    return this.groupSummaryMap;
  }
  get actionServices() {
    return this.services;
  }
  suppress(ctx: string, durationMs?: number) {
    this.suppressLiveSync(ctx, durationMs);
  }
}

const makeDialAction = (id: string) =>
  ({
    id,
    setTitle: vi.fn().mockResolvedValue(undefined),
    setFeedback: vi.fn().mockResolvedValue(undefined),
    setImage: vi.fn().mockResolvedValue(undefined),
    showAlert: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    setSettings: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DialAction<Settings & JsonObject>;

const appearEvent = (
  action: DialAction<Settings & JsonObject>,
  settings: Settings = {},
) =>
  ({ action, payload: { settings } }) as unknown as WillAppearEvent<Settings>;

const disappearEvent = (
  action: DialAction<Settings & JsonObject>,
  settings: Settings = {},
) =>
  ({
    action,
    payload: { settings },
  }) as unknown as WillDisappearEvent<Settings>;

const settingsEvent = (
  action: DialAction<Settings & JsonObject>,
  settings: Settings,
) =>
  ({
    action,
    payload: { settings },
  }) as unknown as DidReceiveSettingsEvent<Settings>;

const piEvent = (action: { id: string }, payload: unknown) =>
  ({ action, payload }) as unknown as SendToPluginEvent<JsonValue, Settings>;

describe("BaseDialAction", () => {
  let dial: TestDialAction;
  let action: DialAction<Settings & JsonObject>;

  beforeEach(() => {
    vi.useFakeTimers();
    dial = new TestDialAction();
    action = makeDialAction("ctx-1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when a dial appears", () => {
    it("renders it once straight away, without waiting for a sync tick", async () => {
      await dial.onWillAppear(appearEvent(action, { stepSize: 5 }));

      expect(dial.synced).toHaveLength(1);
      expect(dial.displayed).toEqual([{ id: "ctx-1", settings: { stepSize: 5 } }]);
    });

    it("lets the subclass set up its per-context value maps", async () => {
      await dial.onWillAppear(appearEvent(action));

      expect(dial.initialised).toEqual(["ctx-1"]);
    });

    it("assumes the target is on until a sync says otherwise", async () => {
      await dial.onWillAppear(appearEvent(action));

      expect(dial.powerState.get("ctx-1")).toBe(true);
    });

    it("keeps a power state already known for the context", async () => {
      dial.powerState.set("ctx-1", false);

      await dial.onWillAppear(appearEvent(action));

      expect(dial.powerState.get("ctx-1")).toBe(false);
    });

    it("refreshes the dial every three seconds while it is visible", async () => {
      await dial.onWillAppear(appearEvent(action));
      expect(dial.synced).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS);
      expect(dial.synced).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS * 2);
      expect(dial.synced).toHaveLength(4);
    });

    it("runs only one sync loop when the same context appears twice", async () => {
      await dial.onWillAppear(appearEvent(action));
      await dial.onWillAppear(appearEvent(action));
      const before = dial.synced.length;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS);

      expect(dial.synced.length - before).toBe(1);
    });

    it("keeps each context's sync loop separate", async () => {
      const second = makeDialAction("ctx-2");
      await dial.onWillAppear(appearEvent(action));
      await dial.onWillAppear(appearEvent(second));
      dial.synced.length = 0;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS);

      expect(dial.synced.map((s) => s.ctx).sort()).toEqual(["ctx-1", "ctx-2"]);
    });
  });

  describe("when a dial disappears", () => {
    it("stops refreshing it", async () => {
      await dial.onWillAppear(appearEvent(action));
      await dial.onWillDisappear(disappearEvent(action));
      const before = dial.synced.length;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS * 5);

      expect(dial.synced.length).toBe(before);
    });

    it("leaves the other visible dials syncing", async () => {
      const second = makeDialAction("ctx-2");
      await dial.onWillAppear(appearEvent(action));
      await dial.onWillAppear(appearEvent(second));
      await dial.onWillDisappear(disappearEvent(action));
      dial.synced.length = 0;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS);

      expect(dial.synced.map((s) => s.ctx)).toEqual(["ctx-2"]);
    });

    it("forgets every piece of state held for the context", async () => {
      await dial.onWillAppear(appearEvent(action));
      dial.offlineState.set("ctx-1", true);
      dial.groupState.set("ctx-1", {
        onCount: 1,
        total: 2,
      } as unknown as NonNullable<
        ReturnType<typeof dial.groupState.get>
      >);

      await dial.onWillDisappear(disappearEvent(action));

      expect(dial.powerState.has("ctx-1")).toBe(false);
      expect(dial.offlineState.has("ctx-1")).toBe(false);
      expect(dial.groupState.has("ctx-1")).toBe(false);
      expect(dial.cleanedUp).toEqual(["ctx-1"]);
    });

    it("disarms the partial-failure banner so it cannot retitle the next dial", async () => {
      await dial.onWillAppear(appearEvent(action));
      // A group command missed some members: the banner shows now and is
      // scheduled to restore the baseline title 30 s later.
      dial.actionServices.showPartialFailureBanner(
        action,
        "ctx-1",
        1,
        3,
        "Office",
      );
      expect(action.setTitle).toHaveBeenCalledWith("Office\n⚠ 1/3");
      (action.setTitle as ReturnType<typeof vi.fn>).mockClear();

      await dial.onWillDisappear(disappearEvent(action));
      await vi.advanceTimersByTimeAsync(60_000);

      // The key now belongs to whatever the user dropped there next.
      expect(action.setTitle).not.toHaveBeenCalled();
    });

    it("does nothing for a context that never appeared", async () => {
      await expect(
        dial.onWillDisappear(disappearEvent(makeDialAction("ghost"))),
      ).resolves.toBeUndefined();
    });
  });

  describe("when settings change", () => {
    it("re-renders the dial with the new settings", async () => {
      await dial.onWillAppear(appearEvent(action, { stepSize: 5 }));
      dial.displayed.length = 0;

      await dial.onDidReceiveSettings(settingsEvent(action, { stepSize: 25 }));

      expect(dial.displayed).toEqual([
        { id: "ctx-1", settings: { stepSize: 25 } },
      ]);
    });

    it("uses the new settings for every later sync tick", async () => {
      await dial.onWillAppear(appearEvent(action, { stepSize: 5 }));
      await dial.onDidReceiveSettings(settingsEvent(action, { stepSize: 25 }));
      dial.synced.length = 0;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS);

      expect(dial.synced[0].settings).toEqual({ stepSize: 25 });
    });
  });

  describe("the live-sync loop", () => {
    it("keeps ticking after a sync fails", async () => {
      dial.syncBehaviour = () => {
        throw new Error("device unreachable");
      };
      await dial.onWillAppear(appearEvent(action));

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS * 2);

      expect(dial.synced.length).toBeGreaterThanOrEqual(3);
    });

    it("does not render the dial from a sync that failed", async () => {
      dial.syncBehaviour = () => {
        throw new Error("device unreachable");
      };

      await dial.onWillAppear(appearEvent(action));

      expect(dial.displayed).toEqual([]);
    });

    it("stops fetching while sync is suppressed, but keeps the display current", async () => {
      await dial.onWillAppear(appearEvent(action));
      dial.suppress("ctx-1", 8000);
      dial.synced.length = 0;
      dial.displayed.length = 0;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS * 2);

      expect(dial.synced).toHaveLength(0);
      expect(dial.displayed.length).toBeGreaterThan(0);
    });

    it("resumes fetching once the suppression window has passed", async () => {
      await dial.onWillAppear(appearEvent(action));
      dial.suppress("ctx-1", 8000);
      dial.synced.length = 0;

      await vi.advanceTimersByTimeAsync(LIVE_SYNC_INTERVAL_MS * 4);

      expect(dial.synced.length).toBeGreaterThan(0);
    });
  });

  describe("routing Property Inspector events", () => {
    const handlers = [
      "handleGetDevices",
      "handleGetGroups",
      "handleSaveGroup",
      "handleDeleteGroup",
      "handleRefreshState",
      "handleGetDeviceDebug",
    ] as const;
    let spies: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      spies = {};
      for (const name of handlers) {
        spies[name] = vi
          .spyOn(
            dial.actionServices,
            name as keyof typeof dial.actionServices as never,
          )
          .mockResolvedValue(undefined as never) as unknown as ReturnType<
          typeof vi.fn
        >;
      }
    });

    it("asks for the device list", async () => {
      await dial.onSendToPlugin(piEvent(action, { event: "getDevices" }));

      expect(spies.handleGetDevices).toHaveBeenCalledWith("ctx-1");
    });

    it("asks for the saved groups", async () => {
      await dial.onSendToPlugin(piEvent(action, { event: "getGroups" }));

      expect(spies.handleGetGroups).toHaveBeenCalledWith("ctx-1");
    });

    it("passes a group save through with its payload", async () => {
      const payload = { event: "saveGroup", name: "Office", lights: [] };

      await dial.onSendToPlugin(piEvent(action, payload));

      expect(spies.handleSaveGroup).toHaveBeenCalledWith("ctx-1", payload);
    });

    it("passes a group deletion through with its payload", async () => {
      const payload = { event: "deleteGroup", groupId: "g1" };

      await dial.onSendToPlugin(piEvent(action, payload));

      expect(spies.handleDeleteGroup).toHaveBeenCalledWith("ctx-1", payload);
    });

    it("forces a state refresh", async () => {
      await dial.onSendToPlugin(piEvent(action, { event: "refreshState" }));

      expect(spies.handleRefreshState).toHaveBeenCalled();
    });

    it("forwards the selected device to the diagnostics request", async () => {
      await dial.onSendToPlugin(
        piEvent(action, {
          event: "getDeviceDebug",
          selectedDeviceId: "dev-1|H6110",
        }),
      );

      expect(spies.handleGetDeviceDebug).toHaveBeenCalledWith(
        "ctx-1",
        "dev-1|H6110",
      );
    });

    it("asks for diagnostics with no device when the id is not a string", async () => {
      await dial.onSendToPlugin(
        piEvent(action, { event: "getDeviceDebug", selectedDeviceId: 42 }),
      );

      expect(spies.handleGetDeviceDebug).toHaveBeenCalledWith(
        "ctx-1",
        undefined,
      );
    });

    it("hands an event it does not know to the subclass", async () => {
      const payload = { event: "setSomethingDialSpecific", value: 7 };

      await dial.onSendToPlugin(piEvent(action, payload));

      expect(dial.customEvents).toEqual([payload]);
    });

    it.each([
      ["a string payload", "getDevices"],
      ["a null payload", null],
      ["a payload with no event name", { deviceId: "dev-1" }],
    ])("ignores %s", async (_label, payload) => {
      await dial.onSendToPlugin(piEvent(action, payload));

      expect(dial.customEvents).toEqual([]);
      for (const name of handlers) {
        expect(spies[name]).not.toHaveBeenCalled();
      }
    });
  });
});
