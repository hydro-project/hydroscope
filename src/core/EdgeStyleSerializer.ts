/**
 * Edge Style Serializer
 * 
 * Shared utilities for serializing/deserializing ProcessedEdgeStyle objects
 * between regular edges and hyperedges to prevent drift and duplication.
 */

import type { ProcessedEdgeStyle } from './EdgeStyleProcessor';

/**
 * Serialize ProcessedEdgeStyle to JSON string for storage
 */
export function serializeProcessedStyle(styleResult: ProcessedEdgeStyle): string {
  return JSON.stringify({
    reactFlowType: styleResult.reactFlowType,
    style: styleResult.style,
    animated: styleResult.animated,
    appliedProperties: styleResult.appliedProperties,
    markerEndSpec: styleResult.markerEndSpec,
    label: styleResult.label,
    lineStyle: styleResult.lineStyle
  });
}

/**
 * Deserialize ProcessedEdgeStyle from JSON string
 */
export function deserializeProcessedStyle(styleJson: string): ProcessedEdgeStyle | null {
  try {
    const parsed = JSON.parse(styleJson);
    return {
      reactFlowType: parsed.reactFlowType || 'standard',
      style: parsed.style || {},
      animated: parsed.animated || false,
      appliedProperties: parsed.appliedProperties || [],
      markerEndSpec: parsed.markerEndSpec,
      label: parsed.label,
      lineStyle: parsed.lineStyle
    };
  } catch (e) {
    console.warn('Failed to parse ProcessedEdgeStyle JSON:', e);
    return null;
  }
}