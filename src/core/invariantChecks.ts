/**
 * Aggressive invariant checking for development/debugging
 *
 * These checks can be enabled/disabled via DEBUG_INVARIANTS flag
 * When enabled, they will throw errors immediately when invariants are violated
 */

// Global debug flag - always enabled for now to catch bugs early
// TODO: Make this configurable via import.meta.env or build flag
export const DEBUG_INVARIANTS = true;

/**
 * Assert that a condition is true, throwing an error if not
 */
export function assertInvariant(
  condition: boolean,
  message: string,
  context?: Record<string, any>,
): void {
  if (!DEBUG_INVARIANTS) return;

  if (!condition) {
    const contextStr = context
      ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
      : "";
    throw new Error(`❌ INVARIANT VIOLATION: ${message}${contextStr}`);
  }
}

/**
 * Check that all ancestors of a container are expanded (not collapsed)
 */
export function assertAncestorsExpanded(
  containerId: string,
  getContainer: (id: string) => { collapsed: boolean; id: string } | undefined,
  getParent: (id: string) => string | undefined,
  operation: string,
): void {
  if (!DEBUG_INVARIANTS) return;

  let currentAncestor = getParent(containerId);
  const collapsedAncestors: string[] = [];

  while (currentAncestor) {
    const ancestorContainer = getContainer(currentAncestor);
    if (ancestorContainer && ancestorContainer.collapsed) {
      collapsedAncestors.push(currentAncestor);
    }
    currentAncestor = getParent(currentAncestor);
  }

  assertInvariant(
    collapsedAncestors.length === 0,
    `Cannot ${operation} container ${containerId} - ancestors are collapsed`,
    {
      containerId,
      operation,
      collapsedAncestors,
    },
  );
}

/**
 * Check that all descendants of a collapsed container are also collapsed and hidden
 */
export function assertDescendantsCollapsedAndHidden(
  containerId: string,
  getContainer: (id: string) =>
    | {
        collapsed: boolean;
        hidden: boolean;
        children: Set<string>;
        id: string;
      }
    | undefined,
  getNode: (id: string) => { hidden: boolean; id: string } | undefined,
): void {
  if (!DEBUG_INVARIANTS) return;

  const container = getContainer(containerId);
  if (!container || !container.collapsed) return;

  const violations: string[] = [];
  const queue: string[] = [containerId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = getContainer(currentId);
    if (!current) continue;

    // Check all children
    for (const childId of current.children) {
      const childContainer = getContainer(childId);
      const childNode = getNode(childId);

      if (childContainer) {
        if (!childContainer.collapsed) {
          violations.push(
            `Container ${childId} should be collapsed (ancestor ${containerId} is collapsed)`,
          );
        }
        if (!childContainer.hidden) {
          violations.push(
            `Container ${childId} should be hidden (ancestor ${containerId} is collapsed)`,
          );
        }
        queue.push(childId);
      } else if (childNode) {
        if (!childNode.hidden) {
          violations.push(
            `Node ${childId} should be hidden (container ${containerId} is collapsed)`,
          );
        }
      }
    }
  }

  assertInvariant(
    violations.length === 0,
    `Container ${containerId} has inconsistent descendants`,
    {
      containerId,
      violations,
    },
  );
}

/**
 * Check that a container's visibility state is consistent with its collapsed state
 */
export function assertContainerVisibilityConsistent(
  containerId: string,
  container: { collapsed: boolean; hidden: boolean; id: string },
): void {
  if (!DEBUG_INVARIANTS) return;

  // A collapsed container can be visible (but its contents are hidden)
  // A hidden container should have all descendants hidden
  // This is just checking basic consistency

  assertInvariant(
    !(container.hidden && !container.collapsed),
    `Container ${containerId} is hidden but not collapsed - inconsistent state`,
    {
      containerId,
      collapsed: container.collapsed,
      hidden: container.hidden,
    },
  );
}

/**
 * Check that the collapsedContainers Set matches the actual collapsed state
 */
export function assertCollapsedSetConsistent(
  collapsedContainers: Set<string>,
  getAllContainers: () => Iterable<{
    collapsed: boolean;
    id: string;
  }>,
): void {
  if (!DEBUG_INVARIANTS) return;

  const violations: string[] = [];

  for (const container of getAllContainers()) {
    const isInSet = collapsedContainers.has(container.id);
    const isCollapsed = container.collapsed;

    if (isCollapsed && !isInSet) {
      violations.push(
        `Container ${container.id} is collapsed but NOT in collapsedContainers set`,
      );
    } else if (!isCollapsed && isInSet) {
      violations.push(
        `Container ${container.id} is expanded but IS in collapsedContainers set`,
      );
    }
  }

  assertInvariant(
    violations.length === 0,
    "collapsedContainers Set is inconsistent with actual container state",
    {
      violations,
      collapsedSetSize: collapsedContainers.size,
    },
  );
}

/**
 * Log an invariant check (useful for tracking what's being validated)
 */
export function logInvariantCheck(
  operation: string,
  details?: Record<string, any>,
): void {
  if (!DEBUG_INVARIANTS) return;

  console.log(`🔍 Invariant check: ${operation}`, details || "");
}
