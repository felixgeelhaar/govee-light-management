/**
 * Visual Regression Tests for Stream Deck Property Inspector UI
 *
 * These tests capture screenshots of various UI states and compare them
 * against baseline images to detect unintended visual changes.
 *
 * Running tests:
 * - `npm run test:e2e` - Run all e2e tests including visual regression
 * - `npm run test:e2e:visual` - Run only visual tests
 * - `npm run test:e2e:visual:update` - Update baseline screenshots
 *
 * Visual regression testing helps catch:
 * - Layout changes and CSS regressions
 * - Theme and styling inconsistencies
 * - Component rendering issues
 * - Accessibility-related visual changes
 */

import { test, expect } from '@playwright/test';

// Increase timeout for visual tests since they involve screenshot comparisons
test.setTimeout(60000);

// Common screenshot options with tolerance for minor rendering differences
// CI environments may render fonts/elements slightly differently
const screenshotOptions = {
  fullPage: true,
  maxDiffPixelRatio: 0.05, // Allow up to 5% pixel difference
};

test.describe('Visual Regression - Light Control Property Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/property-inspector.html');
    await page.waitForLoadState('networkidle');
  });

  test('initial state - empty form', async ({ page }) => {
    // Verify form is present
    const form = page.locator('#lightControlForm');
    await expect(form).toBeVisible();

    // Capture the initial empty state of the property inspector
    await expect(page).toHaveScreenshot('light-control-initial.png', screenshotOptions);
  });

  test('API key input focused state', async ({ page }) => {
    const apiKeyInput = page.locator('#apiKey');
    await expect(apiKeyInput).toBeVisible();
    await apiKeyInput.focus();

    await expect(page).toHaveScreenshot('light-control-api-key-focused.png', screenshotOptions);
  });

  test('brightness mode selected', async ({ page }) => {
    const controlModeSelect = page.locator('#controlMode');
    await expect(controlModeSelect).toBeVisible();

    await controlModeSelect.selectOption('brightness');

    // Wait for brightness slider to appear
    const brightnessSettings = page.locator('#brightnessSettings');
    await expect(brightnessSettings).toBeVisible();

    await expect(page).toHaveScreenshot('light-control-brightness-mode.png', screenshotOptions);
  });

  test('color mode selected', async ({ page }) => {
    const controlModeSelect = page.locator('#controlMode');
    await expect(controlModeSelect).toBeVisible();

    await controlModeSelect.selectOption('color');

    // Wait for color picker to appear
    const colorSettings = page.locator('#colorSettings');
    await expect(colorSettings).toBeVisible();

    await expect(page).toHaveScreenshot('light-control-color-mode.png', screenshotOptions);
  });

  test('color temperature mode selected', async ({ page }) => {
    const controlModeSelect = page.locator('#controlMode');
    await expect(controlModeSelect).toBeVisible();

    await controlModeSelect.selectOption('colorTemp');

    // Wait for color temp slider to appear
    const colorTempSettings = page.locator('#colorTempSettings');
    await expect(colorTempSettings).toBeVisible();

    await expect(page).toHaveScreenshot('light-control-colortemp-mode.png', screenshotOptions);
  });

  test('lights loaded after valid API key', async ({ page }) => {
    const apiKeyInput = page.locator('#apiKey');
    await expect(apiKeyInput).toBeVisible();

    // Enter valid API key
    await apiKeyInput.fill('valid-api-key-123');
    await apiKeyInput.blur();

    // Wait for lights to load (demo has 1.5s delay)
    const lightSelect = page.locator('#selectedLight');
    await expect(lightSelect).toBeEnabled({ timeout: 10000 });

    await expect(page).toHaveScreenshot('light-control-lights-loaded.png', screenshotOptions);
  });
});

test.describe('Visual Regression - Group Control Property Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/property-inspector-groups.html');
    await page.waitForLoadState('networkidle');
  });

  test('initial state - group form', async ({ page }) => {
    await expect(page).toHaveScreenshot('group-control-initial.png', screenshotOptions);
  });
});

test.describe('Visual Regression - Test Server Homepage', () => {
  // Skip test due to dimension mismatch between local and CI environments
  // The test server homepage renders with different heights in different environments
  // TODO: Regenerate baseline in CI with `npx playwright test --update-snapshots`
  test.skip('homepage UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('test-server-homepage.png', screenshotOptions);
  });
});

test.describe('Visual Regression - Dark Theme Consistency', () => {
  test('light control matches Stream Deck dark theme', async ({ page }) => {
    await page.goto('/property-inspector.html');
    await page.waitForLoadState('networkidle');

    // Verify dark theme background color
    const bodyElement = page.locator('body');
    await expect(bodyElement).toHaveCSS('background-color', 'rgb(45, 45, 48)');

    await expect(page).toHaveScreenshot('dark-theme-light-control.png', screenshotOptions);
  });
});

test.describe('Visual Regression - Responsive Layout', () => {
  const viewports = [
    { name: 'narrow', width: 280, height: 600 }, // Stream Deck narrow panel
    { name: 'standard', width: 340, height: 600 }, // Stream Deck standard panel
    { name: 'wide', width: 400, height: 600 }, // Stream Deck wide panel
  ];

  for (const viewport of viewports) {
    test(`light control at ${viewport.name} width (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/property-inspector.html');
      await page.waitForLoadState('networkidle');

      // Verify form is visible
      await expect(page.locator('#lightControlForm')).toBeVisible();

      await expect(page).toHaveScreenshot(`light-control-${viewport.name}.png`, screenshotOptions);
    });
  }
});
