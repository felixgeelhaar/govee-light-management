/**
 * Shared keypad-action state tracker. Encapsulates the periodic
 * live-sync, race-protection epoch, group offline recovery, and
 * three-state group title machinery that every keypad action needs to
 * present a consistent status glyph (●/◐/○ + N/M).
 *
 * Actions hand the tracker an action + settings on `onWillAppear` and
 * the tracker drives its own refresh loop, calling back into a
 * caller-provided `renderTitle(ctx)` whenever state changes. Keeps the
 * action class itself focused on its action-specific behaviour
 * (apply, settings shape, label format) without duplicating the
 * 100+ lines of state plumbing.
 */
import { streamDeck } from "@elgato/streamdeck";
import { ActionServices, type BaseSettings } from "./ActionServices";

interface GroupPowerSummary {
  onCount: number;
  totalCount: number;
}

interface TrackedAction {
  id: string;
  setTitle(text: string): Promise<void>;
}

export interface KeypadStateTrackerOptions {
  /** Interval between automatic live-state syncs. Defaults to 30 s. */
  liveSyncIntervalMs?: number;
  /** Called whenever state changes and the title should re-render. */
  renderTitle?: (ctx: string) => Promise<void> | void;
}

export class KeypadStateTracker {
  private services = new ActionServices();
  private readonly liveSyncIntervalMs: number;
  private readonly renderTitle?: (ctx: string) => Promise<void> | void;

  /** Last sampled on/off — for single-light targets. */
  private powerState = new Map<string, boolean>();
  /** Group three-state summary: how many of how many are on. */
  private groupSummary = new Map<string, GroupPowerSummary>();
  /** Suppress redundant API calls when settings change without device change. */
  private lastSyncedDevice = new Map<string, string>();
  /** Set when the most recent sync saw an offline group member. */
  private hasOfflineMember = new Map<string, boolean>();
  /** Per-context press counter — bumped externally before user-issued commands. */
  private toggleEpoch = new Map<string, number>();
  private liveSyncTimers = new Map<string, ReturnType<typeof setInterval>>();
  private visibleActions = new Map<string, TrackedAction>();
  private settingsMap = new Map<string, BaseSettings>();

  constructor(options: KeypadStateTrackerOptions = {}) {
    this.liveSyncIntervalMs = options.liveSyncIntervalMs ?? 30_000;
    this.renderTitle = options.renderTitle;
  }

  attach(action: TrackedAction, settings: BaseSettings): void {
    const ctx = action.id;
    if (!this.powerState.has(ctx)) {
      this.powerState.set(ctx, false);
    }
    this.visibleActions.set(ctx, action);
    this.settingsMap.set(ctx, settings);
    void this.syncOnce(ctx);
    this.startTimer(ctx);
  }

  detach(ctx: string): void {
    this.powerState.delete(ctx);
    this.groupSummary.delete(ctx);
    this.lastSyncedDevice.delete(ctx);
    this.hasOfflineMember.delete(ctx);
    this.toggleEpoch.delete(ctx);
    this.visibleActions.delete(ctx);
    this.settingsMap.delete(ctx);
    this.stopTimer(ctx);
  }

  /**
   * Update tracked settings and force a re-sync if the selected device
   * changed. Called from `onDidReceiveSettings`.
   */
  async settingsChanged(
    action: TrackedAction,
    settings: BaseSettings,
  ): Promise<void> {
    const ctx = action.id;
    const newDevice = settings.selectedDeviceId ?? "";
    this.visibleActions.set(ctx, action);
    this.settingsMap.set(ctx, settings);

    if (this.lastSyncedDevice.get(ctx) !== newDevice) {
      this.groupSummary.delete(ctx);
      await this.syncOnce(ctx);
    } else if (this.renderTitle) {
      await this.renderTitle(ctx);
    }
  }

  /**
   * Bump the epoch counter. The action's `onKeyDown` should call this
   * before any optimistic state update so a concurrent live-sync knows
   * its writes are stale and must not overwrite the optimistic value.
   */
  bumpEpoch(ctx: string): number {
    const next = (this.toggleEpoch.get(ctx) ?? 0) + 1;
    this.toggleEpoch.set(ctx, next);
    return next;
  }

  /** Apply optimistic post-command state for a single-light target. */
  setOptimisticSingle(ctx: string, isOn: boolean): void {
    this.powerState.set(ctx, isOn);
    this.groupSummary.delete(ctx);
  }

  /** Apply optimistic post-command state for a group target. */
  setOptimisticGroup(ctx: string, onCount: number, totalCount: number): void {
    this.groupSummary.set(ctx, { onCount, totalCount });
    this.powerState.set(ctx, onCount > 0);
  }

  /**
   * Three-state status glyph for the current target. Empty string when
   * no state is known yet (e.g. first frame after appear, before the
   * initial sync lands).
   *
   * Format:
   *   - Group: `●\n2/2` / `◐\n1/2` / `○\n0/2`
   *   - Single light: `●` / `○`
   *   - Unknown: ``
   */
  getStatusGlyph(ctx: string): string {
    const summary = this.groupSummary.get(ctx);
    if (summary && summary.totalCount > 0) {
      let glyph = "○";
      if (summary.onCount === summary.totalCount) glyph = "●";
      else if (summary.onCount > 0) glyph = "◐";
      return `${glyph}\n${summary.onCount}/${summary.totalCount}`;
    }
    if (this.powerState.has(ctx)) {
      return this.powerState.get(ctx) ? "●" : "○";
    }
    return "";
  }

  private startTimer(ctx: string): void {
    this.stopTimer(ctx);
    this.liveSyncTimers.set(
      ctx,
      setInterval(() => {
        this.lastSyncedDevice.delete(ctx);
        if (this.hasOfflineMember.get(ctx)) {
          // Bust the discover cache so an offline→online recovery is
          // detected without waiting for the cache TTL on top of the
          // timer interval.
          this.services.deviceService?.clearCache();
        }
        void this.syncOnce(ctx);
      }, this.liveSyncIntervalMs),
    );
  }

  private stopTimer(ctx: string): void {
    const timer = this.liveSyncTimers.get(ctx);
    if (timer) clearInterval(timer);
    this.liveSyncTimers.delete(ctx);
  }

  private async syncOnce(ctx: string): Promise<void> {
    const action = this.visibleActions.get(ctx);
    const settings = this.settingsMap.get(ctx);
    if (!action || !settings) return;

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      if (this.renderTitle) await this.renderTitle(ctx);
      return;
    }

    const epochAtStart = this.toggleEpoch.get(ctx) ?? 0;
    const powerStateAtStart = this.powerState.get(ctx);
    const groupSummaryAtStart = this.groupSummary.get(ctx);

    try {
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget(settings);
      if (target?.type === "light" && target.light) {
        const isOn = await this.services.getLivePowerState(target.light);
        if (isOn !== undefined) {
          this.powerState.set(ctx, isOn);
          this.groupSummary.delete(ctx);
        }
      } else if (target?.type === "group" && target.group) {
        const allMembers = target.group.lights;
        const controllable = target.group.getControllableLights();
        let onCount = 0;
        for (const light of controllable) {
          try {
            const live = await this.services.getLivePowerState(light);
            if (live === true) onCount++;
          } catch {
            // Best effort per member.
          }
        }
        this.groupSummary.set(ctx, {
          onCount,
          totalCount: allMembers.length,
        });
        this.powerState.set(ctx, onCount > 0);
        this.hasOfflineMember.set(ctx, controllable.length < allMembers.length);
      }
    } catch (error) {
      streamDeck.logger?.debug("KeypadStateTracker.syncOnce failed", error);
    }

    // Race-fix: if a press landed during the slow API work, restore
    // the optimistic state we snapshotted before the call.
    const epochAtEnd = this.toggleEpoch.get(ctx) ?? 0;
    if (epochAtEnd !== epochAtStart) {
      if (powerStateAtStart !== undefined) {
        this.powerState.set(ctx, powerStateAtStart);
      }
      if (groupSummaryAtStart !== undefined) {
        this.groupSummary.set(ctx, groupSummaryAtStart);
      }
    }
    this.lastSyncedDevice.set(ctx, settings.selectedDeviceId ?? "");

    if (this.renderTitle) {
      await this.renderTitle(ctx);
    }
  }
}
