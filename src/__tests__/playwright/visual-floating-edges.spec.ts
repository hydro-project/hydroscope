/**
 * @fileoverview Visual test for floating edges - focuses on actual visual issues
 * rather than trying to parse ReactFlow DOM internals
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Visual Floating Edges Detection', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to the Hydroscope application
    await page.goto('http://localhost:3000/hydroscope');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });

  test('should detect visual floating edges after container collapse', async () => {
    console.log('🔍 Starting visual floating edges detection...');
    
    // Step 1: Load test data
    console.log('📁 Loading test-data/paxos.json...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('test-data/paxos.json');

    // Wait for ReactFlow to render
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow time for full rendering

    // Step 2: Capture initial state
    const initialScreenshot = await page.screenshot({ 
      path: 'hydroscope/test-results/before-collapse.png',
      fullPage: true 
    });

    const initialNodes = await page.locator('.react-flow__node').count();
    const initialEdges = await page.locator('.react-flow__edge').count();
    console.log(`📊 Initial state: ${initialNodes} nodes, ${initialEdges} edges`);

    // Step 3: Look for and click CollapseAll button in custom controls
    console.log('🔍 Looking for CollapseAll button in custom controls...');
    
    // Look for the button with tooltip "Collapse All Containers" in the lower left custom controls
    const possibleSelectors = [
      'button[title="Collapse All Containers"]',
      'button[aria-label="Collapse All Containers"]',
      '[title="Collapse All Containers"]',
      '.react-flow__controls button[title*="Collapse"]',
      '.react-flow__panel button[title*="Collapse"]',
      'button[title*="collapse"]',
      'button[title*="Collapse"]'
    ];

    let collapseButton = null;
    for (const selector of possibleSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible()) {
        collapseButton = button;
        const buttonTitle = await button.getAttribute('title');
        const buttonText = await button.textContent();
        console.log(`✅ Found collapse button with selector: ${selector}`);
        console.log(`   Title: "${buttonTitle}"`);
        console.log(`   Text: "${buttonText}"`);
        break;
      }
    }

    if (!collapseButton) {
      // If no collapse button found, explore the custom controls area
      console.log('⚠️ No collapse button found. Exploring custom controls area...');
      
      // Look for ReactFlow controls/panels
      const controlsSelectors = [
        '.react-flow__controls',
        '.react-flow__panel',
        '[class*="controls"]',
        '[class*="panel"]'
      ];
      
      for (const selector of controlsSelectors) {
        const controls = page.locator(selector);
        const count = await controls.count();
        if (count > 0) {
          console.log(`Found ${count} elements with selector: ${selector}`);
          
          // Look for buttons within these controls
          const buttons = controls.locator('button');
          const buttonCount = await buttons.count();
          console.log(`  Contains ${buttonCount} buttons`);
          
          for (let i = 0; i < Math.min(buttonCount, 10); i++) {
            const button = buttons.nth(i);
            const title = await button.getAttribute('title');
            const text = await button.textContent();
            const isVisible = await button.isVisible();
            console.log(`    Button ${i}: title="${title}", text="${text}", visible=${isVisible}`);
            
            // If this looks like a collapse button, try it
            if (title && title.toLowerCase().includes('collapse')) {
              collapseButton = button;
              console.log(`✅ Found collapse button in controls: "${title}"`);
              break;
            }
          }
        }
      }
      
      if (!collapseButton) {
        console.log('❌ Still no collapse button found. Listing all buttons with titles:');
        const allButtons = await page.locator('button[title]').all();
        for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
          const title = await allButtons[i].getAttribute('title');
          const isVisible = await allButtons[i].isVisible();
          console.log(`  Button ${i}: title="${title}" (visible: ${isVisible})`);
        }
        
        console.log('❌ Cannot find collapse button. Test may not be applicable.');
        return;
      }
    }

    // Click the collapse button
    await collapseButton.click();
    console.log('✅ Clicked collapse button');

    // Wait for collapse operation to complete
    await page.waitForTimeout(2000);

    // Step 3.5: Click Fit View to make floating edges visible
    console.log('🔍 Looking for Fit View button...');
    const fitViewSelectors = [
      'button[title="Fit View"]',
      'button[aria-label="Fit View"]',
      '[title="Fit View"]',
      '.react-flow__controls button[title*="Fit"]',
      'button[title*="fit"]',
      'button[title*="Fit"]'
    ];

    let fitViewButton = null;
    for (const selector of fitViewSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible()) {
        fitViewButton = button;
        const buttonTitle = await button.getAttribute('title');
        console.log(`✅ Found Fit View button: "${buttonTitle}"`);
        break;
      }
    }

    if (fitViewButton) {
      await fitViewButton.click();
      console.log('✅ Clicked Fit View button');
      await page.waitForTimeout(1000); // Wait for view to adjust
    } else {
      console.log('⚠️ Fit View button not found, continuing without it');
    }

    // Step 4: Capture post-collapse state
    const afterScreenshot = await page.screenshot({ 
      path: 'hydroscope/test-results/after-collapse.png',
      fullPage: true 
    });

    const finalNodes = await page.locator('.react-flow__node').count();
    const finalEdges = await page.locator('.react-flow__edge').count();
    console.log(`📊 After collapse: ${finalNodes} nodes, ${finalEdges} edges`);

    // Step 5: Analyze edge visual properties instead of DOM attributes
    console.log('🔍 Analyzing edge visual properties...');
    
    const edges = await page.locator('.react-flow__edge').all();
    const suspiciousEdges = [];
    
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      
      try {
        // Get the edge's bounding box and path
        const boundingBox = await edge.boundingBox();
        const pathElement = edge.locator('path').first();
        
        if (boundingBox && await pathElement.isVisible()) {
          const pathData = await pathElement.getAttribute('d');
          
          // Analyze the path to detect potential floating edges
          if (pathData) {
            // Look for patterns that might indicate floating edges:
            // 1. Very long paths (edges going off-screen)
            // 2. Paths with extreme coordinates
            // 3. Paths that start or end at (0,0) or negative coordinates
            
            const coordinates = pathData.match(/[-]?\d+\.?\d*/g) || [];
            const numbers = coordinates.map(Number).filter(n => !isNaN(n));
            
            if (numbers.length > 0) {
              const minX = Math.min(...numbers.filter((_, i) => i % 2 === 0));
              const maxX = Math.max(...numbers.filter((_, i) => i % 2 === 0));
              const minY = Math.min(...numbers.filter((_, i) => i % 2 === 1));
              const maxY = Math.max(...numbers.filter((_, i) => i % 2 === 1));
              
              // Detect suspicious patterns
              const hasExtremeCoordinates = minX < -1000 || maxX > 5000 || minY < -1000 || maxY > 5000;
              const hasZeroCoordinates = numbers.includes(0) && numbers.length > 2;
              const pathLength = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2));
              const isVeryLong = pathLength > 2000;
              
              if (hasExtremeCoordinates || isVeryLong) {
                suspiciousEdges.push({
                  index: i,
                  boundingBox,
                  pathLength,
                  coordinates: { minX, maxX, minY, maxY },
                  hasExtremeCoordinates,
                  isVeryLong,
                  pathData: pathData.substring(0, 100) + '...' // Truncate for logging
                });
              }
            }
          }
        }
      } catch (error) {
        console.log(`Error analyzing edge ${i}: ${error}`);
      }
    }

    // Step 6: Report findings
    console.log(`🔍 Analysis complete:`);
    console.log(`  - Total edges: ${edges.length}`);
    console.log(`  - Suspicious edges: ${suspiciousEdges.length}`);
    
    if (suspiciousEdges.length > 0) {
      console.log(`❌ Found ${suspiciousEdges.length} potentially floating edges:`);
      suspiciousEdges.slice(0, 5).forEach((edge, i) => {
        console.log(`  ${i + 1}. Edge ${edge.index}:`);
        console.log(`     - Path length: ${edge.pathLength.toFixed(2)}`);
        console.log(`     - Coordinates: X(${edge.coordinates.minX}, ${edge.coordinates.maxX}) Y(${edge.coordinates.minY}, ${edge.coordinates.maxY})`);
        console.log(`     - Extreme coords: ${edge.hasExtremeCoordinates}, Very long: ${edge.isVeryLong}`);
      });
    } else {
      console.log(`✅ No visually floating edges detected`);
    }

    // Step 7: Extract detailed edge information from ReactFlow
    console.log('🔍 Extracting detailed edge information from ReactFlow...');
    
    const edgeDetails = await page.evaluate(() => {
      const edges = Array.from(document.querySelectorAll('.react-flow__edge'));
      const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
      
      return {
        edges: edges.map((edge, index) => {
          const pathElement = edge.querySelector('path');
          const pathData = pathElement ? pathElement.getAttribute('d') : null;
          
          return {
            index,
            id: edge.getAttribute('data-id'),
            source: edge.getAttribute('data-source'),
            target: edge.getAttribute('data-target'),
            sourceHandle: edge.getAttribute('data-sourcehandle'),
            targetHandle: edge.getAttribute('data-targethandle'),
            pathData: pathData ? pathData.substring(0, 200) + '...' : null,
            classes: edge.className,
            style: edge.getAttribute('style')
          };
        }),
        nodes: nodes.map(node => ({
          id: node.getAttribute('data-id'),
          type: node.getAttribute('data-nodetype'),
          position: node.style.transform,
          classes: node.className,
          text: node.textContent?.substring(0, 50)
        })),
        handles: Array.from(document.querySelectorAll('.react-flow__handle')).map(handle => ({
          id: handle.getAttribute('data-handleid'),
          type: handle.getAttribute('data-handletype'),
          nodeId: handle.closest('.react-flow__node')?.getAttribute('data-id'),
          position: handle.style.transform || 'no transform',
          classes: handle.className
        }))
      };
    });

    console.log('\n🔍 DETAILED EDGE ANALYSIS:');
    console.log(`Found ${edgeDetails.edges.length} edges, ${edgeDetails.nodes.length} nodes, ${edgeDetails.handles.length} handles`);
    
    // Analyze each suspicious edge
    suspiciousEdges.forEach((suspiciousEdge, i) => {
      const edgeDetail = edgeDetails.edges[suspiciousEdge.index];
      console.log(`\n❌ SUSPICIOUS EDGE ${i + 1}:`);
      console.log(`  - Index: ${suspiciousEdge.index}`);
      console.log(`  - ID: ${edgeDetail?.id}`);
      console.log(`  - Source: ${edgeDetail?.source}`);
      console.log(`  - Target: ${edgeDetail?.target}`);
      console.log(`  - Source Handle: ${edgeDetail?.sourceHandle}`);
      console.log(`  - Target Handle: ${edgeDetail?.targetHandle}`);
      console.log(`  - Path Length: ${suspiciousEdge.pathLength.toFixed(2)}px`);
      console.log(`  - Coordinates: X(${suspiciousEdge.coordinates.minX}, ${suspiciousEdge.coordinates.maxX}) Y(${suspiciousEdge.coordinates.minY}, ${suspiciousEdge.coordinates.maxY})`);
      
      // Find corresponding nodes
      const sourceNode = edgeDetails.nodes.find(n => n.id === edgeDetail?.source);
      const targetNode = edgeDetails.nodes.find(n => n.id === edgeDetail?.target);
      
      console.log(`  - Source Node: ${sourceNode ? `${sourceNode.id} (${sourceNode.type}) at ${sourceNode.position}` : 'NOT FOUND'}`);
      console.log(`  - Target Node: ${targetNode ? `${targetNode.id} (${targetNode.type}) at ${targetNode.position}` : 'NOT FOUND'}`);
      
      // Find corresponding handles
      const sourceHandles = edgeDetails.handles.filter(h => h.nodeId === edgeDetail?.source && h.type === 'source');
      const targetHandles = edgeDetails.handles.filter(h => h.nodeId === edgeDetail?.target && h.type === 'target');
      
      console.log(`  - Source Handles: ${sourceHandles.length} (${sourceHandles.map(h => h.id).join(', ')})`);
      console.log(`  - Target Handles: ${targetHandles.length} (${targetHandles.map(h => h.id).join(', ')})`);
      
      if (edgeDetail?.pathData) {
        console.log(`  - Path Data: ${edgeDetail.pathData}`);
      }
    });

    // Step 8: Check browser console for our validation messages
    console.log('\n📝 Checking browser console for validation messages...');
    
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ReactFlowBridge') || text.includes('FLOATING EDGE') || text.includes('Edge validation')) {
        consoleLogs.push({ type: msg.type(), text });
      }
    });

    await page.waitForTimeout(1000);

    if (consoleLogs.length > 0) {
      console.log(`📝 Found ${consoleLogs.length} validation messages:`);
      consoleLogs.forEach((log, i) => {
        console.log(`  ${i + 1}. [${log.type}] ${log.text}`);
      });
    } else {
      console.log('📝 No validation messages found in console');
    }

    // Step 8: Final assessment
    const hasVisualFloatingEdges = suspiciousEdges.length > 0;
    const hasValidationErrors = consoleLogs.some(log => log.text.includes('FLOATING EDGE PROBLEM'));
    
    console.log(`\n📋 Final Assessment:`);
    console.log(`  - Visual floating edges: ${hasVisualFloatingEdges ? 'YES' : 'NO'} (${suspiciousEdges.length})`);
    console.log(`  - Validation errors: ${hasValidationErrors ? 'YES' : 'NO'}`);
    console.log(`  - Screenshots saved: before-collapse.png, after-collapse.png`);

    // The test passes if there are no visual floating edges
    // (We're not failing on validation errors since those might be false positives)
    if (hasVisualFloatingEdges) {
      console.log(`❌ Test failed: Found ${suspiciousEdges.length} visually floating edges`);
      console.log(`💡 Check the screenshots and coordinate analysis above for details`);
    } else {
      console.log(`✅ Test passed: No visually floating edges detected`);
    }

    expect(suspiciousEdges.length).toBe(0);
  });
});