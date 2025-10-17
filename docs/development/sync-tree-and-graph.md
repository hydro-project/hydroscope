# Tree and Graph Synchronization Control

## Overview

The Tree and Graph Synchronization Control allows users to link or unlink the expansion/collapse state between the HierarchyTree panel and the ReactFlow graph visualization. This gives users fine-grained control over how the two views interact.

## Feature Description

### Control Location

The sync control is located in the InfoPanel's "Grouping" section, above the search controls. It appears as a button with either:
- A **chain link icon** (🔗) when sync is **enabled** (linked state)
- A **broken link icon** (⛓️‍💥) when sync is **disabled** (independent state)

### Behavior

#### When Sync is Enabled (Default)

- Expanding/collapsing a container in the HierarchyTree will also expand/collapse it in the ReactFlow graph
- Clicking a container in the ReactFlow graph will expand/collapse it and update the HierarchyTree accordingly
- The two views stay in sync automatically
- Button shows: "Tree and graph linked" with a chain link icon in blue (#3b82f6)

#### When Sync is Disabled

- The HierarchyTree operates independently from the ReactFlow graph
- Expanding/collapsing in the tree does not affect the graph
- Clicking containers in the graph does not affect the tree
- Each view can have its own expansion state
- Button shows: "Tree and graph independent" with a broken link icon in gray (#888)

### Toggling the Control

Click the chain link button to toggle between linked and independent modes. The button's icon and text will update to reflect the current state.

### State Preservation

When toggling from disabled to enabled:
- The ReactFlow graph's state is preserved (used as the source of truth)
- The HierarchyTree automatically syncs to match the graph's current expansion state
- This ensures a smooth transition without unexpected changes to the visible graph

### Settings Persistence

The sync state preference is automatically saved to localStorage and will be restored when you return to the application.

## Implementation Details

### Component Structure

- **Hydroscope**: Manages the sync state and passes it to InfoPanel
- **InfoPanel**: Renders the sync control button and passes syncEnabled to HierarchyTree
- **HierarchyTree**: Respects the syncEnabled prop when handling container toggles

### State Management

The sync state is stored in the Hydroscope component's state:

```typescript
interface HydroscopeState {
  // ... other state
  syncTreeAndGraph: boolean; // Default: true
}
```

And persisted in localStorage as part of the settings:

```typescript
interface HydroscopeSettings {
  // ... other settings
  syncTreeAndGraph: boolean;
}
```

### Props

The following new props have been added:

**InfoPanel:**
- `syncTreeAndGraph?: boolean` - Current sync state (default: true)
- `onSyncTreeAndGraphChange?: (enabled: boolean) => void` - Callback when sync is toggled

**HierarchyTree:**
- `syncEnabled?: boolean` - Whether to sync with the graph (default: true)

## Use Cases

### When to Use Linked Mode (Default)

- General browsing and exploration
- When you want consistent views across both panels
- When demonstrating or presenting the graph structure
- When you want changes in one view to immediately reflect in the other

### When to Use Independent Mode

- When you want to explore different parts of the hierarchy in the tree while keeping the graph focused on a specific area
- When you want to maintain a specific graph layout while navigating the full hierarchy in the tree
- When you're comparing different collapsed states
- When working with complex hierarchies where you want fine-grained control over each view

## Visual Appearance

The sync control has a subtle background color that matches its state:
- **Linked**: Light blue background (rgba(59, 130, 246, 0.05)) with blue border
- **Independent**: Light gray background (rgba(128, 128, 128, 0.05)) with gray border

This provides clear visual feedback about the current sync state without being intrusive.

## Examples

### Example 1: Default Linked Behavior

```typescript
<Hydroscope
  data={myData}
  showInfoPanel={true}
  // syncTreeAndGraph defaults to true
/>
```

### Example 2: Starting with Independent Mode

```typescript
// Set in localStorage before initializing
localStorage.setItem('hydroscope-settings', JSON.stringify({
  syncTreeAndGraph: false,
  // ... other settings
}));

<Hydroscope
  data={myData}
  showInfoPanel={true}
/>
```

## Keyboard Shortcuts

Currently, there are no keyboard shortcuts for toggling sync state. Users must click the button to change the mode.

## Future Enhancements

Possible future improvements:
- Keyboard shortcut for toggling sync (e.g., Ctrl+L or Cmd+L)
- Option to choose which view to preserve when enabling sync (currently always preserves graph state)
- Indicator in the tree showing which containers are out of sync with the graph when in independent mode
- Animation or visual feedback when syncing occurs
