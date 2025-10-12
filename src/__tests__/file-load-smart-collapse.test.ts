/**
 * Test to verify smart collapse runs when loading new files
 * This simulates the file upload widget scenario
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("File Load Smart Collapse", () => {
  let state: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let parser: JSONParser;

  beforeEach(() => {
    state = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({ algorithm: "layered" });
    reactFlowBridge = new ReactFlowBridge({
      nodeStyles: {},
      edgeStyles: {},
      semanticMappings: {},
      propertyMappings: {},
    });
    parser = new JSONParser({ debug: false });

    // Set up AsyncCoordinator with bridge instances
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
  });

  function createTestData(containerPrefix: string, largeContainerSize: number = 10): HydroscopeData {
    const testData: HydroscopeData = {
      nodes: [],
      edges: [],
      hierarchyChoices: [
        {
          id: "test",
          name: "Test Hierarchy",
          children: [
            { id: `${containerPrefix}_large`, name: "Large Container", children: [] },
            { id: `${containerPrefix}_small`, name: "Small Container", children: [] }
          ]
        }
      ],
      nodeAssignments: {
        test: {}
      }
    };

    // Create large container with many children (> 7 threshold)
    for (let i = 0; i < largeContainerSize; i++) {
      testData.nodes.push({
        id: `${containerPrefix}_node_${i}`,
        label: `Node ${i}`,
        type: "default"
      });
      testData.nodeAssignments.test[`${containerPrefix}_node_${i}`] = `${containerPrefix}_large`;
    }

    // Create small container with few children (< 7 threshold)
    for (let i = 0; i < 3; i++) {
      testData.nodes.push({
        id: `${containerPrefix}_small_node_${i}`,
        label: `Small Node ${i}`,
        type: "default"
      });
      testData.nodeAssignments.test[`${containerPrefix}_small_node_${i}`] = `${containerPrefix}_small`;
    }

    return testData;
  }

  it("should run smart collapse on initial file load", async () => {
    console.log('🧪 Testing smart collapse on initial file load...');
    
    // Create initial test data
    const initialData = createTestData("initial");
    
    // Add debug logging to track smart collapse
    const originalPerformSmartCollapse = state.performSmartCollapse;
    let smartCollapseCallCount = 0;
    state.performSmartCollapse = function(budgetOverride?: number) {
      smartCollapseCallCount++;
      console.log(`🎯 SMART COLLAPSE CALLED (call #${smartCollapseCallCount})`);
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };
    
    // Parse and process initial data
    await parser.parseData(initialData, state);
    
    console.log(`📊 Initial state:`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    console.log(`  Is first layout: ${state.isFirstLayout()}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    
    // Run initial layout
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, { fitView: false });
    
    // Check that smart collapse ran
    const largeContainer = state.getContainer('initial_large');
    const smallContainer = state.getContainer('initial_small');
    
    console.log(`✅ After initial load:`);
    console.log(`  Large container collapsed: ${largeContainer?.collapsed}`);
    console.log(`  Small container collapsed: ${smallContainer?.collapsed}`);
    console.log(`  Smart collapse call count: ${smartCollapseCallCount}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    console.log(`  Should run smart collapse now: ${state.shouldRunSmartCollapse()}`);
    
    // Verify smart collapse worked
    expect(smartCollapseCallCount).toBe(1);
    expect(largeContainer?.collapsed).toBe(true);
    expect(smallContainer?.collapsed).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(false);
  });

  it("should run smart collapse again when loading a new file", async () => {
    console.log('🧪 Testing smart collapse on new file load...');
    
    // Step 1: Load initial file
    const initialData = createTestData("initial");
    
    // Add debug logging to track smart collapse
    const originalPerformSmartCollapse = state.performSmartCollapse;
    let smartCollapseCallCount = 0;
    state.performSmartCollapse = function(budgetOverride?: number) {
      smartCollapseCallCount++;
      console.log(`🎯 SMART COLLAPSE CALLED (call #${smartCollapseCallCount})`);
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };
    
    await parser.parseData(initialData, state);
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, { fitView: false });
    
    console.log(`📊 After initial file load:`);
    console.log(`  Smart collapse call count: ${smartCollapseCallCount}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    
    // Verify initial state
    expect(smartCollapseCallCount).toBe(1);
    expect(state.shouldRunSmartCollapse()).toBe(false);
    
    // Step 2: Simulate loading a new file (this is the key fix)
    console.log('\n🔄 Loading new file...');
    
    // CRITICAL FIX: Reset layout state for new data (simulating HydroscopeCore fix)
    state.resetLayoutState();
    console.log('🔄 Reset layout state for new data - smart collapse should run again');
    
    const newData = createTestData("new", 12); // Even larger container
    
    console.log(`📊 After reset, before new data:`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    console.log(`  Is first layout: ${state.isFirstLayout()}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    
    // Parse new data
    await parser.parseData(newData, state);
    
    console.log(`📊 After parsing new data:`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    console.log(`  Is first layout: ${state.isFirstLayout()}`);
    
    // Run layout for new data
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, { fitView: false });
    
    // Check that smart collapse ran again
    const newLargeContainer = state.getContainer('new_large');
    const newSmallContainer = state.getContainer('new_small');
    
    console.log(`\n✅ After new file load:`);
    console.log(`  New large container collapsed: ${newLargeContainer?.collapsed}`);
    console.log(`  New small container collapsed: ${newSmallContainer?.collapsed}`);
    console.log(`  Smart collapse call count: ${smartCollapseCallCount}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    console.log(`  Should run smart collapse now: ${state.shouldRunSmartCollapse()}`);
    
    // Verify smart collapse ran again for new file
    expect(smartCollapseCallCount).toBe(2); // Should have been called twice
    expect(newLargeContainer?.collapsed).toBe(true); // New large container should be collapsed
    expect(newSmallContainer?.collapsed).toBe(false); // New small container should remain expanded
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should be disabled again
    
    console.log('🎉 SUCCESS: Smart collapse ran correctly on new file load!');
  });

  it("should NOT run smart collapse if layout state is not reset", async () => {
    console.log('🧪 Testing that smart collapse does NOT run without reset...');
    
    // Step 1: Load initial file
    const initialData = createTestData("initial");
    
    let smartCollapseCallCount = 0;
    const originalPerformSmartCollapse = state.performSmartCollapse;
    state.performSmartCollapse = function(budgetOverride?: number) {
      smartCollapseCallCount++;
      console.log(`🎯 SMART COLLAPSE CALLED (call #${smartCollapseCallCount})`);
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };
    
    await parser.parseData(initialData, state);
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, { fitView: false });
    
    expect(smartCollapseCallCount).toBe(1);
    expect(state.shouldRunSmartCollapse()).toBe(false);
    
    // Step 2: Load new file WITHOUT resetting layout state (old buggy behavior)
    console.log('\n🔄 Loading new file WITHOUT reset (simulating bug)...');
    
    const newData = createTestData("new", 12);
    
    console.log(`📊 Before new data (no reset):`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    console.log(`  Is first layout: ${state.isFirstLayout()}`);
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    
    // Parse new data without reset
    await parser.parseData(newData, state);
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, { fitView: false });
    
    console.log(`\n❌ After new file load (no reset):`);
    console.log(`  Smart collapse call count: ${smartCollapseCallCount}`);
    console.log(`  Should run smart collapse: ${state.shouldRunSmartCollapse()}`);
    
    // Verify smart collapse did NOT run again (demonstrating the bug)
    expect(smartCollapseCallCount).toBe(1); // Should still be 1, not 2
    expect(state.shouldRunSmartCollapse()).toBe(false);
    
    // The new large container should NOT be collapsed because smart collapse didn't run
    const newLargeContainer = state.getContainer('new_large');
    expect(newLargeContainer?.collapsed).toBe(false); // Bug: should be true but isn't
    
    console.log('❌ BUG DEMONSTRATED: Smart collapse did not run on new file load without reset');
  });
});