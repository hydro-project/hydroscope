/**
 * Core data types for Hydroscope rewrite
 * Enforces architectural constraints: React-free, stateless bridges
 */

export interface GraphNode {
  id: string
  label: string
  longLabel: string
  type: string
  semanticTags: string[]
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
  hidden: boolean
  showingLongLabel?: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  semanticTags: string[]
  hidden: boolean
}

export interface Container {
  id: string
  label: string
  children: Set<string>
  collapsed: boolean
  hidden: boolean
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
  width?: number
  height?: number
  x?: number
  y?: number
}

export interface AggregatedEdge {
  id: string
  source: string
  target: string
  type: string
  semanticTags: string[]
  hidden: boolean
  aggregated: true
  originalEdgeIds: string[]
  aggregationSource: string
}

export interface LayoutState {
  phase: 'initial' | 'laying_out' | 'ready' | 'rendering' | 'displayed' | 'error'
  layoutCount: number
  lastUpdate: number
  error?: string
}

export interface SearchResult {
  id: string
  label: string
  type: 'node' | 'container'
  matchIndices: number[][]
}

export interface InvariantViolation {
  type: string
  message: string
  entityId?: string
  severity: 'error' | 'warning'
}

export interface LayoutConfig {
  algorithm?: string
  spacing?: number
  direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT'
}

export interface StyleConfig {
  nodeStyles?: Record<string, any>
  edgeStyles?: Record<string, any>
  containerStyles?: Record<string, any>
}

export interface ReactFlowData {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
}

export interface ReactFlowNode {
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
  style?: Record<string, any>
}

export interface ReactFlowEdge {
  id: string
  source: string
  target: string
  type: string
  style?: Record<string, any>
}

export interface ELKNode {
  id: string
  children?: ELKNode[]
  edges?: ELKEdge[]
  layoutOptions?: Record<string, any>
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface ELKEdge {
  id: string
  sources: string[]
  targets: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}