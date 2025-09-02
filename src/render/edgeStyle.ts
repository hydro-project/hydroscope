/**
 * @fileoverview Shared helpers for edge styling and flags.
 */

import type { EdgeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';

type StyleCfg = {
  edgeColor?: string;
  edgeWidth?: number;
  edgeDashed?: boolean;
};

export type StrokeDefaults = {
  color?: string;
  width?: number;
  dash?: string;
};

/**
 * Compute stroke/style values with sensible fallbacks.
 * Precedence: explicit style -> provided defaults -> config -> hardcoded fallback.
 */
export function getStroke(
  styleCfg: StyleCfg,
  style: CSSProperties | undefined,
  defaults: StrokeDefaults = {}
) {
  const stroke = (style?.stroke ?? styleCfg.edgeColor ?? defaults.color ?? '#1976d2') as string;
  const strokeWidth = (style?.strokeWidth ?? styleCfg.edgeWidth ?? defaults.width ?? 2) as number;
  // Priority: explicit style -> explicit default dash -> cfg-based dash -> undefined
  const strokeDasharray = (style?.strokeDasharray ??
    defaults.dash ??
    (styleCfg.edgeDashed ? '6,6' : undefined)) as string | undefined;
  return { stroke, strokeWidth, strokeDasharray } as const;
}

/** Extract optional halo color. */
export function getHaloColor(style: CSSProperties | undefined): string | undefined {
  return (style as any)?.haloColor as string | undefined;
}

/** Return style object without haloColor property. */
export function stripHaloStyle(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style) return style;
  const { haloColor, ...rest } = style as CSSProperties & { haloColor?: string };
  return rest;
}

// Extended properties that might exist on edge data/style
interface ExtendedEdgeData {
  processedStyle?: {
    lineStyle?: string;
    waviness?: boolean;
  };
}

interface ExtendedEdgeStyle extends CSSProperties {
  lineStyle?: string;
  waviness?: boolean;
  filter?: string;
}

/** Whether this edge should render as a double line. */
export function isDoubleLineEdge(props: EdgeProps): boolean {
  const data = props.data as ExtendedEdgeData | undefined;
  const style = props.style as ExtendedEdgeStyle | undefined;
  return data?.processedStyle?.lineStyle === 'double' || style?.lineStyle === 'double';
}

/** Whether this edge should render with a wavy path. */
export function isWavyEdge(props: EdgeProps): boolean {
  const data = props.data as ExtendedEdgeData | undefined;
  const style = props.style as ExtendedEdgeStyle | undefined;
  return Boolean(
    style?.filter?.includes('edge-wavy') || data?.processedStyle?.waviness || style?.waviness
  );
}
