/**
 * Container Operations - Collapse/Expand Logic
 *
 * Handles all container state transitions including collapse/expand operations,
 * hyperEdge management, and visibility cascading.
 */

import { GraphEdge } from '../types';
import { createHyperEdge } from '../EdgeFactory';
import { HYPEREDGE_CONSTANTS } from '../../shared/config';
import { EDGE_VISUAL_CHANNELS } from '../EdgeStyleProcessor';

export class ContainerOperations {
  private readonly state: any; // Use any to access private methods

  constructor(state: any) {
    this.state = state;
  }

  /**
   * Handle container collapse with hyperEdge management
   */
  handleContainerCollapse(containerId: string): void {
    const children = this.state.getContainerChildren(containerId) || new Set();

    // Disable invariant checking while collapsing
    const validationState = this.state.disableValidation();

    // Step 1: Recursively collapse any expanded child containers first
    for (const childId of children) {
      const container = this.state.getContainer(childId);
      if (container) {
        // Always mark child containers as hidden when parent is collapsed
        // regardless of whether they were already collapsed or not
        container.hidden = true;
        this.state.visibilityManager.updateContainerVisibilityCaches(childId, container);
        
        // If child container is expanded, collapse it recursively
        if (!this.state.getContainerCollapsed(childId)) {
          this.handleContainerCollapse(childId);
        }
      }
    }

    // Step 2: Hide child nodes (containers are already handled by Step 1)
    for (const childId of children) {
      const node = this.state.getGraphNode(childId);
      if (node) {
        this.state.setNodeVisibility(childId, false);
      }
      // Note: Child containers are already collapsed and hidden by the recursive call in Step 1
      // Calling setContainerState again would cause double-processing and validation issues
    }

    // Step 3: Clean up any hyperEdges that are no longer valid due to visibility changes
    this.cleanupAdjacentHyperEdges(children);

    // Step 4: Create hyperEdges based on external connections
    this.createHyperEdgesForCollapsedContainer(containerId);

    // Step 5: Mark container as collapsed (use direct state modification to avoid recursion)
    const container = this.state.getContainer(containerId);
    if (container) {
      container.collapsed = true;
      // Update visibility caches
      this.state.visibilityManager.updateContainerVisibilityCaches(containerId, container);
    }

    // Reenable invariants
    this.state.resetValidation(validationState);
  }

  /**
   * Handle container expansion by removing hyperEdges and restoring GraphEdge visibility
   */
  handleContainerExpansion(containerId: string): void {
    // DIAGNOSTIC: Log container expansion
    console.error(`[ContainerOperations] 🔍 Expanding container ${containerId}`);
    
    // 1. Mark container as expanded
    this.state.setContainerCollapsed(containerId, false);

    // 2. Remove the adjacent hyperEdges (they are now invalid)
    const nodes = new Set<string>();
    nodes.add(containerId);
    this.cleanupAdjacentHyperEdges(nodes);

    // 3. Show all child nodes and expanded child containers
    const children = this.state.getContainerChildren(containerId) || new Set();
    console.error(`[ContainerOperations] 🔍 Container ${containerId} has ${children.size} children:`, Array.from(children).join(', '));
    
    for (const childId of children) {
      const container = this.state.getContainer(childId);
      const node = this.state.getGraphNode(childId);

      if (container) {
        console.error(`[ContainerOperations] 🔍 Making child container ${childId} visible (parent: ${containerId})`);
        
        // CRITICAL FIX: Only make child containers visible if ALL their ancestors are expanded
        // Check if this child container should be visible based on ancestor states
        const shouldBeVisible = this.shouldContainerBeVisible(childId);
        
        if (shouldBeVisible) {
          // Use direct state modification to avoid recursive validation issues
          container.hidden = false;
          this.state.visibilityManager.updateContainerVisibilityCaches(childId, container);
        } else {
          console.error(`[ContainerOperations] 🔍 Keeping child container ${childId} hidden due to collapsed ancestors`);
        }
      } else if (node) {
        // Show child nodes
        this.state.setNodeVisibility(childId, true);
      }
    }

    // 5. Restore visibility of GraphEdges using CoveredEdgesIndex
    const coveredEdgeIds = this.state.getCoveredEdges(containerId);
    for (const edgeId of coveredEdgeIds) {
      const edge = this.state.getGraphEdge(edgeId);
      if (!edge) continue;

      // Check if both endpoints are now visible
      const sourceVisible = this.isNodeOrContainerVisible(edge.source);
      const targetVisible = this.isNodeOrContainerVisible(edge.target);
      if (sourceVisible && targetVisible) {
        this.state.setEdgeVisibility(edge.id, true);
      }
    }

    // 6. Create hyperEdges for any child containers -- or neighbors of child nodes that are containers!
    for (const collapsedContainerId of this.findCollapsedNodesOrNeighbors(children)) {
      this.createHyperEdgesForCollapsedContainer(collapsedContainerId);
    }
  }

  /**
   * Get crossing edges for a container (public API used by tests only)
   */
  getCrossingEdges(containerId: string): GraphEdge[] {
    return this.findCrossingEdges(containerId);
  }

  /**
   * Find all edges that cross the boundary of a container
   * (one endpoint inside the container, one outside)
   */
  private findCrossingEdges(containerId: string): GraphEdge[] {
    const crossingEdges: GraphEdge[] = [];

    // Check all edges in the state (access via private collections)
    for (const [, edge] of this.state._collections.graphEdges.entries()) {
      const sourceInContainer = this.isNodeInContainerRecursive(edge.source, containerId);
      const targetInContainer = this.isNodeInContainerRecursive(edge.target, containerId);

      // Edge crosses container boundary if exactly one endpoint is inside
      if (sourceInContainer !== targetInContainer) {
        crossingEdges.push(edge);
      }
    }

    return crossingEdges;
  }

  /**
   * Create fresh hyperEdges for a collapsed container
   */
  public createHyperEdgesForCollapsedContainer(containerId: string): void {
    // Ensure the container is actually collapsed before creating hyperEdges
    const container = this.state.getContainer(containerId);
    if (!container || !container.collapsed) {
      return; // Only create hyperEdges for collapsed containers
    }

    // Find all edges that cross the container boundary
    const crossingEdges = this.findCrossingEdges(containerId);

    if (crossingEdges.length === 0) {
      return;
    }

    // Group external connections by endpoint
    const externalConnections = new Map<string, { incoming: GraphEdge[]; outgoing: GraphEdge[] }>();

    for (const edge of crossingEdges) {
      const sourceInContainer = this.isNodeInContainerRecursive(edge.source, containerId);

      // Determine external endpoint
      const externalEndpoint = sourceInContainer ? edge.target : edge.source;
      const isOutgoing = sourceInContainer;

      // Find the visible representation of the external endpoint
      const visibleExternalEndpoint = this.findLowestVisibleAncestor(externalEndpoint);

      // Skip self-referencing connections
      if (visibleExternalEndpoint === containerId) {
        continue;
      }

      if (!externalConnections.has(visibleExternalEndpoint)) {
        externalConnections.set(visibleExternalEndpoint, { incoming: [], outgoing: [] });
      }

      const group = externalConnections.get(visibleExternalEndpoint)!;
      if (isOutgoing) {
        group.outgoing.push(edge);
      } else {
        group.incoming.push(edge);
      }
    }

    // Create hyperEdges for each external connection
    for (const [externalEndpoint, group] of externalConnections) {
      // Validate that both endpoints are visible before creating hyperEdges
      const containerVisible = this.isNodeOrContainerVisible(containerId);
      const externalVisible = this.isNodeOrContainerVisible(externalEndpoint);

      if (!containerVisible || !externalVisible) {
        continue; // Skip creating hyperEdges with invalid endpoints
      }

      // Aggregate semantic tags from underlying edges
      function getCommonEdgeProperties(edges: GraphEdge[]): string[] | undefined {
        if (edges.length === 0) return undefined;

        // Get all property sets
        const propertySets = edges.map(edge => new Set(edge.edgeProperties || []));

        // Find intersection of all sets (properties common to ALL edges)
        const commonProperties = propertySets.reduce((common, current) => {
          return new Set([...common].filter(prop => current.has(prop)));
        });

        // Additionally, preserve channel-specific properties that are common within each visual channel
        const channelCommonProperties = new Set<string>();

        for (const [_channelName, channelValues] of Object.entries(EDGE_VISUAL_CHANNELS)) {
          // For each channel, find properties that belong to this channel
          const channelProperties = propertySets.map(propSet =>
            [...propSet].filter(prop =>
              (channelValues as readonly (string | number)[]).includes(prop)
            )
          );

          // If all edges have at least one property from this channel,
          // and they all share a common property within this channel
          if (channelProperties.every(props => props.length > 0)) {
            const channelIntersection = channelProperties.reduce((common, current) => {
              return common.filter(prop => current.includes(prop));
            });

            // Add common channel properties
            channelIntersection.forEach(prop => channelCommonProperties.add(prop));
          }
        }

        const allCommonProperties = new Set([...commonProperties, ...channelCommonProperties]);
        return allCommonProperties.size > 0 ? Array.from(allCommonProperties) : undefined;
      }

      // Helper to create hyperedge with aggregated semantic tags
      const createAggregatedHyperEdge = (edges: GraphEdge[], source: string, target: string) => {
        const hyperEdgeId = `${HYPEREDGE_CONSTANTS.PREFIX}${source}${HYPEREDGE_CONSTANTS.SEPARATOR}${target}`;
        const commonProps = getCommonEdgeProperties(edges);

        const hyperEdge = createHyperEdge({
          id: hyperEdgeId,
          source,
          target,
          edgeProperties: commonProps,
        });
        this.state.setHyperEdge(hyperEdge.id, hyperEdge);
      };

      // Create incoming hyperEdge (container <- external)
      if (group.incoming.length > 0) {
        createAggregatedHyperEdge(group.incoming, externalEndpoint, containerId);
      }

      // Create outgoing hyperEdge (container -> external)
      if (group.outgoing.length > 0) {
        createAggregatedHyperEdge(group.outgoing, containerId, externalEndpoint);
      }
    }
  }

  /**
   * Check if a container should be visible based on its ancestor states
   * A container should only be visible if ALL its ancestors are expanded
   */
  private shouldContainerBeVisible(containerId: string): boolean {
    // Walk up the container hierarchy and check if any ancestor is collapsed
    let currentContainer = containerId;
    
    while (currentContainer) {
      const parentContainerId = this.state.getContainerParent(currentContainer);
      if (!parentContainerId) {
        // Reached the top level, no more ancestors to check
        break;
      }
      
      const parentContainer = this.state.getContainer(parentContainerId);
      if (parentContainer && parentContainer.collapsed) {
        // Found a collapsed ancestor, so this container should be hidden
        return false;
      }
      
      currentContainer = parentContainerId;
    }
    
    // All ancestors are expanded, so this container can be visible
    return true;
  }

  /**
   * Check if a node is contained within a container recursively
   */
  private isNodeInContainerRecursive(nodeId: string, containerId: string): boolean {
    const directParent = this.state.getNodeContainer(nodeId);
    if (!directParent) return false;
    if (directParent === containerId) return true;

    // Check if the direct parent container is itself contained in the target container
    return this.isNodeInContainerRecursive(directParent, containerId);
  }

  /**
   * Find the lowest visible ancestor of a given entity (node or container)
   */
  private findLowestVisibleAncestor(entityId: string): string {
    // First check if the entity itself is visible
    if (this.isNodeOrContainerVisible(entityId)) {
      return entityId;
    }

    // If it's a node, find its visible ancestor
    let nodeContainer = this.state.getNodeContainer(entityId);
    // If it's a container, find its visible ancestor
    if (!nodeContainer) {
      nodeContainer = this.state.getContainer(entityId)?.parentId;
    }
    if (nodeContainer) {
      // Recursively find the lowest visible ancestor of the container
      return this.findLowestVisibleAncestor(nodeContainer);
    }

    // If no visible ancestor found, return the entity itself
    // This shouldn't happen in well-formed data, but prevents infinite loops
    return entityId;
  }

  /**
   * Check if a node or container is currently visible to ELK
   */
  private isNodeOrContainerVisible(entityId: string): boolean {
    return (
      this.state._collections._visibleNodes.has(entityId) ||
      this.state._collections._visibleContainers.has(entityId)
    );
  }

  /**
   * Clean up hyperEdges that connect to nodes that are no longer visible
   */
  public cleanupAdjacentHyperEdges(nodeIds: Set<string>): void {
    const hyperEdgesToRemove: string[] = [];

    // Check all hyperEdges for invalid endpoints
    for (const nodeId of nodeIds) {
      for (const edgeId of this.state.getAdjacentEdges(nodeId)) {
        const hyperEdge = this.state.getHyperEdge(edgeId);
        if (hyperEdge) {
          const sourceVisible = this.isNodeOrContainerVisible(hyperEdge.source);
          const targetVisible = this.isNodeOrContainerVisible(hyperEdge.target);
          const sourceContainer = this.state.getContainer(hyperEdge.source);
          const targetContainer = this.state.getContainer(hyperEdge.target);
          const sourceExpanded = sourceContainer && !sourceContainer.hidden;
          const targetExpanded = targetContainer && !targetContainer.hidden;

          // Remove hyperEdges with any hidden endpoints
          // HyperEdges should only exist between visible entities
          if (!sourceVisible || !targetVisible || sourceExpanded || targetExpanded) {
            hyperEdgesToRemove.push(hyperEdge.id);
          }
        }
      }
    }

    // Remove invalid hyperEdges
    for (const hyperEdgeId of hyperEdgesToRemove) {
      this.state.removeHyperEdge(hyperEdgeId);
    }
  }

  /**
   * Find all collapsed container neighbors of the given set of nodes.
   * This helps identify which collapsed containers might be affected
   * by changes in the visibility or state of the provided nodes.
   */
  private findCollapsedNodesOrNeighbors(nodeIds: Set<string>): Set<string> {
    const collapsedNodesOrNeighbors = new Set<string>();

    for (const nodeId of nodeIds) {
      if (this.state.getContainer(nodeId)) {
        collapsedNodesOrNeighbors.add(nodeId);
      } else {
        // a graphNode. Look for adjacent containers
        const edges = this.state.getAdjacentEdges(nodeId);
        for (const edgeId of edges) {
          let edge = this.state.getGraphEdge(edgeId) || this.state.getHyperEdge(edgeId);
          if (!edge) continue;
          let remote = edge.source === nodeId ? edge.target : edge.source;
          const remoteAnc = this.findLowestVisibleAncestor(remote);
          if (!remoteAnc) {
            throw new Error(
              `[findCollapsedNodesOrNeighbors] No visible ancestor found for node ${remote}`
            );
          }
          // If the lowest visible ancestor is a container, add it to the set
          if (this.state.getContainer(remoteAnc)) {
            collapsedNodesOrNeighbors.add(remoteAnc);
          }
        }
      }
    }
    return collapsedNodesOrNeighbors;
  }
}
