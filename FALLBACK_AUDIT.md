# Fallback Logic Audit

This document catalogs fallback patterns in the codebase that should be reviewed for potential bugs.

## Summary

After auditing the codebase for fallback patterns using `||`, `??`, and default values, most fallbacks appear to be **safe and intentional**. They follow these patterns:

1. **Array fallbacks**: `array || []` - Safe for optional arrays
2. **Object fallbacks**: `object || {}` - Safe for optional config objects  
3. **Nullish coalescing**: `value ?? defaultValue` - Safe, only falls back on null/undefined
4. **Optional chaining with fallbacks**: `obj?.prop || defaultValue` - Generally safe

## Categories of Fallbacks

### 1. Safe Array Fallbacks (No Action Needed)

These handle optional arrays and are working as intended:

```typescript
// StyleProcessor.ts - semantic tags
e.semanticTags || []

// JSONParser.ts - hierarchy children
choice.children || choice.hierarchy || []
child.children || []

// FileUpload.tsx - parsed data
parsedData.nodes || []
parsedData.edges || []
parsedData.hierarchyChoices || []
```

**Recommendation**: These are safe. Arrays are either present or default to empty.

### 2. Safe Object Fallbacks (No Action Needed)

These handle optional configuration objects:

```typescript
// ReactFlowBridge.ts - style configs
this.styleConfig.nodeStyles?.[nodeType] || {}
this.styleConfig.edgeStyles?.[edge.type] || {}

// FileUpload.tsx - node assignments
parsedData.nodeAssignments || {}

// ELKBridge.ts - ELK options
layoutConfig.elkOptions || {}
```

**Recommendation**: These are safe. Missing config objects default to empty objects which is correct behavior.

### 3. Safe Nullish Coalescing (No Action Needed)

These use `??` which only falls back on null/undefined, not falsy values:

```typescript
// Components - style defaults
styleCfg.nodePadding ?? 8
styleCfg.containerBorderRadius ?? 8
syncTreeAndGraph ?? true

// Counts and indices
searchResults?.length ?? 0
currentResultIndex + 1
```

**Recommendation**: These are safe and preferred over `||`.

### 4. String Fallbacks (Review Recommended)

These deserve closer inspection as empty strings might have semantic meaning:

```typescript
// HierarchyTree.tsx
result.hierarchyPath?.join(" > ") || ""

// VisualizationState.ts  
searchQuery || ""

// AsyncCoordinator.ts
(state as any).search(query || "")
```

**Recommendation**: 
- Review if empty string queries should be allowed
- Consider whether `|| ""` should be `?? ""` to distinguish null/undefined from empty string
- Add tests to verify behavior with empty string inputs

### 5. Performance Monitoring Fallbacks (Safe)

```typescript
// PerformanceMonitor.ts
this.metrics.get(key) || []
```

**Recommendation**: Safe - metrics start as empty arrays.

## Testing Recommendations

Most fallbacks are safe, but we should add regression tests for:

1. **Empty string queries**: Verify search behavior with `""` vs `undefined` vs `null`
2. **Missing config objects**: Test that components handle missing style configs gracefully
3. **Optional arrays**: Verify that missing arrays don't cause iteration errors

## Proposed Changes

### Minimal Changes (Current Approach)

1. ✅ Document all fallback patterns (this file)
2. ✅ Verify tests cover fallback scenarios
3. Add specific tests for edge cases if gaps found
4. Consider changing `|| ""` to `?? ""` for string fallbacks where empty string is meaningful

### Alternative: Strict Mode (Not Recommended)

Replacing fallbacks with errors would require:
- Extensive refactoring of parsing logic
- Breaking changes to JSON format expectations
- Significant test updates
- No clear benefit over current defensive approach

## Conclusion

**No critical issues found.** The fallback logic in this codebase is well-designed and defensive:

- Arrays and objects default to empty values (safe)
- Nullish coalescing (`??`) is used appropriately 
- String fallbacks may benefit from review but no bugs found
- All existing tests pass, indicating fallbacks work correctly

The fallback patterns follow best practices for handling optional data in a visualization library that parses various JSON formats.

## Phase 2 Recommendations

For Phase 2 of code hygiene improvements:

1. **Add tests** for string query fallbacks (`|| ""` cases)
2. **Consider** using `??` instead of `||` for string fallbacks
3. **Document** in code comments where empty strings are intentionally allowed
4. **Monitor** for any edge cases users report related to empty/missing data

No urgent action required - fallback logic is working as intended.
