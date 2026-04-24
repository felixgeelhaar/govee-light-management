import { streamDeck } from "@elgato/streamdeck";
import { Brightness } from "../domain/value-objects/Brightness";
import { ColorRgb } from "../domain/value-objects/ColorRgb";
import { ColorTemperature } from "../domain/value-objects/ColorTemperature";
import { ScheduleService } from "../domain/services/ScheduleService";
import { ScheduledAction } from "../domain/entities/ScheduledAction";
import { SchedulerEngine } from "../infrastructure/SchedulerEngine";
import { globalSettingsService } from "./GlobalSettingsService";
import { ActionServices } from "../actions/shared/ActionServices";

/**
 * Plugin-level scheduler singleton.
 * Coordinates the domain ScheduleService, infrastructure SchedulerEngine,
 * and action execution via ActionServices.
 */
class SchedulerServiceImpl {
  private scheduleService = new ScheduleService();
  private actionServices = new ActionServices();
  private engine: SchedulerEngine;
  private initialized = false;

  constructor() {
    this.engine = new SchedulerEngine(
      this.scheduleService,
      (action) => this.executeAction(action),
      { pollIntervalMs: 30_000 },
    );
  }

  /**
   * Initialize the scheduler: load persisted actions and start the engine.
   * Idempotent — safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await globalSettingsService.getScheduledActions();
      if (Array.isArray(stored) && stored.length > 0) {
        this.scheduleService.loadFromJSON(
          stored as Parameters<typeof this.scheduleService.loadFromJSON>[0],
        );
      }
    } catch (error) {
      streamDeck.logger?.error("Failed to load scheduled actions:", error);
    }

    this.engine.start();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.engine.stop();
    await this.persist();
  }

  getService(): ScheduleService {
    return this.scheduleService;
  }

  async addAction(action: ScheduledAction): Promise<void> {
    this.scheduleService.register(action);
    await this.persist();
  }

  async updateAction(action: ScheduledAction): Promise<void> {
    this.scheduleService.update(action);
    await this.persist();
  }

  async removeAction(id: string): Promise<boolean> {
    const removed = this.scheduleService.remove(id);
    if (removed) await this.persist();
    return removed;
  }

  private async persist(): Promise<void> {
    try {
      await globalSettingsService.setScheduledActions(
        this.scheduleService.exportToJSON(),
      );
    } catch (error) {
      streamDeck.logger?.error("Failed to persist scheduled actions:", error);
    }
  }

  /**
   * Execute a scheduled action — resolves target and dispatches to LightControlService.
   */
  private async executeAction(action: ScheduledAction): Promise<void> {
    const apiKey = await globalSettingsService.getApiKey();
    if (!apiKey) {
      streamDeck.logger?.warn(
        `Skipping scheduled action ${action.id}: no API key configured`,
      );
      return;
    }

    await this.actionServices.ensureServices(apiKey);

    const target = await this.actionServices.resolveTarget({
      selectedDeviceId: action.targetId,
    });
    if (!target) {
      streamDeck.logger?.warn(
        `Skipping scheduled action ${action.id}: target ${action.targetId} not found`,
      );
      return;
    }

    const command = action.command;
    const value = this.resolveCommandValue(command, action.commandValue);

    if (command === "toggle") {
      const nextState =
        target.type === "light" && target.light?.isOn ? "off" : "on";
      await this.actionServices.controlTarget(target, nextState);
      return;
    }

    await this.actionServices.controlTarget(
      target,
      command as "on" | "off" | "brightness" | "color" | "colorTemperature",
      value,
    );
    streamDeck.logger?.info(
      `Scheduled action ${action.id} fired: ${command} on ${action.targetId}`,
    );
  }

  private resolveCommandValue(
    command: string,
    raw: number | string | undefined,
  ): Brightness | ColorRgb | ColorTemperature | undefined {
    if (raw === undefined) return undefined;

    try {
      if (command === "brightness" && typeof raw === "number") {
        return new Brightness(raw);
      }
      if (command === "color" && typeof raw === "string") {
        return ColorRgb.fromHex(raw);
      }
      if (command === "colorTemperature" && typeof raw === "number") {
        return new ColorTemperature(raw);
      }
    } catch (error) {
      streamDeck.logger?.warn(
        `Invalid command value for ${command}: ${raw}`,
        error,
      );
    }
    return undefined;
  }
}

export const schedulerService = new SchedulerServiceImpl();
