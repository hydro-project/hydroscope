/**
 * Utility functions for validating sync invariants
 */

import type { VisualizationState } from "../core/VisualizationState.js";

/**
 * Validates the sync invariant between collapsedContainers set and VisualizationState
 *
 * Invariant: For each container in VisualizationState:
 * - If container.collapsed === true, it SHOULD be in collapsedContainers set
 * - If container.collapsed === false, it should NOT be in collapsedContainers set
 *
 * @param visualizationState - The current visualization state
 * @param collapsedContainers - The derived set of collapsed container IDs
 * @param context - Description of when this check is being performed (for error messages)
 * @throws Error if invariant is violated
 */
export function validateSyncInvariant(
  visualizationState: VisualizationState,
  collapsedContainers: Set<string>,
  context: string = "unknown",
): void {
  const containers = visualizationState.getAllContainers();
  const violations: string[] = [];

  for (const container of containers) {
    const containerId = container.id;
    const isCollapsedInState = container.collapsed;
    const isInCollapsedSet = collapsedContainers.has(containerId);

    // Invariant: container.collapsed should match presence in collapsedContainers set
    if (isCollapsedInState && !isInCollapsedSet) {
      violations.push(
        `Container "${containerId}" is collapsed in state (collapsed=true) but NOT in collapsedContainers set`,
      );
    } else if (!isCollapsedInState && isInCollapsedSet) {
      violations.push(
        `Container "${containerId}" is expanded in state (collapsed=false) but IS in collapsedContainers set`,
      );
    }
  }

  if (violations.length > 0) {
    const allContainerIds = Array.from(containers).map((c) => c.id);
    const collapsedInState = Array.from(containers)
      .filter((c) => c.collapsed)
      .map((c) => c.id);
    const expandedInState = Array.from(containers)
      .filter((c) => !c.collapsed)
      .map((c) => c.id);
    const collapsedSetArray = Array.from(collapsedContainers).sort();

    const errorMessage =
      `❌ Sync invariant violated during: ${context}\n\n` +
      `Violations (${violations.length}):\n${violations.map((v) => `  • ${v}`).join("\n")}\n\n` +
      `Debug info:\n` +
      `  • Total containers: ${allContainerIds.length}\n` +
      `  • Collapsed in state: ${collapsedInState.length} → [${collapsedInState.sort().join(", ")}]\n` +
      `  • Expanded in state: ${expandedInState.length} → [${expandedInState.sort().join(", ")}]\n` +
      `  • In collapsedContainers set: ${collapsedSetArray.length} → [${collapsedSetArray.join(", ")}]`;

    throw new Error(errorMessage);
  }
}

/**
 * Derives the collapsedContainers set from VisualizationState
 * This mimics the logic in Hydroscope.tsx
 *
 * @param state - The visualization state to derive from
 * @returns Set of container IDs that are collapsed
 */
export function deriveCollapsedContainers(
  state: VisualizationState,
): Set<string> {
  const containers = state.getAllContainers();
  const collapsed = new Set<string>();
  for (const container of containers) {
    if (container.collapsed) {
      collapsed.add(container.id);
    }
  }
  return collapsed;
}
