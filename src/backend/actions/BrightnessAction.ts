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
import { Brightness } from "@felixgeelhaar/govee-api-client";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { telemetryService } from "../services/TelemetryService";

type BrightnessSettings = BaseSettings & {
  brightnessValue?: number;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.brightness" })
export class BrightnessAction extends SingletonAction<BrightnessSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<BrightnessSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<BrightnessSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(
    ev: KeyDownEvent<BrightnessSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

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

    const started = Date.now();

    try {
      const brightness = new Brightness(settings.brightnessValue ?? 50);
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        // Clear overlay modes for single lights and groups (see #170).
        await this.services.ensurePreparedForTarget(ev.action.id, target);
        await this.services.controlTarget(target, "brightness", brightness);
      } finally {
        stopSpinner();
      }
      await ev.action.setTitle(this.getTitle(settings));
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.brightness`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set brightness:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, BrightnessSettings>,
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
    }
  }

  private getTitle(_settings: BrightnessSettings): string {
    return "";
  }
}
