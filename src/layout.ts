import ELK from "elkjs/lib/elk.bundled.js";
import type { GraphNode, Container } from "./types";
import type { VisibleEdge } from "./state";

export interface LayoutResult {
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>;
  containerPositions: Map<string, { x: number; y: number; width: number; height: number }>;
}

const elk = new ELK();
const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;
const CONTAINER_PADDING = 40;

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
): Promise<LayoutResult> {
  const containerIds = new Set(containers.map((c) => c.id));
  const rootChildren: ElkNode[] = [];
  const containerElkNodes = new Map<string, ElkNode>();
  // Track all node IDs in the ELK graph for edge filtering
  const allElkNodeIds = new Set<string>();

  for (const container of containers) {
    const isCollapsed = collapsed.has(container.id);
    const elkNode: ElkNode = {
      id: container.id,
      labels: [{ text: container.name }],
      children: [],
      layoutOptions: { "elk.padding": `[top=${CONTAINER_PADDING},left=20,bottom=20,right=20]` },
      ...(isCollapsed ? { width: NODE_WIDTH, height: NODE_HEIGHT } : {}),
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

  // Only include edges where both endpoints exist in the ELK graph
  const validEdges = edges.filter((e) => allElkNodeIds.has(e.source) && allElkNodeIds.has(e.target));

  try {
    const result = await elk.layout({
      id: "root",
      children: rootChildren,
      edges: validEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.layered.spacing.nodeNodeBetweenLayers": "50",
        "elk.spacing.nodeNode": "30",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
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
  } catch (err) {
    console.error("ELK layout failed:", err);
    // Fallback: place nodes in a simple grid
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    const containerPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    let i = 0;
    const cols = Math.ceil(Math.sqrt(nodes.length));
    for (const node of nodes) {
      const col = i % cols, row = Math.floor(i / cols);
      nodePositions.set(node.id, { x: col * 220, y: row * 80, width: NODE_WIDTH, height: NODE_HEIGHT });
      i++;
    }
    return { nodePositions, containerPositions };
  }
}
