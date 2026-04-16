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
import { ColorTemperature } from "@felixgeelhaar/govee-api-client";
import { ActionServices, type BaseSettings } from "./shared/ActionServices";
import {
  kelvinFromPercent,
  normalizeKelvin,
  type KelvinRange,
} from "./shared/kelvin-utils";
import { telemetryService } from "../services/TelemetryService";

type ColorTemperatureSettings = BaseSettings & {
  colorTempValue?: number;
};

/**
 * Fallback range used when the device has not advertised its Kelvin range
 * (typical for group targets) or when discovery has not yet populated it.
 * 2700–6500K is the common intersection across Govee H-series lights and
 * avoids hitting the "parameter value out of range" rejection that the
 * previous hardcoded 2000–9000K mapping produced on most devices.
 */
const FALLBACK_RANGE: KelvinRange = { min: 2700, max: 6500, precision: 100 };

@action({ UUID: "com.felixgeelhaar.govee-light-management.colortemp" })
export class ColorTemperatureAction extends SingletonAction<ColorTemperatureSettings> {
  private services = new ActionServices();

  override async onWillAppear(
    ev: WillAppearEvent<ColorTemperatureSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<ColorTemperatureSettings>,
  ): Promise<void> {
    await ev.action.setTitle(this.getTitle(ev.payload.settings));
  }

  override async onKeyDown(
    ev: KeyDownEvent<ColorTemperatureSettings>,
  ): Promise<void> {
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

    const started = Date.now();

    try {
      const tempPercent = settings.colorTempValue ?? 50;
      // Map the percentage to the device's advertised Kelvin range instead
      // of a hardcoded 2000–9000K window. Most Govee devices only support
      // 2700–6500K; sending outside that window caused a silent
      // "parameter value out of range" rejection (see #167).
      const range = await this.resolveKelvinRange(settings);
      const kelvin = normalizeKelvin(
        kelvinFromPercent(tempPercent, range),
        range,
      );
      const colorTemp = new ColorTemperature(kelvin);

      const stopSpinner = this.services.showSpinner(ev.action);
      try {
        // Exit gradient/nightlight overlay once per key session so
        // setColorTemperature is not tinted by a lingering mode (see #170).
        if (target.type === "light" && target.light) {
          await this.services.ensurePreparedForSolidColor(
            ev.action.id,
            target.light,
          );
        }
        await this.services.controlTarget(
          target,
          "colorTemperature",
          colorTemp,
        );
      } finally {
        stopSpinner();
      }
      await ev.action.setTitle(this.getTitle(settings));
      await ev.action.showOk();

      telemetryService.recordCommand({
        command: `${target.type}.colorTemperature`,
        durationMs: Date.now() - started,
        success: true,
      });
    } catch (error) {
      streamDeck.logger.error("Failed to set color temperature:", error);
      await ev.action.showAlert();
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ColorTemperatureSettings>,
  ): Promise<void> {
    if (!(ev.payload instanceof Object) || !("event" in ev.payload)) return;

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
    }
  }

  private getTitle(_settings: ColorTemperatureSettings): string {
    return "";
  }

  /**
   * Resolve the Kelvin range to use for the percent→Kelvin mapping.
   *
   * Prefers the device's advertised range from cloud capability metadata
   * (populated by CloudTransport.extractColorTemperatureRange). Falls back
   * to a safe 2700–6500K window when:
   *  - the target is a group (no single device range available), or
   *  - the device has not advertised a range, or
   *  - discovery has not yet populated properties.colorTem.
   */
  private async resolveKelvinRange(
    settings: ColorTemperatureSettings,
  ): Promise<KelvinRange> {
    const lightItem = await this.services.getLightItem(settings);
    const declared = lightItem?.properties?.colorTem?.range;
    if (!declared) {
      return FALLBACK_RANGE;
    }
    return {
      min: declared.min,
      max: declared.max,
      precision: Math.max(1, declared.precision ?? FALLBACK_RANGE.precision),
    };
  }
}
