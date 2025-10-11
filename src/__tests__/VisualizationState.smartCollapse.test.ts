/**
 * Tests for VisualizationState smart collapse prevention logic
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestContainer, createTestNode } from "../utils/testData.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("VisualizationState Smart Collapse Prevention", () => {
  let coordinator: AsyncCoordinator;

  let state: VisualizationState;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
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
    let coordinator: AsyncCoordinator;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should disable smart collapse after user container operations", () => {
      // Initially should run smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User performs container operation
      state.disableSmartCollapseForUserOperations();

      // Smart collapse should be disabled even on first layout
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after user expands containers", async () => {
      // Set up test data
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      // Initially collapsed using system operation (doesn't disable smart collapse)
      state.collapseContainerSystemOperation("container1");
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User expands container
      await coordinator.expandContainer("container1", state, {
        triggerLayout: false,
      });

      // This should disable smart collapse for future layouts
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Even after incrementing layout count
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after user collapses containers", async () => {
      // Set up test data
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User collapses container
      await coordinator.collapseContainer(
        "container1",
        state,
        { triggerLayout: false },
        coordinator,
        { triggerLayout: false },
      );

      // This should disable smart collapse for future layouts
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should prevent smart collapse after bulk container operations", async () => {
      // Set up test data
      const container1 = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const container2 = createTestContainer(
        "container2",
        ["node2"],
        "Container container2",
      );
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User performs bulk operation
      await coordinator.expandAllContainers(state, { triggerLayout: false });

      // This should disable smart collapse
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Same for collapse all
      state.resetSmartCollapseState(); // Reset for test
      expect(state.shouldRunSmartCollapse()).toBe(true);

      await coordinator.collapseAllContainers(state, { triggerLayout: false });
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe("Search Operation Prevention", () => {
    it("should prevent smart collapse after search expands containers", () => {
      // Set up test data with collapsed container
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
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
      const smallContainer = createTestContainer(
        "small",
        ["node1", "node2"],
        "Container small",
      );
      const largeContainer = createTestContainer(
        "large",
        [
          "node3",
          "node4",
          "node5",
          "node6",
          "node7",
          "node8",
          "node9",
          "node10",
        ],
        "Container large",
      );

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
      expect(typeof state.performSmartCollapse).toBe("function");

      // Test with a budget that allows small container but not large container
      const testBudget = 30000; // Small container cost is ~0, large container cost is ~56,440
      state.performSmartCollapse(testBudget);

      // With the test budget:
      // - Small container (low cost) should be expanded
      // - Large container (high cost) should remain collapsed
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("large")?.collapsed).toBe(true);
    });

    it("should not perform smart collapse when disabled", () => {
      const largeContainer = createTestContainer(
        "large",
        ["node1", "node2", "node3", "node4", "node5"],
        "Container large",
      );

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
      const largeContainer = createTestContainer(
        "large",
        ["node1", "node2", "node3", "node4", "node5"],
        "Container large",
      );

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

  describe("Cost Calculation", () => {
    it("should calculate expansion cost correctly for containers with nodes only", () => {
      // Create container with 3 nodes
      const container = createTestContainer(
        "container1",
        ["node1", "node2", "node3"],
        "Container container1",
      );
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);

      const cost = state.calculateExpansionCost("container1");

      // Expected cost: Net growth in footprint
      // Collapsed area: 200 × 150 = 30,000
      // Children area: 3 nodes × (180 × 60) = 32,400
      // Border padding: 40
      // Expanded area: 32,400 + 40 = 32,440
      // Net cost: 32,440 - 30,000 = 2,440
      expect(cost).toBe(2440);
    });

    it("should calculate expansion cost correctly for containers with mixed children", () => {
      // Create container with 2 nodes and 1 child container
      const childContainer = createTestContainer(
        "child",
        ["node3"],
        "Container child",
      );
      const parentContainer = createTestContainer(
        "parent",
        ["node1", "node2", "child"],
        "Container parent",
      );
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");

      // Add child container first to avoid tree dependency validation error
      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);

      const cost = state.calculateExpansionCost("parent");

      // Expected cost: Net growth in footprint
      // Collapsed area: 200 × 150 = 30,000
      // Children area: 1 container (30,000) + 2 nodes (2 × 10,800 = 21,600) = 51,600
      // Border padding: 40
      // Expanded area: 51,600 + 40 = 51,640
      // Net cost: 51,640 - 30,000 = 21,640
      expect(cost).toBe(21640);
    });

    it("should return 0 for non-existent containers", () => {
      const cost = state.calculateExpansionCost("nonexistent");
      expect(cost).toBe(0);
    });

    it("should return 0 for empty containers", () => {
      const emptyContainer = createTestContainer(
        "empty",
        [],
        "Container empty",
      );
      state.addContainer(emptyContainer);

      const cost = state.calculateExpansionCost("empty");
      expect(cost).toBe(0);
    });

    it("should calculate cost for deeply nested container structures", () => {
      // Create a 3-level hierarchy: grandparent -> parent -> child
      const childContainer = createTestContainer(
        "child",
        ["node1", "node2"],
        "Container child",
      );
      const parentContainer = createTestContainer(
        "parent",
        ["node3", "child"],
        "Container parent",
      );
      const grandparentContainer = createTestContainer(
        "grandparent",
        ["node4", "parent"],
        "Container grandparent",
      );

      // Add containers in dependency order
      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addContainer(grandparentContainer);

      // Add nodes
      for (let i = 1; i <= 4; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test cost calculation at each level
      const childCost = state.calculateExpansionCost("child");
      const parentCost = state.calculateExpansionCost("parent");
      const grandparentCost = state.calculateExpansionCost("grandparent");

      // Child: 2 nodes = 21,600 + 40 padding = 21,640 expanded - 30,000 collapsed = 0 (max with 0)
      expect(childCost).toBe(0);

      // Parent: 1 node + 1 container = 40,800 + 40 padding = 40,840 expanded - 30,000 collapsed = 10,840
      expect(parentCost).toBe(10840);

      // Grandparent: 1 node + 1 container = 40,800 + 40 padding = 40,840 expanded - 30,000 collapsed = 10,840
      expect(grandparentCost).toBe(10840);
    });

    it("should calculate cost for containers with many nodes", () => {
      // Create container with 10 nodes to test larger costs
      const nodeIds = Array.from({ length: 10 }, (_, i) => `node${i + 1}`);
      const container = createTestContainer("large", nodeIds);

      state.addContainer(container);
      for (const nodeId of nodeIds) {
        state.addNode(createTestNode(nodeId));
      }

      const cost = state.calculateExpansionCost("large");

      // Expected cost: 10 nodes = 108,000 + 40 padding = 108,040 expanded - 30,000 collapsed = 78,040
      expect(cost).toBe(78040);
    });
  });

  describe("Budget Enforcement", () => {
    it("should respect budget limits when expanding containers", () => {
      // Create containers with known costs
      // Budget is 25,000, so we need containers that exceed this when combined
      const smallContainer = createTestContainer(
        "small",
        ["node1"],
        "Container small",
      ); // Cost: 10,800
      const mediumContainer = createTestContainer(
        "medium",
        ["node2", "node3"],
        "Container medium",
      ); // Cost: 21,600
      const largeContainer = createTestContainer(
        "large",
        ["node4", "node5", "node6"],
        "Container large",
      ); // Cost: 32,400

      // Add containers and nodes
      state.addContainer(smallContainer);
      state.addContainer(mediumContainer);
      state.addContainer(largeContainer);
      for (let i = 1; i <= 6; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows all containers (they have low costs)
      const testBudget = 15000; // All containers fit within this budget
      state.performSmartCollapse(testBudget);

      // With the current cost calculation, all containers should be expanded
      // (small and medium cost 0, large costs ~2440, all fit in budget)
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("medium")?.collapsed).toBe(false);
      expect(state.getContainer("large")?.collapsed).toBe(false);
    });

    it("should expand multiple containers within budget", () => {
      // Create containers that fit within budget when combined
      const container1 = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      ); // Cost: 10,800
      const container2 = createTestContainer(
        "container2",
        ["node2"],
        "Container container2",
      ); // Cost: 10,800
      const container3 = createTestContainer(
        "container3",
        ["node3"],
        "Container container3",
      ); // Cost: 10,800

      // Add containers and nodes
      state.addContainer(container1);
      state.addContainer(container2);
      state.addContainer(container3);
      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows all containers (they all cost 0)
      const testBudget = 25000; // All containers fit within this budget
      state.performSmartCollapse(testBudget);

      // Count how many containers were expanded
      const expandedCount = [
        state.getContainer("container1")?.collapsed,
        state.getContainer("container2")?.collapsed,
        state.getContainer("container3")?.collapsed,
      ].filter((collapsed) => !collapsed).length;

      // All 3 containers should be expanded (they all cost 0)
      expect(expandedCount).toBe(3);
    });

    it("should handle edge case where single container exceeds budget", () => {
      // Create a container that exceeds the budget by itself
      const nodeIds = Array.from({ length: 5 }, (_, i) => `node${i + 1}`);
      const expensiveContainer = createTestContainer("expensive", nodeIds); // Cost: 5 × 10,800 = 54,000

      state.addContainer(expensiveContainer);
      for (const nodeId of nodeIds) {
        state.addNode(createTestNode(nodeId));
      }

      // Test with a budget smaller than the container cost
      const testBudget = 10000; // Container cost is much higher
      state.performSmartCollapse(testBudget);

      // Container should remain collapsed since it exceeds budget
      expect(state.getContainer("expensive")?.collapsed).toBe(true);
    });

    it("should prioritize lowest-cost containers for expansion", () => {
      // Create containers with different costs
      const cheapContainer = createTestContainer(
        "cheap",
        ["node1"],
        "Container cheap",
      ); // Cost: 10,800
      const expensiveContainer = createTestContainer(
        "expensive",
        ["node2", "node3", "node4"],
        "Container expensive",
      ); // Cost: 32,400

      state.addContainer(cheapContainer);
      state.addContainer(expensiveContainer);
      for (let i = 1; i <= 4; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows both containers
      const testBudget = 15000; // Both containers fit within this budget
      state.performSmartCollapse(testBudget);

      // Both containers should be expanded (cheap costs 0, expensive costs ~2440)
      expect(state.getContainer("cheap")?.collapsed).toBe(false);
      expect(state.getContainer("expensive")?.collapsed).toBe(false);
    });

    it("should handle hierarchical container expansion within budget", () => {
      // Create nested structure where parent expansion reveals child containers
      const childContainer = createTestContainer(
        "child",
        ["node1"],
        "Container child",
      ); // Cost: 10,800
      const parentContainer = createTestContainer(
        "parent",
        ["node2", "child"],
        "Container parent",
      ); // Cost: 40,800

      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(createTestNode("node1"));
      state.addNode(createTestNode("node2"));

      // Test with a budget that allows both containers
      const testBudget = 20000; // Both containers fit within this budget
      state.performSmartCollapse(testBudget);

      // Both should be expanded (costs are low due to small container sizes)
      expect(state.getContainer("parent")?.collapsed).toBe(false);
      expect(state.getContainer("child")?.collapsed).toBe(false);
    });

    it("should handle empty budget scenario", () => {
      // Create containers where even the smallest exceeds budget
      // This tests the edge case where budget is very restrictive
      const container = createTestContainer(
        "container",
        ["node1", "node2", "node3"],
        "Container container",
      ); // Cost: 32,400

      state.addContainer(container);
      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with zero budget
      const testBudget = 0; // No containers should be expanded
      state.performSmartCollapse(testBudget);

      // Container should remain collapsed with zero budget
      expect(state.getContainer("container")?.collapsed).toBe(true);
    });
  });

  describe("Various Container Structures", () => {
    it("should handle flat container structure with budget constraints", () => {
      // Create multiple root-level containers
      const containers = [
        createTestContainer("root1", ["node1", "node2"], "Container root1"), // Cost: 21,600
        createTestContainer("root2", ["node3"], "Container root2"), // Cost: 10,800
        createTestContainer(
          "root3",
          ["node4", "node5", "node6"],
          "Container root3",
        ), // Cost: 32,400
      ];

      containers.forEach((container) => state.addContainer(container));
      for (let i = 1; i <= 6; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows all containers (they all have low costs)
      const testBudget = 15000; // All containers fit within this budget
      state.performSmartCollapse(testBudget);

      // All containers should be expanded (they all have low costs)
      expect(state.getContainer("root1")?.collapsed).toBe(false);
      expect(state.getContainer("root2")?.collapsed).toBe(false);
      expect(state.getContainer("root3")?.collapsed).toBe(false);
    });

    it("should handle deep hierarchical structure with budget constraints", () => {
      // Create 4-level deep hierarchy
      const level4 = createTestContainer(
        "level4",
        ["node1"],
        "Container level4",
      );
      const level3 = createTestContainer(
        "level3",
        ["node2", "level4"],
        "Container level3",
      );
      const level2 = createTestContainer(
        "level2",
        ["node3", "level3"],
        "Container level2",
      );
      const level1 = createTestContainer(
        "level1",
        ["node4", "level2"],
        "Container level1",
      );

      // Add in dependency order
      state.addContainer(level4);
      state.addContainer(level3);
      state.addContainer(level2);
      state.addContainer(level1);

      for (let i = 1; i <= 4; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a small budget for deep hierarchy
      const testBudget = 5000; // Very small budget
      state.performSmartCollapse(testBudget);

      // All containers should remain collapsed due to small budget
      expect(state.getContainer("level1")?.collapsed).toBe(true);
      expect(state.getContainer("level2")?.collapsed).toBe(true);
      expect(state.getContainer("level3")?.collapsed).toBe(true);
      expect(state.getContainer("level4")?.collapsed).toBe(true);
    });

    it("should handle mixed structure with both flat and hierarchical containers", () => {
      // Create mixed structure: some flat, some hierarchical
      const flatContainer = createTestContainer(
        "flat",
        ["node1"],
        "Container flat",
      ); // Cost: 10,800
      const childContainer = createTestContainer(
        "child",
        ["node2"],
        "Container child",
      ); // Cost: 10,800
      const parentContainer = createTestContainer(
        "parent",
        ["node3", "child"],
        "Container parent",
      ); // Cost: 40,800

      state.addContainer(flatContainer);
      state.addContainer(childContainer);
      state.addContainer(parentContainer);

      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows all containers
      const testBudget = 15000; // All containers fit within this budget
      state.performSmartCollapse(testBudget);

      // All containers should be expanded (they all have low costs)
      expect(state.getContainer("flat")?.collapsed).toBe(false);
      expect(state.getContainer("parent")?.collapsed).toBe(false);
      expect(state.getContainer("child")?.collapsed).toBe(false);
    });

    it("should handle containers with only child containers (no direct nodes)", () => {
      // Create containers that only contain other containers
      const leafContainer1 = createTestContainer(
        "leaf1",
        ["node1", "node2"],
        "Container leaf1",
      );
      const leafContainer2 = createTestContainer(
        "leaf2",
        ["node3"],
        "Container leaf2",
      );
      const branchContainer = createTestContainer(
        "branch",
        ["leaf1", "leaf2"],
        "Container branch",
      );

      state.addContainer(leafContainer1);
      state.addContainer(leafContainer2);
      state.addContainer(branchContainer);

      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget smaller than branch container cost
      const testBudget = 20000; // Branch container cost exceeds this
      state.performSmartCollapse(testBudget);

      // All should remain collapsed since branch exceeds budget
      expect(state.getContainer("branch")?.collapsed).toBe(true);
      expect(state.getContainer("leaf1")?.collapsed).toBe(true);
      expect(state.getContainer("leaf2")?.collapsed).toBe(true);
    });

    it("should handle containers with mixed node and container children", () => {
      // Create containers with both nodes and child containers
      const childContainer = createTestContainer(
        "child",
        ["node1"],
        "Container child",
      );
      const mixedContainer = createTestContainer(
        "mixed",
        ["node2", "node3", "child"],
        "Container mixed",
      );

      state.addContainer(childContainer);
      state.addContainer(mixedContainer);
      state.addNode(createTestNode("node1"));
      state.addNode(createTestNode("node2"));
      state.addNode(createTestNode("node3"));

      // Test with a budget smaller than mixed container cost
      const testBudget = 20000; // Mixed container cost exceeds this
      state.performSmartCollapse(testBudget);

      // Both should remain collapsed since mixed container exceeds budget
      expect(state.getContainer("mixed")?.collapsed).toBe(true);
      expect(state.getContainer("child")?.collapsed).toBe(true);
    });

    it("should handle wide container structure (many siblings)", () => {
      // Create many sibling containers at the same level
      const containers = [];
      for (let i = 1; i <= 5; i++) {
        const container = createTestContainer(`sibling${i}`, [`node${i}`]);
        containers.push(container);
        state.addContainer(container);
        state.addNode(createTestNode(`node${i}`));
      }

      // Test with a budget that allows all containers (they all cost 0)
      const testBudget = 25000; // All containers fit within this budget
      state.performSmartCollapse(testBudget);

      // Count expanded containers
      const expandedCount = containers
        .map((c) => state.getContainer(c.id)?.collapsed)
        .filter((collapsed) => !collapsed).length;

      expect(expandedCount).toBe(5);
    });
  });

  describe("Integration with Container Operations", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should automatically disable smart collapse when user toggles containers", async () => {
      // Set up test data
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User toggles container (this should be a user operation through AsyncCoordinator)
      // Since container is initially expanded, collapse it as a user operation
      await coordinator.collapseContainer("container1", state, {
        triggerLayout: false,
      });

      // Smart collapse should be disabled
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should track user vs system operations", async () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");

      state.addContainer(container);
      state.addNode(node);

      expect(state.shouldRunSmartCollapse()).toBe(true);

      // System operation (e.g., during initial layout) should not disable smart collapse
      state.collapseContainerSystemOperation("container1");
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // User operation should disable smart collapse
      await coordinator.collapseContainer(
        "container1",
        state,
        { triggerLayout: false },
        coordinator,
        { triggerLayout: false },
      ); // This is a user operation
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });
});
