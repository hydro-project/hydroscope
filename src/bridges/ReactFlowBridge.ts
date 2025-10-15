/**
 * ReactFlowBridge - Stateless bridge for ReactFlow rendering
 * Architectural constraints: Stateless, synchronous conversions, immutable output
 */
import React from "react";
import { hscopeLogger } from "../utils/logger.js";
import type { VisualizationState } from "../core/VisualizationState.js";
import type {
  StyleConfig,
  ReactFlowData,
  ReactFlowNode,
  ReactFlowEdge,
} from "../types/core.js";
import type { IReactFlowBridge } from "../types/bridges.js";
import {
  processSemanticTags,
  processAggregatedSemanticTags,
  DEFAULT_STYLE,
} from "../utils/StyleProcessor.js";
import { CURRENT_HANDLE_STRATEGY } from "../render/handleConfig.js";
import {
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
  NAVIGATION_HIGHLIGHT_COLORS,
  HIGHLIGHT_STYLING,
} from "../shared/config.js";
// Performance optimization constants
const LARGE_GRAPH_NODE_THRESHOLD = 1000;
const LARGE_GRAPH_EDGE_THRESHOLD = 2000;
// ENHANCEMENT: Fail-fast edge validation error types
export class ReactFlowBridge implements IReactFlowBridge {
  constructor(private styleConfig: StyleConfig) {}
  // Synchronous Conversion - pure function without caching
  toReactFlowData(
    state: VisualizationState,
    interactionHandler?: any,
    options?: { showFullNodeLabels?: boolean },
  ): ReactFlowData {
    // Detect large graphs for performance optimizations
    const isLargeGraph = this.isLargeGraph(state);
    hscopeLogger.log(
      "bridge",
      `🌉 [ReactFlowBridge] isLargeGraph=${isLargeGraph}, nodeCount=${state.visibleNodes.length}, using ${isLargeGraph ? "OPTIMIZED" : "REGULAR"} conversion`,
    );

    // Convert with appropriate optimization strategy
    const nodeStartTime = performance.now();
    const nodes = isLargeGraph
      ? this.convertNodesOptimized(state, interactionHandler, options)
      : this.convertNodes(state, interactionHandler, options);
    const nodeEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Node conversion took ${(nodeEndTime - nodeStartTime).toFixed(2)}ms`,
    );

    const edgeStartTime = performance.now();
    const edges = isLargeGraph
      ? this.convertEdgesOptimized(state)
      : this.convertEdges(state);
    const edgeEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Edge conversion took ${(edgeEndTime - edgeStartTime).toFixed(2)}ms`,
    );

    // Apply basic styling first
    const styleStartTime = performance.now();
    let styledNodes = this.applyNodeStyles(nodes);
    let styledEdges = this.applyEdgeStyles(edges, state);
    const styleEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Basic styling took ${(styleEndTime - styleStartTime).toFixed(2)}ms`,
    );

    // Apply search and navigation highlights
    const highlightStartTime = performance.now();
    styledNodes = this.applyAllHighlights(styledNodes, state, "node");
    styledEdges = this.applyAllHighlights(styledEdges, state, "edge");
    const highlightEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Highlight application took ${(highlightEndTime - highlightStartTime).toFixed(2)}ms`,
    );
    // Create result with mutable arrays for ReactFlow compatibility
    const result: ReactFlowData = {
      nodes: styledNodes,
      edges: styledEdges,
    };
    // Deep freeze the result for immutability while maintaining TypeScript compatibility
    this.deepFreezeReactFlowData(result);
    // Return deep clone to ensure immutability
    const clonedResult = this.deepCloneReactFlowData(result);
    // CRITICAL FIX: Force React to recognize nodes array as completely new
    // by adding a unique timestamp to the array itself
    const finalResult = {
      ...clonedResult,
      nodes: [...clonedResult.nodes], // Create new array reference
      edges: [...clonedResult.edges], // Create new array reference
      // Add metadata to force React state change detection
      _timestamp: Date.now(),
      _changeId: Math.random().toString(36).substr(2, 9),
    };
    return finalResult;
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
      // Preserve extent property for container constraints
      extent: node.extent,
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
    _interactionHandler?: any,
    options?: { showFullNodeLabels?: boolean },
  ): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = [];

    // Build parent mapping for nodes and containers
    const mappingStartTime = performance.now();
    const nodeParentMap = new Map<string, string>();
    const containerParentMap = new Map<string, string>();
    // Map nodes to their parent containers
    for (const container of state.visibleContainers) {
      for (const childId of container.children) {
        nodeParentMap.set(childId, container.id);
      }
    }
    // Map containers to their parent containers
    for (const container of state.visibleContainers) {
      const parentContainerId = state.getContainerParent(container.id);
      if (parentContainerId) {
        containerParentMap.set(container.id, parentContainerId);
      }
    }
    const mappingEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Parent mapping took ${(mappingEndTime - mappingStartTime).toFixed(2)}ms`,
    );

    // OPTIMIZED: Pre-calculate depths to avoid repeated ancestor lookups
    const depthStartTime = performance.now();
    const containerDepths = new Map<string, number>();
    for (const container of state.visibleContainers) {
      containerDepths.set(
        container.id,
        state.getContainerAncestors(container.id).length,
      );
    }

    const sortedContainers = [...state.visibleContainers].sort((a, b) => {
      const aDepth = containerDepths.get(a.id) || 0;
      const bDepth = containerDepths.get(b.id) || 0;
      return aDepth - bDepth; // Parents (lower depth) come first
    });
    const depthEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Depth calculation and sorting took ${(depthEndTime - depthStartTime).toFixed(2)}ms`,
    );

    // Add containers first (parents before children)
    for (const container of sortedContainers) {
      const parentId = containerParentMap.get(container.id);
      // Get position and dimensions from ELK layout
      const position = container.position || { x: 0, y: 0 };
      const dimensions = {
        width: container.dimensions?.width || container.width || 200,
        height: container.dimensions?.height || container.height || 150,
      };
      nodes.push({
        id: container.id,
        type: "container",
        position,
        // CRITICAL FIX: Set width and height directly on the ReactFlow node for fitView calculations
        width: dimensions.width,
        height: dimensions.height,
        data: {
          label: container.label,
          nodeType: "container",
          isExpanded: !container.collapsed,
          childCount: container.children.size,
          showingLongLabel: false, // Containers don't have long labels
          // Add onClick handler if interaction handler is provided
          onClick: _interactionHandler
            ? (containerId: string) => {
                if (_interactionHandler.handleContainerClick) {
                  _interactionHandler.handleContainerClick(containerId);
                }
              }
            : undefined,
        },
        style: {
          width: dimensions.width,
          height: dimensions.height,
          // Default styles
          border: container.collapsed ? "2px dashed #ccc" : "2px solid #333",
          backgroundColor: container.collapsed
            ? "rgba(240, 240, 240, 0.8)"
            : "rgba(255, 255, 255, 0.9)",
          borderRadius: "8px",
          // Apply configured container styles (overrides defaults)
          ...(container.collapsed
            ? this.styleConfig.containerStyles?.collapsed
            : this.styleConfig.containerStyles?.expanded),
        },
        parentId: parentId,
        extent: parentId ? "parent" : undefined,
      } as ReactFlowNode & { width: number; height: number });
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
      // AGGRESSIVE DEBUG: Log node positioning pipeline
      let adjustedPosition = position || { x: 0, y: 0 };
      if (parentId && parentContainer) {
        // Get the parent container's position and dimensions for bounds checking
        // Ensure node is within parent bounds (with some padding)
      }
      // Get node dimensions from ELK to ensure rendered size matches layout
      const width = node.dimensions?.width || 120;
      const height = node.dimensions?.height || 60;

      hscopeLogger.log(
        "bridge",
        `🌉 [ReactFlowBridge] Node ${node.id}: dimensions=${node.dimensions ? `${node.dimensions.width}x${node.dimensions.height}` : "undefined"} -> using ${width}x${height}`,
      );

      if (node.dimensions) {
        hscopeLogger.log(
          "bridge",
          `🌉 [ReactFlowBridge] Node ${node.id}: passing dimensions ${width}x${height} to ReactFlow`,
        );
      }

      nodes.push({
        id: node.id,
        type: node.type || "default",
        position: adjustedPosition,
        // CRITICAL FIX: Set width and height directly on the ReactFlow node for fitView calculations
        width,
        height,
        data: {
          label:
            node.showingLongLabel && node.longLabel
              ? node.longLabel
              : node.label,
          longLabel: node.longLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          showingLongLabel: node.showingLongLabel,
          showFullNodeLabels: options?.showFullNodeLabels || false,
          // CRITICAL FIX: Pass dimensions in data for StandardNode to use
          width,
          height,
          // Add onClick handler if interaction handler is provided
          onClick: _interactionHandler
            ? (nodeId: string) => {
                if (_interactionHandler.handleNodeClick) {
                  _interactionHandler.handleNodeClick(nodeId);
                }
              }
            : undefined,
        },
        parentId: parentId,
        extent: parentId ? "parent" : undefined,
      } as ReactFlowNode & { width: number; height: number });
    }
    return nodes;
  }
  private convertEdgesOptimized(state: VisualizationState): ReactFlowEdge[] {
    const startTime = performance.now();
    const edges: ReactFlowEdge[] = [];
    const visibleEdges = state.visibleEdges;

    // PERFORMANCE OPTIMIZATION: Skip expensive validation in optimized mode
    // Trust that VisualizationState provides clean, valid data
    const setupStartTime = performance.now();
    const setupEndTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED Edge setup took ${(setupEndTime - setupStartTime).toFixed(2)}ms`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED Validation skipped for performance (trusting VisualizationState data)`,
    );

    let _validEdges = 0;
    let _skippedEdges = 0;
    let totalRenderTime = 0;

    // Batch process edges for better performance - NO VALIDATION
    const renderStartTime = performance.now();
    for (let i = 0; i < visibleEdges.length; i++) {
      const edge = visibleEdges[i];

      // FAST PATH: Skip validation entirely, trust the data
      const renderStart = performance.now();
      let renderedEdge: ReactFlowEdge | null;
      if ("aggregated" in edge && (edge as any).aggregated) {
        renderedEdge = this.renderAggregatedEdge(edge, state);
      } else {
        renderedEdge = this.renderOriginalEdge(edge, state);
      }
      totalRenderTime += performance.now() - renderStart;

      // Only add valid edges
      if (renderedEdge) {
        _validEdges++;
        edges.push(renderedEdge);
      } else {
        _skippedEdges++;
        console.warn(
          `[ReactFlowBridge] ⚠️ Optimized conversion: Edge ${edge.id} failed to render`,
        );
      }
    }

    const renderEndTime = performance.now();
    const totalTime = renderEndTime - startTime;
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED Edge rendering took ${(renderEndTime - renderStartTime).toFixed(2)}ms`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED - Individual render time: ${totalRenderTime.toFixed(2)}ms`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED Total edge conversion took ${totalTime.toFixed(2)}ms for ${visibleEdges.length} edges`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] OPTIMIZED Edge stats: rendered=${_validEdges}, skipped=${_skippedEdges}`,
    );

    return edges;
  }
  private convertNodes(
    state: VisualizationState,
    _interactionHandler?: any,
    options?: { showFullNodeLabels?: boolean },
  ): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = [];
    // Build parent mapping for nodes and containers
    const nodeParentMap = new Map<string, string>();
    const containerParentMap = new Map<string, string>();
    // Map nodes to their parent containers
    for (const container of state.visibleContainers) {
      for (const childId of container.children) {
        nodeParentMap.set(childId, container.id);
      }
    }
    // Map containers to their parent containers
    for (const container of state.visibleContainers) {
      const parentContainerId = state.getContainerParent(container.id);
      if (parentContainerId) {
        containerParentMap.set(container.id, parentContainerId);
      }
    }
    // Sort containers so parents come before children
    // Use hierarchy depth to ensure parents appear before children
    const sortedContainers = [...state.visibleContainers].sort((a, b) => {
      const aDepth = state.getContainerAncestors(a.id).length;
      const bDepth = state.getContainerAncestors(b.id).length;
      return aDepth - bDepth; // Parents (lower depth) come first
    });
    // Add containers first (parents before children)
    for (const container of sortedContainers) {
      const parentId = containerParentMap.get(container.id);
      // Get position and dimensions from ELK layout
      const position = container.position || { x: 0, y: 0 };
      const width = container.dimensions?.width || container.width || 200;
      const height = container.dimensions?.height || container.height || 150;
      const nodeCount = container.collapsed
        ? this.countContainerNodes(container, state)
        : 0;
      const containerNode: ReactFlowNode & { width: number; height: number } = {
        id: container.id,
        type: container.collapsed ? "standard" : "container", // Collapsed containers use 'standard' type for edge connections
        position,
        // CRITICAL FIX: Set width and height directly on the ReactFlow node for fitView calculations
        width,
        height,
        data: {
          label: container.label || container.id,
          nodeType: "container",
          collapsed: container.collapsed,
          containerChildren: container.children.size,
          nodeCount,
          width,
          height,
          colorPalette: state.getColorPalette(),
          style: "default",
          showingLongLabel: false, // Containers don't have long labels
          // Add onClick handler if interaction handler is provided
          onClick: _interactionHandler
            ? (containerId: string) => {
                if (_interactionHandler.handleContainerClick) {
                  _interactionHandler.handleContainerClick(containerId);
                }
              }
            : undefined,
        },
        style: {
          width,
          height,
          ...(this.styleConfig?.containerStyles
            ? container.collapsed
              ? this.styleConfig.containerStyles.collapsed
              : this.styleConfig.containerStyles.expanded
            : {}),
        },
        parentId: parentId,
        parentNode: parentId, // React Flow uses parentNode
        // FIXED: Containers that are children of other containers should be constrained
        // to prevent dragging outside their parent container boundaries
        extent: parentId ? "parent" : undefined,
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
      // AGGRESSIVE DEBUG: Log node positioning pipeline
      let adjustedPosition = position || { x: 0, y: 0 };
      if (parentId && parentContainer) {
        // Get the parent container's position and dimensions for bounds checking
        // CRITICAL FIX: ELK already returns child positions relative to their parent container!
        // We should NOT subtract the parent position. The position from ELK is already correct.
        // See: https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html
        // "The coordinates of most elements are relative to their parent element."
        // Check if position is within parent bounds (for debugging only)
        // adjustedPosition already contains the correct relative position from ELK
      }
      // Determine if we should constrain this node to its parent container
      // Only apply extent constraint for nodes in non-collapsed containers
      // CRITICAL FIX: Always apply extent constraint for nodes with parents to prevent dragging outside containers
      const shouldConstrainToParent =
        parentId && parentContainer && !parentContainer.collapsed;
      // CRITICAL FIX: Get node dimensions from ELK to ensure rendered size matches layout
      const width = node.dimensions?.width || 120;
      const height = node.dimensions?.height || 60;

      hscopeLogger.log(
        "bridge",
        `🌉 [ReactFlowBridge-Optimized] Node ${node.id}: dimensions=${node.dimensions ? `${node.dimensions.width}x${node.dimensions.height}` : "undefined"} -> using ${width}x${height}`,
      );
      const reactFlowNode: ReactFlowNode & { width: number; height: number } = {
        id: node.id,
        type: "standard",
        position: adjustedPosition,
        // CRITICAL FIX: Set width and height directly on the ReactFlow node for fitView calculations
        width,
        height,
        data: {
          label:
            node.showingLongLabel && node.longLabel
              ? node.longLabel
              : node.label,
          longLabel: node.longLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          colorPalette: state.getColorPalette(),
          style: node.type || "default",
          width, // Pass ELK-calculated width to match layout
          height, // Pass ELK-calculated height to match layout
          showingLongLabel: node.showingLongLabel,
          showFullNodeLabels: options?.showFullNodeLabels || false,
          // Add onClick handler if interaction handler is provided
          onClick: _interactionHandler
            ? (nodeId: string) => {
                if (_interactionHandler.handleNodeClick) {
                  _interactionHandler.handleNodeClick(nodeId);
                }
              }
            : undefined,
        },
        parentId: parentId,
        parentNode: parentId, // React Flow uses parentNode
        // FIXED: Re-enable extent="parent" for nodes in non-collapsed containers
        // This prevents nodes from being dragged outside their container boundaries
        // while avoiding the positioning bugs that occurred in deeply nested collapsed containers
        extent: shouldConstrainToParent ? "parent" : undefined,
      };
      nodes.push(reactFlowNode);
    }
    return nodes;
  }
  private countContainerNodes(
    container: any,
    state: VisualizationState,
  ): number {
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
    const startTime = performance.now();
    const edges: ReactFlowEdge[] = [];

    // ARCHITECTURAL PRINCIPLE: Trust VisualizationState to provide clean, valid data
    // Validation should happen at the data layer, not the presentation layer
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Converting ${state.visibleEdges.length} edges (trusting VisualizationState data)`,
    );

    let renderedEdgeCount = 0;
    let skippedEdgeCount = 0;
    let totalRenderTime = 0;

    const renderStartTime = performance.now();
    for (const edge of state.visibleEdges) {
      const renderStart = performance.now();
      let renderedEdge;
      if ("aggregated" in edge && (edge as any).aggregated) {
        renderedEdge = this.renderAggregatedEdge(edge, state);
      } else {
        renderedEdge = this.renderOriginalEdge(edge, state);
      }
      totalRenderTime += performance.now() - renderStart;

      // Only add the edge if it was successfully rendered (not null)
      if (renderedEdge) {
        renderedEdgeCount++;
        edges.push(renderedEdge);
      } else {
        skippedEdgeCount++;
        console.warn(`[ReactFlowBridge] ⚠️ Edge ${edge.id} failed to render`);
      }
    }

    const renderEndTime = performance.now();
    const totalTime = renderEndTime - startTime;
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Edge rendering took ${(renderEndTime - renderStartTime).toFixed(2)}ms`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] - Individual render time: ${totalRenderTime.toFixed(2)}ms`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Total edge conversion took ${totalTime.toFixed(2)}ms for ${state.visibleEdges.length} edges`,
    );
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Edge stats: rendered=${renderedEdgeCount}, skipped=${skippedEdgeCount}`,
    );

    return edges;
  }
  // Styling with immutability - OPTIMIZED with ephemeral batching
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    if (nodes.length === 0) return nodes;

    // EPHEMERAL STATE: Temporary data structures for this computation only
    const ephemeralState = {
      // Pre-compute all type-based styles once
      typeStyleCache: new Map<string, any>(),
      // Group nodes by semantic signature for batch processing
      semanticGroups: new Map<
        string,
        {
          semanticTags: string[];
          representativeLabel: string;
          nodes: ReactFlowNode[];
          computedStyle?: { style: any; appliedTags: string[] };
        }
      >(),
    };

    // Phase 1: Group nodes and pre-compute type styles
    for (const node of nodes) {
      const nodeType = node.data.nodeType;
      const semanticTags = node.data.semanticTags || [];

      // Cache type-based style computation
      if (!ephemeralState.typeStyleCache.has(nodeType)) {
        ephemeralState.typeStyleCache.set(
          nodeType,
          this.styleConfig.nodeStyles?.[nodeType] || {},
        );
      }

      // Group by semantic signature for batch processing
      const semanticKey = semanticTags.join(",");
      if (!ephemeralState.semanticGroups.has(semanticKey)) {
        ephemeralState.semanticGroups.set(semanticKey, {
          semanticTags,
          representativeLabel: node.data.label, // Use first node as representative
          nodes: [],
        });
      }
      ephemeralState.semanticGroups.get(semanticKey)!.nodes.push(node);
    }

    // PERFORMANCE OPTIMIZATION: Skip semantic processing entirely if no mappings configured
    const hasSemanticMappings =
      this.styleConfig.semanticMappings || this.styleConfig.propertyMappings;

    // Phase 2: Batch compute semantic styles (one per group)
    for (const group of ephemeralState.semanticGroups.values()) {
      if (group.semanticTags.length > 0 && hasSemanticMappings) {
        group.computedStyle = processSemanticTags(
          group.semanticTags,
          this.styleConfig,
          group.representativeLabel,
          "node",
        );
      } else {
        // No semantic tags or no mappings - use empty style
        group.computedStyle = { style: {}, appliedTags: [] };
      }
    }

    // Phase 3: Apply computed styles to all nodes
    const styledNodes: ReactFlowNode[] = [];
    for (const group of ephemeralState.semanticGroups.values()) {
      const semanticStyle = group.computedStyle!.style;
      const appliedTags = group.computedStyle!.appliedTags;

      for (const node of group.nodes) {
        const typeBasedStyle = ephemeralState.typeStyleCache.get(
          node.data.nodeType,
        )!;
        const finalStyle = {
          ...typeBasedStyle,
          ...semanticStyle,
          ...node.style, // Individual node styles override group styles
        };
        styledNodes.push(
          this.createImmutableNode(node, finalStyle, appliedTags),
        );
      }
    }

    // Ephemeral state is automatically garbage collected when method exits
    return styledNodes;
  }
  private createImmutableNode(
    node: ReactFlowNode,
    style: any,
    appliedTags: string[],
  ): ReactFlowNode {
    const result = {
      ...node, // This preserves all properties including extent, parentNode, etc.
      position: { ...node.position },
      style: { ...style },
      data: {
        ...node.data,
        appliedSemanticTags: [...appliedTags],
      },
    };

    // DEBUG MODE: Only freeze objects in development for debugging
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG_IMMUTABILITY
    ) {
      Object.freeze(result);
      Object.freeze(result.position);
      Object.freeze(result.style);
      Object.freeze(result.data);
      Object.freeze(result.data.appliedSemanticTags);
      if (result.data.semanticTags) Object.freeze(result.data.semanticTags);
    }

    return result;
  }
  applyEdgeStyles(
    edges: ReactFlowEdge[],
    state?: VisualizationState,
  ): ReactFlowEdge[] {
    const startTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Starting edge styling for ${edges.length} edges`,
    );

    if (edges.length === 0) return edges;

    // EPHEMERAL STATE: Temporary caches for this computation only
    const ephemeralState = {
      // Current edge style from VisualizationState
      currentEdgeStyle: state?.getEdgeStyle() || "bezier",
      // Pre-compute type-based styles for all edge types
      typeStyleCache: new Map<string, any>(),
      // Cache aggregated edge processing by original edge signature
      aggregatedStyleCache: new Map<string, any>(),
      // Group regular edges by semantic signature for batch processing
      regularEdgeGroups: new Map<
        string,
        {
          semanticTags: string[];
          representativeLabel: string;
          edges: ReactFlowEdge[];
          computedStyle?: any;
        }
      >(),
    };

    // Phase 1: Separate and group edges
    const aggregatedEdges: ReactFlowEdge[] = [];
    const regularEdges: ReactFlowEdge[] = [];

    for (const edge of edges) {
      const edgeData = edge.data as any;
      const isAggregated = edgeData?.aggregated === true;

      // Cache type-based style computation
      if (!ephemeralState.typeStyleCache.has(edge.type)) {
        ephemeralState.typeStyleCache.set(
          edge.type,
          this.styleConfig.edgeStyles?.[edge.type] || {},
        );
      }

      if (isAggregated) {
        aggregatedEdges.push(edge);
      } else {
        regularEdges.push(edge);
      }
    }

    // Phase 2: Process regular edges in batches
    const styledRegularEdges = this.processRegularEdgesBatch(
      regularEdges,
      ephemeralState,
    );

    // Phase 3: Process aggregated edges with caching
    const styledAggregatedEdges = this.processAggregatedEdgesBatch(
      aggregatedEdges,
      state,
      ephemeralState,
    );

    // Combine results
    const result = [...styledRegularEdges, ...styledAggregatedEdges];

    const endTime = performance.now();
    hscopeLogger.log(
      "bridge",
      `[ReactFlowBridge] Edge styling completed in ${(endTime - startTime).toFixed(2)}ms`,
    );
    return result;
  }

  private processRegularEdgesBatch(
    edges: ReactFlowEdge[],
    ephemeralState: any,
  ): ReactFlowEdge[] {
    // Group edges by semantic signature for batch processing
    for (const edge of edges) {
      const edgeData = edge.data as any;
      const semanticTags = edgeData?.semanticTags || [];
      const semanticKey = semanticTags.join(",");

      if (!ephemeralState.regularEdgeGroups.has(semanticKey)) {
        ephemeralState.regularEdgeGroups.set(semanticKey, {
          semanticTags,
          representativeLabel: edge.label as string,
          edges: [],
        });
      }
      ephemeralState.regularEdgeGroups.get(semanticKey)!.edges.push(edge);
    }

    // PERFORMANCE OPTIMIZATION: Skip semantic processing entirely if no mappings configured
    const hasSemanticMappings =
      this.styleConfig.semanticMappings || this.styleConfig.propertyMappings;

    // Batch compute semantic styles (one per group)
    for (const group of ephemeralState.regularEdgeGroups.values()) {
      if (group.semanticTags.length > 0 && hasSemanticMappings) {
        group.computedStyle = processSemanticTags(
          group.semanticTags,
          this.styleConfig,
          group.representativeLabel,
          "edge",
        );
      } else {
        // No semantic tags or no mappings - use empty style
        group.computedStyle = {
          style: {},
          appliedTags: [],
          animated: false,
          label: null,
          markerEnd: null,
          lineStyle: "single",
        };
      }
    }

    // Apply computed styles to all edges
    const styledEdges: ReactFlowEdge[] = [];
    for (const group of ephemeralState.regularEdgeGroups.values()) {
      const computedStyle = group.computedStyle!;

      for (const edge of group.edges) {
        const typeBasedStyle = ephemeralState.typeStyleCache.get(edge.type)!;

        // PERFORMANCE OPTIMIZATION: Explicit value merging instead of object spreading
        const combinedStyle = this.mergeEdgeStyles(
          typeBasedStyle,
          computedStyle.style,
          edge.style,
        );

        const styleData = {
          style: combinedStyle,
          animated: computedStyle.animated || edge.animated,
          label: computedStyle.label || edge.label,
          markerEnd: computedStyle.markerEnd || edge.markerEnd,
          appliedTags: computedStyle.appliedTags,
          lineStyle: computedStyle.lineStyle || "single",
          edgeStyleType: ephemeralState.currentEdgeStyle,
        };

        styledEdges.push(this.createImmutableEdge(edge, styleData));
      }
    }

    return styledEdges;
  }

  private processAggregatedEdgesBatch(
    aggregatedEdges: ReactFlowEdge[],
    state: VisualizationState | undefined,
    ephemeralState: any,
  ): ReactFlowEdge[] {
    if (!state) {
      // Fallback to individual processing if no state
      return aggregatedEdges.map((edge) =>
        this.processAggregatedEdgeIndividual(edge, state, ephemeralState),
      );
    }

    const styledEdges: ReactFlowEdge[] = [];

    for (const edge of aggregatedEdges) {
      const edgeData = edge.data as any;
      const originalEdgeIds = edgeData?.originalEdgeIds || [];

      if (originalEdgeIds.length === 0) {
        // No original edges, use default processing
        styledEdges.push(
          this.processAggregatedEdgeIndividual(edge, state, ephemeralState),
        );
        continue;
      }

      // Create cache key based on original edge IDs (sorted for consistency)
      const cacheKey = [...originalEdgeIds].sort().join(",");

      // Check if we've already processed this signature
      let processedStyle = ephemeralState.aggregatedStyleCache.get(cacheKey);

      if (!processedStyle) {
        // Process this signature for the first time
        const originalEdges = originalEdgeIds
          .map((id: string) => state.getGraphEdge(id))
          .filter((e: any) => e !== undefined);

        if (originalEdges.length > 0) {
          processedStyle = processAggregatedSemanticTags(
            originalEdges,
            this.styleConfig,
            edge.label as string,
          );

          // Cache the result for reuse
          ephemeralState.aggregatedStyleCache.set(cacheKey, processedStyle);
        } else {
          // No valid original edges found, use default style
          processedStyle = {
            style: {
              stroke: DEFAULT_STYLE.DEFAULT_STROKE_COLOR,
              strokeWidth: DEFAULT_STYLE.STROKE_WIDTH,
            },
            appliedTags: [],
            animated: false,
            label: edge.label,
            markerEnd: { type: "arrowclosed" },
          };
          ephemeralState.aggregatedStyleCache.set(cacheKey, processedStyle);
        }
      }

      // Apply the cached/computed style to this edge
      const typeBasedStyle = ephemeralState.typeStyleCache.get(edge.type) || {};
      const combinedStyle = {
        ...typeBasedStyle,
        ...processedStyle.style,
        ...edge.style,
      };

      const styleData = {
        style: combinedStyle,
        animated: processedStyle.animated || edge.animated,
        label: processedStyle.label || edge.label,
        markerEnd: processedStyle.markerEnd || edge.markerEnd,
        appliedTags: processedStyle.appliedTags || [],
        lineStyle: processedStyle.lineStyle || "single",
        edgeStyleType: ephemeralState.currentEdgeStyle,
      };

      // Skip freezing for large batches to improve performance
      styledEdges.push(this.createImmutableEdge(edge, styleData));
    }

    return styledEdges;
  }

  private processAggregatedEdgeIndividual(
    edge: ReactFlowEdge,
    _state: VisualizationState | undefined,
    ephemeralState: any,
  ): ReactFlowEdge {
    // Fallback to original individual processing logic
    const typeBasedStyle = ephemeralState.typeStyleCache.get(edge.type) || {};
    const combinedStyle = {
      ...typeBasedStyle,
      ...edge.style,
    };

    const styleData = {
      style: combinedStyle,
      animated: edge.animated,
      label: edge.label,
      markerEnd: edge.markerEnd,
      appliedTags: [],
      lineStyle: "single",
      edgeStyleType: ephemeralState.currentEdgeStyle,
    };

    return this.createImmutableEdge(edge, styleData);
  }

  /**
   * PERFORMANCE OPTIMIZATION: Explicit style merging without object spreading
   * Merges edge styles by explicitly handling known properties
   */
  private mergeEdgeStyles(
    typeStyle: Record<string, string | number>,
    semanticStyle: Record<string, string | number>,
    edgeStyle?: Record<string, string | number>,
  ): Record<string, string | number> {
    // Fast path: if all styles are empty, return empty object
    if (
      Object.keys(typeStyle).length === 0 &&
      Object.keys(semanticStyle).length === 0 &&
      (!edgeStyle || Object.keys(edgeStyle).length === 0)
    ) {
      return {};
    }

    // Create result object and merge known properties explicitly
    const result: Record<string, string | number> = {};

    // Common edge style properties (in priority order: edge > semantic > type)
    const stroke =
      edgeStyle?.stroke ?? semanticStyle.stroke ?? typeStyle.stroke;
    const strokeWidth =
      edgeStyle?.strokeWidth ??
      semanticStyle.strokeWidth ??
      typeStyle.strokeWidth;
    const strokeDasharray =
      edgeStyle?.strokeDasharray ??
      semanticStyle.strokeDasharray ??
      typeStyle.strokeDasharray;

    // Only set properties that have values
    if (stroke !== undefined) result.stroke = stroke;
    if (strokeWidth !== undefined) result.strokeWidth = strokeWidth;
    if (strokeDasharray !== undefined) result.strokeDasharray = strokeDasharray;

    // Handle any other properties that might exist (fallback to spreading for unknown props)
    const allKeys = new Set([
      ...Object.keys(typeStyle),
      ...Object.keys(semanticStyle),
      ...(edgeStyle ? Object.keys(edgeStyle) : []),
    ]);

    for (const key of allKeys) {
      if (
        key !== "stroke" &&
        key !== "strokeWidth" &&
        key !== "strokeDasharray"
      ) {
        const value = edgeStyle?.[key] ?? semanticStyle[key] ?? typeStyle[key];
        if (value !== undefined) result[key] = value;
      }
    }

    return result;
  }

  private createImmutableEdge(
    edge: ReactFlowEdge,
    styleData: any,
  ): ReactFlowEdge {
    // RUNTIME PERFORMANCE OPTIMIZATION: Skip object creation when nothing changes
    const hasStyle = styleData.style && Object.keys(styleData.style).length > 0;
    const hasAppliedTags =
      styleData.appliedTags && styleData.appliedTags.length > 0;
    const hasChanges =
      hasStyle ||
      styleData.animated !== edge.animated ||
      styleData.label !== edge.label ||
      (styleData.markerEnd && styleData.markerEnd !== edge.markerEnd) ||
      hasAppliedTags ||
      styleData.lineStyle ||
      styleData.edgeStyleType;

    // If nothing changes, return the original edge (no object creation needed)
    if (!hasChanges) {
      return edge;
    }

    // Only create new object when we actually need to modify something
    const result = {
      ...edge,
      style: hasStyle ? { ...styleData.style } : edge.style || {},
      animated: styleData.animated,
      label: styleData.label,
      markerEnd: styleData.markerEnd || { type: "arrowclosed" },
      data: {
        ...edge.data,
        appliedSemanticTags: hasAppliedTags ? [...styleData.appliedTags] : [],
        lineStyle: styleData.lineStyle,
        edgeStyleType: styleData.edgeStyleType,
      },
    };

    // DEBUG MODE: Only freeze objects in development for debugging
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG_IMMUTABILITY
    ) {
      Object.freeze(result);
      Object.freeze(result.style);
      Object.freeze(result.data);
      Object.freeze(result.data.appliedSemanticTags);
      if (result.data.semanticTags) Object.freeze(result.data.semanticTags);
      if (result.data.originalEdgeIds)
        Object.freeze(result.data.originalEdgeIds);
    }

    return result;
  }
  // Container Handling
  // These methods are no longer used - container rendering is handled in convertNodes
  // Smart Handle Selection
  private getSmartHandles(
    visState: VisualizationState,
    sourceId: string,
    targetId: string,
  ): {
    sourceHandle?: string;
    targetHandle?: string;
  } {
    if (CURRENT_HANDLE_STRATEGY !== "discrete") {
      return {}; // No handle selection needed for other strategies
    }
    try {
      // Get source element (node or container)
      const sourceNode = visState.getGraphNode(sourceId);
      const sourceContainer = sourceNode
        ? null
        : visState.getContainer(sourceId);
      const sourceElement = sourceNode || sourceContainer;
      // Get target element (node or container)
      const targetNode = visState.getGraphNode(targetId);
      const targetContainer = targetNode
        ? null
        : visState.getContainer(targetId);
      const targetElement = targetNode || targetContainer;
      if (!sourceElement || !targetElement) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }
      // CRITICAL FIX: Get positions from ELK layout data, not stale VisualizationState positions
      // Use the same position source that ReactFlow nodes use to ensure consistency
      const sourcePos = {
        x: sourceElement.position?.x ?? (sourceElement as any).x ?? 0,
        y: sourceElement.position?.y ?? (sourceElement as any).y ?? 0,
      };
      const targetPos = {
        x: targetElement.position?.x ?? (targetElement as any).x ?? 0,
        y: targetElement.position?.y ?? (targetElement as any).y ?? 0,
      };
      // Validate positions
      if (
        !this.isValidPosition(sourcePos) ||
        !this.isValidPosition(targetPos)
      ) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }
      // Get dimensions with fallbacks - prioritize fresh dimensions from ELK layout
      const sourceWidth = Math.max(
        1,
        sourceElement.dimensions?.width ?? (sourceElement as any).width ?? 120, // Default fallback
      );
      const sourceHeight = Math.max(
        1,
        sourceElement.dimensions?.height ?? (sourceElement as any).height ?? 60, // Default fallback
      );
      const targetWidth = Math.max(
        1,
        targetElement.dimensions?.width ?? (targetElement as any).width ?? 120, // Default fallback
      );
      const targetHeight = Math.max(
        1,
        targetElement.dimensions?.height ?? (targetElement as any).height ?? 60, // Default fallback
      );

      // Calculate centers
      const sourceCenterX = sourcePos.x + sourceWidth / 2;
      const sourceCenterY = sourcePos.y + sourceHeight / 2;
      const targetCenterX = targetPos.x + targetWidth / 2;
      const targetCenterY = targetPos.y + targetHeight / 2;
      // Calculate relative position
      const deltaX = targetCenterX - sourceCenterX;
      const deltaY = targetCenterY - sourceCenterY;
      // Validate deltas
      if (!isFinite(deltaX) || !isFinite(deltaY)) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }
      // Direction thresholds
      const DIRECTION_THRESHOLD = 1.2;
      const MIN_SEPARATION = 10;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      // If nodes are too close, default to vertical
      if (absX < MIN_SEPARATION && absY < MIN_SEPARATION) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }
      // Determine primary direction and select handles
      const isHorizontalPrimary = absX > absY * DIRECTION_THRESHOLD;
      const isVerticalPrimary = absY > absX * DIRECTION_THRESHOLD;
      if (isHorizontalPrimary) {
        // Horizontal arrangement
        if (deltaX > 0) {
          // Target is to the right
          return { sourceHandle: "out-right", targetHandle: "in-left" };
        } else {
          // Target is to the left - fall back to vertical
          return { sourceHandle: "out-bottom", targetHandle: "in-top" };
        }
      } else if (isVerticalPrimary) {
        // Vertical arrangement
        if (deltaY > 0) {
          // Target is below
          return { sourceHandle: "out-bottom", targetHandle: "in-top" };
        } else {
          // Target is above - use horizontal if reasonable
          if (absX > sourceWidth / 2) {
            return deltaX > 0
              ? { sourceHandle: "out-right", targetHandle: "in-left" }
              : { sourceHandle: "out-bottom", targetHandle: "in-top" };
          } else {
            return { sourceHandle: "out-bottom", targetHandle: "in-top" };
          }
        }
      }
      // Default case
      const result = { sourceHandle: "out-bottom", targetHandle: "in-top" };
      return result;
    } catch (error) {
      console.warn("[ReactFlowBridge] Error in smart handle selection:", error);
      return { sourceHandle: "out-bottom", targetHandle: "in-top" };
    }
  }
  private isValidPosition(pos: { x: number; y: number }): boolean {
    return (
      typeof pos.x === "number" &&
      typeof pos.y === "number" &&
      isFinite(pos.x) &&
      isFinite(pos.y) &&
      !isNaN(pos.x) &&
      !isNaN(pos.y)
    );
  }
  private validateEdgeForRendering(
    edge: any,
    edgeType: "original" | "aggregated",
  ): {
    isValid: boolean;
    reason: string;
  } {
    // Check for required properties
    if (!edge) {
      return { isValid: false, reason: "Edge is null or undefined" };
    }
    if (!edge.id) {
      return { isValid: false, reason: "Edge missing required id property" };
    }
    if (!edge.source || typeof edge.source !== "string") {
      return {
        isValid: false,
        reason: `Edge source is invalid: "${edge.source}" (type: ${typeof edge.source})`,
      };
    }
    if (!edge.target || typeof edge.target !== "string") {
      return {
        isValid: false,
        reason: `Edge target is invalid: "${edge.target}" (type: ${typeof edge.target})`,
      };
    }
    // Additional validation for aggregated edges
    if (edgeType === "aggregated") {
      if (!("aggregated" in edge) || !edge.aggregated) {
        return {
          isValid: false,
          reason: "Aggregated edge missing aggregated property or it is false",
        };
      }
      if (!edge.originalEdgeIds || !Array.isArray(edge.originalEdgeIds)) {
        console.warn(
          `[ReactFlowBridge] ⚠️ Aggregated edge ${edge.id} missing or invalid originalEdgeIds`,
        );
        // This is a warning, not a failure - some aggregated edges might not have this
      }
    }
    return { isValid: true, reason: "Edge is valid for rendering" };
  }
  private validateRenderedEdge(renderedEdge: ReactFlowEdge): boolean {
    // Final validation of the rendered ReactFlow edge
    if (!renderedEdge.id || !renderedEdge.source || !renderedEdge.target) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered edge missing required properties:`,
        {
          id: renderedEdge.id,
          source: renderedEdge.source,
          target: renderedEdge.target,
        },
      );
      return false;
    }
    // Check for circular references (source === target)
    if (renderedEdge.source === renderedEdge.target) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Self-loop edge detected: ${renderedEdge.id} (${renderedEdge.source})`,
      );
      // Self-loops are valid in ReactFlow, just log a warning
    }
    // Validate handle names if present
    if (
      renderedEdge.sourceHandle &&
      typeof renderedEdge.sourceHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid sourceHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.sourceHandle}`,
      );
    }
    if (
      renderedEdge.targetHandle &&
      typeof renderedEdge.targetHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid targetHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.targetHandle}`,
      );
    }
    return true;
  }
  // Edge Handling
  renderOriginalEdge(
    edge: any,
    visState?: VisualizationState,
  ): ReactFlowEdge | null {
    // Enhanced validation for original edges
    const validation = this.validateEdgeForRendering(edge, "original");
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render original edge ${edge.id}: ${validation.reason}`,
      );
      return null;
    }
    const handles = visState
      ? this.getSmartHandles(visState, edge.source, edge.target)
      : {};
    // Get source and target node dimensions to create a unique key

    const renderedEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: edge.type || "default",

      data: {
        semanticTags: edge.semanticTags || [],
        originalEdge: edge,
      },
    };
    // Final validation of rendered edge
    if (!this.validateRenderedEdge(renderedEdge)) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered edge ${edge.id} failed final validation`,
      );
      return null;
    }
    return renderedEdge;
  }
  renderAggregatedEdge(
    aggregatedEdge: any,
    visState?: VisualizationState,
  ): ReactFlowEdge | null {
    // Enhanced validation for aggregated edges
    const validation = this.validateEdgeForRendering(
      aggregatedEdge,
      "aggregated",
    );
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render aggregated edge ${aggregatedEdge.id}: ${validation.reason}`,
      );
      return null;
    }
    const handles = visState
      ? this.getSmartHandles(
          visState,
          aggregatedEdge.source,
          aggregatedEdge.target,
        )
      : {};
    // Get source and target node dimensions to create a unique key
    const sourceNode = visState?.getGraphNode(aggregatedEdge.source);
    const targetNode = visState?.getGraphNode(aggregatedEdge.target);
    const sourceDim = sourceNode?.dimensions
      ? `${sourceNode.dimensions.width}x${sourceNode.dimensions.height}`
      : "def";
    const targetDim = targetNode?.dimensions
      ? `${targetNode.dimensions.width}x${targetNode.dimensions.height}`
      : "def";

    const renderedEdge = {
      id: aggregatedEdge.id,
      source: aggregatedEdge.source,
      target: aggregatedEdge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: "aggregated",
      // Add a key that changes when node dimensions change to force ReactFlow recalculation
      key: `${aggregatedEdge.id}-${sourceDim}-${targetDim}`,
      data: {
        semanticTags: aggregatedEdge.semanticTags || [],
        originalEdgeIds: aggregatedEdge.originalEdgeIds || [],
        aggregationSource: aggregatedEdge.aggregationSource,
        aggregated: true,
      },
    };
    // Final validation of rendered edge
    if (!this.validateRenderedEdge(renderedEdge)) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered aggregated edge ${aggregatedEdge.id} failed final validation`,
      );
      return null;
    }
    return renderedEdge;
  }
  // ============================================================================
  // SEARCH AND NAVIGATION HIGHLIGHTING
  // ============================================================================
  /**
   * OPTIMIZED: Apply all highlights in a single pass
   */
  private applyAllHighlights<T extends ReactFlowNode | ReactFlowEdge>(
    elements: T[],
    state: VisualizationState,
    elementType: "node" | "edge",
  ): T[] {
    try {
      // PERFORMANCE OPTIMIZATION: If no highlight method exists, skip all processing
      if (!state.getGraphElementHighlightType) {
        return elements; // No highlighting capability, return as-is
      }

      // PERFORMANCE OPTIMIZATION: For large graphs, check if any highlights exist first
      if (elements.length > 100) {
        // Sample a few elements to see if any highlights exist
        const sampleSize = Math.min(10, elements.length);
        let hasAnyHighlights = false;
        for (let i = 0; i < sampleSize; i++) {
          if (state.getGraphElementHighlightType(elements[i].id)) {
            hasAnyHighlights = true;
            break;
          }
        }

        // If no highlights found in sample, likely no highlights at all
        if (!hasAnyHighlights) {
          return elements; // Skip expensive per-element processing
        }
      }

      return elements.map((element) => {
        const highlightType = state.getGraphElementHighlightType(element.id);

        if (!highlightType) {
          // No highlights to apply, return as-is (don't clear non-existent highlights)
          return element;
        }

        // Apply appropriate highlights based on type
        if (highlightType === "search") {
          return elementType === "node"
            ? (this.applySearchHighlightToElement(
                element as ReactFlowNode,
                state,
              ) as T)
            : (this.applySearchHighlightToEdge(
                element as ReactFlowEdge,
                state,
              ) as T);
        } else if (highlightType === "navigation") {
          return elementType === "node"
            ? (this.applyNavigationHighlightToElement(
                element as ReactFlowNode,
                state,
              ) as T)
            : (this.applyNavigationHighlightToEdge(
                element as ReactFlowEdge,
                state,
              ) as T);
        } else if (highlightType === "both") {
          // Apply both highlights - navigation takes precedence for styling
          return elementType === "node"
            ? (this.applyNavigationHighlightToElement(
                element as ReactFlowNode,
                state,
              ) as T)
            : (this.applyNavigationHighlightToEdge(
                element as ReactFlowEdge,
                state,
              ) as T);
        }

        return element;
      });
    } catch (error) {
      console.error(
        `[ReactFlowBridge] Error applying highlights to ${elementType}s:`,
        error,
      );
      return elements; // Return original elements on error
    }
  }
  /**
   * Get search highlight style for a node
   */
  private getSearchHighlightStyle(
    node: ReactFlowNode,
    state: VisualizationState,
  ): React.CSSProperties {
    // Check if this is the current search result
    const isCurrentResult = state.getCurrentSearchResult()?.id === node.id;
    const colors = isCurrentResult
      ? SEARCH_CURRENT_COLORS
      : SEARCH_HIGHLIGHT_COLORS;
    return {
      backgroundColor: colors.backgroundColor,
      border: `${HIGHLIGHT_STYLING.BORDER_WIDTH} solid ${colors.border}`,
      boxShadow: `0 0 8px ${colors.border}${HIGHLIGHT_STYLING.GLOW_OPACITY}`, // Add glow effect
    };
  }
  /**
   * Get navigation highlight style for a node
   */
  private getNavigationHighlightStyle(
    _node: ReactFlowNode,
    _state: VisualizationState,
  ): React.CSSProperties {
    return {
      backgroundColor: NAVIGATION_HIGHLIGHT_COLORS.backgroundColor,
      border: `${HIGHLIGHT_STYLING.BORDER_WIDTH} solid ${NAVIGATION_HIGHLIGHT_COLORS.border}`,
      boxShadow: `0 0 8px ${NAVIGATION_HIGHLIGHT_COLORS.border}${HIGHLIGHT_STYLING.GLOW_OPACITY}`, // Add glow effect
    };
  }
  /**
   * Get search highlight style for an edge
   */
  private getSearchHighlightStyleForEdge(
    _edge: ReactFlowEdge,
    _state: VisualizationState,
  ): React.CSSProperties {
    return {
      stroke: SEARCH_HIGHLIGHT_COLORS.border,
      strokeWidth: HIGHLIGHT_STYLING.EDGE_STROKE_WIDTH,
    };
  }
  /**
   * Get navigation highlight style for an edge
   */
  private getNavigationHighlightStyleForEdge(
    _edge: ReactFlowEdge,
    _state: VisualizationState,
  ): React.CSSProperties {
    return {
      stroke: NAVIGATION_HIGHLIGHT_COLORS.border,
      strokeWidth: HIGHLIGHT_STYLING.EDGE_STROKE_WIDTH,
    };
  }
  /**
   * Create a highlighted node with immutable properties
   */
  private createHighlightedNode(
    node: ReactFlowNode,
    highlightStyle: React.CSSProperties,
    highlightType: "search" | "navigation",
  ): ReactFlowNode {
    // Combine existing style with highlight style
    const combinedStyle = {
      ...node.style,
      ...highlightStyle,
    };
    // Create new node with highlight data
    const result = {
      ...node,
      style: combinedStyle,
      data: {
        ...node.data,
        highlightType,
        isHighlighted: true,
        highlightTimestamp: Date.now(), // Force React to recognize data change
      },
    };
    // Freeze for immutability
    Object.freeze(result);
    Object.freeze(result.style);
    Object.freeze(result.data);
    return result;
  }
  /**
   * Create a highlighted edge with immutable properties
   */
  private createHighlightedEdge(
    edge: ReactFlowEdge,
    highlightStyle: React.CSSProperties,
    highlightType: "search" | "navigation",
  ): ReactFlowEdge {
    // Combine existing style with highlight style
    const combinedStyle = {
      ...edge.style,
      ...highlightStyle,
    };
    // Create new edge with highlight data
    const result = {
      ...edge,
      style: combinedStyle,
      data: {
        ...edge.data,
        highlightType,
        isHighlighted: true,
      },
    };
    // Freeze for immutability
    Object.freeze(result);
    Object.freeze(result.style);
    Object.freeze(result.data);
    return result;
  }

  private applySearchHighlightToElement(
    node: ReactFlowNode,
    state: VisualizationState,
  ): ReactFlowNode {
    const searchStyle = this.getSearchHighlightStyle(node, state);
    return this.createHighlightedNode(node, searchStyle, "search");
  }

  private applyNavigationHighlightToElement(
    node: ReactFlowNode,
    state: VisualizationState,
  ): ReactFlowNode {
    const navigationStyle = this.getNavigationHighlightStyle(node, state);
    return this.createHighlightedNode(node, navigationStyle, "navigation");
  }

  private applySearchHighlightToEdge(
    edge: ReactFlowEdge,
    state: VisualizationState,
  ): ReactFlowEdge {
    const searchStyle = this.getSearchHighlightStyleForEdge(edge, state);
    return this.createHighlightedEdge(edge, searchStyle, "search");
  }

  private applyNavigationHighlightToEdge(
    edge: ReactFlowEdge,
    state: VisualizationState,
  ): ReactFlowEdge {
    const navigationStyle = this.getNavigationHighlightStyleForEdge(
      edge,
      state,
    );
    return this.createHighlightedEdge(edge, navigationStyle, "navigation");
  }
}
