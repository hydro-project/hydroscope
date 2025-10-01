# Hydroscope Migration Guide

## Overview

This guide helps you migrate from the deprecated `HydroscopeEnhanced` component to the new standalone components (`InfoPanel`, `StyleTuner`, and `Hydroscope`).

## Why Migrate?

The new architecture provides:

- **Better Performance**: React.memo optimization and efficient rendering
- **Cleaner Architecture**: Proper v6 integration without timing bugs
- **Flexibility**: Use components individually or together
- **Better Error Handling**: Graceful degradation and error recovery
- **Improved TypeScript Support**: Better type safety and IntelliSense

## Migration Examples

### Basic Usage

**Before (Deprecated):**
```tsx
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

function MyComponent() {
  return (
    <HydroscopeEnhanced 
      data={graphData}
      enhanced={true}
      height="600px"
      showControls={true}
    />
  );
}
```

**After (Recommended):**
```tsx
import { Hydroscope } from '@hydro-project/hydroscope';

function MyComponent() {
  return (
    <Hydroscope 
      data={graphData}
      showInfoPanel={true}
      showStylePanel={true}
      height="600px"
      showControls={true}
    />
  );
}
```

### Using Standalone Components

**Individual Components:**
```tsx
import { InfoPanel, StyleTuner } from '@hydro-project/hydroscope/panels';
import { HydroscopeCore } from '@hydro-project/hydroscope';

function MyCustomLayout() {
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [visualizationState, setVisualizationState] = useState(null);

  return (
    <div>
      <HydroscopeCore 
        data={graphData}
        onVisualizationStateChange={setVisualizationState}
      />
      
      <InfoPanel
        visualizationState={visualizationState}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
      />
      
      <StyleTuner
        value={styleConfig}
        onChange={setStyleConfig}
        open={stylePanelOpen}
        onOpenChange={setStylePanelOpen}
      />
    </div>
  );
}
```

## Prop Mapping

### HydroscopeEnhanced → Hydroscope

| HydroscopeEnhanced | Hydroscope | Notes |
|-------------------|------------|-------|
| `enhanced={true}` | `showInfoPanel={true} showStylePanel={true}` | Split into separate props |
| `data` | `data` | Same |
| `height` | `height` | Same |
| `width` | `width` | Same |
| `showControls` | `showControls` | Same |
| `showMiniMap` | `showMiniMap` | Same |
| `showBackground` | `showBackground` | Same |
| `responsive` | `responsive` | Same |
| `enableUrlParams` | `enableUrlParams` | Same |

### New Props Available

The new `Hydroscope` component provides additional props:

```tsx
<Hydroscope
  // File upload
  showFileUpload={true}
  onFileUpload={(data, filename) => console.log('File uploaded:', filename)}
  
  // Panel control
  showInfoPanel={true}
  showStylePanel={true}
  showPerformancePanel={false}
  
  // Container operations
  enableCollapse={true}
  onContainerCollapse={(id) => console.log('Container collapsed:', id)}
  onContainerExpand={(id) => console.log('Container expanded:', id)}
  
  // Layout and styling
  initialLayoutAlgorithm="layered"
  initialColorPalette="Set2"
  onConfigChange={(config) => console.log('Config changed:', config)}
  
  // Event handlers
  onNodeClick={(event, node) => console.log('Node clicked:', node)}
/>
```

## Breaking Changes

### None for Basic Usage

The migration maintains full backward compatibility for basic usage. Your existing `HydroscopeEnhanced` code will continue to work without changes.

### Advanced Usage Changes

If you were accessing internal methods or properties:

**Before:**
```tsx
// These internal APIs are no longer available
const ref = useRef<HydroscopeEnhanced>();
ref.current?.toggleInfoPanel();
ref.current?.resetStyles();
```

**After:**
```tsx
// Use controlled props instead
const [infoPanelOpen, setInfoPanelOpen] = useState(false);
const [styleConfig, setStyleConfig] = useState(defaultConfig);

<Hydroscope
  showInfoPanel={infoPanelOpen}
  onInfoPanelToggle={setInfoPanelOpen}
  styleConfig={styleConfig}
  onStyleConfigChange={setStyleConfig}
/>
```

## Gradual Migration Strategy

### Phase 1: Update Imports (No Code Changes)
```tsx
// Keep using HydroscopeEnhanced but update import
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';
// This will show deprecation warnings in development
```

### Phase 2: Switch to New Component
```tsx
// Replace with new component
import { Hydroscope } from '@hydro-project/hydroscope';
// Update props as needed
```

### Phase 3: Optimize with Standalone Components
```tsx
// Use individual components for maximum flexibility
import { InfoPanel, StyleTuner } from '@hydro-project/hydroscope/panels';
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Update prop names according to the mapping table above
2. **Missing Features**: Check if the feature is available in the new component
3. **Styling Issues**: The new components use updated styling - check CSS overrides

### Getting Help

- Check the [API documentation](https://hydro.run/docs/hydroscope/api)
- Review [examples](https://hydro.run/docs/hydroscope/examples)
- Open an issue on [GitHub](https://github.com/hydro-project/hydro/issues)

## Timeline

- **Current**: HydroscopeEnhanced is deprecated but fully supported
- **Next Major Version**: HydroscopeEnhanced will be removed
- **Migration Period**: At least 6 months notice before removal

## Benefits After Migration

After migrating, you'll get:

- ✅ Better performance and memory usage
- ✅ Improved error handling and recovery
- ✅ Access to new features and improvements
- ✅ Better TypeScript support
- ✅ Future-proof architecture
- ✅ Easier testing and debugging