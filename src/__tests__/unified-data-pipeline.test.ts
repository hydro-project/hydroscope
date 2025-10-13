/**
 * Test to verify the unified data processing pipeline works for all scenarios
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Unified Data Processing Pipeline", () => {
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

  function createTestDataWithHierarchies(): HydroscopeData {
    return {
      nodes: [
        { id: "node1", label: "Node 1", type: "default" },
        { id: "node2", label: "Node 2", type: "default" },
        { id: "node3", label: "Node 3", type: "default" },
        { id: "node4", label: "Node 4", type: "default" },
        { id: "node5", label: "Node 5", type: "default" },
        { id: "node6", label: "Node 6", type: "default" },
        { id: "node7", label: "Node 7", type: "default" },
        { id: "node8", label: "Node 8", type: "default" },
        { id: "node9", label: "Node 9", type: "default" },
        { id: "node10", label: "Node 10", type: "default" },
      ],
      edges: [],
      hierarchyChoices: [
        {
          id: "location",
          name: "By Location",
          children: [
            { id: "datacenter1", name: "Datacenter 1", children: [] },
            { id: "datacenter2", name: "Datacenter 2", children: [] },
          ],
        },
        {
          id: "service",
          name: "By Service",
          children: [
            { id: "web_service", name: "Web Service", children: [] },
            { id: "db_service", name: "Database Service", children: [] },
          ],
        },
      ],
      nodeAssignments: {
        location: {
          node1: "datacenter1",
          node2: "datacenter1",
          node3: "datacenter1",
          node4: "datacenter1",
          node5: "datacenter1",
          node6: "datacenter1",
          node7: "datacenter1",
          node8: "datacenter1", // 8 nodes in datacenter1 (> 7 threshold)
          node9: "datacenter2",
          node10: "datacenter2", // 2 nodes in datacenter2 (< 7 threshold)
        },
        service: {
          node1: "web_service",
          node2: "web_service",
          node3: "web_service",
          node4: "web_service",
          node5: "web_service",
          node6: "web_service",
          node7: "web_service",
          node8: "web_service",
          node9: "web_service", // 9 nodes in web_service (> 7 threshold)
          node10: "db_service", // 1 node in db_service (< 7 threshold)
        },
      },
    };
  }

  /**
   * Simulate the unified data processing pipeline that HydroscopeCore uses
   */
  async function simulateUnifiedPipeline(
    data: HydroscopeData,
    reason: "initial_load" | "file_load" | "hierarchy_change",
  ) {
    console.log(`🚀 Simulating unified data processing pipeline: ${reason}`);

    // Track smart collapse calls
    const originalPerformSmartCollapse = state.performSmartCollapse;
    let smartCollapseCallCount = 0;
    state.performSmartCollapse = function (budgetOverride?: number) {
      smartCollapseCallCount++;
      console.log(
        `🎯 SMART COLLAPSE CALLED for ${reason} (call #${smartCollapseCallCount})`,
      );
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };

    // CRITICAL: Reset layout state for ALL data changes (this is the key fix)
    state.resetLayoutState();
    console.log(
      `🔄 Reset layout state for ${reason} - smart collapse will run on next layout`,
    );

    // Parse data
    await parser.parseData(data, state);

    // Execute pipeline
    const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(
      state,
      {
        relayoutEntities: undefined, // Full layout for data changes
        fitView: false, // Skip fitView for tests
      },
    );

    return { smartCollapseCallCount, reactFlowData };
  }

  it("should run smart collapse for initial load", async () => {
    console.log("🧪 Testing unified pipeline: initial load");

    const data = createTestDataWithHierarchies();
    const result = await simulateUnifiedPipeline(data, "initial_load");

    // Verify smart collapse ran
    expect(result.smartCollapseCallCount).toBe(1);

    // Check that large containers were collapsed
    const datacenter1 = state.getContainer("datacenter1"); // 8 nodes > 7 threshold
    const datacenter2 = state.getContainer("datacenter2"); // 2 nodes < 7 threshold

    console.log(`📊 After initial load:`);
    console.log(`  Datacenter1 (8 nodes): collapsed=${datacenter1?.collapsed}`);
    console.log(`  Datacenter2 (2 nodes): collapsed=${datacenter2?.collapsed}`);

    expect(datacenter1?.collapsed).toBe(true); // Should be collapsed
    expect(datacenter2?.collapsed).toBe(false); // Should remain expanded
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should be disabled after first layout
  });

  it("should run smart collapse for file load", async () => {
    console.log("🧪 Testing unified pipeline: file load");

    // First, simulate initial load
    const initialData = createTestDataWithHierarchies();
    await simulateUnifiedPipeline(initialData, "initial_load");

    // Verify smart collapse is disabled
    expect(state.shouldRunSmartCollapse()).toBe(false);

    // Now simulate loading a new file (different data)
    const newFileData = {
      ...createTestDataWithHierarchies(),
      nodes: [
        ...createTestDataWithHierarchies().nodes,
        { id: "node11", label: "Node 11", type: "default" },
        { id: "node12", label: "Node 12", type: "default" },
      ],
    };

    const result = await simulateUnifiedPipeline(newFileData, "file_load");

    // Verify smart collapse ran again for new file
    expect(result.smartCollapseCallCount).toBe(1); // New call count for this simulation
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should be disabled again

    console.log("✅ Smart collapse ran correctly for file load");
  });

  it("should run smart collapse for hierarchy change", async () => {
    console.log("🧪 Testing unified pipeline: hierarchy change");

    // First, simulate initial load with location hierarchy
    const data = createTestDataWithHierarchies();
    await simulateUnifiedPipeline(data, "initial_load");

    // Check initial state (location hierarchy)
    const datacenter1 = state.getContainer("datacenter1");
    const datacenter2 = state.getContainer("datacenter2");

    console.log(`📊 After initial load (location hierarchy):`);
    console.log(`  Datacenter1 (8 nodes): collapsed=${datacenter1?.collapsed}`);
    console.log(`  Datacenter2 (2 nodes): collapsed=${datacenter2?.collapsed}`);

    expect(datacenter1?.collapsed).toBe(true);
    expect(datacenter2?.collapsed).toBe(false);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    // Now simulate hierarchy change to service hierarchy
    // This simulates what happens when user selects different hierarchy in UI
    const hierarchyChangedData = {
      ...data,
      hierarchyChoices: [
        data.hierarchyChoices[1], // Move service hierarchy to front (selected)
        data.hierarchyChoices[0], // Move location hierarchy to back
      ],
    };

    const result = await simulateUnifiedPipeline(
      hierarchyChangedData,
      "hierarchy_change",
    );

    // Verify smart collapse ran again for hierarchy change
    expect(result.smartCollapseCallCount).toBe(1); // New call count for this simulation

    // Check new hierarchy state (service hierarchy)
    const webService = state.getContainer("web_service"); // 9 nodes > 7 threshold
    const dbService = state.getContainer("db_service"); // 1 node < 7 threshold

    console.log(`📊 After hierarchy change (service hierarchy):`);
    console.log(`  Web Service (9 nodes): collapsed=${webService?.collapsed}`);
    console.log(`  DB Service (1 node): collapsed=${dbService?.collapsed}`);

    expect(webService?.collapsed).toBe(true); // Should be collapsed
    expect(dbService?.collapsed).toBe(false); // Should remain expanded
    expect(state.shouldRunSmartCollapse()).toBe(false); // Should be disabled again

    console.log("✅ Smart collapse ran correctly for hierarchy change");
  });

  it("should NOT run smart collapse without layout state reset", async () => {
    console.log("🧪 Testing that smart collapse requires layout state reset");

    // First, simulate initial load
    const data = createTestDataWithHierarchies();
    await simulateUnifiedPipeline(data, "initial_load");

    expect(state.shouldRunSmartCollapse()).toBe(false);

    // Now simulate data change WITHOUT reset (old buggy behavior)
    console.log("🔄 Simulating data change WITHOUT layout state reset (bug)");

    let smartCollapseCallCount = 0;
    const originalPerformSmartCollapse = state.performSmartCollapse;
    state.performSmartCollapse = function (budgetOverride?: number) {
      smartCollapseCallCount++;
      console.log(`🎯 SMART COLLAPSE CALLED (should not happen)`);
      return originalPerformSmartCollapse.call(this, budgetOverride);
    };

    // Parse new data without reset
    const newData = {
      ...data,
      nodes: [
        ...data.nodes,
        { id: "node11", label: "Node 11", type: "default" },
      ],
    };

    await parser.parseData(newData, state);
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });

    // Smart collapse should NOT have run
    expect(smartCollapseCallCount).toBe(0);
    expect(state.shouldRunSmartCollapse()).toBe(false);

    console.log(
      "❌ BUG DEMONSTRATED: Smart collapse did not run without layout state reset",
    );
  });
});
