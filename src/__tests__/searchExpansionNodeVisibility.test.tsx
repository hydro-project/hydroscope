/**
 * Test to validate that search expansion properly makes nodes visible
 * 
 * This test reproduces the bug where search expansion completes successfully
 * but nodes inside expanded containers remain invisible to ReactFlowBridge.
 */

import { createVisualizationState } from '../core/VisualizationState';

describe('Search Expansion Node Visibility Bug', () => {
  test('search expansion should make nodes inside containers visible', () => {
    // Create a visualization state with containers and nodes
    const visState = createVisualizationState();
    
    // Add a container
    visState.addContainer('container1', {
      label: 'Test Container',
      collapsed: true, // Start collapsed
      children: ['node1', 'node2']
    });
    
    // Add nodes inside the container
    visState.addGraphNode('node1', {
      label: 'Node 1',
      type: 'operator'
    });
    
    visState.addGraphNode('node2', {
      label: 'Node 2', 
      type: 'operator'
    });
    
    // Initially, nodes should be hidden because container is collapsed
    console.log('=== INITIAL STATE ===');
    console.log('Visible nodes count:', visState.visibleNodes.length);
    console.log('Container collapsed:', visState.getContainer('container1')?.collapsed);
    
    expect(visState.visibleNodes.length).toBe(0);
    expect(visState.getContainer('container1')?.collapsed).toBe(true);
    
    // Simulate search expansion - this is what should happen during search
    console.log('=== EXPANDING CONTAINER ===');
    visState.expandContainer('container1');
    
    // After expansion, nodes should be visible
    console.log('=== AFTER EXPANSION ===');
    console.log('Visible nodes count:', visState.visibleNodes.length);
    console.log('Container collapsed:', visState.getContainer('container1')?.collapsed);
    console.log('Visible nodes:', visState.visibleNodes.map(n => n.id));
    
    // This is the assertion that should pass but might fail due to the bug
    expect(visState.visibleNodes.length).toBe(2);
    expect(visState.getContainer('container1')?.collapsed).toBe(false);
    
    // Verify specific nodes are visible
    const visibleNodeIds = visState.visibleNodes.map(n => n.id);
    expect(visibleNodeIds).toContain('node1');
    expect(visibleNodeIds).toContain('node2');
  });
  
  test('search expansion should work with real search flow', () => {
    // Create a simpler scenario that mimics the real search flow
    const visState = createVisualizationState();
    
    // Add a container with nodes (like the real data)
    visState.addContainer('bt_86', {
      label: 'leader_election',
      collapsed: true,
      children: ['node18', 'node19', 'node20']
    });
    
    // Add nodes inside the container
    visState.addGraphNode('node18', { label: 'Node 18', type: 'operator' });
    visState.addGraphNode('node19', { label: 'Node 19', type: 'operator' });
    visState.addGraphNode('node20', { label: 'Node 20', type: 'operator' });
    
    // Initially no nodes visible (container is collapsed)
    console.log('=== INITIAL STATE ===');
    console.log('Visible nodes count:', visState.visibleNodes.length);
    expect(visState.visibleNodes.length).toBe(0);
    
    // Simulate what search expansion should do
    // This mimics the search finding "leader_election" and expanding bt_86
    console.log('=== SIMULATING SEARCH EXPANSION ===');
    visState.expandContainer('bt_86');
    
    // After expansion, nodes should be visible for ReactFlowBridge
    console.log('=== AFTER EXPANSION ===');
    console.log('Visible nodes count:', visState.visibleNodes.length);
    console.log('Visible nodes:', visState.visibleNodes.map(n => n.id));
    
    // This is the critical assertion - nodes must be visible for ReactFlowBridge
    expect(visState.visibleNodes.length).toBe(3);
    
    // Verify the specific nodes are visible
    const visibleNodeIds = visState.visibleNodes.map(n => n.id);
    expect(visibleNodeIds).toContain('node18');
    expect(visibleNodeIds).toContain('node19');
    expect(visibleNodeIds).toContain('node20');
    
    console.log('✅ Search expansion correctly makes nodes visible');
  });

  test('validates search visibility invariants', () => {
    // Test the core search invariant: matched containers should remain collapsed
    const visState = createVisualizationState();
    
    // Create simple hierarchy
    visState.addContainer('parent', {
      label: 'Parent Container',
      collapsed: true,
      children: ['match_container', 'match_node']
    });
    
    visState.addContainer('match_container', {
      label: 'leader_election', // This will be a search match
      collapsed: true,
      children: []
    });
    
    visState.addGraphNode('match_node', { 
      label: 'p_leader_heartbeat', // This will be a search match
      type: 'operator' 
    });
    
    // Simulate search matches
    const searchMatches = [
      { id: 'match_container', type: 'container' as const }, // Container match
      { id: 'match_node', type: 'node' as const }            // Node match
    ];
    
    // Get expansion keys with search invariants
    const currentCollapsed = new Set(['parent', 'match_container']);
    const expansionKeys = visState.getSearchExpansionKeys(searchMatches, currentCollapsed);
    
    console.log('Expansion keys:', expansionKeys);
    
    // The key insight: match_container should NOT be in expansion keys
    expect(expansionKeys).toContain('parent');        // Parent should be expanded
    expect(expansionKeys).not.toContain('match_container'); // Matched container should stay collapsed
    
    console.log('✅ Search invariant validated: matched containers stay collapsed');
  });
});