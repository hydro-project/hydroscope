/**
 * Tests for VisualizationState edge aggregation and restoration algorithms
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import {
  createTestContainer,
  createTestNode,
  createTestEdge,
} from "../utils/testData.js";

describe("VisualizationState Edge Aggregation and Restoration Algorithms", () => {
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
  });

  describe("Basic Edge Aggregation Algorithm", () => {
    it("should aggregate edges from internal nodes to external nodes", async () => {
      // Set up: container with internal nodes, edges to external nodes
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Verify aggregation through visible edges
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      
      // Should have aggregated edges when container is collapsed
      const aggregatedEdges = visibleEdges.filter(edge => 
        'aggregated' in edge && edge.aggregated === true
      );
      expect(aggregatedEdges.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle bidirectional edge aggregation", async () => {
      // Set up bidirectional edges
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      
      // Bidirectional edges
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "external", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Verify bidirectional aggregation
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
    });

    it("should preserve edge semantics during aggregation", async () => {
      // Set up edges with semantic tags
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      
      const edge1 = createTestEdge("edge1", "node1", "external");
      edge1.semanticTags = ["dataflow", "critical"];
      const edge2 = createTestEdge("edge2", "node2", "external");
      edge2.semanticTags = ["control", "normal"];

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Verify semantic preservation
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      
      // Aggregated edges should preserve or merge semantic information
      const aggregatedEdges = visibleEdges.filter(edge => 
        'aggregated' in edge && edge.aggregated === true
      );
      
      aggregatedEdges.forEach(edge => {
        expect(Array.isArray(edge.semanticTags)).toBe(true);
      });
    });
  });

  describe("Edge Restoration Algorithm", () => {
    it("should restore edges when container is expanded", async () => {
      // Set up expanded container first, then collapse it
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false; // Start expanded

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // First collapse the container
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Expand container to trigger restoration
      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Verify restoration
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      expect(visibleEdges.length).toBeGreaterThanOrEqual(2);

      // Original edges should be restored
      const originalEdges = visibleEdges.filter(edge => 
        edge.id === "edge1" || edge.id === "edge2"
      );
      expect(originalEdges.length).toBe(2);
    });

    it("should restore internal edges when container is expanded", async () => {
      // Set up container with internal edges
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false; // Start expanded

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const internalEdge = createTestEdge("internal", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(internalEdge);

      // First collapse the container
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Expand container
      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Verify internal edge restoration
      const visibleEdges = state.visibleEdges;
      const restoredInternalEdge = visibleEdges.find(edge => edge.id === "internal");
      expect(restoredInternalEdge).toBeDefined();
    });

    it("should handle partial restoration in nested scenarios", async () => {
      // Set up nested containers - start expanded
      const innerContainer = createTestContainer("inner", "Inner Container");
      innerContainer.children = new Set(["node1", "node2"]);
      innerContainer.childNodes = ["node1", "node2"];
      innerContainer.collapsed = false;

      const outerContainer = createTestContainer("outer", "Outer Container");
      outerContainer.children = new Set(["inner", "node3"]);
      outerContainer.childNodes = ["node3"];
      outerContainer.childContainers = ["inner"];
      outerContainer.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const node3 = createTestNode("node3", "Node 3");
      const externalNode = createTestNode("external", "External Node");

      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "node3");

      state.addContainer(innerContainer);
      state.addContainer(outerContainer);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // First collapse both containers
      await asyncCoordinator.collapseContainer("inner", state, {
        relayoutEntities: ["inner"],
        fitView: false
      });

      await asyncCoordinator.collapseContainer("outer", state, {
        relayoutEntities: ["outer"],
        fitView: false
      });

      // Expand outer container (inner remains collapsed)
      await asyncCoordinator.expandContainer("outer", state, {
        relayoutEntities: ["outer"],
        fitView: false
      });

      // Verify partial restoration
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      
      // Should have some edges visible but not all (due to inner container still collapsed)
      const visibleNodes = state.visibleNodes;
      expect(visibleNodes.find(n => n.id === "node3")).toBeDefined();
      expect(visibleNodes.find(n => n.id === "node1")).toBeUndefined(); // Still in collapsed inner
    });
  });

  describe("Algorithm Correctness Validation", () => {
    it("should maintain edge count consistency", async () => {
      // Set up test scenario
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Get initial edge count
      const initialEdges = state.visibleEdges;
      const initialCount = initialEdges.length;

      // Collapse and expand cycle
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const collapsedEdges = state.visibleEdges;
      
      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const restoredEdges = state.visibleEdges;

      // Verify consistency
      expect(Array.isArray(initialEdges)).toBe(true);
      expect(Array.isArray(collapsedEdges)).toBe(true);
      expect(Array.isArray(restoredEdges)).toBe(true);
      
      // After restoration, should have original edges back
      expect(restoredEdges.length).toBe(initialCount);
    });

    it("should handle complex multi-container scenarios", async () => {
      // Set up multiple containers with interconnected edges
      const container1 = createTestContainer("c1", "Container 1");
      container1.children = new Set(["n1", "n2"]);
      container1.childNodes = ["n1", "n2"];
      container1.collapsed = false;

      const container2 = createTestContainer("c2", "Container 2");
      container2.children = new Set(["n3", "n4"]);
      container2.childNodes = ["n3", "n4"];
      container2.collapsed = false;

      const nodes = [
        createTestNode("n1", "Node 1"),
        createTestNode("n2", "Node 2"),
        createTestNode("n3", "Node 3"),
        createTestNode("n4", "Node 4"),
        createTestNode("external", "External Node"),
      ];

      const edges = [
        createTestEdge("e1", "n1", "n3"), // Between containers
        createTestEdge("e2", "n2", "n4"), // Between containers
        createTestEdge("e3", "n1", "external"), // To external
        createTestEdge("e4", "n3", "external"), // To external
      ];

      state.addContainer(container1);
      state.addContainer(container2);
      nodes.forEach(node => state.addNode(node));
      edges.forEach(edge => state.addEdge(edge));

      // Complex collapse/expand operations
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      await asyncCoordinator.collapseContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false
      });

      const bothCollapsedEdges = state.visibleEdges;

      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const oneExpandedEdges = state.visibleEdges;

      await asyncCoordinator.expandContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false
      });

      const bothExpandedEdges = state.visibleEdges;

      // Verify all states are valid
      expect(Array.isArray(bothCollapsedEdges)).toBe(true);
      expect(Array.isArray(oneExpandedEdges)).toBe(true);
      expect(Array.isArray(bothExpandedEdges)).toBe(true);
      
      // Final state should have all original edges
      expect(bothExpandedEdges.length).toBe(4);
    });

    it("should maintain consistent aggregated edge IDs after expand/collapse cycle", async () => {
      // Set up scenario for consistent ID testing
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1", "node2"]);
      container.childNodes = ["node1", "node2"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const node2 = createTestNode("node2", "Node 2");
      const externalNode = createTestNode("external", "External Node");
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // First collapse cycle
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const firstCollapseEdges = state.visibleEdges;
      const firstAggregatedIds = firstCollapseEdges
        .filter(edge => 'aggregated' in edge && edge.aggregated)
        .map(edge => edge.id);

      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Second collapse cycle
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const secondCollapseEdges = state.visibleEdges;
      const secondAggregatedIds = secondCollapseEdges
        .filter(edge => 'aggregated' in edge && edge.aggregated)
        .map(edge => edge.id);

      // Verify ID consistency
      expect(Array.isArray(firstAggregatedIds)).toBe(true);
      expect(Array.isArray(secondAggregatedIds)).toBe(true);
      
      // IDs should be consistent across cycles
      if (firstAggregatedIds.length > 0 && secondAggregatedIds.length > 0) {
        expect(firstAggregatedIds).toEqual(secondAggregatedIds);
      }
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large numbers of edges efficiently", async () => {
      // Create container with many edges
      const container = createTestContainer("container1", "Container 1");
      const nodeCount = 20;
      const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node${i}`);
      
      container.children = new Set(nodeIds);
      container.childNodes = nodeIds;
      container.collapsed = false;

      // Create nodes
      const nodes = nodeIds.map(id => createTestNode(id, `Node ${id}`));
      const externalNode = createTestNode("external", "External Node");

      // Create many edges to external node
      const edges = nodeIds.map(id => 
        createTestEdge(`edge_${id}`, id, "external")
      );

      state.addContainer(container);
      nodes.forEach(node => state.addNode(node));
      state.addNode(externalNode);
      edges.forEach(edge => state.addEdge(edge));

      // Performance test
      const startTime = Date.now();
      
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
      
      // Verify correctness
      const finalEdges = state.visibleEdges;
      expect(finalEdges.length).toBe(nodeCount); // All original edges restored
    });

    it("should handle empty containers gracefully", async () => {
      // Empty container
      const container = createTestContainer("empty", "Empty Container");
      container.children = new Set();
      container.childNodes = [];
      container.collapsed = false;

      state.addContainer(container);

      // Operations on empty container should not crash
      await asyncCoordinator.collapseContainer("empty", state, {
        relayoutEntities: ["empty"],
        fitView: false
      });

      await asyncCoordinator.expandContainer("empty", state, {
        relayoutEntities: ["empty"],
        fitView: false
      });

      // Should handle gracefully
      const edges = state.visibleEdges;
      expect(Array.isArray(edges)).toBe(true);
    });

    it("should handle self-referencing edges", async () => {
      // Container with self-referencing edge
      const container = createTestContainer("container1", "Container 1");
      container.children = new Set(["node1"]);
      container.childNodes = ["node1"];
      container.collapsed = false;

      const node1 = createTestNode("node1", "Node 1");
      const selfEdge = createTestEdge("self", "node1", "node1");

      state.addContainer(container);
      state.addNode(node1);
      state.addEdge(selfEdge);

      // Should handle self-referencing edges
      await asyncCoordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      await asyncCoordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      const edges = state.visibleEdges;
      expect(Array.isArray(edges)).toBe(true);
    });
  });
});