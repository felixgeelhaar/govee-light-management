import streamDeck from "@elgato/streamdeck";
import type { IDisposable } from "@elgato/utils";
import {
  ActionServices,
  registerPowerLifecycleOverride,
  sendToPI,
} from "../actions/shared/ActionServices";
import { NativePowerEvents } from "../infrastructure/power/NativePowerEvents";
import { SuspensionDetector } from "../infrastructure/power/SuspensionDetector";
import {
  canonicalPowerTarget,
  normalizePowerRules,
} from "../../shared/power-lifecycle";
import {
  globalSettingsService,
  type GlobalPluginSettings,
} from "./GlobalSettingsService";
import { PowerLifecycleService } from "./PowerLifecycleService";

function createService(): PowerLifecycleService {
  const services = new ActionServices();
  return new PowerLifecycleService({
    getApiKey: () => globalSettingsService.getApiKey(),
    resolveTarget: async (id, signal) => {
      signal.throwIfAborted();
      const target = await services.resolveLifecycleTarget(id);
      signal.throwIfAborted();
      return target;
    },
    setPower: (target, power, signal, key) =>
      services.controlLifecyclePower(target, power, signal, key),
    events: new NativePowerEvents(),
    suspension: new SuspensionDetector(),
    log: (record) => streamDeck.logger.info("power.lifecycle", record),
  });
}

/** SDK/global-storage adapter. Rules belong to the account, not visible keys. */
export class PowerLifecycleController {
  private subscriptions: IDisposable[] = [];
  private attached = false;
  private ready = false;
  private pendingWake = false;
  private lastKey?: string;
  private groupSignature = "";
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly service = createService()) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    registerPowerLifecycleOverride((target) =>
      this.service.manualOverride(target),
    );
    const input = (event: {
      payload: { settings: Record<string, unknown> };
    }) => {
      this.service.manualOverrideSelection(
        event.payload.settings.selectedDeviceId,
        event.payload.settings.selectedModel,
      );
    };
    this.subscriptions.push(
      streamDeck.actions.onKeyDown(input),
      streamDeck.actions.onDialDown(input),
      streamDeck.actions.onDialRotate(input),
      streamDeck.actions.onTouchTap(input),
    );
    this.subscriptions.push(
      streamDeck.system.onSystemDidWakeUp(() => {
        if (!this.ready) this.pendingWake = true;
        else void this.service.handle("wake");
      }),
    );
    this.subscriptions.push(
      streamDeck.settings.onDidReceiveGlobalSettings((event) => {
        globalSettingsService.clearCache();
        this.applySettings(event.settings as GlobalPluginSettings);
      }),
    );
  }

  async initialize(): Promise<void> {
    this.applySettings(await globalSettingsService.getSettings());
    this.ready = true;
    await this.service.handle("startup");
    if (this.pendingWake) {
      this.pendingWake = false;
      await this.service.handle("wake");
    }
  }

  private applySettings(settings: GlobalPluginSettings): void {
    if (this.ready && settings.apiKey !== this.lastKey)
      this.service.credentialsChanged();
    this.lastKey = settings.apiKey;
    const groups = JSON.stringify(settings.govee_v1_lightGroups) ?? "";
    if (groups !== this.groupSignature)
      this.service.invalidatePreparedTargets();
    this.groupSignature = groups;
    this.service.configure(settings.powerLifecycleRules);
    void this.service.prepareTargets();
  }

  shutdown(): void {
    this.ready = false;
    for (const subscription of this.subscriptions) subscription.dispose();
    this.subscriptions = [];
    registerPowerLifecycleOverride(null);
    this.service.shutdown();
  }

  async handlePI(
    actionId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const id = canonicalPowerTarget(payload.selectedDeviceId);
    if (!id && payload.event !== "getPowerLifecycleRule") {
      await sendToPI(actionId, {
        event: "powerLifecycleRule",
        status: "error",
        message: "Select a light or group first.",
        requestId:
          typeof payload.requestId === "number" ? payload.requestId : undefined,
      });
      return;
    }
    // Serialize writes from the PI; reading another rule waits for pending saves.
    const work = async () => {
      try {
        // A failed read must never be converted to {} before a global write.
        const mutating =
          payload.event === "savePowerLifecycleRule" ||
          payload.event === "deletePowerLifecycleRule";
        const settings = mutating
          ? ((await streamDeck.settings.getGlobalSettings()) as GlobalPluginSettings)
          : await globalSettingsService.getSettings();
        if (
          !settings ||
          typeof settings !== "object" ||
          Array.isArray(settings)
        )
          throw new Error("Invalid global settings");
        let rules = normalizePowerRules(settings.powerLifecycleRules);
        if (id && payload.event === "savePowerLifecycleRule") {
          const raw =
            payload.rule && typeof payload.rule === "object"
              ? payload.rule
              : {};
          const [rule] = normalizePowerRules([
            { ...raw, selectedDeviceId: id },
          ]);
          if (!rule) throw new Error("Invalid rule");
          rules = [
            ...rules.filter((rule) => rule.selectedDeviceId !== id),
            rule,
          ];
          await globalSettingsService.save({
            ...settings,
            powerLifecycleRules: rules,
          });
          this.service.configure(rules);
          void this.service.prepareTargets();
        } else if (id && payload.event === "deletePowerLifecycleRule") {
          rules = rules.filter((rule) => rule.selectedDeviceId !== id);
          await globalSettingsService.save({
            ...settings,
            powerLifecycleRules: rules,
          });
          this.service.configure(rules);
          void this.service.prepareTargets();
        }
        await sendToPI(actionId, {
          event: "powerLifecycleRule",
          status: "ok",
          selectedDeviceId: id,
          rule: rules.find((rule) => rule.selectedDeviceId === id) ?? null,
          helperStatus: this.service.helperStatus,
          rules,
          requestId:
            typeof payload.requestId === "number"
              ? payload.requestId
              : undefined,
        });
      } catch {
        await sendToPI(actionId, {
          event: "powerLifecycleRule",
          status: "error",
          selectedDeviceId: id,
          message: "Power rule could not be loaded or saved.",
          requestId:
            typeof payload.requestId === "number"
              ? payload.requestId
              : undefined,
        });
      }
    };
    const next = this.writes.then(work, work);
    this.writes = next.catch(() => {});
    await next;
  }
}
export const powerLifecycleController = new PowerLifecycleController();
