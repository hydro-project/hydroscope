/**
 * Test for edge distance validation threshold configuration
 */

import { vi } from "vitest";
import { LAYOUT_CONSTANTS } from "../shared/config.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestNode } from "../utils/testData.js";

describe("Edge Distance Validation Threshold", () => {
  let state: VisualizationState;
  let bridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    bridge = new ReactFlowBridge({});
  });

  it("should use configurable threshold for edge distance warnings", () => {
    // Verify the threshold is configurable and set to a reasonable value
    expect(LAYOUT_CONSTANTS.EDGE_DISTANCE_WARNING_THRESHOLD).toBe(5000);
    expect(LAYOUT_CONSTANTS.EDGE_DISTANCE_WARNING_THRESHOLD).toBeGreaterThan(
      2000,
    );
  });

  it("should not warn for edges under the threshold distance", () => {
    // Create nodes that are far apart but under the threshold
    const node1 = createTestNode("node1", "Node 1");
    const node2 = createTestNode("node2", "Node 2");

    // Position nodes 4000px apart (under 5000px threshold)
    node1.position = { x: 0, y: 0 };
    node2.position = { x: 4000, y: 0 };

    state.addNode(node1);
    state.addNode(node2);
    state.addEdge({
      id: "edge1",
      source: "node1",
      target: "node2",
      type: "dataflow",
      semanticTags: [],
      hidden: false,
    });

    // Spy on console.error to check if warnings are logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Convert to ReactFlow data - this triggers validation
      bridge.toReactFlowData(state);

      // Should not have logged any edge distance warnings
      const edgeDistanceWarnings = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes?.("very long edge distance"),
      );
      expect(edgeDistanceWarnings).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should not warn for edges over the threshold distance (validation disabled)", () => {
    // Create nodes that are far apart and over the threshold
    const node1 = createTestNode("node1", "Node 1");
    const node2 = createTestNode("node2", "Node 2");

    // Position nodes 6000px apart (over 5000px threshold)
    node1.position = { x: 0, y: 0 };
    node2.position = { x: 6000, y: 0 };

    state.addNode(node1);
    state.addNode(node2);
    state.addEdge({
      id: "edge1",
      source: "node1",
      target: "node2",
      type: "dataflow",
      semanticTags: [],
      hidden: false,
    });

    // Spy on console.error to check if warnings are logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Convert to ReactFlow data - validation is currently disabled
      bridge.toReactFlowData(state);

      // Should NOT have logged edge distance warnings (validation disabled)
      const edgeDistanceWarnings = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes?.("very long edge distance"),
      );
      expect(edgeDistanceWarnings.length).toBe(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should suppress validation warnings for large graphs", () => {
    // Create a large graph (more than 20 nodes)
    for (let i = 0; i < 25; i++) {
      const node = createTestNode(`node${i}`, `Node ${i}`);
      node.position = { x: i * 1000, y: 0 }; // Spread them out
      state.addNode(node);
    }

    // Set the total element count to simulate a large graph parsed by JSONParser
    state.setTotalElementCount(25); // 25 nodes, 0 containers

    // Add some edges with very long distances
    state.addEdge({
      id: "edge1",
      source: "node0",
      target: "node24", // 24000px apart - way over threshold
      type: "dataflow",
      semanticTags: [],
      hidden: false,
    });

    // Spy on console.error to check if warnings are logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Convert to ReactFlow data - this triggers validation
      bridge.toReactFlowData(state);

      // Should NOT have logged edge distance warnings for large graphs
      const edgeDistanceWarnings = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes?.("very long edge distance"),
      );
      expect(edgeDistanceWarnings).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
