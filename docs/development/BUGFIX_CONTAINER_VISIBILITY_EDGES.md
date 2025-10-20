# Bug Fix: Container Visibility Toggle Edge Aggregation

## Problem

When toggling container visibility via the eye icon in HierarchyTree, edges were referencing non-existent (hidden) nodes, causing ELK layout failures:

```
[ELKBridge] ❌ INVALID EDGE: e1 references non-existent nodes - source=1 (exists: true), target=2 (exists: false)
[ELKBridge] 🚨 Data consistency error: 6 edges reference non-existent nodes
```

## Root Cause

The `toggleContainerVisibility` method was hiding containers and nodes but **not cleaning up aggregated edges** that referenced those hidden entities. This is different from the collapse/expand path, which properly handles edge aggregation.

### What Was Happening

1. User clicks eye icon to hide a container
2. `_hideContainerAndSaveState()` marks containers and nodes as hidden
3. Descendant containers and nodes are recursively hidden
4. **BUT** aggregated edges still reference the now-hidden containers
5. ELK layout receives edges pointing to non-existent nodes → crash

## Solution

Added proper edge aggregation cleanup when hiding/showing containers via visibility toggle:

### Changes Made

1. **`_hideContainerAndSaveState()`**
   - Now sets `container.hidden = true` on the container object
   - Calls `_cleanupAggregatedEdgesForHiddenContainer()` for the container
   - Recursively cleans up edges for all descendant containers via new helper method

2. **`_showContainerAndRestoreState()`**
   - Now sets `container.hidden = false` on the container object
   - Calls `aggregateEdgesForContainer()` to re-aggregate edges with visible endpoints

3. **New Method: `_cleanupAggregatedEdgesForHiddenContainerRecursive()`**
   - Recursively cleans up aggregated edges for a container and all its descendants
   - Ensures deeply nested containers don't leave dangling edge references

4. **`_hideAllDescendantContainers()`**
   - Now sets `childContainer.hidden = true` on each descendant

5. **`_showDescendantContainersBasedOnSnapshot()`**
   - Now sets `childContainer.hidden = false` when restoring visibility

6. **`_hideAllNodesInContainer()` and `_showNodesInContainer()`**
   - Already fixed in previous commit to set `node.hidden` property

## Testing

All 203 existing tests pass, including:
- `hierarchy-visibility-recursive.test.ts` - Validates recursive hiding/showing
- `VisualizationState.visibility.test.ts` - Container visibility operations
- `VisualizationState.edgeAggregation.test.ts` - Edge aggregation correctness
- `VisualizationState.edgeAlgorithms.test.ts` - Edge restoration algorithms

## Impact

- ✅ Fixes ELK layout crashes when toggling container visibility
- ✅ Maintains consistency between visibility state and edge aggregation
- ✅ Properly handles deeply nested container hierarchies
- ✅ No breaking changes to existing functionality

## Related Files

- `hydroscope/src/core/VisualizationState.ts` - Core fix
- `hydroscope/src/__tests__/hierarchy-visibility-recursive.test.ts` - Regression test
- `hydroscope/console.log` - Original error log
- `hydroscope/bugs.md` - Bug tracking document
