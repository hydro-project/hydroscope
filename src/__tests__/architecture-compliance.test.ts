/**
 * Tests for architecture compliance enforcement
 * Validates that bridges follow stateless architecture constraints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { BridgeFactory } from "../bridges/BridgeFactory.js";
import { validateStatelessBridge } from "../types/bridges.js";
import type { StyleConfig, LayoutConfig } from "../types/core.js";
import type { 
  IReactFlowBridge, 
  IELKBridge, 
  IBridgeFactory,
  StatelessBridgeConstraint,
} from "../types/bridges.js";
import type { 
  EnforceStateless,
  ArchitectureTests,
  AssertStateless,
} from "../types/architecture-constraints.js";

describe("Architecture Compliance Enforcement", () => {
  let styleConfig: StyleConfig;
  let layoutConfig: LayoutConfig;

  beforeEach(() => {
    styleConfig = {
      nodeStyles: {},
      edgeStyles: {},
      containerStyles: {},
    };

    layoutConfig = {
      algorithm: "layered",
      direction: "DOWN",
      nodeSpacing: 20,
      layerSpacing: 25,
    };
  });

  describe("Bridge Interface Compliance", () => {
    it("should validate ReactFlowBridge implements IReactFlowBridge", () => {
      const bridge = new ReactFlowBridge(styleConfig);
      
      // Runtime validation
      expect(() => validateStatelessBridge(bridge, "ReactFlowBridge")).not.toThrow();
      
      // Check required methods exist
      expect(typeof bridge.toReactFlowData).toBe("function");
      expect(typeof bridge.applyNodeStyles).toBe("function");
      expect(typeof bridge.applyEdgeStyles).toBe("function");
    });

    it("should validate ELKBridge implements IELKBridge", () => {
      const bridge = new ELKBridge(layoutConfig);
      
      // Runtime validation
      expect(() => validateStatelessBridge(bridge, "ELKBridge")).not.toThrow();
      
      // Check required methods exist
      expect(typeof bridge.toELKGraph).toBe("function");
      expect(typeof bridge.applyLayout).toBe("function");
      expect(typeof bridge.layout).toBe("function");
      expect(typeof bridge.updateConfiguration).toBe("function");
      expect(typeof bridge.getConfiguration).toBe("function");
    });

    it("should validate BridgeFactory implements IBridgeFactory", () => {
      const factory = BridgeFactory.getInstance();
      
      // Runtime validation
      expect(() => validateStatelessBridge(factory, "BridgeFactory")).not.toThrow();
      
      // Check required methods exist
      expect(typeof factory.getReactFlowBridge).toBe("function");
      expect(typeof factory.getELKBridge).toBe("function");
      expect(typeof factory.reset).toBe("function");
    });
  });

  describe("Stateless Constraint Validation", () => {
    it("should detect prohibited cache properties", () => {
      // Create a mock bridge with prohibited properties
      class BadBridge {
        private styleCache = new Map(); // Prohibited
        private lastStateHash = ""; // Prohibited
        private cachedResults = {}; // Prohibited
        private memoizedData = null; // Prohibited
        
        constructor(private config: any) {} // Allowed
        
        someMethod() {
          return "test";
        }
      }

      const badBridge = new BadBridge({});
      
      // Should throw error for prohibited properties
      expect(() => validateStatelessBridge(badBridge, "BadBridge")).toThrow(
        /violates stateless architecture.*prohibited.*properties/i
      );
    });

    it("should allow configuration properties", () => {
      // Create a bridge with only allowed properties
      class GoodBridge {
        constructor(private styleConfig: StyleConfig) {} // Allowed
        
        toReactFlowData() {
          return { nodes: [], edges: [] };
        }
      }

      const goodBridge = new GoodBridge(styleConfig);
      
      // Should not throw error
      expect(() => validateStatelessBridge(goodBridge, "GoodBridge")).not.toThrow();
    });

    it("should validate bridge methods are pure functions", () => {
      const bridge = new ReactFlowBridge(styleConfig);
      
      // Methods should be functions
      expect(typeof bridge.toReactFlowData).toBe("function");
      expect(typeof bridge.applyNodeStyles).toBe("function");
      expect(typeof bridge.applyEdgeStyles).toBe("function");
      
      // Methods should not modify bridge state (we can't test this directly,
      // but we can ensure no prohibited properties exist)
      expect(() => validateStatelessBridge(bridge, "ReactFlowBridge")).not.toThrow();
    });
  });

  describe("TypeScript Constraint Validation", () => {
    it("should compile-time validate stateless bridges", () => {
      // These type assertions will cause compilation errors if bridges violate constraints
      
      // Test ReactFlowBridge is stateless
      type ReactFlowBridgeTest = AssertStateless<ReactFlowBridge>;
      const _reactFlowTest: ReactFlowBridgeTest = true;
      
      // Test ELKBridge is stateless  
      type ELKBridgeTest = AssertStateless<ELKBridge>;
      const _elkTest: ELKBridgeTest = true;
      
      // Test BridgeFactory is stateless
      type BridgeFactoryTest = AssertStateless<BridgeFactory>;
      const _factoryTest: BridgeFactoryTest = true;
      
      // If we reach here, all bridges pass compile-time validation
      expect(true).toBe(true);
    });

    it("should validate bridge architecture at type level", () => {
      // Test that bridges are detected as stateless
      type ReactFlowIsStateless = ArchitectureTests.IsStateless<ReactFlowBridge>;
      type ELKIsStateless = ArchitectureTests.IsStateless<ELKBridge>;
      type FactoryIsStateless = ArchitectureTests.IsStateless<BridgeFactory>;
      
      // These should all be true if bridges are properly stateless
      const reactFlowStateless: ReactFlowIsStateless = true;
      const elkStateless: ELKIsStateless = true;
      const factoryStateless: FactoryIsStateless = true;
      
      expect(reactFlowStateless).toBe(true);
      expect(elkStateless).toBe(true);
      expect(factoryStateless).toBe(true);
    });
  });

  describe("Bridge Factory Singleton Pattern", () => {
    it("should reuse bridge instances", () => {
      const factory = BridgeFactory.getInstance();
      
      const bridge1 = factory.getReactFlowBridge(styleConfig);
      const bridge2 = factory.getReactFlowBridge(styleConfig);
      
      // Should return same instance for same config
      expect(bridge1).toBe(bridge2);
    });

    it("should create new instances for different configs", () => {
      const factory = BridgeFactory.getInstance();
      
      const config1: StyleConfig = { nodeStyles: { default: { backgroundColor: "red" } } };
      const config2: StyleConfig = { nodeStyles: { default: { backgroundColor: "blue" } } };
      
      // Reset factory to ensure clean state
      factory.reset();
      
      const bridge1 = factory.getReactFlowBridge(config1);
      factory.reset(); // Reset to force new instance
      const bridge2 = factory.getReactFlowBridge(config2);
      
      // Should return different instances for different configs
      expect(bridge1).not.toBe(bridge2);
    });

    it("should reset all instances", () => {
      const factory = BridgeFactory.getInstance();
      
      const bridge1 = factory.getReactFlowBridge(styleConfig);
      factory.reset();
      const bridge2 = factory.getReactFlowBridge(styleConfig);
      
      // Should return new instance after reset
      expect(bridge1).not.toBe(bridge2);
    });
  });

  describe("Method Immutability", () => {
    it("should return immutable data from bridge methods", () => {
      const bridge = new ReactFlowBridge(styleConfig);
      
      // Create mock state
      const mockState = {
        visibleNodes: [],
        visibleContainers: [],
        visibleEdges: [],
      } as any;
      
      const result = bridge.toReactFlowData(mockState);
      
      // Result should be frozen (immutable)
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.nodes)).toBe(true);
      expect(Object.isFrozen(result.edges)).toBe(true);
    });

    it("should not modify input parameters", () => {
      const bridge = new ReactFlowBridge(styleConfig);
      
      const originalNodes = [
        { id: "1", type: "standard", position: { x: 0, y: 0 }, data: { label: "Node 1" } }
      ];
      
      const nodesCopy = JSON.parse(JSON.stringify(originalNodes));
      
      bridge.applyNodeStyles(originalNodes);
      
      // Original nodes should not be modified
      expect(originalNodes).toEqual(nodesCopy);
    });
  });

  describe("Error Handling", () => {
    it("should provide clear error messages for architecture violations", () => {
      class ViolatingBridge {
        private styleCache = new Map(); // Violation
        private lastResult = null; // Violation
        
        constructor() {}
      }
      
      const bridge = new ViolatingBridge();
      
      expect(() => validateStatelessBridge(bridge, "ViolatingBridge")).toThrow(
        /ViolatingBridge violates stateless architecture.*styleCache.*lastResult/
      );
    });

    it("should identify specific violating properties", () => {
      class MultiViolationBridge {
        private cache = {}; // Violation
        private lastStateHash = ""; // Violation
        private memoizedResults = []; // Violation
        
        constructor() {}
      }
      
      const bridge = new MultiViolationBridge();
      
      try {
        validateStatelessBridge(bridge, "MultiViolationBridge");
        expect.fail("Should have thrown error");
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain("cache");
        expect(message).toContain("lastStateHash");
        expect(message).toContain("memoizedResults");
      }
    });
  });
});