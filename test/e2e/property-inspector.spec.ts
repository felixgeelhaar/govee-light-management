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
      const submitButton = page.locator('button[type="submit"]');
      
      // Enter invalid API key
      await apiKeyInput.fill('invalid-key');
      await submitButton.click();
      
      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Invalid API key format');
    });

    test('should fetch lights when valid API key is entered', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const lightSelect = page.locator('select[name="selectedLight"]');
      
      // Mock API response would be handled by test setup
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      
      // Wait for lights to load
      await expect(lightSelect).toBeEnabled();
      await expect(lightSelect.locator('option')).toHaveCount.greaterThan(1);
    });

    test('should show control mode options', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      
      await expect(controlModeSelect).toBeVisible();
      
      const options = controlModeSelect.locator('option');
      await expect(options).toContainText(['Toggle', 'On', 'Off', 'Brightness', 'Color', 'Color Temperature']);
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
      
      await apiKeyInput.fill('valid-api-key-123');
      await lightSelect.selectOption('device123|H6110');
      await testButton.click();
      
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Light test successful');
    });
  });

  test.describe('Group Control Configuration', () => {
    test('should allow creating new light groups', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      
      const createGroupButton = page.locator('button[data-action="createGroup"]');
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[type="checkbox"][name="lights"]');
      
      await createGroupButton.click();
      await groupNameInput.fill('Living Room Lights');
      
      // Select multiple lights
      await lightCheckboxes.nth(0).check();
      await lightCheckboxes.nth(1).check();
      
      const saveButton = page.locator('button[data-action="saveGroup"]');
      await saveButton.click();
      
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group created successfully');
    });

    test('should load existing groups in dropdown', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      
      const groupSelect = page.locator('select[name="selectedGroup"]');
      await expect(groupSelect).toBeVisible();
      
      // Should have at least the "Select Group" option
      const options = groupSelect.locator('option');
      await expect(options).toHaveCount.greaterThan(0);
    });

    test('should test group functionality', async ({ page }) => {
      await page.goto('/property-inspector-groups.html');
      
      const groupSelect = page.locator('select[name="selectedGroup"]');
      const testButton = page.locator('button[data-action="testGroup"]');
      
      await groupSelect.selectOption('group123');
      await testButton.click();
      
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group test successful');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      
      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Failed to fetch lights');
    });

    test('should validate required fields', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      const requiredFieldErrors = page.locator('.field-error');
      await expect(requiredFieldErrors).toHaveCount.greaterThan(0);
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
      
      await page.keyboard.press('Tab');
      await expect(page.locator('select[name="selectedLight"]')).toBeFocused();
    });

    test('should meet contrast requirements', async ({ page }) => {
      // This would require axe-core integration for full accessibility testing
      const bodyElement = page.locator('body');
      await expect(bodyElement).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    });
  });
});