/**
 * Playwright E2E test for the Proposer floating edges bug
 * 
 * Reproduction steps:
 * 1. Use FileDropZone to load test-data/paxos.json
 * 2. Click on the Proposer node
 * 3. Click on the background of the resulting big expanded container
 * 4. Observe that edges are floating disconnected
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Proposer Floating Edges Bug', () => {
  test('should reproduce floating edges bug with exact steps', async ({ page }) => {
    console.log('[E2E] 🚀 Starting Proposer floating edges bug reproduction');

    // Capture browser console logs
    page.on('console', msg => {
      if (msg.text().includes('[EdgeDebug]') || msg.text().includes('[VisualizationState]') || msg.text().includes('[ReactFlowBridge]')) {
        console.log(`[Browser] ${msg.text()}`);
      }
    });

    // Navigate to the Hydroscope demo page
    await page.goto('http://localhost:3000/hydroscope');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    console.log('[E2E] ✅ Page loaded');

    // Step 1: Load paxos.json using FileDropZone
    console.log('[E2E] 📁 Step 1: Loading paxos.json via FileDropZone');
    
    // Load the actual paxos.json file content
    const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
    expect(fs.existsSync(paxosPath)).toBe(true);
    const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
    
    // Find and click on the FileUpload area to trigger file upload
    // Target the specific clickable div with role="button"
    const fileUploadArea = page.locator('.upload-area[role="button"]');
    
    // Wait for the upload area to be visible
    await expect(fileUploadArea).toBeVisible();
    console.log('[E2E] 📁 FileUpload area is visible');
    
    // Set up file chooser handler before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Click on the upload area to open file chooser
    await fileUploadArea.click();
    console.log('[E2E] 🖱️ Clicked on FileUpload area');
    
    // Handle the file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(paxosPath);
    console.log('[E2E] 📁 paxos.json file selected through FileDropZone');

    // Wait for the file to be processed and the graph to render
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    console.log('[E2E] ✅ Graph rendered with nodes');

    // Take a screenshot of initial state
    await page.screenshot({ path: 'e2e-screenshots/01-initial-state.png', fullPage: true });

    // Step 2: Find and click on the Proposer node
    console.log('[E2E] 📦 Step 2: Finding and clicking Proposer node');
    
    // Look for the Proposer container node
    // It might be identified by text content or data attributes
    const proposerNode = page.locator('.react-flow__node').filter({ hasText: /Proposer/i }).first();
    
    // If not found by text, try by data-id (loc_0 based on our investigation)
    const proposerNodeById = page.locator('[data-id="loc_0"]');
    
    let proposerElement = proposerNode;
    if (await proposerNode.count() === 0) {
      proposerElement = proposerNodeById;
      console.log('[E2E] 📦 Using Proposer node by ID (loc_0)');
    } else {
      console.log('[E2E] 📦 Using Proposer node by text content');
    }
    
    // Ensure the Proposer node exists
    await expect(proposerElement).toBeVisible();
    console.log('[E2E] 📦 Proposer node found and visible');
    
    // Get initial edge count
    const initialEdges = await page.locator('.react-flow__edge').count();
    console.log(`[E2E] 📊 Initial edge count: ${initialEdges}`);
    
    // Click on the Proposer node to expand it
    await proposerElement.click();
    console.log('[E2E] 🖱️ Clicked on Proposer node');
    
    // Wait for the expansion to complete
    await page.waitForTimeout(2000); // Give time for animations and async operations
    
    // Take a screenshot after expansion
    await page.screenshot({ path: 'e2e-screenshots/02-after-expansion.png', fullPage: true });
    
    // Verify that the container expanded (more nodes should be visible)
    const expandedNodes = await page.locator('.react-flow__node').count();
    console.log(`[E2E] 📊 Nodes after expansion: ${expandedNodes}`);
    
    // Step 3: Click on the blue background of the expanded container to collapse it
    console.log('[E2E] 🖱️ Step 3: Clicking on blue background to collapse container');
    
    // Find the expanded Proposer container (it should be larger now)
    const expandedProposerContainer = page.locator('[data-id="loc_0"]').first();
    await expect(expandedProposerContainer).toBeVisible();
    
    // Get the container's bounding box and click on an empty area
    const containerBox = await expandedProposerContainer.boundingBox();
    if (containerBox) {
      // Click on the bottom-right corner of the container (likely empty blue background)
      await page.mouse.click(
        containerBox.x + containerBox.width - 30,  // 30px from right edge
        containerBox.y + containerBox.height - 30  // 30px from bottom edge
      );
      console.log('[E2E] 🖱️ Clicked on bottom-right corner of expanded Proposer container');
    } else {
      throw new Error('Could not get container bounding box');
    }
    
    // Wait for the collapse to complete
    await page.waitForTimeout(2000);
    
    // Take a screenshot after collapse
    await page.screenshot({ path: 'e2e-screenshots/03-after-collapse.png', fullPage: true });
    
    // Step 4: Close the Graph Info panel to reveal floating edges
    console.log('[E2E] 👻 Step 4: Closing Graph Info panel to reveal floating edges');
    
    // Find and close the Graph Info panel
    const infoPanelCloseButton = page.locator('[data-testid="info-panel-close"]').or(
      page.locator('button').filter({ hasText: /close|×|✕/i }).or(
        page.locator('.info-panel .close-button').or(
          page.locator('[aria-label*="close"]')
        )
      )
    );
    
    // Try to close the info panel if it exists
    if (await infoPanelCloseButton.count() > 0) {
      await infoPanelCloseButton.first().click();
      console.log('[E2E] 🖱️ Closed Graph Info panel');
      await page.waitForTimeout(1000); // Wait for panel to close
    } else {
      console.log('[E2E] ℹ️ No closeable Graph Info panel found');
    }
    
    // Take a screenshot with the panel closed to show floating edges clearly
    await page.screenshot({ path: 'e2e-screenshots/04-panel-closed-floating-edges.png', fullPage: true });
    
    // Step 5: Check for floating disconnected edges
    console.log('[E2E] 👻 Step 5: Checking for floating disconnected edges');
    
    // Get all nodes and edges after collapse
    const finalNodes = await page.locator('.react-flow__node').all();
    const finalEdges = await page.locator('.react-flow__edge').all();
    
    console.log(`[E2E] 📊 Final state: ${finalNodes.length} nodes, ${finalEdges.length} edges`);
    
    // Get all node IDs that exist in the DOM
    const nodeIds = new Set<string>();
    for (const node of finalNodes) {
      const nodeId = await node.getAttribute('data-id');
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    }
    
    console.log(`[E2E] 📊 Node IDs present:`, Array.from(nodeIds));
    
    // Check each edge to see if its source and target nodes exist
    const floatingEdges: { id: string; source: string; target: string; reason: string }[] = [];
    
    for (const edge of finalEdges) {
      const edgeId = await edge.getAttribute('data-id');
      const sourceId = await edge.getAttribute('data-source');
      const targetId = await edge.getAttribute('data-target');
      
      if (sourceId && targetId) {
        const sourceExists = nodeIds.has(sourceId);
        const targetExists = nodeIds.has(targetId);
        
        if (!sourceExists || !targetExists) {
          const reason = !sourceExists && !targetExists ? 'both nodes missing' :
                        !sourceExists ? 'source node missing' : 'target node missing';
          
          floatingEdges.push({
            id: edgeId || 'unknown',
            source: sourceId,
            target: targetId,
            reason
          });
          
          console.log(`[E2E] 👻 Floating edge found: ${edgeId} (${sourceId} -> ${targetId}) - ${reason}`);
          console.log(`[E2E] 👻   Source exists: ${sourceExists}, Target exists: ${targetExists}`);
        }
      }
    }
    
    // Additional check: Look for edges that might be visually floating
    // (edges that extend beyond the visible node area)
    const visibleNodeArea = await page.locator('.react-flow__nodes').boundingBox();
    const edgesOutsideNodeArea: string[] = [];
    
    for (const edge of finalEdges) {
      const edgeBox = await edge.boundingBox();
      if (edgeBox && visibleNodeArea) {
        // Check if edge extends significantly beyond the node area
        const extendsBelow = edgeBox.y + edgeBox.height > visibleNodeArea.y + visibleNodeArea.height + 50;
        const extendsAbove = edgeBox.y < visibleNodeArea.y - 50;
        const extendsLeft = edgeBox.x < visibleNodeArea.x - 50;
        const extendsRight = edgeBox.x + edgeBox.width > visibleNodeArea.x + visibleNodeArea.width + 50;
        
        if (extendsBelow || extendsAbove || extendsLeft || extendsRight) {
          const edgeId = await edge.getAttribute('data-id');
          edgesOutsideNodeArea.push(edgeId || 'unknown');
          console.log(`[E2E] 👻 Edge extending outside node area: ${edgeId}`);
        }
      }
    }
    
    if (edgesOutsideNodeArea.length > 0) {
      console.log(`[E2E] 👻 Found ${edgesOutsideNodeArea.length} edges extending outside the node area (potentially floating)`);
    }
    
    // Log the results
    if (floatingEdges.length > 0) {
      console.error(`[E2E] ❌ BUG REPRODUCED: Found ${floatingEdges.length} floating edges!`);
      console.error('[E2E] 👻 Floating edges:', floatingEdges);
      
      // Take a detailed screenshot highlighting the issue
      await page.screenshot({ path: 'e2e-screenshots/05-floating-edges-bug-confirmed.png', fullPage: true });
      
      // Highlight floating edges for visual confirmation
      for (const floatingEdge of floatingEdges) {
        const edgeElement = page.locator(`[data-id="${floatingEdge.id}"]`);
        if (await edgeElement.count() > 0) {
          await edgeElement.evaluate(el => {
            el.style.stroke = 'red';
            el.style.strokeWidth = '3px';
            el.style.opacity = '1';
          });
        }
      }
      
      await page.screenshot({ path: 'e2e-screenshots/06-highlighted-floating-edges.png', fullPage: true });
      
      // Fail the test to indicate bug reproduction
      expect(floatingEdges.length).toBe(0);
    } else {
      console.log('[E2E] ✅ No floating edges found - bug may be fixed');
    }
    
    // Additional validation: Check that the Proposer container is back to collapsed state
    const finalProposerNode = page.locator('[data-id="loc_0"]');
    await expect(finalProposerNode).toBeVisible();
    
    // Verify edge count is consistent with initial state
    const finalEdgeCount = await page.locator('.react-flow__edge').count();
    console.log(`[E2E] 📊 Final edge count: ${finalEdgeCount} (initial: ${initialEdges})`);
    
    // The edge count should be the same as initial (allowing for small variations due to aggregation)
    expect(Math.abs(finalEdgeCount - initialEdges)).toBeLessThanOrEqual(2);
    
    console.log('[E2E] ✅ Proposer floating edges bug test completed');
  });

  test('should maintain edge consistency across multiple expand/collapse cycles', async ({ page }) => {
    console.log('[E2E] 🚀 Starting multiple cycle test');

    // Capture browser console logs
    page.on('console', msg => {
      if (msg.text().includes('[EdgeDebug]') || msg.text().includes('[VisualizationState]') || msg.text().includes('[ReactFlowBridge]')) {
        console.log(`[Browser] ${msg.text()}`);
      }
    });

    // Navigate and load paxos.json (same as above)
    await page.goto('http://localhost:3000/hydroscope');
    await page.waitForLoadState('networkidle');

    const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
    
    // Find and click on the FileUpload area
    const fileUploadArea = page.locator('.upload-area[role="button"]');
    
    await expect(fileUploadArea).toBeVisible();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await fileUploadArea.click();
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(paxosPath);

    await page.waitForSelector('.react-flow__node', { timeout: 10000 });

    // Get initial state
    const initialEdgeCount = await page.locator('.react-flow__edge').count();
    console.log(`[E2E] 📊 Initial edge count: ${initialEdgeCount}`);

    // Perform multiple expand/collapse cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`[E2E] 🔄 Cycle ${cycle}: Starting expand/collapse`);

      // Find Proposer node
      const proposerNode = page.locator('[data-id="loc_0"]');
      await expect(proposerNode).toBeVisible();

      // Expand
      await proposerNode.click();
      await page.waitForTimeout(1500);
      console.log(`[E2E] 🔄 Cycle ${cycle}: Expanded`);

      // Collapse
      await proposerNode.click();
      await page.waitForTimeout(1500);
      console.log(`[E2E] 🔄 Cycle ${cycle}: Collapsed`);

      // Check for floating edges after each cycle
      const nodes = await page.locator('.react-flow__node').all();
      const edges = await page.locator('.react-flow__edge').all();

      const nodeIds = new Set<string>();
      for (const node of nodes) {
        const nodeId = await node.getAttribute('data-id');
        if (nodeId) nodeIds.add(nodeId);
      }

      let floatingCount = 0;
      for (const edge of edges) {
        const sourceId = await edge.getAttribute('data-source');
        const targetId = await edge.getAttribute('data-target');
        
        if (sourceId && targetId) {
          if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
            floatingCount++;
          }
        }
      }

      console.log(`[E2E] 🔄 Cycle ${cycle}: ${floatingCount} floating edges found`);
      expect(floatingCount).toBe(0);

      // Take screenshot for each cycle
      await page.screenshot({ path: `e2e-screenshots/cycle-${cycle}-final.png`, fullPage: true });
    }

    console.log('[E2E] ✅ Multiple cycle test completed');
  });
});