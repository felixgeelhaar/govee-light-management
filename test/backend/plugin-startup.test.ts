import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import streamDeck from "@elgato/streamdeck";

const controller = vi.hoisted(() => ({
  attach: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
}));
const scheduler = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
}));
vi.mock("../../src/backend/services/PowerLifecycleController", () => ({
  powerLifecycleController: controller,
}));
vi.mock("../../src/backend/services/SchedulerService", () => ({
  schedulerService: scheduler,
}));
const lan = vi.hoisted(() => ({
  useSetting: vi.fn(),
  configure: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/backend/services/LanDiscovery", () => ({
  lanDiscovery: lan,
}));

const listeners = new Map(
  ["SIGTERM", "SIGINT"].map((event) => [event, process.listeners(event)]),
);
afterEach(() => {
  for (const [event, previous] of listeners) {
    for (const listener of process.listeners(event)) {
      if (!previous.includes(listener)) process.removeListener(event, listener);
    }
  }
});

it("uses SDK 3 settings behavior before connecting and retains startup initialization and all 14 registrations", async () => {
  Object.assign(streamDeck.settings, { useLegacySettingsBehavior: false });
  const connect = vi.fn(async () => {
    expect(streamDeck.settings.useLegacySettingsBehavior).toBe(false);
  });
  Object.assign(streamDeck, { connect });
  Object.assign(streamDeck.settings, {
    onDidReceiveGlobalSettings: vi.fn(),
  });
  await import("../../src/backend/plugin");
  await vi.waitFor(() => expect(controller.initialize).toHaveBeenCalledOnce());
  expect(connect).toHaveBeenCalledOnce();
  expect(controller.attach).toHaveBeenCalledOnce();
  expect(scheduler.initialize).toHaveBeenCalledOnce();
  expect(lan.useSetting).toHaveBeenCalledOnce();
  const [saved] = lan.useSetting.mock.calls[0];
  await expect(saved).resolves.toBe(true);
  const [onGlobal] = vi.mocked(streamDeck.settings.onDidReceiveGlobalSettings)
    .mock.calls[0];
  onGlobal({ settings: { localNetworkControl: false } } as never);
  expect(lan.configure).toHaveBeenLastCalledWith(false);
  onGlobal({ settings: { apiKey: "k" } } as never);
  expect(lan.configure).toHaveBeenLastCalledWith(true);
  expect(streamDeck.actions.registerAction).toHaveBeenCalledTimes(14);
  expect(streamDeck.settings.setGlobalSettings).not.toHaveBeenCalled();
  // Importing plugin.ts loads every action and service: ~4.5 s alone, past
  // the 5 s default on a loaded machine. The time is module loading, not
  // the startup path asserted here.
}, 30_000);

it("declares the SDK 3 settings minimum host version", () => {
  const manifest = JSON.parse(
    readFileSync(
      "com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json",
      "utf8",
    ),
  );
  expect(manifest.Software.MinimumVersion).toBe("7.1");
});
