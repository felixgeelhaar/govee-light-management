import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import {
  ActionServices,
  sendToPI,
  type BaseSettings,
} from "./shared/ActionServices";
import { ScheduledAction } from "../domain/entities/ScheduledAction";
import {
  Schedule,
  ScheduleType,
  DayOfWeek,
  type ScheduleClock,
} from "../domain/value-objects/Schedule";
import { schedulerService } from "../services/SchedulerService";

type ScheduleSettings = BaseSettings & {
  scheduleId?: string;
  scheduleName?: string;
  scheduleType?: ScheduleType;
  hour?: number;
  minute?: number;
  delaySeconds?: number;
  days?: DayOfWeek[];
  /** Absent on keys saved before 3.0.1, whose hour/minute/days are UTC. */
  clock?: ScheduleClock;
  command?:
    "on" | "off" | "toggle" | "brightness" | "color" | "colorTemperature";
  commandValue?: number | string;
  enabled?: boolean;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.schedule" })
export class ScheduleAction extends SingletonAction<ScheduleSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<ScheduleSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    await schedulerService.initialize();
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ScheduleSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.syncAction(ev.payload.settings);
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<ScheduleSettings>): Promise<void> {
    const settings = ev.payload.settings;

    if (!this.isConfigured(settings)) {
      await this.services.ignoreUnconfiguredPress(ev.action, {
        hasSchedule: false,
      });
      return;
    }

    // Toggle enabled/disabled
    const enabled = !(settings.enabled ?? true);
    const updated = { ...settings, enabled };
    await ev.action.setSettings(updated);
    await this.syncAction(updated);
    await this.refreshTitle(ev.action, updated);
    await ev.action.showOk();
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ScheduleSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

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
      case "getSchedules":
        await this.sendSchedules(ev.action);
        break;
      case "deleteSchedule": {
        const id = ev.payload.scheduleId;
        const { scheduleId: ownId } = await ev.action.getSettings();
        // This key's own schedule follows its settings and would be added
        // back on the next change; it is paused by pressing the key.
        if (typeof id === "string" && id !== ownId)
          await schedulerService.removeAction(id);
        await this.sendSchedules(ev.action);
        break;
      }
    }
  }

  /**
   * Every saved schedule, for the inspector's "Manage schedules" list.
   * Stream Deck sends no event when a key is deleted, so this is where a
   * deleted key's schedule can be found and removed.
   */
  private async sendSchedules(action: {
    id: string;
    getSettings(): Promise<ScheduleSettings>;
  }): Promise<void> {
    const { scheduleId: ownId } = await action.getSettings();
    const schedules = schedulerService
      .getService()
      .getAll()
      .map((item) => {
        const { schedule, ...rest } = item.toJSON();
        return {
          ...rest,
          ...schedule,
          enabled: item.isEnabled(),
          nextAt: item.nextTriggerAt()?.toISOString() ?? null,
          own: item.id === ownId,
        };
      });
    await sendToPI(action.id, { event: "schedulesReceived", schedules });
  }

  private isConfigured(settings: ScheduleSettings): boolean {
    if (!settings.selectedDeviceId || !settings.command) return false;
    if (!settings.scheduleType) return false;

    switch (settings.scheduleType) {
      case ScheduleType.Daily:
        return settings.hour !== undefined && settings.minute !== undefined;
      case ScheduleType.Weekly:
        return (
          settings.hour !== undefined &&
          settings.minute !== undefined &&
          Array.isArray(settings.days) &&
          settings.days.length > 0
        );
      case ScheduleType.Delay:
        return (
          typeof settings.delaySeconds === "number" && settings.delaySeconds > 0
        );
      case ScheduleType.OneTime:
        return false; // not supported from PI for MVP
    }
  }

  /**
   * Sync this action's settings with the SchedulerService.
   * Creates/updates/removes the scheduled action as needed.
   */
  private async syncAction(settings: ScheduleSettings): Promise<void> {
    const id = settings.scheduleId;
    if (!id) return;

    if (!this.isConfigured(settings)) {
      await schedulerService.removeAction(id);
      return;
    }

    try {
      const schedule = this.buildSchedule(settings);
      const finalSchedule =
        (settings.enabled ?? true) ? schedule : schedule.disable();

      const scheduledAction = ScheduledAction.create({
        id,
        name: settings.scheduleName || "Scheduled Action",
        schedule: finalSchedule,
        targetId: settings.selectedDeviceId!,
        targetType: settings.selectedDeviceId?.startsWith("group:")
          ? "group"
          : "light",
        command: settings.command!,
        commandValue: settings.commandValue,
      });

      const existing = schedulerService.getService().get(id);
      if (existing) {
        await schedulerService.updateAction(scheduledAction);
      } else {
        await schedulerService.addAction(scheduledAction);
      }
    } catch (error) {
      streamDeck.logger?.error("Failed to sync scheduled action:", error);
    }
  }

  private buildSchedule(settings: ScheduleSettings): Schedule {
    switch (settings.scheduleType) {
      case ScheduleType.Daily:
        return Schedule.daily(
          settings.hour!,
          settings.minute!,
          settings.clock ?? "utc",
        );
      case ScheduleType.Weekly:
        return Schedule.weekly(
          settings.days!,
          settings.hour!,
          settings.minute!,
          settings.clock ?? "utc",
        );
      case ScheduleType.Delay:
        return Schedule.delay(settings.delaySeconds!);
      default:
        throw new Error(`Unsupported schedule type: ${settings.scheduleType}`);
    }
  }

  private async refreshTitle(
    action: { setTitle: (title: string) => Promise<void> },
    settings: ScheduleSettings,
  ): Promise<void> {
    await action.setTitle(this.getTitle(settings));
  }

  private getTitle(settings: ScheduleSettings): string {
    if (!this.isConfigured(settings)) return "⚙ Setup";
    if (!(settings.enabled ?? true)) return "⏸ Off";

    const existing = settings.scheduleId
      ? schedulerService.getService().get(settings.scheduleId)
      : undefined;
    const next = existing?.nextTriggerAt();
    if (!next) return "✓";

    // Local time, whichever clock the schedule was entered in.
    const hh = String(next.getHours()).padStart(2, "0");
    const mm = String(next.getMinutes()).padStart(2, "0");
    return `⏰\n${hh}:${mm}`;
  }
}
