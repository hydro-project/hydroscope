/**
 * ELKBridge - Stateless bridge for ELK layout engine integration
 * Architectural constraints: Stateless, React-free, synchronous conversions
 */

import type { VisualizationState } from '../core/VisualizationState.js'
import type { LayoutConfig, ELKNode, ValidationResult, GraphNode, Container } from '../types/core.js'

export class ELKBridge {
  constructor(private layoutConfig: LayoutConfig = {}) {
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
        'elk.spacing.nodeNode': (this.layoutConfig.spacing || 50).toString()
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
          height: 60
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
          height: 80
        })
      } else {
        // Expanded container with children
        const containerChildren = visibleNodes
          .filter(node => container.children.has(node.id))
          .map(node => ({
            id: node.id,
            width: 120,
            height: 60
          }))

        elkNode.children!.push({
          id: container.id,
          width: 200,
          height: 150,
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

    try {
      // Validate ELK result structure
      this.validateELKResult(elkResult)

      // Apply positions to nodes and containers
      this.applyPositionsToElements(state, elkResult.children)
      
      // Update layout state to indicate successful layout application
      state.setLayoutPhase('ready')
    } catch (error) {
      // Handle layout application errors
      state.setLayoutPhase('error')
      throw new Error(`Failed to apply ELK layout results: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private applyPositionsToElements(state: VisualizationState, elkChildren: ELKNode[]): void {
    for (const elkChild of elkChildren) {
      if (elkChild.x === undefined || elkChild.y === undefined) {
        continue // Skip invalid results
      }

      const node = state.getGraphNode(elkChild.id)
      const container = state.getContainer(elkChild.id)

      if (node) {
        this.applyNodePosition(node, elkChild)
      } else if (container) {
        this.applyContainerPosition(container, elkChild)
      }
      // Silently ignore unknown IDs (they may be from previous state)

      // Handle nested children (for expanded containers)
      if (elkChild.children && elkChild.children.length > 0) {
        this.applyPositionsToElements(state, elkChild.children)
      }
    }
  }

  private applyNodePosition(node: GraphNode, elkChild: ELKNode): void {
    node.position = { x: elkChild.x!, y: elkChild.y! }
    if (elkChild.width && elkChild.height) {
      node.dimensions = { width: elkChild.width, height: elkChild.height }
    }
  }

  private applyContainerPosition(container: Container, elkChild: ELKNode): void {
    container.position = { x: elkChild.x!, y: elkChild.y! }
    if (elkChild.width && elkChild.height) {
      container.dimensions = { width: elkChild.width, height: elkChild.height }
    }
  }

  // Configuration
  updateConfiguration(config: Partial<LayoutConfig>): void {
    const newConfig: LayoutConfig = { ...this.layoutConfig, ...config }
    this.validateConfiguration(newConfig)
    this.layoutConfig = newConfig
  }

  private validateConfiguration(config: LayoutConfig): void {
    const validAlgorithms = ['layered', 'force', 'stress', 'mrtree']
    const validDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT']

    if (config.algorithm && !validAlgorithms.includes(config.algorithm)) {
      throw new Error('Invalid ELK algorithm')
    }

    if (config.direction && !validDirections.includes(config.direction)) {
      throw new Error('Invalid ELK direction')
    }
  }

  private validateELKResult(elkResult: ELKNode): void {
    if (!elkResult.children) return

    this.validateELKChildren(elkResult.children)
  }

  private validateELKChildren(children: ELKNode[]): void {
    for (const child of children) {
      // Validate required position and dimension properties
      if (child.x === undefined || child.y === undefined || 
          child.width === undefined || child.height === undefined) {
        throw new Error(`Invalid ELK layout result for element ${child.id}: missing position or dimensions`)
      }

      // Validate position values are finite numbers
      if (!Number.isFinite(child.x) || !Number.isFinite(child.y) ||
          !Number.isFinite(child.width) || !Number.isFinite(child.height)) {
        throw new Error(`Invalid ELK layout result for element ${child.id}: non-finite position or dimensions`)
      }

      // Validate dimensions are positive
      if (child.width <= 0 || child.height <= 0) {
        throw new Error(`Invalid ELK layout result for element ${child.id}: non-positive dimensions`)
      }

      // Recursively validate nested children
      if (child.children && child.children.length > 0) {
        this.validateELKChildren(child.children)
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