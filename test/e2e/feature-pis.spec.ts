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

/**
 * #199 invariant: the Sequence step builder must expose the full command
 * palette (color / color-temperature / scene / snapshot / music mode /
 * feature toggle / segment color / effect) with a per-command input row
 * wired up. When the command dropdown changes, exactly one input row is
 * visible. Regressions here are invisible — the backend would accept the
 * payload but users couldn't build the step — so this test locks in the
 * UI surface.
 */
test.describe("Sequence builder: all command rows present", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ui/sequence.html");
  });

  const REQUIRED_COMMAND_VALUES = [
    "on",
    "off",
    "toggle",
    "brightness",
    "color",
    "colorTemperature",
    "scene",
    "snapshot",
    "music-mode",
    "feature-toggle",
    "segment-color",
    "effect",
  ];

  // sdpi-select moves its declared <option> children into its shadow DOM at
  // construction, so Playwright's descendant locator can't find them in the
  // light DOM. Instead we verify the command-value palette against the page
  // HTML source — which is what the user sees on load and what ships.
  test("command dropdown exposes every expected value", async ({ page }) => {
    const html = await page.content();
    for (const value of REQUIRED_COMMAND_VALUES) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  const REQUIRED_ROWS = [
    "row-brightness",
    "row-color",
    "row-colortemp",
    "row-scene",
    "row-snapshot",
    "row-music-mode",
    "row-music-sensitivity",
    "row-toggle-feature",
    "row-toggle-state",
    "row-segment-index",
    "row-segment-color",
    "row-effect",
  ];

  for (const id of REQUIRED_ROWS) {
    test(`per-command row #${id} is present in the builder`, async ({
      page,
    }) => {
      await expect(page.locator(`#${id}`)).toBeAttached();
    });
  }

  test("scene/snapshot/music/toggle/effect selects bind to their datasources", async ({
    page,
  }) => {
    await expect(
      page.locator('#stepScene[datasource="getScenes"]'),
    ).toBeAttached();
    await expect(
      page.locator('#stepSnapshot[datasource="getSnapshots"]'),
    ).toBeAttached();
    await expect(
      page.locator('#stepMusicMode[datasource="getMusicModes"]'),
    ).toBeAttached();
    await expect(
      page.locator('#stepToggleFeature[datasource="getToggleFeatures"]'),
    ).toBeAttached();
    await expect(
      page.locator('#stepEffect[datasource="getEffects"]'),
    ).toBeAttached();
  });
});
