# UI Scaling for Hydroscope

## Overview

Hydroscope now supports scaling the UI panels (InfoPanel, StyleTuner, and toggle buttons) to better fit constrained spaces like IDE extensions.

## Usage

Add the `uiScale` prop to the `Hydroscope` component:

```tsx
<Hydroscope
  data={graphData}
  uiScale={0.85}  // Scale panels to 85% of original size
  // ... other props
/>
```

## Scale Values

- **1.0** (default): Full size panels - ideal for standalone web applications
- **0.85**: Recommended for IDE extensions - provides better fit in limited space
- **0.7-0.9**: Acceptable range for most use cases
- **< 0.7**: Not recommended - text becomes too small to read comfortably

## What Gets Scaled

The `uiScale` prop applies CSS `transform: scale()` to:

1. **InfoPanel** - The information and hierarchy panel on the right
2. **StyleTuner** - The style configuration panel on the right
3. **Panel Toggle Buttons** - The buttons in the top-right corner

The transform origin is set to `top right` to ensure panels scale from their anchor point.

## What Doesn't Get Scaled

- The main ReactFlow graph visualization
- ReactFlow controls (zoom, fit view, etc.)
- The minimap
- Background patterns

## Implementation Details

The scaling is applied using CSS transforms:

```tsx
<div
  style={{
    transform: `scale(${uiScale})`,
    transformOrigin: "top right",
  }}
>
  {/* Panel content */}
</div>
```

This approach:
- Maintains all interactive functionality
- Preserves layout calculations
- Doesn't affect ReactFlow's internal coordinate system
- Works consistently across browsers

## Example: IDE Integration

```tsx
// hydro-ide/webview/index.tsx
<Hydroscope
  data={graphData}
  showFileUpload={false}
  showInfoPanel={true}
  showStylePanel={true}
  responsive={true}
  uiScale={0.85}  // Scale down for IDE
/>
```

## Notes

- The scaling is purely visual - all click targets and interactions work normally
- Font sizes in the panels are already optimized for readability
- If you need more aggressive scaling, consider also adjusting `PANEL_CONSTANTS` in `hydroscope/src/shared/config/ui.ts`
