/**
 * Test for AsyncCoordinator pipeline sequencing
 * Verifies: ELK → State Update → ReactFlow Render
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestNode } from "../utils/testData.js";
import { bridgeFactory } from "@/bridges/BridgeFactory.js";
import { bridgeFactory } from "@/bridges/BridgeFactory.js";
import { bridgeFactory } from "@/bridges/BridgeFactory.js";

describe("AsyncCoordinator Pipeline Sequencing", () => {
  let _coordinator: AsyncCoordinator;

  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    const _coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    asyncCoordinator = new AsyncCoordinator();
  });

  it("should have executeLayoutAndRenderPipeline method (replacement for deprecated queueLayoutAndRenderPipeline)", () => {
    expect(asyncCoordinator.executeLayoutAndRenderPipeline).toBeDefined();
    expect(typeof asyncCoordinator.executeLayoutAndRenderPipeline).toBe(
      "function",
    );
  });

  it("should execute complete layout and render pipeline", async () => {
    // Setup simple test data
    const node1 = createTestNode("n1", "Node 1");
    const node2 = createTestNode("n2", "Node 2");

    state.addNode(node1);
    state.addNode(node2);

    // Execute complete pipeline using new method - should not throw
    const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
      state,
      elkBridge,
      { 
        relayoutEntities: undefined, // Full layout
        fitView: false,
        timeout: 5000 
      },
    );

    // Verify result is returned
    expect(result).toBeDefined();

    // Verify layout phase progressed
    expect(state.getLayoutState().phase).toBe("displayed");
  });

  it("should ensure ELK completes before ReactFlow render", async () => {
    const node = createTestNode("n1", "Node 1");
    state.addNode(node);

    // Execute pipeline using new method - should complete without error
    const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
      state, 
      elkBridge,
      {
        relayoutEntities: undefined, // Full layout
        fitView: false
      }
    );

    // Verify result is returned
    expect(result).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();

    // Verify layout phase progressed correctly
    expect(state.getLayoutState().phase).toBe("displayed");
  });

  describe("executeLayoutAndRenderPipeline (synchronous)", () => {
    it("should have executeLayoutAndRenderPipeline method", () => {
      expect(asyncCoordinator.executeLayoutAndRenderPipeline).toBeDefined();
      expect(typeof asyncCoordinator.executeLayoutAndRenderPipeline).toBe("function");
    });

    it("should execute synchronous pipeline with full layout", async () => {
      // Setup simple test data
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");

      state.addNode(node1);
      state.addNode(node2);

      // Execute enhanced pipeline with full layout (default)
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: undefined, // Full layout
        fitView: false
      });

      // Verify result is returned
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should skip layout when relayoutEntities is empty array", async () => {
      const node = createTestNode("n1", "Node 1");
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

    it("should trigger FitView callback when enabled", async () => {
      const node = createTestNode("n1", "Node 1");
      state.addNode(node);

      // Setup FitView callback mock
      let fitViewCalled = false;
      let fitViewOptions: any = null;
      asyncCoordinator.onFitViewRequested = (options) => {
        fitViewCalled = true;
        fitViewOptions = options;
      };

      // Execute pipeline with FitView enabled
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 50, duration: 300 }
      });

      // Verify FitView callback was called
      expect(fitViewCalled).toBe(true);
      // Note: Duration may be optimized for small graphs (300ms -> 500ms)
      expect(fitViewOptions).toEqual({ padding: 50, duration: 500 });
    });

    it("should not trigger FitView callback when disabled", async () => {
      const node = createTestNode("n1", "Node 1");
      state.addNode(node);

      // Setup FitView callback mock
      let fitViewCalled = false;
      asyncCoordinator.onFitViewRequested = () => {
        fitViewCalled = true;
      };

      // Execute pipeline with FitView disabled
      await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify FitView callback was not called
      expect(fitViewCalled).toBe(false);
    });

    it("should trigger ReactFlow data update callback", async () => {
      const node = createTestNode("n1", "Node 1");
      state.addNode(node);

      // Setup ReactFlow data update callback mock
      let reactFlowDataUpdateCalled = false;
      let updatedData: any = null;
      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        reactFlowDataUpdateCalled = true;
        updatedData = data;
      };

      // Execute pipeline
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: [],
        fitView: false
      });

      // Verify ReactFlow data update callback was called
      expect(reactFlowDataUpdateCalled).toBe(true);
      expect(updatedData).toEqual(result);
    });
  });

  describe("updateSearchResults", () => {
    it("should have updateSearchResults method", () => {
      expect(asyncCoordinator.updateSearchResults).toBeDefined();
      expect(typeof asyncCoordinator.updateSearchResults).toBe("function");
    });

    it("should perform search highlighting without container expansion", async () => {
      // Setup test data with searchable nodes
      const node1 = createTestNode("n1", "Test Node");
      const node2 = createTestNode("n2", "Another Node");
      
      state.addNode(node1);
      state.addNode(node2);

      // Execute search without container expansion
      const result = await asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
        expandContainers: false,
        fitView: false
      });

      // Verify result is returned
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify search was performed (check if search results exist)
      const searchResults = state.getSearchResults();
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].label).toContain("Test");
    });

    it("should perform search with container expansion when enabled", async () => {
      // Setup test data with containers
      const node1 = createTestNode("n1", "Test Node");
      const node2 = createTestNode("n2", "Another Node");
      
      state.addNode(node1);
      state.addNode(node2);

      // Mock container expansion functionality
      let expandedContainers: string[] = [];
      state._expandContainerForCoordinator = (containerId: string) => {
        expandedContainers.push(containerId);
      };

      // Mock _getContainersForSearchResults to return test containers
      const originalGetContainers = asyncCoordinator['_getContainersForSearchResults'];
      asyncCoordinator['_getContainersForSearchResults'] = () => ['container1', 'container2'];

      // Execute search with container expansion
      const result = await asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
        expandContainers: true,
        fitView: false
      });

      // Verify result is returned
      expect(result).toBeDefined();

      // Verify containers were expanded
      expect(expandedContainers).toEqual(['container1', 'container2']);

      // Restore original method
      asyncCoordinator['_getContainersForSearchResults'] = originalGetContainers;
    });

    it("should trigger FitView callback when enabled for search results", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup FitView callback mock
      let fitViewCalled = false;
      let fitViewOptions: any = null;
      asyncCoordinator.onFitViewRequested = (options) => {
        fitViewCalled = true;
        fitViewOptions = options;
      };

      // Execute search with FitView enabled
      await asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
        expandContainers: false,
        fitView: true,
        fitViewOptions: { padding: 100, duration: 500 }
      });

      // Verify FitView callback was called
      expect(fitViewCalled).toBe(true);
      expect(fitViewOptions).toEqual({ padding: 100, duration: 500 });
    });

    it("should not trigger FitView callback when disabled", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup FitView callback mock
      let fitViewCalled = false;
      asyncCoordinator.onFitViewRequested = () => {
        fitViewCalled = true;
      };

      // Execute search with FitView disabled
      await asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
        expandContainers: false,
        fitView: false
      });

      // Verify FitView callback was not called
      expect(fitViewCalled).toBe(false);
    });

    it("should trigger ReactFlow data update callback", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Setup ReactFlow data update callback mock
      let reactFlowDataUpdateCalled = false;
      let updatedData: any = null;
      asyncCoordinator.onReactFlowDataUpdate = (data) => {
        reactFlowDataUpdateCalled = true;
        updatedData = data;
      };

      // Execute search
      const result = await asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
        expandContainers: false,
        fitView: false
      });

      // Verify ReactFlow data update callback was called
      expect(reactFlowDataUpdateCalled).toBe(true);
      expect(updatedData).toEqual(result);
    });

    it("should handle empty search query gracefully", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Execute search with empty query
      const result = await asyncCoordinator.updateSearchResults("", state, elkBridge, {
        expandContainers: false,
        fitView: false
      });

      // Verify result is returned
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();

      // Verify no search results for empty query
      const searchResults = state.getSearchResults();
      expect(searchResults.length).toBe(0);
    });

    it("should handle search errors gracefully", async () => {
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
  });

  describe("Error Handling for Synchronous Pipeline", () => {
    it("should fail fast on ELK layout failures with clear error messages", async () => {
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
          relayoutEntities: undefined, // Full layout
          fitView: false
        })
      ).rejects.toThrow("ELK layout failed");

      // Restore original layout method
      elkBridge.layout = originalLayout;
    });

    it("should handle ReactFlow data generation failures", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock bridge factory to return invalid bridge
      const originalGetBridge = bridgeFactory.getReactFlowBridge;
      bridgeFactory.getReactFlowBridge = () => {
        throw new Error("ReactFlow bridge failed");
      };

      // Execute pipeline and expect it to throw for rendering failures
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge, {
          relayoutEntities: [],
          fitView: false
        })
      ).rejects.toThrow("ReactFlow bridge failed");

      // Restore original bridge factory
      bridgeFactory.getReactFlowBridge = originalGetBridge;
    });

    it("should fail fast on FitView callback failures with clear error messages", async () => {
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

    it("should fail fast on ReactFlow data update callback failures with clear error messages", async () => {
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

    it("should provide detailed error logging for pipeline failures before failing fast", async () => {
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

    it("should handle container expand operation failures", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock state method to throw error
      const originalExpandMethod = state._expandContainerForCoordinator;
      state._expandContainerForCoordinator = () => {
        throw new Error("Container expand failed");
      };

      // Execute container expand and expect it to throw
      await expect(
        asyncCoordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false
        })
      ).rejects.toThrow("Failed to expand container container1");

      // Restore original method
      state._expandContainerForCoordinator = originalExpandMethod;
    });

    it("should handle container collapse operation failures", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock state method to throw error
      const originalCollapseMethod = state._collapseContainerForCoordinator;
      state._collapseContainerForCoordinator = () => {
        throw new Error("Container collapse failed");
      };

      // Execute container collapse and expect it to throw
      await expect(
        asyncCoordinator.collapseContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false
        })
      ).rejects.toThrow("Failed to collapse container container1");

      // Restore original method
      state._collapseContainerForCoordinator = originalCollapseMethod;
    });

    it("should fail fast on search with container expansion failures with clear error messages", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Mock container expansion to fail
      const originalExpandMethod = state._expandContainerForCoordinator;
      state._expandContainerForCoordinator = () => {
        throw new Error("Container expansion failed during search");
      };

      // Mock _getContainersForSearchResults to return test containers
      const originalGetContainers = asyncCoordinator['_getContainersForSearchResults'];
      asyncCoordinator['_getContainersForSearchResults'] = () => ['container1'];

      // Execute search with container expansion - should fail fast with clear error
      await expect(
        asyncCoordinator.updateSearchResults("Test", state, elkBridge, {
          expandContainers: true,
          fitView: false
        })
      ).rejects.toThrow("Container expansion failed during search");

      // Restore original methods
      state._expandContainerForCoordinator = originalExpandMethod;
      asyncCoordinator['_getContainersForSearchResults'] = originalGetContainers;
    });

    it("should validate required parameters and throw meaningful errors", async () => {
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
  });
});
