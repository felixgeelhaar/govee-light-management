/**
 * Recall — composite action that bundles dynamic scenes, DIY scenes,
 * and snapshots behind a single device + look picker. The user picks
 * one "look" they want a key to apply, regardless of whether Govee
 * classifies it as a scene or a snapshot. Removes the discoverability
 * tax of the three atomic actions (Scene, DIY scene mode, Snapshot)
 * for the very common "I want one button to recall this room state" job.
 *
 * Direct user demand for this composite is documented in #199 ("similar
 * to the Tap-To-Run feature in the Govee Home app") and #182 ("having
 * a list of my Govee snapshots"). The atomic actions remain shipped —
 * Recall is additive, not a deprecation.
 */
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
import {
  ActionServices,
  sendPIDatasource,
  type BaseSettings,
  type PIDatasourceItem,
} from "./shared/ActionServices";
import { KeypadStateTracker } from "./shared/KeypadStateTracker";
import { applyRecallToLight, parseRecallPayload } from "./recall-payload";

type RecallSettings = BaseSettings & {
  selectedRecall?: string;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.recall" })
export class RecallAction extends SingletonAction<RecallSettings> {
  private services = new ActionServices();
  private settingsByCtx = new Map<string, RecallSettings>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private actionsByCtx = new Map<string, any>();
  private state = new KeypadStateTracker({
    renderTitle: async (ctx) => {
      const action = this.actionsByCtx.get(ctx);
      const settings = this.settingsByCtx.get(ctx);
      if (!action || !settings) return;
      await action.setTitle(this.composeTitle(settings, ctx));
    },
  });

  override async onWillAppear(
    ev: WillAppearEvent<RecallSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    this.settingsByCtx.set(ctx, ev.payload.settings);
    this.actionsByCtx.set(ctx, ev.action);
    await ev.action.setTitle(this.composeTitle(ev.payload.settings, ctx));
    this.state.attach(ev.action, ev.payload.settings);
  }

  override onWillDisappear(ev: WillDisappearEvent<RecallSettings>): void {
    const ctx = ev.action.id;
    this.settingsByCtx.delete(ctx);
    this.actionsByCtx.delete(ctx);
    this.state.detach(ctx);
    this.services.clearPartialFailureBanner(ctx);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<RecallSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    this.settingsByCtx.set(ctx, ev.payload.settings);
    this.actionsByCtx.set(ctx, ev.action);
    await ev.action.setTitle(this.composeTitle(ev.payload.settings, ctx));
    await this.state.settingsChanged(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<RecallSettings>): Promise<void> {
    const { settings } = ev.payload;
    this.state.bumpEpoch(ev.action.id);

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

    if (!settings.selectedRecall) {
      streamDeck.logger.warn("Recall action: no look selected");
      await ev.action.showAlert();
      return;
    }

    const parsed = parseRecallPayload(settings.selectedRecall);
    if (!parsed) {
      streamDeck.logger.warn("Recall action: malformed selectedRecall payload");
      await ev.action.showAlert();
      return;
    }

    const stopSpinner = this.services.showSpinner(ev.action);
    let anySucceeded = false;
    let failedCount = 0;
    let totalCount = 0;
    try {
      if (target.type === "light" && target.light) {
        await applyRecallToLight(this.services, target.light, parsed);
        anySucceeded = true;
      } else if (target.type === "group" && target.group) {
        const members = target.group.getControllableLights();
        totalCount = members.length;
        for (const light of members) {
          try {
            await applyRecallToLight(this.services, light, parsed);
            anySucceeded = true;
          } catch (error) {
            failedCount++;
            streamDeck.logger.warn(
              `Recall apply failed for group member ${light.name}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      streamDeck.logger.error("Failed to apply recall:", error);
      stopSpinner();
      await ev.action.showAlert();
      return;
    } finally {
      stopSpinner();
    }

    if (!anySucceeded) {
      await ev.action.showAlert();
      return;
    }
    // Optimistic status: scenes/snapshots always result in lights on,
    // so flip the glyph immediately rather than waiting up to 30 s for
    // the next live-sync.
    if (target.type === "light" && target.light) {
      this.state.setOptimisticSingle(ev.action.id, true);
    } else if (target.type === "group" && target.group) {
      const total = target.group.lights.length;
      const commanded = target.group.getControllableLights().length;
      this.state.setOptimisticGroup(ev.action.id, commanded, total);
    }
    await ev.action.setTitle(this.composeTitle(settings, ev.action.id));

    if (failedCount > 0 && totalCount > 0) {
      this.services.showPartialFailureBanner(
        ev.action,
        ev.action.id,
        failedCount,
        totalCount,
        this.composeTitle(settings, ev.action.id),
      );
    }
    await ev.action.showOk();
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, RecallSettings>,
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
      case "getRecallOptions": {
        const settings = await ev.action.getSettings();
        const selectedDeviceId =
          typeof ev.payload.selectedDeviceId === "string"
            ? ev.payload.selectedDeviceId
            : settings.selectedDeviceId;
        await this.handleGetRecallOptions(ev.action.id, {
          ...settings,
          selectedDeviceId,
        });
        break;
      }
    }
  }

  private async handleGetRecallOptions(
    actionId: string,
    settings: RecallSettings,
  ): Promise<void> {
    const deviceId = settings.selectedDeviceId;
    if (!deviceId) {
      await sendPIDatasource(actionId, {
        event: "getRecallOptions",
        items: [],
        status: "empty",
        message: "Select a device to load its scenes and snapshots.",
      });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings);
      if (!apiKey) {
        await sendPIDatasource(actionId, {
          event: "getRecallOptions",
          items: [],
          status: "error",
          message: "Missing API key — reconnect in the API Key panel.",
        });
        return;
      }

      await this.services.ensureServices(apiKey);
      const target = await this.services.resolveTarget({
        selectedDeviceId: deviceId,
      });

      // For groups, query the first controllable member's catalogue;
      // members of a plugin group are typically the same model so they
      // share scene + snapshot definitions.
      let queryLight;
      if (target?.type === "light" && target.light) {
        queryLight = target.light;
      } else if (target?.type === "group" && target.group) {
        queryLight = target.group.getControllableLights()[0];
      }

      if (!queryLight) {
        await sendPIDatasource(actionId, {
          event: "getRecallOptions",
          items: [],
          status: "error",
          message:
            "Selected device could not be resolved. Try refreshing devices.",
        });
        return;
      }

      const [dynamicResult, diyResult, snapshotResult] =
        await Promise.allSettled([
          this.services.getDynamicScenes(queryLight),
          this.services.getDiyScenes(queryLight),
          this.services.getSnapshots(queryLight),
        ]);

      const dynamicScenes =
        dynamicResult.status === "fulfilled" ? dynamicResult.value : [];
      const diyScenes = diyResult.status === "fulfilled" ? diyResult.value : [];
      const snapshots =
        snapshotResult.status === "fulfilled" ? snapshotResult.value : [];

      const items: PIDatasourceItem[] = [];

      if (dynamicScenes.length > 0) {
        items.push({
          label: "Scenes",
          value: "",
          children: dynamicScenes.map((scene) => ({
            label: scene.name,
            value: JSON.stringify({
              kind: "scene",
              sceneKind: "dynamic",
              id: scene.id,
              paramId: scene.paramId,
              name: scene.name,
            }),
          })),
        });
      }
      if (diyScenes.length > 0) {
        items.push({
          label: "DIY Scenes",
          value: "",
          children: diyScenes.map((scene) => ({
            label: scene.name,
            value: JSON.stringify({
              kind: "scene",
              sceneKind: "diy",
              id: scene.id,
              paramId: scene.paramId,
              name: scene.name,
            }),
          })),
        });
      }
      if (snapshots.length > 0) {
        items.push({
          label: "Snapshots",
          value: "",
          children: snapshots.map((s) => ({
            label: s.name,
            value: JSON.stringify({
              kind: "snapshot",
              id: s.id,
              paramId: s.paramId,
              name: s.name,
            }),
          })),
        });
      }

      if (items.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getRecallOptions",
          items: [],
          status: "empty",
          message:
            "No scenes or snapshots found for this device. Create them in the Govee mobile app first.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getRecallOptions",
        status: "ok",
        items,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch recall options:", error);
      await sendPIDatasource(actionId, {
        event: "getRecallOptions",
        items: [],
        status: "error",
        message:
          "Failed to load scenes and snapshots. Check your connection and retry.",
      });
    }
  }

  /** Action-specific label (the look name). Used by the partial-failure banner. */
  private getTitle(settings: RecallSettings): string {
    if (!settings.selectedRecall) return "";
    const parsed = parseRecallPayload(settings.selectedRecall);
    return parsed?.name ?? "";
  }

  /**
   * Compose the visible key title: action label on top, shared status
   * glyph below. Empty status falls through to the bare label so the
   * key doesn't look broken before the first sync lands.
   */
  private composeTitle(settings: RecallSettings, ctx: string): string {
    const label = this.getTitle(settings);
    const status = this.state.getStatusGlyph(ctx);
    if (!label) return status;
    if (!status) return label;
    return `${label}\n${status}`;
  }
}
