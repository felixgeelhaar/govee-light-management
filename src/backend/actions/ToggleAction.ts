import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  type TitleParametersDidChangeEvent,
  streamDeck,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import {
  ActionServices,
  sendPIDatasource,
  type BaseSettings,
} from "./shared/ActionServices";
import { parseFeatureSetting } from "./shared/validation";
import { TitleOverrideTracker } from "./shared/title-override";
import {
  applyStatusImage,
  powerStatus,
  type ImageCapableAction,
} from "./shared/status-badge";

type ToggleSettings = BaseSettings & {
  selectedFeature?: string; // JSON: { name, instance }
  operation?: "toggle" | "on" | "off";
};

@action({ UUID: "com.felixgeelhaar.govee-light-management.toggle" })
export class ToggleAction extends SingletonAction<ToggleSettings> {
  private services = new ActionServices();
  private featureState = new Map<string, boolean>();
  /**
   * Per-context press counter. Bumped on every `onKeyDown` so the
   * `onWillAppear` initial-state read can detect whether a press
   * landed during its API work and skip overwriting the optimistic
   * `featureState` with stale data.
   */
  private toggleEpoch = new Map<string, number>();
  /** Whether the user's own title has displaced ours (see #333). */
  private titleOverride = new TitleOverrideTracker();
  /** Last settings seen per context, for re-rendering off-cycle. */
  private settingsByCtx = new Map<string, ToggleSettings>();

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
        // Snapshot before slow API work so a press landing during the
        // call doesn't get overwritten by a stale read.
        const epochAtStart = this.toggleEpoch.get(ctx) ?? 0;
        const featureStateAtStart = this.featureState.get(ctx);
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
        const epochAtEnd = this.toggleEpoch.get(ctx) ?? 0;
        if (epochAtEnd !== epochAtStart && featureStateAtStart !== undefined) {
          this.featureState.set(ctx, featureStateAtStart);
        }
      }
    }

    await this.render(ev.action, ev.payload.settings, ctx);
  }

  override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
    this.featureState.delete(ev.action.id);
    this.toggleEpoch.delete(ev.action.id);
    this.titleOverride.forget(ev.action.id);
    this.settingsByCtx.delete(ev.action.id);
    this.services.clearPartialFailureBanner(ev.action.id);
  }

  /**
   * Stream Deck reports the title it will actually render — the user's
   * if they set one, otherwise ours. That is the only way to learn our
   * title has been displaced, so re-render on a real change to swap the
   * glyph for the artwork badge (or back again).
   */
  override async onTitleParametersDidChange(
    ev: TitleParametersDidChangeEvent<ToggleSettings>,
  ): Promise<void> {
    const ctx = ev.action.id;
    const changed = this.titleOverride.observe(ctx, {
      title: ev.payload.title,
      showTitle: ev.payload.titleParameters.showTitle,
    });
    if (changed) {
      const settings = this.settingsByCtx.get(ctx) ?? ev.payload.settings;
      await this.render(ev.action, settings, ctx);
    }
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ToggleSettings>,
  ): Promise<void> {
    await this.render(ev.action, ev.payload.settings, ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { settings } = ev.payload;
    const ctx = ev.action.id;
    // Bump epoch first so any concurrent `onWillAppear` API read knows
    // its result is stale by the time it lands.
    this.toggleEpoch.set(ctx, (this.toggleEpoch.get(ctx) ?? 0) + 1);

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
        // #311: pick from all members; the online flag is unreliable
        const queryLight =
          target.type === "light" ? target.light : target.group?.lights[0];
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
      let anySucceeded = false;
      let failedCount = 0;
      let totalCount = 0;
      let singleLightUnapplied = false;
      try {
        if (target.type === "light" && target.light) {
          await this.services.toggleFeatureRaw(
            target.light,
            parsed.instance,
            enabled,
          );
          anySucceeded = true;
          // Govee occasionally accepts a 200 OK but no-ops the write
          // (notably `dreamViewToggle` on strips without a paired Sync
          // Box). Verify the change actually landed so the user gets
          // an alert instead of a misleading optimistic green check.
          const verification = await this.services.verifyToggleStateApplied(
            target.light,
            parsed.instance,
            enabled,
          );
          if (verification === "mismatched") {
            singleLightUnapplied = true;
          }
        } else if (target.type === "group" && target.group) {
          // #311: iterate all members; the online flag is unreliable
          const members = target.group.lights;
          totalCount = members.length;
          for (const light of members) {
            try {
              await this.services.toggleFeatureRaw(
                light,
                parsed.instance,
                enabled,
              );
              anySucceeded = true;
            } catch (error) {
              failedCount++;
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
      if (!anySucceeded) {
        // Revert optimistic state since nothing actually changed
        this.featureState.set(ctx, originalState);
        await this.render(ev.action, settings, ctx);
        await ev.action.showAlert();
        return;
      }
      if (singleLightUnapplied) {
        // Govee accepted the write but the device did not reflect it.
        // Revert title and warn so the user knows the press was a no-op
        // (see verifyToggleStateApplied for the DreamView-companion case).
        this.featureState.set(ctx, originalState);
        await this.render(ev.action, settings, ctx);
        await ev.action.showAlert();
        return;
      }
      await this.render(ev.action, settings, ctx);
      if (failedCount > 0 && totalCount > 0) {
        this.services.showPartialFailureBanner(
          ev.action,
          ctx,
          failedCount,
          totalCount,
          this.getTitle(settings, ctx),
        );
      }
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to toggle feature:", error);
      // Revert to original state
      this.featureState.set(ctx, originalState);
      await this.render(ev.action, settings, ctx);
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
        // #311: pick from all members; the online flag is unreliable
        const first = target.group.lights[0];
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

  /**
   * Paint the key: feature name plus the ●/○ state in the title, and
   * the same state as a badge on the artwork. The badge is the
   * redundant copy — a user-set title suppresses `setTitle()`
   * altogether (#333), and the feature name is exactly the thing a
   * user is likely to retitle.
   */
  private async render(
    action: ImageCapableAction & { setTitle(title: string): Promise<void> },
    settings: ToggleSettings,
    contextId: string,
  ): Promise<void> {
    this.settingsByCtx.set(contextId, settings);
    const title = this.getTitle(settings, contextId);
    await action.setTitle(title);
    this.titleOverride.noteWritten(contextId, title);

    // The badge is the fallback for when the title glyph is not
    // visible: either the user took the title over, or this is a
    // dedicated on/off key, which is a command rather than a state
    // display and shows no glyph at all.
    const tracksState = (settings.operation ?? "toggle") === "toggle";
    const status =
      tracksState && this.titleOverride.isOverridden(contextId)
        ? powerStatus(undefined, this.featureState.get(contextId))
        : "unknown";
    await applyStatusImage(action, "toggle", status);
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
