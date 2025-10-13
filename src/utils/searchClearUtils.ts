/**
 * @fileoverview Search Clear Utilities
 * 
 * Provides imperative search clearing operations that avoid React re-render cascades
 * and ResizeObserver loops by using direct DOM manipulation and minimal state updates.
 */

/**
 * Clear search imperatively without triggering AsyncCoordinator cascades
 * 
 * This utility implements the pattern we discovered for avoiding ResizeObserver loops:
 * 1. Clear VisualizationState directly (imperative)
 * 2. Clear DOM input directly (imperative) 
 * 3. Update React state minimally (batched)
 * 4. Avoid callbacks that trigger coordination systems
 */
export function clearSearchImperatively(options: {
  visualizationState?: any;
  inputRef?: React.RefObject<HTMLInputElement>;
  setQuery?: (query: string) => void;
  setMatches?: (matches: any[]) => void;
  setCurrentIndex?: (index: number) => void;
  clearTimer?: () => void;
  debug?: boolean;
}): void {
  const {
    visualizationState,
    inputRef,
    setQuery,
    setMatches,
    setCurrentIndex,
    clearTimer,
    debug = false
  } = options;

  if (debug) {
    console.log('[SearchClearUtils] Starting imperative search clear');
  }

  // 1. Clear any pending timers
  if (clearTimer) {
    clearTimer();
  }

  // 2. Clear VisualizationState directly (imperative)
  if (visualizationState && visualizationState.clearSearchEnhanced) {
    try {
      visualizationState.clearSearchEnhanced();
      if (debug) {
        console.log('[SearchClearUtils] VisualizationState cleared imperatively');
      }
    } catch (error) {
      console.error('[SearchClearUtils] VisualizationState clear failed:', error);
    }
  }

  // 3. Clear DOM input directly (imperative)
  if (inputRef?.current) {
    inputRef.current.value = "";
    if (debug) {
      console.log('[SearchClearUtils] Input cleared imperatively');
    }
  }

  // 4. Update React state minimally (React 18 will batch these automatically)
  if (setQuery) setQuery("");
  if (setMatches) setMatches([]);
  if (setCurrentIndex) setCurrentIndex(0);

  if (debug) {
    console.log('[SearchClearUtils] React state cleared imperatively');
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
  debug?: boolean;
}): void {
  const {
    setSearchQuery,
    setSearchMatches,
    setCurrentSearchMatch,
    debug = false
  } = options;

  if (debug) {
    console.log('[SearchClearUtils] Starting imperative panel clear');
  }

  // Update React state minimally (React 18 will batch these automatically)
  if (setSearchQuery) setSearchQuery("");
  if (setSearchMatches) setSearchMatches([]);
  if (setCurrentSearchMatch) setCurrentSearchMatch(undefined);

  if (debug) {
    console.log('[SearchClearUtils] Panel state cleared imperatively');
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
    "Use synchronous operations"
  ],
  DONT: [
    "Call AsyncCoordinator during UI operations",
    "Trigger parent callbacks (onClear, onSearch, onSearchUpdate)",
    "Use async/await for simple UI state changes",
    "Create cascading state update chains"
  ]
} as const;