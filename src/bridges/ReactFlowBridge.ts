/**
 * @fileoverview ReactFlow Bridge - Converts VisualizationState to ReactFlow format
 * 
 * This bridge converts VisualizationState to ReactFlow's expected data structures.
 * ReactFlow only sees unified edges (hyperedges are included transparently).
 */

import type { VisualizationState } from '../core/VisualizationState';
import type { GraphNode, GraphEdge, Container } from '../shared/types';
import { LAYOUT_CONSTANTS } from '../shared/config';
import { MarkerType, Edge as ReactFlowEdge } from '@xyflow/react';
import { getHandleConfig, CURRENT_HANDLE_STRATEGY } from '../render/handleConfig';
import { convertEdgesToReactFlow, EdgeConverterOptions } from './EdgeConverter';
import {
  buildParentMap as buildParentMapUtil,
  sortContainersByHierarchy as sortContainersByHierarchyUtil,
  computeChildContainerPosition,
  computeRootContainerPosition,
  computeNodePosition,
  getAdjustedContainerDimensionsSafe
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
   * This is the primary public interface, symmetric with ELKBridge.layoutVisState()
   */
  convertVisState(visState: VisualizationState): ReactFlowData {
    return this.visStateToReactFlow(visState);
  }

  // ============================================================================
  // Core Conversion Logic  
  // ============================================================================

  /**
   * Convert positioned VisState data to ReactFlow format
   * TRUST ELK: Use ELK's hierarchical layout results completely
   */
  private visStateToReactFlow(visState: VisualizationState): ReactFlowData {
    console.log(`[Bridge] 🔍 Converting VisualizationState with ${visState.visibleNodes.length} visible nodes`);
    
    // Debug: Log first few visible nodes
    const firstFewNodes = visState.visibleNodes.slice(0, 5);
    firstFewNodes.forEach(node => {
      console.log(`[Bridge] 📋 Node ${node.id}: label="${node.label}", shortLabel="${node.shortLabel}", fullLabel="${node.fullLabel}"`);
    });

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
    
    return { nodes, edges };
  }

  // ============================================================================
  // Element Conversion Methods
  // ============================================================================

  /**
   * CANONICAL PATTERN: Convert nodes to flat ReactFlow nodes (no hierarchy)
   */
  private convertNodesToFlat(visState: VisualizationState, nodes: ReactFlowNode[]): void {
    visState.visibleNodes.forEach(node => {
      // CANONICAL: Use ELK coordinates if available, otherwise fall back to node coordinates
      let position;
      try {
        const nodeLayout = visState.getNodeLayout(node.id);
        position = {
          x: nodeLayout?.position?.x || node.x || 0,
          y: nodeLayout?.position?.y || node.y || 0
        };
      } catch {
        // Fallback for test environments or when layout isn't available
        position = {
          x: node.x || 0,
          y: node.y || 0
        };
      }
      
      const flatNode: ReactFlowNode = {
        id: node.id,
        type: 'standard',
        position,
        data: {
          label: node.label || node.shortLabel || node.id, // Respect toggled label field
          shortLabel: node.shortLabel || node.id,
          fullLabel: node.fullLabel || node.shortLabel || node.id,
          style: node.style || 'default',
          colorPalette: this.colorPalette,
          ...this.extractCustomProperties(node)
        }
        // NO parentId - completely flat
      };
      
      // Debug: Log label data for troubleshooting
      if (node.id === '0' || node.id === '7') {
        console.log(`[Bridge] 🏷️ Node ${node.id}: label="${flatNode.data.label}", shortLabel="${flatNode.data.shortLabel}", fullLabel="${flatNode.data.fullLabel}"`);
      }
      
      // Debug: Log node label resolution
      if (node.label && node.label !== node.shortLabel) {
        console.log(`🔗 Bridge: Node ${node.id} using toggled label: "${node.label}" (short: "${node.shortLabel}", full: "${node.fullLabel}")`);
      }
      
      nodes.push(flatNode);
    });
  }

  /**
   * CANONICAL PATTERN: Convert containers to flat ReactFlow nodes (no hierarchy)
   */
  private convertContainersToFlat(visState: VisualizationState, nodes: ReactFlowNode[]): void {
    visState.visibleContainers.forEach(container => {
      // CANONICAL: Use ELK coordinates if available, otherwise fall back to container coordinates
      let position;
      try {
        const containerLayout = visState.getContainerLayout(container.id);
        position = {
          x: containerLayout?.position?.x || container.x || 0,
          y: containerLayout?.position?.y || container.y || 0
        };
      } catch {
        // Fallback for test environments or when layout isn't available
        position = {
          x: container.x || 0,
          y: container.y || 0
        };
      }
      
      const width = container.width;
      const height = container.height;
      const nodeCount = container.collapsed ? 
        visState.getContainerChildren(container.id)?.size || 0 : 0;
      
      const flatContainer: ReactFlowNode = {
        id: container.id,
        type: 'container',
        position,
        data: {
          label: container.label || container.id, // Use single label field for containers
          style: (container as any).style || 'default',
          collapsed: container.collapsed || false,
          colorPalette: this.colorPalette,
          nodeCount,
          width,
          height,
          ...this.extractCustomProperties(container as any)
        },
        style: {
          width,
          height
        }
        // NO parentId - completely flat
      };
      
      nodes.push(flatContainer);
    });
  }

  /**
   * CANONICAL PATTERN: Convert edges using simple source/target mapping
   */
  private convertEdgesToFlat(visState: VisualizationState, edges: ReactFlowEdge[]): void {
    visState.visibleEdges.forEach(edge => {
      const flatEdge: ReactFlowEdge = {
        id: edge.id,
        type: 'standard',
        source: edge.source,
        target: edge.target,
        sourceHandle: 'out-bottom', // Force edges to come out the bottom of source nodes
        targetHandle: 'in-top',     // Force edges to go into the top of target nodes
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: '#999'
        },
        data: {
          style: edge.style || 'default'
        }
        // NO custom routing - ReactFlow handles positioning automatically
      };
      
      edges.push(flatEdge);
    });
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
  private sortContainersByHierarchy(containers: any[], parentMap: Map<string, string>): any[] {
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
      const containerLayout = visState.getContainerLayout(container.id);
      let position: { x: number; y: number };
      
      if (parentId) {
        position = computeChildContainerPosition(visState, container, parentId);
      } else {
        position = computeRootContainerPosition(visState, container);
      }
      
      // Get adjusted dimensions that include label space (matches test expectations)
  const { width, height } = getAdjustedContainerDimensionsSafe(visState, container.id);
      
      const nodeCount = container.collapsed ? 
        visState.getContainerChildren(container.id)?.size || 0 : 0;
      
      // Debug: Log container label source
      console.log(`🏷️ Container ${container.id}: label="${container.label}", id="${container.id}", using="${container.label || container.id}"`);
      
      const containerNode: ReactFlowNode = {
        id: container.id,
        type: 'container',
        position,
        data: {
          label: container.label || container.id, // Use container.label, fallback to id
          style: (container as any).style || 'default',
          collapsed: container.collapsed,
          colorPalette: this.colorPalette,
          width,
          height,
          nodeCount: nodeCount
        },
        style: {
          width,
          height
        },
        parentId: parentId,
        extent: parentId ? 'parent' : undefined // Constrain to parent if nested
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
      const nodeLayout = visState.getNodeLayout(node.id);
  const position: { x: number; y: number } = computeNodePosition(visState, node, parentId);
      
      const standardNode: ReactFlowNode = {
        id: node.id,
        type: 'standard',
        position,
        data: {
          label: node.label || node.shortLabel || node.id, // Respect toggled label field
          shortLabel: node.shortLabel || node.id,
          fullLabel: node.fullLabel || node.shortLabel || node.id,
          style: node.style || 'default',
          colorPalette: this.colorPalette,
          ...this.extractCustomProperties(node)
        },
        parentId,
        connectable: CURRENT_HANDLE_STRATEGY === 'floating',
        // ReactFlow sub-flow: constrain children within parent bounds
        extent: parentId ? 'parent' : undefined
      };

      // Debug: Log label handling for ELK nodes
      if (node.label && node.label !== node.shortLabel) {
        console.log(`🔗 Bridge (ELK): Node ${node.id} using toggled label: "${node.label}" (short: "${node.shortLabel}", full: "${node.fullLabel}")`);
      }
      
      nodes.push(standardNode);
    });
  }

  /**
   * Convert regular edges to ReactFlow edges
   */
  private convertEdges(visState: VisualizationState, edges: ReactFlowEdge[]): void {
    // First, convert edges using EdgeConverter for proper styling
    const visibleEdges = Array.from(visState.visibleEdges);
    const edgeConverterOptions: EdgeConverterOptions = {
      edgeStyleConfig: this.edgeStyleConfig,
      showPropertyLabels: true,
      enableAnimations: true
    };
    const convertedEdges = convertEdgesToReactFlow(visibleEdges, edgeConverterOptions);
    
    // Then, apply smart handle selection to each converted edge
    convertedEdges.forEach((reactFlowEdge, index) => {
      const originalEdge = visibleEdges[index];
      
      if (CURRENT_HANDLE_STRATEGY === 'discrete') {
        const smartHandles = this.getEdgeHandles(visState, originalEdge.id);
        
        // Override EdgeConverter handles with smart selection
        reactFlowEdge.sourceHandle = smartHandles.sourceHandle || 'out-bottom';
        reactFlowEdge.targetHandle = smartHandles.targetHandle || 'in-top';
      }
    });
    
    // Add converted edges to the result array
    edges.push(...convertedEdges);
  }

  /**
   * Get edge handles for ReactFlow bridge (moved from VisualizationState)
   * This is ReactFlow-specific logic for handle assignment
   * For discrete strategy: intelligently choose handles based on node positions
   * Prefer: inputs at top or left, outputs at bottom or right
   */
  getEdgeHandles(visState: VisualizationState, edgeId: string): { sourceHandle?: string; targetHandle?: string } {
    const edge = visState.getGraphEdge(edgeId);
    if (!edge) {
      return {};
    }
    
    if (CURRENT_HANDLE_STRATEGY === 'discrete') {
      // Get source and target nodes to determine optimal handle positions
      const sourceNode = visState.getGraphNode(edge.source);
      const targetNode = visState.getGraphNode(edge.target);
      
      if (sourceNode && targetNode && sourceNode.layout && targetNode.layout) {
        // Fix: Access position coordinates correctly from nested structure
        const sourcePos = { 
          x: sourceNode.layout.position?.x || sourceNode.layout.x || 0, 
          y: sourceNode.layout.position?.y || sourceNode.layout.y || 0,
          width: sourceNode.layout.dimensions?.width || sourceNode.layout.width || 120,
          height: sourceNode.layout.dimensions?.height || sourceNode.layout.height || 40
        };
        const targetPos = { 
          x: targetNode.layout.position?.x || targetNode.layout.x || 0, 
          y: targetNode.layout.position?.y || targetNode.layout.y || 0,
          width: targetNode.layout.dimensions?.width || targetNode.layout.width || 120,
          height: targetNode.layout.dimensions?.height || targetNode.layout.height || 40
        };
        
        // Calculate center-to-center distances
        const sourceCenterX = sourcePos.x + sourcePos.width / 2;
        const sourceCenterY = sourcePos.y + sourcePos.height / 2;
        const targetCenterX = targetPos.x + targetPos.width / 2;
        const targetCenterY = targetPos.y + targetPos.height / 2;
        
        const deltaX = targetCenterX - sourceCenterX;
        const deltaY = targetCenterY - sourceCenterY;
        
        // Use absolute distances to determine primary direction
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        let sourceHandle: string;
        let targetHandle: string;
        
        // STRICT RULES: 
        // - Sources only use: out-bottom, out-right (NEVER out-top or out-left)
        // - Targets only use: in-top, in-left (NEVER in-bottom or in-right)
        
        if (absX > absY * 0.8) {
          // Horizontal relationship is stronger - prefer left/right handles
          sourceHandle = 'out-right';   // Always use right for horizontal sources
          targetHandle = 'in-left';     // Always use left for horizontal targets
        } else {
          // Vertical or diagonal relationship - use bottom/top handles
          sourceHandle = 'out-bottom';  // Always use bottom for sources (never top!)
          targetHandle = 'in-top';      // Always use top for targets
        }
        
        return { sourceHandle, targetHandle };
      }
      
      // Fallback to default if no layout information
      return {
        sourceHandle: (edge as any).sourceHandle || 'out-bottom',
        targetHandle: (edge as any).targetHandle || 'in-top'
      };
    }
    
    // Handle edges with port information for other strategies
    return {
      sourceHandle: (edge as any).sourceHandle || 'default-out',
      targetHandle: (edge as any).targetHandle || 'default-in'
    };
  }

  /**
   * Extract custom properties from graph elements
   */
  private extractCustomProperties(element: GraphNode | GraphEdge | Container): Record<string, any> {
    const customProps: Record<string, any> = {};
    
    // Filter out known properties to get custom ones
    const knownProps = new Set([
      'id', 'label', 'style', 'hidden', 'layout', 
      'source', 'target', 'children', 'collapsed',
      'x', 'y', 'width', 'height'
    ]);
    
    Object.entries(element).forEach(([key, value]) => {
      if (!knownProps.has(key)) {
        customProps[key] = value;
      }
    });
    
    return customProps;
  }
}
