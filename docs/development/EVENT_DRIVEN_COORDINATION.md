# Event-Driven Coordination in AsyncCoordinator

## Problem

AsyncCoordinator had timeout-based patterns that violated its core principle of deterministic, sequential execution:

1. **Animation wait timeouts** - `setTimeout(animationDuration + 50)` to guess when viewport animations complete
2. **Double RAF hack** - `requestAnimationFrame` twice to guess when React finishes rendering
3. **Race conditions** - Search and navigation had different code paths triggering spotlights at different times
4. **Fire-and-forget search** - SearchControls was calling async search but returning immediately, allowing navigation before search completed

## Solution

Replaced all timeout-based patterns with event-driven coordination:

### 1. Viewport Animation Completion Tracking

**Added to AsyncCoordinator:**
```typescript
// Track viewport animation state
private viewportAnimationCompleteResolvers: Array<() => void> = [];
private isViewportAnimating = false;

// Mark animation start (called before setCenter/fitView)
private markViewportAnimationStart(): void

// Wait for animation complete (returns Promise)
private waitForViewportAnimationComplete(): Promise<void>

// Called by HydroscopeCore when onMoveEnd fires
public notifyViewportAnimationComplete(): void
```

**Wired up in HydroscopeCore:**
```typescript
<ReactFlow
  onMoveEnd={() => {
    state.asyncCoordinator?.notifyViewportAnimationComplete();
  }}
/>
```

### 2. Unified Spotlight Triggering

**Before (race condition):**
- Search: AsyncCoordinator → `setTimeout(300ms)` → spotlight
- Navigation: InfoPanel → spotlight immediately

**After (event-driven):**
- Search: AsyncCoordinator → wait for `onMoveEnd` → spotlight
- Navigation: AsyncCoordinator → wait for `onMoveEnd` → spotlight

Both paths now use the same event-driven flow through `waitForViewportAnimationComplete()`.

### 3. React Render Completion

**Existing mechanism (already event-driven):**
- `enqueuePostRenderCallback()` - Queue callbacks to run after React renders
- `notifyRenderComplete()` - Called by HydroscopeCore after `useEffect` runs
- `waitForNextRender()` - Returns Promise that resolves after next render

**Removed:**
- Double `requestAnimationFrame` hack in `_handleFocusViewportOnElement`
- Now relies on caller using `waitForNextRender()` if needed

## Key Changes

### AsyncCoordinator.ts

1. Added viewport animation tracking state and methods
2. Updated `_handleFocusViewportOnElement` to mark animation start
3. Replaced `setTimeout` with `waitForViewportAnimationComplete()` in search paths
4. Updated `navigateToElementWithErrorHandling` to wait for animation before spotlight
5. Removed double RAF hack

### HydroscopeCore.tsx

1. Added `onMoveEnd` handler to notify AsyncCoordinator

### SearchControls.tsx

1. Made setTimeout callback `async` to allow awaiting
2. Changed from `.then()` chaining to `await` for search completion
3. Removed "return early" pattern that was causing race conditions
4. Search now blocks until complete before allowing navigation

## Benefits

1. **Deterministic** - No more guessing when animations complete
2. **No race conditions** - Single code path for spotlight triggering, search completes before navigation
3. **Sequential** - All operations properly sequenced through events
4. **Maintainable** - Clear event-driven flow instead of magic timeouts
5. **Correct behavior** - Navigation arrows can't be clicked until search finishes expanding containers

## The Search Race Condition Bugs

### Bug 1: Fire-and-Forget Search (Fixed)

**What Was Happening:**
1. User types "map" in search box
2. SearchControls calls `asyncCoordinator.updateSearchResults()` which returns a Promise
3. SearchControls **immediately returns** without waiting (fire-and-forget pattern)
4. User clicks navigation arrow to go to element 29
5. Navigation tries to focus element 29, but it's not in the DOM yet (search hasn't expanded containers)
6. Error: "Element 29 not found in ReactFlow"

**Root Cause:** SearchControls was using `.then()` chaining and returning early.

**Fix:** Changed to `await` pattern to block until search completes.

### Bug 2: Premature Return from updateSearchResults (Fixed)

**What Was Happening:**
1. Search expands containers (e.g., loc_0 for element 29)
2. Layout runs and React state updates
3. `updateSearchResults` returns immediately with results
4. SearchControls navigates to first result (element 29)
5. Navigation tries to create spotlight but element 29 not in DOM yet
6. Error: "Could not find nodeElement or container for element: 29"

**Root Cause:** `updateSearchResults` was returning after updating React state but BEFORE React actually rendered the new nodes.

**The Fix:**

Added `await this.waitForNextRender()` before returning from `updateSearchResults`:

```typescript
// AsyncCoordinator.ts - updateSearchResults
await this._handleLayoutAndRenderPipeline(...);

// Wait for React to render the expanded containers before returning
await this.waitForNextRender();

// Return search results after all work completes AND React has rendered
return searchResults;
```

This ensures that when SearchControls gets the results back, the elements are guaranteed to be in the DOM and ready for navigation.

**Benefits:**
- Deterministic: Uses event-driven `notifyRenderComplete()` callback, not timeouts
- Correct API: Return value guarantees elements are ready to use
- No race conditions: Navigation always happens after render completes

## Remaining Legitimate Timeouts

These timeouts are still present and are appropriate:

1. **Retry backoff** (line 412) - Exponential backoff for failed operations
2. **Operation timeout** (line 426) - Timeout enforcement for queued operations
3. **ELK layout timeout** (line 1400) - Prevents ELK from hanging forever

These are timeout *enforcement* mechanisms, not coordination mechanisms, so they're fine.
