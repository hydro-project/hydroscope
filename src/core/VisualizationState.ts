/**
 * Visualization State - Core Data Structure (Refactored)
 *
 * Maintains the mutable state of the visualization including nodes, edges, containers, and hyperEdges.
 * Provides efficient access to visible/non-hidden elements through Maps and collections.
 */

import type { GraphNode, GraphEdge, Container, LayoutState } from '../shared/types';
import type { NodeStyle, EdgeStyle as _EdgeStyle } from '../shared/config';

import type { Edge, HyperEdge } from './types';

// Specific interface for collapsed containers rendered as nodes
interface CollapsedContainerNode extends Container {
  x: number;
  y: number;
  label: string;
  style: string;
  type: 'container-node';
  collapsed: true;
}
import { LAYOUT_CONSTANTS, SIZES } from '../shared/config';

// Import specialized operation classes
import { VisualizationStateInvariantValidator } from './validation/VisualizationStateValidator';
import { ValidationConfigs, wrapPublicMethods } from './validation/ValidationWrapper';
import { ContainerOperations } from './operations/ContainerOperations';
import { VisibilityManager } from './operations/VisibilityManager';
import { CoveredEdgesIndex } from './CoveredEdgesIndex';
import { LayoutOperations } from './operations/LayoutOperations';

// Raw data interfaces for external input (before processing into GraphNode/GraphEdge/Container)
interface RawNodeData {
  id?: string;
  label?: string;
  shortLabel?: string;
  fullLabel?: string;
  style?: string;
  hidden?: boolean;
  width?: number;
  height?: number;
  [key: string]: unknown; // Allow additional properties from external sources
}

interface RawEdgeData {
  id?: string;
  source?: string;
  target?: string;
  style?: string;
  hidden?: boolean;
  type?: string;
  edgeProperties?: string[];
  [key: string]: unknown;
}

interface RawContainerData {
  id?: string;
  label?: string;
  collapsed?: boolean;
  hidden?: boolean;
  children?: string[] | Set<string>;
  [key: string]: unknown;
}

interface RawHyperEdgeData {
  id?: string;
  source?: string;
  target?: string;
  style?: string;
  hidden?: boolean;
  type?: 'hyper';
  edgeProperties?: string[];
  [key: string]: unknown;
}

/**
 * Core visualization state class that manages all graph elements including nodes, edges,
 * containers, and hyperEdges. Provides both mutable APIs for state management and
 * read-only APIs for rendering systems.
 *
 * Key Design Principles:
 * - Encapsulated state with controlled access via getters/setters
 * - Automatic consistency maintenance through invariant validation
 * - Separation of concerns through specialized operation classes
 * - Bridge pattern for backwards compatibility with existing systems
 *
 * @class VisualizationState
 *
 * @example
 * ```typescript
 * const state = new VisualizationState();
 * state.addGraphNode('node1', { type: 'operator', style: 'default' });
 * state.addContainer('container1', { children: ['node1'] });
 * state.setContainerState('container1', { collapsed: true });
 * ```
 */
export class VisualizationState {
  // Protected state collections - NEVER access directly!
  private readonly _collections = {
    graphNodes: new Map<string, GraphNode>(),
    graphEdges: new Map<string, GraphEdge>(),
    containers: new Map<string, Container>(),
    hyperEdges: new Map<string, HyperEdge>(),
    _visibleNodes: new Map<string, GraphNode>(),
    _visibleEdges: new Map<string, Edge>(),
    _visibleContainers: new Map<string, Container>(),
    _expandedContainers: new Map<string, Container>(),
    _collapsedContainers: new Map<string, Container>(),
    _nodeToEdges: new Map<string, Set<string>>(),
    _manualPositions: new Map<string, { x: number; y: number }>(),
    _containerChildren: new Map<string, Set<string>>(),
    _nodeContainers: new Map<string, string>(),

    // Additional indexes
    _nodeParentMap: new Map<string, string>(), // nodeId -> parentContainerId (O(1) parent lookup)
    _containerParentMap: new Map<string, string>(), // containerId -> parentContainerId (O(1) container parent lookup)
    _containerLeafCounts: new Map<string, number>(), // containerId -> immediate leaf node count
    _containerLeafNodes: new Map<string, GraphNode[]>(), // containerId -> immediate leaf nodes array
    _recursiveLeafCounts: new Map<string, number>(), // containerId -> recursive leaf node count (memoized)

    // Track active keys to prevent duplicates at React rendering level
    _activeRenderKeys: new Set<string>(),
  };

  // Specialized operation classes
  private readonly invariantValidator: VisualizationStateInvariantValidator;
  private readonly containerOps: ContainerOperations;
  private readonly visibilityManager: VisibilityManager;
  private readonly layoutOps: LayoutOperations;

  // Track containers in transition state to suppress spurious warnings
  private readonly _recentlyCollapsedContainers = new Set<string>();
  private readonly _recentlyExpandedContainers = new Set<string>();

  // Flag to control validation during transitions
  public _validationEnabled = true;
  public _validationLevel: 'strict' | 'normal' | 'minimal' | 'silent' = 'normal';
  public _validationInProgress = false;

  // Layout control interface for optimization
  private _layoutController: {
    suspendAutoLayout?: () => void;
    resumeAutoLayout?: (triggerLayout?: boolean) => void;
  } | null = null;

  // Viewport dimensions for layout calculations
  private _viewport: { width: number; height: number } | null = null;

  // Covered edges index for efficient aggregated edge queries
  private _coveredEdgesIndex: CoveredEdgesIndex | null = null;

  // Track the most recently changed container for selective layout
  private _lastChangedContainer: string | null = null;

  // Lazy initialization flags for efficient caches
  private _cacheInitialized = false;

  // RACE CONDITION FIX: Layout lock to prevent concurrent modifications during ELK processing
  private _layoutLock = false;
  private _layoutLockQueue: Array<() => void> = [];

  // ============ LAYOUT LOCK METHODS ============
  // Prevent race conditions during ELK processing

  /**
   * Acquire layout lock to prevent concurrent modifications during ELK processing
   */
  acquireLayoutLock(): void {
    this._layoutLock = true;
  }

  /**
   * Release layout lock and process any queued modifications
   */
  releaseLayoutLock(): void {
    this._layoutLock = false;

    // Process queued modifications
    const queue = [...this._layoutLockQueue];
    this._layoutLockQueue = [];

    if (queue.length > 0) {
      console.error(`[VisualizationState] Processing ${queue.length} queued operations`);
    }

    for (const operation of queue) {
      try {
        operation();
      } catch (error) {
        console.error('[VisualizationState] ❌ Error processing queued operation:', error);
      }
    }
  }

  /**
   * Check if a modification should be blocked or queued due to layout lock
   */
  private _checkLayoutLock(operationName: string, operation: () => void): boolean {
    if (this._layoutLock) {
      this._layoutLockQueue.push(operation);
      return true; // Operation was queued
    }
    return false; // Operation can proceed
  }

  // ============ BRIDGE PATTERN ACCESSORS ============
  // These provide indirect access for specialized operations classes
  private get _containerChildren(): Map<string, Set<string>> {
    return this._collections._containerChildren;
  }

  // ============ CONSTRUCTOR ============

  /**
   * Create a new VisualizationState instance
   * @constructor
   */
  constructor() {
    // Initialize specialized operation classes
    this.invariantValidator = new VisualizationStateInvariantValidator(this);
    this.containerOps = new ContainerOperations(this);
    this.visibilityManager = new VisibilityManager(this);
    this.layoutOps = new LayoutOperations(this);

    // Wrap public APIs with validation
    this._wrapPublicMethods();
  }

  /**
   * Wraps public methods with validation at API boundaries
   * This removes the need for internal validation calls throughout the codebase
   */
  private _wrapPublicMethods(): void {
    wrapPublicMethods(this, {
      // State mutation APIs - validate after changes
      addGraphNode: ValidationConfigs.MUTATOR,
      addGraphEdge: ValidationConfigs.MUTATOR,
      addContainer: ValidationConfigs.MUTATOR,
      setContainerState: ValidationConfigs.MUTATOR,
      setContainerCollapsed: ValidationConfigs.MUTATOR,
      updateNode: ValidationConfigs.MUTATOR,
      removeGraphNode: ValidationConfigs.MUTATOR,
      removeGraphEdge: ValidationConfigs.MUTATOR,

      // Internal operations called by public APIs - skip validation to prevent duplicate checks
      setNodeVisibility: ValidationConfigs.INTERNAL,
      setEdgeVisibility: ValidationConfigs.INTERNAL,

      // Legacy compatibility methods - validate after
      setGraphNode: ValidationConfigs.MUTATOR,
      setHyperEdge: ValidationConfigs.MUTATOR,
    });
  }

  // ============ Viewport Management ============

  /**
   * Sets the viewport dimensions for layout calculations.
   * @param width The width of the viewport in pixels.
   * @param height The height of the viewport in pixels.
   */
  public setViewport(width: number, height: number): void {
    if (width > 0 && height > 0) {
      this._viewport = { width, height };
    } else {
      this._viewport = null;
    }
  }

  /**
   * Gets the current viewport dimensions.
   * @returns The viewport dimensions or null if not set.
   */
  public get viewport(): { width: number; height: number } | null {
    return this._viewport;
  }

  // ============ Layout Control Interface ============

  /**
   * Set the layout controller for optimization during bulk operations
   * Called by VisualizationEngine to provide layout suspension capabilities
   */
  public setLayoutController(controller: {
    suspendAutoLayout?: () => void;
    resumeAutoLayout?: (triggerLayout?: boolean) => void;
  }): void {
    this._layoutController = controller;
  }

  /**
   * Suspend automatic layout triggers during bulk operations
   * Used internally for performance optimization
   */
  private _suspendLayoutTriggers(): void {
    if (this._layoutController?.suspendAutoLayout) {
      this._layoutController.suspendAutoLayout();
    }
  }

  /**
   * Resume automatic layout triggers and optionally trigger layout
   * Used internally for performance optimization
   */
  private _resumeLayoutTriggers(triggerLayout: boolean = true): void {
    if (this._layoutController?.resumeAutoLayout) {
      this._layoutController.resumeAutoLayout(triggerLayout);
    }
  }

  // ============ SAFE BRIDGE API (Read-only access for external systems) ============

  /**
   * Get visible nodes for rendering (safe read-only access)
   * Bridges should ONLY use this method, never access internal maps directly
   */
  get visibleNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._collections._visibleNodes.values());
  }

  /**
   * Get all nodes (including hidden ones) for search functionality
   * This allows searching for nodes inside collapsed containers
   */
  get allNodes(): ReadonlyArray<GraphNode> {
    return Array.from(this._collections.graphNodes.values());
  }

  /**
   * Get visible nodes as mutable array (legacy compatibility)
   * @deprecated Use visibleNodes getter for new code
   */
  getVisibleNodes(): GraphNode[] {
    return Array.from(this._collections._visibleNodes.values());
  }

  /**
   * Get visible edges for rendering (safe read-only access)
   * Bridges should ONLY use this method, never access internal maps directly
   */
  get visibleEdges(): ReadonlyArray<Edge> {
    // Include both regular visible edges and visible hyperEdges
    const regularEdges = Array.from(this._collections._visibleEdges.values());
    const hyperEdges = Array.from(this._collections.hyperEdges.values()).filter(
      (edge: HyperEdge) => {
        return !edge.hidden;
      }
    );

    const allEdges = [...regularEdges, ...hyperEdges];

    // Check for duplicate keys to prevent React warnings
    this._validateRenderKeys(allEdges);

    return allEdges;
  }

  /**
   * Get visible edges as mutable array (legacy compatibility)
   * @deprecated Use visibleEdges getter for new code
   */
  getVisibleEdges(): Edge[] {
    const regularEdges = Array.from(this._collections._visibleEdges.values());
    const hyperEdges = Array.from(this._collections.hyperEdges.values()).filter(
      (edge: HyperEdge) => {
        return !edge.hidden;
      }
    );

    const allEdges = [...regularEdges, ...hyperEdges];

    // Check for duplicate keys to prevent React warnings
    this._validateRenderKeys(allEdges);

    return allEdges;
  }

  /**
   * Get visible containers for rendering (safe read-only access)
   * Bridges should ONLY use this method, never access internal maps directly
   * Returns containers with dimensions adjusted for labels.
   */
  get visibleContainers(): ReadonlyArray<Container> {
    const containers = Array.from(this._collections._visibleContainers.values());

    return containers.map(container => {
      const adjustedDimensions = this.layoutOps.getContainerAdjustedDimensions(container.id);
      return {
        ...container,
        width: adjustedDimensions.width,
        height: adjustedDimensions.height,
      };
    });
  }

  /**
   * Get visible containers as mutable array (legacy compatibility)
   * @deprecated Use visibleContainers getter for new code
   */
  getVisibleContainers(): Container[] {
    return Array.from(this._collections._visibleContainers.values()).map(container => {
      const adjustedDimensions = this.layoutOps.getContainerAdjustedDimensions(container.id);
      return {
        ...container,
        width: adjustedDimensions.width,
        height: adjustedDimensions.height,
      };
    });
  }

  /**
   * Get visible hyperEdges for rendering (safe read-only access)
   * Used by tests and debugging - filters out hidden hyperEdges
   */
  get visibleHyperEdges(): ReadonlyArray<HyperEdge> {
    return Array.from(this._collections.hyperEdges.values()).filter((edge: HyperEdge) => {
      return !edge.hidden;
    });
  }

  /**
   * Get expanded containers (safe read-only access)
   * Bridges should ONLY use this method, never access internal maps directly
   */
  getExpandedContainers(): ReadonlyArray<Container> {
    return Array.from(this._collections._expandedContainers.values());
  }

  /**
   * Get collapsed containers (safe read-only access)
   * Bridges should ONLY use this method, never access internal maps directly
   */
  getCollapsedContainers(): ReadonlyArray<Container> {
    return Array.from(this._collections._collapsedContainers.values());
  }

  /**
   * Container hierarchy access (backwards compatibility)
   */
  getContainerChildren(containerId: string): ReadonlySet<string> {
    return this._collections._containerChildren.get(containerId) || new Set();
  }

  getNodeContainer(nodeId: string): string | undefined {
    return this._collections._nodeContainers.get(nodeId);
  }

  /**
   * Get node-to-container mapping for efficient parent lookups (bridge access)
   * Returns a read-only map for bridges that need to do bulk parent lookups
   * @returns ReadonlyMap from nodeId to containerId
   */
  getNodeContainerMapping(): ReadonlyMap<string, string> {
    return this._collections._nodeContainers;
  }

  /**
   * Get container-to-parent mapping for efficient hierarchy traversal (bridge access)
   * Returns a read-only map for bridges that need to do bulk parent container lookups
   * @returns ReadonlyMap from containerId to parent containerId
   */
  getContainerParentMapping(): ReadonlyMap<string, string> {
    this._initializeCaches();
    return this._collections._containerParentMap;
  }

  /**
   * Get container by ID for O(1) lookup (bridge access)
   * Returns the container or undefined if not found
   * @param containerId The ID of the container to retrieve
   * @returns Container or undefined
   */
  getContainerById(containerId: string): Container | undefined {
    return this._collections._visibleContainers.get(containerId);
  }

  /**
   * Get all hyperEdges (safe read-only access for tests and debugging)
   */
  public get hyperEdges(): ReadonlyMap<string, HyperEdge> {
    return this._collections.hyperEdges;
  }

  // ============ EFFICIENT HIERARCHY ACCESSORS (O(1) lookups for HierarchyTree) ============

  /**
   * Lazy initialization of efficient lookup caches
   * Called automatically on first access to any cache-dependent method
   */
  private _initializeCaches(): void {
    if (this._cacheInitialized) return;

    // Initialize node parent cache from existing _nodeContainers
    this._collections._nodeParentMap.clear();
    for (const [nodeId, containerId] of this._collections._nodeContainers) {
      this._collections._nodeParentMap.set(nodeId, containerId);
    }

    // Initialize container parent cache from existing _containerChildren
    this._collections._containerParentMap.clear();
    for (const [parentId, children] of this._collections._containerChildren) {
      for (const childId of children) {
        // Check if child is a container (not just a node)
        if (this._collections.containers.has(childId)) {
          this._collections._containerParentMap.set(childId, parentId);
        }
      }
    }

    // Initialize container leaf caches
    this._collections._containerLeafCounts.clear();
    this._collections._containerLeafNodes.clear();

    for (const [containerId, children] of this._collections._containerChildren) {
      const leafNodes: GraphNode[] = [];
      let leafCount = 0;

      for (const childId of children) {
        // Check if child is a node (not a container)
        const childNode = this._collections.graphNodes.get(childId);
        if (childNode && !this._collections.containers.has(childId)) {
          leafNodes.push(childNode);
          leafCount++;
        }
      }

      this._collections._containerLeafCounts.set(containerId, leafCount);
      this._collections._containerLeafNodes.set(containerId, leafNodes);
    }

    this._cacheInitialized = true;
  }

  /**
   * Get parent container of a node (O(1) lookup)
   * @param nodeId - The node ID to find parent for
   * @returns Parent container ID or null if node has no parent
   */
  getNodeParent(nodeId: string): string | null {
    this._initializeCaches();
    return this._collections._nodeParentMap.get(nodeId) || null;
  }

  /**
   * Get parent container of a container (O(1) lookup)
   * @param containerId - The container ID to find parent for
   * @returns Parent container ID or null if container has no parent
   */
  getContainerParent(containerId: string): string | null {
    this._initializeCaches();
    return this._collections._containerParentMap.get(containerId) || null;
  }

  /**
   * Get immediate leaf node count for container (O(1) lookup)
   * Only counts direct child nodes, not recursive descendants
   * @param containerId - The container ID
   * @returns Number of immediate leaf node children
   */
  getContainerLeafNodeCount(containerId: string): number {
    this._initializeCaches();
    return this._collections._containerLeafCounts.get(containerId) || 0;
  }

  /**
   * Get immediate leaf nodes for container (O(1) lookup)
   * Only returns direct child nodes, not recursive descendants
   * @param containerId - The container ID
   * @returns ReadonlyArray of immediate leaf node children
   */
  getContainerLeafNodes(containerId: string): ReadonlyArray<GraphNode> {
    this._initializeCaches();
    return this._collections._containerLeafNodes.get(containerId) || [];
  }

  /**
   * Get visible node data efficiently (O(1) lookup)
   * @param nodeId - The node ID to look up
   * @returns GraphNode if visible, undefined otherwise
   */
  getVisibleNode(nodeId: string): GraphNode | undefined {
    return this._collections._visibleNodes.get(nodeId);
  }

  /**
   * Get search expansion keys efficiently
   * Determines which containers should be expanded to show search matches
   * @param searchMatches - Array of search match results
   * @param currentCollapsed - Set of currently collapsed container IDs
   * @returns Array of container IDs that should be expanded
   */
  getSearchExpansionKeys(
    searchMatches: Array<{ id: string; type: 'container' | 'node' }>,
    currentCollapsed: Set<string>
  ): string[] {
    if (!searchMatches || searchMatches.length === 0) {
      // No search - return all non-collapsed containers
      const allContainerIds: string[] = [];
      for (const container of this._collections.containers.keys()) {
        allContainerIds.push(container);
      }
      return allContainerIds.filter(id => !currentCollapsed.has(id));
    }

    this._initializeCaches();
    const toExpand = new Set<string>();

    const addAncestors = (containerId: string) => {
      let current: string | null = containerId;
      while (current) {
        toExpand.add(current);
        current = this.getContainerParent(current);
      }
    };

    const addAncestorsOnly = (containerId: string) => {
      // Add only the ancestors, not the container itself
      let current: string | null = this.getContainerParent(containerId);
      while (current) {
        toExpand.add(current);
        current = this.getContainerParent(current);
      }
    };

    // Add containers needed for search matches (and their ancestors)
    console.error(`[VisualizationState] Processing ${searchMatches.length} search matches for expansion`);
    searchMatches.forEach(match => {
      console.error(`[VisualizationState] Processing match: ${match.id} (${match.type})`);
      if (match.type === 'container') {
        // FIXED: Container matches should be visible AND expanded so they can be highlighted
        // Expand both ancestors and the matched container itself
        const parentId = this.getContainerParent(match.id);
        console.error(`[VisualizationState] Container ${match.id} parent: ${parentId || 'none'}`);
        addAncestors(match.id); // This will expand ancestors AND the container itself
      } else if (match.type === 'node') {
        // SEARCH INVARIANT: Node matches should be visible as nodes
        // Expand all ancestors including the direct parent container
        const parentContainer = this.getNodeParent(match.id);
        if (parentContainer) {
          console.error(`[VisualizationState] Node ${match.id} parent container: ${parentContainer}`);
          addAncestors(parentContainer);
        }
      }
    });

    console.error(`[VisualizationState] Containers to expand: ${Array.from(toExpand).join(', ')}`);

    // Track matched containers for diagnostics
    const matchedContainerIds = new Set<string>();
    searchMatches.forEach(match => {
      if (match.type === 'container') {
        matchedContainerIds.add(match.id);
        // FIXED: Don't remove matched containers from expansion - let them be expanded
      }
    });

    // DIAGNOSTIC: Log which matched containers will be visible after expansion
    const willBeVisible = Array.from(matchedContainerIds).filter(id => {
      // A matched container is visible if:
      // 1. It's not collapsed itself (search invariant keeps them collapsed, so they should be visible)
      // 2. All its ancestors are expanded (or will be expanded)
      let current = this.getContainerParent(id);
      while (current) {
        if (!toExpand.has(current) && this.getContainer(current)?.collapsed) {
          return false; // Ancestor is collapsed and won't be expanded
        }
        current = this.getContainerParent(current);
      }
      return true;
    });

    console.error(`[VisualizationState] Matched containers that WILL be visible: ${willBeVisible.join(', ')}`);
    const willBeInvisible = Array.from(matchedContainerIds).filter(id => !willBeVisible.includes(id));
    console.error(`[VisualizationState] Matched containers that will be INVISIBLE: ${willBeInvisible.join(', ')}`);

    return Array.from(toExpand);
  }

  // ============ COVERED EDGES INDEX API ============

  /**
   * Build/rebuild the covered edges index
   * Call this after hierarchy changes (adding/removing containers or changing parent-child relationships)
   */
  buildCoveredEdgesIndex(): void {
    if (!this._coveredEdgesIndex) {
      this._coveredEdgesIndex = new CoveredEdgesIndex();
    }
    this._coveredEdgesIndex.initialize(
      this._collections.containers,
      this._collections.graphEdges,
      this._collections._containerChildren,
      this._collections._nodeContainers
    );
  }

  /**
   * Get all edges that are covered by a given container or hyperEdge
   */
  getCoveredEdges(entityId: string): ReadonlySet<string> {
    if (!this._coveredEdgesIndex) {
      this.buildCoveredEdgesIndex();
    }

    const coveredEdgeIds = this._coveredEdgesIndex!.getCoveredEdges(entityId);
    return coveredEdgeIds;
  }

  /**
   * Get all edges adjacent to a given node or container
   * @param nodeId The ID of the node or container
   * @returns ReadonlySet of edge IDs that are connected to this node/container
   */
  getAdjacentEdges(nodeId: string): ReadonlySet<string> {
    const edgeSet = this._collections._nodeToEdges.get(nodeId);
    return edgeSet ? edgeSet : new Set();
  }

  /**
   * Check if the covered edges index needs rebuilding
   */
  isCoveredEdgesIndexStale(): boolean {
    return this._coveredEdgesIndex === null;
  }

  /**
   * Invalidate the covered edges index (call this when hierarchy changes)
   */
  invalidateCoveredEdgesIndex(): void {
    this._coveredEdgesIndex = null;
  }

  // ============ LAYOUT API (Delegate to LayoutOperations) ============

  getAllManualPositions(): Map<string, { x: number; y: number }> {
    return this.layoutOps.getAllManualPositions();
  }

  hasAnyManualPositions(): boolean {
    return this.layoutOps.hasAnyManualPositions();
  }

  setManualPosition(entityId: string, x: number, y: number): void {
    this.layoutOps.setManualPosition(entityId, x, y);
  }

  setContainerLayout(
    containerId: string,
    layout: Partial<LayoutState> & Record<string, unknown>
  ): void {
    this.layoutOps.setContainerLayout(containerId, layout);
  }

  setNodeLayout(nodeId: string, layout: Partial<LayoutState> & Record<string, unknown>): void {
    this.layoutOps.setNodeLayout(nodeId, layout);
  }

  getContainerLayout(
    containerId: string
  ):
    | { position?: { x: number; y: number }; dimensions?: { width: number; height: number } }
    | undefined {
    return this.layoutOps.getContainerLayout(containerId);
  }

  getNodeLayout(
    nodeId: string
  ):
    | { position?: { x: number; y: number }; dimensions?: { width: number; height: number } }
    | undefined {
    return this.layoutOps.getNodeLayout(nodeId);
  }

  getContainerAdjustedDimensions(containerId: string): { width: number; height: number } {
    return this.layoutOps.getContainerAdjustedDimensions(containerId);
  }

  clearLayoutPositions(): void {
    this.layoutOps.clearLayoutPositions();
  }

  getEdgeLayout(edgeId: string): (Partial<LayoutState> & Record<string, unknown>) | undefined {
    return this.layoutOps.getEdgeLayout(edgeId);
  }

  setEdgeLayout(edgeId: string, layout: Partial<LayoutState> & Record<string, unknown>): void {
    this.layoutOps.setEdgeLayout(edgeId, layout);
  }

  // ============ CORE API - Direct Entity Management ============

  /**
   * Get a graph node by ID (core API)
   */
  getGraphNode(nodeId: string): GraphNode | undefined {
    return this._collections.graphNodes.get(nodeId);
  }

  /**
   * Get a graph edge by ID (core API)
   */
  getGraphEdge(edgeId: string): GraphEdge | undefined {
    return this._collections.graphEdges.get(edgeId);
  }

  /**
   * Get a container by ID (core API)
   */
  /**
   * Get a container by ID
   * @param containerId - The container ID to look up
   * @returns Container object if found, undefined otherwise
   */
  getContainer(containerId: string): Container | undefined {
    return this._collections.containers.get(containerId);
  }

  /**
   * Get a hyperEdge by ID
   * @param hyperEdgeId - The hyperEdge ID to look up
   * @returns HyperEdge object if found, undefined otherwise
   */
  getHyperEdge(hyperEdgeId: string): HyperEdge | undefined {
    return this._collections.hyperEdges.get(hyperEdgeId);
  }

  /**
   * Add a graph node directly (for JSONParser and initial data loading)
   */
  addGraphNode(nodeId: string, nodeData: RawNodeData): void {
    // Check if node belongs to a collapsed container and should be hidden
    const parentContainer = this._collections._nodeContainers.get(nodeId);
    let shouldBeHidden = nodeData.hidden || false;

    if (parentContainer) {
      const container = this._collections.containers.get(parentContainer);
      if (container && container.collapsed) {
        shouldBeHidden = true;
      }
    }

    // Ensure label fields exist for legacy API compatibility
    // Defaults:
    // - shortLabel: prefer provided shortLabel, else label, else id
    // - fullLabel: prefer provided fullLabel, else label, else shortLabel
    // - label (display): prefer provided label, else shortLabel
    const derivedShortLabel = nodeData.shortLabel ?? nodeData.label ?? nodeId;
    const derivedFullLabel = nodeData.fullLabel ?? nodeData.label ?? derivedShortLabel;
    const derivedDisplayLabel = nodeData.label ?? derivedShortLabel;

    // Ensure all nodes have default dimensions and proper typing
    const processedData: GraphNode = {
      ...nodeData,
      id: nodeId,
      // Provide derived labels if not explicitly set
      label: nodeData.label ?? derivedDisplayLabel,
      shortLabel: nodeData.shortLabel ?? derivedShortLabel,
      fullLabel: nodeData.fullLabel ?? derivedFullLabel,
      style: (nodeData.style as NodeStyle) || ('default' as NodeStyle),
      hidden: shouldBeHidden,
      width: nodeData.width || LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH,
      height: nodeData.height || LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT,
    };

    this._collections.graphNodes.set(nodeId, processedData);

    // Update visibility cache
    if (!shouldBeHidden) {
      this._collections._visibleNodes.set(nodeId, processedData);
    }

    // Update edge mappings if needed
    this._collections._nodeToEdges.set(nodeId, new Set());

    // Update efficient lookup caches incrementally
    if (this._cacheInitialized && parentContainer) {
      // Update node parent cache
      this._collections._nodeParentMap.set(nodeId, parentContainer);

      // Update container leaf caches
      const existingLeafNodes = this._collections._containerLeafNodes.get(parentContainer) || [];
      const existingCount = this._collections._containerLeafCounts.get(parentContainer) || 0;

      this._collections._containerLeafNodes.set(parentContainer, [
        ...existingLeafNodes,
        processedData,
      ]);
      this._collections._containerLeafCounts.set(parentContainer, existingCount + 1);

      // Invalidate recursive leaf counts since hierarchy changed
      this._invalidateRecursiveLeafCounts(parentContainer);
    }

    // Invalidate covered edges index since graph structure changed
    this.invalidateCoveredEdgesIndex();
  }

  /**
   * Add a graph edge directly (for JSONParser and initial data loading)
   */
  addGraphEdge(edgeId: string, edgeData: RawEdgeData): void {
    const processedData: GraphEdge = {
      ...edgeData,
      id: edgeId,
      source: edgeData.source || '',
      target: edgeData.target || '',
      type: 'graph' as const,
      hidden: edgeData.hidden || false,
    };
    this._collections.graphEdges.set(edgeId, processedData);

    // Update node-to-edge mappings
    if (processedData.source) {
      const sourceSet = this._collections._nodeToEdges.get(processedData.source) || new Set();
      sourceSet.add(edgeId);
      this._collections._nodeToEdges.set(processedData.source, sourceSet);
    }

    if (processedData.target) {
      const targetSet = this._collections._nodeToEdges.get(processedData.target) || new Set();
      targetSet.add(edgeId);
      this._collections._nodeToEdges.set(processedData.target, targetSet);
    }

    // Update CoveredEdgesIndex if it exists
    if (this._coveredEdgesIndex) {
      this._coveredEdgesIndex.addEdge(edgeId, processedData, this._collections._nodeContainers);
    }

    // Update visibility cache if edge should be visible
    const sourceExists = this._isEndpointVisible(processedData.source);
    const targetExists = this._isEndpointVisible(processedData.target);
    if (!processedData.hidden && sourceExists && targetExists) {
      this._collections._visibleEdges.set(edgeId, processedData);
    }
  }

  /**
   * Add a container directly (for JSONParser and initial data loading)
   */
  addContainer(containerId: string, containerData: RawContainerData): void {
    // Check existing state BEFORE making changes
    const existingContainer = this._collections.containers.get(containerId);
    const wasCollapsed = existingContainer?.collapsed === true;

    // Ensure proper defaults
    const processedData: Container = {
      ...containerData,
      id: containerId,
      collapsed: containerData.collapsed || false,
      hidden: containerData.hidden || false,
      children: new Set(containerData.children || []),
      width: (containerData.width as number) || LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH,
      height: (containerData.height as number) || LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT,
      expandedDimensions: {
        width: (containerData.width as number) || LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH,
        height: (containerData.height as number) || LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT,
      },
    };

    this._collections.containers.set(containerId, processedData);

    // Update visibility caches
    this.visibilityManager.updateContainerVisibilityCaches(containerId, processedData);

    // Process children relationships
    if (containerData.children) {
      this._collections._containerChildren.set(containerId, new Set(containerData.children));
      for (const childId of containerData.children) {
        this._collections._nodeContainers.set(childId, containerId);

        // Update efficient lookup caches incrementally for new children
        if (this._cacheInitialized) {
          const childNode = this._collections.graphNodes.get(childId);
          const isChildContainer = this._collections.containers.has(childId);

          if (childNode && !isChildContainer) {
            // Child is a node, update node parent cache
            this._collections._nodeParentMap.set(childId, containerId);
          } else if (isChildContainer) {
            // Child is a container, update container parent cache
            this._collections._containerParentMap.set(childId, containerId);
          }
        }
      }

      // Update container leaf caches for this new container
      if (this._cacheInitialized) {
        const leafNodes: GraphNode[] = [];
        let leafCount = 0;

        for (const childId of containerData.children) {
          const childNode = this._collections.graphNodes.get(childId);
          const isChildContainer = this._collections.containers.has(childId);

          if (childNode && !isChildContainer) {
            leafNodes.push(childNode);
            leafCount++;
          }
        }

        this._collections._containerLeafCounts.set(containerId, leafCount);
        this._collections._containerLeafNodes.set(containerId, leafNodes);

        // Invalidate recursive leaf counts since we added a new container with children
        this._invalidateRecursiveLeafCounts(containerId);
      }
    }

    // Handle state transitions and cascading
    const isNowCollapsed = processedData.collapsed === true;
    const isNowExpanded = processedData.collapsed === false;

    if (isNowCollapsed && (!wasCollapsed || !existingContainer)) {
      // Container is being collapsed (either transition or added as collapsed)
      this.containerOps.handleContainerCollapse(containerId);
    } else if (wasCollapsed && isNowExpanded) {
      // Container is being expanded
    }

    // Invalidate covered edges index since hierarchy changed
    this.invalidateCoveredEdgesIndex();
  }

  // ============ CONTROLLED STATE MUTATION API ============

  /**
   * Safely set node visibility with automatic cache updates and edge cascade
   */
  setNodeVisibility(nodeId: string, visible: boolean): void {
    this.visibilityManager.setNodeVisibility(nodeId, visible);
  }

  /**
   * Safely set container state with proper cascade and hyperEdge management
   */
  setContainerState(containerId: string, state: { collapsed?: boolean; hidden?: boolean }): void {
    // RACE CONDITION FIX: Check if we're in a layout lock and queue the operation
    if (this._checkLayoutLock('setContainerState', () => this.setContainerState(containerId, state))) {
      return;
    }

    const container = this._collections.containers.get(containerId);
    if (!container) {
      console.warn(
        `[VisualizationState] Cannot set state for non-existent container: ${containerId}`
      );
      return;
    }

    const wasCollapsed = container.collapsed;
    const wasHidden = container.hidden;

    // CRITICAL FIX: Prevent illegal state transitions
    // If we're trying to expand a hidden container, make it visible first
    if (state.collapsed === false && (container.hidden || state.hidden === true)) {
      console.warn(`[VisualizationState] Preventing illegal Expanded/Hidden state for container ${containerId}. Making visible.`);
      state.hidden = false;
    }

    // Apply state changes
    if (state.collapsed !== undefined) {
      container.collapsed = state.collapsed;

      // CRITICAL: Always override dimensions when collapsing
      if (state.collapsed) {
        container.width = SIZES.COLLAPSED_CONTAINER_WIDTH;
        container.height = SIZES.COLLAPSED_CONTAINER_HEIGHT;
      }
    }
    if (state.hidden !== undefined) container.hidden = state.hidden;

    // Update visibility caches
    this.visibilityManager.updateContainerVisibilityCaches(containerId, container);

    // Handle collapse/expand transitions with hyperEdge management
    if (state.collapsed !== undefined && state.collapsed !== wasCollapsed) {
      if (state.collapsed) {
        // Disable validation during collapse to avoid intermediate state warnings
        const originalValidation = this._validationEnabled;
        this._validationEnabled = false;

        try {
          this.containerOps.handleContainerCollapse(containerId);
        } finally {
          this._validationEnabled = originalValidation;
        }
      } else {
        // Disable validation during expansion to avoid intermediate state warnings
        const originalValidation = this._validationEnabled;
        this._validationEnabled = false;

        try {
          this.containerOps.handleContainerExpansion(containerId);
        } finally {
          this._validationEnabled = originalValidation;
        }
      }
    }

    // Handle hide/show transitions
    if (state.hidden !== undefined && state.hidden !== wasHidden) {
      this.visibilityManager.cascadeContainerVisibility(containerId, !state.hidden);
    }
  }

  /**
   * Safely set edge visibility with endpoint validation
   */
  setEdgeVisibility(edgeId: string, visible: boolean): void {
    this.visibilityManager.setEdgeVisibility(edgeId, visible);
  }

  // ============ LEGACY/COMPATIBILITY API ============

  /**
   * Set a graph node (legacy compatibility - forwards to addGraphNode)
   * @deprecated Use addGraphNode() for new code
   */
  setGraphNode(nodeId: string, nodeData: RawNodeData): VisualizationState {
    this.addGraphNode(nodeId, nodeData);
    return this;
  }

  /**
   * Set a graph edge (legacy compatibility - forwards to addGraphEdge)
   * @deprecated Use addGraphEdge() for new code
   */
  setGraphEdge(edgeId: string, edgeData: RawEdgeData): VisualizationState {
    this.addGraphEdge(edgeId, edgeData);
    return this;
  }

  /**
   * Set a container (legacy compatibility - forwards to addContainer)
   * @deprecated Use addContainer() for new code
   */
  setContainer(
    containerIdOrData: string | (RawContainerData & { id: string }),
    containerData?: RawContainerData
  ): VisualizationState {
    if (typeof containerIdOrData === 'string') {
      // Old API: setContainer('id', { ... })
      this.addContainer(containerIdOrData, containerData || {});
    } else {
      // New API: setContainer({ id: 'id', ... })
      const { id, ...data } = containerIdOrData;
      this.addContainer(id, data);
    }
    return this;
  }

  /**
   * Collapse a container (legacy compatibility method)
   */
  collapseContainer(containerId: string): void {
    const container = this._collections.containers.get(containerId);
    if (!container) {
      throw new Error(`Cannot collapse non-existent container: ${containerId}`);
    }

    try {
      this._recentlyCollapsedContainers.add(containerId);
      this._lastChangedContainer = containerId; // Track for selective layout
      this.setContainerState(containerId, { collapsed: true });

      setTimeout(() => {
        this._recentlyCollapsedContainers.delete(containerId);
      }, 2000);
    } finally {
      // Cleanup if needed
    }
  }

  /**
   * Expand a container with proper hyperEdge cleanup
   */
  expandContainer(containerId: string): void {
    // RACE CONDITION FIX: Check layout lock
    if (this._checkLayoutLock('expandContainer', () => this.expandContainer(containerId))) {
      return; // Operation was queued
    }

    const container = this._collections.containers.get(containerId);
    if (!container) {
      throw new Error(`Cannot expand non-existent container: ${containerId}`);
    }

    this._lastChangedContainer = containerId; // Track for selective layout

    // Track recently expanded containers to protect them from auto-collapse
    this._recentlyExpandedContainers.add(containerId);
    setTimeout(() => {
      this._recentlyExpandedContainers.delete(containerId);
    }, 10000); // Protect for 10 seconds

    // Just update the container's collapsed state - setContainerState will handle calling handleContainerExpansion
    this.setContainerState(containerId, { collapsed: false });
  }

  /**
   * Get recently expanded containers (for smart collapse protection)
   */
  getRecentlyExpandedContainers(): Set<string> {
    return new Set(this._recentlyExpandedContainers);
  }

  /**
   * Apply smart collapse for ELK capacity management
   * This is an encapsulated API that respects user intentions and container priorities
   */
  applySmartCollapseForCapacity(targetCount: number): number {
    const expandedContainers = Array.from(this._collections._expandedContainers.values());

    if (expandedContainers.length <= targetCount) {
      return expandedContainers.length; // No collapse needed
    }

    // Calculate container priorities (higher = keep expanded)
    const containersByPriority = expandedContainers
      .map(container => ({
        container,
        priority: this.calculateContainerPriority(container)
      }))
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

    // Keep the highest priority containers expanded, collapse the rest
    const containersToKeep = containersByPriority.slice(0, targetCount);
    const containersToCollapse = containersByPriority.slice(targetCount);

    // Apply collapses through proper API
    for (const { container } of containersToCollapse) {
      this.setContainerState(container.id, { collapsed: true });
    }

    return containersToKeep.length;
  }

  /**
   * Calculate container priority for smart collapse (higher = keep expanded)
   */
  private calculateContainerPriority(container: any): number {
    let priority = 0;

    // Highest priority: Recently expanded by user (protect user actions!)
    if (this._recentlyExpandedContainers.has(container.id)) {
      priority += 1000;
    }

    // Medium priority: Containers with many children (more important)
    const childCount = container.children?.size || 0;
    priority += childCount * 10;

    // Low priority: Alphabetical order (for consistency)
    priority += container.label?.charCodeAt(0) || 0;

    return priority;
  }

  /**
   * Recursively expand a container and all its child containers
   */
  expandContainerRecursive(containerId: string): void {
    const container = this._collections.containers.get(containerId);
    if (!container) {
      throw new Error(`Cannot expand non-existent container: ${containerId}`);
    }

    // Use the container operations method
    this.containerOps.handleContainerExpansion(containerId);

    // Update all affected containers' collapsed state
    this._updateCollapsedStateRecursive(containerId, false);
  }

  /**
   * Helper to recursively update collapsed state
   */
  private _updateCollapsedStateRecursive(containerId: string, collapsed: boolean): void {
    this.setContainerState(containerId, { collapsed });

    const children = this.getContainerChildren(containerId) || new Set();
    for (const childId of Array.from(children)) {
      if (typeof childId === 'string') {
        const childContainer = this._collections.containers.get(childId);
        if (childContainer) {
          this._updateCollapsedStateRecursive(childId, collapsed);
        }
      }
    }
  }

  /**
   * Get the most recently changed container for selective layout
   */
  getLastChangedContainer(): string | null {
    return this._lastChangedContainer;
  }

  /**
   * Clear the last changed container tracking
   */
  clearLastChangedContainer(): void {
    this._lastChangedContainer = null;
  }

  /**
   * Expand all containers in bulk with proper validation handling
   */
  expandAllContainers(): void {
    // Import the profiler dynamically to avoid circular dependencies
    import('../dev')
      .then(({ getExpandAllProfiler }) => {
        const profiler = getExpandAllProfiler();
        if (profiler) {
          profiler.startProfiling();
          this._expandAllContainersWithProfiling(profiler);
        } else {
          this._expandAllContainersCore();
        }
      })
      .catch(error => {
        console.warn('ExpandAllProfiler not available, continuing without profiling:', error);
        this._expandAllContainersCore();
      });
  }

  private _expandAllContainersWithProfiling(profiler: any): void {
    // Note: profiler is guaranteed to exist when this method is called
    profiler.startStage('containerDiscovery');

    // OPTIMIZATION: Suspend automatic layout during bulk expansion
    this._suspendLayoutTriggers();

    // Get top-level containers (containers with no visible parent container)
    const topLevelContainers = [];

    for (const container of this.visibleContainers) {
      // Check if this container has a parent container using O(1) lookup
      const parentId = this.getContainerParent(container.id);
      let hasVisibleParent = false;

      if (parentId) {
        const parent = this._collections.containers.get(parentId);
        if (parent && !parent.collapsed && !parent.hidden) {
          hasVisibleParent = true;
        }
      }

      if (!hasVisibleParent) {
        topLevelContainers.push(container);
      }
    }

    const collapsedTopLevel = topLevelContainers.filter(c => c.collapsed);

    // Calculate container statistics
    let totalChildCount = 0;
    let maxChildCount = 0;
    let totalLeafNodes = 0;

    for (const container of collapsedTopLevel) {
      const childCount = this.getContainerChildren(container.id).size;
      const leafNodeCount = this.countRecursiveLeafNodes(container.id);

      totalChildCount += childCount;
      maxChildCount = Math.max(maxChildCount, childCount);
      totalLeafNodes += leafNodeCount;
    }

    profiler.setContainerStats({
      totalContainers: topLevelContainers.length,
      collapsedContainers: collapsedTopLevel.length,
      averageChildCount:
        collapsedTopLevel.length > 0 ? totalChildCount / collapsedTopLevel.length : 0,
      maxChildCount,
      totalLeafNodes,
    });

    profiler.endStage('containerDiscovery');

    if (collapsedTopLevel.length === 0) {
      // Resume layout triggers even if no work to do
      this._resumeLayoutTriggers(false);
      profiler.endProfiling();
      return;
    }

    profiler.startStage('expansionLoop');

    // OPTIMIZATION: Safer Batched Expansion
    // Use the existing expansion logic but minimize validation overhead

    // Disable validation during bulk expansion to avoid intermediate state issues
    const originalValidation = this._validationEnabled;
    this._validationEnabled = false;

    try {
      // Expand each container using the proper expansion logic, but with validation disabled
      for (const container of collapsedTopLevel) {
        const expansionStart = performance.now();

        const childCount = this.getContainerChildren(container.id).size;
        const leafNodeCount = this.countRecursiveLeafNodes(container.id);

        // Use the proper expansion method but with validation disabled for performance
        this.expandContainerRecursive(container.id);

        const expansionTime = performance.now() - expansionStart;
        profiler.profileContainerExpansion(container.id, childCount, leafNodeCount, expansionTime);
      }
    } finally {
      this._validationEnabled = originalValidation;
    }

    profiler.endStage('expansionLoop');
    profiler.startStage('validation');

    // Re-enable validation and run final validation
    if (this._validationEnabled) {
      this.validateInvariants();
    }

    profiler.endStage('validation');
    profiler.startStage('layoutTrigger');

    // OPTIMIZATION: Resume layout triggers and trigger single layout calculation
    this._resumeLayoutTriggers(true);

    profiler.endStage('layoutTrigger');
    profiler.endProfiling();
  }

  private _expandAllContainersCore(): void {
    // OPTIMIZATION 4: Layout suspension for fallback implementation
    this._suspendLayoutTriggers();

    const topLevelContainers = [];

    for (const container of this.visibleContainers) {
      // Check if this container has a parent container using O(1) lookup
      const parentId = this.getContainerParent(container.id);
      let hasVisibleParent = false;

      if (parentId) {
        const parent = this._collections.containers.get(parentId);
        if (parent && !parent.collapsed && !parent.hidden) {
          hasVisibleParent = true;
        }
      }

      if (!hasVisibleParent) {
        topLevelContainers.push(container);
      }
    }

    const collapsedTopLevel = topLevelContainers.filter(c => c.collapsed);

    if (collapsedTopLevel.length === 0) {
      // Resume layout triggers even if no work to do
      this._resumeLayoutTriggers(false);
      return;
    }

    const originalValidation = this._validationEnabled;
    this._validationEnabled = false;

    try {
      // Use proper expansion logic but with validation disabled for performance
      for (const container of collapsedTopLevel) {
        this.expandContainerRecursive(container.id);
      }
    } finally {
      this._validationEnabled = originalValidation;
      if (this._validationEnabled) {
        this.validateInvariants();
      }

      // OPTIMIZATION: Resume layout triggers and trigger single layout calculation
      this._resumeLayoutTriggers(true);
    }
  }

  /**
   * Collapse all containers in bulk with proper validation handling
   */
  collapseAllContainers(): void {
    // OPTIMIZATION: Suspend layout triggers during bulk operations
    this._suspendLayoutTriggers();

    const topLevelContainers = this.getTopLevelContainers();
    const expandedTopLevel = topLevelContainers.filter(c => !c.collapsed);

    if (expandedTopLevel.length === 0) {
      // Resume layout triggers even if no work to do
      this._resumeLayoutTriggers(false);
      return;
    }

    // Disable validation during bulk collapse to avoid intermediate state issues
    const originalValidation = this._validationEnabled;
    this._validationEnabled = false;

    try {
      // Collapse each top-level expanded container (this will cascade to children)
      for (const container of expandedTopLevel) {
        this.collapseContainer(container.id);
      }
    } finally {
      // Re-enable validation and run it once at the end
      this._validationEnabled = originalValidation;
      if (originalValidation) {
        this.validateInvariants();
      }

      // OPTIMIZATION: Resume layout triggers and trigger single layout calculation
      this._resumeLayoutTriggers(true);
    }
  }

  /**
   * Update container properties (legacy compatibility method)
   */
  updateContainer(containerId: string, updates: Partial<Container>): void {
    const container = this._collections.containers.get(containerId);
    if (container) {
      Object.assign(container, updates);
      this.visibilityManager.updateContainerVisibilityCaches(containerId, container);
    }
  }

  // ============ BRIDGE SUPPORT METHODS ============

  /**
   * Get parent-child mapping for ReactFlow bridge
   */
  getParentChildMap(): Map<string, string> {
    const parentMap = new Map<string, string>();

    // Map visible nodes to their expanded parent containers
    for (const node of this.visibleNodes) {
      const parentContainer = this._collections._nodeContainers.get(node.id);
      if (parentContainer) {
        const parent = this._collections.containers.get(parentContainer);
        if (parent && !parent.collapsed && !parent.hidden) {
          parentMap.set(node.id, parentContainer);
        }
      }
    }

    // Also handle containers defined with children arrays (for test compatibility)
    for (const [containerId, container] of this._collections.containers) {
      if (!container.collapsed && !container.hidden && container.children) {
        for (const childId of container.children) {
          parentMap.set(childId, containerId);
        }
      }
    }

    // Also map visible containers to their parent containers
    for (const container of this.visibleContainers) {
      const parentId = this.getContainerParent(container.id);
      if (parentId) {
        const parent = this._collections.containers.get(parentId);
        if (parent && !parent.collapsed && !parent.hidden) {
          parentMap.set(container.id, parentId);
        }
      }
    }

    return parentMap;
  }

  /**
   * Get collapsed containers as nodes for ELK bridge
   */
  getCollapsedContainersAsNodes(): ReadonlyArray<CollapsedContainerNode> {
    const collapsedAsNodes: CollapsedContainerNode[] = [];

    for (const container of this._collections.containers.values()) {
      if (container.collapsed && !container.hidden) {
        collapsedAsNodes.push({
          ...container,
          x: container.x ?? 0,
          y: container.y ?? 0,
          label: container.label || container.id,
          style: container.style || 'default',
          type: 'container-node',
          collapsed: true,
        });
      }
    }

    return collapsedAsNodes;
  }

  /**
   * Check if a parent container exists and is visible (not collapsed and not hidden)
   */
  private hasVisibleParentContainer(parentId: string | null): boolean {
    if (!parentId) return false;

    const parent = this._collections.containers.get(parentId);
    return parent ? !parent.collapsed && !parent.hidden : false;
  }

  /**
   * Get top-level nodes (nodes not in any expanded container)
   */
  getTopLevelNodes(): ReadonlyArray<GraphNode> {
    const topLevelNodes: GraphNode[] = [];

    for (const node of this.visibleNodes) {
      const parentContainer = this.getNodeParent(node.id);
      const isInExpandedContainer = this.hasVisibleParentContainer(parentContainer);

      if (!isInExpandedContainer) {
        topLevelNodes.push(node);
      }
    }

    return topLevelNodes;
  }

  /**
   * Get top-level containers (containers with no visible parent container)
   */
  getTopLevelContainers(): ReadonlyArray<Container> {
    const topLevelContainers: Container[] = [];

    for (const container of this.visibleContainers) {
      const parentId = this.getContainerParent(container.id);
      const hasVisibleParent = this.hasVisibleParentContainer(parentId);

      if (!hasVisibleParent) {
        topLevelContainers.push(container);
      }
    }

    return topLevelContainers;
  }

  /**
   * Update edge properties (legacy compatibility method)
   */
  updateEdge(edgeId: string, updates: Partial<GraphEdge>): void {
    const edge = this._collections.graphEdges.get(edgeId);
    if (edge) {
      Object.assign(edge, updates);

      // Update visibility cache
      if (updates.hidden !== undefined) {
        if (updates.hidden) {
          this._collections._visibleEdges.delete(edgeId);
        } else if (this._isEndpointVisible(edge.source) && this._isEndpointVisible(edge.target)) {
          this._collections._visibleEdges.set(edgeId, edge);
        }
      }
    }
  }

  // ============ CORE CONTAINER OPERATIONS (Direct access) ============

  // ============ MINIMAL COMPATIBILITY METHODS ============

  setHyperEdge(hyperEdgeId: string, hyperEdgeData: RawHyperEdgeData): this {
    const processedData: HyperEdge = {
      ...hyperEdgeData,
      id: hyperEdgeId,
      source: hyperEdgeData.source || '',
      target: hyperEdgeData.target || '',
      type: 'hyper' as const,
      hidden: hyperEdgeData.hidden || false,
    };

    this._collections.hyperEdges.set(hyperEdgeId, processedData);
    // Update node-to-edge mappings
    const sourceSet = this._collections._nodeToEdges.get(processedData.source) || new Set();
    sourceSet.add(hyperEdgeId);
    this._collections._nodeToEdges.set(processedData.source, sourceSet);

    const targetSet = this._collections._nodeToEdges.get(processedData.target) || new Set();
    targetSet.add(hyperEdgeId);
    this._collections._nodeToEdges.set(processedData.target, targetSet);

    // Note: Visibility cache updates could be added here if needed for hyperEdges

    return this;
  }

  addContainerChild(containerId: string, childId: string): void {
    const children = this._collections._containerChildren.get(containerId) || new Set();
    children.add(childId);
    this._collections._containerChildren.set(containerId, children);
    this._collections._nodeContainers.set(childId, containerId);

    // Update efficient lookup caches incrementally
    if (this._cacheInitialized) {
      const childNode = this._collections.graphNodes.get(childId);
      const isChildContainer = this._collections.containers.has(childId);

      if (childNode && !isChildContainer) {
        // Child is a node, update parent and leaf caches
        this._collections._nodeParentMap.set(childId, containerId);

        const existingLeafNodes = this._collections._containerLeafNodes.get(containerId) || [];
        const existingCount = this._collections._containerLeafCounts.get(containerId) || 0;

        this._collections._containerLeafNodes.set(containerId, [...existingLeafNodes, childNode]);
        this._collections._containerLeafCounts.set(containerId, existingCount + 1);
      } else if (isChildContainer) {
        // Child is a container, update container parent cache
        this._collections._containerParentMap.set(childId, containerId);
      }

      // Invalidate recursive leaf counts since hierarchy changed
      this._invalidateRecursiveLeafCounts(containerId);
    }
  }

  removeContainerChild(containerId: string, childId: string): void {
    const children = this._collections._containerChildren.get(containerId);
    if (children) {
      children.delete(childId);
      if (children.size === 0) {
        this._collections._containerChildren.delete(containerId);
      }
    }
    this._collections._nodeContainers.delete(childId);

    // Update efficient lookup caches incrementally
    if (this._cacheInitialized) {
      const childNode = this._collections.graphNodes.get(childId);
      const isChildContainer = this._collections.containers.has(childId);

      if (childNode && !isChildContainer) {
        // Child is a node, update parent and leaf caches
        this._collections._nodeParentMap.delete(childId);

        const existingLeafNodes = this._collections._containerLeafNodes.get(containerId) || [];
        const existingCount = this._collections._containerLeafCounts.get(containerId) || 0;

        const updatedLeafNodes = existingLeafNodes.filter(node => node.id !== childId);
        this._collections._containerLeafNodes.set(containerId, updatedLeafNodes);
        this._collections._containerLeafCounts.set(containerId, Math.max(0, existingCount - 1));
      } else if (isChildContainer) {
        // Child is a container, update container parent cache
        this._collections._containerParentMap.delete(childId);
      }

      // Invalidate recursive leaf counts since hierarchy changed
      this._invalidateRecursiveLeafCounts(containerId);
    }
  }

  updateNode(nodeId: string, updates: Partial<GraphNode>): void {
    const node = this._collections.graphNodes.get(nodeId);
    if (node) {
      Object.assign(node, updates);

      // Update visibility cache if hidden state changed
      if (updates.hidden !== undefined) {
        if (updates.hidden) {
          this._collections._visibleNodes.delete(nodeId);
        } else {
          this._collections._visibleNodes.set(nodeId, node);
        }
      }
    }
  }

  removeGraphNode(nodeId: string): void {
    // Get parent container before removal for cache maintenance
    const parentContainer = this._collections._nodeContainers.get(nodeId);

    this._collections.graphNodes.delete(nodeId);
    this._collections._visibleNodes.delete(nodeId);
    this._collections._nodeToEdges.delete(nodeId);
    this._collections._nodeContainers.delete(nodeId);

    // Update efficient lookup caches incrementally
    if (this._cacheInitialized) {
      // Update node parent cache
      this._collections._nodeParentMap.delete(nodeId);

      // Update container leaf caches
      if (parentContainer) {
        const existingLeafNodes = this._collections._containerLeafNodes.get(parentContainer) || [];
        const existingCount = this._collections._containerLeafCounts.get(parentContainer) || 0;

        const updatedLeafNodes = existingLeafNodes.filter(node => node.id !== nodeId);
        this._collections._containerLeafNodes.set(parentContainer, updatedLeafNodes);
        this._collections._containerLeafCounts.set(parentContainer, Math.max(0, existingCount - 1));
      }
    }

    // Invalidate recursive leaf count cache since hierarchy changed
    if (parentContainer) {
      this._invalidateRecursiveLeafCounts(parentContainer);
    }
  }

  removeGraphEdge(edgeId: string): void {
    const edge = this._collections.graphEdges.get(edgeId);
    if (edge) {
      // Remove from node-to-edges mappings
      const sourceEdges = this._collections._nodeToEdges.get(edge.source);
      if (sourceEdges) sourceEdges.delete(edgeId);

      const targetEdges = this._collections._nodeToEdges.get(edge.target);
      if (targetEdges) targetEdges.delete(edgeId);
    }

    this._collections.graphEdges.delete(edgeId);
    this._collections._visibleEdges.delete(edgeId);
  }

  removeHyperEdge(edgeId: string): void {
    const edge = this._collections.hyperEdges.get(edgeId);
    if (edge) {
      // Remove from node-to-edges mappings
      const sourceEdges = this._collections._nodeToEdges.get(edge.source);
      if (sourceEdges) sourceEdges.delete(edgeId);

      const targetEdges = this._collections._nodeToEdges.get(edge.target);
      if (targetEdges) targetEdges.delete(edgeId);
    }

    this._collections.hyperEdges.delete(edgeId);
    this._collections._visibleEdges.delete(edgeId);
  }

  setContainerELKFixed(containerId: string, fixed: boolean): void {
    const container = this._collections.containers.get(containerId);
    if (container) {
      container.elkFixed = fixed;
    }
  }

  getContainerCollapsed(containerId: string): boolean {
    const container = this._collections.containers.get(containerId);
    return container?.collapsed || false;
  }

  /**
   * Recursively count leaf nodes (graphNodes) within a container
   * This counts all graphNodes that are descendants of the container,
   * not just direct children.
   * OPTIMIZED: Uses memoization for O(1) subsequent lookups
   */
  countRecursiveLeafNodes(containerId: string): number {
    // Check cache first for O(1) lookup
    const cached = this._collections._recursiveLeafCounts.get(containerId);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate and cache the result
    const count = this._calculateRecursiveLeafNodes(containerId);
    this._collections._recursiveLeafCounts.set(containerId, count);
    return count;
  }

  /**
   * Internal method to calculate recursive leaf nodes without caching
   * Separated for clarity and testing
   */
  private _calculateRecursiveLeafNodes(containerId: string): number {
    let leafCount = 0;
    const children = this.getContainerChildren(containerId);

    for (const childId of children) {
      // Check if this child is a container or a leaf node
      const childContainer = this._collections.containers.get(childId);

      if (childContainer) {
        // It's a container, recurse into it (this will use cache if available)
        leafCount += this.countRecursiveLeafNodes(childId);
      } else {
        // It's a leaf node (graphNode), count it
        leafCount += 1;
      }
    }

    return leafCount;
  }

  /**
   * Invalidate recursive leaf count cache for a container and its ancestors
   * Called when container hierarchy changes (add/remove children)
   */
  private _invalidateRecursiveLeafCounts(containerId: string): void {
    // Remove cached count for this container
    this._collections._recursiveLeafCounts.delete(containerId);

    // Recursively invalidate all ancestor containers since their counts may change
    let current = this.getContainerParent(containerId);
    while (current) {
      this._collections._recursiveLeafCounts.delete(current);
      current = this.getContainerParent(current);
    }
  }

  setContainerCollapsed(containerId: string, collapsed: boolean): void {
    this.setContainerState(containerId, { collapsed });
  }

  get expandedContainers(): ReadonlyArray<Container> {
    return this.getExpandedContainers();
  }

  getNodeVisibility(nodeId: string): { hidden?: boolean } {
    const node = this._collections.graphNodes.get(nodeId);
    if (!node) return {};

    return {
      hidden: node.hidden || !this._collections._visibleNodes.has(nodeId),
    };
  }

  getEdgeVisibility(edgeId: string): { hidden?: boolean } {
    const edge = this._collections.graphEdges.get(edgeId);
    if (!edge) return {};

    const isVisible =
      this._collections._visibleEdges.has(edgeId) ||
      (this._collections.hyperEdges.has(edgeId) &&
        !this._collections.hyperEdges.get(edgeId)!.hidden);

    return {
      hidden: edge.hidden || !isVisible,
    };
  }

  // ============ INTERNAL HELPERS ============

  private _isEndpointVisible(endpointId: string): boolean {
    // Check if it's a visible node
    const node = this._collections.graphNodes.get(endpointId);
    if (node) return !node.hidden;

    // Check if it's a visible container (collapsed containers are visible)
    const container = this._collections.containers.get(endpointId);
    if (container) return !container.hidden;

    return false;
  }

  // ============ VALIDATION API ============

  /**
   * Validate all VisualizationState invariants
   */
  validateInvariants(): void {
    if (!this._validationEnabled) {
      return; // Skip validation during controlled transitions
    }

    this.invariantValidator.validateInvariants();
  }

  /**
   * Alias for validateInvariants (backwards compatibility)
   */
  validateAllInvariants(context?: string): void {
    if (context) {
    }
    this.validateInvariants();
  }

  disableValidation(): boolean {
    const currentState = this._validationEnabled;
    this._validationEnabled = false;
    return currentState;
  }

  resetValidation(oldState: boolean): void {
    this._validationEnabled = oldState;
  }

  // ============ INTERNAL ACCESS FOR OPERATION CLASSES ============
  // These provide controlled access for the operation classes

  get _internalCollections() {
    return this._collections;
  }

  get _containerOperations() {
    return this.containerOps;
  }

  _updateContainerVisibilityCaches(containerId: string, container: Container): void {
    this.visibilityManager.updateContainerVisibilityCaches(containerId, container);
  }

  _cascadeNodeVisibilityToEdges(nodeId: string): void {
    const connectedEdges = this._collections._nodeToEdges.get(nodeId) || new Set();

    for (const edgeId of Array.from(connectedEdges)) {
      const edge = this._collections.graphEdges.get(edgeId);
      if (!edge) continue;

      const sourceVisible = this._isEndpointVisible(edge.source);
      const targetVisible = this._isEndpointVisible(edge.target);
      const shouldBeVisible = sourceVisible && targetVisible;

      this.setEdgeVisibility(edgeId as string, shouldBeVisible);
    }
  }

  /**
   * Get crossing edges for a container
   * A crossing edge is one where exactly one endpoint is inside the container
   */
  getCrossingEdges(containerId: string): GraphEdge[] {
    return this.containerOps.getCrossingEdges(containerId);
  }

  /**
   * Validate render keys to prevent React duplicate key warnings
   * This method checks for duplicate IDs in the edge collection that would cause React warnings
   */
  private _validateRenderKeys(edges: Edge[]): void {
    const seenKeys = new Set<string>();
    const duplicateKeys = new Set<string>();

    for (const edge of edges) {
      if (seenKeys.has(edge.id)) {
        duplicateKeys.add(edge.id);
      } else {
        seenKeys.add(edge.id);
      }
    }

    if (duplicateKeys.size > 0) {
      console.error(
        `[DUPLICATE_KEYS] Found duplicate edge keys that will cause React warnings:`,
        Array.from(duplicateKeys)
      );

      // Check for ID overlap between regular and hyperEdges
      const regularEdges = Array.from(this._collections._visibleEdges.values());
      const hyperEdges = Array.from(this._collections.hyperEdges.values()).filter(
        (edge: HyperEdge) => !edge.hidden
      );
      const regularIds = new Set(regularEdges.map(e => e.id));
      const hyperIds = new Set(hyperEdges.map(e => e.id));
      const overlap = Array.from(duplicateKeys).filter(
        id => regularIds.has(id) && hyperIds.has(id)
      );

      if (overlap.length > 0) {
        console.error(`[DEBUG] ID OVERLAP between regular edges and hyperEdges:`, overlap);
      }

      // In strict validation mode, throw an error to fail tests
      if (this._validationLevel === 'strict') {
        throw new Error(`Duplicate edge keys detected: ${Array.from(duplicateKeys).join(', ')}`);
      }

      // In normal mode for fuzz tests, treat as test failure
      if (this._validationLevel === 'normal' && duplicateKeys.size > 0) {
        throw new Error(
          `FUZZ TEST FAILURE: Found ${duplicateKeys.size} duplicate edge keys that will cause React warnings. This indicates a timing issue in hyperEdge creation/removal.`
        );
      }

      // Otherwise, just log the warning but let React handle it
      console.warn(
        `[DUPLICATE_KEYS] React will show warnings for these duplicate keys. Check hyperEdge creation/removal timing.`
      );
    }
  }

  public updateNodeDimensions(config: Record<string, unknown>) {
    for (const node of this._collections.graphNodes.values()) {
      const { width, height } = this.layoutOps.calculateNodeDimensions(node, config);
      node.width = width;
      node.height = height;
    }

    // When node dimensions change, we must invalidate the cached dimensions of expanded containers
    // so that the layout engine is forced to recalculate them.
    for (const container of this._collections.containers.values()) {
      if (!container.collapsed) {
        container.width = undefined;
        container.height = undefined;
        if (container.layout) {
          container.layout.dimensions = undefined;
        }
      }
    }
  }
}

/**
 * Create factory function for VisualizationState
 */
export function createVisualizationState(): VisualizationState {
  return new VisualizationState();
}
