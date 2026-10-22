/**
 * E2E tests for the Stream Deck+ Dial Property Inspectors (SDPI)
 */
import { test, expect } from '@playwright/test';

const DIAL_PIS = [
  { name: 'Brightness Dial', url: '/ui/brightness.html', settings: ['stepSize'] },
  { name: 'Color Hue Dial', url: '/ui/color.html', settings: ['saturation', 'stepSize'] },
  { name: 'Color Temperature Dial', url: '/ui/color-temperature.html', settings: ['stepSize'] },
  { name: 'Saturation Dial', url: '/ui/saturation-dial.html', settings: ['stepSize'] },
  { name: 'Segment Color Dial', url: '/ui/segment-color.html', settings: ['segmentIndex', 'saturation', 'stepSize'] },
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

test('brightness dials expose a host-editable title alongside value and bar (#378)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.json')).json();
  const retired = ['brightness-dial', 'colorhue-dial', 'colortemp-dial', 'segment-color-dial'];
  expect(manifest.Actions).toHaveLength(14);
  expect(manifest.Actions.some((action: { UUID: string }) =>
    retired.some(suffix => action.UUID.endsWith(`.${suffix}`)))).toBe(false);
  const actions = manifest.Actions.filter((action: { UUID: string }) =>
    ['brightness'].some(suffix => action.UUID.endsWith(`.${suffix}`)));
  expect(actions).toHaveLength(1);
  for (const action of actions) {
    const layout = await (await request.get(`/${action.Encoder.layout}`)).json();
    expect(layout.items.map((item: { key: string }) => item.key)).toEqual(['title', 'value', 'bar']);
    expect(layout.items[0].type).toBe('text');
  }
});
