import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { telemetryService } from "../services/TelemetryService";

type OnOffSettings = BaseSettings & {
  operation?: "toggle" | "on" | "off";
};

interface GroupPowerSummary {
  onCount: number;
  totalCount: number;
}

@action({ UUID: "com.felixgeelhaar.govee-light-management.lights" })
export class OnOffAction extends SingletonAction<OnOffSettings> {
  /**
   * Interval for the keypad live-sync timer. Long enough that idle keys
   * don't burn API quota (Govee free tier = 100 req/min plugin-wide) but
   * short enough that toggling a light from the Govee app or another
   * action shows up on the keypad title within ~half a minute.
   *
   * Dials run a 3 s loop because the LCD bar is a continuous-feedback
   * surface; a static keypad has no such expectation. Don't lower this
   * without re-checking telemetry.
   */
  private static readonly LIVE_SYNC_INTERVAL_MS = 30_000;

  private services = new ActionServices();
  private powerState = new Map<string, boolean>();
  /** Group state summary for three-state title (●/◐/○) when target is a group. */
  private groupSummary = new Map<string, GroupPowerSummary>();
  /** Track last synced device to avoid redundant API calls on settings changes. */
  private lastSyncedDevice = new Map<string, string>();
  /**
   * Per-context flag set when the most recent sync observed a group
   * member that was offline. Read by the periodic timer to decide
   * whether to invalidate the discover cache so the next tick picks
   * up an offline→online recovery quickly.
   */
  private hasOfflineMember = new Map<string, boolean>();
  /**
   * Per-context press counter incremented on every `onKeyDown`. The
   * periodic sync snapshots this before fetching live state and checks
   * again after — if the user pressed during the sync, the sync's
   * write is stale relative to the optimistic update. Restoring
   * `powerState` + `groupSummary` from the pre-sync snapshot keeps the
   * keypad title consistent with the user's most recent press.
   */
  private toggleEpoch = new Map<string, number>();
  /** Per-context periodic refresh timer so keypad titles don't go stale. */
  private liveSyncTimers = new Map<string, ReturnType<typeof setInterval>>();
  /** Snapshot of current visible action + settings for the timer to use. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private visibleActions = new Map<string, any>();
  private settingsMap = new Map<string, OnOffSettings>();

  override async onWillAppear(
    ev: WillAppearEvent<OnOffSettings>,
  ): Promise<void> {
    const contextId = ev.action.id;
    if (!this.powerState.has(contextId)) {
      this.powerState.set(contextId, false);
    }
    this.visibleActions.set(contextId, ev.action);
    this.settingsMap.set(contextId, ev.payload.settings);

    await this.syncDisplayedPowerState(ev.action, ev.payload.settings);
    this.startLiveSync(contextId);
  }

  override onWillDisappear(ev: WillDisappearEvent<OnOffSettings>): void {
    const ctx = ev.action.id;
    this.powerState.delete(ctx);
    this.groupSummary.delete(ctx);
    this.lastSyncedDevice.delete(ctx);
    this.hasOfflineMember.delete(ctx);
    this.toggleEpoch.delete(ctx);
    this.visibleActions.delete(ctx);
    this.settingsMap.delete(ctx);
    this.stopLiveSync(ctx);
  }

  private startLiveSync(contextId: string): void {
    this.stopLiveSync(contextId);
    this.liveSyncTimers.set(
      contextId,
      setInterval(() => {
        const action = this.visibleActions.get(contextId);
        const settings = this.settingsMap.get(contextId);
        if (!action || !settings) return;
        // Force re-sync regardless of lastSyncedDevice — the interval's
        // job is to catch out-of-band changes.
        this.lastSyncedDevice.delete(contextId);
        // If the previous sync saw any group member offline, drop the
        // device cache so the next resolveTarget refetches
        // /user/devices immediately. Otherwise an offline→online
        // recovery would wait for the cache TTL (30 s) on top of the
        // timer interval — up to a minute of stale state even after
        // the user restored power.
        if (this.hasOfflineMember.get(contextId)) {
          this.services.deviceService?.clearCache();
        }
        void this.syncDisplayedPowerState(action, settings);
      }, OnOffAction.LIVE_SYNC_INTERVAL_MS),
    );
  }

  private stopLiveSync(contextId: string): void {
    const timer = this.liveSyncTimers.get(contextId);
    if (timer) clearInterval(timer);
    this.liveSyncTimers.delete(contextId);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<OnOffSettings>,
  ): Promise<void> {
    const contextId = ev.action.id;
    const newDevice = ev.payload.settings.selectedDeviceId ?? "";
    this.visibleActions.set(contextId, ev.action);
    this.settingsMap.set(contextId, ev.payload.settings);

    // Only re-sync from API if the selected device actually changed
    if (this.lastSyncedDevice.get(contextId) !== newDevice) {
      // Reset group summary so the title doesn't briefly show stale
      // counts from the previous device while sync is pending.
      this.groupSummary.delete(contextId);
      await this.syncDisplayedPowerState(ev.action, ev.payload.settings);
    } else {
      await ev.action.setTitle(this.getTitle(ev.payload.settings, contextId));
    }
  }

  override async onKeyDown(ev: KeyDownEvent<OnOffSettings>): Promise<void> {
    const { settings } = ev.payload;
    const contextId = ev.action.id;
    // Bump the epoch immediately so any concurrent
    // `syncDisplayedPowerState` (periodic timer) knows its result is
    // stale by the time it lands. Must happen before any await so
    // the in-flight sync sees the new value.
    this.toggleEpoch.set(contextId, (this.toggleEpoch.get(contextId) ?? 0) + 1);

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      await ev.action.showAlert();
      return;
    }

    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const operation = settings.operation || "toggle";
    const started = Date.now();
    let originalState = this.powerState.get(contextId) ?? false;

    try {
      let command: "on" | "off";

      if (operation === "toggle") {
        if (target.type === "light" && target.light) {
          const liveState = await this.services.getLivePowerState(target.light);
          if (liveState !== undefined) {
            originalState = liveState;
          }
        } else if (target.type === "group" && target.group) {
          // Sample full group power so we can render mixed state and
          // pick the right toggle direction. "Any on" → toggle off
          // (matches user intent: "make this off"). totalCount is
          // the FULL member count (not just controllable) so that an
          // offline member doesn't shrink the denominator and confuse
          // the user — they see `0/2` while a light is unreachable,
          // not `0/1`.
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
          this.groupSummary.set(contextId, {
            onCount,
            totalCount: allMembers.length,
          });
          originalState = onCount > 0;
        }
        command = originalState ? "off" : "on";
      } else {
        command = operation as "on" | "off";
        originalState = this.powerState.get(contextId) ?? false;
      }

      // Optimistic update
      this.powerState.set(contextId, command === "on");

      if (target.type === "light" && target.light) {
        streamDeck.logger.info("onoff.toggle.request", {
          deviceId: target.light.deviceId,
          model: target.light.model,
          name: target.light.name,
          operation,
          originalState,
          command,
        });
      } else if (target.type === "group" && target.group) {
        streamDeck.logger.info("onoff.toggle.group.request", {
          groupId: target.group.id,
          name: target.group.name,
          memberCount: target.group.lights.length,
          controllableCount: target.group.getControllableLights().length,
          operation,
          originalState,
          command,
        });
      }

      const stopSpinner = this.services.showSpinner(ev.action);

      try {
        await this.services.controlTarget(target, command);
        if (target.type === "light" && target.light) {
          await this.services.verifyLivePowerState(
            target.light,
            command === "on",
          );
        } else if (target.type === "group" && target.group) {
          // After a successful group toggle, every controllable member
          // moved to the commanded state. Offline members weren't
          // commanded, so onCount reflects only those that were —
          // totalCount stays at full group size so the user sees that
          // the offline member exists ("1/2" rather than "1/1").
          const total = target.group.lights.length;
          const commanded = target.group.getControllableLights().length;
          this.groupSummary.set(contextId, {
            onCount: command === "on" ? commanded : 0,
            totalCount: total,
          });
        }
      } finally {
        stopSpinner();
      }

      await ev.action.setTitle(this.getTitle(settings, contextId));
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.${operation}`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to toggle power:", error);
      // Revert to original state, not a double-flip
      this.powerState.set(contextId, originalState);
      await ev.action.setTitle(this.getTitle(settings, contextId));
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, OnOffSettings>,
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
    }
  }

  private getTitle(_settings: OnOffSettings, contextId: string): string {
    const op = _settings.operation || "toggle";
    if (op !== "toggle") return "";

    const summary = this.groupSummary.get(contextId);
    if (summary && summary.totalCount > 0) {
      // Three-state group title: ● all on, ◐ mixed, ○ all off + count.
      let glyph = "○";
      if (summary.onCount === summary.totalCount) glyph = "●";
      else if (summary.onCount > 0) glyph = "◐";
      return `${glyph}\n${summary.onCount}/${summary.totalCount}`;
    }

    const isOn = this.powerState.get(contextId) ?? false;
    return isOn ? "●" : "○";
  }

  private async syncDisplayedPowerState(
    action: any,
    settings: OnOffSettings,
  ): Promise<void> {
    const contextId = action.id;
    const apiKey = await this.services.getApiKey(settings);

    if (apiKey && settings.selectedDeviceId) {
      // Snapshot epoch + state before slow API work. If a `onKeyDown`
      // bumps the epoch while the API call is in flight, the writes
      // below are stale relative to the optimistic update; restore
      // from the snapshot at the end so the title doesn't flicker
      // back to the pre-press state.
      const epochAtStart = this.toggleEpoch.get(contextId) ?? 0;
      const powerStateAtStart = this.powerState.get(contextId);
      const groupSummaryAtStart = this.groupSummary.get(contextId);
      try {
        await this.services.ensureServices(apiKey);
        const target = await this.services.resolveTarget(settings);
        if (target?.type === "light" && target.light) {
          const isOn = await this.services.getLivePowerState(target.light);
          if (isOn !== undefined) {
            this.powerState.set(contextId, isOn);
          }
        } else if (target?.type === "group" && target.group) {
          // Sample every controllable member; offline members are
          // excluded from the per-light state query but still counted
          // in the title denominator so the group size stays stable
          // across reachability changes.
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
          this.groupSummary.set(contextId, {
            onCount,
            totalCount: allMembers.length,
          });
          this.powerState.set(contextId, onCount > 0);
          // Flag for the periodic timer: if any member was filtered
          // out as offline, next tick should bust the device cache so
          // the recovery is detected promptly.
          this.hasOfflineMember.set(
            contextId,
            controllable.length < allMembers.length,
          );
        }
      } catch {
        // Best effort - keep cached state
      }
      // If a key press landed during the API work, restore the
      // optimistic state we snapshotted before the call so the title
      // reflects what the user just asked for, not what the (stale)
      // sync read.
      const epochAtEnd = this.toggleEpoch.get(contextId) ?? 0;
      if (epochAtEnd !== epochAtStart) {
        if (powerStateAtStart !== undefined) {
          this.powerState.set(contextId, powerStateAtStart);
        }
        if (groupSummaryAtStart !== undefined) {
          this.groupSummary.set(contextId, groupSummaryAtStart);
        }
      }
      this.lastSyncedDevice.set(contextId, settings.selectedDeviceId ?? "");
    }

    await action.setTitle(this.getTitle(settings, contextId));
  }
}
