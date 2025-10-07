/**
 * Test for search and navigation state management enhancements
 * Tests debouncing, caching, cleanup, and state persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import type { GraphNode, Container } from "../types/core.js";

// Mock timers for debouncing tests
vi.useFakeTimers();

describe("Search and Navigation State Management", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
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

  describe("Search Query Debouncing", () => {
    it("should debounce search queries with 300ms delay", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      const callback = vi.fn();

      // Trigger multiple rapid searches
      state.performSearchDebounced("Test", callback, 300);
      state.performSearchDebounced("Test", callback, 300);
      state.performSearchDebounced("Test", callback, 300);

      // Should not have called callback yet
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward time by 299ms - still shouldn't call
      vi.advanceTimersByTime(299);
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward by 1 more ms - should call now
      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledOnce();

      // Should have called with the final query
      const results = callback.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe("Test Node");
    });

    it("should cancel previous debounced search when new one is triggered", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      // Trigger first search
      state.performSearchDebounced("Test", callback1, 300);

      // Fast-forward by 200ms
      vi.advanceTimersByTime(200);

      // Trigger second search (should cancel first)
      state.performSearchDebounced("Different", callback2, 300);

      // Fast-forward by 300ms
      vi.advanceTimersByTime(300);

      // Only second callback should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it("should track debouncing state", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      expect(state.isSearchDebouncing()).toBe(false);

      state.performSearchDebounced("Test", undefined, 300);
      expect(state.isSearchDebouncing()).toBe(true);

      vi.advanceTimersByTime(300);
      expect(state.isSearchDebouncing()).toBe(false);
    });
  });

  describe("Search Result Caching", () => {
    it("should cache search results for performance", () => {
      const node1 = createTestNode("node1", "Test Node");
      const node2 = createTestNode("node2", "Another Node");
      state.addNode(node1);
      state.addNode(node2);

      // First search - should compute results
      const results1 = state.performSearch("Test");
      expect(results1).toHaveLength(1);

      // Second search with same query - should use cache
      const results2 = state.performSearch("Test");
      expect(results2).toHaveLength(1);
      expect(results2[0].id).toBe("node1");

      // Verify cache statistics
      const cacheStats = state.getSearchCacheStats();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.maxSize).toBe(50);
    });

    it("should cache different queries separately", () => {
      const node1 = createTestNode("node1", "Test Node");
      const node2 = createTestNode("node2", "Another Node");
      state.addNode(node1);
      state.addNode(node2);

      // Search for different terms
      const results1 = state.performSearch("Test");
      const results2 = state.performSearch("Another");

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].id).toBe("node1");
      expect(results2[0].id).toBe("node2");

      // Should have 2 entries in cache
      const cacheStats = state.getSearchCacheStats();
      expect(cacheStats.size).toBe(2);
    });

    it("should clear search cache when requested", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Perform search to populate cache
      state.performSearch("Test");
      expect(state.getSearchCacheStats().size).toBe(1);

      // Clear cache
      state.clearSearchCache();
      expect(state.getSearchCacheStats().size).toBe(0);
    });

    it.skip("should implement LRU eviction when cache is full", () => {
      // Create a single node that will match our test query
      const node1 = createTestNode("node1", "Test");
      state.addNode(node1);

      // Fill cache with exactly max size + 1 entries to test eviction
      const maxSize = state.getSearchCacheStats().maxSize;
      for (let i = 0; i <= maxSize; i++) {
        state.performSearch(`query${i}`);
      }

      const cacheStats = state.getSearchCacheStats();
      // Cache should not exceed max size
      expect(cacheStats.size).toBeLessThanOrEqual(cacheStats.maxSize);
      // Cache should have at least some entries (not be empty)
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe("Proper Cleanup of Highlights", () => {
    it("should clear search highlights while preserving expansion state", () => {
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Expand tree nodes
      state.expandTreeNodes(["container1"]);

      // Perform search
      state.performSearch("Test");
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
      expect(state.getGraphSearchHighlights().size).toBeGreaterThan(0);

      // Clear search
      state.clearSearchEnhanced();

      // Highlights should be cleared
      expect(state.getTreeSearchHighlights().size).toBe(0);
      expect(state.getGraphSearchHighlights().size).toBe(0);

      // Expansion state should be preserved
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
    });

    it("should clear debounce timers when clearing search", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Start debounced search
      state.performSearchDebounced("Test", undefined, 300);
      expect(state.isSearchDebouncing()).toBe(true);

      // Clear search should cancel debounce
      state.clearSearchEnhanced();
      expect(state.isSearchDebouncing()).toBe(false);
    });

    it("should clear all debounce timers on cleanup", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Start debounced search
      state.performSearchDebounced("Test", undefined, 300);
      expect(state.isSearchDebouncing()).toBe(true);

      // Clear all timers
      state.clearDebounceTimers();
      expect(state.isSearchDebouncing()).toBe(false);
    });
  });

  describe("State Persistence", () => {
    it("should create and restore state snapshots", () => {
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Set up some state
      state.performSearch("Test");
      state.navigateToElement("node1");
      state.expandTreeNodes(["container1"]);

      // Create snapshot
      const snapshot = state.createStateSnapshot();
      expect(snapshot).toBeTruthy();

      // Create new state and restore
      const newState = new VisualizationState();
      newState.addNode(node1);
      newState.addContainer(container1);

      const restored = newState.restoreStateSnapshot(snapshot);
      expect(restored).toBe(true);

      // Verify state was restored
      expect(newState.getSearchQueryEnhanced()).toBe("Test");
      expect(newState.getNavigationSelection()).toBe("node1");
      expect(newState.getExpandedTreeNodes().has("container1")).toBe(true);
    });

    it("should detect state changes", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Initially should be changed (no previous snapshot)
      expect(state.hasStateChanged()).toBe(true);

      // Create snapshot
      state.createStateSnapshot();
      expect(state.hasStateChanged()).toBe(false);

      // Make a change
      state.performSearch("Test");
      expect(state.hasStateChanged()).toBe(true);
    });

    it("should handle invalid snapshots gracefully", () => {
      const restored1 = state.restoreStateSnapshot("invalid json");
      expect(restored1).toBe(false);

      const restored2 = state.restoreStateSnapshot('{"version": 999}');
      expect(restored2).toBe(false);
    });

    it("should provide state version for compatibility", () => {
      expect(state.getStateVersion()).toBe(1);
    });
  });

  describe("Integration with Existing Search", () => {
    it("should maintain backward compatibility with old search methods", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Old search method should still work
      const oldResults = state.search("Test");
      expect(oldResults).toHaveLength(1);

      // New search method should work
      const newResults = state.performSearch("Test");
      expect(newResults).toHaveLength(1);

      // Both should have same results
      expect(oldResults[0].id).toBe(newResults[0].id);
    });

    it("should sync old and new search state", () => {
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Perform search with new method
      state.performSearch("Test");

      // Old getters should return consistent data
      expect(state.getSearchQuery()).toBe("Test");
      expect(state.getSearchQueryEnhanced()).toBe("Test");
    });
  });
});
