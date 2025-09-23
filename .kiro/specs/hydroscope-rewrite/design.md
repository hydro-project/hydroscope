# Hydroscope Rewrite Design Document

## Overview

The Hydroscope rewrite implements a clean, layered architecture with VisualizationState as the central data model, surrounded by synchronous bridges for external integrations, and managed async boundaries for performance-critical operations. The design emphasizes predictability, testability, and maintainability.

## Architecture

### Core Principles

1. **Single Source of Truth**: VisualizationState contains all graph data and state
2. **Synchronous Core**: All data transformations within the core are synchronous and predictable
3. **Async Boundaries**: Async operations are isolated to specific boundaries with sequential queues
4. **Immutable Interfaces**: External systems receive immutable views of the data
5. **Test-First Development**: Every component is built with comprehensive tests

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   React UI      │  │   File Upload   │  │   Search    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Async Coordinator │
                    │   (Sequential)     │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                      Core Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   ELK Bridge    │  │ VisualizationState │  │ReactFlow Bridge │ │
│  │  (Synchronous)  │  │   (Synchronous)   │  │  (Synchronous)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   External APIs   │
                    │  ELK, ReactFlow   │
                    └───────────────────┘
```

## Components and Interfaces

### VisualizationState

**Purpose**: Central data model managing all graph state

**Key Responsibilities**:
- Store nodes, edges, containers with relationships
- Manage visibility states (collapsed/expanded containers)
- Track layout history and prevent invalid operations
- Provide efficient read-only access for bridges
- Maintain search state and results
- Ensure atomic state transitions

**Interface**:
```typescript
class VisualizationState {
  // Data Management
  addNode(node: GraphNode): void
  addEdge(edge: GraphEdge): void
  addContainer(container: Container): void
  
  // Container Operations
  expandContainer(id: string): void
  collapseContainer(id: string): void
  expandAllContainers(): void
  collapseAllContainers(): void
  
  // Edge Aggregation Management
  aggregateEdgesForContainer(containerId: string): void
  restoreEdgesForContainer(containerId: string): void
  getAggregatedEdges(): ReadonlyArray<AggregatedEdge>
  getOriginalEdges(): ReadonlyArray<GraphEdge>
  
  // Layout State
  getLayoutState(): LayoutState
  setLayoutPhase(phase: LayoutPhase): void
  incrementLayoutCount(): void
  isFirstLayout(): boolean
  
  // Read-only Access
  get visibleNodes(): ReadonlyArray<GraphNode>
  get visibleEdges(): ReadonlyArray<GraphEdge | AggregatedEdge>
  get visibleContainers(): ReadonlyArray<Container>
  
  // Graph Element Interactions
  toggleNodeLabel(nodeId: string): void
  setNodeLabelState(nodeId: string, showLongLabel: boolean): void
  toggleContainer(containerId: string): void
  
  // Search
  search(query: string): SearchResult[]
  clearSearch(): void
  
  // Validation
  validateInvariants(): void
}
```

### ELKBridge

**Purpose**: Synchronous conversion between VisualizationState and ELK format

**Key Responsibilities**:
- Convert VisualizationState to ELK graph format
- Apply ELK layout results back to VisualizationState
- Handle layout configuration
- Manage ELK-specific optimizations

**Interface**:
```typescript
class ELKBridge {
  constructor(layoutConfig: LayoutConfig)
  
  // Synchronous Conversions
  toELKGraph(state: VisualizationState): ELKNode
  applyELKResults(state: VisualizationState, elkResult: ELKNode): void
  
  // Configuration
  updateLayoutConfig(config: LayoutConfig): void
  
  // Validation
  validateELKGraph(elkGraph: ELKNode): ValidationResult
}
```

### ReactFlowBridge

**Purpose**: Synchronous conversion from VisualizationState to ReactFlow format

**Key Responsibilities**:
- Convert VisualizationState to ReactFlow nodes and edges
- Apply styling based on semantic tags
- Handle container rendering (collapsed vs expanded)
- Generate immutable ReactFlow data

**Interface**:
```typescript
class ReactFlowBridge {
  constructor(styleConfig: StyleConfig)
  
  // Synchronous Conversion
  toReactFlowData(state: VisualizationState): ReactFlowData
  
  // Styling
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[]
  applyEdgeStyles(edges: ReactFlowEdge[]): ReactFlowEdge[]
  applyAggregatedEdgeStyles(aggregatedEdges: ReactFlowEdge[]): ReactFlowEdge[]
  
  // Container Handling
  renderCollapsedContainer(container: Container): ReactFlowNode
  renderExpandedContainer(container: Container, children: ReactFlowNode[]): ReactFlowNode[]
  
  // Edge Aggregation Handling
  renderOriginalEdge(edge: GraphEdge): ReactFlowEdge
  renderAggregatedEdge(aggregatedEdge: AggregatedEdge): ReactFlowEdge
  
  // Interaction Handling
  attachClickHandlers(nodes: ReactFlowNode[], containers: ReactFlowNode[]): void
  handleElementClick(elementId: string, elementType: 'node' | 'container'): void
}
```

### AsyncCoordinator

**Purpose**: Manage async boundaries with sequential queues

**Key Responsibilities**:
- Queue ELK layout operations
- Queue ReactFlow render operations
- Queue application events
- Ensure sequential processing
- Handle error recovery

**Interface**:
```typescript
class AsyncCoordinator {
  // ELK Operations
  queueELKLayout(state: VisualizationState, config: LayoutConfig): Promise<void>
  
  // ReactFlow Operations
  queueReactFlowRender(state: VisualizationState): Promise<ReactFlowData>
  
  // Application Events
  queueApplicationEvent(event: ApplicationEvent): Promise<void>
  
  // Queue Management
  getQueueStatus(): QueueStatus
  clearQueue(): void
}
```

### InteractionHandler

**Purpose**: Handle user interactions with graph elements

**Key Responsibilities**:
- Process click events on nodes and containers
- Coordinate state changes with VisualizationState
- Trigger appropriate layout updates
- Manage interaction event queuing

**Interface**:
```typescript
class InteractionHandler {
  constructor(visualizationState: VisualizationState, asyncCoordinator: AsyncCoordinator)
  
  // Click Event Handling
  handleNodeClick(nodeId: string): void
  handleContainerClick(containerId: string): void
  
  // Event Processing
  processClickEvent(elementId: string, elementType: 'node' | 'container'): void
  
  // State Coordination
  triggerLayoutUpdate(): void
}
```

## Data Models

### Core Data Types

```typescript
interface GraphNode {
  id: string
  label: string // Short label displayed by default
  longLabel: string // Full label displayed on click toggle
  type: string
  semanticTags: string[]
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
  hidden: boolean
  showingLongLabel?: boolean // UI state for label toggle
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  semanticTags: string[]
  hidden: boolean
}

interface Container {
  id: string
  label: string
  children: Set<string>
  collapsed: boolean
  hidden: boolean
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
}

interface AggregatedEdge {
  id: string
  source: string // Source endpoint (node or container ID)
  target: string // Target endpoint (node or container ID)
  type: string
  semanticTags: string[]
  hidden: boolean
  aggregated: true // Always true for aggregated edges
  originalEdgeIds: string[] // IDs of original edges that were aggregated into this edge
  aggregationSource: string // Container ID that caused the aggregation
}

interface LayoutState {
  phase: 'initial' | 'laying_out' | 'ready' | 'rendering' | 'displayed' | 'error'
  layoutCount: number
  lastUpdate: number
  error?: string
}

interface SearchResult {
  id: string
  label: string
  type: 'node' | 'container'
  matchIndices: number[][]
}

interface ClickEvent {
  elementId: string
  elementType: 'node' | 'container'
  timestamp: number
  position: { x: number; y: number }
}

interface InteractionState {
  nodeLabelsExpanded: Set<string> // Node IDs showing long labels
  recentClicks: Map<string, number> // Element ID -> timestamp for debouncing
}
```

### ReactFlow Data Types

```typescript
interface ReactFlowData {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
}

interface ReactFlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    longLabel?: string
    showingLongLabel?: boolean
    nodeType: string
    collapsed?: boolean
    containerChildren?: number
    onClick?: (elementId: string, elementType: 'node' | 'container') => void
  }
  style?: CSSProperties
}

interface ReactFlowEdge {
  id: string
  source: string
  target: string
  type: string
  style?: CSSProperties
}
```

## Error Handling

### Error Categories

1. **Parse Errors**: Invalid input data format
2. **Validation Errors**: Invariant violations in VisualizationState
3. **Layout Errors**: ELK processing failures
4. **Render Errors**: ReactFlow conversion failures
5. **Queue Errors**: Async operation failures

### Error Recovery Strategy

```typescript
interface ErrorHandler {
  handleParseError(error: ParseError): void
  handleValidationError(error: ValidationError): void
  handleLayoutError(error: LayoutError): void
  handleRenderError(error: RenderError): void
  handleQueueError(error: QueueError): void
}
```

### Error Boundaries

- **Core Layer**: Validation errors are caught and reported, state is rolled back
- **Bridge Layer**: Conversion errors are caught and default values provided
- **Async Layer**: Queue errors are caught, operations are retried or skipped

## Testing Strategy

### Test-Driven Development (TDD) Approach

**Core TDD Principles**:
1. **Red-Green-Refactor Cycle**: Write failing test → Make it pass → Improve code
2. **Tests First**: No production code without a failing test
3. **Incremental Development**: Each test adds one small piece of functionality
4. **Continuous Integration**: All tests pass after every commit
5. **Paxos.json Validation**: Real-world data testing at every integration point

### Unit Testing

**VisualizationState Tests** (TDD Approach):
- **RED**: Write tests for node CRUD operations → **GREEN**: Implement operations → **REFACTOR**: Optimize
- **RED**: Write tests for container expand/collapse → **GREEN**: Implement logic → **REFACTOR**: Improve performance
- **RED**: Write tests for layout state management → **GREEN**: Implement tracking → **REFACTOR**: Clean up
- **RED**: Write tests for search functionality → **GREEN**: Implement search → **REFACTOR**: Optimize algorithms
- **RED**: Write tests for invariant validation → **GREEN**: Implement validation → **REFACTOR**: Improve error messages

**Bridge Tests** (TDD Approach):
- **RED**: Write tests for ELK conversion accuracy → **GREEN**: Implement conversion → **REFACTOR**: Optimize
- **RED**: Write tests for ReactFlow conversion → **GREEN**: Implement conversion → **REFACTOR**: Improve performance
- **RED**: Write tests for style application → **GREEN**: Implement styling → **REFACTOR**: Clean up code
- **RED**: Write tests for error handling → **GREEN**: Implement error cases → **REFACTOR**: Improve recovery

**AsyncCoordinator Tests** (TDD Approach):
- **RED**: Write tests for queue ordering → **GREEN**: Implement FIFO queue → **REFACTOR**: Optimize
- **RED**: Write tests for error recovery → **GREEN**: Implement retry logic → **REFACTOR**: Improve resilience
- **RED**: Write tests for performance under load → **GREEN**: Implement optimizations → **REFACTOR**: Fine-tune

### Integration Testing

**Core Integration Tests**:
- VisualizationState + ELKBridge integration
- VisualizationState + ReactFlowBridge integration
- End-to-end data flow through all components

**Paxos.json Integration Tests (Incremental Validation)**:

**Phase 1 Checkpoints**:
- **After Task 2.1**: Load paxos.json nodes/edges into VisualizationState - verify all data is stored correctly
- **After Task 2.2**: Load paxos.json containers - verify hierarchy relationships are correct
- **After Task 2.3**: Test container expand/collapse with paxos.json - verify visibility states
- **After Task 4.2**: Search paxos.json nodes - verify search results and highlighting

**Phase 2 Checkpoints**:
- **After Task 6.2**: Run ELK layout on paxos.json - verify all containers have positions
- **After Task 7.1**: Convert paxos.json to ReactFlow format - verify node/edge structure
- **After Task 8.3**: Complete pipeline test - verify paxos.json flows through parse → layout → render

**Phase 3 Checkpoints**:
- **After Task 9.3**: Test async operations with paxos.json - verify queue processing
- **After Task 11.2**: Test rapid container operations - verify no race conditions

**Phase 4 Checkpoints**:
- **After Task 13.2**: Load paxos.json through UI - verify file upload works
- **After Task 14.2**: Search paxos.json through UI - verify search integration

**Phase 5 Checkpoints**:
- **After Task 16.3**: Browser test with paxos.json - verify visual rendering matches expected output
- **After Task 17.1**: Performance test with paxos.json - verify acceptable load times

### End-to-End Testing

**Browser Tests with Playwright**:
- Load paxos.json in browser
- Verify visual rendering matches expected output
- Test container expand/collapse interactions
- Test search functionality
- Test performance with large graphs

### Test Data Management

**Paxos.json as Primary Test Case**:
- Use paxos.json for all integration and e2e tests
- Create smaller subsets for unit tests
- Generate synthetic data for edge cases
- Maintain test data versioning

## Performance Considerations

### Memory Management

- Use efficient data structures (Maps, Sets) for lookups
- Implement object pooling for frequently created objects
- Clear unused references promptly
- Monitor memory usage in tests

### Layout Performance

- Cache ELK results when possible
- Implement incremental layout updates
- Use layout hints to optimize ELK processing
- Profile layout operations and optimize bottlenecks

### Rendering Performance

- Generate immutable ReactFlow data to enable React optimizations
- Implement virtual scrolling for large graphs
- Use React.memo and useMemo strategically
- Profile render operations and optimize bottlenecks

## Development Phases

### Phase 1: Core Foundation
- Implement VisualizationState with comprehensive tests
- Build basic data management and validation
- Implement container operations
- Test with paxos.json data

### Phase 2: Bridge Implementation
- Implement ELKBridge with full test coverage
- Implement ReactFlowBridge with full test coverage
- Test bridge integrations with VisualizationState
- Verify paxos.json flows through entire pipeline

### Phase 3: Async Coordination
- Implement AsyncCoordinator with queue management
- Integrate ELK async operations
- Integrate ReactFlow async operations
- Test async boundary behavior

### Phase 4: Application Integration
- Build React components using the core system
- Implement file upload and parsing
- Implement search UI
- Implement container controls

### Phase 5: End-to-End Validation
- Comprehensive Playwright tests
- Performance testing and optimization
- Error handling validation
- Production readiness verification

## Success Criteria

1. **Functionality**: All paxos.json operations work correctly
2. **Performance**: Layout and rendering complete within acceptable time limits
3. **Reliability**: No race conditions or timing issues
4. **Maintainability**: Clear separation of concerns and comprehensive tests
5. **Autonomous Development**: Kiro can implement and test each component independently