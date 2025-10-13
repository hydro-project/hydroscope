/**
 * Test data utilities for paxos.json and other test scenarios
 * Provides consistent test data throughout development
 */
import type { GraphNode, GraphEdge, Container } from "../types/core.js";
export interface TestGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  containers: Container[];
}
export function loadPaxosTestData(): TestGraphData {
  // In browser environment, return minimal test data
  // File system access is not available in browsers
  console.warn(
    "File system access not available in browser, using minimal test data",
  );
  return getMinimalTestData();
}
function _convertHierarchyToContainers(
  hierarchy: any,
  containers: Container[],
): void {
  if (hierarchy.children && hierarchy.children.length > 0) {
    // Create container for this hierarchy level
    const childIds = hierarchy.children
      .filter((child: any) => !child.children || child.children.length === 0)
      .map((child: any) => child.id);
    if (childIds.length > 0) {
      containers.push({
        id: hierarchy.id || `container_${containers.length}`,
        label: hierarchy.name || `Container ${containers.length}`,
        children: new Set(childIds),
        collapsed: false,
        hidden: false,
      });
    }
    // Recursively process nested hierarchies
    for (const child of hierarchy.children) {
      if (child.children && child.children.length > 0) {
        _convertHierarchyToContainers(child, containers);
      }
    }
  }
}
export function getMinimalTestData(): TestGraphData {
  return {
    nodes: [
      {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1 (Full Label)",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n2",
        label: "Node 2",
        longLabel: "Node 2 (Full Label)",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
    ],
    containers: [
      {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1"]),
        collapsed: false,
        hidden: false,
      },
    ],
  };
}
export function createTestNode(id: string, label?: string): GraphNode {
  return {
    id,
    label: label || `Node ${id}`,
    longLabel: label ? `${label} (Full Label)` : `Node ${id} (Full Label)`,
    type: "node",
    semanticTags: [],
    hidden: false,
  };
}
export function createTestEdge(
  id: string,
  source: string,
  target: string,
): GraphEdge {
  return {
    id,
    source,
    target,
    type: "edge",
    semanticTags: [],
    hidden: false,
  };
}
export function createTestContainer(
  id: string,
  children: string[],
  label?: string,
): Container {
  return {
    id,
    label: label || `Container ${id}`,
    children: new Set(children),
    collapsed: false,
    hidden: false,
  };
}
export async function createTestVisualizationState() {
  const { VisualizationState } = await import("../core/VisualizationState.js");
  const state = new VisualizationState();
  const testData = loadPaxosTestData();
  // Add test data to state
  for (const node of testData.nodes) {
    state.addNode(node);
  }
  for (const container of testData.containers) {
    state.addContainer(container);
  }
  for (const edge of testData.edges) {
    state.addEdge(edge);
  }
  return state;
}

/**
 * Create a properly configured AsyncCoordinator for testing
 * Sets up bridge instances to avoid "ELK bridge is not available" errors
 */
export async function createTestAsyncCoordinator() {
  const { AsyncCoordinator } = await import("../core/AsyncCoordinator.js");
  const { ReactFlowBridge } = await import("../bridges/ReactFlowBridge.js");
  const { ELKBridge } = await import("../bridges/ELKBridge.js");

  const asyncCoordinator = new AsyncCoordinator();
  const reactFlowBridge = new ReactFlowBridge({});
  const elkBridge = new ELKBridge({
    algorithm: "mrtree",
    direction: "DOWN",
  });

  // Set bridge instances to avoid "ELK bridge is not available" errors
  asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);

  return { asyncCoordinator, reactFlowBridge, elkBridge };
}
