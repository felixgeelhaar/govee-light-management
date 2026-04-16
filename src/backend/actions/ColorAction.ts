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
import { ColorRgb } from "@felixgeelhaar/govee-api-client";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import { telemetryService } from "../services/TelemetryService";

type ColorSettings = BaseSettings & {
  colorValue?: string;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.color" })
export class ColorAction extends SingletonAction<ColorSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<ColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ColorSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent<ColorSettings>): Promise<void> {
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
      const color = ColorRgb.fromHex(settings.colorValue || "#ffffff");
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        // Exit gradient/nightlight overlay once per key session so
        // setColor is not tinted by a lingering mode (see #170).
        if (target.type === "light" && target.light) {
          await this.services.ensurePreparedForSolidColor(
            ev.action.id,
            target.light,
          );
        }
        await this.services.controlTarget(target, "color", color);
      } finally {
        stopSpinner();
      }
      await ev.action.setTitle(this.getTitle(settings));
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.color`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set color:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorSettings>,
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

  private getTitle(_settings: ColorSettings): string {
    return "";
  }
}
