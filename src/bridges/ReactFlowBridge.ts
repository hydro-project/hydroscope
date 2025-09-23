/**
 * ReactFlowBridge - Stateless bridge for ReactFlow rendering
 * Architectural constraints: Stateless, synchronous conversions, immutable output
 */

import type { VisualizationState } from '../core/VisualizationState.js'
import type { StyleConfig, ReactFlowData, ReactFlowNode, ReactFlowEdge } from '../types/core.js'

export class ReactFlowBridge {
  constructor(private styleConfig: StyleConfig) {}

  // Synchronous Conversion
  toReactFlowData(state: VisualizationState): ReactFlowData {
    const nodes = this.convertNodes(state)
    const edges = this.convertEdges(state)

    return {
      nodes: this.applyNodeStyles(nodes),
      edges: this.applyEdgeStyles(edges)
    }
  }

  private convertNodes(state: VisualizationState): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = []

    // Convert regular nodes
    for (const node of state.visibleNodes) {
      nodes.push({
        id: node.id,
        type: 'default',
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.showingLongLabel ? node.longLabel : node.label,
          longLabel: node.longLabel,
          showingLongLabel: node.showingLongLabel,
          nodeType: node.type
        }
      })
    }

    // Convert containers
    for (const container of state.visibleContainers) {
      if (container.collapsed) {
        nodes.push(this.renderCollapsedContainer(container))
      } else {
        nodes.push(...this.renderExpandedContainer(container, state))
      }
    }

    return nodes
  }

  private convertEdges(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = []

    for (const edge of state.visibleEdges) {
      if ('aggregated' in edge && edge.aggregated) {
        edges.push(this.renderAggregatedEdge(edge))
      } else {
        edges.push(this.renderOriginalEdge(edge))
      }
    }

    return edges
  }

  // Styling
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map(node => ({
      ...node,
      style: {
        ...this.styleConfig.nodeStyles?.[node.data.nodeType],
        ...node.style
      }
    }))
  }

  applyEdgeStyles(edges: ReactFlowEdge[]): ReactFlowEdge[] {
    return edges.map(edge => ({
      ...edge,
      style: {
        ...this.styleConfig.edgeStyles?.[edge.type],
        ...edge.style
      }
    }))
  }

  // Container Handling
  renderCollapsedContainer(container: any): ReactFlowNode {
    return {
      id: container.id,
      type: 'container',
      position: container.position || { x: 0, y: 0 },
      data: {
        label: container.label,
        nodeType: 'container',
        collapsed: true,
        containerChildren: container.children.size
      },
      style: this.styleConfig.containerStyles?.collapsed
    }
  }

  renderExpandedContainer(container: any, state: VisualizationState): ReactFlowNode[] {
    // For expanded containers, we render the container boundary and its children
    const containerNode: ReactFlowNode = {
      id: container.id,
      type: 'container',
      position: container.position || { x: 0, y: 0 },
      data: {
        label: container.label,
        nodeType: 'container',
        collapsed: false,
        containerChildren: container.children.size
      },
      style: this.styleConfig.containerStyles?.expanded
    }

    return [containerNode]
  }

  // Edge Handling
  renderOriginalEdge(edge: any): ReactFlowEdge {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'default'
    }
  }

  renderAggregatedEdge(aggregatedEdge: any): ReactFlowEdge {
    return {
      id: aggregatedEdge.id,
      source: aggregatedEdge.source,
      target: aggregatedEdge.target,
      type: 'aggregated',
      style: {
        strokeWidth: 3,
        stroke: '#ff6b6b'
      }
    }
  }
}