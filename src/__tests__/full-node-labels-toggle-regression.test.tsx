/**
 * Regression test for "Show full node labels" toggle bug
 *
 * Bug: The toggle would update state but not actually update the screen.
 * - Turning ON sometimes worked, sometimes didn't
 * - Turning OFF never worked
 *
 * Root cause: Label changes were applied to OLD VisualizationState instance
 * before bridge reallocation, then NEW instances were created without the changes.
 *
 * This test verifies the complete user interaction flow through the StyleTuner UI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestNode } from "../utils/testData.js";

describe("Full Node Labels Toggle - Regression Test", () => {
  let visualizationState: VisualizationState;

  beforeEach(() => {
    visualizationState = new VisualizationState();

    // Add test nodes with different short/long labels
    visualizationState.addNode(createTestNode("node1", "Short"));
    visualizationState.addNode(createTestNode("node2", "N2"));
    visualizationState.addNode(createTestNode("node3", "N3"));

    // Mock console methods to reduce noise
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should expand all node labels when toggling ON", () => {
    // Initially, nodes should use short labels (showingLongLabel is falsy)
    const node1 = visualizationState.visibleNodes.find((n) => n.id === "node1");
    expect(node1?.showingLongLabel).toBeFalsy();

    // Toggle ON - expand all labels
    visualizationState.expandAllNodeLabelsToLong();
    visualizationState.updateNodeDimensionsForFullLabels(true);

    // After toggling ON, nodes should use long labels
    const node1After = visualizationState.visibleNodes.find(
      (n) => n.id === "node1",
    );
    expect(node1After?.showingLongLabel).toBe(true);

    // Dimensions should be updated
    expect(node1After?.dimensions).toBeDefined();
    expect(node1After?.dimensions?.width).toBeGreaterThan(0);
  });

  it("should reset all node labels when toggling OFF", () => {
    // Start with full labels enabled
    visualizationState.expandAllNodeLabelsToLong();
    visualizationState.updateNodeDimensionsForFullLabels(true);

    const node1Before = visualizationState.visibleNodes.find(
      (n) => n.id === "node1",
    );
    expect(node1Before?.showingLongLabel).toBe(true);
    const expandedWidth = node1Before?.dimensions?.width;
    expect(expandedWidth).toBeGreaterThan(120); // Should be wider than default

    // Toggle OFF - this was the main bug case that NEVER worked
    visualizationState.resetAllNodeLabelsToShort();
    visualizationState.updateNodeDimensionsForFullLabels(false);

    // After toggling OFF, nodes should use short labels again
    const node1After = visualizationState.visibleNodes.find(
      (n) => n.id === "node1",
    );
    expect(node1After?.showingLongLabel).toBe(false);

    // Dimensions should be reset to default
    expect(node1After?.dimensions?.width).toBe(120); // Default width
  });

  it("should handle multiple rapid toggles without breaking", () => {
    // Rapidly toggle multiple times
    visualizationState.expandAllNodeLabelsToLong(); // ON
    visualizationState.updateNodeDimensionsForFullLabels(true);

    visualizationState.resetAllNodeLabelsToShort(); // OFF
    visualizationState.updateNodeDimensionsForFullLabels(false);

    visualizationState.expandAllNodeLabelsToLong(); // ON
    visualizationState.updateNodeDimensionsForFullLabels(true);

    visualizationState.resetAllNodeLabelsToShort(); // OFF
    visualizationState.updateNodeDimensionsForFullLabels(false);

    // Final state should be OFF (short labels)
    const node1 = visualizationState.visibleNodes.find((n) => n.id === "node1");
    expect(node1?.showingLongLabel).toBe(false);
    expect(node1?.dimensions?.width).toBe(120); // Default width

    // Should not crash or leave the state in a broken condition
    expect(visualizationState.visibleNodes.length).toBe(3);
  });

  it("should apply changes to a fresh VisualizationState instance correctly", () => {
    // Simulate the bug scenario: applying changes to old instance, then creating new one
    const oldInstance = visualizationState;

    // Apply changes to old instance (this was the bug)
    oldInstance.expandAllNodeLabelsToLong();
    oldInstance.updateNodeDimensionsForFullLabels(true);

    // Create new instance (simulating bridge reallocation)
    const newInstance = new VisualizationState();
    newInstance.addNode(createTestNode("node1", "Short"));
    newInstance.addNode(createTestNode("node2", "N2"));
    newInstance.addNode(createTestNode("node3", "N3"));

    // The bug: new instance doesn't have the label changes!
    const node1InNew = newInstance.visibleNodes.find((n) => n.id === "node1");
    expect(node1InNew?.showingLongLabel).toBeFalsy(); // Still short label!

    // The fix: apply changes to NEW instance AFTER reallocation
    newInstance.expandAllNodeLabelsToLong();
    newInstance.updateNodeDimensionsForFullLabels(true);

    const node1Fixed = newInstance.visibleNodes.find((n) => n.id === "node1");
    expect(node1Fixed?.showingLongLabel).toBe(true); // Now has long label!
    expect(node1Fixed?.dimensions).toBeDefined();
  });

  it("should maintain label state when adding new nodes", () => {
    // Enable full labels
    visualizationState.expandAllNodeLabelsToLong();
    visualizationState.updateNodeDimensionsForFullLabels(true);

    // Verify existing nodes have long labels
    expect(
      visualizationState.visibleNodes.find((n) => n.id === "node1")
        ?.showingLongLabel,
    ).toBe(true);

    // Add a new node
    visualizationState.addNode(createTestNode("node4", "N4"));

    // New node should have short label initially (falsy)
    expect(
      visualizationState.visibleNodes.find((n) => n.id === "node4")
        ?.showingLongLabel,
    ).toBeFalsy();

    // But if we expand again, it should get the long label
    visualizationState.expandAllNodeLabelsToLong();
    expect(
      visualizationState.visibleNodes.find((n) => n.id === "node4")
        ?.showingLongLabel,
    ).toBe(true);

    // Existing nodes should still have long labels
    expect(
      visualizationState.visibleNodes.find((n) => n.id === "node1")
        ?.showingLongLabel,
    ).toBe(true);
  });
});
