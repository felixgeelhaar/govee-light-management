/**
 * E2E behavior tests for the shared field-hint system.
 *
 * Proves that a backend datasource response carrying `status: "empty"`
 * or `status: "error"` renders a visible hint element below the
 * dependent dropdown, rather than leaving the user staring at the
 * static "Select a device first" placeholder (the bug in #182).
 *
 * Uses page.addInitScript to inject a mock SDPIComponents.streamDeckClient
 * before the PI's DOMContentLoaded handler runs, then captures the
 * subscribe() handler and invokes it with synthetic payloads.
 */
import { test, expect, type Page } from "@playwright/test";

async function installMockClient(page: Page) {
  await page.addInitScript(() => {
    type Handler = (msg: unknown) => void;
    type WrappedMessage = { payload: unknown };

    const piHandlers: Handler[] = [];

    const subscribable = <T>(handlers: Handler[]) => ({
      subscribe(handler: (msg: T) => void) {
        handlers.push(handler as Handler);
      },
      unsubscribe(handler: (msg: T) => void) {
        const idx = handlers.indexOf(handler as Handler);
        if (idx >= 0) handlers.splice(idx, 1);
      },
    });

    const globalSettingsHandlers: Handler[] = [];
    const settingsHandlers: Handler[] = [];

    const client = {
      sendToPropertyInspector: subscribable<WrappedMessage>(piHandlers),
      didReceiveGlobalSettings: subscribable(globalSettingsHandlers),
      didReceiveSettings: subscribable(settingsHandlers),
      getGlobalSettings() {
        // Simulate an empty global settings response so the PI shows
        // the API key setup panel (consistent with first-run state).
        setTimeout(() => {
          globalSettingsHandlers.forEach((h) =>
            h({ payload: { settings: {} } }),
          );
        }, 0);
      },
      setGlobalSettings() {},
      sendToPlugin() {},
      send() {},
    };

    // Expose hook for tests to dispatch PI messages into the subscribed
    // handlers as if they came from the plugin backend.
    (
      window as unknown as {
        __dispatchPIMessage: (payload: unknown) => void;
      }
    ).__dispatchPIMessage = (payload: unknown) => {
      piHandlers.forEach((h) => h({ payload }));
    };

    // Use a property descriptor so that if sdpi-components.js tries to
    // replace window.SDPIComponents later, our mock still wins.
    Object.defineProperty(window, "SDPIComponents", {
      get: () => ({ streamDeckClient: client }),
      set: () => {
        /* swallow assignments from the real library */
      },
      configurable: true,
    });
  });
}

async function dispatchPIMessage(page: Page, payload: unknown) {
  await page.evaluate((p) => {
    (
      window as unknown as { __dispatchPIMessage: (payload: unknown) => void }
    ).__dispatchPIMessage(p);
  }, payload);
}

const HINT_SCENARIOS = [
  {
    name: "Snapshot",
    url: "/ui/snapshot.html",
    event: "getSnapshots",
    emptyMessage: "No snapshots found. Create one in the Govee mobile app first.",
    errorMessage: "Couldn't load snapshots. Check your connection and try again.",
  },
  {
    name: "Scene",
    url: "/ui/scene.html",
    event: "getScenes",
    emptyMessage: "This device has no dynamic scenes available.",
    errorMessage: "Couldn't load scenes. Check your connection and try again.",
  },
  {
    name: "Music Mode",
    url: "/ui/music-mode.html",
    event: "getMusicModes",
    emptyMessage: "This device doesn't support music modes.",
    errorMessage:
      "Couldn't load music modes. Check your connection and try again.",
  },
  {
    name: "Toggle",
    url: "/ui/toggle.html",
    event: "getToggleFeatures",
    emptyMessage: "This device has no toggleable features.",
    errorMessage:
      "Couldn't load toggleable features. Check your connection and try again.",
  },
];

for (const { name, url, event, emptyMessage, errorMessage } of HINT_SCENARIOS) {
  test.describe(`${name} field-hint behavior`, () => {
    test.beforeEach(async ({ page }) => {
      await installMockClient(page);
      await page.goto(url);
      // Wait for attachFieldStatus to have actually wired the hint
      // element to the DOM (i.e. GoveePI.ready has fired and the PI's
      // per-dropdown call completed). Before this point the handler
      // isn't subscribed yet.
      await page.waitForSelector(`[data-field-hint="${event}"]`, {
        state: "attached",
      });
    });

    test(`renders info hint when backend returns status="empty"`, async ({
      page,
    }) => {
      await dispatchPIMessage(page, {
        event,
        status: "empty",
        items: [],
        message: emptyMessage,
      });

      const hint = page.locator(`[data-field-hint="${event}"]`);
      await expect(hint).toBeAttached();
      await expect(hint).toHaveText(emptyMessage);
      await expect(hint).toHaveClass(/field-hint/);
      await expect(hint).toHaveClass(/\binfo\b/);
    });

    test(`renders error hint when backend returns status="error"`, async ({
      page,
    }) => {
      await dispatchPIMessage(page, {
        event,
        status: "error",
        items: [],
        message: errorMessage,
      });

      const hint = page.locator(`[data-field-hint="${event}"]`);
      await expect(hint).toBeAttached();
      await expect(hint).toHaveText(errorMessage);
      await expect(hint).toHaveClass(/field-hint/);
      await expect(hint).toHaveClass(/\berror\b/);
    });

    test(`clears hint when backend returns status="ok" with items`, async ({
      page,
    }) => {
      // First send an empty status to render the hint.
      await dispatchPIMessage(page, {
        event,
        status: "empty",
        items: [],
        message: emptyMessage,
      });
      const hint = page.locator(`[data-field-hint="${event}"]`);
      await expect(hint).toHaveText(emptyMessage);

      // Then send a populated ok response; the hint should be cleared.
      await dispatchPIMessage(page, {
        event,
        status: "ok",
        items: [{ label: "Option A", value: "a" }],
      });
      await expect(hint).toHaveClass(/\bhidden\b/);
    });
  });
}
