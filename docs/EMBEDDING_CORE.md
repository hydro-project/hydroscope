# Embedding HydroscopeCore in Your Application

This guide shows how to embed the **HydroscopeCore** component in your React application. HydroscopeCore is the low-level, headless component that provides maximum control and customization for advanced use cases.

## Overview

The `HydroscopeCore` component is perfect when you want:
- Full control over the UI and interactions
- Custom panels, controls, and workflows
- Integration with existing design systems
- Programmatic control via callbacks
- Minimal bundle size (no built-in panels)

For a simpler, batteries-included experience, see [Embedding Hydroscope](EMBEDDING.md).

## Key Differences from Hydroscope

| Feature | Hydroscope | HydroscopeCore |
|---------|------------|----------------|
| File upload UI | ✅ Built-in | ❌ Build your own |
| Info panel | ✅ Built-in | ❌ Build your own |
| Style panel | ✅ Built-in | ❌ Build your own |
| URL parsing | ✅ Built-in | ❌ Build your own |
| Bundle size | Larger | Smaller |
| Customization | Limited | Complete |
| Data prop | Optional | **Required** |

## Basic Setup

### 1. Install the Package

```bash
npm install @hydro-project/hydroscope
```

### 2. Import Styles

```tsx
import "@hydro-project/hydroscope/style.css";
```

### 3. Basic Component

```tsx
import { HydroscopeCore } from "@hydro-project/hydroscope";
import type { HydroscopeData } from "@hydro-project/hydroscope";
import "@hydro-project/hydroscope/style.css";

function App() {
  const graphData: HydroscopeData = {
    nodes: [
      { id: "1", nodeType: "Source", shortLabel: "input" },
      { id: "2", nodeType: "Transform", shortLabel: "process" },
      { id: "3", nodeType: "Sink", shortLabel: "output" }
    ],
    edges: [
      { id: "e1", source: "1", target: "2" },
      { id: "e2", source: "2", target: "3" }
    ]
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <HydroscopeCore data={graphData} />
    </div>
  );
}
```

**Important:** The `data` prop is **required** for HydroscopeCore.

## Configuration Options

### Visual Controls

```tsx
<HydroscopeCore
  data={graphData}
  showControls={true}           // Show zoom/pan controls
  showMiniMap={false}           // Show minimap
  showBackground={true}         // Show grid background
  height="100vh"                // Container height
  width="100%"                  // Container width
/>
```

### Interaction Modes

```tsx
<HydroscopeCore
  data={graphData}
  readOnly={false}              // Allow interactions
  enableCollapse={true}         // Allow container collapse/expand
/>
```

### Initial Styling

```tsx
<HydroscopeCore
  data={graphData}
  initialLayoutAlgorithm="layered"     // ELK layout: "layered", "force", "stress", "mrtree"
  initialColorPalette="vivid"          // Color scheme
  initialEdgeStyle="bezier"            // "bezier" | "straight" | "smoothstep"
  initialEdgeWidth={2}                 // Edge thickness
  initialEdgeDashed={false}            // Dashed edges
  initialNodePadding={20}              // Node padding
  initialNodeFontSize={12}             // Font size
  initialContainerBorderWidth={2}      // Container border width
/>
```

## Event Callbacks

### Node Interactions

```tsx
const handleNodeClick = (event, node, visualizationState) => {
  console.log("Clicked node:", node.id);
  console.log("Current state:", visualizationState);
  // Access node data, position, etc.
};

<HydroscopeCore
  data={graphData}
  onNodeClick={handleNodeClick}
/>
```

### Container Operations

```tsx
const handleContainerCollapse = (containerId, visualizationState) => {
  console.log(`Container ${containerId} collapsed`);
  // Update your UI, save state, etc.
};

const handleContainerExpand = (containerId, visualizationState) => {
  console.log(`Container ${containerId} expanded`);
};

<HydroscopeCore
  data={graphData}
  onContainerCollapse={handleContainerCollapse}
  onContainerExpand={handleContainerExpand}
  enableCollapse={true}
/>
```

### Bulk Operations

```tsx
const handleCollapseAll = (visualizationState) => {
  console.log("All containers collapsed");
};

const handleExpandAll = (visualizationState) => {
  console.log("All containers expanded");
};

<HydroscopeCore
  data={graphData}
  onCollapseAll={handleCollapseAll}
  onExpandAll={handleExpandAll}
/>
```

### Configuration Changes

```tsx
const handleConfigChange = (updates) => {
  console.log("Config changed:", updates);
  // Updates include: layoutAlgorithm, colorPalette, edgeStyle, etc.
};

const handleStateChange = (visualizationState) => {
  console.log("Visualization state updated:", visualizationState);
  // State includes: visible nodes, collapsed containers, search results, etc.
};

<HydroscopeCore
  data={graphData}
  onRenderConfigChange={handleConfigChange}
  onVisualizationStateChange={handleStateChange}
/>
```

### Error Handling

```tsx
const handleError = (error) => {
  console.error("Visualization error:", error);
  // Show user-friendly error message
};

<HydroscopeCore
  data={graphData}
  onError={handleError}
/>
```

## Building Custom Panels

### Custom Control Panel

```tsx
import { HydroscopeCore } from "@hydro-project/hydroscope";
import { useState } from "react";

function GraphWithControls() {
  const [layoutAlgorithm, setLayoutAlgorithm] = useState("layered");
  const [colorPalette, setColorPalette] = useState("vivid");

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Custom Control Panel */}
      <div style={{ width: "300px", padding: "20px", background: "#f5f5f5" }}>
        <h3>Layout</h3>
        <select
          value={layoutAlgorithm}
          onChange={(e) => setLayoutAlgorithm(e.target.value)}
        >
          <option value="layered">Layered</option>
          <option value="force">Force</option>
          <option value="stress">Stress</option>
          <option value="mrtree">Tree</option>
        </select>

        <h3>Colors</h3>
        <select
          value={colorPalette}
          onChange={(e) => setColorPalette(e.target.value)}
        >
          <option value="vivid">Vivid</option>
          <option value="pastel">Pastel</option>
          <option value="monochrome">Monochrome</option>
        </select>
      </div>

      {/* Graph Visualization */}
      <div style={{ flex: 1 }}>
        <HydroscopeCore
          data={graphData}
          initialLayoutAlgorithm={layoutAlgorithm}
          initialColorPalette={colorPalette}
          onRenderConfigChange={(config) => {
            console.log("Config updated:", config);
          }}
        />
      </div>
    </div>
  );
}
```

### Custom Info Panel

```tsx
import { useState } from "react";

function GraphWithInfo() {
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ flex: 1 }}>
        <HydroscopeCore
          data={graphData}
          onNodeClick={(event, node) => setSelectedNode(node)}
        />
      </div>

      {/* Custom Info Panel */}
      {selectedNode && (
        <div style={{
          width: "350px",
          padding: "20px",
          background: "white",
          borderLeft: "1px solid #ccc",
          overflow: "auto"
        }}>
          <h2>Node Details</h2>
          <p><strong>ID:</strong> {selectedNode.id}</p>
          <p><strong>Type:</strong> {selectedNode.data?.nodeType}</p>
          <p><strong>Label:</strong> {selectedNode.data?.label}</p>
          
          {selectedNode.data?.data && (
            <div>
              <h3>Metadata</h3>
              <pre>{JSON.stringify(selectedNode.data.data, null, 2)}</pre>
            </div>
          )}
          
          <button onClick={() => setSelectedNode(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
```

### Using Built-in Panels

You can import and use the built-in panels separately:

```tsx
import { HydroscopeCore, InfoPanel, StyleTuner } from "@hydro-project/hydroscope";
import { useState } from "react";

function CustomLayout() {
  const [visualState, setVisualState] = useState(null);
  const [styleConfig, setStyleConfig] = useState({});

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 300px", height: "100vh" }}>
      {/* Left Panel: Info & Search */}
      <InfoPanel
        visualizationState={visualState}
        onSearch={(query) => console.log("Search:", query)}
        onHierarchyChange={(hierarchy) => console.log("Hierarchy:", hierarchy)}
      />

      {/* Center: Graph */}
      <HydroscopeCore
        data={graphData}
        onVisualizationStateChange={setVisualState}
        onRenderConfigChange={(config) => setStyleConfig(config)}
        {...styleConfig}
      />

      {/* Right Panel: Style Controls */}
      <StyleTuner
        config={styleConfig}
        onChange={(updates) => setStyleConfig({ ...styleConfig, ...updates })}
      />
    </div>
  );
}
```

## Advanced Patterns

### Dynamic Data Updates

```tsx
function LiveGraph() {
  const [graphData, setGraphData] = useState(initialData);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fetch new data from API
      fetch("/api/graph-data")
        .then(res => res.json())
        .then(data => setGraphData(data));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <HydroscopeCore
      data={graphData}
      key={graphData.timestamp} // Force re-render on data change
    />
  );
}
```

### Read-Only Embedded View

```tsx
function EmbeddedGraph({ graphId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/graphs/${graphId}`)
      .then(res => res.json())
      .then(setData);
  }, [graphId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ width: "800px", height: "600px", border: "1px solid #ccc" }}>
      <HydroscopeCore
        data={data}
        readOnly={true}              // Disable all interactions
        showControls={false}         // Hide controls
        showBackground={false}       // Clean appearance
        enableCollapse={false}       // No container operations
      />
    </div>
  );
}
```

### Programmatic Auto-Fit

```tsx
function GraphWithAutoFit() {
  const [autoFit, setAutoFit] = useState(false);

  return (
    <div>
      <button onClick={() => setAutoFit(true)}>Fit to View</button>
      
      <HydroscopeCore
        data={graphData}
        autoFitEnabled={autoFit}
        onRenderConfigChange={(config) => {
          // Auto-fit is complete
          setAutoFit(false);
        }}
      />
    </div>
  );
}
```

## Props Reference

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `HydroscopeData` | Graph data (nodes, edges, hierarchies) |

### Visual Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `string \| number` | `"100%"` | Container height |
| `width` | `string \| number` | `"100%"` | Container width |
| `showControls` | `boolean` | `true` | Show zoom/pan controls |
| `showMiniMap` | `boolean` | `false` | Show minimap |
| `showBackground` | `boolean` | `true` | Show grid background |
| `className` | `string` | `undefined` | Custom CSS class |
| `style` | `CSSProperties` | `undefined` | Inline styles |

### Interaction Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `readOnly` | `boolean` | `false` | Disable all interactions |
| `enableCollapse` | `boolean` | `true` | Allow container collapse |

### Initial Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialLayoutAlgorithm` | `string` | `"layered"` | ELK layout algorithm |
| `initialColorPalette` | `string` | `"vivid"` | Color scheme |
| `initialEdgeStyle` | `"bezier" \| "straight" \| "smoothstep"` | `"bezier"` | Edge style |
| `initialEdgeWidth` | `number` | `2` | Edge thickness |
| `initialEdgeDashed` | `boolean` | `false` | Dashed edges |
| `initialNodePadding` | `number` | `20` | Node padding |
| `initialNodeFontSize` | `number` | `12` | Font size |
| `initialContainerBorderWidth` | `number` | `2` | Container border |

### Callback Props

| Prop | Type | Description |
|------|------|-------------|
| `onNodeClick` | `(event, node, state?) => void` | Node click handler |
| `onContainerCollapse` | `(containerId, state?) => void` | Container collapsed |
| `onContainerExpand` | `(containerId, state?) => void` | Container expanded |
| `onCollapseAll` | `(state?) => void` | All collapsed |
| `onExpandAll` | `(state?) => void` | All expanded |
| `onVisualizationStateChange` | `(state) => void` | State changed |
| `onRenderConfigChange` | `(config) => void` | Config changed |
| `onError` | `(error) => void` | Error occurred |

### Programmatic Control

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoFitEnabled` | `boolean` | `false` | Trigger auto-fit to viewport |

## TypeScript Support

Full TypeScript definitions:

```tsx
import type {
  HydroscopeCoreProps,
  HydroscopeData,
} from "@hydro-project/hydroscope";

const props: HydroscopeCoreProps = {
  data: myGraphData,
  showControls: true,
  onNodeClick: (event, node, state) => {
    console.log("Node:", node.id);
  }
};
```

## Performance Optimization

### For Large Graphs (>500 nodes)

1. **Disable expensive features:**
```tsx
<HydroscopeCore
  data={largeGraph}
  showMiniMap={false}           // Minimap is expensive
  showBackground={false}        // Grid can impact performance
  initialEdgeStyle="straight"   // Faster than bezier
/>
```

2. **Use read-only mode:**
```tsx
<HydroscopeCore
  data={largeGraph}
  readOnly={true}               // Disables interaction handlers
/>
```

3. **Optimize callbacks:**
```tsx
// Use useCallback to prevent re-renders
const handleNodeClick = useCallback((event, node) => {
  // Handler logic
}, []);
```

## Next Steps

- **[Embedding Hydroscope](EMBEDDING.md)** - Higher-level component with built-in UI
- **[JSON Format Specification](JSON_FORMAT.md)** - Learn the data format
- **[Development Docs](development/)** - Architecture details

## Troubleshooting

### Graph Not Visible

1. Parent container must have explicit dimensions
2. Ensure CSS is imported: `import "@hydro-project/hydroscope/style.css"`
3. Check `data` prop is valid HydroscopeData

### Callbacks Not Firing

1. Verify `readOnly={false}` (default)
2. Check for React re-render issues (use `useCallback`)
3. Ensure `enableCollapse={true}` for container callbacks

### Layout Issues

1. Try different `initialLayoutAlgorithm` values
2. Check hierarchy definitions in your data
3. Verify node/edge references are correct
