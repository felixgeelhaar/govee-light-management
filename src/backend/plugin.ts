import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { LightControlAction, GroupControlAction } from "./actions";
import { BrightnessDialAction } from "./actions/dials/BrightnessDialAction";
import { ColorTemperatureDialAction } from "./actions/dials/ColorTemperatureDialAction";
import { ColorDialAction } from "./actions/dials/ColorDialAction";
import { GroupDialAction } from "./actions/dials/GroupDialAction";

// Set appropriate logging level for production
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the enterprise-grade light control actions
streamDeck.actions.registerAction(new LightControlAction());
streamDeck.actions.registerAction(new GroupControlAction());

// Register Stream Deck Plus dial actions
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTemperatureDialAction());
streamDeck.actions.registerAction(new ColorDialAction());
streamDeck.actions.registerAction(new GroupDialAction());

// Connect to Stream Deck
streamDeck.connect();

// Log successful initialization
streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully with Stream Deck Plus support",
);
