/**
 * VisualizationState - Central data model for Hydroscope
 * Architectural constraints: React-free, single source of truth, synchronous core
 */
import { hscopeLogger } from "../utils/logger.js";
import { getHierarchyOrderMap } from "../utils/hierarchyUtils.js";
import {
  LAYOUT_CONSTANTS,
  SIZES,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_ELK_ALGORITHM,
  NAVIGATION_TIMING,
} from "@/shared/config.js";
import type { RenderConfig } from "@/components/Hydroscope.js";
import type {
  GraphNode,
  GraphEdge,
  Container,
  AggregatedEdge,
  LayoutState,
  SearchResult,
  StyleConfig,
  InvariantViolation,
  SearchNavigationState,
} from "../types/core.js";
import {
  assertAncestorsExpanded,
  assertDescendantsCollapsedAndHidden,
  logInvariantCheck,
} from "./invariantChecks.js";

export class VisualizationState {
  private _nodes = new Map<string, GraphNode>();
  private _edges = new Map<string, GraphEdge>();
  private _containers = new Map<string, Container>();
  private _aggregatedEdges = new Map<string, AggregatedEdge>();
  private _nodeContainerMap = new Map<string, string>();
  private _containerParentMap = new Map<string, string>();
  private _orphanedNodes = new Set<string>();
  private _orphanedContainers = new Set<string>();
  private _totalElementCount: number = 0; // Total count of nodes + containers for validation suppression
  private _layoutState: LayoutState = {
    phase: "initial",
    layoutCount: 0,
    lastUpdate: Date.now(),
  };
  // Render configuration - single source of truth for styling
  private _renderConfig: Required<RenderConfig> & {
    layoutAlgorithm: string; // Additional property not in RenderConfig interface
  } = {
    edgeStyle: "bezier",
    edgeWidth: 2,
    edgeDashed: false,
    nodePadding: 8,
    nodeFontSize: 12,
    containerBorderWidth: 2,
    colorPalette: DEFAULT_COLOR_PALETTE,
    layoutAlgorithm: DEFAULT_ELK_ALGORITHM,
    fitView: true,
    showFullNodeLabels: false,
  };
  private _searchResults: SearchResult[] = [];
  private _edgeStyleConfig?: StyleConfig;

  /**
   * Set the edge style configuration (including semantic priorities)
   */
  setEdgeStyleConfig(config: StyleConfig): void {
    this._edgeStyleConfig = config;
  }
  private _searchQuery: string = "";
  private _searchHistory: string[] = [];
  private _searchState: {
    isActive: boolean;
    query: string;
    resultCount: number;
    lastSearchTime: number;
    expandedContainers: Set<string>; // Containers expanded due to search
  } = {
    isActive: false,
    query: "",
    resultCount: 0,
    lastSearchTime: 0,
    expandedContainers: new Set(),
  };
  private _validationEnabled = true;
  private _validationInProgress = false;
  private _performanceMetrics = {
    operationCounts: new Map<string, number>(),
    operationTimes: new Map<string, number[]>(),
    lastOptimization: Date.now(),
  };

  // Performance optimization caches
  private _rootContainersCache: Container[] | null = null;
  private _descendantCache = new Map<string, Set<string>>();
  private _ancestorCache = new Map<string, string[]>();
  private _cacheVersion = 0;
  // Search and Navigation State
  private _searchNavigationState: SearchNavigationState = {
    // Search state
    searchQuery: "",
    searchResults: [],
    treeSearchHighlights: new Set<string>(),
    graphSearchHighlights: new Set<string>(),
    // Navigation state
    navigationSelection: null,
    treeNavigationHighlights: new Set<string>(),
    graphNavigationHighlights: new Set<string>(),
    // Temporary click feedback highlights
    temporaryHighlights: new Set<string>(),
    temporaryHighlightTimestamps: new Map<string, number>(),
    // Expansion state (persists through search operations)
    expandedTreeNodes: new Set<string>(),
    expandedGraphContainers: new Set<string>(),
    // Viewport state
    lastNavigationTarget: null,
    shouldFocusViewport: false,
  };
  // Search debouncing and caching
  private _searchDebounceTimer: number | null = null;
  private _searchCache = new Map<string, SearchResult[]>();
  private _searchCacheMaxSize = 50;
  private _searchCacheMaxAge = 5 * 60 * 1000; // 5 minutes
  private _searchCacheTimestamps = new Map<string, number>();

  // Search indexing for performance
  private _searchIndex = new Map<string, Set<string>>(); // word -> entity IDs
  private _searchIndexVersion = 0;

  // Manual visibility control (separate from collapse/expand hidden property)
  private _manuallyHiddenNodes = new Set<string>();
  private _manuallyHiddenContainers = new Set<string>();
  // Store the state snapshot when hiding, for restoration when showing
  private _hiddenStateSnapshots = new Map<
    string,
    {
      collapsed?: boolean; // For containers
      childStates?: Map<
        string,
        { collapsed?: boolean; manuallyHidden?: boolean }
      >; // Recursive child states
    }
  >();

  // State persistence
  private _stateVersion = 1;
  private _lastStateSnapshot: string | null = null;
  // Data Management

  /**
   * Clear all data from the VisualizationState
   */
  clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this._containers.clear();
    this._nodeContainerMap.clear();
    this._aggregatedEdges.clear();
    this._originalToAggregatedMap.clear();
    this._aggregatedToOriginalMap.clear();
    this._containerAggregationMap.clear();
    this._orphanedNodes.clear();
    this._orphanedContainers.clear();
    this._searchState.query = "";
    this._searchState.resultCount = 0;
    this._searchState.expandedContainers.clear();
    this._searchNavigationState.searchQuery = "";
    this._searchNavigationState.searchResults = [];
    this._searchNavigationState.treeSearchHighlights.clear();
    this._searchNavigationState.graphSearchHighlights.clear();
    this._searchNavigationState.treeNavigationHighlights.clear();
    this._searchNavigationState.graphNavigationHighlights.clear();
    this._searchNavigationState.navigationSelection = null;
    this._searchNavigationState.shouldFocusViewport = false;
    this._searchIndex.clear();
    this._manuallyHiddenNodes.clear();
    this._manuallyHiddenContainers.clear();
    this._hiddenStateSnapshots.clear();
    this._searchCache.clear();
    this._searchCacheTimestamps.clear();
    this._descendantCache.clear();
    this._ancestorCache.clear();
    this._rootContainersCache = null;
    this._invalidateAllCaches();
  }

  addNode(node: GraphNode): void {
    this._validateNodeData(node);
    this._nodes.set(node.id, { ...node });
    this._invalidateAllCaches();
    this.validateInvariants();
  }
  removeNode(id: string): void {
    this._nodes.delete(id);
    this._nodeContainerMap.delete(id);
    this._invalidateAllCaches();
    this.validateInvariants();
  }
  updateNode(id: string, node: GraphNode): void {
    if (!this._nodes.has(id)) {
      console.warn("[VisualizationState] updateNode called with invalid id");
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
    this._invalidateVisibilityCache();
    this.validateInvariants();
  }
  private _handleEdgeAggregationOnAdd(edgeId: string): void {
    const edge = this._edges.get(edgeId);
    if (!edge) return;

    // OPTIMIZED: Check if parent containers are collapsed instead of iterating all containers
    const sourceAffectedContainers = this._getCollapsedAncestors(edge.source);
    const targetAffectedContainers = this._getCollapsedAncestors(edge.target);

    // Aggregate for all affected containers
    const affectedContainers = new Set([
      ...sourceAffectedContainers,
      ...targetAffectedContainers,
    ]);
    for (const containerId of affectedContainers) {
      this.aggregateEdgesForContainer(containerId);
    }
  }

  /**
   * OPTIMIZED: Get all collapsed ancestor containers for a given entity
   */
  private _getCollapsedAncestors(entityId: string): string[] {
    const collapsedAncestors: string[] = [];
    let currentContainerId =
      this._nodeContainerMap.get(entityId) ||
      this._containerParentMap.get(entityId);

    while (currentContainerId) {
      const container = this._containers.get(currentContainerId);
      if (container && container.collapsed) {
        collapsedAncestors.push(currentContainerId);
      }
      currentContainerId = this._containerParentMap.get(currentContainerId);
    }

    return collapsedAncestors;
  }
  removeEdge(id: string): void {
    this._edges.delete(id);
    this._invalidateVisibilityCache();
    this.validateInvariants();
  }
  updateEdge(id: string, edge: GraphEdge): void {
    if (!this._edges.has(id)) {
      console.warn("[VisualizationState] updateEdge called with invalid id");
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

    // Validate that source and target nodes/containers actually exist
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
  addContainer(container: Container): void {
    this._validateContainerData(container);
    this._updateContainerWithMappings(container);
    this._invalidateAllCaches();
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
    this._invalidateAllCaches();
    this.validateInvariants();
  }
  updateContainer(id: string, container: Container): void {
    if (!this._containers.has(id)) {
      console.warn(
        "[VisualizationState] updateContainer called with invalid id",
      );
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
    validateId: boolean = true,
  ): void {
    if (!container) {
      throw new Error(
        "Invalid container: container cannot be null or undefined",
      );
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
    // TODO: throw on container with no children? Make symmetric to orphaned nodes?
    // Need to check order of ops at parsing/initialization.
  }
  private _updateContainerWithMappings(container: Container): void {
    // Check for non-tree-shaped dependencies before adding
    this._validateTreeDependencies(container);
    // If container already exists, clean up old mappings first
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
    // Hide all (transitive) descendants
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
  private _validateTreeDependencies(container: Container): void {
    // Check that each container referenced only once. Prevents DAGs and cycles
    if (container.children.has(container.id)) {
      throw new Error(
        `Non-tree dependency detected: Container ${container.id} cannot contain itself`,
      );
    }
    // Check if this container is already referenced as a child by any existing container
    // If so, adding it would create a DAG or possibly a cycle
    for (const [existingId, existingContainer] of this._containers) {
      if (existingContainer.children.has(container.id)) {
        // container.id is already a child of existingId
        throw new Error(
          `Non-tree dependency detected: ${existingId} already referenced ${container.id} as a child`,
        );
      }
    }
  }
  // Internal method for AsyncCoordinator use only - DO NOT CALL DIRECTLY
  _expandContainerForCoordinator(id: string): void {
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
        // CRITICAL FIX: If the child container is still collapsed, ensure its descendants are properly hidden
        // This maintains the invariant that collapsed containers have hidden descendants
        if (childContainer.collapsed) {
          this._hideAllDescendants(childId);
        }
        // Don't automatically show contents of child containers - they keep their collapsed state
        // Child containers will only show their contents when explicitly expanded
      }
    }
  }
  // Internal method for AsyncCoordinator use only - DO NOT CALL DIRECTLY
  _collapseContainerForCoordinator(id: string): void {
    this._collapseContainerInternal(id);
    // Aggregate edges when container collapses
    this.aggregateEdgesForContainer(id);
    // User operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
    // ReactFlow validation removed - handled by AsyncCoordinator pipeline
  }
  private _hideAllDescendants(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;
    // CRITICAL FIX: Process bottom-up to ensure proper edge aggregation
    // First, recursively process all nested containers (deepest first)
    for (const childId of container.children) {
      const childContainer = this._containers.get(childId);
      if (childContainer) {
        // Recursively process descendants first (bottom-up)
        this._hideAllDescendants(childId);
        // Then collapse and aggregate edges for this child container
        childContainer.hidden = true;
        childContainer.collapsed = true; // CRITICAL FIX: Also collapse child containers to avoid invariant violations
        // CRITICAL FIX: Clean up any existing aggregated edges that reference this now-hidden container
        // This prevents ELK from trying to reference non-existent shapes
        this._cleanupAggregatedEdgesForHiddenContainer(childId);
        // CRITICAL FIX: Aggregate edges for this nested container AFTER its descendants are processed
        // This ensures that edges referencing deeply nested containers are properly handled
        this.aggregateEdgesForContainer(childId);
      }
    }
    // Finally, hide all direct child nodes
    for (const childId of container.children) {
      const childNode = this._nodes.get(childId);
      if (childNode) {
        childNode.hidden = true;
      }
    }
  }
  // Internal method for AsyncCoordinator use only - DO NOT CALL DIRECTLY
  _expandContainersForCoordinator(containerIds?: string[]): void {
    // CRITICAL FIX: Expand containers in hierarchical order (parents before children)
    // This prevents invariant violations where children are expanded before their parents
    let expandedInThisIteration = 0;
    let _totalExpanded = 0;
    let iteration = 0;
    const maxIterations = 10; // Safety limit to prevent infinite loops
    do {
      expandedInThisIteration = 0;
      iteration++;
      // Get all containers and sort them by hierarchy depth (shallowest first)
      const allContainers = containerIds
        ? containerIds.map((id) => this._containers.get(id)).filter(Boolean)
        : Array.from(this._containers.values());
      // Sort containers by hierarchy depth to expand parents before children
      const sortedContainers = allContainers
        .filter(
          (container): container is Container =>
            container !== undefined && container.collapsed,
        )
        .sort((a, b) => {
          const depthA = this._getContainerDepth(a.id);
          const depthB = this._getContainerDepth(b.id);
          return depthA - depthB; // Shallowest first
        });
      for (const container of sortedContainers) {
        // Double-check that the container can be expanded (parent is expanded)
        if (this._canExpandContainer(container.id)) {
          this._expandContainerInternal(container.id);
          expandedInThisIteration++;
          _totalExpanded++;
        } else {
        }
      }
      if (iteration >= maxIterations) {
        console.warn(
          `[VisualizationState] ⚠️ Reached maximum iterations (${maxIterations}) in expandContainers`,
        );
        break;
      }
    } while (expandedInThisIteration > 0);
    // Bulk user operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
  }
  // Internal method for AsyncCoordinator use only - DO NOT CALL DIRECTLY
  _collapseContainersForCoordinator(containerIds?: string[]): void {
    const containersToCollapse = containerIds
      ? containerIds.map((id) => this._containers.get(id)).filter(Boolean)
      : Array.from(this._containers.values());
    for (const container of containersToCollapse) {
      if (container && !container.collapsed) {
        this._collapseContainerInternal(container.id);
        // CRITICAL FIX: Aggregate edges when each container collapses
        this.aggregateEdgesForContainer(container.id);
      }
    }
    // Bulk user operations disable smart collapse
    this.disableSmartCollapseForUserOperations();
    // ReactFlow validation removed - handled by AsyncCoordinator pipeline
  }
  /**
   * Trigger ReactFlow validation to check for floating edges and other issues
   * TODO This is jank and needs to be cleaned out.
   */
  // ReactFlow validation removed - now handled by AsyncCoordinator pipeline
  // Edge Aggregation Management
  aggregateEdgesForContainer(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) {
      return;
    }
    // Get all descendants of this container (including nested containers)
    const allDescendants = this._getAllDescendantIds(containerId);
    const edgesToAggregate = new Map<string, GraphEdge[]>(); // key: source-target, value: edges
    const aggregatedEdgesToDelete: string[] = []; // Track aggregated edges to delete
    // Find all edges that need to be aggregated
    const edgesBySourceTarget = new Map<
      string,
      {
        source: string;
        target: string;
        edges: GraphEdge[];
      }
    >();
    // TODO: seems inefficient to iterate through all edges. Should walk the tree downward from here.
    for (const [_edgeId, edge] of this._edges) {
      // Process ALL edges, including hidden ones, since they might need aggregation
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
          // CRITICAL FIX: Find lowest visible ancestor instead of direct assignment
          const visibleAncestor =
            this._findLowestVisibleAncestorForAggregation(containerId);
          if (visibleAncestor) {
            aggregatedSource = visibleAncestor;
          } else {
            // No visible ancestor, skip this edge
            edge.hidden = true;
            continue;
          }
        }
        // If target is in container, aggregate to container
        if (targetInContainer) {
          // CRITICAL FIX: Find lowest visible ancestor instead of direct assignment
          const visibleAncestor =
            this._findLowestVisibleAncestorForAggregation(containerId);
          if (visibleAncestor) {
            aggregatedTarget = visibleAncestor;
          } else {
            // No visible ancestor, skip this edge
            edge.hidden = true;
            continue;
          }
        }
        // TODO: DRY up the next two blocks into one block.
        // TODO: do these 2 blocks need to be made recursive?
        // CRITICAL FIX: Ensure both endpoints are visible containers or nodes
        // For any node that's not visible, find the lowest visible ancestor in the hierarchy
        // CRITICAL FIX: Ensure both endpoints are visible containers or nodes
        // If source is a hidden node, find its visible container
        if (!this._containers.has(aggregatedSource)) {
          const sourceNode = this._nodes.get(aggregatedSource);
          if (!sourceNode) {
            throw new Error(
              `Edge ${edge.id} references non-existent source node: ${aggregatedSource}`,
            );
          }
          if (sourceNode.hidden) {
            // Use proper hierarchy traversal to find visible ancestor
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(aggregatedSource);
            if (visibleAncestor) {
              aggregatedSource = visibleAncestor;
            } else {
              console.warn(
                `[EdgeDebug] No visible ancestor found for hidden source ${edge.source}, skipping edge ${edge.id}`,
              );
              edge.hidden = true;
              continue;
            }
          }
        } else {
          // CRITICAL FIX: If source is a hidden container, find its visible ancestor
          const sourceContainer = this._containers.get(aggregatedSource);
          if (sourceContainer && sourceContainer.hidden) {
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(aggregatedSource);
            if (visibleAncestor) {
              aggregatedSource = visibleAncestor;
            } else {
              console.warn(
                `[EdgeDebug] No visible ancestor found for hidden source container ${edge.source}, skipping edge ${edge.id}`,
              );
              edge.hidden = true;
              continue;
            }
          }
        }
        // If target is a hidden node, find its visible container
        if (!this._containers.has(aggregatedTarget)) {
          const targetNode = this._nodes.get(aggregatedTarget);
          if (!targetNode) {
            throw new Error(
              `Edge ${edge.id} references non-existent target node: ${aggregatedTarget}`,
            );
          }
          if (targetNode.hidden) {
            // Use proper hierarchy traversal to find visible ancestor
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(aggregatedTarget);
            if (visibleAncestor) {
              aggregatedTarget = visibleAncestor;
            } else {
              console.warn(
                `[EdgeDebug] No visible ancestor found for hidden target ${edge.target}, skipping edge ${edge.id}`,
              );
              edge.hidden = true;
              continue;
            }
          }
        } else {
          // CRITICAL FIX: If target is a hidden container, find its visible ancestor
          const targetContainer = this._containers.get(aggregatedTarget);
          if (targetContainer && targetContainer.hidden) {
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(aggregatedTarget);
            if (visibleAncestor) {
              aggregatedTarget = visibleAncestor;
            } else {
              console.warn(
                `[EdgeDebug] No visible ancestor found for hidden target container ${edge.target}, skipping edge ${edge.id}`,
              );
              edge.hidden = true;
              continue;
            }
          }
        }
        // Skip self-loops to the container
        if (aggregatedSource === aggregatedTarget) {
          edge.hidden = true;
          continue;
        }
        const key = `${aggregatedSource}-${aggregatedTarget}`;
        if (!edgesBySourceTarget.has(key)) {
          edgesBySourceTarget.set(key, {
            source: aggregatedSource,
            target: aggregatedTarget,
            edges: [],
          });
        }
        edgesBySourceTarget.get(key)!.edges.push(edge);
        // Hide the original edge
        edge.hidden = true;
      }
    }
    // Also check existing aggregated edges that might need to be updated
    // TODO: Can this be DRYed up? Seems quite similar to the above.
    for (const [_aggId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.hidden) continue;
      const sourceInContainer = allDescendants.has(aggEdge.source);
      const targetInContainer = allDescendants.has(aggEdge.target);
      if (sourceInContainer || targetInContainer) {
        // This aggregated edge needs to be updated
        let newSource = aggEdge.source;
        let newTarget = aggEdge.target;
        if (sourceInContainer) {
          // CRITICAL FIX: Find lowest visible ancestor instead of direct assignment
          const visibleAncestor =
            this._findLowestVisibleAncestorForAggregation(containerId);
          if (visibleAncestor) {
            newSource = visibleAncestor;
          } else {
            // No visible ancestor, hide the edge
            aggEdge.hidden = true;
            continue;
          }
        }
        if (targetInContainer) {
          // CRITICAL FIX: Find lowest visible ancestor instead of direct assignment
          const visibleAncestor =
            this._findLowestVisibleAncestorForAggregation(containerId);
          if (visibleAncestor) {
            newTarget = visibleAncestor;
          } else {
            // No visible ancestor, hide the edge
            aggEdge.hidden = true;
            continue;
          }
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
        // CRITICAL FIX: Delete the old aggregated edge instead of just hiding it
        // This prevents ELK from seeing references to hidden containers
        // Add its original edges to be re-aggregated with new endpoints
        for (const originalEdgeId of aggEdge.originalEdgeIds) {
          const originalEdge = this._edges.get(originalEdgeId);
          if (originalEdge) {
            edgesToAggregate.get(key)!.push(originalEdge);
          }
        }
        // Mark for deletion (we'll delete after iteration to avoid modifying map during iteration)
        aggregatedEdgesToDelete.push(aggEdge.id);
      }
    }
    // CRITICAL FIX: Delete old aggregated edges that reference hidden containers
    for (const aggEdgeId of aggregatedEdgesToDelete) {
      this._aggregatedEdges.delete(aggEdgeId);
    }
    // Create new aggregated edges
    for (const [_key, edgeGroup] of edgesBySourceTarget) {
      const { source, target, edges } = edgeGroup;
      // Validate that both endpoints exist
      const sourceContainer = this._containers.get(source);
      const sourceNode = this._nodes.get(source);
      const targetContainer = this._containers.get(target);
      const targetNode = this._nodes.get(target);
      const sourceExists = sourceContainer || sourceNode;
      const targetExists = targetContainer || targetNode;
      if (!sourceExists) {
        throw new Error(
          `Aggregated edge source ${source} does not exist as container or node`,
        );
      }
      if (!targetExists) {
        throw new Error(
          `Aggregated edge target ${target} does not exist as container or node`,
        );
      }
      // SIMPLIFIED FIX: Use source-target pair for consistent IDs while preserving directionality
      const aggregatedEdgeId = `agg-${source}-${target}`;
      // CRITICAL DEBUG: Log when we create problematic edges
      if (source === "bt_136" || target === "bt_136") {
        console.error(
          `[EdgeDebug] 🚨 CREATING PROBLEMATIC EDGE: ${aggregatedEdgeId}`,
        );
        console.error(
          `[EdgeDebug] 🚨   Container ${containerId} is aggregating edges`,
        );
        console.error(
          `[EdgeDebug] 🚨   bt_136 container exists: ${this._containers.has("bt_136")}`,
        );
        console.error(
          `[EdgeDebug] 🚨   bt_136 container hidden: ${this._containers.get("bt_136")?.hidden}`,
        );
        console.error(
          `[EdgeDebug] 🚨   Original edges: ${edges.map((e) => e.id).join(", ")}`,
        );
        // Check the hierarchy
        const bt136Container = this._containers.get("bt_136");
        if (bt136Container) {
          const parent = this._containerParentMap.get("bt_136");
          console.error(`[EdgeDebug] 🚨   bt_136 parent: ${parent}`);
          if (parent) {
            const parentContainer = this._containers.get(parent);
            console.error(
              `[EdgeDebug] 🚨   Parent ${parent} hidden: ${parentContainer?.hidden}, collapsed: ${parentContainer?.collapsed}`,
            );
          }
        }
      }
      // Check if this aggregated edge already exists
      const existingAggEdge = this._aggregatedEdges.get(aggregatedEdgeId);
      if (existingAggEdge && !existingAggEdge.hidden) {
        // Merge with existing aggregated edge
        const newOriginalIds = edges.map((e) => e.id);
        // Only add edge IDs that aren't already in the list to prevent duplicates
        const uniqueNewIds = newOriginalIds.filter(
          (id) => !existingAggEdge.originalEdgeIds.includes(id),
        );
        // Create new arrays to avoid modifying frozen objects
        existingAggEdge.originalEdgeIds = [
          ...existingAggEdge.originalEdgeIds,
          ...uniqueNewIds,
        ];
        existingAggEdge.semanticTags = this._mergeSemanticTagsWithPriority([
          ...existingAggEdge.semanticTags,
          ...edges.flatMap((e) => e.semanticTags),
        ]);
      } else {
        // Create new aggregated edge
        const aggregatedEdge: AggregatedEdge = {
          id: aggregatedEdgeId,
          source,
          target,
          type: edges[0].type, // Use type from first edge
          semanticTags: this._mergeSemanticTagsWithPriority(
            edges.flatMap((e) => e.semanticTags),
          ), // Merge tags with priority rules
          hidden: false,
          aggregated: true,
          originalEdgeIds: edges.map((e) => e.id),
          aggregationSource: containerId,
        };
        this._aggregatedEdges.set(aggregatedEdge.id, aggregatedEdge);
        // Update tracking structures
        this._aggregatedToOriginalMap.set(
          aggregatedEdge.id,
          aggregatedEdge.originalEdgeIds,
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
    const edgeCount = Array.from(edgesBySourceTarget.values()).reduce(
      (sum, edgeGroup) => sum + edgeGroup.edges.length,
      0,
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
  /**
   * Merge semantic tags with priority rules for conflicting tags.
   * Priority rules are defined in the edgeStyleConfig.semanticPriorities field.
   */
  private _mergeSemanticTagsWithPriority(tags: string[]): string[] {
    const tagSet = new Set(tags);

    // Get priority rules from config (if provided)
    const priorityRules = this._edgeStyleConfig?.semanticPriorities || [];

    // Apply priority rules: if both tags exist, keep only the winner
    for (const [winner, loser] of priorityRules) {
      if (tagSet.has(winner) && tagSet.has(loser)) {
        tagSet.delete(loser);
      }
    }

    return Array.from(tagSet);
  }

  private _getAllDescendantIds(containerId: string): Set<string> {
    // Check cache first
    if (this._descendantCache.has(containerId)) {
      return this._descendantCache.get(containerId)!;
    }

    const descendants = new Set<string>();
    const container = this._containers.get(containerId);
    if (!container) {
      this._descendantCache.set(containerId, descendants);
      return descendants;
    }

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

    // Cache the result
    this._descendantCache.set(containerId, descendants);
    return descendants;
  }
  private _getContainerDepth(containerId: string): number {
    let depth = 0;
    let currentId = containerId;
    // Walk up the parent chain to calculate depth
    while (currentId) {
      const parentId = this._containerParentMap.get(currentId);
      if (parentId) {
        depth++;
        currentId = parentId;
      } else {
        break;
      }
    }
    return depth;
  }
  private _canExpandContainer(containerId: string): boolean {
    const container = this._containers.get(containerId);
    if (!container) return false;
    // If container is not collapsed, it doesn't need expansion
    if (!container.collapsed) return false;
    // Check if ALL ancestors are expanded (not just immediate parent)
    let currentId = containerId;
    while (currentId) {
      const parentId = this._containerParentMap.get(currentId);
      if (parentId) {
        const parentContainer = this._containers.get(parentId);
        if (!parentContainer || parentContainer.collapsed) {
          // If any ancestor is collapsed, this container cannot be expanded
          return false;
        }
        currentId = parentId;
      } else {
        // Reached the top level
        break;
      }
    }
    // All ancestors are expanded (or this is a top-level container)
    return true;
  }
  restoreEdgesForContainer(containerId: string): void {
    // Get all descendants of this container
    const allDescendants = this._getAllDescendantIds(containerId);
    // Find aggregated edges that involve this container
    const aggregatedEdgesToRemove: string[] = [];
    const edgesToRestore: string[] = [];
    const edgesToReaggregate: GraphEdge[] = [];
    // TODO: could be made more efficient with an index from container to aggregated edges
    for (const [aggEdgeId, aggEdge] of this._aggregatedEdges) {
      // Check if this aggregated edge involves the container or any of its descendants
      const sourceInvolved =
        aggEdge.source === containerId || allDescendants.has(aggEdge.source);
      const targetInvolved =
        aggEdge.target === containerId || allDescendants.has(aggEdge.target);
      if (sourceInvolved || targetInvolved) {
        // This aggregated edge involves the container being expanded
        // Collect original edges for potential re-aggregation
        for (const originalEdgeId of aggEdge.originalEdgeIds) {
          const originalEdge = this._edges.get(originalEdgeId);
          if (originalEdge) {
            edgesToReaggregate.push(originalEdge);
          }
        }
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
          // leave the edge hidden - it will be re-aggregated when we call
          // aggregateEdgesForContainer for the affected containers below
          originalEdge.hidden = true;
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
      (id) => !aggregatedEdgesToRemove.includes(id),
    );
    if (updatedAggregations.length === 0) {
      this._containerAggregationMap.delete(containerId);
    } else {
      this._containerAggregationMap.set(containerId, updatedAggregations);
    }
    // CRITICAL FIX: Re-aggregate edges that still need aggregation
    // When a container is expanded, some of its original edges might still need
    // to be aggregated if they connect to other collapsed containers
    if (edgesToReaggregate.length > 0) {
      // Group edges that still need aggregation by their effective source/target
      const edgesBySourceTarget = new Map<
        string,
        {
          source: string;
          target: string;
          edges: GraphEdge[];
        }
      >();
      for (const edge of edgesToReaggregate) {
        // Skip if edge is now visible (both endpoints visible)
        if (!edge.hidden) continue;
        // Determine the effective source and target (container if collapsed, node if visible)
        let effectiveSource = edge.source;
        let effectiveTarget = edge.target;
        // Check if source is in a collapsed container
        const sourceContainer = this._getContainerForNode(edge.source);
        if (
          sourceContainer &&
          sourceContainer.collapsed &&
          sourceContainer.id !== containerId
        ) {
          // CRITICAL FIX: If the collapsed container is hidden, find its visible ancestor
          if (sourceContainer.hidden) {
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(sourceContainer.id);
            if (visibleAncestor) {
              effectiveSource = visibleAncestor;
            }
          } else {
            effectiveSource = sourceContainer.id;
          }
        }
        // Check if target is in a collapsed container
        const targetContainer = this._getContainerForNode(edge.target);
        if (
          targetContainer &&
          targetContainer.collapsed &&
          targetContainer.id !== containerId
        ) {
          // CRITICAL FIX: If the collapsed container is hidden, find its visible ancestor
          if (targetContainer.hidden) {
            const visibleAncestor =
              this._findLowestVisibleAncestorForAggregation(targetContainer.id);
            if (visibleAncestor) {
              effectiveTarget = visibleAncestor;
            }
          } else {
            effectiveTarget = targetContainer.id;
          }
        }
        // Only aggregate if at least one endpoint is still a collapsed container
        if (
          effectiveSource !== edge.source ||
          effectiveTarget !== edge.target
        ) {
          const key = `${effectiveSource}-${effectiveTarget}`;
          if (!edgesBySourceTarget.has(key)) {
            edgesBySourceTarget.set(key, {
              source: effectiveSource,
              target: effectiveTarget,
              edges: [],
            });
          }
          edgesBySourceTarget.get(key)!.edges.push(edge);
        }
      }
      // Create new aggregated edges
      for (const [_key, edgeGroup] of edgesBySourceTarget) {
        const { source, target, edges } = edgeGroup;
        const aggregatedEdgeId = `agg-${source}-${target}`;
        const aggregatedEdge: AggregatedEdge = {
          id: aggregatedEdgeId,
          source,
          target,
          type: "aggregated",
          semanticTags: [],
          originalEdgeIds: edges.map((e) => e.id),
          aggregated: true,
          hidden: false,
          aggregationSource: "re-aggregation",
        };
        this._aggregatedEdges.set(aggregatedEdge.id, aggregatedEdge);
        // Update tracking structures
        this._aggregatedToOriginalMap.set(
          aggregatedEdge.id,
          aggregatedEdge.originalEdgeIds,
        );
        for (const originalId of aggregatedEdge.originalEdgeIds) {
          this._originalToAggregatedMap.set(originalId, aggregatedEdge.id);
        }
        // Update container aggregation maps
        if (this._containers.has(source)) {
          if (!this._containerAggregationMap.has(source)) {
            this._containerAggregationMap.set(source, []);
          }
          this._containerAggregationMap.get(source)!.push(aggregatedEdge.id);
        }
        if (this._containers.has(target) && target !== source) {
          if (!this._containerAggregationMap.has(target)) {
            this._containerAggregationMap.set(target, []);
          }
          this._containerAggregationMap.get(target)!.push(aggregatedEdge.id);
        }
      }
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
  // Helper methods for canonical aggregated edge management
  private _getContainerForNode(nodeId: string): Container | undefined {
    const containerId = this._nodeContainerMap.get(nodeId);
    return containerId ? this._containers.get(containerId) : undefined;
  }
  getAggregatedEdges(): ReadonlyArray<AggregatedEdge> {
    return Array.from(this._aggregatedEdges.values()).filter(
      (edge) => !edge.hidden,
    );
  }
  getOriginalEdges(): ReadonlyArray<GraphEdge> {
    return Array.from(this._edges.values());
  }
  // Read-only Access
  get visibleNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._nodes.values()).filter(
      (node) => !node.hidden && !this._manuallyHiddenNodes.has(node.id),
    );
  }

  /**
   * Get all nodes regardless of manual visibility state
   * (includes both visible and manually hidden nodes)
   * Used by Show All button to find hidden nodes
   *
   * CRITICAL: This includes manually hidden nodes (where node.hidden = true
   * but they're in _manuallyHiddenNodes set). It only excludes nodes that
   * are hidden due to collapse (not manually hidden).
   */
  get allNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._nodes.values()).filter(
      (node) => !node.hidden || this._manuallyHiddenNodes.has(node.id),
    );
  }

  getAllNodes(): Array<GraphNode> {
    return Array.from(this._nodes.values());
  }

  getAllEdges(): Array<GraphEdge> {
    return Array.from(this._edges.values());
  }

  get visibleEdges(): ReadonlyArray<GraphEdge | AggregatedEdge> {
    const regularEdges = Array.from(this._edges.values()).filter(
      (edge) => !edge.hidden,
    );
    const aggregatedEdges = Array.from(this._aggregatedEdges.values()).filter(
      (edge) => !edge.hidden,
    );
    return [...regularEdges, ...aggregatedEdges];
  }
  get visibleContainers(): ReadonlyArray<Container> {
    return Array.from(this._containers.values()).filter(
      (container) =>
        !container.hidden && !this._manuallyHiddenContainers.has(container.id),
    );
  }

  /**
   * Get all containers regardless of visibility state
   * (includes both visible and manually hidden containers)
   * Used by hierarchy tree to show all containers with appropriate eye icons
   *
   * CRITICAL: This includes manually hidden containers (where container.hidden = true
   * but they're in _manuallyHiddenContainers set). It only excludes containers that
   * are hidden due to collapse (not manually hidden).
   */
  get allContainers(): ReadonlyArray<Container> {
    return Array.from(this._containers.values()).filter(
      (container) =>
        !container.hidden || this._manuallyHiddenContainers.has(container.id),
    );
  }

  // Getters for validation and external access

  /**
   * Get the current cache version - increments whenever internal state changes
   * This can be used as a React dependency to trigger re-renders when the
   * visualization state changes (e.g., visibility toggles, collapse/expand)
   */
  get cacheVersion(): number {
    return this._cacheVersion;
  }

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
    // Check cache first
    if (this._ancestorCache.has(containerId)) {
      return this._ancestorCache.get(containerId)!;
    }

    const ancestors: string[] = [];
    let current = this.getContainerParent(containerId);
    while (current) {
      ancestors.push(current);
      current = this.getContainerParent(current);
    }

    // Cache the result
    this._ancestorCache.set(containerId, ancestors);
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
  assignNodeToContainer(nodeId: string, targetContainerId: string): void {
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
  // Render Configuration - Single Source of Truth
  getRenderConfig(): Required<RenderConfig> & {
    layoutAlgorithm: string;
  } {
    return { ...this._renderConfig };
  }
  updateRenderConfig(
    updates: Partial<
      Required<RenderConfig> & {
        layoutAlgorithm: string;
      }
    >,
  ): void {
    this._renderConfig = { ...this._renderConfig, ...updates };
  }
  getEdgeStyle(): "bezier" | "straight" | "smoothstep" {
    return this._renderConfig.edgeStyle;
  }
  getColorPalette(): string {
    return this._renderConfig.colorPalette;
  }
  getLayoutAlgorithm(): string {
    return this._renderConfig.layoutAlgorithm;
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
    hscopeLogger.log(
      "op",
      `🔄 RESET LAYOUT STATE: Before reset - layoutCount=${this._layoutState.layoutCount}`,
    );
    this._layoutState = {
      phase: "initial",
      layoutCount: 0,
      lastUpdate: Date.now(),
    };
    // CRITICAL FIX: Reset smart collapse state for new data
    this.resetSmartCollapseState();
    hscopeLogger.log(
      "op",
      `🔄 RESET LAYOUT STATE: After reset - layoutCount=${this._layoutState.layoutCount}, isFirstLayout=${this.isFirstLayout()}, smartCollapseEnabled=${this._smartCollapseEnabled}`,
    );
  }
  // Smart Collapse Management
  private _smartCollapseEnabled = true;
  private _smartCollapseOverride = false;
  shouldRunSmartCollapse(): boolean {
    if (this._smartCollapseOverride) {
      this._smartCollapseOverride = false; // Reset after checking
      hscopeLogger.log(
        "op",
        "🎯 SMART COLLAPSE: Override enabled, returning true",
      );
      return true;
    }
    const enabled = this._smartCollapseEnabled;
    const isFirst = this.isFirstLayout();
    const result = enabled && isFirst;
    hscopeLogger.log(
      "op",
      `🎯 SMART COLLAPSE CHECK: enabled=${enabled}, isFirstLayout=${isFirst}, layoutCount=${this._layoutState.layoutCount}, result=${result}`,
    );
    return result;
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
  /**
   * Perform smart collapse operation - automatically collapse containers
   * that meet certain criteria to improve initial layout readability
   *
   * @param budgetOverride - Optional budget override for testing purposes
   */
  performSmartCollapse(budgetOverride?: number): void {
    if (!this.shouldRunSmartCollapse()) {
      return;
    }
    // Step 1: Get all root containers and collapse them initially
    const rootContainers = this.getRootContainers();
    if (rootContainers.length === 0) {
      return;
    }
    // Collapse all root containers initially
    let _collapsedCount = 0;
    for (const container of rootContainers) {
      if (!container.collapsed) {
        this.collapseContainerSystemOperation(container.id);
        _collapsedCount++;
      }
    }
    // Step 2: Create expansion candidates sorted by cost
    interface ExpansionCandidate {
      containerId: string;
      cost: number;
    }
    const expansionCandidates: ExpansionCandidate[] = [];
    // Add all collapsed root containers as initial candidates
    for (const container of rootContainers) {
      if (container.collapsed) {
        const cost = this.calculateExpansionCost(container.id);
        expansionCandidates.push({ containerId: container.id, cost });
      }
    }
    // Sort candidates by cost (lowest first)
    expansionCandidates.sort((a, b) => a.cost - b.cost);
    // Step 3: Expand containers until budget is reached
    const budget = budgetOverride ?? LAYOUT_CONSTANTS.SMART_COLLAPSE_BUDGET;
    let currentCost = 0;
    let _expandedCount = 0;
    while (expansionCandidates.length > 0) {
      // Get the lowest-cost candidate
      const candidate = expansionCandidates.shift()!;
      // Check if expanding this container would exceed the budget
      if (currentCost + candidate.cost > budget) {
        break;
      }
      this._expandContainerInternal(candidate.containerId);
      currentCost += candidate.cost;
      _expandedCount++;
      // Step 4: Add child containers to expansion candidates
      const expandedContainer = this._containers.get(candidate.containerId);
      if (expandedContainer) {
        const childContainers: ExpansionCandidate[] = [];
        for (const childId of expandedContainer.children) {
          const childContainer = this._containers.get(childId);
          if (childContainer && childContainer.collapsed) {
            const childCost = this.calculateExpansionCost(childId);
            childContainers.push({ containerId: childId, cost: childCost });
          }
        }
        // Add child containers to candidates and re-sort
        expansionCandidates.push(...childContainers);
        expansionCandidates.sort((a, b) => a.cost - b.cost);
        if (childContainers.length > 0) {
        }
      }
    }
    for (const _container of this._containers.values()) {
      // Container processing logic would go here if needed
    }
  }
  /**
   * Calculate the expansion cost for a container as the net growth in screen area.
   *
   * Key insight: When we expand a container, we're replacing its collapsed footprint
   * with an expanded footprint that contains its children plus border space.
   *
   * Cost = (expanded container size) - (original collapsed container size)
   */
  calculateExpansionCost(containerId: string): number {
    const container = this._containers.get(containerId);
    if (!container) {
      return 0;
    }
    // Original footprint: collapsed container size
    const collapsedArea =
      SIZES.COLLAPSED_CONTAINER_WIDTH * SIZES.COLLAPSED_CONTAINER_HEIGHT;
    // Calculate the area needed to contain all direct children
    let childrenArea = 0;
    for (const childId of container.children) {
      const childContainer = this._containers.get(childId);
      if (childContainer) {
        // Child containers appear as collapsed units when parent expands
        childrenArea +=
          SIZES.COLLAPSED_CONTAINER_WIDTH * SIZES.COLLAPSED_CONTAINER_HEIGHT;
      } else if (this._nodes.has(childId)) {
        // Direct node children
        childrenArea +=
          LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH *
          LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT;
      }
    }
    // Expanded container needs to contain children plus border/padding
    const borderPadding = 40; // Rough estimate for container borders and internal padding
    const expandedArea = childrenArea + borderPadding;
    // Net cost is the growth in footprint
    const netCost = Math.max(0, expandedArea - collapsedArea);
    return netCost;
  }
  /**
   * Get root containers - containers that are not children of other containers
   * Used by the holistic smart collapse algorithm to identify top-level containers
   * OPTIMIZED: Uses cache and parent map for O(n) performance
   */
  getRootContainers(): Container[] {
    if (this._rootContainersCache) {
      return this._rootContainersCache;
    }

    const rootContainers: Container[] = [];
    for (const container of this._containers.values()) {
      // Use parent map for O(1) lookup instead of O(n) search
      if (!this._containerParentMap.has(container.id)) {
        rootContainers.push(container);
      }
    }

    this._rootContainersCache = rootContainers;
    return rootContainers;
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
  // Internal method for AsyncCoordinator use only - DO NOT CALL DIRECTLY
  _toggleContainerForCoordinator(id: string): void {
    const container = this._containers.get(id);
    if (!container) {
      console.warn("[VisualizationState] Container not found:", id);
      return;
    }
    if (container.collapsed) {
      this._expandContainerForCoordinator(id);
    } else {
      this._collapseContainerForCoordinator(id);
    }
  }
  // Internal methods for container operations
  private _expandContainerInternal(id: string): void {
    const container = this._containers.get(id);
    if (!container) {
      console.warn(
        `[VisualizationState] ❌ Container ${id} not found for expansion`,
      );
      return;
    }

    // Invariant check: All ancestors must be expanded before we expand this container
    assertAncestorsExpanded(
      id,
      (cid: string) => this._containers.get(cid),
      (cid: string) => this._containerParentMap.get(cid),
      `_expandContainerInternal(${id})`,
    );

    container.collapsed = false;
    container.hidden = false;
    // Track expanded graph containers
    this._searchNavigationState.expandedGraphContainers.add(id);
    this._showImmediateChildren(id);
    this.restoreEdgesForContainer(id);

    logInvariantCheck(`_expandContainerInternal(${id})`, { containerId: id });
    this.validateInvariants();
  }
  private _collapseContainerInternal(id: string): void {
    const container = this._containers.get(id);
    if (!container) {
      console.warn(
        `[VisualizationState] ❌ Container ${id} not found in _collapseContainerInternal`,
      );
      return;
    }
    container.collapsed = true;
    // Reset dimensions to collapsed size to prevent layout issues
    if (container.dimensions) {
      container.dimensions = {
        width: 200, // Standard collapsed width
        height: 150, // Standard collapsed height
      };
    }
    // Remove from expanded graph containers
    this._searchNavigationState.expandedGraphContainers.delete(id);
    this._hideAllDescendants(id);
    this.aggregateEdgesForContainer(id);

    // Invariant check: All descendants must be properly collapsed and hidden
    assertDescendantsCollapsedAndHidden(
      id,
      (cid: string) => this._containers.get(cid),
      (nid: string) => this._nodes.get(nid),
    );

    logInvariantCheck(`_collapseContainerInternal(${id})`, { containerId: id });
    this.validateInvariants();
  }
  /**
   * Clean up aggregated edges that reference a hidden container
   * This prevents ELK from trying to reference non-existent shapes
   */
  private _cleanupAggregatedEdgesForHiddenContainer(containerId: string): void {
    const edgesToRemove: string[] = [];
    const edgesToReaggregate: GraphEdge[] = [];
    for (const [aggEdgeId, aggEdge] of this._aggregatedEdges) {
      if (aggEdge.source === containerId || aggEdge.target === containerId) {
        edgesToRemove.push(aggEdgeId);
        // Collect the original edges for re-aggregation
        for (const originalEdgeId of aggEdge.originalEdgeIds) {
          const originalEdge = this._edges.get(originalEdgeId);
          if (originalEdge) {
            edgesToReaggregate.push(originalEdge);
          }
        }
      }
    }
    // Remove the problematic aggregated edges
    for (const aggEdgeId of edgesToRemove) {
      this._aggregatedEdges.delete(aggEdgeId);
    }
    // Re-aggregate the original edges with proper endpoint resolution
    for (const edge of edgesToReaggregate) {
      this._reaggregateEdgeWithVisibleEndpoints(edge, containerId);
    }
  }
  /**
   * Re-aggregate a single edge, ensuring both endpoints reference visible containers/nodes
   */
  private _reaggregateEdgeWithVisibleEndpoints(
    edge: GraphEdge,
    hiddenContainerId: string,
  ): void {
    let newSource = edge.source;
    let newTarget = edge.target;
    // If source was the hidden container, find its visible parent
    if (edge.source === hiddenContainerId) {
      const visibleAncestor =
        this._findLowestVisibleAncestorForAggregation(hiddenContainerId);
      if (visibleAncestor) {
        newSource = visibleAncestor;
      } else {
        // No visible ancestor, hide the edge
        edge.hidden = true;
        return;
      }
    }
    // If target was the hidden container, find its visible parent
    if (edge.target === hiddenContainerId) {
      const visibleAncestor =
        this._findLowestVisibleAncestorForAggregation(hiddenContainerId);
      if (visibleAncestor) {
        newTarget = visibleAncestor;
      } else {
        // No visible ancestor, hide the edge
        edge.hidden = true;
        return;
      }
    }
    // Skip self-loops
    if (newSource === newTarget) {
      edge.hidden = true;
      return;
    }
    // Create or update aggregated edge with new endpoints
    const aggregatedEdgeId = `agg-${newSource}-${newTarget}`;
    const existingAggEdge = this._aggregatedEdges.get(aggregatedEdgeId);
    if (existingAggEdge) {
      // Add to existing aggregated edge
      if (!existingAggEdge.originalEdgeIds.includes(edge.id)) {
        existingAggEdge.originalEdgeIds.push(edge.id);
      }
    } else {
      // Create new aggregated edge
      const aggregatedEdge: AggregatedEdge = {
        id: aggregatedEdgeId,
        source: newSource,
        target: newTarget,
        type: "aggregated",
        semanticTags: [],
        hidden: false,
        aggregated: true,
        originalEdgeIds: [edge.id],
        aggregationSource: hiddenContainerId,
      };
      this._aggregatedEdges.set(aggregatedEdgeId, aggregatedEdge);
    }
    // Hide the original edge
    edge.hidden = true;
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
    containerId: string,
  ): ReadonlyArray<AggregatedEdge> {
    const edgeIds = this._containerAggregationMap.get(containerId) || [];
    return edgeIds
      .map((id) => this._aggregatedEdges.get(id))
      .filter(
        (edge): edge is AggregatedEdge => edge !== undefined && !edge.hidden,
      );
  }
  getOriginalEdgesForAggregated(
    aggregatedEdgeId: string,
  ): ReadonlyArray<GraphEdge> {
    const originalIds =
      this._aggregatedToOriginalMap.get(aggregatedEdgeId) || [];
    return originalIds
      .map((id) => this._edges.get(id))
      .filter((edge): edge is GraphEdge => edge !== undefined);
  }
  getAggregatedEdgesAffectingNode(
    nodeId: string,
  ): ReadonlyArray<AggregatedEdge> {
    return Array.from(this._aggregatedEdges.values()).filter(
      (edge) =>
        !edge.hidden && (edge.source === nodeId || edge.target === nodeId),
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
      (e) => !e.hidden,
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
    for (const [aggId, _aggEdge] of this._aggregatedEdges) {
      const originalIds = this._aggregatedToOriginalMap.get(aggId);
      if (!originalIds || originalIds.length === 0) {
        errors.push(`Aggregated edge ${aggId} has no original edges`);
        continue;
      }
      for (const originalId of originalIds) {
        const originalEdge = this._edges.get(originalId);
        if (!originalEdge) {
          errors.push(
            `Aggregated edge ${aggId} references non-existent original edge ${originalId}`,
          );
        }
      }
    }
    // Check that all original-to-aggregated mappings are valid
    for (const [originalId, aggId] of this._originalToAggregatedMap) {
      const aggEdge = this._aggregatedEdges.get(aggId);
      if (!aggEdge) {
        errors.push(
          `Original edge ${originalId} maps to non-existent aggregated edge ${aggId}`,
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
      (node) => node.showingLongLabel,
    );
  }
  getInteractionStateSummary(): {
    nodesWithLongLabels: number;
    collapsedContainers: number;
    expandedContainers: number;
  } {
    const nodesWithLongLabels = Array.from(this._nodes.values()).filter(
      (node) => node.showingLongLabel,
    ).length;
    const collapsedContainers = Array.from(this._containers.values()).filter(
      (container) => container.collapsed,
    ).length;
    const expandedContainers = Array.from(this._containers.values()).filter(
      (container) => !container.collapsed,
    ).length;
    return {
      nodesWithLongLabels,
      collapsedContainers,
      expandedContainers,
    };
  }
  resetAllNodeLabelsToShort(): void {
    hscopeLogger.log(
      "op",
      "🏷️ [VisualizationState] resetAllNodeLabelsToShort called, node count:",
      this._nodes.size,
    );
    for (const node of this._nodes.values()) {
      node.showingLongLabel = false;
    }
  }
  expandAllNodeLabelsToLong(): void {
    hscopeLogger.log(
      "op",
      "🏷️ [VisualizationState] expandAllNodeLabelsToLong called, node count:",
      this._nodes.size,
    );
    for (const node of this._nodes.values()) {
      node.showingLongLabel = true;
    }
  }

  /**
   * Toggle a single node's label to show long label
   */
  expandNodeLabelToLong(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (node) {
      hscopeLogger.log(
        "op",
        `🏷️ [VisualizationState] Expanding label for node ${nodeId}`,
      );
      node.showingLongLabel = true;
    } else {
      console.warn(
        `[VisualizationState] Cannot expand label - node ${nodeId} not found`,
      );
    }
  }

  /**
   * Toggle a single node's label to show short label
   */
  resetNodeLabelToShort(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (node) {
      hscopeLogger.log(
        "op",
        `🏷️ [VisualizationState] Resetting label for node ${nodeId}`,
      );
      node.showingLongLabel = false;
    } else {
      console.warn(
        `[VisualizationState] Cannot reset label - node ${nodeId} not found`,
      );
    }
  }

  /**
   * Update node dimensions for full labels mode
   * Calculates new dimensions based on each node's individual label length
   */
  updateNodeDimensionsForFullLabels(enabled: boolean): void {
    hscopeLogger.log(
      "op",
      "📏 [VisualizationState] updateNodeDimensionsForFullLabels called, enabled:",
      enabled,
      "node count:",
      this._nodes.size,
    );
    for (const node of this._nodes.values()) {
      if (enabled) {
        // Calculate dimensions based on this specific node's long label length
        const labelToMeasure = node.longLabel || node.label;
        if (labelToMeasure) {
          // Use font size 10px (FONT_SIZE_POPUP) for calculation
          // More accurate character width estimation for smaller font
          const charWidth = 6; // Approximate width per character at 10px font
          const padding = 32; // Total horizontal padding
          const baseWidth = 120; // Minimum node width
          const maxWidth = 400; // Maximum node width

          // Calculate width based on label length
          const calculatedWidth = Math.max(
            baseWidth,
            Math.min(labelToMeasure.length * charWidth + padding, maxWidth),
          );

          // Calculate height - allow for text wrapping in very long labels
          const maxCharsPerLine = Math.floor(
            (calculatedWidth - padding) / charWidth,
          );
          const estimatedLines = Math.max(
            1,
            Math.ceil(labelToMeasure.length / maxCharsPerLine),
          );
          const lineHeight = 14; // Line height for 10px font
          const verticalPadding = 20; // Top and bottom padding
          const calculatedHeight = Math.max(
            60,
            estimatedLines * lineHeight + verticalPadding,
          );

          node.dimensions = {
            width: calculatedWidth,
            height: calculatedHeight,
          };
          hscopeLogger.log(
            "op",
            `📏 [VisualizationState] Node ${node.id}: label="${labelToMeasure}" -> dimensions=${calculatedWidth}x${calculatedHeight}`,
          );
        } else {
          // No label, use default dimensions
          node.dimensions = {
            width: 120,
            height: 60,
          };
        }
      } else {
        // Reset to default dimensions
        node.dimensions = {
          width: 120,
          height: 60,
        };
      }
    }

    // CRITICAL FIX: Invalidate caches to ensure ELKBridge sees the updated dimensions
    // Without this, ELKBridge may read stale node references that don't have the new dimensions
    this._invalidateVisibilityCache();
    hscopeLogger.log(
      "op",
      "📏 [VisualizationState] Invalidated visibility cache after dimension update",
    );
  }

  /**
   * Update dimensions for a single node based on its current label state
   */
  updateNodeDimensionsForLabel(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) {
      console.warn(
        `[VisualizationState] Cannot update dimensions - node ${nodeId} not found`,
      );
      return;
    }

    hscopeLogger.log(
      "op",
      `📏 [VisualizationState] Updating dimensions for node ${nodeId}, showingLongLabel: ${node.showingLongLabel}`,
    );

    if (node.showingLongLabel) {
      // Calculate dimensions based on long label
      const labelToMeasure = node.longLabel || node.label;
      if (labelToMeasure) {
        const charWidth = 6;
        const padding = 32;
        const baseWidth = 120;
        const maxWidth = 400;

        const calculatedWidth = Math.max(
          baseWidth,
          Math.min(labelToMeasure.length * charWidth + padding, maxWidth),
        );

        const maxCharsPerLine = Math.floor(
          (calculatedWidth - padding) / charWidth,
        );
        const estimatedLines = Math.max(
          1,
          Math.ceil(labelToMeasure.length / maxCharsPerLine),
        );
        const lineHeight = 14;
        const verticalPadding = 20;
        const calculatedHeight = Math.max(
          60,
          estimatedLines * lineHeight + verticalPadding,
        );

        node.dimensions = {
          width: calculatedWidth,
          height: calculatedHeight,
        };
        hscopeLogger.log(
          "op",
          `📏 [VisualizationState] Node ${nodeId}: label="${labelToMeasure}" -> dimensions=${calculatedWidth}x${calculatedHeight}`,
        );
      } else {
        node.dimensions = { width: 120, height: 60 };
      }
    } else {
      // Reset to default dimensions
      node.dimensions = { width: 120, height: 60 };
      hscopeLogger.log(
        "op",
        `📏 [VisualizationState] Node ${nodeId}: reset to default dimensions 120x60`,
      );
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
          `Node ${nodeId} is showing long label but has no longLabel property`,
        );
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  // Search (backward compatibility)
  search(query: string): SearchResult[] {
    // Update both old and new search state for backward compatibility
    this._searchQuery = query.trim();
    this._searchState.isActive = this._searchQuery.length > 0;
    this._searchState.query = this._searchQuery;
    this._searchState.lastSearchTime = Date.now();
    // Also update new search navigation state
    this._searchNavigationState.searchQuery = this._searchQuery;
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
      this._searchNavigationState.searchResults = [];
      this.updateTreeSearchHighlights([]);
      this.updateGraphSearchHighlights([]);
      return this._searchResults;
    }
    const queryLower = this._searchQuery.toLowerCase();
    // Search nodes - prioritize exact matches
    for (const node of this._nodes.values()) {
      const matchResult = this._findMatches(node.label, queryLower);
      if (matchResult.matches) {
        const result: SearchResult = {
          id: node.id,
          label: node.label,
          type: "node",
          matchIndices: matchResult.indices,
          hierarchyPath: this._getHierarchyPath(node.id),
          confidence: this._calculateSearchConfidence(
            node.label,
            queryLower,
            matchResult.isExact,
          ),
        };
        this._searchResults.push(result);
      }
    }
    // Search containers - prioritize exact matches
    for (const container of this._containers.values()) {
      const matchResult = this._findMatches(container.label, queryLower);
      if (matchResult.matches) {
        const result: SearchResult = {
          id: container.id,
          label: container.label,
          type: "container",
          matchIndices: matchResult.indices,
          hierarchyPath: this._getHierarchyPath(container.id),
          confidence: this._calculateSearchConfidence(
            container.label,
            queryLower,
            matchResult.isExact,
          ),
        };
        this._searchResults.push(result);
      }
    }

    this._searchState.resultCount = this._searchResults.length;
    // Update new search navigation state
    this._searchNavigationState.searchResults = [...this._searchResults];
    this.updateTreeSearchHighlights(this._searchResults);
    this.updateGraphSearchHighlights(this._searchResults);
    return [...this._searchResults];
  }
  // TODO: Use a library for this.
  private _findMatches(
    text: string,
    query: string,
  ): {
    matches: boolean;
    indices: number[][];
    isExact: boolean;
  } {
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
      const charIndices: number[][] = fuzzyIndices.map((i) => [i, i + 1]);
      return { matches: true, indices: charIndices, isExact: false };
    }
    return { matches: false, indices: [], isExact: false };
  }
  clearSearch(): void {
    // Clear old search state for backward compatibility
    this._searchResults = [];
    this._searchQuery = "";
    this._searchState.isActive = false;
    this._searchState.query = "";
    this._searchState.resultCount = 0;
    this._searchState.expandedContainers.clear();
    // Clear new search navigation state
    this._searchNavigationState.searchQuery = "";
    this._searchNavigationState.searchResults = [];
    this._searchNavigationState.treeSearchHighlights.clear();
    this._searchNavigationState.graphSearchHighlights.clear();
    // DO NOT clear navigation highlights - those are independent
    // Navigation highlights (blue borders from next/prev navigation) should persist
    // Note: Expansion state is preserved (expandedTreeNodes, expandedGraphContainers)
    // This matches the requirement that expansion state persists through search operations
  }

  /**
   * Enhanced search clearing that preserves expansion state AND navigation state
   * Only clears search highlights, not navigation highlights
   * Also cancels any pending debounced search operations
   */
  clearSearchEnhanced(): void {
    this.clearSearch();
    // Cancel any pending debounced search
    if (this._searchDebounceTimer !== null) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
  }
  // Search state getters (backward compatibility)
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
  searchByType(
    query: string,
    entityType: "node" | "container",
  ): SearchResult[] {
    const allResults = this.search(query);
    return allResults.filter((result) => result.type === entityType);
  }
  searchBySemanticTag(tag: string): SearchResult[] {
    this._searchResults = [];
    // Search nodes by semantic tags
    for (const node of this._nodes.values()) {
      if (
        node.semanticTags.some((nodeTag) =>
          nodeTag.toLowerCase().includes(tag.toLowerCase()),
        )
      ) {
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
      if (
        edge.semanticTags.some((edgeTag) =>
          edgeTag.toLowerCase().includes(tag.toLowerCase()),
        )
      ) {
        // Add source and target nodes if not already in results
        const sourceNode = this._nodes.get(edge.source);
        const targetNode = this._nodes.get(edge.target);
        if (
          sourceNode &&
          !this._searchResults.some((r) => r.id === sourceNode.id)
        ) {
          this._searchResults.push({
            id: sourceNode.id,
            label: sourceNode.label,
            type: "node",
            matchIndices: [[0, 0]],
          });
        }
        if (
          targetNode &&
          !this._searchResults.some((r) => r.id === targetNode.id)
        ) {
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
  // ============================================================================
  // ENHANCED SEARCH AND NAVIGATION METHODS
  // ============================================================================
  /**
   * Perform search with debouncing and caching
   */
  performSearchDebounced(
    query: string,
    callback?: (results: SearchResult[]) => void,
    debounceMs: number = 300,
  ): void {
    // Clear existing debounce timer
    if (this._searchDebounceTimer !== null) {
      clearTimeout(this._searchDebounceTimer);
    }
    // Set up new debounced search
    this._searchDebounceTimer = window.setTimeout(() => {
      const results = this.performSearch(query);
      if (callback) {
        callback(results);
      }
      this._searchDebounceTimer = null;
    }, debounceMs);
  }
  /**
   * Get cached search results if available and not expired
   */
  private _getCachedSearchResults(query: string): SearchResult[] | null {
    const trimmedQuery = query.trim().toLowerCase();
    if (!this._searchCache.has(trimmedQuery)) {
      return null;
    }
    const timestamp = this._searchCacheTimestamps.get(trimmedQuery);
    if (!timestamp || Date.now() - timestamp > this._searchCacheMaxAge) {
      // Cache expired, remove it
      this._searchCache.delete(trimmedQuery);
      this._searchCacheTimestamps.delete(trimmedQuery);
      return null;
    }
    return this._searchCache.get(trimmedQuery) || null;
  }
  /**
   * Cache search results with timestamp
   */
  private _cacheSearchResults(query: string, results: SearchResult[]): void {
    const trimmedQuery = query.trim().toLowerCase();
    // Skip caching empty queries (but cache queries with no results)
    if (!trimmedQuery) {
      return;
    }
    // Implement LRU cache eviction if we're at max size and adding a new entry
    if (
      this._searchCache.size >= this._searchCacheMaxSize &&
      !this._searchCache.has(trimmedQuery)
    ) {
      // Find oldest entry to evict
      let oldestKey: string | null = null;
      let oldestTime = Date.now();
      for (const [key, timestamp] of this._searchCacheTimestamps) {
        if (timestamp < oldestTime) {
          oldestTime = timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this._searchCache.delete(oldestKey);
        this._searchCacheTimestamps.delete(oldestKey);
      }
    }
    this._searchCache.set(trimmedQuery, [...results]);
    this._searchCacheTimestamps.set(trimmedQuery, Date.now());
  }
  /**
   * Clear search result cache
   */
  clearSearchCache(): void {
    this._searchCache.clear();
    this._searchCacheTimestamps.clear();
  }
  /**
   * Perform search with enhanced result generation including hierarchy paths and caching
   *
   * ⚠️ **WARNING: Do not call this method directly from UI components!**
   *
   * This method updates internal search state but does NOT regenerate ReactFlow data.
   * Calling it directly will result in search highlights not appearing in the graph.
   *
   * **Correct usage:**
   * - From AsyncCoordinator: Use `asyncCoordinator.updateSearchResults()` which handles
   *   the full pipeline: search → expand → highlight → render
   * - From tests: Direct calls are OK for unit testing internal behavior
   *
   * **Incorrect usage:**
   * - ❌ From SearchControls or other UI components
   * - ❌ From event handlers
   *
   * @internal This should only be called by AsyncCoordinator or tests
   */
  performSearch(query: string): SearchResult[] {
    // Warn in development if called outside of AsyncCoordinator context
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      const stack = new Error().stack || "";
      const isFromAsyncCoordinator = stack.includes("AsyncCoordinator");
      const isFromTest =
        stack.includes(".test.ts") || stack.includes(".test.tsx");

      if (!isFromAsyncCoordinator && !isFromTest) {
        console.warn(
          "⚠️ [VisualizationState] performSearch() called directly! " +
            "This will NOT update the graph visualization. " +
            "Use asyncCoordinator.updateSearchResults() instead.",
          "\nCall stack:",
          stack,
        );
      }
    }

    const trimmedQuery = query.trim();
    this._searchNavigationState.searchQuery = trimmedQuery;
    // Update backward compatibility state
    this._searchQuery = trimmedQuery;
    this._searchState.query = trimmedQuery;
    this._searchState.isActive = trimmedQuery.length > 0;
    this._searchState.lastSearchTime = Date.now();
    if (!trimmedQuery) {
      this._searchNavigationState.searchResults = [];
      this._searchResults = [];
      this._searchState.resultCount = 0;
      this.updateTreeSearchHighlights([]);
      this.updateGraphSearchHighlights([]);
      return [];
    }
    // Check cache first
    const cachedResults = this._getCachedSearchResults(trimmedQuery);
    if (cachedResults) {
      // Re-sort cached results by hierarchy order
      const hierarchyOrderMap = this._getHierarchyOrderMap();
      const sortedResults = [...cachedResults].sort((a, b) => {
        const orderA = hierarchyOrderMap.get(a.id) ?? Infinity;
        const orderB = hierarchyOrderMap.get(b.id) ?? Infinity;
        return orderA - orderB;
      });
      // Use sorted results and apply common post-processing
      return this._finalizeSearchResults(trimmedQuery, sortedResults);
    }
    const queryLower = trimmedQuery.toLowerCase();
    const results: SearchResult[] = [];

    // OPTIMIZED: Use search index for better performance
    this._buildSearchIndex();

    // Get candidate entity IDs from search index
    const candidateIds = new Set<string>();
    const queryWords = this._extractSearchWords(queryLower);

    if (queryWords.length > 0) {
      // For each query word, find matching entities
      for (const queryWord of queryWords) {
        // Exact word matches
        if (this._searchIndex.has(queryWord)) {
          for (const entityId of this._searchIndex.get(queryWord)!) {
            candidateIds.add(entityId);
          }
        }

        // Prefix and substring matches for partial words
        for (const [indexWord, entityIds] of this._searchIndex) {
          if (
            indexWord.startsWith(queryWord) ||
            queryWord.startsWith(indexWord) ||
            indexWord.includes(queryWord) // Allow substring matching (e.g., "keyed" in "foldkeyed")
          ) {
            for (const entityId of entityIds) {
              candidateIds.add(entityId);
            }
          }
        }
      }
    } else {
      // Fallback: search all entities for non-word queries
      for (const nodeId of this._nodes.keys()) {
        candidateIds.add(nodeId);
      }
      for (const containerId of this._containers.keys()) {
        candidateIds.add(containerId);
      }
    }

    // Process candidates with detailed matching
    for (const entityId of candidateIds) {
      const node = this._nodes.get(entityId);
      const container = this._containers.get(entityId);

      if (node) {
        const matchResult = this._findMatches(node.label, queryLower);
        if (matchResult.matches) {
          results.push({
            id: node.id,
            label: node.label,
            type: "node",
            matchIndices: matchResult.indices,
            hierarchyPath: this._getHierarchyPath(node.id),
            confidence: this._calculateSearchConfidence(
              node.label,
              queryLower,
              matchResult.isExact,
            ),
          });
        }
      } else if (container) {
        const matchResult = this._findMatches(container.label, queryLower);
        if (matchResult.matches) {
          results.push({
            id: container.id,
            label: container.label,
            type: "container",
            matchIndices: matchResult.indices,
            hierarchyPath: this._getHierarchyPath(container.id),
            confidence: this._calculateSearchConfidence(
              container.label,
              queryLower,
              matchResult.isExact,
            ),
          });
        }
      }
    }
    // Sort results by hierarchy tree order (depth-first traversal)
    // This ensures search results appear in the same order as the HierarchyTree component
    const hierarchyOrderMap = this._getHierarchyOrderMap();
    results.sort((a, b) => {
      const orderA = hierarchyOrderMap.get(a.id) ?? Infinity;
      const orderB = hierarchyOrderMap.get(b.id) ?? Infinity;
      return orderA - orderB;
    });
    // Apply common post-processing to new results
    return this._finalizeSearchResults(trimmedQuery, results);
  }
  /**
   * Finalize search results with common post-processing logic
   * Used by both cached and non-cached search paths to avoid duplication
   */
  private _finalizeSearchResults(
    trimmedQuery: string,
    results: SearchResult[],
  ): SearchResult[] {
    // Update both new and backward compatibility search states
    this._searchNavigationState.searchResults = results;
    this._searchResults = [...results];
    this._searchState.resultCount = results.length;
    // Add to search history if not empty
    if (trimmedQuery && results.length > 0) {
      // Remove existing entry if present
      const existingIndex = this._searchHistory.indexOf(trimmedQuery);
      if (existingIndex !== -1) {
        this._searchHistory.splice(existingIndex, 1);
      }
      // Add to front
      this._searchHistory.unshift(trimmedQuery);
      // Keep only last 10 searches
      if (this._searchHistory.length > 10) {
        this._searchHistory = this._searchHistory.slice(0, 10);
      }
    }
    // NOTE: We only update search highlights here, NOT container expansion state.
    // Container expansion is handled by:
    // 1. HierarchyTree component for tree view (via getTreeExpansionPath)
    // 2. LayoutOrchestrator.expandForSearch for graph view (via async operations)
    // This prevents unwanted side effects and double rendering.

    // Update highlights and cache results
    this.updateTreeSearchHighlights(results);
    this.updateGraphSearchHighlights(results);
    this._cacheSearchResults(trimmedQuery, results);
    return [...results];
  }
  /**
   * Update tree search highlights based on search results
   */
  updateTreeSearchHighlights(results: SearchResult[]): void {
    this._searchNavigationState.treeSearchHighlights.clear();
    for (const result of results) {
      this._searchNavigationState.treeSearchHighlights.add(result.id);
    }
    // Update collapsed ancestors containing matches
    this.updateCollapsedAncestorsInTree();
  }
  /**
   * Update graph search highlights - only highlight visible matches
   */
  updateGraphSearchHighlights(results: SearchResult[]): void {
    this._searchNavigationState.graphSearchHighlights.clear();

    for (const result of results) {
      // Only highlight if the element itself is visible
      if (this._isElementVisibleInGraph(result.id)) {
        this._searchNavigationState.graphSearchHighlights.add(result.id);
      }
    }
  }
  /**
   * Navigate to a specific element
   */
  navigateToElement(
    elementId: string,
    options?: { skipTemporaryHighlight?: boolean },
  ): void {
    this._searchNavigationState.navigationSelection = elementId;
    this._searchNavigationState.lastNavigationTarget = elementId;
    this._searchNavigationState.shouldFocusViewport = true;

    // Clear any existing navigation highlights before adding new ones
    this._searchNavigationState.treeNavigationHighlights.clear();
    this._searchNavigationState.graphNavigationHighlights.clear();

    // Add the element to navigation highlights
    this._searchNavigationState.treeNavigationHighlights.add(elementId);
    this._searchNavigationState.graphNavigationHighlights.add(elementId);

    // Set temporary highlight for visual feedback (glow effect) unless skipped
    if (!options?.skipTemporaryHighlight) {
      this.setTemporaryHighlight(elementId);
    }
  }

  /**
   * Clear navigation state (selection and highlights)
   * This clears navigation without affecting search highlights
   */
  clearNavigation(): void {
    this._searchNavigationState.navigationSelection = null;
    this._searchNavigationState.lastNavigationTarget = null;
    this._searchNavigationState.treeNavigationHighlights.clear();
    this._searchNavigationState.graphNavigationHighlights.clear();
    this._searchNavigationState.shouldFocusViewport = false;
    // Don't clear temporary highlights - they have their own lifecycle
  }

  /**
   * Set temporary highlight for an element (glow effect after click)
   * Adds a new highlight without clearing existing ones (allows concurrent glows)
   */
  setTemporaryHighlight(
    elementId: string,
    durationMs: number = NAVIGATION_TIMING.HIGHLIGHT_DURATION,
    onClear?: () => void,
  ): void {
    // Don't clear existing highlights - allow multiple concurrent glows
    const timestamp = Date.now();
    this._searchNavigationState.temporaryHighlights.add(elementId);
    this._searchNavigationState.temporaryHighlightTimestamps.set(
      elementId,
      timestamp,
    );

    // Also highlight the visible ancestor in the graph if element is hidden
    const lowestVisibleAncestor =
      this.getLowestVisibleAncestorInGraph(elementId);
    const highlightedElements = [elementId];
    if (lowestVisibleAncestor && lowestVisibleAncestor !== elementId) {
      this._searchNavigationState.temporaryHighlights.add(
        lowestVisibleAncestor,
      );
      this._searchNavigationState.temporaryHighlightTimestamps.set(
        lowestVisibleAncestor,
        timestamp,
      );
      highlightedElements.push(lowestVisibleAncestor);
    }

    // Auto-clear only these specific highlights after duration
    setTimeout(() => {
      // Remove only the highlights we added
      highlightedElements.forEach((id) => {
        this.removeTemporaryHighlight(id);
      });
      // Notify callback that highlights were cleared so React can re-render
      if (onClear) {
        onClear();
      }
    }, durationMs);
  }

  /**
   * Clear temporary highlights
   */
  clearTemporaryHighlights(): void {
    this._searchNavigationState.temporaryHighlights.clear();
    this._searchNavigationState.temporaryHighlightTimestamps.clear();
  }

  /**
   * Check if an element has temporary highlight (glow effect)
   */
  hasTemporaryHighlight(elementId: string): boolean {
    return this._searchNavigationState.temporaryHighlights.has(elementId);
  }

  /**
   * Get temporary highlight timestamp for a specific element
   * @param elementId - The element to get the timestamp for
   * @returns The timestamp when the highlight was set, or null if not highlighted
   */
  getTemporaryHighlightTimestamp(elementId: string): number | null {
    return (
      this._searchNavigationState.temporaryHighlightTimestamps.get(elementId) ??
      null
    );
  }

  /**
   * Add a temporary highlight to a node or container.
   * @param id - The ID of the node or container to highlight.
   */
  addTemporaryHighlight(id: string): void {
    this._searchNavigationState.temporaryHighlights.add(id);
    this._searchNavigationState.temporaryHighlightTimestamps.set(
      id,
      Date.now(),
    );
  }

  /**
   * Remove a temporary highlight from a node or container.
   * @param id - The ID of the node or container to remove the highlight from.
   */
  removeTemporaryHighlight(id: string): void {
    this._searchNavigationState.temporaryHighlights.delete(id);
    this._searchNavigationState.temporaryHighlightTimestamps.delete(id);
  }
  /**
   * Get highlight type for tree elements
   */
  getTreeElementHighlightType(
    elementId: string,
  ): "search" | "navigation" | "both" | null {
    const hasSearch =
      this._searchNavigationState.treeSearchHighlights.has(elementId);
    const hasNavigation =
      this._searchNavigationState.treeNavigationHighlights.has(elementId);
    if (hasSearch && hasNavigation) return "both";
    if (hasSearch) return "search";
    if (hasNavigation) return "navigation";
    return null;
  }
  /**
   * Get highlight type for graph elements
   */
  getGraphElementHighlightType(
    elementId: string,
  ): "search" | "navigation" | "both" | null {
    const hasSearch =
      this._searchNavigationState.graphSearchHighlights.has(elementId);
    const hasNavigation =
      this._searchNavigationState.graphNavigationHighlights.has(elementId);

    if (hasSearch && hasNavigation) {
      return "both";
    } else if (hasSearch) {
      return "search";
    } else if (hasNavigation) {
      return "navigation";
    }
    return null;
  }
  /**
   * Get the lowest visible ancestor in the ReactFlow graph for an element
   */
  getLowestVisibleAncestorInGraph(elementId: string): string | null {
    // If element is directly visible, return null (no ancestor needed)
    if (this._isElementVisibleInGraph(elementId)) {
      return null;
    }
    // Walk up the hierarchy to find the lowest visible ancestor
    const hierarchyPath = this._getHierarchyPath(elementId);
    // Start from the immediate parent and work up
    for (let i = hierarchyPath.length - 1; i >= 0; i--) {
      const ancestorId = hierarchyPath[i];
      if (this._isElementVisibleInGraph(ancestorId)) {
        return ancestorId;
      }
    }
    return null;
  }
  /**
   * Get the lowest visible ancestor in the tree hierarchy for an element
   */
  getLowestVisibleAncestorInTree(elementId: string): string | null {
    // If element is directly visible in tree, return null (no ancestor needed)
    if (this._isElementVisibleInTree(elementId)) {
      return null;
    }
    // Walk up the hierarchy to find the lowest visible ancestor
    const hierarchyPath = this._getHierarchyPath(elementId);
    // Start from the immediate parent and work up
    for (let i = hierarchyPath.length - 1; i >= 0; i--) {
      const ancestorId = hierarchyPath[i];
      if (this._isElementVisibleInTree(ancestorId)) {
        return ancestorId;
      }
    }
    return null;
  }
  // ============================================================================
  // TREE HIERARCHY EXPANSION METHODS
  // ============================================================================
  /**
   * Expand tree nodes (UI tree structure)
   */
  expandTreeNodes(containerIds: string[]): void {
    for (const containerId of containerIds) {
      this._searchNavigationState.expandedTreeNodes.add(containerId);
    }
  }
  /**
   * Collapse tree nodes (UI tree structure)
   */
  collapseTreeNodes(containerIds: string[]): void {
    for (const containerId of containerIds) {
      this._searchNavigationState.expandedTreeNodes.delete(containerId);
    }
  }
  /**
   * Get the expansion path needed to show an element in the tree
   */
  getTreeExpansionPath(elementId: string): string[] {
    const hierarchyPath = this._getHierarchyPath(elementId);
    return hierarchyPath.filter((ancestorId) => {
      const container = this._containers.get(ancestorId);
      return (
        container &&
        !this._searchNavigationState.expandedTreeNodes.has(ancestorId)
      );
    });
  }
  /**
   * Get the expansion path needed to show an element in the graph
   */
  getGraphExpansionPath(elementId: string): string[] {
    const hierarchyPath = this._getHierarchyPath(elementId);
    return hierarchyPath.filter((ancestorId) => {
      const container = this._containers.get(ancestorId);
      return container && container.collapsed;
    });
  }
  /**
   * Expand tree hierarchy to show search matches
   * This implements search-driven tree expansion logic that expands necessary parent nodes
   */
  expandTreeToShowMatches(searchResults: SearchResult[]): void {
    const containersToExpand = new Set<string>();
    for (const result of searchResults) {
      // Get the path of containers that need to be expanded to show this match
      const expansionPath = this.getTreeExpansionPath(result.id);
      for (const containerId of expansionPath) {
        containersToExpand.add(containerId);
      }
    }
    // Expand all necessary containers
    if (containersToExpand.size > 0) {
      // CRITICAL FIX: Expand containers in both tree state AND graph state
      this.expandTreeNodes(Array.from(containersToExpand)); // For HierarchyTree
      // Also expand containers in the actual graph visualization
      for (const containerId of containersToExpand) {
        const container = this._containers.get(containerId);
        if (container) {
          // CRITICAL FIX: Always expand containers that should contain search matches
          // Force expansion regardless of current state to ensure search results are visible
          if (container.collapsed) {
            this._expandContainerInternal(containerId);
          } else {
            // Even if already expanded, ensure it's properly shown and edges are restored
            // This handles cases where container was manually collapsed then search is performed
          }
        }
      }
    }
  }
  /**
   * Update collapsed ancestors highlighting in tree hierarchy
   * Highlights collapsed ancestors that contain search matches
   */
  updateCollapsedAncestorsInTree(): void {
    // Get all current search results
    const searchResults = this._searchNavigationState.searchResults;
    for (const result of searchResults) {
      const hierarchyPath = result.hierarchyPath || [];
      for (const ancestorId of hierarchyPath) {
        // Check if this ancestor is collapsed in the tree
        if (!this._searchNavigationState.expandedTreeNodes.has(ancestorId)) {
          const container = this._containers.get(ancestorId);
          if (container) {
            // Highlight this collapsed ancestor as it contains matches
            this._searchNavigationState.treeSearchHighlights.add(ancestorId);
          }
        }
      }
    }
  }
  // ============================================================================
  // SEARCH AND NAVIGATION STATE GETTERS
  // ============================================================================
  /**
   * Get current search query (enhanced version)
   */
  getSearchQueryEnhanced(): string {
    return this._searchNavigationState.searchQuery;
  }
  /**
   * Get current search results (enhanced version)
   */
  getSearchResultsEnhanced(): ReadonlyArray<SearchResult> {
    return [...this._searchNavigationState.searchResults];
  }
  /**
   * Get current search result (the one being navigated to)
   */
  getCurrentSearchResult(): SearchResult | null {
    // For now, return the first search result if any exist
    // This can be enhanced later to track which result is currently selected
    const results = this._searchNavigationState.searchResults;
    return results.length > 0 ? results[0] : null;
  }
  /**
   * Get current navigation selection
   */
  getNavigationSelection(): string | null {
    return this._searchNavigationState.navigationSelection;
  }
  /**
   * Get tree search highlights
   */
  getTreeSearchHighlights(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.treeSearchHighlights);
  }
  /**
   * Get graph search highlights
   */
  getGraphSearchHighlights(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.graphSearchHighlights);
  }
  /**
   * Get tree navigation highlights
   */
  getTreeNavigationHighlights(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.treeNavigationHighlights);
  }
  /**
   * Get graph navigation highlights
   */
  getGraphNavigationHighlights(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.graphNavigationHighlights);
  }
  /**
   * Get expanded tree nodes
   */
  getExpandedTreeNodes(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.expandedTreeNodes);
  }
  /**
   * Get expanded graph containers
   */
  getExpandedGraphContainers(): ReadonlySet<string> {
    return new Set(this._searchNavigationState.expandedGraphContainers);
  }
  /**
   * Check if viewport should focus on navigation target
   */
  getShouldFocusViewport(): boolean {
    return this._searchNavigationState.shouldFocusViewport;
  }
  /**
   * Get last navigation target
   */
  getLastNavigationTarget(): string | null {
    return this._searchNavigationState.lastNavigationTarget;
  }
  /**
   * Reset viewport focus flag
   */
  resetViewportFocus(): void {
    this._searchNavigationState.shouldFocusViewport = false;
  }
  /**
   * Get search cache statistics
   */
  getSearchCacheStats(): {
    size: number;
    maxSize: number;
    maxAge: number;
  } {
    return {
      size: this._searchCache.size,
      maxSize: this._searchCacheMaxSize,
      maxAge: this._searchCacheMaxAge,
    };
  }
  /**
   * Check if a search is currently debouncing
   */
  isSearchDebouncing(): boolean {
    return this._searchDebounceTimer !== null;
  }
  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================
  /**
   * Calculate hierarchy path from root to element
   */
  private _getHierarchyPath(elementId: string): string[] {
    const path: string[] = [];
    // Check if it's a node
    let currentContainer = this._nodeContainerMap.get(elementId);
    // If not a node, check if it's a container
    if (!currentContainer && this._containers.has(elementId)) {
      currentContainer = this._containerParentMap.get(elementId);
    }
    // Walk up the hierarchy
    while (currentContainer) {
      path.unshift(currentContainer);
      currentContainer = this._containerParentMap.get(currentContainer);
    }
    return path;
  }
  /**
   * Calculate search confidence score
   */
  private _calculateSearchConfidence(
    label: string,
    query: string,
    isExact: boolean,
  ): number {
    if (isExact) {
      // Exact matches get higher scores
      if (label.toLowerCase() === query) return 1.0; // Perfect match
      if (label.toLowerCase().startsWith(query)) return 0.9; // Starts with query
      return 0.8; // Contains query
    }
    // Fuzzy matches get lower scores
    return 0.5;
  }
  /**
   * Get hierarchy order map for sorting search results
   */
  private _getHierarchyOrderMap(): Map<string, number> {
    const orderMap: Map<string, number> = getHierarchyOrderMap(this);
    return orderMap;
  }

  /**
   * Check if element is visible in the ReactFlow graph
   */
  private _isElementVisibleInGraph(elementId: string): boolean {
    const node = this._nodes.get(elementId);
    if (node) {
      return !node.hidden;
    }
    const container = this._containers.get(elementId);
    if (container) {
      return !container.hidden;
    }
    return false;
  }
  /**
   * Check if element is visible in the tree hierarchy
   */
  private _isElementVisibleInTree(elementId: string): boolean {
    // In tree hierarchy, visibility is determined by expansion state
    // An element is visible if all its ancestors are expanded
    const hierarchyPath = this._getHierarchyPath(elementId);
    for (const ancestorId of hierarchyPath) {
      if (!this._searchNavigationState.expandedTreeNodes.has(ancestorId)) {
        return false;
      }
    }
    return true;
  }
  // Tree Hierarchy Expansion Methods (Enhanced)
  /**
   * Check if a tree container is collapsed and contains search matches
   * Used for special highlighting of collapsed containers with matches
   */
  isCollapsedTreeContainerWithMatches(containerId: string): boolean {
    // Container must not be expanded in tree
    if (this._searchNavigationState.expandedTreeNodes.has(containerId)) {
      return false;
    }
    // Check if any search results are descendants of this container
    const descendants = this._getAllDescendantIds(containerId);
    for (const result of this._searchNavigationState.searchResults) {
      if (descendants.has(result.id)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Get all tree containers that are collapsed but contain search matches
   * Used for applying special highlighting to collapsed ancestors
   */
  getCollapsedTreeContainersWithMatches(): string[] {
    const collapsedWithMatches: string[] = [];
    for (const [containerId] of this._containers) {
      if (this.isCollapsedTreeContainerWithMatches(containerId)) {
        collapsedWithMatches.push(containerId);
      }
    }
    return collapsedWithMatches;
  }
  // Cache Management
  private _invalidateAllCaches(): void {
    this._cacheVersion++;
    this._rootContainersCache = null;
    this._descendantCache.clear();
    this._ancestorCache.clear();
    this._invalidateSearchIndex();
  }

  private _invalidateVisibilityCache(): void {}

  private _invalidateSearchIndex(): void {
    this._searchIndex.clear();
    this._searchIndexVersion++;
  }

  /**
   * Build search index for faster text searching
   */
  private _buildSearchIndex(): void {
    if (
      this._searchIndex.size > 0 &&
      this._searchIndexVersion === this._cacheVersion
    ) {
      return; // Index is up to date
    }

    this._searchIndex.clear();

    // Index nodes
    for (const [nodeId, node] of this._nodes) {
      const words = this._extractSearchWords(node.label);
      for (const word of words) {
        if (!this._searchIndex.has(word)) {
          this._searchIndex.set(word, new Set());
        }
        this._searchIndex.get(word)!.add(nodeId);
      }
    }

    // Index containers
    for (const [containerId, container] of this._containers) {
      const words = this._extractSearchWords(container.label);
      for (const word of words) {
        if (!this._searchIndex.has(word)) {
          this._searchIndex.set(word, new Set());
        }
        this._searchIndex.get(word)!.add(containerId);
      }
    }

    this._searchIndexVersion = this._cacheVersion;
  }

  /**
   * Extract searchable words from a label
   */
  private _extractSearchWords(label: string): string[] {
    return label
      .toLowerCase()
      .split(/[\s\-_.]+/)
      .filter((word) => word.length > 0);
  }

  getPerformanceMetrics(): {
    operationCounts: Map<string, number>;
    averageTimes: Map<string, number>;
    recommendations: string[];
  } {
    const averageTimes = new Map<string, number>();
    const recommendations: string[] = [];
    for (const [operation, times] of this._performanceMetrics.operationTimes) {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      averageTimes.set(operation, avg);
      // Generate recommendations based on performance
      if (avg > 50 && operation.includes("search")) {
        recommendations.push(
          `Search operations averaging ${avg.toFixed(2)}ms - consider search indexing`,
        );
      }
      if (avg > 100 && operation.includes("container")) {
        recommendations.push(
          `Container operations averaging ${avg.toFixed(2)}ms - consider lazy loading`,
        );
      }
    }
    return {
      operationCounts: new Map(this._performanceMetrics.operationCounts),
      averageTimes,
      recommendations,
    };
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
    violations: InvariantViolation[],
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
    violations: InvariantViolation[],
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
      // FIXED: Use the actual rendered dimensions for collapsed containers
      // Collapsed containers always render with fixed dimensions from config
      const actualWidth = SIZES.COLLAPSED_CONTAINER_WIDTH; // 200
      const actualHeight = SIZES.COLLAPSED_CONTAINER_HEIGHT; // 150
      // Only check if the actual rendered dimensions are problematic
      const maxAllowedWidth = 300; // Reasonable threshold
      const maxAllowedHeight = 300;
      if (actualWidth > maxAllowedWidth || actualHeight > maxAllowedHeight) {
        violations.push({
          type: "COLLAPSED_CONTAINER_LARGE_DIMENSIONS",
          message: `Collapsed container ${containerId} has large rendered dimensions (${actualWidth}x${actualHeight}) that may cause layout issues`,
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
        errors,
      );
      throw new Error(
        `VisualizationState invariant violations: ${errors.map((e) => e.message).join("; ")}`,
      );
    }
  }
  // State Persistence Methods
  /**
   * Create a snapshot of the current search and navigation state for persistence
   */
  createStateSnapshot(): string {
    const snapshot = {
      version: this._stateVersion,
      timestamp: Date.now(),
      searchNavigationState: {
        searchQuery: this._searchNavigationState.searchQuery,
        searchResults: this._searchNavigationState.searchResults,
        treeSearchHighlights: Array.from(
          this._searchNavigationState.treeSearchHighlights,
        ),
        graphSearchHighlights: Array.from(
          this._searchNavigationState.graphSearchHighlights,
        ),
        navigationSelection: this._searchNavigationState.navigationSelection,
        treeNavigationHighlights: Array.from(
          this._searchNavigationState.treeNavigationHighlights,
        ),
        graphNavigationHighlights: Array.from(
          this._searchNavigationState.graphNavigationHighlights,
        ),
        expandedTreeNodes: Array.from(
          this._searchNavigationState.expandedTreeNodes,
        ),
        expandedGraphContainers: Array.from(
          this._searchNavigationState.expandedGraphContainers,
        ),
        lastNavigationTarget: this._searchNavigationState.lastNavigationTarget,
        shouldFocusViewport: this._searchNavigationState.shouldFocusViewport,
      },
      // Include backward compatibility state
      searchState: {
        isActive: this._searchState.isActive,
        query: this._searchState.query,
        resultCount: this._searchState.resultCount,
        lastSearchTime: this._searchState.lastSearchTime,
        expandedContainers: Array.from(this._searchState.expandedContainers),
      },
      searchQuery: this._searchQuery,
      searchResults: this._searchResults,
      searchHistory: this._searchHistory,
    };
    this._lastStateSnapshot = JSON.stringify(snapshot);
    return this._lastStateSnapshot;
  }
  /**
   * Restore state from a snapshot
   */
  restoreStateSnapshot(snapshotJson: string): boolean {
    try {
      const snapshot = JSON.parse(snapshotJson);
      // Version compatibility check
      if (snapshot.version !== this._stateVersion) {
        console.warn(
          `[VisualizationState] State snapshot version mismatch: expected ${this._stateVersion}, got ${snapshot.version}`,
        );
        return false;
      }
      // Restore search navigation state
      if (snapshot.searchNavigationState) {
        const sns = snapshot.searchNavigationState;
        this._searchNavigationState.searchQuery = sns.searchQuery || "";
        this._searchNavigationState.searchResults = sns.searchResults || [];
        this._searchNavigationState.treeSearchHighlights = new Set(
          sns.treeSearchHighlights || [],
        );
        this._searchNavigationState.graphSearchHighlights = new Set(
          sns.graphSearchHighlights || [],
        );
        this._searchNavigationState.navigationSelection =
          sns.navigationSelection || null;
        this._searchNavigationState.treeNavigationHighlights = new Set(
          sns.treeNavigationHighlights || [],
        );
        this._searchNavigationState.graphNavigationHighlights = new Set(
          sns.graphNavigationHighlights || [],
        );
        this._searchNavigationState.expandedTreeNodes = new Set(
          sns.expandedTreeNodes || [],
        );
        this._searchNavigationState.expandedGraphContainers = new Set(
          sns.expandedGraphContainers || [],
        );
        this._searchNavigationState.lastNavigationTarget =
          sns.lastNavigationTarget || null;
        this._searchNavigationState.shouldFocusViewport =
          sns.shouldFocusViewport || false;
      }
      // Restore backward compatibility state
      if (snapshot.searchState) {
        const ss = snapshot.searchState;
        this._searchState.isActive = ss.isActive || false;
        this._searchState.query = ss.query || "";
        this._searchState.resultCount = ss.resultCount || 0;
        this._searchState.lastSearchTime = ss.lastSearchTime || 0;
        this._searchState.expandedContainers = new Set(
          ss.expandedContainers || [],
        );
      }
      this._searchQuery = snapshot.searchQuery || "";
      this._searchResults = snapshot.searchResults || [];
      this._searchHistory = snapshot.searchHistory || [];
      this._lastStateSnapshot = snapshotJson;
      return true;
    } catch (error) {
      console.error(
        "[VisualizationState] Failed to restore state snapshot:",
        error,
      );
      return false;
    }
  }
  /**
   * Check if the current state has changed since the last snapshot
   */
  hasStateChanged(): boolean {
    if (!this._lastStateSnapshot) {
      return true; // No previous snapshot, consider it changed
    }
    try {
      const lastSnapshot = JSON.parse(this._lastStateSnapshot);
      const currentState = {
        searchNavigationState: {
          searchQuery: this._searchNavigationState.searchQuery,
          searchResults: this._searchNavigationState.searchResults,
          treeSearchHighlights: Array.from(
            this._searchNavigationState.treeSearchHighlights,
          ),
          graphSearchHighlights: Array.from(
            this._searchNavigationState.graphSearchHighlights,
          ),
          navigationSelection: this._searchNavigationState.navigationSelection,
          treeNavigationHighlights: Array.from(
            this._searchNavigationState.treeNavigationHighlights,
          ),
          graphNavigationHighlights: Array.from(
            this._searchNavigationState.graphNavigationHighlights,
          ),
          expandedTreeNodes: Array.from(
            this._searchNavigationState.expandedTreeNodes,
          ),
          expandedGraphContainers: Array.from(
            this._searchNavigationState.expandedGraphContainers,
          ),
          lastNavigationTarget:
            this._searchNavigationState.lastNavigationTarget,
          shouldFocusViewport: this._searchNavigationState.shouldFocusViewport,
        },
        searchState: {
          isActive: this._searchState.isActive,
          query: this._searchState.query,
          resultCount: this._searchState.resultCount,
          expandedContainers: Array.from(this._searchState.expandedContainers),
        },
        searchQuery: this._searchQuery,
        searchResults: this._searchResults,
        searchHistory: this._searchHistory,
      };
      // Compare state objects (excluding timestamps)
      return (
        JSON.stringify(currentState) !==
        JSON.stringify({
          searchNavigationState: lastSnapshot.searchNavigationState,
          searchState: {
            isActive: lastSnapshot.searchState?.isActive,
            query: lastSnapshot.searchState?.query,
            resultCount: lastSnapshot.searchState?.resultCount,
            expandedContainers: lastSnapshot.searchState?.expandedContainers,
          },
          searchQuery: lastSnapshot.searchQuery,
          searchResults: lastSnapshot.searchResults,
          searchHistory: lastSnapshot.searchHistory,
        })
      );
    } catch (error) {
      console.warn(
        "[VisualizationState] Error comparing state snapshots:",
        error,
      );
      return true; // Assume changed if comparison fails
    }
  }
  /**
   * Get the current state version for compatibility checking
   */
  getStateVersion(): number {
    return this._stateVersion;
  }
  /**
   * Clear all debounce timers (useful for cleanup)
   */
  clearDebounceTimers(): void {
    if (this._searchDebounceTimer !== null) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
  }
  /**
   * Get the search and navigation state for error handling and external access
   */
  get searchNavigationState(): SearchNavigationState {
    return this._searchNavigationState;
  }
  // ENHANCEMENT: Missing methods for integration
  /**
   * Get a graph edge by ID
   */
  getEdge(id: string): GraphEdge | undefined {
    return this._edges.get(id);
  }
  /**
   * Get all containers (including hidden ones)
   */
  getAllContainers(): Container[] {
    return Array.from(this._containers.values());
  }

  /**
   * Get the total element count (nodes + containers) for validation suppression
   */
  get totalElementCount(): number {
    return this._totalElementCount;
  }

  /**
   * Set the total element count (used by JSONParser)
   */
  setTotalElementCount(count: number): void {
    this._totalElementCount = count;
  }
  /**
   * Find the lowest visible ancestor for edge aggregation
   * This is specifically for edge aggregation - it returns the entity itself if visible,
   * or the lowest visible ancestor if the entity is hidden
   */
  private _findLowestVisibleAncestorForAggregation(
    entityId: string,
  ): string | null {
    // First check if the entity itself is visible
    const node = this._nodes.get(entityId);
    const container = this._containers.get(entityId);
    if (node) {
    }
    if (container) {
    }
    if (node && !node.hidden) {
      return entityId;
    }
    if (container && !container.hidden) {
      return entityId;
    }
    // Entity is hidden, find the lowest visible ancestor
    // Start by finding what container contains this entity
    let currentContainerId =
      this._nodeContainerMap.get(entityId) ||
      this._containerParentMap.get(entityId);
    // Traverse up the hierarchy to find a visible container
    while (currentContainerId) {
      const currentContainer = this._containers.get(currentContainerId);
      if (currentContainer && !currentContainer.hidden) {
        return currentContainerId;
      }
      // Move up to the parent container
      const nextParent = this._containerParentMap.get(currentContainerId);
      currentContainerId = nextParent;
    }
    // No visible ancestor found
    return null;
  }

  // ============ MANUAL VISIBILITY CONTROL ============

  /**
   * Check if a node is manually hidden via eye toggle
   */
  isNodeManuallyHidden(nodeId: string): boolean {
    return this._manuallyHiddenNodes.has(nodeId);
  }

  /**
   * Check if a container is manually hidden via eye toggle
   */
  isContainerManuallyHidden(containerId: string): boolean {
    return this._manuallyHiddenContainers.has(containerId);
  }

  /**
   * Toggle visibility of a node via eye icon
   * When hiding, node simply disappears from view
   * When showing, node reappears (no state to restore for leaf nodes)
   */
  toggleNodeVisibility(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) {
      console.warn(`[VisualizationState] Node ${nodeId} not found`);
      return;
    }

    if (this._manuallyHiddenNodes.has(nodeId)) {
      // Show the node
      this._manuallyHiddenNodes.delete(nodeId);
      this._hiddenStateSnapshots.delete(nodeId);
      hscopeLogger.log("orchestrator", `👁️ Showing node ${nodeId}`);
    } else {
      // Hide the node
      this._manuallyHiddenNodes.add(nodeId);
      hscopeLogger.log("orchestrator", `🙈 Hiding node ${nodeId}`);
    }

    // Invalidate caches
    this._invalidateAllCaches();
  }

  /**
   * Toggle visibility of a container via eye icon
   * When hiding: saves collapse/expand state of container and all descendants
   * When showing: restores the saved collapse/expand state
   */
  toggleContainerVisibility(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) {
      console.warn(`[VisualizationState] Container ${containerId} not found`);
      return;
    }

    if (this._manuallyHiddenContainers.has(containerId)) {
      // Show the container and restore its state
      this._showContainerAndRestoreState(containerId);
    } else {
      // Hide the container and save its state
      this._hideContainerAndSaveState(containerId);
    }

    // Invalidate caches
    this._invalidateAllCaches();
  }

  /**
   * Hide a container and recursively save the collapse/expand state of it and all descendants
   */
  private _hideContainerAndSaveState(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    hscopeLogger.log("orchestrator", `🙈 Hiding container ${containerId}`);

    // Capture current state of this container and all descendants
    const snapshot = this._captureContainerStateRecursive(containerId);
    this._hiddenStateSnapshots.set(containerId, snapshot);

    // Mark as manually hidden
    this._manuallyHiddenContainers.add(containerId);

    // Hide all descendant containers
    this._hideAllDescendantContainers(containerId);

    // Hide all nodes within this container and descendants
    const allDescendants = this._getAllDescendantIds(containerId);
    hscopeLogger.log(
      "validation",
      `[VisualizationState] Hiding container ${containerId}, descendants:`,
      Array.from(allDescendants),
    );
    for (const descendantId of allDescendants) {
      const node = this._nodes.get(descendantId);
      if (node) {
        this._manuallyHiddenNodes.add(descendantId);
        node.hidden = true;
      }
    }

    // Hide edges that connect to hidden nodes/containers
    for (const edge of this._edges.values()) {
      if (
        allDescendants.has(edge.source) ||
        allDescendants.has(edge.target) ||
        edge.source === containerId ||
        edge.target === containerId
      ) {
        edge.hidden = true;
      }
    }
  }

  /**
   * Show a container and recursively restore the collapse/expand state of it and all descendants
   */
  private _showContainerAndRestoreState(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    hscopeLogger.log("orchestrator", `👁️ Showing container ${containerId}`);

    // Get the saved snapshot
    const snapshot = this._hiddenStateSnapshots.get(containerId);

    // Remove from manually hidden set
    this._manuallyHiddenContainers.delete(containerId);
    this._hiddenStateSnapshots.delete(containerId);

    // Restore state if we have a snapshot
    if (snapshot) {
      this._restoreContainerStateRecursive(containerId, snapshot);
    }

    // Show all descendant containers that should be visible
    this._showDescendantContainersBasedOnSnapshot(containerId, snapshot);

    // Show all nodes within this container and descendants
    const allDescendants = this._getAllDescendantIds(containerId);
    for (const descendantId of allDescendants) {
      const node = this._nodes.get(descendantId);
      if (node) {
        this._manuallyHiddenNodes.delete(descendantId);
        node.hidden = false;
      }
    }

    // Show edges that were hidden when we hid this container
    // Only show edges that involve this container or its descendants
    for (const edge of this._edges.values()) {
      if (
        allDescendants.has(edge.source) ||
        allDescendants.has(edge.target) ||
        edge.source === containerId ||
        edge.target === containerId
      ) {
        // Check if both endpoints are now visible
        const sourceNode = this._nodes.get(edge.source);
        const targetNode = this._nodes.get(edge.target);
        const sourceContainer = this._containers.get(edge.source);
        const targetContainer = this._containers.get(edge.target);

        const sourceVisible =
          (sourceNode && !sourceNode.hidden) ||
          (sourceContainer && !sourceContainer.hidden);
        const targetVisible =
          (targetNode && !targetNode.hidden) ||
          (targetContainer && !targetContainer.hidden);

        if (sourceVisible && targetVisible) {
          edge.hidden = false;
        }
      }
    }
  }

  /**
   * Recursively capture the state of a container and all its descendants
   */
  private _captureContainerStateRecursive(containerId: string): {
    collapsed?: boolean;
    childStates?: Map<
      string,
      { collapsed?: boolean; manuallyHidden?: boolean }
    >;
  } {
    const container = this._containers.get(containerId);
    if (!container) return {};

    const snapshot: {
      collapsed?: boolean;
      childStates?: Map<
        string,
        { collapsed?: boolean; manuallyHidden?: boolean }
      >;
    } = {
      collapsed: container.collapsed,
      childStates: new Map(),
    };

    // Capture state of all child containers recursively
    for (const childId of container.children) {
      const childContainer = this._containers.get(childId);
      if (childContainer) {
        const childSnapshot = this._captureContainerStateRecursive(childId);
        snapshot.childStates!.set(childId, {
          collapsed: childSnapshot.collapsed,
          manuallyHidden: this._manuallyHiddenContainers.has(childId),
        });
      }
    }

    return snapshot;
  }

  /**
   * Recursively restore the state of a container from a snapshot
   */
  private _restoreContainerStateRecursive(
    containerId: string,
    snapshot: {
      collapsed?: boolean;
      childStates?: Map<
        string,
        { collapsed?: boolean; manuallyHidden?: boolean }
      >;
    },
  ): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    // Restore collapsed state of this container
    if (snapshot.collapsed !== undefined) {
      container.collapsed = snapshot.collapsed;
      if (snapshot.collapsed) {
        this._searchNavigationState.expandedGraphContainers.delete(containerId);
      } else {
        this._searchNavigationState.expandedGraphContainers.add(containerId);
      }
    }

    // Restore child container states
    if (snapshot.childStates) {
      for (const [childId, childState] of snapshot.childStates) {
        const childContainer = this._containers.get(childId);
        if (childContainer && childState.collapsed !== undefined) {
          childContainer.collapsed = childState.collapsed;
          if (childState.collapsed) {
            this._searchNavigationState.expandedGraphContainers.delete(childId);
          } else {
            this._searchNavigationState.expandedGraphContainers.add(childId);
          }
        }
      }
    }
  }

  /**
   * Hide all descendant containers when parent is hidden
   */
  private _hideAllDescendantContainers(containerId: string): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    for (const childId of container.children) {
      const childContainer = this._containers.get(childId);
      if (childContainer) {
        this._manuallyHiddenContainers.add(childId);
        childContainer.hidden = true;
        // Recursively hide descendants
        this._hideAllDescendantContainers(childId);
      }
    }
  }

  /**
   * Show descendant containers based on their saved manually hidden state
   */
  private _showDescendantContainersBasedOnSnapshot(
    containerId: string,
    snapshot?: {
      collapsed?: boolean;
      childStates?: Map<
        string,
        { collapsed?: boolean; manuallyHidden?: boolean }
      >;
    },
  ): void {
    const container = this._containers.get(containerId);
    if (!container) return;

    for (const childId of container.children) {
      const childContainer = this._containers.get(childId);
      if (childContainer) {
        // Check if this child was manually hidden before parent was hidden
        const wasManuallyHidden =
          snapshot?.childStates?.get(childId)?.manuallyHidden;

        if (!wasManuallyHidden) {
          // Child was not manually hidden, so show it
          this._manuallyHiddenContainers.delete(childId);
          childContainer.hidden = false;
        }
        // Note: if it WAS manually hidden, leave it in the hidden set

        // Recursively process descendants
        const childSnapshot = snapshot?.childStates?.get(childId);
        if (childSnapshot) {
          this._showDescendantContainersBasedOnSnapshot(childId, childSnapshot);
        }
      }
    }
  }
}
