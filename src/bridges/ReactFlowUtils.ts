/**
 * @fileoverview Utilities for bridges
 */

import type { VisualizationState } from '../core/VisualizationState';
import type { Container, GraphNode } from '../shared/types';
import { LAYOUT_CONSTANTS } from '../shared/config';
import { hscopeLogger } from '../utils/logger';

/** Build parent-child relationship map for visible elements */
export function buildParentMap(visState: VisualizationState): Map<string, string> {
  // ARCHITECTURAL FIX: Use VisualizationState's optimized mappings instead of local collections
  const nodeContainerMapping = visState.getNodeContainerMapping();
  const containerParentMapping = visState.getContainerParentMapping();

  const parentMap = new Map<string, string>();

  // Add node-to-container relationships for visible nodes
  visState.visibleNodes.forEach(node => {
    const containerId = nodeContainerMapping.get(node.id);
    if (containerId) {
      parentMap.set(node.id, containerId);
    }
  });

  // Add container-to-container relationships for visible containers
  visState.visibleContainers.forEach(container => {
    const parentId = containerParentMapping.get(container.id);
    if (parentId) {
      parentMap.set(container.id, parentId);
    }
  });

  return parentMap;
}

/** Sort containers by hierarchy level so parents appear before children */
export function sortContainersByHierarchy(
  containers: Container[],
  parentMap: Map<string, string>
): Container[] {
  const getHierarchyLevel = (containerId: string): number => {
    let level = 0;
    let currentId = containerId;
    while (parentMap.has(currentId)) {
      level++;
      currentId = parentMap.get(currentId)!;
    }
    return level;
  };

  return containers.sort((a, b) => getHierarchyLevel(a.id) - getHierarchyLevel(b.id));
}

/** Ensure a coordinate is a finite number, else 0 */
export function safeNum(n: unknown): number {
  return typeof n === 'number' && !isNaN(n) && isFinite(n) ? n : 0;
}

/** Check if ELK layout has meaningful non-zero coordinates */
export function hasMeaningfulELKPosition(
  layout: { position?: { x?: number; y?: number } } | undefined
): boolean {
  const x = layout?.position?.x;
  const y = layout?.position?.y;
  // Position is meaningful if both coordinates are defined (including 0,0)
  // ELK might legitimately place containers at (0,0) as part of hierarchical layout
  return x !== undefined && y !== undefined;
}

/** Compute relative (child) position from absolute child and parent absolute */
export function toRelativePosition(
  childAbs: { x: unknown; y: unknown },
  parentAbs: { x: unknown; y: unknown }
) {
  const cx = safeNum(childAbs.x);
  const cy = safeNum(childAbs.y);
  const px = safeNum(parentAbs.x);
  const py = safeNum(parentAbs.y);
  return { x: cx - px, y: cy - py };
}

/** Compute absolute/root position safely */
export function toAbsolutePosition(abs: { x: unknown; y: unknown }) {
  return { x: safeNum(abs.x), y: safeNum(abs.y) };
}

/** Compute child-container position using ELK when available, else grid fallback */
export function computeChildContainerPosition(
  visState: VisualizationState,
  container: Container,
  parentId: string
) {
  const containerLayout = visState.getContainerLayout(container.id);
  const parentLayout = visState.getContainerLayout(parentId);

  if (hasMeaningfulELKPosition(containerLayout)) {
    const absoluteX = containerLayout?.position?.x ?? container.x ?? 0;
    const absoluteY = containerLayout?.position?.y ?? container.y ?? 0;
    const parentX = parentLayout?.position?.x ?? 0;
    const parentY = parentLayout?.position?.y ?? 0;
    return toRelativePosition({ x: absoluteX, y: absoluteY }, { x: parentX, y: parentY });
  }

  // PROPER FIX NEEDED: This indicates a timing issue where ELK layout hasn't
  // completed before ReactFlow conversion. This should be fixed in the
  // ConsolidatedOperationManager to ensure proper sequencing.

  const containerPos = containerLayout?.position;
  const parentPos = parentLayout?.position;

  hscopeLogger.error(
    'bridge',
    `Missing ELK layout positions for hierarchical containers:
   Container ${container.id} (${container.label}): position = ${containerPos ? `(${containerPos.x}, ${containerPos.y})` : 'undefined'}
   Parent ${parentId}: position = ${parentPos ? `(${parentPos.x}, ${parentPos.y})` : 'undefined'}
   This indicates ELK layout was not run properly or failed to set positions`
  );

  // DIAGNOSTIC: Show where this container is coming from
  if (container.id === 'bt_204' || container.id === 'bt_40') {
    hscopeLogger.log(
      'bridge',
      `🔍 DIAGNOSTIC for ${container.id}:
   Container object: ${JSON.stringify(container, null, 2)}
   Is in VisualizationState containers: ${visState.getContainer(container.id) ? 'YES' : 'NO'}
   Is in visible containers: ${visState.visibleContainers.some(c => c.id === container.id) ? 'YES' : 'NO'}
   Container source stack trace: ${new Error().stack}`
    );
  }

  throw new Error(
    `Missing ELK layout position for container ${container.id} (${container.label}). ` +
      `ELK layout must be run successfully before ReactFlow conversion. ` +
      `Container position: ${containerPos ? `(${containerPos.x}, ${containerPos.y})` : 'undefined'}, ` +
      `Parent position: ${parentPos ? `(${parentPos.x}, ${parentPos.y})` : 'undefined'}`
  );
}

/** Compute root container absolute position safely */
export function computeRootContainerPosition(visState: VisualizationState, container: Container) {
  const containerLayout = visState.getContainerLayout(container.id);
  const rootX = containerLayout?.position?.x ?? container.x ?? 0;
  const rootY = containerLayout?.position?.y ?? container.y ?? 0;
  return toAbsolutePosition({ x: rootX, y: rootY });
}

/** Compute node position from ELK; relative to parent if nested */
export function computeNodePosition(
  visState: VisualizationState,
  node: GraphNode,
  parentId: string | undefined
) {
  const nodeLayout = visState.getNodeLayout(node.id);
  if (parentId) {
    const parentLayout = visState.getContainerLayout(parentId);
    const absoluteX = nodeLayout?.position?.x ?? node.x ?? 0;
    const absoluteY = nodeLayout?.position?.y ?? node.y ?? 0;
    const parentX = parentLayout?.position?.x ?? 0;
    const parentY = parentLayout?.position?.y ?? 0;
    return toRelativePosition({ x: absoluteX, y: absoluteY }, { x: parentX, y: parentY });
  }
  const rootX = nodeLayout?.position?.x ?? node.x ?? 0;
  const rootY = nodeLayout?.position?.y ?? node.y ?? 0;
  return toAbsolutePosition({ x: rootX, y: rootY });
}

/** Get adjusted container dimensions, falling back to defaults when invalid */
export function getAdjustedContainerDimensionsSafe(
  visState: VisualizationState,
  containerId: string
) {
  const adjusted = visState.getContainerAdjustedDimensions(containerId) || { width: 0, height: 0 };
  const width =
    safeNum(adjusted.width) > 0 ? adjusted.width : LAYOUT_CONSTANTS.DEFAULT_PARENT_CONTAINER_WIDTH;
  const height =
    safeNum(adjusted.height) > 0
      ? adjusted.height
      : LAYOUT_CONSTANTS.DEFAULT_PARENT_CONTAINER_HEIGHT;
  return { width, height };
}
