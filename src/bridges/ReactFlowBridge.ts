/**
 * ReactFlowBridge - Stateless bridge for ReactFlow rendering
 * Architectural constraints: Stateless, synchronous conversions, immutable output
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import type {
  StyleConfig,
  ReactFlowData,
  ReactFlowNode,
  ReactFlowEdge,
} from "../types/core.js";
import { processSemanticTags } from "../utils/StyleProcessor.js";

// Performance optimization constants
const LARGE_GRAPH_NODE_THRESHOLD = 1000;
const LARGE_GRAPH_EDGE_THRESHOLD = 2000;
const PERFORMANCE_CACHE_SIZE = 100;
const CACHE_CLEANUP_THRESHOLD = 500; // Clean cache when it exceeds this size

export class ReactFlowBridge {
  private styleCache = new Map<string, any>();
  private nodeCache = new Map<string, ReactFlowNode>();
  private containerCache = new Map<string, ReactFlowNode[]>();
  private edgeCache = new Map<string, ReactFlowEdge>();
  private lastStateHash: string | null = null;
  private lastResult: ReactFlowData | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private lastCacheCleanup = Date.now();

  constructor(private styleConfig: StyleConfig) {}

  // Clear caches when needed (for testing or memory management)
  clearCaches(): void {
    this.styleCache.clear();
    this.nodeCache.clear();
    this.containerCache.clear();
    this.edgeCache.clear();
    this.lastStateHash = null;
    this.lastResult = null;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // Get cache statistics for performance monitoring
  getCacheStats(): {
    hitRate: number;
    totalRequests: number;
    cacheSize: {
      styles: number;
      nodes: number;
      edges: number;
    };
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      totalRequests,
      cacheSize: {
        styles: this.styleCache.size,
        nodes: this.nodeCache.size,
        edges: this.edgeCache.size,
      },
    };
  }

  // Intelligent cache cleanup
  private cleanupCaches(): void {
    const now = Date.now();

    // Only cleanup if enough time has passed and caches are large
    if (
      now - this.lastCacheCleanup < 60000 || // 1 minute
      this.nodeCache.size + this.edgeCache.size < CACHE_CLEANUP_THRESHOLD
    ) {
      return;
    }

    // Keep only the most recently used items (simple LRU approximation)
    if (this.nodeCache.size > PERFORMANCE_CACHE_SIZE) {
      const entries = Array.from(this.nodeCache.entries());
      this.nodeCache.clear();
      // Keep last 50% of entries
      entries
        .slice(-Math.floor(PERFORMANCE_CACHE_SIZE / 2))
        .forEach(([key, value]) => {
          this.nodeCache.set(key, value);
        });
    }

    if (this.edgeCache.size > PERFORMANCE_CACHE_SIZE) {
      const entries = Array.from(this.edgeCache.entries());
      this.edgeCache.clear();
      entries
        .slice(-Math.floor(PERFORMANCE_CACHE_SIZE / 2))
        .forEach(([key, value]) => {
          this.edgeCache.set(key, value);
        });
    }

    this.lastCacheCleanup = now;
  }

  // Synchronous Conversion with immutability and performance optimizations
  toReactFlowData(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowData {
    // Generate state hash for caching
    const stateHash = this.generateStateHash(state, interactionHandler);

    // Return cached result if state hasn't changed
    if (this.lastStateHash === stateHash && this.lastResult) {
      return this.deepCloneReactFlowData(this.lastResult);
    }

    // Detect large graphs for performance optimizations
    const isLargeGraph = this.isLargeGraph(state);

    // Convert with appropriate optimization strategy
    const nodes = isLargeGraph
      ? this.convertNodesOptimized(state, interactionHandler)
      : this.convertNodes(state, interactionHandler);

    const edges = isLargeGraph
      ? this.convertEdgesOptimized(state)
      : this.convertEdges(state);

    // Create result with mutable arrays for ReactFlow compatibility
    const result: ReactFlowData = {
      nodes: this.applyNodeStyles(nodes),
      edges: this.applyEdgeStyles(edges),
    };

    // Deep freeze the result for immutability while maintaining TypeScript compatibility
    this.deepFreezeReactFlowData(result);

    // Cache result for performance
    this.lastStateHash = stateHash;
    this.lastResult = result;

    // Return deep clone to ensure immutability
    return this.deepCloneReactFlowData(result);
  }

  // Performance optimization helpers
  private generateStateHash(
    state: VisualizationState,
    interactionHandler?: any,
  ): string {
    // Simple hash based on visible element counts and interaction handler presence
    const nodeCount = state.visibleNodes.length;
    const edgeCount = state.visibleEdges.length;
    const containerCount = state.visibleContainers.length;
    const hasHandler = !!interactionHandler;

    // Include layout state for cache invalidation
    const layoutState = state.getLayoutState();

    return `${nodeCount}-${edgeCount}-${containerCount}-${hasHandler}-${layoutState.lastUpdate}`;
  }

  private isLargeGraph(state: VisualizationState): boolean {
    return (
      state.visibleNodes.length > LARGE_GRAPH_NODE_THRESHOLD ||
      state.visibleEdges.length > LARGE_GRAPH_EDGE_THRESHOLD
    );
  }

  private deepFreezeReactFlowData(data: ReactFlowData): void {
    // Freeze the top-level object and arrays
    Object.freeze(data);
    Object.freeze(data.nodes);
    Object.freeze(data.edges);

    // Freeze each node and its nested objects
    data.nodes.forEach((node) => {
      Object.freeze(node);
      Object.freeze(node.position);
      Object.freeze(node.data);
      if (node.data.semanticTags) Object.freeze(node.data.semanticTags);
      if (node.data.appliedSemanticTags)
        Object.freeze(node.data.appliedSemanticTags);
      if (node.style) Object.freeze(node.style);
    });

    // Freeze each edge and its nested objects
    data.edges.forEach((edge) => {
      Object.freeze(edge);
      if (edge.data) {
        Object.freeze(edge.data);
        if (edge.data.semanticTags) Object.freeze(edge.data.semanticTags);
        if (edge.data.appliedSemanticTags)
          Object.freeze(edge.data.appliedSemanticTags);
        if (edge.data.originalEdgeIds) Object.freeze(edge.data.originalEdgeIds);
      }
      if (edge.style) Object.freeze(edge.style);
    });
  }

  private deepCloneReactFlowData(data: ReactFlowData): ReactFlowData {
    const clonedNodes = data.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: {
        ...node.data,
        // Deep clone onClick function reference (but not the function itself)
        onClick: node.data.onClick,
        semanticTags: node.data.semanticTags
          ? [...node.data.semanticTags]
          : undefined,
        appliedSemanticTags: node.data.appliedSemanticTags
          ? [...node.data.appliedSemanticTags]
          : undefined,
      },
      style: node.style ? { ...node.style } : undefined,
    }));

    const clonedEdges = data.edges.map((edge) => ({
      ...edge,
      style: edge.style ? { ...edge.style } : undefined,
      data: edge.data
        ? {
            ...edge.data,
            semanticTags: edge.data.semanticTags
              ? [...edge.data.semanticTags]
              : undefined,
            appliedSemanticTags: edge.data.appliedSemanticTags
              ? [...edge.data.appliedSemanticTags]
              : undefined,
            originalEdgeIds: edge.data.originalEdgeIds
              ? [...edge.data.originalEdgeIds]
              : undefined,
          }
        : undefined,
    }));

    const clonedResult = {
      nodes: clonedNodes,
      edges: clonedEdges,
    };

    // Deep freeze the cloned result
    this.deepFreezeReactFlowData(clonedResult);

    return clonedResult;
  }

  // Optimized conversion for large graphs - use same logic as regular conversion
  private convertNodesOptimized(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowNode[] {
    // For now, use the same logic as regular conversion
    // TODO: Add caching and batching optimizations
    return this.convertNodes(state, interactionHandler);
  }

  private convertEdgesOptimized(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = [];
    const visibleEdges = state.visibleEdges;

    // Batch process edges for better performance
    for (let i = 0; i < visibleEdges.length; i++) {
      const edge = visibleEdges[i];
      const cacheKey = `edge-${edge.id}-${edge.type}`;

      let reactFlowEdge = this.edgeCache.get(cacheKey);
      if (!reactFlowEdge) {
        if ("aggregated" in edge && edge.aggregated) {
          reactFlowEdge = this.renderAggregatedEdge(edge);
        } else {
          reactFlowEdge = this.renderOriginalEdge(edge);
        }

        // Limit cache size to prevent memory issues
        if (this.edgeCache.size < PERFORMANCE_CACHE_SIZE) {
          this.edgeCache.set(cacheKey, reactFlowEdge);
        }
      }

      edges.push(reactFlowEdge);
    }

    return edges;
  }

  private createReactFlowNode(
    node: any,
    interactionHandler?: any,
  ): ReactFlowNode {
    return {
      id: node.id,
      type: "standard",
      position:
        node.position ||
        (() => {
          throw new Error(
            `Node ${node.id} is missing position data. ELK layout must be calculated before rendering.`,
          );
        })(),
      data: {
        label: node.showingLongLabel ? node.longLabel : node.label,
        longLabel: node.longLabel,
        showingLongLabel: node.showingLongLabel,
        nodeType: node.type,
        semanticTags: node.semanticTags || [],
        onClick: interactionHandler
          ? (elementId: string, elementType: "node" | "container") => {
              if (elementType === "node") {
                interactionHandler.handleNodeClick(elementId);
              }
            }
          : undefined,
      },
    };
  }

  private convertNodes(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = [];

    // Build parent mapping for nodes and containers
    const nodeParentMap = new Map<string, string>();
    const containerParentMap = new Map<string, string>();

    // Map nodes to their parent containers
    for (const container of state.visibleContainers) {
      for (const childId of container.children) {
        nodeParentMap.set(childId, container.id);
        console.log(`[ReactFlowBridge] Node ${childId} assigned to container ${container.id}`);
      }
    }

    // Add containers first (parents before children)
    for (const container of state.visibleContainers) {
      const parentId = containerParentMap.get(container.id);
      
      // Get position and dimensions from ELK layout
      const position = container.position || { x: 0, y: 0 };
      const width = container.dimensions?.width || container.width || 200;
      const height = container.dimensions?.height || container.height || 150;
      
      // Debug: Log container info
      console.log(`[ReactFlowBridge] Processing container ${container.id}: collapsed=${container.collapsed}, children=${container.children.size}, position=(${position.x}, ${position.y})`);
      if (container.children.size > 0) {
        const childIds = Array.from(container.children).slice(0, 5); // First 5 children
        console.log(`[ReactFlowBridge] Container ${container.id} children (first 5):`, childIds);
      }
      

      
      const nodeCount = container.collapsed ? this.countContainerNodes(container, state) : 0;

      const containerNode: ReactFlowNode = {
        id: container.id,
        type: container.collapsed ? 'standard' : 'container',
        position,
        data: {
          label: container.label || container.id,
          nodeType: 'container',
          collapsed: container.collapsed,
          containerChildren: container.children.size,
          nodeCount,
          width,
          height,
          colorPalette: 'Set3',
          style: 'default',
        },
        style: {
          width,
          height,
        },
        parentId: parentId,
        extent: parentId ? 'parent' : undefined,
      };

      nodes.push(containerNode);
    }

    // Add regular nodes with proper parent relationships
    for (const node of state.visibleNodes) {
      const parentId = nodeParentMap.get(node.id);
      const parentContainer = parentId ? state.getContainer(parentId) : null;
      
      // Skip nodes that are inside collapsed containers
      if (parentContainer && parentContainer.collapsed) {
        continue;
      }

      const position = node.position;
      
      // Debug: Log all node positions from ELK
      console.log(`[ReactFlowBridge] Node ${node.id} ELK position: (${position?.x}, ${position?.y}), assigned to container: ${parentId}`);
      
      // ELK already calculates positions relative to parent containers
      // For nodes with parents, position is already relative - no conversion needed
      let adjustedPosition = position || { x: 0, y: 0 };
      
      if (parentId) {
        console.log(`[ReactFlowBridge] Node ${node.id} using ELK relative position: (${adjustedPosition.x}, ${adjustedPosition.y}) in container ${parentId}`);
      } else {
        console.log(`[ReactFlowBridge] Node ${node.id} using ELK absolute position: (${adjustedPosition.x}, ${adjustedPosition.y}) (no parent)`);
      }

      const reactFlowNode: ReactFlowNode = {
        id: node.id,
        type: 'standard',
        position: adjustedPosition,
        data: {
          label: node.showingLongLabel ? node.longLabel : node.label,
          longLabel: node.longLabel,
          showingLongLabel: node.showingLongLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          colorPalette: 'Set3',
          style: node.type || 'default',
        },
        parentId: parentId,
        parentNode: parentId, // React Flow uses parentNode
        extent: parentId ? 'parent' : undefined,
      };

      nodes.push(reactFlowNode);
    }

    return nodes;
  }

  private countContainerNodes(container: any, state: VisualizationState): number {
    let count = 0;
    for (const childId of container.children) {
      const childNode = state.getGraphNode(childId);
      const childContainer = state.getContainer(childId);
      if (childNode) {
        count++;
      } else if (childContainer) {
        count += this.countContainerNodes(childContainer, state);
      }
    }
    return count;
  }

  private convertEdges(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = [];

    for (const edge of state.visibleEdges) {
      if ("aggregated" in edge && edge.aggregated) {
        edges.push(this.renderAggregatedEdge(edge));
      } else {
        edges.push(this.renderOriginalEdge(edge));
      }
    }

    return edges;
  }

  // Styling with immutability and performance optimizations
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map((node) => {
      // Create style cache key for performance
      const styleCacheKey = `node-style-${node.data.nodeType}-${node.data.label}`;

      // Check style cache first
      let cachedStyle = this.styleCache.get(styleCacheKey);
      if (cachedStyle) {
        return this.createImmutableNode(
          node,
          cachedStyle.style,
          cachedStyle.appliedTags,
        );
      }

      // Get semantic tags from node data
      const semanticTags = node.data.semanticTags || [];

      // Start with type-based styles
      const typeBasedStyle =
        this.styleConfig.nodeStyles?.[node.data.nodeType] || {};

      // Process semantic tags for styling (only if we have semantic tags and config)
      let semanticStyle = {};
      let appliedTags: string[] = [];

      if (
        semanticTags.length > 0 &&
        (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)
      ) {
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          node.data.label,
          "node",
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...node.style,
      };

      // Cache the computed style for performance
      if (this.styleCache.size < PERFORMANCE_CACHE_SIZE) {
        this.styleCache.set(styleCacheKey, {
          style: combinedStyle,
          appliedTags,
        });
      }

      return this.createImmutableNode(node, combinedStyle, appliedTags);
    });
  }

  private createImmutableNode(
    node: ReactFlowNode,
    style: any,
    appliedTags: string[],
  ): ReactFlowNode {
    const result = {
      ...node,
      position: { ...node.position },
      style: { ...style },
      data: {
        ...node.data,
        appliedSemanticTags: [...appliedTags],
      },
    };

    // Freeze the node and its nested objects
    Object.freeze(result);
    Object.freeze(result.position);
    Object.freeze(result.style);
    Object.freeze(result.data);
    Object.freeze(result.data.appliedSemanticTags);
    if (result.data.semanticTags) Object.freeze(result.data.semanticTags);

    return result;
  }

  applyEdgeStyles(edges: ReactFlowEdge[]): ReactFlowEdge[] {
    return edges.map((edge) => {
      // Get semantic tags from edge data
      const edgeData = edge.data as any;
      const semanticTags = edgeData?.semanticTags || [];

      // Create style cache key for performance
      const styleCacheKey = `edge-style-${edge.type}-${semanticTags.join(",")}-${edge.id}`;

      // Check style cache first
      let cachedStyle = this.styleCache.get(styleCacheKey);
      if (cachedStyle) {
        return this.createImmutableEdge(edge, cachedStyle);
      }

      // Start with type-based styles
      const typeBasedStyle = this.styleConfig.edgeStyles?.[edge.type] || {};

      // Process semantic tags for styling (only if we have semantic tags and config)
      let semanticStyle = {};
      let appliedTags: string[] = [];
      let animated = false;
      let label = edge.label;
      let markerEnd = edge.markerEnd;
      let lineStyle: "single" | "double" = "single";

      if (
        semanticTags.length > 0 &&
        (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)
      ) {
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          edge.label as string,
          "edge",
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
        animated = processedStyle.animated;
        label = processedStyle.label || edge.label;
        markerEnd = processedStyle.markerEnd || edge.markerEnd;
        lineStyle = processedStyle.lineStyle || "single";
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...edge.style,
      };

      const styleData = {
        style: combinedStyle,
        animated: animated || edge.animated,
        label: label,
        markerEnd: markerEnd,
        appliedTags: appliedTags,
        lineStyle: lineStyle,
      };

      // Cache the computed style for performance
      if (this.styleCache.size < PERFORMANCE_CACHE_SIZE) {
        this.styleCache.set(styleCacheKey, styleData);
      }

      return this.createImmutableEdge(edge, styleData);
    });
  }

  private createImmutableEdge(
    edge: ReactFlowEdge,
    styleData: any,
  ): ReactFlowEdge {
    const result = {
      ...edge,
      style: { ...styleData.style },
      animated: styleData.animated,
      label: styleData.label,
      markerEnd: styleData.markerEnd,
      data: {
        ...edge.data,
        appliedSemanticTags: [...styleData.appliedTags],
        lineStyle: styleData.lineStyle,
      },
    };

    // Freeze the edge and its nested objects
    Object.freeze(result);
    Object.freeze(result.style);
    Object.freeze(result.data);
    Object.freeze(result.data.appliedSemanticTags);
    if (result.data.semanticTags) Object.freeze(result.data.semanticTags);
    if (result.data.originalEdgeIds) Object.freeze(result.data.originalEdgeIds);

    return result;
  }

  // Container Handling
  // These methods are no longer used - container rendering is handled in convertNodes

  // Edge Handling
  renderOriginalEdge(edge: any): ReactFlowEdge {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || "default",
      data: {
        semanticTags: edge.semanticTags || [],
        originalEdge: edge,
      },
    };
  }

  renderAggregatedEdge(aggregatedEdge: any): ReactFlowEdge {
    return {
      id: aggregatedEdge.id,
      source: aggregatedEdge.source,
      target: aggregatedEdge.target,
      type: "aggregated",
      style: {
        strokeWidth: 3,
        stroke: "#ff6b6b",
      },
      data: {
        semanticTags: aggregatedEdge.semanticTags || [],
        originalEdgeIds: aggregatedEdge.originalEdgeIds || [],
        aggregationSource: aggregatedEdge.aggregationSource,
        aggregated: true,
      },
    };
  }
}
