/**
 * Style Processor - Converts semantic tags to visual styles
 *
 * Maps semantic tags to visual channels like line-pattern, line-width, animation, etc.
 * Based on the semantic mappings configuration from the JSON data.
 */
import type { CSSProperties } from "react";
import type { StyleConfig } from "../types/core.js";
// Visual channels supported by the style processor
export const VISUAL_CHANNELS = {
  "line-pattern": ["solid", "dashed", "dotted", "dash-dot"],
  "line-width": [2, 3, 4, 5],
  animation: ["static", "animated"],
  "line-style": ["single", "double", "hash-marks"],
  color: [], // Edge stroke color - values are hex codes from semantic mappings
  halo: ["none", "light-blue", "light-red", "light-green"],
  arrowhead: [
    "none",
    "triangle-open",
    "triangle-filled",
    "circle-filled",
    "diamond-open",
  ],
  waviness: ["none", "wavy"],
} as const;
// Default style values
export const DEFAULT_STYLE = {
  STROKE_COLOR: "#666666",
  STROKE_WIDTH: 3,
  DEFAULT_STROKE_COLOR: "#999999", // For elements with no semantic tags
} as const;
// Halo color mappings
export const HALO_COLOR_MAPPINGS = {
  "light-blue": "#4a90e2",
  "light-red": "#e74c3c",
  "light-green": "#27ae60",
} as const;
export interface ProcessedStyle {
  style: CSSProperties & Record<string, unknown>;
  animated: boolean;
  label?: string;
  appliedTags: string[];
  markerEnd?: string | object;
  lineStyle?: "single" | "hash-marks";
  waviness?: boolean;
}
/**
 * Process semantic tags and return visual style
 */
export function processSemanticTags(
  semanticTags: string[],
  styleConfig?: StyleConfig,
  originalLabel?: string,
  elementType: "node" | "edge" = "edge",
): ProcessedStyle {
  if (!semanticTags || semanticTags.length === 0) {
    return getDefaultStyle(elementType);
  }
  // If we have semantic mappings, use them
  if (styleConfig?.semanticMappings) {
    return processWithSemanticMappings(
      semanticTags,
      styleConfig,
      originalLabel,
      elementType,
    );
  }
  // If we have property mappings, use them (legacy support)
  if (styleConfig?.propertyMappings) {
    return processWithPropertyMappings(
      semanticTags,
      styleConfig,
      originalLabel,
      elementType,
    );
  }
  // No mappings available, return default style
  return getDefaultStyle(elementType);
}
/**
 * Process semantic tags for aggregated edges with conflict resolution
 */
export function processAggregatedSemanticTags(
  originalEdges: any[],
  styleConfig?: StyleConfig,
  originalLabel?: string,
): ProcessedStyle {
  if (!originalEdges || originalEdges.length === 0) {
    return getDefaultStyle("edge");
  }
  if (!styleConfig?.semanticMappings) {
    // Fallback to merging all semantic tags if no mappings
    const allTags = [
      ...new Set(originalEdges.flatMap((e) => e.semanticTags || [])),
    ];
    const result = processSemanticTags(
      allTags,
      styleConfig,
      originalLabel,
      "edge",
    );
    // Ensure we always have some default styling for aggregated edges
    if (!result.style || Object.keys(result.style).length === 0) {
      return getDefaultStyle("edge");
    }
    return result;
  }
  // Process each original edge to get its style settings
  const edgeStyleSettings: Record<string, string | number>[] = [];
  for (const edge of originalEdges) {
    const edgeTags = edge.semanticTags || [];
    if (edgeTags.length > 0) {
      const styleSettings = extractStyleSettingsFromTags(edgeTags, styleConfig);
      if (Object.keys(styleSettings).length > 0) {
        edgeStyleSettings.push(styleSettings);
      }
    }
  }
  // Merge style settings with conflict resolution
  const mergedSettings =
    mergeStyleSettingsWithConflictResolution(edgeStyleSettings);
  // Convert merged settings to visual format
  if (Object.keys(mergedSettings).length > 0) {
    const appliedTags = [
      ...new Set(originalEdges.flatMap((e) => e.semanticTags || [])),
    ];
    return convertStyleSettingsToVisual(
      mergedSettings,
      appliedTags,
      originalLabel,
      "edge",
    );
  }
  return getDefaultStyle("edge");
}
/**
 * Extract style settings from semantic tags using semantic mappings
 */
function extractStyleSettingsFromTags(
  semanticTags: string[],
  styleConfig: StyleConfig,
): Record<string, string | number> {
  const styleSettings: Record<string, string | number> = {};
  if (!styleConfig.semanticMappings) {
    return styleSettings;
  }
  // Process each group in the semantic mappings
  for (const [, group] of Object.entries(styleConfig.semanticMappings)) {
    // Find which option in this group matches our semantic tags (if any)
    for (const [optionName, styleMapping] of Object.entries(group)) {
      if (semanticTags.includes(optionName)) {
        // Apply all style settings from this option
        Object.assign(styleSettings, styleMapping);
        break; // Only one option per group can match
      }
    }
  }
  return styleSettings;
}
/**
 * Merge style settings from multiple edges with conflict resolution
 */
function mergeStyleSettingsWithConflictResolution(
  edgeStyleSettings: Record<string, string | number>[],
): Record<string, string | number> {
  if (edgeStyleSettings.length === 0) {
    return {};
  }
  if (edgeStyleSettings.length === 1) {
    return { ...edgeStyleSettings[0] };
  }
  // Collect all style properties and their values across edges
  const propertyValues: Record<string, Set<string | number>> = {};
  for (const settings of edgeStyleSettings) {
    for (const [property, value] of Object.entries(settings)) {
      if (!propertyValues[property]) {
        propertyValues[property] = new Set();
      }
      propertyValues[property].add(value);
    }
  }

  // Resolve conflicts
  const mergedSettings: Record<string, string | number> = {};
  for (const [property, values] of Object.entries(propertyValues)) {
    if (values.size === 1) {
      // No conflict - use the single value
      mergedSettings[property] = Array.from(values)[0];
    } else {
      // Conflict - use neutral default
      const neutralValue = getNeutralDefaultForProperty(property);
      if (neutralValue !== undefined) {
        mergedSettings[property] = neutralValue;
      }
      // If no neutral default exists, omit the property (let CSS defaults apply)
    }
  }

  return mergedSettings;
}
/**
 * Get neutral default values for conflicting style properties
 */
function getNeutralDefaultForProperty(
  property: string,
): string | number | undefined {
  const neutralDefaults: Record<string, string | number> = {
    "line-pattern": "solid",
    "line-width": 2,
    animation: "static",
    "line-style": "single",
    halo: "none",
    arrowhead: "triangle-open", // Neutral arrow for aggregated edges
    waviness: "none",
  };
  return neutralDefaults[property];
}
/**
 * Process semantic tags using semantic mappings configuration
 */
function processWithSemanticMappings(
  semanticTags: string[],
  styleConfig: StyleConfig,
  originalLabel?: string,
  elementType: "node" | "edge" = "edge",
): ProcessedStyle {
  if (!styleConfig.semanticMappings) {
    return getDefaultStyle(elementType);
  }
  // Collect all style settings from matching semantic tags
  const styleSettings: Record<string, string | number> = {};
  const appliedTags: string[] = [];
  // Process each group in the semantic mappings
  for (const [, group] of Object.entries(styleConfig.semanticMappings)) {
    // Find which option in this group matches our semantic tags (if any)
    for (const [optionName, styleMapping] of Object.entries(group)) {
      if (semanticTags.includes(optionName)) {
        // Apply all style settings from this option
        Object.assign(styleSettings, styleMapping);
        appliedTags.push(optionName);
        break; // Only one option per group can match
      }
    }
  }
  // Convert style settings to visual format
  if (Object.keys(styleSettings).length > 0) {
    return convertStyleSettingsToVisual(
      styleSettings,
      appliedTags,
      originalLabel,
      elementType,
    );
  }
  return getDefaultStyle(elementType);
}
/**
 * Process semantic tags using property mappings (legacy support)
 */
function processWithPropertyMappings(
  semanticTags: string[],
  styleConfig: StyleConfig,
  originalLabel?: string,
  elementType: "node" | "edge" = "edge",
): ProcessedStyle {
  if (!styleConfig.propertyMappings) {
    return getDefaultStyle(elementType);
  }
  let style: CSSProperties & Record<string, unknown> = {};
  let animated = false;
  const appliedTags: string[] = [];
  const labels: string[] = [];
  // Apply each matching property mapping
  for (const tag of semanticTags) {
    const mapping = styleConfig.propertyMappings[tag];
    if (mapping) {
      if (typeof mapping === "string") {
        // Simple string mapping - treat as style class
        style.className = mapping;
      } else {
        // Complex mapping object
        if (mapping.style) {
          Object.assign(style, mapping.style);
        }
        if (mapping.animated) {
          animated = true;
        }
        if (mapping.label) {
          labels.push(mapping.label);
        }
      }
      appliedTags.push(tag);
    }
  }
  return {
    style: {
      stroke: DEFAULT_STYLE.STROKE_COLOR,
      strokeWidth: DEFAULT_STYLE.STROKE_WIDTH,
      ...style,
    },
    animated,
    label:
      labels.length > 0
        ? labels.join("")
        : createTagLabel(appliedTags, originalLabel),
    appliedTags,
  };
}
/**
 * Convert style settings to visual format
 */
function convertStyleSettingsToVisual(
  styleSettings: Record<string, string | number>,
  appliedTags: string[],
  originalLabel?: string,
  elementType: "node" | "edge" = "edge",
): ProcessedStyle {
  let style: CSSProperties & Record<string, unknown> = {};
  let animated = false;
  let markerEnd: string | object | undefined = undefined;
  let lineStyle: "single" | "hash-marks" = "single";
  let waviness = false;
  // Apply line-pattern
  const linePattern = styleSettings["line-pattern"] as string;
  if (linePattern) {
    switch (linePattern) {
      case "solid":
        style.strokeDasharray = undefined;
        break;
      case "dashed":
        style.strokeDasharray = "8,4";
        break;
      case "dotted":
        style.strokeDasharray = "2,2";
        break;
      case "dash-dot":
        style.strokeDasharray = "8,2,2,2";
        break;
    }
  }
  // Apply line-width
  const lineWidth = styleSettings["line-width"] as number;
  if (lineWidth) {
    style.strokeWidth = lineWidth;
  }

  // Apply color (for edge stroke color)
  const color = styleSettings["color"] as string;
  if (color) {
    style.stroke = color;
  }

  // Apply animation
  const animation = styleSettings["animation"] as string;
  if (animation === "animated") {
    animated = true;
  }
  // Apply line-style
  const lineStyleSetting = styleSettings["line-style"] as string;
  if (lineStyleSetting === "hash-marks") {
    lineStyle = "hash-marks";
    // Hash marks rendering is handled by CustomEdge component
    // which renders vertical tick marks along the edge for keyed streams
  }

  // Apply waviness (can be boolean true or string "wavy")
  const wavinessSetting = styleSettings["waviness"];
  if (
    wavinessSetting === "wavy" ||
    wavinessSetting === "true" ||
    (typeof wavinessSetting === "boolean" && wavinessSetting)
  ) {
    waviness = true;
  }
  // Apply halo
  const halo = styleSettings["halo"] as string;
  if (halo && halo !== "none") {
    if (halo === "unbounded-blue") {
      // Special blue halo for unbounded streams
      style.haloColor = "rgba(100, 200, 255, 0.4)";
    } else {
      const haloColor =
        HALO_COLOR_MAPPINGS[halo as keyof typeof HALO_COLOR_MAPPINGS];
      if (haloColor) {
        style.haloColor = haloColor;
      }
    }
  }

  // Apply arrowhead
  const arrowhead = styleSettings["arrowhead"] as string;
  if (arrowhead && arrowhead !== "none") {
    switch (arrowhead) {
      case "triangle-open":
        markerEnd = { type: "arrow" };
        break;
      case "triangle-filled":
        markerEnd = { type: "arrowclosed" };
        break;
      case "circle-filled":
        // Use a simple circle marker (ReactFlow doesn't have this built-in, so we'll use arrowclosed for now)
        markerEnd = { type: "arrowclosed" };
        break;
      case "diamond-open":
        // Use arrow for diamond (ReactFlow doesn't have this built-in)
        markerEnd = { type: "arrow" };
        break;
    }
  } else if (elementType === "edge" && !arrowhead) {
    // Default arrowhead for edges when none is specified
    markerEnd = { type: "arrowclosed" };
  }
  // Only set base style properties if we don't have any style settings
  const hasStyleSettings = Object.keys(style).length > 0;
  let baseStyle: CSSProperties & Record<string, unknown> = { ...style };
  // For edges, only set defaults if no style settings were applied
  if (elementType === "edge" && !hasStyleSettings) {
    baseStyle.stroke = DEFAULT_STYLE.STROKE_COLOR;
    baseStyle.strokeWidth = DEFAULT_STYLE.STROKE_WIDTH;
  }
  // For nodes, apply different base styles only if no style settings were applied
  if (elementType === "node") {
    if (!hasStyleSettings) {
      baseStyle.backgroundColor = "#f5f5f5";
      baseStyle.border = "1px solid #666";
    } else {
      // Remove edge-specific properties from node styles
      delete baseStyle.stroke;
      delete baseStyle.strokeWidth;
      delete baseStyle.strokeDasharray;
    }
  }
  const result = {
    style: baseStyle,
    animated,
    label: createTagLabel(appliedTags, originalLabel),
    appliedTags,
    markerEnd,
    lineStyle,
    waviness,
  };

  return result;
}
/**
 * Get default style for elements with no semantic tags
 */
function getDefaultStyle(
  elementType: "node" | "edge" = "edge",
): ProcessedStyle {
  if (elementType === "node") {
    return {
      style: {
        backgroundColor: "#f5f5f5",
        border: "1px solid #666",
      },
      animated: false,
      appliedTags: [],
    };
  }
  return {
    style: {
      stroke: DEFAULT_STYLE.DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STYLE.STROKE_WIDTH,
    },
    animated: false,
    appliedTags: [],
    markerEnd: { type: "arrowclosed" },
  };
}
/**
 * Create a label from semantic tags
 */
function createTagLabel(
  appliedTags: string[],
  originalLabel?: string,
): string | undefined {
  if (!appliedTags || appliedTags.length === 0) {
    return originalLabel;
  }
  // Use first character of each tag as abbreviation
  const tagLabels = appliedTags
    .map((tag) => tag.charAt(0).toUpperCase())
    .join("");
  if (originalLabel) {
    return `${originalLabel} [${tagLabels}]`;
  }
  return tagLabels.length > 0 ? tagLabels : undefined;
}
/**
 * Validate semantic mappings configuration
 */
export function validateSemanticMappings(
  semanticMappings: Record<
    string,
    Record<string, Record<string, string | number>>
  >,
): string[] {
  const errors: string[] = [];
  const stylePropertyToGroups: Record<string, string[]> = {};
  // Track which groups use each style property
  for (const [groupName, group] of Object.entries(semanticMappings)) {
    const groupStyleProperties = new Set<string>();
    // Collect all style properties used in this group
    for (const [, styleMapping] of Object.entries(group)) {
      for (const styleProperty of Object.keys(styleMapping)) {
        groupStyleProperties.add(styleProperty);
      }
    }
    // Track group usage for each style property
    for (const styleProperty of groupStyleProperties) {
      if (!stylePropertyToGroups[styleProperty]) {
        stylePropertyToGroups[styleProperty] = [];
      }
      stylePropertyToGroups[styleProperty].push(groupName);
    }
  }
  // Check for conflicts (same style property used in multiple groups)
  for (const [styleProperty, groups] of Object.entries(stylePropertyToGroups)) {
    if (groups.length > 1) {
      errors.push(
        `Style property "${styleProperty}" is used in multiple groups: ${groups.join(", ")}`,
      );
    }
  }
  return errors;
}
