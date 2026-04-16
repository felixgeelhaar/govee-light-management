import streamDeck from "@elgato/streamdeck";

import { OnOffAction } from "./actions/OnOffAction";
import { BrightnessAction } from "./actions/BrightnessAction";
import { ColorAction } from "./actions/ColorAction";
import { ColorTemperatureAction } from "./actions/ColorTemperatureAction";
import { BrightnessDialAction } from "./actions/BrightnessDialAction";
import { ColorTempDialAction } from "./actions/ColorTempDialAction";
import { ColorHueDialAction } from "./actions/ColorHueDialAction";
import { SaturationDialAction } from "./actions/SaturationDialAction";
import { SegmentColorAction } from "./actions/SegmentColorAction";
import { SegmentColorDialAction } from "./actions/SegmentColorDialAction";
import { SceneAction } from "./actions/SceneAction";
import { MusicModeAction } from "./actions/MusicModeAction";
import { ToggleAction } from "./actions/ToggleAction";

streamDeck.logger.setLevel("info");

// Keypad actions
streamDeck.actions.registerAction(new OnOffAction());
streamDeck.actions.registerAction(new BrightnessAction());
streamDeck.actions.registerAction(new ColorAction());
streamDeck.actions.registerAction(new ColorTemperatureAction());
streamDeck.actions.registerAction(new SegmentColorAction());
streamDeck.actions.registerAction(new SceneAction());
streamDeck.actions.registerAction(new MusicModeAction());
streamDeck.actions.registerAction(new ToggleAction());

// Encoder actions (Stream Deck+)
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTempDialAction());
streamDeck.actions.registerAction(new ColorHueDialAction());
streamDeck.actions.registerAction(new SaturationDialAction());
streamDeck.actions.registerAction(new SegmentColorDialAction());

streamDeck.connect();

streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
