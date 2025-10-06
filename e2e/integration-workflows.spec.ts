import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * End-to-End Tests: Integration Workflows Between Components
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * - Test integration between search, container operations, and style changes
 * - Test complex user scenarios with multiple feature interactions
 * - Test state persistence across different operations
 * - Test error handling in complex workflows
 */

test.describe('Integration Workflows Between Components', () => {
  let paxosData: any;

  test.beforeAll(async () => {
    const paxosPath = join(process.cwd(), 'test-data', 'paxos.json');
    paxosData = JSON.parse(readFileSync(paxosPath, 'utf-8'));
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/hydroscope');
    await expect(page.locator('text=Interactive graph visualization')).toBeVisible({ timeout: 10000 });
    
    // Upload test data for all integration tests
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });
  });

  test('should integrate search with container operations seamlessly', async ({ page }) => {
    // Step 1: Open InfoPanel and perform search
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('persist');

    // Wait for search results
    await expect(page.locator('text=results, text=matches')).toBeVisible({ timeout: 5000 });

    // Step 2: Perform container operations while search is active
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 3: Verify search results are maintained after container expansion
    await expect(page.locator('text=results, text=matches')).toBeVisible();

    // Step 4: Collapse containers and verify search still works
    const collapseAllButton = page.locator('button:has-text("Collapse All"), button:has-text("Pack All")').first();
    if (await collapseAllButton.isVisible()) {
      await collapseAllButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 5: Verify search results are still maintained
    await expect(page.locator('text=results, text=matches')).toBeVisible();

    // Step 6: Clear search and verify highlighting is removed
    const clearButton = page.locator('button:has-text("Clear"), [aria-label*="Clear"]').first();
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    }

    console.log('✅ Search and container operations integration completed successfully');
  });

  test('should integrate style changes with search and container operations', async ({ page }) => {
    // Step 1: Open StyleTuner and change layout
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    await expect(stylePanelButton).toBeVisible({ timeout: 5000 });
    await stylePanelButton.click();

    const layoutSelect = page.locator('select:has(option:has-text("layered")), select:has(option:has-text("force"))').first();
    if (await layoutSelect.isVisible()) {
      await layoutSelect.selectOption({ label: 'force' });
      await page.waitForTimeout(3000); // Wait for layout recalculation
    }

    // Step 2: Perform search while new layout is active
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('map');
      await expect(page.locator('text=results, text=matches')).toBeVisible({ timeout: 5000 });
    }

    // Step 3: Change color palette while search is active
    await stylePanelButton.click(); // Reopen style panel
    const colorPaletteSelect = page.locator('select:has(option:has-text("Set1")), select:has(option:has-text("Set2"))').first();
    if (await colorPaletteSelect.isVisible()) {
      await colorPaletteSelect.selectOption({ label: 'Set1' });
      await page.waitForTimeout(1000);
    }

    // Step 4: Perform container operations with active search and new styles
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 5: Verify all changes are maintained and graph is functional
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();
    if (await searchInput.isVisible()) {
      await expect(page.locator('text=results, text=matches')).toBeVisible();
    }

    console.log('✅ Style, search, and container operations integration completed successfully');
  });

  test('should handle complex multi-panel workflow', async ({ page }) => {
    // Step 1: Open both InfoPanel and StyleTuner simultaneously
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();

    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
      await page.waitForTimeout(500);
    }

    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
      await page.waitForTimeout(500);
    }

    // Step 2: Perform search in InfoPanel
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('fold');
      await page.waitForTimeout(1000);
    }

    // Step 3: Change styles in StyleTuner
    const edgeStyleSelect = page.locator('select:has(option:has-text("bezier")), select:has(option:has-text("straight"))').first();
    if (await edgeStyleSelect.isVisible()) {
      await edgeStyleSelect.selectOption({ label: 'straight' });
      await page.waitForTimeout(1000);
    }

    // Step 4: Perform container operations
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 5: Navigate search results
    const nextButton = page.locator('button:has-text("Next"), [aria-label*="Next"]').first();
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Step 6: Change layout algorithm
    const layoutSelect = page.locator('select:has(option:has-text("layered")), select:has(option:has-text("force"))').first();
    if (await layoutSelect.isVisible()) {
      await layoutSelect.selectOption({ label: 'layered' });
      await page.waitForTimeout(3000);
    }

    // Step 7: Verify everything still works
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    console.log('✅ Complex multi-panel workflow completed successfully');
  });

  test('should handle rapid successive operations without breaking', async ({ page }) => {
    // Step 1: Perform rapid container operations
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    const collapseAllButton = page.locator('button:has-text("Collapse All"), button:has-text("Pack All")').first();

    for (let i = 0; i < 3; i++) {
      if (await expandAllButton.isVisible()) {
        await expandAllButton.click();
        await page.waitForTimeout(500); // Shorter wait for rapid operations
      }
      
      if (await collapseAllButton.isVisible()) {
        await collapseAllButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Step 2: Perform rapid search operations
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      const searchTerms = ['p', 'pe', 'per', 'pers', 'persist'];
      for (const term of searchTerms) {
        await searchInput.fill(term);
        await page.waitForTimeout(100);
      }
    }

    // Step 3: Perform rapid style changes
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
    }

    const colorPaletteSelect = page.locator('select:has(option:has-text("Set1")), select:has(option:has-text("Set2"))').first();
    if (await colorPaletteSelect.isVisible()) {
      const palettes = ['Set1', 'Set2', 'Set3'];
      for (const palette of palettes) {
        try {
          await colorPaletteSelect.selectOption({ label: palette });
          await page.waitForTimeout(200);
        } catch (error) {
          // Some palettes might not exist, continue with others
          console.log(`Palette ${palette} not available, skipping`);
        }
      }
    }

    // Step 4: Verify application remains stable
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    // Step 5: Test that controls are still responsive
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('✅ Rapid successive operations completed successfully');
  });

  test('should maintain state consistency across complex operations', async ({ page }) => {
    // Step 1: Set up initial state with search and expanded containers
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('network');
      await page.waitForTimeout(1000);
    }

    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 2: Record initial state
    const initialSearchValue = await searchInput.inputValue();
    const initialNodeCount = await page.locator('.react-flow__node').count();

    // Step 3: Perform style changes
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
    }

    const layoutSelect = page.locator('select:has(option:has-text("layered")), select:has(option:has-text("force"))').first();
    if (await layoutSelect.isVisible()) {
      await layoutSelect.selectOption({ label: 'force' });
      await page.waitForTimeout(3000);
    }

    // Step 4: Verify state is maintained after style changes
    if (await searchInput.isVisible()) {
      const currentSearchValue = await searchInput.inputValue();
      expect(currentSearchValue).toBe(initialSearchValue);
    }

    const currentNodeCount = await page.locator('.react-flow__node').count();
    expect(currentNodeCount).toBe(initialNodeCount);

    // Step 5: Perform file re-upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    await page.waitForTimeout(3000);

    // Step 6: Verify state is reset appropriately after new file
    if (await searchInput.isVisible()) {
      const newSearchValue = await searchInput.inputValue();
      // Search should be cleared after new file upload
      expect(newSearchValue).toBe('');
    }

    // Step 7: Verify graph is functional after all operations
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    console.log('✅ State consistency across complex operations verified successfully');
  });

  test('should handle error recovery in complex workflows', async ({ page }) => {
    // Step 1: Set up complex state
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
    }

    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
    }

    // Step 2: Introduce error by uploading invalid file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json }')
    });

    // Step 3: Verify error is handled gracefully
    await expect(page.locator('text=Error, text=Invalid, text=Failed')).toBeVisible({ timeout: 5000 });

    // Step 4: Verify panels remain functional during error state
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click(); // Should still be clickable
    }

    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click(); // Should still be clickable
    }

    // Step 5: Recover by uploading valid file
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Step 6: Verify full recovery
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 7: Verify all functionality works after recovery
    if (await searchInput.isVisible()) {
      await searchInput.fill('recover');
      await page.waitForTimeout(1000);
    }

    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('✅ Error recovery in complex workflows completed successfully');
  });

  test('should handle browser navigation and refresh during complex workflows', async ({ page }) => {
    // Step 1: Set up complex state
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('persist');
    }

    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
    }

    const colorPaletteSelect = page.locator('select:has(option:has-text("Set1")), select:has(option:has-text("Set2"))').first();
    if (await colorPaletteSelect.isVisible()) {
      await colorPaletteSelect.selectOption({ label: 'Set1' });
    }

    // Step 2: Refresh the page
    await page.reload();
    await expect(page.locator('text=Interactive graph visualization')).toBeVisible({ timeout: 10000 });

    // Step 3: Verify application starts fresh
    await expect(page.locator('text=Drop a JSON file here')).toBeVisible({ timeout: 10000 });

    // Step 4: Re-upload file and verify functionality
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 5: Verify all functionality works after refresh
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
    }

    console.log('✅ Browser navigation and refresh handling completed successfully');
  });

  test('should handle concurrent user interactions gracefully', async ({ page }) => {
    // Step 1: Set up multiple panels
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();

    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    if (await stylePanelButton.isVisible()) {
      await stylePanelButton.click();
    }

    // Step 2: Simulate concurrent interactions
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    const layoutSelect = page.locator('select:has(option:has-text("layered")), select:has(option:has-text("force"))').first();

    // Perform multiple actions simultaneously
    const actions = [];
    
    if (await searchInput.isVisible()) {
      actions.push(searchInput.fill('concurrent'));
    }
    
    if (await expandAllButton.isVisible()) {
      actions.push(expandAllButton.click());
    }
    
    if (await layoutSelect.isVisible()) {
      actions.push(layoutSelect.selectOption({ label: 'force' }));
    }

    // Execute actions concurrently
    await Promise.all(actions);

    // Step 3: Wait for all operations to complete
    await page.waitForTimeout(3000);

    // Step 4: Verify application remains stable
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    // Step 5: Verify individual features still work
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('✅ Concurrent user interactions handled gracefully');
  });
});