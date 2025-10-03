/**
 * @hydro-project/hydroscope - Interactive Graph Visualization for Hydro
 *
 * Simple, focused API for graph visualization components.
 */

// 🎯 CORE COMPONENTS
export { Hydroscope } from "./components/Hydroscope.js";
export { HydroscopeViewer } from "./components/HydroscopeViewer.js";
export { HydroscopeCore } from "./components/HydroscopeCoreNew.js";

// 🔧 ADVANCED COMPONENTS (for power users)
export { InfoPanel, StyleTuner } from "./components/panels/index.js";

// 📝 ESSENTIAL TYPES
export type { HydroscopeProps, RenderConfig } from "./components/Hydroscope.js";
export type { HydroscopeViewerProps } from "./components/HydroscopeViewer.js";
export type { HydroscopeCoreProps } from "./components/HydroscopeCoreNew.js";
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
