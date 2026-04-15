import {
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { MusicMode } from "@felixgeelhaar/govee-api-client";
import {
  ActionServices,
  sendToPI,
  type BaseSettings,
} from "./shared/ActionServices";

type MusicModeSettings = BaseSettings & {
  selectedMode?: string; // JSON: { name, modeId }
  sensitivity?: number;
};

export class MusicModeAction extends SingletonAction<MusicModeSettings> {
  override readonly manifestId =
    "com.felixgeelhaar.govee-light-management.music-mode";
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<MusicModeSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override onWillDisappear(_ev: WillDisappearEvent<MusicModeSettings>): void {
    // No state to clean up
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<MusicModeSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent<MusicModeSettings>): Promise<void> {
    const { settings } = ev.payload;

    const apiKey = await this.services.getApiKey(settings);
    if (!apiKey || !settings.selectedDeviceId) {
      await ev.action.showAlert();
      return;
    }

    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget(settings);
    if (!target || target.type !== "light" || !target.light) {
      await ev.action.showAlert();
      return;
    }

    if (!settings.selectedMode) {
      streamDeck.logger.warn("Music mode action: no mode selected");
      await ev.action.showAlert();
      return;
    }

    try {
      const parsed = JSON.parse(settings.selectedMode) as {
        name: string;
        modeId: number;
      };
      const musicMode = new MusicMode(
        parsed.modeId,
        settings.sensitivity ?? 50,
      );
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        await this.services.applyMusicModeRaw(target.light, musicMode);
      } finally {
        stopSpinner();
      }
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to set music mode:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, MusicModeSettings>,
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
      case "getMusicModes": {
        const settings = await ev.action.getSettings();
        await this.handleGetMusicModes(ev.action.id, settings);
        break;
      }
    }
  }

  private async handleGetMusicModes(
    actionId: string,
    settings: MusicModeSettings,
  ): Promise<void> {
    const deviceId = settings.selectedDeviceId;
    if (!deviceId) {
      await sendToPI(actionId, { event: "getMusicModes", items: [] });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings);
      if (!apiKey) {
        await sendToPI(actionId, { event: "getMusicModes", items: [] });
        return;
      }

      await this.services.ensureServices(apiKey);

      // Query device capabilities for music modes
      const modes = await this.services.getMusicModes(deviceId);
      await sendToPI(actionId, {
        event: "getMusicModes",
        items: modes.map((m) => ({
          label: m.name,
          value: JSON.stringify({ name: m.name, modeId: m.value }),
        })),
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch music modes:", error);
      await sendToPI(actionId, { event: "getMusicModes", items: [] });
    }
  }

  private getTitle(settings: MusicModeSettings): string {
    if (!settings.selectedMode) return "";
    try {
      const parsed = JSON.parse(settings.selectedMode);
      return parsed.name || "";
    } catch {
      return "";
    }
  }
}
