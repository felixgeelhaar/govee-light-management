import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { LightControlAction } from "./actions";
import { BrightnessDialAction } from "./actions/dials/BrightnessDialAction";
import { ColorTemperatureDialAction } from "./actions/dials/ColorTemperatureDialAction";
import { ColorDialAction } from "./actions/dials/ColorDialAction";
// GroupDialAction removed in this iteration

// Set appropriate logging level for production
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the enterprise-grade light control action
streamDeck.actions.registerAction(new LightControlAction());

// Register Stream Deck Plus dial actions
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTemperatureDialAction());
streamDeck.actions.registerAction(new ColorDialAction());
// GroupDialAction registration removed in this iteration

// Connect to Stream Deck
streamDeck.connect();

// Log successful initialization
streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully with Stream Deck Plus support",
);

// Export streamDeck instance for other modules
export { streamDeck };
