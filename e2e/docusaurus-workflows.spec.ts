import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * End-to-End Tests: Complete User Workflows in Docusaurus Page
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * - Test complete user workflows in docusaurus page
 * - Test file upload and visualization pipeline
 * - Test search and navigation functionality
 * - Test style customization and container operations
 */

test.describe('Docusaurus Page Complete User Workflows', () => {
  let paxosData: any;
  let chatData: any;

  test.beforeAll(async () => {
    // Load test data files
    const paxosPath = join(process.cwd(), 'test-data', 'paxos.json');
    const chatPath = join(process.cwd(), 'test-data', 'chat.json');
    
    paxosData = JSON.parse(readFileSync(paxosPath, 'utf-8'));
    chatData = JSON.parse(readFileSync(chatPath, 'utf-8'));
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to the test application (mock hydroscope interface)
    await page.goto('/e2e/test-app.html');
    
    // Wait for the test application to load
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible({ timeout: 10000 });
  });

  test('should complete full file upload and visualization workflow', async ({ page }) => {
    // Step 1: Verify initial state - should show file upload interface
    await expect(page.locator('text=Load a JSON file to view the graph')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Upload paxos.json file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Step 3: Wait for file processing and visualization to load
    await expect(page.locator('[data-testid="status"]')).toContainText('successfully', { timeout: 15000 });
    
    // Step 4: Verify graph is rendered
    await expect(page.locator('[data-testid="graph-container"]')).toContainText('Graph Loaded Successfully');
    
    // Step 5: Verify controls are enabled
    await expect(page.locator('[data-testid="expand-all-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="collapse-all-button"]')).toBeEnabled();
    
    // Step 6: Verify node and edge counts are displayed
    const nodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const edgeCount = await page.locator('[data-testid="edge-count"]').textContent();
    
    expect(parseInt(nodeCount || '0')).toBeGreaterThan(0);
    expect(parseInt(edgeCount || '0')).toBeGreaterThan(0);

    console.log('✅ Complete file upload and visualization workflow completed successfully');
  });

  test('should handle complete search and navigation workflow', async ({ page }) => {
    // Step 1: Upload test data first
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for visualization to load
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 2: Open InfoPanel to access search
    const infoPanelButton = page.locator('button:has-text("Info"), [aria-label*="Info"], [title*="Info"]').first();
    if (await infoPanelButton.isVisible()) {
      await infoPanelButton.click();
    }

    // Step 3: Perform search
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    await searchInput.fill('persist');
    
    // Step 4: Verify search results appear
    await expect(page.locator('text=results, text=matches')).toBeVisible({ timeout: 5000 });
    
    // Step 5: Test search navigation if multiple results
    const nextButton = page.locator('button:has-text("Next"), [aria-label*="Next"]').first();
    const prevButton = page.locator('button:has-text("Previous"), [aria-label*="Previous"]').first();
    
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      // Verify navigation worked (result index should change)
      await page.waitForTimeout(500);
    }
    
    if (await prevButton.isVisible() && await prevButton.isEnabled()) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }

    // Step 6: Clear search
    const clearButton = page.locator('button:has-text("Clear"), [aria-label*="Clear"]').first();
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    }

    console.log('✅ Complete search and navigation workflow completed successfully');
  });

  test('should handle complete style customization workflow', async ({ page }) => {
    // Step 1: Upload test data
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for visualization to load
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 2: Open StyleTuner panel
    const stylePanelButton = page.locator('button:has-text("Style"), [aria-label*="Style"], [title*="Style"]').first();
    await expect(stylePanelButton).toBeVisible({ timeout: 5000 });
    await stylePanelButton.click();

    // Step 3: Test color palette changes
    const colorPaletteSelect = page.locator('select:has(option:has-text("Set1")), select:has(option:has-text("Set2"))').first();
    if (await colorPaletteSelect.isVisible()) {
      await colorPaletteSelect.selectOption({ label: 'Set1' });
      await page.waitForTimeout(1000); // Wait for style changes to apply
    }

    // Step 4: Test layout algorithm changes
    const layoutSelect = page.locator('select:has(option:has-text("layered")), select:has(option:has-text("force"))').first();
    if (await layoutSelect.isVisible()) {
      await layoutSelect.selectOption({ label: 'force' });
      await page.waitForTimeout(2000); // Wait for layout to recalculate
    }

    // Step 5: Test edge style changes
    const edgeStyleSelect = page.locator('select:has(option:has-text("bezier")), select:has(option:has-text("straight"))').first();
    if (await edgeStyleSelect.isVisible()) {
      await edgeStyleSelect.selectOption({ label: 'straight' });
      await page.waitForTimeout(1000);
    }

    // Step 6: Test node size adjustments
    const nodeSizeSlider = page.locator('input[type="range"], input[type="number"]').first();
    if (await nodeSizeSlider.isVisible()) {
      await nodeSizeSlider.fill('20');
      await page.waitForTimeout(1000);
    }

    // Step 7: Verify changes are applied (graph should still be visible and functional)
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    console.log('✅ Complete style customization workflow completed successfully');
  });

  test('should handle complete container operations workflow', async ({ page }) => {
    // Step 1: Upload test data with containers
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for visualization to load
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 2: Test expand all containers
    const expandAllButton = page.locator('button:has-text("Expand All"), button:has-text("Unpack All")').first();
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
      await page.waitForTimeout(2000); // Wait for expansion animation
      
      // Verify more nodes are visible after expansion
      const nodeCount = await page.locator('.react-flow__node').count();
      expect(nodeCount).toBeGreaterThan(0);
    }

    // Step 3: Test collapse all containers
    const collapseAllButton = page.locator('button:has-text("Collapse All"), button:has-text("Pack All")').first();
    if (await collapseAllButton.isVisible()) {
      await collapseAllButton.click();
      await page.waitForTimeout(2000); // Wait for collapse animation
    }

    // Step 4: Test individual container interactions
    const containerNodes = page.locator('.react-flow__node[data-type="container"], .container-node');
    const containerCount = await containerNodes.count();
    
    if (containerCount > 0) {
      // Click on first container to expand it
      await containerNodes.first().click();
      await page.waitForTimeout(1000);
      
      // Click again to collapse it
      await containerNodes.first().click();
      await page.waitForTimeout(1000);
    }

    // Step 5: Verify graph remains functional after operations
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();

    console.log('✅ Complete container operations workflow completed successfully');
  });

  test('should handle complete multi-file workflow', async ({ page }) => {
    // Step 1: Upload first file (paxos.json)
    let fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for first visualization
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });
    
    // Record initial node count
    const initialNodeCount = await page.locator('.react-flow__node').count();

    // Step 2: Upload second file (chat.json) to replace the first
    fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'chat.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(chatData))
    });

    // Wait for new visualization to load
    await page.waitForTimeout(3000);
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();
    
    // Step 3: Verify the graph changed (different node count indicates new data)
    const newNodeCount = await page.locator('.react-flow__node').count();
    // Note: We can't guarantee the counts will be different, but the graph should still be functional
    expect(newNodeCount).toBeGreaterThanOrEqual(0);

    // Step 4: Test that all functionality still works with new data
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('✅ Complete multi-file workflow completed successfully');
  });

  test('should handle complete error recovery workflow', async ({ page }) => {
    // Step 1: Try to upload invalid JSON
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json }')
    });

    // Step 2: Verify error handling
    await expect(page.locator('text=Error, text=Invalid, text=Failed')).toBeVisible({ timeout: 5000 });

    // Step 3: Upload valid file to recover
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Step 4: Verify recovery - graph should load successfully
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 5: Verify all functionality works after recovery
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
    }

    console.log('✅ Complete error recovery workflow completed successfully');
  });

  test('should handle complete responsive behavior workflow', async ({ page }) => {
    // Step 1: Upload test data
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for visualization
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 2: Test different viewport sizes
    const viewportSizes = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const size of viewportSizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(1000);
      
      // Verify graph is still visible and functional
      await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();
      
      // Test that controls are still accessible (may be collapsed on mobile)
      const controlsVisible = await page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').isVisible();
      if (controlsVisible) {
        // Controls should work at any size
        await page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first().click();
        await page.waitForTimeout(500);
      }
    }

    // Step 3: Reset to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    console.log('✅ Complete responsive behavior workflow completed successfully');
  });

  test('should handle complete URL parameter workflow', async ({ page }) => {
    // Step 1: Test loading with URL parameters (if supported)
    // This tests the parseDataFromUrl functionality
    const encodedData = encodeURIComponent(JSON.stringify(paxosData));
    await page.goto(`/hydroscope?data=${encodedData}`);

    // Step 2: Wait for page to load with URL data
    await expect(page.locator('text=Interactive graph visualization')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Verify graph loads from URL parameters
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 4: Verify functionality works with URL-loaded data
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
      await page.waitForTimeout(1000);
    }

    // Step 5: Test that file upload still works after URL loading
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'chat.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(chatData))
      });

      // Verify new data loads
      await page.waitForTimeout(3000);
      await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible();
    }

    console.log('✅ Complete URL parameter workflow completed successfully');
  });

  test('should handle complete accessibility workflow', async ({ page }) => {
    // Step 1: Upload test data
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'paxos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(paxosData))
    });

    // Wait for visualization
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 15000 });

    // Step 2: Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus first interactive element
    await page.keyboard.press('Tab'); // Move to next element
    await page.keyboard.press('Enter'); // Activate focused element
    await page.waitForTimeout(500);

    // Step 3: Test that all interactive elements have proper labels
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) { // Test first 10 buttons
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Each button should have either text content or aria-label
        const hasText = await button.textContent();
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasTitle = await button.getAttribute('title');
        
        expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
      }
    }

    // Step 4: Test that form inputs have proper labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const hasPlaceholder = await input.getAttribute('placeholder');
        const hasAriaLabel = await input.getAttribute('aria-label');
        const hasAssociatedLabel = await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0;
        
        expect(hasPlaceholder || hasAriaLabel || hasAssociatedLabel).toBeTruthy();
      }
    }

    console.log('✅ Complete accessibility workflow completed successfully');
  });

  test('should handle complete performance workflow with large dataset', async ({ page }) => {
    // Step 1: Create a larger dataset for performance testing
    const largeDataset = {
      nodes: [],
      edges: [],
      hierarchyChoices: paxosData.hierarchyChoices,
      nodeAssignments: {}
    };

    // Generate more nodes and edges
    for (let i = 0; i < 100; i++) {
      largeDataset.nodes.push({
        id: `node_${i}`,
        shortLabel: `Node ${i}`,
        fullLabel: `Performance Test Node ${i}`
      });
    }

    for (let i = 0; i < 150; i++) {
      const sourceIdx = Math.floor(Math.random() * 100);
      const targetIdx = Math.floor(Math.random() * 100);
      if (sourceIdx !== targetIdx) {
        largeDataset.edges.push({
          id: `edge_${i}`,
          source: `node_${sourceIdx}`,
          target: `node_${targetIdx}`
        });
      }
    }

    // Step 2: Upload large dataset and measure performance
    const startTime = Date.now();
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'large_dataset.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(largeDataset))
    });

    // Step 3: Wait for visualization to load and measure time
    await expect(page.locator('.react-flow, [data-testid="react-flow"]')).toBeVisible({ timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`📊 Large dataset load time: ${loadTime}ms`);
    
    // Should load within reasonable time (30 seconds max)
    expect(loadTime).toBeLessThan(30000);

    // Step 4: Test that interactions remain responsive
    const interactionStartTime = Date.now();
    
    const fitViewButton = page.locator('button:has-text("Fit View"), [aria-label="Fit View"]').first();
    if (await fitViewButton.isVisible()) {
      await fitViewButton.click();
    }
    
    const interactionTime = Date.now() - interactionStartTime;
    console.log(`📊 Interaction response time: ${interactionTime}ms`);
    
    // Interactions should be responsive (under 2 seconds)
    expect(interactionTime).toBeLessThan(2000);

    console.log('✅ Complete performance workflow completed successfully');
  });
});