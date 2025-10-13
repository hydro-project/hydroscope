/**
 * @fileoverview Container Operation Utilities
 * 
 * Provides imperative container operation functions that avoid React re-render cascades
 * and ResizeObserver loops by using direct VisualizationState manipulation and minimal
 * coordination system usage.
 * 
 * This follows the same pattern established in searchClearUtils.ts for avoiding
 * ResizeObserver loops and coordination cascades.
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import { 
  globalOperationMonitor, 
  recordCoordinatorCall,
  type OperationType 
} from "./operationPerformanceMonitor.js";

/**
 * Debounce utility for rapid container operations
 */
class ContainerOperationDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly delay: number;

  constructor(delay: number = 150) {
    this.delay = delay;
  }

  debounce<T extends any[]>(
    key: string,
    fn: (...args: T) => void,
    ...args: T
  ): void {
    // Clear existing timer for this key
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.timers.delete(key);
      fn(...args);
    }, this.delay);

    this.timers.set(key, timer);
  }

  clear(key?: string): void {
    if (key) {
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    } else {
      // Clear all timers
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    }
  }
}

// Global debouncer instance for container operations
const containerDebouncer = new ContainerOperationDebouncer();

/**
 * Toggle container imperatively without triggering AsyncCoordinator cascades
 * 
 * This utility implements the pattern for avoiding ResizeObserver loops:
 * 1. Manipulate VisualizationState directly (imperative)
 * 2. Avoid callbacks that trigger coordination systems
 * 3. Use synchronous operations
 * 4. Provide debouncing for rapid operations
 */
export function toggleContainerImperatively(options: {
  containerId: string;
  visualizationState?: VisualizationState;
  forceExpanded?: boolean; // Force to expanded state
  forceCollapsed?: boolean; // Force to collapsed state
  debounce?: boolean; // Enable debouncing for rapid operations
  debounceKey?: string; // Custom debounce key (defaults to containerId)
  debug?: boolean;
  enablePerformanceMonitoring?: boolean; // Enable performance monitoring
}): boolean {
  const {
    containerId,
    visualizationState,
    forceExpanded,
    forceCollapsed,
    debounce = false,
    debounceKey,
    debug = false,
    enablePerformanceMonitoring = true
  } = options;

  // Start performance monitoring
  const operation: OperationType = 'container_toggle';
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, { 
      containerId, 
      forceExpanded, 
      forceCollapsed, 
      debounce 
    });
  }

  if (debug) {
    console.log('[ContainerOperationUtils] Starting imperative container toggle', {
      containerId,
      forceExpanded,
      forceCollapsed,
      debounce
    });
  }

  // Validate inputs
  if (!containerId) {
    console.error('[ContainerOperationUtils] Container ID is required');
    return false;
  }

  if (!visualizationState) {
    console.error('[ContainerOperationUtils] VisualizationState is required');
    return false;
  }

  // Get container
  const container = visualizationState.getContainer(containerId);
  if (!container) {
    console.warn(`[ContainerOperationUtils] Container ${containerId} not found`);
    return false;
  }

  // Determine target state
  let targetCollapsed: boolean;
  if (forceExpanded) {
    targetCollapsed = false;
  } else if (forceCollapsed) {
    targetCollapsed = true;
  } else {
    // Toggle current state
    targetCollapsed = !container.collapsed;
  }

  // Skip if already in target state
  if (container.collapsed === targetCollapsed) {
    if (debug) {
      console.log(`[ContainerOperationUtils] Container ${containerId} already in target state`);
    }
    return true;
  }

  // Define the operation function
  const performOperation = () => {
    try {
      if (targetCollapsed) {
        // Use the coordinator method for collapse
        if (visualizationState._collapseContainerForCoordinator) {
          // Record coordinator call for performance monitoring
          if (enablePerformanceMonitoring) {
            recordCoordinatorCall();
          }
          visualizationState._collapseContainerForCoordinator(containerId);
          if (debug) {
            console.log(`[ContainerOperationUtils] Container ${containerId} collapsed imperatively`);
          }
        } else {
          console.error('[ContainerOperationUtils] _collapseContainerForCoordinator method not available');
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, { error: '_collapseContainerForCoordinator not available' });
          }
          return false;
        }
      } else {
        // Use the coordinator method for expand
        if (visualizationState._expandContainerForCoordinator) {
          // Record coordinator call for performance monitoring
          if (enablePerformanceMonitoring) {
            recordCoordinatorCall();
          }
          visualizationState._expandContainerForCoordinator(containerId);
          if (debug) {
            console.log(`[ContainerOperationUtils] Container ${containerId} expanded imperatively`);
          }
        } else {
          console.error('[ContainerOperationUtils] _expandContainerForCoordinator method not available');
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, { error: '_expandContainerForCoordinator not available' });
          }
          return false;
        }
      }
      
      // End performance monitoring on success
      if (enablePerformanceMonitoring) {
        globalOperationMonitor.endOperation(operation, { success: true, targetCollapsed });
      }
      return true;
    } catch (error) {
      console.error(`[ContainerOperationUtils] Error toggling container ${containerId}:`, error);
      if (enablePerformanceMonitoring) {
        globalOperationMonitor.endOperation(operation, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      return false;
    }
  };

  // Execute with or without debouncing
  if (debounce) {
    const key = debounceKey || containerId;
    containerDebouncer.debounce(key, performOperation);
    // For debounced operations, end monitoring immediately with debounce flag
    if (enablePerformanceMonitoring) {
      globalOperationMonitor.endOperation(operation, { debounced: true });
    }
    return true; // Assume success for debounced operations
  } else {
    return performOperation();
  }
}

/**
 * Expand container imperatively
 */
export function expandContainerImperatively(options: {
  containerId: string;
  visualizationState?: VisualizationState;
  debounce?: boolean;
  debounceKey?: string;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  return toggleContainerImperatively({
    ...options,
    forceExpanded: true
  });
}

/**
 * Collapse container imperatively
 */
export function collapseContainerImperatively(options: {
  containerId: string;
  visualizationState?: VisualizationState;
  debounce?: boolean;
  debounceKey?: string;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  return toggleContainerImperatively({
    ...options,
    forceCollapsed: true
  });
}

/**
 * Batch container operations imperatively
 * 
 * Useful for bulk operations like expand all / collapse all
 */
export function batchContainerOperationsImperatively(options: {
  operations: Array<{
    containerId: string;
    operation: 'expand' | 'collapse' | 'toggle';
  }>;
  visualizationState?: VisualizationState;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): { success: number; failed: number; errors: string[] } {
  const { operations, visualizationState, debug = false, enablePerformanceMonitoring = true } = options;

  // Start performance monitoring for batch operation
  const batchOperation: OperationType = 'container_batch';
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(batchOperation, { 
      operationCount: operations.length,
      operationTypes: operations.map(op => op.operation)
    });
  }
  
  if (debug) {
    console.log('[ContainerOperationUtils] Starting batch container operations', {
      operationCount: operations.length
    });
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  if (!visualizationState) {
    results.errors.push('VisualizationState is required');
    results.failed = operations.length;
    return results;
  }

  for (const { containerId, operation } of operations) {
    try {
      let success = false;
      
      switch (operation) {
        case 'expand':
          success = expandContainerImperatively({
            containerId,
            visualizationState,
            debug,
            enablePerformanceMonitoring: false // Disable individual monitoring in batch
          });
          break;
        case 'collapse':
          success = collapseContainerImperatively({
            containerId,
            visualizationState,
            debug,
            enablePerformanceMonitoring: false // Disable individual monitoring in batch
          });
          break;
        case 'toggle':
          success = toggleContainerImperatively({
            containerId,
            visualizationState,
            debug,
            enablePerformanceMonitoring: false // Disable individual monitoring in batch
          });
          break;
        default:
          results.errors.push(`Unknown operation: ${operation} for container ${containerId}`);
          results.failed++;
          continue;
      }

      if (success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`Failed to ${operation} container ${containerId}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Error ${operation} container ${containerId}: ${error}`);
    }
  }

  if (debug) {
    console.log('[ContainerOperationUtils] Batch operations completed', results);
  }

  // End performance monitoring for batch operation
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.endOperation(batchOperation, { 
      success: results.success,
      failed: results.failed,
      totalOperations: operations.length
    });
  }

  return results;
}

/**
 * Clear all debounced container operations
 * 
 * Useful for cleanup or when you need immediate execution
 */
export function clearContainerOperationDebouncing(containerId?: string): void {
  containerDebouncer.clear(containerId);
}

/**
 * Pattern for avoiding ResizeObserver loops in container operations
 * 
 * Key principles:
 * 1. Use imperative operations for VisualizationState manipulation
 * 2. Avoid AsyncCoordinator calls during UI interactions
 * 3. Use debouncing for rapid operations
 * 4. Prefer direct state manipulation over complex async coordination
 */
export const CONTAINER_OPERATION_PATTERN = {
  DO: [
    "Use _expandContainerForCoordinator() and _collapseContainerForCoordinator() for direct state changes",
    "Debounce rapid container toggle operations",
    "Use synchronous operations for UI interactions",
    "Batch multiple operations when possible"
  ],
  DONT: [
    "Call AsyncCoordinator.expandContainer() or AsyncCoordinator.collapseContainer() during UI interactions",
    "Trigger layout operations during rapid interactions",
    "Use async/await for simple container state changes",
    "Create cascading container operation chains"
  ]
} as const;

// Export performance monitoring utilities for container operations
export {
  globalOperationMonitor as containerOperationMonitor,
  recordCoordinatorCall,
  monitorOperation,
  measureOperationPerformance,
  type OperationType,
  type OperationMetrics
} from "./operationPerformanceMonitor.js";