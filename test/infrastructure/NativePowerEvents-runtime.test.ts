import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NativePowerEvents } from "../../src/backend/infrastructure/power/NativePowerEvents";
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
describe("real packaged native observer runtime", () => {
  it.skipIf(!["darwin", "win32"].includes(process.platform))(
    "starts and exits on pipe closure without orphaning a process",
    async () => {
      let child!: ChildProcess;
      let diagnostics = "";
      const source = new NativePowerEvents({
        spawn: ((command, args, options) => {
          child = spawn(command, args, options);
          child.stdout?.on("data", (data) => {
            diagnostics = (diagnostics + String(data)).slice(-4000);
          });
          child.stderr?.on("data", (data) => {
            diagnostics = (diagnostics + String(data)).slice(-4000);
          });
          return child;
        }) as typeof spawn,
      });
      try {
        await source.start(
          () => {},
          () => {},
        );
        const exited = new Promise<number | null>((resolve) =>
          child.once("exit", resolve),
        );
        source.stop();
        expect(await exited).toBe(0);
      } catch (error) {
        throw new Error(
          `Observer startup/cleanup failed on ${process.platform}: ${diagnostics || "no output"}`,
          { cause: error },
        );
      } finally {
        source.stop();
      }
    },
    40000,
  );

  it.skipIf(process.platform !== "darwin")(
    "routes AppKit notifications in a private test observer",
    async () => {
      const directory = mkdtempSync(join(tmpdir(), "govee-power-native-"));
      directories.push(directory);
      const path = join(
        process.cwd(),
        "com.felixgeelhaar.govee-light-management.sdPlugin/power-hooks/macos.js",
      );
      // NSWorkspace's notification center here is local to this subprocess.
      // Posting these notifications does not suspend or shut down the machine.
      const sourceCode = readFileSync(path, "utf8").replace(
        'emit("ready");',
        `emit("ready");
workspace.postNotificationNameObject($.NSWorkspaceWillSleepNotification, null);
workspace.postNotificationNameObject($.NSWorkspaceDidWakeNotification, null);
workspace.postNotificationNameObject($.NSWorkspaceWillPowerOffNotification, null);`,
      );
      writeFileSync(join(directory, "macos.js"), sourceCode);
      const events: string[] = [];
      let finishEvents!: () => void;
      const received = new Promise<void>((resolve) => {
        finishEvents = resolve;
      });
      let child!: ChildProcess;
      const source = new NativePowerEvents({
        directory,
        spawn: ((command, args, options) => {
          child = spawn(command, args, options);
          return child;
        }) as typeof spawn,
      });
      try {
        await source.start(
          (event) => {
            events.push(event);
            if (events.length === 3) finishEvents();
          },
          () => {},
        );
        await received;
        expect(events).toEqual(["sleep", "wake", "shutdown"]);
        const exited = new Promise<number | null>((resolve) =>
          child.once("exit", resolve),
        );
        source.stop();
        expect(await exited).toBe(0);
      } finally {
        source.stop();
      }
    },
    15000,
  );
});
