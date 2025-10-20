/**
 * Utility functions for working with hierarchy tree structures
 *
 * These utilities traverse the container hierarchy in depth-first order,
 * which matches the visual order in the HierarchyTree component.
 */

import type { VisualizationState } from "../core/VisualizationState.js";

/**
 * Get searchable items in the same order as they appear in the tree hierarchy
 * This is used for:
 * 1. Search result ordering (so results match tree order)
 * 2. Search navigation (so next/prev follows tree order)
 *
 * The traversal order is:
 * 1. Container
 * 2. Child containers (recursively)
 * 3. Leaf nodes of the container
 */
export function getSearchableItemsInTreeOrder(
  visualizationState: VisualizationState,
): Array<{ id: string; label: string; type: "container" | "node" }> {
  const items: Array<{
    id: string;
    label: string;
    type: "container" | "node";
  }> = [];

  // Get root containers (those without parents)
  const allContainers = visualizationState.allContainers;
  const rootContainers = allContainers.filter(
    (container) => !visualizationState.getContainerParent(container.id),
  );

  const traverse = (containerId: string) => {
    // Add the container first
    const containerData = visualizationState.getContainer(containerId);
    const containerLabel = containerData?.label || containerId;
    items.push({ id: containerId, label: containerLabel, type: "container" });

    // Get child containers
    const childContainerIds: string[] = [];
    const containerChildren =
      visualizationState.getContainerChildren(containerId);
    containerChildren?.forEach((childId: string) => {
      if (visualizationState.getContainer(childId)) {
        childContainerIds.push(childId);
      }
    });

    // Recurse into child containers FIRST (matching tree render order)
    for (const childId of childContainerIds) {
      traverse(childId);
    }

    // THEN add its leaf children (nodes) - these come after child containers in the tree
    const containerNodes = visualizationState.getContainerNodes(containerId);
    if (containerNodes && containerNodes.size > 0) {
      const leafNodeIds = Array.from(containerNodes);
      for (const leafId of leafNodeIds) {
        const nodeData = visualizationState.getGraphNode(leafId);
        const nodeLabel = nodeData?.label || leafId;
        items.push({ id: leafId, label: nodeLabel, type: "node" });
      }
    }
  };

  // Traverse from each root container
  for (const container of rootContainers) {
    traverse(container.id);
  }

  return items;
}

/**
 * Get a map of entity ID to its position in the hierarchy tree (for sorting)
 * Lower numbers appear earlier in the tree (depth-first traversal order)
 */
export function getHierarchyOrderMap(
  visualizationState: VisualizationState,
): Map<string, number> {
  const orderMap = new Map<string, number>();
  const items = getSearchableItemsInTreeOrder(visualizationState);

  items.forEach((item, index) => {
    orderMap.set(item.id, index);
  });

  return orderMap;
}
