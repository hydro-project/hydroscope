/**
 * @fileoverview Unified Configuration and Constants
 *
 * All configuration constants, styling, colors, typography, and layout settings
 * for the visualizer-v4 system. This replaces the previous split between
 * config.ts and constants.ts for better organization.
 */

// ============================================================================
// STYLING CONSTANTS (from constants.ts)
// ============================================================================

// Node styling constants
export const NODE_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  SELECTED: "selected",
  WARNING: "warning",
  ERROR: "error",
} as const;

// Edge styling constants
export const EDGE_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  DASHED: "dashed",
  THICK: "thick",
  WARNING: "warning",
} as const;

// Container styling constants
export const CONTAINER_STYLES = {
  DEFAULT: "default",
  HIGHLIGHTED: "highlighted",
  SELECTED: "selected",
  MINIMIZED: "minimized",
} as const;

// Layout constants
export const LAYOUT_CONSTANTS = {
  defaultNodePadding: 12,
  defaultNodeFontSize: 12,
  DEFAULT_NODE_WIDTH: 180,
  DEFAULT_NODE_HEIGHT: 60,
  DEFAULT_CONTAINER_PADDING: 20,
  MIN_CONTAINER_WIDTH: 200,
  MIN_CONTAINER_HEIGHT: 150,

  // Container sizing constants for ReactFlow hierarchical layout (fallback values when ELK doesn't provide sizing)
  CHILD_CONTAINER_WIDTH: 200, // Compact width for child containers (was 220)
  CHILD_CONTAINER_HEIGHT: 120, // Compact height for child containers (was 140)
  MAX_PARENT_CONTAINER_WIDTH: 500, // Reduced maximum width cap (was 600)
  MAX_PARENT_CONTAINER_HEIGHT: 350, // Reduced maximum height cap (was 450)
  DEFAULT_PARENT_CONTAINER_WIDTH: 250, // Reduced default width (was 300)
  DEFAULT_PARENT_CONTAINER_HEIGHT: 150, // Reduced default height (was 200)
  FALLBACK_CONTAINER_WIDTH: 200, // Match child container width
  FALLBACK_CONTAINER_HEIGHT: 120, // Match child container height
  FALLBACK_CONTAINER_MAX_WIDTH: 250, // Reduced fallback max (was 300)
  FALLBACK_CONTAINER_MAX_HEIGHT: 150, // Reduced fallback max (was 200)

  // Node positioning within containers (fallback values when ELK positioning isn't available)
  NODE_GRID_PADDING: 8, // Compact padding between nodes (was 10)
  NODE_CONTAINER_TITLE_HEIGHT: 30, // Compact title height (was 35)
  NODE_GRID_WIDTH: 100, // Compact node width (was 120)
  NODE_GRID_HEIGHT: 40, // Compact node height (was 45)
  NODE_GRID_COLUMNS: 2, // Keep 2 columns

  // Container positioning within parent containers (fallback values)
  CONTAINER_GRID_PADDING: 15, // Compact padding between containers (was 15)
  CONTAINER_TITLE_HEIGHT: 30, // Match node title height (was 35)
  CONTAINER_GRID_COLUMNS: 2, // Keep 2 columns

  // Container label positioning and sizing
  CONTAINER_LABEL_HEIGHT: 32, // Height reserved for container labels
  CONTAINER_LABEL_PADDING: 12, // Padding around container labels
  CONTAINER_LABEL_FONT_SIZE: 12, // Font size for container labels

  // Validation and warning thresholds
  MAX_HYPEREDGE_WARNINGS: 10, // Maximum hyperEdge warnings before summary

  // Large container detection thresholds (derived from base constants)
  get LARGE_CONTAINER_WIDTH_THRESHOLD() {
    return this.MIN_CONTAINER_WIDTH * 1.5; // 300 (1.5x minimum width)
  },
  get LARGE_CONTAINER_HEIGHT_THRESHOLD() {
    return this.MIN_CONTAINER_HEIGHT + this.CONTAINER_LABEL_HEIGHT; // 182 (min height + label)
  },
  LARGE_CONTAINER_CHILD_COUNT_THRESHOLD: 7,

  SMART_COLLAPSE_BUDGET: 25000,
} as const;

// UI Animation and Interaction Constants
export const UI_CONSTANTS = {
  // ReactFlow viewport animation
  FIT_VIEW_PADDING: 0.15, // Increased from 0.1 to prevent content cutoff at viewport edges
  FIT_VIEW_MAX_ZOOM: 1.2,
  FIT_VIEW_DURATION: 300, // milliseconds

  // Timing constants
  LAYOUT_DELAY_THRESHOLD: 500, // milliseconds - when to apply shorter delay
  LAYOUT_DELAY_SHORT: 100, // milliseconds
  LAYOUT_DELAY_NORMAL: 300, // milliseconds

  // Handle dimensions (ReactFlow connection points)
  HANDLE_SIZE: 8, // pixels - width and height for handles
  HANDLE_SIZE_SMALL: 6, // pixels - for continuous/floating handles
  HANDLE_OPACITY_HIDDEN: 0, // completely transparent
  HANDLE_OPACITY_VISIBLE: 0.1, // barely visible

  // Border and stroke widths
  BORDER_WIDTH_DEFAULT: 2, // pixels
  BORDER_WIDTH_THICK: 3, // pixels
  EDGE_STROKE_WIDTH: 2, // pixels
  MINIMAP_STROKE_WIDTH: 2, // pixels

  // Node sizing constants (fallback values when not specified)
  NODE_WIDTH_DEFAULT: 120, // pixels
  NODE_WIDTH_CONTAINER: 180, // pixels - for collapsed containers
  NODE_HEIGHT_DEFAULT: 40, // pixels
  NODE_HEIGHT_CONTAINER: 100, // pixels - for collapsed containers

  // Zoom limits
  MAX_ZOOM: 2, // maximum zoom level for ReactFlow
} as const;

// Panel and Component Sizing Constants
export const PANEL_CONSTANTS = {
  // Panel positioning
  PANEL_TOP: 10, // pixels - position to occlude the button
  PANEL_RIGHT: 8, // pixels - right side positioning

  // Info Panel dimensions
  INFO_PANEL_MIN_WIDTH: 280, // pixels
  INFO_PANEL_MAX_WIDTH: 340, // pixels
  INFO_PANEL_PADDING: 20, // pixels
  INFO_PANEL_BORDER_RADIUS: 2, // pixels

  // Style Tuner Panel dimensions (matches Info Panel)
  STYLE_TUNER_MIN_WIDTH: 280, // pixels
  STYLE_TUNER_MAX_WIDTH: 340, // pixels
  STYLE_TUNER_PADDING: 20, // pixels
  STYLE_TUNER_BORDER_RADIUS: 2, // pixels

  // General component styling
  COMPONENT_BORDER_RADIUS: 4, // pixels - for buttons, inputs, etc.
  COMPONENT_PADDING: 12, // pixels - general padding

  // Search controls
  SEARCH_MIN_WIDTH: 52, // pixels - for search result counter

  // Typography
  FONT_SIZE_TINY: 11, // pixels - for secondary text
  FONT_SIZE_SMALL: 12, // pixels
  FONT_SIZE_LABEL: 13, // pixels - for node/container labels
  FONT_SIZE_MEDIUM: 16, // pixels
  FONT_SIZE_LARGE: 18, // pixels
} as const;

// Color manipulation constants (for generateContainerColors function)
export const COLOR_CONSTANTS = {
  LIGHTEN_FACTOR: 0.8, // factor for lightening colors (0-1)
  DARKEN_FACTOR: 0.2, // factor for darkening colors (0-1)
  CONTRAST_FACTOR: 0.4, // factor for text contrast (0-1)
} as const;

// HyperEdge constants
export const HYPEREDGE_CONSTANTS = {
  PREFIX: "hyper_", // Prefix for hyperEdge IDs
  SEPARATOR: "_to_", // Separator for hyperEdge naming
} as const;

// Edge style tag mappings
export const EDGE_STYLE_TAG_MAPPINGS = {
  // New numbered edge style system with boolean pairs
  // Each pair uses different visual properties that can merge cleanly

  // Style 1 pair: Line pattern (ordering)
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

  // Style 2 pair: Line thickness (bounds)
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

  // Style 3 pair: Animation (scope)
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

  // Single properties: Double line (keyed), wavy (cycle)
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

// Halo color mappings
export const HALO_COLOR_MAPPINGS = {
  "light-blue": "#4a90e2",
  "light-red": "#e74c3c",
  "light-green": "#27ae60",
} as const;

// Edge property abbreviations
export const EDGE_PROPERTY_ABBREVIATIONS = {
  Network: "N",
  Cycle: "C",
  Bounded: "B",
  Unbounded: "U",
  NoOrder: "~",
  TotalOrder: "O",
  Keyed: "K",
} as const;

// Edge property descriptions
export const EDGE_PROPERTY_DESCRIPTIONS = {
  Network: "Network communication",
  Cycle: "Cyclic data flow",
  Bounded: "Finite data stream",
  Unbounded: "Infinite data stream",
  NoOrder: "Unordered data",
  TotalOrder: "Ordered data",
  Keyed: "Key-value pairs",
} as const;

// Default edge style values
export const DEFAULT_EDGE_STYLE = {
  STROKE_COLOR: "#666666",
  STROKE_WIDTH: 2,
  DEFAULT_STROKE_COLOR: "#999999", // For edges with no properties
} as const;

// Search and Navigation Highlight Colors
export const SEARCH_HIGHLIGHT_COLORS = {
  backgroundColor: "#fbbf24", // Amber-400
  border: "#f59e0b", // Amber-500
} as const;

export const SEARCH_CURRENT_COLORS = {
  backgroundColor: "#f97316", // Orange-500
  border: "#ea580c", // Orange-600
} as const;

export const NAVIGATION_HIGHLIGHT_COLORS = {
  backgroundColor: "#3b82f6", // Blue-500
  border: "#2563eb", // Blue-600
} as const;

export const COMBINED_HIGHLIGHT_COLORS = {
  backgroundColor: "#8b5cf6", // Violet-500
  border: "#7c3aed", // Violet-600
} as const;

// Type exports
export type NodeStyle = (typeof NODE_STYLES)[keyof typeof NODE_STYLES];
export type EdgeStyle = (typeof EDGE_STYLES)[keyof typeof EDGE_STYLES];
export type ContainerStyle =
  (typeof CONTAINER_STYLES)[keyof typeof CONTAINER_STYLES];
export type EdgeStyleTagMapping =
  (typeof EDGE_STYLE_TAG_MAPPINGS)[keyof typeof EDGE_STYLE_TAG_MAPPINGS];

// ============================================================================
// OPERATION MANAGER CONSTANTS
// ============================================================================

// ConsolidatedOperationManager livelock prevention constants
export const OPERATION_MANAGER_CONSTANTS = {
  // Immediate follow-up limits to prevent livelock
  MAX_IMMEDIATE_FOLLOW_UPS: 5, // Maximum number of immediate follow-ups in a chain
  MAX_FOLLOW_UP_CHAIN_DURATION_MS: 10000, // Maximum duration (10 seconds) for a follow-up chain
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

// Additional exports expected by components
export const COMPONENT_COLORS = {
  BACKGROUND_PRIMARY: "#ffffff",
  BACKGROUND_SECONDARY: "#f9fafb",
  PANEL_BACKGROUND: "#ffffff",
  PANEL_HEADER_BACKGROUND: "#f9fafb",
  BORDER_LIGHT: "#e5e7eb",
  BORDER_MEDIUM: "#d1d5db",
  TEXT_PRIMARY: "#111827",
  TEXT_SECONDARY: "#6b7280",
  TEXT_TERTIARY: "#9ca3af",
  TEXT_DISABLED: "#d1d5db",
  BUTTON_HOVER_BACKGROUND: "#f3f4f6",
};

// Default color palette - single source of truth
export const DEFAULT_COLOR_PALETTE = "Set3";

export const COLOR_PALETTES = {
  Set2: [
    { primary: "#66c2a5", secondary: "#e0f2ef", name: "Teal Green" },
    { primary: "#fc8d62", secondary: "#ffe1d6", name: "Soft Orange" },
    { primary: "#8da0cb", secondary: "#e6e9f5", name: "Dusty Blue" },
    { primary: "#e78ac3", secondary: "#fbe1f2", name: "Pink Purple" },
    { primary: "#a6d854", secondary: "#eef8d9", name: "Lime Green" },
    { primary: "#ffd92f", secondary: "#fff6bf", name: "Soft Yellow" },
    { primary: "#e5c494", secondary: "#f6ebd9", name: "Tan" },
  ],
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
};

export const SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
  BORDER_RADIUS_DEFAULT: "6px",
  COLLAPSED_CONTAINER_WIDTH: 200,
  COLLAPSED_CONTAINER_HEIGHT: 150,
};

// Typography and font size constants
export const TYPOGRAPHY = {
  // InfoPanel font sizes - increased from tiny sizes for better readability
  INFOPANEL_BASE: "14px", // Main InfoPanel content (was 10px)
  INFOPANEL_TITLE: "16px", // Section titles
  INFOPANEL_HIERARCHY_NODE: "13px", // Hierarchy tree nodes (was 9-10px)
  INFOPANEL_HIERARCHY_DETAILS: "12px", // Node details and counts (was 9px)
  INFOPANEL_LEGEND: "13px", // Legend items (was 10-11px)

  // General UI font sizes
  UI_SMALL: "12px",
  UI_MEDIUM: "14px",
  UI_LARGE: "16px",
  UI_HEADING: "18px",

  // Page-level typography
  PAGE_TITLE: "24px",
  PAGE_SUBTITLE: "14px",
  BUTTON_SMALL: "14px",
  BUTTON_MEDIUM: "16px",
};

export const SHADOWS = {
  LIGHT: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  MEDIUM: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  LARGE: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  PANEL_DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  PANEL_DRAGGING: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
};

// ============================================================================
// RENDER CONFIG (migrated from src/render/config.ts)
// ============================================================================

// Note: Keep types decoupled to avoid circular deps; use simple shape here.
export const DEFAULT_RENDER_CONFIG = {
  enableMiniMap: true,
  enableControls: true,
  fitView: true,
  nodesDraggable: true,
  snapToGrid: false,
  gridSize: 20,
  nodesConnectable: false,
  elementsSelectable: true,
  enableZoom: true,
  enablePan: true,
  enableSelection: true,

  // Visual style defaults (kept here to avoid importing types and to satisfy FlowGraph expectations)
  edgeStyle: "bezier", // 'bezier' | 'straight' | 'smoothstep'
  edgeColor: "#1976d2", // default blue edge color
  edgeWidth: 2, // px
  edgeDashed: false, // solid by default

  nodeBorderRadius: 4, // px
  nodePadding: 12, // px
  nodeFontSize: 12, // px

  containerBorderRadius: 8, // px
  containerBorderWidth: 2, // px
  containerShadow: "LIGHT", // 'LIGHT' | 'MEDIUM' | 'LARGE' | 'NONE'
} as const;

// Wavy edge rendering configuration
export const WAVY_EDGE_CONFIG = {
  // Standard edges (most common)
  standardEdge: {
    amplitude: 2, // Wave height
    frequency: 4, // Number of wave cycles (increased for more visible waves)
  },

  // Hyper edges (multi-node connections)
  hyperEdge: {
    amplitude: 2, // Slightly smaller amplitude for hyper edges
    frequency: 4,
  },

  // Wave calculation parameters
  calculation: {
    segments: {
      min: 150, // Minimum segments for smooth curves
      divisor: 1.5, // Distance divisor for segment calculation (lower = more segments)
    },
    frequencyDivisor: 20, // Controls wave density (lower = more waves)
  },
} as const;

// ELK Layout exports expected by ELKStateManager
export const ELK_ALGORITHMS = {
  LAYERED: "layered",
  MRTREE: "mrtree",
  FORCE: "force",
  STRESS: "stress",
} as const;

// Default algorithm - single source of truth
export const DEFAULT_ELK_ALGORITHM = ELK_ALGORITHMS.LAYERED;

// Default layout configuration - single source of truth for all layout settings
export const DEFAULT_LAYOUT_CONFIG = {
  algorithm: DEFAULT_ELK_ALGORITHM,
  direction: "DOWN",
  enableSmartCollapse: true,
  spacing: 100,
  nodeSize: { width: 180, height: 60 },
} as const;

export const LAYOUT_SPACING = {
  // Updated to match working Visualizer spacing values
  NODE_NODE: 75, // Increased for better node separation
  NODE_EDGE: 10, // Keep edge spacing tight
  EDGE_EDGE: 10, // Keep edge spacing tight
  NODE_TO_NODE_NORMAL: 75, // Match Visualizer: better readability
  EDGE_TO_EDGE: 10, // Keep edge spacing tight
  EDGE_TO_NODE: 0, // Match Visualizer: no extra edge-node gap
  COMPONENT_TO_COMPONENT: 60, // Match Visualizer: better component separation
  ROOT_PADDING: 20, // Keep root padding minimal
  CONTAINER_PADDING: 60, // Match Visualizer: proper breathing room in containers
};

export const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": DEFAULT_ELK_ALGORITHM,
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": LAYOUT_SPACING.NODE_TO_NODE_NORMAL.toString(),
  "elk.spacing.edgeNode": LAYOUT_SPACING.EDGE_TO_NODE.toString(),
  "elk.spacing.edgeEdge": LAYOUT_SPACING.EDGE_TO_EDGE.toString(),
  "elk.spacing.componentComponent":
    LAYOUT_SPACING.COMPONENT_TO_COMPONENT.toString(),
  "elk.layered.spacing.nodeNodeBetweenLayers": "50", // Match Visualizer layer separation
  "elk.edgeRouting": "ORTHOGONAL", // less edge overlap
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX", // stagger nodes
  "elk.nodeSize.options": "DEFAULT_MINIMUM_SIZE", // Respect our specified dimensions
};

export type ELKAlgorithm = (typeof ELK_ALGORITHMS)[keyof typeof ELK_ALGORITHMS];

// Accept broader algorithm strings and coerce to a valid ELK algorithm with a safe default
export function getELKLayoutOptions(algorithm: string = DEFAULT_ELK_ALGORITHM) {
  const allowed: Record<string, ELKAlgorithm> = {
    [ELK_ALGORITHMS.LAYERED]: ELK_ALGORITHMS.LAYERED,
    [ELK_ALGORITHMS.MRTREE]: ELK_ALGORITHMS.MRTREE,
    [ELK_ALGORITHMS.FORCE]: ELK_ALGORITHMS.FORCE,
    [ELK_ALGORITHMS.STRESS]: ELK_ALGORITHMS.STRESS,
  } as const;
  const normalized = allowed[algorithm] ?? DEFAULT_ELK_ALGORITHM;
  return {
    ...ELK_LAYOUT_OPTIONS,
    "elk.algorithm": normalized,
    // TRUST ELK: Enable proper hierarchical layout handling
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    // Use absolute coordinates for ReactFlow integration
    "elk.json.shapeCoords": "ROOT",
    "elk.json.edgeCoords": "ROOT",
  };
}

export function createFixedPositionOptions(x?: number, y?: number) {
  const options = {
    ...ELK_LAYOUT_OPTIONS,
    // Use stronger position constraints based on ELK documentation
    "elk.position": "FIXED",
    // Fixed size constraints - empty means size is already fixed and should not be changed
    "elk.nodeSize.constraints": "",
    "elk.nodeSize.options": "DEFAULT_MINIMUM_SIZE",
    // Interactive layout to respect existing positions
    "elk.interactive": "true",
  };

  if (x !== undefined && y !== undefined) {
    return {
      ...options,
      "elk.position.x": x.toString(),
      "elk.position.y": y.toString(),
    };
  }

  return options;
}

export function createFreePositionOptions() {
  return {
    ...ELK_LAYOUT_OPTIONS,
    "elk.position": "FREE",
  };
}
