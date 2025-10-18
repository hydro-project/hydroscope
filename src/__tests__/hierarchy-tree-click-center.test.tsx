/**
 * @fileoverview Test for hierarchy tree click-to-center feature
 *
 * This test verifies that clicking on a hierarchy tree label centers
 * the corresponding element in the ReactFlow view with native font size zoom (1.0).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState";
import { AsyncCoordinator } from "../core/AsyncCoordinator";
import { GraphNode, Container } from "../types/core";

describe("Hierarchy Tree Click-to-Center Feature", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let mockReactFlowInstance: any;

  beforeEach(() => {
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();

    // Create a simple graph structure
    const container1: Container = {
      id: "container1",
      label: "Test Container",
      collapsed: false,
      hidden: false,
      children: new Set<string>(),
    };

    const node1: GraphNode = {
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1 Long Label",
      type: "standard",
      position: { x: 120, y: 120 },
      dimensions: { width: 100, height: 50 },
      semanticTags: [],
      hidden: false,
    };

    const node2: GraphNode = {
      id: "node2",
      label: "Node 2",
      longLabel: "Node 2 Long Label",
      type: "standard",
      position: { x: 220, y: 150 },
      dimensions: { width: 100, height: 50 },
      semanticTags: [],
      hidden: false,
    };

    visualizationState.addContainer(container1);
    visualizationState.addNode(node1);
    visualizationState.addNode(node2);
    visualizationState.assignNodeToContainer("node1", "container1");
    visualizationState.assignNodeToContainer("node2", "container1");

    // Mock ReactFlow instance
    mockReactFlowInstance = {
      getNode: vi.fn((id: string) => {
        if (id === "container1") {
          return {
            id: "container1",
            position: { x: 100, y: 100 },
            width: 300,
            height: 200,
          };
        }
        if (id === "node1") {
          return {
            id: "node1",
            position: { x: 120, y: 120 },
            width: 100,
            height: 50,
          };
        }
        return null;
      }),
      setCenter: vi.fn(),
      fitView: vi.fn(),
    };
  });

  it("should center and zoom to native size when clicking on container label", async () => {
    // Simulate clicking on a container label in the hierarchy tree
    const result = asyncCoordinator.navigateToElementWithErrorHandling(
      "container1",
      visualizationState,
      mockReactFlowInstance,
    );

    expect(result.success).toBe(true);

    // Wait for async viewport focusing to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify that setCenter was called with correct parameters
    // Container center: x: 100 + 300/2 = 250, y: 100 + 200/2 = 200
    // Zoom should be 1.0 for native font size
    // Default behavior is immediate positioning (duration: 0) unless duration is explicitly provided
    expect(mockReactFlowInstance.setCenter).toHaveBeenCalledWith(
      250,
      200,
      expect.objectContaining({
        zoom: 1.0,
        duration: 800, // navigateToElementWithErrorHandling passes VIEWPORT_ANIMATION_DURATION
      }),
    );
  });

  it("should center and zoom to native size when clicking on node label", async () => {
    // Simulate clicking on a node label in the hierarchy tree
    const result = asyncCoordinator.navigateToElementWithErrorHandling(
      "node1",
      visualizationState,
      mockReactFlowInstance,
    );

    expect(result.success).toBe(true);

    // Wait for async viewport focusing to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify that setCenter was called with correct parameters
    // Node center: x: 120 + 100/2 = 170, y: 120 + 50/2 = 145
    // Zoom should be 1.0 for native font size
    expect(mockReactFlowInstance.setCenter).toHaveBeenCalledWith(
      170,
      145,
      expect.objectContaining({
        zoom: 1.0,
        duration: 800,
      }),
    );
  });

  it("should support custom zoom level if needed", async () => {
    // Test that we can override the zoom level if needed
    const result = asyncCoordinator.navigateToElementWithErrorHandling(
      "node1",
      visualizationState,
      mockReactFlowInstance,
      {
        zoom: 1.5, // Custom zoom level
      },
    );

    expect(result.success).toBe(true);

    // Wait for async viewport focusing to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify custom zoom was used
    expect(mockReactFlowInstance.setCenter).toHaveBeenCalledWith(
      170,
      145,
      expect.objectContaining({
        zoom: 1.5,
      }),
    );
  });

  it("should update navigation state when clicking on label", () => {
    // Before navigation
    expect(visualizationState.getNavigationSelection()).toBeNull();

    // Navigate to element
    asyncCoordinator.navigateToElementWithErrorHandling(
      "node1",
      visualizationState,
      mockReactFlowInstance,
    );

    // After navigation, the state should be updated
    expect(visualizationState.getNavigationSelection()).toBe("node1");
  });

  it("should handle missing ReactFlow instance gracefully", () => {
    // Navigate without ReactFlow instance
    const result = asyncCoordinator.navigateToElementWithErrorHandling(
      "node1",
      visualizationState,
      undefined, // No ReactFlow instance
    );

    // Navigation should still succeed (updates state)
    expect(result.success).toBe(true);

    // But setCenter should not be called
    expect(mockReactFlowInstance.setCenter).not.toHaveBeenCalled();
  });

  it("should trigger glow effect on clicked container", () => {
    asyncCoordinator.navigateToElementWithErrorHandling(
      "container1",
      visualizationState,
      mockReactFlowInstance,
    );

    // Verify that the container is temporarily highlighted
    expect(visualizationState.hasTemporaryHighlight("container1")).toBe(true);
  });

  it("should trigger glow effect on clicked node", () => {
    asyncCoordinator.navigateToElementWithErrorHandling(
      "node1",
      visualizationState,
      mockReactFlowInstance,
    );

    // Verify that the node is temporarily highlighted
    expect(visualizationState.hasTemporaryHighlight("node1")).toBe(true);
  });
});
