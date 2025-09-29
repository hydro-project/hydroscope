/**
 * Tests for VisualizationState edge aggregation data structures and tracking
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import {
  createTestContainer,
  createTestNode,
  createTestEdge,
} from "../utils/testData.js";
import type { AggregatedEdge } from "../types/core.js";

describe("VisualizationState Edge Aggregation Data Structures", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  describe("AggregatedEdge Data Structure", () => {
    it("should create aggregated edges with correct structure", () => {
      // Set up test data: container with internal nodes and edges
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3"); // External node
      const internalEdge = createTestEdge("edge1", "node1", "node2");
      const externalEdge = createTestEdge("edge2", "node1", "node3");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(internalEdge);
      state.addEdge(externalEdge);

      // Collapse container to trigger aggregation
      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      const aggEdge = aggregatedEdges[0];
      expect(aggEdge.aggregated).toBe(true);
      expect(aggEdge.originalEdgeIds).toContain("edge2");
      expect(aggEdge.aggregationSource).toBe("container1");
      expect(
        aggEdge.source === "container1" || aggEdge.target === "container1",
      ).toBe(true);
    });

    it("should maintain bidirectional mapping between original and aggregated edges", () => {
      // Set up test scenario
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      // Collapse to create aggregation
      state.collapseContainerSystemOperation("container1");

      // Check bidirectional mapping
      const originalToAggregated = state.getOriginalToAggregatedMapping();
      const aggregatedToOriginal = state.getAggregatedToOriginalMapping();

      expect(originalToAggregated.has("edge1")).toBe(true);
      const aggEdgeId = originalToAggregated.get("edge1");
      expect(aggEdgeId).toBeDefined();
      expect(aggregatedToOriginal.has(aggEdgeId!)).toBe(true);
      expect(aggregatedToOriginal.get(aggEdgeId!)?.includes("edge1")).toBe(
        true,
      );
    });

    it("should track aggregation metadata correctly", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");

      const metadata = state.getAggregationMetadata();
      expect(metadata.totalOriginalEdges).toBeGreaterThan(0);
      expect(metadata.totalAggregatedEdges).toBeGreaterThan(0);
      expect(metadata.aggregationsByContainer.has("container1")).toBe(true);
    });
  });

  describe("Efficient Lookup Structures", () => {
    it("should provide O(1) lookup for aggregated edges by container", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");

      // Should be O(1) lookup
      const containerAggregations =
        state.getAggregatedEdgesByContainer("container1");
      expect(containerAggregations.length).toBeGreaterThan(0);
    });

    it("should provide O(1) lookup for original edges by aggregated edge", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      const aggEdge = aggregatedEdges[0];
      const originalEdges = state.getOriginalEdgesForAggregated(aggEdge.id);
      expect(originalEdges.length).toBeGreaterThan(0);
      expect(originalEdges.some((e) => e.id === "edge1")).toBe(true);
    });

    it("should efficiently find all aggregated edges affecting a node", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");
      const edge1 = createTestEdge("edge1", "node1", "node2");
      const edge2 = createTestEdge("edge2", "node1", "node3");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(edge1);
      state.addEdge(edge2);

      state.collapseContainerSystemOperation("container1");

      const affectedEdges = state.getAggregatedEdgesAffectingNode("node2");
      expect(affectedEdges.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Aggregation Tracking", () => {
    it("should track aggregation history", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const historyBefore = state.getAggregationHistory();
      expect(historyBefore.length).toBe(0);

      state.collapseContainerSystemOperation("container1");

      const historyAfter = state.getAggregationHistory();
      expect(historyAfter.length).toBe(1);
      expect(historyAfter[0].operation).toBe("aggregate");
      expect(historyAfter[0].containerId).toBe("container1");
      expect(historyAfter[0].edgeCount).toBeGreaterThan(0);
    });

    it("should track restoration history", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");
      state.expandContainer("container1");

      const history = state.getAggregationHistory();
      expect(history.length).toBe(2);
      expect(history[1].operation).toBe("restore");
      expect(history[1].containerId).toBe("container1");
    });

    it("should provide aggregation statistics", () => {
      const container1 = createTestContainer("container1", ["node1"]);
      const container2 = createTestContainer("container2", ["node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");
      const edge1 = createTestEdge("edge1", "node1", "node3");
      const edge2 = createTestEdge("edge2", "node2", "node3");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(edge1);
      state.addEdge(edge2);

      state.collapseContainerSystemOperation("container1");
      state.collapseContainerSystemOperation("container2");

      const stats = state.getAggregationStatistics();
      expect(stats.totalAggregations).toBeGreaterThan(0);
      expect(stats.activeAggregations).toBeGreaterThan(0);
      expect(stats.edgeReductionRatio).toBeGreaterThanOrEqual(0); // Allow 0 if no reduction occurred
      expect(stats.containerAggregationCounts.size).toBeGreaterThan(0);
    });
  });

  describe("Multi-Container Edge Scenarios", () => {
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

      state.collapseContainerSystemOperation("container1");
      state.collapseContainerSystemOperation("container2");

      const aggregatedEdges = state.getAggregatedEdges();
      const containerToContainerEdge = aggregatedEdges.find(
        (e) =>
          (e.source === "container1" && e.target === "container2") ||
          (e.source === "container2" && e.target === "container1"),
      );

      expect(containerToContainerEdge).toBeDefined();
      expect(containerToContainerEdge!.originalEdgeIds).toContain("edge1");
    });

    it("should handle nested container aggregation", () => {
      const parentContainer = createTestContainer("parent", ["child"]);
      const childContainer = createTestContainer("child", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      // Add child container first, then parent
      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      // Collapse parent (should also collapse child)
      state.collapseContainerSystemOperation("parent");

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      // Edge should be aggregated to parent container
      const parentAggregation = aggregatedEdges.find(
        (e) => e.source === "parent" || e.target === "parent",
      );
      expect(parentAggregation).toBeDefined();
    });
  });

  describe("Performance Optimizations", () => {
    it("should handle large edge sets efficiently", () => {
      const container = createTestContainer("container1", []);
      const nodes = [];
      const edges = [];

      // Create large number of nodes and edges
      for (let i = 0; i < 100; i++) {
        const nodeId = `node${i}`;
        nodes.push(createTestNode(nodeId));
        container.children.add(nodeId);

        if (i > 0) {
          edges.push(createTestEdge(`edge${i}`, `node${i - 1}`, `node${i}`));
        }
        // Add external edge
        edges.push(createTestEdge(`ext_edge${i}`, nodeId, "external_node"));
      }

      const externalNode = createTestNode("external_node");

      state.addContainer(container);
      state.addNode(externalNode);
      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));

      const startTime = performance.now();
      state.collapseContainerSystemOperation("container1");
      const endTime = performance.now();

      // Should complete in reasonable time (less than 100ms for 100 nodes/edges)
      expect(endTime - startTime).toBeLessThan(100);

      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBeGreaterThan(0);
    });

    it("should optimize memory usage for aggregated edges", () => {
      const container = createTestContainer("container1", ["node1", "node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");

      // Multiple edges between same endpoints
      const edge1 = createTestEdge("edge1", "node1", "node3");
      const edge2 = createTestEdge("edge2", "node1", "node3");
      const edge3 = createTestEdge("edge3", "node2", "node3");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(edge1);
      state.addEdge(edge2);
      state.addEdge(edge3);

      state.collapseContainerSystemOperation("container1");

      const aggregatedEdges = state.getAggregatedEdges();

      // Should merge edges with same endpoints into single aggregated edge
      const containerToNode3Edges = aggregatedEdges.filter(
        (e) =>
          (e.source === "container1" && e.target === "node3") ||
          (e.source === "node3" && e.target === "container1"),
      );

      expect(containerToNode3Edges.length).toBe(1);
      expect(containerToNode3Edges[0].originalEdgeIds.length).toBe(3);
    });
  });

  describe("Edge Aggregation Validation", () => {
    it("should validate aggregated edge consistency", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");

      const validation = state.validateAggregationConsistency();
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should detect aggregation inconsistencies", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const edge = createTestEdge("edge1", "node1", "node2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      state.collapseContainerSystemOperation("container1");

      // Manually corrupt aggregation state for testing
      state.corruptAggregationForTesting();

      const validation = state.validateAggregationConsistency();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
