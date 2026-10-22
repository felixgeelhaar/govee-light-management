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

it("enables legacy settings before connecting and retains startup initialization and all 18 registrations", async () => {
  Object.assign(streamDeck.settings, { useLegacySettingsBehavior: false });
  const connect = vi.fn(async () => {
    expect(streamDeck.settings.useLegacySettingsBehavior).toBe(true);
  });
  Object.assign(streamDeck, { connect });
  await import("../../src/backend/plugin");
  await vi.waitFor(() => expect(controller.initialize).toHaveBeenCalledOnce());
  expect(connect).toHaveBeenCalledOnce();
  expect(controller.attach).toHaveBeenCalledOnce();
  expect(scheduler.initialize).toHaveBeenCalledOnce();
  expect(streamDeck.actions.registerAction).toHaveBeenCalledTimes(18);
  expect(streamDeck.settings.setGlobalSettings).not.toHaveBeenCalled();
});
