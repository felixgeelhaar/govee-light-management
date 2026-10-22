import { powerLifecycleController } from "./services/PowerLifecycleController";
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
import { createShutdownRunner } from "./services/lifecycle";

// Preserve SDK 2 settings events and Stream Deck 6.9 compatibility.
// SDK 3 defaults require message identifiers introduced in Stream Deck 7.1.
streamDeck.settings.useLegacySettingsBehavior = true;

streamDeck.logger.setLevel("info");
powerLifecycleController.attach();

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

void streamDeck
  .connect()
  .then(() => powerLifecycleController.initialize())
  .catch(() => {
    streamDeck.logger.error("power.lifecycle initialization failed");
  });

// Initialize background services after connection
void schedulerService.initialize().catch((error) => {
  streamDeck.logger.error("Failed to initialize scheduler:", error);
});

// Stream Deck stops a plugin by signalling its process. Without this the
// scheduler's 30s engine poll ran until the process was killed, and the
// schedule it holds was never persisted on the way out — `shutdown()` existed
// and nothing called it.
const shutdown = createShutdownRunner(streamDeck.logger);
shutdown.onShutdown("power-lifecycle", () =>
  powerLifecycleController.shutdown(),
);
shutdown.onShutdown("scheduler", () => schedulerService.shutdown());
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown.run(signal).finally(() => process.exit(0));
  });
}

streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
