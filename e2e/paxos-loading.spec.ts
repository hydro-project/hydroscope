import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Playwright Test: Browser-based paxos.json loading tests
 * 
 * Requirements: 7.3, 6.3
 * - Write Playwright test that loads paxos.json in browser
 * - Verify visual rendering matches expected container structure
 * - Test that all nodes and edges are visible and positioned correctly
 * - Validate that container hierarchy is displayed properly
 */

test.describe('Paxos.json Loading Tests', () => {
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
  });

  test('should load paxos.json file successfully', async ({ page }) => {
    // Verify initial state
    await expect(page.locator('[data-testid="node-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="edge-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="container-count"]')).toHaveText('0');

    // Create a file input with paxos.json data
    const paxosContent = JSON.stringify(paxosData);
    
    // Upload the file
    const fileInput = page.locator('[data-testid="file-input"]');
    
    // Create a temporary file for upload
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for file to be processed
    await expect(page.locator('[data-testid="status"]')).toContainText('Loaded paxos.json successfully');

    // Verify that data was loaded
    const nodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const edgeCount = await page.locator('[data-testid="edge-count"]').textContent();
    const containerCount = await page.locator('[data-testid="container-count"]').textContent();

    // Verify counts match expected values from paxos.json
    expect(parseInt(nodeCount || '0')).toBeGreaterThan(0);
    expect(parseInt(edgeCount || '0')).toBeGreaterThan(0);
    
    // Verify that controls are enabled after loading
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeEnabled();
  });

  test('should display correct node and edge counts from paxos.json', async ({ page }) => {
    // Upload paxos.json
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Get actual counts from the data
    const expectedNodeCount = paxosData.nodes?.length || 0;
    const expectedEdgeCount = paxosData.edges?.length || 0;

    // Verify displayed counts
    const displayedNodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const displayedEdgeCount = await page.locator('[data-testid="edge-count"]').textContent();

    // Note: The visible node count might be different due to container collapsing
    // but should be reasonable (not 0 and not more than total)
    const visibleNodes = parseInt(displayedNodeCount || '0');
    const visibleEdges = parseInt(displayedEdgeCount || '0');

    expect(visibleNodes).toBeGreaterThan(0);
    expect(visibleNodes).toBeLessThanOrEqual(expectedNodeCount + 100); // Allow for containers as nodes
    expect(visibleEdges).toBe(expectedEdgeCount);
  });

  test('should display container hierarchy from paxos.json', async ({ page }) => {
    // Upload paxos.json
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Verify container count is displayed
    const containerCount = await page.locator('[data-testid="container-count"]').textContent();
    const numContainers = parseInt(containerCount || '0');

    // Should have containers if hierarchy choices exist
    if (paxosData.hierarchyChoices && paxosData.nodeAssignments) {
      expect(numContainers).toBeGreaterThan(0);
    }

    // Verify graph container shows loaded state
    await expect(page.locator('[data-testid="graph-container"]')).toContainText('Graph Loaded Successfully');
    
    // Verify the graph shows container information
    if (numContainers > 0) {
      await expect(page.locator('[data-testid="graph-container"]')).toContainText(`${numContainers} containers`);
    }
  });

  test('should handle visual rendering of loaded graph', async ({ page }) => {
    // Upload paxos.json
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Verify graph container shows the loaded graph
    const graphContainer = page.locator('[data-testid="graph-container"]');
    
    // Should no longer show the "Load a JSON file" message
    await expect(graphContainer).not.toContainText('Load a JSON file to view the graph');
    
    // Should show success message
    await expect(graphContainer).toContainText('Graph Loaded Successfully');
    
    // Should show node and edge counts in the graph display
    await expect(graphContainer).toContainText('visible nodes');
    await expect(graphContainer).toContainText('edges');
    
    // Verify the graph container has proper dimensions
    const boundingBox = await graphContainer.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(500);
    expect(boundingBox!.height).toBeGreaterThan(400);
  });

  test('should validate paxos.json structure and content', async ({ page }) => {
    // Upload paxos.json
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Verify that the data structure is valid
    expect(paxosData).toHaveProperty('nodes');
    expect(paxosData).toHaveProperty('edges');
    expect(Array.isArray(paxosData.nodes)).toBe(true);
    expect(Array.isArray(paxosData.edges)).toBe(true);

    // Verify nodes have required properties
    if (paxosData.nodes.length > 0) {
      const firstNode = paxosData.nodes[0];
      expect(firstNode).toHaveProperty('id');
      // Should have either shortLabel, fullLabel, or both
      expect(
        firstNode.shortLabel || firstNode.fullLabel || firstNode.id
      ).toBeTruthy();
    }

    // Verify edges have required properties
    if (paxosData.edges.length > 0) {
      const firstEdge = paxosData.edges[0];
      expect(firstEdge).toHaveProperty('id');
      expect(firstEdge).toHaveProperty('source');
      expect(firstEdge).toHaveProperty('target');
    }

    // Verify hierarchy structure if present
    if (paxosData.hierarchyChoices) {
      expect(Array.isArray(paxosData.hierarchyChoices)).toBe(true);
      if (paxosData.hierarchyChoices.length > 0) {
        expect(paxosData).toHaveProperty('nodeAssignments');
      }
    }
  });

  test('should handle large paxos.json file efficiently', async ({ page }) => {
    const startTime = Date.now();

    // Upload paxos.json
    const paxosContent = JSON.stringify(paxosData);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(paxosContent)
    });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load within reasonable time (less than 10 seconds for large files)
    expect(loadTime).toBeLessThan(10000);

    // Verify the application remains responsive
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="search-input"]')).toBeEnabled();

    // Verify counts are displayed correctly
    const nodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const edgeCount = await page.locator('[data-testid="edge-count"]').textContent();

    expect(parseInt(nodeCount || '0')).toBeGreaterThan(0);
    expect(parseInt(edgeCount || '0')).toBeGreaterThan(0);
  });

  test('should handle invalid JSON gracefully', async ({ page }) => {
    // Upload invalid JSON
    const invalidJson = '{ "nodes": [invalid json}';
    
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidJson)
    });

    // Should show error status
    await expect(page.locator('[data-testid="status"]')).toContainText('Invalid JSON file');

    // Counts should remain at 0
    await expect(page.locator('[data-testid="node-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="edge-count"]')).toHaveText('0');

    // Controls should remain disabled
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeDisabled();
  });

  test('should handle empty JSON file', async ({ page }) => {
    // Upload empty JSON
    const emptyJson = '{}';
    
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from(emptyJson)
    });

    // Should load successfully but with 0 counts
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully');

    // Counts should be 0
    await expect(page.locator('[data-testid="node-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="edge-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="container-count"]')).toHaveText('0');

    // Controls should be enabled but won't do anything
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeEnabled();
  });
});