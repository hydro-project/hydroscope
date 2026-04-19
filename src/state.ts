import type { HydroscopeData, GraphNode, GraphEdge, Container, HierarchyNode } from "./types";

export interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  containers: Map<string, Container>;
  collapsed: Set<string>;
  hierarchyId: string;
  raw: HydroscopeData;
}

export type Action =
  | { type: "load"; data: HydroscopeData }
  | { type: "toggle_collapse"; containerId: string }
  | { type: "set_hierarchy"; hierarchyId: string }
  | { type: "collapse_all" }
  | { type: "expand_all" };

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

  return { nodes, edges: data.edges, containers, collapsed: new Set(), hierarchyId, raw: data };
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
      return { ...state, collapsed: next };
    }
    case "set_hierarchy": return buildState(state.raw, action.hierarchyId);
    case "collapse_all": {
      const all = new Set<string>();
      for (const id of state.containers.keys()) all.add(id);
      return { ...state, collapsed: all };
    }
    case "expand_all": return { ...state, collapsed: new Set() };
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
  return [...state.nodes.values()].filter((n) => !isNodeHidden(n.id, state));
}

export function getVisibleContainers(state: GraphState): Container[] {
  return [...state.containers.values()].filter((c) => {
    if (!c.parentId) return true;
    return !isContainerCollapsed(c.parentId, state);
  });
}

function findCollapsedAncestor(containerId: string, state: GraphState): string {
  const container = state.containers.get(containerId);
  if (!container) return containerId;
  if (container.parentId && isContainerCollapsed(container.parentId, state))
    return findCollapsedAncestor(container.parentId, state);
  return containerId;
}

function remapEndpoint(nodeId: string, state: GraphState): string {
  const node = state.nodes.get(nodeId);
  if (!node || !node.parentId || !isNodeHidden(nodeId, state)) return nodeId;
  return findCollapsedAncestor(node.parentId, state);
}

export interface VisibleEdge extends GraphEdge {
  count: number;
}

export function getVisibleEdges(state: GraphState): VisibleEdge[] {
  const edgeMap = new Map<string, VisibleEdge>();
  for (const edge of state.edges) {
    const source = remapEndpoint(edge.source, state);
    const target = remapEndpoint(edge.target, state);
    if (source === target) continue;
    const key = source + "\u2192" + target;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.count++;
      for (const tag of edge.semanticTags)
        if (!existing.semanticTags.includes(tag)) existing.semanticTags.push(tag);
    } else {
      edgeMap.set(key, {
        id: "agg_" + source + "_" + target,
        source, target,
        semanticTags: [...edge.semanticTags],
        label: edge.label,
        count: 1,
      });
    }
  }
  return [...edgeMap.values()];
}
