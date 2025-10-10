/**
 * Test direct container operations without AsyncCoordinator
 * This isolates whether the issue is in core logic or coordination layer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { loadPaxosTestData } from "../utils/testData.js";

describe("Direct Container Operations (Bypass AsyncCoordinator)", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});

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
        children: new Set(["n1", "n2"]),
        collapsed: true,
        hidden: false,
      },
    ];

    // Add all data to state
    for (const node of nodes) {
      state.addNode(node);
    }
    for (const container of containers) {
      state.addContainer(container);
    }
    for (const edge of edges) {
      state.addEdge(edge);
    }
  });

  describe("Core Container Operations", () => {
    it("should expand and collapse containers directly", () => {
      // Get initial container state
      const initialContainers = state.visibleContainers;
      const collapsedContainer = initialContainers.find((c) => c.collapsed);

      expect(collapsedContainer).toBeDefined();
      console.log(
        `[DirectTest] 📦 Found collapsed container: ${collapsedContainer!.id}`,
      );

      // Expand container directly
      state._expandContainerForCoordinator(collapsedContainer!.id);

      // Check container is expanded
      const expandedContainer = state.visibleContainers.find(
        (c) => c.id === collapsedContainer!.id,
      );
      expect(expandedContainer?.collapsed).toBe(false);
      console.log(
        `[DirectTest] ✅ Container ${collapsedContainer!.id} expanded successfully`,
      );

      // Collapse container directly
      state._collapseContainerForCoordinator(collapsedContainer!.id);

      // Check container is collapsed
      const reCollapsedContainer = state.visibleContainers.find(
        (c) => c.id === collapsedContainer!.id,
      );
      expect(reCollapsedContainer?.collapsed).toBe(true);
      console.log(
        `[DirectTest] ✅ Container ${collapsedContainer!.id} collapsed successfully`,
      );
    });

    it("should maintain edge consistency during direct operations", () => {
      // Get initial state
      const initialReactFlowData = reactFlowBridge.toReactFlowData(state);
      const initialEdges = initialReactFlowData.edges;

      console.log(`[DirectTest] 📊 Initial edges: ${initialEdges.length}`);

      // Find a collapsed container
      const collapsedContainer = state.visibleContainers.find(
        (c) => c.collapsed,
      );
      expect(collapsedContainer).toBeDefined();

      // Expand container directly
      state._expandContainerForCoordinator(collapsedContainer!.id);

      // Get ReactFlow data after expand
      const expandedReactFlowData = reactFlowBridge.toReactFlowData(state);
      const expandedEdges = expandedReactFlowData.edges;

      console.log(
        `[DirectTest] 📊 Edges after expand: ${expandedEdges.length}`,
      );

      // Collapse container directly
      state._collapseContainerForCoordinator(collapsedContainer!.id);

      // Get ReactFlow data after collapse
      const collapsedReactFlowData = reactFlowBridge.toReactFlowData(state);
      const collapsedEdges = collapsedReactFlowData.edges;

      console.log(
        `[DirectTest] 📊 Edges after collapse: ${collapsedEdges.length}`,
      );

      // Check edge consistency
      expect(collapsedEdges.length).toBe(initialEdges.length);

      // Check that all initial edges are present after the cycle
      const initialEdgeIds = new Set(initialEdges.map((e) => e.id));
      const finalEdgeIds = new Set(collapsedEdges.map((e) => e.id));

      const missingEdges = [...initialEdgeIds].filter(
        (id) => !finalEdgeIds.has(id),
      );
      const extraEdges = [...finalEdgeIds].filter(
        (id) => !initialEdgeIds.has(id),
      );

      console.log(
        `[DirectTest] 🔍 Missing edges: ${missingEdges.length}`,
        missingEdges,
      );
      console.log(
        `[DirectTest] 🔍 Extra edges: ${extraEdges.length}`,
        extraEdges,
      );

      expect(missingEdges.length).toBe(0);
      expect(extraEdges.length).toBe(0);
    });

    it("should handle multiple expand/collapse cycles", () => {
      const collapsedContainer = state.visibleContainers.find(
        (c) => c.collapsed,
      );
      expect(collapsedContainer).toBeDefined();

      // Perform multiple cycles
      for (let i = 0; i < 3; i++) {
        console.log(`[DirectTest] 🔄 Cycle ${i + 1}`);

        // Expand
        state._expandContainerForCoordinator(collapsedContainer!.id);
        const expandedData = reactFlowBridge.toReactFlowData(state);
        console.log(
          `[DirectTest] 📊 Cycle ${i + 1} - Expanded edges: ${expandedData.edges.length}`,
        );

        // Collapse
        state._collapseContainerForCoordinator(collapsedContainer!.id);
        const collapsedData = reactFlowBridge.toReactFlowData(state);
        console.log(
          `[DirectTest] 📊 Cycle ${i + 1} - Collapsed edges: ${collapsedData.edges.length}`,
        );

        // Check container state
        const container = state.visibleContainers.find(
          (c) => c.id === collapsedContainer!.id,
        );
        expect(container?.collapsed).toBe(true);
      }
    });
  });

  describe("Edge Aggregation Logic", () => {
    it("should create consistent aggregated edge IDs", () => {
      const collapsedContainer = state.visibleContainers.find(
        (c) => c.collapsed,
      );
      expect(collapsedContainer).toBeDefined();

      // Get initial aggregated edges
      const initialData = reactFlowBridge.toReactFlowData(state);
      const initialAggregatedEdges = initialData.edges.filter(
        (e) => e.data?.isAggregated,
      );

      console.log(
        `[DirectTest] 📊 Initial aggregated edges: ${initialAggregatedEdges.length}`,
      );
      initialAggregatedEdges.forEach((edge) => {
        console.log(
          `[DirectTest] 🔗 Initial aggregated edge: ${edge.id} (${edge.source} -> ${edge.target})`,
        );
      });

      // Expand and collapse
      state._expandContainerForCoordinator(collapsedContainer!.id);
      state._collapseContainerForCoordinator(collapsedContainer!.id);

      // Get final aggregated edges
      const finalData = reactFlowBridge.toReactFlowData(state);
      const finalAggregatedEdges = finalData.edges.filter(
        (e) => e.data?.isAggregated,
      );

      console.log(
        `[DirectTest] 📊 Final aggregated edges: ${finalAggregatedEdges.length}`,
      );
      finalAggregatedEdges.forEach((edge) => {
        console.log(
          `[DirectTest] 🔗 Final aggregated edge: ${edge.id} (${edge.source} -> ${edge.target})`,
        );
      });

      // Check consistency
      expect(finalAggregatedEdges.length).toBe(initialAggregatedEdges.length);

      const initialIds = new Set(initialAggregatedEdges.map((e) => e.id));
      const finalIds = new Set(finalAggregatedEdges.map((e) => e.id));

      expect(finalIds).toEqual(initialIds);
    });
  });
});
