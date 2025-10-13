/**
 * Type definitions for AsyncCoordinator to avoid circular dependencies
 * and eliminate unsafe `any` types
 */

// Core interfaces that AsyncCoordinator needs
export interface VisualizationStateInterface {
  // Layout state management
  setLayoutPhase(phase: string): void;
  incrementLayoutCount(): void;
  getLayoutState(): any;

  // Container operations
  getContainer(id: string): any;
  getAllContainers(): any[];
  getContainerParent(id: string): string | null;
  getContainerAncestors(id: string): string[];

  // Node operations
  getGraphNode(id: string): any;
  visibleNodes: any[];
  visibleEdges: any[];
  visibleContainers: any[];

  // Render config
  updateRenderConfig(updates: any): void;
  getRenderConfig(): any;
  getColorPalette(): string;
  getEdgeStyle(): "bezier" | "straight" | "smoothstep";

  // Search functionality
  searchNodes(query: string): any[];
  highlightSearchResults(results: any[]): void;
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
    interactionHandler?: any,
  ): ReactFlowData;

  // Styling
  applyNodeStyles(nodes: any[]): any[];
  applyEdgeStyles(edges: any[], state?: VisualizationStateInterface): any[];
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
  getNodes(): any[];
  getEdges(): any[];
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

export interface ReactFlowData {
  nodes: any[];
  edges: any[];
  _timestamp?: number;
  _changeId?: string;
}

// Note: QueueOptions is imported from "../types/core" to avoid duplication

export interface PipelineOptions {
  relayoutEntities?: string[];
  fitView?: boolean;
  fitViewOptions?: { padding?: number; duration?: number };
  timeout?: number;
  maxRetries?: number;
}

export interface ContainerOperationOptions {
  relayoutEntities?: string[];
  fitView?: boolean;
  fitViewOptions?: { padding?: number; duration?: number };
  timeout?: number;
  maxRetries?: number;
}
