/**
 * @fileoverview Panel Operation Utilities
 * 
 * Provides imperative panel operation functions that avoid React re-render cascades
 * and ResizeObserver loops by using direct state manipulation and minimal
 * coordination system usage.
 * 
 * This follows the same pattern established in searchClearUtils.ts and containerOperationUtils.ts
 * for avoiding ResizeObserver loops and coordination cascades.
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import { 
  globalOperationMonitor, 
  recordDOMUpdate,
  type OperationType 
} from "./operationPerformanceMonitor.js";
import {
  withResizeObserverErrorSuppression,
  withAsyncResizeObserverErrorSuppression
} from "./ResizeObserverErrorSuppression.js";

/**
 * Panel operation types supported by the utilities
 */
export type PanelOperation = 'expand' | 'collapse' | 'toggle';

/**
 * Panel section identifiers for InfoPanel
 */
export type InfoPanelSection = 'legend' | 'grouping' | 'edgeStyles';

/**
 * Style operation types for StyleTuner
 */
export type StyleOperation = 'layout' | 'colorPalette' | 'edgeStyle' | 'reset';

/**
 * Debounce utility for rapid panel operations
 */
class PanelOperationDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly delay: number;

  constructor(delay: number = 100) {
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

// Global debouncer instance for panel operations
const panelDebouncer = new PanelOperationDebouncer();

/**
 * Toggle panel imperatively without triggering coordination cascades
 * 
 * This utility implements the pattern for avoiding ResizeObserver loops:
 * 1. Manipulate panel state directly (imperative)
 * 2. Avoid callbacks that trigger coordination systems
 * 3. Use synchronous operations
 * 4. Provide debouncing for rapid operations
 */
export function togglePanelImperatively(options: {
  panelId: string;
  operation?: PanelOperation;
  setState?: (collapsed: boolean) => void;
  currentState?: boolean; // Current collapsed state
  debounce?: boolean;
  debounceKey?: string;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  const {
    panelId,
    operation = 'toggle',
    setState,
    currentState = false,
    debounce = false,
    debounceKey,
    debug = false,
    enablePerformanceMonitoring = true
  } = options;

  // Start performance monitoring
  const monitoringOperation: OperationType = `panel_${operation}` as OperationType;
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(monitoringOperation, { 
      panelId, 
      operation, 
      currentState, 
      debounce 
    });
  }

  if (debug) {
    console.log('[PanelOperationUtils] Starting imperative panel toggle', {
      panelId,
      operation,
      currentState,
      debounce
    });
  }

  // Validate inputs
  if (!panelId) {
    console.error('[PanelOperationUtils] Panel ID is required');
    return false;
  }

  if (!setState) {
    console.error('[PanelOperationUtils] setState function is required');
    return false;
  }

  // Determine target state
  let targetCollapsed: boolean;
  switch (operation) {
    case 'expand':
      targetCollapsed = false;
      break;
    case 'collapse':
      targetCollapsed = true;
      break;
    case 'toggle':
    default:
      targetCollapsed = !currentState;
      break;
  }

  // Skip if already in target state
  if (currentState === targetCollapsed) {
    if (debug) {
      console.log(`[PanelOperationUtils] Panel ${panelId} already in target state`);
    }
    return true;
  }

  // Define the operation function
  const performOperation = () => {
    try {
      // Use requestAnimationFrame to batch DOM updates and avoid ResizeObserver loops
      requestAnimationFrame(() => {
        // Record DOM update for performance monitoring
        if (enablePerformanceMonitoring) {
          recordDOMUpdate();
        }
        setState(targetCollapsed);
        if (debug) {
          console.log(`[PanelOperationUtils] Panel ${panelId} ${targetCollapsed ? 'collapsed' : 'expanded'} imperatively`);
        }
        // End performance monitoring on success
        if (enablePerformanceMonitoring) {
          globalOperationMonitor.endOperation(monitoringOperation, { 
            success: true, 
            targetCollapsed 
          });
        }
      });
      return true;
    } catch (error) {
      console.error(`[PanelOperationUtils] Error toggling panel ${panelId}:`, error);
      if (enablePerformanceMonitoring) {
        globalOperationMonitor.endOperation(monitoringOperation, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      return false;
    }
  };

  // Execute with or without debouncing
  if (debounce) {
    const key = debounceKey || panelId;
    panelDebouncer.debounce(key, performOperation);
    // For debounced operations, end monitoring immediately with debounce flag
    if (enablePerformanceMonitoring) {
      globalOperationMonitor.endOperation(monitoringOperation, { debounced: true });
    }
    return true; // Assume success for debounced operations
  } else {
    return performOperation();
  }
}

/**
 * Expand panel imperatively
 */
export function expandPanelImperatively(options: {
  panelId: string;
  setState?: (collapsed: boolean) => void;
  currentState?: boolean;
  debounce?: boolean;
  debounceKey?: string;
  debug?: boolean;
}): boolean {
  return togglePanelImperatively({
    ...options,
    operation: 'expand'
  });
}

/**
 * Collapse panel imperatively
 */
export function collapsePanelImperatively(options: {
  panelId: string;
  setState?: (collapsed: boolean) => void;
  currentState?: boolean;
  debounce?: boolean;
  debounceKey?: string;
  debug?: boolean;
}): boolean {
  return togglePanelImperatively({
    ...options,
    operation: 'collapse'
  });
}

/**
 * Batch panel operations imperatively
 * 
 * Useful for coordinating multiple panel state changes
 */
export function batchPanelOperationsImperatively(options: {
  operations: Array<{
    panelId: string;
    operation: PanelOperation;
    setState: (collapsed: boolean) => void;
    currentState: boolean;
  }>;
  debug?: boolean;
}): { success: number; failed: number; errors: string[] } {
  const { operations, debug = false } = options;
  
  if (debug) {
    console.log('[PanelOperationUtils] Starting batch panel operations', {
      operationCount: operations.length
    });
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  // Use requestAnimationFrame to batch all operations
  requestAnimationFrame(() => {
    for (const { panelId, operation, setState, currentState } of operations) {
      try {
        const success = togglePanelImperatively({
          panelId,
          operation,
          setState,
          currentState,
          debug
        });

        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to ${operation} panel ${panelId}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error ${operation} panel ${panelId}: ${error}`);
      }
    }

    if (debug) {
      console.log('[PanelOperationUtils] Batch operations completed', results);
    }
  });

  return results;
}

/**
 * Handle style changes imperatively without coordination cascades
 * 
 * This utility avoids triggering AsyncCoordinator cascades during style operations
 */
export function changeStyleImperatively(options: {
  styleType: StyleOperation;
  value: string | number | boolean;
  visualizationState?: VisualizationState;
  onStyleChange?: (styleType: StyleOperation, value: any) => void;
  suppressResizeObserver?: boolean;
  debug?: boolean;
}): boolean {
  const {
    styleType,
    value,
    visualizationState,
    onStyleChange,
    suppressResizeObserver = true,
    debug = false
  } = options;

  if (debug) {
    console.log('[PanelOperationUtils] Starting imperative style change', {
      styleType,
      value,
      suppressResizeObserver
    });
  }

  // Define the operation function
  const performStyleChange = () => {
    // Use requestAnimationFrame to batch style updates and avoid ResizeObserver loops
    requestAnimationFrame(() => {
      try {
        if (onStyleChange) {
          onStyleChange(styleType, value);
        }
        
        if (debug) {
          console.log(`[PanelOperationUtils] Style ${styleType} changed to ${value} imperatively`);
        }
      } catch (error) {
        console.error(`[PanelOperationUtils] Error changing style ${styleType}:`, error);
      }
    });
    // Always return true since errors are handled asynchronously in requestAnimationFrame
    return true;
  };

  // Use centralized ResizeObserver error suppression
  if (suppressResizeObserver) {
    return withResizeObserverErrorSuppression(performStyleChange)();
  }

  return performStyleChange();
}

/**
 * Handle layout algorithm changes imperatively
 */
export function changeLayoutImperatively(options: {
  algorithm: string;
  visualizationState?: VisualizationState;
  onLayoutChange?: (algorithm: string) => void;
  debug?: boolean;
}): boolean {
  return changeStyleImperatively({
    styleType: 'layout',
    value: options.algorithm,
    visualizationState: options.visualizationState,
    onStyleChange: (_, value) => options.onLayoutChange?.(value as string),
    debug: options.debug
  });
}

/**
 * Handle color palette changes imperatively
 */
export function changeColorPaletteImperatively(options: {
  palette: string;
  visualizationState?: VisualizationState;
  onPaletteChange?: (palette: string) => void;
  debug?: boolean;
}): boolean {
  return changeStyleImperatively({
    styleType: 'colorPalette',
    value: options.palette,
    visualizationState: options.visualizationState,
    onStyleChange: (_, value) => options.onPaletteChange?.(value as string),
    debug: options.debug
  });
}

/**
 * Handle edge style changes imperatively
 */
export function changeEdgeStyleImperatively(options: {
  edgeStyle: 'bezier' | 'straight' | 'smoothstep';
  visualizationState?: VisualizationState;
  onEdgeStyleChange?: (edgeStyle: 'bezier' | 'straight' | 'smoothstep') => void;
  debug?: boolean;
}): boolean {
  return changeStyleImperatively({
    styleType: 'edgeStyle',
    value: options.edgeStyle,
    visualizationState: options.visualizationState,
    onStyleChange: (_, value) => options.onEdgeStyleChange?.(value as 'bezier' | 'straight' | 'smoothstep'),
    debug: options.debug
  });
}

/**
 * Clear all debounced panel operations
 * 
 * Useful for cleanup or when you need immediate execution
 */
export function clearPanelOperationDebouncing(panelId?: string): void {
  panelDebouncer.clear(panelId);
}

/**
 * Pattern for avoiding ResizeObserver loops in panel operations
 * 
 * Key principles:
 * 1. Use imperative operations for panel state manipulation
 * 2. Avoid AsyncCoordinator calls during UI interactions
 * 3. Use requestAnimationFrame for batching DOM updates
 * 4. Suppress ResizeObserver errors during style changes
 * 5. Prefer direct state manipulation over complex async coordination
 */
export const PANEL_OPERATION_PATTERN = {
  DO: [
    "Use setState() directly for panel collapse/expand operations",
    "Batch operations with requestAnimationFrame to avoid ResizeObserver loops",
    "Use debouncing for rapid panel toggle operations",
    "Suppress ResizeObserver errors during style changes",
    "Use synchronous operations for UI interactions"
  ],
  DONT: [
    "Call AsyncCoordinator during panel toggle operations",
    "Trigger layout operations during rapid interactions",
    "Use async/await for simple panel state changes",
    "Create cascading panel operation chains",
    "Allow ResizeObserver errors to propagate during style changes"
  ]
} as const;

// Export performance monitoring utilities for panel operations
export {
  globalOperationMonitor as panelOperationMonitor,
  recordDOMUpdate,
  monitorOperation,
  measureOperationPerformance,
  type OperationType,
  type OperationMetrics
} from "./operationPerformanceMonitor.js";