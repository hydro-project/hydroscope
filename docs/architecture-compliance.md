# Architecture Compliance Enforcement

This document describes the architecture compliance enforcement system implemented to ensure bridges remain stateless and follow the established architectural patterns.

## Overview

The Hydroscope architecture requires that:
1. **VisualizationState** is the single source of truth for all data
2. **Bridge components** are stateless and contain no internal caches or state
3. **All bridge methods** are pure functions that don't rely on internal state
4. **Data flows** through VisualizationState, not between bridges directly

## Enforcement Mechanisms

### 1. TypeScript Constraints

#### Bridge Interfaces
- `IReactFlowBridge` - Enforces stateless ReactFlow bridge behavior
- `IELKBridge` - Enforces stateless ELK bridge behavior  
- `IBridgeFactory` - Enforces singleton factory pattern

#### Type-Level Constraints
```typescript
// Prevents cache properties at compile time
type NoCacheProperties<T> = {
  [K in keyof T]: K extends `${string}Cache` | `cache${string}` 
    ? never 
    : T[K];
};

// Validates bridge is stateless
type StatelessBridge<T> = EnforceStateless<OnlyPureMethods<T>>;

// Compile-time assertion
type ValidBridge = AssertStateless<MyBridge>;
```

#### Method Signatures
All bridge methods use `ImmutableBridgeMethod` type to ensure:
- Methods are pure functions
- Return values are immutable
- No side effects on internal state

### 2. ESLint Rules

#### `no-bridge-state`
Prevents private state properties in bridge classes:
```javascript
// ❌ Prohibited
class MyBridge {
  private cache = new Map(); // Error: prohibited cache property
  private lastState = null;  // Error: prohibited state property
}

// ✅ Allowed
class MyBridge {
  constructor(private config: StyleConfig) {} // Configuration OK
  
  toReactFlowData(state: VisualizationState) { // Pure function OK
    return processData(state);
  }
}
```

#### `enforce-bridge-interfaces`
Ensures bridge classes implement required interfaces:
```typescript
// ❌ Missing interface
class ReactFlowBridge {
  // Error: must implement IReactFlowBridge
}

// ✅ Implements interface
class ReactFlowBridge implements IReactFlowBridge {
  // All required methods must be implemented
}
```

### 3. Runtime Validation

#### `validateStatelessBridge()`
Runtime function that checks bridge instances for prohibited properties:
```typescript
const bridge = new ReactFlowBridge(config);
validateStatelessBridge(bridge, "ReactFlowBridge"); // Throws if violations found
```

#### Prohibited Patterns
The system detects these patterns as violations:
- `*Cache*` - Any cache-related properties
- `lastState*` - State tracking properties
- `lastResult*` - Result caching properties
- `*Hash*` - Hash-based caching
- `cached*` - Cached data properties
- `memoized*` - Memoization properties

#### Allowed Patterns
These patterns are allowed for configuration:
- `styleConfig` - Style configuration
- `layoutConfig` - Layout configuration
- `performanceHints` - Performance optimization hints
- `elk` - ELK library instance

## Usage Examples

### Correct Bridge Implementation
```typescript
import type { IReactFlowBridge } from "../types/bridges.js";

export class ReactFlowBridge implements IReactFlowBridge {
  constructor(private styleConfig: StyleConfig) {}

  // Pure function - no internal state
  toReactFlowData(state: VisualizationState): ReactFlowData {
    const nodes = this.convertNodes(state);
    const edges = this.convertEdges(state);
    
    return Object.freeze({ nodes, edges }); // Immutable result
  }

  // Pure function - no caching
  applyNodeStyles(nodes: ReactFlowNode[]): ReactFlowNode[] {
    return nodes.map(node => ({
      ...node,
      style: this.calculateStyle(node),
    }));
  }
}
```

### Incorrect Bridge Implementation
```typescript
// ❌ This will trigger linting errors and runtime validation failures
export class BadBridge {
  private cache = new Map(); // Prohibited cache
  private lastStateHash = ""; // Prohibited state tracking
  
  toReactFlowData(state: VisualizationState): ReactFlowData {
    // Check cache first (violates stateless principle)
    const hash = this.generateHash(state);
    if (this.lastStateHash === hash) {
      return this.cache.get(hash); // Using internal cache
    }
    
    // Process and cache result (violates stateless principle)
    const result = this.processState(state);
    this.cache.set(hash, result);
    this.lastStateHash = hash;
    
    return result;
  }
}
```

## Testing Architecture Compliance

### Unit Tests
```typescript
describe("Architecture Compliance", () => {
  it("should validate bridge is stateless", () => {
    const bridge = new ReactFlowBridge(config);
    expect(() => validateStatelessBridge(bridge, "ReactFlowBridge")).not.toThrow();
  });

  it("should enforce immutable return values", () => {
    const bridge = new ReactFlowBridge(config);
    const result = bridge.toReactFlowData(state);
    
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nodes)).toBe(true);
    expect(Object.isFrozen(result.edges)).toBe(true);
  });
});
```

### Type-Level Tests
```typescript
// Compile-time validation
type ReactFlowBridgeTest = AssertStateless<ReactFlowBridge>;
const _test: ReactFlowBridgeTest = true; // Compilation error if bridge has state

// Architecture validation
type IsStateless = ArchitectureTests.IsStateless<ReactFlowBridge>;
const _isStateless: IsStateless = true; // Must be true for stateless bridges
```

## Integration with Build Process

### ESLint Configuration
```javascript
// eslint.config.js
export default [
  {
    plugins: {
      'hydroscope-architecture': hydroscopeArchitecture,
    },
    rules: {
      'hydroscope-architecture/no-bridge-state': 'error',
      'hydroscope-architecture/enforce-bridge-interfaces': 'error',
    },
  },
];
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## Benefits

### 1. Prevents Floating Edge Bugs
By ensuring bridges don't cache stale data, edge positioning is always calculated from current state.

### 2. Predictable Behavior
Stateless bridges guarantee that the same input always produces the same output.

### 3. Easier Testing
Pure functions are easier to test and reason about.

### 4. Better Performance
No memory leaks from unbounded caches or stale references.

### 5. Architectural Consistency
Enforces the single source of truth principle throughout the codebase.

## Troubleshooting

### Common Violations

#### Cache Properties
```typescript
// ❌ Prohibited
private styleCache = new Map();
private nodeCache = {};
private lastResult = null;

// ✅ Use VisualizationState instead
// Let VisualizationState handle caching if needed
```

#### State Tracking
```typescript
// ❌ Prohibited
private lastStateHash = "";
private previousNodes = [];

// ✅ Pure function approach
toReactFlowData(state: VisualizationState) {
  // Always process from current state
  return this.processCurrentState(state);
}
```

#### Memoization
```typescript
// ❌ Prohibited internal memoization
private memoizedResults = new Map();

// ✅ Let VisualizationState handle optimization
// Or use external memoization libraries if needed
```

### Fixing Violations

1. **Remove prohibited properties** - Delete cache and state tracking properties
2. **Implement interfaces** - Add `implements IXxxBridge` to class declaration
3. **Import bridge types** - Add import from `../types/bridges.js`
4. **Make methods pure** - Ensure methods don't rely on internal state
5. **Return immutable data** - Use `Object.freeze()` on return values

### Performance Concerns

If removing caches causes performance issues:

1. **Add caching to VisualizationState** - Centralized caching is allowed
2. **Use external memoization** - Libraries like `memoize-one` can be used externally
3. **Optimize algorithms** - Improve algorithmic efficiency instead of caching
4. **Profile before optimizing** - Measure actual performance impact

## Future Enhancements

1. **Automated fixes** - ESLint rules with auto-fix capabilities
2. **Performance monitoring** - Track bridge method performance
3. **Documentation generation** - Auto-generate bridge API docs from interfaces
4. **Integration tests** - End-to-end tests for architecture compliance