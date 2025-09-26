/**
 * Core data types for Hydroscope rewrite
 * Enforces architectural constraints: React-free, stateless bridges
 */

export interface GraphNode {
  id: string;
  label: string;
  longLabel: string;
  type: string;
  semanticTags: string[];
  position?: { x: number; y: number };
  dimensions?: { width: number; height: number };
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
  children: Set<string>;
  collapsed: boolean;
  hidden: boolean;
  position?: { x: number; y: number };
  dimensions?: { width: number; height: number };
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
}

export interface InvariantViolation {
  type: string;
  message: string;
  entityId?: string;
  severity: "error" | "warning";
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
  nodeSize?: { width: number; height: number };
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
  nodeStyles?: Record<string, any>;
  edgeStyles?: Record<string, any>;
  containerStyles?: Record<string, any>;
  // Semantic tag to visual style mappings
  semanticMappings?: Record<
    string,
    Record<string, Record<string, string | number>>
  >;
  // Direct property mappings (legacy support)
  propertyMappings?: Record<string, string | EdgeStyleMapping>;
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
  position: { x: number; y: number };
  data: {
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
  };
  style?: Record<string, any>;
  parentNode?: string;
  parentId?: string;
  extent?: 'parent' | [[number, number], [number, number]];
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  style?: Record<string, any>;
  animated?: boolean;
  label?: string;
  markerEnd?: string | object;
  data?: {
    semanticTags?: string[];
    appliedSemanticTags?: string[];
    lineStyle?: "single" | "double";
    originalEdge?: any;
    originalEdgeIds?: string[];
    aggregationSource?: string;
    aggregated?: boolean;
  };
}

export interface ELKNode {
  id: string;
  children?: ELKNode[];
  edges?: ELKEdge[];
  layoutOptions?: Record<string, any>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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
  type: "elk_layout" | "reactflow_render" | "application_event";
  operation: () => Promise<T>;
  timeout?: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
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
    | "search"
    | "layout_config_change";
  payload: ApplicationEventPayload;
  timestamp: number;
}

export interface ApplicationEventPayload {
  // Common fields
  state?: any; // VisualizationState - using any to avoid circular dependency
  triggerLayout?: boolean;
  layoutConfig?: LayoutConfig;

  // Container operation fields
  containerId?: string;

  // Search fields
  query?: string;
  expandContainers?: boolean;

  // Layout config change fields
  config?: LayoutConfig;
}

// File upload and parsing types
export interface HydroscopeData {
  nodes: any[]; // Raw node data from JSON
  edges: any[]; // Raw edge data from JSON
  hierarchyChoices: HierarchyChoice[];
  nodeAssignments: Record<string, Record<string, string>>;
  nodeTypeConfig?: any;
  edgeStyleConfig?: any;
  legend?: any;
  styles?: any;
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
  context?: Record<string, any>;
}
