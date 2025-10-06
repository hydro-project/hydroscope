/**
 * Components Index - Simplified exports for public API
 */

// Main Components
export {
  Hydroscope,
  type HydroscopeProps,
  type RenderConfig,
} from "./Hydroscope.js";

export { HydroscopeCore, type HydroscopeCoreProps } from "./HydroscopeCore.js";

// Panel Components (for advanced users)
export {
  InfoPanel,
  type InfoPanelProps,
  type InfoPanelRef,
  StyleTuner,
  type StyleTunerProps,
  type StyleConfig,
  type LayoutAlgorithm,
  type ColorPaletteOption,
} from "./panels/index.js";
