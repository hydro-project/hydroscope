# Hydroscope API Documentation

This document provides comprehensive API documentation for the cleaned Hydroscope component, including all props, interfaces, and usage patterns.

## Component Interface

### HydroscopeProps

The main props interface for the Hydroscope component.

```typescript
interface HydroscopeProps {
  // Core Data Props
  data?: HydroscopeData;
  height?: string | number;
  width?: string | number;

  // Feature Toggle Props
  showControls?: boolean;
  showMiniMap?: boolean;
  showBackground?: boolean;
  showFileUpload?: boolean;
  showInfoPanel?: boolean;
  showStylePanel?: boolean;
  enableCollapse?: boolean;

  // Configuration Props
  initialLayoutAlgorithm?: string;
  initialColorPalette?: string;
  responsive?: boolean;

  // Event Handler Props
  onFileUpload?: (data: HydroscopeData, filename?: string) => void;
  onNodeClick?: (event: React.MouseEvent, node: NodeData, visualizationState?: VisualizationState) => void;
  onContainerCollapse?: (containerId: string, visualizationState?: VisualizationState) => void;
  onContainerExpand?: (containerId: string, visualizationState?: VisualizationState) => void;
  onConfigChange?: (config: RenderConfig) => void;

  // Styling Props
  className?: string;
  style?: React.CSSProperties;
}
```

## Props Reference

### Core Data Props

#### `data?: HydroscopeData`

**Type**: `HydroscopeData | undefined`  
**Default**: `undefined`  
**Description**: JSON data to visualize containing nodes, edges, and containers.

```typescript
interface HydroscopeData {
  nodes: Array<{
    id: string;
    type?: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    data?: Record<string, unknown>;
  }>;
  containers?: Array<{
    id: string;
    label?: string;
    children: string[];
    data?: Record<string, unknown>;
  }>;
}
```

**Usage**:
```tsx
const graphData = {
  nodes: [
    { id: '1', label: 'Node 1', type: 'process' },
    { id: '2', label: 'Node 2', type: 'data' }
  ],
  edges: [
    { id: 'e1', source: '1', target: '2' }
  ]
};

<Hydroscope data={graphData} />
```

#### `height?: string | number`

**Type**: `string | number`  
**Default**: `600`  
**Description**: Height of the visualization container.

**Usage**:
```tsx
<Hydroscope height="100vh" />        // CSS string
<Hydroscope height={500} />          // Pixels
<Hydroscope height="calc(100% - 60px)" />  // CSS calc
```

#### `width?: string | number`

**Type**: `string | number`  
**Default**: `"100%"`  
**Description**: Width of the visualization container.

**Usage**:
```tsx
<Hydroscope width="100vw" />         // CSS string
<Hydroscope width={800} />           // Pixels
<Hydroscope width="100%" />          // Percentage
```

### Feature Toggle Props

#### `showControls?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show ReactFlow controls (zoom, fit view, etc.).

#### `showMiniMap?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show the minimap overview.

#### `showBackground?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show the background pattern.

#### `showFileUpload?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show file upload interface when no data is provided.

#### `showInfoPanel?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show the InfoPanel with search and hierarchy controls.

#### `showStylePanel?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to show the StyleTuner panel with layout and styling controls.

#### `enableCollapse?: boolean`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Whether to enable container collapse/expand functionality.

### Configuration Props

#### `initialLayoutAlgorithm?: string`

**Type**: `string`  
**Default**: `"layered"`  
**Options**: `"layered"`, `"mrtree"`, `"force"`, `"stress"`, `"radial"`  
**Description**: Layout algorithm to use on first render.

**Usage**:
```tsx
<Hydroscope initialLayoutAlgorithm="force" />
```

#### `initialColorPalette?: string`

**Type**: `string`  
**Default**: `"Set2"`  
**Options**: `"Set2"`, `"Set3"`, `"Pastel1"`, `"Dark2"`  
**Description**: Color palette to use on first render.

**Usage**:
```tsx
<Hydroscope initialColorPalette="Dark2" />
```

#### `responsive?: boolean`

**Type**: `boolean`  
**Default**: `false`  
**Description**: Whether to enable responsive height calculation.

### Event Handler Props

#### `onFileUpload?: (data: HydroscopeData, filename?: string) => void`

**Description**: Called when user uploads a file through the file upload interface.

**Parameters**:
- `data: HydroscopeData` - Parsed graph data from uploaded file
- `filename?: string` - Original filename (optional)

**Usage**:
```tsx
<Hydroscope
  onFileUpload={(data, filename) => {
    console.log(`File uploaded: ${filename}`);
    console.log(`Nodes: ${data.nodes.length}, Edges: ${data.edges.length}`);
    
    // Validate data
    if (!data.nodes || data.nodes.length === 0) {
      alert('No nodes found in uploaded file');
      return;
    }
    
    // Process data
    setGraphData(data);
  }}
/>
```

#### `onNodeClick?: (event: React.MouseEvent, node: NodeData, visualizationState?: VisualizationState) => void`

**Description**: Called when user clicks on a node in the visualization.

**Parameters**:
- `event: React.MouseEvent` - React click event
- `node: NodeData` - Clicked node data
- `visualizationState?: VisualizationState` - Current v1.0.0 visualization state

**Usage**:
```tsx
<Hydroscope
  onNodeClick={(event, node, visualizationState) => {
    console.log('Node clicked:', node.id);
    
    // Access additional node data through v1.0.0 architecture
    if (visualizationState) {
      const fullNodeData = visualizationState.getNode(node.id);
      console.log('Full node data:', fullNodeData);
      
      // Highlight connected nodes
      const connectedNodes = visualizationState.getConnectedNodes(node.id);
      console.log('Connected nodes:', connectedNodes);
    }
    
    // Handle click event
    if (event.ctrlKey) {
      // Multi-select behavior
      addToSelection(node.id);
    } else {
      // Single select
      setSelectedNode(node.id);
    }
  }}
/>
```

#### `onContainerCollapse?: (containerId: string, visualizationState?: VisualizationState) => void`

**Description**: Called when user collapses a container.

**Parameters**:
- `containerId: string` - ID of collapsed container
- `visualizationState?: VisualizationState` - Current v1.0.0 visualization state

**Usage**:
```tsx
<Hydroscope
  onContainerCollapse={(containerId, visualizationState) => {
    console.log(`Container ${containerId} collapsed`);
    
    // Track collapsed containers
    setCollapsedContainers(prev => new Set([...prev, containerId]));
    
    // Access container data
    if (visualizationState) {
      const containerData = visualizationState.getContainer(containerId);
      console.log(`Collapsed container with ${containerData.children.length} children`);
    }
  }}
/>
```

#### `onContainerExpand?: (containerId: string, visualizationState?: VisualizationState) => void`

**Description**: Called when user expands a container.

**Parameters**:
- `containerId: string` - ID of expanded container
- `visualizationState?: VisualizationState` - Current v1.0.0 visualization state

**Usage**:
```tsx
<Hydroscope
  onContainerExpand={(containerId, visualizationState) => {
    console.log(`Container ${containerId} expanded`);
    
    // Track expanded containers
    setCollapsedContainers(prev => {
      const newSet = new Set(prev);
      newSet.delete(containerId);
      return newSet;
    });
  }}
/>
```

#### `onConfigChange?: (config: RenderConfig) => void`

**Description**: Called when user modifies styling, layout, or other configuration.

**Parameters**:
- `config: RenderConfig` - Updated render configuration

**Usage**:
```tsx
<Hydroscope
  onConfigChange={(config) => {
    console.log('Configuration changed:', config);
    
    // Save configuration
    localStorage.setItem('my-app-hydroscope-config', JSON.stringify(config));
    
    // Apply to other components
    setGlobalRenderConfig(config);
    
    // Track configuration changes
    analytics.track('hydroscope_config_changed', {
      edgeStyle: config.edgeStyle,
      colorPalette: config.colorPalette,
      layoutAlgorithm: config.layoutAlgorithm
    });
  }}
/>
```

### Styling Props

#### `className?: string`

**Type**: `string`  
**Description**: CSS class name to apply to the Hydroscope root element.

**Usage**:
```tsx
<Hydroscope className="my-custom-hydroscope" />
```

```css
.my-custom-hydroscope {
  border: 2px solid #007bff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.my-custom-hydroscope .react-flow__controls {
  background: rgba(255, 255, 255, 0.9);
}
```

#### `style?: React.CSSProperties`

**Type**: `React.CSSProperties`  
**Description**: Inline styles to apply to the Hydroscope root element.

**Usage**:
```tsx
<Hydroscope
  style={{
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f9f9f9'
  }}
/>
```

## Supporting Interfaces

### RenderConfig

Configuration object for visual styling.

```typescript
interface RenderConfig {
  edgeStyle?: "bezier" | "straight" | "smoothstep";
  edgeWidth?: number;
  edgeDashed?: boolean;
  nodePadding?: number;
  nodeFontSize?: number;
  containerBorderWidth?: number;
  colorPalette?: string;
  fitView?: boolean;
}
```

### NodeData

Node data structure passed to event handlers.

```typescript
interface NodeData {
  id: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
  type?: string;
  label?: string;
}
```

## Breaking Changes from HydroscopeEnhanced

### Enhanced Callbacks

**Before (HydroscopeEnhanced)**:
```tsx
onNodeClick={(event, node) => {
  // Limited node information
  console.log('Node clicked:', node.id);
}}
```

**After (New Hydroscope)**:
```tsx
onNodeClick={(event, node, visualizationState) => {
  // Enhanced with v1.0.0 architecture access
  console.log('Node clicked:', node.id);
  
  if (visualizationState) {
    const fullData = visualizationState.getNode(node.id);
    console.log('Full node data:', fullData);
  }
}}
```

### Container Operations

**New in Hydroscope**:
```tsx
<Hydroscope
  onContainerCollapse={(containerId, visualizationState) => {
    // New callback for container operations
  }}
  onContainerExpand={(containerId, visualizationState) => {
    // New callback for container operations
  }}
/>
```

### Configuration Management

**Before (HydroscopeEnhanced)**:
```tsx
// Configuration was managed internally
<HydroscopeEnhanced enhanced={true} />
```

**After (New Hydroscope)**:
```tsx
// Unified configuration callback
<Hydroscope
  onConfigChange={(config) => {
    // Handle all configuration changes
    console.log('Config updated:', config);
  }}
/>
```

## Migration Examples

### Basic Migration

**Before**:
```tsx
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

<HydroscopeEnhanced
  data={data}
  enhanced={true}
  height="600px"
/>
```

**After**:
```tsx
import { Hydroscope } from '@hydro-project/hydroscope';

<Hydroscope
  data={data}
  showInfoPanel={true}
  showStylePanel={true}
  height="600px"
/>
```

### Advanced Migration

**Before**:
```tsx
<HydroscopeEnhanced
  data={data}
  enhanced={true}
  onNodeClick={handleNodeClick}
  responsive={true}
/>
```

**After**:
```tsx
<Hydroscope
  data={data}
  showInfoPanel={true}
  showStylePanel={true}
  onNodeClick={(event, node, visualizationState) => {
    // Enhanced callback with v1.0.0 integration
    handleNodeClick(event, node, visualizationState);
  }}
  onConfigChange={(config) => {
    // New unified configuration handling
    handleConfigChange(config);
  }}
  responsive={true}
/>
```

## Error Handling

### Component-Level Error Handling

The Hydroscope component includes comprehensive error handling:

```tsx
// Automatic error boundary
<Hydroscope
  data={data}
  onFileUpload={(data, filename) => {
    try {
      // Validate data
      if (!data.nodes || data.nodes.length === 0) {
        throw new Error('No nodes found in data');
      }
      
      setGraphData(data);
    } catch (error) {
      console.error('File upload error:', error);
      setError(error.message);
    }
  }}
/>
```

### Panel Error Isolation

Panels are automatically isolated from errors:

```tsx
// Panel errors don't crash the main component
<Hydroscope
  showInfoPanel={true}
  showStylePanel={true}
  // If InfoPanel crashes, StyleTuner and main visualization continue working
/>
```

## Performance Considerations

### Memoization

The component uses React.memo for optimal performance:

```tsx
// Component is automatically memoized
const MyComponent = () => {
  const stableData = useMemo(() => processData(rawData), [rawData]);
  
  return (
    <Hydroscope
      data={stableData}
      // Other props should also be stable for best performance
    />
  );
};
```

### Resource Management

Automatic cleanup prevents memory leaks:

```tsx
// Resources are automatically cleaned up
<Hydroscope
  data={data}
  // Timers, observers, and event listeners are automatically managed
/>
```

## Best Practices

### 1. Stable Props

Use stable references for callback props:

```tsx
const handleNodeClick = useCallback((event, node, visualizationState) => {
  // Handle node click
}, [/* dependencies */]);

<Hydroscope onNodeClick={handleNodeClick} />
```

### 2. Error Handling

Always handle errors in callbacks:

```tsx
<Hydroscope
  onFileUpload={(data, filename) => {
    try {
      validateData(data);
      setData(data);
    } catch (error) {
      showErrorMessage(error.message);
    }
  }}
/>
```

### 3. Configuration Persistence

Save important configuration:

```tsx
<Hydroscope
  onConfigChange={(config) => {
    localStorage.setItem('app-hydroscope-config', JSON.stringify(config));
  }}
/>
```

### 4. v1.0.0 Architecture Usage

Leverage v1.0.0 architecture in callbacks:

```tsx
<Hydroscope
  onNodeClick={(event, node, visualizationState) => {
    if (visualizationState) {
      // Use v1.0.0 features for enhanced functionality
      const nodeData = visualizationState.getNode(node.id);
      const connections = visualizationState.getConnectedNodes(node.id);
    }
  }}
/>
```

This API documentation provides comprehensive coverage of the Hydroscope component interface and usage patterns. For more examples and integration patterns, see the [Component Usage Examples](./component-usage-examples.md) and [Panel Integration Guide](./panel-integration-guide.md).