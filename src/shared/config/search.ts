/**
 * @fileoverview Search Configuration
 *
 * All search and navigation-related constants including highlight colors,
 * timing, and interaction settings.
 */

// ============================================================================
// SEARCH HIGHLIGHT COLORS
// ============================================================================

export const SEARCH_HIGHLIGHT_COLORS = {
  backgroundColor: "#fcd34d", // Yellow-300 - softer yellow for search matches
  border: "#fbbf24", // Amber-400 - gentle border
} as const;

export const SEARCH_CURRENT_COLORS = {
  backgroundColor: "#fbbf24", // Amber-400 - current search result
  border: "#f59e0b", // Amber-500 - slightly darker border
} as const;

export const NAVIGATION_HIGHLIGHT_COLORS = {
  backgroundColor: "#3b82f6", // Blue-500
  border: "#2563eb", // Blue-600
} as const;

export const COMBINED_HIGHLIGHT_COLORS = {
  backgroundColor: "#8b5cf6", // Violet-500
  border: "#7c3aed", // Violet-600
} as const;

// ============================================================================
// NAVIGATION AND TIMING
// ============================================================================

export const NAVIGATION_TIMING = {
  VIEWPORT_ANIMATION_DURATION: 800, // ms - duration for viewport pan/zoom animation
  HIGHLIGHT_DURATION: 2000, // ms - duration for temporary highlight glow
} as const;

// ============================================================================
// SEARCH CONFIGURATION
// ============================================================================

export const SEARCH_CONFIG = {
  // Search behavior
  DEFAULT_DEBOUNCE_MS: 300, // milliseconds to wait before executing search
  MAX_SEARCH_HISTORY: 10, // maximum number of search terms to remember

  // Search result navigation
  NAVIGATION_DELAY: 100, // milliseconds delay after navigation
  RESULTS_LIST_HIDE_DELAY: 150, // milliseconds delay before hiding results list

  // Search result display
  MIN_COUNTER_WIDTH: 52, // pixels - minimum width for search result counter

  // Viewport fitting for search results
  VIEWPORT_PADDING_FACTOR: 0.8, // Use 80% of viewport (20% padding total)
} as const;
