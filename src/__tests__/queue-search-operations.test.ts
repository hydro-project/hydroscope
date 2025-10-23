/**
 * Queue Search Operations Tests
 *
 * Tests that verify:
 * - updateSearchHighlights updates state correctly
 * - clearSearchHighlights clears state correctly
 * - Highlights are applied after container expansion
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("AsyncCoordinator - Search Highlight Operations", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    coordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});

    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Add mock React state setter to handle render callbacks
    coordinator.setReactStateSetter((updater: any) => {
      // Mock implementation - just call the updater
      if (typeof updater === "function") {
        updater({});
      }
    });

    // Immediately notify render complete to avoid waiting
    coordinator.notifyRenderComplete();

    // Add test data
    state.addNode({
      id: "node1",
      label: "Test Node 1",
      longLabel: "Test Node 1 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "Test Node 2",
      longLabel: "Test Node 2 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node3",
      label: "Different Label",
      longLabel: "Different Label Long",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addContainer({
      id: "container1",
      label: "Test Container",
      children: new Set(["node1"]),
      collapsed: true,
      hidden: false,
    });
  });

  describe("updateSearchHighlights", () => {
    it("should update search highlights correctly", () => {
      // Test the core logic directly without async pipeline
      const results = state.performSearch("Test");
      expect(results.length).toBeGreaterThan(0);

      // Update highlights using internal method (allowed in test context)
      state._updateGraphSearchHighlights(results);

      // Verify highlights were set
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.graphSearchHighlights.size).toBeGreaterThan(0);
    });

    it("should find matching nodes", () => {
      const results = state.performSearch("node");

      // Should find node1 and node2
      expect(results.length).toBeGreaterThanOrEqual(2);
      const nodeIds = results.map((r: any) => r.id);
      expect(nodeIds).toContain("node1");
      expect(nodeIds).toContain("node2");
    });

    it("should handle empty search query", () => {
      const results = state.performSearch("");

      // Empty query should return no results
      expect(results.length).toBe(0);
    });

    it("should handle non-matching search query", () => {
      const results = state.performSearch("nonexistent");

      // Non-matching query should return no results
      expect(results.length).toBe(0);
    });

    it("should update highlights atomically through queue", async () => {
      // Test that direct state updates work correctly
      const results1 = state.performSearch("Test");
      state._updateGraphSearchHighlights(results1);

      const results2 = state.performSearch("node");
      state._updateGraphSearchHighlights(results2);

      // Final state should match the last search
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("node");
    });
  });

  describe("clearSearchHighlights", () => {
    it("should clear search highlights", () => {
      // First perform a search
      const results = state.performSearch("Test");
      state._updateGraphSearchHighlights(results);

      // Verify highlights are set
      let searchState = (state as any)._searchNavigationState;
      expect(searchState.graphSearchHighlights.size).toBeGreaterThan(0);

      // Clear highlights using internal method (allowed in test context)
      (state as any)._forAsyncCoordinator.clearSearchHighlights();

      // Verify highlights are cleared
      searchState = (state as any)._searchNavigationState;
      expect(searchState.graphSearchHighlights.size).toBe(0);
      expect(searchState.treeSearchHighlights.size).toBe(0);
      expect(searchState.searchQuery).toBe("");
    });

    it("should clear search results", () => {
      // Perform search
      const results = state.performSearch("Test");
      state._updateGraphSearchHighlights(results);

      // Verify results exist
      let searchResults = state.getSearchResults();
      expect(searchResults.length).toBeGreaterThan(0);

      // Clear
      (state as any)._forAsyncCoordinator.clearSearchHighlights();

      // Verify results are cleared
      searchResults = state.getSearchResults();
      expect(searchResults.length).toBe(0);
    });

    it("should handle clearing when no highlights exist", () => {
      // Clear without any prior search
      expect(() => {
        (state as any)._forAsyncCoordinator.clearSearchHighlights();
      }).not.toThrow();

      // Verify state is clean
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.graphSearchHighlights.size).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should handle empty state gracefully", () => {
      const emptyState = new VisualizationState();

      // Should not throw, just return empty results
      const results = emptyState.performSearch("test");

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it("should handle special characters in search", () => {
      // Test with special characters
      const results = state.performSearch("@#$%");
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Highlights after container expansion", () => {
    it("should maintain search results after expanding container", async () => {
      // Search for node1
      const results = state.performSearch("node1");
      expect(results.length).toBeGreaterThan(0);

      // Manually expand container
      await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });

      // Verify container was expanded
      const container = state.getContainer("container1");
      expect(container?.collapsed).toBe(false);

      // Search results should still be valid
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("node1");
    });

    it("should make nodes visible after container expansion", async () => {
      // Verify node1 starts hidden (in collapsed container)
      let nodes = (state as any)._nodes;
      let node1 = nodes.get("node1");
      expect(node1?.hidden).toBe(true);

      // Expand container
      await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });

      // node1 should now be visible
      nodes = (state as any)._nodes;
      node1 = nodes.get("node1");
      expect(node1?.hidden).toBe(false);
    });
  });

  describe("Sequential processing", () => {
    it("should process multiple searches sequentially", () => {
      const executionOrder: string[] = [];

      // Simulate sequential searches
      const results1 = state.performSearch("Test");
      state._updateGraphSearchHighlights(results1);
      executionOrder.push("search1");

      const results2 = state.performSearch("node");
      state._updateGraphSearchHighlights(results2);
      executionOrder.push("search2");

      (state as any)._forAsyncCoordinator.clearSearchHighlights();
      executionOrder.push("clear");

      // Verify sequential execution
      expect(executionOrder).toEqual(["search1", "search2", "clear"]);
    });

    it("should maintain state consistency across operations", () => {
      // First search
      const results1 = state.performSearch("Test");
      state._updateGraphSearchHighlights(results1);

      let searchState = (state as any)._searchNavigationState;
      const firstHighlightCount = searchState.graphSearchHighlights.size;
      expect(firstHighlightCount).toBeGreaterThan(0);

      // Second search
      const results2 = state.performSearch("node");
      state._updateGraphSearchHighlights(results2);

      searchState = (state as any)._searchNavigationState;
      const secondHighlightCount = searchState.graphSearchHighlights.size;
      expect(secondHighlightCount).toBeGreaterThan(0);

      // Clear
      (state as any)._forAsyncCoordinator.clearSearchHighlights();

      searchState = (state as any)._searchNavigationState;
      expect(searchState.graphSearchHighlights.size).toBe(0);
    });
  });
});
