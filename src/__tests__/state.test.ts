import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  initState, reducer, getVisibleNodes, getVisibleEdges, getVisibleContainers,
  searchAllNodes, containersToExpand, getContainerLeafCounts,
} from "../state";
import { parseHydroscopeData } from "../parse";

const loadTestData = (name: string) => {
  const raw = readFileSync(join(__dirname, "../../test-data", name), "utf-8");
  return parseHydroscopeData(raw);
};

const paxos = loadTestData("paxos.json");
const mapReduce = loadTestData("map_reduce.json");

describe("initState", () => {
  it("builds state from paxos data", () => {
    const state = initState(paxos);
    expect(state.nodes.size).toBeGreaterThan(0);
    expect(state.containers.size).toBeGreaterThan(0);
    expect(state.edges.length).toBeGreaterThan(0);
    expect(state.hierarchyId).toBe(paxos.selectedHierarchy ?? paxos.hierarchyChoices[0]?.id);
  });

  it("builds state from map_reduce data", () => {
    const state = initState(mapReduce);
    expect(state.nodes.size).toBeGreaterThan(0);
    expect(state.containers.size).toBeGreaterThan(0);
  });

  it("assigns nodes to containers", () => {
    const state = initState(mapReduce);
    const nodesWithParent = [...state.nodes.values()].filter((n) => n.parentId !== null);
    expect(nodesWithParent.length).toBeGreaterThan(0);
    // Every parentId should reference a valid container
    for (const node of nodesWithParent) {
      expect(state.containers.has(node.parentId!)).toBe(true);
    }
  });

  it("derives locationType for containers", () => {
    const state = initState(paxos);
    const withLocType = [...state.containers.values()].filter((c) => c.locationType);
    expect(withLocType.length).toBeGreaterThan(0);
  });

  it("starts with containers collapsed (auto-expand pending)", () => {
    const state = initState(paxos);
    // Should have some collapsed containers (large graph)
    expect(state.collapsed.size).toBeGreaterThan(0);
  });
});

describe("reducer", () => {
  it("toggle_collapse expands a collapsed container", () => {
    const state = initState(mapReduce);
    const cid = [...state.collapsed][0];
    if (!cid) return; // skip if nothing collapsed
    const next = reducer(state, { type: "toggle_collapse", containerId: cid });
    expect(next.collapsed.has(cid)).toBe(false);
  });

  it("toggle_collapse collapses an expanded container", () => {
    const state = initState(mapReduce);
    const expanded = [...state.containers.keys()].find((id) => !state.collapsed.has(id));
    if (!expanded) return;
    const next = reducer(state, { type: "toggle_collapse", containerId: expanded });
    expect(next.collapsed.has(expanded)).toBe(true);
  });

  it("collapse_all collapses everything", () => {
    const state = initState(mapReduce);
    const next = reducer(state, { type: "collapse_all" });
    expect(next.collapsed.size).toBe(state.containers.size);
  });

  it("expand_all expands everything", () => {
    const state = initState(paxos);
    const next = reducer(state, { type: "expand_all" });
    expect(next.collapsed.size).toBe(0);
  });

  it("expand_to expands specific containers", () => {
    const state = initState(paxos);
    const collapsed = [...state.collapsed];
    const toExpand = collapsed.slice(0, 2);
    const next = reducer(state, { type: "expand_to", containerIds: toExpand });
    for (const id of toExpand) {
      expect(next.collapsed.has(id)).toBe(false);
    }
  });

  it("set_hierarchy rebuilds state with different hierarchy", () => {
    const state = initState(paxos);
    const otherHierarchy = paxos.hierarchyChoices.find((c) => c.id !== state.hierarchyId);
    if (!otherHierarchy) return;
    const next = reducer(state, { type: "set_hierarchy", hierarchyId: otherHierarchy.id });
    expect(next.hierarchyId).toBe(otherHierarchy.id);
  });

  it("toggle_synthetic dissolves and re-bundles", () => {
    const state = initState(mapReduce);
    const allCollapsed = reducer(state, { type: "collapse_all" });
    const synId = "__syn_root";
    const dissolved = reducer(allCollapsed, { type: "toggle_synthetic", syntheticId: synId });
    expect(dissolved.dissolvedSynthetics.has(synId)).toBe(true);
    const rebundled = reducer(dissolved, { type: "toggle_synthetic", syntheticId: synId });
    expect(rebundled.dissolvedSynthetics.has(synId)).toBe(false);
  });
});

describe("getVisibleNodes", () => {
  it("returns all nodes when nothing is collapsed", () => {
    const state = reducer(initState(mapReduce), { type: "expand_all" });
    const visible = getVisibleNodes(state);
    expect(visible.length).toBe(state.nodes.size);
  });

  it("hides nodes inside collapsed containers", () => {
    const state = reducer(initState(mapReduce), { type: "collapse_all" });
    const visible = getVisibleNodes(state);
    // Should only have nodes without parents (root-level)
    expect(visible.length).toBeLessThan(state.nodes.size);
    for (const n of visible) {
      expect(n.parentId).toBeNull();
    }
  });
});

describe("getVisibleContainers", () => {
  it("returns all containers when nothing is collapsed", () => {
    const state = reducer(initState(mapReduce), { type: "expand_all" });
    const visible = getVisibleContainers(state);
    expect(visible.length).toBe(state.containers.size);
  });

  it("creates synthetic containers when needed", () => {
    // Collapse all, then expand one container that has children
    const state = reducer(initState(paxos), { type: "collapse_all" });
    const rootContainer = [...state.containers.values()].find((c) => !c.parentId && c.childContainerIds.length > 0);
    if (!rootContainer) return;
    const expanded = reducer(state, { type: "toggle_collapse", containerId: rootContainer.id });
    const visible = getVisibleContainers(expanded);
    const synthetics = visible.filter((c) => c.id.startsWith("__syn_"));
    // If the expanded container has both leaves and collapsed children, there should be a synthetic
    const hasLeaves = rootContainer.nodeIds.length > 0;
    const hasCollapsedChildren = rootContainer.childContainerIds.some((id) => expanded.collapsed.has(id));
    if (hasLeaves && hasCollapsedChildren) {
      expect(synthetics.length).toBeGreaterThan(0);
    }
  });
});

describe("getVisibleEdges", () => {
  it("remaps edges to collapsed containers", () => {
    const state = reducer(initState(mapReduce), { type: "collapse_all" });
    const edges = getVisibleEdges(state);
    // All edge endpoints should be either root-level nodes or container IDs
    const validIds = new Set([
      ...[...state.nodes.values()].filter((n) => !n.parentId).map((n) => n.id),
      ...state.containers.keys(),
    ]);
    for (const edge of edges) {
      expect(validIds.has(edge.source) || edge.source.startsWith("__syn_")).toBe(true);
      expect(validIds.has(edge.target) || edge.target.startsWith("__syn_")).toBe(true);
    }
  });

  it("drops labels on remapped edges", () => {
    const state = reducer(initState(mapReduce), { type: "collapse_all" });
    const edges = getVisibleEdges(state);
    // Remapped edges (agg_ prefix) should not have labels
    for (const edge of edges) {
      if (edge.id.startsWith("agg_")) {
        expect(edge.label).toBeUndefined();
      }
    }
  });

  it("aggregates multiple edges between same endpoints", () => {
    const state = reducer(initState(paxos), { type: "collapse_all" });
    const edges = getVisibleEdges(state);
    const multiCount = edges.filter((e) => e.count > 1);
    expect(multiCount.length).toBeGreaterThan(0);
  });
});

describe("getContainerLeafCounts", () => {
  it("counts all descendant leaves", () => {
    const state = initState(mapReduce);
    const counts = getContainerLeafCounts(state);
    // Total of all root container counts should equal total nodes
    const rootContainers = [...state.containers.values()].filter((c) => !c.parentId);
    const rootTotal = rootContainers.reduce((sum, c) => sum + (counts.get(c.id) ?? 0), 0);
    const nodesWithParent = [...state.nodes.values()].filter((n) => n.parentId).length;
    expect(rootTotal).toBe(nodesWithParent);
  });
});

describe("searchAllNodes", () => {
  it("finds nodes by label", () => {
    const state = reducer(initState(paxos), { type: "collapse_all" });
    const hits = searchAllNodes(state, "source");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      const matchesLabel = hit.node.label.toLowerCase().includes("source");
      const matchesFull = hit.node.fullLabel.toLowerCase().includes("source");
      expect(matchesLabel || matchesFull).toBe(true);
    }
  });

  it("finds hidden nodes inside collapsed containers", () => {
    const state = reducer(initState(paxos), { type: "collapse_all" });
    const hits = searchAllNodes(state, "source");
    const hidden = hits.filter((h) => h.hidden);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("returns container path for each hit", () => {
    const state = initState(paxos);
    const hits = searchAllNodes(state, "network");
    const withPath = hits.filter((h) => h.containerPath.length > 0);
    expect(withPath.length).toBeGreaterThan(0);
  });

  it("returns empty for blank query", () => {
    const state = initState(paxos);
    expect(searchAllNodes(state, "")).toHaveLength(0);
  });
});

describe("containersToExpand", () => {
  it("returns containers needed to reveal hidden nodes", () => {
    const state = reducer(initState(paxos), { type: "collapse_all" });
    const hits = searchAllNodes(state, "source");
    const hidden = hits.filter((h) => h.hidden);
    if (hidden.length === 0) return;
    const toExpand = containersToExpand(state, hidden.map((h) => h.node.id));
    expect(toExpand.length).toBeGreaterThan(0);
    // All returned IDs should be currently collapsed
    for (const id of toExpand) {
      expect(state.collapsed.has(id)).toBe(true);
    }
  });
});
