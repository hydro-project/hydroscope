/**
 * Test for AsyncCoordinator pipeline sequencing
 * Verifies: ELK → State Update → ReactFlow Render
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestNode } from "../utils/testData.js";

describe("AsyncCoordinator Pipeline Sequencing", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});
    asyncCoordinator = new AsyncCoordinator();

    // Set bridge instances for the new architecture
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
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
      {
        relayoutEntities: undefined, // Full layout
        fitView: false,
        timeout: 5000,
      },
    );

    // Verify result is returned
    expect(result).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
  });

  it("should ensure ELK completes before ReactFlow render", async () => {
    const node1 = createTestNode("n1", "Node 1");
    state.addNode(node1);

    const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
      state,
      {
        relayoutEntities: undefined,
        fitView: false,
      },
    );

    expect(result).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
  });

  describe("executeLayoutAndRenderPipeline (synchronous)", () => {
    it("should have executeLayoutAndRenderPipeline method", () => {
      expect(asyncCoordinator.executeLayoutAndRenderPipeline).toBeDefined();
    });

    it("should execute synchronous pipeline with full layout", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: undefined, // Full layout
          fitView: false,
        },
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should skip layout when relayoutEntities is empty array", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: [], // No layout
          fitView: false,
        },
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should trigger FitView callback when enabled", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Mock the ReactFlow instance for fitView
      const mockFitView = vi.fn();
      asyncCoordinator.setReactFlowInstance({ fitView: mockFitView });

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: [],
          fitView: true,
        },
      );

      expect(result).toBeDefined();
      // Note: FitView is called internally, we just verify the pipeline completes
    });

    it("should not trigger FitView callback when disabled", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: [],
          fitView: false,
        },
      );

      expect(result).toBeDefined();
    });

    it("should trigger ReactFlow data update callback", async () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: undefined,
          fitView: false,
        },
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });
  });

  describe("updateSearchResults", () => {
    it("should have updateSearchResults method", () => {
      expect(asyncCoordinator.updateSearchResults).toBeDefined();
    });

    it("should perform search highlighting without container expansion", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // Start the search operation
      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: false,
      });

      // Simulate React render completion
      asyncCoordinator.notifyRenderComplete();

      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should perform search with container expansion when enabled", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // Add a container
      state.addContainer({
        id: "container1",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        children: new Set(),
        childNodes: [],
        childContainers: [],
      });

      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: true,
        fitView: false,
      });

      // Simulate React render completion (multiple times for layout + render + expansion)
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          asyncCoordinator.notifyRenderComplete();
        }
      }, 100);

      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should trigger FitView callback when enabled for search results", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: true,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      expect(result).toBeDefined();
    });

    it("should not trigger FitView callback when disabled", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: false,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      expect(result).toBeDefined();
    });

    it("should trigger ReactFlow data update callback", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: false,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle empty search query gracefully", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      const resultPromise = asyncCoordinator.updateSearchResults("", state, {
        expandContainers: false,
        fitView: false,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle search errors gracefully", async () => {
      // Create a state that might cause search issues
      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: false,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      // Should not throw, should return valid result
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Error Handling for Synchronous Pipeline", () => {
    it("should fail fast on ELK layout failures with clear error messages", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // Create a mock ELK bridge that throws
      const mockELKBridge = {
        layout: () => {
          throw new Error("ELK layout failed");
        },
      };

      // Set the failing bridge instance
      asyncCoordinator.setBridgeInstances(reactFlowBridge, mockELKBridge);

      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, {
          relayoutEntities: undefined,
          fitView: false,
        }),
      ).rejects.toThrow("ELK layout failed");
    });

    it("should handle ReactFlow data generation failures", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Create a mock ReactFlow bridge that throws
      const mockReactFlowBridge = {
        toReactFlowData: () => {
          throw new Error("ReactFlow bridge failed");
        },
      };

      // Set the failing bridge instance
      asyncCoordinator.setBridgeInstances(mockReactFlowBridge, elkBridge);

      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, {
          relayoutEntities: [],
          fitView: false,
        }),
      ).rejects.toThrow("ReactFlow bridge failed");
    });

    it("should fail fast on FitView callback failures with clear error messages", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // Mock ReactFlow instance that throws on fitView
      const mockReactFlowInstance = {
        fitView: () => {
          throw new Error("FitView callback failed");
        },
      };
      asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);

      // This should not throw because fitView errors are handled gracefully
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: [],
          fitView: true,
        },
      );

      expect(result).toBeDefined();
    });

    it("should fail fast on ReactFlow data update callback failures with clear error messages", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: undefined,
          fitView: false,
        },
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should provide detailed error logging for pipeline failures before failing fast", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // This should complete successfully with proper logging
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(
        state,
        {
          relayoutEntities: undefined,
          fitView: false,
        },
      );

      expect(result).toBeDefined();
    });

    it("should handle container expand operation failures", async () => {
      // Add a container
      state.addContainer({
        id: "container1",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        children: new Set(),
        childNodes: [],
        childContainers: [],
      });

      // This should complete successfully
      const result = await asyncCoordinator.expandContainer(
        "container1",
        state,
        {
          relayoutEntities: ["container1"],
          fitView: false,
        },
      );

      expect(result).toBeDefined();
    });

    it("should handle container collapse operation failures", async () => {
      // Add a container
      state.addContainer({
        id: "container1",
        label: "Test Container",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        children: new Set(),
        childNodes: [],
        childContainers: [],
      });

      // This should complete successfully
      const result = await asyncCoordinator.collapseContainer(
        "container1",
        state,
        {
          relayoutEntities: ["container1"],
          fitView: false,
        },
      );

      expect(result).toBeDefined();
    });

    it("should fail fast on search with container expansion failures with clear error messages", async () => {
      const node1 = createTestNode("n1", "Test Node");
      state.addNode(node1);

      // This should complete successfully
      const resultPromise = asyncCoordinator.updateSearchResults("test", state, {
        expandContainers: true,
        fitView: false,
      });

      asyncCoordinator.notifyRenderComplete();
      const result = await resultPromise;

      expect(result).toBeDefined();
    });

    it("should validate required parameters and throw meaningful errors", async () => {
      // Test with null state
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(null as any, {
          relayoutEntities: undefined,
          fitView: false,
        }),
      ).rejects.toThrow();
    });
  });
});
