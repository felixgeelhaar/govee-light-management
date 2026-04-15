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
import {
  ActionServices,
  sendToPI,
  type BaseSettings,
} from "./shared/ActionServices";
import { parseFeatureSetting } from "./shared/validation";

type ToggleSettings = BaseSettings & {
  selectedFeature?: string; // JSON: { name, instance }
  operation?: "toggle" | "on" | "off";
};

export class ToggleAction extends SingletonAction<ToggleSettings> {
  override readonly manifestId =
    "com.felixgeelhaar.govee-light-management.toggle";
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
    if (!target || target.type !== "light" || !target.light) {
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
        let liveState: boolean | undefined;
        try {
          liveState = await this.services.getToggleFeatureState(
            target.light,
            parsed.instance,
          );
        } catch (error) {
          streamDeck.logger.warn(
            `Falling back to cached toggle state for ${parsed.instance}:`,
            error,
          );
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
        await this.services.toggleFeatureRaw(
          target.light,
          parsed.instance,
          enabled,
        );
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
      await sendToPI(actionId, { event: "getToggleFeatures", items: [] });
      return;
    }

    try {
      const apiKey = await this.services.getApiKey(settings);
      if (!apiKey) {
        await sendToPI(actionId, { event: "getToggleFeatures", items: [] });
        return;
      }

      await this.services.ensureServices(apiKey);
      const features = await this.services.getToggleFeatures(deviceId);
      await sendToPI(actionId, {
        event: "getToggleFeatures",
        items: features.map((f) => ({
          label: f.name,
          value: JSON.stringify({ name: f.name, instance: f.instance }),
        })),
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch toggle features:", error);
      await sendToPI(actionId, { event: "getToggleFeatures", items: [] });
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
