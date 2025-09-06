/**
 * Edge Style Processor
 *
 * Processes edge properties and applies appropriate visual styles based on
 * the edgeStyleConfig from the JSON data.
 */

interface EdgeStyleMapping {
  reactFlowType?: string;
  style?: Record<string, unknown>;
  animated?: boolean;
  label?: string;
  styleTag?: string;
}

export interface EdgeStyleConfig {
  semanticMappings?: Record<string, Record<string, Record<string, string | number>>>;
  propertyMappings?: Record<string, string | EdgeStyleMapping>;
}

// Fixed style categories defined by the visualizer
export const EDGE_VISUAL_CHANNELS = {
  'line-pattern': ['solid', 'dashed', 'dotted', 'dash-dot'],
  'line-width': [1, 2, 3, 4],
  animation: ['static', 'animated'],
  'line-style': ['single', 'double'],
  halo: ['none', 'light-blue', 'light-red', 'light-green'],
  // collection markers; we map to native React Flow markers where possible
  arrowhead: ['none', 'triangle-open', 'triangle-filled', 'circle-filled', 'diamond-open'],
  // ordering
  waviness: ['none', 'wavy'],
} as const;

import type { CSSProperties } from 'react';
import { MarkerType } from '@xyflow/react';
import type { EdgeMarker } from '@xyflow/react';
import {
  EDGE_STYLE_TAG_MAPPINGS,
  HALO_COLOR_MAPPINGS,
  EDGE_PROPERTY_ABBREVIATIONS,
  EDGE_PROPERTY_DESCRIPTIONS,
  DEFAULT_EDGE_STYLE,
} from '../shared/config';

// Use ReactFlow's EdgeMarker type directly for better compatibility
export type MarkerSpec = EdgeMarker;

// Enhanced ProcessedEdgeStyle with proper typing
export interface ProcessedEdgeStyle {
  reactFlowType: string;
  style: CSSProperties & Record<string, unknown>;
  animated: boolean;
  label?: string;
  appliedProperties: string[];
  markerEndSpec?: MarkerSpec | string; // Can be object or URL string
  lineStyle?: 'single' | 'double';
}

/**
 * Process edge properties and return the appropriate visual style
 */
export function processEdgeStyle(
  edgeProperties: string[],
  styleConfig?: EdgeStyleConfig,
  originalLabel?: string
): ProcessedEdgeStyle {
  if (!edgeProperties || edgeProperties.length === 0) {
    return getDefaultStyle();
  }

  // If we have a style config from JSON, use it to map semantic tags to style tags
  if (styleConfig && (styleConfig.semanticMappings || styleConfig.propertyMappings)) {
    return processWithMappings(edgeProperties, styleConfig, originalLabel);
  }

  // Otherwise, in semantics-only mode do not interpret properties as style tags
  return getDefaultStyle();
}

/**
 * Process edges using semantic property mappings and style categories
 */
function processWithMappings(
  edgeProperties: string[],
  styleConfig: EdgeStyleConfig,
  originalLabel?: string
): ProcessedEdgeStyle {
  // Handle new semantic mappings system
  if (styleConfig.semanticMappings) {
    return processWithSemanticMappings(edgeProperties, styleConfig, originalLabel);
  }

  // Final fallback
  return processDirectStyleTags();
}

/**
 * Validate semantic mappings to ensure no style property appears in multiple groups
 * (but it's OK for the same style property to appear in different options within the same group)
 */
function validateSemanticMappings(
  semanticMappings: Record<string, Record<string, Record<string, string | number>>>
): void {
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
  const conflicts: string[] = [];
  for (const [styleProperty, groups] of Object.entries(stylePropertyToGroups)) {
    if (groups.length > 1) {
      conflicts.push(
        `Style property "${styleProperty}" is used in multiple groups: ${groups.join(', ')}`
      );
    }
  }

  if (conflicts.length > 0) {
    throw new Error(`Conflicting style property assignments detected:\n${conflicts.join('\n')}`);
  }
}

/**
 * Process edges using the new semantic→style mapping system
 */
function processWithSemanticMappings(
  edgeProperties: string[],
  styleConfig: EdgeStyleConfig,
  originalLabel?: string
): ProcessedEdgeStyle {
  if (!styleConfig.semanticMappings) {
    return getDefaultStyle();
  }

  // Validate the semantic mappings configuration
  validateSemanticMappings(styleConfig.semanticMappings);

  // Collect all style settings from matching semantic properties
  const styleSettings: Record<string, string | number> = {};
  const appliedProperties: string[] = [];

  // Process each group
  for (const [, group] of Object.entries(styleConfig.semanticMappings)) {
    // Find which option in this group matches our edge properties (if any)
    for (const [optionName, styleMapping] of Object.entries(group)) {
      if (edgeProperties.includes(optionName)) {
        // Apply all style settings from this option
        Object.assign(styleSettings, styleMapping);
        appliedProperties.push(optionName);
        break; // Only one option per group can match
      }
    }
  }

  // Convert style settings to ReactFlow format
  if (Object.keys(styleSettings).length > 0) {
    return convertStyleSettingsToReactFlow(styleSettings, appliedProperties, originalLabel);
  }

  return getDefaultStyle();
}

/**
 * Convert semantic style settings to ReactFlow visual format
 */
function convertStyleSettingsToReactFlow(
  styleSettings: Record<string, string | number>,
  appliedProperties: string[],
  originalLabel?: string
): ProcessedEdgeStyle {
  let style: Record<string, unknown> = {};
  let animated = false;
  let label = createEdgeLabel(appliedProperties, undefined, originalLabel);
  let markerEndSpec: MarkerSpec | string | undefined = undefined;

  // Apply line-pattern
  const linePattern = styleSettings['line-pattern'] as string;
  if (linePattern) {
    switch (linePattern) {
      case 'solid':
        style.strokeDasharray = undefined;
        break;
      case 'dashed':
        style.strokeDasharray = '8,4';
        break;
      case 'dotted':
        style.strokeDasharray = '2,2';
        break;
      case 'dash-dot':
        style.strokeDasharray = '8,2,2,2';
        break;
    }
  }

  // Apply line-width
  const lineWidth = styleSettings['line-width'] as number;
  if (lineWidth) {
    style.strokeWidth = lineWidth;
  }

  // Apply animation
  const animation = styleSettings['animation'] as string;
  if (animation === 'animated') {
    animated = true;
  }

  // Apply line-style (single/double)
  const lineStyle = styleSettings['line-style'] as string;
  if (lineStyle === 'double') {
    // For double lines, we'll use a dash pattern that looks like double lines
    style.strokeDasharray = '10,2,2,2';
  }

  // Apply waviness (path-based approach)
  const waviness = styleSettings['waviness'] as string;
  if (waviness === 'wavy') {
    // Use custom path generation instead of SVG filter
    style.waviness = 'wavy';
  }

  // Apply halo (pass halo info to edge component)
  const halo = styleSettings['halo'] as string;
  let strokeColor = DEFAULT_EDGE_STYLE.STROKE_COLOR;
  let haloColor: string | undefined = undefined;

  if (halo && halo !== 'none') {
    // Store halo color for edge component to use
    haloColor = HALO_COLOR_MAPPINGS[halo as keyof typeof HALO_COLOR_MAPPINGS];
    // Keep default stroke color for the main edge
  }

  // Apply arrowhead
  const arrowhead = styleSettings['arrowhead'] as string;
  if (arrowhead && arrowhead !== 'none') {
    // Map to React Flow marker types including custom markers
    switch (arrowhead) {
      case 'triangle-open':
        markerEndSpec = { type: MarkerType.Arrow }; // Built-in open triangle
        break;
      case 'triangle-filled':
        markerEndSpec = { type: MarkerType.ArrowClosed }; // Built-in filled triangle
        break;
      case 'circle-filled':
        // Use custom SVG marker for filled circles (Singleton)
        markerEndSpec = 'url(#circle-filled)';
        break;
      case 'diamond-open':
        // Use custom SVG marker for open diamonds (Optional)
        markerEndSpec = 'url(#diamond-open)';
        break;
    }
  }

  return {
    reactFlowType: 'standard',
    style: {
      stroke: strokeColor,
      strokeWidth: DEFAULT_EDGE_STYLE.STROKE_WIDTH,
      ...(haloColor && { haloColor }), // Pass halo color to edge component
      ...style,
    },
    animated,
    label,
    appliedProperties,
    markerEndSpec,
    lineStyle: lineStyle === 'double' ? 'double' : 'single',
  };
}

/**
 * Process edge properties as direct style tag names
 */
function processDirectStyleTags(): ProcessedEdgeStyle {
  // Disabled in semantics-only mode: return neutral default
  return getDefaultStyle();
}

/**
 * Map a style tag name to actual ReactFlow visual style
 */
function mapStyleTagToVisual(styleTag: string, originalProperties: string[]): ProcessedEdgeStyle {
  const normalizedTag = styleTag.toLowerCase().replace(/[_\s]/g, '-');
  const visualStyle =
    EDGE_STYLE_TAG_MAPPINGS[normalizedTag as keyof typeof EDGE_STYLE_TAG_MAPPINGS];

  if (visualStyle) {
    return {
      reactFlowType: 'standard',
      style: {
        stroke: DEFAULT_EDGE_STYLE.STROKE_COLOR,
        strokeWidth: DEFAULT_EDGE_STYLE.STROKE_WIDTH,
        ...visualStyle.style,
      },
      animated: visualStyle.animated ?? false,
      label: visualStyle.label,
      appliedProperties: originalProperties,
    };
  }

  // Unknown tag: return neutral default (no arbitrary colors)
  return {
    reactFlowType: 'standard',
    style: {
      stroke: DEFAULT_EDGE_STYLE.STROKE_COLOR,
      strokeWidth: DEFAULT_EDGE_STYLE.STROKE_WIDTH,
    },
    animated: false,
    label: '',
    appliedProperties: originalProperties,
  };
}

/**
 * Combine style tags using intelligent merging rules to handle conflicts
 */
/**
 * Combine style tags with priority resolution
 *
 * NOTE: This function is currently unused but kept for potential future use
 */
/*
function combineStyleTagsWithPriority(styleTags: string[], originalProperties: string[], styleConfig: EdgeStyleConfig): ProcessedEdgeStyle {
  // Start with default style
  let combinedStyle: Partial<ProcessedEdgeStyle> = {
    style: {
      stroke: '#666666',
      strokeWidth: 2
    }
  };
  let animated = false;
  let labels: string[] = [];
  
  // Group style tags by the CSS property they affect
  const styleGroups: Record<string, {tag: string, priority: number}[]> = {};
  
  for (const tag of styleTags) {
    const tagStyle = mapStyleTagToVisual(tag, []);
    
    // Assign priority based on boolean pair order (lower index = higher priority)
    let priority = 999;
    if (styleConfig.booleanPropertyPairs) {
      const pairIndex = styleConfig.booleanPropertyPairs.findIndex(pair => 
        pair.defaultStyle === tag || pair.altStyle === tag
      );
      if (pairIndex !== -1) {
        priority = pairIndex;
      }
    }
    
    // Group by CSS property
    for (const cssProp of Object.keys(tagStyle.style)) {
      if (!styleGroups[cssProp]) {
        styleGroups[cssProp] = [];
      }
      styleGroups[cssProp].push({ tag, priority });
    }
    
    // Handle non-style properties
    if (tagStyle.animated) {
      animated = true;
    }
    if (tagStyle.label) {
      labels.push(tagStyle.label);
    }
  }
  
  // For each CSS property, use the tag with highest priority (lowest index)
  for (const [cssProp, candidates] of Object.entries(styleGroups)) {
    // Sort by priority (lowest number = highest priority)
    candidates.sort((a, b) => a.priority - b.priority);
    const winningTag = candidates[0].tag;
    
    // Apply the winning tag's style for this property
    const tagStyle = mapStyleTagToVisual(winningTag, []);
    if (tagStyle.style[cssProp] !== undefined) {
      combinedStyle[cssProp] = tagStyle.style[cssProp];
    }
  }
  
  return {
    reactFlowType: 'standard',
    style: combinedStyle,
    animated: animated,
    label: labels.join(''),
    appliedProperties: originalProperties
  };
}
*/

/**
 * Combine multiple style tags into a single visual style (old method - kept for fallback)
 * NOTE: This function is currently unused but kept for potential future use
 */
/*
function combineStyleTags(styleTags: string[], originalProperties: string[]): ProcessedEdgeStyle {
  // Start with default style
  let combinedStyle: Partial<ProcessedEdgeStyle> = {
    style: {
      stroke: '#666666',
      strokeWidth: 2
    }
  };
  let animated = false;
  let labels: string[] = [];
  
  // Apply each style tag
  for (const tag of styleTags) {
    const tagStyle = mapStyleTagToVisual(tag, []);
    
    // Merge styles (later tags can override earlier ones)
    combinedStyle = { ...combinedStyle, ...tagStyle.style };
    
    // Animation is true if any tag enables it
    if (tagStyle.animated) {
      animated = true;
    }
    
    // Collect labels
    if (tagStyle.label) {
      labels.push(tagStyle.label);
    }
  }
  
  return {
    reactFlowType: 'standard',
    style: combinedStyle,
    animated: animated,
    label: labels.join(''),
    appliedProperties: originalProperties
  };
}
*/

/**
 * Get default style for edges with no properties
 */
function getDefaultStyle(): ProcessedEdgeStyle {
  return {
    reactFlowType: 'standard',
    style: {
      stroke: DEFAULT_EDGE_STYLE.DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_EDGE_STYLE.STROKE_WIDTH,
    },
    animated: false,
    appliedProperties: [],
  };
}

/**
 * Combine multiple edge properties into a single label
 */
export function createEdgeLabel(
  edgeProperties: string[],
  _styleConfig?: EdgeStyleConfig,
  originalLabel?: string
): string | undefined {
  if (!edgeProperties || edgeProperties.length === 0) {
    return originalLabel;
  }

  const propertyLabels = edgeProperties
    .map(
      prop =>
        EDGE_PROPERTY_ABBREVIATIONS[prop as keyof typeof EDGE_PROPERTY_ABBREVIATIONS] ||
        prop.charAt(0)
    )
    .join('');

  if (originalLabel) {
    return `${originalLabel} [${propertyLabels}]`;
  }

  return propertyLabels.length > 0 ? propertyLabels : undefined;
}

/**
 * Get a human-readable description of edge properties
 */
export function getEdgePropertiesDescription(
  edgeProperties: string[],
  _styleConfig?: EdgeStyleConfig
): string {
  if (!edgeProperties || edgeProperties.length === 0) {
    return 'No properties';
  }

  return edgeProperties
    .map(
      prop => EDGE_PROPERTY_DESCRIPTIONS[prop as keyof typeof EDGE_PROPERTY_DESCRIPTIONS] || prop
    )
    .join(', ');
}
