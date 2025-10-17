import { describe, it, expect } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";

describe("Search Highlighting Bug", () => {
  it("should highlight child node, not parent container, when container is expanded", () => {
    const state = new VisualizationState();

    // Create a container with a child node
    state.addContainer({
      id: "proposer_container",
      label: "hydro_test::cluster::paxos::Proposer",
      children: new Set(["defertick_node"]),
      collapsed: false, // Container is expanded
      hidden: false,
    });

    state.addNode({
      id: "defertick_node",
      label: "defertick",
      longLabel: "defertick",
      type: "operator",
      semanticTags: [],
      hidden: false, // Node is visible because container is expanded
    });

    // Search for "tick" - should match "defertick" node
    const results = state.performSearch("tick");

    // Should find the node
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("defertick_node");
    expect(results[0].label).toBe("defertick");

    // Check graph highlights - should highlight the node, NOT the container
    const graphHighlights = Array.from(state.getGraphSearchHighlights());

    expect(graphHighlights).toHaveLength(1);
    expect(graphHighlights[0]).toBe("defertick_node");
    expect(graphHighlights).not.toContain("proposer_container");
  });

  it("should NOT highlight parent container when only child matches (parent doesn't match)", () => {
    const state = new VisualizationState();

    // Create a container that does NOT contain "tick" in its name
    state.addContainer({
      id: "proposer_container",
      label: "hydro_test::cluster::paxos::Proposer", // Does NOT contain "tick"
      children: new Set(["defertick_node"]),
      collapsed: false, // Container is expanded
      hidden: false,
    });

    state.addNode({
      id: "defertick_node",
      label: "defertick",
      longLabel: "defertick",
      type: "operator",
      semanticTags: [],
      hidden: false, // Node is visible because container is expanded
    });

    // Search for "tick" - should ONLY match "defertick" node, NOT the container
    const results = state.performSearch("tick");

    // Should find only the node
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("defertick_node");

    // Check graph highlights - should ONLY highlight the node, NOT the container
    const graphHighlights = Array.from(state.getGraphSearchHighlights());

    expect(graphHighlights).toHaveLength(1);
    expect(graphHighlights[0]).toBe("defertick_node");
    expect(graphHighlights).not.toContain("proposer_container");
  });

  it("should highlight both parent and child when both match search", () => {
    const state = new VisualizationState();

    // Create a container that also contains "tick" in its name
    state.addContainer({
      id: "proposer_container",
      label: "hydro_test::cluster::paxos::ProposerTick", // Contains "tick"!
      children: new Set(["defertick_node"]),
      collapsed: false, // Container is expanded
      hidden: false,
    });

    state.addNode({
      id: "defertick_node",
      label: "defertick",
      longLabel: "defertick",
      type: "operator",
      semanticTags: [],
      hidden: false, // Node is visible because container is expanded
    });

    // Search for "tick" - will match BOTH container and node
    const results = state.performSearch("tick");

    // Should find both in search results
    expect(results.length).toBe(2);
    const resultIds = results.map((r) => r.id);
    expect(resultIds).toContain("defertick_node");
    expect(resultIds).toContain("proposer_container");

    // Check graph highlights - BOTH should be highlighted since BOTH match the search
    const graphHighlights = Array.from(state.getGraphSearchHighlights());

    expect(graphHighlights).toContain("defertick_node");
    expect(graphHighlights).toContain("proposer_container");
    expect(graphHighlights.length).toBe(2);
  });

  it("should NOT highlight parent when searching for child with real paxos-like IDs", () => {
    const state = new VisualizationState();

    // Create a container that does NOT contain "tick"
    state.addContainer({
      id: "loc_0",
      label: "hydro_test::cluster::paxos::Proposer",
      children: new Set(["36"]),
      collapsed: false,
      hidden: false,
    });

    state.addNode({
      id: "36",
      label: "defer_tick",
      longLabel: "defer_tick",
      type: "operator",
      semanticTags: [],
      hidden: false,
    });

    // Search for "tick" - should only match node "36", not container "loc_0"
    const results = state.performSearch("tick");

    // Should only find the node
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("36");
    expect(results[0].label).toBe("defer_tick");

    // The container should NOT be in highlights
    const graphHighlights = Array.from(state.getGraphSearchHighlights());
    expect(graphHighlights).toHaveLength(1);
    expect(graphHighlights[0]).toBe("36");
    expect(graphHighlights).not.toContain("loc_0");
  });

  it("should NOT highlight anything when child node is hidden (container collapsed)", () => {
    const state = new VisualizationState();

    // Create a collapsed container with a child node
    state.addContainer({
      id: "proposer_container",
      label: "hydro_test::cluster::paxos::Proposer",
      children: new Set(["defertick_node"]),
      collapsed: true, // Container is collapsed
      hidden: false,
    });

    state.addNode({
      id: "defertick_node",
      label: "defertick",
      longLabel: "defertick",
      type: "operator",
      semanticTags: [],
      hidden: true, // Node is hidden because container is collapsed
    });

    // Search for "tick" - should match "defertick" node
    const results = state.performSearch("tick");

    // Should find the node in search results
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("defertick_node");

    // Check graph highlights - should NOT highlight anything
    // (the node is hidden, and we don't highlight non-matching ancestors)
    const graphHighlights = Array.from(state.getGraphSearchHighlights());

    expect(graphHighlights).toHaveLength(0);
    // The user needs to expand the container to see the match
  });
});
