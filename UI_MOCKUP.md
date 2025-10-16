# Sync Control UI Mockup

## Visual Appearance

The sync control appears in the InfoPanel's Grouping section, right above the search controls.

```
┌─────────────────────────────────────────┐
│  Graph Info                          × │
├─────────────────────────────────────────┤
│  ▼ Grouping                            │
│  ┌───────────────────────────────────┐ │
│  │ [Dropdown: Select Grouping]      │ │
│  └───────────────────────────────────┘ │
│                                        │
│  ┌───────────────────────────────────┐ │
│  │ 🔗  Tree and graph linked        │ │  ← SYNC CONTROL (Linked)
│  └───────────────────────────────────┘ │
│                                        │
│  ┌───────────────────────────────────┐ │
│  │ 🔍 Search nodes and containers...│ │
│  └───────────────────────────────────┘ │
│                                        │
│  Container Hierarchy                  │
│  ├─ 📁 Runtime                        │
│  ├─ 📁 Proposer                       │
│  └─ 📁 Acceptor                       │
└─────────────────────────────────────────┘
```

### When Linked (Default State)

```
┌─────────────────────────────────────────┐
│ 🔗  Tree and graph linked              │
└─────────────────────────────────────────┘
  ↑                      ↑
  Blue icon           Blue text
  Light blue background (#3b82f6 @ 5% opacity)
  Blue border (#3b82f6 @ 20% opacity)
```

**Tooltip**: "Tree and graph are synced - click to unlink"

### When Independent

```
┌─────────────────────────────────────────┐
│ ⛓️‍💥  Tree and graph independent       │
└─────────────────────────────────────────┘
  ↑                      ↑
  Gray icon           Gray text
  Light gray background (#888 @ 5% opacity)
  Gray border (#888 @ 20% opacity)
```

**Tooltip**: "Tree and graph are independent - click to link"

## Icon Details

### Link Icon (When Linked)
```
🔗 SVG chain link with two connected links
   - 16x16px
   - Color: currentColor (inherits blue #3b82f6)
   - Two interlocking chain links
```

### Broken Link Icon (When Independent)
```
⛓️‍💥 SVG broken chain with gap and break lines
   - 16x16px
   - Color: currentColor (inherits gray #888)
   - Two chain links with visible gap
   - Diagonal break lines indicating separation
```

## Interaction Flow

### Scenario 1: Default Usage (Linked)

1. **Initial State**: Control shows "Tree and graph linked" (blue)
2. **User Action**: Clicks folder "Runtime" in tree
3. **Result**: 
   - Tree expands "Runtime" folder
   - Graph expands "Runtime" container
   - Both views stay synchronized

### Scenario 2: Toggle to Independent

1. **Initial State**: Control shows "Tree and graph linked" (blue)
2. **User Action**: Clicks the sync control button
3. **Result**:
   - Button changes to "Tree and graph independent" (gray)
   - State saved to localStorage
   - Future tree clicks don't affect graph
   - Future graph container clicks don't affect tree

### Scenario 3: Toggle Back to Linked

1. **Initial State**: Control shows "Tree and graph independent" (gray)
2. **Current States**:
   - Tree: Runtime expanded, Proposer collapsed
   - Graph: Runtime collapsed, Proposer expanded
3. **User Action**: Clicks the sync control button
4. **Result**:
   - Button changes to "Tree and graph linked" (blue)
   - Tree automatically syncs to match graph state
   - Tree updates to: Runtime collapsed, Proposer expanded
   - Graph state is preserved (unchanged)
   - Both views are now in sync

## Context in Full InfoPanel

```
┌─────────────────────────────────────────┐
│  Graph Info                          × │
├─────────────────────────────────────────┤
│  ▼ Grouping                            │
│     [Select Grouping ▼]               │
│                                        │
│     ┌───────────────────────────────┐ │
│     │ 🔗  Tree and graph linked    │ │ ← SYNC CONTROL
│     └───────────────────────────────┘ │
│                                        │
│     [🔍 Search...]                    │
│                                        │
│     Container Hierarchy               │
│     ├─ 📁 Runtime                     │
│     │  ├─ node1                       │
│     │  └─ node2                       │
│     ├─ 📁 Proposer                    │
│     └─ 📁 Acceptor                    │
├─────────────────────────────────────────┤
│  ▶ Edge Styles                        │
├─────────────────────────────────────────┤
│  ▶ Node Types                         │
│     • Input - Blue                    │
│     • Compute - Green                 │
│     • Output - Orange                 │
└─────────────────────────────────────────┘
```

## Responsive Design

The control adapts to different panel widths:

**Wide Panel (300px+)**:
```
┌─────────────────────────────────────┐
│ 🔗  Tree and graph linked          │
└─────────────────────────────────────┘
```

**Narrow Panel (200px-300px)**:
```
┌───────────────────────────┐
│ 🔗  Tree and graph       │
│     linked               │
└───────────────────────────┘
```

The text wraps naturally and the icon remains aligned to the left.

## Color Palette

### Linked State (Enabled)
- Icon: `#3b82f6` (Blue 500)
- Text: `#3b82f6` (Blue 500)
- Background: `rgba(59, 130, 246, 0.05)` (Blue 500 @ 5%)
- Border: `rgba(59, 130, 246, 0.2)` (Blue 500 @ 20%)
- Font Weight: `500` (Medium)

### Independent State (Disabled)
- Icon: `#888` (Gray)
- Text: `#888` (Gray)
- Background: `rgba(128, 128, 128, 0.05)` (Gray @ 5%)
- Border: `rgba(128, 128, 128, 0.2)` (Gray @ 20%)
- Font Weight: `400` (Normal)

## Accessibility Features

1. **Semantic HTML**: Uses `<button>` element
2. **Tooltip**: Descriptive `title` attribute
3. **Clear Text**: Icon + text label (not icon-only)
4. **Color Contrast**: Meets WCAG AA standards
5. **Keyboard Support**: 
   - Tab to focus
   - Enter/Space to activate
   - Visible focus indicator
6. **Screen Reader**: Announces "Tree and graph linked" or "independent"

## Animation (Subtle)

When toggling:
- Background color transitions smoothly (0.18s ease)
- Icon color transitions smoothly (0.18s ease)
- Text color transitions smoothly (0.18s ease)
- No jarring layout shifts

## Edge Cases Handled

1. **No Containers**: Control still renders, ready for future use
2. **Large Hierarchy**: Control remains at top, always accessible
3. **Search Active**: Control remains visible and functional
4. **Panel Collapsed**: Control hidden with panel, state preserved
5. **Multiple Panels**: Each Hydroscope instance maintains its own state

## User Feedback Indicators

### Visual Feedback
- ✅ Color change (blue ↔ gray)
- ✅ Icon change (link ↔ broken link)
- ✅ Text change ("linked" ↔ "independent")
- ✅ Background color change

### Behavioral Feedback
- ✅ Immediate sync when toggling to linked
- ✅ Tree updates to match graph
- ✅ No unexpected changes to graph (preserved)

## Comparison with Similar Controls

The design is consistent with other Hydroscope controls:

### Auto-Fit Toggle (in CustomControls)
- ✅ Icon + background color indicates state
- ✅ Blue when enabled, default when disabled
- ✅ Tooltip explains current state
- ✅ Similar visual language

### Panel Expand/Collapse
- ✅ Icon indicates state (▼ vs ▶)
- ✅ Instant visual feedback
- ✅ Consistent animation timing

This sync control follows the same patterns for a cohesive user experience.
