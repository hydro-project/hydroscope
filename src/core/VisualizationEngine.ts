/**
 * @fileoverview Visualization Engine - Orchestrates the entire visualization pipeline
  
 * 2. Layout (VisualizationState → ELK → VisualizationState) 
 * 3. Render (VisualizationState → ReactFlow)
 * 
 * Clean separation: Engine orchestrates, Bridges translate, VisualizationState stores
 */

import type { VisualizationState } from './VisualizationState';
import { ELKBridge } from '../bridges/ELKBridge';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import type { ReactFlowData } from '../bridges/ReactFlowBridge';
import type { Container, LayoutConfig } from './types';
import { LAYOUT_CONSTANTS } from '../shared/config';

// Visualization states
export type VisualizationPhase =
  | 'initial' // Fresh data loaded
  | 'laying_out' // ELK layout in progress
  | 'ready' // Layout complete, ready to render
  | 'rendering' // ReactFlow conversion in progress
  | 'displayed' // ReactFlow data ready for display
  | 'error'; // Error occurred

export interface VisualizationEngineState {
  phase: VisualizationPhase;
  lastUpdate: number;
  layoutCount: number;
  error?: string;
}

export interface VisualizationEngineConfig {
  autoLayout: boolean; // Automatically run layout on data changes
  layoutDebounceMs: number; // Debounce layout calls
  enableLogging: boolean; // Enable detailed logging
  layoutConfig?: LayoutConfig; // Layout configuration
}

const DEFAULT_CONFIG: VisualizationEngineConfig = {
  autoLayout: true,
  layoutDebounceMs: 300,
  enableLogging: false,
  layoutConfig: {
    enableSmartCollapse: true,
    algorithm: 'mrtree',
    direction: 'DOWN',
  },
};

export class VisualizationEngine {
  private visState: VisualizationState;
  private elkBridge: ELKBridge;
  private reactFlowBridge: ReactFlowBridge;
  private config: VisualizationEngineConfig;
  private state: VisualizationEngineState;
  private layoutTimeout?: number;
  private listeners: Map<string, (state: VisualizationEngineState) => void> = new Map();

  constructor(visState: VisualizationState, config: Partial<VisualizationEngineConfig> = {}) {
    this.visState = visState;
    // Deep-merge layoutConfig to preserve DEFAULT_CONFIG.layoutConfig values
    const mergedConfig: VisualizationEngineConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      layoutConfig: {
        ...DEFAULT_CONFIG.layoutConfig,
        ...(config.layoutConfig || {}),
      },
    } as VisualizationEngineConfig;
    this.config = mergedConfig;
    // Initialize bridges after computing the merged config
    this.elkBridge = new ELKBridge(this.config.layoutConfig);
    this.reactFlowBridge = new ReactFlowBridge();

    // Set up layout controller for VisualizationState optimizations
    this.visState.setLayoutController({
      suspendAutoLayout: () => this.suspendAutoLayout(),
      resumeAutoLayout: (triggerLayout?: boolean) => this.resumeAutoLayout(triggerLayout),
    });

    this.state = {
      phase: 'initial',
      lastUpdate: Date.now(),
      layoutCount: 0,
    };
  }

  // ============ Public API ============

  /**
   * Get current engine state
   */
  getState(): VisualizationEngineState {
    return { ...this.state };
  }

  /**
   * Get the underlying VisualizationState
   */
  getVisualizationState(): VisualizationState {
    return this.visState;
  }

  /**
   * Update layout configuration and optionally re-run layout
   */
  updateLayoutConfig(layoutConfig: LayoutConfig, autoReLayout: boolean = true): void {
    this.config.layoutConfig = { ...this.config.layoutConfig, ...layoutConfig };
    this.elkBridge.updateLayoutConfig(layoutConfig);

    if (autoReLayout) {
      // Reset layout count to trigger smart collapse on algorithm change
      this.state.layoutCount = 0;
      this.runLayout();
    }
  }

  /**
   * Temporarily suspend automatic layout for bulk operations
   */
  suspendAutoLayout(): void {
    this.config.autoLayout = false;
  }

  /**
   * Resume automatic layout and optionally trigger immediate layout
   */
  resumeAutoLayout(triggerLayout: boolean = true): void {
    this.config.autoLayout = true;

    if (triggerLayout) {
      this.scheduleLayout();
    }
  }

  /**
   * Run layout on current VisualizationState data
   */
  async runLayout(): Promise<void> {
    if (this.state.phase === 'laying_out') {
      return;
    }

    // Import profiler utilities for layout timing
    const { getProfiler } = await import('../dev')
      .catch(() => ({ getProfiler: () => null }));

    const profiler = getProfiler();

    let bigGraph: boolean = false;

    try {
      this.updateState('laying_out');
      
      // Profile layout operations
      profiler?.start('layout-operation');
      
      if (this.state.layoutCount === 0 && this.visState.getVisibleNodes().length > 50) {
        // layout the graph with all top-level containers collapsed.
        profiler?.start('full-collapse');
        await this.runFullCollapse();
        profiler?.end('full-collapse');
      } else {
        // Use ELK bridge to layout the VisualizationState
        profiler?.start('elk-layout');
        await this.elkBridge.layoutVisualizationState(this.visState);
        profiler?.end('elk-layout');

        // Run smart collapse only on the first layout if enabled
        if (this.config.layoutConfig?.enableSmartCollapse && this.state.layoutCount === 0) {
          profiler?.start('smart-collapse');
          await this.runSmartCollapse();
          profiler?.end('smart-collapse');
          
          // Re-layout after smart collapse
          profiler?.start('elk-layout-post-collapse');
          await this.elkBridge.layoutVisualizationState(this.visState);
          profiler?.end('elk-layout-post-collapse');
        }
      }

      profiler?.end('layout-operation');

      // layoutCount is used to avoid running smart collapse on subsequent layouts
      this.state.layoutCount++;
      this.updateState('ready');
    } catch (error) {
      this.handleError('Layout failed', error);
    }
  }

  /**
   * Run selective layout with fixed positions for unchanged containers
   * This is used for individual container collapse/expand operations
   */
  async runSelectiveLayout(changedContainerId: string): Promise<void> {
    if (this.state.phase === 'laying_out') {
      return;
    }

    try {
      this.updateState('laying_out');

      // Use ELK bridge to layout with position fixing
      await this.elkBridge.layoutVisualizationState(this.visState, changedContainerId);

      // Don't run smart collapse for selective layouts - respect user intent
      // Don't increment layout count either - this is just a refinement

      this.updateState('ready');
    } catch (error) {
      this.handleError('Selective layout failed', error);
    }
  }

  /**
   * Get ReactFlow data for rendering
   */
  getReactFlowData(): ReactFlowData {
    if (this.state.phase === 'error') {
      throw new Error(`Cannot render in error state: ${this.state.error}`);
    }

    try {
      this.updateState('rendering');

      // Use ReactFlow bridge to convert VisualizationState
      const reactFlowData = this.reactFlowBridge.convertVisualizationState(this.visState);

      this.updateState('displayed');

      return reactFlowData;
    } catch (error) {
      this.handleError('ReactFlow conversion failed', error);
      throw error;
    }
  }

  /**
   * Complete visualization pipeline: layout + render
   */
  async visualize(): Promise<ReactFlowData> {
    // Step 1: Run layout if needed
    if (this.state.phase !== 'ready' && this.state.phase !== 'displayed') {
      await this.runLayout();
    }

    // Step 2: Generate ReactFlow data
    return this.getReactFlowData();
  }

  /**
   * Trigger layout with debouncing (for auto-layout)
   */
  scheduleLayout(): void {
    if (!this.config.autoLayout) {
      return;
    }

    // Clear existing timeout
    if (this.layoutTimeout) {
      clearTimeout(this.layoutTimeout);
    }

    // Schedule new layout
    this.layoutTimeout = setTimeout(() => {
      this.runLayout().catch(error => {
        this.handleError('Scheduled layout failed', error);
      });
    }, 100) as unknown as number; // 100ms debounce delay
  }

  /**
   * Notify that VisualizationState data has changed
   */
  onDataChanged(): void {
    this.updateState('initial');
    this.scheduleLayout();
  }

  /**
   * Add state change listener
   */
  onStateChange(id: string, listener: (state: VisualizationEngineState) => void): void {
    this.listeners.set(id, listener);
  }

  /**
   * Remove state change listener
   */
  removeStateListener(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.layoutTimeout) {
      clearTimeout(this.layoutTimeout);
    }
    this.listeners.clear();
  }

  // (Viewport change tracking removed; engine reads viewport from VisualizationState during smart collapse only)

  /**
   * Smart collapse implementation, to choose which containers to expand vs collapse
   * so that initial layout is not too cluttered.
   * Run after initial ELK layout to collapse containers that exceed viewport budget
   */
  private async runSmartCollapse(): Promise<void> {
    // Step 1: Get TOP-LEVEL containers from VisualizationState
    // This ensures we don't double-process parent and child containers
    const containers = this.visState.getTopLevelContainers();

    if (containers.length === 0) {
      return;
    }

    // Step 2: Calculate container areas using layout dimensions from ELK
    const containerAreas = containers
      .map(container => {
        // Get dimensions from ELK layout results (stored as width/height on container)
        const width = container.width || LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH;
        const height = container.height || LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT;
        const area = width * height;

        return {
          container,
          area,
          width,
          height,
        };
      })
      .sort((a, b) => a.area - b.area); // Sort by area, smallest to largest

    // Step 3: Calculate viewport area and budget
    // Get viewport dimensions from VisualizationState, fallback to defaults if not set
    const viewport = this.visState.viewport;
    const viewportWidth = viewport?.width || 1200;
    const viewportHeight = viewport?.height || 800;
    const viewportArea = viewportWidth * viewportHeight;
    const containerAreaBudgetRatio = 0.7; // Use 70% of viewport for containers
    const containerAreaBudget = viewportArea * containerAreaBudgetRatio;

    // Step 4: Iterate through containers, keep expanding until budget exceeded
    let usedArea = 0;
    const containersToKeepExpanded: string[] = [];
    const containersToCollapse: string[] = [];

    for (const { container, area } of containerAreas) {
      if (usedArea + area <= containerAreaBudget) {
        // We can afford to keep this container expanded
        containersToKeepExpanded.push(container.id);
        usedArea += area;
      } else {
        // This would exceed budget, collapse it
        containersToCollapse.push(container.id);
      }
    }

    // Step 5: Apply collapse decisions using collapseContainer
    if (containersToCollapse.length > 0) {
      for (const containerId of containersToCollapse) {
        try {
          // Sanity check:
          // Check if container exists and is already collapsed/hidden before attempting collapse
          const container = this.visState.getContainer(containerId);
          if (!container || container.collapsed || container.hidden) {
            continue;
          }

          // Use collapseContainer which handles all the mechanics atomically:
          // - Collapsing the container and its children
          // - Creating hyperEdges for crossing edges
          // - Hiding descendant containers
          this.visState.collapseContainer(containerId);
        } catch (error) {
          // Continue with other containers even if one fails
        }
      }

      // Step 6: Re-run layout after collapse to get clean final layout
      // IMPORTANT: Clear any cached positions to force fresh layout with new collapsed dimensions
      this.visState.clearLayoutPositions();
      // Force ELK to rebuild from scratch with new dimensions
      this.elkBridge = new ELKBridge(this.config.layoutConfig);

      // INVARIANT: All containers should be unfixed for fresh layout
      this.validateRelayoutInvariants();

      await this.elkBridge.layoutVisualizationState(this.visState);
    }
  }

  /**
   * Full collapse implementation, collpases all top-level containers
   */
  private async runFullCollapse(): Promise<void> {
    // Step 1: Get TOP-LEVEL containers from VisualizationState
    // This ensures we don't double-process parent and child containers
    const containers: readonly Container[] = this.visState.getTopLevelContainers();

    if (containers.length === 0) {
      return;
    }

    for (const container of containers) {
      try {
        // Sanity check:
        // Check if container exists and is already collapsed/hidden before attempting collapse
        if (!container || container.collapsed || container.hidden) {
          continue;
        }

        // Use collapseContainer which handles all the mechanics atomically:
        // - Collapsing the container and its children
        // - Creating hyperEdges for crossing edges
        // - Hiding descendant containers
        this.visState.collapseContainer(container.id);
      } catch (error) {
        // Continue with other containers even if one fails
      }
    }

    // Re-run layout after collapse to get clean final layout
    // IMPORTANT: Clear any cached positions to force fresh layout with new collapsed dimensions
    this.visState.clearLayoutPositions();
    // Force ELK to rebuild from scratch with new dimensions
    this.elkBridge = new ELKBridge(this.config.layoutConfig);

    await this.elkBridge.layoutVisualizationState(this.visState);
  }

  // ============ Internal Methods ============

  private updateState(phase: VisualizationPhase): void {
    this.state.phase = phase;
    this.state.lastUpdate = Date.now();

    if (phase !== 'error') {
      delete this.state.error;
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('[VisualizationEngine] Listener error:', error);
      }
    });
  }

  /**
   * Validate invariants before re-layout after collapse
   */
  private validateRelayoutInvariants(): void {
    // INVARIANT: All containers should have elkFixed=false for fresh layout
    const containers = this.visState.visibleContainers;
    let fixedCount = 0;

    for (const container of containers) {
      const isFixed = this.elkBridge.getContainerELKFixed(this.visState, container.id);
      if (isFixed) {
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      throw new Error(
        `Re-layout invariant violation: ${fixedCount} containers are still elkFixed=true, preventing fresh layout`
      );
    }
  }

  private handleError(message: string, error: unknown): void {
    const errorMessage = `${message}: ${error instanceof Error ? error.message : String(error)}`;
    this.state.error = errorMessage;
    this.updateState('error');

    console.error(`[VisualizationEngine] ❌ ${errorMessage}`, error);
  }
}

/**
 * Factory function to create a visualization engine
 */
export function createVisualizationEngine(
  visState: VisualizationState,
  config?: Partial<VisualizationEngineConfig>
): VisualizationEngine {
  return new VisualizationEngine(visState, config);
}
