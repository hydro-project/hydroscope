/**
 * @fileoverview Layout module exports - Bridge Architecture Implementation
 *
 * Clean layout module using our bridge architecture.
 * No dependencies on alpha.
 */

// Core layout engine - bridge-based!
export { ELKLayoutEngine } from './ELKLayoutEngine';

// Re-export centralized layout configuration
export { DEFAULT_LAYOUT_CONFIG } from '../shared/config';

// Our own types
export type {
  LayoutConfig,
  LayoutResult,
  LayoutEngine,
  LayoutStatistics,
  LayoutEventData,
  LayoutEventCallback,
  PositionedNode,
  PositionedEdge,
  PositionedContainer,
  PositionedHyperEdge,
  Position,
} from '../core/types';

// Import types for local use
import type { LayoutConfig } from '../core/types';
import { DEFAULT_LAYOUT_CONFIG } from '../shared/config';

// Configuration helpers
export function getLayoutConfig(): LayoutConfig {
  return DEFAULT_LAYOUT_CONFIG;
}

export function createLayoutConfig(overrides: Partial<LayoutConfig>): LayoutConfig {
  return { ...DEFAULT_LAYOUT_CONFIG, ...overrides };
}

// Pre-defined configurations for compatibility
export const LAYOUT_CONFIGS = {
  default: DEFAULT_LAYOUT_CONFIG,
  compact: { ...DEFAULT_LAYOUT_CONFIG, spacing: 50 },
  spacious: { ...DEFAULT_LAYOUT_CONFIG, spacing: 150 },
} as const;
