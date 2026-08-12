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
import { SnapshotAction } from "./actions/SnapshotAction";
import { MusicModeAction } from "./actions/MusicModeAction";
import { ToggleAction } from "./actions/ToggleAction";
import { ScheduleAction } from "./actions/ScheduleAction";
import { SequenceAction } from "./actions/SequenceAction";
import { CustomEffectAction } from "./actions/CustomEffectAction";
import { RecallAction } from "./actions/RecallAction";
import { schedulerService } from "./services/SchedulerService";
import { globalSettingsService } from "./services/GlobalSettingsService";
import { setStatusBadgeVisible } from "./actions/shared/status-badge";

streamDeck.logger.setLevel("info");

// Keypad actions
streamDeck.actions.registerAction(new OnOffAction());
streamDeck.actions.registerAction(new BrightnessAction());
streamDeck.actions.registerAction(new ColorAction());
streamDeck.actions.registerAction(new ColorTemperatureAction());
streamDeck.actions.registerAction(new SegmentColorAction());
streamDeck.actions.registerAction(new RecallAction());
streamDeck.actions.registerAction(new SceneAction());
streamDeck.actions.registerAction(new SnapshotAction());
streamDeck.actions.registerAction(new MusicModeAction());
streamDeck.actions.registerAction(new ToggleAction());
streamDeck.actions.registerAction(new ScheduleAction());
streamDeck.actions.registerAction(new SequenceAction());
streamDeck.actions.registerAction(new CustomEffectAction());

// Encoder actions (Stream Deck+)
streamDeck.actions.registerAction(new BrightnessDialAction());
streamDeck.actions.registerAction(new ColorTempDialAction());
streamDeck.actions.registerAction(new ColorHueDialAction());
streamDeck.actions.registerAction(new SaturationDialAction());
streamDeck.actions.registerAction(new SegmentColorDialAction());

streamDeck.connect();

// Initialize background services after connection
void schedulerService.initialize().catch((error) => {
  streamDeck.logger.error("Failed to initialize scheduler:", error);
});

// The status badge preference is global, so it is pushed into the renderer
// once rather than read on every repaint — status-badge stays free of the
// SDK and the settings service, which is what keeps it cheap to test.
void globalSettingsService
  .getShowStatusBadge()
  .then(setStatusBadgeVisible)
  .catch((error) => {
    streamDeck.logger.error("Failed to read status badge preference:", error);
  });

// Global settings change in the property inspector, not here, so the
// renderer has to be told. Without this the keys keep their old look until
// the plugin restarts.
streamDeck.settings.onDidReceiveGlobalSettings((event) => {
  const settings = event.settings as { showStatusBadge?: boolean };
  setStatusBadgeVisible(settings?.showStatusBadge !== false);
});

streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
