/**
 * @fileoverview Regression test for smart collapse after bulk operations
 * 
 * This test verifies that smart collapse works correctly after a user performs
 * bulk operations (like collapseAll) and then loads new data. Previously,
 * bulk operations would disable smart collapse globally, preventing it from
 * running on new file loads.
 * 
 * Bug scenario:
 * 1. Load chat.json
 * 2. Click collapseAll (this disables smart collapse)
 * 3. Load paxos.json
 * 4. Smart collapse should still run for the new data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState.js';
import { AsyncCoordinator } from '../core/AsyncCoordinator.js';
import { ELKBridge } from '../bridges/ELKBridge.js';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge.js';

describe('Smart Collapse After Bulk Operations Regression', () => {
  let state: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({ algorithm: 'mrtree' });
    reactFlowBridge = new ReactFlowBridge({});
    
    // Set up AsyncCoordinator with bridges
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
  });

  const createTestContainer = (id: string, label: string, childCount: number = 50) => ({
    id,
    label,
    collapsed: false,
    children: new Set(Array.from({ length: childCount }, (_, i) => `${id}_child_${i}`)),
    semanticTags: [],
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 }
  });

  const createTestNode = (id: string, label: string) => ({
    id,
    label,
    semanticTags: [],
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 }
  });

  it('should run smart collapse on new file load even after user performed collapseAll', async () => {
    console.log('🧪 Testing smart collapse after bulk operations regression');

    // === STEP 1: Load initial data (simulating chat.json) ===
    console.log('📁 Step 1: Loading initial data (chat.json simulation)');
    
    // Create initial data with large containers that should trigger smart collapse
    const chatContainer1 = createTestContainer('chat_container1', 'Chat Container 1', 60); // Large
    const chatContainer2 = createTestContainer('chat_container2', 'Chat Container 2', 5);  // Small
    
    // Add containers and nodes
    state.addContainer(chatContainer1);
    state.addContainer(chatContainer2);
    
    // Add child nodes
    [...Array.from(chatContainer1.children), ...Array.from(chatContainer2.children)].forEach(nodeId => {
      state.addNode(createTestNode(nodeId, `Node ${nodeId}`));
    });

    // Reset layout state to simulate initial file load
    state.resetLayoutState();
    
    // Verify smart collapse is enabled for initial load
    expect(state.shouldRunSmartCollapse()).toBe(true);
    console.log('✅ Smart collapse enabled for initial load');

    // Simulate smart collapse running (large containers get collapsed)
    state.incrementLayoutCount(); // This disables smart collapse after first layout
    expect(state.shouldRunSmartCollapse()).toBe(false);
    console.log('✅ Smart collapse disabled after first layout (expected)');

    // === STEP 2: User performs collapseAll operation ===
    console.log('🔄 Step 2: User performs collapseAll operation');
    
    // This simulates the user clicking the collapseAll button
    await asyncCoordinator.collapseAllContainers(state, {
      fitView: false // Don't trigger fitView for test
    });
    
    // Verify that collapseAll disabled smart collapse (this was the bug)
    expect(state.shouldRunSmartCollapse()).toBe(false);
    console.log('✅ Smart collapse disabled after collapseAll (expected)');

    // === STEP 3: Load new data (simulating paxos.json) ===
    console.log('📁 Step 3: Loading new data (paxos.json simulation)');
    
    // Clear existing data
    state.clear();
    
    // Create new data with different large containers
    const paxosContainer1 = createTestContainer('paxos_container1', 'Paxos Container 1', 80); // Large
    const paxosContainer2 = createTestContainer('paxos_container2', 'Paxos Container 2', 3);  // Small
    
    // Add new containers and nodes
    state.addContainer(paxosContainer1);
    state.addContainer(paxosContainer2);
    
    // Add child nodes
    [...Array.from(paxosContainer1.children), ...Array.from(paxosContainer2.children)].forEach(nodeId => {
      state.addNode(createTestNode(nodeId, `Node ${nodeId}`));
    });

    // === STEP 4: Reset layout state for new data (this is the fix) ===
    console.log('🔄 Step 4: Reset layout state for new data');
    
    // This simulates what happens when new data is loaded
    // The fix ensures that resetLayoutState() also resets smart collapse state
    state.resetLayoutState();
    
    // === STEP 5: Verify smart collapse is re-enabled for new data ===
    console.log('🎯 Step 5: Verify smart collapse works for new data');
    
    // CRITICAL: Smart collapse should be enabled again for the new data
    expect(state.shouldRunSmartCollapse()).toBe(true);
    console.log('✅ Smart collapse re-enabled for new data (this was the bug fix)');
    
    // Verify we're on the first layout for the new data
    expect(state.isFirstLayout()).toBe(true);
    console.log('✅ Confirmed this is the first layout for new data');
    
    // Simulate smart collapse running on the new data
    // Large containers should be collapsed, small ones should remain expanded
    if (state.shouldRunSmartCollapse()) {
      // Simulate the smart collapse logic
      const containers = state.visibleContainers;
      containers.forEach(container => {
        if (container.children.size > 50) {
          state._collapseContainerForCoordinator(container.id);
          console.log(`🎯 Smart collapse: Collapsed large container ${container.id} (${container.children.size} children)`);
        }
      });
    }
    
    // Increment layout count to mark that layout has run
    state.incrementLayoutCount();
    
    // Verify the results
    const paxosContainer1After = state.getContainer('paxos_container1');
    const paxosContainer2After = state.getContainer('paxos_container2');
    
    expect(paxosContainer1After?.collapsed).toBe(true);  // Large container should be collapsed
    expect(paxosContainer2After?.collapsed).toBe(false); // Small container should remain expanded
    
    console.log('🎉 SUCCESS: Smart collapse worked correctly after bulk operations!');
    console.log(`   - Large container (${paxosContainer1After?.children.size} children): ${paxosContainer1After?.collapsed ? 'COLLAPSED' : 'EXPANDED'}`);
    console.log(`   - Small container (${paxosContainer2After?.children.size} children): ${paxosContainer2After?.collapsed ? 'COLLAPSED' : 'EXPANDED'}`);
  });

  it('should reset smart collapse state when resetLayoutState is called', () => {
    console.log('🧪 Testing resetLayoutState resets smart collapse state');
    
    // Disable smart collapse (simulating user operations)
    state.disableSmartCollapseForUserOperations();
    expect(state.shouldRunSmartCollapse()).toBe(false);
    console.log('✅ Smart collapse disabled by user operations');
    
    // Reset layout state (this should re-enable smart collapse)
    state.resetLayoutState();
    
    // Verify smart collapse is re-enabled
    expect(state.shouldRunSmartCollapse()).toBe(true);
    console.log('✅ Smart collapse re-enabled after resetLayoutState');
    
    // Verify layout count is reset
    expect(state.isFirstLayout()).toBe(true);
    console.log('✅ Layout count reset to first layout');
  });

  it('should maintain smart collapse behavior across multiple file loads', async () => {
    console.log('🧪 Testing smart collapse across multiple file loads');
    
    // === File 1: Load and perform bulk operation ===
    const container1 = createTestContainer('file1_container', 'File 1 Container', 70);
    state.addContainer(container1);
    Array.from(container1.children).forEach(nodeId => {
      state.addNode(createTestNode(nodeId, `Node ${nodeId}`));
    });
    
    state.resetLayoutState();
    expect(state.shouldRunSmartCollapse()).toBe(true);
    
    // Simulate smart collapse and layout
    state.incrementLayoutCount();
    expect(state.shouldRunSmartCollapse()).toBe(false);
    
    // User performs bulk operation
    await asyncCoordinator.expandAllContainers(state, { fitView: false });
    expect(state.shouldRunSmartCollapse()).toBe(false);
    
    // === File 2: Load new data ===
    state.clear();
    const container2 = createTestContainer('file2_container', 'File 2 Container', 90);
    state.addContainer(container2);
    Array.from(container2.children).forEach(nodeId => {
      state.addNode(createTestNode(nodeId, `Node ${nodeId}`));
    });
    
    state.resetLayoutState();
    expect(state.shouldRunSmartCollapse()).toBe(true);
    console.log('✅ Smart collapse enabled for second file');
    
    // === File 3: Load third data ===
    state.clear();
    const container3 = createTestContainer('file3_container', 'File 3 Container', 100);
    state.addContainer(container3);
    Array.from(container3.children).forEach(nodeId => {
      state.addNode(createTestNode(nodeId, `Node ${nodeId}`));
    });
    
    state.resetLayoutState();
    expect(state.shouldRunSmartCollapse()).toBe(true);
    console.log('✅ Smart collapse enabled for third file');
    
    console.log('🎉 SUCCESS: Smart collapse works correctly across multiple file loads');
  });
});