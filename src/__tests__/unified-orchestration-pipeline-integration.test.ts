/**
 * Comprehensive integration tests for the unified orchestration pipeline
 * 
 * This test suite validates that:
 * 1. All operations are truly atomic and sequential
 * 2. Error recovery and graceful degradation work correctly
 * 3. The synchronous pipeline methods work as expected
 * 4. Manual orchestration patterns have been eliminated
 * 
 * Requirements covered: 2.3, 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestNode } from "../utils/testData.js";

describe("Unified Orchestration Pipeline Integration Tests", () => {
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

  describe("Atomic and Sequential Operations (Requirement 3.1, 3.2)", () => {
    it("should execute container operations atomically", async () => {
      // Setup test container
      state.addContainer({
        id: "test-container",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        children: new Set(),
        childNodes: [],
        childContainers: []
      });

      // Track operation sequence
      const operationLog: string[] = [];
      
      // Mock callbacks to track execution order
      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        operationLog.push("reactflow_update");
      };
      
      asyncCoordinator.onFitViewRequested = (options) => {
        operationLog.push("fitview_requested");
      };

      // Execute expand operation
      const result = await asyncCoordinator.expandContainer(
        "test-container", 
        state, 
        elkBridge, 
        {
          relayoutEntities: ["test-container"],
          fitView: true
        }
      );

      // Verify atomic completion
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify container was expanded
      const container = state.getContainer("test-container");
      expect(container?.collapsed).toBe(false);

      // Verify callbacks were called in correct order
      expect(operationLog).toContain("reactflow_update");
      expect(operationLog).toContain("fitview_requested");
      
      // ReactFlow update should come before FitView
      const reactFlowIndex = operationLog.indexOf("reactflow_update");
      const fitViewIndex = operationLog.indexOf("fitview_requested");
      expect(reactFlowIndex).toBeLessThan(fitViewIndex);
    });

    it("should execute multiple container operations sequentially", async () => {
      // Setup multiple test containers
      for (let i = 1; i <= 3; i++) {
        state.addContainer({
          id: `container-${i}`,
          label: `Container ${i}`,
          collapsed: true,
          position: { x: i * 100, y: 0 },
          size: { width: 100, height: 100 },
          childNodes: [],
          childContainers: []
        });
      }

      // Execute operations sequentially
      const results = [];
      for (let i = 1; i <= 3; i++) {
        const result = await asyncCoordinator.expandContainer(
          `container-${i}`,
          state,
          elkBridge,
          {
            relayoutEntities: [`container-${i}`],
            fitView: false
          }
        );
        results.push(result);
      }

      // Verify all operations completed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      });

      // Verify all containers were expanded
      for (let i = 1; i <= 3; i++) {
        const container = state.getContainer(`container-${i}`);
        expect(container?.collapsed).toBe(false);
      }
    });

    it("should execute search operations atomically", async () => {
      // Setup test data with searchable nodes
      const node1 = createTestNode("n1", "Test Node");
      const node2 = createTestNode("n2", "Another Node");
      
      state.addNode(node1);
      state.addNode(node2);

      // Track operation sequence
      const operationLog: string[] = [];
      
      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        operationLog.push("reactflow_update");
      };
      
      asyncCoordinator.onFitViewRequested = (options) => {
        operationLog.push("fitview_requested");
      };

      // Execute search operation
      const result = await asyncCoordinator.updateSearchResults(
        "Test", 
        state, 
        elkBridge, 
        {
          expandContainers: false,
          fitView: true
        }
      );

      // Verify atomic completion
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify search was performed
      const searchResults = state.getSearchResults();
      expect(searchResults.length).toBeGreaterThan(0);

      // Verify callbacks were called
      expect(operationLog).toContain("reactflow_update");
      expect(operationLog).toContain("fitview_requested");
    });

    it("should execute layout and render pipeline atomically", async () => {
      // Setup test data
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      
      state.addNode(node1);
      state.addNode(node2);

      // Track operation sequence
      const operationLog: string[] = [];
      
      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        operationLog.push("reactflow_update");
      };
      
      asyncCoordinator.onFitViewRequested = (options) => {
        operationLog.push("fitview_requested");
      };

      // Execute complete pipeline
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        elkBridge,
        {
          relayoutEntities: undefined, // Full layout
          fitView: true
        }
      );

      // Verify atomic completion
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify layout was performed
      expect(state.getLayoutState().phase).toBe("displayed");

      // Verify callbacks were called
      expect(operationLog).toContain("reactflow_update");
      expect(operationLog).toContain("fitview_requested");
    });
  });

  describe("Error Recovery and Graceful Degradation (Requirement 3.3, 3.4)", () => {
    it("should handle ELK layout failures gracefully", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock ELK bridge to throw error
      const originalLayout = elkBridge.layout;
      elkBridge.layout = () => {
        throw new Error("ELK layout failed");
      };

      // Execute pipeline - should fail fast with clear error
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: undefined,
          fitView: false
        })
      ).rejects.toThrow("ELK layout failed");

      // Restore original layout method
      elkBridge.layout = originalLayout;
    });

    it("should handle container operation failures gracefully", async () => {
      // Setup test container
      state.addContainer({
        id: "test-container",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        childNodes: [],
        childContainers: []
      });

      // Mock state method to throw error
      const originalExpandMethod = state._expandContainerForCoordinator;
      state._expandContainerForCoordinator = () => {
        throw new Error("Container expand failed");
      };

      // Execute container expand and expect it to throw
      await expect(
        asyncCoordinator.expandContainer("test-container", state, elkBridge, {
          relayoutEntities: ["test-container"],
          fitView: false
        })
      ).rejects.toThrow("Failed to expand container test-container");

      // Restore original method
      state._expandContainerForCoordinator = originalExpandMethod;
    });

    it("should handle search operation failures gracefully", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock search to throw error
      const originalSearch = state.search;
      state.search = () => {
        throw new Error("Search failed");
      };

      // Execute search and expect it to throw
      await expect(
        asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
          expandContainers: false,
          fitView: false
        })
      ).rejects.toThrow("Search failed");

      // Restore original search method
      state.search = originalSearch;
    });

    it("should handle FitView callback failures gracefully", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup FitView callback that throws error
      asyncCoordinator.onFitViewRequested = () => {
        throw new Error("FitView callback failed");
      };

      // Execute pipeline - should fail fast with clear error
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: [],
          fitView: true
        })
      ).rejects.toThrow("FitView callback failed");
    });

    it("should handle ReactFlow data update callback failures gracefully", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup ReactFlow data update callback that throws error
      asyncCoordinator.onReactFlowDataUpdate = () => {
        throw new Error("ReactFlow data update callback failed");
      };

      // Execute pipeline - should fail fast with clear error
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: [],
          fitView: false
        })
      ).rejects.toThrow("ReactFlow data update callback failed");
    });

    it("should validate required parameters and provide meaningful errors", async () => {
      // Test missing state parameter
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(null as any, elkBridge)
      ).rejects.toThrow("VisualizationState instance is required for layout and render pipeline");

      // Test missing ELK bridge parameter
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, null as any)
      ).rejects.toThrow("ELKBridge instance is required for layout and render pipeline");

      // Test missing container ID for expand operation
      await expect(
        asyncCoordinator.expandContainer("", state, elkBridge)
      ).rejects.toThrow("Container ID is required for expand operation");

      // Test missing state for search operation
      await expect(
        asyncCoordinator.updateSearchResults("test", null as any, elkBridge)
      ).rejects.toThrow("VisualizationState is required for search operations");
    });

    it("should provide detailed error logging before failing fast", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock console.error to capture error logs
      const originalConsoleError = console.error;
      const errorLogs: any[] = [];
      console.error = (...args: any[]) => {
        errorLogs.push(args);
      };

      // Mock ELK bridge to throw error
      const originalLayout = elkBridge.layout;
      elkBridge.layout = () => {
        throw new Error("ELK layout failed");
      };

      // Execute pipeline - should fail fast but log detailed error info first
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: undefined,
          fitView: false
        })
      ).rejects.toThrow("ELK layout failed");

      // Verify error was logged with details before failing
      expect(errorLogs.length).toBeGreaterThan(0);
      const layoutErrorLog = errorLogs.find(log => 
        log[0].includes('[AsyncCoordinator]') && log[0].includes('ELK layout operation failed')
      );
      expect(layoutErrorLog).toBeDefined();

      // Restore original methods
      elkBridge.layout = originalLayout;
      console.error = originalConsoleError;
    });
  });

  describe("Manual Orchestration Elimination (Requirement 2.3)", () => {
    it("should not expose deprecated methods", () => {
      // Verify deprecated methods are no longer available
      expect((asyncCoordinator as any).queueELKLayout).toBeUndefined();
      expect((asyncCoordinator as any).queueReactFlowRender).toBeUndefined();
      expect((asyncCoordinator as any).queueApplicationEvent).toBeUndefined();
      expect((asyncCoordinator as any).queueLayoutAndRenderPipeline).toBeUndefined();
      expect((asyncCoordinator as any).processApplicationEventAndWait).toBeUndefined();
    });

    it("should provide only atomic, high-level methods", () => {
      // Verify new synchronous methods are available
      expect(asyncCoordinator.executeLayoutAndRenderPipeline).toBeDefined();
      expect(typeof asyncCoordinator.executeLayoutAndRenderPipeline).toBe("function");
      
      expect(asyncCoordinator.expandContainer).toBeDefined();
      expect(typeof asyncCoordinator.expandContainer).toBe("function");
      
      expect(asyncCoordinator.collapseContainer).toBeDefined();
      expect(typeof asyncCoordinator.collapseContainer).toBe("function");
      
      expect(asyncCoordinator.expandAllContainers).toBeDefined();
      expect(typeof asyncCoordinator.expandAllContainers).toBe("function");
      
      expect(asyncCoordinator.collapseAllContainers).toBeDefined();
      expect(typeof asyncCoordinator.collapseAllContainers).toBe("function");
      
      expect(asyncCoordinator.updateSearchResults).toBeDefined();
      expect(typeof asyncCoordinator.updateSearchResults).toBe("function");
    });

    it("should ensure all operations return ReactFlowData when complete", async () => {
      // Setup test data
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);
      
      state.addContainer({
        id: "test-container",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        childNodes: [],
        childContainers: []
      });

      // Test all atomic operations return ReactFlowData
      const pipelineResult = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state, elkBridge, { relayoutEntities: [], fitView: false }
      );
      expect(pipelineResult).toBeDefined();
      expect(pipelineResult.nodes).toBeDefined();
      expect(pipelineResult.edges).toBeDefined();

      const expandResult = await asyncCoordinator.expandContainer(
        "test-container", state, elkBridge, { relayoutEntities: ["test-container"], fitView: false }
      );
      expect(expandResult).toBeDefined();
      expect(expandResult.nodes).toBeDefined();
      expect(expandResult.edges).toBeDefined();

      const collapseResult = await asyncCoordinator.collapseContainer(
        "test-container", state, elkBridge, { relayoutEntities: ["test-container"], fitView: false }
      );
      expect(collapseResult).toBeDefined();
      expect(collapseResult.nodes).toBeDefined();
      expect(collapseResult.edges).toBeDefined();

      const searchResult = await asyncCoordinator.updateSearchResults(
        "Test", state, elkBridge, { expandContainers: false, fitView: false }
      );
      expect(searchResult).toBeDefined();
      expect(searchResult.nodes).toBeDefined();
      expect(searchResult.edges).toBeDefined();
    });

    it("should handle bulk operations atomically", async () => {
      // Setup multiple test containers
      for (let i = 1; i <= 3; i++) {
        state.addContainer({
          id: `container-${i}`,
          label: `Container ${i}`,
          collapsed: true,
          position: { x: i * 100, y: 0 },
          size: { width: 100, height: 100 },
          childNodes: [],
          childContainers: []
        });
      }

      // Test expand all
      const expandAllResult = await asyncCoordinator.expandAllContainers(
        state, elkBridge, { relayoutEntities: undefined, fitView: false }
      );
      expect(expandAllResult).toBeDefined();
      expect(expandAllResult.nodes).toBeDefined();
      expect(expandAllResult.edges).toBeDefined();

      // Verify all containers were expanded
      for (let i = 1; i <= 3; i++) {
        const container = state.getContainer(`container-${i}`);
        expect(container?.collapsed).toBe(false);
      }

      // Test collapse all
      const collapseAllResult = await asyncCoordinator.collapseAllContainers(
        state, elkBridge, { relayoutEntities: undefined, fitView: false }
      );
      expect(collapseAllResult).toBeDefined();
      expect(collapseAllResult.nodes).toBeDefined();
      expect(collapseAllResult.edges).toBeDefined();

      // Verify all containers were collapsed
      for (let i = 1; i <= 3; i++) {
        const container = state.getContainer(`container-${i}`);
        expect(container?.collapsed).toBe(true);
      }
    });
  });

  describe("Performance and Optimization", () => {
    it("should skip layout when relayoutEntities is empty array", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Track if layout was called
      const originalSetLayoutPhase = state.setLayoutPhase;
      let layoutPhaseCalls: string[] = [];
      state.setLayoutPhase = (phase: string) => {
        layoutPhaseCalls.push(phase);
        return originalSetLayoutPhase.call(state, phase);
      };

      // Execute pipeline with no layout
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [], // No layout
        fitView: false
      });

      // Verify result is returned
      expect(result).toBeDefined();
      
      // Verify layout was skipped (no "laying_out" phase)
      expect(layoutPhaseCalls).not.toContain("laying_out");
    });

    it("should optimize FitView options based on node count", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup FitView callback mock to capture options
      let capturedOptions: any = null;
      asyncCoordinator.onFitViewRequested = (options) => {
        capturedOptions = options;
      };

      // Execute pipeline with FitView enabled and custom options
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 50, duration: 300 }
      });

      // Verify FitView options were optimized (duration may be adjusted for small graphs)
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.padding).toBe(50);
      // Duration may be optimized for small graphs (300ms -> 500ms)
      expect(capturedOptions.duration).toBeGreaterThanOrEqual(300);
    });

    it("should handle concurrent operations gracefully", async () => {
      // Setup test data
      for (let i = 1; i <= 5; i++) {
        const node = createTestNode(`n${i}`, `Node ${i}`);
        state.addNode(node);
      }

      // Execute multiple operations concurrently
      const operations = [
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: [], fitView: false
        }),
        asyncCoordinator.updateSearchResults("Node", state, elkBridge, {
          expandContainers: false, fitView: false
        }),
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: [], fitView: false
        })
      ];

      // All operations should complete successfully
      const results = await Promise.all(operations);
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      });
    });
  });

  describe("Callback Integration", () => {
    it("should trigger ReactFlow data update callback for all operations", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      let callbackCount = 0;
      let lastUpdatedData: any = null;

      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        callbackCount++;
        lastUpdatedData = data;
      };

      // Execute pipeline operation
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify callback was called
      expect(callbackCount).toBe(1);
      expect(lastUpdatedData).toEqual(result);
    });

    it("should trigger FitView callback only when enabled", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      let fitViewCallCount = 0;
      asyncCoordinator.onFitViewRequested = () => {
        fitViewCallCount++;
      };

      // Execute with FitView disabled
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: false
      });

      expect(fitViewCallCount).toBe(0);

      // Execute with FitView enabled
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: true
      });

      expect(fitViewCallCount).toBe(1);
    });

    it("should pass correct FitView options to callback", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      let capturedOptions: any = null;
      asyncCoordinator.onFitViewRequested = (options) => {
        capturedOptions = options;
      };

      // Execute with custom FitView options
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 100, duration: 500 }
      });

      expect(capturedOptions).toEqual({ padding: 100, duration: 500 });
    });
  });
});