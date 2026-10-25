/**
 * E2E tests for the keypad Property Inspectors (SDPI)
 */
import { test, expect } from '@playwright/test';

const KEYPAD_PIS = [
  { name: 'On / Off', url: '/ui/on-off.html' },
  { name: 'Brightness', url: '/ui/brightness.html' },
  { name: 'Color', url: '/ui/color.html' },
  { name: 'Color Temperature', url: '/ui/color-temperature.html' },
];

for (const { name, url } of KEYPAD_PIS) {
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

    test('should have device selector with datasource', async ({ page }) => {
      const select = page.locator('sdpi-select[setting="selectedDeviceId"]');
      await expect(select).toBeAttached();
      await expect(select).toHaveAttribute('datasource', 'getDevices');
    });

    test('should have setup guide', async ({ page }) => {
      const guide = page.locator('.guide ol li');
      await expect(guide).toHaveCount(4);
    });
  });
}

test.describe('On / Off specific', () => {
  test('should have operation selector', async ({ page }) => {
    await page.goto('/ui/on-off.html');
    await expect(page.locator('sdpi-select[setting="operation"]')).toBeAttached();
  });
});

test.describe('Brightness specific', () => {
  test('should have brightness range', async ({ page }) => {
    await page.goto('/ui/brightness.html');
    await expect(page.locator('sdpi-range[setting="brightnessValue"]')).toBeAttached();
  });
});

test.describe('Color specific', () => {
  test('should have color picker', async ({ page }) => {
    await page.goto('/ui/color.html');
    await expect(page.locator('sdpi-color[setting="colorValue"]')).toBeAttached();
  });
});

test.describe('Color Temperature specific', () => {
  test('should have temperature range', async ({ page }) => {
    await page.goto('/ui/color-temperature.html');
    await expect(page.locator('sdpi-range[setting="colorTempValue"]')).toBeAttached();
  });
});

test('On/Off exposes native per-state artwork without automatic host toggling (#375)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.json')).json();
  const action = manifest.Actions.find((item: { UUID: string }) => item.UUID.endsWith('.lights'));
  expect(action.DisableAutomaticStates).toBe(true);
  expect(action.States.map((state: { Name: string }) => state.Name)).toEqual(['On', 'Off']);
  // Both defaults retain the original artwork; custom images belong to the host.
  expect(action.States.map((state: { Image: string }) => state.Image)).toEqual([
    'imgs/actions/light/key', 'imgs/actions/light/key',
  ]);
});
