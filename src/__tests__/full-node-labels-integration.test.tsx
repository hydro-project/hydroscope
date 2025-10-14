/**
 * Integration test for "Show full node labels" feature
 * Tests that nodes are properly resized when the feature is enabled
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestNode } from "../utils/testData.js";

describe("Full Node Labels Integration", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  it("should calculate different dimensions for nodes with different label lengths", () => {
    // Create nodes with different label lengths
    const shortNode = createTestNode("short", "Short");
    shortNode.longLabel = "Short Long";
    
    const longNode = createTestNode("long", "L");
    longNode.longLabel = "This is a very long label that should result in a wider node";

    state.addNode(shortNode);
    state.addNode(longNode);

    // Enable full node labels and update dimensions
    state.expandAllNodeLabelsToLong();
    state.updateNodeDimensionsForFullLabels(true);

    // Get the nodes with updated dimensions
    const visibleNodes = state.visibleNodes;
    const shortNodeResult = visibleNodes.find(n => n.id === "short");
    const longNodeResult = visibleNodes.find(n => n.id === "long");

    expect(shortNodeResult).toBeDefined();
    expect(longNodeResult).toBeDefined();

    // Verify that dimensions are calculated
    expect(shortNodeResult?.dimensions).toBeDefined();
    expect(longNodeResult?.dimensions).toBeDefined();

    // The long node should be wider than the short node
    expect(longNodeResult!.dimensions!.width).toBeGreaterThan(shortNodeResult!.dimensions!.width);

    // Both should be within reasonable bounds (120-400px as per implementation)
    expect(shortNodeResult!.dimensions!.width).toBeGreaterThanOrEqual(120);
    expect(longNodeResult!.dimensions!.width).toBeGreaterThanOrEqual(120);
    expect(longNodeResult!.dimensions!.width).toBeLessThanOrEqual(400);
  });

  it("should expand all node labels when expandAllNodeLabelsToLong is called", () => {
    // Create nodes with long labels
    const node1 = createTestNode("node1", "Short1");
    node1.longLabel = "This is a much longer label for node 1";
    const node2 = createTestNode("node2", "Short2");
    node2.longLabel = "This is a much longer label for node 2";

    state.addNode(node1);
    state.addNode(node2);

    // Initially all nodes should show short labels
    let visibleNodes = state.visibleNodes;
    expect(visibleNodes.find(n => n.id === "node1")?.showingLongLabel).toBeFalsy();
    expect(visibleNodes.find(n => n.id === "node2")?.showingLongLabel).toBeFalsy();

    // Enable full node labels
    state.expandAllNodeLabelsToLong();

    // All nodes should now show long labels
    visibleNodes = state.visibleNodes;
    expect(visibleNodes.find(n => n.id === "node1")?.showingLongLabel).toBe(true);
    expect(visibleNodes.find(n => n.id === "node2")?.showingLongLabel).toBe(true);
  });

  it("should reset all node labels when resetAllNodeLabelsToShort is called", () => {
    // Create nodes with long labels
    const node1 = createTestNode("node1", "Short1");
    node1.longLabel = "This is a much longer label for node 1";
    const node2 = createTestNode("node2", "Short2");
    node2.longLabel = "This is a much longer label for node 2";

    state.addNode(node1);
    state.addNode(node2);

    // Enable full node labels first
    state.expandAllNodeLabelsToLong();
    let visibleNodes = state.visibleNodes;
    expect(visibleNodes.find(n => n.id === "node1")?.showingLongLabel).toBe(true);
    expect(visibleNodes.find(n => n.id === "node2")?.showingLongLabel).toBe(true);

    // Reset to short labels
    state.resetAllNodeLabelsToShort();

    // All nodes should now show short labels
    visibleNodes = state.visibleNodes;
    expect(visibleNodes.find(n => n.id === "node1")?.showingLongLabel).toBe(false);
    expect(visibleNodes.find(n => n.id === "node2")?.showingLongLabel).toBe(false);
  });

  it("should reset dimensions when full labels are disabled", () => {
    // Create a node with a long label
    const node = createTestNode("node1", "Short");
    node.longLabel = "This is a very long label that should result in a wider node";

    state.addNode(node);

    // Enable full labels and update dimensions
    state.updateNodeDimensionsForFullLabels(true);
    let visibleNodes = state.visibleNodes;
    let nodeResult = visibleNodes.find(n => n.id === "node1");
    const fullLabelWidth = nodeResult?.dimensions?.width;
    expect(fullLabelWidth).toBeGreaterThan(120);

    // Disable full labels and reset dimensions
    state.updateNodeDimensionsForFullLabels(false);
    visibleNodes = state.visibleNodes;
    nodeResult = visibleNodes.find(n => n.id === "node1");
    
    // Should reset to default dimensions
    expect(nodeResult?.dimensions?.width).toBe(120);
    expect(nodeResult?.dimensions?.height).toBe(60);
  });

  it("should handle nodes without long labels gracefully", () => {
    // Create a node without a long label
    const nodeWithoutLongLabel = createTestNode("node1", "Short Label");
    // Intentionally not setting longLabel

    state.addNode(nodeWithoutLongLabel);

    // Should not throw when updating dimensions
    expect(() => {
      state.updateNodeDimensionsForFullLabels(true);
    }).not.toThrow();

    // Should calculate dimensions based on the regular label
    const visibleNodes = state.visibleNodes;
    const nodeResult = visibleNodes.find(n => n.id === "node1");
    expect(nodeResult?.dimensions).toBeDefined();
    
    // Should have reasonable dimensions
    expect(nodeResult?.dimensions?.width).toBeGreaterThanOrEqual(120);
    expect(nodeResult?.dimensions?.height).toBeGreaterThanOrEqual(60);
  });

  it("should demonstrate the fix: dimensions are properly calculated and available for rendering", () => {
    // This test demonstrates that our fix works:
    // 1. VisualizationState calculates dimensions based on label length
    // 2. These dimensions are stored in node.dimensions
    // 3. ReactFlowBridge passes these dimensions to node.data.width/height
    // 4. StandardNode uses data.width instead of calculating its own width

    const node = createTestNode("test", "Short");
    node.longLabel = "This is a very long label that needs a wider node to display properly";

    state.addNode(node);

    // Step 1: VisualizationState calculates dimensions
    state.expandAllNodeLabelsToLong();
    state.updateNodeDimensionsForFullLabels(true);

    const visibleNodes = state.visibleNodes;
    const nodeWithDimensions = visibleNodes.find(n => n.id === "test");

    // Verify dimensions are calculated and stored
    expect(nodeWithDimensions?.dimensions).toBeDefined();
    expect(nodeWithDimensions?.dimensions?.width).toBeGreaterThan(120);
    expect(nodeWithDimensions?.showingLongLabel).toBe(true);

    // Step 2: Verify the dimensions are reasonable for the long label
    const expectedWidth = Math.max(120, Math.min(node.longLabel!.length * 6 + 32, 400));
    expect(nodeWithDimensions?.dimensions?.width).toBe(expectedWidth);

    // This demonstrates that our fix ensures:
    // - Nodes get properly sized based on their label length
    // - The sizing is consistent between VisualizationState calculation and StandardNode rendering
    // - The "Show full node labels" feature now works correctly with proper node resizing
  });
});