import type { HydroscopeData, GraphNode, GraphEdge, Container, HierarchyNode } from "./types";
import { NODE_WIDTH, NODE_HEIGHT, AUTO_EXPAND_AREA_BUDGET } from "./constants";

export interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  containers: Map<string, Container>;
  collapsed: Set<string>;
  dissolvedSynthetics: Set<string>;
  hierarchyId: string;
  raw: HydroscopeData;
}

export type Action =
  | { type: "load"; data: HydroscopeData }
  | { type: "toggle_collapse"; containerId: string }
  | { type: "toggle_synthetic"; syntheticId: string }
  | { type: "rebundle_all" }
  | { type: "set_hierarchy"; hierarchyId: string }
  | { type: "collapse_all" }
  | { type: "expand_all" }
  | { type: "expand_to"; containerIds: string[] }
  | { type: "auto_expand"; containerSizes: Map<string, { width: number; height: number }> };

export function initState(data: HydroscopeData): GraphState {
  return buildState(data, data.selectedHierarchy ?? data.hierarchyChoices[0]?.id ?? "");
}

function buildState(data: HydroscopeData, hierarchyId: string): GraphState {
  const nodes = new Map<string, GraphNode>();
  const containers = new Map<string, Container>();
  const rawAssignments = data.nodeAssignments[hierarchyId] ?? {};

  // Build containers from hierarchy tree
  const choice = data.hierarchyChoices.find((c) => c.id === hierarchyId);
  if (choice) buildContainers(choice.children, null, containers);

  // Build a lookup from serialized assignment values to container IDs.
  // Location hierarchy assigns nodes via LocationKey objects like {"idx":1,"version":1}
  // but containers use "key" field like "loc1v1". We need to map between them.
  // Strategy: match by position — the Rust side emits containers and assignments in the
  // same order, so we map unique assignment values to containers by sorted order.
  const assignmentValueToContainerId = new Map<string, string>();
  const uniqueAssignVals = new Set<string>();
  for (const v of Object.values(rawAssignments)) {
    const s = typeof v === "object" && v !== null ? JSON.stringify(v, Object.keys(v as object).sort()) : String(v);
    uniqueAssignVals.add(s);
  }
  // If assignment values are strings that match container IDs directly, use them as-is
  // Otherwise, try to match object values to containers by index
  const containerIds = [...containers.keys()];
  for (const val of uniqueAssignVals) {
    if (containers.has(val)) {
      assignmentValueToContainerId.set(val, val);
    }
  }
  // For unmatched values (object assignments), map by sorted order
  if (assignmentValueToContainerId.size < uniqueAssignVals.size) {
    const unmatchedVals = [...uniqueAssignVals].filter((v) => !assignmentValueToContainerId.has(v)).sort();
    const unmatchedContainers = containerIds.filter((id) => ![...assignmentValueToContainerId.values()].includes(id));
    for (let i = 0; i < Math.min(unmatchedVals.length, unmatchedContainers.length); i++) {
      assignmentValueToContainerId.set(unmatchedVals[i], unmatchedContainers[i]);
    }
  }

  // Build nodes with resolved parent container
  for (const raw of data.nodes) {
    const rawVal = rawAssignments[raw.id] ?? null;
    let parentId: string | null = null;
    if (rawVal !== null) {
      const serialized = typeof rawVal === "object" ? JSON.stringify(rawVal, Object.keys(rawVal as object).sort()) : String(rawVal);
      parentId = assignmentValueToContainerId.get(serialized) ?? null;
    }
    nodes.set(raw.id, {
      id: raw.id,
      label: raw.label ?? raw.shortLabel ?? raw.id,
      shortLabel: raw.shortLabel ?? raw.label ?? raw.id,
      fullLabel: raw.fullLabel ?? raw.label ?? raw.id,
      nodeType: raw.nodeType ?? "Transform",
      parentId,
      data: raw.data,
    });
    if (parentId) {
      const container = containers.get(parentId);
      if (container) container.nodeIds.push(raw.id);
    }
  }

  // Derive locationType for each container from its child nodes
  for (const container of containers.values()) {
    for (const nid of container.nodeIds) {
      const n = nodes.get(nid);
      if (n?.data?.locationType) {
        container.locationType = n.data.locationType;
        break;
      }
    }
  }

  // Start fully collapsed — auto-expand will be triggered async after headless layout
  const allCollapsed = new Set<string>(containers.keys());

  return { nodes, edges: data.edges, containers, collapsed: allCollapsed, dissolvedSynthetics: new Set(), hierarchyId, raw: data };
}

function buildContainers(children: HierarchyNode[], parentId: string | null, out: Map<string, Container>) {
  for (const child of children) {
    const cid = child.id ?? child.key;
    if (!cid) continue;
    out.set(cid, {
      id: cid,
      name: child.name,
      parentId,
      childContainerIds: (child.children ?? []).filter((c) => c.id ?? c.key).map((c) => (c.id ?? c.key)!),
      nodeIds: [],
    });
    if (child.children) buildContainers(child.children, cid, out);
  }
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case "load": return initState(action.data);
    case "toggle_collapse": {
      const next = new Set(state.collapsed);
      if (next.has(action.containerId)) next.delete(action.containerId);
      else next.add(action.containerId);
      return { ...state, collapsed: next, dissolvedSynthetics: new Set() };
    }
    case "toggle_synthetic": {
      const next = new Set(state.dissolvedSynthetics);
      if (next.has(action.syntheticId)) next.delete(action.syntheticId);
      else next.add(action.syntheticId);
      return { ...state, dissolvedSynthetics: next };
    }
    case "rebundle_all": return { ...state, dissolvedSynthetics: new Set() };
    case "set_hierarchy": return buildState(state.raw, action.hierarchyId);
    case "collapse_all": {
      const all = new Set<string>();
      for (const id of state.containers.keys()) all.add(id);
      return { ...state, collapsed: all, dissolvedSynthetics: new Set() };
    }
    case "expand_all": return { ...state, collapsed: new Set(), dissolvedSynthetics: new Set() };
    case "expand_to": {
      const next = new Set(state.collapsed);
      for (const id of action.containerIds) next.delete(id);
      return { ...state, collapsed: next };
    }
    case "auto_expand": {
      return { ...state, collapsed: computeAutoExpand(state, action.containerSizes), dissolvedSynthetics: new Set() };
    }
  }
}

// --- Derived state selectors ---

function isContainerCollapsed(containerId: string, state: GraphState): boolean {
  if (state.collapsed.has(containerId)) return true;
  const container = state.containers.get(containerId);
  if (!container || !container.parentId) return false;
  return isContainerCollapsed(container.parentId, state);
}

function isNodeHidden(nodeId: string, state: GraphState): boolean {
  const node = state.nodes.get(nodeId);
  if (!node || !node.parentId) return false;
  return isContainerCollapsed(node.parentId, state);
}

export function getVisibleNodes(state: GraphState): GraphNode[] {
  return getVisibleGraph(state).nodes;
}

export function getVisibleContainers(state: GraphState): Container[] {
  return getVisibleGraph(state).containers;
}

function findCollapsedAncestor(containerId: string, state: GraphState): string {
  const container = state.containers.get(containerId);
  if (!container) return containerId;
  if (container.parentId && isContainerCollapsed(container.parentId, state))
    return findCollapsedAncestor(container.parentId, state);
  return containerId;
}

function remapEndpoint(nodeId: string, state: GraphState, syntheticMap: Map<string, string>): string {
  // Check if this node was bundled into a synthetic container
  const syn = syntheticMap.get(nodeId);
  if (syn) return syn;
  const node = state.nodes.get(nodeId);
  if (!node || !node.parentId || !isNodeHidden(nodeId, state)) return nodeId;
  return findCollapsedAncestor(node.parentId, state);
}

export interface VisibleEdge extends GraphEdge {
  count: number;
}

/** Cached visible graph computation */
const visibleGraphCache = new WeakMap<GraphState, { nodes: GraphNode[]; containers: Container[]; syntheticMap: Map<string, string> }>();

function getVisibleGraph(state: GraphState): { nodes: GraphNode[]; containers: Container[]; syntheticMap: Map<string, string> } {
  const cached = visibleGraphCache.get(state);
  if (cached) return cached;

  const visibleContainers: Container[] = [];
  const syntheticMap = new Map<string, string>(); // nodeId → synthetic container id
  const syntheticLeafCounts = new Map<string, number>(); // synthetic id → leaf count

  for (const c of state.containers.values()) {
    // Skip containers hidden inside collapsed parents
    if (c.parentId && isContainerCollapsed(c.parentId, state)) continue;

    if (state.collapsed.has(c.id)) {
      // This container is collapsed — show it as-is
      visibleContainers.push(c);
      continue;
    }

    // This container is expanded. Check if it has both leaf nodes and collapsed children.
    const hasCollapsedChildren = c.childContainerIds.some((cid) => state.collapsed.has(cid));
    const directLeaves = c.nodeIds.filter((nid) => {
      const n = state.nodes.get(nid);
      return n && !isNodeHidden(nid, state);
    });

    if (hasCollapsedChildren && directLeaves.length > 0) {
      const synId = `__syn_${c.id}`;
      // Only bundle if this synthetic hasn't been dissolved
      if (!state.dissolvedSynthetics.has(synId)) {
        for (const nid of directLeaves) syntheticMap.set(nid, synId);
        syntheticLeafCounts.set(synId, directLeaves.length);
        visibleContainers.push(c);
        visibleContainers.push({
          id: synId,
          name: `${directLeaves.length} nodes`,
          parentId: c.id,
          childContainerIds: [],
          nodeIds: directLeaves,
          locationType: undefined,
          _synthetic: true,
        } as Container & { _synthetic?: boolean });
      } else {
        // Dissolved — show leaves normally
        visibleContainers.push(c);
      }
    } else {
      visibleContainers.push(c);
    }
  }

  // Also add root-level synthetic container if root has both leaves and collapsed containers
  const rootLeaves: string[] = [];
  const hasRootCollapsed = [...state.containers.values()].some((c) => !c.parentId && state.collapsed.has(c.id));
  for (const n of state.nodes.values()) {
    if (!n.parentId && !syntheticMap.has(n.id)) rootLeaves.push(n.id);
  }
  if (hasRootCollapsed && rootLeaves.length > 0) {
    const synId = "__syn_root";
    if (!state.dissolvedSynthetics.has(synId)) {
      for (const nid of rootLeaves) syntheticMap.set(nid, synId);
      syntheticLeafCounts.set(synId, rootLeaves.length);
      visibleContainers.push({
        id: synId,
        name: `${rootLeaves.length} nodes`,
        parentId: null,
        childContainerIds: [],
        nodeIds: rootLeaves,
        locationType: undefined,
        _synthetic: true,
      } as Container & { _synthetic?: boolean });
    }
  }

  // Visible nodes: exclude those bundled into synthetic containers
  const visibleNodes = [...state.nodes.values()].filter((n) =>
    !isNodeHidden(n.id, state) && !syntheticMap.has(n.id)
  );

  const result = { nodes: visibleNodes, containers: visibleContainers, syntheticMap };
  visibleGraphCache.set(state, result);
  return result;
}

export function getVisibleEdges(state: GraphState): VisibleEdge[] {
  const { syntheticMap } = getVisibleGraph(state);
  const edgeMap = new Map<string, VisibleEdge>();
  for (const edge of state.edges) {
    const source = remapEndpoint(edge.source, state, syntheticMap);
    const target = remapEndpoint(edge.target, state, syntheticMap);
    if (source === target) continue;
    const key = source + "\u2192" + target;
    const remapped = source !== edge.source || target !== edge.target;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.count++;
      existing.label = undefined;
      for (const tag of edge.semanticTags)
        if (!existing.semanticTags.includes(tag)) existing.semanticTags.push(tag);
    } else {
      edgeMap.set(key, {
        id: "agg_" + source + "_" + target,
        source, target,
        semanticTags: [...edge.semanticTags],
        label: remapped ? undefined : edge.label,
        count: 1,
      });
    }
  }
  return [...edgeMap.values()];
}

/** Compute total descendant leaf node count for each container */
export function getContainerLeafCounts(state: GraphState): Map<string, number> {
  const counts = new Map<string, number>();
  function count(cid: string): number {
    if (counts.has(cid)) return counts.get(cid)!;
    const c = state.containers.get(cid);
    if (!c) return 0;
    let n = c.nodeIds.length;
    for (const childId of c.childContainerIds) n += count(childId);
    counts.set(cid, n);
    return n;
  }
  for (const cid of state.containers.keys()) count(cid);
  return counts;
}

// --- Area-based auto-expand ---

/** Viewport area budget in px² */
const AREA_BUDGET = AUTO_EXPAND_AREA_BUDGET;

function computeAutoExpand(
  state: GraphState,
  containerSizes: Map<string, { width: number; height: number }>,
): Set<string> {
  const { containers } = state;
  if (containers.size === 0) return new Set();

  // If no sizes available, stay collapsed
  if (containerSizes.size === 0) return new Set(containers.keys());

  const collapsed = new Set(containers.keys());

  // Compute total area if everything were expanded (from the headless layout)
  let totalArea = 0;
  for (const [, size] of containerSizes) totalArea += size.width * size.height;

  // If everything fits, expand all
  if (totalArea <= AREA_BUDGET) return new Set();

  // Track current used area (start with collapsed root supernodes)
  let usedArea = 0;
  for (const c of containers.values()) {
    if (!c.parentId) usedArea += NODE_WIDTH * NODE_HEIGHT;
  }

  // Greedy: expand smallest-area containers first
  // Only expand a container if its parent is already expanded (or it's root)
  let changed = true;
  while (changed) {
    changed = false;
    let bestId: string | null = null;
    let bestArea = Infinity;

    for (const cid of collapsed) {
      const c = containers.get(cid);
      if (!c) continue;
      // Can only expand if parent is expanded (or root)
      if (c.parentId && collapsed.has(c.parentId)) continue;

      const size = containerSizes.get(cid);
      if (!size) continue;
      const area = size.width * size.height;
      if (area < bestArea) { bestArea = area; bestId = cid; }
    }

    if (bestId !== null) {
      // Cost: replace the supernode with the expanded container area
      const netCost = bestArea - NODE_WIDTH * NODE_HEIGHT;
      if (usedArea + netCost <= AREA_BUDGET) {
        collapsed.delete(bestId);
        usedArea += netCost;
        // Its child containers are now visible as supernodes — add their area
        const c = containers.get(bestId)!;
        for (const childId of c.childContainerIds) {
          if (collapsed.has(childId)) usedArea += NODE_WIDTH * NODE_HEIGHT;
        }
        changed = true;
      }
    }
  }

  return collapsed;
}

// --- Search across all nodes (including hidden inside collapsed containers) ---

export interface SearchHit {
  node: GraphNode;
  /** Container ancestry from outermost to innermost (empty if node is at root) */
  containerPath: string[];
  /** Whether the node is currently hidden inside a collapsed container */
  hidden: boolean;
}

export function searchAllNodes(state: GraphState, query: string): SearchHit[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const hits: SearchHit[] = [];
  for (const node of state.nodes.values()) {
    if (node.label.toLowerCase().includes(q) || node.fullLabel.toLowerCase().includes(q)) {
      const containerPath: string[] = [];
      let cid = node.parentId;
      while (cid) {
        containerPath.unshift(cid);
        const c = state.containers.get(cid);
        cid = c?.parentId ?? null;
      }
      hits.push({ node, containerPath, hidden: isNodeHidden(node.id, state) });
    }
  }
  return hits;
}

/** Returns the set of container IDs that need to be expanded to reveal the given nodes */
export function containersToExpand(state: GraphState, nodeIds: string[]): string[] {
  const toExpand = new Set<string>();
  for (const nid of nodeIds) {
    const node = state.nodes.get(nid);
    if (!node?.parentId) continue;
    let cid: string | null = node.parentId;
    while (cid) {
      if (state.collapsed.has(cid)) toExpand.add(cid);
      const c = state.containers.get(cid);
      cid = c?.parentId ?? null;
    }
  }
  return [...toExpand];
}
