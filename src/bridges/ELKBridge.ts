/**
 * ELKBridge - Stateless bridge for ELK layout engine integration
 * Architectural constraints: Stateless, React-free, synchronous conversions
 */

import type { VisualizationState } from '../core/VisualizationState.js'
import type { LayoutConfig, ELKNode, ELKEdge, ValidationResult } from '../types/core.js'

export class ELKBridge {
  constructor(private layoutConfig: Partial<LayoutConfig> = {}) {
    // Set defaults for missing config
    const fullConfig: LayoutConfig = {
      algorithm: layoutConfig.algorithm || 'layered',
      direction: layoutConfig.direction || 'DOWN',
      spacing: layoutConfig.spacing || 50
    }
    
    this.validateConfiguration(fullConfig)
    this.layoutConfig = fullConfig
  }

  // Synchronous Conversions
  toELKGraph(state: VisualizationState): ELKNode {
    const visibleNodes = state.visibleNodes
    const visibleContainers = state.visibleContainers
    const visibleEdges = state.visibleEdges
    const aggregatedEdges = state.getAggregatedEdges()

    const elkNode: ELKNode = {
      id: 'root',
      children: [],
      edges: [],
      layoutOptions: {
        'elk.algorithm': this.layoutConfig.algorithm,
        'elk.direction': this.layoutConfig.direction,
        'elk.spacing.nodeNode': this.layoutConfig.spacing.toString()
      }
    }

    // Convert visible nodes (not in collapsed containers)
    for (const node of visibleNodes) {
      // Check if node is in an expanded container
      const parentContainer = visibleContainers.find(c => c.children.has(node.id) && !c.collapsed)
      
      if (!parentContainer) {
        // Node is not in a container or container is collapsed
        elkNode.children!.push({
          id: node.id,
          width: 120,
          height: 60,
          labels: [{ text: node.label }]
        })
      }
    }

    // Convert containers
    for (const container of visibleContainers) {
      if (container.collapsed) {
        // Collapsed container as single node
        elkNode.children!.push({
          id: container.id,
          width: 150,
          height: 80,
          labels: [{ text: container.label }]
        })
      } else {
        // Expanded container with children
        const containerChildren = visibleNodes
          .filter(node => container.children.has(node.id))
          .map(node => ({
            id: node.id,
            width: 120,
            height: 60,
            labels: [{ text: node.label }]
          }))

        elkNode.children!.push({
          id: container.id,
          width: 200,
          height: 150,
          labels: [{ text: container.label }],
          children: containerChildren
        })
      }
    }

    // Convert regular edges (for expanded containers)
    for (const edge of visibleEdges) {
      elkNode.edges!.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target]
      })
    }

    // Convert aggregated edges (for collapsed containers)
    for (const aggEdge of aggregatedEdges) {
      elkNode.edges!.push({
        id: aggEdge.id,
        sources: [aggEdge.source],
        targets: [aggEdge.target]
      })
    }

    return elkNode
  }

  applyLayout(state: VisualizationState, elkResult: ELKNode): void {
    this.applyELKResults(state, elkResult)
  }

  applyELKResults(state: VisualizationState, elkResult: ELKNode): void {
    if (!elkResult.children) return

    // Validate ELK result
    this.validateELKResult(elkResult)

    // Apply positions to nodes and containers
    for (const elkChild of elkResult.children) {
      if (elkChild.x === undefined || elkChild.y === undefined) {
        continue // Skip invalid results
      }

      const node = state.getGraphNode(elkChild.id)
      const container = state.getContainer(elkChild.id)

      if (node) {
        node.position = { x: elkChild.x, y: elkChild.y }
        if (elkChild.width && elkChild.height) {
          node.dimensions = { width: elkChild.width, height: elkChild.height }
        }
      }

      if (container) {
        container.position = { x: elkChild.x, y: elkChild.y }
        if (elkChild.width && elkChild.height) {
          container.dimensions = { width: elkChild.width, height: elkChild.height }
        }
      }

      // Handle nested children (for expanded containers)
      if (elkChild.children) {
        for (const nestedChild of elkChild.children) {
          if (nestedChild.x === undefined || nestedChild.y === undefined) {
            continue
          }

          const nestedNode = state.getGraphNode(nestedChild.id)
          if (nestedNode) {
            nestedNode.position = { x: nestedChild.x, y: nestedChild.y }
            if (nestedChild.width && nestedChild.height) {
              nestedNode.dimensions = { width: nestedChild.width, height: nestedChild.height }
            }
          }
        }
      }
    }
  }

  // Configuration
  updateConfiguration(config: Partial<LayoutConfig>): void {
    const newConfig = { ...this.layoutConfig, ...config }
    this.validateConfiguration(newConfig)
    this.layoutConfig = newConfig
  }

  private validateConfiguration(config: LayoutConfig): void {
    const validAlgorithms = ['layered', 'force', 'stress', 'mrtree']
    const validDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT']

    if (!validAlgorithms.includes(config.algorithm)) {
      throw new Error('Invalid ELK algorithm')
    }

    if (!validDirections.includes(config.direction)) {
      throw new Error('Invalid ELK direction')
    }
  }

  private validateELKResult(elkResult: ELKNode): void {
    if (!elkResult.children) return

    for (const child of elkResult.children) {
      if (child.x === undefined || child.y === undefined || 
          child.width === undefined || child.height === undefined) {
        throw new Error('Invalid ELK layout result')
      }
    }
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