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
import { LightScene } from "@felixgeelhaar/govee-api-client";
import {
  ActionServices,
  sendToPI,
  type BaseSettings,
} from "./shared/ActionServices";

type SceneSettings = BaseSettings & {
  selectedScene?: string;
  sceneId?: number;
  sceneParamId?: number;
  sceneName?: string;
};

export class SceneAction extends SingletonAction<SceneSettings> {
  override readonly manifestId =
    "com.felixgeelhaar.govee-light-management.scene";
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<SceneSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override onWillDisappear(_ev: WillDisappearEvent<SceneSettings>): void {
    // No state to clean up
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SceneSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
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

    if (!settings.selectedScene) {
      streamDeck.logger.warn("Scene action: no scene selected");
      await ev.action.showAlert();
      return;
    }

    try {
      const parsed = JSON.parse(settings.selectedScene) as {
        id: number;
        paramId: number;
        name: string;
      };
      const scene = new LightScene(parsed.id, parsed.paramId, parsed.name);
      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        await this.services.applyDynamicScene(target.light, scene);
      } finally {
        stopSpinner();
      }
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to apply scene:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SceneSettings>,
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
      case "getScenes": {
        const settings = await ev.action.getSettings();
        await this.handleGetScenes(ev.action.id, settings);
        break;
      }
    }
  }

  private async handleGetScenes(
    actionId: string,
    settings: SceneSettings,
  ): Promise<void> {
    const deviceId = settings.selectedDeviceId;
    if (!deviceId) {
      await sendToPI(actionId, { event: "getScenes", items: [] });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings ?? {});
      if (!apiKey) {
        await sendToPI(actionId, { event: "getScenes", items: [] });
        return;
      }

      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget({
        selectedDeviceId: deviceId,
      });

      if (!target || target.type !== "light" || !target.light) {
        await sendToPI(actionId, { event: "getScenes", items: [] });
        return;
      }

      const scenes = await this.services.getDynamicScenes(target.light);
      await sendToPI(actionId, {
        event: "getScenes",
        items: scenes.map((s) => ({
          label: s.name,
          value: JSON.stringify({ id: s.id, paramId: s.paramId, name: s.name }),
        })),
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch scenes:", error);
      await sendToPI(actionId, { event: "getScenes", items: [] });
    }
  }

  private getTitle(settings: SceneSettings): string {
    if (!settings.selectedScene) return "";
    try {
      const parsed = JSON.parse(settings.selectedScene);
      return parsed.name || "";
    } catch {
      return "";
    }
  }
}
