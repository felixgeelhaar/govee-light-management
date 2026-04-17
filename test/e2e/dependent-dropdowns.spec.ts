/**
 * E2E tests for Property Inspectors that have a second dropdown
 * depending on the selected device (Scene, Snapshot, Music Mode, Toggle,
 * Custom Effect). Verifies the datasource wiring is correct so we never
 * ship a dropdown that silently fails to load options (see #184 Custom
 * Effect regression and #182 snapshot empty-state bug).
 */
import { test, expect } from "@playwright/test";

const DEPENDENT_PIS = [
  {
    name: "Scene",
    url: "/ui/scene.html",
    dependent: { setting: "selectedScene", datasource: "getScenes" },
  },
  {
    name: "Snapshot",
    url: "/ui/snapshot.html",
    dependent: { setting: "selectedSnapshot", datasource: "getSnapshots" },
  },
  {
    name: "Music Mode",
    url: "/ui/music-mode.html",
    dependent: { setting: "selectedMode", datasource: "getMusicModes" },
  },
  {
    name: "Toggle",
    url: "/ui/toggle.html",
    dependent: { setting: "selectedFeature", datasource: "getToggleFeatures" },
  },
  {
    name: "Custom Effect",
    url: "/ui/custom-effect.html",
    dependent: { setting: "effectId", datasource: "getEffects" },
  },
];

for (const { name, url, dependent } of DEPENDENT_PIS) {
  test.describe(`${name} Property Inspector`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(url);
    });

    test("should have setup and settings panels", async ({ page }) => {
      await expect(page.locator("#setup")).toBeAttached();
      await expect(page.locator("#settings")).toBeAttached();
    });

    test("should have API key input and Connect button", async ({ page }) => {
      await expect(page.locator("#apiKey")).toBeAttached();
      await expect(page.locator("#connect")).toBeAttached();
    });

    test("should have device selector bound to getDevices", async ({
      page,
    }) => {
      const select = page.locator('sdpi-select[setting="selectedDeviceId"]');
      await expect(select).toBeAttached();
      await expect(select).toHaveAttribute("datasource", "getDevices");
    });

    test(`should have dependent dropdown bound to ${dependent.datasource}`, async ({
      page,
    }) => {
      const select = page.locator(
        `sdpi-select[setting="${dependent.setting}"]`,
      );
      await expect(select).toBeAttached();
      await expect(select).toHaveAttribute("datasource", dependent.datasource);
    });

    test("should load without console errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      // Reload so our listeners observe the full page lifecycle.
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      // Filter out expected SDPI connection warnings that fire when the
      // PI loads outside Stream Deck's WebSocket environment.
      const unexpected = errors.filter(
        (e) =>
          !/sendToPlugin is unavailable/i.test(e) &&
          !/WebSocket/i.test(e) &&
          !/streamDeckClient/i.test(e),
      );
      expect(unexpected).toEqual([]);
    });
  });
}
