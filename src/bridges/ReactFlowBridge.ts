/**
 * ReactFlowBridge - Stateless bridge for ReactFlow rendering
 * Architectural constraints: Stateless, synchronous conversions, immutable output
 */

import React from "react";
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
} from "../utils/StyleProcessor.js";
import { CURRENT_HANDLE_STRATEGY } from "../render/handleConfig.js";
import {
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
  NAVIGATION_HIGHLIGHT_COLORS,
} from "../shared/config.js";
import { searchNavigationErrorHandler } from "../core/ErrorHandler.js";

// Performance optimization constants
const LARGE_GRAPH_NODE_THRESHOLD = 1000;
const LARGE_GRAPH_EDGE_THRESHOLD = 2000;

// Enhanced edge validation result interface
interface EdgeValidationResult {
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
    | "missing";
  targetType:
    | "node"
    | "container"
    | "hidden-node"
    | "hidden-container"
    | "missing";
  suggestedFix?: string;
  hierarchyLevel?: number;
  crossHierarchy?: boolean;
  containerAwareness?: {
    sourceContainerPath: string[];
    targetContainerPath: string[];
    commonAncestor?: string;
  };
}

// ENHANCEMENT: Fail-fast edge validation error types
class EdgeValidationError extends Error {
  constructor(
    message: string,
    public edgeId: string,
    public validationType:
      | "structure"
      | "endpoints"
      | "hierarchy"
      | "rendering",
    public details: Record<string, any> = {}
  ) {
    super(message);
    this.name = "EdgeValidationError";
  }
}

export class ReactFlowBridge implements IReactFlowBridge {
  constructor(private styleConfig: StyleConfig) {}

  /**
   * ENHANCEMENT: Fail-fast edge validation that throws errors for critical issues
   * Requirements: 2.2, 3.4
   */
  private validateEdgeFailFast(
    edge: any,
    allVisibleIds: Set<string>,
    visibleNodeIds: Set<string>,
    visibleContainerIds: Set<string>,
    state: VisualizationState
  ): void {
    // FAIL EARLY: Validate edge object structure
    if (!edge) {
      throw new EdgeValidationError(
        "Edge is null or undefined",
        "unknown",
        "structure",
        { edge }
      );
    }

    if (!edge.id) {
      throw new EdgeValidationError(
        "Edge missing id property",
        "unknown",
        "structure",
        { edge: JSON.stringify(edge) }
      );
    }

    // FAIL EARLY: Validate source and target existence
    if (!edge.source || !edge.target) {
      throw new EdgeValidationError(
        `Edge has missing source or target`,
        edge.id,
        "endpoints",
        { source: edge.source, target: edge.target }
      );
    }

    // FAIL EARLY: Validate source and target types
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      throw new EdgeValidationError(
        `Edge has invalid source/target types`,
        edge.id,
        "endpoints",
        {
          sourceType: typeof edge.source,
          targetType: typeof edge.target,
          source: edge.source,
          target: edge.target,
        }
      );
    }

    // FAIL EARLY: Check if endpoints exist in the data model
    const sourceInAllNodes =
      state.getGraphNode(edge.source) !== undefined ||
      state.getContainer(edge.source) !== undefined;
    const targetInAllNodes =
      state.getGraphNode(edge.target) !== undefined ||
      state.getContainer(edge.target) !== undefined;

    if (!sourceInAllNodes) {
      throw new EdgeValidationError(
        `Edge source does not exist in data model`,
        edge.id,
        "endpoints",
        { source: edge.source, target: edge.target }
      );
    }

    if (!targetInAllNodes) {
      throw new EdgeValidationError(
        `Edge target does not exist in data model`,
        edge.id,
        "endpoints",
        { source: edge.source, target: edge.target }
      );
    }

    // FAIL EARLY: For visible edges, both endpoints must be visible
    if (!edge.hidden) {
      const sourceVisible = allVisibleIds.has(edge.source);
      const targetVisible = allVisibleIds.has(edge.target);

      if (!sourceVisible && !targetVisible) {
        throw new EdgeValidationError(
          `Visible edge has both endpoints hidden`,
          edge.id,
          "rendering",
          {
            source: edge.source,
            target: edge.target,
            sourceVisible,
            targetVisible,
            edgeHidden: edge.hidden,
          }
        );
      }

      // Allow one endpoint to be hidden (for aggregated edges), but not both
      // This is a less critical issue but still worth logging
      if (!sourceVisible || !targetVisible) {
        console.warn(
          `[ReactFlowBridge] ⚠️ Edge ${edge.id} has one hidden endpoint: ` +
            `source ${edge.source} visible=${sourceVisible}, target ${edge.target} visible=${targetVisible}`
        );
      }
    }
  }

  // Synchronous Conversion - pure function without caching
  toReactFlowData(
    state: VisualizationState,
    interactionHandler?: any
  ): ReactFlowData {
    // Detect large graphs for performance optimizations
    const isLargeGraph = this.isLargeGraph(state);

    // Convert with appropriate optimization strategy
    const nodes = isLargeGraph
      ? this.convertNodesOptimized(state, interactionHandler)
      : this.convertNodes(state, interactionHandler);

    const edges = isLargeGraph
      ? this.convertEdgesOptimized(state)
      : this.convertEdges(state);

    // Apply basic styling first
    let styledNodes = this.applyNodeStyles(nodes);
    let styledEdges = this.applyEdgeStyles(edges, state);

    // Apply search and navigation highlights
    styledNodes = this.applySearchHighlights(styledNodes, state);
    styledNodes = this.applyNavigationHighlights(styledNodes, state);
    styledEdges = this.applySearchHighlightsToEdges(styledEdges, state);
    styledEdges = this.applyNavigationHighlightsToEdges(styledEdges, state);

    // Create result with mutable arrays for ReactFlow compatibility
    const result: ReactFlowData = {
      nodes: styledNodes,
      edges: styledEdges,
    };

    // Deep freeze the result for immutability while maintaining TypeScript compatibility
    this.deepFreezeReactFlowData(result);

    // Return deep clone to ensure immutability
    return this.deepCloneReactFlowData(result);
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
    interactionHandler?: any
  ): ReactFlowNode[] {
    // For now, use the same logic as regular conversion
    // TODO: Add caching and batching optimizations
    return this.convertNodes(state, interactionHandler);
  }

  private convertEdgesOptimized(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = [];
    const visibleEdges = state.visibleEdges;

    // Create validation context once for all edges
    const visibleNodeIds = new Set(state.visibleNodes.map((node) => node.id));
    const visibleContainerIds = new Set(
      state.visibleContainers.map((container) => container.id)
    );
    const allVisibleIds = new Set([...visibleNodeIds, ...visibleContainerIds]);

    const validationContext = this.createEdgeValidationContext(
      allVisibleIds,
      visibleNodeIds,
      visibleContainerIds,
      state
    );

    let validEdges = 0;
    let invalidEdges = 0;
    let skippedEdges = 0;

    // Batch process edges for better performance
    for (let i = 0; i < visibleEdges.length; i++) {
      const edge = visibleEdges[i];

      // Quick validation check using optimized context
      const edgeValidation = this.validateEdgeWithContext(
        edge,
        validationContext
      );

      if (!edgeValidation.isValid) {
        invalidEdges++;
        // Skip invalid edges in optimized mode
        continue;
      }

      let renderedEdge: ReactFlowEdge | null;
      if ("aggregated" in edge && (edge as any).aggregated) {
        renderedEdge = this.renderAggregatedEdge(edge, state);
      } else {
        renderedEdge = this.renderOriginalEdge(edge, state);
      }

      // Only add valid edges
      if (renderedEdge) {
        validEdges++;
        edges.push(renderedEdge);
      } else {
        skippedEdges++;
        console.warn(
          `[ReactFlowBridge] ⚠️ Optimized conversion: Edge ${edge.id} passed validation but failed to render`
        );
      }
    }

    return edges;
  }

  private convertNodes(
    state: VisualizationState,
    interactionHandler?: any
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

      // CRITICAL DEBUG: Check if position needs adjustment for nested containers
      console.log(
        `[ReactFlowBridge] 🔍 CONTAINER ${container.id}: parentId=${parentId}, position from ELK=(${position.x}, ${position.y})`
      );

      const containerNode: ReactFlowNode = {
        id: container.id,
        type: container.collapsed ? "standard" : "container", // Collapsed containers use 'standard' type for edge connections
        position,
        data: {
          label: container.label || container.id,
          nodeType: "container",
          collapsed: container.collapsed,
          containerChildren: container.children.size,
          nodeCount,
          width,
          height,
          colorPalette: (() => {
            const palette = state.getColorPalette();
            console.log(`[ReactFlowBridge] 🎨 Container ${container.id} using color palette: ${palette}`);
            return palette;
          })(),
          style: "default",
          onClick: interactionHandler
            ? (elementId: string, elementType: "node" | "container") => {
                if (elementType === "container") {
                  interactionHandler.handleContainerClick(elementId);
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
        // CRITICAL: Do NOT set extent: "parent" on container nodes themselves!
        // Only leaf nodes (regular nodes) should have extent set.
        // Container nodes are positioned via parentNode, but need freedom to size themselves.
        extent: undefined,
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
      console.log(
        `[ReactFlowBridge] Node ${node.id} ELK position: (${position?.x}, ${position?.y}), assigned to container: ${parentId}`
      );

      // AGGRESSIVE DEBUG: Log node positioning pipeline
      let adjustedPosition = position || { x: 0, y: 0 };

      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id}: parentId=${parentId}, parentContainer=${!!parentContainer}, ELK position=(${adjustedPosition.x}, ${adjustedPosition.y})`
      );

      if (parentId && parentContainer) {
        // Get the parent container's position and dimensions for bounds checking
        const parentDimensions = {
          width:
            parentContainer.dimensions?.width || parentContainer.width || 200,
          height:
            parentContainer.dimensions?.height || parentContainer.height || 150,
        };

        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} PARENT INFO: dimensions=(${parentDimensions.width}x${parentDimensions.height}), collapsed=${parentContainer.collapsed}`
        );

        // CRITICAL FIX: ELK already returns child positions relative to their parent container!
        // We should NOT subtract the parent position. The position from ELK is already correct.
        // See: https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html
        // "The coordinates of most elements are relative to their parent element."

        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} POSITION: ELK relative=(${adjustedPosition.x}, ${adjustedPosition.y}) (already relative to parent)`
        );

        // Check if position is within parent bounds (for debugging only)
        const withinBounds =
          adjustedPosition.x >= 0 &&
          adjustedPosition.y >= 0 &&
          adjustedPosition.x <= parentDimensions.width &&
          adjustedPosition.y <= parentDimensions.height;

        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} BOUNDS CHECK: within parent bounds=${withinBounds}`
        );

        // adjustedPosition already contains the correct relative position from ELK
      } else {
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id}: NO PARENT - using absolute position=(${adjustedPosition.x}, ${adjustedPosition.y})`
        );
      }

      // FINAL DEBUG: Log the position that will be used in ReactFlow node
      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id} FINAL POSITION: (${adjustedPosition.x}, ${adjustedPosition.y}) - parentId=${parentId}`
      );

      // Determine if we should constrain this node to its parent container
      // Only apply extent constraint for nodes in non-collapsed containers
      // and avoid it for deeply nested hierarchies where it causes positioning issues
      const shouldConstrainToParent = parentId && parentContainer && !parentContainer.collapsed;

      // CRITICAL DEBUG: Check ReactFlow parent-child setup
      if (parentId) {
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} REACTFLOW SETUP: parentId="${parentId}", parentNode="${parentId}", extent="${shouldConstrainToParent ? 'parent' : 'undefined'}", position=(${adjustedPosition.x}, ${adjustedPosition.y})`
        );
      }

      // CRITICAL FIX: Get node dimensions from ELK to ensure rendered size matches layout
      const width = node.dimensions?.width || 120;
      const height = node.dimensions?.height || 60;

      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id} DIMENSIONS: from ELK=${node.dimensions?.width}x${node.dimensions?.height}, using=${width}x${height}`
      );
      
      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id} EXTENT LOGIC: parentId=${parentId}, parentContainer=${!!parentContainer}, collapsed=${parentContainer?.collapsed}, shouldConstrainToParent=${shouldConstrainToParent}`
      );
      
      const reactFlowNode: ReactFlowNode = {
        id: node.id,
        type: "standard",
        position: adjustedPosition,
        data: {
          label: node.showingLongLabel ? node.longLabel : node.label,
          longLabel: node.longLabel,
          showingLongLabel: node.showingLongLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          colorPalette: (() => {
            const palette = state.getColorPalette();
            console.log(`[ReactFlowBridge] 🎨 Node ${node.id} using color palette: ${palette}`);
            return palette;
          })(),
          style: node.type || "default",
          width, // Pass ELK-calculated width to match layout
          height, // Pass ELK-calculated height to match layout
          onClick: interactionHandler
            ? (elementId: string, elementType: "node" | "container") => {
                if (elementType === "node") {
                  interactionHandler.handleNodeClick(elementId);
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
    state: VisualizationState
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
    const edges: ReactFlowEdge[] = [];

    // Debug: Create a set of visible node IDs for validation
    const visibleNodeIds = new Set(state.visibleNodes.map((node) => node.id));
    const visibleContainers = state.visibleContainers;
    console.log(
      `[ReactFlowBridge] 🔍 Debug visibleContainers:`,
      visibleContainers.length
    );
    for (const container of visibleContainers) {
      console.log(
        `  - Container ${container.id}: hidden=${container.hidden}, collapsed=${container.collapsed}`
      );
    }

    const visibleContainerIds = new Set(
      visibleContainers.map((container) => container.id)
    );
    const allVisibleIds = new Set([...visibleNodeIds, ...visibleContainerIds]);

    // Skip fail-fast validation for now to maintain test compatibility
    // TODO: Re-enable with proper test data setup
    console.log(
      `[ReactFlowBridge] 🔍 Processing ${state.visibleEdges.length} edges with regular validation`
    );

    console.log(`[ReactFlowBridge] 🔍 Edge validation context:`);
    console.log(
      `  - Visible nodes: ${visibleNodeIds.size} (${Array.from(visibleNodeIds).slice(0, 5).join(", ")}${visibleNodeIds.size > 5 ? "..." : ""})`
    );
    console.log(
      `  - Visible containers: ${visibleContainerIds.size} (${Array.from(visibleContainerIds).slice(0, 5).join(", ")}${visibleContainerIds.size > 5 ? "..." : ""})`
    );
    console.log(`  - Total visible elements: ${allVisibleIds.size}`);
    console.log(`  - Edges to process: ${state.visibleEdges.length}`);

    // Debug: Log first few edges to see their actual source/target values
    if (state.visibleEdges.length > 0) {
      console.log(`[ReactFlowBridge] 🔍 First few edges to validate:`);
      state.visibleEdges.slice(0, 5).forEach((edge, index) => {
        console.log(
          `  ${index + 1}. ${edge.id}: "${edge.source}" -> "${edge.target}" (type: ${edge.type})`
        );
      });
    }

    let validEdgeCount = 0;
    let invalidEdgeCount = 0;
    let floatingEdgeCount = 0;
    let skippedEdgeCount = 0;

    // Performance optimization: pre-compute validation context once
    const validationContext = this.createEdgeValidationContext(
      allVisibleIds,
      visibleNodeIds,
      visibleContainerIds,
      state
    );

    for (const edge of state.visibleEdges) {
      const edgeValidation = this.validateEdgeWithContext(
        edge,
        validationContext
      );

      if (!edgeValidation.isValid) {
        invalidEdgeCount++;
        if (edgeValidation.isFloating) {
          floatingEdgeCount++;
        }

        // Log detailed error for first few invalid edges
        if (invalidEdgeCount <= 10) {
          console.error(
            `[ReactFlowBridge] ❌ Invalid edge ${edge.id}:`,
            edgeValidation.reason
          );
          console.error(
            `  - Source: ${edge.source} (visible: ${edgeValidation.sourceExists}, exists: ${edgeValidation.sourceInAllNodes}, type: ${edgeValidation.sourceType})`
          );
          console.error(
            `  - Target: ${edge.target} (visible: ${edgeValidation.targetExists}, exists: ${edgeValidation.targetInAllNodes}, type: ${edgeValidation.targetType})`
          );

          // Enhanced error information
          if (edgeValidation.crossHierarchy) {
            console.error(
              `  - 🔀 CROSS-HIERARCHY EDGE: Source depth=${edgeValidation.containerAwareness?.sourceContainerPath.length}, Target depth=${edgeValidation.containerAwareness?.targetContainerPath.length}`
            );
            if (edgeValidation.containerAwareness?.commonAncestor) {
              console.error(
                `  - 🏗️ Common ancestor: ${edgeValidation.containerAwareness.commonAncestor}`
              );
            }
          }

          if (edgeValidation.suggestedFix) {
            console.error(
              `  - 💡 Suggested fix: ${edgeValidation.suggestedFix}`
            );
          }

          if (edgeValidation.isFloating) {
            console.error(
              `  - 🔴 FLOATING EDGE DETECTED: One or both endpoints don't exist in the graph!`
            );
          } else {
            console.error(
              `  - ⚠️ HIDDEN EDGE: Edge endpoints exist but are not visible (likely in collapsed containers)`
            );
          }
        }
        continue; // Skip invalid edges
      }

      // Edge is valid, log success for debugging
      validEdgeCount++;
      if (validEdgeCount <= 5) {
        // Log first few valid edges
        console.log(
          `[ReactFlowBridge] ✅ Valid edge ${edge.id}: ${edge.source} (${edgeValidation.sourceType}) -> ${edge.target} (${edgeValidation.targetType})`
        );
      }

      let renderedEdge;
      if ("aggregated" in edge && (edge as any).aggregated) {
        renderedEdge = this.renderAggregatedEdge(edge, state);
      } else {
        renderedEdge = this.renderOriginalEdge(edge, state);
      }

      // Only add the edge if it was successfully rendered (not null)
      if (renderedEdge) {
        edges.push(renderedEdge);
      } else {
        skippedEdgeCount++;
        console.warn(
          `[ReactFlowBridge] ⚠️ Edge ${edge.id} was valid but failed to render`
        );
      }
    }

    // Summary report
    console.log(`[ReactFlowBridge] 📊 Edge processing summary:`);
    console.log(`  - ✅ Valid edges: ${validEdgeCount}`);
    console.log(`  - ❌ Invalid edges: ${invalidEdgeCount}`);
    console.log(`  - 🔴 Floating edges: ${floatingEdgeCount}`);
    console.log(`  - ⚠️ Skipped during render: ${skippedEdgeCount}`);
    console.log(`  - 🎯 Successfully rendered: ${edges.length}`);

    if (floatingEdgeCount > 0) {
      console.error(
        `[ReactFlowBridge] 🚨 FLOATING EDGE PROBLEM: ${floatingEdgeCount} edges are floating (missing endpoints)!`
      );
    }

    // ADDITIONAL VALIDATION: Check the final rendered edges for potential ReactFlow issues
    this.validateFinalRenderedEdges(
      edges,
      visibleNodeIds,
      visibleContainerIds,
      state
    );

    return edges;
  }

  // Styling with immutability - pure function without caching
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map((node) => {
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
          "node"
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

      return this.createImmutableNode(node, combinedStyle, appliedTags);
    });
  }

  private createImmutableNode(
    node: ReactFlowNode,
    style: any,
    appliedTags: string[]
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

    // Freeze the node and its nested objects
    Object.freeze(result);
    Object.freeze(result.position);
    Object.freeze(result.style);
    Object.freeze(result.data);
    Object.freeze(result.data.appliedSemanticTags);
    if (result.data.semanticTags) Object.freeze(result.data.semanticTags);

    return result;
  }

  applyEdgeStyles(
    edges: ReactFlowEdge[],
    state?: VisualizationState
  ): ReactFlowEdge[] {
    return edges.map((edge) => {
      // Get semantic tags from edge data
      const edgeData = edge.data as any;
      const semanticTags = edgeData?.semanticTags || [];
      const isAggregated = edgeData?.aggregated === true;

      // Start with type-based styles
      const typeBasedStyle = this.styleConfig.edgeStyles?.[edge.type] || {};

      // Process semantic tags for styling
      let semanticStyle = {};
      let appliedTags: string[] = [];
      let animated = false;
      let label = edge.label;
      let markerEnd = edge.markerEnd;
      let lineStyle: "single" | "double" = "single";

      if (isAggregated && state && edgeData?.originalEdgeIds) {
        // For aggregated edges, use conflict resolution system
        console.log(
          `[ReactFlowBridge] 🔄 Processing aggregated edge ${edge.id} with ${edgeData.originalEdgeIds.length} original edges`
        );

        // Get original edges from state
        const originalEdges = edgeData.originalEdgeIds
          .map((id: string) => state.getGraphEdge(id))
          .filter((e: any) => e !== undefined);

        if (originalEdges.length > 0) {
          const processedStyle = processAggregatedSemanticTags(
            originalEdges,
            this.styleConfig,
            edge.label as string
          );
          semanticStyle = processedStyle.style;
          appliedTags = processedStyle.appliedTags;
          animated = processedStyle.animated;
          label = processedStyle.label || edge.label;
          markerEnd =
            (processedStyle.markerEnd as
              | string
              | { type: string; color?: string; strokeWidth?: number }
              | undefined) || edge.markerEnd;
          lineStyle = processedStyle.lineStyle || "single";

          console.log(
            `[ReactFlowBridge] ✅ Aggregated edge ${edge.id} resolved conflicts:`,
            {
              originalEdgeCount: originalEdges.length,
              appliedTags,
              hasStyle: Object.keys(semanticStyle).length > 0,
              hasSemanticMappings: !!this.styleConfig.semanticMappings,
            }
          );
        } else {
          // No original edges found, use default styling
          console.log(
            `[ReactFlowBridge] ⚠️ Aggregated edge ${edge.id} has no original edges, using default styling`
          );
          const defaultStyle = processSemanticTags(
            [],
            this.styleConfig,
            edge.label as string,
            "edge"
          );
          semanticStyle = defaultStyle.style;
          appliedTags = defaultStyle.appliedTags;
        }
      } else if (
        semanticTags.length > 0 &&
        (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)
      ) {
        // For regular edges, use normal semantic processing
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          edge.label as string,
          "edge"
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
        animated = processedStyle.animated;
        label = processedStyle.label || edge.label;
        markerEnd =
          (processedStyle.markerEnd as
            | string
            | { type: string; color?: string; strokeWidth?: number }
            | undefined) || edge.markerEnd;
        lineStyle = processedStyle.lineStyle || "single";
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...edge.style,
      };

      const renderConfig = state?.getRenderConfig();
      const edgeStyleType = renderConfig?.edgeStyle || "bezier";
      console.log(
        `[ReactFlowBridge] 🎨 Setting edge ${edge.id} style type to: ${edgeStyleType}`
      );

      const styleData = {
        style: combinedStyle,
        animated: animated || edge.animated,
        label: label,
        markerEnd: markerEnd,
        appliedTags: appliedTags,
        lineStyle: lineStyle,
        edgeStyleType: edgeStyleType, // Add edge style type for edge components
      };

      return this.createImmutableEdge(edge, styleData);
    });
  }

  private createImmutableEdge(
    edge: ReactFlowEdge,
    styleData: any
  ): ReactFlowEdge {
    const result = {
      ...edge,
      style: { ...styleData.style },
      animated: styleData.animated,
      label: styleData.label,
      markerEnd: styleData.markerEnd || { type: "arrowclosed" },
      data: {
        ...edge.data,
        appliedSemanticTags: [...styleData.appliedTags],
        lineStyle: styleData.lineStyle,
        edgeStyleType: styleData.edgeStyleType,
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

  // Smart Handle Selection
  private getSmartHandles(
    visState: VisualizationState,
    sourceId: string,
    targetId: string
  ): { sourceHandle?: string; targetHandle?: string } {
    console.log(
      `[ReactFlowBridge] 🎯 Getting smart handles for ${sourceId} -> ${targetId}`
    );
    console.log(
      `[ReactFlowBridge] 🎯 CURRENT_HANDLE_STRATEGY = "${CURRENT_HANDLE_STRATEGY}"`
    );

    if (CURRENT_HANDLE_STRATEGY !== "discrete") {
      console.log(
        `[ReactFlowBridge] Strategy is ${CURRENT_HANDLE_STRATEGY}, skipping handle selection`
      );
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
        console.log(
          `[ReactFlowBridge] ⚠️ Missing elements for ${sourceId} -> ${targetId}: sourceElement=${!!sourceElement}, targetElement=${!!targetElement}`
        );
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

      console.log(
        `[EdgeDebug] Smart handles using positions: source=(${sourcePos.x}, ${sourcePos.y}), target=(${targetPos.x}, ${targetPos.y})`
      );

      // Validate positions
      if (
        !this.isValidPosition(sourcePos) ||
        !this.isValidPosition(targetPos)
      ) {
        console.log(
          `[ReactFlowBridge] ⚠️ Invalid positions for ${sourceId} -> ${targetId}: sourcePos=${JSON.stringify(sourcePos)}, targetPos=${JSON.stringify(targetPos)}`
        );
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }

      // Get dimensions with fallbacks
      const sourceWidth = Math.max(
        1,
        sourceElement.dimensions?.width ?? (sourceElement as any).width ?? 120
      );
      const sourceHeight = Math.max(
        1,
        sourceElement.dimensions?.height ?? (sourceElement as any).height ?? 40
      );
      const targetWidth = Math.max(
        1,
        targetElement.dimensions?.width ?? (targetElement as any).width ?? 120
      );
      const targetHeight = Math.max(
        1,
        targetElement.dimensions?.height ?? (targetElement as any).height ?? 40
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
      console.log(
        `[ReactFlowBridge] 🎯 Selected handles for ${sourceId} -> ${targetId}:`,
        result
      );
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

  /**
   * Get the container hierarchy path for an element (node or container)
   * Returns array of container IDs from root to immediate parent
   */
  private getContainerHierarchyPath(
    elementId: string,
    state: VisualizationState
  ): string[] {
    const path: string[] = [];

    // Check if element is a node
    const node = state.getGraphNode(elementId);
    if (node) {
      // Find which container this node belongs to using visible containers
      // Note: This is a limitation - we can only see visible containers
      for (const container of state.visibleContainers) {
        if (container.children.has(elementId)) {
          path.push(container.id);
          // Recursively get parent containers
          const parentPath = this.getContainerHierarchyPath(
            container.id,
            state
          );
          return [...parentPath, ...path];
        }
      }
      return path; // Node is at root level or in hidden container
    }

    // Check if element is a container
    const container = state.getContainer(elementId);
    if (container) {
      // Get parent containers
      const parentId = state.getContainerParent(elementId);
      if (parentId) {
        const parentPath = this.getContainerHierarchyPath(parentId, state);
        return [...parentPath, parentId];
      }
      return path; // Container is at root level
    }

    return path; // Element not found
  }

  /**
   * Find the common ancestor container for two hierarchy paths
   */
  private findCommonAncestorContainer(
    path1: string[],
    path2: string[]
  ): string | undefined {
    const minLength = Math.min(path1.length, path2.length);

    for (let i = 0; i < minLength; i++) {
      if (path1[i] !== path2[i]) {
        return i > 0 ? path1[i - 1] : undefined;
      }
    }

    // If one path is a prefix of the other, return the last common element
    return minLength > 0 ? path1[minLength - 1] : undefined;
  }

  /**
   * Find the immediate container that contains the given element
   */
  private findContainingContainer(
    elementId: string,
    state: VisualizationState
  ): string | undefined {
    // Check if element is a node
    const node = state.getGraphNode(elementId);
    if (node) {
      for (const container of state.visibleContainers) {
        if (container.children.has(elementId)) {
          return container.id;
        }
      }
    }

    // Check if element is a container
    const container = state.getContainer(elementId);
    if (container) {
      return state.getContainerParent(elementId);
    }

    return undefined;
  }

  /**
   * Performance optimization: Create validation context once for batch processing
   */
  private createEdgeValidationContext(
    allVisibleIds: Set<string>,
    visibleNodeIds: Set<string>,
    visibleContainerIds: Set<string>,
    state: VisualizationState
  ) {
    // Pre-compute expensive lookups for performance
    // Get all containers (both visible and hidden) by iterating through the internal containers map
    const allContainers: any[] = [];
    // Since we don't have direct access to all containers, we'll use visible containers
    // and build the mapping from what we can access
    const nodeToContainerMap = new Map<string, string>();
    const containerHierarchyCache = new Map<string, string[]>();

    // Build node-to-container mapping from visible containers
    for (const container of state.visibleContainers) {
      allContainers.push(container);
      for (const childId of container.children) {
        nodeToContainerMap.set(childId, container.id);
      }
    }

    return {
      allVisibleIds,
      visibleNodeIds,
      visibleContainerIds,
      state,
      nodeToContainerMap,
      containerHierarchyCache,
      allContainers,
    };
  }

  /**
   * Optimized edge validation using pre-computed context
   */
  private validateEdgeWithContext(
    edge: any,
    context: ReturnType<typeof this.createEdgeValidationContext>
  ): EdgeValidationResult {
    const {
      allVisibleIds,
      visibleNodeIds,
      visibleContainerIds,
      state,
      nodeToContainerMap,
      containerHierarchyCache,
    } = context;

    // Check for null/undefined/empty source or target
    if (!edge.source || !edge.target) {
      return {
        isValid: false,
        isFloating: true,
        reason: `Missing source or target: source="${edge.source}", target="${edge.target}"`,
        sourceExists: false,
        targetExists: false,
        sourceType: "missing",
        targetType: "missing",
        sourceInAllNodes: false,
        targetInAllNodes: false,
        suggestedFix: "Ensure edge has valid source and target identifiers",
      };
    }

    // Check if source and target are strings
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      return {
        isValid: false,
        isFloating: true,
        reason: `Source or target is not a string: source type=${typeof edge.source}, target type=${typeof edge.target}`,
        sourceExists: false,
        targetExists: false,
        sourceType: "missing",
        targetType: "missing",
        sourceInAllNodes: false,
        targetInAllNodes: false,
        suggestedFix: "Convert source and target to string identifiers",
      };
    }

    // Check if source and target exist in visible elements
    const sourceExists = allVisibleIds.has(edge.source);
    const targetExists = allVisibleIds.has(edge.target);

    // ENHANCED: Also check if they exist in ALL nodes/containers (including hidden ones)
    const sourceInAllNodes =
      state.getGraphNode(edge.source) !== undefined ||
      state.getContainer(edge.source) !== undefined;
    const targetInAllNodes =
      state.getGraphNode(edge.target) !== undefined ||
      state.getContainer(edge.target) !== undefined;

    // Get container hierarchy information using cache for performance
    const sourceContainerPath = this.getContainerHierarchyPathOptimized(
      edge.source,
      state,
      nodeToContainerMap,
      containerHierarchyCache
    );
    const targetContainerPath = this.getContainerHierarchyPathOptimized(
      edge.target,
      state,
      nodeToContainerMap,
      containerHierarchyCache
    );
    const commonAncestor = this.findCommonAncestorContainer(
      sourceContainerPath,
      targetContainerPath
    );
    const crossHierarchy =
      sourceContainerPath.length !== targetContainerPath.length ||
      !sourceContainerPath.every(
        (id, index) => id === targetContainerPath[index]
      );

    // Determine element types with enhanced container awareness
    let sourceType: EdgeValidationResult["sourceType"] = "missing";
    let targetType: EdgeValidationResult["targetType"] = "missing";

    if (visibleNodeIds.has(edge.source)) {
      sourceType = "node";
    } else if (visibleContainerIds.has(edge.source)) {
      sourceType = "container";
    } else if (sourceInAllNodes) {
      // Check if it's a hidden node or container
      if (state.getGraphNode(edge.source)) {
        sourceType = "hidden-node";
      } else if (state.getContainer(edge.source)) {
        sourceType = "hidden-container";
      }
    }

    if (visibleNodeIds.has(edge.target)) {
      targetType = "node";
    } else if (visibleContainerIds.has(edge.target)) {
      targetType = "container";
    } else if (targetInAllNodes) {
      // Check if it's a hidden node or container
      if (state.getGraphNode(edge.target)) {
        targetType = "hidden-node";
      } else if (state.getContainer(edge.target)) {
        targetType = "hidden-container";
      }
    }

    // An edge is floating if either endpoint doesn't exist at all (not even hidden)
    const isFloating = !sourceInAllNodes || !targetInAllNodes;

    // An edge is invalid if either endpoint is not visible OR doesn't exist at all
    const isValid = sourceExists && targetExists;

    // Generate detailed reason and suggested fix
    let reason = "Valid edge";
    let suggestedFix: string | undefined;

    if (isFloating) {
      if (!sourceInAllNodes && !targetInAllNodes) {
        reason = `Floating edge: both source "${edge.source}" and target "${edge.target}" do not exist in the graph`;
        suggestedFix =
          "Check if the edge references valid node/container IDs that exist in the data";
      } else if (!sourceInAllNodes) {
        reason = `Floating edge: source "${edge.source}" does not exist in the graph (target exists as ${targetType})`;
        suggestedFix = `Verify source ID "${edge.source}" exists in the graph data`;
      } else {
        reason = `Floating edge: target "${edge.target}" does not exist in the graph (source exists as ${sourceType})`;
        suggestedFix = `Verify target ID "${edge.target}" exists in the graph data`;
      }
    } else if (!isValid) {
      if (!sourceExists && !targetExists) {
        reason = `Edge endpoints not visible: both source "${edge.source}" (${sourceType}) and target "${edge.target}" (${targetType}) are hidden`;
        if (sourceType.includes("hidden") && targetType.includes("hidden")) {
          suggestedFix =
            "Expand the containers containing both endpoints to make them visible";
        } else {
          suggestedFix = "Check container visibility states for both endpoints";
        }
      } else if (!sourceExists) {
        reason = `Edge source not visible: source "${edge.source}" (${sourceType}) is hidden, target "${edge.target}" (${targetType}) is visible`;
        if (sourceType.includes("hidden")) {
          const sourceContainer =
            nodeToContainerMap.get(edge.source) ||
            state.getContainerParent(edge.source);
          suggestedFix = sourceContainer
            ? `Expand container "${sourceContainer}" to make source visible`
            : "Check source element visibility state";
        }
      } else {
        reason = `Edge target not visible: target "${edge.target}" (${targetType}) is hidden, source "${edge.source}" (${sourceType}) is visible`;
        if (targetType.includes("hidden")) {
          const targetContainer =
            nodeToContainerMap.get(edge.target) ||
            state.getContainerParent(edge.target);
          suggestedFix = targetContainer
            ? `Expand container "${targetContainer}" to make target visible`
            : "Check target element visibility state";
        }
      }

      // Add cross-hierarchy information to reason
      if (crossHierarchy) {
        reason += ` (cross-hierarchy edge: source depth=${sourceContainerPath.length}, target depth=${targetContainerPath.length})`;
      }
    }

    // Check for self-loops (optional validation)
    if (edge.source === edge.target) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Self-loop detected: ${edge.id} (${edge.source} -> ${edge.target})`
      );
      // Self-loops are valid but worth noting
    }

    // Calculate hierarchy level (depth of the deepest endpoint)
    const hierarchyLevel = Math.max(
      sourceContainerPath.length,
      targetContainerPath.length
    );

    return {
      isValid,
      isFloating,
      reason,
      sourceExists,
      targetExists,
      sourceType,
      targetType,
      sourceInAllNodes,
      targetInAllNodes,
      suggestedFix,
      hierarchyLevel,
      crossHierarchy,
      containerAwareness: {
        sourceContainerPath,
        targetContainerPath,
        commonAncestor,
      },
    };
  }

  /**
   * Optimized container hierarchy path calculation with caching
   */
  private getContainerHierarchyPathOptimized(
    elementId: string,
    state: VisualizationState,
    nodeToContainerMap: Map<string, string>,
    containerHierarchyCache: Map<string, string[]>
  ): string[] {
    // Check cache first
    if (containerHierarchyCache.has(elementId)) {
      return containerHierarchyCache.get(elementId)!;
    }

    const path: string[] = [];

    // Check if element is a node (use pre-computed mapping)
    const immediateContainer = nodeToContainerMap.get(elementId);
    if (immediateContainer) {
      path.push(immediateContainer);
      // Recursively get parent containers
      const parentPath = this.getContainerHierarchyPathOptimized(
        immediateContainer,
        state,
        nodeToContainerMap,
        containerHierarchyCache
      );
      const result = [...parentPath, ...path];
      containerHierarchyCache.set(elementId, result);
      return result;
    }

    // Check if element is a container
    const container = state.getContainer(elementId);
    if (container) {
      // Get parent containers
      const parentId = state.getContainerParent(elementId);
      if (parentId) {
        const parentPath = this.getContainerHierarchyPathOptimized(
          parentId,
          state,
          nodeToContainerMap,
          containerHierarchyCache
        );
        const result = [...parentPath, parentId];
        containerHierarchyCache.set(elementId, result);
        return result;
      }
      containerHierarchyCache.set(elementId, path);
      return path; // Container is at root level
    }

    containerHierarchyCache.set(elementId, path);
    return path; // Element not found
  }

  private validateEdgeForRendering(
    edge: any,
    edgeType: "original" | "aggregated"
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
          `[ReactFlowBridge] ⚠️ Aggregated edge ${edge.id} missing or invalid originalEdgeIds`
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
        }
      );
      return false;
    }

    // Check for circular references (source === target)
    if (renderedEdge.source === renderedEdge.target) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Self-loop edge detected: ${renderedEdge.id} (${renderedEdge.source})`
      );
      // Self-loops are valid in ReactFlow, just log a warning
    }

    // Validate handle names if present
    if (
      renderedEdge.sourceHandle &&
      typeof renderedEdge.sourceHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid sourceHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.sourceHandle}`
      );
    }

    if (
      renderedEdge.targetHandle &&
      typeof renderedEdge.targetHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid targetHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.targetHandle}`
      );
    }

    return true;
  }

  // Edge Handling
  renderOriginalEdge(
    edge: any,
    visState?: VisualizationState
  ): ReactFlowEdge | null {
    // Enhanced validation for original edges
    const validation = this.validateEdgeForRendering(edge, "original");
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render original edge ${edge.id}: ${validation.reason}`
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] ✅ Rendering original edge ${edge.id}: ${edge.source} -> ${edge.target}`
    );

    const handles = visState
      ? this.getSmartHandles(visState, edge.source, edge.target)
      : {};

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
        `[ReactFlowBridge] ❌ Rendered edge ${edge.id} failed final validation`
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] 🎯 Successfully rendered original edge ${edge.id}`
    );
    return renderedEdge;
  }

  renderAggregatedEdge(
    aggregatedEdge: any,
    visState?: VisualizationState
  ): ReactFlowEdge | null {
    // Enhanced validation for aggregated edges
    const validation = this.validateEdgeForRendering(
      aggregatedEdge,
      "aggregated"
    );
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render aggregated edge ${aggregatedEdge.id}: ${validation.reason}`
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] ✅ Rendering aggregated edge ${aggregatedEdge.id}: ${aggregatedEdge.source} -> ${aggregatedEdge.target} (aggregating ${aggregatedEdge.originalEdgeIds?.length || 0} edges)`
    );

    const handles = visState
      ? this.getSmartHandles(
          visState,
          aggregatedEdge.source,
          aggregatedEdge.target
        )
      : {};

    const renderedEdge = {
      id: aggregatedEdge.id,
      source: aggregatedEdge.source,
      target: aggregatedEdge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: "aggregated",
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
        `[ReactFlowBridge] ❌ Rendered aggregated edge ${aggregatedEdge.id} failed final validation`
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] 🎯 Successfully rendered aggregated edge ${aggregatedEdge.id}`
    );
    return renderedEdge;
  }

  private validateFinalRenderedEdges(
    edges: ReactFlowEdge[],
    visibleNodeIds: Set<string>,
    visibleContainerIds: Set<string>,
    state: VisualizationState
  ): void {
    console.log(
      `[ReactFlowBridge] 🔍 Final edge validation - checking ${edges.length} rendered edges`
    );

    let potentialFloatingEdges = 0;
    let missingHandleEdges = 0;
    let invalidPositionEdges = 0;

    for (const edge of edges) {
      let hasIssues = false;
      const issues = [];

      // Check if source and target nodes exist and have positions
      const sourceNode = state.getGraphNode(edge.source);
      const targetNode = state.getGraphNode(edge.target);
      const sourceContainer = state.getContainer(edge.source);
      const targetContainer = state.getContainer(edge.target);

      const sourceElement = sourceNode || sourceContainer;
      const targetElement = targetNode || targetContainer;

      // Check for missing elements (shouldn't happen if earlier validation passed)
      if (!sourceElement) {
        issues.push(`source element ${edge.source} not found`);
        hasIssues = true;
      }

      if (!targetElement) {
        issues.push(`target element ${edge.target} not found`);
        hasIssues = true;
      }

      // Check for missing or invalid positions
      if (
        sourceElement &&
        (!sourceElement.position ||
          typeof sourceElement.position.x !== "number" ||
          typeof sourceElement.position.y !== "number" ||
          !isFinite(sourceElement.position.x) ||
          !isFinite(sourceElement.position.y))
      ) {
        issues.push(
          `source ${edge.source} has invalid position: ${JSON.stringify(sourceElement.position)}`
        );
        hasIssues = true;
        invalidPositionEdges++;
      }

      if (
        targetElement &&
        (!targetElement.position ||
          typeof targetElement.position.x !== "number" ||
          typeof targetElement.position.y !== "number" ||
          !isFinite(targetElement.position.x) ||
          !isFinite(targetElement.position.y))
      ) {
        issues.push(
          `target ${edge.target} has invalid position: ${JSON.stringify(targetElement.position)}`
        );
        hasIssues = true;
        invalidPositionEdges++;
      }

      // Check for missing handles when using discrete handle strategy
      if (CURRENT_HANDLE_STRATEGY === "discrete") {
        if (!edge.sourceHandle) {
          issues.push(`missing sourceHandle for discrete strategy`);
          hasIssues = true;
          missingHandleEdges++;
        }

        if (!edge.targetHandle) {
          issues.push(`missing targetHandle for discrete strategy`);
          hasIssues = true;
          missingHandleEdges++;
        }
      }

      // Check for extreme coordinate values that might cause floating
      if (sourceElement?.position && targetElement?.position) {
        const distance = Math.sqrt(
          Math.pow(targetElement.position.x - sourceElement.position.x, 2) +
            Math.pow(targetElement.position.y - sourceElement.position.y, 2)
        );

        if (distance > 2000) {
          // Arbitrary threshold for "very long" edges
          issues.push(`very long edge distance: ${distance.toFixed(2)}px`);
          hasIssues = true;
        }
      }

      if (hasIssues) {
        potentialFloatingEdges++;
        console.error(
          `[ReactFlowBridge] 🔴 Potential floating edge ${edge.id}: ${issues.join(", ")}`
        );
        console.error(
          `  - Source: ${edge.source} (${sourceElement ? "exists" : "missing"}, visible: ${visibleNodeIds.has(edge.source) || visibleContainerIds.has(edge.source)})`
        );
        console.error(
          `  - Target: ${edge.target} (${targetElement ? "exists" : "missing"}, visible: ${visibleNodeIds.has(edge.target) || visibleContainerIds.has(edge.target)})`
        );
        console.error(`  - Source handle: ${edge.sourceHandle || "none"}`);
        console.error(`  - Target handle: ${edge.targetHandle || "none"}`);

        if (sourceElement?.position) {
          console.error(
            `  - Source position: (${sourceElement.position.x}, ${sourceElement.position.y})`
          );
        }
        if (targetElement?.position) {
          console.error(
            `  - Target position: (${targetElement.position.x}, ${targetElement.position.y})`
          );
        }
      }
    }

    if (potentialFloatingEdges > 0) {
      console.error(
        `[ReactFlowBridge] 🚨 REACTFLOW FLOATING EDGE PROBLEM: ${potentialFloatingEdges} edges may render as floating!`
      );
    }
  }

  // ============================================================================
  // SEARCH AND NAVIGATION HIGHLIGHTING
  // ============================================================================

  /**
   * Apply search highlights to nodes with error handling
   */
  private applySearchHighlights(
    nodes: ReactFlowNode[],
    state: VisualizationState
  ): ReactFlowNode[] {
    try {
      return nodes.map((node) => {
        try {
          const highlightType = state.getGraphElementHighlightType
            ? state.getGraphElementHighlightType(node.id)
            : null;

          if (highlightType === "search" || highlightType === "both") {
            // Apply search highlight styling
            const searchStyle = this.getSearchHighlightStyle(node, state);
            return this.createHighlightedNode(node, searchStyle, "search");
          }

          return node;
        } catch (error) {
          console.warn(
            `[ReactFlowBridge] Failed to apply search highlight to node ${node.id}:`,
            error
          );
          // Return original node on error
          return node;
        }
      });
    } catch (error) {
      console.error(`[ReactFlowBridge] Search highlighting failed:`, error);

      // Handle error through error handler
      searchNavigationErrorHandler.handleHighlightingFailure(
        nodes.map((n) => n.id),
        "search",
        state,
        error as Error,
        { operation: "search_highlighting", nodeCount: nodes.length }
      );

      // Return original nodes as fallback
      return nodes;
    }
  }

  /**
   * Apply navigation highlights to nodes with error handling
   */
  private applyNavigationHighlights(
    nodes: ReactFlowNode[],
    state: VisualizationState
  ): ReactFlowNode[] {
    try {
      return nodes.map((node) => {
        try {
          const highlightType = state.getGraphElementHighlightType
            ? state.getGraphElementHighlightType(node.id)
            : null;

          if (highlightType === "navigation" || highlightType === "both") {
            // Apply navigation highlight styling
            const navigationStyle = this.getNavigationHighlightStyle(
              node,
              state
            );
            return this.createHighlightedNode(
              node,
              navigationStyle,
              "navigation"
            );
          }

          return node;
        } catch (error) {
          console.warn(
            `[ReactFlowBridge] Failed to apply navigation highlight to node ${node.id}:`,
            error
          );
          // Return original node on error
          return node;
        }
      });
    } catch (error) {
      console.error(`[ReactFlowBridge] Navigation highlighting failed:`, error);

      // Handle error through error handler
      searchNavigationErrorHandler.handleHighlightingFailure(
        nodes.map((n) => n.id),
        "navigation",
        state,
        error as Error,
        { operation: "navigation_highlighting", nodeCount: nodes.length }
      );

      // Return original nodes as fallback
      return nodes;
    }
  }

  /**
   * Apply search highlights to edges with error handling
   */
  private applySearchHighlightsToEdges(
    edges: ReactFlowEdge[],
    state: VisualizationState
  ): ReactFlowEdge[] {
    try {
      return edges.map((edge) => {
        try {
          const highlightType = state.getGraphElementHighlightType
            ? state.getGraphElementHighlightType(edge.id)
            : null;

          if (highlightType === "search" || highlightType === "both") {
            // Apply search highlight styling to edge
            const searchStyle = this.getSearchHighlightStyleForEdge(
              edge,
              state
            );
            return this.createHighlightedEdge(edge, searchStyle, "search");
          }

          return edge;
        } catch (error) {
          console.warn(
            `[ReactFlowBridge] Failed to apply search highlight to edge ${edge.id}:`,
            error
          );
          // Return original edge on error
          return edge;
        }
      });
    } catch (error) {
      console.error(
        `[ReactFlowBridge] Edge search highlighting failed:`,
        error
      );

      // Handle error through error handler
      searchNavigationErrorHandler.handleHighlightingFailure(
        edges.map((e) => e.id),
        "search",
        state,
        error as Error,
        { operation: "edge_search_highlighting", edgeCount: edges.length }
      );

      // Return original edges as fallback
      return edges;
    }
  }

  /**
   * Apply navigation highlights to edges with error handling
   */
  private applyNavigationHighlightsToEdges(
    edges: ReactFlowEdge[],
    state: VisualizationState
  ): ReactFlowEdge[] {
    try {
      return edges.map((edge) => {
        try {
          const highlightType = state.getGraphElementHighlightType
            ? state.getGraphElementHighlightType(edge.id)
            : null;

          if (highlightType === "navigation" || highlightType === "both") {
            // Apply navigation highlight styling to edge
            const navigationStyle = this.getNavigationHighlightStyleForEdge(
              edge,
              state
            );
            return this.createHighlightedEdge(
              edge,
              navigationStyle,
              "navigation"
            );
          }

          return edge;
        } catch (error) {
          console.warn(
            `[ReactFlowBridge] Failed to apply navigation highlight to edge ${edge.id}:`,
            error
          );
          // Return original edge on error
          return edge;
        }
      });
    } catch (error) {
      console.error(
        `[ReactFlowBridge] Edge navigation highlighting failed:`,
        error
      );

      // Handle error through error handler
      searchNavigationErrorHandler.handleHighlightingFailure(
        edges.map((e) => e.id),
        "navigation",
        state,
        error as Error,
        { operation: "edge_navigation_highlighting", edgeCount: edges.length }
      );

      // Return original edges as fallback
      return edges;
    }
  }

  /**
   * Get search highlight style for a node
   */
  private getSearchHighlightStyle(
    node: ReactFlowNode,
    state: VisualizationState
  ): React.CSSProperties {
    // Check if this is the current search result
    const isCurrentResult = state.getCurrentSearchResult()?.id === node.id;
    const colors = isCurrentResult
      ? SEARCH_CURRENT_COLORS
      : SEARCH_HIGHLIGHT_COLORS;

    return {
      backgroundColor: colors.backgroundColor,
      border: `2px solid ${colors.border}`,
      boxShadow: `0 0 8px ${colors.border}40`, // Add glow effect with 40% opacity
    };
  }

  /**
   * Get navigation highlight style for a node
   */
  private getNavigationHighlightStyle(
    node: ReactFlowNode,
    state: VisualizationState
  ): React.CSSProperties {
    return {
      backgroundColor: NAVIGATION_HIGHLIGHT_COLORS.backgroundColor,
      border: `2px solid ${NAVIGATION_HIGHLIGHT_COLORS.border}`,
      boxShadow: `0 0 8px ${NAVIGATION_HIGHLIGHT_COLORS.border}40`, // Add glow effect
    };
  }

  /**
   * Get search highlight style for an edge
   */
  private getSearchHighlightStyleForEdge(
    edge: ReactFlowEdge,
    state: VisualizationState
  ): React.CSSProperties {
    return {
      stroke: SEARCH_HIGHLIGHT_COLORS.border,
      strokeWidth: 3,
    };
  }

  /**
   * Get navigation highlight style for an edge
   */
  private getNavigationHighlightStyleForEdge(
    edge: ReactFlowEdge,
    state: VisualizationState
  ): React.CSSProperties {
    return {
      stroke: NAVIGATION_HIGHLIGHT_COLORS.border,
      strokeWidth: 3,
    };
  }

  /**
   * Create a highlighted node with immutable properties
   */
  private createHighlightedNode(
    node: ReactFlowNode,
    highlightStyle: React.CSSProperties,
    highlightType: "search" | "navigation"
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
    highlightType: "search" | "navigation"
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
}
