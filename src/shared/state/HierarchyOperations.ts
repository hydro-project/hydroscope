/**
 * HierarchyOperations - Helper functions for hierarchy traversal
 * These are pure utility functions that don't maintain state
 */
import type { Container, GraphNode } from "../../types/core.js";

export class HierarchyOperations {
  /**
   * Get all descendant IDs for a container (including nested containers)
   */
  static getAllDescendants(
    containerId: string,
    containers: Map<string, Container>,
    cache?: Map<string, Set<string>>,
  ): Set<string> {
    // Check cache first
    if (cache?.has(containerId)) {
      return cache.get(containerId)!;
    }

    const descendants = new Set<string>();
    const container = containers.get(containerId);
    if (!container) return descendants;

    for (const childId of container.children) {
      descendants.add(childId);
      // If child is a container, recursively get its descendants
      if (containers.has(childId)) {
        const childDescendants = HierarchyOperations.getAllDescendants(
          childId,
          containers,
          cache,
        );
        for (const descendantId of childDescendants) {
          descendants.add(descendantId);
        }
      }
    }

    // Cache the result if cache is provided
    cache?.set(containerId, descendants);
    return descendants;
  }

  /**
   * Get container depth in hierarchy
   */
  static getContainerDepth(
    containerId: string,
    containerParentMap: Map<string, string>,
  ): number {
    let depth = 0;
    let currentId: string | undefined = containerId;
    
    // Walk up the parent chain to calculate depth
    while (currentId) {
      const parentId = containerParentMap.get(currentId);
      if (parentId) {
        depth++;
        currentId = parentId;
      } else {
        break;
      }
    }
    
    return depth;
  }

  /**
   * Get hierarchy path for an element
   */
  static getHierarchyPath(
    elementId: string,
    nodeContainerMap: Map<string, string>,
    containerParentMap: Map<string, string>,
    containers: Map<string, Container>,
  ): string[] {
    const path: string[] = [];
    
    // Check if it's a node
    let currentContainerId = nodeContainerMap.get(elementId);
    
    // If not a node, check if it's a container
    if (!currentContainerId) {
      currentContainerId = containerParentMap.get(elementId);
    }
    
    // Walk up the hierarchy
    while (currentContainerId) {
      const container = containers.get(currentContainerId);
      if (container) {
        path.unshift(container.label);
      }
      currentContainerId = containerParentMap.get(currentContainerId);
    }
    
    return path;
  }

  /**
   * Check if container can be expanded (all ancestors are expanded)
   */
  static canExpandContainer(
    containerId: string,
    containers: Map<string, Container>,
    containerParentMap: Map<string, string>,
  ): boolean {
    const container = containers.get(containerId);
    // If container is not collapsed, it doesn't need expansion
    if (!container || !container.collapsed) return false;
    
    // Check if ALL ancestors are expanded (not just immediate parent)
    let parentId = containerParentMap.get(containerId);
    while (parentId) {
      const parentContainer = containers.get(parentId);
      if (parentContainer) {
        // If any ancestor is collapsed, this container cannot be expanded
        if (parentContainer.collapsed) {
          return false;
        }
        parentId = containerParentMap.get(parentId);
      } else {
        // Reached the top level
        break;
      }
    }
    
    // All ancestors are expanded (or this is a top-level container)
    return true;
  }

  /**
   * Get all collapsed ancestor containers for a given entity
   */
  static getCollapsedAncestors(
    entityId: string,
    nodeContainerMap: Map<string, string>,
    containerParentMap: Map<string, string>,
    containers: Map<string, Container>,
  ): string[] {
    const collapsedAncestors: string[] = [];
    let currentContainerId =
      nodeContainerMap.get(entityId) || containerParentMap.get(entityId);

    while (currentContainerId) {
      const container = containers.get(currentContainerId);
      if (container && container.collapsed) {
        collapsedAncestors.push(currentContainerId);
      }
      currentContainerId = containerParentMap.get(currentContainerId);
    }

    return collapsedAncestors;
  }
}
