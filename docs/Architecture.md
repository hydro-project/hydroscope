# Visualization System Architecture

## Overview

The Hydro visualization system is built on a modular architecture that separates concerns between state management, layout calculation, and rendering. This document provides an architectural overview of how the components work together.

## System Components

````
┌──────────────────────────────────────────────────────────────┐
│                     React UI Layer                           │
├──────────────────────────────────────────────────────────────┤
│                    Render Components                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ FlowGraph   │  │    Nodes    │  │       Edges         │   │
│  │   .tsx      │  │   .tsx      │  │      .tsx           │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                   Layout Engine                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ ELK Layout  │  │ State Mgr   │  │  Converters         │   │
│  │ Engine      │  │             │  │                     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                   Core State                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              VisualizationState                         │ │
│  │          (Single Source of Truth)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                   Data Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   JSON      │  │  Services   │  │    Adapters         │   │
│  │  Parser     │  │             │  │                     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

The system follows a clear three-stage pipeline with symmetric bridge architecture:

### 1. Input Processing
```
Raw Graph Data → JSONParser → VisualizationState
                              ↓
                     Validation & Storage
```

### 2. Layout Calculation (ELKBridge)
```
VisualizationState → ELKBridge.layoutVisState() → ELK Layout Engine
       ↓                        ↓                         ↓
   Visible Elements     ELK Graph Format         Positioned Results
       ↓                        ↓                         ↓
VisualizationState ← elkToVisState() ←─────────── ELK Results
   (updated with                                  (x, y, width, height)
    layout positions)
```

### 3. Rendering Pipeline (ReactFlowBridge)  
```
VisualizationState → ReactFlowBridge.convertVisState() → React Components → DOM
       ↓                          ↓                             ↓              ↓
   Positioned            ReactFlow Format              ReactFlow Nodes    Visual Output
    Elements            (nodes, edges, styles)          & Edges
```

### Bridge Symmetry

Both main bridges follow similar patterns:

**ELKBridge (Layout)**:
- Input: `VisualizationState` 
- Process: `visStateToELK()` → ELK computation → `elkToVisState()`
- Output: Updates `VisualizationState` in-place (async)

**ReactFlowBridge (Rendering)**:
- Input: `VisualizationState`
- Process: `visStateToReactFlow()` → styling → formatting  
- Output: Returns `ReactFlowData` (sync)

## Core Design Principles

### 1. Single Source of Truth
**VisualizationState** is the central authority for all graph data:
- All components read from VisualizationState
- All updates go through VisualizationState methods
- No direct manipulation of internal data structures
- Consistent state across all system components

### 2. Separation of Concerns

#### State Management (Core)
- **VisualizationState**: Central state management
- **ContainerCollapseExpand**: Hierarchical operations
- **Types**: Shared type definitions

#### Bridge Layer (Bridges)
- **ELKBridge**: Layout calculation and positioning
- **ReactFlowBridge**: Rendering format conversion
- **EdgeConverter**: Edge styling and properties
- **ReactFlowUtils**: Hierarchy and positioning utilities
- **CoordinateTranslator**: Coordinate system conversion

#### Rendering (Render)
- **FlowGraph**: Main ReactFlow component
- **Nodes/Edges**: Custom React components
- **Handle Configuration**: Node connection strategies

#### Data (Services/Shared)
- **JSONParser**: Input data processing
- **VisualizationService**: High-level coordination
- **Config**: Styling and configuration

### 3. Immutable Operations
- Methods return new state or `this` for chaining
- Internal collections use defensive copying
- No external mutation of internal data structures

### 4. Performance Optimization
- O(1) element lookups via Map-based storage
- Cached visible element collections
- Efficient hierarchy operations
- Minimal re-calculations

## Component Interactions

### Symmetric Bridge Architecture

#### ELKBridge (Layout Calculation)

```typescript
// 1. Configure layout
const elkBridge = new ELKBridge(layoutConfig);

// 2. Apply layout to VisualizationState (async, modifies in-place)
await elkBridge.layoutVisState(visualizationState);

// 3. VisualizationState now has layout positions
const nodeLayout = visualizationState.getNodeLayout('node1');
// { position: { x: 100, y: 200 }, dimensions: { width: 50, height: 30 } }
```

#### ReactFlowBridge (Rendering Conversion)

```typescript
// 1. Configure rendering
const reactFlowBridge = new ReactFlowBridge();
reactFlowBridge.setColorPalette('Set3');
reactFlowBridge.setEdgeStyleConfig(edgeConfig);

// 2. Convert to ReactFlow format (sync, returns new data)
const reactFlowData = reactFlowBridge.convertVisState(visualizationState);

// 3. Render in React
<ReactFlow 
  nodes={reactFlowData.nodes} 
  edges={reactFlowData.edges} 
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
/>
```

### Bridge Coordination Pattern

```typescript
// Typical usage: Layout → Render
const elkBridge = new ELKBridge(layoutConfig);
const reactFlowBridge = new ReactFlowBridge();

// 1. Apply layout
await elkBridge.layoutVisState(visualizationState);

// 2. Convert for rendering  
const reactFlowData = reactFlowBridge.convertVisState(visualizationState);

// 3. Update UI
setReactFlowData(reactFlowData);
```

### State Management Patterns

#### Centralized Updates
```typescript
// All updates go through VisualizationState
visualizationState
  .setGraphNode('node1', { label: 'Node 1' })
  .setGraphEdge('edge1', { source: 'node1', target: 'node2' })
  .setContainer('container1', { children: new Set(['node1']) });
```

#### Reactive Access
```typescript
// Components read reactive data
const visibleNodes = visualizationState.visibleNodes;
const expandedContainers = visualizationState.expandedContainers;
```

## Error Handling Strategy

### Validation Layers

1. **Input Validation**: JSONParser validates raw data format
2. **State Validation**: VisualizationState validates operations
3. **Layout Validation**: ELK integration validates layout constraints
4. **Render Validation**: ReactFlow components validate props

### Error Boundaries

```typescript
// VisualizationState throws descriptive errors
try {
  state.setGraphNode('', { label: 'Invalid' });
} catch (error) {
  // Handle validation error
}

// Layout engine handles ELK errors
try {
  const result = await layoutEngine.layout(...);
} catch (error) {
  // Fallback to previous layout or default positioning
}
```

## Performance Characteristics

### Time Complexity
- **Element Access**: O(1) - Map-based lookups
- **Visibility Queries**: O(1) - Cached collections
- **Hierarchy Operations**: O(1) - Direct Map access
- **Layout Calculation**: O(n log n) - ELK algorithm
- **Rendering**: O(n) - ReactFlow rendering

### Space Complexity
- **Element Storage**: O(n) - One Map per element type
- **Visibility Cache**: O(n) - Separate collections for visible elements
- **Hierarchy Index**: O(n) - Parent/child relationship maps
- **Layout Data**: O(n) - Position and dimension data

### Optimization Strategies

1. **Lazy Evaluation**: Visibility collections updated only when needed
2. **Incremental Updates**: Only changed elements trigger recalculation
3. **Memory Sharing**: Shared object references reduce duplication
4. **Batch Operations**: Multiple updates processed together

## Extensibility Points

### 1. Custom Node Types
```typescript
// Add new node component
const customNodeTypes = {
  'custom': CustomNodeComponent,
  ...nodeTypes
};
```

### 2. Layout Algorithms
```typescript
// Implement LayoutEngine interface
class CustomLayoutEngine implements LayoutEngine {
  async layout(nodes, edges, containers, config) {
    // Custom layout logic
  }
}
```

### 3. Data Sources
```typescript
// Implement data adapter
class CustomDataAdapter {
  parseData(rawData) {
    // Convert to VisualizationState format
  }
}
```

### 4. Event Handlers
```typescript
// Custom event handling
const customEventHandlers = {
  onNodeClick: (nodeId) => { /* custom logic */ },
  onEdgeClick: (edgeId) => { /* custom logic */ }
};
```

## Testing Strategy

### Unit Tests
- **VisualizationState**: Core state operations
- **Layout Engine**: Layout calculations
- **Converters**: Data transformations
- **Components**: React component behavior

### Integration Tests
- **State ↔ Layout**: Full layout pipeline
- **Layout ↔ Render**: Complete render pipeline
- **End-to-End**: Full visualization workflow

### Performance Tests
- **Large Graphs**: Scalability testing
- **Frequent Updates**: Update performance
- **Memory Usage**: Memory leak detection

## Configuration Management

### Styling Configuration
```typescript
// Centralized styling in shared/config.ts
export const NODE_COLORS = {
  source: '#8dd3c7',
  transform: '#ffffb3',
  sink: '#80b1d3'
};
```

### Layout Configuration
```typescript
// Layout algorithm settings
export const DEFAULT_LAYOUT_CONFIG = {
  algorithm: 'layered',
  spacing: { nodeNode: 20, edgeNode: 10 },
  direction: 'DOWN'
};
```

### Render Configuration
```typescript
// ReactFlow settings
export const DEFAULT_RENDER_CONFIG = {
  enableMiniMap: true,
  enableControls: true,
  fitView: true
};
```

## File Organization

The codebase follows a clear modular structure that reflects the architectural principles:

```
src/
├── bridges/                     # Bridge layer (symmetric architecture)
│   ├── ELKBridge.ts            # Layout calculation bridge
│   ├── ReactFlowBridge.ts      # Rendering conversion bridge
│   ├── EdgeConverter.ts        # Edge styling utilities
│   ├── ReactFlowUtils.ts       # ReactFlow-specific utilities
│   ├── CoordinateTranslator.ts # Coordinate conversion
│   └── elk-types.ts            # ELK type definitions
│
├── core/                       # Central state management
│   ├── VisualizationState.ts   # Single source of truth
│   ├── VisualizationEngine.ts  # High-level coordination
│   └── types.ts                # Core type definitions
│
├── render/                     # ReactFlow rendering layer
│   ├── FlowGraph.tsx           # Main ReactFlow component
│   ├── nodes/                  # Custom node components
│   └── edges/                  # Custom edge components
│
├── components/                 # UI components
│   ├── Hydroscope.tsx          # Main wrapper components
│   └── panels/                 # Control panels
│
└── shared/                     # Shared utilities
    ├── config.ts               # Configuration constants
    └── types.ts                # Shared type definitions
```

This organization ensures:
- **Clear dependencies**: Each layer only depends on layers below it
- **Isolated concerns**: Bridge logic is separate from UI and state
- **Easy testing**: Each module can be tested independently
- **Maintainable**: Related functionality is grouped together

## Future Considerations

### Scalability Improvements
1. **Virtual Rendering**: For very large graphs
2. **Level-of-Detail**: Simplified rendering at zoom levels
3. **Streaming Updates**: For real-time data

### Feature Extensions
1. **Animation System**: Smooth transitions
2. **Custom Layouts**: Domain-specific algorithms
3. **Collaborative Editing**: Multi-user support
4. **Export Formats**: PDF, SVG, PNG export

### Performance Optimizations
1. **Web Workers**: Background layout calculation
2. **Canvas Rendering**: Alternative to SVG for large graphs
3. **Incremental Layout**: Partial layout updates
4. **Memory Pooling**: Object reuse strategies

---

*This architectural overview reflects the current design as of the latest implementation. For specific implementation details, refer to the individual component documentation.*