# Hydroscope

[![CI](https://github.com/hydro-project/hydroscope/actions/workflows/ci.yml/badge.svg)](https://github.com/hydro-project/hydroscope/actions/workflows/ci.yml)

A React library for visualizing graphs with hierarchical subgraphs. Originally created for Hydro dataflow programs, but works with any graph data structure. Built on React Flow with automatic layout using ELK algorithms.

## What does it do?

Hydroscope helps you display and navigate complex directed graphs. It automatically organizes nodes into groups and subgraphs, handles layout calculations, and provides ready-to-use components for different use cases:

- **HydroscopeCore**: Basic graph rendering without UI controls
- **HydroscopeMini**: Interactive graph with simple collapse/expand controls  
- **Hydroscope**: Full-featured interface with file upload, styling options, search and info panels

Common use cases include visualizing dataflow programs, data pipelines, system architectures, network topologies, or any connected flows where directional relationships matter.

• Package: `@hydro-project/hydroscope`
• Runtime deps (installed for you): `@xyflow/react`, `elkjs`, `antd`

## Install

```bash
npm install @hydro-project/hydroscope
```

Import the stylesheet once in your app:

```ts
import '@hydro-project/hydroscope/style.css';
```

### ESM & Explicit Styles

Hydroscope ships as pure ESM. It does **not** auto-import third-party styles to keep SSR and Node imports safe.

Add these in your application root (order is not critical):

```ts
import '@xyflow/react/dist/style.css';      // React Flow base styles
import '@hydro-project/hydroscope/style.css'; // Hydroscope generated styles
import 'antd/dist/reset.css';               // (Optional) Ant Design reset
```

Server-side rendering (Next.js, Docusaurus): Module top-level has no unguarded `window`/`document` usage, so importing is safe. Browser-only code runs inside React effects. For client-only mounting patterns you can still dynamically import the component if desired.


## Requirements

- Node >= 18
- React >= 17 (tested with React 18)
- Hydroscope uses React Flow (@xyflow/react), ELK (elkjs), and Ant Design (antd) under the hood.
  - These are regular dependencies and will be installed automatically with Hydroscope.
  - You must import their base styles in your app (see below).
Add these once at your app entry (order not critical):

```ts
import '@hydro-project/hydroscope/style.css';
import '@xyflow/react/dist/style.css';
import 'antd/dist/reset.css'; // Ant Design v5
```

## Basic Example

Here's a minimal graph to get you started:

```tsx
import { HydroscopeCore } from '@hydro-project/hydroscope';
import '@hydro-project/hydroscope/style.css';

const graphData = {
  nodes: [
    { id: "a", label: "Start" },
    { id: "b", label: "Process" },
    { id: "c", label: "End" }
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" }
  ]
};

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <HydroscopeCore data={graphData} fillViewport />
    </div>
  );
}
```

## Components Overview

Each component serves different needs:

**HydroscopeCore** - Basic graph rendering:
```tsx
<HydroscopeCore 
  data={yourGraphJson}
  grouping="location"           // optional: group nodes by this property
  fillViewport
  onParsed={(meta, vs) => console.log('Parsed', meta)}
  onError={(msg) => console.error(msg)}
/>
```

**HydroscopeMini** - Interactive with simple controls:
```tsx
<HydroscopeMini 
  data={yourGraphJson} 
  showControls 
  enableCollapse 
/>
```

**Hydroscope** - Full-featured interface:
```tsx
<Hydroscope
  data={yourGraphJson}
  showFileUpload
  showInfoPanel
  onFileUpload={(data, filename) => console.log('Uploaded', filename)}
/>
```


## Props (essentials)

HydroscopeCore (minimal renderer)
- data: object | string — graph JSON
- grouping?: string — hierarchy id to apply (from `hierarchyChoices`)
- config?: RenderConfig — visual/style options
- layoutConfig?: LayoutConfig — layout options
- eventHandlers?: FlowGraphEventHandlers — callbacks (e.g., onNodeClick)
- fillViewport?: boolean — fill parent viewport
- onParsed?: (metadata, visualizationState) => void
- onError?: (message: string) => void

HydroscopeMini
- showControls?: boolean (default: true)
- enableCollapse?: boolean (default: true)
- autoFit?: boolean (default: true)
- onNodeClick?/onContainerCollapse?/onContainerExpand?/onParsed?
- height?: number | string — explicit graph height (e.g., 500 or '500px')
- width?: number | string — explicit graph width (default: '100%')
- defaultHeight?: number | string — fallback height when none provided (default: 600)
- innerStyle?: React.CSSProperties — style applied to inner graph container
- Plus all non-conflicting HydroscopeCore props (data, grouping, config, ...)

Hydroscope (full-featured UI)
- showFileUpload?: boolean (default: true)
- showInfoPanel?: boolean (default: true)
- initialLayoutAlgorithm?: string (default: 'layered')
- initialColorPalette?: string (default: 'Set3')
- autoFit?: boolean (default: true)
- onFileUpload? / onNodeClick? / onContainerCollapse? / onContainerExpand? / onParsed? / onConfigChange?
- Plus all non-conflicting HydroscopeCore props (data, grouping, config, ...)

FileDropZone
- onFileUpload?: (data, filename) => void
- acceptedTypes?: string[] — e.g., ['.json']

## Data format and helpers

- The parser accepts an object or JSON string with nodes, edges, and optional `hierarchyChoices`/style sections. Edges use `semanticTags` for all semantics and styling.
- Exported helpers:

console.log('Schema', SCHEMA_VERSION, 'Updated', LAST_UPDATED);
const sample = generateCompleteExample();
```
## Layout algorithms and fallback

<Hydroscope data={data} layoutConfig={{ algorithm: 'mrtree' }} />
// If you pass 'my-custom', Hydroscope falls back to 'layered'.
```

## Sizing behavior

- If you don’t specify a height, Hydroscope and HydroscopeMini default to a safe 600px graph height. This prevents React Flow container sizing errors when parents don’t have an explicit height.
- Set `fillViewport` to have the graph fill the viewport (`100vw`/`100vh`).
- HydroscopeMini also accepts `height`, `width`, `defaultHeight`, and `innerStyle` for precise sizing control.


## Imperative API (ref)

You can capture a ref to HydroscopeCore to call:
- getVisualizationState(): VisualizationState | null
- refreshLayout(): Promise<void>
- fitView(): void

```tsx
const ref = useRef<HydroscopeCoreRef>(null);
<HydroscopeCore ref={ref} data={data} />
// later
await ref.current?.refreshLayout();
ref.current?.fitView();
```

## Troubleshooting

- Nothing renders: Ensure you imported the CSS and provided a size (e.g., parent div has width/height).
- Container size errors: Defaults now apply a 600px height when unspecified. You can override via `height` or `defaultHeight` on HydroscopeMini, or set an explicit height on the container.
- Parse error: Check your JSON structure; see the complete example via `generateCompleteExample()`.
- Clicks don’t collapse: Use HydroscopeMini/Hydroscope or provide `eventHandlers.onNodeClick` in HydroscopeCore.
- Layout looks odd: Try `layoutConfig={{ algorithm: 'layered' }}` or call `refreshLayout()`.

## Development

Requirements
- Node >= 18

Scripts
- Build: `npm run build` (outputs to dist/)
- Dev (watch): `npm run dev`
- Tests: `npm test` or `npm run test:watch`
- Lint: `npm run lint`
- Typecheck (build config): `npm run typecheck`
- Strict typecheck (source only): `npm run typecheck:strict`

Repo structure (high level)

```
src/
  index.ts            # Public API
  components/         # HydroscopeCore, HydroscopeMini, Hydroscope, panels
  core/               # VisualizationState, JSON parser
  layout/             # ELK layout integration
  render/             # ReactFlow rendering
  shared/             # Config/types/constants
docs/                 # Architecture and schema tooling
dist/                 # Build output
```

## License

Apache-2.0 © Hydro Project Contributors

