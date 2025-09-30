/**
 * Panels - Barrel export for standalone panel components
 *
 * This file provides easy importing of extracted panel components:
 * - InfoPanel: Search, hierarchy, and graph information
 * - StyleTuner: Real-time style configuration and layout controls
 */

export { InfoPanel } from "./InfoPanel.js";
export type {
  InfoPanelProps,
  InfoPanelRef,
  LegendData,
  LegendItem,
  EdgeStyleConfig,
  GroupingOption,
  SearchMatch,
} from "./InfoPanel.js";

export { StyleTuner } from "./StyleTuner.js";
export type {
  StyleTunerProps,
  StyleConfig,
  LayoutAlgorithm,
  ColorPaletteOption,
} from "./StyleTuner.js";
