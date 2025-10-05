# Simplified Hydroscope API Examples

The new Hydroscope API provides a clean, focused interface with just the essentials.

## 🎯 Core Components

### HydroscopeCore - Simple Read-Only Display

Perfect for embedding graphs in documentation or dashboards:

```tsx
import { HydroscopeCore } from '@hydro-project/hydroscope';

function MyDashboard() {
  return (
    <HydroscopeCore
      data={graphData}
      height="400px"
      readOnly={true}
      showControls={true}
      showMiniMap={false}
    />
  );
}
```

### Hydroscope - Full Interactive Component

For complete graph exploration with panels and controls:

```tsx
import { Hydroscope } from '@hydro-project/hydroscope';

function MyApp() {
  return (
    <Hydroscope
      data={graphData}
      showInfoPanel={true}
      showStylePanel={true}
      enableCollapse={true}
      onFileUpload={(data, filename) => {
        console.log(`Loaded: ${filename}`);
      }}
    />
  );
}
```

## 🔧 Advanced Components

For power users who want standalone panels:

```tsx
import { InfoPanel, StyleTuner } from '@hydro-project/hydroscope';

function CustomLayout() {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <HydroscopeCore data={graphData} readOnly={true} />
      </div>
      <div style={{ width: '300px' }}>
        <InfoPanel visualizationState={state} />
        <StyleTuner onConfigChange={handleStyleChange} />
      </div>
    </div>
  );
}
```

## 🛠️ Utilities

```tsx
import { parseDataFromUrl } from '@hydro-project/hydroscope';

// Parse graph data from URL parameters
const data = await parseDataFromUrl(urlParams.get('data'));
```

## What's Different?

### ❌ Old API (too complex):
```tsx
// Too many internal exports
import { 
  VisualizationState, 
  ReactFlowBridge, 
  ELKBridge, 
  JSONParser,
  loadPaxosTestData,
  HydroscopeCore,
  ContainerControls,
  // ... 20+ more exports
} from '@hydro-project/hydroscope';
```

### ✅ New API (focused):
```tsx
// Just what you need
import { 
  Hydroscope,           // Full-featured component
  HydroscopeCore,       // Simple core component (use readOnly={true} for read-only)
  InfoPanel,            // Optional: standalone panel
  StyleTuner,           // Optional: standalone panel
  parseDataFromUrl      // Optional: utility function
} from '@hydro-project/hydroscope';
```

## Benefits

1. **Simpler** - 80% fewer exports to understand
2. **Clearer** - Obvious what each component does
3. **Flexible** - Use HydroscopeCore with readOnly prop or full Hydroscope component
4. **Maintainable** - Smaller public API surface
5. **Typical** - Follows standard React library patterns