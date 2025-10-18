/**
 * Core data types for Hydroscope rewrite
 * Enforces architectural constraints: React-free, stateless bridges
 */
/**
 * GraphNode represents a node in the visualization graph.
 *
 * Label handling:
 * - label: Short display label (mapped from JSON's shortLabel or label field)
 * - longLabel: Full descriptive label (mapped from JSON's fullLabel or longLabel field)
 *
 * The JSONParser automatically maps various JSON field names to these properties,
 * providing flexibility in the input format while maintaining a consistent internal API.
 */
export interface GraphNode {
  id: string;
  label: string;
  longLabel: string;
  type: string;
  semanticTags: string[];
  position?: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
  hidden: boolean;
  showingLongLabel?: boolean;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  semanticTags: string[];
  hidden: boolean;
}
export interface Container {
  id: string;
  label: string;
  longLabel?: string; // Optional long label for detailed container descriptions
  children: Set<string>;
  collapsed: boolean;
  hidden: boolean;
  position?: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}
export interface AggregatedEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  semanticTags: string[];
  hidden: boolean;
  aggregated: true;
  originalEdgeIds: string[];
  aggregationSource: string;
}
export interface LayoutState {
  phase:
    | "initial"
    | "laying_out"
    | "ready"
    | "rendering"
    | "displayed"
    | "error";
  layoutCount: number;
  lastUpdate: number;
  error?: string;
}
export interface SearchResult {
  id: string;
  label: string;
  type: "node" | "container";
  matchIndices: number[][];
  hierarchyPath?: string[]; // Path from root to item
  confidence?: number; // Search relevance score
}
export interface InvariantViolation {
  type: string;
  message: string;
  entityId?: string;
  severity: "error" | "warning";
}
export interface SearchNavigationState {
  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
  treeSearchHighlights: Set<string>; // IDs of highlighted elements in tree hierarchy
  graphSearchHighlights: Set<string>; // IDs of highlighted elements in ReactFlow graph
  // Navigation state
  navigationSelection: string | null; // Currently selected element
  treeNavigationHighlights: Set<string>; // Navigation highlights in tree hierarchy
  graphNavigationHighlights: Set<string>; // Navigation highlights in ReactFlow graph
  // Temporary click feedback highlights (glow effect)
  temporaryHighlights: Set<string>; // Elements that should glow briefly after click
  temporaryHighlightTimestamps: Map<string, number>; // Per-element timestamps for independent animation timing
  // Expansion state (persists through search operations)
  expandedTreeNodes: Set<string>; // Currently expanded tree hierarchy nodes
  expandedGraphContainers: Set<string>; // Currently expanded ReactFlow graph containers
  // Viewport state
  lastNavigationTarget: string | null;
  shouldFocusViewport: boolean;
}
export interface LayoutConfig {
  algorithm?: string;
  spacing?: number;
  direction?: "DOWN" | "UP" | "LEFT" | "RIGHT";
  // Advanced ELK configuration options
  nodeSpacing?: number;
  layerSpacing?: number;
  edgeSpacing?: number;
  portSpacing?: number;
  // Performance optimizations
  separateConnectedComponents?: boolean;
  mergeEdges?: boolean;
  mergeHierarchyEdges?: boolean;
  // Layout hints
  aspectRatio?: number;
  nodeSize?: {
    width: number;
    height: number;
  };
  containerPadding?: number;
  // Large graph optimizations
  hierarchicalLayout?: boolean;
  compactLayout?: boolean;
  interactiveLayout?: boolean;
  // ELK-specific options
  elkOptions?: Record<string, string>;
}
export interface PerformanceHints {
  nodeCount: number;
  edgeCount: number;
  containerCount: number;
  maxDepth: number;
  isLargeGraph: boolean;
  recommendedAlgorithm?: string;
  recommendedOptions?: Record<string, string>;
}
export interface StyleConfig {
  nodeStyles?: Record<string, NodeStyleConfig>;
  edgeStyles?: Record<string, EdgeStyleConfig>;
  containerStyles?: Record<string, ContainerStyleConfig>;
  // Semantic tag to visual style mappings
  semanticMappings?: Record<
    string,
    Record<string, Record<string, string | number>>
  >;
  // Direct property mappings (legacy support)
  propertyMappings?: Record<string, string | EdgeStyleMapping>;
}
export interface NodeStyleConfig {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: string | number;
  padding?: number;
  width?: number;
  height?: number;
}
export interface EdgeStyleConfig {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerEnd?: string;
  animated?: boolean;
  type?: "bezier" | "straight" | "smoothstep";
}
export interface ContainerStyleConfig {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  opacity?: number;
}
interface EdgeStyleMapping {
  reactFlowType?: string;
  style?: Record<string, unknown>;
  animated?: boolean;
  label?: string;
  styleTag?: string;
}
export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}
export interface ReactFlowNode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: ReactFlowNodeData;
  style?: Record<string, string | number>;
  parentNode?: string;
  parentId?: string;
  extent?: "parent" | [[number, number], [number, number]];
  // CRITICAL FIX: Add width and height properties for fitView calculations
  width?: number;
  height?: number;
}
export interface ReactFlowNodeData {
  label: string;
  longLabel?: string;
  showingLongLabel?: boolean;
  nodeType: string;
  collapsed?: boolean;
  containerChildren?: number;
  semanticTags?: string[];
  appliedSemanticTags?: string[];
  onClick?: (elementId: string, elementType: "node" | "container") => void;
  width?: number;
  height?: number;
  nodeCount?: number;
  colorPalette?: string;
  style?: string;
  [key: string]: unknown; // Index signature for compatibility
}
export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  style?: Record<string, string | number>;
  animated?: boolean;
  label?: string;
  markerEnd?:
    | string
    | {
        type: string;
        color?: string;
        strokeWidth?: number;
      };
  data?: ReactFlowEdgeData;
}
export interface ReactFlowEdgeData {
  semanticTags?: string[];
  appliedSemanticTags?: string[];
  lineStyle?: "single" | "double";
  originalEdge?: GraphEdge;
  originalEdgeIds?: string[];
  aggregationSource?: string;
  aggregated?: boolean;
}
export interface ELKNode {
  id: string;
  children?: ELKNode[];
  edges?: ELKEdge[];
  layoutOptions?: Record<string, string | number | boolean>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  labels?: Array<{
    text: string;
    width?: number;
    height?: number;
  }>;
  ports?: Array<{
    id: string;
    x?: number;
    y?: number;
  }>;
}
export interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
}
export interface ELKValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
// AsyncCoordinator types
export interface QueuedOperation<T = any> {
  id: string;
  type:
    | "elk_layout"
    | "reactflow_render"
    | "application_event"
    | "render_config_update"
    | "hierarchy_change"
    | "expand-tree-node"
    | "collapse-tree-node"
    | "expand-all-tree-nodes"
    | "collapse-all-tree-nodes"
    | "navigate-to-element"
    | "focus-viewport"
    | "synchronous_pipeline" // For synchronous pipeline operations
    // High-priority core operations
    | "layout_and_render_pipeline"
    | "process_data_change"
    | "dimension_change_with_remount"
    | "layout_and_render_with_remount"
    // Container operations
    | "expand_container"
    | "collapse_container"
    | "expand_containers"
    | "collapse_containers"
    | "expand_container_with_ancestors"
    // Search operations
    | "update_search_results"
    | "clear_search"
    | "execute_search_pipeline"
    | "search_with_expansion"
    // Config and navigation operations
    | "update_render_config"
    | "navigate_to_element"
    | "focus_viewport_on_element";
  operation: () => Promise<T>;
  timeout?: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
  result?: T;
}
export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  currentOperation?: QueuedOperation;
  averageProcessingTime: number;
  errors: Error[];
}
export interface ApplicationEvent {
  type:
    | "container_expand"
    | "container_collapse"
    | "container_toggle"
    | "container_expand_all"
    | "search"
    | "layout_config_change";
  payload: ApplicationEventPayload;
  timestamp: number;
}
export interface ApplicationEventPayload {
  // Common fields
  state?: unknown; // VisualizationState - avoiding circular dependency
  triggerLayout?: boolean;
  layoutConfig?: LayoutConfig;
  triggerValidation?: boolean; // New field for triggering ReactFlow validation
  isTreeOperation?: boolean; // New field for tree hierarchy operations
  // Container operation fields
  containerId?: string;
  containerIds?: string[];
  // Search fields
  query?: string;
  expandContainers?: boolean;
  // Layout config change fields
  config?: LayoutConfig;
}
// File upload and parsing types
export interface HydroscopeData {
  nodes: RawNodeData[]; // Raw node data from JSON
  edges: RawEdgeData[]; // Raw edge data from JSON
  hierarchyChoices: HierarchyChoice[];
  nodeAssignments: Record<string, Record<string, string>>;
  nodeTypeConfig?: NodeTypeConfig;
  edgeStyleConfig?: {
    note?: string;
    semanticMappings?: Record<
      string,
      Record<string, Record<string, string | number>>
    >;
  };
  legend?: LegendConfig;
  styles?: StyleConfig;
}
export interface RawNodeData {
  id: string;
  label?: string;
  longLabel?: string;
  type?: string;
  style?: string;
  semanticTags?: string[];
  position?: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
  hidden?: boolean;
  [key: string]: unknown; // Allow additional properties from JSON
}
export interface RawEdgeData {
  id: string;
  source: string;
  target: string;
  type?: string;
  style?: string;
  semanticTags?: string[];
  edgeProperties?: string[];
  hidden?: boolean;
  label?: string;
  [key: string]: unknown; // Allow additional properties from JSON
}
export interface NodeTypeConfig {
  types: Array<{
    id: string;
    label?: string;
    colorIndex?: number;
    description?: string;
    style?: NodeStyleConfig;
  }>;
}
export interface LegendConfig {
  title?: string;
  items: Array<{
    type: string;
    label: string;
    description?: string;
    color?: string;
  }>;
}
export interface HierarchyChoice {
  id: string;
  name: string;
  children?: HierarchyChoice[];
}
export interface ParseError {
  type: "json_parse" | "processing_error";
  message: string;
  line?: number;
  column?: number;
  context?: Record<string, any>;
}
export interface ValidationResult {
  type: string;
  message: string;
  severity: "error" | "warning" | "info";
  context?: Record<string, unknown>;
}
export interface EdgeValidationResult {
  isValid: boolean;
  isFloating: boolean;
  reason: string;
  sourceExists: boolean;
  targetExists: boolean;
  sourceInAllNodes: boolean;
  targetInAllNodes: boolean;
  sourceType:
    | "node"
    | "container"
    | "hidden-node"
    | "hidden-container"
    | "unknown"
    | "missing";
  targetType:
    | "node"
    | "container"
    | "hidden-node"
    | "hidden-container"
    | "unknown"
    | "missing";
  suggestedFix?: string;
  hierarchyLevel?: number;
}
export interface ContainerExpansionValidationResult {
  canExpand: boolean;
  issues: string[];
  affectedEdges: string[];
  edgeValidationResults: EdgeValidationResult[];
}
export interface EdgeRestorationResult {
  validEdges: string[];
  invalidEdges: Array<{
    id: string;
    reason: string;
  }>;
  fixedEdges: string[];
}
export interface ContainerExpansionState {
  containerId: string;
  preExpansionState: {
    collapsed: boolean;
    hidden: boolean;
    childrenVisible: string[];
    timestamp: number;
  };
  postExpansionState?: {
    collapsed: boolean;
    hidden: boolean;
    childrenVisible: string[];
    restoredEdges: string[];
    invalidEdges: string[];
    timestamp: number;
  };
  validationResults: {
    preExpansion: ContainerExpansionValidationResult;
    postExpansion?: EdgeRestorationResult;
  };
}
