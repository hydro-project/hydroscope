# Hydroscope Docusaurus Integration

This guide shows how to embed Hydroscope visualizations in your Docusaurus documentation.

## Installation

First, install the Hydroscope package:

```bash
npm install @hydro-project/hydroscope
```

## Basic Usage

### Simple Demo Component

The easiest way to add a Hydroscope visualization to your Docusaurus page is using the `HydroscopeDemo` component:

```jsx
import { HydroscopeDemo } from '@hydro-project/hydroscope';

<HydroscopeDemo height={400} />
```

### Custom Data Visualization

For custom data, use the `HydroscopeDocusaurus` component:

```jsx
import { HydroscopeDocusaurus } from '@hydro-project/hydroscope';

const myData = {
  nodes: [
    {
      id: 'source1',
      shortLabel: 'source',
      fullLabel: 'source_iter([1, 2, 3])',
      nodeType: 'Source',
      data: { locationId: 0, locationType: 'Process' }
    },
    // ... more nodes
  ],
  edges: [
    {
      id: 'e1',
      source: 'source1',
      target: 'map1',
      semanticTags: ['Unbounded', 'TotalOrder']
    },
    // ... more edges
  ],
  hierarchyChoices: [
    {
      id: 'location',
      name: 'Location',
      children: [
        { id: 'loc_0', name: 'Process 0', children: [] },
        { id: 'loc_1', name: 'Process 1', children: [] }
      ]
    }
  ],
  nodeAssignments: {
    location: {
      'source1': 'loc_0',
      'map1': 'loc_0',
      // ... more assignments
    }
  }
};

<HydroscopeDocusaurus 
  data={myData}
  height={500}
  showControls={true}
  showMiniMap={true}
/>
```

## Component Props

### HydroscopeDemo

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `string \| number` | `400` | Height of the visualization |
| `showPaxosDemo` | `boolean` | `false` | Whether to show the paxos.json demo option |

### HydroscopeDocusaurus

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HydroscopeData` | `undefined` | JSON data to visualize |
| `height` | `string \| number` | `600` | Height of the visualization |
| `width` | `string \| number` | `'100%'` | Width of the visualization |
| `showControls` | `boolean` | `true` | Whether to show zoom/pan controls |
| `showMiniMap` | `boolean` | `true` | Whether to show the minimap |
| `showBackground` | `boolean` | `true` | Whether to show the background pattern |
| `demo` | `boolean` | `false` | Whether to load demo paxos.json data |

## Data Format

The `HydroscopeData` format follows the paxos.json structure:

```typescript
interface HydroscopeData {
  nodes: Array<{
    id: string;
    shortLabel: string;
    fullLabel: string;
    nodeType: string;
    data: {
      locationId: number;
      locationType: string;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    semanticTags: string[];
  }>;
  hierarchyChoices: Array<{
    id: string;
    name: string;
    children: Array<{
      id: string;
      name: string;
      children: any[];
    }>;
  }>;
  nodeAssignments: Record<string, Record<string, string>>;
}
```

## Styling

The components automatically adapt to Docusaurus themes (light/dark mode). You can customize the appearance by overriding the CSS classes:

```css
.hydroscope-docusaurus {
  /* Custom border */
  border: 2px solid #your-color;
}

.hydroscope-demo-controls {
  /* Custom control panel styling */
  background: #your-background;
}
```

## Interactive Features

The embedded visualizations support:

- **Container expand/collapse**: Click on container boxes to show/hide their contents
- **Node label toggle**: Click on nodes to switch between short and full labels
- **Zoom and pan**: Use mouse wheel and drag to navigate
- **Minimap navigation**: Click on the minimap to jump to different areas
- **Fit view**: Use the controls to fit the entire graph in view

## Examples

### Simple Dataflow Example

```jsx
<HydroscopeDemo height={300} />
```

### Large Graph Example

```jsx
<HydroscopeDemo height={600} showPaxosDemo={true} />
```

### Custom Styling Example

```jsx
<div style={{ border: '2px solid #007acc', borderRadius: '8px' }}>
  <HydroscopeDocusaurus 
    demo={true}
    height={400}
    showControls={false}
    showMiniMap={false}
  />
</div>
```

## Troubleshooting

### Component Not Rendering

Make sure you have React 17+ installed and that the component is imported correctly:

```jsx
import { HydroscopeDemo } from '@hydro-project/hydroscope';
```

### Styling Issues

If the component doesn't match your Docusaurus theme, try importing the CSS explicitly:

```jsx
import '@hydro-project/hydroscope/dist/style.css';
```

### Performance with Large Graphs

For very large graphs (1000+ nodes), consider:

- Using the minimap for navigation
- Starting with containers collapsed
- Limiting the initial view to essential nodes

## Advanced Usage

For more advanced use cases, you can use the core Hydroscope components directly:

```jsx
import { 
  VisualizationState, 
  JSONParser, 
  ELKBridge, 
  ReactFlowBridge 
} from '@hydro-project/hydroscope';

// Custom implementation
const parser = JSONParser.createPaxosParser();
const result = await parser.parseData(yourData);
const state = result.visualizationState;

// Use with your own React components
```