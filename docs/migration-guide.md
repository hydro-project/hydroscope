# Migration Guide: InfoPanel and StyleTuner Extraction

This guide helps you migrate from embedded InfoPanel and StyleTuner implementations to the new standalone components.

## Overview

The InfoPanel and StyleTuner components have been extracted from HydroscopeEnhanced into standalone, reusable components. This extraction provides:

- Better separation of concerns
- Improved testability
- Enhanced reusability
- Cleaner architecture with v6 integration
- Better error handling and resilience

## Migration Paths

### 1. From HydroscopeEnhanced (Recommended)

If you're currently using HydroscopeEnhanced, you have two options:

#### Option A: Continue using HydroscopeEnhanced (No Changes Required)

HydroscopeEnhanced has been updated internally to use the extracted components, but maintains the same public API. Your existing code will continue to work without any changes.

```tsx
// This continues to work exactly as before
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

function MyComponent() {
  return (
    <HydroscopeEnhanced
      data={data}
      height="100vh"
      // All existing props work the same
    />
  );
}
```

#### Option B: Migrate to New Hydroscope Component (Recommended for New Projects)

For new projects or when you want the cleanest architecture, use the new Hydroscope component:

```tsx
// Before
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

function OldComponent() {
  return (
    <HydroscopeEnhanced
      data={data}
      height="100vh"
      showInfoPanel={true}
      showStylePanel={true}
    />
  );
}

// After
import { Hydroscope } from '@hydro-project/hydroscope';

function NewComponent() {
  return (
    <Hydroscope
      data={data}
      height="100vh"
      showInfoPanel={true}
      showStylePanel={true}
      onFileUpload={(data, filename) => {
        console.log(`Loaded: ${filename}`);
      }}
      onConfigChange={(config) => {
        console.log('Config changed:', config);
      }}
    />
  );
}
```

### 2. From Main Branch Hydroscope

If you're migrating from the main branch Hydroscope component:

```tsx
// Before (Main Branch)
import { Hydroscope } from '@hydro-project/hydroscope';

function MainBranchComponent() {
  return (
    <Hydroscope
      data={data}
      onNodeClick={handleNodeClick}
      // May experience architectural bugs
    />
  );
}

// After (New Clean Implementation)
import { Hydroscope } from '@hydro-project/hydroscope';

function CleanComponent() {
  return (
    <Hydroscope
      data={data}
      onNodeClick={(event, node, visualizationState) => {
        // Enhanced callback with visualizationState
        handleNodeClick(event, node, visualizationState);
      }}
      onContainerCollapse={(containerId, visualizationState) => {
        console.log(`Container ${containerId} collapsed`);
      }}
      onContainerExpand={(containerId, visualizationState) => {
        console.log(`Container ${containerId} expanded`);
      }}
      // No architectural bugs, proper v6 integration
    />
  );
}
```

### 3. Using Standalone Components

If you want to use InfoPanel and StyleTuner as standalone components in your own layout:

```tsx
import React, { useState } from 'react';
import { 
  InfoPanel, 
  StyleTuner, 
  VisualizationState,
  StyleConfig 
} from '@hydro-project/hydroscope';

function CustomLayoutComponent() {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [stylePanelOpen, setStylePanelOpen] = useState(true);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({});

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Your custom visualization area */}
      <div style={{ flex: 1 }}>
        {/* Your ReactFlow or other visualization */}
      </div>
      
      {/* Standalone panels */}
      <div style={{ width: '300px' }}>
        <InfoPanel
          visualizationState={visualizationState}
          open={infoPanelOpen}
          onOpenChange={setInfoPanelOpen}
          onSearchUpdate={(query, matches, current) => {
            console.log(`Search: ${query}, ${matches.length} matches`);
          }}
        />
        
        <StyleTuner
          value={styleConfig}
          onChange={setStyleConfig}
          open={stylePanelOpen}
          onOpenChange={setStylePanelOpen}
          onLayoutChange={(layout) => {
            console.log(`Layout changed to: ${layout}`);
          }}
        />
      </div>
    </div>
  );
}
```

## Breaking Changes

### None for HydroscopeEnhanced Users

If you're using HydroscopeEnhanced, there are **no breaking changes**. The component maintains full backward compatibility.

### For Direct Component Usage

If you were somehow using internal InfoPanel or StyleTuner implementations directly (which was not officially supported), you'll need to:

1. Update import paths to use the new standalone components
2. Update prop interfaces to match the new clean interfaces
3. Handle panel visibility state in your parent component
4. Update callback signatures to match new interfaces

## New Features Available After Migration

### Enhanced Error Handling

```tsx
<Hydroscope
  data={data}
  onFileUpload={(data, filename) => {
    try {
      // Process data
      console.log(`Loaded: ${filename}`);
    } catch (error) {
      console.error('File processing failed:', error);
    }
  }}
  // Components now have built-in error boundaries
/>
```

### V6 Architecture Integration

```tsx
// Access to VisualizationState in callbacks
<Hydroscope
  data={data}
  onNodeClick={(event, node, visualizationState) => {
    if (visualizationState) {
      // Use v6 architecture features
      const nodeData = visualizationState.getNode(node.id);
      console.log('Full node data:', nodeData);
    }
  }}
/>
```

### Improved Settings Persistence

```tsx
// Settings are now automatically persisted to localStorage
// with proper error handling
<Hydroscope
  data={data}
  initialLayoutAlgorithm="layered"
  initialColorPalette="Set2"
  // Settings will be remembered across sessions
/>
```

### Better Performance

```tsx
// Components now use React.memo and optimized rendering
// No performance degradation compared to embedded implementation
<InfoPanel
  visualizationState={visualizationState}
  open={true}
  onOpenChange={() => {}}
  // Optimized re-rendering
/>
```

## Migration Checklist

### For HydroscopeEnhanced Users

- [ ] **No action required** - your code continues to work
- [ ] Consider migrating to new Hydroscope component for new projects
- [ ] Update any custom styling that relied on internal component structure
- [ ] Test that all functionality works as expected

### For Main Branch Users

- [ ] Update import to use new Hydroscope component
- [ ] Update callback signatures to handle new parameters
- [ ] Add error handling for new error callback patterns
- [ ] Test container operations work correctly
- [ ] Verify settings persistence works as expected

### For Custom Integration Users

- [ ] Update imports to use standalone InfoPanel and StyleTuner
- [ ] Update prop interfaces to match new component APIs
- [ ] Implement panel visibility state management
- [ ] Update callback signatures
- [ ] Add error handling
- [ ] Test v6 architecture integration

## Common Issues and Solutions

### Issue: "Component not found" errors

**Solution**: Make sure you're importing from the correct path:

```tsx
// Correct
import { InfoPanel, StyleTuner, Hydroscope } from '@hydro-project/hydroscope';

// Also correct (more specific)
import { InfoPanel } from '@hydro-project/hydroscope/components/panels';
```

### Issue: TypeScript errors about missing props

**Solution**: Check the new prop interfaces and update your usage:

```tsx
// Old (may not work)
<InfoPanel someOldProp={value} />

// New (correct)
<InfoPanel
  visualizationState={visualizationState}
  open={true}
  onOpenChange={() => {}}
/>
```

### Issue: Settings not persisting

**Solution**: The new components use different localStorage keys. Old settings won't automatically migrate, but new settings will persist correctly.

### Issue: Performance issues

**Solution**: Make sure you're using the components correctly with proper memoization:

```tsx
// Use React.memo for parent components if needed
const MyComponent = React.memo(() => {
  return (
    <InfoPanel
      visualizationState={visualizationState}
      // ... other props
    />
  );
});
```

## Support and Help

If you encounter issues during migration:

1. Check the [Component Usage Examples](./component-usage-examples.md) for detailed examples
2. Review the TypeScript interfaces for correct prop usage
3. Check the browser console for error messages and warnings
4. Ensure you're using the latest version of the package

## Timeline

- **Phase 1** (Current): Backward compatible extraction - HydroscopeEnhanced continues to work
- **Phase 2** (Future): Deprecation warnings for old patterns
- **Phase 3** (Future): Full migration to new architecture

You can migrate at your own pace, with full backward compatibility maintained throughout the process.