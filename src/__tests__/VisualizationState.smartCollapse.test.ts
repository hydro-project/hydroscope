/**
 * Tests for VisualizationState smart collapse prevention logic
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestContainer, createTestNode } from "../utils/testData.js";

describe("VisualizationState Smart Collapse Prevention", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
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
    it("should disable smart collapse after user container operations", () => {
      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User performs container operation
      state.disableSmartCollapseForUserOperations();

      // Smart collapse should be disabled even on first layout
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after user expands containers", () => {
      // Set up test data
      const container = createTestContainer("container1", ["node1"]);
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      // Initially collapsed using system operation (doesn't disable smart collapse)
      state.collapseContainerSystemOperation("container1");
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User expands container
      state.expandContainer("container1");

      // This should disable smart collapse for future layouts
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Even after incrementing layout count
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after user collapses containers", () => {
      // Set up test data
      const container = createTestContainer("container1", ["node1"]);
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User collapses container
      state.collapseContainer("container1");

      // This should disable smart collapse for future layouts
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after bulk container operations", () => {
      // Set up test data
      const container1 = createTestContainer("container1", ["node1"]);
      const container2 = createTestContainer("container2", ["node2"]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User performs bulk operation
      state.expandAllContainers();

      // This should disable smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Same for collapse all
      state.resetSmartCollapseState(); // Reset for test
      expect(state.shouldRunSmartCollapse()).toBe(true);

      state.collapseAllContainers();
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Search Operation Prevention", () => {
    it("should prevent smart collapse after search expands containers", () => {
      // Set up test data with collapsed container
      const container = createTestContainer("container1", ["node1"]);
      const node = createTestNode("node1", "searchable node");

      state.addContainer(container);
      state.addNode(node);
      state.collapseContainerSystemOperation("container1"); // Use system operation

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Search that would expand containers
      const results = state.search("searchable");
      expect(results.length).toBeGreaterThan(0);

      // If search expands containers, smart collapse should be disabled
      if (results.some((r) => r.type === "node")) {
        // Simulate search expanding containers to show results
        state.expandContainerForSearch("container1");
        expect(state.shouldRunSmartCollapse()).toBe(false);
      }
    });

    it("should not prevent smart collapse for search without container expansion", () => {
      // Set up test data
      const node = createTestNode("node1", "searchable node");
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Search that doesn't expand containers
      state.search("searchable");

      // Smart collapse should still be enabled
      expect(state.shouldRunSmartCollapse()).toBe(true);
    });
  });

  describe("Layout Configuration Changes", () => {
    it("should allow smart collapse override for layout configuration changes", () => {
      // After first layout, smart collapse is normally disabled
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // But layout configuration changes can enable it
      state.enableSmartCollapseForNextLayout();
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Should reset after checking
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should handle multiple override requests", () => {
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Multiple override requests
      state.enableSmartCollapseForNextLayout();
      state.enableSmartCollapseForNextLayout();

      // Should still work
      expect(state.shouldRunSmartCollapse()).toBe(true);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Smart Collapse State Management", () => {
    it("should reset smart collapse state", () => {
      // Disable smart collapse
      state.disableSmartCollapseForUserOperations();
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Reset should restore initial behavior
      state.resetSmartCollapseState();
      // After reset, it should be enabled again, but we need to reset layout count too
      state.resetLayoutState();
      expect(state.shouldRunSmartCollapse()).toBe(true);
    });

    it("should get smart collapse status", () => {
      const status = state.getSmartCollapseStatus();
      expect(status.enabled).toBe(true);
      expect(status.isFirstLayout).toBe(true);
      expect(status.hasOverride).toBe(false);

      state.disableSmartCollapseForUserOperations();
      state.enableSmartCollapseForNextLayout();

      const newStatus = state.getSmartCollapseStatus();
      expect(newStatus.enabled).toBe(false);
      expect(newStatus.hasOverride).toBe(true);
    });
  });

  describe("Smart Collapse Implementation", () => {
    it("should perform smart collapse on containers with many children", () => {
      // Create containers with different child counts
      const smallContainer = createTestContainer("small", ["node1", "node2"]);
      const largeContainer = createTestContainer("large", ["node3", "node4", "node5", "node6", "node7", "node8", "node9", "node10"]);
      
      // Add test nodes
      for (let i = 1; i <= 10; i++) {
        state.addNode(createTestNode(`node${i}`));
      }
      
      state.addContainer(smallContainer);
      state.addContainer(largeContainer);

      // Initially both containers should be expanded
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("large")?.collapsed).toBe(false);

      // Perform smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);
      
      // Check if performSmartCollapse method exists
      expect(typeof state.performSmartCollapse).toBe('function');
      
      state.performSmartCollapse();

      // Small container (2 children) should remain expanded
      expect(state.getContainer("small")?.collapsed).toBe(false);
      
      // Large container (8 children > 7 threshold) should be collapsed
      expect(state.getContainer("large")?.collapsed).toBe(true);
    });

    it("should not perform smart collapse when disabled", () => {
      const largeContainer = createTestContainer("large", ["node1", "node2", "node3", "node4", "node5"]);
      
      for (let i = 1; i <= 5; i++) {
        state.addNode(createTestNode(`node${i}`));
      }
      
      state.addContainer(largeContainer);
      state.disableSmartCollapseForUserOperations();

      expect(state.shouldRunSmartCollapse()).toBe(false);
      state.performSmartCollapse();

      // Container should remain expanded
      expect(state.getContainer("large")?.collapsed).toBe(false);
    });

    it("should not perform smart collapse after first layout", () => {
      const largeContainer = createTestContainer("large", ["node1", "node2", "node3", "node4", "node5"]);
      
      for (let i = 1; i <= 5; i++) {
        state.addNode(createTestNode(`node${i}`));
      }
      
      state.addContainer(largeContainer);
      state.incrementLayoutCount(); // Simulate first layout completed

      expect(state.shouldRunSmartCollapse()).toBe(false);
      state.performSmartCollapse();

      // Container should remain expanded
      expect(state.getContainer("large")?.collapsed).toBe(false);
    });
  });

  describe("Integration with Container Operations", () => {
    it("should automatically disable smart collapse when user toggles containers", () => {
      // Set up test data
      const container = createTestContainer("container1", ["node1"]);
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User toggles container (this should be a user operation)
      state.toggleContainer("container1");

      // Smart collapse should be disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should track user vs system operations", () => {
      const container = createTestContainer("container1", ["node1"]);
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // System operation (e.g., during initial layout) should not disable smart collapse
      state.collapseContainerSystemOperation("container1");
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User operation should disable smart collapse
      state.collapseContainer("container1"); // This is a user operation
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });
});
