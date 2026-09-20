#!/usr/bin/env node

import { spawn } from "child_process";
import { watch } from "chokidar";

// npm and the Stream Deck CLI are installed as `.cmd` shims on Windows, which
// is the only reason these spawns ever passed `shell: true`. Naming the shim
// directly keeps both platforms working without handing a command line to a
// shell: the arguments here are fixed, so a shell adds a parsing step and an
// injection sink and nothing else.
//
// Without a shell, a missing binary arrives as an `error` event rather than
// exit code 127, so both spawns below handle it — `streamdeck` is genuinely
// optional, and an unhandled `error` event would take the watcher down.
const bin = (name) => (process.platform === "win32" ? `${name}.cmd` : name);

const PLUGIN_ID = "com.felixgeelhaar.govee-light-management";

let buildProcess = null;
let isRestarting = false;

function startRollupBuild() {
  if (buildProcess) {
    buildProcess.kill();
  }

  console.log("Starting Rollup backend build (dev mode with sourcemaps)...");

  // Set ROLLUP_WATCH so dev builds stay unminified with sourcemaps
  buildProcess = spawn(bin("npm"), ["run", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      ROLLUP_WATCH: "1",
    },
  });

  buildProcess.on("error", (error) => {
    console.error(`Backend build could not start: ${error.message}`);
  });

  buildProcess.on("close", (code) => {
    if (code === 0 && !isRestarting) {
      console.log("Backend build completed successfully");
      restartStreamDeck();
    } else if (code !== 0) {
      console.error(`Backend build failed with code ${code}`);
    }
  });
}

function restartStreamDeck() {
  console.log("Restarting Stream Deck plugin...");

  const restartProcess = spawn(bin("streamdeck"), ["restart", PLUGIN_ID], {
    stdio: "inherit",
  });

  restartProcess.on("error", () => {
    console.log("Stream Deck restart skipped (streamdeck CLI is not on PATH)");
  });

  restartProcess.on("close", (code) => {
    if (code === 0) {
      console.log("Stream Deck plugin restarted successfully");
    } else {
      console.log(
        "Stream Deck restart completed (streamdeck CLI may not be available)",
      );
    }
  });
}

function setupWatcher() {
  const watcher = watch(
    [
      "src/backend/**/*.ts",
      "src/shared/**/*.ts",
      "com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json",
    ],
    {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
    },
  );

  watcher.on("change", (path) => {
    if (isRestarting) return;

    isRestarting = true;
    console.log(`File changed: ${path}`);

    setTimeout(() => {
      startRollupBuild();
      isRestarting = false;
    }, 100); // Debounce file changes
  });

  console.log("Watching for backend file changes...");
  return watcher;
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nStopping watch mode...");

  if (buildProcess) {
    buildProcess.kill();
  }

  process.exit(0);
});

// Start initial build and setup watcher
console.log("Starting backend watch mode with Stream Deck integration");
startRollupBuild();
setupWatcher();
