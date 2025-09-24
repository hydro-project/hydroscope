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
import type { CSSProperties } from "react";
import { processSemanticTags } from "../utils/StyleProcessor.js";

export class ReactFlowBridge {
  constructor(private styleConfig: StyleConfig) {}

  // Synchronous Conversion
  toReactFlowData(state: VisualizationState, interactionHandler?: any): ReactFlowData {
    const nodes = this.convertNodes(state, interactionHandler);
    const edges = this.convertEdges(state);

    return {
      nodes: this.applyNodeStyles(nodes),
      edges: this.applyEdgeStyles(edges),
    };
  }

  private convertNodes(state: VisualizationState, interactionHandler?: any): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = [];

    // Convert regular nodes
    for (const node of state.visibleNodes) {
      nodes.push({
        id: node.id,
        type: "default",
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.showingLongLabel ? node.longLabel : node.label,
          longLabel: node.longLabel,
          showingLongLabel: node.showingLongLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          originalNode: node,
          onClick: interactionHandler ? (elementId: string, elementType: 'node' | 'container') => {
            if (elementType === 'node') {
              interactionHandler.handleNodeClick(elementId);
            }
          } : undefined,
        },
      });
    }

    // Convert containers
    for (const container of state.visibleContainers) {
      if (container.collapsed) {
        nodes.push(this.renderCollapsedContainer(container, interactionHandler));
      } else {
        nodes.push(...this.renderExpandedContainer(container, state, interactionHandler));
      }
    }

    return nodes;
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

  // Styling
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map((node) => {
      // Get the original node data to access semantic tags
      const nodeData = node.data as any;
      const semanticTags = nodeData.semanticTags || [];
      
      // Start with type-based styles
      const typeBasedStyle = this.styleConfig.nodeStyles?.[node.data.nodeType] || {};
      
      // Process semantic tags for styling (only if we have semantic tags and config)
      let semanticStyle = {};
      let appliedTags: string[] = [];
      
      if (semanticTags.length > 0 && (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)) {
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          nodeData.label,
          'node'
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

      return {
        ...node,
        style: combinedStyle,
        data: {
          ...node.data,
          appliedSemanticTags: appliedTags,
        },
      };
    });
  }

  applyEdgeStyles(edges: ReactFlowEdge[]): ReactFlowEdge[] {
    return edges.map((edge) => {
      // Get semantic tags from edge data
      const edgeData = edge.data as any;
      const semanticTags = edgeData?.semanticTags || [];
      
      // Start with type-based styles
      const typeBasedStyle = this.styleConfig.edgeStyles?.[edge.type] || {};
      
      // Process semantic tags for styling (only if we have semantic tags and config)
      let semanticStyle = {};
      let appliedTags: string[] = [];
      let animated = false;
      let label = edge.label;
      let markerEnd = edge.markerEnd;
      let lineStyle: 'single' | 'double' = 'single';
      
      if (semanticTags.length > 0 && (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)) {
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          edge.label as string,
          'edge'
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
        animated = processedStyle.animated;
        label = processedStyle.label || edge.label;
        markerEnd = processedStyle.markerEnd || edge.markerEnd;
        lineStyle = processedStyle.lineStyle || 'single';
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...edge.style,
      };

      return {
        ...edge,
        style: combinedStyle,
        animated: animated || edge.animated,
        label: label,
        markerEnd: markerEnd,
        data: {
          ...edgeData,
          appliedSemanticTags: appliedTags,
          lineStyle: lineStyle,
        },
      };
    });
  }

  // Container Handling
  renderCollapsedContainer(container: any, interactionHandler?: any): ReactFlowNode {
    return {
      id: container.id,
      type: "container",
      position: container.position || { x: 0, y: 0 },
      data: {
        label: container.label,
        nodeType: "container",
        collapsed: true,
        containerChildren: container.children.size,
        onClick: interactionHandler ? (elementId: string, elementType: 'node' | 'container') => {
          if (elementType === 'container') {
            interactionHandler.handleContainerClick(elementId);
          }
        } : undefined,
      },
      style: this.styleConfig.containerStyles?.collapsed,
    };
  }

  renderExpandedContainer(
    container: any,
    state: VisualizationState,
    interactionHandler?: any
  ): ReactFlowNode[] {
    // For expanded containers, we render the container boundary and its children
    const containerNode: ReactFlowNode = {
      id: container.id,
      type: "container",
      position: container.position || { x: 0, y: 0 },
      data: {
        label: container.label,
        nodeType: "container",
        collapsed: false,
        containerChildren: container.children.size,
        onClick: interactionHandler ? (elementId: string, elementType: 'node' | 'container') => {
          if (elementType === 'container') {
            interactionHandler.handleContainerClick(elementId);
          }
        } : undefined,
      },
      style: this.styleConfig.containerStyles?.expanded,
    };

    return [containerNode];
  }

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
