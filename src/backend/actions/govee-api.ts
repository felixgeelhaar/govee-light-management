import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  type SendToPluginEvent,
  type JsonValue,
  streamDeck,
} from "@elgato/streamdeck";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.lights" })
export class GoveeLightManagement extends SingletonAction<GoveeSettings> {
  /**
   * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
   * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
   * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
   */
  override onWillAppear(
    ev: WillAppearEvent<GoveeSettings>,
  ): void | Promise<void> {
    return ev.action.setTitle(`${ev.payload.settings.selectedLight ?? "None"}`);
  }

  /**
   * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
   * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
   * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
   * settings using `setSettings` and `getSettings`.
   */
  override async onKeyDown(ev: KeyDownEvent<GoveeSettings>): Promise<void> {
    // Update the count from the settings.
    const { settings } = ev.payload;

    // Ensure the light count is initialized.

    // Update the current count in the action's settings, and change the title.
    await ev.action.setSettings(settings);
    await ev.action.setTitle(`Turn ON ${settings.selectedLight}`);
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, GoveeSettings>,
  ): Promise<void> {
    if (
      ev.payload instanceof Object &&
      "event" in ev.payload &&
      ev.payload.event === "getLights"
    ) {
      ev.action.getSettings().then(async (settings) => {
        if (settings.apiKey) {
          const response = await this.fetchGoveeLights(settings.apiKey ?? "");
          if (response instanceof Error) {
            streamDeck?.logger?.error(
              "Failed to fetch Govee lights:",
              response.message,
            );
            return;
          }
          streamDeck?.logger?.info("SENDING TO PROPERTY INSPECTOR");

          return streamDeck.ui.current?.sendToPropertyInspector({
            event: "getLights",
            items: response.data.map((light) => ({
              label: light.device,
              value: light.sku,
            })),
          });
        } else {
          streamDeck?.logger?.error(
            "API key is required to fetch Govee lights.",
          );
        }
      });
    }
  }

  private async fetchGoveeLights(
    apiKey: string,
  ): Promise<GoveeResponse | Error> {
    if (!apiKey) return Error("API key is required");

    const result = await fetch(
      "https://openapi.api.govee.com/router/api/v1/user/devices",
      {
        headers: {
          "Govee-API-Key": apiKey ?? "",
        },
      },
    );
    if (!result.ok) {
      streamDeck?.logger?.error(
        "Failed to fetch Govee lights:",
        result.statusText,
      );
      return Error(`Failed to fetch Govee lights: ${result.statusText}`);
    }
    const response = (await result.json()) as GoveeResponse;
    return response;
  }
}
/**
 * Settings for {@link FetchGoveeLights}.
 */
type GoveeSettings = {
  apiKey?: string;
  lights?: { label: string; value: string }[];
  selectedLight?: string;
};

/**
 * Response of the GoveeAPI for {@link FetchGoveeLights}.
 */
type GoveeResponse = {
  code: number;
  message: string;
  data: GoveeDevice[];
};

type GoveeDevice = {
  sku: string;
  device: string;
  capacbilities: GoveeCapability[];
};

type GoveeCapability = {
  type: string;
  instance: string;
  parameters: {
    dataType: string;
    options?: GoveeOption[];
  };
};

type GoveeOption = {
  name: string;
  value: number | string;
};
