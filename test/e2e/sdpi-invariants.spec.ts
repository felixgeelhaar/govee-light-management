/**
 * Cross-PI invariants that should hold on every Property Inspector.
 *
 * Catches the class of bug in #190 where a `<sdpi-select>` had a
 * `datasource` attribute but no `setting` attribute, which silently
 * prevents the datasource subscription from firing. Users then see a
 * non-populated dropdown that never responds.
 */
import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const UI_DIR = join(
  process.cwd(),
  "com.felixgeelhaar.govee-light-management.sdPlugin",
  "ui",
);

const HTML_FILES = readdirSync(UI_DIR)
  .filter((f) => f.endsWith(".html"))
  .sort();

for (const file of HTML_FILES) {
  test.describe(`${file} SDPI invariants`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/ui/${file}`);
    });

    test("every sdpi-select with a datasource also has a setting", async ({
      page,
    }) => {
      const offenders = await page.$$eval("sdpi-select[datasource]", (nodes) =>
        nodes
          .filter((n) => !n.getAttribute("setting"))
          .map((n) => ({
            id: n.id || "(no id)",
            datasource: n.getAttribute("datasource"),
          })),
      );
      expect(
        offenders,
        `sdpi-select with datasource="..." but no setting attribute: ${JSON.stringify(
          offenders,
        )}. SDPI won't fire the datasource subscription without a setting.`,
      ).toEqual([]);
    });
  });
}

test("retired status dot has no inspector control or obsolete help", async ({
  page,
}) => {
  for (const file of HTML_FILES) {
    await page.goto(`/ui/${file}`);
    await expect(page.locator('[setting="showStatusBadge"]')).toHaveCount(0);
    await expect(page.locator("#statusBadgeScopeHint")).toHaveCount(0);
  }
});
