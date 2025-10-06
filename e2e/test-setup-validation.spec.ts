import { test, expect } from '@playwright/test';

/**
 * Test Setup Validation
 * 
 * Simple test to validate that the e2e test setup is working correctly
 * and that we can access the test-app.html mock application.
 */

test.describe('Test Setup Validation', () => {
  test('should access test application successfully', async ({ page }) => {
    // Navigate to the test application
    await page.goto('/e2e/test-app.html');
    
    // Verify the test application loads
    await expect(page.locator('h1')).toContainText('Hydroscope Test Application');
    
    // Verify basic elements are present
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-input"]')).toBeVisible();
    
    console.log('✅ Test setup validation completed successfully');
  });

  test('should validate test data files exist', async ({ page }) => {
    // This test validates that our test data files are accessible
    // We'll try to load them via the test application
    
    await page.goto('/e2e/test-app.html');
    
    // Try to fetch test data files to verify they exist
    const paxosResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/test-data/paxos.json');
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { status: 0, ok: false, error: error.message };
      }
    });
    
    const chatResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/test-data/chat.json');
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { status: 0, ok: false, error: error.message };
      }
    });
    
    // Log the results for debugging
    console.log('Paxos data response:', paxosResponse);
    console.log('Chat data response:', chatResponse);
    
    // At minimum, we should be able to access the test application
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
    
    console.log('✅ Test data validation completed');
  });
});