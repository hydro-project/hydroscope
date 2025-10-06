/**
 * Bridge interface definitions for architecture compliance enforcement
 * These interfaces ensure bridges remain stateless and follow architectural constraints
 */

import type { VisualizationState } from "../core/VisualizationState.js";
import type {
  ReactFlowData,
  ELKNode,
  LayoutConfig,
  StyleConfig,
} from "./core.js";
import type {
  ImmutableReturn,
  ImmutableBridgeMethod,
} from "./architecture-constraints.js";

/**
 * Base interface for all stateless bridges
 * Enforces architectural constraint: No private state allowed
 */
export interface StatelessBridge {
  // Bridges MUST NOT have private state properties
  // This is enforced through TypeScript constraints and linting rules
}

/**
 * Interface for ReactFlow bridge - enforces stateless behavior
 * All methods must be pure functions without side effects
 */
export interface IReactFlowBridge extends StatelessBridge {
  /**
   * Convert VisualizationState to ReactFlow data format
   * MUST be a pure function - same input always produces same output
   * MUST NOT rely on internal state or caching
   * 
   * @param state - Current visualization state (single source of truth)
   * @param interactionHandler - Optional interaction handler for events
   * @returns Immutable ReactFlow data structure
   */
  toReactFlowData: ImmutableBridgeMethod<
    [VisualizationState, any?],
    ReactFlowData
  >;

  /**
   * Apply styling to nodes - pure function
   * MUST NOT cache results internally
   * 
   * @param nodes - Array of ReactFlow nodes to style
   * @returns New array with styled nodes (immutable)
   */
  applyNodeStyles: ImmutableBridgeMethod<[any[]], any[]>;

  /**
   * Apply styling to edges - pure function
   * MUST NOT cache results internally
   * 
   * @param edges - Array of ReactFlow edges to style
   * @param state - Current visualization state for context
   * @returns New array with styled edges (immutable)
   */
  applyEdgeStyles: ImmutableBridgeMethod<[any[], VisualizationState], any[]>;
}

/**
 * Interface for ELK bridge - enforces stateless behavior
 * All methods must be pure functions without side effects
 */
export interface IELKBridge extends StatelessBridge {
  /**
   * Convert VisualizationState to ELK graph format
   * MUST be a pure function - same input always produces same output
   * MUST NOT rely on internal state or caching
   * 
   * @param state - Current visualization state (single source of truth)
   * @returns ELK graph structure for layout calculation
   */
  toELKGraph: ImmutableBridgeMethod<[VisualizationState], ELKNode>;

  /**
   * Apply ELK layout results to VisualizationState
   * MUST only update the passed state, no internal state changes
   * 
   * @param state - Visualization state to update with layout results
   * @param elkResult - ELK layout calculation results
   */
  applyLayout(state: VisualizationState, elkResult: ELKNode): void;

  /**
   * Perform complete layout calculation and application
   * Combines toELKGraph, ELK calculation, and applyLayout
   * 
   * @param state - Visualization state to layout
   */
  layout(state: VisualizationState): Promise<void>;

  /**
   * Update bridge configuration
   * MUST NOT affect internal state, only configuration
   * 
   * @param config - New layout configuration
   */
  updateConfiguration(config: Partial<LayoutConfig>): void;

  /**
   * Get current configuration (read-only)
   * MUST return immutable copy
   */
  getConfiguration: ImmutableBridgeMethod<[], Readonly<LayoutConfig>>;
}

/**
 * Factory interface for creating stateless bridge instances
 * Enforces singleton pattern to prevent unnecessary instantiation
 */
export interface IBridgeFactory {
  /**
   * Get or create ReactFlow bridge instance
   * MUST return stateless bridge
   * 
   * @param styleConfig - Style configuration for the bridge (optional, defaults to empty config)
   */
  getReactFlowBridge(styleConfig?: StyleConfig): IReactFlowBridge;

  /**
   * Get or create ELK bridge instance
   * MUST return stateless bridge
   * 
   * @param layoutConfig - Layout configuration for the bridge (optional, defaults to empty config)
   */
  getELKBridge(layoutConfig?: LayoutConfig): IELKBridge;

  /**
   * Reset all bridge instances
   * Used for testing and configuration changes
   */
  reset(): void;
}

/**
 * Type constraint to prevent private state in bridge implementations
 * This type will cause compilation errors if bridges have private state properties
 */
export type BridgeStatelessConstraint<T> = T extends {
  // Detect common cache property patterns
  [K in keyof T]: K extends `${string}Cache` | `cache${string}` | `lastState${string}` | `lastResult${string}` | `lastHash${string}`
    ? never
    : T[K];
}
  ? T
  : never;

/**
 * Utility type to validate bridge implementations at compile time
 * Usage: type ValidBridge = ValidateStatelessBridge<MyBridgeClass>;
 */
export type ValidateStatelessBridge<T> = BridgeStatelessConstraint<T> extends never
  ? {
      error: "Bridge contains prohibited state properties. Bridges must be stateless.";
      violatingProperties: {
        [K in keyof T]: K extends `${string}Cache` | `cache${string}` | `lastState${string}` | `lastResult${string}` | `lastHash${string}`
          ? K
          : never;
      }[keyof T];
    }
  : T;

/**
 * Runtime validation function to check bridge instances
 * Can be used in tests to ensure bridges don't have prohibited properties
 */
export function validateStatelessBridge(bridge: any, bridgeName: string): void {
  const prohibitedPatterns = [
    /.*[Cc]ache.*/,
    /.*lastState.*/,
    /.*lastResult.*/,
    /.*lastHash.*/,
    /.*stateHash.*/,
    /.*cached.*/,
    /.*[Mm]emoized.*/,
    /.*stored.*/,
  ];

  const violations: string[] = [];

  // Check all enumerable properties
  for (const prop in bridge) {
    if (bridge.hasOwnProperty(prop)) {
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(prop)) {
          violations.push(prop);
          break;
        }
      }
    }
  }

  // Check prototype properties (private properties)
  const proto = Object.getPrototypeOf(bridge);
  if (proto && proto.constructor && proto.constructor !== Object) {
    const descriptor = Object.getOwnPropertyDescriptors(proto);
    for (const prop in descriptor) {
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(prop)) {
          violations.push(`${prop} (private)`);
          break;
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Bridge ${bridgeName} violates stateless architecture. ` +
      `Found prohibited state properties: ${violations.join(", ")}. ` +
      `Bridges must be stateless - use VisualizationState for data storage.`
    );
  }
}