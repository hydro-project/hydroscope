/**
 * ELKBridge - Stateless bridge for ELK layout engine integration
 * Architectural constraints: Stateless, React-free, synchronous conversions
 */

import type { VisualizationState } from '../core/VisualizationState.js'
import type { LayoutConfig, ELKNode, ELKEdge, ValidationResult } from '../types/core.js'

export class ELKBridge {
  constructor(private layoutConfig: LayoutConfig) {}

  // Synchronous Conversions
  toELKGraph(state: VisualizationState): ELKNode {
    const visibleNodes = state.visibleNodes
    const visibleContainers = state.visibleContainers
    const visibleEdges = state.visibleEdges

    const elkNode: ELKNode = {
      id: 'root',
      children: [],
      edges: [],
      layoutOptions: {
        'elk.algorithm': this.layoutConfig.algorithm || 'layered',
        'elk.direction': this.layoutConfig.direction || 'DOWN',
        'elk.spacing.nodeNode': this.layoutConfig.spacing || 50
      }
    }

    // Convert nodes
    for (const node of visibleNodes) {
      elkNode.children!.push({
        id: node.id,
        width: node.dimensions?.width || 100,
        height: node.dimensions?.height || 50
      })
    }

    // Convert containers
    for (const container of visibleContainers) {
      elkNode.children!.push({
        id: container.id,
        width: container.width || container.dimensions?.width || 150,
        height: container.height || container.dimensions?.height || 100
      })
    }

    // Convert edges
    for (const edge of visibleEdges) {
      elkNode.edges!.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target]
      })
    }

    return elkNode
  }

  applyELKResults(state: VisualizationState, elkResult: ELKNode): void {
    if (!elkResult.children) return

    // Apply positions to nodes and containers
    for (const elkChild of elkResult.children) {
      const node = state.getGraphNode(elkChild.id)
      const container = state.getContainer(elkChild.id)

      if (node && elkChild.x !== undefined && elkChild.y !== undefined) {
        node.position = { x: elkChild.x, y: elkChild.y }
        if (elkChild.width && elkChild.height) {
          node.dimensions = { width: elkChild.width, height: elkChild.height }
        }
      }

      if (container && elkChild.x !== undefined && elkChild.y !== undefined) {
        container.position = { x: elkChild.x, y: elkChild.y }
        container.x = elkChild.x
        container.y = elkChild.y
        if (elkChild.width && elkChild.height) {
          container.dimensions = { width: elkChild.width, height: elkChild.height }
          container.width = elkChild.width
          container.height = elkChild.height
        }
      }
    }
  }

  // Configuration
  updateLayoutConfig(config: LayoutConfig): void {
    this.layoutConfig = { ...this.layoutConfig, ...config }
  }

  // Validation
  validateELKGraph(elkGraph: ELKNode): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!elkGraph.id) {
      errors.push('ELK graph must have an id')
    }

    if (!elkGraph.children || elkGraph.children.length === 0) {
      warnings.push('ELK graph has no children')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}