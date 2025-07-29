/**
 * Playwright MCP Tests for Stream Deck Property Inspector UI
 * 
 * Uses MCP browser tools for comprehensive UI automation testing
 * covering form validation, API interactions, and accessibility
 */

import { test, expect } from '@playwright/test';

test.describe('MCP Property Inspector Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to property inspector demo page
    await page.goto('/property-inspector.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Initial Page Load and Structure', () => {
    test('should load page with correct title and structure', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle('Govee Light Control - Property Inspector');
      
      // Check main form exists
      const form = page.locator('#lightControlForm');
      await expect(form).toBeVisible();
      
      // Verify all required form elements are present
      await expect(page.locator('input[name="apiKey"]')).toBeVisible();
      await expect(page.locator('select[name="selectedLight"]')).toBeVisible();
      await expect(page.locator('select[name="controlMode"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      await expect(page.locator('button[data-action="testLight"]')).toBeVisible();
    });

    test('should have proper initial form state', async ({ page }) => {
      // API key field should be empty and enabled
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toHaveValue('');
      await expect(apiKeyInput).toBeEnabled();
      await expect(apiKeyInput).toHaveAttribute('type', 'password');
      
      // Light select should be disabled initially
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toBeDisabled();
      await expect(lightSelect).toContainText('Loading lights...');
      
      // Control mode should have default value
      const controlModeSelect = page.locator('select[name="controlMode"]');
      await expect(controlModeSelect).toHaveValue('toggle');
      
      // Test button should be disabled initially
      const testButton = page.locator('button[data-action="testLight"]');
      await expect(testButton).toBeDisabled();
    });
  });

  test.describe('API Key Input and Validation', () => {
    test('should show validation error for empty API key on form submit', async ({ page }) => {
      // Try to submit form without API key
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Should show field error
      const apiKeyError = page.locator('#apiKeyError');
      await expect(apiKeyError).toContainText('API key is required');
    });

    test('should validate API key format', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      
      // Enter invalid format
      await apiKeyInput.fill('invalid');
      await apiKeyInput.blur();
      
      // Should show format error
      const apiKeyError = page.locator('#apiKeyError');
      await expect(apiKeyError).toContainText('Invalid API key format');
      
      // Light select should remain disabled
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toBeDisabled();
    });

    test('should fetch lights with valid API key', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const lightSelect = page.locator('select[name="selectedLight"]');
      
      // Enter valid API key
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      
      // Wait for loading to complete
      await page.waitForTimeout(2000); // Simulate API call delay
      
      // Light select should be enabled with options
      await expect(lightSelect).toBeEnabled();
      const options = lightSelect.locator('option');
      await expect(options).toHaveCount.greaterThan(1);
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Lights loaded successfully');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      
      // Enter API key that triggers error
      await apiKeyInput.fill('invalid-key');
      await apiKeyInput.blur();
      
      // Wait for API call to complete
      await page.waitForTimeout(2000);
      
      // Should show error message
      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Failed to fetch lights');
      
      // Light select should remain disabled
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toBeDisabled();
    });
  });

  test.describe('Light Selection and Testing', () => {
    test.beforeEach(async ({ page }) => {
      // Set up valid API key and load lights
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
    });

    test('should enable test button when light is selected', async ({ page }) => {
      const lightSelect = page.locator('select[name="selectedLight"]');
      const testButton = page.locator('button[data-action="testLight"]');
      
      // Initially test button should be disabled
      await expect(testButton).toBeDisabled();
      
      // Select a light
      await lightSelect.selectOption('device123|H6110');
      
      // Test button should now be enabled
      await expect(testButton).toBeEnabled();
    });

    test('should perform light test successfully', async ({ page }) => {
      const lightSelect = page.locator('select[name="selectedLight"]');
      const testButton = page.locator('button[data-action="testLight"]');
      
      // Select light and test
      await lightSelect.selectOption('device123|H6110');
      await testButton.click();
      
      // Wait for test to complete
      await page.waitForTimeout(1500);
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Light test successful');
    });

    test('should show error when testing without light selection', async ({ page }) => {
      const testButton = page.locator('button[data-action="testLight"]');
      
      // Try to test without selecting light (button should be disabled anyway)
      // But let's test the error handling directly
      await page.evaluate(() => {
        document.getElementById('testButton').disabled = false;
      });
      
      await testButton.click();
      
      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Please select a light to test');
    });
  });

  test.describe('Control Mode Settings', () => {
    test('should show brightness settings when brightness mode selected', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const brightnessSettings = page.locator('#brightnessSettings');
      const brightnessSlider = page.locator('input[name="brightnessValue"]');
      
      // Initially brightness settings should be hidden
      await expect(brightnessSettings).toHaveClass(/hidden/);
      
      // Select brightness mode
      await controlModeSelect.selectOption('brightness');
      
      // Brightness settings should now be visible
      await expect(brightnessSettings).not.toHaveClass(/hidden/);
      await expect(brightnessSlider).toBeVisible();
      await expect(brightnessSlider).toHaveAttribute('type', 'range');
      await expect(brightnessSlider).toHaveAttribute('min', '1');
      await expect(brightnessSlider).toHaveAttribute('max', '100');
    });

    test('should update brightness display when slider moves', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const brightnessSlider = page.locator('input[name="brightnessValue"]');
      const brightnessDisplay = page.locator('#brightnessDisplay');
      
      // Select brightness mode
      await controlModeSelect.selectOption('brightness');
      
      // Move slider to 75
      await brightnessSlider.fill('75');
      
      // Display should update
      await expect(brightnessDisplay).toContainText('75%');
    });

    test('should show color picker when color mode selected', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const colorSettings = page.locator('#colorSettings');
      const colorPicker = page.locator('input[name="colorValue"]');
      
      // Select color mode
      await controlModeSelect.selectOption('color');
      
      // Color settings should be visible
      await expect(colorSettings).not.toHaveClass(/hidden/);
      await expect(colorPicker).toBeVisible();
      await expect(colorPicker).toHaveAttribute('type', 'color');
    });

    test('should update color preview when color changes', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const colorPicker = page.locator('input[name="colorValue"]');
      const colorPreview = page.locator('#colorPreview');
      
      // Select color mode
      await controlModeSelect.selectOption('color');
      
      // Change color to blue
      await colorPicker.fill('#0000ff');
      
      // Preview should update
      await expect(colorPreview).toHaveCSS('background-color', 'rgb(0, 0, 255)');
      await expect(colorPreview).toContainText('#0000FF');
    });

    test('should show color temperature settings when colorTemp mode selected', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const colorTempSettings = page.locator('#colorTempSettings');
      const colorTempSlider = page.locator('input[name="colorTempValue"]');
      
      // Select color temperature mode
      await controlModeSelect.selectOption('colorTemp');
      
      // Color temp settings should be visible
      await expect(colorTempSettings).not.toHaveClass(/hidden/);
      await expect(colorTempSlider).toBeVisible();
      await expect(colorTempSlider).toHaveAttribute('min', '2000');
      await expect(colorTempSlider).toHaveAttribute('max', '9000');
    });

    test('should hide other settings when switching modes', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const brightnessSettings = page.locator('#brightnessSettings');
      const colorSettings = page.locator('#colorSettings');
      const colorTempSettings = page.locator('#colorTempSettings');
      
      // Start with brightness
      await controlModeSelect.selectOption('brightness');
      await expect(brightnessSettings).not.toHaveClass(/hidden/);
      
      // Switch to color
      await controlModeSelect.selectOption('color');
      await expect(brightnessSettings).toHaveClass(/hidden/);
      await expect(colorSettings).not.toHaveClass(/hidden/);
      
      // Switch to toggle (should hide all)
      await controlModeSelect.selectOption('toggle');
      await expect(brightnessSettings).toHaveClass(/hidden/);
      await expect(colorSettings).toHaveClass(/hidden/);
      await expect(colorTempSettings).toHaveClass(/hidden/);
    });
  });

  test.describe('Form Submission and Settings', () => {
    test.beforeEach(async ({ page }) => {
      // Set up valid form state
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      const lightSelect = page.locator('select[name="selectedLight"]');
      await lightSelect.selectOption('device123|H6110');
    });

    test('should save settings successfully with valid form', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"]');
      
      // Submit form
      await submitButton.click();
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Settings saved successfully');
    });

    test('should validate required fields on submission', async ({ page }) => {
      // Clear API key to make form invalid
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.clear();
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Should show validation errors
      const apiKeyError = page.locator('#apiKeyError');
      await expect(apiKeyError).toContainText('API key is required');
    });

    test('should maintain form state during loading', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const testButton = page.locator('button[data-action="testLight"]');
      
      // Change control mode
      await controlModeSelect.selectOption('brightness');
      
      // Start test (which shows loading state)
      await testButton.click();
      
      // During loading, form should be disabled
      await expect(controlModeSelect).toBeDisabled();
      
      // Wait for loading to complete
      await page.waitForTimeout(1500);
      
      // Form should be re-enabled
      await expect(controlModeSelect).toBeEnabled();
      
      // Control mode should still be brightness
      await expect(controlModeSelect).toHaveValue('brightness');
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const lightSelect = page.locator('select[name="selectedLight"]');
      const controlModeSelect = page.locator('select[name="controlMode"]');
      
      await expect(apiKeyInput).toHaveAttribute('aria-label', 'Govee API Key');
      await expect(lightSelect).toHaveAttribute('aria-label', 'Select Light');
      await expect(controlModeSelect).toHaveAttribute('aria-label', 'Control Mode');
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Focus should start on first input
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="apiKey"]')).toBeFocused();
      
      // Tab to next field
      await page.keyboard.press('Tab');
      await expect(page.locator('select[name="selectedLight"]')).toBeFocused();
      
      // Tab to control mode
      await page.keyboard.press('Tab');
      await expect(page.locator('select[name="controlMode"]')).toBeFocused();
    });

    test('should handle form submission with Enter key', async ({ page }) => {
      // Set up valid form
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      const lightSelect = page.locator('select[name="selectedLight"]');
      await lightSelect.selectOption('device123|H6110');
      
      // Focus API key input and press Enter
      await apiKeyInput.focus();
      await page.keyboard.press('Enter');
      
      // Should submit form
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Settings saved successfully');
    });
  });

  test.describe('Responsive Design and Mobile Support', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // All elements should still be visible and functional
      const form = page.locator('#lightControlForm');
      await expect(form).toBeVisible();
      
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toBeVisible();
      
      // Test form interaction on mobile
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toBeEnabled();
    });

    test('should maintain usability at different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 320, height: 568 }, // iPhone SE
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // Desktop small
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        // Check that form is still usable
        const form = page.locator('#lightControlForm');
        await expect(form).toBeVisible();
        
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();
        
        // Check that buttons are still clickable
        const boundingBox = await submitButton.boundingBox();
        expect(boundingBox).toBeTruthy();
        expect(boundingBox!.width).toBeGreaterThan(0);
        expect(boundingBox!.height).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Error Recovery and Edge Cases', () => {
    test('should clear errors when correcting input', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const apiKeyError = page.locator('#apiKeyError');
      
      // Trigger error
      await apiKeyInput.fill('invalid');
      await apiKeyInput.blur();
      await expect(apiKeyError).toContainText('Invalid API key format');
      
      // Correct the input
      await apiKeyInput.clear();
      await apiKeyInput.fill('valid-api-key-123');
      
      // Error should clear
      await expect(apiKeyError).toHaveText('');
    });

    test('should handle rapid API key changes', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      
      // Rapidly change API key
      await apiKeyInput.fill('first-key-123');
      await apiKeyInput.blur();
      
      // Immediately change again before first call completes
      await apiKeyInput.clear();
      await apiKeyInput.fill('second-key-456');
      await apiKeyInput.blur();
      
      // Wait for all calls to complete
      await page.waitForTimeout(3000);
      
      // Should handle the latest API key
      const lightSelect = page.locator('select[name="selectedLight"]');
      await expect(lightSelect).toBeEnabled();
    });

    test('should maintain state after page reload', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const controlModeSelect = page.locator('select[name="controlMode"]');
      
      // Set some form values
      await apiKeyInput.fill('persistent-key-123');
      await controlModeSelect.selectOption('brightness');
      
      // Trigger save to localStorage (simulate form interaction)
      await page.evaluate(() => {
        localStorage.setItem('goveeSettings', JSON.stringify({
          apiKey: 'persistent-key-123',
          controlMode: 'brightness'
        }));
      });
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Values should be restored
      await expect(apiKeyInput).toHaveValue('persistent-key-123');
      await expect(controlModeSelect).toHaveValue('brightness');
    });
  });
});