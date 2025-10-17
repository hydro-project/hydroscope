/**
 * Type definitions for AsyncCoordinator to avoid circular dependencies
 * and eliminate unsafe `any` types
 */

import type {
  GraphNode,
  Container,
  GraphEdge,
  LayoutState,
  SearchResult,
  ReactFlowData,
  ReactFlowNode,
  ReactFlowEdge,
} from "./core.js";

// Core interfaces that AsyncCoordinator needs
export interface VisualizationStateInterface {
  // Layout state management
  setLayoutPhase(phase: string): void;
  incrementLayoutCount(): void;
  getLayoutState(): LayoutState;

  // Container operations
  getContainer(id: string): Container | undefined;
  getAllContainers(): Container[];
  getContainerParent(id: string): string | null;
  getContainerAncestors(id: string): string[];

  // Node operations
  getGraphNode(id: string): GraphNode | undefined;
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  visibleContainers: Container[];

  // Render config
  updateRenderConfig(updates: Partial<RenderConfig>): void;
  getRenderConfig(): RenderConfig;
  getColorPalette(): string;
  getEdgeStyle(): "bezier" | "straight" | "smoothstep";

  // Search functionality
  searchNodes(query: string): SearchResult[];
  highlightSearchResults(results: SearchResult[]): void;
  clearSearchHighlights(): void;

  // Navigation
  highlightElement(elementId: string): void;
  clearHighlights(): void;
}

export interface ELKBridgeInterface {
  // Layout execution
  layout(state: VisualizationStateInterface): Promise<void>;

  // Configuration management
  updateConfiguration(config: Partial<LayoutConfig>): void;
  getConfiguration(): LayoutConfig;
  resetConfiguration(): void;
}

export interface ReactFlowBridgeInterface {
  // Data conversion
  toReactFlowData(
    state: VisualizationStateInterface,
    interactionHandler?: InteractionHandler,
  ): ReactFlowData;

  // Styling
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[];
  applyEdgeStyles(edges: ReactFlowEdge[], state?: VisualizationStateInterface): ReactFlowEdge[];
}

export interface ReactFlowInstanceInterface {
  // Viewport operations
  fitView(options?: {
    padding?: number;
    duration?: number;
    includeHiddenNodes?: boolean;
  }): void;
  getViewport(): { x: number; y: number; zoom: number };
  setViewport(viewport: { x: number; y: number; zoom: number }): void;

  // Node operations
  getNodes(): ReactFlowNode[];
  getEdges(): ReactFlowEdge[];
}

// Configuration interfaces
export interface LayoutConfig {
  algorithm: string;
  direction?: string;
  spacing?: number;
  nodeSpacing?: number;
  containerPadding?: number;
  hierarchicalLayout?: boolean;
  aspectRatio?: number;
  nodeSize?: { width: number; height: number };
  mergeHierarchyEdges?: boolean;
}

// Re-export ReactFlowData and related types from core
export type { ReactFlowData, ReactFlowNode, ReactFlowEdge } from "./core.js";

// Note: QueueOptions is imported from "../types/core" to avoid duplication

export interface PipelineOptions {
  relayoutEntities?: string[];
  fitView?: boolean;
  fitViewOptions?: { padding?: number; duration?: number; includeHiddenNodes?: boolean };
  timeout?: number;
  maxRetries?: number;
}

export interface ContainerOperationOptions {
  relayoutEntities?: string[];
  fitView?: boolean;
  fitViewOptions?: { padding?: number; duration?: number; includeHiddenNodes?: boolean };
  timeout?: number;
  maxRetries?: number;
}

// Render config interface
export interface RenderConfig {
  colorPalette: string;
  edgeStyle: "bezier" | "straight" | "smoothstep";
  showNodeLabels?: boolean;
  showEdgeLabels?: boolean;
  theme?: "light" | "dark";
  [key: string]: unknown; // Allow additional config properties
}

// Interaction handler interface
export interface InteractionHandler {
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onContainerClick?: (containerId: string) => void;
  updateConfig?: (config: { disableNodeClicks?: boolean }) => void;
  [key: string]: unknown; // Allow additional handler methods
}
