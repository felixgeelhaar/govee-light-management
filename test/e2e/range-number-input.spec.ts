/**
 * E2E tests for the paired slider + number input on Property Inspectors
 * (#200). Ensures every PI that opts in with data-number-input gets a
 * working number input alongside the slider and that the two stay in sync.
 */
import { test, expect, type Page } from "@playwright/test";

const RANGE_WITH_NUMBER_INPUT = [
  { name: "Brightness", url: "/ui/brightness.html", setting: "brightnessValue" },
  { name: "Color Temperature", url: "/ui/color-temperature.html", setting: "colorTempValue" },
  { name: "Saturation Dial stepSize", url: "/ui/saturation-dial.html", setting: "stepSize" },
];

async function waitForRangeReady(page: Page, setting: string) {
  // sdpi-range needs a moment to attach its shadow DOM + for the poll in
  // range-value.js to insert the number input. 500ms tops.
  await page.waitForFunction(
    (s: string) => {
      const range = document.querySelector<HTMLElement>(`sdpi-range[setting="${s}"]`);
      if (!range) return false;
      const wrap = range.closest<HTMLElement>(".range-with-number");
      const numberInput = wrap?.querySelector<HTMLInputElement>(".range-number-input");
      return !!(numberInput && numberInput.value !== "");
    },
    setting,
    { timeout: 5_000 },
  );
}

/**
 * PIs hide the #settings panel until SDPI reports a valid API key. In the
 * test environment there's no real Stream Deck backend, so the panel stays
 * hidden and .range-number-input isn't interactable. Force the panel
 * visible for sync-behavior tests.
 */
async function revealSettingsPanel(page: Page) {
  await page.evaluate(() => {
    document.getElementById("settings")?.classList.remove("hidden");
    document.getElementById("setup")?.classList.add("hidden");
  });
}

for (const { name, url, setting } of RANGE_WITH_NUMBER_INPUT) {
  test.describe(`${name} number input`, () => {
    test("renders a number input next to the slider", async ({ page }) => {
      await page.goto(url);
      await waitForRangeReady(page, setting);

      const wrap = page.locator(`.range-with-number:has(sdpi-range[setting="${setting}"])`);
      await expect(wrap).toBeAttached();

      const numberInput = wrap.locator(".range-number-input");
      await expect(numberInput).toBeAttached();
      await expect(numberInput).toHaveAttribute("type", "number");
    });

    test("number input inherits min/max/step from the slider", async ({ page }) => {
      await page.goto(url);
      await waitForRangeReady(page, setting);

      const slider = page.locator(`sdpi-range[setting="${setting}"]`);
      const min = await slider.getAttribute("min");
      const max = await slider.getAttribute("max");
      const step = await slider.getAttribute("step");

      const numberInput = page.locator(
        `.range-with-number:has(sdpi-range[setting="${setting}"]) .range-number-input`,
      );
      await expect(numberInput).toHaveAttribute("min", min ?? "");
      await expect(numberInput).toHaveAttribute("max", max ?? "");
      await expect(numberInput).toHaveAttribute("step", step ?? "1");
    });
  });
}

test.describe("range-number-input sync behavior (brightness)", () => {
  test("typing a value in the number input updates the slider's underlying input", async ({ page }) => {
    await page.goto("/ui/brightness.html");
    await waitForRangeReady(page, "brightnessValue");
    await revealSettingsPanel(page);

    await page.locator('.range-number-input[aria-label="brightnessValue value"]').fill("73");
    await page.locator('.range-number-input[aria-label="brightnessValue value"]').press("Enter");

    const sliderValue = await page.evaluate(() => {
      const range = document.querySelector<HTMLElement>('sdpi-range[setting="brightnessValue"]');
      const nativeInput =
        range?.shadowRoot?.querySelector<HTMLInputElement>('input[type="range"]');
      return nativeInput?.value;
    });
    expect(sliderValue).toBe("73");
  });

  test("typing a value above max clamps to max (happy-path validation)", async ({ page }) => {
    await page.goto("/ui/brightness.html");
    await waitForRangeReady(page, "brightnessValue");
    await revealSettingsPanel(page);

    const numberInput = page.locator('.range-number-input[aria-label="brightnessValue value"]');
    await numberInput.fill("999");
    await numberInput.press("Enter");

    // After clamp the number input shows the max (100 for brightness).
    await expect(numberInput).toHaveValue("100");

    const sliderValue = await page.evaluate(() => {
      const range = document.querySelector<HTMLElement>('sdpi-range[setting="brightnessValue"]');
      const nativeInput =
        range?.shadowRoot?.querySelector<HTMLInputElement>('input[type="range"]');
      return nativeInput?.value;
    });
    expect(sliderValue).toBe("100");
  });

  test("typing a value below min clamps to min", async ({ page }) => {
    await page.goto("/ui/brightness.html");
    await waitForRangeReady(page, "brightnessValue");
    await revealSettingsPanel(page);

    const numberInput = page.locator('.range-number-input[aria-label="brightnessValue value"]');
    await numberInput.fill("-50");
    await numberInput.press("Enter");

    await expect(numberInput).toHaveValue("0");
  });

  test("PIs without data-number-input don't get a number input (on-off has none)", async ({ page }) => {
    await page.goto("/ui/on-off.html");
    // On-off has no sliders at all, but explicitly confirm the helper
    // doesn't create spurious number inputs on unrelated PIs.
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".range-number-input")).toHaveCount(0);
  });
});
