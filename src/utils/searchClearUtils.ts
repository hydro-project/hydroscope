/**
 * @fileoverview Search Clear Utilities
 *
 * Provides imperative search clearing operations that avoid React re-render cascades
 * and ResizeObserver loops by using direct DOM manipulation and minimal state updates.
 */

import { hscopeLogger } from "./logger.js";
import {
  globalOperationMonitor,
  recordDOMUpdate,
  type OperationType,
} from "./operationPerformanceMonitor.js";
import { withResizeObserverErrorSuppression } from "./ResizeObserverErrorSuppression.js";

/**
 * Clear search imperatively using AsyncCoordinator for proper coordination
 *
 * IMPORTANT: This MUST use AsyncCoordinator to ensure ReactFlow data is regenerated
 * after clearing search highlights. Direct calls to clearSearchEnhanced will not
 * update the graph visualization.
 *
 * This utility implements the pattern:
 * 1. Use AsyncCoordinator.clearSearch() to coordinate the operation
 * 2. Clear DOM input directly (imperative)
 * 3. Update React state minimally (batched)
 */
export function clearSearchImperatively(options: {
  visualizationState?: any;
  asyncCoordinator?: any;
  inputRef?: React.RefObject<HTMLInputElement>;
  setQuery?: (query: string) => void;
  setMatches?: (matches: any[]) => void;
  setCurrentIndex?: (index: number) => void;
  clearTimer?: () => void;
  suppressResizeObserver?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): void {
  const {
    visualizationState,
    asyncCoordinator,
    inputRef,
    setQuery,
    setMatches,
    setCurrentIndex,
    clearTimer,
    suppressResizeObserver = true,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "search_clear";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      hasVisualizationState: !!visualizationState,
      hasAsyncCoordinator: !!asyncCoordinator,
      hasInputRef: !!inputRef,
      hasSetters: !!(setQuery && setMatches && setCurrentIndex),
    });
  }

  if (debug) {
    hscopeLogger.log(
      "op",
      "[SearchClearUtils] Starting imperative search clear",
    );
  }

  // Define the search clear operation
  const performSearchClear = () => {
    // 1. Clear any pending timers
    if (clearTimer) {
      clearTimer();
    }

    // 2. Use AsyncCoordinator for coordinated clear (REQUIRED for proper ReactFlow update)
    if (!asyncCoordinator || !visualizationState) {
      if (debug) {
        console.warn(
          "[SearchClearUtils] AsyncCoordinator and VisualizationState not provided - skipping graph highlight clearing",
          {
            hasAsyncCoordinator: !!asyncCoordinator,
            hasVisualizationState: !!visualizationState,
          },
        );
      }
      // Continue with DOM and React state clearing even without AsyncCoordinator
    } else {
      try {
        // Use AsyncCoordinator to ensure ReactFlow data is regenerated
        // IMPORTANT: Don't await here to prevent blocking the UI, but ensure the promise is handled
        asyncCoordinator
          .clearSearch(visualizationState, {
            fitView: false,
          })
          .then((reactFlowData: any) => {
            if (debug) {
              hscopeLogger.log(
                "op",
                "[SearchClearUtils] ✅ Search cleared successfully, ReactFlow data regenerated",
                {
                  nodeCount: reactFlowData?.nodes?.length || 0,
                  edgeCount: reactFlowData?.edges?.length || 0,
                },
              );
            }
          })
          .catch((error: any) => {
            console.error(
              "[SearchClearUtils] AsyncCoordinator clear failed:",
              error,
            );
          });
        if (debug) {
          hscopeLogger.log(
            "op",
            "[SearchClearUtils] Search clear requested via AsyncCoordinator",
          );
        }
      } catch (error) {
        console.error(
          "[SearchClearUtils] AsyncCoordinator clear failed:",
          error,
        );
      }
    }

    // 3. Clear DOM input directly (imperative)
    if (inputRef?.current) {
      // Record DOM update for performance monitoring
      if (enablePerformanceMonitoring) {
        recordDOMUpdate();
      }
      inputRef.current.value = "";
      if (debug) {
        hscopeLogger.log("op", "[SearchClearUtils] Input cleared imperatively");
      }
    }

    // 4. Update React state minimally (React 18 will batch these automatically)
    if (setQuery) setQuery("");
    if (setMatches) setMatches([]);
    if (setCurrentIndex) setCurrentIndex(0);

    if (debug) {
      hscopeLogger.log(
        "op",
        "[SearchClearUtils] React state cleared imperatively",
      );
    }

    // End performance monitoring
    if (enablePerformanceMonitoring) {
      globalOperationMonitor.endOperation(operation, {
        success: true,
        clearedVisualizationState: !!visualizationState,
        clearedDOM: !!inputRef?.current,
        clearedReactState: !!(setQuery && setMatches && setCurrentIndex),
      });
    }
  };

  // Use ResizeObserver error suppression if enabled
  if (suppressResizeObserver) {
    withResizeObserverErrorSuppression(performSearchClear)();
  } else {
    performSearchClear();
  }
}

/**
 * Clear search panel state imperatively
 *
 * For use in parent components like InfoPanel
 */
export function clearSearchPanelImperatively(options: {
  setSearchQuery?: (query: string) => void;
  setSearchMatches?: (matches: any[]) => void;
  setCurrentSearchMatch?: (match: any) => void;
  suppressResizeObserver?: boolean;
  debug?: boolean;
  enablePerformanceMonitoring?: boolean;
}): void {
  const {
    setSearchQuery,
    setSearchMatches,
    setCurrentSearchMatch,
    suppressResizeObserver = true,
    debug = false,
    enablePerformanceMonitoring = true,
  } = options;

  // Start performance monitoring
  const operation: OperationType = "search_panel_clear";
  if (enablePerformanceMonitoring) {
    globalOperationMonitor.startOperation(operation, {
      hasSetters: !!(
        setSearchQuery &&
        setSearchMatches &&
        setCurrentSearchMatch
      ),
    });
  }

  if (debug) {
    hscopeLogger.log(
      "op",
      "[SearchClearUtils] Starting imperative panel clear",
    );
  }

  // Define the panel clear operation
  const performPanelClear = () => {
    // Update React state minimally (React 18 will batch these automatically)
    if (setSearchQuery) setSearchQuery("");
    if (setSearchMatches) setSearchMatches([]);
    if (setCurrentSearchMatch) setCurrentSearchMatch(undefined);

    if (debug) {
      hscopeLogger.log(
        "op",
        "[SearchClearUtils] Panel state cleared imperatively",
      );
    }

    // End performance monitoring
    if (enablePerformanceMonitoring) {
      globalOperationMonitor.endOperation(operation, {
        success: true,
        clearedReactState: !!(
          setSearchQuery &&
          setSearchMatches &&
          setCurrentSearchMatch
        ),
      });
    }
  };

  // Use ResizeObserver error suppression if enabled
  if (suppressResizeObserver) {
    withResizeObserverErrorSuppression(performPanelClear)();
  } else {
    performPanelClear();
  }
}

/**
 * Pattern for avoiding ResizeObserver loops in UI operations
 *
 * Key principles:
 * 1. Use imperative operations for external state (VisualizationState, DOM)
 * 2. Minimize React state updates (let React batch them)
 * 3. Avoid callbacks that trigger coordination systems (AsyncCoordinator)
 * 4. Prefer direct manipulation over complex async coordination
 */
export const SEARCH_CLEAR_PATTERN = {
  DO: [
    "Clear external state imperatively (VisualizationState.clearSearchEnhanced())",
    "Clear DOM directly (inputRef.current.value = '')",
    "Update React state minimally (let React batch setState calls)",
    "Use synchronous operations",
  ],
  DONT: [
    "Call AsyncCoordinator during UI operations",
    "Trigger parent callbacks (onClear, onSearch, onSearchUpdate)",
    "Use async/await for simple UI state changes",
    "Create cascading state update chains",
  ],
} as const;

// Export performance monitoring utilities for search operations
export {
  globalOperationMonitor as searchOperationMonitor,
  recordDOMUpdate,
  monitorOperation,
  measureOperationPerformance,
  type OperationType,
  type OperationMetrics,
} from "./operationPerformanceMonitor.js";
