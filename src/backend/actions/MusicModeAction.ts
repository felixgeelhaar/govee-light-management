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
import { MusicModeOption } from "../domain/value-objects/MusicModeOption";
import {
  ActionServices,
  sendPIDatasource,
  type BaseSettings,
} from "./shared/ActionServices";

type MusicModeSettings = BaseSettings & {
  selectedMode?: string; // JSON: { name, modeId }
  sensitivity?: number;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.music-mode" })
export class MusicModeAction extends SingletonAction<MusicModeSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<MusicModeSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override onWillDisappear(ev: WillDisappearEvent<MusicModeSettings>): void {
    this.services.clearPartialFailureBanner(ev.action.id);
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
    if (!target) {
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
      const musicMode = MusicModeOption.create(
        parsed.modeId,
        settings.sensitivity ?? 50,
      );
      const stopSpinner = this.services.showSpinner(ev.action);
      let anySucceeded = false;
      let failedCount = 0;
      let totalCount = 0;
      try {
        if (target.type === "light" && target.light) {
          await this.services.applyMusicModeRaw(target.light, musicMode);
          anySucceeded = true;
        } else if (target.type === "group" && target.group) {
          const members = target.group.getControllableLights();
          totalCount = members.length;
          for (const light of members) {
            try {
              await this.services.applyMusicModeRaw(light, musicMode);
              anySucceeded = true;
            } catch (error) {
              failedCount++;
              streamDeck.logger.warn(
                `Music mode apply failed for group member ${light.name}:`,
                error,
              );
            }
          }
          if (members.length === 0) {
            streamDeck.logger.warn(
              `Music mode: group ${target.group.name} has no controllable lights`,
            );
          }
        }
      } finally {
        stopSpinner();
      }
      if (!anySucceeded) {
        await ev.action.showAlert();
        return;
      }
      if (failedCount > 0 && totalCount > 0) {
        this.services.showPartialFailureBanner(
          ev.action,
          ev.action.id,
          failedCount,
          totalCount,
          this.getTitle(settings),
        );
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
      case "getMusicModes": {
        const settings = {
          ...(await ev.action.getSettings()),
          ...(typeof ev.payload.selectedDeviceId === "string"
            ? { selectedDeviceId: ev.payload.selectedDeviceId }
            : {}),
        };
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
      await sendPIDatasource(actionId, {
        event: "getMusicModes",
        items: [],
        status: "empty",
        message: "Select a device to load its music modes.",
      });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings);
      if (!apiKey) {
        await sendPIDatasource(actionId, {
          event: "getMusicModes",
          items: [],
          status: "error",
          message: "Missing API key — reconnect in the API Key panel.",
        });
        return;
      }

      await this.services.ensureServices(apiKey);

      // For groups, query music modes from the first controllable member.
      const target = await this.services.resolveTarget({
        selectedDeviceId: deviceId,
      });
      let queryDeviceId = deviceId;
      if (target?.type === "group" && target.group) {
        const first = target.group.getControllableLights()[0];
        if (first) {
          queryDeviceId = `light:${first.deviceId}|${first.model}`;
        }
      }

      const modes = await this.services.getMusicModes(queryDeviceId);
      if (modes.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getMusicModes",
          items: [],
          status: "empty",
          message: "This device doesn't support music modes.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getMusicModes",
        status: "ok",
        items: modes.map((m) => ({
          label: m.name,
          value: JSON.stringify({ name: m.name, modeId: m.value }),
        })),
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch music modes:", error);
      await sendPIDatasource(actionId, {
        event: "getMusicModes",
        items: [],
        status: "error",
        message: "Failed to load music modes. Check your connection and retry.",
      });
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
