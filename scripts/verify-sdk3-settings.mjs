/** Real SDK/host protocol regression; isolated from installed Stream Deck and Govee. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";
import { WebSocketServer } from "ws";

const sdk = import.meta.resolve("@elgato/streamdeck");
const manifest = JSON.parse(
  await readFile(
    new URL(
      "../com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
assert.equal(manifest.Software.MinimumVersion, "7.1");
for (const version of ["7.1.0", "7.6.0"]) {
  const directory = await mkdtemp(join(tmpdir(), "govee-sdk3-settings-"));
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => server.once("listening", resolve));
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  const probe = `
    import assert from "node:assert/strict";
    import streamDeck from ${JSON.stringify(sdk)};
    assert.equal(streamDeck.settings.useLegacySettingsBehavior, false);
    let globalChanges = 0;
    let actionChanges = 0;
    streamDeck.settings.onDidReceiveGlobalSettings(() => globalChanges++);
    streamDeck.settings.onDidReceiveSettings(() => actionChanges++);
    const appeared = new Promise(resolve => streamDeck.actions.onWillAppear(resolve));
    await streamDeck.connect();
    const { action } = await appeared;
    assert.deepEqual(await streamDeck.settings.getGlobalSettings(), { preserved: true });
    assert.deepEqual(await action.getSettings(), { selectedDeviceId: "test-light" });
    assert.equal(globalChanges, 0, "reads must not trigger global change handlers");
    assert.equal(actionChanges, 0, "reads must not trigger action change handlers");
    const changed = new Promise(resolve => streamDeck.settings.onDidReceiveSettings(resolve));
    await action.setTitle("send-pi-changes");
    await changed;
    assert.equal(globalChanges, 1, "unsolicited global PI changes must fire");
    assert.equal(actionChanges, 1, "unsolicited action PI changes must fire");
    assert.deepEqual(await action.getSettings(), { selectedDeviceId: "changed-light" });
    process.exit(0);
  `;
  await writeFile(join(directory, "probe.mjs"), probe);
  const messages = [];
  let child;
  try {
    server.on("connection", (socket) =>
      socket.on("message", (bytes) => {
        const message = JSON.parse(bytes.toString());
        messages.push(message);
        const send = (value) => socket.send(JSON.stringify(value));
        if (message.event === "registerPlugin")
          send({
            event: "willAppear",
            action: manifest.Actions[0].UUID,
            context: "test-action",
            device: "test-deck",
            payload: {
              controller: "Keypad",
              settings: { selectedDeviceId: "test-light" },
              coordinates: { column: 0, row: 0 },
              state: 0,
              isInMultiAction: false,
            },
          });
        if (message.event === "getGlobalSettings") {
          assert.equal(typeof message.id, "string");
          send({
            event: "didReceiveGlobalSettings",
            context: manifest.UUID,
            id: message.id,
            payload: { settings: { preserved: true } },
          });
        }
        if (message.event === "setTitle") {
          send({
            event: "didReceiveGlobalSettings",
            context: manifest.UUID,
            payload: { settings: { preserved: true } },
          });
          send({
            event: "didReceiveSettings",
            action: manifest.Actions[0].UUID,
            context: "test-action",
            payload: { settings: { selectedDeviceId: "changed-light" } },
          });
        }
      }),
    );
    child = spawn(
      process.execPath,
      [
        join(directory, "probe.mjs"),
        "-port",
        String(server.address().port),
        "-pluginUUID",
        manifest.UUID,
        "-registerEvent",
        "registerPlugin",
        "-info",
        JSON.stringify({
          application: { version, platform: "mac", language: "en" },
          plugin: { uuid: manifest.UUID, version: manifest.Version },
          devices: [
            {
              id: "test-deck",
              name: "Synthetic deck",
              type: 0,
              size: { columns: 5, rows: 3 },
            },
          ],
          colors: {},
        }),
      ],
      { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stdout.on("data", (data) => (stderr += data));
    child.stderr.on("data", (data) => (stderr += data));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new Error(
            "SDK protocol test timed out: " + JSON.stringify(messages) + stderr,
          ),
        );
      }, 10000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(new Error(`SDK probe exited ${code}: ${stderr}`));
      });
    });
    console.log(
      `PASS ${version}: identified reads do not emit changes; PI changes do.`,
    );
  } finally {
    if (child && child.exitCode === null) child.kill("SIGKILL");
    for (const client of server.clients) client.terminate();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}
