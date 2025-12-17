import streamDeck from "@elgato/streamdeck";

import {
  LightControlAction,
  GroupControlAction,
  BrightnessDialAction,
  ColorTempDialAction,
  ColorHueDialAction,
  SceneControlAction,
  MusicModeAction,
  SegmentColorDialAction,
} from "./actions";

// Set appropriate logging level for production
streamDeck.logger.setLevel("info");

// Register the enterprise-grade light control actions
streamDeck.actions.registerAction(new LightControlAction());
streamDeck.actions.registerAction(new GroupControlAction());

// Register Stream Deck+ encoder actions
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTempDialAction());
streamDeck.actions.registerAction(new ColorHueDialAction());

// Register advanced feature actions (v1.1.0+)
streamDeck.actions.registerAction(new SceneControlAction());
streamDeck.actions.registerAction(new MusicModeAction());
streamDeck.actions.registerAction(new SegmentColorDialAction());

// Connect to Stream Deck
streamDeck.connect();

// Log successful initialization
streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
