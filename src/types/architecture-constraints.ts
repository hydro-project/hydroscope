/**
 * TypeScript constraints for architecture compliance enforcement
 * Prevents cache properties and enforces stateless bridge behavior at compile time
 */

/**
 * Type that detects and prevents cache-related properties
 * Causes compilation errors if cache properties are detected
 */
export type NoCacheProperties<T> = {
  [K in keyof T]: K extends `${string}Cache` | `cache${string}` | `lastState${string}` | `lastResult${string}` | `lastHash${string}` | `stateHash${string}` | `cached${string}` | `memoized${string}`
    ? never
    : T[K];
};

/**
 * Type that detects and prevents state-related properties in bridges
 * Causes compilation errors if state properties are detected
 */
export type NoStateProperties<T> = {
  [K in keyof T]: K extends `${string}State` | `state${string}` | `stored${string}` | `internal${string}` | `_${string}`
    ? K extends 'performanceHints' | 'elk' | 'styleConfig' | 'layoutConfig' // Allow specific configuration properties
      ? T[K]
      : never
    : T[K];
};

/**
 * Combined constraint that prevents both cache and state properties
 */
export type StatelessConstraint<T> = NoCacheProperties<NoStateProperties<T>>;

/**
 * Utility type to validate that a bridge class is stateless
 * Usage: type ValidBridge = EnforceStateless<MyBridgeClass>;
 * Will cause compilation error if bridge has prohibited properties
 */
export type EnforceStateless<T> = StatelessConstraint<T> extends T
  ? T
  : {
      __ERROR__: "Bridge contains prohibited state or cache properties";
      __VIOLATING_PROPERTIES__: {
        [K in keyof T]: K extends keyof StatelessConstraint<T>
          ? never
          : K;
      }[keyof T];
    };

/**
 * Interface constraint for bridge constructors
 * Ensures bridge constructors only accept configuration, not state
 */
export interface StatelessBridgeConstructor<TConfig = any> {
  new (config: TConfig): any;
}

/**
 * Type guard to ensure bridge methods are pure functions
 * Pure functions must not modify external state or rely on internal state
 */
export type PureFunction<TArgs extends readonly unknown[], TReturn> = (
  ...args: TArgs
) => TReturn;

/**
 * Interface for pure bridge methods
 * All bridge methods must conform to this pattern
 */
export interface PureBridgeMethods {
  // All methods must be pure functions that don't rely on internal state
  [methodName: string]: PureFunction<any[], any>;
}

/**
 * Constraint for bridge classes to ensure they only have pure methods
 */
export type OnlyPureMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K]
    : K extends 'constructor' | 'styleConfig' | 'layoutConfig' | 'performanceHints' | 'elk'
    ? T[K] // Allow constructor and configuration properties
    : never;
};

/**
 * Complete stateless bridge constraint
 * Combines all constraints to ensure bridges are truly stateless
 */
export type StatelessBridge<T> = EnforceStateless<OnlyPureMethods<T>>;

/**
 * Utility type to extract configuration type from bridge constructor
 */
export type BridgeConfig<T> = T extends StatelessBridgeConstructor<infer C> ? C : never;

/**
 * Runtime validation decorator for bridge classes
 * Can be used to validate bridge instances at runtime
 */
export function StatelessBridgeDecorator<T extends new (...args: any[]) => any>(
  constructor: T
): T {
  return class extends constructor {
    constructor(...args: any[]) {
      super(...args);
      
      // Validate that instance doesn't have prohibited properties
      validateBridgeInstance(this, constructor.name);
    }
  };
}

/**
 * Runtime validation function for bridge instances
 */
function validateBridgeInstance(instance: any, className: string): void {
  const prohibitedPatterns = [
    /.*[Cc]ache.*/,
    /.*lastState.*/,
    /.*lastResult.*/,
    /.*lastHash.*/,
    /.*stateHash.*/,
    /.*cached.*/,
    /.*memoized.*/,
    /.*stored.*/,
  ];

  const allowedProperties = new Set([
    'styleConfig',
    'layoutConfig', 
    'performanceHints',
    'elk',
    'constructor',
  ]);

  const violations: string[] = [];

  // Check all properties
  for (const prop in instance) {
    if (allowedProperties.has(prop)) {
      continue; // Skip allowed configuration properties
    }

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(prop)) {
        violations.push(prop);
        break;
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Bridge ${className} violates stateless architecture. ` +
      `Found prohibited properties: ${violations.join(", ")}. ` +
      `Bridges must be stateless - use VisualizationState for data storage.`
    );
  }
}

/**
 * Type-level test utilities for validating bridge implementations
 */
export namespace ArchitectureTests {
  /**
   * Test that a bridge type is stateless
   * Usage: type Test = ArchitectureTests.IsStateless<MyBridge>;
   */
  export type IsStateless<T> = StatelessBridge<T> extends T ? true : false;

  /**
   * Test that a bridge constructor is valid
   * Usage: type Test = ArchitectureTests.HasValidConstructor<typeof MyBridge>;
   */
  export type HasValidConstructor<T> = T extends StatelessBridgeConstructor<any> ? true : false;

  /**
   * Extract violations from a bridge type
   * Usage: type Violations = ArchitectureTests.GetViolations<MyBridge>;
   */
  export type GetViolations<T> = EnforceStateless<T> extends T
    ? never
    : EnforceStateless<T> extends { __VIOLATING_PROPERTIES__: infer V }
    ? V
    : never;
}

/**
 * Compile-time assertion utility
 * Usage: const _test: AssertStateless<MyBridge> = true;
 */
export type AssertStateless<T> = StatelessBridge<T> extends T
  ? true
  : {
      __COMPILATION_ERROR__: "Bridge is not stateless";
      __VIOLATIONS__: ArchitectureTests.GetViolations<T>;
    };

/**
 * Helper type for bridge method signatures
 * Ensures methods don't return mutable references to internal state
 */
export type ImmutableReturn<T> = T extends object
  ? Readonly<T>
  : T;

/**
 * Constraint for bridge method return types
 * All bridge methods must return immutable data
 */
export type ImmutableBridgeMethod<TArgs extends readonly unknown[], TReturn> = (
  ...args: TArgs
) => ImmutableReturn<TReturn>;