/**
 * @fileoverview Handle Configuration for ReactFlow Nodes
 *
 * Centralized configuration for ReactFlow handles to maximize layout flexibility.
 */

import { Position } from '@xyflow/react';

export interface HandleConfig {
  id: string;
  position: Position;
  style?: React.CSSProperties;
}

/**
 * Handle strategy types
 */
export type HandleStrategy = 'discrete' | 'continuous';

/**
 * Handle styles for different strategies
 */
export const HANDLE_STYLES = {
  discrete: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    width: '6px',
    height: '6px',
    opacity: 0.3,
    borderRadius: '50%',
  },
  continuous: {
    background: 'transparent',
    border: 'none',
    width: '100%',
    height: '100%',
  },
} as const;

/**
 * Configuration for different handle strategies
 */
export const HANDLE_STRATEGIES = {
  /**
   * Discrete handles - specific connection points
   * Uses smart routing based on node positions
   */
  discrete: {
    enableContinuousHandles: false,
    sourceHandles: [
      {
        id: 'out-top',
        position: Position.Top,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'out-right',
        position: Position.Right,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'out-bottom',
        position: Position.Bottom,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'out-left',
        position: Position.Left,
        style: HANDLE_STYLES.discrete,
      },
    ] as HandleConfig[],
    targetHandles: [
      {
        id: 'in-top',
        position: Position.Top,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'in-right',
        position: Position.Right,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'in-bottom',
        position: Position.Bottom,
        style: HANDLE_STYLES.discrete,
      },
      {
        id: 'in-left',
        position: Position.Left,
        style: HANDLE_STYLES.discrete,
      },
    ] as HandleConfig[],
  },

  /**
   * Continuous handles (ReactFlow v12) - connections anywhere on perimeter
   */
  continuous: {
    enableContinuousHandles: true,
    sourceHandles: [] as HandleConfig[],
    targetHandles: [] as HandleConfig[],
  },
} as const;

/**
 * Current handle strategy - using discrete for better edge control
 */
export const CURRENT_HANDLE_STRATEGY: HandleStrategy = 'discrete';

/**
 * Get the current handle configuration
 */
export function getHandleConfig() {
  return HANDLE_STRATEGIES[CURRENT_HANDLE_STRATEGY];
}