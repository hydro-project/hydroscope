# AsyncCoordinator Consolidation Evaluation

## Current Problem
ResizeObserver loop errors during search due to multiple rapid renders:
1. Container expansion → ELK layout + ReactFlow render
2. Viewport focus → Animation + potential resize
3. Highlight update → ReactFlow render again

## Question
Should we move more search logic from Hydroscope.tsx into AsyncCoordinator to reduce asynchrony and improve sequencing?

## Analysis

### Current Architecture
**Hydroscope.tsx** (Component layer):
- Handles user input (search query)
- Orchestrates high-level operations
- Calls AsyncCoordinator methods
- Manages React state

**AsyncCoordinator** (Operation layer):
- Queues and sequences operations
- Prevents race conditions
- Handles retries and timeouts
- Manages ReactFlow instance

### Current Search Flow in Hydroscope.tsx
```typescript
// 1. Perform search
const searchResults = currentVisualizationState.performSearch(query);

// 2. Find containers to expand
const containersToExpand = new Set<string>();
for (const result of searchResults) {
  const expansionPath = currentVisualizationState.getTreeExpansionPath(result.id);
  for (const containerId of expansionPath) {
    containersToExpand.add(containerId);
  }
}

// 3. Expand containers (queued)
await asyncCoordinator.expandContainers(...);

// 4. Update highlights (synchronous)
currentVisualizationState.updateGraphSearchHighlights([...searchResults]);

// 5. Render again (queued)
await asyncCoordinator.executeLayoutAndRenderPipeline(...);

// 6. Navigate to first result (queued)
asyncCoordinator.navigateToElementWithErrorHandling(...);
```

### Problems with Current Approach
1. **Multiple awaits** - Each await can trigger React re-renders
2. **Synchronous state mutation** - `updateGraphSearchHighlights` between async operations
3. **Separate render calls** - expandContainers renders, then we render again
4. **Complex orchestration** - Logic spread across component and coordinator

## Proposed Solution: Consolidated Search Operation

### Option A: New `performSearchWithExpansion` Method (RECOMMENDED)
**Effort: Small (2-3 hours)**

Add a single AsyncCoordinator method that handles the entire search pipeline:

```typescript
// In AsyncCoordinator.ts
async performSearchWithExpansion(
  state: VisualizationState,
  query: string,
  options?: {
    navigateToFirst?: boolean;
    fitView?: boolean;
  }
): Promise<SearchResult[]> {
  return this._enqueueAndWait(
    "search_with_expansion",
    () => this._handleSearchWithExpansion(state, query, options),
  );
}

private async _handleSearchWithExpansion(
  state: VisualizationState,
  query: string,
  options?: { navigateToFirst?: boolean; fitView?: boolean }
): Promise<SearchResult[]> {
  // 1. Perform search (synchronous)
  const searchResults = state.performSearch(query);
  
  if (searchResults.length === 0) {
    // Just render to clear highlights
    await this._handleLayoutAndRenderPipeline(state, {
      relayoutEntities: [],
      fitView: false,
    });
    return searchResults;
  }

  // 2. Find containers to expand
  const containersToExpand = new Set<string>();
  for (const result of searchResults) {
    const expansionPath = state.getTreeExpansionPath(result.id);
    for (const containerId of expansionPath) {
      containersToExpand.add(containerId);
    }
  }

  // 3. Expand containers if needed
  if (containersToExpand.size > 0) {
    // Expand and layout
    await this._handleExpandContainers(state, Array.from(containersToExpand), {
      fitView: false,
    });
    
    // 4. Update highlights AFTER expansion (nodes are now visible)
    state.updateGraphSearchHighlights([...searchResults]);
    
    // 5. Render to apply highlights (no layout needed)
    await this._handleLayoutAndRenderPipeline(state, {
      relayoutEntities: [],
      fitView: false,
    });
  } else {
    // No expansion needed, just render highlights
    await this._handleLayoutAndRenderPipeline(state, {
      relayoutEntities: [],
      fitView: false,
    });
  }

  // 6. Navigate to first result if requested
  if (options?.navigateToFirst && searchResults.length > 0) {
    await this._handleFocusViewportOnElement(
      searchResults[0].id,
      state,
      options.fitView,
    );
  }

  return searchResults;
}
```

**In Hydroscope.tsx:**
```typescript
// Much simpler!
const searchResults = await asyncCoordinator.performSearchWithExpansion(
  currentVisualizationState,
  query,
  { navigateToFirst: true, fitView: false }
);
```

### Benefits of Option A
✅ **Single queued operation** - All search logic runs atomically
✅ **No intermediate renders** - Only renders when needed
✅ **Simpler component code** - One method call instead of complex orchestration
✅ **Better error handling** - Entire operation can be retried as a unit
✅ **Prevents ResizeObserver errors** - Fewer DOM mutations
✅ **Easier to test** - Single method to test instead of complex flow
✅ **Consistent with existing patterns** - Similar to `expandContainers`, `navigateToElement`, etc.

### Option B: Keep Current Approach, Fix Render Issue (QUICK FIX)
**Effort: Minimal (30 minutes)**

The real issue is that we're calling `executeLayoutAndRenderPipeline` after `expandContainers`, but `expandContainers` already renders. We can optimize by:

1. Add a `skipRender` option to `expandContainers`
2. Do a single render after updating highlights

```typescript
// In Hydroscope.tsx
await asyncCoordinator.expandContainers(
  currentVisualizationState,
  Array.from(containersToExpand),
  {
    fitView: false,
    skipFinalRender: true, // NEW: Don't render yet
  },
);

// Update highlights
currentVisualizationState.updateGraphSearchHighlights([...searchResults]);

// Single render with highlights
await asyncCoordinator.executeLayoutAndRenderPipeline(
  currentVisualizationState,
  {
    relayoutEntities: [],
    fitView: false,
  },
);
```

### Option C: Batch Operations (MEDIUM EFFORT)
**Effort: Medium (4-6 hours)**

Add a batching mechanism to AsyncCoordinator that combines multiple operations:

```typescript
await asyncCoordinator.batch([
  { type: 'expand', containerIds: [...] },
  { type: 'updateHighlights', results: [...] },
  { type: 'render', options: {...} },
  { type: 'navigate', elementId: '...' },
]);
```

This is more complex and might be overkill for this use case.

## Recommendation

**Go with Option A: `performSearchWithExpansion`**

### Why?
1. **Solves the immediate problem** - Eliminates extra renders
2. **Small effort** - 2-3 hours of work
3. **Better architecture** - Consolidates related operations
4. **Easier to maintain** - Single method instead of complex orchestration
5. **Consistent with existing patterns** - Follows AsyncCoordinator design
6. **Prevents future issues** - Atomic operations prevent race conditions

### Implementation Steps
1. Add `performSearchWithExpansion` method to AsyncCoordinator (~1 hour)
2. Add `_handleSearchWithExpansion` implementation (~1 hour)
3. Update Hydroscope.tsx to use new method (~30 min)
4. Test and verify ResizeObserver error is gone (~30 min)
5. Remove debug logging (~15 min)

### Alternative: Quick Fix First
If you want to verify this solves the ResizeObserver error before committing to the refactor:
1. Implement Option B (30 min) - Add `skipFinalRender` option
2. Test if ResizeObserver error is gone
3. If yes, then do Option A refactor for cleaner code
4. If no, investigate other causes

## Conclusion

**Yes, consolidating search logic into AsyncCoordinator is likely to help** and is a good architectural improvement. The task is **small to medium effort (2-3 hours)** and follows existing patterns in the codebase.

The ResizeObserver error is almost certainly caused by multiple rapid renders, and consolidating into a single queued operation will fix it.
