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
import { Sequence } from "../domain/entities/Sequence";
import {
  SequenceStep,
  SequenceStepJSON,
} from "../domain/value-objects/SequenceStep";
import { sequenceService } from "../services/SequenceService";
import { effectService } from "../services/EffectService";
import { buildSceneItems } from "./scene-items";
import type { Light } from "../domain/entities/Light";

type SequenceSettings = BaseSettings & {
  sequenceId?: string;
  sequenceName?: string;
  steps?: SequenceStepJSON[];
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.sequence" })
export class SequenceAction extends SingletonAction<SequenceSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<SequenceSettings>,
  ): Promise<void> {
    await sequenceService.initialize();
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SequenceSettings>,
  ): Promise<void> {
    await this.refreshTitle(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<SequenceSettings>): Promise<void> {
    const settings = ev.payload.settings;

    if (
      !settings.sequenceId ||
      !settings.steps ||
      settings.steps.length === 0
    ) {
      await ev.action.showAlert();
      return;
    }

    const sequence = this.buildSequence(settings);
    if (!sequence) {
      await ev.action.showAlert();
      return;
    }

    if (sequenceService.isRunning(sequence.id)) {
      // Press again to cancel running sequence
      sequenceService.cancel(sequence.id);
      await ev.action.setTitle("Cancelled");
      return;
    }

    try {
      await ev.action.setTitle("▶ Running");
      await sequenceService.executeSequence(sequence);
      await ev.action.showOk();
      await this.refreshTitle(ev.action, settings);
    } catch (error) {
      streamDeck.logger?.error("Sequence execution failed:", error);
      await ev.action.showAlert();
      await this.refreshTitle(ev.action, settings);
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SequenceSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

    const payload = ev.payload as Record<string, unknown>;
    const targetId =
      typeof payload.targetId === "string"
        ? payload.targetId
        : typeof payload.selectedDeviceId === "string"
          ? payload.selectedDeviceId
          : undefined;

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
      case "getScenes":
        await this.handleGetScenes(ev.action.id, targetId);
        break;
      case "getSnapshots":
        await this.handleGetSnapshots(ev.action.id, targetId);
        break;
      case "getMusicModes":
        await this.handleGetMusicModes(ev.action.id, targetId);
        break;
      case "getToggleFeatures":
        await this.handleGetToggleFeatures(ev.action.id, targetId);
        break;
      case "getEffects":
        await this.handleGetEffects(ev.action.id);
        break;
    }
  }

  /**
   * Resolve the PI-supplied `targetId` (a sequence step target) to the Light
   * we can query capabilities from. For groups we pick the first controllable
   * light, which shares the capability set with the rest of the group.
   * Returns undefined if services can't initialize or the target can't be
   * resolved — callers should send an `error`/`empty` datasource response.
   */
  private async resolveQueryLight(
    targetId: string | undefined,
  ): Promise<Light | undefined> {
    if (!targetId) return undefined;
    const apiKey = await this.services.getApiKey({});
    if (!apiKey) return undefined;
    await this.services.ensureServices(apiKey);
    const target = await this.services.resolveTarget({
      selectedDeviceId: targetId,
    });
    if (target?.type === "light" && target.light) return target.light;
    if (target?.type === "group" && target.group) {
      return target.group.getControllableLights()[0];
    }
    return undefined;
  }

  private async handleGetScenes(
    actionId: string,
    targetId: string | undefined,
  ): Promise<void> {
    if (!targetId) {
      await sendPIDatasource(actionId, {
        event: "getScenes",
        items: [],
        status: "empty",
        message: "Pick a light for this step first to load its scenes.",
      });
      return;
    }
    try {
      const light = await this.resolveQueryLight(targetId);
      if (!light) {
        await sendPIDatasource(actionId, {
          event: "getScenes",
          items: [],
          status: "error",
          message:
            "Selected device could not be resolved. Try refreshing devices.",
        });
        return;
      }
      const [dynamicScenes, diyScenes] = await Promise.all([
        this.services.getDynamicScenes(light),
        this.services.getDiyScenes(light),
      ]);
      const items = buildSceneItems(dynamicScenes, diyScenes);
      if (items.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getScenes",
          items: [],
          status: "empty",
          message:
            "This device has no dynamic or DIY scenes available. Create scenes in the Govee mobile app first.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getScenes",
        status: "ok",
        items,
      });
    } catch (error) {
      streamDeck.logger?.error("Sequence getScenes failed:", error);
      await sendPIDatasource(actionId, {
        event: "getScenes",
        items: [],
        status: "error",
        message: "Failed to load scenes. Check your connection and retry.",
      });
    }
  }

  private async handleGetSnapshots(
    actionId: string,
    targetId: string | undefined,
  ): Promise<void> {
    if (!targetId) {
      await sendPIDatasource(actionId, {
        event: "getSnapshots",
        items: [],
        status: "empty",
        message: "Pick a light for this step first to load its snapshots.",
      });
      return;
    }
    try {
      const light = await this.resolveQueryLight(targetId);
      if (!light) {
        await sendPIDatasource(actionId, {
          event: "getSnapshots",
          items: [],
          status: "error",
          message:
            "Selected device could not be resolved. Try refreshing devices.",
        });
        return;
      }
      const snapshots = await this.services.getSnapshots(light);
      if (snapshots.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getSnapshots",
          items: [],
          status: "empty",
          message:
            "No snapshots found. Create one in the Govee mobile app first.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getSnapshots",
        status: "ok",
        items: snapshots.map((s) => ({
          label: s.name,
          value: JSON.stringify({
            id: s.id,
            paramId: s.paramId,
            name: s.name,
          }),
        })),
      });
    } catch (error) {
      streamDeck.logger?.error("Sequence getSnapshots failed:", error);
      await sendPIDatasource(actionId, {
        event: "getSnapshots",
        items: [],
        status: "error",
        message: "Failed to load snapshots. Check your connection and retry.",
      });
    }
  }

  private async handleGetMusicModes(
    actionId: string,
    targetId: string | undefined,
  ): Promise<void> {
    if (!targetId) {
      await sendPIDatasource(actionId, {
        event: "getMusicModes",
        items: [],
        status: "empty",
        message: "Pick a light for this step first to load its music modes.",
      });
      return;
    }
    try {
      const apiKey = await this.services.getApiKey({});
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
      // The upstream getMusicModes() is keyed by selectedDeviceId — so for
      // groups resolve to the first member's light-id.
      const target = await this.services.resolveTarget({
        selectedDeviceId: targetId,
      });
      let queryDeviceId = targetId;
      if (target?.type === "group" && target.group) {
        const first = target.group.getControllableLights()[0];
        if (first) queryDeviceId = `light:${first.deviceId}|${first.model}`;
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
      streamDeck.logger?.error("Sequence getMusicModes failed:", error);
      await sendPIDatasource(actionId, {
        event: "getMusicModes",
        items: [],
        status: "error",
        message: "Failed to load music modes. Check your connection and retry.",
      });
    }
  }

  private async handleGetToggleFeatures(
    actionId: string,
    targetId: string | undefined,
  ): Promise<void> {
    if (!targetId) {
      await sendPIDatasource(actionId, {
        event: "getToggleFeatures",
        items: [],
        status: "empty",
        message:
          "Pick a light for this step first to load its toggleable features.",
      });
      return;
    }
    try {
      const apiKey = await this.services.getApiKey({});
      if (!apiKey) {
        await sendPIDatasource(actionId, {
          event: "getToggleFeatures",
          items: [],
          status: "error",
          message: "Missing API key — reconnect in the API Key panel.",
        });
        return;
      }
      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget({
        selectedDeviceId: targetId,
      });
      let queryDeviceId = targetId;
      if (target?.type === "group" && target.group) {
        const first = target.group.getControllableLights()[0];
        if (first) queryDeviceId = `light:${first.deviceId}|${first.model}`;
      }
      const features = await this.services.getToggleFeatures(queryDeviceId);
      if (features.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getToggleFeatures",
          items: [],
          status: "empty",
          message: "This device has no toggleable features.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getToggleFeatures",
        status: "ok",
        items: features.map((f) => ({
          label: f.name,
          value: JSON.stringify({ name: f.name, instance: f.instance }),
        })),
      });
    } catch (error) {
      streamDeck.logger?.error("Sequence getToggleFeatures failed:", error);
      await sendPIDatasource(actionId, {
        event: "getToggleFeatures",
        items: [],
        status: "error",
        message:
          "Failed to load toggleable features. Check your connection and retry.",
      });
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
        items: [],
        status: "empty",
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

  private buildSequence(settings: SequenceSettings): Sequence | null {
    if (!settings.sequenceId || !settings.steps) return null;
    try {
      const steps = settings.steps.map((s) => SequenceStep.fromJSON(s));
      return Sequence.create({
        id: settings.sequenceId,
        name: settings.sequenceName || "Sequence",
        steps,
      });
    } catch (error) {
      streamDeck.logger?.error("Failed to build sequence:", error);
      return null;
    }
  }

  private async refreshTitle(
    action: { setTitle: (title: string) => Promise<void> },
    settings: SequenceSettings,
  ): Promise<void> {
    const stepCount = settings.steps?.length ?? 0;
    if (stepCount === 0) {
      await action.setTitle("⚙ Empty");
    } else {
      await action.setTitle(`▶\n${stepCount} steps`);
    }
  }
}
