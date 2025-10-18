/**
 * AsyncCoordinator Tree Hierarchy Test
 *
 * Tests the new tree hierarchy expansion and navigation methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import type { GraphNode, Container } from "../types/core.js";

describe("AsyncCoordinator Tree Hierarchy", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  const createTestNode = (id: string, label: string): GraphNode => ({
    id,
    label,
    longLabel: `${label} (long)`,
    type: "default",
    semanticTags: [],
    hidden: false,
  });

  const createTestContainer = (
    id: string,
    label: string,
    children: string[],
  ): Container => ({
    id,
    label,
    children: new Set(children),
    collapsed: false,
    hidden: false,
  });

  describe("Tree Node Operations", () => {
    let coordinator: AsyncCoordinator;
    let elkBridge: ELKBridge;
    let reactFlowBridge: ReactFlowBridge;

    beforeEach(() => {
      coordinator = new AsyncCoordinator();
      elkBridge = new ELKBridge({
        algorithm: "mrtree",
        direction: "DOWN",
      });
      reactFlowBridge = new ReactFlowBridge({});
      coordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    });

    it("should expand tree node through async coordination", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Initially no tree nodes are expanded
      expect(state.getExpandedTreeNodes().size).toBe(0);

      // Expand tree node through coordinator
      await coordinator.expandTreeNode("container1", state);

      // Tree node should be expanded
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
    });

    it("should collapse tree node through async coordination", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Expand first, then collapse
      state.expandTreeNodes(["container1"]);
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);

      // Collapse tree node through coordinator
      await coordinator.collapseTreeNode("container1", state);

      // Tree node should be collapsed
      expect(state.getExpandedTreeNodes().has("container1")).toBe(false);
    });

    it("should expand all tree nodes through async coordination", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node 1");
      const node2 = createTestNode("node2", "Test Node 2");
      const container1 = createTestContainer("container1", "Test Container 1", [
        "node1",
      ]);
      const container2 = createTestContainer("container2", "Test Container 2", [
        "node2",
      ]);

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container1);
      state.addContainer(container2);

      // Initially no tree nodes are expanded
      expect(state.getExpandedTreeNodes().size).toBe(0);

      // Expand specific tree nodes through coordinator
      await coordinator.expandAllTreeNodes(state, ["container1", "container2"]);

      // Both tree nodes should be expanded
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(true);
    });

    it("should collapse all tree nodes through async coordination", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node 1");
      const node2 = createTestNode("node2", "Test Node 2");
      const container1 = createTestContainer("container1", "Test Container 1", [
        "node1",
      ]);
      const container2 = createTestContainer("container2", "Test Container 2", [
        "node2",
      ]);

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container1);
      state.addContainer(container2);

      // Expand first
      state.expandTreeNodes(["container1", "container2"]);
      expect(state.getExpandedTreeNodes().size).toBe(2);

      // Collapse all tree nodes through coordinator
      await coordinator.collapseAllTreeNodes(state);

      // All tree nodes should be collapsed
      expect(state.getExpandedTreeNodes().size).toBe(0);
    });
  });

  describe("Navigation Operations", () => {
    let coordinator: AsyncCoordinator;
    let elkBridge: ELKBridge;
    let reactFlowBridge: ReactFlowBridge;

    beforeEach(() => {
      coordinator = new AsyncCoordinator();
      elkBridge = new ELKBridge({
        algorithm: "mrtree",
        direction: "DOWN",
      });
      reactFlowBridge = new ReactFlowBridge({});
      coordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    });

    it("should navigate to element through async coordination", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Initially no navigation selection
      expect(state.getNavigationSelection()).toBe(null);

      // Navigate to element through coordinator
      await coordinator.navigateToElement("node1", state);

      // Navigation should be set
      expect(state.getNavigationSelection()).toBe("node1");
    });

    it("should focus viewport on element through async coordination", async () => {
      // Mock ReactFlow instance
      const mockReactFlowInstance = {
        getNodes: () => [{ id: "node1", position: { x: 100, y: 100 } }],
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Focus viewport through coordinator
      await coordinator.focusViewportOnElement("node1", mockReactFlowInstance);

      // setCenter should have been called with zoom 1.0 for native font size
      // Default behavior is immediate positioning (duration: 0) for reliability
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalledWith(150, 125, {
        zoom: 1.0,
        duration: 0,
      });
    });

    it("should handle navigation with viewport focus", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Mock ReactFlow instance
      const mockReactFlowInstance = {
        getNodes: () => [{ id: "node1", position: { x: 100, y: 100 } }],
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Navigate with viewport focus
      await coordinator.navigateToElement(
        "node1",
        state,
        mockReactFlowInstance,
      );

      // Both navigation and viewport focus should work
      expect(state.getNavigationSelection()).toBe("node1");
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
    });
  });

  describe("Enhanced Container Operations", () => {
    let coordinator: AsyncCoordinator;
    let elkBridge: ELKBridge;
    let reactFlowBridge: ReactFlowBridge;

    beforeEach(() => {
      coordinator = new AsyncCoordinator();
      elkBridge = new ELKBridge({
        algorithm: "mrtree",
        direction: "DOWN",
      });
      reactFlowBridge = new ReactFlowBridge({});
      coordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    });

    it("should support container ID list in expandContainers", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node 1");
      const node2 = createTestNode("node2", "Test Node 2");
      const container1 = createTestContainer("container1", "Test Container 1", [
        "node1",
      ]);
      const container2 = createTestContainer("container2", "Test Container 2", [
        "node2",
      ]);

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container1);
      state.addContainer(container2);

      // Collapse both containers first
      await coordinator.collapseContainers(state, { fitView: false });

      // Expand only container1 using new signature
      await coordinator.expandContainers(state, ["container1"], {
        fitView: false,
      });

      // Only container1 should be expanded
      expect(state.getContainer("container1")?.collapsed).toBe(false);
      expect(state.getContainer("container2")?.collapsed).toBe(true);
    });

    it("should support container ID list in collapseContainers", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node 1");
      const node2 = createTestNode("node2", "Test Node 2");
      const container1 = createTestContainer("container1", "Test Container 1", [
        "node1",
      ]);
      const container2 = createTestContainer("container2", "Test Container 2", [
        "node2",
      ]);

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container1);
      state.addContainer(container2);

      // Both containers start expanded
      expect(state.getContainer("container1")?.collapsed).toBe(false);
      expect(state.getContainer("container2")?.collapsed).toBe(false);

      // Collapse only container1 using new signature
      await coordinator.collapseContainers(state, ["container1"], {
        fitView: false,
      });

      // Only container1 should be collapsed
      expect(state.getContainer("container1")?.collapsed).toBe(true);
      expect(state.getContainer("container2")?.collapsed).toBe(false);
    });

    it("should maintain backward compatibility with old signatures", async () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node 1");
      const container1 = createTestContainer("container1", "Test Container 1", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Test old signature for expandContainers
      await coordinator.expandContainers(state, { fitView: false });

      // Should work with old signature
      expect(state.getContainer("container1")?.collapsed).toBe(false);

      // Test old signature for collapseContainers
      await coordinator.collapseContainers(state, { fitView: false });

      // Should work with old signature
      expect(state.getContainer("container1")?.collapsed).toBe(true);
    });
  });
});
