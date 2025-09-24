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
  InvariantViolation,
} from "../types/core.js";

export class VisualizationState {
  private _nodes = new Map<string, GraphNode>();
  private _edges = new Map<string, GraphEdge>();
  private _containers = new Map<string, Container>();
  private _aggregatedEdges = new Map<string, AggregatedEdge>();
  private _nodeContainerMap = new Map<string, string>();
  private _containerParentMap = new Map<string, string>();
  private _orphanedNodes = new Set<string>();
  private _orphanedContainers = new Set<string>();
  private _layoutState: LayoutState = {
    phase: "initial",
    layoutCount: 0,
    lastUpdate: Date.now(),
  };
  private _searchResults: SearchResult[] = [];
  private _searchQuery: string = '';
  private _searchHistory: string[] = [];
  private _searchState: {
    isActive: boolean;
    query: string;
    resultCount: number;
    lastSearchTime: number;
    expandedContainers: Set<string>; // Containers expanded due to search
  } = {
    isActive: false,
    query: '',
    resultCount: 0,
    lastSearchTime: 0,
    expandedContainers: new Set(),
  };
  private _validationEnabled = true;
  private _validationInProgress = false;

  // Data Management
  addNode(node: GraphNode): void {
    this._validateNodeData(node);
    this._nodes.set(node.id, { ...node });
    this.validateInvariants();
  }

  removeNode(id: string): void {
    this._nodes.delete(id);
    this._nodeContainerMap.delete(id);
    this.validateInvariants();
  }

  updateNode(id: string, node: GraphNode): void {
    if (!this._nodes.has(id)) {
      return; // Handle non-existent node gracefully
    }

    this._validateNodeData(node, false); // Skip id validation for updates
    this._nodes.set(id, { ...node });
    this.validateInvariants();
  }

  private _validateNodeData(node: GraphNode, validateId: boolean = true): void {
    if (!node) {
      throw new Error("Invalid node: node cannot be null or undefined");
    }
    if (validateId && (!node.id || node.id.trim() === "")) {
      throw new Error("Invalid node: id cannot be empty");
    }
    if (!node.label || node.label.trim() === "") {
      throw new Error("Invalid node: label cannot be empty");
    }
  }

  addEdge(edge: GraphEdge): void {
    this._validateEdgeData(edge);

    this._edges.set(edge.id, { ...edge });

    // Check if this edge needs to be aggregated due to collapsed containers
    this._handleEdgeAggregationOnAdd(edge.id);

    this.validateInvariants();
  }

  private _handleEdgeAggregationOnAdd(edgeId: string): void {
    const edge = this._edges.get(edgeId);
    if (!edge) return;

    // Find collapsed containers that contain the source or target
    for (const [containerId, container] of this._containers) {
      if (container.collapsed) {
        const descendants = this._getAllDescendantIds(containerId);
        if (descendants.has(edge.source) || descendants.has(edge.target)) {
          // This edge needs to be aggregated
          this.aggregateEdgesForContainer(containerId);
          break; // Only need to aggregate once
        }
      }
    }
  }

  removeEdge(id: string): void {
    this._edges.delete(id);
    this.validateInvariants();
  }

  updateEdge(id: string, edge: GraphEdge): void {
    if (!this._edges.has(id)) {
      return; // Handle non-existent edge gracefully
    }

    this._validateEdgeData(edge, false); // Skip id validation for updates
    this._edges.set(id, { ...edge });
    this.validateInvariants();
  }

  private _validateEdgeData(edge: GraphEdge, validateId: boolean = true): void {
    if (!edge) {
      throw new Error("Invalid edge: edge cannot be null or undefined");
    }
    if (validateId && (!edge.id || edge.id.trim() === "")) {
      throw new Error("Invalid edge: id cannot be empty");
    }
    if (!edge.source || edge.source.trim() === "") {
      throw new Error("Invalid edge: source cannot be empty");
    }
    if (!edge.target || edge.target.trim() === "") {
      throw new Error("Invalid edge: target cannot be empty");
    }
  }

  addContainer(container: Container): void {
    this._validateContainerData(container);
    this._updateContainerWithMappings(container);
    this.validateInvariants();
  }

  removeContainer(id: string): void {
    const container = this._containers.get(id);
    this._containers.delete(id);

    // Clean up mappings and track orphaned entities
    if (container) {
      for (const childId of container.children) {
        this._nodeContainerMap.delete(childId);
        this._containerParentMap.delete(childId);

        // Track orphaned entities
        if (this._nodes.has(childId)) {
          this._orphanedNodes.add(childId);
        }
        if (this._containers.has(childId)) {
          this._orphanedContainers.add(childId);
        }
      }
    }

    this.validateInvariants();
  }

  updateContainer(id: string, container: Container): void {
    if (!this._containers.has(id)) {
      return; // Handle non-existent container gracefully
    }

    this._validateContainerData(container, false); // Skip id validation for updates

    // Clean up old mappings
    const oldContainer = this._containers.get(id);
    if (oldContainer) {
      this._cleanupContainerMappings(oldContainer);
    }

    this._updateContainerWithMappings(container);
    this.validateInvariants();
  }

  private _validateContainerData(
    container: Container,
    validateId: boolean = true
  ): void {
    if (!container) {
      throw new Error(
        "Invalid container: container cannot be null or undefined"
      );
    }
    if (validateId && (!container.id || container.id.trim() === "")) {
      throw new Error("Invalid container: id cannot be empty");
    }
    if (!container.label || container.label.trim() === "") {
      throw new Error("Invalid container: label cannot be empty");
    }
  }

  private _updateContainerWithMappings(container: Container): void {
    // Check for circular dependencies before adding
    this._validateNoCircularDependencies(container);

    // If container already exists, clean up old mappings first
    const existingContainer = this._containers.get(container.id);
    if (existingContainer) {
      this._cleanupContainerMappings(existingContainer);
    }

    this._containers.set(container.id, {
      ...container,
      children: new Set(container.children),
      collapsed: container.collapsed ?? false,
      hidden: container.hidden ?? false,
    });

    // Update mappings for all children
    this._updateChildMappings(container);

    // Also update any existing containers that might now have this as a parent
    this._updateParentMappings();

    // If container is collapsed, ensure children are hidden
    if (container.collapsed) {
      this._hideContainerChildren(container.id);
      this.aggregateEdgesForContainer(container.id);
    }
  }

  private _hideContainerChildren(containerId: string): void {
    // Use the same logic as collapsing - hide all transitive descendants
    this._hideAllDescendants(containerId);
  }

  private _updateChildMappings(container: Container): void {
    for (const childId of container.children) {
      if (this._containers.has(childId)) {
        // Child is a container
        this._containerParentMap.set(childId, container.id);
      } else {
        // Child is a node (or will be a node when added later)
        this._nodeContainerMap.set(childId, container.id);
      }
    }
  }

  private _updateParentMappings(): void {
    // Go through all containers and update parent mappings
    for (const [containerId, container] of this._containers) {
      for (const childId of container.children) {
        if (this._containers.has(childId)) {
          this._containerParentMap.set(childId, containerId);
        }
      }
    }
  }

  private _cleanupContainerMappings(container: Container): void {
    for (const childId of container.children) {
      this._nodeContainerMap.delete(childId);
      this._containerParentMap.delete(childId);
    }
  }

  private _validateNoCircularDependencies(container: Container): void {
    // Check for self-reference
    if (container.children.has(container.id)) {
      throw new Error(
        `Circular dependency detected: Container ${container.id} cannot contain itself`
      );
    }

    // Check if this container is already referenced as a child by any existing container
    // If so, adding it would create a cycle
    for (const [existingId, existingContainer] of this._containers) {
      if (existingContainer.children.has(container.id)) {
        // container.id is already a child of existingId
        // Check if any of container's children are ancestors of existingId
        for (const childId of container.children) {
          if (this._isAncestorOf(childId, existingId)) {
            throw new Error(
              `Circular dependency detected: ${childId} is an ancestor of ${existingId}, which already has ${container.id} as a child`
            );
          }
        }
      }
    }

    // Check for circular dependencies through the hierarchy
    for (const childId of container.children) {
      // Check if childId already has container.id as a child (direct circular dependency)
      const existingChild = this._containers.get(childId);
      if (existingChild && existingChild.children.has(container.id)) {
        throw new Error(
          `Circular dependency detected: ${container.id} and ${childId} would reference each other`
        );
      }

      if (this._containers.has(childId)) {
        // Check if making childId a child of container.id would create a cycle
        // This happens if container.id is already a descendant of childId
        if (this._isDescendantOf(container.id, childId)) {
          throw new Error(
            `Circular dependency detected: Adding ${childId} to ${container.id} would create a cycle`
          );
        }

        // Check if childId is already an ancestor of container.id
        // This would create an indirect cycle: container.id -> ... -> childId -> ... -> container.id
        if (this._isAncestorOf(childId, container.id)) {
          throw new Error(
            `Circular dependency detected: ${childId} is already an ancestor of ${container.id}`
          );
        }
      }
    }
  }

  private _isAncestorOf(
    potentialAncestor: string,
    descendant: string
  ): boolean {
    let current = this.getContainerParent(descendant);
    while (current) {
      if (current === potentialAncestor) {
        return true;
      }
      current = this.getContainerParent(current);
    }
    return false;
  }

  private _isDescendantOf(
    potentialDescendant: string,
    ancestor: string
  ): boolean {
    const descendants = this.getContainerDescendants(ancestor);
    return descendants.includes(potentialDescendant);
  }

  // Container Operations
  expandContainer(id: string): void {
    this._expandContainerInternal(id);
    // User operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }

  private _showImmediateChildren(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    for (const childId of container.children) {
      const childNode = this._nodes.get(childId);
      const childContainer = this._containers.get(childId);

      if (childNode) {
        childNode.hidden = false;
      }
      if (childContainer) {
        childContainer.hidden = false;
        // Don't automatically expand child containers - they keep their collapsed state
        // Only show their contents if they are not collapsed
        if (!childContainer.collapsed) {
          this._showImmediateChildren(childId);
        }
      }
    }
  }

  collapseContainer(id: string): void {
    this._collapseContainerInternal(id);
    // User operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }

  private _hideAllDescendants(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    for (const childId of container.children) {
      const childNode = this._nodes.get(childId);
      const childContainer = this._containers.get(childId);

      if (childNode) {
        childNode.hidden = true;
      }
      if (childContainer) {
        childContainer.hidden = true;
        childContainer.collapsed = true;
        // Recursively hide descendants of child containers
        this._hideAllDescendants(childId);
      }
    }
  }

  expandAllContainers(): void {
    for (const container of this._containers.values()) {
      if (container.collapsed) {
        this._expandContainerInternal(container.id);
      }
    }
    // Bulk user operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }

  collapseAllContainers(): void {
    for (const container of this._containers.values()) {
      if (!container.collapsed) {
        this._collapseContainerInternal(container.id);
      }
    }
    // Bulk user operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }

  // Edge Aggregation Management
  aggregateEdgesForContainer(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    // Get all descendants of this container (including nested containers)
    const allDescendants = this._getAllDescendantIds(containerId);
    const edgesToAggregate = new Map<string, GraphEdge[]>(); // key: source-target, value: edges
    const aggregatedEdgesToUpdate: AggregatedEdge[] = [];

    // Find all edges that need to be aggregated
    for (const [edgeId, edge] of this._edges) {
      if (edge.hidden) continue;

      const sourceInContainer = allDescendants.has(edge.source);
      const targetInContainer = allDescendants.has(edge.target);

      if (sourceInContainer || targetInContainer) {
        // If both endpoints are in the container, just hide the edge (internal edge)
        if (sourceInContainer && targetInContainer) {
          edge.hidden = true;
          continue;
        }

        // Determine the aggregated source and target
        let aggregatedSource = edge.source;
        let aggregatedTarget = edge.target;

        // If source is in container, aggregate to container
        if (sourceInContainer) {
          aggregatedSource = containerId;
        }

        // If target is in container, aggregate to container
        if (targetInContainer) {
          aggregatedTarget = containerId;
        }

        // Skip self-loops to the container (shouldn't happen with the above logic)
        if (aggregatedSource === aggregatedTarget) {
          edge.hidden = true;
          continue;
        }

        const key = `${aggregatedSource}-${aggregatedTarget}`;
        if (!edgesToAggregate.has(key)) {
          edgesToAggregate.set(key, []);
        }
        edgesToAggregate.get(key)!.push(edge);

        // Hide the original edge
        edge.hidden = true;
      }
    }

    // Also check existing aggregated edges that might need to be updated
    for (const [aggId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.hidden) continue;

      const sourceInContainer = allDescendants.has(aggEdge.source);
      const targetInContainer = allDescendants.has(aggEdge.target);

      if (sourceInContainer || targetInContainer) {
        // This aggregated edge needs to be updated
        let newSource = aggEdge.source;
        let newTarget = aggEdge.target;

        if (sourceInContainer) {
          newSource = containerId;
        }
        if (targetInContainer) {
          newTarget = containerId;
        }

        // Skip self-loops
        if (newSource === newTarget) {
          aggEdge.hidden = true;
          continue;
        }

        const key = `${newSource}-${newTarget}`;
        if (!edgesToAggregate.has(key)) {
          edgesToAggregate.set(key, []);
        }

        // Hide the old aggregated edge and add its original edges to be re-aggregated
        aggEdge.hidden = true;
        for (const originalEdgeId of aggEdge.originalEdgeIds) {
          const originalEdge = this._edges.get(originalEdgeId);
          if (originalEdge) {
            edgesToAggregate.get(key)!.push(originalEdge);
          }
        }
      }
    }

    // Create new aggregated edges
    for (const [key, edges] of edgesToAggregate) {
      const [source, target] = key.split("-");
      const aggregatedEdgeId = `agg-${containerId}-${source}-${target}`;

      // Check if this aggregated edge already exists
      const existingAggEdge = this._aggregatedEdges.get(aggregatedEdgeId);

      if (existingAggEdge && !existingAggEdge.hidden) {
        // Merge with existing aggregated edge
        const newOriginalIds = edges.map((e) => e.id);
        existingAggEdge.originalEdgeIds.push(...newOriginalIds);
        existingAggEdge.semanticTags = [
          ...new Set([
            ...existingAggEdge.semanticTags,
            ...edges.flatMap((e) => e.semanticTags),
          ]),
        ];
      } else {
        // Create new aggregated edge
        const aggregatedEdge: AggregatedEdge = {
          id: aggregatedEdgeId,
          source,
          target,
          type: edges[0].type, // Use type from first edge
          semanticTags: [...new Set(edges.flatMap((e) => e.semanticTags))], // Merge unique tags
          hidden: false,
          aggregated: true,
          originalEdgeIds: edges.map((e) => e.id),
          aggregationSource: containerId,
        };

        this._aggregatedEdges.set(aggregatedEdge.id, aggregatedEdge);

        // Update tracking structures
        this._aggregatedToOriginalMap.set(
          aggregatedEdge.id,
          aggregatedEdge.originalEdgeIds
        );
        for (const originalId of aggregatedEdge.originalEdgeIds) {
          this._originalToAggregatedMap.set(originalId, aggregatedEdge.id);
        }

        // Update container aggregation map
        if (!this._containerAggregationMap.has(containerId)) {
          this._containerAggregationMap.set(containerId, []);
        }
        this._containerAggregationMap.get(containerId)!.push(aggregatedEdge.id);
      }
    }

    // Record aggregation history
    const edgeCount = Array.from(edgesToAggregate.values()).reduce(
      (sum, edges) => sum + edges.length,
      0
    );
    if (edgeCount > 0) {
      this._aggregationHistory.push({
        operation: "aggregate",
        containerId,
        edgeCount,
        timestamp: Date.now(),
      });
    }
  }

  private _getAllDescendantIds(containerId: string): Set<string> {
    const descendants = new Set<string>();
    const container = this._containers.get(containerId);
    if (!container) return descendants;

    for (const childId of container.children) {
      descendants.add(childId);

      // If child is a container, recursively get its descendants
      if (this._containers.has(childId)) {
        const childDescendants = this._getAllDescendantIds(childId);
        for (const descendant of childDescendants) {
          descendants.add(descendant);
        }
      }
    }

    return descendants;
  }

  restoreEdgesForContainer(containerId: string): void {
    // Get all descendants of this container
    const allDescendants = this._getAllDescendantIds(containerId);

    // Find aggregated edges that involve this container
    const aggregatedEdgesToRemove: string[] = [];
    const edgesToRestore: string[] = [];

    for (const [aggEdgeId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.source === containerId || aggEdge.target === containerId) {
        // This aggregated edge involves the container being expanded
        edgesToRestore.push(...aggEdge.originalEdgeIds);
        aggregatedEdgesToRemove.push(aggEdgeId);
      }
    }

    // Also restore internal edges that were simply hidden
    for (const [edgeId, edge] of this._edges) {
      if (edge.hidden) {
        const sourceInContainer = allDescendants.has(edge.source);
        const targetInContainer = allDescendants.has(edge.target);

        // If this edge was hidden due to this container being collapsed
        if (sourceInContainer || targetInContainer) {
          edgesToRestore.push(edgeId);
        }
      }
    }

    // Restore original edges
    for (const originalEdgeId of edgesToRestore) {
      const originalEdge = this._edges.get(originalEdgeId);
      if (originalEdge) {
        // Check if both endpoints are visible
        const sourceNode = this._nodes.get(originalEdge.source);
        const targetNode = this._nodes.get(originalEdge.target);
        const sourceContainer = this._containers.get(originalEdge.source);
        const targetContainer = this._containers.get(originalEdge.target);

        const sourceVisible =
          (sourceNode && !sourceNode.hidden) ||
          (sourceContainer && !sourceContainer.hidden);
        const targetVisible =
          (targetNode && !targetNode.hidden) ||
          (targetContainer && !targetContainer.hidden);

        if (sourceVisible && targetVisible) {
          originalEdge.hidden = false;
        } else {
          // If endpoints are still hidden due to other collapsed containers,
          // we need to re-aggregate this edge to the appropriate container
          this._reAggregateEdgeIfNeeded(originalEdge);
        }
      }
    }

    // Remove aggregated edges and update tracking structures
    for (const aggEdgeId of aggregatedEdgesToRemove) {
      const aggEdge = this._aggregatedEdges.get(aggEdgeId);
      if (aggEdge) {
        // Remove from tracking maps
        this._aggregatedToOriginalMap.delete(aggEdgeId);
        for (const originalId of aggEdge.originalEdgeIds) {
          this._originalToAggregatedMap.delete(originalId);
        }
      }
      this._aggregatedEdges.delete(aggEdgeId);
    }

    // Update container aggregation map
    const containerAggregations =
      this._containerAggregationMap.get(containerId) || [];
    const updatedAggregations = containerAggregations.filter(
      (id) => !aggregatedEdgesToRemove.includes(id)
    );
    if (updatedAggregations.length === 0) {
      this._containerAggregationMap.delete(containerId);
    } else {
      this._containerAggregationMap.set(containerId, updatedAggregations);
    }

    // Record restoration history
    if (edgesToRestore.length > 0) {
      this._aggregationHistory.push({
        operation: "restore",
        containerId,
        edgeCount: edgesToRestore.length,
        timestamp: Date.now(),
      });
    }
  }

  private _reAggregateEdgeIfNeeded(edge: GraphEdge): void {
    // Find the smallest collapsed container that contains the source or target
    let sourceContainer: string | undefined;
    let targetContainer: string | undefined;

    // Check if source is in a collapsed container
    const sourceNode = this._nodes.get(edge.source);
    if (sourceNode && sourceNode.hidden) {
      sourceContainer = this._findSmallestCollapsedContainerForNode(
        edge.source
      );
    }

    // Check if target is in a collapsed container
    const targetNode = this._nodes.get(edge.target);
    if (targetNode && targetNode.hidden) {
      targetContainer = this._findSmallestCollapsedContainerForNode(
        edge.target
      );
    }

    // If either endpoint needs aggregation, create aggregated edge
    if (sourceContainer || targetContainer) {
      const aggregatedSource = sourceContainer || edge.source;
      const aggregatedTarget = targetContainer || edge.target;

      // Skip self-loops
      if (aggregatedSource === aggregatedTarget) {
        edge.hidden = true;
        return;
      }

      // Create or update aggregated edge
      const key = `${aggregatedSource}-${aggregatedTarget}`;
      const aggregatedEdgeId = `agg-${sourceContainer || targetContainer}-${aggregatedSource}-${aggregatedTarget}`;

      let existingAggEdge = this._aggregatedEdges.get(aggregatedEdgeId);
      if (existingAggEdge) {
        // Add to existing aggregated edge
        if (!existingAggEdge.originalEdgeIds.includes(edge.id)) {
          existingAggEdge.originalEdgeIds.push(edge.id);
        }
      } else {
        // Create new aggregated edge
        const aggregatedEdge = {
          id: aggregatedEdgeId,
          source: aggregatedSource,
          target: aggregatedTarget,
          type: edge.type,
          semanticTags: [...edge.semanticTags],
          hidden: false,
          aggregated: true as const,
          originalEdgeIds: [edge.id],
          aggregationSource: sourceContainer || targetContainer || "",
        };

        this._aggregatedEdges.set(aggregatedEdge.id, aggregatedEdge);

        // Update tracking structures
        this._aggregatedToOriginalMap.set(aggregatedEdge.id, [edge.id]);
        this._originalToAggregatedMap.set(edge.id, aggregatedEdge.id);

        const containerForTracking = sourceContainer || targetContainer;
        if (containerForTracking) {
          if (!this._containerAggregationMap.has(containerForTracking)) {
            this._containerAggregationMap.set(containerForTracking, []);
          }
          this._containerAggregationMap
            .get(containerForTracking)!
            .push(aggregatedEdge.id);
        }
      }

      edge.hidden = true;
    }
  }

  private _findSmallestCollapsedContainerForNode(
    nodeId: string
  ): string | undefined {
    let currentContainer = this._nodeContainerMap.get(nodeId);

    while (currentContainer) {
      const container = this._containers.get(currentContainer);
      if (container && container.collapsed) {
        return currentContainer;
      }
      currentContainer = this._containerParentMap.get(currentContainer);
    }

    return undefined;
  }

  getAggregatedEdges(): ReadonlyArray<AggregatedEdge> {
    return Array.from(this._aggregatedEdges.values()).filter(
      (edge) => !edge.hidden
    );
  }

  getOriginalEdges(): ReadonlyArray<GraphEdge> {
    return Array.from(this._edges.values());
  }

  // Read-only Access
  get visibleNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._nodes.values()).filter((node) => !node.hidden);
  }

  get visibleEdges(): ReadonlyArray<GraphEdge | AggregatedEdge> {
    const regularEdges = Array.from(this._edges.values()).filter(
      (edge) => !edge.hidden
    );
    const aggregatedEdges = Array.from(this._aggregatedEdges.values()).filter(
      (edge) => !edge.hidden
    );
    return [...regularEdges, ...aggregatedEdges];
  }

  get visibleContainers(): ReadonlyArray<Container> {
    return Array.from(this._containers.values()).filter(
      (container) => !container.hidden
    );
  }

  // Getters for validation and external access
  getGraphNode(id: string): GraphNode | undefined {
    return this._nodes.get(id);
  }

  getGraphEdge(id: string): GraphEdge | undefined {
    return this._edges.get(id);
  }

  getContainer(id: string): Container | undefined {
    return this._containers.get(id);
  }

  getNodeContainer(nodeId: string): string | undefined {
    return this._nodeContainerMap.get(nodeId);
  }

  getContainerChildren(containerId: string): Set<string> {
    return this._containers.get(containerId)?.children || new Set();
  }

  // Container Hierarchy Methods
  getContainerParent(containerId: string): string | undefined {
    return this._containerParentMap.get(containerId);
  }

  getContainerAncestors(containerId: string): string[] {
    const ancestors: string[] = [];
    let current = this.getContainerParent(containerId);

    while (current) {
      ancestors.push(current);
      current = this.getContainerParent(current);
    }

    return ancestors;
  }

  getContainerDescendants(containerId: string): string[] {
    const descendants: string[] = [];
    const children = this.getContainerChildren(containerId);

    for (const childId of children) {
      if (this._containers.has(childId)) {
        descendants.push(childId);
        descendants.push(...this.getContainerDescendants(childId));
      }
    }

    return descendants;
  }

  getContainerNodes(containerId: string): Set<string> {
    const container = this._containers.get(containerId);
    if (!container) return new Set();

    const nodes = new Set<string>();
    for (const childId of container.children) {
      if (this._nodes.has(childId)) {
        nodes.add(childId);
      }
    }

    return nodes;
  }

  getAllNodesInHierarchy(containerId: string): Set<string> {
    const allNodes = new Set<string>();
    const container = this._containers.get(containerId);
    if (!container) return allNodes;

    for (const childId of container.children) {
      if (this._nodes.has(childId)) {
        allNodes.add(childId);
      } else if (this._containers.has(childId)) {
        const childNodes = this.getAllNodesInHierarchy(childId);
        for (const nodeId of childNodes) {
          allNodes.add(nodeId);
        }
      }
    }

    return allNodes;
  }

  getOrphanedNodes(): string[] {
    return Array.from(this._orphanedNodes);
  }

  getOrphanedContainers(): string[] {
    return Array.from(this._orphanedContainers);
  }

  cleanupOrphanedEntities(): void {
    // Remove orphaned nodes
    for (const nodeId of this._orphanedNodes) {
      this._nodes.delete(nodeId);
    }
    this._orphanedNodes.clear();

    // Remove orphaned containers
    for (const containerId of this._orphanedContainers) {
      this._containers.delete(containerId);
    }
    this._orphanedContainers.clear();
  }

  moveNodeToContainer(nodeId: string, targetContainerId: string): void {
    // Remove from current container
    const currentContainerId = this.getNodeContainer(nodeId);
    if (currentContainerId) {
      const currentContainer = this._containers.get(currentContainerId);
      if (currentContainer) {
        currentContainer.children.delete(nodeId);
      }
    }

    // Add to target container
    const targetContainer = this._containers.get(targetContainerId);
    if (targetContainer) {
      targetContainer.children.add(nodeId);
      this._nodeContainerMap.set(nodeId, targetContainerId);
    }

    this.validateInvariants();
  }

  // Layout State
  getLayoutState(): LayoutState {
    return { ...this._layoutState };
  }

  setLayoutPhase(phase: LayoutState["phase"]): void {
    this._layoutState.phase = phase;
    this._layoutState.lastUpdate = Date.now();
  }

  incrementLayoutCount(): void {
    this._layoutState.layoutCount++;
  }

  isFirstLayout(): boolean {
    return this._layoutState.layoutCount === 0;
  }

  setLayoutError(error: string): void {
    this._layoutState.error = error;
    this._layoutState.phase = "error";
    this._layoutState.lastUpdate = Date.now();
  }

  clearLayoutError(): void {
    this._layoutState.error = undefined;
    this._layoutState.lastUpdate = Date.now();
  }

  recoverFromLayoutError(): void {
    this._layoutState.error = undefined;
    this._layoutState.phase = "initial";
    this._layoutState.lastUpdate = Date.now();
  }

  resetLayoutState(): void {
    this._layoutState = {
      phase: "initial",
      layoutCount: 0,
      lastUpdate: Date.now(),
    };
  }

  // Smart Collapse Management
  private _smartCollapseEnabled = true;
  private _smartCollapseOverride = false;

  shouldRunSmartCollapse(): boolean {
    if (this._smartCollapseOverride) {
      this._smartCollapseOverride = false; // Reset after checking
      return true;
    }
    return this._smartCollapseEnabled && this.isFirstLayout();
  }

  enableSmartCollapseForNextLayout(): void {
    this._smartCollapseOverride = true;
  }

  disableSmartCollapseForUserOperations(): void {
    this._smartCollapseEnabled = false;
  }

  resetSmartCollapseState(): void {
    this._smartCollapseEnabled = true;
    this._smartCollapseOverride = false;
  }

  getSmartCollapseStatus(): {
    enabled: boolean;
    isFirstLayout: boolean;
    hasOverride: boolean;
  } {
    return {
      enabled: this._smartCollapseEnabled,
      isFirstLayout: this.isFirstLayout(),
      hasOverride: this._smartCollapseOverride,
    };
  }

  // Search-specific container expansion
  expandContainerForSearch(id: string): void {
    this._expandContainerInternal(id);
    // Track containers expanded for search
    this._searchState.expandedContainers.add(id);
    // Search expansion should disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }

  // System vs User operation tracking
  collapseContainerSystemOperation(id: string): void {
    this._collapseContainerInternal(id);
    // Note: System operations don't disable smart collapse
  }

  // Toggle container (user operation)
  toggleContainer(id: string): void {
    const container = this._containers.get(id);
    if (!container) return;

    if (container.collapsed) {
      this.expandContainer(id);
    } else {
      this.collapseContainer(id);
    }
  }

  // Internal methods for container operations
  private _expandContainerInternal(id: string): void {
    const container = this._containers.get(id);
    if (!container) return;

    container.collapsed = false;
    container.hidden = false;
    this._showImmediateChildren(id);
    this.restoreEdgesForContainer(id);
    this.validateInvariants();
  }

  private _collapseContainerInternal(id: string): void {
    const container = this._containers.get(id);
    if (!container) return;

    container.collapsed = true;
    this._hideAllDescendants(id);
    this.aggregateEdgesForContainer(id);
    this.validateInvariants();
  }

  // Edge Aggregation Tracking and Lookup Methods
  private _originalToAggregatedMap = new Map<string, string>();
  private _aggregatedToOriginalMap = new Map<string, string[]>();
  private _containerAggregationMap = new Map<string, string[]>();
  private _aggregationHistory: Array<{
    operation: "aggregate" | "restore";
    containerId: string;
    edgeCount: number;
    timestamp: number;
  }> = [];

  getOriginalToAggregatedMapping(): ReadonlyMap<string, string> {
    return new Map(this._originalToAggregatedMap);
  }

  getAggregatedToOriginalMapping(): ReadonlyMap<string, string[]> {
    return new Map(this._aggregatedToOriginalMap);
  }

  getAggregationMetadata(): {
    totalOriginalEdges: number;
    totalAggregatedEdges: number;
    aggregationsByContainer: ReadonlyMap<string, number>;
  } {
    const aggregationsByContainer = new Map<string, number>();
    for (const [containerId, aggEdgeIds] of this._containerAggregationMap) {
      aggregationsByContainer.set(containerId, aggEdgeIds.length);
    }

    return {
      totalOriginalEdges: this._edges.size,
      totalAggregatedEdges: this._aggregatedEdges.size,
      aggregationsByContainer,
    };
  }

  getAggregatedEdgesByContainer(
    containerId: string
  ): ReadonlyArray<AggregatedEdge> {
    const edgeIds = this._containerAggregationMap.get(containerId) || [];
    return edgeIds
      .map((id) => this._aggregatedEdges.get(id))
      .filter(
        (edge): edge is AggregatedEdge => edge !== undefined && !edge.hidden
      );
  }

  getOriginalEdgesForAggregated(
    aggregatedEdgeId: string
  ): ReadonlyArray<GraphEdge> {
    const originalIds =
      this._aggregatedToOriginalMap.get(aggregatedEdgeId) || [];
    return originalIds
      .map((id) => this._edges.get(id))
      .filter((edge): edge is GraphEdge => edge !== undefined);
  }

  getAggregatedEdgesAffectingNode(
    nodeId: string
  ): ReadonlyArray<AggregatedEdge> {
    return Array.from(this._aggregatedEdges.values()).filter(
      (edge) =>
        !edge.hidden && (edge.source === nodeId || edge.target === nodeId)
    );
  }

  getAggregationHistory(): ReadonlyArray<{
    operation: "aggregate" | "restore";
    containerId: string;
    edgeCount: number;
    timestamp: number;
  }> {
    return [...this._aggregationHistory];
  }

  getAggregationStatistics(): {
    totalAggregations: number;
    activeAggregations: number;
    edgeReductionRatio: number;
    containerAggregationCounts: ReadonlyMap<string, number>;
  } {
    const containerCounts = new Map<string, number>();
    let activeAggregations = 0;

    for (const [containerId, aggEdgeIds] of this._containerAggregationMap) {
      const activeCount = aggEdgeIds.filter((id) => {
        const edge = this._aggregatedEdges.get(id);
        return edge && !edge.hidden;
      }).length;

      if (activeCount > 0) {
        containerCounts.set(containerId, activeCount);
        activeAggregations += activeCount;
      }
    }

    const totalOriginalEdges = this._edges.size;
    const visibleOriginalEdges = Array.from(this._edges.values()).filter(
      (e) => !e.hidden
    ).length;
    const totalVisibleEdges = visibleOriginalEdges + activeAggregations;
    const edgeReductionRatio =
      totalOriginalEdges > 0
        ? (totalOriginalEdges - totalVisibleEdges) / totalOriginalEdges
        : 0;

    return {
      totalAggregations: this._aggregationHistory.length,
      activeAggregations,
      edgeReductionRatio,
      containerAggregationCounts: containerCounts,
    };
  }

  validateAggregationConsistency(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check that all aggregated edges have valid original edges
    for (const [aggId, aggEdge] of this._aggregatedEdges) {
      const originalIds = this._aggregatedToOriginalMap.get(aggId);
      if (!originalIds || originalIds.length === 0) {
        errors.push(`Aggregated edge ${aggId} has no original edges`);
        continue;
      }

      for (const originalId of originalIds) {
        const originalEdge = this._edges.get(originalId);
        if (!originalEdge) {
          errors.push(
            `Aggregated edge ${aggId} references non-existent original edge ${originalId}`
          );
        }
      }
    }

    // Check that all original-to-aggregated mappings are valid
    for (const [originalId, aggId] of this._originalToAggregatedMap) {
      const aggEdge = this._aggregatedEdges.get(aggId);
      if (!aggEdge) {
        errors.push(
          `Original edge ${originalId} maps to non-existent aggregated edge ${aggId}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  corruptAggregationForTesting(): void {
    // Only for testing - corrupt the aggregation state
    if (this._aggregatedEdges.size > 0) {
      const firstAggId = Array.from(this._aggregatedEdges.keys())[0];
      this._aggregatedToOriginalMap.set(firstAggId, ["non-existent-edge"]);
    }
  }

  // Graph Element Interactions
  toggleNodeLabel(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) return;

    node.showingLongLabel = !node.showingLongLabel;
  }

  setNodeLabelState(nodeId: string, showLongLabel: boolean): void {
    const node = this._nodes.get(nodeId);
    if (!node) return;

    node.showingLongLabel = showLongLabel;
  }

  getNodesShowingLongLabels(): ReadonlyArray<GraphNode> {
    return Array.from(this._nodes.values()).filter(
      (node) => node.showingLongLabel
    );
  }

  getInteractionStateSummary(): {
    nodesWithLongLabels: number;
    collapsedContainers: number;
    expandedContainers: number;
  } {
    const nodesWithLongLabels = Array.from(this._nodes.values()).filter(
      (node) => node.showingLongLabel
    ).length;

    const collapsedContainers = Array.from(this._containers.values()).filter(
      (container) => container.collapsed
    ).length;

    const expandedContainers = Array.from(this._containers.values()).filter(
      (container) => !container.collapsed
    ).length;

    return {
      nodesWithLongLabels,
      collapsedContainers,
      expandedContainers,
    };
  }

  resetAllNodeLabelsToShort(): void {
    for (const node of this._nodes.values()) {
      node.showingLongLabel = false;
    }
  }

  expandAllNodeLabelsToLong(): void {
    for (const node of this._nodes.values()) {
      node.showingLongLabel = true;
    }
  }

  validateInteractionState(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for nodes showing long labels without having long labels
    for (const [nodeId, node] of this._nodes) {
      if (node.showingLongLabel && !node.longLabel) {
        errors.push(
          `Node ${nodeId} is showing long label but has no longLabel property`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Search
  search(query: string): SearchResult[] {
    // Update search state
    this._searchQuery = query.trim();
    this._searchState.isActive = this._searchQuery.length > 0;
    this._searchState.query = this._searchQuery;
    this._searchState.lastSearchTime = Date.now();
    
    // Add to search history if not empty
    if (this._searchQuery) {
      // Remove existing entry if present
      const existingIndex = this._searchHistory.indexOf(this._searchQuery);
      if (existingIndex !== -1) {
        this._searchHistory.splice(existingIndex, 1);
      }
      // Add to front
      this._searchHistory.unshift(this._searchQuery);
      // Keep only last 10 searches
      if (this._searchHistory.length > 10) {
        this._searchHistory = this._searchHistory.slice(0, 10);
      }
    }

    this._searchResults = [];

    if (!this._searchQuery) {
      this._searchState.resultCount = 0;
      return this._searchResults;
    }

    const queryLower = this._searchQuery.toLowerCase();

    // Search nodes - prioritize exact matches
    for (const node of this._nodes.values()) {
      const matchResult = this._findMatches(node.label, queryLower);
      if (matchResult.matches) {
        this._searchResults.push({
          id: node.id,
          label: node.label,
          type: "node",
          matchIndices: matchResult.indices,
        });
      }
    }

    // Search containers - prioritize exact matches
    for (const container of this._containers.values()) {
      const matchResult = this._findMatches(container.label, queryLower);
      if (matchResult.matches) {
        this._searchResults.push({
          id: container.id,
          label: container.label,
          type: "container",
          matchIndices: matchResult.indices,
        });
      }
    }

    // Sort results by relevance (exact matches first, then by match position)
    this._searchResults.sort((a, b) => {
      const aExact = a.label.toLowerCase() === queryLower;
      const bExact = b.label.toLowerCase() === queryLower;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Sort by first match position
      const aFirstMatch = a.matchIndices[0]?.[0] ?? Infinity;
      const bFirstMatch = b.matchIndices[0]?.[0] ?? Infinity;
      
      return aFirstMatch - bFirstMatch;
    });

    this._searchState.resultCount = this._searchResults.length;
    return [...this._searchResults];
  }

  private _findMatches(text: string, query: string): { matches: boolean; indices: number[][]; isExact: boolean } {
    const textLower = text.toLowerCase();
    const indices: number[][] = [];
    
    // Exact substring match
    let startIndex = 0;
    while (true) {
      const index = textLower.indexOf(query, startIndex);
      if (index === -1) break;
      indices.push([index, index + query.length]);
      startIndex = index + 1;
    }
    
    if (indices.length > 0) {
      return { matches: true, indices, isExact: true };
    }
    
    // Only do fuzzy matching for queries longer than 3 characters to avoid too many false positives
    if (query.length <= 3) {
      return { matches: false, indices: [], isExact: false };
    }
    
    // Fuzzy matching - check if all characters of query appear in order
    let queryIndex = 0;
    const fuzzyIndices: number[] = [];
    
    for (let i = 0; i < textLower.length && queryIndex < query.length; i++) {
      if (textLower[i] === query[queryIndex]) {
        fuzzyIndices.push(i);
        queryIndex++;
      }
    }
    
    if (queryIndex === query.length) {
      // All characters found - create match indices for individual characters
      const charIndices: number[][] = fuzzyIndices.map(i => [i, i + 1]);
      return { matches: true, indices: charIndices, isExact: false };
    }
    
    return { matches: false, indices: [], isExact: false };
  }

  clearSearch(): void {
    this._searchResults = [];
    this._searchQuery = '';
    this._searchState.isActive = false;
    this._searchState.query = '';
    this._searchState.resultCount = 0;
    this._searchState.expandedContainers.clear();
  }

  // Search state getters
  getSearchQuery(): string {
    return this._searchQuery;
  }

  getSearchResults(): ReadonlyArray<SearchResult> {
    return [...this._searchResults];
  }

  getSearchHistory(): ReadonlyArray<string> {
    return [...this._searchHistory];
  }

  isSearchActive(): boolean {
    return this._searchState.isActive;
  }

  getSearchResultCount(): number {
    return this._searchState.resultCount;
  }

  getSearchExpandedContainers(): ReadonlyArray<string> {
    return Array.from(this._searchState.expandedContainers);
  }

  clearSearchHistory(): void {
    this._searchHistory = [];
  }

  // Advanced search methods
  searchByType(query: string, entityType: 'node' | 'container'): SearchResult[] {
    const allResults = this.search(query);
    return allResults.filter(result => result.type === entityType);
  }

  searchBySemanticTag(tag: string): SearchResult[] {
    this._searchResults = [];
    
    // Search nodes by semantic tags
    for (const node of this._nodes.values()) {
      if (node.semanticTags.some(nodeTag => 
        nodeTag.toLowerCase().includes(tag.toLowerCase())
      )) {
        this._searchResults.push({
          id: node.id,
          label: node.label,
          type: "node",
          matchIndices: [[0, 0]], // No text highlighting for semantic tag matches
        });
      }
    }

    // Search edges by semantic tags (return connected nodes)
    for (const edge of this._edges.values()) {
      if (edge.semanticTags.some(edgeTag => 
        edgeTag.toLowerCase().includes(tag.toLowerCase())
      )) {
        // Add source and target nodes if not already in results
        const sourceNode = this._nodes.get(edge.source);
        const targetNode = this._nodes.get(edge.target);
        
        if (sourceNode && !this._searchResults.some(r => r.id === sourceNode.id)) {
          this._searchResults.push({
            id: sourceNode.id,
            label: sourceNode.label,
            type: "node",
            matchIndices: [[0, 0]],
          });
        }
        
        if (targetNode && !this._searchResults.some(r => r.id === targetNode.id)) {
          this._searchResults.push({
            id: targetNode.id,
            label: targetNode.label,
            type: "node",
            matchIndices: [[0, 0]],
          });
        }
      }
    }

    this._searchState.resultCount = this._searchResults.length;
    return [...this._searchResults];
  }

  // Get search suggestions based on existing labels
  getSearchSuggestions(partialQuery: string, limit: number = 5): string[] {
    if (!partialQuery.trim()) return [];
    
    const queryLower = partialQuery.toLowerCase();
    const suggestions = new Set<string>();
    
    // Collect suggestions from node labels
    for (const node of this._nodes.values()) {
      if (node.label.toLowerCase().includes(queryLower)) {
        suggestions.add(node.label);
      }
    }
    
    // Collect suggestions from container labels
    for (const container of this._containers.values()) {
      if (container.label.toLowerCase().includes(queryLower)) {
        suggestions.add(container.label);
      }
    }
    
    // Add from search history
    for (const historyItem of this._searchHistory) {
      if (historyItem.toLowerCase().includes(queryLower)) {
        suggestions.add(historyItem);
      }
    }
    
    return Array.from(suggestions).slice(0, limit);
  }

  // Validation - Extracted invariants from main branch
  validateInvariants(): void {
    if (!this._validationEnabled || this._validationInProgress) {
      return;
    }

    this._validationInProgress = true;

    try {
      const violations: InvariantViolation[] = [];

      // Container State Invariants
      violations.push(...this.validateContainerStates());
      violations.push(...this.validateContainerHierarchy());

      // Node State Invariants
      violations.push(...this.validateNodeContainerRelationships());

      // Edge Invariants
      violations.push(...this.validateEdgeNodeConsistency());
      violations.push(...this.validateNoEdgesToHiddenEntities());

      // Layout Invariants
      violations.push(...this.validateCollapsedContainerDimensions());

      this.reportViolations(violations);
    } finally {
      this._validationInProgress = false;
    }
  }

  private validateContainerStates(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [containerId, container] of this._containers) {
      // Illegal Expanded/Hidden state
      if (!container.collapsed && container.hidden) {
        violations.push({
          type: "ILLEGAL_CONTAINER_STATE",
          message: `Container ${containerId} is in illegal Expanded/Hidden state`,
          entityId: containerId,
          severity: "error",
        });
      }
    }

    return violations;
  }

  private validateContainerHierarchy(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [containerId, container] of this._containers) {
      if (container.collapsed) {
        this.validateDescendantsCollapsed(containerId, violations);
      }
      if (!container.hidden) {
        this.validateAncestorsVisible(containerId, violations);
      }
    }

    return violations;
  }

  private validateDescendantsCollapsed(
    containerId: string,
    violations: InvariantViolation[]
  ): void {
    const children = this.getContainerChildren(containerId);

    for (const childId of children) {
      const childContainer = this.getContainer(childId);
      if (childContainer) {
        if (!childContainer.collapsed) {
          violations.push({
            type: "DESCENDANT_NOT_COLLAPSED",
            message: `Container ${childId} should be collapsed because ancestor ${containerId} is collapsed`,
            entityId: childId,
            severity: "error",
          });
        }
        if (!childContainer.hidden) {
          violations.push({
            type: "DESCENDANT_NOT_HIDDEN",
            message: `Container ${childId} should be hidden because ancestor ${containerId} is collapsed`,
            entityId: childId,
            severity: "error",
          });
        }
      } else {
        const childNode = this.getGraphNode(childId);
        if (childNode && !childNode.hidden) {
          violations.push({
            type: "DESCENDANT_NODE_NOT_HIDDEN",
            message: `Node ${childId} should be hidden because container ${containerId} is collapsed`,
            entityId: childId,
            severity: "error",
          });
        }
      }
    }
  }

  private validateAncestorsVisible(
    containerId: string,
    violations: InvariantViolation[]
  ): void {
    let current = this.getNodeContainer(containerId);

    while (current) {
      const ancestorContainer = this.getContainer(current);
      if (ancestorContainer && ancestorContainer.hidden) {
        violations.push({
          type: "ANCESTOR_NOT_VISIBLE",
          message: `Container ${containerId} is visible but ancestor ${current} is hidden`,
          entityId: containerId,
          severity: "error",
        });
      }
      current = this.getNodeContainer(current);
    }
  }

  private validateNodeContainerRelationships(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [nodeId, node] of this._nodes) {
      const containerName = this.getNodeContainer(nodeId);

      if (containerName) {
        const container = this.getContainer(containerName);

        if (container && container.collapsed && !node.hidden) {
          violations.push({
            type: "NODE_NOT_HIDDEN_IN_COLLAPSED_CONTAINER",
            message: `Node ${nodeId} should be hidden because it belongs to collapsed container ${containerName}`,
            entityId: nodeId,
            severity: "error",
          });
        }
      }
    }

    return violations;
  }

  private validateEdgeNodeConsistency(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [edgeId, edge] of this._edges) {
      const sourceExists =
        this.getGraphNode(edge.source) || this.getContainer(edge.source);
      const targetExists =
        this.getGraphNode(edge.target) || this.getContainer(edge.target);

      if (!sourceExists) {
        violations.push({
          type: "EDGE_INVALID_SOURCE",
          message: `Edge ${edgeId} references non-existent source ${edge.source}`,
          entityId: edgeId,
          severity: "error",
        });
      }

      if (!targetExists) {
        violations.push({
          type: "EDGE_INVALID_TARGET",
          message: `Edge ${edgeId} references non-existent target ${edge.target}`,
          entityId: edgeId,
          severity: "error",
        });
      }
    }

    return violations;
  }

  private validateNoEdgesToHiddenEntities(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const edge of this._edges.values()) {
      if (edge.hidden) continue;

      const sourceContainer = this.getContainer(edge.source);
      const targetContainer = this.getContainer(edge.target);
      const sourceNode = this.getGraphNode(edge.source);
      const targetNode = this.getGraphNode(edge.target);

      const sourceHidden = sourceContainer?.hidden || sourceNode?.hidden;
      const targetHidden = targetContainer?.hidden || targetNode?.hidden;

      if (sourceHidden) {
        violations.push({
          type: "EDGE_TO_HIDDEN_SOURCE",
          message: `Visible edge ${edge.id} references hidden source ${edge.source}`,
          entityId: edge.id,
          severity: "error",
        });
      }

      if (targetHidden) {
        violations.push({
          type: "EDGE_TO_HIDDEN_TARGET",
          message: `Visible edge ${edge.id} references hidden target ${edge.target}`,
          entityId: edge.id,
          severity: "error",
        });
      }
    }

    return violations;
  }

  private validateCollapsedContainerDimensions(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const [containerId, container] of this._containers) {
      if (!container.collapsed) continue;

      const width = container.width || container.dimensions?.width || 0;
      const height = container.height || container.dimensions?.height || 0;
      const maxAllowedWidth = 300; // Reasonable threshold
      const maxAllowedHeight = 300;

      if (width > maxAllowedWidth || height > maxAllowedHeight) {
        violations.push({
          type: "COLLAPSED_CONTAINER_LARGE_DIMENSIONS",
          message: `Collapsed container ${containerId} has large dimensions (${width}x${height}) that may cause layout issues`,
          entityId: containerId,
          severity: "warning",
        });
      }
    }

    return violations;
  }

  private reportViolations(violations: InvariantViolation[]): void {
    const errors = violations.filter((v) => v.severity === "error");
    const warnings = violations.filter((v) => v.severity === "warning");

    if (warnings.length > 0) {
      console.warn("[VisualizationState] Invariant warnings:", warnings);
    }

    if (errors.length > 0) {
      console.error(
        "[VisualizationState] CRITICAL: Invariant violations:",
        errors
      );
      throw new Error(
        `VisualizationState invariant violations: ${errors.map((e) => e.message).join("; ")}`
      );
    }
  }
}
