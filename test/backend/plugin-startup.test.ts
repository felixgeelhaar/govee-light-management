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
  await import("../../src/backend/plugin");
  await vi.waitFor(() => expect(controller.initialize).toHaveBeenCalledOnce());
  expect(connect).toHaveBeenCalledOnce();
  expect(controller.attach).toHaveBeenCalledOnce();
  expect(scheduler.initialize).toHaveBeenCalledOnce();
  expect(streamDeck.actions.registerAction).toHaveBeenCalledTimes(14);
  expect(streamDeck.settings.setGlobalSettings).not.toHaveBeenCalled();
});

it("declares the SDK 3 settings minimum host version", () => {
  const manifest = JSON.parse(
    readFileSync(
      "com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json",
      "utf8",
    ),
  );
  expect(manifest.Software.MinimumVersion).toBe("7.1");
});
