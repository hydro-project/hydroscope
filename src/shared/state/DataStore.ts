/**
 * DataStore - Core data management for nodes, edges, and containers
 * Handles CRUD operations and maintains relationships
 */
import type { GraphNode, GraphEdge, Container } from "../../types/core.js";

export class DataStore {
  // Core data structures
  private _nodes = new Map<string, GraphNode>();
  private _edges = new Map<string, GraphEdge>();
  private _containers = new Map<string, Container>();
  
  // Relationship mappings
  private _nodeContainerMap = new Map<string, string>();
  private _containerParentMap = new Map<string, string>();
  
  // Orphaned entity tracking
  private _orphanedNodes = new Set<string>();
  private _orphanedContainers = new Set<string>();
  private _totalElementCount: number = 0;

  // Callbacks for invalidation
  private _onDataChanged: (() => void) | null = null;

  setDataChangeCallback(callback: () => void): void {
    this._onDataChanged = callback;
  }

  private _notifyDataChanged(): void {
    if (this._onDataChanged) {
      this._onDataChanged();
    }
  }

  // Node operations
  addNode(node: GraphNode): void {
    this._validateNodeData(node);
    this._nodes.set(node.id, { ...node });
    this._notifyDataChanged();
  }

  removeNode(id: string): void {
    this._nodes.delete(id);
    this._nodeContainerMap.delete(id);
    this._notifyDataChanged();
  }

  updateNode(id: string, node: GraphNode): void {
    if (!this._nodes.has(id)) {
      console.warn("[DataStore] updateNode called with invalid id");
      return;
    }
    this._validateNodeData(node, false);
    this._nodes.set(id, { ...node });
    this._notifyDataChanged();
  }

  getNode(id: string): GraphNode | undefined {
    return this._nodes.get(id);
  }

  getAllNodes(): Map<string, GraphNode> {
    return this._nodes;
  }

  hasNode(id: string): boolean {
    return this._nodes.has(id);
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

  // Edge operations
  addEdge(edge: GraphEdge): void {
    this._validateEdgeData(edge);
    this._edges.set(edge.id, { ...edge });
    this._notifyDataChanged();
  }

  removeEdge(id: string): void {
    this._edges.delete(id);
    this._notifyDataChanged();
  }

  updateEdge(id: string, edge: GraphEdge): void {
    if (!this._edges.has(id)) {
      console.warn("[DataStore] updateEdge called with invalid id");
      return;
    }
    this._validateEdgeData(edge, false);
    this._edges.set(id, { ...edge });
    this._notifyDataChanged();
  }

  getEdge(id: string): GraphEdge | undefined {
    return this._edges.get(id);
  }

  getAllEdges(): Map<string, GraphEdge> {
    return this._edges;
  }

  hasEdge(id: string): boolean {
    return this._edges.has(id);
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

    const sourceExists =
      this._nodes.has(edge.source) || this._containers.has(edge.source);
    const targetExists =
      this._nodes.has(edge.target) || this._containers.has(edge.target);

    if (!sourceExists) {
      throw new Error(
        `Edge ${edge.id} references non-existent source: ${edge.source}`,
      );
    }
    if (!targetExists) {
      throw new Error(
        `Edge ${edge.id} references non-existent target: ${edge.target}`,
      );
    }
  }

  // Container operations
  addContainer(container: Container): void {
    this._validateContainerData(container);
    this._validateTreeDependencies(container);
    
    const existingContainer = this._containers.get(container.id);
    if (existingContainer) {
      this._cleanupContainerMappings(existingContainer);
    }
    
    const finalContainer = {
      ...container,
      children: new Set(container.children),
      collapsed: container.collapsed ?? false,
      hidden: container.hidden ?? false,
    };
    this._containers.set(container.id, finalContainer);
    this._updateChildMappings(container);
    this._updateParentMappings();
    this._notifyDataChanged();
  }

  removeContainer(id: string): void {
    const container = this._containers.get(id);
    this._containers.delete(id);
    
    if (container) {
      for (const childId of container.children) {
        this._nodeContainerMap.delete(childId);
        this._containerParentMap.delete(childId);
        
        if (this._nodes.has(childId)) {
          this._orphanedNodes.add(childId);
        }
        if (this._containers.has(childId)) {
          this._orphanedContainers.add(childId);
        }
      }
    }
    this._notifyDataChanged();
  }

  updateContainer(id: string, container: Container): void {
    if (!this._containers.has(id)) {
      console.warn("[DataStore] updateContainer called with invalid id");
      return;
    }
    this._validateContainerData(container, false);
    
    const oldContainer = this._containers.get(id);
    if (oldContainer) {
      this._cleanupContainerMappings(oldContainer);
    }
    
    this._validateTreeDependencies(container);
    const finalContainer = {
      ...container,
      children: new Set(container.children),
      collapsed: container.collapsed ?? false,
      hidden: container.hidden ?? false,
    };
    this._containers.set(container.id, finalContainer);
    this._updateChildMappings(container);
    this._updateParentMappings();
    this._notifyDataChanged();
  }

  getContainer(id: string): Container | undefined {
    return this._containers.get(id);
  }

  getAllContainers(): Map<string, Container> {
    return this._containers;
  }

  hasContainer(id: string): boolean {
    return this._containers.has(id);
  }

  private _validateContainerData(
    container: Container,
    validateId: boolean = true,
  ): void {
    if (!container) {
      throw new Error("Invalid container: container cannot be null or undefined");
    }
    if (validateId && (!container.id || container.id.trim() === "")) {
      throw new Error("Invalid container: id cannot be empty");
    }
    if (
      !container.label ||
      typeof container.label !== "string" ||
      container.label.trim() === ""
    ) {
      throw new Error(
        `Invalid container: label cannot be empty (got: ${JSON.stringify(container.label)}, type: ${typeof container.label})`,
      );
    }
  }

  private _validateTreeDependencies(container: Container): void {
    if (container.children.has(container.id)) {
      throw new Error(
        `Non-tree dependency detected: Container ${container.id} cannot contain itself`,
      );
    }
    
    for (const [existingId, existingContainer] of this._containers) {
      if (existingContainer.children.has(container.id)) {
        throw new Error(
          `Non-tree dependency detected: ${existingId} already referenced ${container.id} as a child`,
        );
      }
    }
  }

  private _updateChildMappings(container: Container): void {
    for (const childId of container.children) {
      if (this._containers.has(childId)) {
        this._containerParentMap.set(childId, container.id);
      } else {
        this._nodeContainerMap.set(childId, container.id);
      }
    }
  }

  private _updateParentMappings(): void {
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

  // Relationship queries
  getNodeContainer(nodeId: string): string | undefined {
    return this._nodeContainerMap.get(nodeId);
  }

  getContainerParent(containerId: string): string | undefined {
    return this._containerParentMap.get(containerId);
  }

  getContainerChildren(containerId: string): Set<string> | undefined {
    const container = this._containers.get(containerId);
    return container?.children;
  }

  // Orphaned entity management
  getOrphanedNodes(): Set<string> {
    return this._orphanedNodes;
  }

  getOrphanedContainers(): Set<string> {
    return this._orphanedContainers;
  }

  cleanupOrphanedEntities(): void {
    this._orphanedNodes.clear();
    this._orphanedContainers.clear();
  }

  // Utility
  getTotalElementCount(): number {
    return this._totalElementCount;
  }

  setTotalElementCount(count: number): void {
    this._totalElementCount = count;
  }

  clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this._containers.clear();
    this._nodeContainerMap.clear();
    this._containerParentMap.clear();
    this._orphanedNodes.clear();
    this._orphanedContainers.clear();
    this._totalElementCount = 0;
    this._notifyDataChanged();
  }
}
