/**
 * @fileoverview Hierarchy Tree Utilities
 * 
 * Utility functions for building and managing hierarchy tree structures
 * from VisualizationState data.
 */

import { HierarchyTreeNode } from './types';

/**
 * Build hierarchy tree from VisualizationState
 */
export function buildHierarchyTree(visualizationState: any, grouping: string = 'default'): HierarchyTreeNode[] {
  if (!visualizationState) {
    return [];
  }

  // Get all visible containers and build parent relationships
  const containers = visualizationState.visibleContainers || [];
  const parentMap = new Map<string, string>();

  // Build parent relationships by scanning container children  
  containers.forEach((container: any) => {
    const children = visualizationState.getContainerChildren?.(container.id);
    if (children) {
      children.forEach((childId: string) => {
        const childContainer = visualizationState.getContainer?.(childId);
        if (childContainer) {
          parentMap.set(childId, container.id);
        }
      });
    }
  });

  // Recursively build tree structure 
  const buildTree = (parentId: string | null): HierarchyTreeNode[] => {
    const children: HierarchyTreeNode[] = [];
    for (const container of containers) {
      const containerParent = parentMap.get(container.id) || null;
      if (containerParent === parentId) {
        const grandchildren = buildTree(container.id);
        children.push({
          id: container.id,
          children: grandchildren,
        });
      }
    }
    return children;
  };

  return buildTree(null); // Start with root containers (no parent)
}

/**
 * Get collapsed containers set from VisualizationState
 */
export function getCollapsedContainersSet(visualizationState: any): Set<string> {
  if (!visualizationState) {
    return new Set();
  }

  return new Set(
    visualizationState.visibleContainers
      .filter((container: any) => container.collapsed)
      .map((container: any) => container.id)
  );
}

/**
 * Get expanded keys for HierarchyTree (inverse of collapsed containers)
 */
export function getExpandedKeysForHierarchyTree(
  hierarchyTree: HierarchyTreeNode[], 
  collapsedContainers: Set<string>
): string[] {
  const allKeys: string[] = [];
  
  const collectKeys = (nodes: HierarchyTreeNode[]) => {
    nodes.forEach(node => {
      allKeys.push(node.id);
      if (node.children) {
        collectKeys(node.children);
      }
    });
  };
  
  collectKeys(hierarchyTree);
  
  // Return keys that are NOT in collapsedContainers (i.e., expanded keys)
  return allKeys.filter(key => !collapsedContainers.has(key));
}

/**
 * Validate that HierarchyTree state is synchronized with VisualizationState
 */
export function validateHierarchyTreeSync(
  visualizationState: any,
  hierarchyTree: HierarchyTreeNode[],
  collapsedContainers: Set<string>
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!visualizationState) {
    errors.push('VisualizationState is null or undefined');
    return { isValid: false, errors };
  }

  // Check that collapsed containers set matches actual collapsed state
  const actualCollapsedContainers = getCollapsedContainersSet(visualizationState);
  
  // Check for containers in collapsedContainers that are not actually collapsed
  for (const containerId of collapsedContainers) {
    if (!actualCollapsedContainers.has(containerId)) {
      errors.push(`Container ${containerId} is in collapsedContainers set but is not actually collapsed in VisualizationState`);
    }
  }
  
  // Check for containers that are collapsed but not in collapsedContainers set
  for (const containerId of actualCollapsedContainers) {
    if (!collapsedContainers.has(containerId)) {
      errors.push(`Container ${containerId} is collapsed in VisualizationState but not in collapsedContainers set`);
    }
  }
  
  // Check that all containers in hierarchyTree exist in VisualizationState
  const checkHierarchyExists = (nodes: HierarchyTreeNode[]) => {
    nodes.forEach(node => {
      const container = visualizationState.getContainer(node.id);
      if (!container) {
        errors.push(`Container ${node.id} exists in hierarchyTree but not in VisualizationState`);
      }
      if (node.children) {
        checkHierarchyExists(node.children);
      }
    });
  };
  
  checkHierarchyExists(hierarchyTree);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
