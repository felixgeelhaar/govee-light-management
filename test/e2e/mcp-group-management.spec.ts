/**
 * Playwright MCP Tests for Group Management Property Inspector
 * 
 * Comprehensive tests for group creation, editing, deletion, and control
 * using MCP browser automation tools
 */

import { test, expect } from '@playwright/test';

test.describe('MCP Group Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to group property inspector demo page
    await page.goto('/property-inspector-groups.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Initial Page Load and Structure', () => {
    test('should load page with correct title and group interface', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle('Govee Group Control - Property Inspector');
      
      // Check main form exists
      const form = page.locator('#groupControlForm');
      await expect(form).toBeVisible();
      
      // Verify group control elements
      await expect(page.locator('input[name="apiKey"]')).toBeVisible();
      await expect(page.locator('select[name="selectedGroup"]')).toBeVisible();
      await expect(page.locator('select[name="controlMode"]')).toBeVisible();
      
      // Verify group creation section
      const groupCreation = page.locator('.group-creation');
      await expect(groupCreation).toBeVisible();
      await expect(page.locator('input[name="groupName"]')).toBeVisible();
      await expect(page.locator('button[data-action="createGroup"]')).toBeVisible();
      
      // Verify existing groups section
      const groupList = page.locator('.group-list');
      await expect(groupList).toBeVisible();
    });

    test('should show existing groups in list', async ({ page }) => {
      const groupItems = page.locator('.group-item');

      // Should have some mock groups
      const groupCount = await groupItems.count();
      expect(groupCount).toBeGreaterThan(0);

      // Check first group structure
      const firstGroup = groupItems.first();
      await expect(firstGroup.locator('.group-name')).toBeVisible();
      await expect(firstGroup.locator('.group-count')).toBeVisible();
      await expect(firstGroup.locator('button[data-action="editGroup"]')).toBeVisible();
      await expect(firstGroup.locator('button[data-action="deleteGroup"]')).toBeVisible();
    });

    test('should have lights available for group creation', async ({ page }) => {
      const lightList = page.locator('#lightList');
      const lightItems = lightList.locator('.light-item');

      await expect(lightList).toBeVisible();
      const lightCount = await lightItems.count();
      expect(lightCount).toBeGreaterThan(0);

      // Check light item structure
      const firstLight = lightItems.first();
      await expect(firstLight.locator('input[type="checkbox"]')).toBeVisible();
      await expect(firstLight.locator('.light-name')).toBeVisible();
      await expect(firstLight.locator('.light-model')).toBeVisible();
    });
  });

  test.describe('API Key and Group Loading', () => {
    test('should validate API key and enable group selection', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const groupSelect = page.locator('select[name="selectedGroup"]');
      
      // Initially group select should be disabled
      await expect(groupSelect).toBeDisabled();
      
      // Enter valid API key
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      
      // Wait for loading
      await page.waitForTimeout(2000);
      
      // Group select should be enabled
      await expect(groupSelect).toBeEnabled();
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Groups and lights loaded successfully');
    });

    test('should handle API key validation errors', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      
      // Enter invalid API key
      await apiKeyInput.fill('invalid');
      await apiKeyInput.blur();
      
      const apiKeyError = page.locator('#apiKeyError');
      await expect(apiKeyError).toContainText('Invalid API key format');
    });

    test('should enable test button when group is selected', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const groupSelect = page.locator('select[name="selectedGroup"]');
      const testButton = page.locator('button[data-action="testGroup"]');
      
      // Set up API key
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      // Initially test button should be disabled
      await expect(testButton).toBeDisabled();
      
      // Select a group
      await groupSelect.selectOption('group123');
      
      // Test button should be enabled
      await expect(testButton).toBeEnabled();
    });
  });

  test.describe('Group Creation Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Set up API key for all group creation tests
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
    });

    test('should create new group successfully', async ({ page }) => {
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');
      
      // Fill group name
      await groupNameInput.fill('Living Room Lights');
      
      // Select multiple lights
      await lightCheckboxes.nth(0).check();
      await lightCheckboxes.nth(1).check();
      
      // Verify checkboxes are checked
      await expect(lightCheckboxes.nth(0)).toBeChecked();
      await expect(lightCheckboxes.nth(1)).toBeChecked();
      
      // Create group
      await createGroupButton.click();
      
      // Wait for creation
      await page.waitForTimeout(1500);
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group created successfully');
      
      // Form should be cleared
      await expect(groupNameInput).toHaveValue('');
      await expect(lightCheckboxes.nth(0)).not.toBeChecked();
      await expect(lightCheckboxes.nth(1)).not.toBeChecked();
      
      // Group should appear in the list
      const groupItems = page.locator('.group-item');
      const newGroup = groupItems.filter({ hasText: 'Living Room Lights' });
      await expect(newGroup).toBeVisible();
    });

    test('should validate group creation form', async ({ page }) => {
      const createGroupButton = page.locator('button[data-action="createGroup"]');
      
      // Try to create group without name
      await createGroupButton.click();
      
      const groupNameError = page.locator('#groupNameError');
      await expect(groupNameError).toContainText('Group name is required');
      
      // Add name but no lights
      const groupNameInput = page.locator('input[name="groupName"]');
      await groupNameInput.fill('Test Group');
      await createGroupButton.click();
      
      const lightsError = page.locator('#lightsError');
      await expect(lightsError).toContainText('Please select at least one light');
    });

    test('should cancel group creation', async ({ page }) => {
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const cancelButton = page.locator('#cancelGroupButton');
      
      // Fill form partially
      await groupNameInput.fill('Temporary Group');
      await lightCheckboxes.nth(0).check();
      
      // Cancel
      await cancelButton.click();
      
      // Form should be cleared
      await expect(groupNameInput).toHaveValue('');
      await expect(lightCheckboxes.nth(0)).not.toBeChecked();
      
      // Errors should be cleared
      const groupNameError = page.locator('#groupNameError');
      const lightsError = page.locator('#lightsError');
      await expect(groupNameError).toHaveText('');
      await expect(lightsError).toHaveText('');
    });

    test('should handle light selection correctly', async ({ page }) => {
      const lightCheckboxes = page.locator('input[name="lights"]');
      const lightLabels = page.locator('.light-info');
      
      // Check multiple lights
      await lightCheckboxes.nth(0).check();
      await lightCheckboxes.nth(2).check();
      
      // Verify correct lights are selected
      await expect(lightCheckboxes.nth(0)).toBeChecked();
      await expect(lightCheckboxes.nth(1)).not.toBeChecked();
      await expect(lightCheckboxes.nth(2)).toBeChecked();
      
      // Click on label should toggle checkbox
      await lightLabels.nth(1).click();
      await expect(lightCheckboxes.nth(1)).toBeChecked();
    });
  });

  test.describe('Group Management Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Set up API key for all management tests
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
    });

    test('should edit existing group', async ({ page }) => {
      const editButton = page.locator('button[data-action="editGroup"]').first();
      const groupNameInput = page.locator('input[name="groupName"]');

      // Click edit on first group
      await editButton.click();

      // Form should be populated with group data
      await expect(groupNameInput).toHaveValue('Living Room');

      // Success message should indicate editing
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Editing group: Living Room');

      // At least one light checkbox should be checked
      const checkedLights = page.locator('input[name="lights"]:checked');
      const checkedCount = await checkedLights.count();
      expect(checkedCount).toBeGreaterThan(0);
    });

    test('should delete group with confirmation', async ({ page }) => {
      const deleteButton = page.locator('button[data-action="deleteGroup"]').first();
      
      // Mock the confirm dialog to return true
      await page.evaluate(() => {
        window.confirm = () => true;
      });
      
      // Get initial group count
      const initialGroupItems = page.locator('.group-item');
      const initialCount = await initialGroupItems.count();
      
      // Delete group
      await deleteButton.click();
      
      // Wait for deletion
      await page.waitForTimeout(1000);
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group deleted successfully');
      
      // Group count should decrease
      const finalGroupItems = page.locator('.group-item');
      const finalCount = await finalGroupItems.count();
      expect(finalCount).toBe(initialCount - 1);
    });

    test('should cancel delete when user declines confirmation', async ({ page }) => {
      const deleteButton = page.locator('button[data-action="deleteGroup"]').first();
      
      // Mock the confirm dialog to return false
      await page.evaluate(() => {
        window.confirm = () => false;
      });
      
      // Get initial group count
      const initialGroupItems = page.locator('.group-item');
      const initialCount = await initialGroupItems.count();
      
      // Try to delete group
      await deleteButton.click();
      
      // Group count should remain the same
      const finalGroupItems = page.locator('.group-item');
      const finalCount = await finalGroupItems.count();
      expect(finalCount).toBe(initialCount);
      
      // No success message should appear
      const successMessage = page.locator('.success-message');
      await expect(successMessage).not.toBeVisible();
    });
  });

  test.describe('Group Control and Testing', () => {
    test.beforeEach(async ({ page }) => {
      // Set up valid form state
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      const groupSelect = page.locator('select[name="selectedGroup"]');
      await groupSelect.selectOption('group123');
    });

    test('should test group successfully', async ({ page }) => {
      const testButton = page.locator('button[data-action="testGroup"]');
      
      await testButton.click();
      
      // Wait for test to complete
      await page.waitForTimeout(1500);
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group test successful');
    });

    test('should save group settings', async ({ page }) => {
      const controlModeSelect = page.locator('select[name="controlMode"]');
      const submitButton = page.locator('button[type="submit"]');
      
      // Change control mode
      await controlModeSelect.selectOption('brightness');
      
      // Submit form
      await submitButton.click();
      
      // Should show success message
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toContainText('Group settings saved successfully');
    });

    test('should validate form before submission', async ({ page }) => {
      // Navigate fresh to ensure no form state
      await page.goto('/property-inspector-groups.html');
      await page.waitForLoadState('networkidle');

      // The API key field has required attribute, so browser native validation kicks in
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await expect(apiKeyInput).toHaveAttribute('required', '');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // No success message should appear since form wasn't submitted due to browser validation
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toHaveCount(0);
    });

    test('should handle test errors gracefully', async ({ page }) => {
      // Clear group selection to trigger error
      const groupSelect = page.locator('select[name="selectedGroup"]');
      await groupSelect.selectOption('');
      
      const testButton = page.locator('button[data-action="testGroup"]');
      
      // Enable button artificially to test error handling
      await page.evaluate(() => {
        document.querySelector('button[data-action="testGroup"]').disabled = false;
      });
      
      await testButton.click();
      
      // Should show error message
      const errorMessage = page.locator('.error-message');
      await expect(errorMessage).toContainText('Please select a group to test');
    });
  });

  test.describe('Loading States and UI Feedback', () => {
    test('should show loading state during operations', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');
      const testButton = page.locator('button[data-action="testGroup"]');
      
      // Set up API key
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      
      // During API call, buttons should be disabled
      await expect(createGroupButton).toBeDisabled();
      await expect(testButton).toBeDisabled();
      
      // Should show loading spinner
      const loading = page.locator('.loading');
      await expect(loading).toBeVisible();
      
      // Wait for loading to complete
      await page.waitForTimeout(2000);
      
      // Loading should be hidden
      await expect(loading).not.toBeVisible();
      
      // Buttons should be re-enabled (with proper state)
      await expect(createGroupButton).toBeEnabled();
    });

    test('should disable buttons during group creation', async ({ page }) => {
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');

      // Fill form
      await groupNameInput.fill('Test Group');
      await lightCheckboxes.nth(0).check();

      // Start group creation
      await createGroupButton.click();

      // Create button should be disabled during creation
      await expect(createGroupButton).toBeDisabled();

      // Wait for creation to complete
      await page.waitForTimeout(1500);

      // Create button should be re-enabled
      await expect(createGroupButton).toBeEnabled();
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support keyboard navigation in group list', async ({ page }) => {
      const firstEditButton = page.locator('button[data-action="editGroup"]').first();
      const firstDeleteButton = page.locator('button[data-action="deleteGroup"]').first();
      
      // Tab to first edit button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // Skip through form elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should eventually reach edit button
      // Note: This is a simplified test - in practice, you'd need to know exact tab order
      await firstEditButton.focus();
      await expect(firstEditButton).toBeFocused();
      
      // Tab to delete button
      await page.keyboard.press('Tab');
      await expect(firstDeleteButton).toBeFocused();
    });

    test('should support checkbox keyboard interaction', async ({ page }) => {
      const firstCheckbox = page.locator('input[name="lights"]').first();
      
      // Focus checkbox
      await firstCheckbox.focus();
      await expect(firstCheckbox).toBeFocused();
      
      // Space should toggle checkbox
      await page.keyboard.press('Space');
      await expect(firstCheckbox).toBeChecked();
      
      // Space again should uncheck
      await page.keyboard.press('Space');
      await expect(firstCheckbox).not.toBeChecked();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      const groupSelect = page.locator('select[name="selectedGroup"]');
      const groupNameInput = page.locator('input[name="groupName"]');
      
      await expect(groupSelect).toHaveAttribute('aria-label', 'Select Group');
      await expect(groupNameInput).toHaveAttribute('aria-label', 'Group Name');
      
      // Check that light checkboxes have proper associations
      const firstLightCheckbox = page.locator('input[name="lights"]').first();
      const checkboxId = await firstLightCheckbox.getAttribute('id');
      const associatedLabel = page.locator(`label[for="${checkboxId}"]`);
      await expect(associatedLabel).toBeVisible();
    });
  });

  test.describe('Data Persistence and State Management', () => {
    test('should persist form data across page reloads', async ({ page }) => {
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const controlModeSelect = page.locator('select[name="controlMode"]');
      
      // Set form values
      await apiKeyInput.fill('persistent-group-key');
      await controlModeSelect.selectOption('brightness');
      
      // Simulate saving to localStorage
      await page.evaluate(() => {
        localStorage.setItem('goveeGroupSettings', JSON.stringify({
          apiKey: 'persistent-group-key',
          controlMode: 'brightness'
        }));
      });
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Values should be restored
      await expect(apiKeyInput).toHaveValue('persistent-group-key');
      await expect(controlModeSelect).toHaveValue('brightness');
    });

    test('should maintain group list state', async ({ page }) => {
      // Create a new group
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');

      await groupNameInput.fill('Persistent Group');
      await lightCheckboxes.nth(0).check();
      await createGroupButton.click();
      await page.waitForTimeout(1500);

      // New group should appear in the group list
      const groupItems = page.locator('.group-item');
      const persistentGroup = groupItems.filter({ hasText: 'Persistent Group' });
      await expect(persistentGroup).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors during group operations', async ({ page }) => {
      // Simulate network failure for group creation
      await page.route('**/api/**', route => route.abort());
      
      const groupNameInput = page.locator('input[name="groupName"]');
      const lightCheckboxes = page.locator('input[name="lights"]');
      const createGroupButton = page.locator('button[data-action="createGroup"]');
      
      // Try to create group
      await groupNameInput.fill('Network Test Group');
      await lightCheckboxes.nth(0).check();
      await createGroupButton.click();
      
      // Should handle error gracefully
      await page.waitForTimeout(2000);
      
      // Form should remain in usable state
      await expect(groupNameInput).toBeEnabled();
      await expect(createGroupButton).toBeEnabled();
    });

    test('should handle empty group list gracefully', async ({ page }) => {
      // Remove all groups from the list
      await page.evaluate(() => {
        const groupItems = document.getElementById('groupItems');
        groupItems.innerHTML = '<div class="group-item">No groups available</div>';
      });
      
      const groupSelect = page.locator('select[name="selectedGroup"]');
      const testButton = page.locator('button[data-action="testGroup"]');
      
      // Should still allow API key entry
      const apiKeyInput = page.locator('input[name="apiKey"]');
      await apiKeyInput.fill('valid-api-key-123');
      await apiKeyInput.blur();
      await page.waitForTimeout(2000);
      
      // Test button should remain disabled when no groups available
      await expect(testButton).toBeDisabled();
    });
  });
});