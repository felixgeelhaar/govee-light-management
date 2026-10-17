import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamDeck } from "@elgato/streamdeck";
import { PowerLifecycleController } from "../../../src/backend/services/PowerLifecycleController";
import { globalSettingsService } from "../../../src/backend/services/GlobalSettingsService";
const rule = {
  selectedDeviceId: "light:dev-1|H619A",
  enabled: true,
  onPluginStart: true,
  onWake: true,
  offBeforeSleep: false,
  offBeforeShutdown: false,
};
let wake: () => void;
let global: (event: { settings: Record<string, unknown> }) => void;
const engine = () => ({
  configure: vi.fn(),
  prepareTargets: vi.fn().mockResolvedValue(undefined),
  invalidatePreparedTargets: vi.fn(),
  credentialsChanged: vi.fn(),
  handle: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
  manualOverride: vi.fn(),
  manualOverrideSelection: vi.fn(),
  helperStatus: "disabled",
});
beforeEach(() => {
  Object.assign(
    streamDeck.actions,
    Object.fromEntries(
      ["onKeyDown", "onDialDown", "onDialRotate", "onTouchTap"].map((name) => [
        name,
        vi.fn(() => ({ dispose: vi.fn() })),
      ]),
    ),
  );
  vi.mocked(streamDeck.settings.getGlobalSettings).mockResolvedValue({
    apiKey: "private-key",
    powerLifecycleRules: [rule],
  });
  Object.assign(streamDeck.ui, { action: { id: "pi-1" } });
  Object.assign(streamDeck, {
    system: {
      onSystemDidWakeUp: vi.fn((listener) => {
        wake = listener;
        return { dispose: vi.fn() };
      }),
    },
  });
  Object.assign(streamDeck.settings, {
    onDidReceiveGlobalSettings: vi.fn((listener) => {
      global = listener;
      return { dispose: vi.fn() };
    }),
  });
  vi.spyOn(globalSettingsService, "getSettings").mockResolvedValue({
    apiKey: "private-key",
    powerLifecycleRules: [rule],
  });
});
afterEach(() => vi.restoreAllMocks());
describe("power lifecycle plugin wiring and PI persistence", () => {
  it("loads rules once, handles startup/wake globally and disposes listeners", async () => {
    const service = engine();
    const controller = new PowerLifecycleController(service as never);
    controller.attach();
    controller.attach();
    await controller.initialize();
    wake();
    expect(service.configure).toHaveBeenCalledWith([rule]);
    expect(service.handle.mock.calls.map((call) => call[0])).toEqual([
      "startup",
      "wake",
    ]);
    expect(streamDeck.system.onSystemDidWakeUp).toHaveBeenCalledOnce();
    controller.shutdown();
    expect(service.shutdown).toHaveBeenCalledOnce();
  });
  it("cancels work when credentials change and clears the shared settings cache", async () => {
    const service = engine();
    const controller = new PowerLifecycleController(service as never);
    const clear = vi.spyOn(globalSettingsService, "clearCache");
    controller.attach();
    await controller.initialize();
    global({
      settings: { apiKey: "new-private-key", powerLifecycleRules: [] },
    });
    expect(service.credentialsChanged).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalled();
    controller.shutdown();
  });
  it("saves a canonical rule without losing the API key or groups and without issuing power immediately", async () => {
    const service = engine();
    const controller = new PowerLifecycleController(service as never);
    vi.spyOn(streamDeck.settings, "getGlobalSettings").mockResolvedValue({
      apiKey: "private-key",
      govee_v1_lightGroups: { groups: [] },
    });
    const save = vi.spyOn(globalSettingsService, "save").mockResolvedValue();
    await controller.handlePI("pi-1", {
      event: "savePowerLifecycleRule",
      selectedDeviceId: "dev-1|H619A",
      rule: { ...rule, apiKey: "untrusted" },
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "private-key",
        govee_v1_lightGroups: { groups: [] },
        powerLifecycleRules: [rule],
      }),
    );
    expect(service.handle).not.toHaveBeenCalled();
  });
  it("returns only the requested rule and safe helper status to the PI", async () => {
    const controller = new PowerLifecycleController(engine() as never);
    await controller.handlePI("pi-1", {
      event: "getPowerLifecycleRule",
      selectedDeviceId: "dev-1|H619A",
    });
    const messages = vi.mocked(streamDeck.ui.sendToPropertyInspector).mock
      .calls;
    expect(JSON.stringify(messages)).not.toContain("private-key");
    expect(messages.at(-1)?.[0]).toMatchObject({
      event: "powerLifecycleRule",
      status: "ok",
      rule,
    });
  });
  it("rejects invalid selections and reports storage failure without raw errors", async () => {
    const controller = new PowerLifecycleController(engine() as never);
    await controller.handlePI("pi-1", {
      event: "savePowerLifecycleRule",
      selectedDeviceId: "invalid",
    });
    expect(
      vi.mocked(streamDeck.ui.sendToPropertyInspector).mock.calls.at(-1)?.[0],
    ).toMatchObject({ status: "error" });
    vi.spyOn(globalSettingsService, "save").mockRejectedValue(
      new Error("private-storage-error"),
    );
    await controller.handlePI("pi-1", {
      event: "savePowerLifecycleRule",
      selectedDeviceId: "dev-1|H619A",
      rule,
    });
    expect(
      JSON.stringify(
        vi.mocked(streamDeck.ui.sendToPropertyInspector).mock.calls,
      ),
    ).not.toContain("private-storage-error");
  });
  it("does not overwrite global data if a fresh settings read fails", async () => {
    const controller = new PowerLifecycleController(engine() as never);
    vi.spyOn(streamDeck.settings, "getGlobalSettings").mockRejectedValue(
      new Error("private-storage-error"),
    );
    const save = vi.spyOn(globalSettingsService, "save").mockResolvedValue();
    await controller.handlePI("pi-1", {
      event: "savePowerLifecycleRule",
      selectedDeviceId: "dev-1|H619A",
      rule,
    });
    expect(save).not.toHaveBeenCalled();
    expect(
      vi.mocked(streamDeck.ui.sendToPropertyInspector).mock.calls.at(-1)?.[0],
    ).toMatchObject({ status: "error" });
  });

  it("deletes a saved rule without removing other targets", async () => {
    const controller = new PowerLifecycleController(engine() as never);
    const second = { ...rule, selectedDeviceId: "group:g1" };
    vi.spyOn(streamDeck.settings, "getGlobalSettings").mockResolvedValue({
      powerLifecycleRules: [rule, second],
    });
    const save = vi.spyOn(globalSettingsService, "save").mockResolvedValue();
    await controller.handlePI("pi-1", {
      event: "deletePowerLifecycleRule",
      selectedDeviceId: "dev-1|H619A",
    });
    expect(save).toHaveBeenCalledWith({ powerLifecycleRules: [second] });
  });
});
