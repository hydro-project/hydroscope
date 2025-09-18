/**
 * @fileoverview ELK Bridge - Clean interface between VisualizationState and ELK
 *
 * This bridge implements the core architectural principle:
 * - VisualizationState contains ALL data (nodes, edges, containers)
 * - ELK gets visible elements only through visibleEdges (hyperedges included transparently)
 * - ELK returns layout positions that get applied back to VisualizationState
 */

import { VisualizationState } from '../core/VisualizationState';
import type { LayoutConfig } from '../core/types';
import {
  getELKLayoutOptions,
  // createFixedPositionOptions,
  createFreePositionOptions,
  ELK_LAYOUT_OPTIONS,
  DEFAULT_LAYOUT_CONFIG,
} from '../shared/config';
import { hscopeLogger } from '../utils/logger';

import ELK from 'elkjs';
import type { ElkGraph, ElkNode, ElkEdge } from './elk-types';

export class ELKBridge {
  private elk: any; // ELK instance
  private layoutConfig: LayoutConfig;

  constructor(layoutConfig: LayoutConfig = {}) {
    this.elk = new ELK(); // ✅ Create fresh ELK instance for each ELKBridge
    this.layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfig };
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Update layout configuration
   */
  updateLayoutConfig(config: LayoutConfig): void {
    this.layoutConfig = { ...this.layoutConfig, ...config };
  }

  // ============================================================================
  // Main Layout Method
  // ============================================================================

  /**
   * Convert VisualizationState to ELK format and run layout
   * Key insight: Include ALL visible edges (regular + hyper) with no distinction
   */
  async layoutVisualizationState(
    visState: VisualizationState,
    changedContainerId?: string
  ): Promise<void> {
    if (changedContainerId) {
      // Use selective layout approach for individual container changes
      return this.runSelectiveLayout(visState, changedContainerId);
    }

    // Use standard full layout for initial layout or bulk operations
    return this.runFullLayout(visState);
  }

  /**
   * Run full layout for all containers (initial layout)
   */
  private async runFullLayout(visState: VisualizationState): Promise<void> {
    try {
      // Debug: Log call stack to see what's triggering multiple layouts
      if (typeof console !== 'undefined' && console.trace) {
        console.trace('[ELKBridge] runFullLayout called from:');
      }

      hscopeLogger.log('elk', '🚀 runFullLayout starting');

      // Safely get counts
      const containerCount = visState.visibleContainers.length;
      const edgeCount = visState.visibleEdges.length;

      hscopeLogger.log(
        'elk',
        `📊 Visible containers: ${containerCount}, visible edges: ${edgeCount}`
      );
      // ELK should handle whatever containers are given to it
      // Smart collapse decisions should be made by VisualizationEngine, not ELKBridge

      // RACE CONDITION FIX: Capture layout sequence at start to detect stale operations
      const layoutSequenceAtStart = visState.getLayoutSequence();
      hscopeLogger.log('layout', `starting ELK layout with sequence ${layoutSequenceAtStart}`);

      // Debug: Check if there are already other layout operations in progress
      if ((this as any)._currentLayoutSequence) {
        hscopeLogger.warn(
          'layout',
          `⚠️ Another layout operation is already in progress (sequence ${(this as any)._currentLayoutSequence}). This may cause race conditions.`
        );
      }
      (this as any)._currentLayoutSequence = layoutSequenceAtStart;

      // RACE CONDITION FIX: Capture container state at layout start for validation
      const _initialContainerCount = visState.visibleContainers.length;
      const _initialContainerIds = new Set(visState.visibleContainers.map(c => c.id));

      // Store initial state for validation

      // Import profiler utilities for detailed timing
      const { getProfiler } = await import('../dev').catch(() => ({ getProfiler: () => null }));

      const profiler = getProfiler();

      profiler?.start('elk-bridge-full-layout');

      // Clear any existing edge layout data to ensure ReactFlow starts fresh
      profiler?.start('clear-edge-layouts');

      visState.visibleEdges.forEach(edge => {
        try {
          visState.setEdgeLayout(edge.id, { sections: [] });
        } catch (_error) {
          // Edge might not exist anymore, ignore
        }
      });

      profiler?.end('clear-edge-layouts');

      // 1. Extract all visible data from VisualizationState
      profiler?.start('vis-state-to-elk-conversion');
      const elkGraph = this.visStateToELK(visState);
      profiler?.end('vis-state-to-elk-conversion');

      // 2. Validate ELK input data
      profiler?.start('elk-validation');
      this.validateELKInput(elkGraph);

      // Additional validation for common ELK hang causes
      this.validateELKHangPrevention(elkGraph);

      // Debug: Log the ELK graph structure before sending to ELK (safely - no JSON.stringify)
      hscopeLogger.log(
        'elk',
        `ELK graph structure: ${elkGraph.children?.length || 0} children, ${elkGraph.edges?.length || 0} edges`
      );

      profiler?.end('elk-validation');

      // ConsolidatedOperationManager ensures proper sequencing - no artificial delays needed

      // Debug: Check for data leaks in large graphs
      if ((elkGraph.children?.length || 0) > 10) {
        // CRITICAL: Check if we're accidentally including children of collapsed containers
        const leaks: string[] = [];
        for (const container of elkGraph.children || []) {
          // FIXED: Only check for leaks if container is marked as collapsed
          // Expanded containers (collapsed=false) are SUPPOSED to have children!
          // Check the original container state from visState
          const originalContainer = visState.getContainer(container.id);
          if (originalContainer?.collapsed && container.children && container.children.length > 0) {
            const leakMsg = `Container ${container.id} has ${container.children.length} children but should be collapsed!`;
            console.warn(`[ELKBridge] ⚠️  LEAK: ${leakMsg}`);
            console.warn(
              `[ELKBridge] ⚠️    Children: ${container.children
                .map(c => c.id)
                .slice(0, 3)
                .join(', ')}${container.children.length > 3 ? '...' : ''}`
            );
            leaks.push(leakMsg);
          }
        }

        // In test environments, throw an error if we have leaks
        // Note: Using globalThis to check for test environment since process may not be available in browser
        const isTestEnvironment =
          typeof globalThis !== 'undefined' &&
          (globalThis.process?.env?.NODE_ENV === 'test' ||
            globalThis.process?.env?.VITEST === 'true');

        if (leaks.length > 0 && isTestEnvironment) {
          throw new Error(
            `ELK CONTAINER LEAKS DETECTED: ${leaks.length} collapsed containers have visible children. This violates the collapsed container invariant. Leaks: ${leaks.slice(0, 3).join('; ')}`
          );
        }
      }

      // 4. Run ELK layout algorithm
      profiler?.start('elk-algorithm-execution');
      const containerCountAtELKStart = visState.visibleContainers.length;
      if (profiler) {
        console.log(
          `[ELKBridge] Starting ELK layout with ${elkGraph.children?.length || 0} top-level elements`
        );
      }

      // Store ELK input for debugging failures
      (this as any)._lastElkInput = elkGraph;

      // ELK layout with proper logging for large graphs
      let elkResult: any;
      try {
        hscopeLogger.log(
          'elk',
          `Starting ELK layout with ${elkGraph.children?.length || 0} children and ${elkGraph.edges?.length || 0} edges`
        );

        // For large graphs, ELK can take significant time - that's normal
        const startTime = Date.now();
        elkResult = await this.elk.layout(elkGraph);
        const endTime = Date.now();

        hscopeLogger.log('elk', `ELK layout completed successfully in ${endTime - startTime}ms`);
      } catch (error) {
        hscopeLogger.error('elk', 'ELK layout failed', error);

        // Log detailed debug information
        console.error('[ELKBridge] ELK layout failure details:', {
          error: error instanceof Error ? error.message : error,
          elkGraphStats: {
            rootChildren: elkGraph.children?.length || 0,
            totalEdges: elkGraph.edges?.length || 0,
            layoutOptions: elkGraph.layoutOptions,
          },
          elkInput: elkGraph,
        });

        // Try a fallback layout with minimal ELK configuration
        console.warn('[ELKBridge] Attempting fallback layout with minimal configuration...');

        try {
          // Create a simplified graph with minimal configuration
          const fallbackGraph = {
            id: 'root',
            children:
              elkGraph.children?.map(child => ({
                id: child.id,
                width: child.width || 200,
                height: child.height || 150,
                // Remove children to simplify the graph
                children: [],
              })) || [],
            edges: elkGraph.edges?.slice(0, 50) || [], // Limit edges to prevent complexity
            layoutOptions: {
              'elk.algorithm': 'layered',
              'elk.direction': 'DOWN',
              'elk.spacing.nodeNode': '50',
            },
          };

          elkResult = await Promise.race([
            this.elk.layout(fallbackGraph),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Fallback timeout')), 10000)
            ),
          ]);

          console.warn(
            '[ELKBridge] Fallback layout succeeded, but with simplified graph structure'
          );
        } catch (fallbackError) {
          console.error('[ELKBridge] Fallback layout also failed:', fallbackError);

          // Final fallback: create a simple grid layout
          elkResult = this.createGridFallbackLayout(elkGraph);
          console.warn('[ELKBridge] Using grid fallback layout');
        }
      }

      const containerCountAtELKEnd = visState.visibleContainers.length;

      // COMPREHENSIVE LAYOUT VALIDATION AND RECOVERY
      const hasRaceCondition = containerCountAtELKEnd !== containerCountAtELKStart;

      // FIXED: Count all containers recursively, not just root level
      const allElkContainers: any[] = [];
      const extractAllContainers = (elkNode: any) => {
        allElkContainers.push(elkNode);
        if (elkNode.children) {
          elkNode.children.forEach((child: any) => extractAllContainers(child));
        }
      };
      elkResult.children?.forEach((rootElkNode: any) => extractAllContainers(rootElkNode));

      const elkContainerCount = allElkContainers.length;
      const hasELKFailure = elkContainerCount < containerCountAtELKStart * 0.8; // ELK returned <80% of expected containers

      if (hasRaceCondition || hasELKFailure) {
        if (hasRaceCondition) {
          hscopeLogger.error(
            'elk',
            `🚨 RACE CONDITION: Container count changed ${containerCountAtELKStart} → ${containerCountAtELKEnd} during ELK processing`
          );
        }

        if (hasELKFailure) {
          hscopeLogger.error(
            'elk',
            `🚨 ELK PROCESSING ISSUE: Expected ${containerCountAtELKStart} containers, ELK returned ${elkContainerCount}`
          );

          // FAIL FAST: Don't use fallbacks, debug the root cause
          const elkContainerIds = new Set(allElkContainers.map(elkNode => elkNode.id));
          const missingContainers = visState.visibleContainers.filter(
            container => !elkContainerIds.has(container.id)
          );

          hscopeLogger.error(
            'elk',
            `🚨 ELK FAILURE - Missing containers: ${JSON.stringify(
              missingContainers.map(c => ({
                id: c.id,
                label: c.label || c.data?.label,
                hasPosition: !!c.position,
                hasDimensions: !!(c.width && c.height),
                parentId: c.parentId,
              })),
              null,
              2
            )}`
          );

          // Log the ELK input that caused the failure
          hscopeLogger.error(
            'elk',
            `🚨 ELK INPUT that failed: ${JSON.stringify(
              {
                containerCount: containerCountAtELKStart,
                elkInputChildren: (this as any)._lastElkInput?.children?.length || 'unknown',
                elkOutputChildren: elkResult.children?.length || 0,
              },
              null,
              2
            )}`
          );

          throw new Error(
            `ELK layout failure: Expected ${containerCountAtELKStart} containers, got ${elkContainerCount}. Check console for details.`
          );
        }

        // Retry with exponential backoff (but only for race conditions, not ELK failures)
        const maxRetries = hasRaceCondition ? 3 : 1; // Don't retry ELK failures multiple times
        const currentRetry = (this as any)._layoutRetryCount || 0;

        if (currentRetry < maxRetries && hasRaceCondition) {
          (this as any)._layoutRetryCount = currentRetry + 1;
          hscopeLogger.log('elk', `🔄 Layout retry ${currentRetry + 1}/${maxRetries}`);

          // Add small delay to let any pending operations complete
          await new Promise(resolve => setTimeout(resolve, 100 * currentRetry));

          // Retry the layout
          await this.runFullLayout(visState);
          return;
        }
      }

      // Reset retry counter on successful layout
      (this as any)._layoutRetryCount = 0;

      profiler?.end('elk-algorithm-execution');
      if (profiler) {
        console.log(`[ELKBridge] ELK layout completed`);
      }

      const elkOutputContainers = elkResult.children || [];

      // Calculate actual spacing from ELK results
      const sortedByX = elkOutputContainers
        .filter((c: any) => c && c.x !== undefined)
        .sort((a: any, b: any) => (a.x || 0) - (b.x || 0));

      if (sortedByX.length > 1) {
        const gaps = [];
        for (let i = 1; i < sortedByX.length; i++) {
          const gap =
            (sortedByX[i].x || 0) - ((sortedByX[i - 1].x || 0) + (sortedByX[i - 1].width || 0));
          gaps.push(gap);
        }
      }

      // ConsolidatedOperationManager ensures proper sequencing - no artificial delays needed

      // 6. Check if layout sequence has changed (indicating state modification during layout)
      const currentLayoutSequence = visState.getLayoutSequence();
      if (currentLayoutSequence !== layoutSequenceAtStart) {
        hscopeLogger.log(
          'layout',
          `skipping stale ELK results: sequence changed from ${layoutSequenceAtStart} to ${currentLayoutSequence}`
        );
        // Clear the current layout sequence tracker
        (this as any)._currentLayoutSequence = null;
        return; // Skip applying stale results
      }

      // 7. Apply results back to VisualizationState
      profiler?.start('elk-to-vis-state-conversion');
      this.elkToVisualizationState(elkResult, visState);
      profiler?.end('elk-to-vis-state-conversion');

      // 7. Validate that all visible containers have ELK positions (Fix 2: Position Validation)
      profiler?.start('elk-position-validation');
      this.validateELKPositions(visState);
      profiler?.end('elk-position-validation');

      profiler?.end('elk-bridge-full-layout');

      // Clear the current layout sequence tracker
      (this as any)._currentLayoutSequence = null;
      hscopeLogger.log(
        'layout',
        `ELK layout sequence ${layoutSequenceAtStart} completed and applied`
      );
    } catch (error) {
      hscopeLogger.error('elk', `❌ runFullLayout failed`, error);
      // Clear the current layout sequence tracker even on error
      (this as any)._currentLayoutSequence = null;
      throw error;
    }
  }

  // Fallback positioning removed - we now fail fast to debug ELK issues

  /**
   * Run selective layout for individual container changes
   * This preserves unchanged container positions exactly
   */
  private async runSelectiveLayout(
    visState: VisualizationState,
    _changedContainerId: string
  ): Promise<void> {
    // Run full layout with soft constraints (position preferences are set in visStateToELK)
    // The soft constraints will keep unchanged containers close to their original positions
    // while allowing ELK to adjust them to avoid overlaps with the expanded container
    await this.runFullLayout(visState);

    // No position restoration needed - trust ELK's positioning decisions
    // The INTERACTIVE constraints in visStateToELK already handle position preferences
  }

  /**
   * Backward-compatible alias expected by existing tests
   */
  async layoutVisState(visState: VisualizationState, changedContainerId?: string): Promise<void> {
    return this.layoutVisualizationState(visState, changedContainerId);
  }

  // ============================================================================
  // Debug and Validation Methods
  // ============================================================================

  /*
  /**
   * Log ELK graph structure for debugging layout issues
   */
  /*private logELKGraphStructure(elkGraph: ElkGraph): void {
    
    // Log container positions if they exist (this might be the issue)
    const containersWithPositions = (elkGraph.children || []).filter(child => 
      child.x !== undefined || child.y !== undefined
    );
    
    if (containersWithPositions.length > 0) {
      for (const container of containersWithPositions) { // Log ALL containers with positions!
      }
    } else {
    }
    
    // Log ALL container dimensions to see if there are inconsistencies
    const containers = (elkGraph.children || []);
    for (const container of containers) {
    }
    
    // CRITICAL: Log the exact layout options being sent
  }*/

  /**
   * Additional validation to prevent ELK from hanging
   */
  private validateELKHangPrevention(elkGraph: ElkGraph): void {
    // Check for excessive complexity that might cause ELK to hang
    const totalNodes = this.countAllNodes(elkGraph);
    const totalEdges = elkGraph.edges?.length || 0;

    if (totalNodes > 500) {
      console.warn(
        `[ELKBridge] Large graph detected: ${totalNodes} nodes. This may cause ELK to hang.`
      );
    }

    if (totalEdges > 1000) {
      console.warn(
        `[ELKBridge] Large graph detected: ${totalEdges} edges. This may cause ELK to hang.`
      );
    }

    // Check for circular references in container hierarchy
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const checkCircularReference = (nodeId: string, path: string[] = []): boolean => {
      if (recursionStack.has(nodeId)) {
        throw new Error(
          `Circular reference detected in container hierarchy: ${path.join(' -> ')} -> ${nodeId}`
        );
      }

      if (visited.has(nodeId)) {
        return false; // Already processed this branch
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Find the node and check its children
      const node = this.findNodeById(elkGraph, nodeId);
      if (node?.children) {
        for (const child of node.children) {
          if (checkCircularReference(child.id, [...path, nodeId])) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check all root nodes for circular references
    elkGraph.children?.forEach(child => {
      checkCircularReference(child.id);
    });

    // Check for edges with self-references (can cause ELK issues)
    elkGraph.edges?.forEach(edge => {
      const sources = edge.sources || [];
      const targets = edge.targets || [];

      for (const source of sources) {
        if (targets.includes(source)) {
          console.warn(
            `[ELKBridge] Self-referencing edge detected: ${edge.id} (${source} -> ${source}). This may cause layout issues.`
          );
        }
      }
    });
  }

  /**
   * Helper method to count all nodes recursively
   */
  private countAllNodes(elkGraph: ElkGraph): number {
    let count = 0;

    const countNodes = (node: any) => {
      count++;
      if (node.children) {
        node.children.forEach(countNodes);
      }
    };

    elkGraph.children?.forEach(countNodes);
    return count;
  }

  /**
   * Helper method to find a node by ID recursively
   */
  private findNodeById(elkGraph: ElkGraph, nodeId: string): any {
    const searchInNode = (node: any): any => {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = searchInNode(child);
          if (found) return found;
        }
      }
      return null;
    };

    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        const found = searchInNode(child);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Create a simple grid layout as a last resort fallback
   */
  private createGridFallbackLayout(elkGraph: ElkGraph): any {
    const children = elkGraph.children || [];
    const cols = Math.ceil(Math.sqrt(children.length));
    const spacing = 250;

    const layoutChildren = children.map((child, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      return {
        ...child,
        x: col * spacing,
        y: row * spacing,
        width: child.width || 200,
        height: child.height || 150,
      };
    });

    return {
      id: 'root',
      children: layoutChildren,
      edges: elkGraph.edges || [],
    };
  }

  /**
   * Validate ELK input data to prevent null reference errors
   * NOTE: This should only validate format, not apply business rules
   */
  private validateELKInput(elkGraph: ElkGraph): void {
    // Ensure children array exists
    if (!elkGraph.children) {
      elkGraph.children = [];
    }

    // Ensure edges array exists
    if (!elkGraph.edges) {
      elkGraph.edges = [];
    }

    // Validate each node has required properties
    elkGraph.children.forEach(node => {
      if (!node.id) {
        throw new Error(`ELK node missing ID: ${JSON.stringify(node)}`);
      }
      const isContainer = Array.isArray(node.children) && node.children.length > 0;
      // Require dimensions only for leaf nodes; containers may omit to let ELK derive sizes
      if (!isContainer) {
        if (typeof node.width !== 'number' || node.width <= 0) {
          throw new Error(
            `ELK node ${node.id} has invalid width: ${node.width}. VisualizationState should provide valid dimensions.`
          );
        }
        if (typeof node.height !== 'number' || node.height <= 0) {
          throw new Error(
            `ELK node ${node.id} has invalid height: ${node.height}. VisualizationState should provide valid dimensions.`
          );
        }
      }

      // Validate children if this is a container
      if (node.children) {
        node.children.forEach(child => {
          if (!child.id) {
            throw new Error(`ELK child node missing ID: ${JSON.stringify(child)}`);
          }
          const childIsContainer = Array.isArray(child.children) && child.children.length > 0;
          if (!childIsContainer) {
            if (typeof child.width !== 'number' || child.width <= 0) {
              throw new Error(
                `ELK child node ${child.id} has invalid width: ${child.width}. VisualizationState should provide valid dimensions.`
              );
            }
            if (typeof child.height !== 'number' || child.height <= 0) {
              throw new Error(
                `ELK child node ${child.id} has invalid height: ${child.height}. VisualizationState should provide valid dimensions.`
              );
            }
          }
        });
      }
    });

    // Get all valid node IDs from the ELK graph for edge validation
    const allValidNodeIds = new Set<string>();
    const collectNodeIds = (elkNode: ElkNode) => {
      allValidNodeIds.add(elkNode.id);
      elkNode.children?.forEach(collectNodeIds);
    };
    elkGraph.children?.forEach(collectNodeIds);

    if (allValidNodeIds.size < 20) {
    }

    // STRICT VALIDATION: Throw error for edges with invalid endpoints instead of silently filtering
    // This forces VisualizationState to provide clean, valid data
    elkGraph.edges?.forEach(edge => {
      const hasValidSource = edge.sources?.some(sourceId => allValidNodeIds.has(sourceId));
      const hasValidTarget = edge.targets?.some(targetId => allValidNodeIds.has(targetId));

      if (!hasValidSource || !hasValidTarget) {
        const sourceIds = edge.sources?.join(', ') || 'none';
        const targetIds = edge.targets?.join(', ') || 'none';
        const availableNodes =
          Array.from(allValidNodeIds).slice(0, 10).join(', ') +
          (allValidNodeIds.size > 10 ? '...' : '');

        throw new Error(
          `ELKBridge received edge ${edge.id} with invalid endpoints!\n` +
            `Sources: [${sourceIds}] (valid: ${hasValidSource})\n` +
            `Targets: [${targetIds}] (valid: ${hasValidTarget})\n` +
            `Available nodes: ${availableNodes}\n` +
            `This indicates a bug in VisualizationState - it should not send edges that reference non-existent nodes.`
        );
      }
    });

    // Validate each remaining edge has required properties
    elkGraph.edges.forEach(edge => {
      if (!edge.id) {
        throw new Error(`ELK edge missing ID: ${JSON.stringify(edge)}`);
      }
      if (!edge.sources || edge.sources.length === 0) {
        throw new Error(`ELK edge missing sources: ${edge.id}`);
      }
      if (!edge.targets || edge.targets.length === 0) {
        throw new Error(`ELK edge missing targets: ${edge.id}`);
      }
    });
  }

  // ============================================================================
  // Core Conversion Logic
  // ============================================================================

  /**
   * Convert VisualizationState to ELK format
   * HIERARCHICAL: Use proper ELK hierarchy to match ReactFlow parent-child relationships
   */
  private visStateToELK(visState: VisualizationState, changedContainerId?: string): ElkGraph {
    // HIERARCHICAL: Build proper container hierarchy
    const rootNodes: ElkNode[] = [];
    const processedNodes = new Set<string>();
    const processedContainers = new Set<string>();

    // Helper function to build container hierarchy recursively
    const buildContainerHierarchy = (containerId: string): ElkNode => {
      const container = visState.getContainer(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      // Ensure valid dimensions - fallback to defaults if invalid
      const containerWidth =
        typeof container.width === 'number' && !isNaN(container.width) && isFinite(container.width)
          ? container.width
          : 200;
      const containerHeight =
        typeof container.height === 'number' &&
        !isNaN(container.height) &&
        isFinite(container.height)
          ? container.height
          : 150;

      // Important: Only provide fixed width/height for collapsed containers.
      // For expanded containers, omit width/height so ELK can derive the size from children.
      const containerNode: ElkNode = container.collapsed
        ? { id: container.id, width: containerWidth, height: containerHeight, children: [] }
        : ({ id: container.id, children: [] } as ElkNode);

      // SELECTIVE LAYOUT: Use soft constraints for unchanged containers
      if (changedContainerId && container.id !== changedContainerId) {
        // Get current position from VisualizationState
        const layout = visState.getContainerLayout(container.id);
        const currentPosition = layout?.position || { x: container.x || 0, y: container.y || 0 };

        // Use soft constraints that prefer current position but allow movement to avoid overlaps
        containerNode.x = currentPosition.x;
        containerNode.y = currentPosition.y;
        containerNode.layoutOptions = {
          ...ELK_LAYOUT_OPTIONS,
          // Use INTERACTIVE mode which respects current positions but allows adjustment
          'elk.position': 'INTERACTIVE',
          'elk.position.x': currentPosition.x.toString(),
          'elk.position.y': currentPosition.y.toString(),
          // Allow size adjustments if needed
          'elk.nodeSize.constraints': '',
          'elk.nodeSize.options': 'DEFAULT_MINIMUM_SIZE',
          // Enable interactive layout
          'elk.interactive': 'true',
        };
      } else if (changedContainerId) {
        // Allow free movement for the changed container
        containerNode.layoutOptions = {
          ...createFreePositionOptions(),
        };
      }

      if (!container.collapsed) {
        // Use VisualizationState API to get children (returns Set)
        const containerChildren = visState.getContainerChildren(container.id);
        containerChildren.forEach(childId => {
          // Check if child is a container and if it's visible
          const childContainer = visState.getContainer(childId);
          if (childContainer && !childContainer.hidden) {
            hscopeLogger.log(
              'elk',
              `🔍 Adding child container ${childId} to parent ${container.id}`
            );
            // Add child container recursively
            const childContainerNode = buildContainerHierarchy(childId);
            containerNode.children!.push(childContainerNode);
            processedContainers.add(childId);
          } else {
            // Add child node
            const childNode = visState.getGraphNode(childId);
            if (childNode) {
              // Ensure valid node dimensions
              const nodeWidth =
                typeof childNode.width === 'number' &&
                !isNaN(childNode.width) &&
                isFinite(childNode.width)
                  ? childNode.width
                  : 180;
              const nodeHeight =
                typeof childNode.height === 'number' &&
                !isNaN(childNode.height) &&
                isFinite(childNode.height)
                  ? childNode.height
                  : 60;

              containerNode.children!.push({
                id: childNode.id,
                width: nodeWidth,
                height: nodeHeight,
              });
              processedNodes.add(childId);
            }
          }
        });

        // If no real children were added (rare), provide a minimal footprint so ELK keeps the node visible
        if (!containerNode.children || containerNode.children.length === 0) {
          (containerNode as any).width = containerWidth;
          (containerNode as any).height = containerHeight;
        }
      }

      return containerNode;
    };

    // FIXED: Send ALL visible containers to ELK, not just root containers
    // The hierarchy will be built correctly by buildContainerHierarchy()
    const containerParentMapping = visState.getContainerParentMapping();
    let _rootContainerCount = 0;
    let _containersWithParents = 0;

    visState.visibleContainers.forEach(container => {
      const hasVisibleParent = containerParentMapping.has(container.id);

      if (hasVisibleParent) {
        _containersWithParents++;
      } else {
        _rootContainerCount++;
      }

      // CRITICAL FIX: Only add root containers, but buildContainerHierarchy will include all children
      if (!hasVisibleParent && !processedContainers.has(container.id)) {
        const containerNode = buildContainerHierarchy(container.id);
        rootNodes.push(containerNode);
        processedContainers.add(container.id);
      }
    });

    // Add any uncontained nodes at root level
    visState.visibleNodes.forEach(node => {
      if (!processedNodes.has(node.id)) {
        rootNodes.push({
          id: node.id,
          width: node.width || 180,
          height: node.height || 60,
        });
      }
    });

    // Convert edges - ELK will handle hierarchy automatically
    const allEdges: ElkEdge[] = Array.from(visState.visibleEdges).map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

    const elkGraph = {
      id: 'root',
      children: rootNodes,
      edges: allEdges,
      layoutOptions: getELKLayoutOptions(this.layoutConfig.algorithm),
    };

    // DIAGNOSTIC: Log ELK input during search expansion to identify issues
    if (rootNodes.length > 20) {
      console.warn(
        `[ELKBridge] Large hierarchy detected: ${rootNodes.length} root containers, ` +
          `${visState.visibleContainers.length} total visible containers. ` +
          `This may cause ELK layout failures.`
      );

      // Log container hierarchy depth
      const getMaxDepth = (node: ElkNode, depth = 0): number => {
        if (!node.children || node.children.length === 0) return depth;
        return Math.max(...node.children.map(child => getMaxDepth(child, depth + 1)));
      };

      const maxDepth = Math.max(...rootNodes.map(node => getMaxDepth(node)));
      console.warn(`[ELKBridge] Maximum hierarchy depth: ${maxDepth}`);
    }

    return elkGraph;
  }

  /**
   * Apply ELK results back to VisualizationState
   */
  private elkToVisualizationState(elkResult: ElkGraph, visState: VisualizationState): void {
    if (!elkResult.children) {
      console.warn('[ELKBridge] ⚠️ No children in ELK result');
      return;
    }

    // FIXED: Count all containers recursively, not just root level
    const allElkContainers: any[] = [];
    const extractAllContainers = (elkNode: any) => {
      allElkContainers.push(elkNode);
      if (elkNode.children) {
        elkNode.children.forEach((child: any) => extractAllContainers(child));
      }
    };
    elkResult.children.forEach(rootElkNode => extractAllContainers(rootElkNode));

    const elkContainerCount = allElkContainers.length;
    const visibleContainerCount = visState.visibleContainers.length;

    // Validate ELK result consistency
    if (elkContainerCount !== visibleContainerCount) {
      console.warn(
        `[ELKBridge] ELK result mismatch: ELK returned ${elkContainerCount} containers, ` +
          `but VisualizationState has ${visibleContainerCount} visible containers.`
      );
    }

    // SIMPLIFIED: Use ELK coordinates directly following ReactFlow best practices
    // No custom offset corrections - ELK provides the correct coordinate system

    // DIAGNOSTIC: Check if bt_81 and bt_98 are in the ELK result
    const problemContainers = ['bt_81', 'bt_98'];
    problemContainers.forEach(containerId => {
      const foundAtRoot = elkResult.children?.find(child => child.id === containerId);
      if (foundAtRoot) {
      } else {
        // Check if it's nested in any other container
        let foundNested = false;
        const searchNested = (elkNode: ElkNode, depth: number = 0) => {
          elkNode.children?.forEach(child => {
            if (child.id === containerId) {
              foundNested = true;
            } else if (child.children) {
              searchNested(child, depth + 1);
            }
          });
        };
        elkResult.children?.forEach(rootChild => searchNested(rootChild, 1));

        if (!foundNested) {
        }
      }
    });

    // Filter to only apply positions to elements that exist in VisualizationState
    const validElkContainers = allElkContainers.filter(elkNode => {
      const existsAsContainer = visState.getContainer(elkNode.id) !== undefined;
      const existsAsNode = visState.getGraphNode(elkNode.id) !== undefined;
      return existsAsContainer || existsAsNode;
    });

    // Apply positions only to valid containers using ELK coordinates directly
    validElkContainers.forEach(elkNode => {
      // Check if this ID exists as a container in VisualizationState first
      try {
        const container = visState.getContainer(elkNode.id);
        if (container) {
          this.updateContainerFromELK(elkNode, visState);
          return;
        }
      } catch (_e) {
        // Not a container, continue to node logic
      }

      // Handle as node or container based on ELK structure
      if (elkNode.children && elkNode.children.length > 0) {
        this.updateContainerFromELK(elkNode, visState);
      } else {
        this.updateNodeFromELK(elkNode, visState);
      }
    });

    // SIMPLIFIED: No edge routing processing - let ReactFlow handle all edge positioning
    // ReactFlow will automatically route edges between nodes using handles
  }

  // REMOVED: applyOffsetToChildren - dead code in canonical flat pattern

  // REMOVED: updateEdgeFromELK - ReactFlow handles all edge routing automatically

  /**
   * Update container dimensions and child positions from ELK result
   */
  private updateContainerFromELK(elkNode: ElkNode, visState: VisualizationState): void {
    // Use VisualizationState's proper layout methods instead of direct property access
    const layoutUpdates: any = {};

    // Validate and set position
    if (elkNode.x !== undefined || elkNode.y !== undefined) {
      layoutUpdates.position = {};

      // Validate x coordinate
      if (elkNode.x !== undefined) {
        if (typeof elkNode.x === 'number' && !isNaN(elkNode.x) && isFinite(elkNode.x)) {
          layoutUpdates.position.x = elkNode.x;
        } else {
          hscopeLogger.error(
            'elk',
            `❌ LAYOUT BUG: Invalid x coordinate for container ${elkNode.id}: ${elkNode.x} (type: ${typeof elkNode.x})`
          );
          layoutUpdates.position.x = 0; // Temporarily fallback to see what's happening
        }
      }

      // Validate y coordinate
      if (elkNode.y !== undefined) {
        if (typeof elkNode.y === 'number' && !isNaN(elkNode.y) && isFinite(elkNode.y)) {
          layoutUpdates.position.y = elkNode.y;
        } else {
          hscopeLogger.error(
            'elk',
            `❌ LAYOUT BUG: Invalid y coordinate for container ${elkNode.id}: ${elkNode.y} (type: ${typeof elkNode.y})`
          );
          layoutUpdates.position.y = 0; // Temporarily fallback to see what's happening
        }
      }
    } else {
      // ELK didn't provide ANY position coordinates - this is also a bug!
      hscopeLogger.error(
        'elk',
        `❌ LAYOUT BUG: ELK provided no position coordinates for container ${elkNode.id}`
      );
      // Temporarily use origin fallback to see what's happening
      layoutUpdates.position = { x: 0, y: 0 };
    }

    // Validate and set dimensions
    if (elkNode.width !== undefined || elkNode.height !== undefined) {
      layoutUpdates.dimensions = {};

      // Validate width
      if (elkNode.width !== undefined) {
        if (
          typeof elkNode.width === 'number' &&
          !isNaN(elkNode.width) &&
          isFinite(elkNode.width) &&
          elkNode.width > 0
        ) {
          layoutUpdates.dimensions.width = elkNode.width;
        } else {
          hscopeLogger.error('elk', `Invalid width for container ${elkNode.id}: ${elkNode.width}`);
          layoutUpdates.dimensions.width = 200; // Fallback
        }
      }

      // Validate height
      if (elkNode.height !== undefined) {
        if (
          typeof elkNode.height === 'number' &&
          !isNaN(elkNode.height) &&
          isFinite(elkNode.height) &&
          elkNode.height > 0
        ) {
          layoutUpdates.dimensions.height = elkNode.height;
        } else {
          hscopeLogger.error(
            'elk',
            `Invalid height for container ${elkNode.id}: ${elkNode.height}`
          );
          layoutUpdates.dimensions.height = 150; // Fallback
        }
      }
    }

    if (Object.keys(layoutUpdates).length > 0) {
      visState.setContainerLayout(elkNode.id, layoutUpdates);
    }

    // Update child positions (recursively handle containers vs nodes)
    elkNode.children?.forEach(elkChildNode => {
      // Handle label nodes - store label position with the container
      if (elkChildNode.id.endsWith('_label')) {
        const containerId = elkChildNode.id.replace('_label', '');
        const container = visState.getContainer(containerId);

        if (container) {
          // Store label positioning information with the container
          // This will be used by the container component to render the label
          const containerLayout = visState.getContainerLayout(containerId) || {
            position: { x: container.x || 0, y: container.y || 0 },
            dimensions: { width: container.width || 200, height: container.height || 150 },
          };

          // Update container layout with label position information
          visState.setContainerLayout(containerId, {
            ...containerLayout,
            labelPosition: {
              x: elkChildNode.x || 0,
              y: elkChildNode.y || 0,
              width: elkChildNode.width || 150,
              height: elkChildNode.height || 20,
            },
          });
        }

        return;
      }

      if (elkChildNode.children && elkChildNode.children.length > 0) {
        // This child is also a container - recurse into it
        this.updateContainerFromELK(elkChildNode, visState);
      } else {
        // This child is a leaf node - update its position
        this.updateNodeFromELK(elkChildNode, visState);
      }
    });
  }

  /**
   * Update node position from ELK result
   */
  private updateNodeFromELK(elkNode: ElkNode, visState: VisualizationState): void {
    // Try to update as regular node first using VisualizationState's layout methods
    try {
      const layoutUpdates: any = {};

      // Validate and set position
      if (elkNode.x !== undefined || elkNode.y !== undefined) {
        layoutUpdates.position = {};

        if (elkNode.x !== undefined) {
          if (typeof elkNode.x === 'number' && !isNaN(elkNode.x) && isFinite(elkNode.x)) {
            layoutUpdates.position.x = elkNode.x;
          } else {
            hscopeLogger.error('elk', `Invalid x coordinate for node ${elkNode.id}: ${elkNode.x}`);
            layoutUpdates.position.x = 0;
          }
        }

        if (elkNode.y !== undefined) {
          if (typeof elkNode.y === 'number' && !isNaN(elkNode.y) && isFinite(elkNode.y)) {
            layoutUpdates.position.y = elkNode.y;
          } else {
            hscopeLogger.error('elk', `Invalid y coordinate for node ${elkNode.id}: ${elkNode.y}`);
            layoutUpdates.position.y = 0;
          }
        }
      }

      // Validate and set dimensions
      if (elkNode.width !== undefined || elkNode.height !== undefined) {
        layoutUpdates.dimensions = {};

        if (elkNode.width !== undefined) {
          if (
            typeof elkNode.width === 'number' &&
            !isNaN(elkNode.width) &&
            isFinite(elkNode.width) &&
            elkNode.width > 0
          ) {
            layoutUpdates.dimensions.width = elkNode.width;
          } else {
            hscopeLogger.error('elk', `Invalid width for node ${elkNode.id}: ${elkNode.width}`);
            layoutUpdates.dimensions.width = 180;
          }
        }

        if (elkNode.height !== undefined) {
          if (
            typeof elkNode.height === 'number' &&
            !isNaN(elkNode.height) &&
            isFinite(elkNode.height) &&
            elkNode.height > 0
          ) {
            layoutUpdates.dimensions.height = elkNode.height;
          } else {
            hscopeLogger.error('elk', `Invalid height for node ${elkNode.id}: ${elkNode.height}`);
            layoutUpdates.dimensions.height = 60;
          }
        }
      }

      if (Object.keys(layoutUpdates).length > 0) {
        visState.setNodeLayout(elkNode.id, layoutUpdates);
      }
      return;
    } catch (_nodeError) {
      // If not found as node, might be a collapsed container - apply same validation
      try {
        const layoutUpdates: any = {};

        if (elkNode.x !== undefined || elkNode.y !== undefined) {
          layoutUpdates.position = {};

          if (elkNode.x !== undefined) {
            if (typeof elkNode.x === 'number' && !isNaN(elkNode.x) && isFinite(elkNode.x)) {
              layoutUpdates.position.x = elkNode.x;
            } else {
              hscopeLogger.error(
                'elk',
                `Invalid x coordinate for container ${elkNode.id}: ${elkNode.x}`
              );
              layoutUpdates.position.x = 0;
            }
          }

          if (elkNode.y !== undefined) {
            if (typeof elkNode.y === 'number' && !isNaN(elkNode.y) && isFinite(elkNode.y)) {
              layoutUpdates.position.y = elkNode.y;
            } else {
              hscopeLogger.error(
                'elk',
                `Invalid y coordinate for container ${elkNode.id}: ${elkNode.y}`
              );
              layoutUpdates.position.y = 0;
            }
          }
        }

        if (elkNode.width !== undefined || elkNode.height !== undefined) {
          layoutUpdates.dimensions = {};

          if (elkNode.width !== undefined) {
            if (
              typeof elkNode.width === 'number' &&
              !isNaN(elkNode.width) &&
              isFinite(elkNode.width) &&
              elkNode.width > 0
            ) {
              layoutUpdates.dimensions.width = elkNode.width;
            } else {
              hscopeLogger.error(
                'elk',
                `Invalid width for container ${elkNode.id}: ${elkNode.width}`
              );
              layoutUpdates.dimensions.width = 200;
            }
          }

          if (elkNode.height !== undefined) {
            if (
              typeof elkNode.height === 'number' &&
              !isNaN(elkNode.height) &&
              isFinite(elkNode.height) &&
              elkNode.height > 0
            ) {
              layoutUpdates.dimensions.height = elkNode.height;
            } else {
              hscopeLogger.error(
                'elk',
                `Invalid height for container ${elkNode.id}: ${elkNode.height}`
              );
              layoutUpdates.dimensions.height = 150;
            }
          }
        }

        if (Object.keys(layoutUpdates).length > 0) {
          visState.setContainerLayout(elkNode.id, layoutUpdates);
        }
        return;
      } catch (_containerError) {
        console.warn(`[ELKBridge] Node/Container ${elkNode.id} not found in VisualizationState`);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get containers requiring layout (moved from VisualizationState)
   * This is ELK-specific logic for determining which containers need layout
   */
  getContainersRequiringLayout(
    visState: VisualizationState,
    _changedContainerId?: string
  ): ReadonlyArray<any> {
    // Return all visible containers that need layout
    const visibleContainers = visState.visibleContainers.filter(container => !container.hidden);

    return visibleContainers;
  }

  /**
   * Get container ELK fixed status (moved from VisualizationState)
   * This is ELK-specific logic for tracking fixed positions
   */
  getContainerELKFixed(visState: VisualizationState, containerId: string): boolean {
    const container = visState.getContainer(containerId);
    if (!container) return false;

    return container.elkFixed || false;
  }

  /**
   * Validate that all visible containers have ELK layout positions
   * This prevents race conditions where ReactFlow bridge runs before ELK completes
   */
  private validateELKPositions(visState: VisualizationState): void {
    const missingPositions: Array<{ id: string; label: string }> = [];

    // Check all visible containers for ELK positions
    visState.visibleContainers.forEach(container => {
      const layout = visState.getContainerLayout(container.id);
      const position = layout?.position;

      // Position is missing if undefined or has undefined coordinates
      if (!position || position.x === undefined || position.y === undefined) {
        missingPositions.push({
          id: container.id,
          label: container.label || container.id,
        });
      }
    });

    // If any containers are missing positions, throw detailed error
    if (missingPositions.length > 0) {
      const containerList = missingPositions.map(c => `${c.id} (${c.label})`).join(', ');

      throw new Error(
        `ELK layout incomplete: ${missingPositions.length} visible containers missing positions: ${containerList}. ` +
          `This indicates ELK layout failed to complete properly. All visible containers must have ` +
          `valid (x, y) positions before ReactFlow conversion can proceed.`
      );
    }
  }
}
