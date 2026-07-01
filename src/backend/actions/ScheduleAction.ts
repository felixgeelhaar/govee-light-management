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
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { ScheduledAction } from "../domain/entities/ScheduledAction";
import {
  Schedule,
  ScheduleType,
  DayOfWeek,
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
    await schedulerService.initialize();
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ScheduleSettings>,
  ): Promise<void> {
    await this.syncAction(ev.payload.settings);
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<ScheduleSettings>): Promise<void> {
    const settings = ev.payload.settings;

    if (!this.isConfigured(settings)) {
      await ev.action.showAlert();
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
      case "refreshState":
        await this.services.handleRefreshState();
        break;
    }
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
        return Schedule.daily(settings.hour!, settings.minute!);
      case ScheduleType.Weekly:
        return Schedule.weekly(
          settings.days!,
          settings.hour!,
          settings.minute!,
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

    const hh = String(next.getUTCHours()).padStart(2, "0");
    const mm = String(next.getUTCMinutes()).padStart(2, "0");
    return `⏰\n${hh}:${mm}`;
  }
}
