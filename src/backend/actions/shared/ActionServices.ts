/**
 * Shared services and utilities for all light actions.
 * Handles device/group resolution, service initialization, and
 * the getDevices datasource that returns both lights and groups.
 */
import { streamDeck } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { GoveeLightRepository } from "../../infrastructure/repositories/GoveeLightRepository";
import { LightControlService } from "../../domain/services/LightControlService";
import { Light, LightCapabilities } from "../../domain/entities/Light";
import { LightGroup } from "../../domain/entities/LightGroup";
import type { LightState } from "../../domain/value-objects/LightState";
import { DynamicSceneOption } from "../../domain/value-objects/DynamicSceneOption";
import { DiySceneOption } from "../../domain/value-objects/DiySceneOption";
import { SnapshotOption } from "../../domain/value-objects/SnapshotOption";
import { MusicModeOption } from "../../domain/value-objects/MusicModeOption";

import { DeviceService } from "../../application/services/DeviceService";
import {
  TransportOrchestrator,
  TransportKind,
  CloudTransport,
} from "../../connectivity";
import { globalSettingsService } from "../../services/GlobalSettingsService";
import { StreamDeckLightGroupRepository } from "../../infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightGroupService } from "../../domain/services/LightGroupService";
import { SegmentColor } from "../../domain/value-objects/SegmentColor";
import { Brightness as DomainBrightness } from "../../domain/value-objects/Brightness";
import { ColorRgb as DomainColorRgb } from "../../domain/value-objects/ColorRgb";
import { ColorTemperature as DomainColorTemperature } from "../../domain/value-objects/ColorTemperature";
import { isIgnorableLiveStateError, isValidationError } from "./validation";

/** Default timeout for API calls in PI handlers (10 seconds) */
const PI_HANDLER_TIMEOUT_MS = 10_000;

/** Flash colors for dial bar feedback */
const FLASH_SUCCESS = "#22CC66"; // green – command succeeded
const FLASH_ERROR = "#FF3333"; // red – command failed
const FLASH_LOADING_DELAY_MS = 250; // only show loading if request is noticeably slow
const FLASH_RESULT_MS = 400; // how long success/error flash stays visible
const LIVE_STATE_RETRY_BACKOFF_MS = 30_000;
const RATE_LIMIT_RETRY_BACKOFF_MS = 60_000;
const LIVE_STATE_MIN_REFRESH_MS = 3_000;

/**
 * Send a payload to the Property Inspector for the currently visible action.
 * Uses the public SDK API (streamDeck.ui.sendToPropertyInspector) which tracks
 * the active PI internally. The actionId parameter is accepted for logging
 * but the SDK routes to whichever PI is currently open.
 *
 * Throws if the context doesn't match after max attempts, ensuring we never
 * send payloads to the wrong PI.
 */
async function sendToPI(
  actionId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const MAX_ATTEMPTS = 20;
  const RETRY_DELAY_MS = 25;

  let contextMatched = false;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const currentAction = streamDeck.ui.action;
      if (currentAction?.id === actionId) {
        contextMatched = true;
        break;
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    if (!contextMatched) {
      streamDeck.logger.warn(
        `PI context mismatch after ${MAX_ATTEMPTS} attempts (expected: ${actionId}, current: ${streamDeck.ui.action?.id ?? "none"}) - not sending payload`,
      );
      return;
    }

    await streamDeck.ui.sendToPropertyInspector(payload as JsonValue);
  } catch (error) {
    streamDeck.logger.error(
      `Failed to send to PI (context: ${actionId}):`,
      error,
    );
  }
}

/**
 * Race a promise against a timeout. Returns the promise result or rejects on timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Status discriminator for any datasource-style response the plugin sends
 * to the Property Inspector. Every backend datasource handler MUST emit
 * one of these so the PI can distinguish an empty result from a failure
 * from a valid-but-empty state, and surface the right hint to the user.
 *
 * Introduced after #182, where silent `items: []` responses were
 * indistinguishable from genuine empties and left users staring at a
 * stale "Select a device first" placeholder.
 */
export type PIDatasourceStatus = "ok" | "empty" | "error";

export interface PIDatasourceItem {
  label: string;
  value: string;
  /** Optional nested-group items for SDPI optgroup-style dropdowns. */
  children?: PIDatasourceItem[];
  /**
   * When true the SDPI dropdown renders the option as `disabled` —
   * visible to communicate "this exists" but not selectable. Used to
   * surface Govee cloud groups (BaseGroup, SameModelGroup) that we
   * cannot control via the API.
   */
  disabled?: boolean;
}

export interface PIDatasourceResponse<E extends string = string> {
  event: E;
  status: PIDatasourceStatus;
  items: PIDatasourceItem[];
  /**
   * Human-readable hint shown below the dropdown when the status is
   * `empty` or `error`. Optional for `ok` responses.
   */
  message?: string;
}

/**
 * Typed wrapper around `sendToPI` for datasource-style responses. Requires
 * the caller to include a `status` field at compile time so we can never
 * again ship a handler that silently returns `items: []` without
 * signalling why.
 */
async function sendPIDatasource<E extends string>(
  actionId: string,
  response: PIDatasourceResponse<E>,
): Promise<void> {
  await sendToPI(actionId, response as unknown as Record<string, unknown>);
}

function toDomainControlValue(
  value?: DomainBrightness | DomainColorRgb | DomainColorTemperature,
): DomainBrightness | DomainColorRgb | DomainColorTemperature | undefined {
  return value ?? undefined;
}

export { sendToPI, sendPIDatasource };

/**
 * Late-bound effect-cancellation hook. EffectService registers its
 * `cancelAndWait` here at module-load time (see EffectService.ts). Using
 * late binding instead of a direct import avoids the circular module cycle
 * (EffectService already imports ActionServices to drive device resolution).
 *
 * When null (e.g. in unit tests that don't load EffectService), the
 * chokepoint guards below become no-ops, which is the safe default.
 */
type EffectCanceller = (targetId: string) => Promise<boolean>;
let effectCanceller: EffectCanceller | null = null;
export function registerEffectCanceller(fn: EffectCanceller | null): void {
  effectCanceller = fn;
}

export interface DeviceTarget {
  type: "light" | "group";
  light?: Light;
  group?: LightGroup;
}

export interface BaseSettings {
  apiKey?: string;
  selectedDeviceId?: string;
  selectedModel?: string;
  selectedLightName?: string;
  [key: string]: JsonValue | undefined;
}

/**
 * Manages shared services for light/group actions.
 * Uses static shared state so all action instances share a single
 * GoveeLightRepository and rate limiter.
 */
export class ActionServices {
  private static _shared: {
    lightRepository?: GoveeLightRepository;
    lightControlService?: LightControlService;
    groupRepository?: StreamDeckLightGroupRepository;
    groupService?: LightGroupService;
    transportOrchestrator?: TransportOrchestrator;
    deviceService?: DeviceService;
    currentApiKey?: string;
    /** Guards concurrent ensureServices calls to prevent interleaving. */
    initPromise?: Promise<void>;
  } = {};
  private static liveStateBlockedUntil = new Map<string, number>();
  private static liveStateLogged = new Set<string>();
  private static lightStateSnapshots = new Map<string, LightState>();
  private static lightStateSyncedAt = new Map<string, number>();
  private static liveStateSyncInFlight = new Map<string, Promise<boolean>>();
  /**
   * Tracks which (contextId, deviceId, model) tuples have already had
   * their overlay modes (gradient / nightlight) cleared in this dial
   * session. Keeps the 1st rotation / 1st keypress slightly slower while
   * avoiding those toggles on every subsequent command. Cleared when the
   * dial disappears or switches to a different device (see
   * `clearPreparedForContext`).
   */
  private static preparedForSolidColor = new Set<string>();

  get lightRepository() {
    return ActionServices._shared.lightRepository;
  }
  get lightControlService() {
    return ActionServices._shared.lightControlService;
  }
  get groupService() {
    return ActionServices._shared.groupService;
  }
  get deviceService() {
    return ActionServices._shared.deviceService;
  }

  private getLightSnapshotKey(
    light: Pick<Light, "deviceId" | "model">,
  ): string {
    return `${light.deviceId}|${light.model}`;
  }

  private hydrateFromSnapshot(light: Light): void {
    const snapshot = ActionServices.lightStateSnapshots.get(
      this.getLightSnapshotKey(light),
    );
    if (snapshot) {
      light.updateState(snapshot);
    }
  }

  private rememberLightState(light: Light): void {
    ActionServices.lightStateSnapshots.set(
      this.getLightSnapshotKey(light),
      light.state,
    );
    ActionServices.lightStateSyncedAt.set(
      this.getLightSnapshotKey(light),
      Date.now(),
    );
  }

  private getKnownPowerState(
    light: Pick<Light, "deviceId" | "model">,
  ): boolean | undefined {
    return ActionServices.lightStateSnapshots.get(
      this.getLightSnapshotKey(light),
    )?.isOn;
  }

  private hasFreshSnapshot(light: Pick<Light, "deviceId" | "model">): boolean {
    const syncedAt = ActionServices.lightStateSyncedAt.get(
      this.getLightSnapshotKey(light),
    );
    return (
      typeof syncedAt === "number" &&
      Date.now() - syncedAt < LIVE_STATE_MIN_REFRESH_MS
    );
  }

  private isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes("rate limit exceeded");
  }

  private isNonRetryableControlError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    return (
      normalized.includes("parameter value out of range") ||
      normalized.includes(
        "failed to set color temperature: api returned error code 400",
      )
    );
  }

  async getLightItem(
    settings: BaseSettings,
  ): Promise<import("@shared/types").LightItem | undefined> {
    const target = this.parseTarget(settings);
    if (
      !target ||
      target.type !== "light" ||
      !target.deviceId ||
      !target.model ||
      !this.deviceService
    ) {
      return undefined;
    }

    const lights =
      this.deviceService.getCachedLights() ??
      (await this.deviceService.discover(false));
    return lights.find(
      (light) =>
        light.deviceId === target.deviceId && light.model === target.model,
    );
  }

  /**
   * Initialize all shared services. Serializes concurrent calls so that
   * interleaving cannot produce partially-initialized state.
   */
  async ensureServices(apiKey?: string): Promise<void> {
    const s = ActionServices._shared;
    if (s.initPromise) {
      await s.initPromise;
      // If the key hasn't changed, we're done
      if (!apiKey || apiKey === s.currentApiKey) return;
    }

    const doInit = async () => {
      if (!s.groupRepository) {
        s.groupRepository = new StreamDeckLightGroupRepository();
      }

      if (apiKey && apiKey !== s.currentApiKey) {
        // Persist first, then update in-memory state
        try {
          await globalSettingsService.setApiKey(apiKey);
        } catch (error) {
          streamDeck.logger?.warn("Failed to persist API key globally", error);
        }

        s.lightRepository = new GoveeLightRepository(apiKey, true);
        s.lightControlService = new LightControlService(s.lightRepository);
        s.groupService = new LightGroupService(
          s.groupRepository,
          s.lightRepository,
        );
        s.currentApiKey = apiKey;
      }

      if (s.lightRepository && !s.lightControlService) {
        s.lightControlService = new LightControlService(s.lightRepository);
      }

      if (s.groupRepository && s.lightRepository && !s.groupService) {
        s.groupService = new LightGroupService(
          s.groupRepository,
          s.lightRepository,
        );
      }

      if (!s.transportOrchestrator) {
        const cloudTransport = new CloudTransport();
        s.transportOrchestrator = new TransportOrchestrator({
          [TransportKind.Cloud]: cloudTransport,
        });
      }

      if (s.transportOrchestrator && !s.deviceService) {
        s.deviceService = new DeviceService(s.transportOrchestrator, {
          logger: streamDeck.logger,
        });
      }
    };

    s.initPromise = doInit();
    try {
      await s.initPromise;
    } finally {
      s.initPromise = undefined;
    }
  }

  async getApiKey(settings: BaseSettings): Promise<string | undefined> {
    return settings.apiKey || (await globalSettingsService.getApiKey());
  }

  /**
   * Parse the selectedDeviceId to determine if it's a light or group.
   * Format: "light:deviceId|model" or "group:groupId"
   * Legacy format (no prefix): "deviceId|model" treated as light
   */
  parseTarget(settings: BaseSettings): {
    type: "light" | "group";
    deviceId?: string;
    model?: string;
    groupId?: string;
  } | null {
    const id = settings.selectedDeviceId;
    if (!id) return null;

    if (id.startsWith("group:")) {
      return { type: "group", groupId: id.substring(6) };
    }

    // Light target (with or without prefix)
    const lightId = id.startsWith("light:") ? id.substring(6) : id;
    if (lightId.includes("|")) {
      const [deviceId, model] = lightId.split("|");
      return { type: "light", deviceId, model };
    }

    if (settings.selectedModel) {
      return {
        type: "light",
        deviceId: lightId,
        model: settings.selectedModel,
      };
    }

    return null;
  }

  /**
   * Resolve the target to a Light or LightGroup instance.
   * Uses DeviceService cache for lights to avoid repeated API calls.
   */
  async resolveTarget(
    settings: BaseSettings,
    forceRefresh = false,
  ): Promise<DeviceTarget | null> {
    const target = this.parseTarget(settings);
    if (!target) return null;

    if (target.type === "group" && target.groupId) {
      if (!this.groupService) return null;
      const group = await this.groupService.findGroupById(target.groupId);
      if (group) {
        // Group members are deserialized from storage with default
        // state (`isOnline: true, isOn: false`). Hydrate each member
        // from the device cache + snapshot store so that
        // `getControllableLights()` actually excludes offline devices
        // and so that subsequent reads see fresh power/brightness/colour.
        // Without this every group apply optimistically calls every
        // member, racks up rate-limit budget on offline devices, and
        // surfaces a partial-failure banner the user can do nothing
        // about.
        if (this.deviceService) {
          try {
            const cached =
              this.deviceService.getCachedLights() ??
              (await this.deviceService.discover(forceRefresh));
            for (const light of group.lights) {
              const item = cached.find(
                (c) => c.deviceId === light.deviceId && c.model === light.model,
              );
              if (item) {
                light.updateState({ isOnline: item.controllable });
              } else {
                // Group references a light that's no longer in the
                // user's Govee account (deleted from the app, or
                // discovery failed). Mark it offline so it gets
                // skipped instead of silently failing every command.
                light.updateState({ isOnline: false });
              }
              this.hydrateFromSnapshot(light);
            }
          } catch (error) {
            streamDeck.logger?.debug(
              "resolveTarget: group member state hydration failed",
              error,
            );
          }
        }
        return { type: "group", group };
      }
    }

    if (
      target.type === "light" &&
      target.deviceId &&
      target.model &&
      this.deviceService
    ) {
      // Use DeviceService with its built-in caching (15s TTL)
      const lights = await this.deviceService.discover(forceRefresh);
      const lightItem = lights.find(
        (l) => l.deviceId === target.deviceId && l.model === target.model,
      );

      if (lightItem) {
        // Convert LightItem to domain Light entity using Light.create()
        // LightItem doesn't carry live state, so we use sensible defaults.
        // Actual state is fetched via getLightState() when needed by actions.
        const initialState: LightState = {
          isOn: false,
          isOnline: lightItem.controllable,
          brightness: undefined,
          color: undefined,
          colorTemperature: undefined,
        };

        // Map shared LightCapabilities to domain LightCapabilities
        const capabilities: LightCapabilities = {
          brightness: lightItem.capabilities?.brightness ?? true,
          color: lightItem.capabilities?.color ?? true,
          colorTemperature: lightItem.capabilities?.colorTemperature ?? true,
          scenes: lightItem.capabilities?.scenes ?? false,
          segmentedColor: lightItem.capabilities?.segmentedColor ?? false,
          musicMode: lightItem.capabilities?.musicMode ?? false,
          nightlight: lightItem.capabilities?.nightlight ?? false,
          gradient: lightItem.capabilities?.gradient ?? false,
        };

        const light = Light.create(
          lightItem.deviceId,
          lightItem.model,
          lightItem.name,
          initialState,
          capabilities,
        );
        this.hydrateFromSnapshot(light);
        return { type: "light", light };
      }
    }

    return null;
  }

  /**
   * Handle getGroups - returns group list for group manager UI
   */
  async handleGetGroups(actionId: string): Promise<void> {
    try {
      const apiKey = await globalSettingsService.getApiKey();
      if (!apiKey) {
        await sendToPI(actionId, {
          event: "groupsReceived",
          groups: [],
        });
        return;
      }
      await this.ensureServices(apiKey);
      if (!this.groupService) {
        await sendToPI(actionId, {
          event: "groupsReceived",
          groups: [],
        });
        return;
      }
      const groups = await this.groupService.getAllGroups();
      await sendToPI(actionId, {
        event: "groupsReceived",
        groups: groups.map((g) => ({ id: g.id, name: g.name, size: g.size })),
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch groups:", error);
      await sendToPI(actionId, {
        event: "groupsReceived",
        groups: [],
      });
    }
  }

  /**
   * Handle getDevices SDPI datasource - returns both lights and groups.
   * Uses a timeout to prevent hanging forever if the API is unreachable.
   */
  async handleGetDevices(actionId: string): Promise<void> {
    streamDeck.logger.info(`handleGetDevices called (context: ${actionId})`);

    try {
      const apiKey = await globalSettingsService.getApiKey();
      if (!apiKey) {
        streamDeck.logger.warn(
          "handleGetDevices: no API key in global settings",
        );
        await sendPIDatasource(actionId, {
          event: "getDevices",
          status: "error",
          items: [],
          message: "Missing API key — reconnect in the API Key panel.",
        });
        return;
      }

      await this.ensureServices(apiKey);
      const items: PIDatasourceItem[] = [];

      let discoveryFailed = false;

      // Add lights (with timeout to prevent hanging).
      // forceRefresh=false reuses DeviceService's 30s cache. SDPI's
      // `show-refresh` button calls this same datasource handler, so we
      // can't tell first-open from explicit-refresh — but with TTL=30s
      // any explicit refresh after the cache window will still hit the
      // API. Forcing on every open made each PI open block on a
      // 6-10s `/user/devices` round-trip; trust the TTL instead.
      if (this.deviceService) {
        try {
          const lights = await withTimeout(
            this.deviceService.discover(false),
            PI_HANDLER_TIMEOUT_MS,
            "Device discovery",
          );
          const lightItems: PIDatasourceItem[] = lights.map((light) => ({
            label: `${light.label ?? light.name} (${light.model})`,
            value: `light:${light.deviceId}|${light.model}`,
          }));

          if (lightItems.length > 0) {
            items.push({
              label: "Lights",
              value: "",
              children: lightItems,
            });
          }
          streamDeck.logger.info(
            `handleGetDevices: found ${lightItems.length} lights`,
          );
        } catch (discoverError) {
          streamDeck.logger.error(
            "handleGetDevices: device discovery failed:",
            discoverError,
          );
          discoveryFailed = true;
          // Continue to still return groups even if light discovery fails
        }
      }

      // Add groups
      if (this.groupService) {
        const groups = await this.groupService.getAllGroups();
        const groupItems: PIDatasourceItem[] = groups.map((g) => ({
          label: `${g.name} (${g.size} lights)`,
          value: `group:${g.id}`,
        }));

        if (groupItems.length > 0) {
          items.push({
            label: "Groups",
            value: "",
            children: groupItems,
          });
        }
      }

      // Add cloud groups as disabled options. Govee's API exposes
      // BaseGroup / SameModelGroup / SameModeGroup entries that look
      // controllable but in practice ignore every command we send (see
      // issues #186, #188). Surfacing them grayed-out with an
      // explanation in the PI hint is more honest than silently
      // dropping them — users were creating duplicate plugin groups
      // because they thought their Govee app groups had vanished.
      if (this.deviceService) {
        const unsupported = this.deviceService.getCachedUnsupportedDevices();
        if (unsupported.length > 0) {
          items.push({
            label: "Govee cloud groups (control unsupported)",
            value: "",
            children: unsupported.map((u) => ({
              label: `${u.name} (${u.model})`,
              value: `unsupported:${u.deviceId}|${u.model}`,
              disabled: true,
            })),
          });
        }
      }

      streamDeck.logger.info(
        `handleGetDevices: sending ${items.length} item groups to PI`,
      );
      if (items.length === 0) {
        await sendPIDatasource(actionId, {
          event: "getDevices",
          status: discoveryFailed ? "error" : "empty",
          items: [],
          message: discoveryFailed
            ? "Failed to load devices. Check your API key and connection."
            : "No devices found. Add lights in the Govee mobile app, then refresh.",
        });
        return;
      }
      await sendPIDatasource(actionId, {
        event: "getDevices",
        status: "ok",
        items,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch devices:", error);
      await sendPIDatasource(actionId, {
        event: "getDevices",
        status: "error",
        items: [],
        message: "Failed to load devices. Check your API key and connection.",
      });
    }
  }

  async handleGetDeviceDebug(
    actionId: string,
    selectedDeviceId?: string,
  ): Promise<void> {
    try {
      const apiKey = await globalSettingsService.getApiKey();
      if (!apiKey || !selectedDeviceId) {
        await sendToPI(actionId, {
          event: "deviceDebug",
          selectedDeviceId,
          device: null,
        });
        return;
      }

      await this.ensureServices(apiKey);
      if (!this.deviceService) {
        await sendToPI(actionId, {
          event: "deviceDebug",
          selectedDeviceId,
          device: null,
        });
        return;
      }

      const lights = await withTimeout(
        this.deviceService.discover(false),
        PI_HANDLER_TIMEOUT_MS,
        "Device discovery",
      );
      const light = lights.find(
        (entry) =>
          `light:${entry.deviceId}|${entry.model}` === selectedDeviceId,
      );

      await sendToPI(actionId, {
        event: "deviceDebug",
        selectedDeviceId,
        device: light
          ? {
              device: light.deviceId,
              model: light.model,
              name: light.name,
              controllable: light.controllable,
              retrievable: light.retrievable,
              supportedCommands: light.supportedCommands,
              capabilities: light.capabilities,
              properties: light.properties,
            }
          : null,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to fetch device debug metadata:", error);
      await sendToPI(actionId, {
        event: "deviceDebug",
        selectedDeviceId,
        device: null,
      });
    }
  }

  /**
   * Handle saveGroup from PI
   */
  async handleSaveGroup(actionId: string, payload: JsonValue): Promise<void> {
    const data = payload as { group?: { name: string; lightIds: string[] } };
    const group = data.group;

    if (!group?.name || !group?.lightIds) {
      await sendToPI(actionId, {
        event: "groupSaved",
        success: false,
        error: "Invalid group data",
      });
      return;
    }

    try {
      const apiKey = await globalSettingsService.getApiKey();
      await this.ensureServices(apiKey);

      if (!this.groupService) throw new Error("Group service unavailable");

      const lightIds = group.lightIds.map((id: string) => {
        // Strip "light:" prefix if present
        const cleanId = id.startsWith("light:") ? id.substring(6) : id;
        const [deviceId, model] = cleanId.split("|");
        return { deviceId, model };
      });

      const savedGroup = await this.groupService.createGroup(
        group.name,
        lightIds,
      );

      await sendToPI(actionId, {
        event: "groupSaved",
        success: true,
        group: {
          id: savedGroup.id,
          name: savedGroup.name,
          size: savedGroup.size,
        },
      });
    } catch (error) {
      streamDeck.logger.error("Failed to save group:", error);
      await sendToPI(actionId, {
        event: "groupSaved",
        success: false,
        error: "Failed to save group",
      });
    }
  }

  /**
   * Force refresh the device cache
   */
  async handleRefreshState(): Promise<void> {
    try {
      if (this.deviceService) {
        await this.deviceService.discover(true); // force refresh
        streamDeck.logger.info("Device cache refreshed");
      }
    } catch (error) {
      streamDeck.logger.error("Failed to refresh device cache:", error);
    }
  }

  /**
   * Handle deleteGroup from PI
   */
  async handleDeleteGroup(actionId: string, payload: JsonValue): Promise<void> {
    const data = payload as { groupId?: string };
    if (!data.groupId) return;

    try {
      const apiKey = await globalSettingsService.getApiKey();
      await this.ensureServices(apiKey);

      if (!this.groupService) throw new Error("Group service unavailable");

      // Strip group: prefix if present
      const groupId = data.groupId.startsWith("group:")
        ? data.groupId.substring(6)
        : data.groupId;
      await this.groupService.deleteGroup(groupId);

      await sendToPI(actionId, {
        event: "groupDeleted",
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to delete group:", error);
      await sendToPI(actionId, {
        event: "groupDeleted",
        success: false,
        error: "Failed to delete group",
      });
    }
  }

  /**
   * Deferred dial action execution with optional visual flash feedback.
   * Accumulates rapid dial changes and only executes the callback once the
   * user stops rotating (after `delayMs` of inactivity). Each new call
   * replaces the previous pending callback, so only the latest value is sent.
   *
   * The callback should contain ALL API work (ensureServices, resolveTarget,
   * controlTarget) so that no API calls happen during active dial rotation.
   *
   * When `flash` is provided the bar shows loading and result feedback:
   *   white → while the deferred command is being sent, but only for slower calls
   *   green → on success (auto-restores after 400 ms)
   *   red   → on error   (auto-restores after 400 ms)
   *
   * Key = action context ID to support multiple dials independently.
   */
  private dialTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Tracks flash-restore timeouts so they can be cancelled on disappear. */
  private restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Tracks per-context partial-failure banner timers (keyed by action.id). */
  private partialFailureTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  /**
   * Show a persistent "⚠ N/M failed" banner on a key title, then revert
   * to the supplied baseline after `durationMs`. Use after group-apply
   * loops where some members succeeded and some failed — `showAlert`
   * alone (a 1-second flash) is too easy for a user to miss and treats
   * every failure as identical noise.
   *
   * Calling this while a previous banner is active replaces both the
   * title and the revert timer, so back-to-back partial failures stay
   * legible without piling up.
   */

  showPartialFailureBanner(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: any,
    contextId: string,
    failedCount: number,
    totalCount: number,
    baseTitle: string,
    durationMs = 30_000,
  ): void {
    const existing = this.partialFailureTimers.get(contextId);
    if (existing) clearTimeout(existing);

    const banner =
      baseTitle.length > 0
        ? `${baseTitle}\n⚠ ${failedCount}/${totalCount}`
        : `⚠ ${failedCount}/${totalCount}`;
    action.setTitle(banner).catch(() => {});

    this.partialFailureTimers.set(
      contextId,
      setTimeout(() => {
        this.partialFailureTimers.delete(contextId);
        action.setTitle(baseTitle).catch(() => {});
      }, durationMs),
    );
  }

  /** Cancel a partial-failure banner timer (call from onWillDisappear). */
  clearPartialFailureBanner(contextId: string): void {
    const timer = this.partialFailureTimers.get(contextId);
    if (timer) clearTimeout(timer);
    this.partialFailureTimers.delete(contextId);
  }
  deferDialAction(
    contextId: string,
    callback: () => Promise<void>,
    delayMs?: number,
    flash?: {
      /** The Stream Deck action object (has setFeedback) */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: any;
      /** Returns the dial's current logical bar value (0-100) for restore */
      getRestoreValue: () => number;
      /** Loading-state bar_fill_c override */
      loadingFillColor: string;
      /** Loading-state bar_bg_c override */
      loadingBgColor: string;
      /** Layout default for bar_fill_c (e.g. gradient string or "#FFFFFF") */
      restoreFillColor: string;
      /** Layout default for bar_bg_c (e.g. "#1F2937" or gradient string) */
      restoreBgColor: string;
    },
  ): void {
    const delay = delayMs ?? 500;

    // Cancel any pending execution for this context
    const existingTimer = this.dialTimers.get(contextId);
    if (existingTimer) clearTimeout(existingTimer);

    this.dialTimers.set(
      contextId,
      setTimeout(async () => {
        this.dialTimers.delete(contextId);

        let loadingTimer: ReturnType<typeof setTimeout> | undefined;

        try {
          if (flash) {
            loadingTimer = setTimeout(() => {
              this.showDialLoadingState(
                flash.action,
                flash.getRestoreValue(),
                flash.loadingFillColor,
                flash.loadingBgColor,
              ).catch(() => {});
            }, FLASH_LOADING_DELAY_MS);
          }

          await callback();

          if (loadingTimer) clearTimeout(loadingTimer);

          if (flash) {
            // Show green "success" flash, then restore layout defaults
            await this.flashDialBar(flash.action, FLASH_SUCCESS);
            this.scheduleRestore(contextId, flash);
          }
        } catch (e) {
          streamDeck.logger.error("Deferred dial action failed:", e);

          if (loadingTimer) clearTimeout(loadingTimer);

          if (flash) {
            // Show red "error" flash, then restore layout defaults
            await this.flashDialBar(flash.action, FLASH_ERROR);
            this.scheduleRestore(contextId, flash);
          }
        }
      }, delay),
    );
  }

  /**
   * Show a static loading state while the deferred command is in flight.
   * Keeps the current value fixed so the indicator/arrow does not move.
   */

  private async showDialLoadingState(
    action: any,
    value: number,
    fillColor: string,
    bgColor: string,
  ): Promise<void> {
    try {
      await action.setFeedback({
        bar: {
          value,
          bar_fill_c: fillColor,
          bar_bg_c: bgColor,
        },
      });
    } catch {
      // Ignore - action may have disappeared
    }
  }

  /**
   * Flash both bar_fill_c and bar_bg_c to a solid color.
   * This makes the flash visible on both regular `bar` and `gbar` layouts.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async flashDialBar(action: any, color: string): Promise<void> {
    try {
      await action.setFeedback({
        bar: { bar_fill_c: color, bar_bg_c: color },
      });
    } catch {
      // Ignore – action may have disappeared
    }
  }

  /**
   * Restore bar_fill_c and bar_bg_c to their layout defaults after a flash.
   */

  private async restoreDialBar(
    action: any,
    value: number,
    fillColor: string,
    bgColor: string,
  ): Promise<void> {
    try {
      await action.setFeedback({
        bar: { value, bar_fill_c: fillColor, bar_bg_c: bgColor },
      });
    } catch {
      // Ignore – action may have disappeared
    }
  }

  /**
   * Schedule a flash-restore timeout and track it for cleanup.
   */

  private scheduleRestore(
    contextId: string,
    flash: {
      action: any;
      getRestoreValue: () => number;
      restoreFillColor: string;
      restoreBgColor: string;
    },
  ): void {
    const existing = this.restoreTimers.get(contextId);
    if (existing) clearTimeout(existing);

    this.restoreTimers.set(
      contextId,
      setTimeout(() => {
        this.restoreTimers.delete(contextId);
        this.restoreDialBar(
          flash.action,
          flash.getRestoreValue(),
          flash.restoreFillColor,
          flash.restoreBgColor,
        ).catch(() => {});
      }, FLASH_RESULT_MS),
    );
  }

  /**
   * Clean up deferred dial timers and restore timers for a specific context
   * (call from onWillDisappear).
   */
  cleanupDialTimers(contextId: string): void {
    const timer = this.dialTimers.get(contextId);
    if (timer) clearTimeout(timer);
    this.dialTimers.delete(contextId);

    const restoreTimer = this.restoreTimers.get(contextId);
    if (restoreTimer) clearTimeout(restoreTimer);
    this.restoreTimers.delete(contextId);
  }

  /**
   * Returns true while a dial has a deferred command queued or its success/error
   * flash is still active. Used to avoid live-state refreshes fighting with
   * immediate user feedback.
   */
  isDialInteractionActive(contextId: string): boolean {
    return this.dialTimers.has(contextId) || this.restoreTimers.has(contextId);
  }

  /**
   * Show a spinner on a key while an async operation runs.
   * Returns a function to stop the spinner.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showSpinner(action: any, label?: string): () => void {
    const frames = ["◐", "◓", "◑", "◒"];
    let i = 0;
    let stopped = false;
    const interval = setInterval(() => {
      if (stopped) return;
      const text = label ? `${frames[i]}\n${label}` : frames[i];
      action.setTitle(text).catch(() => {});
      i = (i + 1) % frames.length;
    }, 150);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }

  /**
   * Cancel any RGB effect currently playing on the given target before a user
   * command lands. Must be awaited so the last in-flight effect frame drains
   * before the follow-up command reaches the device — otherwise a trailing
   * frame can re-wake a just-turned-off light.
   *
   * For single lights: cancels the effect keyed by `light:deviceId|model`
   * (matches what EffectService.playEffect is keyed by).
   * For groups: iterates the group's controllable lights and cancels each.
   * Both keys are also tried directly in case an effect was addressed by the
   * group's composite id (future-proofing).
   */
  async cancelActiveEffectForTarget(target: DeviceTarget): Promise<void> {
    if (!effectCanceller) return;
    const targetIds: string[] = [];
    if (target.type === "light" && target.light) {
      targetIds.push(`light:${target.light.deviceId}|${target.light.model}`);
    } else if (target.type === "group" && target.group) {
      targetIds.push(`group:${target.group.id}`);
      for (const light of target.group.getControllableLights()) {
        targetIds.push(`light:${light.deviceId}|${light.model}`);
      }
    }
    for (const id of targetIds) {
      try {
        await effectCanceller(id);
      } catch (error) {
        streamDeck.logger?.debug(
          `cancelActiveEffectForTarget: cancel failed for ${id}`,
          error,
        );
      }
    }
  }

  /**
   * Cancel the effect running on a single light. Used by setSegmentColors
   * which doesn't have a DeviceTarget — just a Light.
   */
  private async cancelActiveEffectForLight(light: Light): Promise<void> {
    if (!effectCanceller) return;
    try {
      await effectCanceller(`light:${light.deviceId}|${light.model}`);
    } catch (error) {
      streamDeck.logger?.debug(
        `cancelActiveEffectForLight: cancel failed for ${light.deviceId}|${light.model}`,
        error,
      );
    }
  }

  /**
   * Execute a control command on either a light or group
   * Includes retry logic with exponential backoff for resilience
   */
  async controlTarget(
    target: DeviceTarget,
    command: "on" | "off" | "brightness" | "color" | "colorTemperature",
    value?: DomainBrightness | DomainColorRgb | DomainColorTemperature,
    maxRetries = 3,
  ): Promise<void> {
    if (!this.lightControlService) {
      throw new Error("Light control service not initialized");
    }

    await this.cancelActiveEffectForTarget(target);

    const execute = async (attempt: number): Promise<void> => {
      try {
        if (target.type === "light" && target.light) {
          await this.lightControlService!.controlLight(
            target.light,
            command,
            toDomainControlValue(value),
          );
          this.rememberLightState(target.light);
        } else if (target.type === "group" && target.group) {
          await this.lightControlService!.controlGroup(
            target.group,
            command,
            toDomainControlValue(value),
          );
          // Persist post-command state for each group member so other
          // actions pointed at the same lights see the new power /
          // brightness / colour value via the shared snapshot cache.
          // Without this, toggling a group from one action leaves the
          // dial state stale until the live-sync timer next refreshes.
          for (const light of target.group.getControllableLights()) {
            this.rememberLightState(light);
          }
        }
      } catch (error) {
        // Don't retry on validation errors - these are likely API issues
        if (
          isValidationError(error) ||
          this.isNonRetryableControlError(error)
        ) {
          throw error;
        }
        if (attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000);
          streamDeck.logger?.warn(
            `Command failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms:`,
            error,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return execute(attempt + 1);
        }
        throw error;
      }
    };

    await execute(0);
  }

  /**
   * Apply per-segment colors to a single light (RGB IC lights only).
   *
   * Cancels any active effect on the target first. EffectService.renderFrame
   * bypasses this method and goes straight to the repo so it doesn't
   * self-cancel during its own play-loop.
   */
  async setSegmentColors(
    light: Light,
    segments: SegmentColor[],
  ): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.setSegmentColors(light, segments);
    this.rememberLightState(light);
  }

  async getDynamicScenes(light: Light): Promise<DynamicSceneOption[]> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return withTimeout(
      this.lightRepository.getDynamicScenes(light),
      PI_HANDLER_TIMEOUT_MS,
      "Dynamic scenes fetch",
    );
  }

  async getDiyScenes(light: Light): Promise<DiySceneOption[]> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return withTimeout(
      this.lightRepository.getDiyScenes(light),
      PI_HANDLER_TIMEOUT_MS,
      "DIY scenes fetch",
    );
  }

  async applyDynamicScene(
    light: Light,
    scene: DynamicSceneOption,
  ): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.setLightScene(light, scene);
    // Persist post-apply state so other actions pointed at this light
    // (notably the OnOff three-state title for groups) see the
    // power=on transition without a separate live-state round-trip.
    this.rememberLightState(light);
  }

  async applyDiyScene(light: Light, scene: DiySceneOption): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.setDiyScene(light, scene);
    this.rememberLightState(light);
  }

  async getSnapshots(light: Light): Promise<SnapshotOption[]> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return withTimeout(
      this.lightRepository.getSnapshots(light),
      PI_HANDLER_TIMEOUT_MS,
      "Snapshots fetch",
    );
  }

  async applySnapshot(light: Light, snapshot: SnapshotOption): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.applySnapshot(light, snapshot);
    this.rememberLightState(light);
  }

  async toggleFeatureRaw(
    light: Light,
    instance: string,
    enabled: boolean,
  ): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.toggleRaw(light, instance, enabled);
    this.rememberLightState(light);
  }

  async getToggleFeatureState(
    light: Light,
    instance: string,
  ): Promise<boolean | undefined> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return this.lightRepository.getToggleState(light, instance);
  }

  async syncLightState(light: Light): Promise<boolean> {
    const lightRepository = this.lightRepository;
    if (!lightRepository) {
      throw new Error("Light repository not initialized");
    }
    this.hydrateFromSnapshot(light);
    if (this.hasFreshSnapshot(light)) {
      return true;
    }
    if (this.isLiveStateTemporarilyBlocked(light, "full-state")) {
      return false;
    }

    const snapshotKey = this.getLightSnapshotKey(light);
    const inFlight = ActionServices.liveStateSyncInFlight.get(snapshotKey);
    if (inFlight) {
      await inFlight;
      this.hydrateFromSnapshot(light);
      return this.hasFreshSnapshot(light);
    }

    const syncPromise = (async () => {
      try {
        await lightRepository.getLightState(light);
        this.clearLiveStateBlock(light, "full-state");
        this.rememberLightState(light);
        return true;
      } catch (error) {
        if (this.handleIgnorableLiveStateError(light, error, "full-state")) {
          return false;
        }
        if (this.isRateLimitError(error)) {
          this.blockLiveState(
            light,
            "full-state",
            RATE_LIMIT_RETRY_BACKOFF_MS,
            error,
          );
          return false;
        }
        throw error;
      } finally {
        ActionServices.liveStateSyncInFlight.delete(snapshotKey);
      }
    })();

    ActionServices.liveStateSyncInFlight.set(snapshotKey, syncPromise);

    const synced = await syncPromise;
    this.hydrateFromSnapshot(light);
    return synced || this.hasFreshSnapshot(light);
  }

  async getLivePowerState(light: Light): Promise<boolean | undefined> {
    this.hydrateFromSnapshot(light);

    if (this.lightRepository) {
      try {
        const synced = await this.syncLightState(light);
        if (synced) {
          return light.isOn;
        }
      } catch {
        // Fall through to transport power-state lookup below.
      }
    }

    if (!this.deviceService) {
      return this.getKnownPowerState(light);
    }

    if (this.isLiveStateTemporarilyBlocked(light, "power-state")) {
      return this.getKnownPowerState(light);
    }

    try {
      const result = await this.deviceService.getLightState(
        light.deviceId,
        light.model,
      );
      streamDeck.logger.info("light.power.live-state", {
        deviceId: light.deviceId,
        model: light.model,
        name: light.name,
        powerState: result.state.powerState,
        isOnline: result.state.isOnline,
        transport: result.transport,
      });
      if (typeof result.state.powerState === "boolean") {
        light.updateState({
          isOn: result.state.powerState,
          isOnline: result.state.isOnline,
        });
        this.rememberLightState(light);
      }
      this.clearLiveStateBlock(light, "power-state");
      return result.state.powerState;
    } catch (error) {
      if (this.handleIgnorableLiveStateError(light, error, "power-state")) {
        return this.getKnownPowerState(light);
      }
      if (this.isRateLimitError(error)) {
        this.blockLiveState(
          light,
          "power-state",
          RATE_LIMIT_RETRY_BACKOFF_MS,
          error,
        );
        return this.getKnownPowerState(light);
      }
      streamDeck.logger.warn(
        `Failed to get live power state for ${light.name}, using cached state:`,
        error,
      );
      return this.getKnownPowerState(light);
    }
  }

  async verifyLivePowerState(
    light: Light,
    expected: boolean,
    attempts = 3,
  ): Promise<void> {
    let observedKnownState: boolean | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const liveState = await this.getLivePowerState(light);
      streamDeck.logger.info("light.power.verify", {
        attempt: attempt + 1,
        attempts,
        deviceId: light.deviceId,
        model: light.model,
        name: light.name,
        expected,
        actual: liveState ?? null,
      });
      if (liveState === expected) {
        return;
      }

      if (liveState !== undefined) {
        observedKnownState = liveState;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (observedKnownState === undefined) {
      streamDeck.logger.warn("light.power.verify.skipped", {
        deviceId: light.deviceId,
        model: light.model,
        name: light.name,
        expected,
        reason: "live-power-state-unavailable",
      });
      return;
    }

    // Govee's cloud API can take several seconds to reflect state changes.
    // Throwing here would show a false alert and revert the optimistic state,
    // leaving the button title out of sync with the actual light. Warn instead
    // and let the periodic live-sync correct any drift.
    streamDeck.logger.warn("light.power.verify.lag", {
      deviceId: light.deviceId,
      model: light.model,
      name: light.name,
      expected,
      actual: observedKnownState,
    });
  }

  async applyMusicModeRaw(
    light: Light,
    musicMode: MusicModeOption,
  ): Promise<void> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    await this.cancelActiveEffectForLight(light);
    await this.lightRepository.setMusicModeRaw(light, musicMode);
    this.rememberLightState(light);
  }

  async getMusicModes(
    deviceId: string,
  ): Promise<Array<{ name: string; value: number }>> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return withTimeout(
      this.lightRepository.getMusicModes(deviceId),
      PI_HANDLER_TIMEOUT_MS,
      "Music modes fetch",
    );
  }

  async getToggleFeatures(
    deviceId: string,
  ): Promise<Array<{ name: string; instance: string }>> {
    if (!this.lightRepository) {
      throw new Error("Light repository not initialized");
    }
    return withTimeout(
      this.lightRepository.getToggleFeatures(deviceId),
      PI_HANDLER_TIMEOUT_MS,
      "Toggle features fetch",
    );
  }

  private getLiveStateKey(light: Light, operation: string): string {
    return `${light.deviceId}|${light.model}|${operation}`;
  }

  private isLiveStateTemporarilyBlocked(
    light: Light,
    operation: string,
  ): boolean {
    const blockedUntil = ActionServices.liveStateBlockedUntil.get(
      this.getLiveStateKey(light, operation),
    );
    return typeof blockedUntil === "number" && blockedUntil > Date.now();
  }

  private clearLiveStateBlock(light: Light, operation: string): void {
    const key = this.getLiveStateKey(light, operation);
    ActionServices.liveStateBlockedUntil.delete(key);
    ActionServices.liveStateLogged.delete(key);
  }

  private blockLiveState(
    light: Light,
    operation: string,
    retryAfterMs: number,
    error: unknown,
  ): void {
    const logKey = this.getLiveStateKey(light, operation);
    ActionServices.liveStateBlockedUntil.set(logKey, Date.now() + retryAfterMs);
    if (!ActionServices.liveStateLogged.has(logKey)) {
      ActionServices.liveStateLogged.add(logKey);
      streamDeck.logger.warn("light.live-state.temporarily-disabled", {
        deviceId: light.deviceId,
        model: light.model,
        name: light.name,
        operation,
        retryAfterMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleIgnorableLiveStateError(
    light: Light,
    error: unknown,
    operation: string,
  ): boolean {
    if (!isIgnorableLiveStateError(error)) {
      return false;
    }

    this.blockLiveState(light, operation, LIVE_STATE_RETRY_BACKOFF_MS, error);

    return true;
  }

  // ── Overlay-mode preparation for solid-color commands ─────────────────
  //
  // On RGB IC / scene-capable lights, the device may currently be in a
  // gradient or nightlight mode. A bare setColor / setColorTemperature /
  // setBrightness command does not reliably exit those overlays, which
  // causes the perceived color to be tinted or washed out. Before the
  // first solid-color command of a dial session, we explicitly disable
  // the overlays that the device advertises. Subsequent commands in the
  // same session skip the prepare step to avoid per-tick API overhead.
  //
  // The tracking is keyed by `${contextId}|${deviceId}|${model}` so that:
  //   • different dials for the same device don't share prepared state
  //     (safe: extra prepare calls are fire-and-forget)
  //   • switching the dial to a different device forces a re-prepare
  //   • disappearing / reappearing the dial forces a re-prepare

  private getPreparedKey(
    contextId: string,
    light: Pick<Light, "deviceId" | "model">,
  ): string {
    return `${contextId}|${light.deviceId}|${light.model}`;
  }

  /**
   * Clear any mode overlays that would tint or override a solid color
   * command. Fire-and-forget per capability — a failure in one toggle
   * does not block the others or the subsequent color command.
   *
   * This is intentionally public so tests can invoke it directly.
   */
  async prepareForSolidColor(light: Light): Promise<void> {
    const repo = this.lightRepository;
    if (!repo) {
      return;
    }
    const tasks: Array<Promise<void>> = [];
    if (light.supportsGradient()) {
      tasks.push(
        repo.toggleGradient(light, false).catch((error) => {
          streamDeck.logger?.debug(
            `prepareForSolidColor: toggleGradient off failed for ${light.name}`,
            error,
          );
        }),
      );
    }
    if (light.supportsNightlight()) {
      tasks.push(
        repo.toggleNightlight(light, false).catch((error) => {
          streamDeck.logger?.debug(
            `prepareForSolidColor: toggleNightlight off failed for ${light.name}`,
            error,
          );
        }),
      );
    }
    await Promise.all(tasks);
  }

  /**
   * Idempotent, per-context guarded version of `prepareForSolidColor`.
   * Runs the prepare once per `(contextId, deviceId, model)` tuple until
   * `clearPreparedForContext` is called. Safe to call on every command.
   */
  async ensurePreparedForSolidColor(
    contextId: string,
    light: Light,
  ): Promise<void> {
    const key = this.getPreparedKey(contextId, light);
    if (ActionServices.preparedForSolidColor.has(key)) {
      return;
    }
    await this.prepareForSolidColor(light);
    ActionServices.preparedForSolidColor.add(key);
  }

  /**
   * Convenience wrapper that handles both single-light and group targets.
   * For groups, iterates the controllable lights and prepares each one.
   * Replaces the per-action `if (target.type === "light")` check so
   * call sites can pass the target directly.
   */
  async ensurePreparedForTarget(
    contextId: string,
    target: DeviceTarget,
  ): Promise<void> {
    if (target.type === "light" && target.light) {
      await this.ensurePreparedForSolidColor(contextId, target.light);
    } else if (target.type === "group" && target.group) {
      for (const light of target.group.getControllableLights()) {
        await this.ensurePreparedForSolidColor(contextId, light);
      }
    }
  }

  /**
   * Drop all prepared-state entries for a context. Called from
   * `onWillDisappear` / `onDidReceiveSettings` so that the next command
   * on that dial re-issues the overlay-clearing toggles. Matches prefix
   * so we drop entries for any device previously used by this context.
   */
  clearPreparedForContext(contextId: string): void {
    const prefix = `${contextId}|`;
    for (const key of ActionServices.preparedForSolidColor) {
      if (key.startsWith(prefix)) {
        ActionServices.preparedForSolidColor.delete(key);
      }
    }
  }
}
