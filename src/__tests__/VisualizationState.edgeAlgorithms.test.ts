/**
 * Tests for VisualizationState edge aggregation and restoration algorithms
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import {
  createTestContainer,
  createTestNode,
  createTestEdge,
} from "../utils/testData.js";

describe("VisualizationState Edge Aggregation and Restoration Algorithms", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  describe("Basic Edge Aggregation Algorithm", () => {
    it("should aggregate edges from internal nodes to external nodes", () => {
      // Set up: container with internal nodes, edges to external nodes
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const externalNode = createTestNode("external");
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      state.collapseContainerSystemOperation("container1");

      // Verify aggregation
      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      expect(
        aggEdge.source === "container1" || aggEdge.target === "container1",
      ).toBe(true);
      expect(
        aggEdge.source === "external" || aggEdge.target === "external",
      ).toBe(true);
      expect(aggEdge.originalEdgeIds).toContain("edge1");
      expect(aggEdge.originalEdgeIds).toContain("edge2");

      // Verify original edges are hidden
      expect(state.getGraphEdge("edge1")?.hidden).toBe(true);
      expect(state.getGraphEdge("edge2")?.hidden).toBe(true);
    });

    it("should hide internal edges completely", () => {
      // Set up: container with internal nodes and internal edges
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const internalEdge = createTestEdge("internal", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(internalEdge);

      // Collapse container
      state.collapseContainerSystemOperation("container1");

      // Internal edge should be hidden, not aggregated
      expect(state.getGraphEdge("internal")?.hidden).toBe(true);
      expect(state.getAggregatedEdges().length).toBe(0);
    });

    it("should handle bidirectional edges correctly", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");
      const edgeOut = createTestEdge("out", "node1", "external");
      const edgeIn = createTestEdge("in", "external", "node1");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edgeOut);
      state.addEdge(edgeIn);

      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(2); // Two separate aggregated edges for different directions
    });
  });

  describe("Multi-Container Edge Aggregation", () => {
    it("should handle edges between multiple collapsed containers", () => {
      const container1 = createTestContainer("container1", ["node1"]);
      const container2 = createTestContainer("container2", ["node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      // Collapse both containers
      state.collapseContainerSystemOperation("container1");
      state.collapseContainerSystemOperation("container2");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      console.log(
        `DEBUG: Aggregated edge: ${aggEdge.id}, source: ${aggEdge.source}, target: ${aggEdge.target}`,
      );
      expect(
        (aggEdge.source === "container1" && aggEdge.target === "container2") ||
          (aggEdge.source === "container2" && aggEdge.target === "container1"),
      ).toBe(true);
      expect(aggEdge.originalEdgeIds).toContain("edge1");
    });

    it("should handle partial container collapse scenarios", () => {
      const container1 = createTestContainer("container1", ["node1"]);
      const container2 = createTestContainer("container2", ["node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      // Collapse only one container
      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      expect(
        (aggEdge.source === "container1" && aggEdge.target === "node2") ||
          (aggEdge.source === "node2" && aggEdge.target === "container1"),
      ).toBe(true);
    });
  });

  describe("Nested Container Edge Aggregation", () => {
    it("should aggregate edges to outermost collapsed container", () => {
      const parentContainer = createTestContainer("parent", ["child"]);
      const childContainer = createTestContainer("child", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");
      const edge = createTestEdge("edge1", "node1", "external");

      // Add child container first, then parent
      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edge);

      // Collapse parent (should also collapse child)
      state.collapseContainerSystemOperation("parent");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      expect(aggEdge.source === "parent" || aggEdge.target === "parent").toBe(
        true,
      );
      expect(aggEdge.originalEdgeIds).toContain("edge1");
    });

    it("should handle complex nested hierarchies", () => {
      // Create a 3-level hierarchy: grandparent -> parent -> child -> node
      const grandparent = createTestContainer("grandparent", ["parent"]);
      const parent = createTestContainer("parent", ["child"]);
      const child = createTestContainer("child", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");
      const edge = createTestEdge("edge1", "node1", "external");

      // Add containers in order: child -> parent -> grandparent
      state.addContainer(child);
      state.addContainer(parent);
      state.addContainer(grandparent);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edge);

      // Collapse grandparent
      state.collapseContainerSystemOperation("grandparent");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      expect(
        aggEdge.source === "grandparent" || aggEdge.target === "grandparent",
      ).toBe(true);
    });
  });

  describe("Edge Restoration Algorithm", () => {
    it("should restore edges when container is expanded", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");
      const edge = createTestEdge("edge1", "node1", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edge);

      // Collapse then expand
      state.collapseContainerSystemOperation("container1");
      expect(state.getAggregatedEdges().length).toBe(1);
      expect(state.getGraphEdge("edge1")?.hidden).toBe(true);

      state.expandContainer("container1");

      // Edge should be restored
      expect(state.getAggregatedEdges().length).toBe(0);
      expect(state.getGraphEdge("edge1")?.hidden).toBe(false);
    });

    it("should restore internal edges when container is expanded", () => {
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const internalEdge = createTestEdge("internal", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(internalEdge);

      // Collapse then expand
      state.collapseContainerSystemOperation("container1");
      expect(state.getGraphEdge("internal")?.hidden).toBe(true);

      state.expandContainer("container1");

      // Internal edge should be restored
      expect(state.getGraphEdge("internal")?.hidden).toBe(false);
    });

    it("should handle partial restoration in nested scenarios", () => {
      const parentContainer = createTestContainer("parent", ["child"]);
      const childContainer = createTestContainer("child", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");
      const edge = createTestEdge("edge1", "node1", "external");

      // Add child container first, then parent
      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edge);

      // Collapse parent, then expand parent but child remains collapsed
      state.collapseContainerSystemOperation("parent");
      state.expandContainer("parent");

      // Edge should now be aggregated to child container instead of parent
      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      expect(aggEdge.source === "child" || aggEdge.target === "child").toBe(
        true,
      );
    });
  });

  describe("Performance Optimizations", () => {
    it("should efficiently handle large numbers of edges", () => {
      const container = createTestContainer("container1", []);
      const externalNode = createTestNode("external");
      const nodes = [];
      const edges = [];

      // Create 50 internal nodes with edges to external node
      for (let i = 0; i < 50; i++) {
        const nodeId = `node${i}`;
        const node = createTestNode(nodeId);
        const edge = createTestEdge(`edge${i}`, nodeId, "external");

        nodes.push(node);
        edges.push(edge);
        container.children.add(nodeId);
      }

      state.addContainer(container);
      state.addNode(externalNode);
      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));

      const startTime = performance.now();
      state.collapseContainerSystemOperation("container1");
      const endTime = performance.now();

      // Should complete quickly (less than 50ms for 50 edges)
      expect(endTime - startTime).toBeLessThan(50);

      // Should create single aggregated edge
      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);
      expect(aggregatedEdges[0].originalEdgeIds.length).toBe(50);
    });

    it("should optimize memory usage by merging edges with same endpoints", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");

      // Multiple edges between same endpoints
      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node1", "external");
      const edge3 = createTestEdge("edge3", "node1", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);
      state.addEdge(edge3);

      state.collapseContainerSystemOperation("container1");

      // Should merge into single aggregated edge
      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);
      expect(aggregatedEdges[0].originalEdgeIds.length).toBe(3);
    });
  });

  describe("Complex Aggregation Scenarios", () => {
    it("should handle mixed internal and external edges", () => {
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const externalNode = createTestNode("external");

      const internalEdge = createTestEdge("internal", "node1", "node2");
      const externalEdge1 = createTestEdge("external1", "node1", "external");
      const externalEdge2 = createTestEdge("external2", "node2", "external");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(internalEdge);
      state.addEdge(externalEdge1);
      state.addEdge(externalEdge2);

      state.collapseContainerSystemOperation("container1");

      // Internal edge should be hidden, external edges aggregated
      expect(state.getGraphEdge("internal")?.hidden).toBe(true);

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);
      expect(aggregatedEdges[0].originalEdgeIds).toContain("external1");
      expect(aggregatedEdges[0].originalEdgeIds).toContain("external2");
      expect(aggregatedEdges[0].originalEdgeIds).not.toContain("internal");
    });

    it("should handle re-aggregation when containers are collapsed in sequence", () => {
      const container1 = createTestContainer("container1", ["node1"]);
      const container2 = createTestContainer("container2", ["node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const externalNode = createTestNode("external");

      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "node2", "external");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse containers in sequence
      state.collapseContainerSystemOperation("container1");
      expect(state.getAggregatedEdges().length).toBe(1);

      state.collapseContainerSystemOperation("container2");
      expect(state.getAggregatedEdges().length).toBe(2);

      // Each container should have its own aggregated edge
      const aggEdges = state.getAggregatedEdges();
      const container1Edge = aggEdges.find(
        (e) => e.source === "container1" || e.target === "container1",
      );
      const container2Edge = aggEdges.find(
        (e) => e.source === "container2" || e.target === "container2",
      );

      expect(container1Edge).toBeDefined();
      expect(container2Edge).toBeDefined();
    });
  });

  describe("Algorithm Correctness Validation", () => {
    it("should maintain edge connectivity semantics", () => {
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const externalNode = createTestNode("external");

      const edge1 = createTestEdge("edge1", "node1", "external");
      edge1.semanticTags = ["important", "data-flow"];
      const edge2 = createTestEdge("edge2", "node2", "external");
      edge2.semanticTags = ["control-flow"];

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(1);

      const aggEdge = aggregatedEdges[0];
      // Should merge semantic tags from original edges
      expect(aggEdge.semanticTags).toContain("important");
      expect(aggEdge.semanticTags).toContain("data-flow");
      expect(aggEdge.semanticTags).toContain("control-flow");
    });

    it("should preserve edge directionality in aggregation", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const externalNode = createTestNode("external");

      const outgoingEdge = createTestEdge("outgoing", "node1", "external");
      const incomingEdge = createTestEdge("incoming", "external", "node1");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(externalNode);
      state.addEdge(outgoingEdge);
      state.addEdge(incomingEdge);

      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBe(2); // Should maintain directionality

      const outgoing = aggregatedEdges.find((e) => e.source === "container1");
      const incoming = aggregatedEdges.find((e) => e.target === "container1");

      expect(outgoing).toBeDefined();
      expect(incoming).toBeDefined();
    });

    it("should maintain consistent aggregated edge IDs after expand/collapse cycle", () => {
      // This test specifically addresses the bug where hyperEdges become disconnected
      // after expanding and then collapsing a container again
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const externalNode = createTestNode("external");

      const edge1 = createTestEdge("edge1", "node1", "external");
      const edge2 = createTestEdge("edge2", "external", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(externalNode);
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Initial collapse - capture the aggregated edge IDs
      state.collapseContainerSystemOperation("container1");
      const initialAggregatedEdges = state.getAggregatedEdges();
      const initialEdgeIds = initialAggregatedEdges.map((e) => e.id).sort();

      expect(initialAggregatedEdges.length).toBe(2);
      expect(initialEdgeIds).toEqual([
        "agg-container1-external",
        "agg-external-container1",
      ]);

      // Expand the container
      state.expandContainer("container1");
      expect(state.getAggregatedEdges().length).toBe(0);
      expect(state.getGraphEdge("edge1")?.hidden).toBe(false);
      expect(state.getGraphEdge("edge2")?.hidden).toBe(false);

      // Collapse again - the aggregated edge IDs should be identical
      state.collapseContainerSystemOperation("container1");
      const secondAggregatedEdges = state.getAggregatedEdges();
      const secondEdgeIds = secondAggregatedEdges.map((e) => e.id).sort();

      expect(secondAggregatedEdges.length).toBe(2);
      expect(secondEdgeIds).toEqual(initialEdgeIds);

      // Verify the edges have the same source/target relationships
      const initialOutgoing = initialAggregatedEdges.find(
        (e) => e.source === "container1",
      );
      const initialIncoming = initialAggregatedEdges.find(
        (e) => e.target === "container1",
      );
      const secondOutgoing = secondAggregatedEdges.find(
        (e) => e.source === "container1",
      );
      const secondIncoming = secondAggregatedEdges.find(
        (e) => e.target === "container1",
      );

      expect(initialOutgoing?.id).toBe(secondOutgoing?.id);
      expect(initialIncoming?.id).toBe(secondIncoming?.id);
      expect(initialOutgoing?.target).toBe(secondOutgoing?.target);
      expect(initialIncoming?.source).toBe(secondIncoming?.source);
    });
  });
});
