# Deadlock Fix - Queue Enforcement

## Problem

Tests were hanging indefinitely when calling bulk operations like `collapseContainers()`.

## Root Cause

**DEADLOCK** in the queue system:

1. `processDataChange` operation was queued and started executing (op_1)
2. Inside `_handleProcessDataChange`, it called `executeLayoutAndRenderPipeline()`
3. `executeLayoutAndRenderPipeline()` tried to queue itself using `_enqueueAndWait()` (op_2)
4. But the queue was already processing op_1, so op_2 was queued but never started
5. op_1 waited for op_2 to complete, and op_2 waited for op_1 to finish
6. **DEADLOCK** - both operations waiting for each other

## Solution

When a queued operation needs to call another operation internally, it should call the private handler directly instead of going through the queue again.

**Changed:**
```typescript
// OLD - causes deadlock
const reactFlowData = await this.executeLayoutAndRenderPipeline(...)

// NEW - calls handler directly
const reactFlowData = await this._handleLayoutAndRenderPipeline(...)
```

This prevents nested queue operations from deadlocking.

## Files Changed

- `hydroscope/src/core/AsyncCoordinator.ts` - Changed `_handleProcessDataChange` to call `_handleLayoutAndRenderPipeline` directly instead of `executeLayoutAndRenderPipeline`

## Test Results

After fix:
- ✅ All 11 bulk-operations-atomicity tests pass
- ✅ All AsyncCoordinator tests pass (68 tests)
- ✅ All integration tests pass (234 tests)
- ✅ Total: 1305 tests passing

Remaining failures (6) are unrelated search functionality bugs.
