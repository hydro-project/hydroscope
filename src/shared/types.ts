import type { NodeStyle, EdgeStyle, ContainerStyle } from "./config";
import type { GraphNode } from "../types/core.js";
// External-facing container type (no expandedDimensions)
export interface ExternalContainer {
  id: string;
  collapsed: boolean;
  hidden: boolean;
  children: Set<string>;
  layout?: LayoutState;
  label?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  expandedDimensions?: Dimensions;
  style?: ContainerStyle | string;
  semanticTags?: string[];
}
/**
 * @fileoverview Type definitions for the Vis component
 *
 * Core TypeScript interfaces and types for the graph visualization system.
 * These types provide compile-time safety and better developer experience.
 */
export interface Dimensions {
  width: number;
  height: number;
}
export interface Position {
  x: number;
  y: number;
}
export interface ElkEdgeSection {
  startPoint: Position;
  endPoint: Position;
  bendPoints?: Position[]; // Optional bend points for complex routing
}
export interface LayoutState {
  position?: Position;
  dimensions?: Dimensions;
  sections?: ElkEdgeSection[]; // ELK edge routing sections
  elkFixed?: boolean; // Whether ELK should fix this element's position
  elkLayoutOptions?: Record<string, string>; // ELK-specific layout options
}
// GraphNode moved to types/core.ts to avoid duplication
// Import from there: import type { GraphNode } from '../types/core.js';
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  style?: EdgeStyle | string;
  hidden?: boolean;
  type: "graph";
  edgeProperties?: string[];
}
export interface Container {
  id: string;
  collapsed: boolean;
  hidden: boolean;
  children: Set<string>;
  width?: number;
  height?: number;
  expandedDimensions?: Dimensions;
  layout?: LayoutState; // Layout-related properties
  label?: string;
  x?: number;
  y?: number;
  style?: ContainerStyle | string;
  semanticTags?: string[];
}
export interface HyperEdge {
  id: string;
  source: string;
  target: string;
  style: EdgeStyle;
  type: "hyper";
  edgeProperties?: string[];
  hidden?: boolean;
  layout?: LayoutState;
  semanticTags?: string[];
  label?: string;
}
// ============ Input Types for Methods ============
export interface CreateNodeProps {
  label: string;
  style?: NodeStyle | string;
  hidden?: boolean;
  layout?: LayoutState;
  longLabel?: string;
  type?: string;
  semanticTags?: string[];
  showingLongLabel?: boolean;
  position?: Position;
  dimensions?: Dimensions;
}
export interface CreateEdgeProps {
  source: string;
  target: string;
  style?: EdgeStyle | string;
  hidden?: boolean;
  layout?: LayoutState;
  type?: string;
  semanticTags?: string[];
  edgeProperties?: string[];
  label?: string;
}
export interface CreateContainerProps {
  expandedDimensions?: Dimensions;
  collapsed?: boolean;
  hidden?: boolean;
  children?: string[];
  layout?: LayoutState;
  label?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  style?: ContainerStyle | string;
  semanticTags?: string[];
}
// Re-export style types for convenience in other modules
export type { NodeStyle, EdgeStyle, ContainerStyle };
// ============ Parser Types ============
export interface ParseResult {
  state: VisualizationState;
  metadata: {
    selectedGrouping: string | null;
    nodeCount: number;
    edgeCount: number;
    containerCount: number;
    hierarchyChoices?: Array<{
      id: string;
      name: string;
    }>;
    nodeTypeConfig?: Record<string, unknown>;
    edgeStyleConfig?: Record<string, unknown>;
  };
}
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
  hierarchyCount: number;
}
export interface GroupingOption {
  id: string;
  name: string;
}
// ============ Visualization State Interface ============
export interface VisualizationState {
  // Node methods
  setGraphNode(id: string, props: CreateNodeProps): GraphNode;
  getGraphNode(id: string): GraphNode | undefined;
  setNodeHidden(id: string, hidden: boolean): void;
  getNodeHidden(id: string): boolean | undefined;
  removeGraphNode(id: string): void;
  // Edge methods
  setGraphEdge(id: string, props: CreateEdgeProps): GraphEdge;
  getGraphEdge(id: string): GraphEdge | undefined;
  setEdgeHidden(id: string, hidden: boolean): void;
  getEdgeHidden(id: string): boolean | undefined;
  removeGraphEdge(id: string): void;
  // Container methods
  setContainer(id: string, props: CreateContainerProps): ExternalContainer;
  getContainer(id: string): ExternalContainer | undefined;
  setContainerHidden(id: string, hidden: boolean): void;
  getContainerHidden(id: string): boolean | undefined;
  // Visibility properties (readonly getters)
  readonly visibleNodes: GraphNode[];
  readonly visibleEdges: GraphEdge[];
  readonly visibleContainers: ExternalContainer[];
  readonly allHyperEdges: HyperEdge[];
  // Container hierarchy methods
  addContainerChild(containerId: string, childId: string): void;
  removeContainerChild(containerId: string, childId: string): void;
  getContainerChildren(containerId: string): Set<string> | undefined;
  getNodeContainer(nodeId: string): string | undefined;
  // Container operations
  collapseContainer(containerId: string): void;
  expandContainer(containerId: string): void;
}
