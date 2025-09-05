# Hydroscope: Graph Visualization Component

Hydroscope is a React component for visualizing complex graphs with hierarchy, labeling, and interactive controls. 

This README is designed for users who want to feed data to an app that already imports Hydroscope, or need help building an app that incorporates Hydroscope.

---

## 1. Creating JSON Files for Hydroscope


Hydroscope consumes a JSON object describing your graph. The format is flexible and supports rich metadata, hierarchy, styling, and semantic tags. You can generate a valid example using the built-in helper:

```ts
import { generateCompleteExample } from '@hydro-project/hydroscope';
const example = generateCompleteExample();
```

### JSON Schema Reference

#### Top-level keys
- `nodes`: Array of node objects (required)
- `edges`: Array of edge objects (required)
- `hierarchyChoices`: Array describing groupings and nesting (optional)
- `nodeAssignments`: Mapping of node IDs to hierarchy group IDs (optional)
- `edgeStyleConfig`: Semantic-to-style mapping for edges (optional)
- `nodeTypeConfig`: Node type definitions for styling and legend (optional)
- `metadata`: Arbitrary metadata (optional)

#### Node object
- `id` (string, required): Unique node identifier
- `label` (string, optional): Display label
- `nodeType` (string, optional): Type for styling/categorization
- `fullLabel` (string, optional): Detailed label
- `shortLabel` (string, optional): Abbreviated label
- `semanticTags` (array of strings, optional): Tags for styling or grouping
- `data` (object, optional): Arbitrary metadata (e.g., code location, backtrace)
- Any additional properties are preserved

#### Edge object
- `id` (string, required): Unique edge identifier
- `source` (string, required): Source node ID
- `target` (string, required): Target node ID
- `label` (string, optional): Display label
- `semanticTags` (array of strings, optional): Tags for styling or grouping
- Any additional properties are preserved

#### Hierarchy and Grouping
- `hierarchyChoices`: Array of objects for menu-driven hierarchy selection
  - `id` (string): Choice ID
  - `name` (string): Display name
  - `children` (array): Nested hierarchy items
- `nodeAssignments`: Mapping of hierarchy IDs to node-to-group assignments

#### Styling and Configuration
- `edgeStyleConfig`:
  - `propertyMappings`: Map semantic tags to style tags
- `nodeTypeConfig`:
  - `defaultType`: Default node type
  - `types`: Array of `{ id, label, colorIndex }` objects

#### Example (comprehensive)
```json
{
  "nodes": [
    { "id": "0", "nodeType": "Source", "shortLabel": "source_iter", "fullLabel": "source_iter" },
    { "id": "1", "nodeType": "Transform", "shortLabel": "persist", "fullLabel": "persist [state storage]" },
    { "id": "2", "nodeType": "Network", "shortLabel": "network(recv)", "fullLabel": "network(ser + deser)" },
    { "id": "3", "nodeType": "Tee", "shortLabel": "tee", "fullLabel": "tee [branch dataflow]" },
    { "id": "4", "nodeType": "Transform", "shortLabel": "inspect", "fullLabel": "inspect" },
    { "id": "5", "nodeType": "Transform", "shortLabel": "persist", "fullLabel": "persist [state storage]" },
    { "id": "6", "nodeType": "Transform", "shortLabel": "flatmap", "fullLabel": "flatmap" },
    { "id": "7", "nodeType": "Network", "shortLabel": "network(recv)", "fullLabel": "network(ser + deser)" },
    { "id": "8", "nodeType": "Sink", "shortLabel": "for_each", "fullLabel": "for_each" }
  ],
  "edges": [
    { "id": "e0", "source": "0", "target": "1", "semanticTags": ["Unbounded", "TotalOrder"] },
    { "id": "e1", "source": "1", "target": "2", "semanticTags": ["TotalOrder", "Unbounded", "Network"] },
    { "id": "e2", "source": "2", "target": "3", "semanticTags": ["TotalOrder", "Network", "Unbounded"] },
    { "id": "e3", "source": "3", "target": "4", "semanticTags": ["Stream", "Unbounded", "NoOrder"] },
    { "id": "e4", "source": "4", "target": "5", "semanticTags": ["Stream", "Unbounded", "NoOrder"] },
    { "id": "e5", "source": "5", "target": "6", "semanticTags": ["NoOrder", "Unbounded", "Stream"] },
    { "id": "e6", "source": "6", "target": "7", "semanticTags": ["Stream", "Unbounded", "NoOrder", "Network"] },
    { "id": "e7", "source": "7", "target": "8", "semanticTags": ["Unbounded", "NoOrder", "Stream"] }
  ],
  "hierarchyChoices": [
    {
      "id": "location",
      "name": "Location",
      "children": [
        { "id": "loc_0", "name": "Clients" },
        { "id": "loc_1", "name": "Server" }
      ]
    }
  ],
  "nodeAssignments": {
    "location": {
      "0": "loc_0",
      "1": "loc_0",
      "2": "loc_1",
      "3": "loc_1",
      "4": "loc_1",
      "5": "loc_1",
      "6": "loc_1",
      "7": "loc_0",
      "8": "loc_0"
    }
  },
  "edgeStyleConfig": {
    "propertyMappings": {
      "Unbounded": "thin-stroke",
      "TotalOrder": "smooth-line",
      "Network": "dashed-animated",
      "NoOrder": "wavy-line",
      "Stream": "double-line"
    }
  },
  "nodeTypeConfig": {
    "defaultType": "Transform",
    "types": [
      { "id": "Source", "label": "Source", "colorIndex": 0 },
      { "id": "Transform", "label": "Transform", "colorIndex": 1 },
      { "id": "Tee", "label": "Tee", "colorIndex": 2 },
      { "id": "Network", "label": "Network", "colorIndex": 3 },
      { "id": "Sink", "label": "Sink", "colorIndex": 4 }
    ]
  }
}
```

##### Notes
- Only `nodes` and `edges` are strictly required; all other fields are optional and additive.
- All additional properties are preserved by the parser for downstream use.
- For full schema details, use `generateCompleteExample()` or inspect the output of that function.

Hierarchy enables collapsible groups and nested containers. Semantic tags and configuration fields allow for rich styling and interactive features.

---

## 2. Incorporating Hydroscope into a Webpage

Install the package:
```bash
npm install @hydro-project/hydroscope
```

Import required styles once in your app:
```ts
import '@hydro-project/hydroscope/style.css';
import '@xyflow/react/dist/style.css';
import 'antd/dist/reset.css'; // Ant Design v5
```

### Basic Usage
```tsx
import { Hydroscope } from '@hydro-project/hydroscope';

export default function MyGraphPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Hydroscope
        data={yourGraphJson}
        showFileUpload={true}      // enables file upload panel
        showInfoPanel={true}       // enables info sidebar
        onFileUpload={(data, filename) => console.log('Uploaded', filename)}
        // ...other props as needed
      />
    </div>
  );
}
```

#### Key Props
- `data`: object or JSON string describing your graph
- `showFileUpload`: boolean (default: true) — enables drag-and-drop file upload
- `showInfoPanel`: boolean (default: true) — shows info sidebar
- `initialLayoutAlgorithm`: string (default: 'layered')
- `initialColorPalette`: string (default: 'Set3')
- `autoFit`: boolean (default: true)
- `onFileUpload`, `onNodeClick`, `onParsed`, etc.: event handlers

#### Sizing
- By default, Hydroscope fills its parent container. Set explicit `width` and `height` on the parent div for best results.
- If no height is provided, defaults to 600px.

---

## Troubleshooting
- **Nothing renders**: Ensure CSS is imported and parent container has width/height.
- **Parse error**: Check your JSON structure; use `generateCompleteExample()` for a working sample.
- **Layout issues**: Try different `initialLayoutAlgorithm` values (e.g., 'layered', 'radial').

---

## Attribution
This repository was motivated by the desire to visualize Hydro graphs.

---

## License
Apache-2.0 © Hydro Project Contributors
