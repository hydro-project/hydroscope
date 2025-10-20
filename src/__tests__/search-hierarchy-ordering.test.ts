/**
 * Regression test for search results ordering by hierarchy tree
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";

describe("Search Results Hierarchy Ordering", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  it("should order search results by hierarchy tree position", () => {
    // Add child container first
    state.addContainer({
      id: "container2",
      label: "Container 2",
      longLabel: "Container 2",
      children: new Set(["node1", "node2"]),
      collapsed: false,
      hidden: false,
    });

    // Then add parent container
    state.addContainer({
      id: "container1",
      label: "Container 1",
      longLabel: "Container 1",
      children: new Set(["container2", "node3"]),
      collapsed: false,
      hidden: false,
    });

    state.addNode({
      id: "node1",
      label: "test node",
      longLabel: "test node",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "another test",
      longLabel: "another test",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node3",
      label: "test item",
      longLabel: "test item",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    const results = state.performSearch("test");

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe("node1");
    expect(results[1].id).toBe("node2");
    expect(results[2].id).toBe("node3");
  });

  it("should maintain hierarchy order even with different confidence scores", () => {
    state.addContainer({
      id: "container1",
      label: "Root",
      longLabel: "Root",
      children: new Set(["node1", "node2"]),
      collapsed: false,
      hidden: false,
    });

    state.addNode({
      id: "node1",
      label: "fuzzy match xyz",
      longLabel: "fuzzy match xyz",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "xyz",
      longLabel: "xyz",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    const results = state.performSearch("xyz");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("node1");
    expect(results[1].id).toBe("node2");
  });

  it("should handle simple container with nodes", () => {
    state.addContainer({
      id: "container1",
      label: "search container",
      longLabel: "search container",
      children: new Set(["node1", "node2"]),
      collapsed: false,
      hidden: false,
    });

    state.addNode({
      id: "node1",
      label: "search result",
      longLabel: "search result",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "search item",
      longLabel: "search item",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    const results = state.performSearch("search");

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe("container1");
    expect(results[1].id).toBe("node1");
    expect(results[2].id).toBe("node2");
  });
});
