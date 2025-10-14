# Bridge Reset Architecture

## Problem

When toggling "Show full node labels", nodes resize but edges remain in stale positions, creating a "dangling edges" problem. This happens because ReactFlow's internal edge handle calculations are not updated when node dimensions change.

## Root Cause

The issue occurs because we were only updating the data layer (VisualizationState) but not forcing the presentation layer (ReactFlow component) to completely remount and recalculate edge handles.

## Solution: Complete 4-Layer Reset

When toggling features that change node dimensions, we now perform a complete reset of all 4 layers:

### The 4 Layers

1. **ELK Bridge** - Converts VisualizationState to ELK graph format
2. **ELK Instance** - The actual ELK layout engine (created inside ELK Bridge)
3. **ReactFlow Bridge** - Converts VisualizationState to ReactFlow format
4. **ReactFlow Component** - The actual React component that renders the graph

### Implementation

#### Utility Functions (`src/utils/bridgeResetUtils.ts`)

```typescript
// Reset ELK bridge (creates new ELK instance internally)
resetELKBridge(options: ELKResetOptions): ELKBridge

// Reset ReactFlow bridge and force component remount
resetReactFlowBridge(options: ReactFlowResetOptions): ReactFlowBridge

// Reset all 4 layers at once
resetAllBridges(options: FullBridgeResetOptions): FullBridgeResetResult
```

#### Component Integration

**HydroscopeCore** exposes a `forceReactFlowRemount()` method that increments the `reactFlowResetKey`:

```typescript
// In HydroscopeCore.tsx
const [reactFlowResetKey, setReactFlowResetKey] = useState(0);

// Exposed via useImperativeHandle
forceReactFlowRemount: () => {
  setReactFlowResetKey((prev) => prev + 1);
}

// Used as key prop on ReactFlow component
<ReactFlow key={reactFlowResetKey} ... />
```

**Hydroscope** calls the utility when toggling full node labels:

```typescript
// In Hydroscope.tsx
const reallocateBridges = useCallback(() => {
  const result = resetAllBridges({
    algorithm: state.layoutAlgorithm,
    asyncCoordinator,
    elkBridgeRef,
    reactFlowBridgeRef: { current: null },
    hydroscopeCoreRef,
  });
  return result;
}, [state.layoutAlgorithm]);
```

**StyleTuner** triggers the reset when checkbox is toggled:

```typescript
// In StyleTuner.tsx
onChange={(e) => {
  const enabled = e.target.checked;
  
  // Update dimensions in VisualizationState
  if (enabled) {
    _visualizationState.expandAllNodeLabelsToLong();
    _visualizationState.updateNodeDimensionsForFullLabels(true);
  } else {
    _visualizationState.resetAllNodeLabelsToShort();
    _visualizationState.updateNodeDimensionsForFullLabels(false);
  }
  
  // Reset all 4 layers
  if (onReallocateBridges) {
    const instances = onReallocateBridges();
    if (instances) {
      // Run full layout pipeline with fresh instances
      instances.asyncCoordinator.executeLayoutAndRenderPipeline(
        instances.visualizationState,
        { relayoutEntities: undefined, fitView: false }
      );
    }
  }
}}
```

## Flow Diagram

```
User toggles "Show full node labels"
  ↓
StyleTuner updates VisualizationState dimensions
  ↓
StyleTuner calls onReallocateBridges()
  ↓
Hydroscope.reallocateBridges() calls resetAllBridges()
  ↓
┌──────────────────────────────────────────────┐
│ resetAllBridges() performs bridge reset:    │
├──────────────────────────────────────────────┤
│ 1. Create new ELK Bridge                    │
│    └─> Creates new ELK instance internally  │
│ 2. Create new ReactFlow Bridge              │
│ 3. Update AsyncCoordinator with new bridges │
│ 4. Return forceRemount() function           │
└──────────────────────────────────────────────┘
  ↓
StyleTuner calls AsyncCoordinator.executeLayoutAndRenderWithRemount()
  ↓
┌──────────────────────────────────────────────────────────┐
│ AsyncCoordinator.executeLayoutAndRenderWithRemount():   │
├──────────────────────────────────────────────────────────┤
│ 1. Execute layout and render pipeline                   │
│    └─> ELK calculates new positions                     │
│    └─> ReactFlowBridge generates new data               │
│    └─> onReactFlowDataUpdate callback triggered         │
│                                                          │
│ 2. Wait for React render to complete                    │
│    └─> Uses post-render callback mechanism              │
│    └─> Ensures state.reactFlowData has fresh data       │
│                                                          │
│ 3. Call forceRemount() callback                         │
│    └─> Increments reactFlowResetKey                     │
│    └─> React sees key change on <ReactFlow>             │
│    └─> ReactFlow component completely remounts          │
│    └─> Fresh component with fresh data                  │
│    └─> Edge handles calculated correctly                │
└──────────────────────────────────────────────────────────┘
  ↓
✅ Edges positioned correctly for new node dimensions
```

## Critical Timing

The key insight is that **ReactFlow must remount AFTER React has rendered the new data**, not before:

### Why File Load Works
- React sees `data` prop change
- Entire component tree re-renders naturally
- ReactFlow gets fresh data automatically
- ✅ Edges positioned correctly

### Why Label Toggle Was Broken
- No prop changes, so no natural re-render
- We were calling `forceRemount()` immediately after pipeline promise resolved
- But the data update callback has a 50ms throttle
- ReactFlow remounted with **stale data**
- ❌ Edge handles calculated from old positions

### The Solution
`AsyncCoordinator.executeLayoutAndRenderWithRemount()` manages the complete sequence:

1. **Execute pipeline** - generates new data
2. **Wait for React render** - uses post-render callback to ensure data is in state
3. **Force remount** - ReactFlow remounts with fresh data

This ensures ReactFlow always remounts with the correct data, which is critical for edge handle positioning.

## Key Benefits

1. **Complete State Reset** - No stale state in any layer
2. **Proper Edge Handles** - ReactFlow recalculates all edge connection points
3. **Reusable Utilities** - Can be used for other features that need clean resets
4. **Clear Separation** - Each utility function has a single responsibility
5. **Type Safety** - Full TypeScript support with proper interfaces

## When to Use

Use `resetAllBridges()` when:
- Toggling features that change node dimensions (like "Show full node labels")
- Switching layout algorithms that require clean state
- Recovering from edge positioning bugs
- Any operation that needs a complete clean slate

Use individual reset functions (`resetELKBridge` or `resetReactFlowBridge`) when:
- Only one layer needs to be reset
- Performance optimization is critical
- You have specific requirements for partial resets
