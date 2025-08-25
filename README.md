# Hydroscope

React-based graph visualization for Hydro dataflow graphs. Built on React and @xyflow/react (React Flow) with ELK for layout. Ships with a minimal component for effortless rendering plus interactive variants and helpful UI panels.

• Package: `@hydro-project/hydroscope`
• Peer deps: `react`, `react-dom` (>=17; tested with React 18)
• Runtime deps (installed for you): `@xyflow/react`, `elkjs`, `antd`

## Install

```bash
npm install @hydro-project/hydroscope
```

Import the stylesheet once in your app:

```ts
import '@hydro-project/hydroscope/style.css';
```

## Requirements

- Node >= 18
- React >= 17 (tested with React 18)
- Hydroscope uses React Flow (@xyflow/react), ELK (elkjs), and Ant Design (antd) under the hood.
  - These are regular dependencies and will be installed automatically with Hydroscope.
  - You must import their base styles in your app (see below).

### Styles you need to import

Add these once at your app entry (order not critical):

```ts
import '@hydro-project/hydroscope/style.css';
import '@xyflow/react/dist/style.css';
import 'antd/dist/reset.css'; // Ant Design v5
```

## API at a glance

- Hydroscope: minimal, read-only visualization
- HydroscopeMini: interactive (click to collapse/expand, pack/unpack, refresh)
- HydroscopeFull: full UI (file upload, layout controls, style tuner, info panel)
- FileDropZone: drag-and-drop JSON uploader with inline docs/example

Utilities and types:
- parseGraphJSON, createRenderConfig
- VisualizationState, VisualizationEngine, createVisualizationEngine
- generateCompleteExample, SCHEMA_VERSION, LAST_UPDATED
- RenderConfig, LayoutConfig, FlowGraphEventHandlers

## Quick start

Basic render (minimal API):

```tsx
import { Hydroscope } from '@hydro-project/hydroscope';
import '@hydro-project/hydroscope/style.css';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Hydroscope
        data={yourGraphJson}
        grouping="location"           // optional grouping id
        fillViewport
        onParsed={(meta, vs) => console.log('Parsed', meta)}
        onError={(msg) => console.error(msg)}
      />
    </div>
  );
}
```

Interactive (small controls built-in):

```tsx
import { HydroscopeMini } from '@hydro-project/hydroscope';

<HydroscopeMini data={yourGraphJson} showControls enableCollapse />
```

Full experience (sidebar, upload, controls):

```tsx
import { HydroscopeFull } from '@hydro-project/hydroscope';

<HydroscopeFull
  data={yourGraphJson}
  showFileUpload
  showInfoPanel
  onFileUpload={(data, filename) => console.log('Uploaded', filename)}
/>
```

## Props (essentials)

Hydroscope
- data: object | string — graph JSON
- grouping?: string — hierarchy id to apply
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
- Plus all non-conflicting Hydroscope props (data, grouping, config, ...)

HydroscopeFull
- showFileUpload?: boolean (default: true)
- showInfoPanel?: boolean (default: true)
- initialLayoutAlgorithm?: string (default: 'mrtree')
- initialColorPalette?: string (default: 'Set3')
- autoFit?: boolean (default: true)
- onFileUpload? / onNodeClick? / onContainerCollapse? / onContainerExpand? / onParsed? / onConfigChange?
- Plus all non-conflicting Hydroscope props (data, grouping, config, ...)

FileDropZone
- onFileUpload?: (data, filename) => void
- acceptedTypes?: string[] — e.g., ['.json']

## Data format and helpers

- The parser accepts an object or JSON string with nodes, edges, and optional hierarchy/style sections.
- Exported helpers:
  - `SCHEMA_VERSION` and `LAST_UPDATED` for display or tooling
  - `generateCompleteExample()` returns a working sample JSON

```ts
import { SCHEMA_VERSION, LAST_UPDATED, generateCompleteExample } from '@hydro-project/hydroscope';

console.log('Schema', SCHEMA_VERSION, 'Updated', LAST_UPDATED);
const sample = generateCompleteExample();
```

## Layout algorithms and fallback

`layoutConfig.algorithm` accepts any string. Supported ELK values include:
`mrtree`, `layered`, `force`, `stress`, `radial`.

- Unknown strings are safely normalized to `mrtree` internally.

```tsx
<Hydroscope data={data} layoutConfig={{ algorithm: 'layered' }} />
// If you pass 'my-custom', Hydroscope falls back to 'mrtree'.
```

## Sizing behavior

- If you don’t specify a height, Hydroscope and HydroscopeMini default to a safe 600px graph height. This prevents React Flow container sizing errors when parents don’t have an explicit height.
- Set `fillViewport` to have the graph fill the viewport (`100vw`/`100vh`).
- HydroscopeMini also accepts `height`, `width`, `defaultHeight`, and `innerStyle` for precise sizing control.

## Imperative API (ref)

You can capture a ref to call:
- getVisualizationState(): VisualizationState | null
- refreshLayout(): Promise<void>
- fitView(): void

```tsx
const ref = useRef<HydroscopeRef>(null);
<Hydroscope ref={ref} data={data} />
// later
await ref.current?.refreshLayout();
ref.current?.fitView();
```

## Troubleshooting

- Nothing renders: Ensure you imported the CSS and provided a size (e.g., parent div has width/height).
- Container size errors: Defaults now apply a 600px height when unspecified. You can override via `height` or `defaultHeight` on HydroscopeMini, or set an explicit height on the container.
- Parse error: Check your JSON structure; see the complete example via `generateCompleteExample()`.
- Clicks don’t collapse: Use HydroscopeMini/HydroscopeFull or provide `eventHandlers.onNodeClick` in Hydroscope.
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
  components/         # Hydroscope, HydroscopeMini, HydroscopeFull, panels
  core/               # VisualizationState, JSON parser
  layout/             # ELK layout integration
  render/             # ReactFlow rendering
  shared/             # Config/types/constants
docs/                 # Architecture and schema tooling
dist/                 # Build output
```

## License

Apache-2.0 © Hydro Project Contributors

