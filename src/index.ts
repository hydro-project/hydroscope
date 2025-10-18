/**
 * @hydro-project/hydroscope - Interactive Graph Visualization for Hydro
 *
 * Simple, focused API for graph visualization components.
 */

// ⚠️ CRITICAL: Install ResizeObserver error suppression IMMEDIATELY
// This must be the very first thing that runs when the library loads
if (typeof window !== "undefined") {
  const resizeObserverPatterns = [
    /ResizeObserver loop limit exceeded/i,
    /ResizeObserver loop completed with undelivered notifications/i,
    /ResizeObserver loop/i,
  ];

  const originalError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const errorStr = String(message || error || "");
    if (resizeObserverPatterns.some((p) => p.test(errorStr))) {
      return true; // Suppress
    }
    return originalError
      ? originalError(message, source, lineno, colno, error)
      : false;
  };

  // Also suppress via error event listener (for webpack-dev-server)
  window.addEventListener(
    "error",
    (e) => {
      const errorStr = String(e.message || e.error || "");
      if (resizeObserverPatterns.some((p) => p.test(errorStr))) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  ); // Use capture phase to intercept before webpack
}

// 🎯 CORE COMPONENTS
export { Hydroscope } from "./components/Hydroscope.js";
export { HydroscopeCore } from "./components/HydroscopeCore.js";
// 🔧 ADVANCED COMPONENTS (for power users)
export { InfoPanel, StyleTuner } from "./components/panels/index.js";
// 📝 ESSENTIAL TYPES
export type { HydroscopeProps, RenderConfig } from "./components/Hydroscope.js";
export type { HydroscopeCoreProps } from "./components/HydroscopeCore.js";
export type { HydroscopeData } from "./types/core.js";
export type {
  InfoPanelProps,
  StyleTunerProps,
  StyleConfig,
  LayoutAlgorithm,
  ColorPaletteOption,
} from "./components/panels/index.js";
// 🛠️ UTILITIES (for advanced use cases)
export { parseDataFromUrl } from "./utils/urlParser.js";
export { decompressData } from "./utils/compression.js";
export {
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression,
  DebouncedOperationManager,
  withResizeObserverErrorSuppression,
  withAsyncResizeObserverErrorSuppression,
  useResizeObserverErrorSuppression,
  withDOMResizeObserverErrorSuppression,
  withLayoutResizeObserverErrorSuppression,
  withStyleResizeObserverErrorSuppression,
  withContainerResizeObserverErrorSuppression,
  withSearchResizeObserverErrorSuppression,
  withBatchResizeObserverErrorSuppression,
} from "./utils/ResizeObserverErrorSuppression.js";
export {
  clearSearchImperatively,
  clearSearchPanelImperatively,
  SEARCH_CLEAR_PATTERN,
} from "./utils/searchClearUtils.js";
