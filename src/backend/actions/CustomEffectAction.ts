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
    if (!ev.action.isKey()) return;
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<CustomEffectSettings>,
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onKeyDown(
    ev: KeyDownEvent<CustomEffectSettings>,
  ): Promise<void> {
    const { settings } = ev.payload;

    if (!settings.selectedDeviceId || !settings.effectId) {
      await this.services.ignoreUnconfiguredPress(ev.action, {
        hasSelectedDevice: Boolean(settings.selectedDeviceId),
        hasEffect: Boolean(settings.effectId),
      });
      return;
    }

    // Keys saved before the list was filtered can still hold a bulb, or a
    // group with no light that has segments; every frame would fail.
    if (!(await this.canPlayOn(settings.selectedDeviceId))) {
      await ev.action.setTitle("⚠\nPick light");
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

  /**
   * False only when the saved light is known to lack segment control, or
   * the saved group has no member with it.
   */
  private async canPlayOn(selectedDeviceId: string): Promise<boolean> {
    try {
      const apiKey = await this.services.getApiKey({});
      if (!apiKey) return true;
      await this.services.ensureServices(apiKey);
      if (selectedDeviceId.startsWith("group:")) {
        if ((await effectService.segmentedMembers(selectedDeviceId)).length)
          return true;
        streamDeck.logger.warn(
          "Custom effect needs a group with at least one light with segment control",
          { group: selectedDeviceId },
        );
        return false;
      }
      const target = await this.services.resolveTarget({ selectedDeviceId });
      if (target?.type !== "light" || !target.light) return true;
      if (target.light.supportsSegmentedColor()) return true;
      streamDeck.logger.warn(
        "Custom effect needs a light with segment control",
        { light: target.light.name },
      );
      return false;
    } catch {
      // Unknown: let playback try and report its own failure.
      return true;
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, CustomEffectSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

    switch (ev.payload.event) {
      case "getDevices":
        // Groups are listed by how many members have segments; a group
        // effect plays on those and skips the rest.
        await this.services.handleGetDevices(ev.action.id, {
          requires: "segmentedColor",
        });
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
