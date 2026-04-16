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

  protected services = new ActionServices();
  protected powerMap = new Map<string, boolean>();
  private visibleActions = new Map<
    string,
    DialAction<TSettings & JsonObject>
  >();
  private settingsMap = new Map<string, TSettings>();
  private liveSyncTimers = new Map<string, ReturnType<typeof setInterval>>();
  private liveSyncInFlight = new Set<string>();

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
    this.cleanupValueMaps(ctx);
    this.visibleActions.delete(ctx);
    this.settingsMap.delete(ctx);
    this.stopLiveSync(ctx);
    this.liveSyncInFlight.delete(ctx);
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
    }

    // Optimistic update
    this.powerMap.set(ctx, !originalIsOn);

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

    this.liveSyncInFlight.add(ctx);

    try {
      await this.syncLiveState(ctx, settings);
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
