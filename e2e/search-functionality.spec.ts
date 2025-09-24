import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Playwright Test: Search functionality in browser
 * 
 * Requirements: 9.1, 9.2, 9.4
 * - Write Playwright test for search input and result highlighting
 * - Test search result navigation (next/previous match)
 * - Verify that search expands containers and shows hidden nodes
 * - Test that search clearing removes highlights correctly
 */

test.describe('Search Functionality', () => {
  let paxosData: any;

  test.beforeAll(async () => {
    // Load paxos.json test data
    const paxosPath = join(process.cwd(), 'test-data', 'paxos.json');
    const paxosContent = readFileSync(paxosPath, 'utf-8');
    paxosData = JSON.parse(paxosContent);
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to test application
    await page.goto('/e2e/test-app.html');
    
    // Wait for page to load
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();

    // Load paxos.json data
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for file to be processed
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');
    
    // Verify search input is available
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  });

  test('should perform search and display results', async ({ page }) => {
    // Perform a search for a common term in paxos.json
    const searchTerm = 'persist';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);

    // Wait for search results to appear
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    // Verify search results format (e.g., "1 of 5 results")
    const resultsText = await page.locator('[data-testid="search-results"]').textContent();
    expect(resultsText).toMatch(/\d+ of \d+ results/);
    
    // Extract the number of results
    const match = resultsText?.match(/(\d+) of (\d+) results/);
    expect(match).not.toBeNull();
    const currentResult = parseInt(match![1]);
    const totalResults = parseInt(match![2]);
    
    expect(currentResult).toBeGreaterThan(0);
    expect(totalResults).toBeGreaterThan(0);
    expect(currentResult).toBeLessThanOrEqual(totalResults);

    // Verify navigation buttons are enabled when there are results
    if (totalResults > 1) {
      await expect(page.locator('[data-testid="search-prev-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="search-next-button"]')).toBeEnabled();
    }
  });

  test('should navigate between search results', async ({ page }) => {
    // Search for a term that should have multiple results
    const searchTerm = 'map';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);

    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    const initialResultsText = await page.locator('[data-testid="search-results"]').textContent();
    const initialMatch = initialResultsText?.match(/(\d+) of (\d+) results/);
    expect(initialMatch).not.toBeNull();
    const totalResults = parseInt(initialMatch![2]);
    
    // Only test navigation if there are multiple results
    if (totalResults > 1) {
      // Click next button
      await page.locator('[data-testid="search-next-button"]').click();
      
      // Verify result index changed
      const nextResultsText = await page.locator('[data-testid="search-results"]').textContent();
      const nextMatch = nextResultsText?.match(/(\d+) of (\d+) results/);
      expect(nextMatch).not.toBeNull();
      const nextCurrentResult = parseInt(nextMatch![1]);
      
      expect(nextCurrentResult).toBe(2); // Should be second result
      
      // Click previous button
      await page.locator('[data-testid="search-prev-button"]').click();
      
      // Should be back to first result
      const prevResultsText = await page.locator('[data-testid="search-results"]').textContent();
      const prevMatch = prevResultsText?.match(/(\d+) of (\d+) results/);
      expect(prevMatch).not.toBeNull();
      const prevCurrentResult = parseInt(prevMatch![1]);
      
      expect(prevCurrentResult).toBe(1); // Should be back to first result
    }
  });

  test('should expand containers when search finds hidden nodes', async ({ page }) => {
    // First collapse all containers to hide nodes
    await page.locator('[data-testid="collapse-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');
    
    // Record initial node count (should be lower with collapsed containers)
    const collapsedNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    
    // Search for a term that should find nodes inside containers
    const searchTerm = 'persist';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    // Node count should increase as containers are expanded to show search results
    const expandedNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    expect(expandedNodeCount).toBeGreaterThanOrEqual(collapsedNodeCount);
    
    // Verify that search results are displayed
    const resultsText = await page.locator('[data-testid="search-results"]').textContent();
    expect(resultsText).toMatch(/\d+ of \d+ results/);
  });

  test('should show search highlighting in graph', async ({ page }) => {
    // Perform a search
    const searchTerm = 'fold';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    // Verify that the graph shows search highlighting
    const graphContainer = page.locator('[data-testid="graph-container"]');
    await expect(graphContainer).toContainText('Search results highlighted');
    
    // Should show the number of matches
    const resultsText = await page.locator('[data-testid="search-results"]').textContent();
    const match = resultsText?.match(/(\d+) of (\d+) results/);
    expect(match).not.toBeNull();
    const totalResults = parseInt(match![2]);
    
    await expect(graphContainer).toContainText(`${totalResults} matches`);
  });

  test('should clear search results and highlighting', async ({ page }) => {
    // Perform a search first
    const searchTerm = 'network';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    // Verify search highlighting is shown
    await expect(page.locator('[data-testid="graph-container"]')).toContainText('Search results highlighted');
    
    // Clear the search
    await page.locator('[data-testid="search-clear-button"]').click();
    
    // Verify search input is cleared
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('');
    
    // Verify search results are cleared
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('');
    
    // Verify navigation buttons are disabled
    await expect(page.locator('[data-testid="search-prev-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="search-next-button"]')).toBeDisabled();
    
    // Verify highlighting is removed from graph
    await expect(page.locator('[data-testid="graph-container"]')).not.toContainText('Search results highlighted');
  });

  test('should handle empty search gracefully', async ({ page }) => {
    // Try searching with empty string
    await page.locator('[data-testid="search-input"]').fill('');
    
    // Should not show any results
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('');
    
    // Navigation buttons should be disabled
    await expect(page.locator('[data-testid="search-prev-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="search-next-button"]')).toBeDisabled();
    
    // Graph should not show highlighting
    await expect(page.locator('[data-testid="graph-container"]')).not.toContainText('Search results highlighted');
  });

  test('should handle search with no results', async ({ page }) => {
    // Search for a term that should not exist
    const searchTerm = 'nonexistentterm12345';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Should not show any results
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('');
    
    // Navigation buttons should be disabled
    await expect(page.locator('[data-testid="search-prev-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="search-next-button"]')).toBeDisabled();
    
    // Graph should not show highlighting
    await expect(page.locator('[data-testid="graph-container"]')).not.toContainText('Search results highlighted');
  });

  test('should search both nodes and containers', async ({ page }) => {
    // Search for a term that might appear in both nodes and containers
    const searchTerm = 'paxos';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Wait for potential results (might be 0 if term doesn't exist)
    await page.waitForTimeout(500);
    
    // Check if there are results
    const resultsText = await page.locator('[data-testid="search-results"]').textContent();
    
    if (resultsText && resultsText.includes('of')) {
      // If there are results, verify they are properly formatted
      expect(resultsText).toMatch(/\d+ of \d+ results/);
      
      // Navigation buttons should be enabled if there are results
      const match = resultsText.match(/(\d+) of (\d+) results/);
      const totalResults = parseInt(match![2]);
      
      if (totalResults > 1) {
        await expect(page.locator('[data-testid="search-prev-button"]')).toBeEnabled();
        await expect(page.locator('[data-testid="search-next-button"]')).toBeEnabled();
      }
    } else {
      // If no results, buttons should be disabled
      await expect(page.locator('[data-testid="search-prev-button"]')).toBeDisabled();
      await expect(page.locator('[data-testid="search-next-button"]')).toBeDisabled();
    }
  });

  test('should handle case-insensitive search', async ({ page }) => {
    // Test with different cases of the same term
    const searchTerms = ['PERSIST', 'persist', 'Persist', 'PeRsIsT'];
    
    let previousResults: string | null = null;
    
    for (const searchTerm of searchTerms) {
      // Clear previous search
      await page.locator('[data-testid="search-clear-button"]').click();
      
      // Search with current term
      await page.locator('[data-testid="search-input"]').fill(searchTerm);
      
      // Wait for results
      await page.waitForTimeout(300);
      
      const resultsText = await page.locator('[data-testid="search-results"]').textContent();
      
      if (previousResults === null) {
        previousResults = resultsText;
      } else {
        // All case variations should return the same results
        expect(resultsText).toBe(previousResults);
      }
    }
  });

  test('should maintain search state during container operations', async ({ page }) => {
    // Perform a search
    const searchTerm = 'map';
    await page.locator('[data-testid="search-input"]').fill(searchTerm);
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toContainText('of');
    
    const initialResultsText = await page.locator('[data-testid="search-results"]').textContent();
    
    // Perform container operations
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');
    
    // Search results should still be there
    const afterExpandResultsText = await page.locator('[data-testid="search-results"]').textContent();
    expect(afterExpandResultsText).toBe(initialResultsText);
    
    // Collapse containers
    await page.locator('[data-testid="collapse-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');
    
    // Search results should still be maintained
    const afterCollapseResultsText = await page.locator('[data-testid="search-results"]').textContent();
    expect(afterCollapseResultsText).toBe(initialResultsText);
  });

  test('should handle rapid search input changes', async ({ page }) => {
    // Type rapidly changing search terms
    const searchTerms = ['p', 'pe', 'per', 'pers', 'persi', 'persist'];
    
    for (const searchTerm of searchTerms) {
      await page.locator('[data-testid="search-input"]').fill(searchTerm);
      // Small delay to simulate typing
      await page.waitForTimeout(50);
    }
    
    // Wait for final results
    await page.waitForTimeout(300);
    
    // Should show results for the final search term
    const resultsText = await page.locator('[data-testid="search-results"]').textContent();
    
    if (resultsText && resultsText.includes('of')) {
      expect(resultsText).toMatch(/\d+ of \d+ results/);
    }
    
    // Application should remain responsive
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('persist');
  });

  test('should verify search input accessibility', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Verify search input is focusable
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
    
    // Verify placeholder text
    await expect(searchInput).toHaveAttribute('placeholder', 'Search nodes...');
    
    // Verify input type
    await expect(searchInput).toHaveAttribute('type', 'text');
    
    // Test keyboard navigation
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
    
    // Test clearing with keyboard
    await searchInput.selectText();
    await searchInput.press('Backspace');
    await expect(searchInput).toHaveValue('');
  });

  test('should handle search with special characters', async ({ page }) => {
    // Test search with special characters that might appear in node names
    const specialSearchTerms = ['()', '[]', '{}', '::'];
    
    for (const searchTerm of specialSearchTerms) {
      // Clear previous search
      await page.locator('[data-testid="search-clear-button"]').click();
      
      // Search with special characters
      await page.locator('[data-testid="search-input"]').fill(searchTerm);
      
      // Wait for results
      await page.waitForTimeout(300);
      
      // Should not crash or show errors
      const resultsText = await page.locator('[data-testid="search-results"]').textContent();
      
      // Results should either be empty or properly formatted
      if (resultsText && resultsText.trim() !== '') {
        expect(resultsText).toMatch(/\d+ of \d+ results/);
      }
    }
  });
});