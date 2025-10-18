# Edge Styling Implementation Plan

## Overview
This document outlines the minimal implementation needed to restore edge styling features lost during the v6 rewrite, including double lines, wavy lines, and other special rendering effects.

## Current State Analysis

### What Works
- ✅ `StyleProcessor` correctly computes `lineStyle: "double"` from semantic tags
- ✅ `ProcessedStyle` interface includes `lineStyle` property
- ✅ Basic edge rendering with strokeDasharray patterns
- ✅ Edge animations
- ✅ Edge colors and widths

### What's Broken
- ❌ Double-line edges render as single lines with workaround strokeDasharray
- ❌ No visual distinction between single and double line styles
- ❌ Wavy lines not supported (old code had `getWavyPath`, `isWavyEdge`)
- ❌ Special rendering effects require custom edge component

### Root Cause
- `ReactFlowBridge` passes `lineStyle` to edge data ✅ (recently fixed)
- No custom edge component registered in `HydroscopeCore`
- Default ReactFlow edges cannot render special effects

## Supported Edge Styles

Based on old code analysis and current config:

### 1. Line Styles (structural)
- **single**: One line (default)
- **double**: Two parallel lines (for keyed streams)

### 2. Line Patterns (strokeDasharray)
- **solid**: Continuous line
- **dashed**: Dashed pattern (8,4)
- **dotted**: Dotted pattern (2,2)
- **dash-dot**: Combined pattern (future)

### 3. Special Effects
- **wavy**: Sine wave path (for cycles/feedback loops)
- **animated**: Flowing animation along path
- **halo**: Colored glow around edge (light-blue, light-red, light-green)

## Implementation Plan

### Phase 1: Core Infrastructure (MINIMAL - ~30 lines)

#### 1.1 Create CustomEdge Component
**File**: `src/render/CustomEdge.tsx` (NEW)

```tsx
import { BaseEdge, EdgeProps, getStraightPath } from '@xyflow/react';
import { memo } from 'react';

/**
 * Custom edge component supporting double lines and special effects
 * Minimal implementation - just enough to fix double-line rendering
 */
export const CustomEdge = memo(function CustomEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style, data } = props;
  
  // Get edge path
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  
  // Check if double-line rendering is needed
  const lineStyle = (data as any)?.lineStyle;
  const isDouble = lineStyle === 'double';
  
  if (!isDouble) {
    // Single line - use default rendering
    return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;
  }
  
  // Double line - render three BaseEdge components
  // Technique: CSS transform to offset parallel lines by ±2px
  const { stroke, strokeWidth, strokeDasharray } = style || {};
  
  return (
    <g>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth, strokeDasharray }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={undefined}
        style={{ 
          stroke, 
          strokeWidth, 
          strokeDasharray,
          transform: 'translate(0, -2px)'
        }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={undefined}
        style={{ 
          stroke, 
          strokeWidth, 
          strokeDasharray,
          transform: 'translate(0, 2px)'
        }}
      />
    </g>
  );
});
```

**Lines**: ~50 (including comments and formatting)

#### 1.2 Register CustomEdge in HydroscopeCore
**File**: `src/components/HydroscopeCore.tsx`

Add near other useMemo hooks:
```tsx
const edgeTypes = useMemo(() => ({ default: CustomEdge }), []);
```

Add to ReactFlow component:
```tsx
<ReactFlow
  // ... existing props ...
  edgeTypes={edgeTypes}
/>
```

**Lines**: ~3

#### 1.3 Remove Workaround from StyleProcessor
**File**: `src/utils/StyleProcessor.ts`

Remove lines 349-350:
```typescript
// REMOVE THIS:
style.strokeDasharray = "10,2,2,2"; // Workaround - should be removed
```

**Lines**: -1

**Phase 1 Total**: ~52 lines (50 new, 3 modified, -1 removed)

### Phase 2: Enhanced Path Rendering (OPTIONAL - ~80 lines)

Only implement if wavy lines are actually used in data files.

#### 2.1 Add Path Type Detection
**File**: `src/render/CustomEdge.tsx`

Extend to support:
- Bezier paths (curved edges)
- Smooth step paths
- Straight paths (current default)

```tsx
// Add path type selection based on edge data or global config
const pathType = (data as any)?.pathType || 'straight';
let edgePath: string;

if (pathType === 'bezier') {
  [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });
} else if (pathType === 'smoothstep') {
  [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });
} else {
  [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
}
```

**Lines**: ~15

#### 2.2 Add Wavy Path Support
**File**: `src/render/CustomEdge.tsx`

Add wavy path generator (extracted from old code concept):

```tsx
/**
 * Generate a wavy path using SVG path commands
 * Creates a sine wave between source and target points
 */
function getWavyPath(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  amplitude?: number;
  frequency?: number;
}): string {
  const { sourceX, sourceY, targetX, targetY, amplitude = 8, frequency = 4 } = params;
  
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Number of wave cycles
  const cycles = Math.floor(distance / (100 / frequency));
  const segmentLength = distance / (cycles * 4); // 4 segments per cycle
  
  // Build SVG path with quadratic curves to approximate sine wave
  let path = `M ${sourceX} ${sourceY}`;
  
  for (let i = 0; i < cycles; i++) {
    const x1 = sourceX + dx * ((i * 4 + 1) * segmentLength / distance);
    const y1 = sourceY + dy * ((i * 4 + 1) * segmentLength / distance);
    const x2 = sourceX + dx * ((i * 4 + 2) * segmentLength / distance);
    const y2 = sourceY + dy * ((i * 4 + 2) * segmentLength / distance);
    const x3 = sourceX + dx * ((i * 4 + 3) * segmentLength / distance);
    const y3 = sourceY + dy * ((i * 4 + 3) * segmentLength / distance);
    const x4 = sourceX + dx * ((i * 4 + 4) * segmentLength / distance);
    const y4 = sourceY + dy * ((i * 4 + 4) * segmentLength / distance);
    
    // Calculate perpendicular offset for wave
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;
    
    // Add wave segments
    path += ` Q ${x1 + Math.cos(perpAngle) * amplitude} ${y1 + Math.sin(perpAngle) * amplitude} ${x2} ${y2}`;
    path += ` Q ${x3 - Math.cos(perpAngle) * amplitude} ${y3 - Math.sin(perpAngle) * amplitude} ${x4} ${y4}`;
  }
  
  return path;
}
```

**Lines**: ~45

Add wavy detection in CustomEdge:
```tsx
// Check for wavy style
const isWavy = (data as any)?.waviness || (style as any)?.waviness;

if (isWavy) {
  edgePath = getWavyPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    amplitude: 8,
    frequency: 4
  });
}
```

**Lines**: ~10

#### 2.3 Update StyleProcessor for Wavy Lines
**File**: `src/utils/StyleProcessor.ts`

Add to EDGE_VISUAL_CHANNELS:
```typescript
const EDGE_VISUAL_CHANNELS = {
  "line-style": ["single", "double"],
  "line-pattern": ["solid", "dashed", "dotted"],
  "waviness": [false, true],  // NEW
};
```

Add to ProcessedStyle interface:
```typescript
export interface ProcessedStyle {
  // ... existing properties ...
  lineStyle?: "single" | "double";
  waviness?: boolean;  // NEW
}
```

Add processing logic:
```typescript
// Apply waviness
const wavinessSetting = styleSettings["waviness"] as boolean;
if (wavinessSetting) {
  // Don't set strokeDasharray - wavy rendering is handled by CustomEdge
}
```

**Lines**: ~10

**Phase 2 Total**: ~80 lines

### Phase 3: Advanced Features (FUTURE - NOT RECOMMENDED)

These features were in old code but may be over-engineered:

#### 3.1 Edge Halos
- Colored glow effects around edges
- Implementation: Multiple BaseEdge components with blur filters
- Complexity: ~50 lines
- **Recommendation**: Skip unless specifically requested

#### 3.2 Multiple Line Patterns
- dash-dot combinations
- Custom dash patterns
- Complexity: ~20 lines
- **Recommendation**: Current strokeDasharray support is sufficient

#### 3.3 Edge Filters
- Edge-specific CSS filters
- Visual effects like blur, brightness
- Complexity: ~30 lines
- **Recommendation**: Skip - React Flow doesn't need this

## Testing Strategy

### Test Data Files
1. **chat2.json**: Contains KeyedStream edges with "line-style": "double"
2. **paxos.json**: May contain cycle edges that could use wavy lines
3. Create test file with all edge styles for validation

### Test Cases

#### Phase 1 (Double Lines)
1. ✅ Load chat2.json
2. ✅ Verify KeyedStream edges render as double lines (two parallel lines)
3. ✅ Verify strokeDasharray workaround is removed
4. ✅ Verify edge colors/widths still work
5. ✅ Verify single-line edges still render correctly

#### Phase 2 (Wavy Lines) - If Implemented
1. Create test data with waviness semantic tag
2. Verify wavy path renders correctly
3. Verify wavy lines work with double-line style
4. Verify performance is acceptable

## Migration Notes

### Breaking Changes
- None - this is pure addition of missing functionality

### Backward Compatibility
- Single-line edges continue to work (no change)
- strokeDasharray patterns preserved
- Edge animations preserved
- Color/width styling preserved

### Performance Considerations
- Phase 1: Negligible impact (simple CSS transform)
- Phase 2: Small impact (path calculation)
  - Wavy path generation is O(distance) per edge
  - Should be fast for typical graphs (<1000 edges)
  - Consider memoization if performance issues

## Implementation Order

### Recommended: Phase 1 Only
**Effort**: 30 minutes  
**Risk**: Very low  
**Benefit**: Fixes immediate bug (double lines not rendering)

Steps:
1. Create CustomEdge.tsx
2. Register in HydroscopeCore.tsx
3. Remove workaround from StyleProcessor.ts
4. Test with chat2.json
5. Commit

### Optional: Add Phase 2 Later
**Effort**: 2 hours  
**Risk**: Medium (path generation complexity)  
**Benefit**: Enables wavy line rendering

**Only proceed if**:
- User data actually uses wavy lines
- Visual distinction is needed for cycles
- Performance is validated

## Success Criteria

### Phase 1 Success
- [ ] chat2.json KeyedStream edges render as two parallel lines
- [ ] Single-line edges render correctly (no regression)
- [ ] No visual artifacts or rendering glitches
- [ ] Edge colors and animations still work
- [ ] No console errors or warnings

### Phase 2 Success (if implemented)
- [ ] Wavy edges render smooth sine wave paths
- [ ] Wavy + double-line combination works
- [ ] Performance acceptable (<100ms render for 1000 edges)
- [ ] No memory leaks

## Code Quality Standards

### Minimal Implementation Principles
1. **No over-engineering**: Solve only the current problem
2. **No premature optimization**: Add features only when needed
3. **No code duplication**: Extract helpers only when used 3+ times
4. **No complex abstractions**: Keep it simple and readable

### What to AVOID from Old Code
- ❌ Separate `edgeStyle.ts` utility file (inline helpers instead)
- ❌ Complex `EdgeStyleProcessor` with 300+ lines (use StyleProcessor)
- ❌ Multiple edge component variants (one CustomEdge is enough)
- ❌ Filter-based styling system (use semantic tags)
- ❌ EdgeStyleLegend component (use existing legend)

### What to EXTRACT from Old Code
- ✅ CSS transform technique for double lines (lines 124-135)
- ✅ isDoubleLineEdge logic (inline in CustomEdge)
- ✅ Wavy path concept (if needed in Phase 2)

## References

### Old Code Locations
- `/tmp/old_StandardEdge.tsx`: Lines 71, 124-135 (double line rendering)
- `/tmp/old_edgeStyle.ts`: Lines 65-68 (isDoubleLineEdge helper)
- `/tmp/old_EdgeStyleProcessor.ts`: EDGE_VISUAL_CHANNELS definition

### Current Code Locations
- `src/utils/StyleProcessor.ts`: Line 346-349 (lineStyle processing)
- `src/bridges/ReactFlowBridge.ts`: Line 1004 (lineStyle passed to edges)
- `src/shared/config.ts`: Lines 186-240 (edge style definitions)

### Git History
- v6 merge: commit 3adcf92 (Oct 16, 2025)
- Clean slate: commit c6b477b (Sep 23, 2025)
- Working code: commit 33b0962 (before clean slate)

## Conclusion

**Start with Phase 1** - it's minimal, low-risk, and solves the immediate problem.

**Consider Phase 2** only if:
1. User data contains wavy edges
2. Visual distinction is valuable
3. Performance is validated

**Skip Phase 3** unless explicitly requested - it's over-engineered for current needs.

Total implementation: **~50 lines for Phase 1**, **~130 lines if adding Phase 2**.
