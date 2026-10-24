/**
 * Custom effects play per segment on one RGB IC light, so a group can never
 * be their target. Groups stay visible but greyed out, and a key saved with
 * a group (which the inspector would otherwise show as a valid selection)
 * explains itself. Found on hardware 2026-10-24: a Custom Effect key saved
 * with "Office (2 lights)" only showed an alert when pressed.
 */
import { test, expect, type Page } from "@playwright/test";

async function mountWith(page: Page, selectedDeviceId: string) {
  await page.addInitScript((selected) => {
    type Handler = (msg: unknown) => void;
    const bus = (handlers: Handler[]) => ({
      subscribe: (h: Handler) => handlers.push(h),
      unsubscribe: (h: Handler) => {
        const i = handlers.indexOf(h);
        if (i >= 0) handlers.splice(i, 1);
      },
    });
    const pi: Handler[] = [];
    const settings: Handler[] = [];
    const global: Handler[] = [];
    const client = {
      sendToPropertyInspector: bus(pi),
      didReceiveSettings: bus(settings),
      didReceiveGlobalSettings: bus(global),
      getSettings() {
        setTimeout(() =>
          settings.forEach((h) =>
            h({ payload: { settings: { selectedDeviceId: selected } } }),
          ),
        );
      },
      getGlobalSettings() {
        setTimeout(() =>
          global.forEach((h) =>
            h({
              payload: { settings: { apiKey: "test-key-for-browser-1234" } },
            }),
          ),
        );
      },
      setGlobalSettings() {},
      setSettings() {},
      send() {},
      sendToPlugin() {},
    };
    (window as unknown as { __pi: (p: unknown) => void }).__pi = (payload) =>
      pi.forEach((h) => h({ payload }));
    Object.defineProperty(window, "SDPIComponents", {
      get: () => ({ streamDeckClient: client }),
      set() {},
      configurable: true,
    });
  }, selectedDeviceId);
  await page.goto("/ui/custom-effect.html");
  await page.evaluate(() =>
    (window as unknown as { __pi: (p: unknown) => void }).__pi({
      event: "getDevices",
      status: "ok",
      items: [
        {
          label: "Lights",
          value: "",
          children: [{ label: "Desk (H6056)", value: "light:dev-1|H6056" }],
        },
        {
          label: "Groups (need a single light)",
          value: "",
          children: [
            { label: "Office (2 lights)", value: "group:g1", disabled: true },
          ],
        },
      ],
    }),
  );
}

test("a saved group target explains that custom effects need a single light", async ({
  page,
}) => {
  await mountWith(page, "group:g1");
  await expect(page.locator("#deviceUnsupported")).toBeVisible();
  await expect(page.locator("#deviceUnsupported")).toContainText(
    "single RGB IC light",
  );
});

test("a light target shows no group warning", async ({ page }) => {
  await mountWith(page, "light:dev-1|H6056");
  await expect(page.locator("#deviceUnsupported")).toBeHidden();
});
