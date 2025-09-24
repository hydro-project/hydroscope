import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Playwright Test: Container expand/collapse interactions in browser
 * 
 * Requirements: 8.1, 8.2, 8.4
 * - Write Playwright test for expand all button functionality
 * - Write Playwright test for collapse all button functionality
 * - Verify that container state changes are reflected visually
 * - Test that node counts change correctly when containers expand/collapse
 */

test.describe('Container Expand/Collapse Interactions', () => {
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
    
    // Verify controls are enabled
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeEnabled();
  });

  test('should expand all containers when expand all button is clicked', async ({ page }) => {
    // Get initial node count (containers should be collapsed by default)
    const initialNodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const initialNodes = parseInt(initialNodeCount || '0');

    // Click expand all button
    await page.locator('[data-testid="expand-all-button"]').click();

    // Wait for status message
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    // Get new node count after expansion
    const expandedNodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const expandedNodes = parseInt(expandedNodeCount || '0');

    // Node count should increase when containers are expanded (showing internal nodes)
    expect(expandedNodes).toBeGreaterThan(initialNodes);

    // Verify visual feedback in graph container
    await expect(page.locator('[data-testid="graph-container"]')).toContainText('Graph Loaded Successfully');
    await expect(page.locator('[data-testid="graph-container"]')).toContainText(`${expandedNodes} visible nodes`);
  });

  test('should collapse all containers when collapse all button is clicked', async ({ page }) => {
    // First expand all containers
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    // Get expanded node count
    const expandedNodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const expandedNodes = parseInt(expandedNodeCount || '0');

    // Click collapse all button
    await page.locator('[data-testid="collapse-all-button"]').click();

    // Wait for status message
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');

    // Get new node count after collapse
    const collapsedNodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const collapsedNodes = parseInt(collapsedNodeCount || '0');

    // Node count should decrease when containers are collapsed (hiding internal nodes)
    expect(collapsedNodes).toBeLessThan(expandedNodes);

    // Verify visual feedback in graph container
    await expect(page.locator('[data-testid="graph-container"]')).toContainText('Graph Loaded Successfully');
    await expect(page.locator('[data-testid="graph-container"]')).toContainText(`${collapsedNodes} visible nodes`);
  });

  test('should reflect container state changes visually in the graph', async ({ page }) => {
    // Initial state - containers should be collapsed
    const initialGraphText = await page.locator('[data-testid="graph-container"]').textContent();
    expect(initialGraphText).toContain('Graph Loaded Successfully');

    // Expand all containers
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    // Verify graph shows expanded state
    const expandedGraphText = await page.locator('[data-testid="graph-container"]').textContent();
    expect(expandedGraphText).toContain('visible nodes');
    
    // The graph should show different node counts
    const expandedMatch = expandedGraphText.match(/(\d+) visible nodes/);
    expect(expandedMatch).not.toBeNull();
    const expandedVisibleNodes = parseInt(expandedMatch![1]);

    // Collapse all containers
    await page.locator('[data-testid="collapse-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');

    // Verify graph shows collapsed state
    const collapsedGraphText = await page.locator('[data-testid="graph-container"]').textContent();
    const collapsedMatch = collapsedGraphText.match(/(\d+) visible nodes/);
    expect(collapsedMatch).not.toBeNull();
    const collapsedVisibleNodes = parseInt(collapsedMatch![1]);

    // Collapsed state should show fewer visible nodes
    expect(collapsedVisibleNodes).toBeLessThan(expandedVisibleNodes);
  });

  test('should update node counts correctly during expand/collapse operations', async ({ page }) => {
    // Record initial counts
    const initialNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    const edgeCount = parseInt(await page.locator('[data-testid="edge-count"]').textContent() || '0');
    const containerCount = parseInt(await page.locator('[data-testid="container-count"]').textContent() || '0');

    // Edge and container counts should remain constant
    expect(edgeCount).toBeGreaterThan(0);
    expect(containerCount).toBeGreaterThan(0);

    // Expand all containers
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    // Check counts after expansion
    const expandedNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    const expandedEdgeCount = parseInt(await page.locator('[data-testid="edge-count"]').textContent() || '0');
    const expandedContainerCount = parseInt(await page.locator('[data-testid="container-count"]').textContent() || '0');

    // Node count should increase, others should stay the same
    expect(expandedNodeCount).toBeGreaterThan(initialNodeCount);
    expect(expandedEdgeCount).toBe(edgeCount);
    expect(expandedContainerCount).toBe(containerCount);

    // Collapse all containers
    await page.locator('[data-testid="collapse-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');

    // Check counts after collapse
    const collapsedNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    const collapsedEdgeCount = parseInt(await page.locator('[data-testid="edge-count"]').textContent() || '0');
    const collapsedContainerCount = parseInt(await page.locator('[data-testid="container-count"]').textContent() || '0');

    // Should return to initial state
    expect(collapsedNodeCount).toBe(initialNodeCount);
    expect(collapsedEdgeCount).toBe(edgeCount);
    expect(collapsedContainerCount).toBe(containerCount);
  });

  test('should handle rapid expand/collapse operations correctly', async ({ page }) => {
    // Perform rapid expand/collapse operations
    for (let i = 0; i < 3; i++) {
      // Expand
      await page.locator('[data-testid="expand-all-button"]').click();
      await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');
      
      // Verify expansion worked
      const expandedCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
      expect(expandedCount).toBeGreaterThan(0);

      // Collapse
      await page.locator('[data-testid="collapse-all-button"]').click();
      await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');
      
      // Verify collapse worked
      const collapsedCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
      expect(collapsedCount).toBeGreaterThan(0);
      expect(collapsedCount).toBeLessThan(expandedCount);
    }

    // Application should remain responsive
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="search-input"]')).toBeEnabled();
  });

  test('should maintain consistent state across multiple operations', async ({ page }) => {
    // Record baseline counts
    const baselineNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    
    // Perform multiple expand/collapse cycles
    for (let cycle = 0; cycle < 2; cycle++) {
      // Expand
      await page.locator('[data-testid="expand-all-button"]').click();
      await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');
      
      const expandedCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
      expect(expandedCount).toBeGreaterThan(baselineNodeCount);

      // Collapse back
      await page.locator('[data-testid="collapse-all-button"]').click();
      await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');
      
      const collapsedCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
      expect(collapsedCount).toBe(baselineNodeCount);
    }

    // Final state should match initial state
    const finalNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    expect(finalNodeCount).toBe(baselineNodeCount);
  });

  test('should show appropriate status messages during operations', async ({ page }) => {
    // Test expand operation status
    await page.locator('[data-testid="expand-all-button"]').click();
    
    // Should show success status
    const statusElement = page.locator('[data-testid="status"]');
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toContainText('All containers expanded');
    await expect(statusElement).toHaveClass(/success/);

    // Status should disappear after a few seconds
    await expect(statusElement).toHaveClass(/hidden/, { timeout: 5000 });

    // Test collapse operation status
    await page.locator('[data-testid="collapse-all-button"]').click();
    
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toContainText('All containers collapsed');
    await expect(statusElement).toHaveClass(/success/);

    // Status should disappear after a few seconds
    await expect(statusElement).toHaveClass(/hidden/, { timeout: 5000 });
  });

  test('should handle container operations with no containers gracefully', async ({ page }) => {
    // Load empty data instead of paxos.json
    const emptyData = { nodes: [], edges: [] };
    
    // Navigate to fresh page
    await page.goto('/e2e/test-app.html');
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();

    // Load empty data
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(emptyData))
    });

    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Verify no containers
    await expect(page.locator('[data-testid="container-count"]')).toHaveText('0');

    // Buttons should still work but do nothing
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    await page.locator('[data-testid="collapse-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers collapsed');

    // Counts should remain 0
    await expect(page.locator('[data-testid="node-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="container-count"]')).toHaveText('0');
  });

  test('should verify container hierarchy is properly displayed', async ({ page }) => {
    // Verify initial collapsed state shows containers
    const containerCount = parseInt(await page.locator('[data-testid="container-count"]').textContent() || '0');
    expect(containerCount).toBeGreaterThan(0);

    // Graph should show container information
    await expect(page.locator('[data-testid="graph-container"]')).toContainText(`${containerCount} containers`);

    // Expand all to see hierarchy
    await page.locator('[data-testid="expand-all-button"]').click();
    await expect(page.locator('[data-testid="status"]')).toContainText('All containers expanded');

    // Container count should remain the same
    const expandedContainerCount = parseInt(await page.locator('[data-testid="container-count"]').textContent() || '0');
    expect(expandedContainerCount).toBe(containerCount);

    // But visible nodes should increase
    const expandedNodeCount = parseInt(await page.locator('[data-testid="node-count"]').textContent() || '0');
    expect(expandedNodeCount).toBeGreaterThan(containerCount);

    // Graph should still show container information
    await expect(page.locator('[data-testid="graph-container"]')).toContainText(`${containerCount} containers`);
  });
});