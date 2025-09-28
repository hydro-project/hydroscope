/**
 * @fileoverview Playwright test to debug floating edges issue
 * 
 * This test reproduces the floating edges problem in a real browser environment
 * and captures detailed debug information to identify the root cause.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Floating Edges Debug', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to the Hydroscope application
    await page.goto('http://localhost:3000/hydroscope');
    
    // Wait for the application to load - just wait for basic page load
    await page.waitForLoadState('networkidle');
  });

  test('should debug floating edges issue with real browser', async () => {
    console.log('🔍 Starting floating edges debug test...');
    
    // Debug: Log what's actually on the page
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);
    
    const bodyText = await page.locator('body').textContent();
    console.log(`📄 Page content preview: ${bodyText?.substring(0, 200)}...`);

    // Step 1: Load test-data/paxos.json data via file drop zone
    console.log('📁 Loading test-data/paxos.json data via file drop zone...');
    
    // The landing page should be a file drop zone - look for file input
    const fileInput = page.locator('input[type="file"]').first();
    
    // Set the file on the input (this should trigger the file loading)
    console.log('📁 Setting file on input...');
    await fileInput.setInputFiles('test-data/paxos.json');

    // Wait for data to load and ReactFlow to render
    console.log('⏳ Waiting for ReactFlow nodes to render...');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Additional wait to ensure all nodes are rendered
    await page.waitForTimeout(500);
    
    // Step 2: Count initial state
    const initialNodes = await page.locator('.react-flow__node').count();
    const initialEdges = await page.locator('.react-flow__edge').count();
    console.log(`📊 Initial state: ${initialNodes} nodes, ${initialEdges} edges`);

    // Step 3: Collapse all containers
    console.log('📦 Collapsing all containers...');
    
    // Debug: Let's see what buttons are actually available
    const allButtons = await page.locator('button').all();
    console.log(`🔍 Found ${allButtons.length} buttons on the page`);
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const buttonText = await allButtons[i].textContent();
      console.log(`  Button ${i}: "${buttonText}"`);
    }
    
    // Look for collapse all button - try multiple possible selectors
    const collapseButton = page.locator('button:has-text("Collapse All"), button:has-text("Collapse"), [data-testid="collapse-all"], button:has-text("collapse")').first();
    
    if (await collapseButton.isVisible()) {
      const buttonText = await collapseButton.textContent();
      console.log(`📦 Found Collapse button: "${buttonText}", clicking...`);
      await collapseButton.click();
      
      // Wait for the collapse operation to complete
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️ Collapse All button not found, trying individual container buttons...');
      // Try alternative - look for individual container collapse buttons
      const containerNodes = page.locator('.react-flow__node[data-nodetype="container"]');
      const containerCount = await containerNodes.count();
      console.log(`🔍 Found ${containerCount} container nodes`);
      
      for (let i = 0; i < containerCount; i++) {
        const container = containerNodes.nth(i);
        const collapseBtn = container.locator('button, [role="button"]').first();
        if (await collapseBtn.isVisible()) {
          await collapseBtn.click();
          await page.waitForTimeout(50); // Small delay between collapses
        }
      }
    }

    // Wait for collapse animation/layout to complete
    await page.waitForTimeout(1000);

    // Step 4: Capture post-collapse state
    const collapsedNodes = await page.locator('.react-flow__node').count();
    const collapsedEdges = await page.locator('.react-flow__edge').count();
    console.log(`📊 After collapse: ${collapsedNodes} nodes, ${collapsedEdges} edges`);

    // Step 5: Analyze edge connections and categorize them
    console.log('🔍 Analyzing edge connections...');
    
    // Get all edges and their connection points
    const edges = await page.locator('.react-flow__edge').all();
    const floatingEdges = [];
    const workingEdges = [];
    const edgeAnalysis = [];
    
    for (let i = 0; i < Math.min(edges.length, 20); i++) { // Analyze first 20 edges for detailed comparison
      const edge = edges[i];
      const edgeId = await edge.getAttribute('data-id') || `edge-${i}`;
      
      // Get edge path element
      const pathElement = edge.locator('path').first();
      if (await pathElement.isVisible()) {
        const pathData = await pathElement.getAttribute('d');
        
        // Check if edge has proper source and target handles
        const sourceHandle = await edge.getAttribute('data-sourcehandle');
        const targetHandle = await edge.getAttribute('data-targethandle');
        
        // Get the actual source and target from the edge element
        const sourceId = await edge.getAttribute('data-source');
        const targetId = await edge.getAttribute('data-target');
        
        // Get edge type
        const edgeType = await edge.getAttribute('data-testid') || await edge.getAttribute('class') || 'unknown';
        
        const edgeInfo = {
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          type: edgeType,
          hasHandles: !!(sourceHandle && targetHandle),
          hasSourceTarget: !!(sourceId && targetId),
          pathLength: pathData?.length || 0
        };
        
        edgeAnalysis.push(edgeInfo);
        
        // Check if edge appears to be floating (no proper connection points or missing source/target)
        if (!sourceHandle || !targetHandle || !sourceId || !targetId) {
          floatingEdges.push(edgeId);
        } else {
          workingEdges.push(edgeId);
        }
      }
    }
    
    // Count all floating edges (not just the first 20)
    for (let i = 20; i < edges.length; i++) {
      const edge = edges[i];
      const edgeId = await edge.getAttribute('data-id') || `edge-${i}`;
      const sourceHandle = await edge.getAttribute('data-sourcehandle');
      const targetHandle = await edge.getAttribute('data-targethandle');
      const sourceId = await edge.getAttribute('data-source');
      const targetId = await edge.getAttribute('data-target');
      
      if (!sourceHandle || !targetHandle || !sourceId || !targetId) {
        floatingEdges.push(edgeId);
      } else {
        workingEdges.push(edgeId);
      }
    }
    
    // Analyze the differences
    console.log('\n📊 EDGE ANALYSIS COMPARISON:');
    console.log(`Total edges analyzed: ${edges.length}`);
    console.log(`Working edges: ${workingEdges.length}`);
    console.log(`Floating edges: ${floatingEdges.length}`);
    
    console.log('\n🔍 DETAILED ANALYSIS (first 20 edges):');
    const workingEdgesSample = edgeAnalysis.filter(e => e.hasHandles && e.hasSourceTarget);
    const floatingEdgesSample = edgeAnalysis.filter(e => !e.hasHandles || !e.hasSourceTarget);
    
    console.log('\n✅ WORKING EDGES SAMPLE:');
    workingEdgesSample.slice(0, 5).forEach(edge => {
      console.log(`  ${edge.id}: ${edge.source} -> ${edge.target} [${edge.sourceHandle} -> ${edge.targetHandle}] (${edge.type})`);
    });
    
    console.log('\n❌ FLOATING EDGES SAMPLE:');
    floatingEdgesSample.slice(0, 5).forEach(edge => {
      console.log(`  ${edge.id}: ${edge.source || 'NULL'} -> ${edge.target || 'NULL'} [${edge.sourceHandle || 'NULL'} -> ${edge.targetHandle || 'NULL'}] (${edge.type})`);
    });
    
    // Look for patterns
    const workingEdgeTypes = [...new Set(workingEdgesSample.map(e => e.type))];
    const floatingEdgeTypes = [...new Set(floatingEdgesSample.map(e => e.type))];
    
    console.log('\n🔍 EDGE TYPE PATTERNS:');
    console.log(`Working edge types: ${workingEdgeTypes.join(', ')}`);
    console.log(`Floating edge types: ${floatingEdgeTypes.join(', ')}`);
    
    // Check if there's a pattern in edge IDs
    const workingEdgeIds = workingEdgesSample.map(e => e.id).sort();
    const floatingEdgeIds = floatingEdgesSample.map(e => e.id).sort();
    
    console.log('\n🔍 EDGE ID PATTERNS:');
    console.log(`Working edge IDs (sample): ${workingEdgeIds.slice(0, 10).join(', ')}`);
    console.log(`Floating edge IDs (sample): ${floatingEdgeIds.slice(0, 10).join(', ')}`);
    
    // Check if floating edges have a pattern (e.g., all start with certain numbers)
    const floatingEdgeNumbers = floatingEdgeIds.map(id => parseInt(id.replace('e', ''))).filter(n => !isNaN(n));
    const workingEdgeNumbers = workingEdgeIds.map(id => parseInt(id.replace('e', ''))).filter(n => !isNaN(n));
    
    if (floatingEdgeNumbers.length > 0 && workingEdgeNumbers.length > 0) {
      console.log(`Floating edge number range: ${Math.min(...floatingEdgeNumbers)} - ${Math.max(...floatingEdgeNumbers)}`);
      console.log(`Working edge number range: ${Math.min(...workingEdgeNumbers)} - ${Math.max(...workingEdgeNumbers)}`);
    }

    // Step 6: Analyze handle elements
    console.log('🎯 Analyzing handle elements...');
    
    const handles = await page.locator('.react-flow__handle').all();
    console.log(`🎯 Found ${handles.length} handle elements`);
    
    const handleInfo = [];
    for (let i = 0; i < Math.min(handles.length, 20); i++) { // Limit to first 20 for readability
      const handle = handles[i];
      const handleId = await handle.getAttribute('data-handleid');
      const handleType = await handle.getAttribute('data-handletype');
      const isVisible = await handle.isVisible();
      const boundingBox = await handle.boundingBox();
      
      handleInfo.push({
        id: handleId,
        type: handleType,
        visible: isVisible,
        position: boundingBox ? `${boundingBox.x},${boundingBox.y}` : 'unknown'
      });
    }
    
    console.log('🎯 Handle details:', handleInfo);

    // Step 7: Capture console logs from the browser
    console.log('📝 Capturing browser console logs...');
    
    const consoleLogs = [];
    const consoleErrors = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ReactFlowBridge') || text.includes('smart handles') || text.includes('invalid')) {
        consoleLogs.push(text);
        if (msg.type() === 'error') {
          consoleErrors.push(text);
        }
      }
    });

    // Wait a bit to capture any console messages
    await page.waitForTimeout(1000);
    
    console.log(`📝 Captured ${consoleLogs.length} relevant console messages:`);
    consoleLogs.forEach((log, i) => console.log(`  ${i + 1}: ${log}`));
    
    if (consoleErrors.length > 0) {
      console.log(`❌ Console errors: ${consoleErrors.length}`);
      consoleErrors.forEach((error, i) => console.log(`  Error ${i + 1}: ${error}`));
    }

    // Step 8: Take screenshot for visual debugging
    await page.screenshot({ 
      path: 'hydroscope/playwright-debug-floating-edges.png',
      fullPage: true 
    });

    // Step 9: Extract ReactFlow internal state
    console.log('🔍 Extracting ReactFlow internal state...');
    
    const reactFlowState = await page.evaluate(() => {
      // Try to access ReactFlow store if available
      const reactFlowWrapper = document.querySelector('.react-flow');
      if (reactFlowWrapper) {
        return {
          nodes: Array.from(document.querySelectorAll('.react-flow__node')).map(node => ({
            id: node.getAttribute('data-id'),
            type: node.getAttribute('data-nodetype'),
            position: {
              x: node.style.transform?.match(/translate\(([^,]+)/)?.[1] || 'unknown',
              y: node.style.transform?.match(/translate\([^,]+,\s*([^)]+)/)?.[1] || 'unknown'
            }
          })),
          edges: Array.from(document.querySelectorAll('.react-flow__edge')).map(edge => ({
            id: edge.getAttribute('data-id'),
            source: edge.getAttribute('data-source'),
            target: edge.getAttribute('data-target'),
            sourceHandle: edge.getAttribute('data-sourcehandle'),
            targetHandle: edge.getAttribute('data-targethandle')
          })),
          handles: Array.from(document.querySelectorAll('.react-flow__handle')).map(handle => ({
            id: handle.getAttribute('data-handleid'),
            type: handle.getAttribute('data-handletype'),
            nodeId: handle.closest('.react-flow__node')?.getAttribute('data-id'),
            visible: handle.offsetParent !== null
          }))
        };
      }
      return null;
    });

    console.log('📊 ReactFlow State:', JSON.stringify(reactFlowState, null, 2));

    // Step 10: Assertions and reporting
    console.log('📋 Test Results Summary:');
    console.log(`   - Floating edges detected: ${floatingEdges.length}`);
    console.log(`   - Total edges: ${collapsedEdges}`);
    console.log(`   - Total handles: ${handles.length}`);
    
    if (floatingEdges.length > 0) {
      console.log(`❌ FLOATING EDGES DETECTED: ${floatingEdges.join(', ')}`);
      console.log('🔍 This indicates edges are not properly connecting to handles');
    }

    // The test should fail if there are floating edges, but we want to see all the debug info
    if (floatingEdges.length > 0) {
      console.log('💡 Debug information captured. Check the screenshot and logs above.');
      
      // Don't fail immediately - let's gather more info
      console.log('🔍 Additional debugging - checking handle-edge relationships...');
      
      // Check if handles exist for the floating edges
      for (const floatingEdgeId of floatingEdges) {
        const edge = page.locator(`.react-flow__edge[data-id="${floatingEdgeId}"]`);
        const sourceId = await edge.getAttribute('data-source');
        const targetId = await edge.getAttribute('data-target');
        
        console.log(`🔍 Floating edge ${floatingEdgeId}: ${sourceId} -> ${targetId}`);
        
        // Check if source and target nodes exist
        const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
        const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
        
        const sourceExists = await sourceNode.count() > 0;
        const targetExists = await targetNode.count() > 0;
        
        console.log(`   - Source node exists: ${sourceExists}`);
        console.log(`   - Target node exists: ${targetExists}`);
        
        if (sourceExists) {
          const sourceHandles = await sourceNode.locator('.react-flow__handle[data-handletype="source"]').count();
          console.log(`   - Source handles: ${sourceHandles}`);
        }
        
        if (targetExists) {
          const targetHandles = await targetNode.locator('.react-flow__handle[data-handletype="target"]').count();
          console.log(`   - Target handles: ${targetHandles}`);
        }
      }
    }

    // Final assertion - this will fail if there are floating edges, showing all our debug info
    expect(floatingEdges.length).toBe(0);
  });
});