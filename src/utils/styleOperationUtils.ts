/**
 * @fileoverview Style Operation Utilities
 *
 * Provides imperative style operation functions that avoid React re-render cascades
 * and ResizeObserver loops by using direct state manipulation and minimal
 * coordination system usage.
 *
 * This follows the same pattern established in searchClearUtils.ts, containerOperationUtils.ts,
 * and panelOperationUtils.ts for avoiding ResizeObserver loops and coordination cascades.
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import {
  globalOperationMonitor,
  recordDOMUpdate,
  type OperationType,
} from "./operationPerformanceMonitor.js";
import { withResizeObserverErrorSuppression } from "./ResizeObserverErrorSuppression.js";

/**
 * Style operation types supported by the utilities
 */
export type StyleOperationType =
  | "layout"
  | "colorPalette"
  | "edgeStyle"
  | "reset";

/**
 * Edge style types
 */
export type EdgeStyleKind = "bezier" | "straight" | "smoothstep";

/**
 * Style change options
 */
export interface StyleChangeOptions {
  styleType: StyleOperationType;
  value: string | EdgeStyleKind | boolean | number;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debug?: boolean;
}

/**
 * Debounce utility for rapid style operations
 */
class StyleOperationDebouncer {
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
      this.timers.forEach((timer) => clearTimeout(timer));
      this.timers.clear();
    }
  }
}

// Global debouncer instance for style operations
const styleDebouncer = new StyleOperationDebouncer();

/**
 * Change layout algorithm imperatively without coordination cascades
 *
 * This utility implements the pattern for avoiding ResizeObserver loops:
 * 1. Use requestAnimationFrame for batching DOM updates
 * 2. Suppress ResizeObserver errors during layout changes
 * 3. Avoid AsyncCoordinator calls during UI interactions
 * 4. Use synchronous operations where possible
 */
export function changeLayoutImperatively(options: {
  algorithm: string;
  onLayoutChange?: (algorithm: string) => void;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debounce?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  const {
    algorithm,
    onLayoutChange,
    visualizationState: _visualizationState,
    suppressResizeObserver = true,
    debounce = false,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "style_layout";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      algorithm,
      suppressResizeObserver,
      debounce,
    });
  }

  if (debug) {
    console.log("[StyleOperationUtils] Starting imperative layout change", {
      algorithm,
      suppressResizeObserver,
      debounce,
    });
  }

  // Validate inputs
  if (!algorithm) {
    console.error("[StyleOperationUtils] Algorithm is required");
    return false;
  }

  // Define the operation function
  const performOperation = () => {
    const layoutOperation = () => {
      const executeCallback = () => {
        try {
          // Record DOM update for performance monitoring
          if (enablePerformanceMonitoring) {
            recordDOMUpdate();
          }
          if (onLayoutChange) {
            onLayoutChange(algorithm);
          }

          if (debug) {
            console.log(
              `[StyleOperationUtils] Layout algorithm changed to ${algorithm} imperatively`,
            );
          }

          // End performance monitoring on success
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              success: true,
              algorithm,
            });
          }
        } catch (error) {
          console.error(
            `[StyleOperationUtils] Error changing layout algorithm to ${algorithm}:`,
            error,
          );
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      };

      // In test environment, execute synchronously for predictable testing
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
        executeCallback();
      } else {
        // Use requestAnimationFrame to batch DOM updates and avoid ResizeObserver loops
        requestAnimationFrame(executeCallback);
      }
      return true;
    };

    if (suppressResizeObserver) {
      withResizeObserverErrorSuppression(layoutOperation)();
    } else {
      layoutOperation();
    }

    return true;
  };

  // Execute with or without debouncing
  if (debounce) {
    styleDebouncer.debounce("layout", performOperation);
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
 * Change color palette imperatively without coordination cascades
 */
export function changeColorPaletteImperatively(options: {
  palette: string;
  onPaletteChange?: (palette: string) => void;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debounce?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  const {
    palette,
    onPaletteChange,
    visualizationState: _visualizationState,
    suppressResizeObserver = true,
    debounce = false,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "style_color_palette";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      palette,
      suppressResizeObserver,
      debounce,
    });
  }

  if (debug) {
    console.log(
      "[StyleOperationUtils] Starting imperative color palette change",
      {
        palette,
        suppressResizeObserver,
        debounce,
      },
    );
  }

  // Validate inputs
  if (!palette) {
    console.error("[StyleOperationUtils] Palette is required");
    return false;
  }

  // Define the operation function
  const performOperation = () => {
    const paletteOperation = () => {
      const executeCallback = () => {
        try {
          // Record DOM update for performance monitoring
          if (enablePerformanceMonitoring) {
            recordDOMUpdate();
          }
          if (onPaletteChange) {
            onPaletteChange(palette);
          }

          if (debug) {
            console.log(
              `[StyleOperationUtils] Color palette changed to ${palette} imperatively`,
            );
          }

          // End performance monitoring on success
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              success: true,
              palette,
            });
          }
        } catch (error) {
          console.error(
            `[StyleOperationUtils] Error changing color palette to ${palette}:`,
            error,
          );
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      };

      // In test environment, execute synchronously for predictable testing
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
        executeCallback();
      } else {
        // Use requestAnimationFrame to batch DOM updates and avoid ResizeObserver loops
        requestAnimationFrame(executeCallback);
      }
      return true;
    };

    if (suppressResizeObserver) {
      withResizeObserverErrorSuppression(paletteOperation)();
    } else {
      paletteOperation();
    }

    return true;
  };

  // Execute with or without debouncing
  if (debounce) {
    styleDebouncer.debounce("colorPalette", performOperation);
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
 * Change edge style imperatively without coordination cascades
 */
export function changeEdgeStyleImperatively(options: {
  edgeStyle: EdgeStyleKind;
  onEdgeStyleChange?: (edgeStyle: EdgeStyleKind) => void;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debounce?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  const {
    edgeStyle,
    onEdgeStyleChange,
    visualizationState: _visualizationState,
    suppressResizeObserver = true,
    debounce = false,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "style_edge_style";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      edgeStyle,
      suppressResizeObserver,
      debounce,
    });
  }

  if (debug) {
    console.log("[StyleOperationUtils] Starting imperative edge style change", {
      edgeStyle,
      suppressResizeObserver,
      debounce,
    });
  }

  // Validate inputs
  if (!edgeStyle) {
    console.error("[StyleOperationUtils] Edge style is required");
    return false;
  }

  // Define the operation function
  const performOperation = () => {
    const edgeStyleOperation = () => {
      const executeCallback = () => {
        try {
          // Record DOM update for performance monitoring
          if (enablePerformanceMonitoring) {
            recordDOMUpdate();
          }
          if (onEdgeStyleChange) {
            onEdgeStyleChange(edgeStyle);
          }

          if (debug) {
            console.log(
              `[StyleOperationUtils] Edge style changed to ${edgeStyle} imperatively`,
            );
          }

          // End performance monitoring on success
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              success: true,
              edgeStyle,
            });
          }
        } catch (error) {
          console.error(
            `[StyleOperationUtils] Error changing edge style to ${edgeStyle}:`,
            error,
          );
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      };

      // In test environment, execute synchronously for predictable testing
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
        executeCallback();
      } else {
        // Use requestAnimationFrame to batch DOM updates and avoid ResizeObserver loops
        requestAnimationFrame(executeCallback);
      }
      return true;
    };

    if (suppressResizeObserver) {
      withResizeObserverErrorSuppression(edgeStyleOperation)();
    } else {
      edgeStyleOperation();
    }

    return true;
  };

  // Execute with or without debouncing
  if (debounce) {
    styleDebouncer.debounce("edgeStyle", performOperation);
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
 * Reset styles to defaults imperatively
 */
export function resetStylesImperatively(options: {
  onResetToDefaults?: () => void;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): boolean {
  const {
    onResetToDefaults,
    visualizationState: _visualizationState,
    suppressResizeObserver = true,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "style_reset";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      suppressResizeObserver,
    });
  }

  if (debug) {
    console.log("[StyleOperationUtils] Starting imperative style reset", {
      suppressResizeObserver,
    });
  }

  // Define the operation function
  const performOperation = () => {
    const resetOperation = () => {
      const executeCallback = () => {
        try {
          // Record DOM update for performance monitoring
          if (enablePerformanceMonitoring) {
            recordDOMUpdate();
          }
          if (onResetToDefaults) {
            onResetToDefaults();
          }

          if (debug) {
            console.log(
              "[StyleOperationUtils] Styles reset to defaults imperatively",
            );
          }

          // End performance monitoring on success
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              success: true,
            });
          }
        } catch (error) {
          console.error(
            "[StyleOperationUtils] Error resetting styles to defaults:",
            error,
          );
          if (enablePerformanceMonitoring) {
            globalOperationMonitor.endOperation(operation, {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      };

      // In test environment, execute synchronously for predictable testing
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
        executeCallback();
      } else {
        // Use requestAnimationFrame to batch DOM updates and avoid ResizeObserver loops
        requestAnimationFrame(executeCallback);
      }
      return true;
    };

    if (suppressResizeObserver) {
      withResizeObserverErrorSuppression(resetOperation)();
    } else {
      resetOperation();
    }

    return true;
  };

  return performOperation();
}

/**
 * Batch style operations imperatively
 *
 * Useful for coordinating multiple style changes
 */
export function batchStyleOperationsImperatively(options: {
  operations: Array<{
    type: "layout" | "colorPalette" | "edgeStyle" | "reset";
    value?: string | EdgeStyleKind;
    callback?: (value?: any) => void;
  }>;
  visualizationState?: VisualizationState;
  suppressResizeObserver?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): { success: number; failed: number; errors: string[] } {
  const {
    operations,
    visualizationState,
    suppressResizeObserver = true,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring for batch operation
  const batchOperation: OperationType = "style_batch";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(batchOperation, {
      operationCount: operations.length,
      operationTypes: operations.map((op) => op.type),
      suppressResizeObserver,
    });
  }

  if (debug) {
    console.log("[StyleOperationUtils] Starting batch style operations", {
      operationCount: operations.length,
      suppressResizeObserver,
    });
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Define the batch operation function
  const performBatchOperation = () => {
    // Process operations synchronously for immediate results tracking
    for (const { type, value, callback } of operations) {
      try {
        let success = false;

        switch (type) {
          case "layout":
            success = changeLayoutImperatively({
              algorithm: value as string,
              onLayoutChange: callback,
              visualizationState,
              suppressResizeObserver: false, // Already handled at batch level
              debug,
              enablePerformanceMonitoring: false, // Disable individual monitoring in batch
            });
            break;
          case "colorPalette":
            success = changeColorPaletteImperatively({
              palette: value as string,
              onPaletteChange: callback,
              visualizationState,
              suppressResizeObserver: false, // Already handled at batch level
              debug,
              enablePerformanceMonitoring: false, // Disable individual monitoring in batch
            });
            break;
          case "edgeStyle":
            success = changeEdgeStyleImperatively({
              edgeStyle: value as EdgeStyleKind,
              onEdgeStyleChange: callback,
              visualizationState,
              suppressResizeObserver: false, // Already handled at batch level
              debug,
              enablePerformanceMonitoring: false, // Disable individual monitoring in batch
            });
            break;
          case "reset":
            success = resetStylesImperatively({
              onResetToDefaults: callback,
              visualizationState,
              suppressResizeObserver: false, // Already handled at batch level
              debug,
              enablePerformanceMonitoring: false, // Disable individual monitoring in batch
            });
            break;
          default:
            results.errors.push(`Unknown operation type: ${type}`);
            results.failed++;
            continue;
        }

        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to execute ${type} operation`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error executing ${type} operation: ${error}`);
      }
    }

    if (debug) {
      console.log("[StyleOperationUtils] Batch operations completed", results);
    }

    // End performance monitoring for batch operation
    if (enablePerformanceMonitoring) {
      globalOperationMonitor.endOperation(batchOperation, {
        success: results.success,
        failed: results.failed,
        totalOperations: operations.length,
      });
    }
  };

  if (suppressResizeObserver) {
    withResizeObserverErrorSuppression(performBatchOperation)();
  } else {
    performBatchOperation();
  }

  return results;
}

/**
 * Clear all debounced style operations
 *
 * Useful for cleanup or when you need immediate execution
 */
export function clearStyleOperationDebouncing(operationType?: string): void {
  styleDebouncer.clear(operationType);
}

/**
 * Pattern for avoiding ResizeObserver loops in style operations
 *
 * Key principles:
 * 1. Use imperative operations for style changes
 * 2. Avoid AsyncCoordinator calls during UI interactions
 * 3. Use requestAnimationFrame for batching DOM updates
 * 4. Suppress ResizeObserver errors during style changes
 * 5. Prefer direct callback invocation over complex async coordination
 */
export const STYLE_OPERATION_PATTERN = {
  DO: [
    "Use requestAnimationFrame to batch DOM updates during style changes",
    "Suppress ResizeObserver errors during layout algorithm changes",
    "Use debouncing for rapid style toggle operations",
    "Call style change callbacks directly without coordination",
    "Use synchronous operations for UI interactions",
  ],
  DONT: [
    "Call AsyncCoordinator during style change operations",
    "Trigger layout operations during rapid interactions",
    "Use async/await for simple style changes",
    "Create cascading style operation chains",
    "Allow ResizeObserver errors to propagate during style changes",
  ],
} as const;

// Export performance monitoring utilities for style operations
export {
  globalOperationMonitor as styleOperationMonitor,
  recordDOMUpdate,
  monitorOperation,
  measureOperationPerformance,
  type OperationType,
  type OperationMetrics,
} from "./operationPerformanceMonitor.js";
