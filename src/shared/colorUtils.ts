/**
 * @fileoverview Color utility functions
 *
 * Simple color utilities for the visualization system.
 */
import { COLOR_PALETTES } from "./config/styling.js";
import {
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
} from "./config/search.js";
// Basic color utility functions
export function hexToRgb(hex: string): {
  r: number;
  g: number;
  b: number;
} | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
export function getContrastColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return "#000000";
  // Calculate brightness using YIQ formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#ffffff";
}
/**
 * Get bright contrasting colors for search highlighting that work well against any palette
 * Uses constants from config.ts to ensure consistency across the codebase
 */
export function getSearchHighlightColors() {
  return {
    // Standard search match - softer yellow for gentler highlighting
    match: {
      background: SEARCH_HIGHLIGHT_COLORS.backgroundColor,
      border: SEARCH_HIGHLIGHT_COLORS.border,
      text: "#000000", // black text for maximum contrast
    },
    // Current/strong search match - amber for emphasis without being garish
    current: {
      background: SEARCH_CURRENT_COLORS.backgroundColor,
      border: SEARCH_CURRENT_COLORS.border,
      text: "#000000", // black text for maximum contrast
    },
  };
}
interface NodeColor {
  primary: string;
  border: string;
  gradient: string;
}
export type { NodeColor };
type NodeColorResult = NodeColor | Record<string, NodeColor>;
// Function expected by Legend component
export function generateNodeColors(
  nodeTypes: [string],
  palette?: string,
): NodeColor;
// eslint-disable-next-line no-redeclare
export function generateNodeColors(
  nodeTypes: string[],
  palette?: string,
): Record<string, NodeColor>;
// eslint-disable-next-line no-redeclare
export function generateNodeColors(
  nodeTypes: string[],
  palette: string = "Set3",
): NodeColorResult {
  // Get the selected palette, fallback to Set3 if not found
  const palettes = COLOR_PALETTES as unknown as Record<
    string,
    Array<{
      primary: string;
      secondary?: string;
    }>
  >;
  const selectedPalette = palettes[palette] || palettes["Set3"] || [];
  if (nodeTypes.length === 1) {
    // Single node type - return object with expected properties
    const nodeType = nodeTypes[0];
    // Use a hash of the node type to pick a consistent color
    const colorIndex =
      Math.abs(nodeType.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) %
      selectedPalette.length;
    const paletteColor = selectedPalette[colorIndex] || { primary: "#8dd3c7" };
    return {
      primary: paletteColor.primary,
      border: paletteColor.primary,
      gradient: paletteColor.primary,
    };
  }
  // Multiple node types - return a map
  const colors: Record<string, NodeColor> = {};
  nodeTypes.forEach((nodeType, index) => {
    const paletteColor = selectedPalette[index % selectedPalette.length] || {
      primary: "#8dd3c7",
    };
    colors[nodeType] = {
      primary: paletteColor.primary,
      border: paletteColor.primary,
      gradient: paletteColor.primary,
    };
  });
  return colors;
}

/**
 * Get a highlight color that contrasts well with the given color palette
 * Returns a vibrant color that stands out from typical palette colors
 */
export function getHighlightColor(palette: string = "Set3"): {
  primary: string;
  border: string;
  glow: string;
  background: string;
} {
  // Choose a contrasting highlight color based on the palette
  // For dark palettes, use bright cyan/electric blue
  if (palette === "Dark2") {
    return {
      primary: "#06b6d4", // cyan-500
      border: "#0891b2", // cyan-600
      glow: "rgba(6, 182, 212, 0.8)", // cyan with opacity
      background: "rgba(6, 182, 212, 0.1)",
    };
  }

  // For pastel palettes, use vibrant magenta/fuchsia
  if (palette === "Pastel1") {
    return {
      primary: "#d946ef", // fuchsia-500
      border: "#c026d3", // fuchsia-600
      glow: "rgba(217, 70, 239, 0.8)", // fuchsia with opacity
      background: "rgba(217, 70, 239, 0.1)",
    };
  }

  // For Set2, use vibrant purple
  if (palette === "Set2") {
    return {
      primary: "#a855f7", // purple-500
      border: "#9333ea", // purple-600
      glow: "rgba(168, 85, 247, 0.8)", // purple with opacity
      background: "rgba(168, 85, 247, 0.1)",
    };
  }

  // Default for Set3 and others: vibrant electric blue
  return {
    primary: "#3b82f6", // blue-500
    border: "#2563eb", // blue-600
    glow: "rgba(59, 130, 246, 0.8)", // blue with opacity
    background: "rgba(59, 130, 246, 0.1)",
  };
}
