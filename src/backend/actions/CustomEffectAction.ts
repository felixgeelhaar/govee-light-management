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
  sendPIDatasource,
  type BaseSettings,
} from "./shared/ActionServices";
import { effectService } from "../services/EffectService";

type CustomEffectSettings = BaseSettings & {
  effectId?: string;
  effectName?: string;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.custom-effect" })
export class CustomEffectAction extends SingletonAction<CustomEffectSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<CustomEffectSettings>,
  ): Promise<void> {
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<CustomEffectSettings>,
  ): Promise<void> {
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onKeyDown(
    ev: KeyDownEvent<CustomEffectSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!settings.selectedDeviceId || !settings.effectId) {
      await ev.action.showAlert();
      return;
    }

    // Toggle: if currently playing, cancel; otherwise start playback
    if (effectService.isPlaying(settings.selectedDeviceId)) {
      effectService.cancel(settings.selectedDeviceId);
      await ev.action.setTitle("⏹ Stopped");
      setTimeout(() => {
        void this.refreshTitle(ev.action, settings);
      }, 1000);
      return;
    }

    const effect = effectService.getPresetById(settings.effectId);
    if (!effect) {
      await ev.action.showAlert();
      return;
    }

    try {
      await ev.action.setTitle("▶\nPlaying");
      // Play in background — don't await the full loop
      void effectService
        .playEffect(settings.selectedDeviceId, effect)
        .then(() => this.refreshTitle(ev.action, settings))
        .catch((error) => {
          streamDeck.logger?.error("Effect playback failed:", error);
        });
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger?.error("Effect playback failed:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, CustomEffectSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

    switch (ev.payload.event) {
      case "getDevices":
        await this.services.handleGetDevices(ev.action.id);
        break;
      case "getEffects":
        await this.handleGetEffects(ev.action.id);
        break;
      case "refreshState":
        await this.services.handleRefreshState();
        break;
    }
  }

  private async handleGetEffects(actionId: string): Promise<void> {
    const effects = effectService.getPresets().map((e) => ({
      value: e.id,
      label: e.name,
    }));
    if (effects.length === 0) {
      await sendPIDatasource(actionId, {
        event: "getEffects",
        status: "empty",
        items: [],
        message: "No effects available.",
      });
      return;
    }
    await sendPIDatasource(actionId, {
      event: "getEffects",
      status: "ok",
      items: effects,
    });
  }

  private async refreshTitle(
    action: { setTitle: (title: string) => Promise<void> },
    settings: CustomEffectSettings,
  ): Promise<void> {
    if (!settings.effectId) {
      await action.setTitle("⚙ Setup");
      return;
    }
    const effect = effectService.getPresetById(settings.effectId);
    const name = effect?.name || "Effect";
    await action.setTitle(`✨\n${name}`);
  }
}
