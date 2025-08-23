/**
 * @fileoverview Visualization Engine - Orchestrates the entire visualization pipeline
 * 
 * This engine manages the state machine for visualization:
 * 1. Data Input → VisState
 * 2. Layout (VisState → ELK → VisState) 
 * 3. Render (VisState → ReactFlow)
 * 
 * Clean separation: Engine orchestrates, Bridges translate, VisState stores
 */

import type { VisualizationState } from './VisualizationState';
import { ELKBridge } from '../bridges/ELKBridge';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import type { ReactFlowData } from '../bridges/ReactFlowBridge';
import type { LayoutConfig } from './types';
import { LAYOUT_CONSTANTS } from '../shared/config';

// Visualization states
export type VisualizationPhase = 
  | 'initial'       // Fresh data loaded
  | 'laying_out'    // ELK layout in progress
  | 'ready'         // Layout complete, ready to render
  | 'rendering'     // ReactFlow conversion in progress
  | 'displayed'     // ReactFlow data ready for display
  | 'error';        // Error occurred

export interface VisualizationEngineState {
  phase: VisualizationPhase;
  lastUpdate: number;
  layoutCount: number;
  error?: string;
}

export interface VisualizationEngineConfig {
  autoLayout: boolean;          // Automatically run layout on data changes
  layoutDebounceMs: number;     // Debounce layout calls
  enableLogging: boolean;       // Enable detailed logging
  layoutConfig?: LayoutConfig;  // Layout configuration
}

const DEFAULT_CONFIG: VisualizationEngineConfig = {
  autoLayout: true,
  layoutDebounceMs: 300,
  enableLogging: false,
  layoutConfig: {
    enableSmartCollapse: true,
    algorithm: 'mrtree',
    direction: 'DOWN'
  }
};

export class VisualizationEngine {
  private visState: VisualizationState;
  private elkBridge: ELKBridge;
  private reactFlowBridge: ReactFlowBridge;
  private config: VisualizationEngineConfig;
  private state: VisualizationEngineState;
  private layoutTimeout?: number;
  private listeners: Map<string, (state: VisualizationEngineState) => void> = new Map();

  constructor(
    visState: VisualizationState, 
    config: Partial<VisualizationEngineConfig> = {}
  ) {
    this.visState = visState;
    this.elkBridge = new ELKBridge(config.layoutConfig);
    this.reactFlowBridge = new ReactFlowBridge();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.state = {
      phase: 'initial',
      lastUpdate: Date.now(),
      layoutCount: 0
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
   * Get the underlying VisState
   */
  getVisState(): VisualizationState {
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
   * Run layout on current VisState data
   */
  async runLayout(): Promise<void> {
    
    if (this.state.phase === 'laying_out') {
      return;
    }

    try {
      this.updateState('laying_out');
      
      // Use ELK bridge to layout the VisState
      await this.elkBridge.layoutVisState(this.visState);
            
      // DEBUG: Check smart collapse conditions
      
      // Run smart collapse if enabled and this is the first layout (initiation) or layout config changed
      if (this.config.layoutConfig?.enableSmartCollapse && (this.state.layoutCount === 0)) {
        await this.runSmartCollapse();
        // Use ELK bridge to re-layout the VisState after smartCollapse
        await this.elkBridge.layoutVisState(this.visState);
      } else {
      }

      this.state.layoutCount++;
      this.updateState('ready');
      

      
    } catch (error) {
      this.handleError('Layout failed', error);
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
      
      // Use ReactFlow bridge to convert VisState
      const reactFlowData = this.reactFlowBridge.convertVisState(this.visState);
      
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
   * Notify that VisState data has changed
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

  /**
   * Simple smart collapse implementation
   * Run after initial ELK layout to collapse containers that exceed viewport budget
   */
  private async runSmartCollapse(): Promise<void> {
    // Step 1: Get only TOP-LEVEL containers from VisState
    // This ensures we don't double-process parent and child containers
    const containers = this.visState.getTopLevelContainers();
    
    if (containers.length === 0) {
      return;
    }
    
          // Step 2: Calculate container areas using layout dimensions
    const containerAreas = containers.map(container => {
      // Get dimensions from ELK layout results (stored as width/height on container)
      const width = (container as any).width || LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH;
      const height = (container as any).height || LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT;
      const area = width * height;
      
      
      return {
        container,
        area,
        width,
        height
      };
    }).sort((a, b) => a.area - b.area); // Sort by area, smallest to largest
    
    
    // Step 3: Calculate viewport area and budget
    // Use reasonable default viewport size (window dimensions would be ideal)
    const viewportWidth = 1200;
    const viewportHeight = 800;
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
          // CRITICAL: Check if container is already collapsed before attempting collapse
          // During recursive collapse, parent containers may have already collapsed their children
          const container = this.visState.getContainer(containerId);
          if (!container) {
            continue;
          }
          
          if (container.collapsed) {
            continue;
          }
          
          // CRITICAL: Check if container is now hidden due to ancestor collapse
          // Smart collapse processes containers individually, but our recursive collapse
          // may have already hidden descendant containers when their ancestors were collapsed
          if (container.hidden) {
            continue;
          }
          
          // Use collapseContainer which handles all the mechanics atomically:
          // - Collapsing the container and its children
          // - Creating hyperEdges for crossing edges  
          // - Hiding descendant containers
          // - Validating invariants
          this.visState.collapseContainer(containerId);
        } catch (error) {
          // Continue with other containers even if one fails
          // collapseContainer already handles invariant validation internally
        }
      }
      
      // Run final validation after all containers are collapsed
      // CRITICAL: Always clean up invalid hyperEdges after smart collapse
      try {
        (this.visState as any).containerOps.validateHyperEdgeLifting();
      } catch (error) {
      }
      
      
      // Step 6: Re-run layout after collapse to get clean final layout
      // IMPORTANT: Clear any cached positions to force fresh layout with new collapsed dimensions
      this.clearLayoutPositions();
      // Force ELK to rebuild from scratch with new dimensions
      this.elkBridge = new ELKBridge(this.config.layoutConfig);
      
      // INVARIANT: All containers should be unfixed for fresh layout
      this.validateRelayoutInvariants();
      
      // CRITICAL: Validate collapsed containers have small dimensions  
      this.validateCollapsedContainerDimensions();
      
      // Sanity check ELK layout config
      this.validateELKLayoutConfig();
      
      // Validate TreeHierarchy and VisState are in sync  
      this.validateTreeHierarchySync();
      
      await this.elkBridge.layoutVisState(this.visState);
    }
  }

  // ============ Internal Methods ============

  private updateState(phase: VisualizationPhase): void {
    const previousPhase = this.state.phase;
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
   * Validate that collapsed containers have correct small dimensions
   */
  private validateCollapsedContainerDimensions(): void {
    
    const containers = this.visState.visibleContainers;
    let collapsedCount = 0;
    let dimensionViolations = 0;
    
    for (const container of containers) {
      if (container.collapsed) {
        collapsedCount++;
        const dimensions = this.visState.getContainerAdjustedDimensions(container.id);
        
        // Collapsed containers should be small (≤300x200)
        if (dimensions.width > 300 || dimensions.height > 200) {
          dimensionViolations++;
        } else {
        }
      }
    }
    
    if (dimensionViolations > 0) {
      throw new Error(`Collapsed container dimension violations: ${dimensionViolations}/${collapsedCount} collapsed containers have incorrect dimensions`);
    }
    
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
      throw new Error(`Re-layout invariant violation: ${fixedCount} containers are still elkFixed=true, preventing fresh layout`);
    }
    
  }

  /**
   * Validate ELK layout configuration
   */
  private validateELKLayoutConfig(): void {
    
    const config = this.config.layoutConfig;
    if (!config) {
      throw new Error('ELK layout config is undefined');
    }
    
  }

  /**
   * Validate TreeHierarchy and VisState are in sync
   */
  private validateTreeHierarchySync(): void {
    
    // Check that visible containers in VisState match what TreeHierarchy should show
    const visibleContainers = this.visState.visibleContainers;
    let collapsedCount = 0;
    let expandedCount = 0;
    
    for (const container of visibleContainers) {
      if (container.collapsed) {
        collapsedCount++;
      } else {
        expandedCount++;
      }
    }
    
  }

  /**
   * Clear all layout positions to force fresh ELK layout calculation
   * This is needed after smart collapse to prevent ELK from using cached positions
   * calculated with old (large) container dimensions
   */
  private clearLayoutPositions(): void {
    
    // Use VisState's public method to clear all layout positions
    this.visState.clearLayoutPositions();
    
  }

  private handleError(message: string, error: any): void {
    const errorMessage = `${message}: ${error instanceof Error ? error.message : String(error)}`;
    this.state.error = errorMessage;
    this.updateState('error');
    
    console.error(`[VisualizationEngine] ❌ ${errorMessage}`, error);
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[VisualizationEngine] ${message}`);
    }
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
