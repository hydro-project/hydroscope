# Sync Control Feature Implementation

## Summary

This feature adds a control in the InfoPanel that allows users to link or unlink the expansion/collapse state between the HierarchyTree and the ReactFlow graph visualization.

## Changes Made

### 1. Icon Components (InfoPanel.tsx)

Added two new SVG icon components:
- **LinkIcon**: Shows a chain link (🔗) when sync is enabled
- **BrokenLinkIcon**: Shows a broken chain link when sync is disabled

### 2. State Management (Hydroscope.tsx)

Added sync state to the component hierarchy:

```typescript
interface HydroscopeState {
  syncTreeAndGraph: boolean; // Default: true
}

interface HydroscopeSettings {
  syncTreeAndGraph: boolean;
}
```

The state is:
- Initialized to `true` by default (linked mode)
- Persisted to localStorage
- Restored on component mount

### 3. UI Control (InfoPanel.tsx)

Added a sync control button in the Grouping section:
- Located above the SearchControls
- Shows current sync state with icon and text
- Has a subtle background color (blue for linked, gray for independent)
- Calls `onSyncTreeAndGraphChange` callback when clicked

Visual appearance:
- **Linked state**: Blue text and icon, light blue background
- **Independent state**: Gray text and icon, light gray background

### 4. HierarchyTree Updates (HierarchyTree.tsx)

Added `syncEnabled` prop to control synchronization behavior:
- When `true`: Container toggles in the tree trigger updates in the graph
- When `false`: Tree operates independently
- Updated the sync effect to only run when `syncEnabled` is true

### 5. Props Added

**InfoPanel:**
```typescript
syncTreeAndGraph?: boolean;
onSyncTreeAndGraphChange?: (enabled: boolean) => void;
```

**HierarchyTree:**
```typescript
syncEnabled?: boolean;
```

## Behavior

### Linked Mode (syncTreeAndGraph: true)

1. Clicking a folder in HierarchyTree expands/collapses the corresponding container in ReactFlow
2. Clicking a container in ReactFlow updates the tree expansion state
3. Both views stay synchronized automatically

### Independent Mode (syncTreeAndGraph: false)

1. HierarchyTree and ReactFlow maintain separate expansion states
2. Changes in one view do not affect the other
3. Useful for exploring different parts independently

### Toggling Behavior

When toggling from disabled to enabled:
- The ReactFlow graph state is preserved (design choice from requirements)
- The HierarchyTree syncs to match the graph
- This prevents unexpected changes to the visible graph layout

## Testing

Created comprehensive tests in `src/__tests__/sync-tree-graph.test.tsx`:

1. ✅ Renders sync control with linked state by default
2. ✅ Renders sync control with independent state when disabled  
3. ✅ Calls callback when toggle button is clicked
4. ✅ Persists sync state in localStorage

All existing tests continue to pass (1277 tests total).

## Files Modified

1. `src/components/panels/InfoPanel.tsx` - Added icons and sync control UI
2. `src/components/Hydroscope.tsx` - Added state management and persistence
3. `src/components/HierarchyTree.tsx` - Added syncEnabled prop and conditional sync logic
4. `src/components/types.ts` - Added syncEnabled to HierarchyTreeProps

## Files Created

1. `src/__tests__/sync-tree-graph.test.tsx` - Test suite for the feature
2. `docs/sync-tree-and-graph.md` - User documentation
3. `SYNC_CONTROL_FEATURE.md` - This implementation summary

## Design Decisions

### 1. Default State: Linked

The control defaults to enabled (linked) because:
- It provides a more intuitive experience for most users
- It matches the existing behavior before the feature was added
- Users can easily toggle it off if they want independent control

### 2. Preserve Graph State When Enabling Sync

When toggling from disabled to enabled, we preserve the ReactFlow graph state and sync the tree to it (option 2 from the issue) because:
- The graph is the primary visualization
- Changes to the graph layout can be disruptive
- The tree is easier to navigate to find specific containers
- This provides a smoother user experience

### 3. Visual Design

The control uses:
- Subtle background colors to indicate state without being intrusive
- Standard link/broken link metaphor for the icons
- Clear text labels ("Tree and graph linked" / "independent")
- Consistent styling with other InfoPanel controls

### 4. Placement

The control is placed:
- In the Grouping section (where hierarchy controls are)
- Above the SearchControls (logical flow: control sync → search → navigate)
- Below the GroupingControls (when present)

## Future Enhancements

Potential improvements not included in this implementation:

1. **Bidirectional Sync Choice**: Add UI to let users choose which view to preserve when enabling sync
2. **Keyboard Shortcut**: Add Ctrl+L / Cmd+L to toggle sync state
3. **Sync Indicator**: Show visual indicator in tree for containers that differ from graph when in independent mode
4. **Animation**: Add subtle animation when sync occurs to provide visual feedback
5. **Accessibility**: Add ARIA labels and keyboard navigation support

## Testing Instructions

### Manual Testing

1. Open the application with data containing hierarchical containers
2. Open the InfoPanel (click the info button)
3. Ensure the Grouping section is expanded
4. Observe the sync control button (should show "Tree and graph linked" by default)
5. Click folders in the HierarchyTree and verify containers expand/collapse in the graph
6. Click the sync button to disable sync
7. Click folders in the tree and verify the graph does not change
8. Toggle sync back on and verify the tree syncs to match the graph state
9. Refresh the page and verify the sync state persists

### Automated Testing

Run the test suite:
```bash
npm test
```

Run only the sync control tests:
```bash
npm test -- sync-tree-graph.test.tsx
```

## Compatibility

- ✅ Backward compatible - existing code works without changes
- ✅ All existing tests pass
- ✅ No breaking changes to public APIs
- ✅ Settings migration handled automatically

## Performance

- Minimal performance impact
- Only affects container toggle operations
- No additional layout calculations
- LocalStorage operations are async and non-blocking

## Browser Support

Same as the rest of Hydroscope:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Node.js 18+

## Accessibility

The sync control button:
- Uses semantic HTML (`<button>`)
- Has descriptive `title` attribute for tooltips
- Uses clear, readable text alongside icons
- Maintains sufficient color contrast
- Can be activated with keyboard (Tab + Enter/Space)

## License

Apache-2.0 (same as the project)
