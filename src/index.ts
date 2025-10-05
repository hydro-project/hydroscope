/**
 * @hydro-project/hydroscope - Interactive Graph Visualization for Hydro
 *
 * Simple, focused API for graph visualization components.
 */

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
