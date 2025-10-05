import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { LightControlAction, GroupControlAction } from "./actions";

// Set appropriate logging level for production
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the enterprise-grade light control actions
streamDeck.actions.registerAction(new LightControlAction());
streamDeck.actions.registerAction(new GroupControlAction());

// Connect to Stream Deck
streamDeck.connect();

// Log successful initialization
streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
