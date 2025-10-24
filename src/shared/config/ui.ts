/**
 * @fileoverview UI Configuration
 *
 * All UI-related constants including component dimensions, typography,
 * colors, shadows, animations, and interaction settings.
 */

// ============================================================================
// UI INTERACTION CONSTANTS
// ============================================================================

export const UI_CONSTANTS = {
  // ReactFlow viewport animation
  FIT_VIEW_PADDING: 0.15, // Increased from 0.1 to prevent content cutoff
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

  // Zoom limits
  MAX_ZOOM: 2, // maximum zoom level for ReactFlow
} as const;

// ============================================================================
// PANEL CONSTANTS
// ============================================================================

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

  // Font sizes for different contexts
  FONT_SIZE_TINY: 11, // pixels - for secondary text
  FONT_SIZE_SMALL: 12, // pixels
  FONT_SIZE_LABEL: 13, // pixels - for node/container labels
  FONT_SIZE_POPUP: 10, // pixels - for popup node text (smaller to fit more content)
  FONT_SIZE_MEDIUM: 16, // pixels
  FONT_SIZE_LARGE: 18, // pixels
} as const;

// ============================================================================
// COMPONENT COLORS
// ============================================================================

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
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

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
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const SHADOWS = {
  LIGHT: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  MEDIUM: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  LARGE: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  PANEL_DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  PANEL_DRAGGING: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
} as const;

// ============================================================================
// SIZES
// ============================================================================

export const SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
  BORDER_RADIUS_DEFAULT: "6px",
  COLLAPSED_CONTAINER_WIDTH: 200,
  COLLAPSED_CONTAINER_HEIGHT: 150,
} as const;

// ============================================================================
// ANIMATION AND TIMING
// ============================================================================

export const ANIMATION_TIMING = {
  // Standard durations
  FAST: 150, // milliseconds
  NORMAL: 300, // milliseconds
  SLOW: 500, // milliseconds

  // Specific use cases
  TOOLTIP_DELAY: 1000, // milliseconds
  DEBOUNCE_SEARCH: 300, // milliseconds
  DEBOUNCE_RESIZE: 100, // milliseconds

  // Polling intervals
  QUEUE_POLL_INTERVAL: 50, // milliseconds
  STATUS_CHECK_INTERVAL: 100, // milliseconds
} as const;
