/**
 * Test to verify smart collapse runs on initialization
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Smart Collapse Initialization", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let parser: JSONParser;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({ algorithm: "layered" });
    parser = new JSONParser({ debug: false });
  });

  it("should run smart collapse on first layout with large containers", async () => {
    // Create test data with large containers that should trigger smart collapse
    const testData: HydroscopeData = {
      nodes: [],
      edges: [],
      hierarchyChoices: [
        {
          id: "test",
          name: "Test Hierarchy",
          children: [
            { id: "container1", name: "Container 1", children: [] },
            { id: "container2", name: "Container 2", children: [] },
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

    console.log("🧪 Testing smart collapse on initialization...");

    // Add debug logging to see what's happening
    const originalPerformSmartCollapse = state.performSmartCollapse;
    let smartCollapseWasCalled = false;
    state.performSmartCollapse = function (budgetOverride?: number) {
      console.log("🎯 SMART COLLAPSE WAS CALLED!");
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

    // Run layout (this should trigger smart collapse)
    console.log("\n🚀 Running ELK layout (should trigger smart collapse)...");
    await elkBridge.layout(state);

    // Check final state
    const container1After = state.getContainer("container1");
    const container2After = state.getContainer("container2");

    console.log(`\n✅ Final state after layout:`);
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

    // Verify smart collapse worked correctly
    expect(container1After?.collapsed).toBe(true); // Large container should be collapsed
    expect(container2After?.collapsed).toBe(false); // Small container should remain expanded
    expect(state.isFirstLayout()).toBe(false); // Layout count should be incremented
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should not run again

    console.log(
      "🎉 SUCCESS: Smart collapse worked correctly on initialization!",
    );
  });

  it("should not run smart collapse on subsequent layouts", async () => {
    // Create test data
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

    // Parse and run first layout
    await parser.parseData(testData, state);
    await elkBridge.layout(state); // First layout

    // Verify first layout completed
    expect(state.isFirstLayout()).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    // Add more nodes to trigger another layout
    const newNode = {
      id: "node3",
      label: "Node 3",
      type: "default",
      semanticTags: [],
    };
    state.addNode(newNode);

    // Run second layout
    console.log(
      "🔄 Running second layout (should NOT trigger smart collapse)...",
    );
    const container1Before = state.getContainer("container1");
    await elkBridge.layout(state);
    const container1After = state.getContainer("container1");

    // Container state should not change due to smart collapse
    expect(container1Before?.collapsed).toBe(container1After?.collapsed);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    console.log(
      "✅ SUCCESS: Smart collapse correctly skipped on subsequent layout!",
    );
  });
});
