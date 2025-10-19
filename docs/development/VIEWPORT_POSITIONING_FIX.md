# Viewport Positioning Fix for Container Expand/Collapse

## Problem

Container expansion and collapse in AutoFit mode were not centering the viewport on the container. Additionally, there were race conditions causing operations to overlap.

## Root Cause

ReactFlow's `setCenter()` API is **fire-and-forget**:
- No promise returned
- No callback parameter
- Only signal is `onMoveEnd` event, which **only fires if viewport actually moves**
- If target position matches current position, `onMoveEnd` never fires

This caused our event-driven coordination to hang waiting for an event that would never come.

## Solution

Use **immediate positioning** (`duration: 0`) instead of animated transitions:

```typescript
await this._handleFocusViewportOnElement(containerId, reactFlowInstance, {
  visualizationState: state,
  immediate: true, // duration: 0 - synchronous and deterministic
  zoom: 1.0,
});
```

### Why This Works

1. **Synchronous execution** - no waiting for events
2. **Deterministic** - always completes immediately
3. **No race conditions** - operations execute sequentially through the queue
4. **Consistent with search/navigation** - they already use immediate positioning

## Implementation Details

### Container Expansion
- After layout completes, immediately center viewport on expanded container
- Auto-calculate zoom to fit container with 80% viewport padding
- Capped at zoom 1.0 (native size)

### Container Collapse
- After layout completes, immediately center viewport on collapsed container
- Fixed zoom of 1.0 for consistent collapsed view

### Test Infrastructure
- Mock `notifyRenderComplete()` to simulate React rendering in tests
- Mock `setCenter()` to simulate viewport changes
- All operations complete synchronously in test environment

## Alternative Approaches Considered

1. **Polling viewport state** - Unreliable and inefficient
2. **Waiting for onMoveEnd** - Doesn't fire if viewport doesn't move
3. **requestAnimationFrame** - Only waits one frame, not for completion
4. **Custom duration tracking** - Race conditions with queue system

## References

- ReactFlow 12.8.2 API documentation
- `onMoveEnd` event behavior
- AsyncCoordinator queue system
