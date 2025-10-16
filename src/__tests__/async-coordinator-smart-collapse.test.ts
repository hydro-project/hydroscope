/**
 * Test to verify smart collapse runs through AsyncCoordinator pipeline
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("AsyncCoordinator Smart Collapse Integration", () => {
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

  it("should run smart collapse through AsyncCoordinator pipeline on initialization", async () => {
    // Create test data with large containers
    const testData: HydroscopeData = {
      nodes: [],
      edges: [],
      hierarchyChoices: [
        {
          id: "test",
          name: "Test Hierarchy",
          children: [
            { id: "container1", name: "Large Container", children: [] },
            { id: "container2", name: "Small Container", children: [] },
          ],
        },
      ],
      nodeAssignments: {
        test: {},
      },
    };

    // Create container1 with 10 children (> 7 threshold)
    for (let i = 0; i < 10; i++) {
      testData.nodes.push({
        id: `node_${i}`,
        label: `Node ${i}`,
        type: "default",
      });
      testData.nodeAssignments.test[`node_${i}`] = "container1";
    }

    // Create container2 with 3 children (< 7 threshold)
    for (let i = 10; i < 13; i++) {
      testData.nodes.push({
        id: `node_${i}`,
        label: `Node ${i}`,
        type: "default",
      });
      testData.nodeAssignments.test[`node_${i}`] = "container2";
    }

    console.log(
      "🧪 Testing smart collapse through AsyncCoordinator pipeline...",
    );

    // Add debug logging to track smart collapse
    const originalPerformSmartCollapse = state.performSmartCollapse;
    let smartCollapseWasCalled = false;
    state.performSmartCollapse = function (budgetOverride?: number) {
      console.log(
        "🎯 SMART COLLAPSE CALLED THROUGH ASYNC COORDINATOR PIPELINE!",
      );
      smartCollapseWasCalled = true;
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };

    // Parse data
    await parser.parseData(testData, state);

    // Check initial state
    const container1Before = state.getContainer("container1");
    const container2Before = state.getContainer("container2");

    console.log(`📊 Initial state:`);
    console.log(
      `  Container1 (10 children): collapsed=${container1Before?.collapsed}`,
    );
    console.log(
      `  Container2 (3 children): collapsed=${container2Before?.collapsed}`,
    );
    console.log(
      `  Should run smart collapse: ${state.shouldRunSmartCollapse()}`,
    );
    console.log(`  Is first layout: ${state.isFirstLayout()}`);

    // Verify initial conditions
    expect(container1Before?.collapsed).toBe(false);
    expect(container2Before?.collapsed).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(true);
    expect(state.isFirstLayout()).toBe(true);

    // Run AsyncCoordinator pipeline (this should trigger smart collapse)
    console.log(
      "\n🚀 Running AsyncCoordinator executeLayoutAndRenderPipeline...",
    );
    const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(
      state,
      {
        relayoutEntities: undefined, // Full layout for new data
        fitView: false, // Skip fitView for this test
      },
    );

    // Check final state
    const container1After = state.getContainer("container1");
    const container2After = state.getContainer("container2");

    console.log(`\n✅ Final state after AsyncCoordinator pipeline:`);
    console.log(
      `  Container1 (10 children): collapsed=${container1After?.collapsed}`,
    );
    console.log(
      `  Container2 (3 children): collapsed=${container2After?.collapsed}`,
    );
    console.log(`  Layout count: ${state.getLayoutState().layoutCount}`);
    console.log(
      `  Should run smart collapse now: ${state.shouldRunSmartCollapse()}`,
    );
    console.log(`  Smart collapse was called: ${smartCollapseWasCalled}`);
    console.log(`  ReactFlow nodes: ${reactFlowData?.nodes?.length || 0}`);

    // Verify smart collapse worked correctly through AsyncCoordinator
    expect(smartCollapseWasCalled).toBe(true); // Smart collapse should have been called
    expect(container1After?.collapsed).toBe(true); // Large container should be collapsed
    expect(container2After?.collapsed).toBe(false); // Small container should remain expanded
    expect(state.isFirstLayout()).toBe(false); // Layout count should be incremented
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should not run again
    expect(reactFlowData).toBeDefined(); // Should return valid ReactFlow data

    console.log(
      "🎉 SUCCESS: Smart collapse worked correctly through AsyncCoordinator pipeline!",
    );
  });

  it("should not run smart collapse on subsequent AsyncCoordinator operations", async () => {
    // Create simple test data
    const testData: HydroscopeData = {
      nodes: [
        { id: "node1", label: "Node 1", type: "default" },
        { id: "node2", label: "Node 2", type: "default" },
      ],
      edges: [],
      hierarchyChoices: [
        {
          id: "test",
          name: "Test Hierarchy",
          children: [{ id: "container1", name: "Container 1", children: [] }],
        },
      ],
      nodeAssignments: {
        test: {
          node1: "container1",
          node2: "container1",
        },
      },
    };

    // Parse and run first pipeline
    await parser.parseData(testData, state);
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });

    // Verify first layout completed
    expect(state.isFirstLayout()).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    // Add debug logging for second run
    let smartCollapseCalledOnSecondRun = false;
    const originalPerformSmartCollapse = state.performSmartCollapse;
    state.performSmartCollapse = function (budgetOverride?: number) {
      console.log("❌ SMART COLLAPSE CALLED ON SECOND RUN (should not happen)");
      smartCollapseCalledOnSecondRun = true;
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };

    // Run second pipeline operation
    console.log(
      "🔄 Running second AsyncCoordinator pipeline (should NOT trigger smart collapse)...",
    );
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });

    // Smart collapse should not have been called
    expect(smartCollapseCalledOnSecondRun).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    console.log(
      "✅ SUCCESS: Smart collapse correctly skipped on subsequent AsyncCoordinator operations!",
    );
  });
});
