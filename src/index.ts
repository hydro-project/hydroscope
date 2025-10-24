/**
 * @hydro-project/hydroscope - Interactive Graph Visualization for Hydro
 *
 * Simple, focused API for graph visualization components.
 */

// ⚠️ CRITICAL: Install ResizeObserver debouncing IMMEDIATELY
// This must be the very first thing that runs when the library loads
import { enableResizeObserverDebouncing } from "./utils/resizeObserverDebounce.js";

declare global {
  interface Window {
    hscopeLogger?: typeof import("./utils/logger").hscopeLogger;
  }
}

import { hscopeLogger } from "./utils/logger";
window.hscopeLogger = hscopeLogger;

if (typeof window !== "undefined") {
  // Enable ResizeObserver debouncing to prevent cascading loops at the source
  // This batches rapid ResizeObserver callbacks into single 16ms windows,
  // preventing the browser from exceeding its ResizeObserver limit
  enableResizeObserverDebouncing();
}

// 🎨 STYLES
import "./styles/dark-mode.css";

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
  enableResizeObserverDebouncing,
  disableResizeObserverDebouncing,
  isResizeObserverDebouncingEnabled,
} from "./utils/resizeObserverDebounce.js";
export {
  clearSearchImperatively,
  clearSearchPanelImperatively,
  SEARCH_CLEAR_PATTERN,
} from "./utils/searchClearUtils.js";
