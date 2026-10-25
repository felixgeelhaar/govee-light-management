import { powerLifecycleController } from "./services/PowerLifecycleController";
import streamDeck from "@elgato/streamdeck";

import { OnOffAction } from "./actions/OnOffAction";
import { BrightnessAction } from "./actions/BrightnessAction";
import { ColorAction } from "./actions/ColorAction";
import { ColorTemperatureAction } from "./actions/ColorTemperatureAction";
import { SaturationDialAction } from "./actions/SaturationDialAction";
import { SegmentColorAction } from "./actions/SegmentColorAction";
import { SceneAction } from "./actions/SceneAction";
import { SnapshotAction } from "./actions/SnapshotAction";
import { MusicModeAction } from "./actions/MusicModeAction";
import { ToggleAction } from "./actions/ToggleAction";
import { ScheduleAction } from "./actions/ScheduleAction";
import { SequenceAction } from "./actions/SequenceAction";
import { CustomEffectAction } from "./actions/CustomEffectAction";
import { RecallAction } from "./actions/RecallAction";
import { schedulerService } from "./services/SchedulerService";
import { lanDiscovery } from "./services/LanDiscovery";
import { createShutdownRunner } from "./services/lifecycle";

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

// Saturation supports both keypad and Stream Deck+ encoders.
streamDeck.actions.registerAction(new SaturationDialAction());

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

// Finds lights on the local network (docs/design/lan-control.md, phase 1).
// Any failure leaves every light on the cloud.
void lanDiscovery.start().catch((error) => {
  streamDeck.logger.warn("LAN discovery failed to start:", error);
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
shutdown.onShutdown("lan-discovery", () => lanDiscovery.shutdown());
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown.run(signal).finally(() => process.exit(0));
  });
}

streamDeck.logger.info(
  "Govee Light Management plugin initialized successfully",
);

export { streamDeck };
