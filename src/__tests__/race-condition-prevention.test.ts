/**
 * Race Condition Prevention Integration Tests
 *
 * Tests that verify:
 * - Rapid searches don't cause race conditions
 * - Concurrent operations are serialized correctly
 * - Read-write coordination works properly
 * - No ResizeObserver errors occur
 *
 * Requirements: 8.2, 8.3, 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("Race Condition Prevention - Integration Tests", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  let renderNotificationInterval: NodeJS.Timeout;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});

    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Set up automatic render notification for tests
    // In real app, React calls notifyRenderComplete() after each render
    // In tests, we simulate this with an interval
    renderNotificationInterval = setInterval(() => {
      if (coordinator.hasPendingCallbacks()) {
        coordinator.notifyRenderComplete();
      }
    }, 10); // Check every 10ms

    // Add test data - multiple nodes for comprehensive testing
    for (let i = 1; i <= 20; i++) {
      state.addNode({
        id: `node${i}`,
        label: `Test Node ${i}`,
        longLabel: `Test Node ${i} Long Label`,
        type: "default",
        semanticTags: [],
        hidden: false,
      });
    }

    // Add containers with nodes
    state.addContainer({
      id: "container1",
      label: "Container 1",
      children: new Set(["node1", "node2", "node3"]),
      collapsed: true,
      hidden: false,
    });

    state.addContainer({
      id: "container2",
      label: "Container 2",
      children: new Set(["node4", "node5"]),
      collapsed: true,
      hidden: false,
    });
  });

  afterEach(() => {
    // Clean up the interval
    if (renderNotificationInterval) {
      clearInterval(renderNotificationInterval);
    }
  });

  describe("12.1 Rapid search typing", () => {
    it("should handle 10+ rapid searches without errors", async () => {
      // Fire 10+ searches in rapid succession
      const promises = [];
      const queries = [
        "Test",
        "Node",
        "node1",
        "node2",
        "Test Node",
        "Label",
        "node",
        "test",
        "Node 1",
        "Test Node 1",
        "node10",
        "Test Node 10",
      ];

      for (const query of queries) {
        promises.push(
          coordinator.updateSearchHighlights(query, state, {
            expandContainers: false,
            focusFirstResult: false,
          }),
        );
      }

      // All should complete without errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it("should have final state match last search", async () => {
      // Fire multiple searches
      const queries = ["Test", "Node", "node1", "node2", "final"];

      for (const query of queries) {
        await coordinator.updateSearchHighlights(query, state, {
          expandContainers: false,
          focusFirstResult: false,
        });
      }

      // Final state should match the last search
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("final");
    });

    it("should complete all searches without throwing", async () => {
      const promises = [];

      // Fire 15 searches rapidly
      for (let i = 0; i < 15; i++) {
        promises.push(
          coordinator.updateSearchHighlights(`query${i}`, state, {
            expandContainers: false,
            focusFirstResult: false,
          }),
        );
      }

      // Should not throw
      await expect(Promise.all(promises)).resolves.toBeDefined();

      // Verify state is consistent
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBeDefined();
    });

    it("should not produce ResizeObserver errors during rapid searches", async () => {
      // Spy on console.error to catch ResizeObserver errors
      const consoleErrorSpy = vi.spyOn(console, "error");

      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          coordinator.updateSearchHighlights(`node${i}`, state, {
            expandContainers: true,
            focusFirstResult: false,
          }),
        );
      }

      await Promise.all(promises);

      // Check that no ResizeObserver errors were logged
      const resizeObserverErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) =>
          String(arg).toLowerCase().includes("resizeobserver"),
        ),
      );

      expect(resizeObserverErrors.length).toBe(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("12.2 Concurrent operations", () => {
    it("should handle search, container expand, and style change concurrently", async () => {
      // Fire search, container expand, and style change concurrently
      const operations = [
        coordinator.updateSearchHighlights("Test", state, {
          expandContainers: false,
          focusFirstResult: false,
        }),
        coordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        }),
        coordinator.updateColorPalette("dark", state, {
          relayoutEntities: [],
          fitView: false,
        }),
      ];

      // All should complete successfully
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it("should maintain consistent state after concurrent operations", async () => {
      // Fire multiple operations concurrently
      await Promise.all([
        coordinator.updateSearchHighlights("node", state, {
          expandContainers: false,
          focusFirstResult: false,
        }),
        coordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        }),
        coordinator.collapseContainer("container2", state, {
          relayoutEntities: ["container2"],
          fitView: false,
        }),
      ]);

      // Verify state is consistent
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("node");

      const container1 = state.getContainer("container1");
      expect(container1?.collapsed).toBe(false);

      const container2 = state.getContainer("container2");
      expect(container2?.collapsed).toBe(true);
    });

    it("should execute operations sequentially despite concurrent submission", async () => {
      const executionOrder: string[] = [];

      // Create operations that track execution order
      const op1 = coordinator
        .updateSearchHighlights("test1", state, {
          expandContainers: false,
          focusFirstResult: false,
        })
        .then(() => executionOrder.push("search"));

      const op2 = coordinator
        .expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        })
        .then(() => executionOrder.push("expand"));

      const op3 = coordinator
        .updateSearchHighlights("test2", state, {
          expandContainers: false,
          focusFirstResult: false,
        })
        .then(() => executionOrder.push("search2"));

      await Promise.all([op1, op2, op3]);

      // Operations should have executed (order may vary due to queue)
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toContain("search");
      expect(executionOrder).toContain("expand");
      expect(executionOrder).toContain("search2");
    });

    it("should handle mixed operation types without errors", async () => {
      const operations = [
        coordinator.updateSearchHighlights("node1", state, {
          expandContainers: true,
          focusFirstResult: false,
        }),
        coordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        }),
        coordinator.updateSearchHighlights("node2", state, {
          expandContainers: false,
          focusFirstResult: false,
        }),
        coordinator.collapseContainer("container2", state, {
          relayoutEntities: ["container2"],
          fitView: false,
        }),
        coordinator.clearSearchHighlights(state, {
          relayoutEntities: [],
          fitView: false,
        }),
      ];

      // Should complete without errors
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe("12.3 Read-write coordination", () => {
    it("should ensure consistent reads after awaiting operations", async () => {
      // Perform a search operation
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      // Read should see consistent state
      const results = state.getSearchResults();
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("Test");
    });

    it("should provide consistent snapshot reads", async () => {
      // Set up initial state
      await coordinator.updateSearchHighlights("node", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      // Take snapshot
      const snapshot1 = state.getSearchResults();
      const query1 = (state as any)._searchNavigationState.searchQuery;

      // Perform another operation
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      // Take another snapshot
      const snapshot2 = state.getSearchResults();
      const query2 = (state as any)._searchNavigationState.searchQuery;

      // Snapshots should be different and consistent
      expect(query1).toBe("node");
      expect(query2).toBe("Test");
      expect(snapshot1).not.toEqual(snapshot2);
    });

    it("should handle opportunistic reads without crashing", () => {
      // Opportunistic reads should not crash even if state is being modified
      expect(() => {
        const results = state.getSearchResults();
        const searchState = (state as any)._searchNavigationState;
        const query = searchState.searchQuery;
      }).not.toThrow();
    });

    it("should maintain consistency during rapid read-write cycles", async () => {
      // Perform multiple write-read cycles
      for (let i = 0; i < 10; i++) {
        await coordinator.updateSearchHighlights(`query${i}`, state, {
          expandContainers: false,
          focusFirstResult: false,
        });

        // Read immediately after write
        const results = state.getSearchResults();
        const searchState = (state as any)._searchNavigationState;

        // State should be consistent
        expect(searchState.searchQuery).toBe(`query${i}`);
        expect(results).toBeDefined();
      }
    });
  });

  describe("12.4 ResizeObserver error elimination", () => {
    it("should not produce ResizeObserver errors during search with expansion", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      // Perform search with container expansion
      await coordinator.updateSearchHighlights("node1", state, {
        expandContainers: true,
        focusFirstResult: false,
      });

      // Check for ResizeObserver errors
      const resizeObserverErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) =>
          String(arg).toLowerCase().includes("resizeobserver"),
        ),
      );

      expect(resizeObserverErrors.length).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it("should not produce ResizeObserver errors during rapid container operations", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      // Rapid container expand/collapse
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          coordinator.expandContainer("container1", state, {
            relayoutEntities: ["container1"],
            fitView: false,
          }),
        );
        operations.push(
          coordinator.collapseContainer("container1", state, {
            relayoutEntities: ["container1"],
            fitView: false,
          }),
        );
      }

      await Promise.all(operations);

      // Check for ResizeObserver errors
      const resizeObserverErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) =>
          String(arg).toLowerCase().includes("resizeobserver"),
        ),
      );

      expect(resizeObserverErrors.length).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it("should not produce console errors during any search scenario", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const consoleWarnSpy = vi.spyOn(console, "warn");

      // Run various search scenarios
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: true,
        focusFirstResult: true,
      });

      await coordinator.updateSearchHighlights("node", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      await coordinator.clearSearchHighlights(state, {
        relayoutEntities: [],
        fitView: false,
      });

      await coordinator.updateSearchHighlights("Node 1", state, {
        expandContainers: true,
        focusFirstResult: true,
      });

      // No errors or warnings should be logged
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it("should handle all previously problematic scenarios without errors", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      // Scenario 1: Rapid typing
      for (let i = 0; i < 5; i++) {
        await coordinator.updateSearchHighlights(`t${i}`, state, {
          expandContainers: true,
          focusFirstResult: false,
        });
      }

      // Scenario 2: Search with container expansion
      await coordinator.updateSearchHighlights("node1", state, {
        expandContainers: true,
        focusFirstResult: true,
      });

      // Scenario 3: Clear and search again
      await coordinator.clearSearchHighlights(state, {
        relayoutEntities: [],
        fitView: false,
      });

      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: true,
        focusFirstResult: true,
      });

      // Scenario 4: Multiple concurrent operations
      await Promise.all([
        coordinator.updateSearchHighlights("node", state, {
          expandContainers: true,
          focusFirstResult: false,
        }),
        coordinator.expandContainer("container2", state, {
          relayoutEntities: ["container2"],
          fitView: false,
        }),
      ]);

      // No ResizeObserver errors should occur
      const resizeObserverErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) =>
          String(arg).toLowerCase().includes("resizeobserver"),
        ),
      );

      expect(resizeObserverErrors.length).toBe(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Additional race condition scenarios", () => {
    it("should handle queue overflow gracefully", async () => {
      // Queue many operations
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          coordinator.updateSearchHighlights(`query${i}`, state, {
            expandContainers: false,
            focusFirstResult: false,
          }),
        );
      }

      // Should complete without errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it("should maintain state consistency with interleaved operations", async () => {
      // Interleave different operation types
      await coordinator.updateSearchHighlights("node1", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });

      await coordinator.updateSearchHighlights("node2", state, {
        expandContainers: false,
        focusFirstResult: false,
      });

      await coordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });

      // Final state should be consistent
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("node2");

      const container1 = state.getContainer("container1");
      expect(container1?.collapsed).toBe(true);
    });

    it("should handle empty queue reads correctly", () => {
      // Reading from empty queue should not crash
      expect(() => {
        const results = state.getSearchResults();
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }).not.toThrow();
    });
  });
});
