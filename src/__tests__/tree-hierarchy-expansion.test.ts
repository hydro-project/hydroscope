/**
 * Tests for tree hierarchy expansion and highlighting functionality
 * Task 2: Implement tree hierarchy expansion and highlighting
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import type { GraphNode, Container, SearchResult } from "../types/core.js";

describe("Tree Hierarchy Expansion and Highlighting", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();

    // Create a nested hierarchy for testing
    // Root -> Container1 -> Container2 -> Node1
    //      -> Container3 -> Node2

    // Add nodes
    const node1: GraphNode = {
      id: "node1",
      label: "Test Node 1",
      semanticTags: [],
      hidden: false,
    };

    const node2: GraphNode = {
      id: "node2",
      label: "Search Target Node",
      semanticTags: [],
      hidden: false,
    };

    state.addNode(node1);
    state.addNode(node2);

    // Add containers in hierarchy
    const container2: Container = {
      id: "container2",
      label: "Inner Container",
      children: new Set(["node1"]),
      collapsed: false,
      hidden: false,
    };

    const container1: Container = {
      id: "container1",
      label: "Outer Container",
      children: new Set(["container2"]),
      collapsed: false,
      hidden: false,
    };

    const container3: Container = {
      id: "container3",
      label: "Another Container",
      children: new Set(["node2"]),
      collapsed: false,
      hidden: false,
    };

    state.addContainer(container2);
    state.addContainer(container1);
    state.addContainer(container3);
  });

  describe("Search-driven Tree Expansion", () => {
    it("should expand tree hierarchy to show search matches", () => {
      // Initially collapse all tree nodes
      state.collapseTreeNodes(["container1", "container2", "container3"]);

      // Verify nodes are collapsed
      expect(state.getExpandedTreeNodes().has("container1")).toBe(false);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(false);
      expect(state.getExpandedTreeNodes().has("container3")).toBe(false);

      // Create search results that would require expansion
      const searchResults: SearchResult[] = [
        {
          id: "node1",
          label: "Test Node 1",
          type: "node",
          matchIndices: [[0, 4]], // "Test"
          hierarchyPath: ["container1", "container2"],
          confidence: 1.0,
        },
        {
          id: "node2",
          label: "Search Target Node",
          type: "node",
          matchIndices: [[0, 6]], // "Search"
          hierarchyPath: ["container3"],
          confidence: 1.0,
        },
      ];

      // Expand tree to show matches
      state.expandTreeToShowMatches(searchResults);

      // Verify necessary containers were expanded
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(true);
      expect(state.getExpandedTreeNodes().has("container3")).toBe(true);
    });

    it("should not expand already expanded containers", () => {
      // Expand some containers initially
      state.expandTreeNodes(["container1"]);

      const searchResults: SearchResult[] = [
        {
          id: "node1",
          label: "Test Node 1",
          type: "node",
          matchIndices: [[0, 4]],
          hierarchyPath: ["container1", "container2"],
          confidence: 1.0,
        },
      ];

      // Track initial state
      const initialExpanded = new Set(state.getExpandedTreeNodes());

      // Expand tree to show matches
      state.expandTreeToShowMatches(searchResults);

      // Verify container1 was already expanded, container2 got expanded
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(true);

      // Should have added container2 but container1 was already there
      expect(state.getExpandedTreeNodes().size).toBe(initialExpanded.size + 1);
    });
  });

  describe("Collapsed Ancestor Highlighting", () => {
    it("should highlight collapsed ancestors containing search matches", () => {
      // Set up search results
      const searchResults: SearchResult[] = [
        {
          id: "node1",
          label: "Test Node 1",
          type: "node",
          matchIndices: [[0, 4]],
          hierarchyPath: ["container1", "container2"],
          confidence: 1.0,
        },
      ];

      // Set search results and collapse some containers
      state.performSearch("Test");
      state.collapseTreeNodes(["container1"]);

      // Update collapsed ancestors highlighting
      state.updateCollapsedAncestorsInTree();

      // Verify collapsed ancestor is highlighted
      expect(state.getTreeSearchHighlights().has("container1")).toBe(true);

      // Verify the actual match is also highlighted
      expect(state.getTreeSearchHighlights().has("node1")).toBe(true);
    });

    it("should not highlight expanded ancestors", () => {
      const searchResults: SearchResult[] = [
        {
          id: "node1",
          label: "Test Node 1",
          type: "node",
          matchIndices: [[0, 4]],
          hierarchyPath: ["container1", "container2"],
          confidence: 1.0,
        },
      ];

      // Keep containers expanded
      state.expandTreeNodes(["container1", "container2"]);
      state.performSearch("Test");

      // Update highlighting
      state.updateCollapsedAncestorsInTree();

      // Verify expanded ancestors are not highlighted (only the match itself)
      expect(state.getTreeSearchHighlights().has("container1")).toBe(false);
      expect(state.getTreeSearchHighlights().has("container2")).toBe(false);
      expect(state.getTreeSearchHighlights().has("node1")).toBe(true);
    });

    it("should highlight multiple collapsed ancestors in hierarchy", () => {
      // Perform search first to get results
      state.performSearch("Test");

      // Then collapse both ancestors after search
      state.collapseTreeNodes(["container1", "container2"]);

      // Update highlighting for collapsed ancestors
      state.updateCollapsedAncestorsInTree();

      // Both collapsed ancestors should be highlighted
      expect(state.getTreeSearchHighlights().has("container1")).toBe(true);
      expect(state.getTreeSearchHighlights().has("container2")).toBe(true);
      expect(state.getTreeSearchHighlights().has("node1")).toBe(true);
    });
  });

  describe("Integration with performSearch", () => {
    it("should automatically expand tree and update highlights during search", () => {
      // Initially collapse containers
      state.collapseTreeNodes(["container1", "container2", "container3"]);

      // Perform search - this should trigger automatic expansion
      const results = state.performSearch("Test");

      // Verify search found the match
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("node1");

      // Verify tree was automatically expanded to show the match
      expect(state.getExpandedTreeNodes().has("container1")).toBe(true);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(true);

      // Verify highlights were applied
      expect(state.getTreeSearchHighlights().has("node1")).toBe(true);
    });

    it("should handle search with no matches gracefully", () => {
      state.collapseTreeNodes(["container1", "container2", "container3"]);

      const results = state.performSearch("NonExistentTerm");

      // No results should be found
      expect(results).toHaveLength(0);

      // Tree should remain collapsed since no matches to show
      expect(state.getExpandedTreeNodes().has("container1")).toBe(false);
      expect(state.getExpandedTreeNodes().has("container2")).toBe(false);
      expect(state.getExpandedTreeNodes().has("container3")).toBe(false);

      // No highlights should be applied
      expect(state.getTreeSearchHighlights().size).toBe(0);
    });
  });

  describe("Tree Expansion Path Calculation", () => {
    it("should calculate correct expansion path for nested elements", () => {
      // Collapse all containers
      state.collapseTreeNodes(["container1", "container2", "container3"]);

      // Get expansion path for deeply nested node
      const expansionPath = state.getTreeExpansionPath("node1");

      // Should include both ancestors that need expansion
      expect(expansionPath).toContain("container1");
      expect(expansionPath).toContain("container2");
      expect(expansionPath).toHaveLength(2);
    });

    it("should return empty path for already visible elements", () => {
      // Expand all containers
      state.expandTreeNodes(["container1", "container2", "container3"]);

      // Get expansion path for visible node
      const expansionPath = state.getTreeExpansionPath("node1");

      // Should be empty since all ancestors are already expanded
      expect(expansionPath).toHaveLength(0);
    });

    it("should return partial path for partially visible elements", () => {
      // Expand only outer container
      state.expandTreeNodes(["container1"]);
      state.collapseTreeNodes(["container2"]);

      // Get expansion path for node in collapsed inner container
      const expansionPath = state.getTreeExpansionPath("node1");

      // Should only include the collapsed inner container
      expect(expansionPath).toContain("container2");
      expect(expansionPath).not.toContain("container1"); // Already expanded
      expect(expansionPath).toHaveLength(1);
    });
  });

  describe("Lowest Visible Ancestor Calculation", () => {
    it("should return null for directly visible elements", () => {
      // Expand all containers so node is directly visible
      state.expandTreeNodes(["container1", "container2", "container3"]);

      const ancestor = state.getLowestVisibleAncestorInTree("node1");

      expect(ancestor).toBeNull();
    });

    it("should return immediate collapsed ancestor", () => {
      // Expand outer container but collapse inner one
      state.expandTreeNodes(["container1"]);
      state.collapseTreeNodes(["container2"]);

      const ancestor = state.getLowestVisibleAncestorInTree("node1");

      expect(ancestor).toBe("container2");
    });

    it("should return outermost collapsed ancestor", () => {
      // Collapse all containers
      state.collapseTreeNodes(["container1", "container2"]);

      const ancestor = state.getLowestVisibleAncestorInTree("node1");

      // Should return the outermost collapsed container
      expect(ancestor).toBe("container1");
    });
  });
});
