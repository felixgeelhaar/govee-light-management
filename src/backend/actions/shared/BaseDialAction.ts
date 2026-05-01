/**
 * Base class for all Stream Deck+ dial/encoder actions.
 * Provides shared lifecycle, power toggle, PI dispatch, and state management.
 */
import {
  SingletonAction,
  type DialAction,
  type DialDownEvent,
  type TouchTapEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { ActionServices, type BaseSettings } from "./ActionServices";

export type BaseDialSettings = BaseSettings & {
  stepSize?: number;
};

/**
 * Abstract base for dial actions. Subclasses implement value-specific logic
 * (what to sync, how to display, how dial rotation maps to a command).
 */
export abstract class BaseDialAction<
  TSettings extends BaseDialSettings,
> extends SingletonAction<TSettings> {
  private static readonly LIVE_SYNC_INTERVAL_MS = 3000;
  private static readonly POST_INTERACTION_SYNC_SUPPRESS_MS = 8000;
  /**
   * Minimum gap between cache invalidations when a group is sampled
   * with an offline member. Discover hits /user/devices (6-10s on
   * slow links); busting on every 3 s tick would saturate the API.
   * 30 s matches OnOff keypad recovery cadence and the DeviceService
   * cache TTL.
   */
  private static readonly OFFLINE_CACHE_BUST_MIN_GAP_MS = 30_000;

  protected services = new ActionServices();
  protected powerMap = new Map<string, boolean>();
  /**
   * Per-context flag set by subclass `syncLiveState` when it observed
   * a group member that was offline (i.e. `getControllableLights()`
   * returned fewer entries than `group.lights`). Read by the live-sync
   * loop to decide whether to invalidate the device-discover cache so
   * that an offline→online recovery is detected without waiting for
   * the cache TTL on top of the 3 s tick.
   */
  protected hasOfflineMember = new Map<string, boolean>();
  private visibleActions = new Map<
    string,
    DialAction<TSettings & JsonObject>
  >();
  private settingsMap = new Map<string, TSettings>();
  private liveSyncTimers = new Map<string, ReturnType<typeof setInterval>>();
  private liveSyncInFlight = new Set<string>();
  private liveSyncSuppressedUntil = new Map<string, number>();
  /** Last time we cleared the discover cache because of an offline member. */
  private lastCacheBustAt = new Map<string, number>();
  /**
   * Per-context press counter incremented on every `togglePower`. The
   * live-sync loop snapshots this before calling `syncLiveState` and
   * checks again after — if it changed during the sync, the user
   * pressed mid-sync and the sync's `powerMap` write is stale relative
   * to the optimistic update. We restore `powerMap` to the optimistic
   * value so the dial face doesn't briefly flicker back to the
   * pre-press state.
   */
  private togglePowerEpoch = new Map<string, number>();

  // ── Lifecycle ──────────────────────────────────────────────────

  override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
    const ctx = ev.action.id;
    if (!this.powerMap.has(ctx)) this.powerMap.set(ctx, true);
    this.initValueMaps(ctx);
    this.visibleActions.set(
      ctx,
      ev.action as DialAction<TSettings & JsonObject>,
    );
    this.settingsMap.set(ctx, ev.payload.settings);

    await this.refreshVisibleDial(ctx);
    this.startLiveSync(ctx);
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<TSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    this.powerMap.delete(ctx);
    this.hasOfflineMember.delete(ctx);
    this.lastCacheBustAt.delete(ctx);
    this.togglePowerEpoch.delete(ctx);
    this.cleanupValueMaps(ctx);
    this.visibleActions.delete(ctx);
    this.settingsMap.delete(ctx);
    this.stopLiveSync(ctx);
    this.liveSyncInFlight.delete(ctx);
    this.liveSyncSuppressedUntil.delete(ctx);
    this.services.cleanupDialTimers(ctx);
    // Force the next rotation to re-issue overlay-clearing toggles
    // (see ActionServices.ensurePreparedForSolidColor / issue #170).
    this.services.clearPreparedForContext(ctx);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    this.visibleActions.set(
      ctx,
      ev.action as DialAction<TSettings & JsonObject>,
    );
    this.settingsMap.set(ctx, ev.payload.settings);
    // Settings may have pointed the dial at a different device; re-prepare
    // the newly-selected target on the next rotation.
    this.services.clearPreparedForContext(ctx);
    await this.refreshVisibleDial(ctx);
  }

  // ── Dial press / touch → power toggle ─────────────────────────

  override async onDialDown(ev: DialDownEvent<TSettings>): Promise<void> {
    await this.togglePower(ev.action, ev.payload.settings);
  }

  override async onTouchTap(ev: TouchTapEvent<TSettings>): Promise<void> {
    await this.togglePower(ev.action, ev.payload.settings);
  }

  protected async togglePower(
    action: DialAction<TSettings & JsonObject>,
    settings: TSettings,
  ): Promise<void> {
    const ctx = action.id;
    // Bump the epoch first so that any in-flight `syncLiveState`
    // promise running concurrently knows its result is stale by the
    // time it lands. Must happen before `await getApiKey` so a sync
    // that fires during the api-key lookup still sees the new epoch.
    this.togglePowerEpoch.set(ctx, (this.togglePowerEpoch.get(ctx) ?? 0) + 1);
    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      await action.showAlert();
      return;
    }
    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target) {
      await action.showAlert();
      return;
    }

    // Capture original state for safe revert on failure
    let originalIsOn = this.powerMap.get(ctx) ?? true;
    if (target.type === "light" && target.light) {
      const liveState = await this.services.getLivePowerState(target.light);
      if (liveState !== undefined) {
        originalIsOn = liveState;
      }
    } else if (target.type === "group" && target.group) {
      // Sample group power: any member on → group "on" → toggle off.
      const members = target.group.getControllableLights();
      let anyOn = false;
      for (const light of members) {
        try {
          const live = await this.services.getLivePowerState(light);
          if (live === true) {
            anyOn = true;
            break;
          }
        } catch {
          // Best effort per member.
        }
      }
      originalIsOn = anyOn;
    }

    // Optimistic update
    this.powerMap.set(ctx, !originalIsOn);
    this.suppressLiveSync(ctx);

    try {
      await this.services.controlTarget(target, originalIsOn ? "off" : "on");
      if (target.type === "light" && target.light) {
        await this.services.verifyLivePowerState(target.light, !originalIsOn);
      }
      await this.updateDisplay(action, settings);
    } catch (error) {
      streamDeck.logger.error("Failed to toggle power:", error);
      // Revert to original state, not a double-flip
      this.powerMap.set(ctx, originalIsOn);
      await action.showAlert();
    }
  }

  // ── PI communication ──────────────────────────────────────────

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, TSettings>,
  ): Promise<void> {
    if (
      typeof ev.payload !== "object" ||
      ev.payload === null ||
      !("event" in ev.payload)
    )
      return;

    switch (ev.payload.event) {
      case "getDevices":
        await this.services.handleGetDevices(ev.action.id);
        break;
      case "getDeviceDebug":
        await this.services.handleGetDeviceDebug(
          ev.action.id,
          typeof ev.payload.selectedDeviceId === "string"
            ? ev.payload.selectedDeviceId
            : undefined,
        );
        break;
      case "getGroups":
        await this.services.handleGetGroups(ev.action.id);
        break;
      case "saveGroup":
        await this.services.handleSaveGroup(ev.action.id, ev.payload);
        break;
      case "deleteGroup":
        await this.services.handleDeleteGroup(ev.action.id, ev.payload);
        break;
      case "refreshState":
        await this.services.handleRefreshState();
        break;
      default:
        await this.handleCustomPIEvent(ev);
        break;
    }
  }

  // ── Abstract hooks for subclasses ─────────────────────────────

  /** Initialize action-specific value maps (e.g. brightnessMap). */
  protected abstract initValueMaps(ctx: string): void;

  /** Clean up action-specific value maps. */
  protected abstract cleanupValueMaps(ctx: string): void;

  /** Fetch live device state and populate value maps. */
  protected abstract syncLiveState(
    ctx: string,
    settings: TSettings,
  ): Promise<void>;

  /** Render the dial feedback display. */
  protected abstract updateDisplay(
    action: DialAction<TSettings & JsonObject>,
    settings: TSettings,
  ): Promise<void>;

  /** Override to handle PI events beyond the standard set. */

  protected async handleCustomPIEvent(
    _ev: SendToPluginEvent<JsonValue, TSettings>,
  ): Promise<void> {
    // No-op by default
  }

  protected getCurrentSettings(ctx: string, fallback: TSettings): TSettings {
    return this.settingsMap.get(ctx) ?? fallback;
  }

  protected suppressLiveSync(
    ctx: string,
    durationMs = BaseDialAction.POST_INTERACTION_SYNC_SUPPRESS_MS,
  ): void {
    this.liveSyncSuppressedUntil.set(ctx, Date.now() + durationMs);
  }

  private startLiveSync(ctx: string): void {
    this.stopLiveSync(ctx);
    this.liveSyncTimers.set(
      ctx,
      setInterval(() => {
        void this.refreshVisibleDial(ctx);
      }, BaseDialAction.LIVE_SYNC_INTERVAL_MS),
    );
  }

  private stopLiveSync(ctx: string): void {
    const timer = this.liveSyncTimers.get(ctx);
    if (timer) clearInterval(timer);
    this.liveSyncTimers.delete(ctx);
  }

  private async refreshVisibleDial(ctx: string): Promise<void> {
    const action = this.visibleActions.get(ctx);
    const settings = this.settingsMap.get(ctx);
    if (!action || !settings) {
      return;
    }

    if (
      this.liveSyncInFlight.has(ctx) ||
      this.services.isDialInteractionActive(ctx)
    ) {
      return;
    }

    const suppressedUntil = this.liveSyncSuppressedUntil.get(ctx) ?? 0;
    if (suppressedUntil > Date.now()) {
      await this.updateDisplay(action, settings);
      return;
    }

    // If the previous sample saw any group member offline, drop the
    // device-discover cache so the next resolveTarget refetches
    // /user/devices and detects offline→online recovery on this tick.
    // Throttled to once per OFFLINE_CACHE_BUST_MIN_GAP_MS so we don't
    // saturate the Govee API on the 3 s dial cadence.
    if (this.hasOfflineMember.get(ctx)) {
      const lastBust = this.lastCacheBustAt.get(ctx) ?? 0;
      if (
        Date.now() - lastBust >=
        BaseDialAction.OFFLINE_CACHE_BUST_MIN_GAP_MS
      ) {
        this.services.deviceService?.clearCache();
        this.lastCacheBustAt.set(ctx, Date.now());
      }
    }

    this.liveSyncInFlight.add(ctx);

    // Snapshot the optimistic `powerMap` and the toggle epoch before
    // calling syncLiveState. If a `togglePower` lands during the
    // sync, the subclass will already have written stale data into
    // `powerMap`; restoring from this snapshot keeps the dial face
    // consistent with the user's most recent press.
    const epochAtStart = this.togglePowerEpoch.get(ctx) ?? 0;
    const powerMapAtStart = this.powerMap.get(ctx);

    try {
      await this.syncLiveState(ctx, settings);
      const epochAtEnd = this.togglePowerEpoch.get(ctx) ?? 0;
      if (epochAtEnd !== epochAtStart && powerMapAtStart !== undefined) {
        this.powerMap.set(ctx, powerMapAtStart);
      }
      await this.updateDisplay(action, settings);
    } catch (error) {
      streamDeck.logger.warn("dial.live-sync.failed", {
        context: ctx,
        error,
      });
    } finally {
      this.liveSyncInFlight.delete(ctx);
    }
  }
}
