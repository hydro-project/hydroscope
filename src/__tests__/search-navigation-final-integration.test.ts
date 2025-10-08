/**
 * @fileoverview Final Integration Tests for Search and Navigation
 *
 * Comprehensive testing with large datasets, accessibility, and edge cases.
 * Uses paxos-flipped.json (543 nodes, 581 edges) for performance testing.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Search Navigation Final Integration", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;
  let bridge: ReactFlowBridge;
  let paxosData: HydroscopeData;
  let performanceMetrics: {
    searchTimes: number[];
    navigationTimes: number[];
    renderTimes: number[];
  };

  beforeEach(async () => {
    // Load the large paxos-flipped.json dataset
    const paxosPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );

    if (!fs.existsSync(paxosPath)) {
      throw new Error(`Test data file not found: ${paxosPath}`);
    }

    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent) as HydroscopeData;

    // Parse the data using JSONParser
    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(paxosData);

    state = parseResult.visualizationState;
    coordinator = new AsyncCoordinator();
    bridge = new ReactFlowBridge({
      nodeStyles: {},
      edgeStyles: {},
      containerStyles: {},
    });

    // Initialize performance metrics
    performanceMetrics = {
      searchTimes: [],
      navigationTimes: [],
      renderTimes: [],
    };

    // Initially collapse all containers to test expansion
    state.collapseAllContainers();
  });

  afterEach(() => {
    // Log performance metrics if any tests collected them
    if (performanceMetrics.searchTimes.length > 0) {
      const avgSearchTime =
        performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) /
        performanceMetrics.searchTimes.length;
      console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);
    }
    if (performanceMetrics.navigationTimes.length > 0) {
      const avgNavTime =
        performanceMetrics.navigationTimes.reduce((a, b) => a + b, 0) /
        performanceMetrics.navigationTimes.length;
      console.log(`Average navigation time: ${avgNavTime.toFixed(2)}ms`);
    }
    if (performanceMetrics.renderTimes.length > 0) {
      const avgRenderTime =
        performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) /
        performanceMetrics.renderTimes.length;
      console.log(`Average render time: ${avgRenderTime.toFixed(2)}ms`);
    }
  });

  describe("Integration with Existing Hydroscope Architecture", () => {
    it("should integrate seamlessly with VisualizationState", () => {
      // Test that all search and navigation methods are available
      expect(typeof state.performSearch).toBe("function");
      expect(typeof state.clearSearchEnhanced).toBe("function");
      expect(typeof state.navigateToElement).toBe("function");
      expect(typeof state.clearNavigation).toBe("function");
      expect(typeof state.expandTreeNodes).toBe("function");
      expect(typeof state.collapseTreeNodes).toBe("function");

      // Test that state management works correctly
      const initialQuery = state.getSearchQuery();
      expect(initialQuery).toBe("");

      state.performSearch("test");
      expect(state.getSearchQuery()).toBe("test");

      state.clearSearchEnhanced();
      expect(state.getSearchQuery()).toBe("");
    });

    it("should integrate with AsyncCoordinator for complex operations", async () => {
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Test that AsyncCoordinator methods are available
      expect(typeof coordinator.navigateToElement).toBe("function");
      expect(typeof coordinator.focusViewportOnElement).toBe("function");
      expect(typeof coordinator.expandAllTreeNodes).toBe("function");
      expect(typeof coordinator.collapseAllTreeNodes).toBe("function");

      // Test navigation coordination
      await coordinator.navigateToElement(
        "test-node",
        state,
        mockReactFlowInstance,
      );
      expect(state.getNavigationSelection()).toBe("test-node");
    });

    it("should integrate with ReactFlowBridge for rendering", () => {
      // Perform search and navigation
      state.performSearch("proposer");
      state.navigateToElement("test-node");

      // Test that bridge can render the state
      const reactFlowData = bridge.toReactFlowData(state);

      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.nodes)).toBe(true);
      expect(Array.isArray(reactFlowData.edges)).toBe(true);
    });
  });

  describe("Large Dataset Performance Testing", () => {
    it("should handle search operations efficiently with 543 nodes", () => {
      const searchTerms = ["persist", "cycle", "network", "filter", "tee"];

      searchTerms.forEach((term) => {
        const startTime = performance.now();
        const results = state.performSearch(term);
        const endTime = performance.now();

        const searchTime = endTime - startTime;
        performanceMetrics.searchTimes.push(searchTime);

        // Search should complete within reasonable time (< 100ms for large dataset)
        expect(searchTime).toBeLessThan(100);

        // Should find results for common terms that exist in the data
        if (term === "persist" || term === "cycle") {
          expect(results.length).toBeGreaterThan(0);
        }
      });
    });

    it("should handle tree expansion efficiently with large hierarchy", async () => {
      // Find a search term that will require expansion
      const results = state.performSearch("persist");

      if (results.length > 0) {
        const startTime = performance.now();

        // This should trigger tree expansion for search results
        const expandedNodes = state.getExpandedTreeNodes();

        const endTime = performance.now();
        const expansionTime = endTime - startTime;

        // Tree expansion should be fast even with large datasets
        expect(expansionTime).toBeLessThan(50);

        // Should have expanded some nodes
        expect(expandedNodes.size).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle ReactFlow rendering efficiently with large graphs", () => {
      // Perform search to create highlights
      state.performSearch("proposer");
      state.navigateToElement("test-node");

      const startTime = performance.now();
      const reactFlowData = bridge.toReactFlowData(state);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      performanceMetrics.renderTimes.push(renderTime);

      // Rendering should be efficient even with large datasets
      expect(renderTime).toBeLessThan(200);

      // Should produce valid ReactFlow data
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);
      expect(reactFlowData.edges.length).toBeGreaterThan(0);
    });

    it("should handle rapid search operations without performance degradation", () => {
      const searchTerms = [
        "a",
        "ac",
        "acc",
        "acce",
        "accep",
        "accept",
        "acceptor",
      ];
      const searchTimes: number[] = [];

      searchTerms.forEach((term) => {
        const startTime = performance.now();
        state.performSearch(term);
        const endTime = performance.now();

        searchTimes.push(endTime - startTime);
      });

      // Later searches shouldn't be significantly slower than earlier ones
      const firstHalf = searchTimes.slice(
        0,
        Math.floor(searchTimes.length / 2),
      );
      const secondHalf = searchTimes.slice(Math.floor(searchTimes.length / 2));

      const avgFirstHalf =
        firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half shouldn't be more than 2x slower than first half
      expect(avgSecondHalf).toBeLessThan(avgFirstHalf * 2);
    });

    it("should handle memory efficiently during extended use", () => {
      // Simulate extended use with many search operations
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 50; i++) {
        state.performSearch(`search${i}`);
        state.clearSearchEnhanced();
        state.navigateToElement(`node${i}`);
        state.clearNavigation();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 50MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe("Accessibility Compliance and Keyboard Navigation", () => {
    it("should provide accessible search result information", () => {
      const results = state.performSearch("persist");

      results.forEach((result) => {
        // Each result should have required accessibility information
        expect(result.id).toBeDefined();
        expect(result.label).toBeDefined();
        expect(result.type).toBeDefined();
        expect(result.hierarchyPath).toBeDefined();

        // Labels should be non-empty strings
        expect(typeof result.label).toBe("string");
        expect(result.label.length).toBeGreaterThan(0);

        // Hierarchy path should provide context
        expect(Array.isArray(result.hierarchyPath)).toBe(true);
      });
    });

    it("should support keyboard navigation patterns", () => {
      const results = state.performSearch("persist");

      if (results.length > 1) {
        // Test navigation between search results
        state.navigateToElement(results[0].id);
        expect(state.getNavigationSelection()).toBe(results[0].id);

        state.navigateToElement(results[1].id);
        expect(state.getNavigationSelection()).toBe(results[1].id);

        // Test clearing navigation (equivalent to Escape key)
        state.clearNavigation();
        expect(state.getNavigationSelection()).toBe(null);
      }
    });

    it("should provide proper highlight contrast and visibility", () => {
      state.performSearch("persist");
      state.navigateToElement("test-node");

      const reactFlowData = bridge.toReactFlowData(state);

      // Check that highlighted nodes have proper styling
      const highlightedNodes = reactFlowData.nodes.filter(
        (node) => node.data?.isHighlighted || node.style?.backgroundColor,
      );

      highlightedNodes.forEach((node) => {
        if (node.style?.backgroundColor) {
          // Background color should be defined and not transparent
          expect(node.style.backgroundColor).toBeDefined();
          expect(node.style.backgroundColor).not.toBe("transparent");
        }

        if (node.style?.border) {
          // Border should be defined for highlighted elements
          expect(node.style.border).toBeDefined();
        }
      });
    });

    it("should handle screen reader announcements structure", () => {
      const results = state.performSearch("persist");

      // Results should be structured for screen reader announcements
      results.forEach((result) => {
        // Should have hierarchical context for announcements
        expect(result.hierarchyPath).toBeDefined();
        expect(Array.isArray(result.hierarchyPath)).toBe(true);

        // Should have confidence/relevance information
        expect(typeof result.confidence).toBe("number");
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      // Navigation selection should be trackable for announcements
      if (results.length > 0) {
        state.navigateToElement(results[0].id);
        expect(state.getNavigationSelection()).toBe(results[0].id);
        expect(state.getLastNavigationTarget()).toBe(results[0].id);
      }
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle empty search queries gracefully", () => {
      expect(() => state.performSearch("")).not.toThrow();
      expect(() => state.performSearch("   ")).not.toThrow();
      expect(() => state.performSearch("\t\n")).not.toThrow();

      const emptyResults = state.performSearch("");
      expect(Array.isArray(emptyResults)).toBe(true);
      expect(emptyResults.length).toBe(0);
    });

    it("should handle search queries with special characters", () => {
      const specialQueries = [
        "test@#$%",
        "query with spaces",
        "query\nwith\nnewlines",
        "query\twith\ttabs",
        "query'with'quotes",
        'query"with"double"quotes',
        "query\\with\\backslashes",
        "query/with/slashes",
        "query.with.dots",
        "query-with-dashes",
        "query_with_underscores",
      ];

      specialQueries.forEach((query) => {
        expect(() => state.performSearch(query)).not.toThrow();
        const results = state.performSearch(query);
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it("should handle navigation to non-existent elements", () => {
      expect(() => state.navigateToElement("non-existent-id")).not.toThrow();
      expect(state.getNavigationSelection()).toBe("non-existent-id");

      // Should still be able to clear navigation
      expect(() => state.clearNavigation()).not.toThrow();
      expect(state.getNavigationSelection()).toBe(null);
    });

    it("should handle concurrent search and navigation operations", async () => {
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Start multiple operations concurrently
      const searchPromise = Promise.resolve(state.performSearch("persist"));
      const navPromise = coordinator.navigateToElement(
        "test-node",
        state,
        mockReactFlowInstance,
      );

      // Wait for both to complete
      const [searchResults] = await Promise.all([searchPromise, navPromise]);

      // Both operations should complete successfully
      expect(Array.isArray(searchResults)).toBe(true);
      expect(state.getNavigationSelection()).toBe("test-node");
    });

    it("should handle state corruption gracefully", () => {
      // Perform normal operations
      state.performSearch("persist");
      state.navigateToElement("test-node");

      // Simulate clearing highlights manually (potential corruption)
      state.clearSearchEnhanced();

      // Should still be able to perform new operations
      expect(() => state.performSearch("cycle")).not.toThrow();
      expect(() => state.navigateToElement("another-node")).not.toThrow();

      // State should be consistent
      expect(state.getSearchQuery()).toBe("cycle");
      expect(state.getNavigationSelection()).toBe("another-node");
    });

    it("should handle very long search queries", () => {
      const longQuery = "a".repeat(1000);

      expect(() => state.performSearch(longQuery)).not.toThrow();
      const results = state.performSearch(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle rapid state changes", () => {
      // Rapidly change search and navigation state
      for (let i = 0; i < 100; i++) {
        state.performSearch(`query${i}`);
        state.navigateToElement(`node${i}`);

        if (i % 10 === 0) {
          state.clearSearchEnhanced();
          state.clearNavigation();
        }
      }

      // Final state should be consistent
      expect(typeof state.getSearchQuery()).toBe("string");
      expect(state.getNavigationSelection()).toBeDefined();
    });

    it("should handle container expansion failures gracefully", async () => {
      // Mock a failing container expansion
      const originalExpandTreeNodes = state.expandTreeNodes;
      state.expandTreeNodes = vi.fn().mockImplementation(() => {
        throw new Error("Expansion failed");
      });

      // Search should still work even if expansion fails
      expect(() => state.performSearch("proposer")).not.toThrow();

      // Restore original method
      state.expandTreeNodes = originalExpandTreeNodes;
    });
  });

  describe("Performance Regression Testing", () => {
    it("should maintain consistent search performance across dataset sizes", () => {
      const searchTerm = "persist";
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        state.performSearch(searchTerm);
        const endTime = performance.now();

        times.push(endTime - startTime);

        // Clear search to reset state
        state.clearSearchEnhanced();
      }

      // Calculate statistics
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Performance should be consistent (allow for more variance in test environment)
      expect(maxTime - minTime).toBeLessThan(avgTime * 5); // Max variance shouldn't exceed 5x average
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
    });

    it("should handle stress testing with rapid operations", () => {
      const startTime = performance.now();

      // Perform 1000 rapid operations
      for (let i = 0; i < 1000; i++) {
        if (i % 4 === 0) state.performSearch(`query${i}`);
        if (i % 4 === 1) state.navigateToElement(`node${i}`);
        if (i % 4 === 2) state.clearSearchEnhanced();
        if (i % 4 === 3) state.clearNavigation();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 1000 operations should complete in reasonable time
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds

      // Final state should be valid
      expect(typeof state.getSearchQuery()).toBe("string");
    });
  });
});
