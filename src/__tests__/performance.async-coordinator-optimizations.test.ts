/**
 * Test for AsyncCoordinator performance optimizations (Task 8)
 * Verifies: State change detection, layout skipping, FitView optimization, performance logging
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestNode } from "../utils/testData.js";

describe("AsyncCoordinator Performance Optimizations (Task 8)", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    asyncCoordinator = new AsyncCoordinator();
  });

  describe("State Change Detection (Optimization 1)", () => {
    it("should skip layout when no significant state changes are detected", async () => {
      // Setup test data
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture optimization logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // First execution - should perform layout (no previous state)
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [], // Empty array allows optimization
        fitView: false
      });

      // Second execution with same state - should skip layout
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [], // Empty array allows optimization
        fitView: false
      });

      // Verify optimization was applied
      const optimizationLog = debugLogs.find(log => 
        log[0].includes('Layout optimization: Skipping unnecessary layout')
      );
      expect(optimizationLog).toBeDefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should not skip layout when full layout is requested", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Execute with full layout (undefined relayoutEntities)
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: undefined, // Full layout - should not skip
        fitView: false
      });

      // Verify layout was not skipped
      const skipLog = debugLogs.find(log => 
        log[0].includes('Layout optimization: Skipping unnecessary layout')
      );
      expect(skipLog).toBeUndefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should not skip layout when specific entities are requested", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Execute with specific entities
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: ["container1"], // Specific entities - should not skip
        fitView: false
      });

      // Verify layout was not skipped
      const skipLog = debugLogs.find(log => 
        log[0].includes('Layout optimization: Skipping unnecessary layout')
      );
      expect(skipLog).toBeUndefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should detect significant state changes and perform layout", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // First execution
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Add another node (significant state change)
      const node2 = createTestNode("n2", "Node 2");
      state.addNode(node2);

      // Second execution - should detect change and perform layout
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify significant changes were detected
      const changesLog = debugLogs.find(log => 
        log[0].includes('Significant changes detected, layout required')
      );
      expect(changesLog).toBeDefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should fail fast on state analysis failures", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock the state snapshot creation to fail (this is where the optimization logic is)
      const originalCreateSnapshot = (asyncCoordinator as any)._createEphemeralStateSnapshot;
      (asyncCoordinator as any)._createEphemeralStateSnapshot = () => {
        throw new Error("State analysis failed");
      };

      // Execute pipeline - should fail fast with clear error
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, {
          relayoutEntities: [],
          fitView: false
        })
      ).rejects.toThrow("State analysis failed");

      // Restore original method
      (asyncCoordinator as any)._createEphemeralStateSnapshot = originalCreateSnapshot;
    });
  });

  describe("FitView Optimization (Optimization 2)", () => {
    it("should optimize FitView options based on node count", async () => {
      // Create large graph (>100 nodes)
      for (let i = 0; i < 150; i++) {
        const node = createTestNode(`n${i}`, `Node ${i}`);
        state.addNode(node);
      }

      // Mock console.debug to capture optimization logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Setup FitView callback to capture optimized options
      let fitViewOptions: any = null;
      asyncCoordinator.onFitViewRequested = (options) => {
        fitViewOptions = options;
      };

      // Execute pipeline with FitView enabled
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 50, duration: 300 }
      });

      // Verify FitView optimization was applied
      const optimizationLog = debugLogs.find(log => 
        log[0].includes('FitView callback triggered successfully') &&
        log[1].optimized === true
      );
      expect(optimizationLog).toBeDefined();

      // Verify options were optimized for large graph
      expect(fitViewOptions).toBeDefined();
      expect(fitViewOptions.duration).toBeLessThanOrEqual(150); // Reduced for large graph
      expect(fitViewOptions.padding).toBeLessThanOrEqual(20); // Reduced for large graph

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should skip FitView when no visible nodes exist", async () => {
      // Create state with no visible nodes by not adding any nodes
      // (empty state should result in no visible nodes)

      // Mock console.debug to capture optimization logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Setup FitView callback to track if it's called
      let fitViewCalled = false;
      asyncCoordinator.onFitViewRequested = () => {
        fitViewCalled = true;
      };

      // Execute pipeline with FitView enabled on empty state
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true
      });

      // Verify FitView was skipped
      expect(fitViewCalled).toBe(false);

      // Verify optimization was logged
      const optimizationLog = debugLogs.find(log => 
        log[0].includes('FitView optimization: Skipping unnecessary FitView operation')
      );
      expect(optimizationLog).toBeDefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should fail fast on FitView optimization failures", async () => {
      const node = createTestNode("n1", "Node 1");
      state.addNode(node);

      // Mock the FitView optimization method to throw an error
      const originalOptimizeFitView = (asyncCoordinator as any)._optimizeFitViewExecution;
      let optimizationCalled = false;
      (asyncCoordinator as any)._optimizeFitViewExecution = () => {
        optimizationCalled = true;
        throw new Error("FitView optimization failed");
      };

      // Setup FitView callback to ensure it's available
      asyncCoordinator.onFitViewRequested = () => {};

      // Execute pipeline with FitView enabled - should fail fast with clear error
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, {
          relayoutEntities: [],
          fitView: true
        })
      ).rejects.toThrow("FitView optimization failed");

      // Verify optimization was actually called
      expect(optimizationCalled).toBe(true);

      // Restore original method
      (asyncCoordinator as any)._optimizeFitViewExecution = originalOptimizeFitView;
    });
  });

  describe("Performance Logging (Optimization 3)", () => {
    it("should log comprehensive performance metrics", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture performance logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Execute pipeline
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true
      });

      // Verify performance metrics were logged
      const performanceLog = debugLogs.find(log => 
        log[0].includes('Pipeline Performance Metrics')
      );
      expect(performanceLog).toBeDefined();

      // Verify metrics structure
      const metrics = performanceLog[1];
      expect(metrics.totalDuration).toBeDefined();
      expect(metrics.optimizationSavings).toBeDefined();
      expect(metrics.optimizationEfficiency).toBeDefined();
      expect(metrics.stateChangeDetection).toBeDefined();
      expect(metrics.layoutDuration).toBeDefined();
      expect(metrics.renderDuration).toBeDefined();
      expect(metrics.performanceClass).toBeDefined();
      expect(metrics.nodesCount).toBeDefined();
      expect(metrics.edgesCount).toBeDefined();

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should classify performance correctly", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock console.debug to capture performance logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // Execute pipeline (should be fast for single node)
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify performance classification
      const performanceLog = debugLogs.find(log => 
        log[0].includes('Pipeline Performance Metrics')
      );
      expect(performanceLog).toBeDefined();

      const metrics = performanceLog[1];
      expect(['excellent', 'good', 'acceptable']).toContain(metrics.performanceClass);

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should log performance warnings for slow execution", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock ELK bridge to be slow
      const originalLayout = elkBridge.layout;
      elkBridge.layout = async (state) => {
        // Simulate slow layout
        await new Promise(resolve => setTimeout(resolve, 1100)); // > 1000ms threshold
        return originalLayout.call(elkBridge, state);
      };

      // Mock console.warn to capture warnings
      const originalConsoleWarn = console.warn;
      const warnLogs: any[] = [];
      console.warn = (...args: any[]) => {
        warnLogs.push(args);
      };

      // Execute pipeline
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: undefined, // Full layout to trigger slow path
        fitView: false
      });

      // Verify performance warning was logged
      const warningLog = warnLogs.find(log => 
        log[0].includes('Pipeline performance warning: Slow execution detected')
      );
      expect(warningLog).toBeDefined();

      // Verify suggestions were provided
      const warningData = warningLog[1];
      expect(warningData.suggestions).toBeDefined();
      expect(Array.isArray(warningData.suggestions)).toBe(true);

      // Restore original methods
      elkBridge.layout = originalLayout;
      console.warn = originalConsoleWarn;
    }, 10000); // Increase timeout for slow test

    it("should generate performance improvement suggestions", async () => {
      // Create large graph to trigger suggestions
      for (let i = 0; i < 50; i++) {
        const node = createTestNode(`n${i}`, `Node ${i}`);
        state.addNode(node);
      }

      // Mock ELK bridge to be slow
      const originalLayout = elkBridge.layout;
      elkBridge.layout = async (state) => {
        await new Promise(resolve => setTimeout(resolve, 1100)); // Slow layout
        return originalLayout.call(elkBridge, state);
      };

      // Mock console.warn to capture warnings
      const originalConsoleWarn = console.warn;
      const warnLogs: any[] = [];
      console.warn = (...args: any[]) => {
        warnLogs.push(args);
      };

      // Execute pipeline with full layout (should trigger suggestions)
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: undefined, // Full layout
        fitView: false
      });

      // Verify suggestions were generated
      const warningLog = warnLogs.find(log => 
        log[0].includes('Pipeline performance warning')
      );
      expect(warningLog).toBeDefined();

      const suggestions = warningLog[1].suggestions;
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s: string) => s.includes('constrained layout'))).toBe(true);

      // Restore original methods
      elkBridge.layout = originalLayout;
      console.warn = originalConsoleWarn;
    }, 10000); // Increase timeout for slow test

    it("should use only local variables for performance tracking (no persistent caches)", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Execute pipeline multiple times
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify no persistent performance caches are created
      // (This is verified by the fact that the class only has _lastStateSnapshot as the only performance-related property)
      const coordinatorKeys = Object.keys(asyncCoordinator as any);
      const performanceCacheKeys = coordinatorKeys.filter(key => 
        key.includes('performance') || key.includes('cache') || key.includes('metrics')
      );
      
      // Should only have _lastStateSnapshot (which is ephemeral state comparison, not persistent cache)
      expect(performanceCacheKeys.length).toBeLessThanOrEqual(1);
      if (performanceCacheKeys.length === 1) {
        expect(performanceCacheKeys[0]).toBe('_lastStateSnapshot');
      }
    });
  });

  describe("Stateless Optimization Requirements", () => {
    it("should not add persistent caches outside VisualizationState", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Get initial AsyncCoordinator properties
      const initialKeys = Object.keys(asyncCoordinator as any);

      // Execute pipeline multiple times
      for (let i = 0; i < 5; i++) {
        await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
          relayoutEntities: [],
          fitView: false
        });
      }

      // Get final AsyncCoordinator properties
      const finalKeys = Object.keys(asyncCoordinator as any);

      // Verify no new persistent properties were added
      expect(finalKeys.length).toBeLessThanOrEqual(initialKeys.length + 1); // Allow _lastStateSnapshot
      
      // If a new property was added, it should only be _lastStateSnapshot
      const newKeys = finalKeys.filter(key => !initialKeys.includes(key));
      if (newKeys.length > 0) {
        expect(newKeys).toEqual(['_lastStateSnapshot']);
      }
    });

    it("should use VisualizationState's existing cache invalidation mechanisms", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock VisualizationState to have cache version
      let cacheVersion = 1;
      state.getCacheVersion = () => cacheVersion;

      // Mock console.debug to capture logs
      const originalConsoleDebug = console.debug;
      const debugLogs: any[] = [];
      console.debug = (...args: any[]) => {
        debugLogs.push(args);
      };

      // First execution
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Second execution with same cache version - should skip layout
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Change cache version
      cacheVersion = 2;

      // Third execution with different cache version - should perform layout
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify cache version was used for optimization
      const cacheVersionLogs = debugLogs.filter(log => 
        log[0].includes('State analysis') && log[1].currentSnapshot?.cacheVersion
      );
      expect(cacheVersionLogs.length).toBeGreaterThan(0);

      // Restore console
      console.debug = originalConsoleDebug;
    });

    it("should ensure all optimizations are stateless", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Execute pipeline with different configurations
      const configurations = [
        { relayoutEntities: undefined, fitView: true },
        { relayoutEntities: [], fitView: false },
        { relayoutEntities: ['container1'], fitView: true },
        { relayoutEntities: [], fitView: false }
      ];

      for (const config of configurations) {
        await asyncCoordinator.executeLayoutAndRenderPipeline(state, config);
      }

      // Verify AsyncCoordinator state is minimal and stateless
      const coordinatorState = asyncCoordinator as any;
      
      // Should not have persistent optimization caches
      expect(coordinatorState.performanceCache).toBeUndefined();
      expect(coordinatorState.optimizationHistory).toBeUndefined();
      expect(coordinatorState.layoutSkipCache).toBeUndefined();
      expect(coordinatorState.fitViewCache).toBeUndefined();
      
      // Only allowed state-related property is _lastStateSnapshot (ephemeral)
      const stateRelatedKeys = Object.keys(coordinatorState).filter(key => 
        key.includes('state') || key.includes('snapshot') || key.includes('cache')
      );
      expect(stateRelatedKeys.length).toBeLessThanOrEqual(1);
      if (stateRelatedKeys.length === 1) {
        expect(stateRelatedKeys[0]).toBe('_lastStateSnapshot');
      }
    });
  });
});