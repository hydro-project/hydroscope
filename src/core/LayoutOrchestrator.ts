/**
 * @fileoverview LayoutOrchestrator - Centralized Layout Decision Making
 *
 * This class serves as the "narrow waist" for all layout-triggering decisions.
 * It coordinates between pure state changes (VisualizationState) and layout execution,
 * using ConsolidatedOperationManager for proper operation coordination and autofit.
 *
 * Architecture:
 * Component -> LayoutOrchestrator -> ConsolidatedOperationManager -> VisualizationState (pure) + LayoutEngine
 */

import type { VisualizationState } from './VisualizationState';
import { consolidatedOperationManager } from '../utils/consolidatedOperationManager';
import { hscopeLogger } from '../utils/logger';

export interface LayoutController {
  refreshLayout: (force?: boolean) => Promise<void>;
}

export interface AutoFitController {
  fitView: (options?: any) => void;
}

/**
 * LayoutOrchestrator coordinates all layout-triggering operations.
 *
 * Key principles:
 * 1. VisualizationState methods called by this class should be "pure" (no internal layout triggers)
 * 2. All layout triggering goes through ConsolidatedOperationManager
 * 3. Single decision point for when layout should occur
 */
export class LayoutOrchestrator {
  constructor(
    private visualizationState: VisualizationState,
    private layoutController: LayoutController,
    private autoFitController?: AutoFitController
  ) {
    hscopeLogger.log('orchestrator', 'LayoutOrchestrator initialized');
  }

  /**
   * Collapse all containers with proper coordination
   */
  async collapseAll(): Promise<void> {
    const operationId = `orchestrator-collapse-all-${Date.now()}`;

    hscopeLogger.log('orchestrator', `collapseAll operation=${operationId}`);

    await consolidatedOperationManager.queueContainerToggle(
      operationId,
      async () => {
        // Use original method - layout lock will prevent coordination issues
        this.visualizationState.collapseAllContainers();

        // Trigger FULL layout recalculation for collapse all (force=true)
        // This ensures containers are repositioned optimally, not just collapsed in place
        await this.layoutController.refreshLayout(true);
      },
      'high'
    );

    // ConsolidatedOperationManager will handle autofit automatically
    hscopeLogger.log('orchestrator', `collapseAll queued operation=${operationId}`);
  }

  /**
   * Expand all containers with proper coordination
   */
  async expandAll(): Promise<void> {
    const operationId = `orchestrator-expand-all-${Date.now()}`;

    hscopeLogger.log('orchestrator', `expandAll operation=${operationId}`);

    await consolidatedOperationManager.queueContainerToggle(
      operationId,
      async () => {
        // Use original method - layout lock will prevent coordination issues
        this.visualizationState.expandAllContainers();

        // Trigger FULL layout recalculation for expand all (force=true)
        // This ensures containers are repositioned optimally
        await this.layoutController.refreshLayout(true);
      },
      'high'
    );

    hscopeLogger.log('orchestrator', `expandAll queued operation=${operationId}`);
  }

  /**
   * Toggle a single container with proper coordination
   */
  async toggleContainer(containerId: string): Promise<void> {
    const container = this.visualizationState.getContainer(containerId);
    if (!container) {
      hscopeLogger.warn('orchestrator', `toggleContainer: container not found id=${containerId}`);
      return;
    }

    const operationId = `orchestrator-toggle-${containerId}-${Date.now()}`;
    const action = container.collapsed ? 'expand' : 'collapse';

    hscopeLogger.log(
      'orchestrator',
      `toggleContainer ${action} id=${containerId} operation=${operationId}`
    );

    await consolidatedOperationManager.queueContainerToggle(
      operationId,
      async () => {
        if (container.collapsed) {
          this.visualizationState.expandContainer(containerId);
          // Expansion needs full layout to position newly visible child nodes
          await this.layoutController.refreshLayout(true);
        } else {
          this.visualizationState.collapseContainer(containerId);
          // Collapse can use selective layout to preserve other container positions
          await this.layoutController.refreshLayout(false);
        }
      },
      'normal'
    );

    hscopeLogger.log(
      'orchestrator',
      `toggleContainer ${action} queued id=${containerId} operation=${operationId}`
    );
  }

  /**
   * Handle search expansion with proper coordination
   */
  async expandForSearch(containerIds: string[], searchQuery: string): Promise<void> {
    if (containerIds.length === 0) return;

    const operationId = `orchestrator-search-expand-${Date.now()}`;

    hscopeLogger.log(
      'orchestrator',
      `expandForSearch containers=${containerIds.length} query="${searchQuery}" operation=${operationId}`
    );

    // Set flag to prevent full collapse from undoing search expansion
    if (typeof window !== 'undefined') {
      (window as any).__hydroRecentSearchExpansion = Date.now();
    }

    await consolidatedOperationManager.queueSearchExpansion(
      operationId,
      async () => {
        hscopeLogger.log(
          'orchestrator',
          `🔄 Starting container expansion for ${containerIds.length} containers`
        );

        // Expand all containers atomically
        for (const containerId of containerIds) {
          this.visualizationState.expandContainer(containerId);
        }

        // CRITICAL: Force visibility cache consistency after search expansion
        // This ensures all container visibility states are consistent before layout
        this.visualizationState.ensureVisibilityConsistency();

        // Search expansion always needs full layout to position newly visible child nodes
        await this.layoutController.refreshLayout(true);
        hscopeLogger.log(
          'orchestrator',
          `✅ Search expansion completed for ${containerIds.length} containers`
        );
      },
      'high' // Search operations are high priority
    );

    hscopeLogger.log(
      'orchestrator',
      `expandForSearch queued containers=${containerIds.length} operation=${operationId}`
    );
  }

  /**
   * Handle layout refresh with optional autofit
   * This is the central decision point for when layout should occur
   */
  async refreshLayout(
    force: boolean = false,
    reason: string = 'orchestrator-request'
  ): Promise<void> {
    const operationId = `orchestrator-layout-${Date.now()}`;

    hscopeLogger.log(
      'orchestrator',
      `refreshLayout force=${force} reason=${reason} operation=${operationId}`
    );

    await consolidatedOperationManager.queueLayoutOperation(
      operationId,
      async () => {
        await this.layoutController.refreshLayout(force);
      },
      {
        priority: force ? 'high' : 'normal',
        reason,
        triggerAutoFit: true, // Layout operations should trigger autofit
        force,
      }
    );

    hscopeLogger.log(
      'orchestrator',
      `refreshLayout queued force=${force} operation=${operationId}`
    );
  }

  /**
   * Request autofit explicitly (for cases where layout doesn't change but viewport should)
   */
  requestAutoFit(reason: string = 'orchestrator-request'): void {
    if (this.autoFitController?.fitView) {
      consolidatedOperationManager.requestAutoFit(
        this.autoFitController.fitView,
        undefined,
        `orchestrator-${reason}`
      );
      hscopeLogger.log('orchestrator', `autofit requested reason=${reason}`);
    } else {
      hscopeLogger.warn(
        'orchestrator',
        `autofit requested but no controller available reason=${reason}`
      );
    }
  }

  /**
   * Handle batched container toggles with proper coordination
   * More efficient than individual toggles for bulk operations
   */
  async toggleContainersBatch(containerIds: string[]): Promise<void> {
    if (containerIds.length === 0) return;

    const operationId = `orchestrator-batch-toggle-${Date.now()}`;

    hscopeLogger.log(
      'orchestrator',
      `toggleContainersBatch containers=${containerIds.length} operation=${operationId}`
    );

    await consolidatedOperationManager.queueContainerToggle(
      operationId,
      async () => {
        // Check if any containers will be expanded (need full layout for child positioning)
        let hasExpansions = false;

        // Toggle each container using pure methods
        for (const containerId of containerIds) {
          const container = this.visualizationState.getContainer(containerId);
          if (!container) continue;

          if (container.collapsed) {
            this.visualizationState.expandContainer(containerId);
            hasExpansions = true; // Expansion detected
          } else {
            this.visualizationState.collapseContainer(containerId);
          }
        }

        // Use full layout if expanding any containers or multiple containers involved
        const force = hasExpansions || containerIds.length > 1;
        await this.layoutController.refreshLayout(force);
      },
      'normal'
    );

    hscopeLogger.log(
      'orchestrator',
      `toggleContainersBatch queued containers=${containerIds.length} operation=${operationId}`
    );
  }

  /**
   * Get current operation status for debugging
   */
  getStatus() {
    return {
      consolidatedManager: consolidatedOperationManager.getStatus(),
    };
  }
}
