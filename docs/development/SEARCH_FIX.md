# Search Regression Fix

## Problem
Search was reporting 0 matches even when there were many matching elements. For example, searching for "leader" in paxos-flipped.json would return 0 results despite many containers having "leader" in their names.

## Root Cause
The issue was in `SearchControls.tsx` lines 315-326. The code was:

1. Getting search results from `AsyncCoordinator.updateSearchResults()` (which correctly found all matches, including those in collapsed containers)
2. Expanding containers to show those matches
3. **Then filtering the results through `searchableItems`** to re-sort them

The problem: `searchableItems` is built by `getSearchableItemsInTreeOrder()` which traverses the hierarchy tree. This list is created **before** the search expands containers, so it only includes nodes that were already visible. When we filtered the complete search results through this stale list, we lost all the results that were inside previously-collapsed containers.

## The Fix
Changed SearchControls.tsx to use the search results directly from `updateSearchResults()` without filtering through `searchableItems`:

```typescript
// BEFORE (broken):
const resultsById = new Map(searchResults.map((r: any) => [r.id, r]));
next = searchableItems
  .filter((item) => resultsById.has(item.id))  // This filters OUT newly visible nodes!
  .map((item) => { ... });

// AFTER (fixed):
next = searchResults.map((r: any) => ({
  id: r.id,
  label: r.label,
  type: r.type,
  matchIndices: r.matchIndices || [],
}));
```

The search results from `VisualizationState.performSearch()` are already:
- Complete (include all matches, even in collapsed containers)
- Correctly sorted (by confidence score and match position)
- Ready to use

There's no need to filter or re-sort them through `searchableItems`.

## Testing
To verify the fix works:
1. Load paxos-flipped.json
2. Search for "leader" - should find many results
3. Switch to backtrace hierarchy and search for "closure" - should find and highlight the container

## Additional Fix: Container Search Results

There was a second issue: when searching for containers (not just nodes), the `_getContainersForSearchResults` method in AsyncCoordinator only handled node results. It didn't expand parent containers to make matching containers visible.

**Fixed in AsyncCoordinator.ts:**
- Added handling for `result.type === "container"` 
- Now expands both the matching container itself AND its parent containers
- **CRITICAL:** Sort containers by depth so parents are expanded BEFORE children
  - This prevents invariant violations where we try to expand a container whose parent is still collapsed
  - Containers are sorted by depth (descending) so root containers expand first

## Additional Fix: Duplicate Spotlight Creation

There was a third issue: duplicate React key warnings for spotlights.

**Root cause:** Spotlights were being created twice for search results:
1. Once by `updateSearchResults` after focusing the viewport
2. Once by `navigateToElement` (called via SearchControls -> onNavigate -> handleSearchNavigate -> onElementNavigation)

**Fixed in AsyncCoordinator.ts:**
- Removed spotlight creation from `updateSearchResults`
- Let the navigation flow handle spotlight creation through `navigateToElement`
- This ensures only one spotlight is created per search result

## Files Changed
- `hydroscope/src/components/SearchControls.tsx` - Removed the filtering step that was losing results
- `hydroscope/src/core/AsyncCoordinator.ts` - Fixed container expansion order and removed duplicate spotlight creation
