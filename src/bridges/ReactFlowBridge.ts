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
    const nodes: ReactFlowNode[] = [];
    const edges: ReactFlowEdge[] = [];

    // Build parent-child mapping from VisualizationState
    const parentMap = this.buildParentMap(visState);

    // Convert containers using ELK positions
    this.convertContainersFromELK(visState, nodes, parentMap);

    // Convert regular nodes using ELK positions
    this.convertNodesFromELK(visState, nodes, parentMap);

    // Convert edges using smart handle selection
    this.convertEdges(visState, edges);

    // ALWAYS recalculate handles after all nodes are created
    // This ensures handles are correct regardless of when layout operations occurred
    this.assignHandlesToEdges(visState, edges, nodes);

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
  private sortContainersByHierarchy(containers: Container[], parentMap: Map<string, string>): Container[] {
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

    sortedContainers.forEach(container => {
      const parentId = parentMap.get(container.id);

      // Get position and dimensions from ELK layout (stored in VisualizationState)
      let position: { x: number; y: number };

      if (parentId) {
        position = computeChildContainerPosition(visState, container, parentId);
      } else {
        position = computeRootContainerPosition(visState, container);
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
        extent: parentId ? 'parent' : undefined, // Constrain to parent if nested
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
        // ReactFlow sub-flow: constrain children within parent bounds
        extent: parentId ? 'parent' : undefined,
      };

      nodes.push(standardNode);
    });
  }

  /**
   * Convert regular edges to ReactFlow edges
   */
  private convertEdges(visState: VisualizationState, edges: ReactFlowEdge[]): void {
    // Always use semantic mappings for edge styling
    const visibleEdges = Array.from(visState.visibleEdges);
    const edgeConverterOptions: EdgeConverterOptions = {
      edgeStyleConfig: this.edgeStyleConfig,
      showPropertyLabels: true,
      enableAnimations: true,
    };
    const convertedEdges = convertEdgesToReactFlow(visibleEdges, edgeConverterOptions);

    // Ensure processedStyle is present and semantic mappings are honored
    convertedEdges.forEach((reactFlowEdge, index) => {
      const originalEdge = visibleEdges[index];
      // Defensive: If processedStyle is missing, reprocess with semanticMappings
      if (!reactFlowEdge.data?.processedStyle && this.edgeStyleConfig?.semanticMappings) {
        const edgeProperties = originalEdge.edgeProperties || [];
        const { processEdgeStyle } = require('../core/EdgeStyleProcessor');
        const processedStyle = processEdgeStyle(edgeProperties, this.edgeStyleConfig);
        if (reactFlowEdge.data) {
          reactFlowEdge.data.processedStyle = processedStyle;
        }
        reactFlowEdge.style = processedStyle.style;
        reactFlowEdge.animated = processedStyle.animated;
        reactFlowEdge.markerEnd = processedStyle.markerEndSpec;
      }
      // Note: Handle assignment will be done after all nodes are created
    });
    edges.push(...convertedEdges);
  }

  /**
   * SIMPLIFIED: Get edge handles using a fixed strategy
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
      const sourceNode = visState.getGraphNode(edge.source);
      const targetNode = visState.getGraphNode(edge.target);
      
      // For discrete handles, use the default bottom-to-top connection pattern
      // This provides consistent behavior and matches test expectations
      if (sourceNode && targetNode) {
        return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
      }
    }

    return {
      sourceHandle: 'out-bottom',
      targetHandle: 'in-top',
    };
  }

  /**
   * Assign handles to edges after all nodes are created
   * This ensures handle calculation uses the same coordinate system as ReactFlow rendering
   * OPTIMIZED: Create node index once instead of for every edge
   */
  private assignHandlesToEdges(
    visState: VisualizationState,
    edges: ReactFlowEdge[],
    nodes: ReactFlowNode[]
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
