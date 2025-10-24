/**
 * @fileoverview Unified Configuration Exports
 *
 * Clean, modular configuration system for Hydroscope.
 * Each configuration domain is separated into its own module.
 */

// Core configuration domains
export * from "./layout.js";
export * from "./styling.js";
export * from "./ui.js";
export * from "./performance.js";
export * from "./search.js";

// Legacy compatibility - re-export commonly used constants
export {
  DEFAULT_RENDER_CONFIG,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_ELK_ALGORITHM,
  getELKLayoutOptions,
  createFixedPositionOptions,
  createFreePositionOptions,
} from "./layout.js";

export {
  NODE_STYLES,
  EDGE_STYLES,
  CONTAINER_STYLES,
  EDGE_STYLE_TAG_MAPPINGS,
  DEFAULT_COLOR_PALETTE,
  COLOR_PALETTES,
} from "./styling.js";

export {
  UI_CONSTANTS,
  PANEL_CONSTANTS,
  COMPONENT_COLORS,
  TYPOGRAPHY,
  SHADOWS,
} from "./ui.js";

export {
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
  NAVIGATION_HIGHLIGHT_COLORS,
  NAVIGATION_TIMING,
} from "./search.js";

// Type exports
export type {
  NodeStyle,
  EdgeStyle,
  ContainerStyle,
  EdgeStyleTagMapping,
} from "./styling.js";

export type { ELKAlgorithm } from "./layout.js";
