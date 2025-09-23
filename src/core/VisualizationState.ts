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
  private _orphanedNodes = new Set<string>()
  private _orphanedContainers = new Set<string>()
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
    
    // Check if this edge needs to be aggregated due to collapsed containers
    this._handleEdgeAggregationOnAdd(edge.id)
    
    this.validateInvariants()
  }

  private _handleEdgeAggregationOnAdd(edgeId: string): void {
    const edge = this._edges.get(edgeId)
    if (!edge) return

    // Find collapsed containers that contain the source or target
    for (const [containerId, container] of this._containers) {
      if (container.collapsed) {
        const descendants = this._getAllDescendantIds(containerId)
        if (descendants.has(edge.source) || descendants.has(edge.target)) {
          // This edge needs to be aggregated
          this.aggregateEdgesForContainer(containerId)
          break // Only need to aggregate once
        }
      }
    }
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
    
    // Clean up mappings and track orphaned entities
    if (container) {
      for (const childId of container.children) {
        this._nodeContainerMap.delete(childId)
        this._containerParentMap.delete(childId)
        
        // Track orphaned entities
        if (this._nodes.has(childId)) {
          this._orphanedNodes.add(childId)
        }
        if (this._containers.has(childId)) {
          this._orphanedContainers.add(childId)
        }
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
    
    // If container is collapsed, ensure children are hidden
    if (container.collapsed) {
      this._hideContainerChildren(container.id)
      this.aggregateEdgesForContainer(container.id)
    }
  }

  private _hideContainerChildren(containerId: string): void {
    // Use the same logic as collapsing - hide all transitive descendants
    this._hideAllDescendants(containerId)
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
    
    // Check if this container is already referenced as a child by any existing container
    // If so, adding it would create a cycle
    for (const [existingId, existingContainer] of this._containers) {
      if (existingContainer.children.has(container.id)) {
        // container.id is already a child of existingId
        // Check if any of container's children are ancestors of existingId
        for (const childId of container.children) {
          if (this._isAncestorOf(childId, existingId)) {
            throw new Error(`Circular dependency detected: ${childId} is an ancestor of ${existingId}, which already has ${container.id} as a child`)
          }
        }
      }
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
        
        // Check if childId is already an ancestor of container.id
        // This would create an indirect cycle: container.id -> ... -> childId -> ... -> container.id
        if (this._isAncestorOf(childId, container.id)) {
          throw new Error(`Circular dependency detected: ${childId} is already an ancestor of ${container.id}`)
        }
      }
    }
  }

  private _isAncestorOf(potentialAncestor: string, descendant: string): boolean {
    let current = this.getContainerParent(descendant)
    while (current) {
      if (current === potentialAncestor) {
        return true
      }
      current = this.getContainerParent(current)
    }
    return false
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

    // Show immediate children (but not their descendants if they are collapsed)
    this._showImmediateChildren(id)

    // Restore edges for this container
    this.restoreEdgesForContainer(id)

    this.validateInvariants()
  }

  private _showImmediateChildren(containerId: string): void {
    const container = this._containers.get(containerId)
    if (!container) return

    for (const childId of container.children) {
      const childNode = this._nodes.get(childId)
      const childContainer = this._containers.get(childId)
      
      if (childNode) {
        childNode.hidden = false
      }
      if (childContainer) {
        childContainer.hidden = false
        // Don't automatically expand child containers - they keep their collapsed state
        // Only show their contents if they are not collapsed
        if (!childContainer.collapsed) {
          this._showImmediateChildren(childId)
        }
      }
    }
  }

  collapseContainer(id: string): void {
    const container = this._containers.get(id)
    if (!container) return

    container.collapsed = true

    // Hide all transitive descendants
    this._hideAllDescendants(id)

    // Aggregate edges for this container
    this.aggregateEdgesForContainer(id)

    this.validateInvariants()
  }

  private _hideAllDescendants(containerId: string): void {
    const container = this._containers.get(containerId)
    if (!container) return

    for (const childId of container.children) {
      const childNode = this._nodes.get(childId)
      const childContainer = this._containers.get(childId)
      
      if (childNode) {
        childNode.hidden = true
      }
      if (childContainer) {
        childContainer.hidden = true
        childContainer.collapsed = true
        // Recursively hide descendants of child containers
        this._hideAllDescendants(childId)
      }
    }
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

  // Edge Aggregation Management
  aggregateEdgesForContainer(containerId: string): void {
    const container = this._containers.get(containerId)
    if (!container) return

    // Get all descendants of this container (including nested containers)
    const allDescendants = this._getAllDescendantIds(containerId)
    const edgesToAggregate = new Map<string, GraphEdge[]>() // key: source-target, value: edges
    const aggregatedEdgesToUpdate: AggregatedEdge[] = []

    // Find all edges that need to be aggregated
    for (const [edgeId, edge] of this._edges) {
      if (edge.hidden) continue

      const sourceInContainer = allDescendants.has(edge.source)
      const targetInContainer = allDescendants.has(edge.target)

      if (sourceInContainer || targetInContainer) {
        // Determine the aggregated source and target
        let aggregatedSource = edge.source
        let aggregatedTarget = edge.target

        // If source is in container, aggregate to container
        if (sourceInContainer) {
          aggregatedSource = containerId
        }

        // If target is in container, aggregate to container  
        if (targetInContainer) {
          aggregatedTarget = containerId
        }

        // Skip self-loops to the container
        if (aggregatedSource === aggregatedTarget) continue

        const key = `${aggregatedSource}-${aggregatedTarget}`
        if (!edgesToAggregate.has(key)) {
          edgesToAggregate.set(key, [])
        }
        edgesToAggregate.get(key)!.push(edge)

        // Hide the original edge
        edge.hidden = true
      }
    }

    // Also check existing aggregated edges that might need to be updated
    for (const [aggId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.hidden) continue

      const sourceInContainer = allDescendants.has(aggEdge.source)
      const targetInContainer = allDescendants.has(aggEdge.target)

      if (sourceInContainer || targetInContainer) {
        // This aggregated edge needs to be updated
        let newSource = aggEdge.source
        let newTarget = aggEdge.target

        if (sourceInContainer) {
          newSource = containerId
        }
        if (targetInContainer) {
          newTarget = containerId
        }

        // Skip self-loops
        if (newSource === newTarget) {
          aggEdge.hidden = true
          continue
        }

        const key = `${newSource}-${newTarget}`
        if (!edgesToAggregate.has(key)) {
          edgesToAggregate.set(key, [])
        }

        // Hide the old aggregated edge and add its original edges to be re-aggregated
        aggEdge.hidden = true
        for (const originalEdgeId of aggEdge.originalEdgeIds) {
          const originalEdge = this._edges.get(originalEdgeId)
          if (originalEdge) {
            edgesToAggregate.get(key)!.push(originalEdge)
          }
        }
      }
    }

    // Create new aggregated edges
    for (const [key, edges] of edgesToAggregate) {
      const [source, target] = key.split('-')
      const aggregatedEdgeId = `agg-${containerId}-${source}-${target}`
      
      // Check if this aggregated edge already exists
      const existingAggEdge = this._aggregatedEdges.get(aggregatedEdgeId)
      
      if (existingAggEdge && !existingAggEdge.hidden) {
        // Merge with existing aggregated edge
        const newOriginalIds = edges.map(e => e.id)
        existingAggEdge.originalEdgeIds.push(...newOriginalIds)
        existingAggEdge.semanticTags = [...new Set([...existingAggEdge.semanticTags, ...edges.flatMap(e => e.semanticTags)])]
      } else {
        // Create new aggregated edge
        const aggregatedEdge: AggregatedEdge = {
          id: aggregatedEdgeId,
          source,
          target,
          type: edges[0].type, // Use type from first edge
          semanticTags: [...new Set(edges.flatMap(e => e.semanticTags))], // Merge unique tags
          hidden: false,
          aggregated: true,
          originalEdgeIds: edges.map(e => e.id),
          aggregationSource: containerId
        }

        this._aggregatedEdges.set(aggregatedEdge.id, aggregatedEdge)
      }
    }
  }

  private _getAllDescendantIds(containerId: string): Set<string> {
    const descendants = new Set<string>()
    const container = this._containers.get(containerId)
    if (!container) return descendants

    for (const childId of container.children) {
      descendants.add(childId)
      
      // If child is a container, recursively get its descendants
      if (this._containers.has(childId)) {
        const childDescendants = this._getAllDescendantIds(childId)
        for (const descendant of childDescendants) {
          descendants.add(descendant)
        }
      }
    }

    return descendants
  }

  restoreEdgesForContainer(containerId: string): void {
    // Find aggregated edges that involve this container
    const aggregatedEdgesToRemove: string[] = []
    const edgesToRestore: string[] = []
    
    for (const [aggEdgeId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.source === containerId || aggEdge.target === containerId) {
        // This aggregated edge involves the container being expanded
        edgesToRestore.push(...aggEdge.originalEdgeIds)
        aggregatedEdgesToRemove.push(aggEdgeId)
      }
    }

    // Restore original edges
    for (const originalEdgeId of edgesToRestore) {
      const originalEdge = this._edges.get(originalEdgeId)
      if (originalEdge) {
        // Check if both endpoints are visible
        const sourceNode = this._nodes.get(originalEdge.source)
        const targetNode = this._nodes.get(originalEdge.target)
        const sourceContainer = this._containers.get(originalEdge.source)
        const targetContainer = this._containers.get(originalEdge.target)
        
        const sourceVisible = (sourceNode && !sourceNode.hidden) || (sourceContainer && !sourceContainer.hidden)
        const targetVisible = (targetNode && !targetNode.hidden) || (targetContainer && !targetContainer.hidden)
        
        if (sourceVisible && targetVisible) {
          originalEdge.hidden = false
        }
      }
    }

    // Remove aggregated edges
    for (const aggEdgeId of aggregatedEdgesToRemove) {
      this._aggregatedEdges.delete(aggEdgeId)
    }
  }

  getAggregatedEdges(): ReadonlyArray<AggregatedEdge> {
    return Array.from(this._aggregatedEdges.values()).filter(edge => !edge.hidden)
  }

  getOriginalEdges(): ReadonlyArray<GraphEdge> {
    return Array.from(this._edges.values())
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
    return Array.from(this._orphanedNodes)
  }

  getOrphanedContainers(): string[] {
    return Array.from(this._orphanedContainers)
  }

  cleanupOrphanedEntities(): void {
    // Remove orphaned nodes
    for (const nodeId of this._orphanedNodes) {
      this._nodes.delete(nodeId)
    }
    this._orphanedNodes.clear()
    
    // Remove orphaned containers
    for (const containerId of this._orphanedContainers) {
      this._containers.delete(containerId)
    }
    this._orphanedContainers.clear()
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