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
      const largeContainer = createTestContainer("large", [
        "node3",
        "node4",
        "node5",
        "node6",
        "node7",
        "node8",
        "node9",
        "node10",
      ]);

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

      state.performSmartCollapse();

      // With budget-based approach and budget of 25,000:
      // - Small container (cost: 21,600) fits within budget and should be expanded
      // - Large container (cost: 86,400) exceeds budget and should remain collapsed
      // The algorithm starts everything collapsed, then expands lowest-cost containers first
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("large")?.collapsed).toBe(true);
    });

    it("should not perform smart collapse when disabled", () => {
      const largeContainer = createTestContainer("large", [
        "node1",
        "node2",
        "node3",
        "node4",
        "node5",
      ]);

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
      const largeContainer = createTestContainer("large", [
        "node1",
        "node2",
        "node3",
        "node4",
        "node5",
      ]);

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
      const container = createTestContainer("container1", [
        "node1",
        "node2",
        "node3",
      ]);
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");
      const node3 = createTestNode("node3");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);

      const cost = state.calculateExpansionCost("container1");

      // Expected cost: 0 containers × containerArea + 3 nodes × nodeArea
      // containerArea = 200 × 150 = 30,000
      // nodeArea = 180 × 60 = 10,800
      // cost = 0 × 30,000 + 3 × 10,800 = 32,400
      expect(cost).toBe(32400);
    });

    it("should calculate expansion cost correctly for containers with mixed children", () => {
      // Create container with 2 nodes and 1 child container
      const childContainer = createTestContainer("child", ["node3"]);
      const parentContainer = createTestContainer("parent", [
        "node1",
        "node2",
        "child",
      ]);
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

      // Expected cost: 1 container × containerArea + 2 nodes × nodeArea
      // containerArea = 200 × 150 = 30,000
      // nodeArea = 180 × 60 = 10,800
      // cost = 1 × 30,000 + 2 × 10,800 = 51,600
      expect(cost).toBe(51600);
    });

    it("should return 0 for non-existent containers", () => {
      const cost = state.calculateExpansionCost("nonexistent");
      expect(cost).toBe(0);
    });

    it("should return 0 for empty containers", () => {
      const emptyContainer = createTestContainer("empty", []);
      state.addContainer(emptyContainer);

      const cost = state.calculateExpansionCost("empty");
      expect(cost).toBe(0);
    });

    it("should calculate cost for deeply nested container structures", () => {
      // Create a 3-level hierarchy: grandparent -> parent -> child
      const childContainer = createTestContainer("child", ["node1", "node2"]);
      const parentContainer = createTestContainer("parent", ["node3", "child"]);
      const grandparentContainer = createTestContainer("grandparent", [
        "node4",
        "parent",
      ]);

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

      // Child: 2 nodes × 10,800 = 21,600
      expect(childCost).toBe(21600);

      // Parent: 1 node × 10,800 + 1 container × 30,000 = 40,800
      expect(parentCost).toBe(40800);

      // Grandparent: 1 node × 10,800 + 1 container × 30,000 = 40,800
      expect(grandparentCost).toBe(40800);
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

      // Expected cost: 10 nodes × 10,800 = 108,000
      expect(cost).toBe(108000);
    });
  });

  describe("Budget Enforcement", () => {
    it("should respect budget limits when expanding containers", () => {
      // Create containers with known costs
      // Budget is 25,000, so we need containers that exceed this when combined
      const smallContainer = createTestContainer("small", ["node1"]); // Cost: 10,800
      const mediumContainer = createTestContainer("medium", ["node2", "node3"]); // Cost: 21,600
      const largeContainer = createTestContainer("large", [
        "node4",
        "node5",
        "node6",
      ]); // Cost: 32,400

      // Add containers and nodes
      state.addContainer(smallContainer);
      state.addContainer(mediumContainer);
      state.addContainer(largeContainer);
      for (let i = 1; i <= 6; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Perform smart collapse
      state.performSmartCollapse();

      // With budget of 25,000:
      // - small (10,800) + medium (21,600) = 32,400 > budget
      // - Only small (10,800) should be expanded as it's the lowest cost
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("medium")?.collapsed).toBe(true);
      expect(state.getContainer("large")?.collapsed).toBe(true);
    });

    it("should expand multiple containers within budget", () => {
      // Create containers that fit within budget when combined
      const container1 = createTestContainer("container1", ["node1"]); // Cost: 10,800
      const container2 = createTestContainer("container2", ["node2"]); // Cost: 10,800
      const container3 = createTestContainer("container3", ["node3"]); // Cost: 10,800

      // Add containers and nodes
      state.addContainer(container1);
      state.addContainer(container2);
      state.addContainer(container3);
      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Perform smart collapse
      state.performSmartCollapse();

      // Total cost: 3 × 10,800 = 32,400 > budget (25,000)
      // Should expand containers until budget is reached
      // First two containers: 2 × 10,800 = 21,600 < budget
      const expandedCount = [
        state.getContainer("container1")?.collapsed,
        state.getContainer("container2")?.collapsed,
        state.getContainer("container3")?.collapsed,
      ].filter((collapsed) => !collapsed).length;

      // Should expand exactly 2 containers (within budget)
      expect(expandedCount).toBe(2);
    });

    it("should handle edge case where single container exceeds budget", () => {
      // Create a container that exceeds the budget by itself
      const nodeIds = Array.from({ length: 5 }, (_, i) => `node${i + 1}`);
      const expensiveContainer = createTestContainer("expensive", nodeIds); // Cost: 5 × 10,800 = 54,000

      state.addContainer(expensiveContainer);
      for (const nodeId of nodeIds) {
        state.addNode(createTestNode(nodeId));
      }

      // Perform smart collapse
      state.performSmartCollapse();

      // Container cost (54,000) exceeds budget (25,000), so it should remain collapsed
      expect(state.getContainer("expensive")?.collapsed).toBe(true);
    });

    it("should prioritize lowest-cost containers for expansion", () => {
      // Create containers with different costs
      const cheapContainer = createTestContainer("cheap", ["node1"]); // Cost: 10,800
      const expensiveContainer = createTestContainer("expensive", [
        "node2",
        "node3",
        "node4",
      ]); // Cost: 32,400

      state.addContainer(cheapContainer);
      state.addContainer(expensiveContainer);
      for (let i = 1; i <= 4; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Perform smart collapse
      state.performSmartCollapse();

      // Should expand the cheaper container first
      expect(state.getContainer("cheap")?.collapsed).toBe(false);
      expect(state.getContainer("expensive")?.collapsed).toBe(true);
    });

    it("should handle hierarchical container expansion within budget", () => {
      // Create nested structure where parent expansion reveals child containers
      const childContainer = createTestContainer("child", ["node1"]); // Cost: 10,800
      const parentContainer = createTestContainer("parent", ["node2", "child"]); // Cost: 40,800

      state.addContainer(childContainer);
      state.addContainer(parentContainer);
      state.addNode(createTestNode("node1"));
      state.addNode(createTestNode("node2"));

      // Perform smart collapse
      state.performSmartCollapse();

      // Parent cost (40,800) exceeds budget (25,000), so both should remain collapsed
      expect(state.getContainer("parent")?.collapsed).toBe(true);
      expect(state.getContainer("child")?.collapsed).toBe(true);
    });

    it("should handle empty budget scenario", () => {
      // Create containers where even the smallest exceeds budget
      // This tests the edge case where budget is very restrictive
      const container = createTestContainer("container", [
        "node1",
        "node2",
        "node3",
      ]); // Cost: 32,400

      state.addContainer(container);
      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      // Perform smart collapse
      state.performSmartCollapse();

      // Container exceeds budget, should remain collapsed
      expect(state.getContainer("container")?.collapsed).toBe(true);
    });
  });

  describe("Various Container Structures", () => {
    it("should handle flat container structure with budget constraints", () => {
      // Create multiple root-level containers
      const containers = [
        createTestContainer("root1", ["node1", "node2"]), // Cost: 21,600
        createTestContainer("root2", ["node3"]), // Cost: 10,800
        createTestContainer("root3", ["node4", "node5", "node6"]), // Cost: 32,400
      ];

      containers.forEach((container) => state.addContainer(container));
      for (let i = 1; i <= 6; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.performSmartCollapse();

      // With budget 25,000: root2 (10,800) should be expanded, others collapsed
      expect(state.getContainer("root1")?.collapsed).toBe(true);
      expect(state.getContainer("root2")?.collapsed).toBe(false);
      expect(state.getContainer("root3")?.collapsed).toBe(true);
    });

    it("should handle deep hierarchical structure with budget constraints", () => {
      // Create 4-level deep hierarchy
      const level4 = createTestContainer("level4", ["node1"]);
      const level3 = createTestContainer("level3", ["node2", "level4"]);
      const level2 = createTestContainer("level2", ["node3", "level3"]);
      const level1 = createTestContainer("level1", ["node4", "level2"]);

      // Add in dependency order
      state.addContainer(level4);
      state.addContainer(level3);
      state.addContainer(level2);
      state.addContainer(level1);

      for (let i = 1; i <= 4; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.performSmartCollapse();

      // All containers should be collapsed due to high costs in hierarchy
      expect(state.getContainer("level1")?.collapsed).toBe(true);
      expect(state.getContainer("level2")?.collapsed).toBe(true);
      expect(state.getContainer("level3")?.collapsed).toBe(true);
      expect(state.getContainer("level4")?.collapsed).toBe(true);
    });

    it("should handle mixed structure with both flat and hierarchical containers", () => {
      // Create mixed structure: some flat, some hierarchical
      const flatContainer = createTestContainer("flat", ["node1"]); // Cost: 10,800
      const childContainer = createTestContainer("child", ["node2"]); // Cost: 10,800
      const parentContainer = createTestContainer("parent", ["node3", "child"]); // Cost: 40,800

      state.addContainer(flatContainer);
      state.addContainer(childContainer);
      state.addContainer(parentContainer);

      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.performSmartCollapse();

      // Flat container should be expanded (lowest cost), hierarchical should be collapsed
      expect(state.getContainer("flat")?.collapsed).toBe(false);
      expect(state.getContainer("parent")?.collapsed).toBe(true);
      expect(state.getContainer("child")?.collapsed).toBe(true);
    });

    it("should handle containers with only child containers (no direct nodes)", () => {
      // Create containers that only contain other containers
      const leafContainer1 = createTestContainer("leaf1", ["node1", "node2"]);
      const leafContainer2 = createTestContainer("leaf2", ["node3"]);
      const branchContainer = createTestContainer("branch", ["leaf1", "leaf2"]);

      state.addContainer(leafContainer1);
      state.addContainer(leafContainer2);
      state.addContainer(branchContainer);

      for (let i = 1; i <= 3; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.performSmartCollapse();

      // Branch container cost: 2 containers × 30,000 = 60,000 (exceeds budget)
      // All should remain collapsed
      expect(state.getContainer("branch")?.collapsed).toBe(true);
      expect(state.getContainer("leaf1")?.collapsed).toBe(true);
      expect(state.getContainer("leaf2")?.collapsed).toBe(true);
    });

    it("should handle containers with mixed node and container children", () => {
      // Create containers with both nodes and child containers
      const childContainer = createTestContainer("child", ["node1"]);
      const mixedContainer = createTestContainer("mixed", [
        "node2",
        "node3",
        "child",
      ]);

      state.addContainer(childContainer);
      state.addContainer(mixedContainer);
      state.addNode(createTestNode("node1"));
      state.addNode(createTestNode("node2"));
      state.addNode(createTestNode("node3"));

      state.performSmartCollapse();

      // Mixed container cost: 2 nodes × 10,800 + 1 container × 30,000 = 51,600 (exceeds budget)
      // Both should remain collapsed
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

      state.performSmartCollapse();

      // Each container costs 10,800
      // Budget 25,000 allows for 2 containers (21,600 total)
      const expandedCount = containers
        .map((c) => state.getContainer(c.id)?.collapsed)
        .filter((collapsed) => !collapsed).length;

      expect(expandedCount).toBe(2);
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
