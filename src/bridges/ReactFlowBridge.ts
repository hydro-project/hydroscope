/**
 * ReactFlowBridge - Stateless bridge for ReactFlow rendering
 * Architectural constraints: Stateless, synchronous conversions, immutable output
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import type {
  StyleConfig,
  ReactFlowData,
  ReactFlowNode,
  ReactFlowEdge,
} from "../types/core.js";
import {
  processSemanticTags,
  processAggregatedSemanticTags,
} from "../utils/StyleProcessor.js";
import { CURRENT_HANDLE_STRATEGY } from "../render/handleConfig.js";

// Performance optimization constants
const LARGE_GRAPH_NODE_THRESHOLD = 1000;
const LARGE_GRAPH_EDGE_THRESHOLD = 2000;
const PERFORMANCE_CACHE_SIZE = 100;
const CACHE_CLEANUP_THRESHOLD = 500; // Clean cache when it exceeds this size

export class ReactFlowBridge {
  private styleCache = new Map<string, any>();
  private nodeCache = new Map<string, ReactFlowNode>();
  private containerCache = new Map<string, ReactFlowNode[]>();
  private edgeCache = new Map<string, ReactFlowEdge>();
  private lastStateHash: string | null = null;
  private lastResult: ReactFlowData | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private lastCacheCleanup = Date.now();

  constructor(private styleConfig: StyleConfig) {}

  // Clear caches when needed (for testing or memory management)
  clearCaches(): void {
    this.styleCache.clear();
    this.nodeCache.clear();
    this.containerCache.clear();
    this.edgeCache.clear();
    this.lastStateHash = null;
    this.lastResult = null;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // Get cache statistics for performance monitoring
  getCacheStats(): {
    hitRate: number;
    totalRequests: number;
    cacheSize: {
      styles: number;
      nodes: number;
      edges: number;
    };
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      totalRequests,
      cacheSize: {
        styles: this.styleCache.size,
        nodes: this.nodeCache.size,
        edges: this.edgeCache.size,
      },
    };
  }

  // Intelligent cache cleanup
  private cleanupCaches(): void {
    const now = Date.now();

    // Only cleanup if enough time has passed and caches are large
    if (
      now - this.lastCacheCleanup < 60000 || // 1 minute
      this.nodeCache.size + this.edgeCache.size < CACHE_CLEANUP_THRESHOLD
    ) {
      return;
    }

    // Keep only the most recently used items (simple LRU approximation)
    if (this.nodeCache.size > PERFORMANCE_CACHE_SIZE) {
      const entries = Array.from(this.nodeCache.entries());
      this.nodeCache.clear();
      // Keep last 50% of entries
      entries
        .slice(-Math.floor(PERFORMANCE_CACHE_SIZE / 2))
        .forEach(([key, value]) => {
          this.nodeCache.set(key, value);
        });
    }

    if (this.edgeCache.size > PERFORMANCE_CACHE_SIZE) {
      const entries = Array.from(this.edgeCache.entries());
      this.edgeCache.clear();
      entries
        .slice(-Math.floor(PERFORMANCE_CACHE_SIZE / 2))
        .forEach(([key, value]) => {
          this.edgeCache.set(key, value);
        });
    }

    this.lastCacheCleanup = now;
  }

  // Synchronous Conversion with immutability and performance optimizations
  toReactFlowData(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowData {
    // Debug: Log collapsed containers and aggregated edges
    console.log(`[ReactFlowBridge] 🔍 Converting to ReactFlow data:`);
    console.log(`  - Visible nodes: ${state.visibleNodes.length}`);
    console.log(`  - Visible containers: ${state.visibleContainers.length}`);
    console.log(`  - Visible edges: ${state.visibleEdges.length}`);

    // Debug collapsed containers
    const collapsedContainers = state.visibleContainers.filter(
      (c) => c.collapsed,
    );
    console.log(`  - Collapsed containers: ${collapsedContainers.length}`);
    if (collapsedContainers.length > 0 && collapsedContainers.length < 10) {
      console.log(
        `  - Collapsed container IDs: ${collapsedContainers.map((c) => c.id).join(", ")}`,
      );
    }

    // Debug aggregated edges
    const aggregatedEdges = state.visibleEdges.filter(
      (e) => "aggregated" in e && (e as any).aggregated,
    );
    console.log(`  - Aggregated edges: ${aggregatedEdges.length}`);
    if (aggregatedEdges.length > 0 && aggregatedEdges.length < 20) {
      console.log(`  - Aggregated edge details:`);
      aggregatedEdges.forEach((e) => {
        console.log(
          `    - ${e.id}: ${e.source} -> ${e.target} (aggregated: ${(e as any).aggregated})`,
        );
      });
    }

    // Generate state hash for caching
    const stateHash = this.generateStateHash(state, interactionHandler);

    // DEBUG: Log cache status
    console.log(`[ReactFlowBridge] 🔄 CACHE CHECK: current=${stateHash}, last=${this.lastStateHash}, hit=${this.lastStateHash === stateHash}`);

    // Return cached result if state hasn't changed
    if (this.lastStateHash === stateHash && this.lastResult) {
      console.log(`[ReactFlowBridge] 🔄 CACHE HIT: Returning cached result with ${this.lastResult.nodes.length} nodes`);
      return this.deepCloneReactFlowData(this.lastResult);
    }

    console.log(`[ReactFlowBridge] 🔄 CACHE MISS: Recalculating layout`);

    // Detect large graphs for performance optimizations
    const isLargeGraph = this.isLargeGraph(state);

    // Convert with appropriate optimization strategy
    const nodes = isLargeGraph
      ? this.convertNodesOptimized(state, interactionHandler)
      : this.convertNodes(state, interactionHandler);

    const edges = isLargeGraph
      ? this.convertEdgesOptimized(state)
      : this.convertEdges(state);

    // Create result with mutable arrays for ReactFlow compatibility
    const result: ReactFlowData = {
      nodes: this.applyNodeStyles(nodes),
      edges: this.applyEdgeStyles(edges, state),
    };

    // HIERARCHY LOGGING: Log final ReactFlow hierarchy
    console.log(`[ReactFlowBridge] 🏗️ FINAL REACTFLOW HIERARCHY:`);
    console.log(`[ReactFlowBridge] 🏗️ Total nodes: ${result.nodes.length}`);
    console.log(`[ReactFlowBridge] 🏗️ Total edges: ${result.edges.length}`);
    
    // DEBUG: Log actual ReactFlow node structure
    console.log(`[ReactFlowBridge] 🔍 REACTFLOW NODE STRUCTURE:`);
    result.nodes.forEach(node => {
      if (node.type === 'container') {
        console.log(`[ReactFlowBridge] 🔍 Container ${node.id}: parentNode=${node.parentNode}, position=(${node.position.x}, ${node.position.y})`);
      } else {
        console.log(`[ReactFlowBridge] 🔍 Node ${node.id}: parentNode=${node.parentNode}, position=(${node.position.x}, ${node.position.y}), extent=${node.extent}`);
      }
    });
    
    const rootNodes = result.nodes.filter(n => !n.parentId);
    const childNodes = result.nodes.filter(n => n.parentId);
    
    console.log(`[ReactFlowBridge] 🏗️ Root-level nodes: ${rootNodes.length}`);
    rootNodes.forEach(node => {
      const children = result.nodes.filter(n => n.parentId === node.id);
      if (children.length > 0) {
        console.log(`[ReactFlowBridge] 🏗️ Container ${node.id}: type=${node.type}, collapsed=${node.data?.collapsed}, children=${children.length}, position=(${node.position.x}, ${node.position.y})`);
        children.forEach(child => {
          console.log(`[ReactFlowBridge] 🏗️   └─ Child ${child.id}: type=${child.type}, position=(${child.position.x}, ${child.position.y})`);
        });
      } else {
        console.log(`[ReactFlowBridge] 🏗️ Node ${node.id}: type=${node.type}, position=(${node.position.x}, ${node.position.y})`);
      }
    });
    
    if (childNodes.length > 0) {
      // Check for truly orphaned nodes (parent doesn't exist in the node list at all)
      const orphanedNodes = childNodes.filter(n => !result.nodes.find(r => r.id === n.parentId));
      console.log(`[ReactFlowBridge] 🏗️ Orphaned child nodes (should be 0): ${orphanedNodes.length}`);
      if (orphanedNodes.length > 0) {
        console.log(`[ReactFlowBridge] ⚠️ Truly orphaned nodes:`, orphanedNodes.map(n => `${n.id} (parent: ${n.parentId})`));
      }
    }

    // Deep freeze the result for immutability while maintaining TypeScript compatibility
    this.deepFreezeReactFlowData(result);

    // Cache result for performance
    this.lastStateHash = stateHash;
    this.lastResult = result;

    // Cleanup caches periodically for memory management
    this.cleanupCaches();

    // Return deep clone to ensure immutability
    return this.deepCloneReactFlowData(result);
  }

  // Performance optimization helpers
  private generateStateHash(
    state: VisualizationState,
    interactionHandler?: any,
  ): string {
    // Simple hash based on visible element counts and interaction handler presence
    const nodeCount = state.visibleNodes.length;
    const edgeCount = state.visibleEdges.length;
    const containerCount = state.visibleContainers.length;
    const hasHandler = !!interactionHandler;

    // Include layout state for cache invalidation
    const layoutState = state.getLayoutState();

    // DEBUG: Include container collapsed states in hash
    const containerStates = state.visibleContainers.map(c => `${c.id}:${c.collapsed}`).join(',');

    const hash = `${nodeCount}-${edgeCount}-${containerCount}-${hasHandler}-${layoutState.lastUpdate}-${containerStates}`;
    
    console.log(`[ReactFlowBridge] 🔄 HASH COMPONENTS: nodes=${nodeCount}, edges=${edgeCount}, containers=${containerCount}, handler=${hasHandler}, layout=${layoutState.lastUpdate}, containerStates=${containerStates}`);
    console.log(`[ReactFlowBridge] 🔄 GENERATED HASH: ${hash}`);

    return hash;
  }

  private isLargeGraph(state: VisualizationState): boolean {
    return (
      state.visibleNodes.length > LARGE_GRAPH_NODE_THRESHOLD ||
      state.visibleEdges.length > LARGE_GRAPH_EDGE_THRESHOLD
    );
  }

  private deepFreezeReactFlowData(data: ReactFlowData): void {
    // Freeze the top-level object and arrays
    Object.freeze(data);
    Object.freeze(data.nodes);
    Object.freeze(data.edges);

    // Freeze each node and its nested objects
    data.nodes.forEach((node) => {
      Object.freeze(node);
      Object.freeze(node.position);
      Object.freeze(node.data);
      if (node.data.semanticTags) Object.freeze(node.data.semanticTags);
      if (node.data.appliedSemanticTags)
        Object.freeze(node.data.appliedSemanticTags);
      if (node.style) Object.freeze(node.style);
    });

    // Freeze each edge and its nested objects
    data.edges.forEach((edge) => {
      Object.freeze(edge);
      if (edge.data) {
        Object.freeze(edge.data);
        if (edge.data.semanticTags) Object.freeze(edge.data.semanticTags);
        if (edge.data.appliedSemanticTags)
          Object.freeze(edge.data.appliedSemanticTags);
        if (edge.data.originalEdgeIds) Object.freeze(edge.data.originalEdgeIds);
      }
      if (edge.style) Object.freeze(edge.style);
    });
  }

  private deepCloneReactFlowData(data: ReactFlowData): ReactFlowData {
    const clonedNodes = data.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: {
        ...node.data,
        // Deep clone onClick function reference (but not the function itself)
        onClick: node.data.onClick,
        semanticTags: node.data.semanticTags
          ? [...node.data.semanticTags]
          : undefined,
        appliedSemanticTags: node.data.appliedSemanticTags
          ? [...node.data.appliedSemanticTags]
          : undefined,
      },
      style: node.style ? { ...node.style } : undefined,
    }));

    const clonedEdges = data.edges.map((edge) => ({
      ...edge,
      style: edge.style ? { ...edge.style } : undefined,
      data: edge.data
        ? {
            ...edge.data,
            semanticTags: edge.data.semanticTags
              ? [...edge.data.semanticTags]
              : undefined,
            appliedSemanticTags: edge.data.appliedSemanticTags
              ? [...edge.data.appliedSemanticTags]
              : undefined,
            originalEdgeIds: edge.data.originalEdgeIds
              ? [...edge.data.originalEdgeIds]
              : undefined,
          }
        : undefined,
    }));

    const clonedResult = {
      nodes: clonedNodes,
      edges: clonedEdges,
    };

    // Deep freeze the cloned result
    this.deepFreezeReactFlowData(clonedResult);

    return clonedResult;
  }

  // Optimized conversion for large graphs - use same logic as regular conversion
  private convertNodesOptimized(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowNode[] {
    // For now, use the same logic as regular conversion
    // TODO: Add caching and batching optimizations
    return this.convertNodes(state, interactionHandler);
  }

  private convertEdgesOptimized(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = [];
    const visibleEdges = state.visibleEdges;

    console.log(
      `[ReactFlowBridge] 🚀 Using optimized edge conversion for ${visibleEdges.length} edges`,
    );

    let cacheHits = 0;
    let cacheMisses = 0;
    let validEdges = 0;
    let invalidEdges = 0;

    // Batch process edges for better performance
    for (let i = 0; i < visibleEdges.length; i++) {
      const edge = visibleEdges[i];
      const cacheKey = `edge-${edge.id}-${edge.type}`;

      let reactFlowEdge = this.edgeCache.get(cacheKey);
      if (!reactFlowEdge) {
        cacheMisses++;

        let renderedEdge: ReactFlowEdge | null;
        if ("aggregated" in edge && (edge as any).aggregated) {
          renderedEdge = this.renderAggregatedEdge(edge, state);
        } else {
          renderedEdge = this.renderOriginalEdge(edge, state);
        }

        // Only cache and add valid edges
        if (renderedEdge) {
          validEdges++;
          reactFlowEdge = renderedEdge;
          // Limit cache size to prevent memory issues
          if (this.edgeCache.size < PERFORMANCE_CACHE_SIZE) {
            this.edgeCache.set(cacheKey, reactFlowEdge);
          }
          edges.push(reactFlowEdge);
        } else {
          invalidEdges++;
          console.warn(
            `[ReactFlowBridge] ⚠️ Optimized conversion: Edge ${edge.id} failed to render`,
          );
        }
      } else {
        cacheHits++;
        validEdges++;
        edges.push(reactFlowEdge);
      }
    }

    console.log(`[ReactFlowBridge] 📊 Optimized edge conversion summary:`);
    console.log(`  - Cache hits: ${cacheHits}, Cache misses: ${cacheMisses}`);
    console.log(
      `  - Valid edges: ${validEdges}, Invalid edges: ${invalidEdges}`,
    );
    console.log(`  - Final edge count: ${edges.length}`);

    // Trigger cache cleanup if needed
    this.cleanupCaches();

    return edges;
  }

  private convertNodes(
    state: VisualizationState,
    interactionHandler?: any,
  ): ReactFlowNode[] {
    const nodes: ReactFlowNode[] = [];

    // Build parent mapping for nodes and containers
    const nodeParentMap = new Map<string, string>();
    const containerParentMap = new Map<string, string>();

    // Map nodes to their parent containers
    for (const container of state.visibleContainers) {
      for (const childId of container.children) {
        nodeParentMap.set(childId, container.id);
        console.log(
          `[ReactFlowBridge] Node ${childId} assigned to container ${container.id}`,
        );
      }
    }

    // Map containers to their parent containers
    for (const container of state.visibleContainers) {
      const parentContainerId = state.getContainerParent(container.id);
      if (parentContainerId) {
        containerParentMap.set(container.id, parentContainerId);
        console.log(
          `[ReactFlowBridge] Container ${container.id} assigned to parent container ${parentContainerId}`,
        );
      }
    }

    // Sort containers so parents come before children
    // Use hierarchy depth to ensure parents appear before children
    const sortedContainers = [...state.visibleContainers].sort((a, b) => {
      const aDepth = state.getContainerAncestors(a.id).length;
      const bDepth = state.getContainerAncestors(b.id).length;
      return aDepth - bDepth; // Parents (lower depth) come first
    });
    
    // Add containers first (parents before children)
    for (const container of sortedContainers) {
      const parentId = containerParentMap.get(container.id);

      // Get position and dimensions from ELK layout
      const position = container.position || { x: 0, y: 0 };
      const width = container.dimensions?.width || container.width || 200;
      const height = container.dimensions?.height || container.height || 150;

      // AGGRESSIVE DEBUG: Log container info with all dimension sources
      console.log(
        `[ReactFlowBridge] 🔍 CONTAINER ${container.id}: collapsed=${container.collapsed}, children=${container.children.size}`,
      );
      console.log(
        `[ReactFlowBridge] 🔍 CONTAINER ${container.id} POSITION: ELK=(${position.x}, ${position.y})`,
      );
      console.log(
        `[ReactFlowBridge] 🔍 CONTAINER ${container.id} DIMENSIONS: width=${width} (from: dimensions=${container.dimensions?.width}, width=${container.width}, fallback=200), height=${height} (from: dimensions=${container.dimensions?.height}, height=${container.height}, fallback=150)`,
      );
      console.log(
        `[ReactFlowBridge] 🔍 CONTAINER ${container.id} RAW DIMENSIONS:`, {
          dimensions: container.dimensions,
          width: container.width,
          height: container.height,
        },
      );
      if (container.children.size > 0) {
        const childIds = Array.from(container.children).slice(0, 5); // First 5 children
        console.log(
          `[ReactFlowBridge] Container ${container.id} children (first 5):`,
          childIds,
        );
      }

      const nodeCount = container.collapsed
        ? this.countContainerNodes(container, state)
        : 0;

      // CRITICAL DEBUG: Check if position needs adjustment for nested containers
      console.log(`[ReactFlowBridge] 🔍 CONTAINER ${container.id}: parentId=${parentId}, position from ELK=(${position.x}, ${position.y})`);
      
      const containerNode: ReactFlowNode = {
        id: container.id,
        type: container.collapsed ? "standard" : "container", // Critical: Make sure to use 'standard' type for collapsed containers (to avoid edge connection bugs), 'container' type only for expanded (proper UI)
        position,
        data: {
          label: container.label || container.id,
          nodeType: "container",
          collapsed: container.collapsed,
          containerChildren: container.children.size,
          nodeCount,
          width,
          height,
          colorPalette: "Set3",
          style: "default",
          onClick: interactionHandler
            ? (elementId: string, elementType: "node" | "container") => {
                if (elementType === "container") {
                  interactionHandler.handleContainerClick(elementId);
                }
              }
            : undefined,
        },
        style: {
          width,
          height,
          ...(this.styleConfig?.containerStyles
            ? container.collapsed
              ? this.styleConfig.containerStyles.collapsed
              : this.styleConfig.containerStyles.expanded
            : {}),
        },
        parentId: parentId,
        parentNode: parentId, // React Flow uses parentNode
        // CRITICAL: Do NOT set extent: "parent" on container nodes themselves!
        // Only leaf nodes (regular nodes) should have extent set.
        // Container nodes are positioned via parentNode, but need freedom to size themselves.
        extent: undefined,
      };

      nodes.push(containerNode);
    }

    // Add regular nodes with proper parent relationships
    for (const node of state.visibleNodes) {
      const parentId = nodeParentMap.get(node.id);
      const parentContainer = parentId ? state.getContainer(parentId) : null;

      // Skip nodes that are inside collapsed containers
      if (parentContainer && parentContainer.collapsed) {
        continue;
      }

      const position = node.position;

      // Debug: Log all node positions from ELK
      console.log(
        `[ReactFlowBridge] Node ${node.id} ELK position: (${position?.x}, ${position?.y}), assigned to container: ${parentId}`,
      );

      // AGGRESSIVE DEBUG: Log node positioning pipeline
      let adjustedPosition = position || { x: 0, y: 0 };
      
      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id}: parentId=${parentId}, parentContainer=${!!parentContainer}, ELK position=(${adjustedPosition.x}, ${adjustedPosition.y})`,
      );

      if (parentId && parentContainer) {
        // Get the parent container's position and dimensions for bounds checking
        const parentDimensions = {
          width: parentContainer.dimensions?.width || parentContainer.width || 200,
          height: parentContainer.dimensions?.height || parentContainer.height || 150,
        };
        
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} PARENT INFO: dimensions=(${parentDimensions.width}x${parentDimensions.height}), collapsed=${parentContainer.collapsed}`,
        );
        
        // CRITICAL FIX: ELK already returns child positions relative to their parent container!
        // We should NOT subtract the parent position. The position from ELK is already correct.
        // See: https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html
        // "The coordinates of most elements are relative to their parent element."
        
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} POSITION: ELK relative=(${adjustedPosition.x}, ${adjustedPosition.y}) (already relative to parent)`,
        );
        
        // Check if position is within parent bounds (for debugging only)
        const withinBounds = adjustedPosition.x >= 0 && adjustedPosition.y >= 0 && 
                           adjustedPosition.x <= parentDimensions.width && 
                           adjustedPosition.y <= parentDimensions.height;
        
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id} BOUNDS CHECK: within parent bounds=${withinBounds}`,
        );
        
        // adjustedPosition already contains the correct relative position from ELK
      } else {
        console.log(
          `[ReactFlowBridge] 🔍 NODE ${node.id}: NO PARENT - using absolute position=(${adjustedPosition.x}, ${adjustedPosition.y})`,
        );
      }

      // FINAL DEBUG: Log the position that will be used in ReactFlow node
      console.log(
        `[ReactFlowBridge] 🔍 NODE ${node.id} FINAL POSITION: (${adjustedPosition.x}, ${adjustedPosition.y}) - parentId=${parentId}`,
      );
      
      // CRITICAL DEBUG: Check ReactFlow parent-child setup
      if (parentId) {
        console.log(`[ReactFlowBridge] 🔍 NODE ${node.id} REACTFLOW SETUP: parentId="${parentId}", parentNode="${parentId}", extent="parent", position=(${adjustedPosition.x}, ${adjustedPosition.y})`);
      }

      // CRITICAL FIX: Get node dimensions from ELK to ensure rendered size matches layout
      const width = node.dimensions?.width || 120;
      const height = node.dimensions?.height || 60;
      
      console.log(`[ReactFlowBridge] 🔍 NODE ${node.id} DIMENSIONS: from ELK=${node.dimensions?.width}x${node.dimensions?.height}, using=${width}x${height}`);

      const reactFlowNode: ReactFlowNode = {
        id: node.id,
        type: "standard",
        position: adjustedPosition,
        data: {
          label: node.showingLongLabel ? node.longLabel : node.label,
          longLabel: node.longLabel,
          showingLongLabel: node.showingLongLabel,
          nodeType: node.type,
          semanticTags: node.semanticTags || [],
          colorPalette: "Set3",
          style: node.type || "default",
          width,  // Pass ELK-calculated width to match layout
          height, // Pass ELK-calculated height to match layout
          onClick: interactionHandler
            ? (elementId: string, elementType: "node" | "container") => {
                if (elementType === "node") {
                  interactionHandler.handleNodeClick(elementId);
                }
              }
            : undefined,
        },
        parentId: parentId,
        parentNode: parentId, // React Flow uses parentNode
        // CRITICAL: Do NOT set extent="parent" for nodes inside containers!
        // ReactFlow has a bug where extent="parent" breaks positioning for nodes
        // in deeply nested containers, causing nodes to overlap even when ELK
        // calculated correct non-overlapping positions. The parentNode property
        // alone is sufficient for React Flow to understand the hierarchy.
        // See: chat.json Backtrace hierarchy bug where nodes overlapped in bt_6
      };

      nodes.push(reactFlowNode);
    }

    return nodes;
  }

  private countContainerNodes(
    container: any,
    state: VisualizationState,
  ): number {
    let count = 0;
    for (const childId of container.children) {
      const childNode = state.getGraphNode(childId);
      const childContainer = state.getContainer(childId);
      if (childNode) {
        count++;
      } else if (childContainer) {
        count += this.countContainerNodes(childContainer, state);
      }
    }
    return count;
  }

  private convertEdges(state: VisualizationState): ReactFlowEdge[] {
    const edges: ReactFlowEdge[] = [];

    // Debug: Create a set of visible node IDs for validation
    const visibleNodeIds = new Set(state.visibleNodes.map((node) => node.id));
    const visibleContainerIds = new Set(
      state.visibleContainers.map((container) => container.id),
    );
    const allVisibleIds = new Set([...visibleNodeIds, ...visibleContainerIds]);

    console.log(`[ReactFlowBridge] 🔍 Edge validation context:`);
    console.log(
      `  - Visible nodes: ${visibleNodeIds.size} (${Array.from(visibleNodeIds).slice(0, 5).join(", ")}${visibleNodeIds.size > 5 ? "..." : ""})`,
    );
    console.log(
      `  - Visible containers: ${visibleContainerIds.size} (${Array.from(visibleContainerIds).slice(0, 5).join(", ")}${visibleContainerIds.size > 5 ? "..." : ""})`,
    );
    console.log(`  - Total visible elements: ${allVisibleIds.size}`);
    console.log(`  - Edges to process: ${state.visibleEdges.length}`);

    // Debug: Log first few edges to see their actual source/target values
    if (state.visibleEdges.length > 0) {
      console.log(`[ReactFlowBridge] 🔍 First few edges to validate:`);
      state.visibleEdges.slice(0, 5).forEach((edge, index) => {
        console.log(
          `  ${index + 1}. ${edge.id}: "${edge.source}" -> "${edge.target}" (type: ${edge.type})`,
        );
      });
    }

    let validEdgeCount = 0;
    let invalidEdgeCount = 0;
    let floatingEdgeCount = 0;
    let skippedEdgeCount = 0;

    for (const edge of state.visibleEdges) {
      const edgeValidation = this.validateEdge(
        edge,
        allVisibleIds,
        visibleNodeIds,
        visibleContainerIds,
        state,
      );

      if (!edgeValidation.isValid) {
        invalidEdgeCount++;
        if (edgeValidation.isFloating) {
          floatingEdgeCount++;
        }

        // Log detailed error for first few invalid edges
        if (invalidEdgeCount <= 10) {
          console.error(
            `[ReactFlowBridge] ❌ Invalid edge ${edge.id}:`,
            edgeValidation.reason,
          );
          console.error(
            `  - Source: ${edge.source} (visible: ${edgeValidation.sourceExists}, exists: ${edgeValidation.sourceInAllNodes}, type: ${edgeValidation.sourceType})`,
          );
          console.error(
            `  - Target: ${edge.target} (visible: ${edgeValidation.targetExists}, exists: ${edgeValidation.targetInAllNodes}, type: ${edgeValidation.targetType})`,
          );
          if (edgeValidation.isFloating) {
            console.error(
              `  - 🔴 FLOATING EDGE DETECTED: One or both endpoints don't exist in the graph!`,
            );
          } else {
            console.error(
              `  - ⚠️ HIDDEN EDGE: Edge endpoints exist but are not visible (likely in collapsed containers)`,
            );
          }
        }
        continue; // Skip invalid edges
      }

      // Edge is valid, log success for debugging
      validEdgeCount++;
      if (validEdgeCount <= 5) {
        // Log first few valid edges
        console.log(
          `[ReactFlowBridge] ✅ Valid edge ${edge.id}: ${edge.source} (${edgeValidation.sourceType}) -> ${edge.target} (${edgeValidation.targetType})`,
        );
      }

      let renderedEdge;
      if ("aggregated" in edge && (edge as any).aggregated) {
        renderedEdge = this.renderAggregatedEdge(edge, state);
      } else {
        renderedEdge = this.renderOriginalEdge(edge, state);
      }

      // Only add the edge if it was successfully rendered (not null)
      if (renderedEdge) {
        edges.push(renderedEdge);
      } else {
        skippedEdgeCount++;
        console.warn(
          `[ReactFlowBridge] ⚠️ Edge ${edge.id} was valid but failed to render`,
        );
      }
    }

    // Summary report
    console.log(`[ReactFlowBridge] 📊 Edge processing summary:`);
    console.log(`  - ✅ Valid edges: ${validEdgeCount}`);
    console.log(`  - ❌ Invalid edges: ${invalidEdgeCount}`);
    console.log(`  - 🔴 Floating edges: ${floatingEdgeCount}`);
    console.log(`  - ⚠️ Skipped during render: ${skippedEdgeCount}`);
    console.log(`  - 🎯 Successfully rendered: ${edges.length}`);

    if (floatingEdgeCount > 0) {
      console.error(
        `[ReactFlowBridge] 🚨 FLOATING EDGE PROBLEM: ${floatingEdgeCount} edges are floating (missing endpoints)!`,
      );
    }

    // ADDITIONAL VALIDATION: Check the final rendered edges for potential ReactFlow issues
    this.validateFinalRenderedEdges(
      edges,
      visibleNodeIds,
      visibleContainerIds,
      state,
    );

    return edges;
  }

  private validateEdge(
    edge: any,
    allVisibleIds: Set<string>,
    visibleNodeIds: Set<string>,
    visibleContainerIds: Set<string>,
    state: VisualizationState,
  ): {
    isValid: boolean;
    isFloating: boolean;
    reason: string;
    sourceExists: boolean;
    targetExists: boolean;
    sourceType: string;
    targetType: string;
    sourceInAllNodes: boolean;
    targetInAllNodes: boolean;
  } {
    // Check for null/undefined/empty source or target
    if (!edge.source || !edge.target) {
      return {
        isValid: false,
        isFloating: true,
        reason: `Missing source or target: source="${edge.source}", target="${edge.target}"`,
        sourceExists: false,
        targetExists: false,
        sourceType: "missing",
        targetType: "missing",
        sourceInAllNodes: false,
        targetInAllNodes: false,
      };
    }

    // Check if source and target are strings
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      return {
        isValid: false,
        isFloating: true,
        reason: `Source or target is not a string: source type=${typeof edge.source}, target type=${typeof edge.target}`,
        sourceExists: false,
        targetExists: false,
        sourceType: typeof edge.source,
        targetType: typeof edge.target,
        sourceInAllNodes: false,
        targetInAllNodes: false,
      };
    }

    // Check if source and target exist in visible elements
    const sourceExists = allVisibleIds.has(edge.source);
    const targetExists = allVisibleIds.has(edge.target);

    // ENHANCED: Also check if they exist in ALL nodes/containers (including hidden ones)
    const sourceInAllNodes =
      state.getGraphNode(edge.source) !== undefined ||
      state.getContainer(edge.source) !== undefined;
    const targetInAllNodes =
      state.getGraphNode(edge.target) !== undefined ||
      state.getContainer(edge.target) !== undefined;

    // Determine element types for visible elements
    let sourceType = "missing";
    let targetType = "missing";

    if (visibleNodeIds.has(edge.source)) {
      sourceType = "node";
    } else if (visibleContainerIds.has(edge.source)) {
      sourceType = "container";
    } else if (sourceInAllNodes) {
      // Check if it's a hidden node or container
      if (state.getGraphNode(edge.source)) {
        sourceType = "hidden-node";
      } else if (state.getContainer(edge.source)) {
        sourceType = "hidden-container";
      }
    }

    if (visibleNodeIds.has(edge.target)) {
      targetType = "node";
    } else if (visibleContainerIds.has(edge.target)) {
      targetType = "container";
    } else if (targetInAllNodes) {
      // Check if it's a hidden node or container
      if (state.getGraphNode(edge.target)) {
        targetType = "hidden-node";
      } else if (state.getContainer(edge.target)) {
        targetType = "hidden-container";
      }
    }

    // An edge is floating if either endpoint doesn't exist at all (not even hidden)
    const isFloating = !sourceInAllNodes || !targetInAllNodes;

    // An edge is invalid if either endpoint is not visible OR doesn't exist at all
    const isValid = sourceExists && targetExists;

    let reason = "Valid edge";
    if (isFloating) {
      reason = `Floating edge: source exists=${sourceInAllNodes}, target exists=${targetInAllNodes}`;
    } else if (!isValid) {
      reason = `Edge endpoints not visible: source visible=${sourceExists} (${sourceType}), target visible=${targetExists} (${targetType})`;
    }

    // Check for self-loops (optional validation)
    if (edge.source === edge.target) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Self-loop detected: ${edge.id} (${edge.source} -> ${edge.target})`,
      );
      // Self-loops are valid but worth noting
    }

    return {
      isValid,
      isFloating,
      reason,
      sourceExists,
      targetExists,
      sourceType,
      targetType,
      sourceInAllNodes,
      targetInAllNodes,
    };
  }

  // Styling with immutability and performance optimizations
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map((node) => {
      // Create style cache key for performance
      const styleCacheKey = `node-style-${node.data.nodeType}-${node.data.label}`;

      // Check style cache first
      let cachedStyle = this.styleCache.get(styleCacheKey);
      if (cachedStyle) {
        return this.createImmutableNode(
          node,
          cachedStyle.style,
          cachedStyle.appliedTags,
        );
      }

      // Get semantic tags from node data
      const semanticTags = node.data.semanticTags || [];

      // Start with type-based styles
      const typeBasedStyle =
        this.styleConfig.nodeStyles?.[node.data.nodeType] || {};

      // Process semantic tags for styling (only if we have semantic tags and config)
      let semanticStyle = {};
      let appliedTags: string[] = [];

      if (
        semanticTags.length > 0 &&
        (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)
      ) {
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          node.data.label,
          "node",
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...node.style,
      };

      // Cache the computed style for performance
      if (this.styleCache.size < PERFORMANCE_CACHE_SIZE) {
        this.styleCache.set(styleCacheKey, {
          style: combinedStyle,
          appliedTags,
        });
      }

      return this.createImmutableNode(node, combinedStyle, appliedTags);
    });
  }

  private createImmutableNode(
    node: ReactFlowNode,
    style: any,
    appliedTags: string[],
  ): ReactFlowNode {
    const result = {
      ...node,
      position: { ...node.position },
      style: { ...style },
      data: {
        ...node.data,
        appliedSemanticTags: [...appliedTags],
      },
    };

    // Freeze the node and its nested objects
    Object.freeze(result);
    Object.freeze(result.position);
    Object.freeze(result.style);
    Object.freeze(result.data);
    Object.freeze(result.data.appliedSemanticTags);
    if (result.data.semanticTags) Object.freeze(result.data.semanticTags);

    return result;
  }

  applyEdgeStyles(
    edges: ReactFlowEdge[],
    state?: VisualizationState,
  ): ReactFlowEdge[] {
    return edges.map((edge) => {
      // Get semantic tags from edge data
      const edgeData = edge.data as any;
      const semanticTags = edgeData?.semanticTags || [];
      const isAggregated = edgeData?.aggregated === true;

      // Create style cache key for performance
      const styleCacheKey = `edge-style-${edge.type}-${semanticTags.join(",")}-${edge.id}-${isAggregated}`;

      // Check style cache first
      let cachedStyle = this.styleCache.get(styleCacheKey);
      if (cachedStyle) {
        return this.createImmutableEdge(edge, cachedStyle);
      }

      // Start with type-based styles
      const typeBasedStyle = this.styleConfig.edgeStyles?.[edge.type] || {};

      // Process semantic tags for styling
      let semanticStyle = {};
      let appliedTags: string[] = [];
      let animated = false;
      let label = edge.label;
      let markerEnd = edge.markerEnd;
      let lineStyle: "single" | "double" = "single";

      if (isAggregated && state && edgeData?.originalEdgeIds) {
        // For aggregated edges, use conflict resolution system
        console.log(
          `[ReactFlowBridge] 🔄 Processing aggregated edge ${edge.id} with ${edgeData.originalEdgeIds.length} original edges`,
        );

        // Get original edges from state
        const originalEdges = edgeData.originalEdgeIds
          .map((id: string) => state.getGraphEdge(id))
          .filter((e: any) => e !== undefined);

        if (originalEdges.length > 0) {
          const processedStyle = processAggregatedSemanticTags(
            originalEdges,
            this.styleConfig,
            edge.label as string,
          );
          semanticStyle = processedStyle.style;
          appliedTags = processedStyle.appliedTags;
          animated = processedStyle.animated;
          label = processedStyle.label || edge.label;
          markerEnd =
            (processedStyle.markerEnd as
              | string
              | { type: string; color?: string; strokeWidth?: number }
              | undefined) || edge.markerEnd;
          lineStyle = processedStyle.lineStyle || "single";

          console.log(
            `[ReactFlowBridge] ✅ Aggregated edge ${edge.id} resolved conflicts:`,
            {
              originalEdgeCount: originalEdges.length,
              appliedTags,
              hasStyle: Object.keys(semanticStyle).length > 0,
              hasSemanticMappings: !!this.styleConfig.semanticMappings,
            },
          );
        } else {
          // No original edges found, use default styling
          console.log(
            `[ReactFlowBridge] ⚠️ Aggregated edge ${edge.id} has no original edges, using default styling`,
          );
          const defaultStyle = processSemanticTags(
            [],
            this.styleConfig,
            edge.label as string,
            "edge",
          );
          semanticStyle = defaultStyle.style;
          appliedTags = defaultStyle.appliedTags;
        }
      } else if (
        semanticTags.length > 0 &&
        (this.styleConfig.semanticMappings || this.styleConfig.propertyMappings)
      ) {
        // For regular edges, use normal semantic processing
        const processedStyle = processSemanticTags(
          semanticTags,
          this.styleConfig,
          edge.label as string,
          "edge",
        );
        semanticStyle = processedStyle.style;
        appliedTags = processedStyle.appliedTags;
        animated = processedStyle.animated;
        label = processedStyle.label || edge.label;
        markerEnd =
          (processedStyle.markerEnd as
            | string
            | { type: string; color?: string; strokeWidth?: number }
            | undefined) || edge.markerEnd;
        lineStyle = processedStyle.lineStyle || "single";
      }

      // Combine styles: type-based, then semantic, then existing
      const combinedStyle = {
        ...typeBasedStyle,
        ...semanticStyle,
        ...edge.style,
      };

      const styleData = {
        style: combinedStyle,
        animated: animated || edge.animated,
        label: label,
        markerEnd: markerEnd,
        appliedTags: appliedTags,
        lineStyle: lineStyle,
      };

      // Cache the computed style for performance
      if (this.styleCache.size < PERFORMANCE_CACHE_SIZE) {
        this.styleCache.set(styleCacheKey, styleData);
      }

      return this.createImmutableEdge(edge, styleData);
    });
  }

  private createImmutableEdge(
    edge: ReactFlowEdge,
    styleData: any,
  ): ReactFlowEdge {
    const result = {
      ...edge,
      style: { ...styleData.style },
      animated: styleData.animated,
      label: styleData.label,
      markerEnd: styleData.markerEnd || { type: "arrowclosed" },
      data: {
        ...edge.data,
        appliedSemanticTags: [...styleData.appliedTags],
        lineStyle: styleData.lineStyle,
      },
    };

    // Freeze the edge and its nested objects
    Object.freeze(result);
    Object.freeze(result.style);
    Object.freeze(result.data);
    Object.freeze(result.data.appliedSemanticTags);
    if (result.data.semanticTags) Object.freeze(result.data.semanticTags);
    if (result.data.originalEdgeIds) Object.freeze(result.data.originalEdgeIds);

    return result;
  }

  // Container Handling
  // These methods are no longer used - container rendering is handled in convertNodes

  // Smart Handle Selection
  private getSmartHandles(
    visState: VisualizationState,
    sourceId: string,
    targetId: string,
  ): { sourceHandle?: string; targetHandle?: string } {
    console.log(
      `[ReactFlowBridge] 🎯 Getting smart handles for ${sourceId} -> ${targetId}`,
    );
    console.log(
      `[ReactFlowBridge] 🎯 CURRENT_HANDLE_STRATEGY = "${CURRENT_HANDLE_STRATEGY}"`,
    );

    if (CURRENT_HANDLE_STRATEGY !== "discrete") {
      console.log(
        `[ReactFlowBridge] Strategy is ${CURRENT_HANDLE_STRATEGY}, skipping handle selection`,
      );
      return {}; // No handle selection needed for other strategies
    }

    try {
      // Get source element (node or container)
      const sourceNode = visState.getGraphNode(sourceId);
      const sourceContainer = sourceNode
        ? null
        : visState.getContainer(sourceId);
      const sourceElement = sourceNode || sourceContainer;

      // Get target element (node or container)
      const targetNode = visState.getGraphNode(targetId);
      const targetContainer = targetNode
        ? null
        : visState.getContainer(targetId);
      const targetElement = targetNode || targetContainer;

      if (!sourceElement || !targetElement) {
        console.log(
          `[ReactFlowBridge] ⚠️ Missing elements for ${sourceId} -> ${targetId}: sourceElement=${!!sourceElement}, targetElement=${!!targetElement}`,
        );
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }

      // Get positions with fallbacks
      const sourcePos = {
        x: sourceElement.position?.x ?? (sourceElement as any).x ?? 0,
        y: sourceElement.position?.y ?? (sourceElement as any).y ?? 0,
      };
      const targetPos = {
        x: targetElement.position?.x ?? (targetElement as any).x ?? 0,
        y: targetElement.position?.y ?? (targetElement as any).y ?? 0,
      };

      // Validate positions
      if (
        !this.isValidPosition(sourcePos) ||
        !this.isValidPosition(targetPos)
      ) {
        console.log(
          `[ReactFlowBridge] ⚠️ Invalid positions for ${sourceId} -> ${targetId}: sourcePos=${JSON.stringify(sourcePos)}, targetPos=${JSON.stringify(targetPos)}`,
        );
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }

      // Get dimensions with fallbacks
      const sourceWidth = Math.max(
        1,
        sourceElement.dimensions?.width ?? (sourceElement as any).width ?? 120,
      );
      const sourceHeight = Math.max(
        1,
        sourceElement.dimensions?.height ?? (sourceElement as any).height ?? 40,
      );
      const targetWidth = Math.max(
        1,
        targetElement.dimensions?.width ?? (targetElement as any).width ?? 120,
      );
      const targetHeight = Math.max(
        1,
        targetElement.dimensions?.height ?? (targetElement as any).height ?? 40,
      );

      // Calculate centers
      const sourceCenterX = sourcePos.x + sourceWidth / 2;
      const sourceCenterY = sourcePos.y + sourceHeight / 2;
      const targetCenterX = targetPos.x + targetWidth / 2;
      const targetCenterY = targetPos.y + targetHeight / 2;

      // Calculate relative position
      const deltaX = targetCenterX - sourceCenterX;
      const deltaY = targetCenterY - sourceCenterY;

      // Validate deltas
      if (!isFinite(deltaX) || !isFinite(deltaY)) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }

      // Direction thresholds
      const DIRECTION_THRESHOLD = 1.2;
      const MIN_SEPARATION = 10;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If nodes are too close, default to vertical
      if (absX < MIN_SEPARATION && absY < MIN_SEPARATION) {
        return { sourceHandle: "out-bottom", targetHandle: "in-top" };
      }

      // Determine primary direction and select handles
      const isHorizontalPrimary = absX > absY * DIRECTION_THRESHOLD;
      const isVerticalPrimary = absY > absX * DIRECTION_THRESHOLD;

      if (isHorizontalPrimary) {
        // Horizontal arrangement
        if (deltaX > 0) {
          // Target is to the right
          return { sourceHandle: "out-right", targetHandle: "in-left" };
        } else {
          // Target is to the left - fall back to vertical
          return { sourceHandle: "out-bottom", targetHandle: "in-top" };
        }
      } else if (isVerticalPrimary) {
        // Vertical arrangement
        if (deltaY > 0) {
          // Target is below
          return { sourceHandle: "out-bottom", targetHandle: "in-top" };
        } else {
          // Target is above - use horizontal if reasonable
          if (absX > sourceWidth / 2) {
            return deltaX > 0
              ? { sourceHandle: "out-right", targetHandle: "in-left" }
              : { sourceHandle: "out-bottom", targetHandle: "in-top" };
          } else {
            return { sourceHandle: "out-bottom", targetHandle: "in-top" };
          }
        }
      }

      // Default case
      const result = { sourceHandle: "out-bottom", targetHandle: "in-top" };
      console.log(
        `[ReactFlowBridge] 🎯 Selected handles for ${sourceId} -> ${targetId}:`,
        result,
      );
      return result;
    } catch (error) {
      console.warn("[ReactFlowBridge] Error in smart handle selection:", error);
      return { sourceHandle: "out-bottom", targetHandle: "in-top" };
    }
  }

  private isValidPosition(pos: { x: number; y: number }): boolean {
    return (
      typeof pos.x === "number" &&
      typeof pos.y === "number" &&
      isFinite(pos.x) &&
      isFinite(pos.y) &&
      !isNaN(pos.x) &&
      !isNaN(pos.y)
    );
  }

  private validateEdgeForRendering(
    edge: any,
    edgeType: "original" | "aggregated",
  ): {
    isValid: boolean;
    reason: string;
  } {
    // Check for required properties
    if (!edge) {
      return { isValid: false, reason: "Edge is null or undefined" };
    }

    if (!edge.id) {
      return { isValid: false, reason: "Edge missing required id property" };
    }

    if (!edge.source || typeof edge.source !== "string") {
      return {
        isValid: false,
        reason: `Edge source is invalid: "${edge.source}" (type: ${typeof edge.source})`,
      };
    }

    if (!edge.target || typeof edge.target !== "string") {
      return {
        isValid: false,
        reason: `Edge target is invalid: "${edge.target}" (type: ${typeof edge.target})`,
      };
    }

    // Additional validation for aggregated edges
    if (edgeType === "aggregated") {
      if (!("aggregated" in edge) || !edge.aggregated) {
        return {
          isValid: false,
          reason: "Aggregated edge missing aggregated property or it is false",
        };
      }

      if (!edge.originalEdgeIds || !Array.isArray(edge.originalEdgeIds)) {
        console.warn(
          `[ReactFlowBridge] ⚠️ Aggregated edge ${edge.id} missing or invalid originalEdgeIds`,
        );
        // This is a warning, not a failure - some aggregated edges might not have this
      }
    }

    return { isValid: true, reason: "Edge is valid for rendering" };
  }

  private validateRenderedEdge(renderedEdge: ReactFlowEdge): boolean {
    // Final validation of the rendered ReactFlow edge
    if (!renderedEdge.id || !renderedEdge.source || !renderedEdge.target) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered edge missing required properties:`,
        {
          id: renderedEdge.id,
          source: renderedEdge.source,
          target: renderedEdge.target,
        },
      );
      return false;
    }

    // Check for circular references (source === target)
    if (renderedEdge.source === renderedEdge.target) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Self-loop edge detected: ${renderedEdge.id} (${renderedEdge.source})`,
      );
      // Self-loops are valid in ReactFlow, just log a warning
    }

    // Validate handle names if present
    if (
      renderedEdge.sourceHandle &&
      typeof renderedEdge.sourceHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid sourceHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.sourceHandle}`,
      );
    }

    if (
      renderedEdge.targetHandle &&
      typeof renderedEdge.targetHandle !== "string"
    ) {
      console.warn(
        `[ReactFlowBridge] ⚠️ Invalid targetHandle type for edge ${renderedEdge.id}: ${typeof renderedEdge.targetHandle}`,
      );
    }

    return true;
  }

  // Edge Handling
  renderOriginalEdge(
    edge: any,
    visState?: VisualizationState,
  ): ReactFlowEdge | null {
    // Enhanced validation for original edges
    const validation = this.validateEdgeForRendering(edge, "original");
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render original edge ${edge.id}: ${validation.reason}`,
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] ✅ Rendering original edge ${edge.id}: ${edge.source} -> ${edge.target}`,
    );

    const handles = visState
      ? this.getSmartHandles(visState, edge.source, edge.target)
      : {};

    const renderedEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: edge.type || "default",
      data: {
        semanticTags: edge.semanticTags || [],
        originalEdge: edge,
      },
    };

    // Final validation of rendered edge
    if (!this.validateRenderedEdge(renderedEdge)) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered edge ${edge.id} failed final validation`,
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] 🎯 Successfully rendered original edge ${edge.id}`,
    );
    return renderedEdge;
  }

  renderAggregatedEdge(
    aggregatedEdge: any,
    visState?: VisualizationState,
  ): ReactFlowEdge | null {
    // Enhanced validation for aggregated edges
    const validation = this.validateEdgeForRendering(
      aggregatedEdge,
      "aggregated",
    );
    if (!validation.isValid) {
      console.error(
        `[ReactFlowBridge] ❌ Cannot render aggregated edge ${aggregatedEdge.id}: ${validation.reason}`,
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] ✅ Rendering aggregated edge ${aggregatedEdge.id}: ${aggregatedEdge.source} -> ${aggregatedEdge.target} (aggregating ${aggregatedEdge.originalEdgeIds?.length || 0} edges)`,
    );

    const handles = visState
      ? this.getSmartHandles(
          visState,
          aggregatedEdge.source,
          aggregatedEdge.target,
        )
      : {};

    const renderedEdge = {
      id: aggregatedEdge.id,
      source: aggregatedEdge.source,
      target: aggregatedEdge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: "aggregated",
      data: {
        semanticTags: aggregatedEdge.semanticTags || [],
        originalEdgeIds: aggregatedEdge.originalEdgeIds || [],
        aggregationSource: aggregatedEdge.aggregationSource,
        aggregated: true,
      },
    };

    // Final validation of rendered edge
    if (!this.validateRenderedEdge(renderedEdge)) {
      console.error(
        `[ReactFlowBridge] ❌ Rendered aggregated edge ${aggregatedEdge.id} failed final validation`,
      );
      return null;
    }

    console.log(
      `[ReactFlowBridge] 🎯 Successfully rendered aggregated edge ${aggregatedEdge.id}`,
    );
    return renderedEdge;
  }

  private validateFinalRenderedEdges(
    edges: ReactFlowEdge[],
    visibleNodeIds: Set<string>,
    visibleContainerIds: Set<string>,
    state: VisualizationState,
  ): void {
    console.log(
      `[ReactFlowBridge] 🔍 Final edge validation - checking ${edges.length} rendered edges`,
    );

    let potentialFloatingEdges = 0;
    let missingHandleEdges = 0;
    let invalidPositionEdges = 0;

    for (const edge of edges) {
      let hasIssues = false;
      const issues = [];

      // Check if source and target nodes exist and have positions
      const sourceNode = state.getGraphNode(edge.source);
      const targetNode = state.getGraphNode(edge.target);
      const sourceContainer = state.getContainer(edge.source);
      const targetContainer = state.getContainer(edge.target);

      const sourceElement = sourceNode || sourceContainer;
      const targetElement = targetNode || targetContainer;

      // Check for missing elements (shouldn't happen if earlier validation passed)
      if (!sourceElement) {
        issues.push(`source element ${edge.source} not found`);
        hasIssues = true;
      }

      if (!targetElement) {
        issues.push(`target element ${edge.target} not found`);
        hasIssues = true;
      }

      // Check for missing or invalid positions
      if (
        sourceElement &&
        (!sourceElement.position ||
          typeof sourceElement.position.x !== "number" ||
          typeof sourceElement.position.y !== "number" ||
          !isFinite(sourceElement.position.x) ||
          !isFinite(sourceElement.position.y))
      ) {
        issues.push(
          `source ${edge.source} has invalid position: ${JSON.stringify(sourceElement.position)}`,
        );
        hasIssues = true;
        invalidPositionEdges++;
      }

      if (
        targetElement &&
        (!targetElement.position ||
          typeof targetElement.position.x !== "number" ||
          typeof targetElement.position.y !== "number" ||
          !isFinite(targetElement.position.x) ||
          !isFinite(targetElement.position.y))
      ) {
        issues.push(
          `target ${edge.target} has invalid position: ${JSON.stringify(targetElement.position)}`,
        );
        hasIssues = true;
        invalidPositionEdges++;
      }

      // Check for missing handles when using discrete handle strategy
      if (CURRENT_HANDLE_STRATEGY === "discrete") {
        if (!edge.sourceHandle) {
          issues.push(`missing sourceHandle for discrete strategy`);
          hasIssues = true;
          missingHandleEdges++;
        }

        if (!edge.targetHandle) {
          issues.push(`missing targetHandle for discrete strategy`);
          hasIssues = true;
          missingHandleEdges++;
        }
      }

      // Check for extreme coordinate values that might cause floating
      if (sourceElement?.position && targetElement?.position) {
        const distance = Math.sqrt(
          Math.pow(targetElement.position.x - sourceElement.position.x, 2) +
            Math.pow(targetElement.position.y - sourceElement.position.y, 2),
        );

        if (distance > 2000) {
          // Arbitrary threshold for "very long" edges
          issues.push(`very long edge distance: ${distance.toFixed(2)}px`);
          hasIssues = true;
        }
      }

      if (hasIssues) {
        potentialFloatingEdges++;
        console.error(
          `[ReactFlowBridge] 🔴 Potential floating edge ${edge.id}: ${issues.join(", ")}`,
        );
        console.error(
          `  - Source: ${edge.source} (${sourceElement ? "exists" : "missing"})`,
        );
        console.error(
          `  - Target: ${edge.target} (${targetElement ? "exists" : "missing"})`,
        );
        console.error(`  - Source handle: ${edge.sourceHandle || "none"}`);
        console.error(`  - Target handle: ${edge.targetHandle || "none"}`);

        if (sourceElement?.position) {
          console.error(
            `  - Source position: (${sourceElement.position.x}, ${sourceElement.position.y})`,
          );
        }
        if (targetElement?.position) {
          console.error(
            `  - Target position: (${targetElement.position.x}, ${targetElement.position.y})`,
          );
        }
      }
    }

    // Summary
    console.log(`[ReactFlowBridge] 📊 Final validation summary:`);
    console.log(`  - 🔴 Potential floating edges: ${potentialFloatingEdges}`);
    console.log(`  - 🎯 Missing handle edges: ${missingHandleEdges}`);
    console.log(`  - 📍 Invalid position edges: ${invalidPositionEdges}`);

    if (potentialFloatingEdges > 0) {
      console.error(
        `[ReactFlowBridge] 🚨 REACTFLOW FLOATING EDGE PROBLEM: ${potentialFloatingEdges} edges may render as floating!`,
      );
    }
  }
}
