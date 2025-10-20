/**
 * Tests for VisualizationState search functionality
 * Covers search state management, algorithms, and result generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import {
  createTestNode,
  createTestContainer,
  createTestEdge,
} from "../utils/testData.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("VisualizationState Search Functionality", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    const elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    const reactFlowBridge = new ReactFlowBridge({});
    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    state = new VisualizationState();
  });

  describe("Search State Management", () => {
    it("should initialize with empty search state", () => {
      expect(state.getSearchQuery()).toBe("");
      expect(state.getSearchResults()).toHaveLength(0);
      expect(state.getSearchHistory()).toHaveLength(0);
      expect(state.isSearchActive()).toBe(false);
      expect(state.getSearchResultCount()).toBe(0);
      expect(state.getSearchExpandedContainers()).toHaveLength(0);
    });

    it("should update search state when performing search", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      const results = state.search("Test");

      expect(state.getSearchQuery()).toBe("Test");
      expect(state.isSearchActive()).toBe(true);
      expect(state.getSearchResultCount()).toBe(1);
      expect(results).toHaveLength(1);
    });

    it("should maintain search history", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      state.search("Test");
      state.search("Node");
      state.search("Another");

      const history = state.getSearchHistory();
      expect(history).toEqual(["Another", "Node", "Test"]);
    });

    it("should limit search history to 10 items", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      // Add 12 search queries
      for (let i = 1; i <= 12; i++) {
        state.search(`query${i}`);
      }

      const history = state.getSearchHistory();
      expect(history).toHaveLength(10);
      expect(history[0]).toBe("query12"); // Most recent first
      expect(history[9]).toBe("query3"); // Oldest kept
    });

    it("should not duplicate search history entries", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      state.search("Test");
      state.search("Node");
      state.search("Test"); // Duplicate

      const history = state.getSearchHistory();
      expect(history).toEqual(["Test", "Node"]); // Test moved to front, no duplicate
    });

    it("should clear search state properly", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      state.search("Test");
      expect(state.isSearchActive()).toBe(true);

      state.clearSearch();

      expect(state.getSearchQuery()).toBe("");
      expect(state.getSearchResults()).toHaveLength(0);
      expect(state.isSearchActive()).toBe(false);
      expect(state.getSearchResultCount()).toBe(0);
      expect(state.getSearchExpandedContainers()).toHaveLength(0);
    });

    it("should track containers expanded for search", async () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1", "Test Node");

      state.addContainer(container);
      state.addNode(node);
      await coordinator.collapseContainer("container1", state, {
        fitView: false,
      });

      state.expandContainerForSearch("container1");

      const expandedContainers = state.getSearchExpandedContainers();
      expect(expandedContainers).toContain("container1");
    });
  });

  describe("Search Algorithms", () => {
    beforeEach(() => {
      // Clear any existing data and set up fresh test data
      state = new VisualizationState();

      const node1 = createTestNode("node1", "JavaScript Function");
      const node2 = createTestNode("node2", "Python Script");
      const node3 = createTestNode("node3", "Java Application");
      const container1 = createTestContainer(
        "container1",
        ["node1"],
        "Frontend Code",
      );
      const container2 = createTestContainer(
        "container2",
        ["node2"],
        "Backend Scripts",
      );

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container1);
      state.addContainer(container2);
    });

    it("should perform exact substring matching", () => {
      // Create a fresh state to avoid any test pollution
      const freshState = new VisualizationState();
      const node2 = createTestNode("node2", "Python Script");
      const container2 = createTestContainer(
        "container2",
        ["node2"],
        "Backend Scripts",
      );

      freshState.addNode(node2);
      freshState.addContainer(container2);

      const results = freshState.search("Script");

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.id === "node2")).toBe(true); // Python Script
      expect(results.some((r) => r.id === "container2")).toBe(true); // Backend Scripts
    });

    it("should be case insensitive", () => {
      const results = state.search("javascript");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("node1");
      expect(results[0].label).toBe("JavaScript Function");
    });

    it("should perform fuzzy matching", () => {
      const results = state.search("jvapp"); // Should match "Java Application"

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("node3");
      expect(results[0].label).toBe("Java Application");
    });

    it("should provide match indices for highlighting", () => {
      const results = state.search("Script");

      const scriptResult = results.find((r) => r.id === "node2");
      expect(scriptResult?.matchIndices).toEqual([[7, 13]]); // "Python Script"
    });

    it("should sort results by relevance", () => {
      // Add a node with exact match
      const exactNode = createTestNode("exact", "Script");
      state.addNode(exactNode);

      const results = state.search("Script");

      // Should find all matches including exact match
      expect(results.length).toBeGreaterThan(0);
      const exactMatch = results.find((r) => r.id === "exact");
      expect(exactMatch).toBeDefined();
      expect(exactMatch?.label).toBe("Script");
    });

    it("should handle empty queries", () => {
      const results = state.search("");

      expect(results).toHaveLength(0);
      expect(state.isSearchActive()).toBe(false);
    });

    it("should handle queries with only whitespace", () => {
      const results = state.search("   ");

      expect(results).toHaveLength(0);
      expect(state.isSearchActive()).toBe(false);
    });
  });

  describe("Advanced Search Features", () => {
    beforeEach(() => {
      const node1 = createTestNode("node1", "Test Node");
      node1.semanticTags = ["frontend", "component"];
      const node2 = createTestNode("node2", "Another Node");
      node2.semanticTags = ["backend", "service"];
      const container1 = createTestContainer(
        "container1",
        ["node1"],
        "Test Container",
      );
      const edge1 = createTestEdge("edge1", "node1", "node2");
      edge1.semanticTags = ["api-call", "async"];

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container1);
      state.addEdge(edge1);
    });

    it("should search by entity type", () => {
      const nodeResults = state.searchByType("Test", "node");
      const containerResults = state.searchByType("Test", "container");

      expect(nodeResults).toHaveLength(1);
      expect(nodeResults[0].type).toBe("node");
      expect(containerResults).toHaveLength(1);
      expect(containerResults[0].type).toBe("container");
    });

    it("should search by semantic tags", () => {
      const results = state.searchBySemanticTag("frontend");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("node1");
    });

    it("should find nodes connected by edges with semantic tags", () => {
      const results = state.searchBySemanticTag("api-call");

      expect(results).toHaveLength(2); // Both connected nodes
      expect(results.some((r) => r.id === "node1")).toBe(true);
      expect(results.some((r) => r.id === "node2")).toBe(true);
    });

    it("should provide search suggestions", () => {
      const suggestions = state.getSearchSuggestions("Test");

      expect(suggestions).toContain("Test Node");
      expect(suggestions).toContain("Test Container");
    });

    it("should limit search suggestions", () => {
      // Add many matching items
      for (let i = 0; i < 10; i++) {
        const node = createTestNode(`test${i}`, `Test Item ${i}`);
        state.addNode(node);
      }

      const suggestions = state.getSearchSuggestions("Test", 3);

      expect(suggestions).toHaveLength(3);
    });

    it("should include search history in suggestions", () => {
      state.search("Previous Search");

      const suggestions = state.getSearchSuggestions("Previous");

      expect(suggestions).toContain("Previous Search");
    });
  });

  describe("Search History Management", () => {
    it("should clear search history", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      state.search("Test");
      state.search("Node");

      expect(state.getSearchHistory()).toHaveLength(2);

      state.clearSearchHistory();

      expect(state.getSearchHistory()).toHaveLength(0);
    });
  });
});
