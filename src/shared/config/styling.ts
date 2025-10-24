/**
 * @fileoverview Styling Configuration
 *
 * All styling-related constants including node/edge/container styles,
 * colors, edge style mappings, and visual appearance settings.
 */

// ============================================================================
// STYLE ENUMS
// ============================================================================

export const NODE_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  SELECTED: "selected",
  WARNING: "warning",
  ERROR: "error",
} as const;

export const EDGE_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  DASHED: "dashed",
  THICK: "thick",
  WARNING: "warning",
} as const;

export const CONTAINER_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  SELECTED: "selected",
  MINIMIZED: "minimized",
} as const;

export type NodeStyle = (typeof NODE_STYLES)[keyof typeof NODE_STYLES];
export type EdgeStyle = (typeof EDGE_STYLES)[keyof typeof EDGE_STYLES];
export type ContainerStyle =
  (typeof CONTAINER_STYLES)[keyof typeof CONTAINER_STYLES];

// ============================================================================
// COLOR PALETTES
// ============================================================================

export const DEFAULT_COLOR_PALETTE = "Set3";

export const COLOR_PALETTES = {
  Set3: [
    { primary: "#8dd3c7", secondary: "#ffffb3", name: "Light Teal" },
    { primary: "#bebada", secondary: "#fb8072", name: "Light Purple" },
    { primary: "#80b1d3", secondary: "#fdb462", name: "Light Blue" },
    { primary: "#fccde5", secondary: "#b3de69", name: "Light Pink" },
    { primary: "#d9d9d9", secondary: "#fccde5", name: "Light Gray" },
    { primary: "#bc80bd", secondary: "#ccebc5", name: "Medium Purple" },
    { primary: "#ccebc5", secondary: "#ffed6f", name: "Light Green" },
    { primary: "#ffed6f", secondary: "#8dd3c7", name: "Light Yellow" },
  ],
  Set2: [
    { primary: "#66c2a5", secondary: "#e0f2ef", name: "Teal Green" },
    { primary: "#fc8d62", secondary: "#ffe1d6", name: "Soft Orange" },
    { primary: "#8da0cb", secondary: "#e6e9f5", name: "Dusty Blue" },
    { primary: "#e78ac3", secondary: "#fbe1f2", name: "Pink Purple" },
    { primary: "#a6d854", secondary: "#eef8d9", name: "Lime Green" },
    { primary: "#ffd92f", secondary: "#fff6bf", name: "Soft Yellow" },
    { primary: "#e5c494", secondary: "#f6ebd9", name: "Tan" },
  ],
  Pastel1: [
    { primary: "#fbb4ae", secondary: "#b3cde3", name: "Soft Red" },
    { primary: "#b3cde3", secondary: "#ccebc5", name: "Soft Blue" },
    { primary: "#ccebc5", secondary: "#decbe4", name: "Soft Green" },
    { primary: "#decbe4", secondary: "#fed9a6", name: "Soft Lavender" },
    { primary: "#fed9a6", secondary: "#ffffcc", name: "Soft Orange" },
    { primary: "#ffffcc", secondary: "#e5d8bd", name: "Soft Yellow" },
    { primary: "#e5d8bd", secondary: "#fddaec", name: "Soft Beige" },
    { primary: "#fddaec", secondary: "#f2f2f2", name: "Soft Pink" },
  ],
  Dark2: [
    { primary: "#1b9e77", secondary: "#d95f02", name: "Dark Teal" },
    { primary: "#d95f02", secondary: "#7570b3", name: "Dark Orange" },
    { primary: "#7570b3", secondary: "#e7298a", name: "Dark Purple" },
    { primary: "#e7298a", secondary: "#66a61e", name: "Dark Pink" },
    { primary: "#66a61e", secondary: "#e6ab02", name: "Dark Green" },
    { primary: "#e6ab02", secondary: "#a6761d", name: "Dark Gold" },
    { primary: "#a6761d", secondary: "#666666", name: "Dark Brown" },
    { primary: "#666666", secondary: "#1b9e77", name: "Dark Gray" },
  ],
} as const;

// ============================================================================
// EDGE STYLE MAPPINGS
// ============================================================================

export const EDGE_STYLE_TAG_MAPPINGS = {
  // Numbered edge style system with boolean pairs
  edge_style_1: {
    style: { strokeDasharray: undefined }, // solid line
    animated: false,
    label: "1",
  },
  edge_style_1_alt: {
    style: { strokeDasharray: "4,4" }, // dashed line
    animated: false,
    label: "1*",
  },
  edge_style_2: {
    style: { strokeWidth: 1 }, // thin
    animated: false,
    label: "2",
  },
  edge_style_2_alt: {
    style: { strokeWidth: 3 }, // thick
    animated: false,
    label: "2*",
  },
  edge_style_3: {
    style: {},
    animated: false,
    label: "3",
  },
  edge_style_3_alt: {
    style: {},
    animated: true,
    label: "3*",
  },
  edge_style_4: {
    style: { strokeDasharray: "8,2,2,2" }, // double-line pattern
    animated: false,
    label: "4",
  },
  edge_style_5: {
    style: { strokeDasharray: "2,2" }, // dotted for cycles
    animated: true,
    label: "5",
  },

  // Legacy compound visual styles (for backward compatibility)
  "dashed-animated": {
    style: { strokeDasharray: "8,4" },
    animated: true,
    label: "- ->",
  },
  "thin-stroke": {
    style: { strokeWidth: 1 },
    animated: false,
    label: "thin",
  },
  "thick-stroke": {
    style: { strokeWidth: 3 },
    animated: false,
    label: "thick",
  },
  "wavy-line": {
    style: { strokeDasharray: "5,5" },
    animated: true,
    label: "~",
  },
  "smooth-line": {
    style: { strokeDasharray: undefined },
    animated: false,
    label: "—",
  },
  "double-line": {
    style: { strokeDasharray: "10,2,2,2" },
    animated: false,
    label: "=",
  },

  // Basic line patterns
  solid: {
    style: { strokeDasharray: undefined },
    animated: false,
    label: "—",
  },
  dashed: {
    style: { strokeDasharray: "8,4" },
    animated: false,
    label: "- -",
  },
  dotted: {
    style: { strokeDasharray: "2,2" },
    animated: false,
    label: "...",
  },
  wavy: {
    style: { strokeDasharray: "5,5" },
    animated: true,
    label: "~",
  },
  double: {
    style: { strokeDasharray: "10,2,2,2" },
    animated: false,
    label: "=",
  },

  // Line thickness
  thin: {
    style: { strokeWidth: 1 },
    animated: false,
    label: "T",
  },
  normal: {
    style: { strokeWidth: 2 },
    animated: false,
    label: "N",
  },
  thick: {
    style: { strokeWidth: 3 },
    animated: false,
    label: "B",
  },
  "extra-thick": {
    style: { strokeWidth: 4 },
    animated: false,
    label: "BB",
  },

  // Animation
  animated: {
    style: {},
    animated: true,
    label: ">",
  },
  static: {
    style: {},
    animated: false,
    label: "",
  },
} as const;

export type EdgeStyleTagMapping =
  (typeof EDGE_STYLE_TAG_MAPPINGS)[keyof typeof EDGE_STYLE_TAG_MAPPINGS];

// ============================================================================
// EDGE STYLING CONSTANTS
// ============================================================================

export const DEFAULT_EDGE_STYLE = {
  STROKE_COLOR: "#666666",
  STROKE_WIDTH: 2,
  DEFAULT_STROKE_COLOR: "#999999", // For edges with no properties
} as const;

export const EDGE_PROPERTY_ABBREVIATIONS = {
  Network: "N",
  Cycle: "C",
  Bounded: "B",
  Unbounded: "U",
  NoOrder: "~",
  TotalOrder: "O",
  Keyed: "K",
} as const;

export const EDGE_PROPERTY_DESCRIPTIONS = {
  Network: "Network communication",
  Cycle: "Cyclic data flow",
  Bounded: "Finite data stream",
  Unbounded: "Infinite data stream",
  NoOrder: "Unordered data",
  TotalOrder: "Ordered data",
  Keyed: "Key-value pairs",
} as const;

// ============================================================================
// WAVY EDGE CONFIGURATION
// ============================================================================

export const WAVY_EDGE_CONFIG = {
  // Wave appearance parameters
  amplitude: 0.8, // Wave height in pixels
  frequency: 6, // Number of complete wave cycles per 60px of edge length

  // Wave smoothness parameters
  pointsPerWave: 40, // Number of sample points per complete wave cycle
  baseWaveLength: 60, // Base wavelength in pixels for frequency calculation

  // Minimum edge length for wavy rendering
  minEdgeLength: 10, // Edges shorter than this will render as straight lines
} as const;

// ============================================================================
// EDGE MARKER CONFIGURATION
// ============================================================================

export const EDGE_MARKER_CONFIG = {
  // Percentage of edge length to keep plain at each end for marker visibility
  trimPercentage: 0.15, // 15% at each end (30% total) will be plain, 70% will be styled

  // Minimum trim length in pixels (used for very short edges)
  minTrimLength: 8,

  // Maximum trim length in pixels (prevents over-trimming on very long edges)
  maxTrimLength: 30,
} as const;

// ============================================================================
// HALO AND HIGHLIGHT COLORS
// ============================================================================

export const HALO_COLOR_MAPPINGS = {
  "light-blue": "#4a90e2",
  "light-red": "#e74c3c",
  "light-green": "#27ae60",
} as const;

export const HIGHLIGHT_STYLING = {
  EDGE_STROKE_WIDTH: 3,
  GLOW_OPACITY: "40", // 40% opacity for glow effects
  BORDER_WIDTH: "2px",
} as const;

// ============================================================================
// COLOR MANIPULATION CONSTANTS
// ============================================================================

export const COLOR_CONSTANTS = {
  LIGHTEN_FACTOR: 0.8, // factor for lightening colors (0-1)
  DARKEN_FACTOR: 0.2, // factor for darkening colors (0-1)
  CONTRAST_FACTOR: 0.4, // factor for text contrast (0-1)
} as const;

// ============================================================================
// HYPEREDGE CONSTANTS
// ============================================================================

export const HYPEREDGE_CONSTANTS = {
  PREFIX: "hyper_", // Prefix for hyperEdge IDs
  SEPARATOR: "_to_", // Separator for hyperEdge naming
} as const;
