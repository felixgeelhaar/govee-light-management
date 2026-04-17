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
} from "./shared/ActionServices";
import { parseFeatureSetting } from "./shared/validation";

type ToggleSettings = BaseSettings & {
  selectedFeature?: string; // JSON: { name, instance }
  operation?: "toggle" | "on" | "off";
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.toggle" })
export class ToggleAction extends SingletonAction<ToggleSettings> {
  private services = new ActionServices();
  private featureState = new Map<string, boolean>();

  override async onWillAppear(
    ev: WillAppearEvent<ToggleSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    if (!this.featureState.has(ctx)) this.featureState.set(ctx, false);

    const { settings } = ev.payload;
    const parsed = settings.selectedFeature
      ? parseFeatureSetting(settings.selectedFeature)
      : null;

    if (parsed) {
      const apiKey = await this.services.getApiKey(settings);
      if (apiKey && settings.selectedDeviceId) {
        try {
          await this.services.ensureServices(apiKey);
          const target = await this.services.resolveTarget(settings);
          if (target?.type === "light" && target.light) {
            const enabled = await this.services.getToggleFeatureState(
              target.light,
              parsed.instance,
            );
            if (enabled !== undefined) {
              this.featureState.set(ctx, enabled);
            }
          }
        } catch {
          // Best effort - keep default
        }
      }
    }

    await ev.action.setTitle(this.getTitle(ev.payload.settings, ctx));
  }

  override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
    this.featureState.delete(ev.action.id);
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ToggleSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings, ev.action.id));
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;

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

    const parsed = settings.selectedFeature
      ? parseFeatureSetting(settings.selectedFeature)
      : null;

    if (!parsed) {
      streamDeck.logger.warn("Toggle action: no valid feature selected");
      await ev.action.showAlert();
      return;
    }

    const originalState = this.featureState.get(ctx) ?? false;

    try {
      const operation = settings.operation ?? "toggle";

      let enabled: boolean;
      if (operation === "toggle") {
        // For toggle mode, read live state from the first available light.
        let liveState: boolean | undefined;
        const queryLight =
          target.type === "light"
            ? target.light
            : target.group?.getControllableLights()[0];
        if (queryLight) {
          try {
            liveState = await this.services.getToggleFeatureState(
              queryLight,
              parsed.instance,
            );
          } catch (error) {
            streamDeck.logger.warn(
              `Falling back to cached toggle state for ${parsed.instance}:`,
              error,
            );
          }
        }
        const currentState = liveState ?? originalState;
        enabled = !currentState;
      } else {
        enabled = operation === "on";
      }

      // Optimistic update
      this.featureState.set(ctx, enabled);

      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        if (target.type === "light" && target.light) {
          await this.services.toggleFeatureRaw(
            target.light,
            parsed.instance,
            enabled,
          );
        } else if (target.type === "group" && target.group) {
          for (const light of target.group.getControllableLights()) {
            try {
              await this.services.toggleFeatureRaw(
                light,
                parsed.instance,
                enabled,
              );
            } catch (error) {
              streamDeck.logger.warn(
                `Toggle ${parsed.instance} failed for group member ${light.name}:`,
                error,
              );
            }
          }
        }
      } finally {
        stopSpinner();
      }
      await ev.action.setTitle(this.getTitle(settings, ctx));
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to toggle feature:", error);
      // Revert to original state
      this.featureState.set(ctx, originalState);
      await ev.action.setTitle(this.getTitle(settings, ctx));
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ToggleSettings>,
  ): Promise<void> {
    if (
      typeof ev.payload !== "object" ||
      ev.payload === null ||
      !("event" in ev.payload)
    )
      return;

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
      case "getToggleFeatures": {
        const settings = await ev.action.getSettings();
        await this.handleGetToggleFeatures(ev.action.id, settings);
        break;
      }
    }
  }

  private async handleGetToggleFeatures(
    actionId: string,
    settings: ToggleSettings,
  ): Promise<void> {
    const deviceId = settings.selectedDeviceId;
    if (!deviceId) {
      await sendPIDatasource(actionId, {
        event: "getToggleFeatures",
        items: [],
        status: "empty",
        message: "Select a device to load its toggleable features.",
      });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings);
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

      // For groups, query toggle features from the first controllable member.
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
      streamDeck.logger.error("Failed to fetch toggle features:", error);
      await sendPIDatasource(actionId, {
        event: "getToggleFeatures",
        items: [],
        status: "error",
        message:
          "Failed to load toggleable features. Check your connection and retry.",
      });
    }
  }

  private getTitle(settings: ToggleSettings, contextId: string): string {
    const parsed = settings.selectedFeature
      ? parseFeatureSetting(settings.selectedFeature)
      : null;
    const label = parsed?.name || "Toggle";

    const operation = settings.operation ?? "toggle";
    if (operation === "toggle") {
      const isOn = this.featureState.get(contextId) ?? false;
      return `${label}\n${isOn ? "●" : "○"}`;
    }
    return label;
  }
}
