/**
 * @fileoverview Regression test for search result ordering
 *
 * This test ensures that search results are ordered consistently with the
 * HierarchyTree component's depth-first traversal order. This prevents
 * regressions where search results might be returned in arbitrary order
 * (e.g., insertion order, Map iteration order) instead of tree order.
 *
 * The correct ordering is:
 * 1. Container
 * 2. Child containers (recursively)
 * 3. Leaf nodes of the container
 *
 * This matches the visual order in the HierarchyTree component.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState";
import { getSearchableItemsInTreeOrder } from "../utils/hierarchyUtils";

describe("Search Result Ordering Regression Test", () => {
  let visualizationState: VisualizationState;

  beforeEach(() => {
    visualizationState = new VisualizationState();

    // Create a hierarchy structure:
    // root_container
    //   ├── child_container_a
    //   │   ├── grandchild_container
    //   │   │   └── deep_node
    //   │   └── node_in_a
    //   ├── child_container_b
    //   │   └── node_in_b
    //   └── root_leaf_node

    // Add nodes first
    visualizationState.addNode({
      id: "deep_node",
      label: "Deep Node",
      longLabel: "Deep Node",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    visualizationState.addNode({
      id: "node_in_a",
      label: "Node in A",
      longLabel: "Node in A",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    visualizationState.addNode({
      id: "node_in_b",
      label: "Node in B",
      longLabel: "Node in B",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    visualizationState.addNode({
      id: "root_leaf_node",
      label: "Root Leaf Node",
      longLabel: "Root Leaf Node",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    // Add containers with their children already specified
    visualizationState.addContainer({
      id: "grandchild_container",
      label: "Grandchild Container",
      children: new Set(["deep_node"]),
      collapsed: false,
      hidden: false,
    });

    visualizationState.addContainer({
      id: "child_container_a",
      label: "Child Container A",
      children: new Set(["grandchild_container", "node_in_a"]),
      collapsed: false,
      hidden: false,
    });

    visualizationState.addContainer({
      id: "child_container_b",
      label: "Child Container B",
      children: new Set(["node_in_b"]),
      collapsed: false,
      hidden: false,
    });

    visualizationState.addContainer({
      id: "root_container",
      label: "Root Container",
      children: new Set([
        "child_container_a",
        "child_container_b",
        "root_leaf_node",
      ]),
      collapsed: false,
      hidden: false,
    });
  });

  it("should return search results in the same order as HierarchyTree depth-first traversal", () => {
    // Search for "container" or "node" to match multiple items
    const searchResults = visualizationState.performSearch("container");

    // Get the expected order from hierarchyUtils (same function used by HierarchyTree)
    const treeOrder = getSearchableItemsInTreeOrder(visualizationState);
    const expectedOrder = treeOrder
      .filter((item) => item.label.toLowerCase().includes("container"))
      .map((item) => item.id);

    // Extract IDs from search results
    const actualOrder = searchResults.map((result) => result.id);

    // The order should match exactly
    expect(actualOrder).toEqual(expectedOrder);

    // Verify the expected depth-first order:
    // 1. root_container (parent)
    // 2. child_container_a (first child)
    // 3. grandchild_container (child of child_container_a)
    // 4. child_container_b (second child of root)
    expect(actualOrder).toEqual([
      "root_container",
      "child_container_a",
      "grandchild_container",
      "child_container_b",
    ]);
  });

  it("should order mixed node and container results in tree order", () => {
    // Search for "node" to get both containers and nodes
    const searchResults = visualizationState.performSearch("node");

    // Get the expected order from hierarchyUtils
    const treeOrder = getSearchableItemsInTreeOrder(visualizationState);
    const expectedOrder = treeOrder
      .filter((item) => item.label.toLowerCase().includes("node"))
      .map((item) => item.id);

    const actualOrder = searchResults.map((result) => result.id);

    expect(actualOrder).toEqual(expectedOrder);

    // Verify the expected order includes nodes after their containers:
    // 1. grandchild_container (has "node" in label? No, but deep_node is inside)
    // 2. deep_node (leaf of grandchild_container)
    // 3. node_in_a (leaf of child_container_a, after grandchild subtree)
    // 4. node_in_b (leaf of child_container_b)
    // 5. root_leaf_node (leaf of root_container, after all child containers)
    expect(actualOrder).toEqual([
      "deep_node",
      "node_in_a",
      "node_in_b",
      "root_leaf_node",
    ]);
  });

  it("should maintain tree order even when search matches are sparse", () => {
    // Search for a term that only matches specific items
    const searchResults = visualizationState.performSearch("deep");

    // Should only match "deep_node" and "grandchild_container" (if it had "deep" in label)
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].id).toBe("deep_node");
  });

  it("should order results consistently across multiple searches", () => {
    // First search
    const firstSearch = visualizationState.performSearch("container");
    const firstOrder = firstSearch.map((r) => r.id);

    // Clear and search again
    visualizationState.clearSearch();
    const secondSearch = visualizationState.performSearch("container");
    const secondOrder = secondSearch.map((r) => r.id);

    // Order should be identical
    expect(firstOrder).toEqual(secondOrder);
  });

  it("should order results in tree order even when containers are collapsed", () => {
    // Collapse some containers by modifying their state directly
    const childA = visualizationState.getContainer("child_container_a");
    if (childA) {
      childA.collapsed = true;
    }

    const grandchild = visualizationState.getContainer("grandchild_container");
    if (grandchild) {
      grandchild.collapsed = true;
    }

    // Search should still return results in tree order
    const searchResults = visualizationState.performSearch("node");
    const actualOrder = searchResults.map((result) => result.id);

    // Order should still follow tree hierarchy, not collapse state
    expect(actualOrder).toEqual([
      "deep_node",
      "node_in_a",
      "node_in_b",
      "root_leaf_node",
    ]);
  });

  it("should match the order returned by getSearchableItemsInTreeOrder utility", () => {
    // This is the critical test: search results MUST match the utility function
    // that HierarchyTree uses for ordering

    const searchResults = visualizationState.performSearch("a"); // Match many items

    // Get all searchable items in tree order
    const treeOrderItems = getSearchableItemsInTreeOrder(visualizationState);

    // Filter to only items that match the search
    const expectedMatches = treeOrderItems.filter((item) =>
      item.label.toLowerCase().includes("a"),
    );

    // Search results should be in the same order
    const actualOrder = searchResults.map((r) => r.id);
    const expectedOrder = expectedMatches.map((item) => item.id);

    expect(actualOrder).toEqual(expectedOrder);
  });

  it("should handle empty search results without errors", () => {
    const searchResults = visualizationState.performSearch("nonexistent");

    expect(searchResults).toEqual([]);
  });

  it("should order results by tree position, not by confidence score", () => {
    // Add nodes with labels that would have different confidence scores
    visualizationState.addNode({
      id: "exact_match",
      label: "test", // Exact match - high confidence
      longLabel: "test",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    visualizationState.addNode({
      id: "partial_match",
      label: "testing_something", // Partial match - lower confidence
      longLabel: "testing_something",
      type: "node",
      semanticTags: [],
      hidden: false,
    });

    // Update containers to include these new nodes
    // partial_match is in grandchild_container (appears earlier in tree)
    // exact_match is in root_container (appears later in tree)
    const grandchild = visualizationState.getContainer("grandchild_container");
    if (grandchild) {
      grandchild.children.add("partial_match");
    }

    const root = visualizationState.getContainer("root_container");
    if (root) {
      root.children.add("exact_match");
    }

    const searchResults = visualizationState.performSearch("test");

    // Despite exact_match having higher confidence, partial_match should come first
    // because it's earlier in the tree hierarchy
    const actualOrder = searchResults.map((r) => r.id);

    // Get expected order from tree traversal
    const treeOrder = getSearchableItemsInTreeOrder(visualizationState);
    const expectedOrder = treeOrder
      .filter((item) => item.label.toLowerCase().includes("test"))
      .map((item) => item.id);

    expect(actualOrder).toEqual(expectedOrder);

    // Verify partial_match comes before exact_match (tree order, not confidence)
    const partialIndex = actualOrder.indexOf("partial_match");
    const exactIndex = actualOrder.indexOf("exact_match");
    expect(partialIndex).toBeLessThan(exactIndex);
  });
});
