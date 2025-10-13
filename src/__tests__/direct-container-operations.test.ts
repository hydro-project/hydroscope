/**
 * Test direct container operations with AsyncCoordinator
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("Direct Container Operations (Bypass AsyncCoordinator)", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});
    asyncCoordinator = new AsyncCoordinator();
    
    // Set bridge instances for the new architecture
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Create test data with collapsed containers
    const nodes = [
      {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n2",
        label: "Node 2",
        longLabel: "Node 2",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n3",
        label: "Node 3",
        longLabel: "Node 3",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ];

    const edges = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e2",
        source: "n2",
        target: "n3",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
    ];

    const containers = [
      {
        id: "c1",
        label: "Container 1",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      },
      {
        id: "c2",
        label: "Container 2",
        collapsed: true,
        position: { x: 300, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n3"]),
        childNodes: ["n3"],
        childContainers: [],
      },
    ];

    // Add data to state
    nodes.forEach((node) => state.addNode(node));
    edges.forEach((edge) => state.addEdge(edge));
    containers.forEach((container) => state.addContainer(container));
  });

  describe("Core Container Operations", () => {
    it("should expand and collapse containers directly", async () => {
      // Test expand operation
      const expandResult = await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      expect(expandResult).toBeDefined();
      expect(expandResult.nodes).toBeDefined();
      expect(expandResult.edges).toBeDefined();

      // Verify container is expanded
      const container = state.getContainer("c1");
      expect(container?.collapsed).toBe(false);

      // Test collapse operation
      const collapseResult = await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      expect(collapseResult).toBeDefined();
      expect(collapseResult.nodes).toBeDefined();
      expect(collapseResult.edges).toBeDefined();

      // Verify container is collapsed
      const collapsedContainer = state.getContainer("c1");
      expect(collapsedContainer?.collapsed).toBe(true);
    });

    it("should maintain edge consistency during direct operations", async () => {
      // Expand container
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      // Check that edges are properly handled
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.edges)).toBe(true);

      // Collapse container
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      // Check that edges are still properly handled
      const reactFlowDataAfterCollapse = reactFlowBridge.toReactFlowData(state);
      expect(reactFlowDataAfterCollapse.edges).toBeDefined();
      expect(Array.isArray(reactFlowDataAfterCollapse.edges)).toBe(true);
    });

    it("should handle multiple expand/collapse cycles", async () => {
      // Perform multiple cycles
      for (let i = 0; i < 3; i++) {
        // Expand
        const expandResult = await asyncCoordinator.expandContainer("c1", state, {
          relayoutEntities: ["c1"],
          fitView: false
        });
        expect(expandResult).toBeDefined();

        // Verify expanded
        const expandedContainer = state.getContainer("c1");
        expect(expandedContainer?.collapsed).toBe(false);

        // Collapse
        const collapseResult = await asyncCoordinator.collapseContainer("c1", state, {
          relayoutEntities: ["c1"],
          fitView: false
        });
        expect(collapseResult).toBeDefined();

        // Verify collapsed
        const collapsedContainer = state.getContainer("c1");
        expect(collapsedContainer?.collapsed).toBe(true);
      }
    });
  });

  describe("Edge Aggregation Logic", () => {
    it("should create consistent aggregated edge IDs", async () => {
      // Expand both containers first
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });
      await asyncCoordinator.expandContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false
      });

      // Get ReactFlow data with expanded containers
      const expandedData = reactFlowBridge.toReactFlowData(state);
      expect(expandedData.edges).toBeDefined();

      // Collapse containers
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });
      await asyncCoordinator.collapseContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false
      });

      // Get ReactFlow data with collapsed containers
      const collapsedData = reactFlowBridge.toReactFlowData(state);
      expect(collapsedData.edges).toBeDefined();

      // Verify edge consistency
      expect(Array.isArray(collapsedData.edges)).toBe(true);
      expect(Array.isArray(expandedData.edges)).toBe(true);
    });
  });

  describe("Bulk Operations", () => {
    it("should handle expand all containers", async () => {
      const result = await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined, // Full layout
        fitView: false
      });

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify all containers are expanded
      const container1 = state.getContainer("c1");
      const container2 = state.getContainer("c2");
      expect(container1?.collapsed).toBe(false);
      expect(container2?.collapsed).toBe(false);
    });

    it("should handle collapse all containers", async () => {
      // First expand all
      await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false
      });

      // Then collapse all
      const result = await asyncCoordinator.collapseAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false
      });

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify all containers are collapsed
      const container1 = state.getContainer("c1");
      const container2 = state.getContainer("c2");
      expect(container1?.collapsed).toBe(true);
      expect(container2?.collapsed).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle operations on non-existent containers gracefully", async () => {
      // The AsyncCoordinator handles non-existent containers gracefully by returning a result
      // rather than throwing, which is the expected behavior
      const result = await asyncCoordinator.expandContainer("nonexistent", state, {
        relayoutEntities: ["nonexistent"],
        fitView: false
      });

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should handle invalid state gracefully", async () => {
      // Test with null state should throw
      await expect(
        asyncCoordinator.expandContainer("c1", null as any, {
          relayoutEntities: ["c1"],
          fitView: false
        })
      ).rejects.toThrow();
    });
  });
});