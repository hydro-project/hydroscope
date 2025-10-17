# Embedding Hydroscope in Your Application

This guide shows how to embed the **Hydroscope** component in your React application. Hydroscope is the high-level, batteries-included component that provides a complete visualization experience with file upload, info panel, style controls, and more.

## Overview

The `Hydroscope` component is perfect when you want:
- Quick integration with minimal setup
- Built-in file upload interface
- Info panel with search and hierarchy controls
- Style customization panel
- URL parameter support for sharing configurations

For more control and customization, see [Embedding HydroscopeCore](EMBEDDING_CORE.md).

## Basic Setup

### 1. Install the Package

```bash
npm install @hydro-project/hydroscope
```

### 2. Import Styles

Always import the CSS in your main application file:

```tsx
import "@hydro-project/hydroscope/style.css";
```

### 3. Basic Component

```tsx
import { Hydroscope } from "@hydro-project/hydroscope";
import "@hydro-project/hydroscope/style.css";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Hydroscope />
    </div>
  );
}
```

This shows the file upload interface by default.

## Loading Data

### From JSON File (Recommended)

```tsx
import { Hydroscope } from "@hydro-project/hydroscope";
import { useState, useEffect } from "react";

function GraphViewer() {
  const [graphData, setGraphData] = useState(null);

  useEffect(() => {
    fetch("/data/my-graph.json")
      .then((res) => res.json())
      .then((data) => setGraphData(data))
      .catch((err) => console.error("Failed to load graph:", err));
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Hydroscope data={graphData} />
    </div>
  );
}
```

### With File Upload Callback

```tsx
function App() {
  const handleFileUpload = (data, filename) => {
    console.log(`Loaded: ${filename}`, data);
    // Store in state, send to analytics, etc.
  };

  return (
    <Hydroscope
      showFileUpload={true}
      onFileUpload={handleFileUpload}
    />
  );
}
```

### From URL Parameters

Hydroscope can automatically load data from URL parameters:

```tsx
function App() {
  return (
    <Hydroscope
      enableUrlParsing={true}
      onConfigChange={(config) => {
        console.log("Config changed:", config);
      }}
    />
  );
}
```

Users can then share links like: `https://yourapp.com/?data=<compressed-data>`

## Configuration Options

### Panel Controls

```tsx
<Hydroscope
  data={graphData}
  showInfoPanel={true}        // Show search & hierarchy controls
  showStylePanel={true}       // Show style customization panel
  showFileUpload={false}      // Hide file upload (when data is provided)
/>
```

### Responsive Layout

```tsx
<Hydroscope
  data={graphData}
  responsive={true}           // Auto-adjust height based on content
/>
```

### Initial Configuration

```tsx
<Hydroscope
  data={graphData}
  initialLayoutAlgorithm="layered"
  initialColorPalette="vivid"
  initialEdgeStyle="bezier"
  initialEdgeWidth={2}
  enableCollapse={true}
/>
```

## Complete Example

```tsx
import { Hydroscope } from "@hydro-project/hydroscope";
import "@hydro-project/hydroscope/style.css";
import { useState } from "react";

function GraphApp() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const handleFileUpload = (data, filename) => {
    setCurrentFile(filename || "uploaded-graph.json");
    console.log("Loaded graph with", data.nodes.length, "nodes");
  };

  const handleConfigChange = (config) => {
    console.log("User changed config:", config);
    // Save to localStorage, update URL, etc.
  };

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {currentFile && (
        <div style={{ padding: "10px", background: "#f0f0f0" }}>
          Currently viewing: {currentFile}
        </div>
      )}
      
      <div style={{ flex: 1, minHeight: 0 }}>
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
          responsive={false}
          enableUrlParsing={true}
          initialLayoutAlgorithm="layered"
          initialColorPalette="vivid"
          enableCollapse={true}
          onFileUpload={handleFileUpload}
          onConfigChange={handleConfigChange}
        />
      </div>
    </div>
  );
}

export default GraphApp;
```

## Props Reference

### Data Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HydroscopeData \| null` | `null` | Graph data to visualize |
| `showFileUpload` | `boolean` | `true` | Show file upload when no data |
| `enableUrlParsing` | `boolean` | `true` | Parse data from URL parameters |

### UI Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showInfoPanel` | `boolean` | `true` | Show search & hierarchy panel |
| `showStylePanel` | `boolean` | `true` | Show style customization panel |
| `responsive` | `boolean` | `false` | Auto-adjust height |

### Initial Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialLayoutAlgorithm` | `string` | `"layered"` | ELK layout algorithm |
| `initialColorPalette` | `string` | `"vivid"` | Color scheme |
| `initialEdgeStyle` | `"bezier" \| "straight" \| "smoothstep"` | `"bezier"` | Edge rendering style |
| `initialEdgeWidth` | `number` | `2` | Default edge thickness |
| `initialEdgeDashed` | `boolean` | `false` | Use dashed edges |
| `enableCollapse` | `boolean` | `true` | Allow container collapse |

### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onFileUpload` | `(data, filename?) => void` | Called when file is uploaded |
| `onConfigChange` | `(config) => void` | Called when config changes |

### Layout Props

All props from `HydroscopeCore` are also supported (see [Embedding HydroscopeCore](EMBEDDING_CORE.md) for details):

- Visual controls: `showControls`, `showMiniMap`, `showBackground`
- Interaction callbacks: `onNodeClick`, `onContainerCollapse`, `onContainerExpand`
- Dimensions: `height`, `width`
- Read-only mode: `readOnly`

## Styling

### Container Styling

```tsx
<Hydroscope
  className="my-custom-graph"
  style={{
    border: "2px solid #ccc",
    borderRadius: "8px"
  }}
  data={graphData}
/>
```

### CSS Custom Properties

Override default styles in your CSS:

```css
.my-custom-graph {
  --hydroscope-background: #f5f5f5;
  --hydroscope-primary-color: #0066cc;
  --hydroscope-panel-background: rgba(255, 255, 255, 0.95);
}
```

## Common Patterns

### Embed in Dashboard

```tsx
function Dashboard() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", height: "100vh" }}>
      <Sidebar />
      <div style={{ overflow: "hidden" }}>
        <Hydroscope
          data={graphData}
          showInfoPanel={false}  // Use your own sidebar instead
          responsive={true}
        />
      </div>
    </div>
  );
}
```

### Multiple Graphs

```tsx
function ComparisonView() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100vh", gap: "10px" }}>
      <Hydroscope data={graphDataA} showStylePanel={false} />
      <Hydroscope data={graphDataB} showStylePanel={false} />
    </div>
  );
}
```

### Controlled File Upload

```tsx
function ControlledUpload() {
  const [data, setData] = useState(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File) => {
    const text = await file.text();
    const json = JSON.parse(text);
    setData(json);
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
        style={{ display: "none" }}
      />
      <button onClick={() => fileInputRef.current?.click()}>
        Load Graph
      </button>
      
      {data && (
        <div style={{ height: "80vh", marginTop: "20px" }}>
          <Hydroscope
            data={data}
            showFileUpload={false}
            onConfigChange={(config) => console.log("Config:", config)}
          />
        </div>
      )}
    </div>
  );
}
```

## TypeScript Support

Full TypeScript definitions are included:

```tsx
import type { HydroscopeProps, HydroscopeData } from "@hydro-project/hydroscope";

const props: HydroscopeProps = {
  data: myGraphData,
  showInfoPanel: true,
  onFileUpload: (data: HydroscopeData, filename?: string) => {
    console.log("Loaded:", filename);
  }
};
```

## Next Steps

- **[JSON Format Specification](JSON_FORMAT.md)** - Learn the graph data format
- **[Embedding HydroscopeCore](EMBEDDING_CORE.md)** - For advanced customization
- **Sample Data** - Check `test-data/` directory for examples

## Troubleshooting

### Graph Not Rendering

1. Make sure you imported the CSS: `import "@hydro-project/hydroscope/style.css"`
2. Check that the parent container has explicit dimensions (width and height)
3. Verify your JSON data matches the [format specification](JSON_FORMAT.md)

### File Upload Not Working

1. Ensure `showFileUpload={true}` is set
2. Check browser console for JSON parsing errors
3. Verify file is valid JSON matching the expected format

### Performance Issues

For large graphs (>500 nodes), consider:
1. Using `HydroscopeCore` instead for more control
2. Implementing pagination or filtering
3. Pre-computing layouts server-side
