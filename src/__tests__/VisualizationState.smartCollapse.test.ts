/**
 * Tests for VisualizationState smart collapse prevention logic
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestContainer, createTestNode } from "../utils/testData.js";

describe("VisualizationState Smart Collapse Prevention", () => {
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

  describe("Initial Layout Smart Collapse", () => {
    it("should run smart collapse on first layout", () => {
      expect(state.isFirstLayout()).toBe(true);
      expect(state.shouldRunSmartCollapse()).toBe(true);
    });

    it("should not run smart collapse after first layout", () => {
      state.incrementLayoutCount();
      expect(state.isFirstLayout()).toBe(false);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should track layout count accurately", () => {
      expect(state.getLayoutState().layoutCount).toBe(0);

      state.incrementLayoutCount();
      expect(state.getLayoutState().layoutCount).toBe(1);
      expect(state.shouldRunSmartCollapse()).toBe(false);

      state.incrementLayoutCount();
      expect(state.getLayoutState().layoutCount).toBe(2);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("User Operation Prevention", () => {
    it("should prevent smart collapse after user expands containers", async () => {
      // Create test containers
      const container1 = createTestContainer("c1", "Container 1");
      container1.collapsed = true;
      const container2 = createTestContainer("c2", "Container 2");
      container2.collapsed = true;

      state.addContainer(container1);
      state.addContainer(container2);

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User expands a container
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Smart collapse should be disabled after user operation
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after user collapses containers", async () => {
      // Create test containers
      const container1 = createTestContainer("c1", "Container 1");
      container1.collapsed = false;
      const container2 = createTestContainer("c2", "Container 2");
      container2.collapsed = false;

      state.addContainer(container1);
      state.addContainer(container2);

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User collapses a container
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Smart collapse should be disabled after user operation
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after bulk container operations", async () => {
      // Create test containers
      const containers = [
        createTestContainer("c1", "Container 1"),
        createTestContainer("c2", "Container 2"),
        createTestContainer("c3", "Container 3"),
      ];

      containers.forEach((container) => {
        container.collapsed = true;
        state.addContainer(container);
      });

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User performs bulk expand operation
      await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false,
      });

      // Smart collapse should be disabled after bulk operation
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should handle mixed container states", async () => {
      // Create containers with mixed states
      const expandedContainer = createTestContainer(
        "expanded",
        "Expanded Container",
      );
      expandedContainer.collapsed = false;
      const collapsedContainer = createTestContainer(
        "collapsed",
        "Collapsed Container",
      );
      collapsedContainer.collapsed = true;

      state.addContainer(expandedContainer);
      state.addContainer(collapsedContainer);

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User operation on any container should disable smart collapse
      await asyncCoordinator.expandContainer("collapsed", state, {
        relayoutEntities: ["collapsed"],
        fitView: false,
      });

      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Integration with Container Operations", () => {
    it("should automatically disable smart collapse when user toggles containers", async () => {
      // Create test data
      const nodes = [
        createTestNode("n1", "Node 1"),
        createTestNode("n2", "Node 2"),
        createTestNode("n3", "Node 3"),
      ];

      const container = createTestContainer("c1", "Test Container");
      container.children = new Set(["n1", "n2", "n3"]);
      container.childNodes = ["n1", "n2", "n3"];
      container.collapsed = false;

      nodes.forEach((node) => state.addNode(node));
      state.addContainer(container);

      // Verify initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User collapses container
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Smart collapse should be disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Verify container is collapsed
      const visibleContainers = state.visibleContainers;
      const collapsedContainer = visibleContainers.find((c) => c.id === "c1");
      expect(collapsedContainer?.collapsed).toBe(true);
    });

    it("should track user vs system operations", async () => {
      // Create test containers
      const container1 = createTestContainer("c1", "Container 1");
      container1.collapsed = false;
      const container2 = createTestContainer("c2", "Container 2");
      container2.collapsed = false;

      state.addContainer(container1);
      state.addContainer(container2);

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User operation should disable smart collapse
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      expect(state.shouldRunSmartCollapse()).toBe(false);

      // System operations (like layout updates) shouldn't re-enable it
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should handle rapid user operations", async () => {
      // Create multiple containers
      const containers = Array.from({ length: 5 }, (_, i) => {
        const container = createTestContainer(`c${i}`, `Container ${i}`);
        container.collapsed = i % 2 === 0; // Mix of collapsed/expanded
        return container;
      });

      containers.forEach((container) => state.addContainer(container));

      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Rapid user operations
      await asyncCoordinator.expandContainer("c0", state, {
        relayoutEntities: ["c0"],
        fitView: false,
      });

      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Smart collapse should remain disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Smart Collapse State Management", () => {
    it("should provide smart collapse status", () => {
      // Initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);
      expect(state.isFirstLayout()).toBe(true);

      // After layout increment
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);
      expect(state.isFirstLayout()).toBe(false);
    });

    it("should handle smart collapse reset scenarios", () => {
      // Disable smart collapse
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Reset should re-enable (if implemented)
      // Note: This depends on whether reset functionality exists
      const layoutState = state.getLayoutState();
      expect(layoutState.layoutCount).toBeGreaterThan(0);
    });

    it("should maintain smart collapse state across operations", async () => {
      const container = createTestContainer("c1", "Test Container");
      container.collapsed = true;
      state.addContainer(container);

      // Initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Multiple operations
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Should remain disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle operations on non-existent containers gracefully", async () => {
      // Initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Operation on non-existent container should not crash
      try {
        await asyncCoordinator.expandContainer("nonexistent", state, {
          relayoutEntities: ["nonexistent"],
          fitView: false,
        });
      } catch (_error) {
        // Expected to handle gracefully
      }

      // Smart collapse state should be preserved or handled appropriately
      // The exact behavior depends on implementation
      expect(typeof state.shouldRunSmartCollapse()).toBe("boolean");
    });

    it("should handle empty container sets", async () => {
      // No containers added
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Bulk operations on empty set
      await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false,
      });

      await asyncCoordinator.collapseAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false,
      });

      // Should handle gracefully
      expect(typeof state.shouldRunSmartCollapse()).toBe("boolean");
    });

    it("should maintain consistency during concurrent operations", async () => {
      const containers = [
        createTestContainer("c1", "Container 1"),
        createTestContainer("c2", "Container 2"),
      ];

      containers.forEach((container) => {
        container.collapsed = true;
        state.addContainer(container);
      });

      // Initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Simulate concurrent operations (though they'll be sequential in tests)
      const operations = [
        asyncCoordinator.expandContainer("c1", state, {
          relayoutEntities: ["c1"],
          fitView: false,
        }),
        asyncCoordinator.expandContainer("c2", state, {
          relayoutEntities: ["c2"],
          fitView: false,
        }),
      ];

      await Promise.all(operations);

      // Smart collapse should be disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Performance and Optimization", () => {
    it("should handle large numbers of containers efficiently", async () => {
      // Create many containers
      const containerCount = 50;
      const containers = Array.from({ length: containerCount }, (_, i) => {
        const container = createTestContainer(`c${i}`, `Container ${i}`);
        container.collapsed = true;
        return container;
      });

      containers.forEach((container) => state.addContainer(container));

      // Initial state
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Bulk operation should complete efficiently
      const startTime = Date.now();
      await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined,
        fitView: false,
      });
      const endTime = Date.now();

      // Should complete in reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should optimize smart collapse checks", () => {
      // Multiple checks should be efficient
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        state.shouldRunSmartCollapse();
      }

      const endTime = Date.now();

      // Should be very fast for simple boolean checks
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
