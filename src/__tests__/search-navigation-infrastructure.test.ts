/**
 * Test for the new search and navigation infrastructure
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import type { GraphNode, Container } from "../types/core.js";

describe("Search and Navigation Infrastructure", () => {
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

  describe("Enhanced Search Operations", () => {
    it("should perform search with hierarchy paths", () => {
      // Create test data with hierarchy
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      const results = state.performSearch("Test");

      expect(results).toHaveLength(2);
      expect(results[0].hierarchyPath).toBeDefined();
      expect(results[0].confidence).toBeDefined();
    });

    it("should update tree search highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.performSearch("Test");

      const treeHighlights = state.getTreeSearchHighlights();
      expect(treeHighlights.has("node1")).toBe(true);
    });

    it("should update graph search highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.performSearch("Test");

      const graphHighlights = state.getGraphSearchHighlights();
      expect(graphHighlights.has("node1")).toBe(true);
    });

    it("should clear search while preserving expansion state", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Expand some tree nodes
      state.expandTreeNodes(["container1"]);

      // Perform search
      state.performSearch("Test");
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);

      // Clear search
      state.clearSearchEnhanced();

      // Search highlights should be cleared
      expect(state.getTreeSearchHighlights().size).toBe(0);
      expect(state.getGraphSearchHighlights().size).toBe(0);

      // But expansion state should be preserved
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
    });
  });

  describe("Navigation Operations", () => {
    it("should navigate to element", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.navigateToElement("node1");

      expect(state.getNavigationSelection()).toBe("node1");
      expect(state.getTreeNavigationHighlights().has("node1")).toBe(true);
      expect(state.getShouldFocusViewport()).toBe(true);
    });

    it("should clear navigation", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.navigateToElement("node1");
      expect(state.getNavigationSelection()).toBe("node1");

      state.clearNavigation();
      expect(state.getNavigationSelection()).toBe(null);
      expect(state.getTreeNavigationHighlights().size).toBe(0);
      expect(state.getShouldFocusViewport()).toBe(false);
    });
  });

  describe("Highlight Management", () => {
    it("should detect search highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.performSearch("Test");

      expect(state.getTreeElementHighlightType("node1")).toBe("search");
      expect(state.getGraphElementHighlightType("node1")).toBe("search");
    });

    it("should detect navigation highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.navigateToElement("node1");

      expect(state.getTreeElementHighlightType("node1")).toBe("navigation");
      expect(state.getGraphElementHighlightType("node1")).toBe("navigation");
    });

    it("should detect combined highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      state.performSearch("Test");
      state.navigateToElement("node1");

      expect(state.getTreeElementHighlightType("node1")).toBe("both");
      expect(state.getGraphElementHighlightType("node1")).toBe("both");
    });

    it("should return null for no highlights", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      expect(state.getTreeElementHighlightType("node1")).toBe(null);
      expect(state.getGraphElementHighlightType("node1")).toBe(null);
    });
  });

  describe("Tree Hierarchy Expansion", () => {
    it("should expand tree nodes", () => {
      state.expandTreeNodes(["container1", "container2"]);

      const expanded = state.getExpandedTreeNodes();
      expect(expanded.has("container1")).toBe(true);
      expect(expanded.has("container2")).toBe(true);
    });

    it("should collapse tree nodes", () => {
      state.expandTreeNodes(["container1", "container2"]);
      state.collapseTreeNodes(["container1"]);

      const expanded = state.getExpandedTreeNodes();
      expect(expanded.has("container1")).toBe(false);
      expect(expanded.has("container2")).toBe(true);
    });

    it("should get tree expansion path", () => {
      // Create nested hierarchy
      const node1 = createTestNode("node1", "Test Node");
      const container2 = createTestContainer("container2", "Inner Container", [
        "node1",
      ]);
      const container1 = createTestContainer("container1", "Outer Container", [
        "container2",
      ]);

      state.addNode(node1);
      state.addContainer(container2);
      state.addContainer(container1);

      const expansionPath = state.getTreeExpansionPath("node1");
      expect(expansionPath).toContain("container1");
      expect(expansionPath).toContain("container2");
    });
  });

  describe("Enhanced Container Operations", () => {
    it("should expand specific containers", () => {
      const container1 = createTestContainer("container1", "Container 1", []);
      const container2 = createTestContainer("container2", "Container 2", []);

      state.addContainer(container1);
      state.addContainer(container2);

      // Collapse both
      state._collapseAllContainersForCoordinator();

      // Expand only container1
      state._expandAllContainersForCoordinator(["container1"]);

      expect(state.getContainer("container1")?.collapsed).toBe(false);
      expect(state.getContainer("container2")?.collapsed).toBe(true);
    });

    it("should collapse specific containers", () => {
      const container1 = createTestContainer("container1", "Container 1", []);
      const container2 = createTestContainer("container2", "Container 2", []);

      state.addContainer(container1);
      state.addContainer(container2);

      // Collapse only container1
      state._collapseAllContainersForCoordinator(["container1"]);

      expect(state.getContainer("container1")?.collapsed).toBe(true);
      expect(state.getContainer("container2")?.collapsed).toBe(false);
    });
  });

  describe("Viewport Management", () => {
    it("should track viewport focus state", () => {
      expect(state.getShouldFocusViewport()).toBe(false);

      state.navigateToElement("node1");
      expect(state.getShouldFocusViewport()).toBe(true);

      state.resetViewportFocus();
      expect(state.getShouldFocusViewport()).toBe(false);
    });

    it("should track last navigation target", () => {
      expect(state.getLastNavigationTarget()).toBe(null);

      state.navigateToElement("node1");
      expect(state.getLastNavigationTarget()).toBe("node1");

      state.navigateToElement("node2");
      expect(state.getLastNavigationTarget()).toBe("node2");
    });
  });
});
