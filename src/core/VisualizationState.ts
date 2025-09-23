/**
 * VisualizationState - Central data model for Hydroscope
 * Architectural constraints: React-free, single source of truth, synchronous core
 */

import type { 
  GraphNode, 
  GraphEdge, 
  Container, 
  AggregatedEdge, 
  LayoutState, 
  SearchResult, 
  InvariantViolation 
} from '../types/core.js'

export class VisualizationState {
  private _nodes = new Map<string, GraphNode>()
  private _edges = new Map<string, GraphEdge>()
  private _containers = new Map<string, Container>()
  private _aggregatedEdges = new Map<string, AggregatedEdge>()
  private _nodeContainerMap = new Map<string, string>()
  private _containerParentMap = new Map<string, string>()
  private _layoutState: LayoutState = {
    phase: 'initial',
    layoutCount: 0,
    lastUpdate: Date.now()
  }
  private _searchResults: SearchResult[] = []
  private _validationEnabled = true
  private _validationInProgress = false

  // Data Management
  addNode(node: GraphNode): void {
    this._validateNodeData(node)
    this._nodes.set(node.id, { ...node })
    this.validateInvariants()
  }

  removeNode(id: string): void {
    this._nodes.delete(id)
    this._nodeContainerMap.delete(id)
    this.validateInvariants()
  }

  updateNode(id: string, node: GraphNode): void {
    if (!this._nodes.has(id)) {
      return // Handle non-existent node gracefully
    }
    
    this._validateNodeData(node, false) // Skip id validation for updates
    this._nodes.set(id, { ...node })
    this.validateInvariants()
  }

  private _validateNodeData(node: GraphNode, validateId: boolean = true): void {
    if (!node) {
      throw new Error('Invalid node: node cannot be null or undefined')
    }
    if (validateId && (!node.id || node.id.trim() === '')) {
      throw new Error('Invalid node: id cannot be empty')
    }
    if (!node.label || node.label.trim() === '') {
      throw new Error('Invalid node: label cannot be empty')
    }
  }

  addEdge(edge: GraphEdge): void {
    this._validateEdgeData(edge)
    this._edges.set(edge.id, { ...edge })
    this.validateInvariants()
  }

  removeEdge(id: string): void {
    this._edges.delete(id)
    this.validateInvariants()
  }

  updateEdge(id: string, edge: GraphEdge): void {
    if (!this._edges.has(id)) {
      return // Handle non-existent edge gracefully
    }
    
    this._validateEdgeData(edge, false) // Skip id validation for updates
    this._edges.set(id, { ...edge })
    this.validateInvariants()
  }

  private _validateEdgeData(edge: GraphEdge, validateId: boolean = true): void {
    if (!edge) {
      throw new Error('Invalid edge: edge cannot be null or undefined')
    }
    if (validateId && (!edge.id || edge.id.trim() === '')) {
      throw new Error('Invalid edge: id cannot be empty')
    }
    if (!edge.source || edge.source.trim() === '') {
      throw new Error('Invalid edge: source cannot be empty')
    }
    if (!edge.target || edge.target.trim() === '') {
      throw new Error('Invalid edge: target cannot be empty')
    }
  }

  addContainer(container: Container): void {
    this._validateContainerData(container)
    this._updateContainerWithMappings(container)
    this.validateInvariants()
  }

  removeContainer(id: string): void {
    const container = this._containers.get(id)
    this._containers.delete(id)
    
    // Clean up mappings for this container's children
    if (container) {
      for (const childId of container.children) {
        this._nodeContainerMap.delete(childId)
        this._containerParentMap.delete(childId)
      }
    }
    
    this.validateInvariants()
  }

  updateContainer(id: string, container: Container): void {
    if (!this._containers.has(id)) {
      return // Handle non-existent container gracefully
    }
    
    this._validateContainerData(container, false) // Skip id validation for updates
    
    // Clean up old mappings
    const oldContainer = this._containers.get(id)
    if (oldContainer) {
      this._cleanupContainerMappings(oldContainer)
    }
    
    this._updateContainerWithMappings(container)
    this.validateInvariants()
  }

  private _validateContainerData(container: Container, validateId: boolean = true): void {
    if (!container) {
      throw new Error('Invalid container: container cannot be null or undefined')
    }
    if (validateId && (!container.id || container.id.trim() === '')) {
      throw new Error('Invalid container: id cannot be empty')
    }
    if (!container.label || container.label.trim() === '') {
      throw new Error('Invalid container: label cannot be empty')
    }
  }

  private _updateContainerWithMappings(container: Container): void {
    // Check for circular dependencies before adding
    this._validateNoCircularDependencies(container)
    
    // If container already exists, clean up old mappings first
    const existingContainer = this._containers.get(container.id)
    if (existingContainer) {
      this._cleanupContainerMappings(existingContainer)
    }
    
    this._containers.set(container.id, { 
      ...container, 
      children: new Set(container.children),
      collapsed: container.collapsed ?? false,
      hidden: container.hidden ?? false
    })
    
    // Update mappings for all children
    this._updateChildMappings(container)
    
    // Also update any existing containers that might now have this as a parent
    this._updateParentMappings()
  }

  private _updateChildMappings(container: Container): void {
    for (const childId of container.children) {
      if (this._containers.has(childId)) {
        // Child is a container
        this._containerParentMap.set(childId, container.id)
      } else {
        // Child is a node (or will be a node when added later)
        this._nodeContainerMap.set(childId, container.id)
      }
    }
  }

  private _updateParentMappings(): void {
    // Go through all containers and update parent mappings
    for (const [containerId, container] of this._containers) {
      for (const childId of container.children) {
        if (this._containers.has(childId)) {
          this._containerParentMap.set(childId, containerId)
        }
      }
    }
  }

  private _cleanupContainerMappings(container: Container): void {
    for (const childId of container.children) {
      this._nodeContainerMap.delete(childId)
      this._containerParentMap.delete(childId)
    }
  }

  private _validateNoCircularDependencies(container: Container): void {
    // Check for self-reference
    if (container.children.has(container.id)) {
      throw new Error(`Circular dependency detected: Container ${container.id} cannot contain itself`)
    }
    
    // Check for circular dependencies through the hierarchy
    for (const childId of container.children) {
      // Check if childId already has container.id as a child (direct circular dependency)
      const existingChild = this._containers.get(childId)
      if (existingChild && existingChild.children.has(container.id)) {
        throw new Error(`Circular dependency detected: ${container.id} and ${childId} would reference each other`)
      }
      
      if (this._containers.has(childId)) {
        // Check if making childId a child of container.id would create a cycle
        // This happens if container.id is already a descendant of childId
        if (this._isDescendantOf(container.id, childId)) {
          throw new Error(`Circular dependency detected: Adding ${childId} to ${container.id} would create a cycle`)
        }
      }
    }
  }

  private _isDescendantOf(potentialDescendant: string, ancestor: string): boolean {
    const descendants = this.getContainerDescendants(ancestor)
    return descendants.includes(potentialDescendant)
  }

  // Container Operations
  expandContainer(id: string): void {
    const container = this._containers.get(id)
    if (!container) return

    container.collapsed = false
    container.hidden = false

    // Show child nodes
    for (const childId of container.children) {
      const childNode = this._nodes.get(childId)
      if (childNode) {
        childNode.hidden = false
      }
    }

    this.validateInvariants()
  }

  collapseContainer(id: string): void {
    const container = this._containers.get(id)
    if (!container) return

    container.collapsed = true

    // Hide child nodes and containers
    for (const childId of container.children) {
      const childNode = this._nodes.get(childId)
      const childContainer = this._containers.get(childId)
      
      if (childNode) {
        childNode.hidden = true
      }
      if (childContainer) {
        childContainer.hidden = true
        childContainer.collapsed = true
      }
    }

    this.validateInvariants()
  }

  expandAllContainers(): void {
    for (const container of this._containers.values()) {
      if (container.collapsed) {
        this.expandContainer(container.id)
      }
    }
  }

  collapseAllContainers(): void {
    for (const container of this._containers.values()) {
      if (!container.collapsed) {
        this.collapseContainer(container.id)
      }
    }
  }

  // Read-only Access
  get visibleNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._nodes.values()).filter(node => !node.hidden)
  }

  get visibleEdges(): ReadonlyArray<GraphEdge | AggregatedEdge> {
    const regularEdges = Array.from(this._edges.values()).filter(edge => !edge.hidden)
    const aggregatedEdges = Array.from(this._aggregatedEdges.values()).filter(edge => !edge.hidden)
    return [...regularEdges, ...aggregatedEdges]
  }

  get visibleContainers(): ReadonlyArray<Container> {
    return Array.from(this._containers.values()).filter(container => !container.hidden)
  }

  // Getters for validation and external access
  getGraphNode(id: string): GraphNode | undefined {
    return this._nodes.get(id)
  }

  getGraphEdge(id: string): GraphEdge | undefined {
    return this._edges.get(id)
  }

  getContainer(id: string): Container | undefined {
    return this._containers.get(id)
  }

  getNodeContainer(nodeId: string): string | undefined {
    return this._nodeContainerMap.get(nodeId)
  }

  getContainerChildren(containerId: string): Set<string> {
    return this._containers.get(containerId)?.children || new Set()
  }

  // Container Hierarchy Methods
  getContainerParent(containerId: string): string | undefined {
    return this._containerParentMap.get(containerId)
  }

  getContainerAncestors(containerId: string): string[] {
    const ancestors: string[] = []
    let current = this.getContainerParent(containerId)
    
    while (current) {
      ancestors.push(current)
      current = this.getContainerParent(current)
    }
    
    return ancestors
  }

  getContainerDescendants(containerId: string): string[] {
    const descendants: string[] = []
    const children = this.getContainerChildren(containerId)
    
    for (const childId of children) {
      if (this._containers.has(childId)) {
        descendants.push(childId)
        descendants.push(...this.getContainerDescendants(childId))
      }
    }
    
    return descendants
  }

  getContainerNodes(containerId: string): Set<string> {
    const container = this._containers.get(containerId)
    if (!container) return new Set()
    
    const nodes = new Set<string>()
    for (const childId of container.children) {
      if (this._nodes.has(childId)) {
        nodes.add(childId)
      }
    }
    
    return nodes
  }

  getAllNodesInHierarchy(containerId: string): Set<string> {
    const allNodes = new Set<string>()
    const container = this._containers.get(containerId)
    if (!container) return allNodes
    
    for (const childId of container.children) {
      if (this._nodes.has(childId)) {
        allNodes.add(childId)
      } else if (this._containers.has(childId)) {
        const childNodes = this.getAllNodesInHierarchy(childId)
        for (const nodeId of childNodes) {
          allNodes.add(nodeId)
        }
      }
    }
    
    return allNodes
  }

  getOrphanedNodes(): string[] {
    const orphaned: string[] = []
    
    // Check all node-container mappings for non-existent containers
    for (const [nodeId, containerId] of this._nodeContainerMap) {
      if (!this._containers.has(containerId)) {
        orphaned.push(nodeId)
      }
    }
    
    return orphaned
  }

  getOrphanedContainers(): string[] {
    const orphaned: string[] = []
    
    // Check all container-parent mappings for non-existent parents
    for (const [containerId, parentId] of this._containerParentMap) {
      if (!this._containers.has(parentId)) {
        orphaned.push(containerId)
      }
    }
    
    return orphaned
  }

  cleanupOrphanedEntities(): void {
    // Clean up orphaned node mappings and remove nodes
    const orphanedNodes = this.getOrphanedNodes()
    for (const nodeId of orphanedNodes) {
      this._nodeContainerMap.delete(nodeId)
      this.removeNode(nodeId)
    }
    
    // Clean up orphaned container mappings and remove containers
    const orphanedContainers = this.getOrphanedContainers()
    for (const containerId of orphanedContainers) {
      this._containerParentMap.delete(containerId)
      this.removeContainer(containerId)
    }
  }

  moveNodeToContainer(nodeId: string, targetContainerId: string): void {
    // Remove from current container
    const currentContainerId = this.getNodeContainer(nodeId)
    if (currentContainerId) {
      const currentContainer = this._containers.get(currentContainerId)
      if (currentContainer) {
        currentContainer.children.delete(nodeId)
      }
    }
    
    // Add to target container
    const targetContainer = this._containers.get(targetContainerId)
    if (targetContainer) {
      targetContainer.children.add(nodeId)
      this._nodeContainerMap.set(nodeId, targetContainerId)
    }
    
    this.validateInvariants()
  }

  // Layout State
  getLayoutState(): LayoutState {
    return { ...this._layoutState }
  }

  setLayoutPhase(phase: LayoutState['phase']): void {
    this._layoutState.phase = phase
    this._layoutState.lastUpdate = Date.now()
  }

  incrementLayoutCount(): void {
    this._layoutState.layoutCount++
  }

  isFirstLayout(): boolean {
    return this._layoutState.layoutCount === 0
  }

  // Search
  search(query: string): SearchResult[] {
    this._searchResults = []
    
    // Search nodes
    for (const node of this._nodes.values()) {
      if (node.label.toLowerCase().includes(query.toLowerCase())) {
        this._searchResults.push({
          id: node.id,
          label: node.label,
          type: 'node',
          matchIndices: [[0, query.length]]
        })
      }
    }

    // Search containers
    for (const container of this._containers.values()) {
      if (container.label.toLowerCase().includes(query.toLowerCase())) {
        this._searchResults.push({
          id: container.id,
          label: container.label,
          type: 'container',
          matchIndices: [[0, query.length]]
        })
      }
    }

    return [...this._searchResults]
  }

  clearSearch(): void {
    this._searchResults = []
  }

  // Validation - Extracted invariants from main branch
  validateInvariants(): void {
    if (!this._validationEnabled || this._validationInProgress) {
      return
    }

    this._validationInProgress = true
    
    try {
      const violations: InvariantViolation[] = []

      // Container State Invariants
      violations.push(...this.validateContainerStates())
      violations.push(...this.validateContainerHierarchy())

      // Node State Invariants  
      violations.push(...this.validateNodeContainerRelationships())

      // Edge Invariants
      violations.push(...this.validateEdgeNodeConsistency())
      violations.push(...this.validateNoEdgesToHiddenEntities())

      // Layout Invariants
      violations.push(...this.validateCollapsedContainerDimensions())

      this.reportViolations(violations)
    } finally {
      this._validationInProgress = false
    }
  }

  private validateContainerStates(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const [containerId, container] of this._containers) {
      // Illegal Expanded/Hidden state
      if (!container.collapsed && container.hidden) {
        violations.push({
          type: 'ILLEGAL_CONTAINER_STATE',
          message: `Container ${containerId} is in illegal Expanded/Hidden state`,
          entityId: containerId,
          severity: 'error'
        })
      }
    }

    return violations
  }

  private validateContainerHierarchy(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const [containerId, container] of this._containers) {
      if (container.collapsed) {
        this.validateDescendantsCollapsed(containerId, violations)
      }
      if (!container.hidden) {
        this.validateAncestorsVisible(containerId, violations)
      }
    }

    return violations
  }

  private validateDescendantsCollapsed(containerId: string, violations: InvariantViolation[]): void {
    const children = this.getContainerChildren(containerId)

    for (const childId of children) {
      const childContainer = this.getContainer(childId)
      if (childContainer) {
        if (!childContainer.collapsed) {
          violations.push({
            type: 'DESCENDANT_NOT_COLLAPSED',
            message: `Container ${childId} should be collapsed because ancestor ${containerId} is collapsed`,
            entityId: childId,
            severity: 'error'
          })
        }
        if (!childContainer.hidden) {
          violations.push({
            type: 'DESCENDANT_NOT_HIDDEN',
            message: `Container ${childId} should be hidden because ancestor ${containerId} is collapsed`,
            entityId: childId,
            severity: 'error'
          })
        }
      } else {
        const childNode = this.getGraphNode(childId)
        if (childNode && !childNode.hidden) {
          violations.push({
            type: 'DESCENDANT_NODE_NOT_HIDDEN',
            message: `Node ${childId} should be hidden because container ${containerId} is collapsed`,
            entityId: childId,
            severity: 'error'
          })
        }
      }
    }
  }

  private validateAncestorsVisible(containerId: string, violations: InvariantViolation[]): void {
    let current = this.getNodeContainer(containerId)

    while (current) {
      const ancestorContainer = this.getContainer(current)
      if (ancestorContainer && ancestorContainer.hidden) {
        violations.push({
          type: 'ANCESTOR_NOT_VISIBLE',
          message: `Container ${containerId} is visible but ancestor ${current} is hidden`,
          entityId: containerId,
          severity: 'error'
        })
      }
      current = this.getNodeContainer(current)
    }
  }

  private validateNodeContainerRelationships(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const [nodeId, node] of this._nodes) {
      const containerName = this.getNodeContainer(nodeId)

      if (containerName) {
        const container = this.getContainer(containerName)

        if (container && container.collapsed && !node.hidden) {
          violations.push({
            type: 'NODE_NOT_HIDDEN_IN_COLLAPSED_CONTAINER',
            message: `Node ${nodeId} should be hidden because it belongs to collapsed container ${containerName}`,
            entityId: nodeId,
            severity: 'error'
          })
        }
      }
    }

    return violations
  }

  private validateEdgeNodeConsistency(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const [edgeId, edge] of this._edges) {
      const sourceExists = this.getGraphNode(edge.source) || this.getContainer(edge.source)
      const targetExists = this.getGraphNode(edge.target) || this.getContainer(edge.target)

      if (!sourceExists) {
        violations.push({
          type: 'EDGE_INVALID_SOURCE',
          message: `Edge ${edgeId} references non-existent source ${edge.source}`,
          entityId: edgeId,
          severity: 'error'
        })
      }

      if (!targetExists) {
        violations.push({
          type: 'EDGE_INVALID_TARGET',
          message: `Edge ${edgeId} references non-existent target ${edge.target}`,
          entityId: edgeId,
          severity: 'error'
        })
      }
    }

    return violations
  }

  private validateNoEdgesToHiddenEntities(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const edge of this._edges.values()) {
      if (edge.hidden) continue

      const sourceContainer = this.getContainer(edge.source)
      const targetContainer = this.getContainer(edge.target)
      const sourceNode = this.getGraphNode(edge.source)
      const targetNode = this.getGraphNode(edge.target)

      const sourceHidden = sourceContainer?.hidden || sourceNode?.hidden
      const targetHidden = targetContainer?.hidden || targetNode?.hidden

      if (sourceHidden) {
        violations.push({
          type: 'EDGE_TO_HIDDEN_SOURCE',
          message: `Visible edge ${edge.id} references hidden source ${edge.source}`,
          entityId: edge.id,
          severity: 'error'
        })
      }

      if (targetHidden) {
        violations.push({
          type: 'EDGE_TO_HIDDEN_TARGET',
          message: `Visible edge ${edge.id} references hidden target ${edge.target}`,
          entityId: edge.id,
          severity: 'error'
        })
      }
    }

    return violations
  }

  private validateCollapsedContainerDimensions(): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const [containerId, container] of this._containers) {
      if (!container.collapsed) continue

      const width = container.width || container.dimensions?.width || 0
      const height = container.height || container.dimensions?.height || 0
      const maxAllowedWidth = 300 // Reasonable threshold
      const maxAllowedHeight = 300

      if (width > maxAllowedWidth || height > maxAllowedHeight) {
        violations.push({
          type: 'COLLAPSED_CONTAINER_LARGE_DIMENSIONS',
          message: `Collapsed container ${containerId} has large dimensions (${width}x${height}) that may cause layout issues`,
          entityId: containerId,
          severity: 'warning'
        })
      }
    }

    return violations
  }

  private reportViolations(violations: InvariantViolation[]): void {
    const errors = violations.filter(v => v.severity === 'error')
    const warnings = violations.filter(v => v.severity === 'warning')

    if (warnings.length > 0) {
      console.warn('[VisualizationState] Invariant warnings:', warnings)
    }

    if (errors.length > 0) {
      console.error('[VisualizationState] CRITICAL: Invariant violations:', errors)
      throw new Error(`VisualizationState invariant violations: ${errors.map(e => e.message).join('; ')}`)
    }
  }
}