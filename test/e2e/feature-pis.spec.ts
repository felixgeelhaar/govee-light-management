/**
 * E2E smoke tests for the remaining feature Property Inspectors that
 * don't fit the simple keypad or dial templates: Segment Color,
 * Schedule, Sequence. Verifies core wiring (setup/settings panels,
 * API key flow, device dropdown datasource) so a broken PI never
 * ships silently.
 */
import { test, expect } from "@playwright/test";

const FEATURE_PIS = [
  {
    name: "Segment Color",
    url: "/ui/segment-color.html",
    hasDeviceSelect: true,
    extraSelects: ["preset"],
    extraRanges: ["segmentStart", "segmentEnd"],
  },
  {
    name: "Schedule",
    url: "/ui/schedule.html",
    hasDeviceSelect: true,
    extraSelects: ["scheduleType", "command"],
    extraRanges: [],
  },
  {
    name: "Sequence",
    url: "/ui/sequence.html",
    // Sequence uses its own builder; device dropdown lives inside the
    // step builder, not at top level.
    hasDeviceSelect: false,
    extraSelects: [],
    extraRanges: [],
  },
];

for (const {
  name,
  url,
  hasDeviceSelect,
  extraSelects,
  extraRanges,
} of FEATURE_PIS) {
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

    if (hasDeviceSelect) {
      test("should have device selector bound to getDevices", async ({
        page,
      }) => {
        const select = page.locator('sdpi-select[setting="selectedDeviceId"]');
        await expect(select).toBeAttached();
        await expect(select).toHaveAttribute("datasource", "getDevices");
      });
    }

    for (const setting of extraSelects) {
      test(`should have ${setting} select`, async ({ page }) => {
        await expect(
          page.locator(`sdpi-select[setting="${setting}"]`),
        ).toBeAttached();
      });
    }

    for (const setting of extraRanges) {
      test(`should have ${setting} range`, async ({ page }) => {
        await expect(
          page.locator(`sdpi-range[setting="${setting}"]`),
        ).toBeAttached();
      });
    }

    test("should load without unexpected errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
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
