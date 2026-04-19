import ELK from "elkjs/lib/elk.bundled.js";
import type { GraphNode, Container } from "./types";
import type { VisibleEdge } from "./state";
import {
  NODE_WIDTH, NODE_HEIGHT, COLLAPSED_WIDTH, COLLAPSED_HEIGHT,
  CONTAINER_PADDING_TOP, CONTAINER_PADDING_SIDE,
  ELK_NODE_SPACING, ELK_LAYER_SPACING,
  FALLBACK_COL_SPACING, FALLBACK_ROW_SPACING,
} from "./constants";

export interface LayoutResult {
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>;
  containerPositions: Map<string, { x: number; y: number; width: number; height: number }>;
}

export type LayoutDirection = "DOWN" | "RIGHT" | "UP" | "LEFT";
export type LayoutAlgorithm = "mrtree" | "layered" | "stress" | "force";

export interface LayoutOptions {
  direction: LayoutDirection;
  algorithm: LayoutAlgorithm;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: "DOWN",
  algorithm: "layered",
};

const elk = new ELK();
const PADDING_STR = `[top=${CONTAINER_PADDING_TOP},left=${CONTAINER_PADDING_SIDE},bottom=${CONTAINER_PADDING_SIDE},right=${CONTAINER_PADDING_SIDE}]`;

interface ElkNode {
  id: string;
  labels?: { text: string }[];
  children?: ElkNode[];
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
}

export async function layoutGraph(
  nodes: GraphNode[],
  edges: VisibleEdge[],
  containers: Container[],
  collapsed: Set<string>,
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS,
): Promise<LayoutResult> {
  const containerIds = new Set(containers.map((c) => c.id));
  const rootChildren: ElkNode[] = [];
  const containerElkNodes = new Map<string, ElkNode>();
  const allElkNodeIds = new Set<string>();

  for (const container of containers) {
    const isCollapsed = collapsed.has(container.id) || container.id.startsWith("__syn_");
    const elkNode: ElkNode = {
      id: container.id,
      labels: [{ text: container.name }],
      children: [],
      layoutOptions: { "elk.padding": PADDING_STR },
      ...(isCollapsed ? { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT } : {}),
    };
    containerElkNodes.set(container.id, elkNode);
    allElkNodeIds.add(container.id);
  }

  for (const container of containers) {
    const elkNode = containerElkNodes.get(container.id)!;
    if (container.parentId && containerElkNodes.has(container.parentId))
      containerElkNodes.get(container.parentId)!.children!.push(elkNode);
    else rootChildren.push(elkNode);
  }

  for (const node of nodes) {
    if (containerIds.has(node.id)) continue;
    const elkNode: ElkNode = {
      id: node.id,
      labels: [{ text: node.shortLabel }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
    if (node.parentId && containerElkNodes.has(node.parentId))
      containerElkNodes.get(node.parentId)!.children!.push(elkNode);
    else rootChildren.push(elkNode);
    allElkNodeIds.add(node.id);
  }

  const validEdges = edges.filter((e) => allElkNodeIds.has(e.source) && allElkNodeIds.has(e.target));

  const algorithmMap: Record<LayoutAlgorithm, string> = {
    mrtree: "mrtree", layered: "layered", stress: "stress", force: "force",
  };

  try {
    const result = await elk.layout({
      id: "root",
      children: rootChildren,
      edges: validEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      layoutOptions: {
        "elk.algorithm": algorithmMap[options.algorithm],
        "elk.direction": options.direction,
        "elk.layered.spacing.nodeNodeBetweenLayers": String(ELK_LAYER_SPACING),
        "elk.spacing.nodeNode": String(ELK_NODE_SPACING),
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      },
    } as any);

    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    const containerPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

    function extract(elkNode: any, ox: number, oy: number) {
      const x = (elkNode.x ?? 0) + ox, y = (elkNode.y ?? 0) + oy;
      const w = elkNode.width ?? NODE_WIDTH, h = elkNode.height ?? NODE_HEIGHT;
      (containerElkNodes.has(elkNode.id) ? containerPositions : nodePositions)
        .set(elkNode.id, { x, y, width: w, height: h });
      for (const child of elkNode.children ?? []) extract(child, x, y);
    }
    for (const child of result.children ?? []) extract(child, 0, 0);

    return { nodePositions, containerPositions };
  } catch {
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    const containerPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    let i = 0;
    const cols = Math.ceil(Math.sqrt(nodes.length));
    for (const node of nodes) {
      const col = i % cols, row = Math.floor(i / cols);
      nodePositions.set(node.id, { x: col * FALLBACK_COL_SPACING, y: row * FALLBACK_ROW_SPACING, width: NODE_WIDTH, height: NODE_HEIGHT });
      i++;
    }
    return { nodePositions, containerPositions };
  }
}

/**
 * Headless layout pass: runs ELK with everything expanded to compute
 * the actual pixel dimensions of each container. Used for auto-expand.
 */
export async function computeContainerSizes(
  nodes: GraphNode[],
  edges: { id: string; source: string; target: string }[],
  containers: Container[],
): Promise<Map<string, { width: number; height: number }>> {
  const containerIds = new Set(containers.map((c) => c.id));
  const rootChildren: ElkNode[] = [];
  const containerElkNodes = new Map<string, ElkNode>();
  const allElkNodeIds = new Set<string>();

  for (const container of containers) {
    const elkNode: ElkNode = {
      id: container.id,
      labels: [{ text: container.name }],
      children: [],
      layoutOptions: { "elk.padding": PADDING_STR },
    };
    containerElkNodes.set(container.id, elkNode);
    allElkNodeIds.add(container.id);
  }

  for (const container of containers) {
    const elkNode = containerElkNodes.get(container.id)!;
    if (container.parentId && containerElkNodes.has(container.parentId))
      containerElkNodes.get(container.parentId)!.children!.push(elkNode);
    else rootChildren.push(elkNode);
  }

  for (const node of nodes) {
    if (containerIds.has(node.id)) continue;
    const elkNode: ElkNode = {
      id: node.id,
      labels: [{ text: node.shortLabel }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
    if (node.parentId && containerElkNodes.has(node.parentId))
      containerElkNodes.get(node.parentId)!.children!.push(elkNode);
    else rootChildren.push(elkNode);
    allElkNodeIds.add(node.id);
  }

  const validEdges = edges.filter((e) => allElkNodeIds.has(e.source) && allElkNodeIds.has(e.target));

  try {
    const result = await elk.layout({
      id: "root",
      children: rootChildren,
      edges: validEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      layoutOptions: {
        "elk.algorithm": "mrtree",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": String(ELK_NODE_SPACING),
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      },
    } as any);

    const sizes = new Map<string, { width: number; height: number }>();
    function extractSizes(elkNode: any) {
      if (containerElkNodes.has(elkNode.id)) {
        sizes.set(elkNode.id, {
          width: elkNode.width ?? NODE_WIDTH,
          height: elkNode.height ?? NODE_HEIGHT,
        });
      }
      for (const child of elkNode.children ?? []) extractSizes(child);
    }
    for (const child of result.children ?? []) extractSizes(child);
    return sizes;
  } catch {
    return new Map();
  }
}
