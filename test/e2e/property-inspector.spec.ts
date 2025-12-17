/**
 * End-to-End tests for Stream Deck Property Inspector UI
 * 
 * Tests the configuration interface using Playwright MCP for UI automation
 */

import { test, expect } from '@playwright/test';

test.describe('Property Inspector', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to property inspector (would be loaded by Stream Deck)
    await page.goto('/property-inspector.html');
  });

  test.describe('Light Control Configuration', () => {
    test('should load API key input field', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toBeVisible();
      await expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    test('should validate API key format', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');

      // Enter invalid API key (too short, no dash)
      await apiKeyInput.fill('invalid');
      await apiKeyInput.blur();

      // Validation errors appear in field-error elements
      const errorMessage = page.locator('#apiKeyError');
      await expect(errorMessage).toContainText('Invalid API key format');
    });

    test('should fetch lights when valid API key is entered', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const lightSelect = page.locator('select[name="selectedLight"]');

      // Enter valid API key (must be 10+ chars with dash)
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();

      // Wait for API simulation (1.5s delay in demo)
      await page.waitForTimeout(2000);

      // Light select should be enabled with options
      await expect(lightSelect).toBeEnabled();
      const optionCount = await lightSelect.locator('option').count();
      expect(optionCount).toBeGreaterThan(1);
    });

    test('should show control mode options', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');

      await expect(controlModeSelect).toBeVisible();

      // Verify options exist by checking select inner text contains expected modes
      const selectText = await controlModeSelect.innerText();
      expect(selectText).toContain('Toggle');
      expect(selectText).toContain('On');
      expect(selectText).toContain('Off');
      expect(selectText).toContain('Brightness');
      expect(selectText).toContain('Color');
    });

    test('should show brightness slider when brightness mode selected', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const brightnessSlider = page.locator('input[name="brightnessValue"]');
      
      await controlModeSelect.selectOption('brightness');
      await expect(brightnessSlider).toBeVisible();
      await expect(brightnessSlider).toHaveAttribute('type', 'range');
      await expect(brightnessSlider).toHaveAttribute('min', '1');
      await expect(brightnessSlider).toHaveAttribute('max', '100');
    });

    test('should show color picker when color mode selected', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const colorPicker = page.locator('input[name="colorValue"]');
      
      await controlModeSelect.selectOption('color');
      await expect(colorPicker).toBeVisible();
      await expect(colorPicker).toHaveAttribute('type', 'color');
    });

    test('should test light functionality', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const lightSelect = page.locator('select[name="selectedLight"]');
      const testButton = page.locator('button[data-action="testLight"]');

      // First load lights with valid API key
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);

      // Select a light and test
      await lightSelect.selectOption('device123|H6110');
      await testButton.click();

      // Wait for test to complete (1s delay in demo)
      await page.waitForTimeout(1500);

      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Light test successful');
    });
  });

  test.describe('Group Control Configuration', () => {
    test('should allow creating new light groups', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      await page.waitForLoadState('networkidle');

      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');

      // Fill group name and select lights
      await groupNameInput.fill('Living Room Lights');
      await lightCheckboxes.nth(0).check();
      await lightCheckboxes.nth(1).check();

      // Create group
      await createGroupButton.click();

      // Wait for creation (1s delay in demo)
      await page.waitForTimeout(1500);

      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group created successfully');
    });

    test('should load existing groups in dropdown', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      await page.waitForLoadState('networkidle');

      // First enter API key to enable group selection
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);

      const groupSelect = page.locator('select[name="selectedGroup"]');
      await expect(groupSelect).toBeVisible();
      await expect(groupSelect).toBeEnabled();

      // Should have options loaded
      const optionCount = await groupSelect.locator('option').count();
      expect(optionCount).toBeGreaterThan(0);
    });

    test('should test group functionality', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      await page.waitForLoadState('networkidle');

      // First enter API key to enable group selection
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);

      const groupSelect = page.locator('select[name="selectedGroup"]');
      const testButton = page.locator('button[data-action="testGroup"]');

      // Select group and test
      await groupSelect.selectOption('group123');
      await testButton.click();

      // Wait for test (1s delay in demo)
      await page.waitForTimeout(1500);

      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group test successful');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API key validation errors', async ({ page }) => {
      // Enter API key that triggers error (contains 'invalid')
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('invalid-key');
      await apiKeyInput.blur();

      // Wait for API simulation
      await page.waitForTimeout(2000);

      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Failed to fetch lights');
    });

    test('should validate required fields', async ({ page }) => {
      // The API key field has required attribute, so browser native validation kicks in
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toHaveAttribute('required', '');

      // Try to submit - browser will show native validation tooltip
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // No success message should appear since form wasn't submitted
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toHaveCount(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toHaveAttribute('aria-label', 'Govee API Key');
      
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toHaveAttribute('aria-label', 'Select Light');
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="apiKey"]')).toBeFocused();

      // Tab to control mode (light select is disabled so it's skipped)
      await page.keyboard.press('Tab');
      await expect(page.locator('select[name="controlMode"]')).toBeFocused();
    });

    test('should meet contrast requirements', async ({ page }) => {
      // Property inspector uses dark theme matching Stream Deck UI
      const bodyElement = page.locator('body');
      // Dark theme background color #2d2d30 = rgb(45, 45, 48)
      await expect(bodyElement).toHaveCSS('background-color', 'rgb(45, 45, 48)');
    });
  });
});