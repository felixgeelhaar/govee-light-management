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
import { Snapshot } from "@felixgeelhaar/govee-api-client";
import {
  ActionServices,
  sendPIDatasource,
  type BaseSettings,
} from "./shared/ActionServices";

type SnapshotSettings = BaseSettings & {
  selectedSnapshot?: string;
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.snapshot" })
export class SnapshotAction extends SingletonAction<SnapshotSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<SnapshotSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override onWillDisappear(_ev: WillDisappearEvent<SnapshotSettings>): void {
    // No state to clean up
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<SnapshotSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent<SnapshotSettings>): Promise<void> {
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

    if (!settings.selectedSnapshot) {
      streamDeck.logger.warn("Snapshot action: no snapshot selected");
      await ev.action.showAlert();
      return;
    }

    try {
      const parsed = JSON.parse(settings.selectedSnapshot) as {
        id: number;
        paramId: number;
        name: string;
      };
      const snapshot = new Snapshot(parsed.id, parsed.paramId, parsed.name);

      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        if (target.type === "light" && target.light) {
          await this.services.applySnapshot(target.light, snapshot);
        } else if (target.type === "group" && target.group) {
          // Apply snapshot to each light in the group.
          // Groups don't have a single-call path for snapshots,
          // so iterate the members sequentially.
          for (const member of target.group.lights) {
            try {
              await this.services.applySnapshot(member, snapshot);
            } catch (error) {
              streamDeck.logger.warn(
                `Snapshot apply failed for group member ${member.name}:`,
                error,
              );
              // Continue to next light — don't fail the whole group
            }
          }
        }
      } finally {
        stopSpinner();
      }
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to apply snapshot:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, SnapshotSettings>,
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
      case "getSnapshots": {
        const settings = await ev.action.getSettings();
        await this.handleGetSnapshots(ev.action.id, settings);
        break;
      }
    }
  }

  private async handleGetSnapshots(
    actionId: string,
    settings: SnapshotSettings,
  ): Promise<void> {
    const deviceId = settings.selectedDeviceId;
    if (!deviceId) {
      await sendPIDatasource(actionId, {
        event: "getSnapshots",
        items: [],
        status: "empty",
        message: "Select a device to load its snapshots.",
      });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings ?? {});
      if (!apiKey) {
        await sendPIDatasource(actionId, {
          event: "getSnapshots",
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

      // For groups, fetch snapshots from the first controllable member.
      let queryLight;
      if (target?.type === "light" && target.light) {
        queryLight = target.light;
      } else if (target?.type === "group" && target.group) {
        const members = target.group.getControllableLights();
        queryLight = members[0];
      }

      if (!queryLight) {
        await sendPIDatasource(actionId, {
          event: "getSnapshots",
          items: [],
          status: "error",
          message:
            "Selected device could not be resolved. Try refreshing devices.",
        });
        return;
      }

      const snapshots = await this.services.getSnapshots(queryLight);
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
      streamDeck.logger.error("Failed to fetch snapshots:", error);
      await sendPIDatasource(actionId, {
        event: "getSnapshots",
        items: [],
        status: "error",
        message: "Failed to load snapshots. Check your connection and retry.",
      });
    }
  }

  private getTitle(settings: SnapshotSettings): string {
    if (!settings.selectedSnapshot) return "";
    try {
      const parsed = JSON.parse(settings.selectedSnapshot);
      return parsed.name || "";
    } catch {
      return "";
    }
  }
}
