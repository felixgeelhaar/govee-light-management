import streamDeck, { LogLevel } from "@elgato/streamdeck";

import {
  LightControlAction,
  GroupControlAction,
  BrightnessDialAction,
  ColorTempDialAction,
} from "./actions";

// Set appropriate logging level for production
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the enterprise-grade light control actions
streamDeck.actions.registerAction(new LightControlAction());
streamDeck.actions.registerAction(new GroupControlAction());

// Register Stream Deck+ encoder actions
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTempDialAction());

// Connect to Stream Deck
streamDeck.connect();

// Log successful initialization
streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
