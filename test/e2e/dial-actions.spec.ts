/**
 * E2E tests for the Stream Deck+ Dial Property Inspectors (SDPI)
 */
import { test, expect } from '@playwright/test';

const DIAL_PIS = [
  { name: 'Brightness Dial', url: '/ui/brightness-dial.html', settings: ['stepSize'] },
  { name: 'Color Hue Dial', url: '/ui/colorhue-dial.html', settings: ['saturation', 'stepSize'] },
  { name: 'Color Temperature Dial', url: '/ui/colortemp-dial.html', settings: ['stepSize'] },
  { name: 'Saturation Dial', url: '/ui/saturation-dial.html', settings: ['stepSize'] },
  { name: 'Segment Color Dial', url: '/ui/segment-color-dial.html', settings: ['segmentIndex', 'saturation', 'stepSize'] },
];

for (const { name, url, settings } of DIAL_PIS) {
  test.describe(`${name} Property Inspector`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(url);
    });

    test('should have setup and settings panels', async ({ page }) => {
      await expect(page.locator('#setup')).toBeAttached();
      await expect(page.locator('#settings')).toBeAttached();
    });

    test('should have API key input and Connect button', async ({ page }) => {
      await expect(page.locator('#apiKey')).toBeAttached();
      await expect(page.locator('#connect')).toBeAttached();
    });

    test('should have device selector with refresh', async ({ page }) => {
      const select = page.locator('sdpi-select[setting="selectedDeviceId"]');
      await expect(select).toBeAttached();
      await expect(select).toHaveAttribute('show-refresh', '');
    });

    for (const setting of settings) {
      test(`should have ${setting} control`, async ({ page }) => {
        const control = page.locator(`sdpi-range[setting="${setting}"]`);
        await expect(control).toBeAttached();
      });
    }

    test('should have setup guide', async ({ page }) => {
      const guide = page.locator('.guide ol li');
      await expect(guide).toHaveCount(3);
    });
  });
}
