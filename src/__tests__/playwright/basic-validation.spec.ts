import { test, expect } from '@playwright/test';

test.describe('Basic Validation', () => {
  test('should validate nodes and edges without collapse', async ({ page }) => {
    // Navigate to the test page
    await page.goto('http://localhost:3000/hydroscope');

    // Debug: Log what's actually on the page
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);
    
    const bodyText = await page.locator('body').textContent();
    console.log(`📄 Page content preview: ${bodyText?.substring(0, 200)}...`);

    // Load test-data/paxos.json data via file drop zone
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

    // Get ReactFlow data from the page
    const reactFlowData = await page.evaluate(() => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (!reactFlowInstance) {
        throw new Error('ReactFlow instance not found');
      }
      
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();
      
      return {
        nodes: nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            label: node.data?.label,
            nodeType: node.data?.nodeType
          }
        })),
        edges: edges.map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }))
      };
    });

    console.log(`📊 Initial ReactFlow state:`);
    console.log(`  - Total nodes: ${reactFlowData.nodes.length}`);
    console.log(`  - Total edges: ${reactFlowData.edges.length}`);

    // Log first few nodes and edges for debugging
    if (reactFlowData.nodes.length > 0) {
      console.log(`  - First 5 nodes:`);
      reactFlowData.nodes.slice(0, 5).forEach((node: any) => {
        console.log(`    - ${node.id}: ${node.data?.label || 'no label'} (type: ${node.type})`);
      });
    }

    if (reactFlowData.edges.length > 0) {
      console.log(`  - First 5 edges:`);
      reactFlowData.edges.slice(0, 5).forEach((edge: any) => {
        console.log(`    - ${edge.id}: ${edge.source} -> ${edge.target} (type: ${edge.type})`);
      });
    }

    // Check for floating edges (edges with null/undefined source or target)
    const floatingEdges = reactFlowData.edges.filter((edge: any) => 
      !edge.source || !edge.target || edge.source === 'null' || edge.target === 'null'
    );

    if (floatingEdges.length > 0) {
      console.log(`❌ Found ${floatingEdges.length} floating edges:`);
      floatingEdges.slice(0, 10).forEach((edge: any) => {
        console.log(`  - ${edge.id}: ${edge.source} -> ${edge.target}`);
      });
    }

    // Check for nodes that exist
    const nodeIds = new Set(reactFlowData.nodes.map((node: any) => node.id));
    console.log(`📋 Node validation:`);
    console.log(`  - Unique node IDs: ${nodeIds.size}`);
    console.log(`  - Total nodes: ${reactFlowData.nodes.length}`);

    // Check edge validity
    const invalidEdges = reactFlowData.edges.filter((edge: any) => {
      const sourceExists = nodeIds.has(edge.source);
      const targetExists = nodeIds.has(edge.target);
      return !sourceExists || !targetExists;
    });

    if (invalidEdges.length > 0) {
      console.log(`❌ Found ${invalidEdges.length} edges with missing nodes:`);
      invalidEdges.slice(0, 10).forEach((edge: any) => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        console.log(`  - ${edge.id}: ${edge.source} (exists: ${sourceExists}) -> ${edge.target} (exists: ${targetExists})`);
      });
    }

    // Basic assertions
    expect(reactFlowData.nodes.length).toBeGreaterThan(0);
    expect(reactFlowData.edges.length).toBeGreaterThan(0);
    expect(floatingEdges.length).toBe(0);
    expect(invalidEdges.length).toBe(0);
  });
});