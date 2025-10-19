# Search Viewport Focus Implementation

## Problem

When performing a search, the first match should automatically center and zoom in the viewport (like the up/down arrow navigation does), but this wasn't happening. Previous attempts caused race conditions.

## Root Cause

The search operation involves multiple async steps:

1. Perform search in VisualizationState
2. Expand containers to show hidden matches
3. Run ELK layout for expanded containers
4. Render ReactFlow with highlights
5. Focus viewport on first result

The SearchControls component was trying to navigate immediately after calling `onSearch`, but the search pipeline (steps 2-4) hadn't completed yet, causing race conditions.

## Solution

Use the AsyncCoordinator's queue to ensure proper sequencing:

### 1. Modified `handleSearchUpdate` in Hydroscope.tsx

Added navigation to first result AFTER the search pipeline completes:

```typescript
// Navigate to first result after search pipeline completes
if (searchResults.length > 0 && current) {
  asyncCoordinator.navigateToElementWithErrorHandling(
    current.id,
    currentVisualizationState,
    undefined, // Use AsyncCoordinator's internal ReactFlow instance
    {
      timeout: 10000,
      maxRetries: 1,
    },
  );
}
```

### 2. Updated `navigateToElementWithErrorHandling` in AsyncCoordinator.ts

Made it use the internal ReactFlow instance as a fallback:

```typescript
const instanceToUse = reactFlowInstance || this.reactFlowInstance;
```

This allows the method to work even when called without explicitly passing the ReactFlow instance.

## How It Works

### Sequence of Operations

1. User types search query in SearchControls
2. SearchControls calls `onSearch` (which is `handleSearchUpdate`)
3. `handleSearchUpdate` performs search and expands containers through AsyncCoordinator queue
4. After expansion completes, `handleSearchUpdate` calls `navigateToElementWithErrorHandling`
5. Navigation queues viewport focus operation
6. **Viewport focus waits for React render** using `waitForNextRender()`
7. After React renders the new nodes, viewport smoothly animates to center on the first match

### Queue Enforcement

All operations go through the AsyncCoordinator's queue:

- Container expansion → queued
- Layout calculation → queued
- ReactFlow render → queued
- **React render completion** → awaited via `waitForNextRender()`
- Viewport focus → queued and waits for render

This ensures no race conditions - each operation completes before the next begins, including waiting for React to actually render the new nodes.

## Benefits

✅ First search result automatically centers in viewport
✅ No race conditions - proper sequencing through AsyncCoordinator
✅ Consistent behavior with up/down arrow navigation
✅ Smooth animations
✅ Works even when containers need expansion

## Testing

To test:

1. Load a graph with collapsed containers
2. Search for a term that matches a hidden node
3. Observe that the viewport automatically centers and zooms on the first match
4. Use up/down arrows to navigate - should work consistently

## Files Modified

- `hydroscope/src/components/Hydroscope.tsx` - Added navigation after search pipeline
- `hydroscope/src/core/AsyncCoordinator.ts` - Use internal ReactFlow instance as fallback
