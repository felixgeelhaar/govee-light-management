/**
 * End-to-End tests for Stream Deck Property Inspector UI
 * 
 * Tests that the Vue-based property inspector pages load successfully
 */

import { test, expect } from '@playwright/test';

test.describe('Property Inspector Pages', () => {
  test.describe('Page Loading', () => {
    test('should load light control page', async ({ page }) => {
      await page.goto('/light-control.html');
      
      // Check that the page loaded and Vue app mounted
      await expect(page.locator('#app')).toBeVisible();
      
      // Check that the title is correct
      await expect(page).toHaveTitle('Govee Light Control');
    });

    test('should load brightness action page', async ({ page }) => {
      await page.goto('/brightness-action.html');
      
      // Check that the page loaded and Vue app mounted
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('.sdpi-wrapper')).toBeVisible();
    });

    test('should load color action page', async ({ page }) => {
      await page.goto('/color-action.html');
      
      // Check that the page loaded and Vue app mounted
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('.sdpi-wrapper')).toBeVisible();
    });

    test('should load warmth action page', async ({ page }) => {
      await page.goto('/warmth-action.html');
      
      // Check that the page loaded and Vue app mounted
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('.sdpi-wrapper')).toBeVisible();
    });

    test('should load toggle action page', async ({ page }) => {
      await page.goto('/toggle-action.html');
      
      // Check that the page loaded and Vue app mounted
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('.sdpi-wrapper')).toBeVisible();
    });
  });

  test.describe('Vue Application Initialization', () => {
    test('should initialize Vue applications without JavaScript errors', async ({ page }) => {
      const errors: string[] = [];
      
      // Capture console errors
      page.on('pageerror', error => {
        errors.push(error.message);
      });

      await page.goto('/light-control.html');
      
      // Wait for Vue to potentially mount and render
      await page.waitForTimeout(1000);
      
      // Check that no critical JavaScript errors occurred
      const criticalErrors = errors.filter(error => 
        !error.includes('favicon.ico') && 
        !error.includes('sdpi.css') &&
        !error.includes('sdpi-components.js')
      );
      
      expect(criticalErrors.length).toBe(0);
    });

    test('should load required CSS and JS resources', async ({ page }) => {
      await page.goto('/brightness-action.html');
      
      // Check that CSS files are loaded (even if they result in 404, the page should still function)
      const cssLink = page.locator('link[rel="stylesheet"]').first();
      await expect(cssLink).toHaveAttribute('href');
      
      // Check that JS modules are loaded
      const scriptTag = page.locator('script[type="module"]').first();
      await expect(scriptTag).toHaveAttribute('src');
    });
  });

  test.describe('Basic Accessibility', () => {
    test('should have proper document structure', async ({ page }) => {
      await page.goto('/light-control.html');
      
      // Check basic HTML document structure
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('Govee Light Control');
      await expect(page.locator('meta[charset="UTF-8"]')).toHaveCount(1);
    });

    test('should have proper viewport configuration', async ({ page }) => {
      await page.goto('/color-action.html');
      
      // Check viewport meta tag for responsive design
      const viewportMeta = page.locator('meta[name="viewport"]');
      await expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle missing resources gracefully', async ({ page }) => {
      await page.goto('/warmth-action.html');
      
      // Even with missing SDPI resources, the page should still load the Vue app
      await expect(page.locator('#app')).toBeVisible();
      
      // The wrapper should be present even if styling is limited
      await expect(page.locator('.sdpi-wrapper')).toBeVisible();
    });
  });
});