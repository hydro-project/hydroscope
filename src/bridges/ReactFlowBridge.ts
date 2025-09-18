/**
 * @fileoverview ReactFlow Bridge - Converts VisualizationState to ReactFlow format
 *
 * This bridge converts VisualizationState to ReactFlow's expected data structures.
 * ReactFlow only sees unified edges (hyperedges are included transparently).
 */

import type { VisualizationState } from '../core/VisualizationState';
import type { GraphNode, GraphEdge, Container } from '../shared/types';
import { LAYOUT_CONSTANTS } from '../shared/config';
import { generateNodeColors, type NodeColor } from '../shared/colorUtils';
import { Edge as ReactFlowEdge } from '@xyflow/react';
import { CURRENT_HANDLE_STRATEGY } from '../render/handleConfig';
import { convertEdgesToReactFlow, EdgeConverterOptions } from './EdgeConverter';
import { deserializeProcessedStyle } from '../core/EdgeStyleSerializer';
import { hscopeLogger } from '../utils/logger';
import {
  buildParentMap as buildParentMapUtil,
  sortContainersByHierarchy as sortContainersByHierarchyUtil,
  computeChildContainerPosition,
  computeRootContainerPosition,
  computeNodePosition,
  getAdjustedContainerDimensionsSafe,
} from './ReactFlowUtils';

// ReactFlow types
export interface ReactFlowNode {
  id: string;
  type: 'standard' | 'container';
  position: { x: number; y: number };
  data: {
    label: string;
    style: string;
    collapsed?: boolean;
    width?: number;
    height?: number;
    [key: string]: any;
  };
  style?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    border?: string;
  };
  parentId?: string;
  connectable?: boolean; // For floating handles strategy
  extent?: 'parent' | [[number, number], [number, number]]; // Constrains node movement to parent boundaries
}

export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export class ReactFlowBridge {
  private colorPalette: string = 'Set3';
  private edgeStyleConfig?: any; // EdgeStyleConfig from EdgeStyleProcessor

  constructor(colorPalette?: string, edgeStyleConfig?: any) {
    if (colorPalette) this.colorPalette = colorPalette;
    if (edgeStyleConfig) this.edgeStyleConfig = edgeStyleConfig;
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Set the color palette for node styling
   */
  setColorPalette(palette: string): void {
    this.colorPalette = palette;
  }

  /**
   * Set the edge style configuration
   */
  setEdgeStyleConfig(config: any): void {
    this.edgeStyleConfig = config;
  }

  // ============================================================================
  // Main Conversion Method
  // ============================================================================

  /**
   * Main conversion method: Convert VisualizationState to ReactFlow format
   * This is the primary public interface, symmetric with ELKBridge.layoutVisualizationState()
   *
   * IMPORTANT: This method ALWAYS recalculates handles fresh from current positions
   * to ensure handles are correct after any layout operations (collapse/expand/ELK layout)
   */
  convertVisualizationState(visState: VisualizationState): ReactFlowData {
    return this.visStateToReactFlow(visState);
  }

  /**
   * Backward-compatible alias expected by existing tests
   */
  convertVisState(visState: VisualizationState): ReactFlowData {
    return this.convertVisualizationState(visState);
  }

  // ============================================================================
  // Core Conversion Logic
  // ============================================================================

  /**
   * Convert positioned VisualizationState data to ReactFlow format
   * TRUST ELK: Use ELK's hierarchical layout results completely
   */
  private visStateToReactFlow(visState: VisualizationState): ReactFlowData {
    const conversionId = `conversion-${Date.now()}`;
    // Starting ReactFlow conversion (debug logging removed for performance)

    const nodes: ReactFlowNode[] = [];
    const edges: ReactFlowEdge[] = [];

    // Build parent-child mapping from VisualizationState
    // Building parent map (debug logging removed for performance)
    const parentMap = this.buildParentMap(visState);

    // Convert containers using ELK positions
    console.log(`[ReactFlowBridge] 📦 Converting containers [${conversionId}]`);
    const containerCountBefore = nodes.length;
    this.convertContainersFromELK(visState, nodes, parentMap);
    const containerCount = nodes.length - containerCountBefore;
    console.log(`[ReactFlowBridge] 📦 Converted ${containerCount} containers [${conversionId}]`);

    // Convert regular nodes using ELK positions
    console.log(`[ReactFlowBridge] 🔵 Converting regular nodes [${conversionId}]`);
    const nodeCountBefore = nodes.length;
    this.convertNodesFromELK(visState, nodes, parentMap);
    const regularNodeCount = nodes.length - nodeCountBefore;
    console.log(
      `[ReactFlowBridge] 🔵 Converted ${regularNodeCount} regular nodes [${conversionId}]`
    );

    // Convert edges using smart handle selection
    console.log(`[ReactFlowBridge] 🔗 Converting edges [${conversionId}]`);

    // DIAGNOSTIC: Log edge data before conversion
    const visibleEdgeCount = visState.visibleEdges.length;
    console.log(
      `[ReactFlowBridge] 🔗 VisualizationState has ${visibleEdgeCount} visible edges before conversion`
    );

    this.convertEdges(visState, edges, nodes);
    console.log(`[ReactFlowBridge] 🔗 Converted ${edges.length} edges [${conversionId}]`);

    // ALWAYS recalculate handles after all nodes are created
    // This ensures handles are correct regardless of when layout operations occurred
    console.log(`[ReactFlowBridge] 🎯 Assigning handles to edges [${conversionId}]`);
    this.assignHandlesToEdges(visState, edges, nodes);
    console.log(`[ReactFlowBridge] 🎯 Handle assignment completed [${conversionId}]`);

    // DIAGNOSTIC: Check for edge data loss
    if (edges.length === 0 && nodes.length > 5) {
      hscopeLogger.error(
        'bridge',
        `🚨 EDGE DATA LOSS DETECTED [${conversionId}]:
  - Nodes: ${nodes.length} (${containerCount} containers, ${regularNodeCount} regular)
  - Edges: ${edges.length} (ZERO EDGES WITH MANY NODES)
  - VisualizationState visible edges: ${visState.visibleEdges.length}
  - This indicates edges were lost during state transitions or conversion`
      );
    }

    console.log(`[ReactFlowBridge] ✅ Conversion completed [${conversionId}]:`, {
      totalNodes: nodes.length,
      containerNodes: containerCount,
      regularNodes: regularNodeCount,
      totalEdges: edges.length,
    });

    return { nodes, edges };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Build parent-child relationship map
   * NOTE: VisualizationState should provide this logic via getParentChildMap()
   */
  private buildParentMap(visState: VisualizationState): Map<string, string> {
    return buildParentMapUtil(visState);
  }

  /**
   * Sort containers by hierarchy level to ensure parents are processed before children
   */
  private sortContainersByHierarchy(
    containers: Container[],
    parentMap: Map<string, string>
  ): Container[] {
    return sortContainersByHierarchyUtil(containers, parentMap);
  }

  /**
   * Convert containers to ReactFlow container nodes using ELK layout positions
   * TRUST ELK: Use ELK's hierarchical positioning completely
   */
  private convertContainersFromELK(
    visState: VisualizationState,
    nodes: ReactFlowNode[],
    parentMap: Map<string, string>
  ): void {
    // Sort containers by hierarchy level (parents first, then children)
    const containers = Array.from(visState.visibleContainers);
    const sortedContainers = this.sortContainersByHierarchy(containers, parentMap);

    // DIAGNOSTIC: Check for parent-child consistency issues
    const containerIds = new Set(containers.map(c => c.id));
    const missingParents: string[] = [];

    for (const container of containers) {
      const parentId = parentMap.get(container.id);
      if (parentId && !containerIds.has(parentId)) {
        missingParents.push(`${container.id} -> ${parentId}`);
      }
    }

    if (missingParents.length > 0) {
      hscopeLogger.error(
        'bridge',
        `❌ PARENT-CHILD INCONSISTENCY: ${missingParents.length} containers reference missing parents: ${missingParents.slice(0, 5).join(', ')}
📊 Visible containers: ${containers.length}, Parent map size: ${parentMap.size}`
      );
    }

    sortedContainers.forEach(container => {
      const parentId = parentMap.get(container.id);

      // CRITICAL FIX: Check if container has valid ELK position before processing
      // During grouping changes, some containers may not have been processed by ELK yet
      const containerLayout = visState.getContainerLayout(container.id);
      if (
        !containerLayout?.position ||
        containerLayout.position.x === undefined ||
        containerLayout.position.y === undefined
      ) {
        console.warn(
          `[ReactFlowBridge] ⚠️ Skipping container ${container.id} - no valid ELK position (likely from concurrent grouping change)`
        );
        return; // Skip this container
      }

      // Get position and dimensions from ELK layout (stored in VisualizationState)
      let position: { x: number; y: number };

      try {
        if (parentId) {
          position = computeChildContainerPosition(visState, container, parentId);
        } else {
          position = computeRootContainerPosition(visState, container);
        }
      } catch (error) {
        console.warn(
          `[ReactFlowBridge] ⚠️ Skipping container ${container.id} - position computation failed:`,
          error
        );
        return; // Skip this container
      }

      // Get adjusted dimensions that include label space (matches test expectations)
      const { width, height } = getAdjustedContainerDimensionsSafe(visState, container.id);

      const nodeCount = container.collapsed ? visState.countRecursiveLeafNodes(container.id) : 0;

      // HANDLE FIX: Use 'standard' type for collapsed containers to match regular nodes
      // This ensures ReactFlow treats both node types identically for handle positioning
      const nodeType = container.collapsed ? 'standard' : 'container';

      const containerNode: ReactFlowNode = {
        id: container.id,
        type: nodeType,
        position,
        data: {
          label: container.label || container.id, // Use container.label, fallback to id
          style: (container as any).style || 'default',
          collapsed: container.collapsed,
          nodeType: (container as any).nodeType,
          colorPalette: this.colorPalette,
          width,
          height,
          nodeCount: nodeCount,
        },
        style: {
          width,
          height,
        },
        parentId: parentId,
        // Set extent constraint for child nodes to keep them within parent boundaries
        extent: parentId ? 'parent' : undefined,
      };

      nodes.push(containerNode);
    });
  }

  /**
   * Convert regular nodes to ReactFlow standard nodes using ELK layout positions
   * TRUST ELK: Use ELK's hierarchical positioning completely
   */
  private convertNodesFromELK(
    visState: VisualizationState,
    nodes: ReactFlowNode[],
    parentMap: Map<string, string>
  ): void {
    visState.visibleNodes.forEach(node => {
      const parentId = parentMap.get(node.id);

      // Get position from ELK layout (stored in VisualizationState)
      const position: { x: number; y: number } = computeNodePosition(visState, node, parentId);

      const nodeType: string = (node as any).nodeType || (node as any).type || 'default';
      const nodeColors = generateNodeColors([nodeType], this.colorPalette) as NodeColor;

      // HANDLE FIX: Add explicit dimensions to regular nodes to match collapsed container behavior
      // This ensures ReactFlow uses consistent dimension sources for handle positioning
      const nodeWidth = node.width || LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH;
      const nodeHeight = node.height || LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT;

      const standardNode: ReactFlowNode = {
        id: node.id,
        type: 'standard',
        position,
        data: {
          label: node.label || node.shortLabel || node.id, // Respect toggled label field
          shortLabel: node.shortLabel || node.id,
          fullLabel: node.fullLabel || node.shortLabel || node.id,
          style: node.style || 'default',
          // Preserve nodeType explicitly for coloring/rendering
          nodeType,
          colorPalette: this.colorPalette,
          // HANDLE FIX: Add explicit dimensions to data (like collapsed containers)
          width: nodeWidth,
          height: nodeHeight,
          ...this.extractCustomProperties(node),
        },
        style: {
          backgroundColor: nodeColors.primary,
          border: `1px solid ${nodeColors.border}`,
          // HANDLE FIX: Add explicit dimensions to style (like collapsed containers)
          width: nodeWidth,
          height: nodeHeight,
        },
        parentId,
        connectable: CURRENT_HANDLE_STRATEGY === 'floating',
        // Set extent constraint for child nodes to keep them within parent boundaries
        extent: parentId ? 'parent' : undefined,
      };

      nodes.push(standardNode);
    });
  }

  /**
   * Convert regular edges to ReactFlow edges
   */
  private convertEdges(
    visState: VisualizationState,
    edges: ReactFlowEdge[],
    nodes: ReactFlowNode[]
  ): void {
    // Always use semantic mappings for edge styling
    const visibleEdges = Array.from(visState.visibleEdges);
    console.log(`[ReactFlowBridge] 🔗 Converting ${visibleEdges.length} visible edges:`, {
      edgeIds: visibleEdges.map(e => e.id).slice(0, 10), // Log first 10 edge IDs
      edgeTypes: [...new Set(visibleEdges.map(e => e.type))],
      hasEdgeStyleConfig: !!this.edgeStyleConfig,
    });

    const edgeConverterOptions: EdgeConverterOptions = {
      edgeStyleConfig: this.edgeStyleConfig,
      showPropertyLabels: true,
      enableAnimations: true,
    };

    console.log(`[ReactFlowBridge] ⚙️ Edge converter options:`, edgeConverterOptions);
    const convertedEdges = convertEdgesToReactFlow(visibleEdges, edgeConverterOptions);
    console.log(`[ReactFlowBridge] ✨ Edge converter produced ${convertedEdges.length} edges`);

    // DIAGNOSTIC: Check if edge endpoints exist in nodes array
    const nodeIds = new Set(nodes.map(n => n.id));
    const missingEndpoints: string[] = [];

    convertedEdges.forEach(edge => {
      if (!nodeIds.has(edge.source)) {
        missingEndpoints.push(`${edge.id}: source ${edge.source} missing`);
      }
      if (!nodeIds.has(edge.target)) {
        missingEndpoints.push(`${edge.id}: target ${edge.target} missing`);
      }
    });

    if (missingEndpoints.length > 0) {
      hscopeLogger.error(
        'bridge',
        `❌ MISSING EDGE ENDPOINTS: ${missingEndpoints.length} edges have missing source/target nodes: ${missingEndpoints.slice(0, 10).join(', ')}
📊 Total nodes: ${nodes.length}, Total edges: ${convertedEdges.length}`
      );
    }

    // EdgeConverter already processed all edges correctly, including hyperedges
    // Only override if hyperedge has pre-serialized style (legacy compatibility)
    let _overrideCount = 0;
    convertedEdges.forEach((reactFlowEdge, index) => {
      const originalEdge = visibleEdges[index];

      // Only override EdgeConverter processing for hyperedges with pre-serialized styles
      if (
        originalEdge.type === 'hyper' &&
        originalEdge.style &&
        typeof originalEdge.style === 'string'
      ) {
        // Overriding hyperedge style (debug logging removed for performance)
        _overrideCount++;

        const parsedStyle = deserializeProcessedStyle(originalEdge.style);
        if (parsedStyle) {
          if (reactFlowEdge.data) {
            reactFlowEdge.data.processedStyle = parsedStyle;
          }
          reactFlowEdge.style = parsedStyle.style;
          reactFlowEdge.animated = parsedStyle.animated;
          if (parsedStyle.markerEndSpec) {
            reactFlowEdge.markerEnd = parsedStyle.markerEndSpec;
          }
        }
      }
      // For all other edges (including hyperedges with edgeProperties), trust EdgeConverter's processing
    });

    // Edge conversion summary (debug logging removed for performance)
    edges.push(...convertedEdges);
  }

  /**
   * Get edge handles using intelligent position-based strategy
   * CONSERVATIVE: Only uses safe handle combinations to avoid breaking hyperedges
   */
  getEdgeHandles(
    visState: VisualizationState,
    edgeId: string
  ): { sourceHandle?: string; targetHandle?: string } {
    const edge = visState.getGraphEdge(edgeId) || visState.getHyperEdge(edgeId);
    if (!edge) {
      return {};
    }

    if (CURRENT_HANDLE_STRATEGY === 'discrete') {
      // For source: try node first, then container
      const sourceNode = visState.getGraphNode(edge.source);
      const sourceContainer = sourceNode ? null : visState.getContainer(edge.source);

      // For target: try node first, then container
      const targetNode = visState.getGraphNode(edge.target);
      const targetContainer = targetNode ? null : visState.getContainer(edge.target);

      // Smart handle selection if we have both endpoints
      const sourceElement = sourceNode || sourceContainer;
      const targetElement = targetNode || targetContainer;

      if (sourceElement && targetElement) {
        return this.selectSmartHandles(visState, sourceElement, targetElement, edge);
      }
    }

    // Fallback to safe defaults
    return {
      sourceHandle: 'out-bottom',
      targetHandle: 'in-top',
    };
  }

  /**
   * Select appropriate handles based on node positions and relationship
   * CONSERVATIVE: Only uses handles that follow the safe rules:
   * - Sources: out-bottom or out-right (never out-top)
   * - Targets: in-top or in-left (never in-bottom)
   */
  private selectSmartHandles(
    visState: VisualizationState,
    sourceElement: any,
    targetElement: any,
    _edge: any
  ): { sourceHandle: string; targetHandle: string } {
    try {
      // Get layout information for source (could be node or container)
      const sourceLayout =
        visState.getNodeLayout(sourceElement.id) || visState.getContainerLayout(sourceElement.id);

      // Get layout information for target (could be node or container)
      const targetLayout =
        visState.getNodeLayout(targetElement.id) || visState.getContainerLayout(targetElement.id);

      // Get positions, falling back to element properties and then defaults
      const sourcePos = {
        x: sourceLayout?.position?.x ?? sourceElement.x ?? 0,
        y: sourceLayout?.position?.y ?? sourceElement.y ?? 0,
      };
      const targetPos = {
        x: targetLayout?.position?.x ?? targetElement.x ?? 0,
        y: targetLayout?.position?.y ?? targetElement.y ?? 0,
      };

      // Validate positions - if any are invalid, fall back to safe defaults
      if (!this.isValidPosition(sourcePos) || !this.isValidPosition(targetPos)) {
        return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
      }

      // Get dimensions from layout or element data or defaults
      const sourceWidth = Math.max(
        1,
        sourceLayout?.dimensions?.width ?? sourceElement.width ?? 120
      );
      const sourceHeight = Math.max(
        1,
        sourceLayout?.dimensions?.height ?? sourceElement.height ?? 40
      );
      const targetWidth = Math.max(
        1,
        targetLayout?.dimensions?.width ?? targetElement.width ?? 120
      );
      const targetHeight = Math.max(
        1,
        targetLayout?.dimensions?.height ?? targetElement.height ?? 40
      );

      // Calculate node centers
      const sourceCenterX = sourcePos.x + sourceWidth / 2;
      const sourceCenterY = sourcePos.y + sourceHeight / 2;
      const targetCenterX = targetPos.x + targetWidth / 2;
      const targetCenterY = targetPos.y + targetHeight / 2;

      // Calculate relative position
      const deltaX = targetCenterX - sourceCenterX;
      const deltaY = targetCenterY - sourceCenterY;

      // Validate deltas - if any are invalid, fall back to safe defaults
      if (!isFinite(deltaX) || !isFinite(deltaY)) {
        return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
      }

      // Use 1.2x threshold to determine primary direction as mentioned in comments
      // Add minimum separation threshold to avoid instability with very close nodes
      const DIRECTION_THRESHOLD = 1.2;
      const MIN_SEPARATION = 10; // pixels
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If nodes are too close, default to vertical
      if (absX < MIN_SEPARATION && absY < MIN_SEPARATION) {
        return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
      }

      // Determine primary direction
      const isHorizontalPrimary = absX > absY * DIRECTION_THRESHOLD;
      const isVerticalPrimary = absY > absX * DIRECTION_THRESHOLD;

      // Conservative handle selection following the safe rules
      if (isHorizontalPrimary) {
        // Nodes are primarily horizontally arranged
        if (deltaX > 0) {
          // Target is to the right of source
          return { sourceHandle: 'out-right', targetHandle: 'in-left' };
        } else {
          // Target is to the left of source
          // Since we can't use out-left or in-right safely, fall back to vertical
          return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
        }
      } else if (isVerticalPrimary) {
        // Nodes are primarily vertically arranged
        if (deltaY > 0) {
          // Target is below source
          return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
        } else {
          // Target is above source
          // Since we can't use out-top safely, use horizontal if reasonable
          if (absX > sourceWidth / 2) {
            // There's enough horizontal separation
            return deltaX > 0
              ? { sourceHandle: 'out-right', targetHandle: 'in-left' }
              : { sourceHandle: 'out-bottom', targetHandle: 'in-top' }; // Fall back for left direction
          } else {
            // Use vertical with reversed safe handles - out-bottom still, but target gets in-top
            return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
          }
        }
      }

      // Default case: use safe vertical connection
      return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
    } catch (error) {
      // If any error occurs in smart selection, fall back to safe defaults
      console.warn(
        '[ReactFlowBridge] Error in smart handle selection, falling back to defaults:',
        error
      );
      return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
    }
  }

  /**
   * Validate that a position object has valid coordinates
   */
  private isValidPosition(pos: { x: number; y: number }): boolean {
    return (
      typeof pos.x === 'number' &&
      typeof pos.y === 'number' &&
      isFinite(pos.x) &&
      isFinite(pos.y) &&
      !isNaN(pos.x) &&
      !isNaN(pos.y)
    );
  }

  /**
   * Assign handles to edges after all nodes are created
   * This ensures handle calculation uses the same coordinate system as ReactFlow rendering
   * OPTIMIZED: Create node index once instead of for every edge
   */
  private assignHandlesToEdges(
    visState: VisualizationState,
    edges: ReactFlowEdge[],
    _nodes: ReactFlowNode[]
  ): void {
    edges.forEach(reactFlowEdge => {
      // Find the original edge to get its ID
      const originalEdge =
        visState.getGraphEdge(reactFlowEdge.id) || visState.getHyperEdge(reactFlowEdge.id);
      if (originalEdge) {
        const smartHandles = this.getEdgeHandles(visState, reactFlowEdge.id);
        reactFlowEdge.sourceHandle = smartHandles.sourceHandle || 'out-bottom';
        reactFlowEdge.targetHandle = smartHandles.targetHandle || 'in-top';
      }
    });
  }

  /**
   * Recalculate handles for existing ReactFlow data after layout changes
   * This is the aggressive approach to ensure handles are always correct after ELK layout
   * OPTIMIZED: Create node index once
   *    */
  recalculateHandlesAfterLayout(
    visState: VisualizationState,
    reactFlowData: ReactFlowData
  ): ReactFlowData {
    if (CURRENT_HANDLE_STRATEGY !== 'discrete') {
      return reactFlowData; // No handle recalculation needed for other strategies
    }

    // Create a copy to avoid mutating the original
    const updatedEdges = reactFlowData.edges.map(edge => {
      const originalEdge = visState.getGraphEdge(edge.id) || visState.getHyperEdge(edge.id);
      if (originalEdge) {
        const smartHandles = this.getEdgeHandles(visState, edge.id);
        return {
          ...edge,
          sourceHandle: smartHandles.sourceHandle || edge.sourceHandle || 'out-bottom',
          targetHandle: smartHandles.targetHandle || edge.targetHandle || 'in-top',
        };
      }
      return edge;
    });

    return {
      nodes: reactFlowData.nodes,
      edges: updatedEdges,
    };
  }

  /**
   * Static method to recalculate handles after any layout operation
   * This can be called from anywhere in the application after ELK layout
   */
  static recalculateHandlesAfterLayoutStatic(
    visState: VisualizationState,
    reactFlowData: ReactFlowData,
    colorPalette?: string,
    edgeStyleConfig?: any
  ): ReactFlowData {
    // Create a temporary bridge instance to use the handle calculation logic
    const tempBridge = new ReactFlowBridge(colorPalette, edgeStyleConfig);
    return tempBridge.recalculateHandlesAfterLayout(visState, reactFlowData);
  }

  /**
   * Extract custom properties from graph elements
   */
  private extractCustomProperties(element: GraphNode | GraphEdge | Container): Record<string, any> {
    const customProps: Record<string, any> = {};

    // Filter out known properties to get custom ones
    const knownProps = new Set([
      'id',
      'label',
      'style',
      'hidden',
      'layout',
      'source',
      'target',
      'children',
      'collapsed',
      'x',
      'y',
      'width',
      'height',
    ]);

    Object.entries(element).forEach(([key, value]) => {
      if (!knownProps.has(key)) {
        customProps[key] = value;
      }
    });

    return customProps;
  }
}
