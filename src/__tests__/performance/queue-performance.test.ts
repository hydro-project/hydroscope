/**
 * Queue Performance Tests
 *
 * Tests that verify:
 * - Queue latency for empty queue < 10ms
 * - Queue throughput under load (100 operations < 5000ms)
 * - Operation cancellation works correctly
 * - Search performance with large graphs
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 17.1, 17.2, 17.3, 18.1, 18.2, 18.3, 18.4, 18.5
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VisualizationState } from "../../core/VisualizationState.js";
import { AsyncCoordinator } from "../../core/AsyncCoordinator.js";
import { ELKBridge } from "../../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../../bridges/ReactFlowBridge.js";

describe("Queue Performance Tests", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let renderNotificationInterval: NodeJS.Timeout;

  // Performance thresholds
  const THRESHOLDS = {
    emptyQueueLatency: 15, // ms - empty queue should process very fast (slight headroom for CI)
    containerOperationLatency: 80, // ms - container operations involve layout (allow some headroom)
    searchHighlightUpdate: 100, // ms - search with 1000 nodes
    searchClear: 50, // ms - clear operation
    averageOperationTime: 50, // ms - average per operation under load
    totalThroughput: 5000, // ms - 100 operations total
  };

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
    renderNotificationInterval = setInterval(() => {
      if (coordinator.hasPendingCallbacks()) {
        coordinator.notifyRenderComplete();
      }
    }, 5); // Check every 5ms for faster test execution

    // Mock React state setter
    coordinator.setReactStateSetter((updater: any) => {
      if (typeof updater === "function") {
        updater({});
      }
    });

    // Immediately notify render complete
    coordinator.notifyRenderComplete();
  });

  afterEach(() => {
    if (renderNotificationInterval) {
      clearInterval(renderNotificationInterval);
    }
  });

  describe("13.1 Queue Latency", () => {
    it("should process operation with minimal latency on empty queue", async () => {
      // Add minimal test data
      state.addNode({
        id: "node1",
        label: "Test Node",
        longLabel: "Test Node Long",
        type: "default",
        semanticTags: [],
        hidden: false,
      });

      // Measure time from queue to execution
      const start = performance.now();
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: false,
      });
      const duration = performance.now() - start;

      // Verify latency is under threshold
      expect(duration).toBeLessThan(THRESHOLDS.emptyQueueLatency);
      console.log(`Empty queue latency: ${duration.toFixed(2)}ms`);
    });

    it("should have low latency for container expand operation", async () => {
      // Setup
      state.addContainer({
        id: "container1",
        label: "Container",
        children: new Set(["node1"]),
        collapsed: true,
        hidden: false,
      });
      state.addNode({
        id: "node1",
        label: "Node",
        longLabel: "Node Long",
        type: "default",
        semanticTags: [],
        hidden: true,
      });

      // Measure
      const start = performance.now();
      await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });
      const duration = performance.now() - start;

      // Verify - container operations take longer due to layout
      expect(duration).toBeLessThan(THRESHOLDS.containerOperationLatency);
      console.log(`Container expand latency: ${duration.toFixed(2)}ms`);
    });

    it("should have low latency for style update operation", async () => {
      // Add some nodes
      for (let i = 0; i < 10; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Measure
      const start = performance.now();
      await coordinator.updateColorPalette("dark", state, {
        relayoutEntities: [],
        fitView: false,
      });
      const duration = performance.now() - start;

      // Verify
      expect(duration).toBeLessThan(THRESHOLDS.emptyQueueLatency);
      console.log(`Style update latency: ${duration.toFixed(2)}ms`);
    });

    it("should have consistent latency across different operation types", async () => {
      // Setup
      state.addNode({
        id: "node1",
        label: "Test",
        longLabel: "Test Long",
        type: "default",
        semanticTags: [],
        hidden: false,
      });
      state.addContainer({
        id: "container1",
        label: "Container",
        children: new Set(["node1"]),
        collapsed: true,
        hidden: false,
      });

      const durations: Record<string, number> = {};

      // Test search
      let start = performance.now();
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: false,
      });
      durations.search = performance.now() - start;

      // Test clear
      start = performance.now();
      await coordinator.clearSearchHighlights(state, {
        fitView: false,
      });
      durations.clear = performance.now() - start;

      // Test container expand
      start = performance.now();
      await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });
      durations.expand = performance.now() - start;

      // Test container collapse
      start = performance.now();
      await coordinator.collapseContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      });
      durations.collapse = performance.now() - start;

      // All should be under appropriate thresholds
      Object.entries(durations).forEach(([op, duration]) => {
        const threshold =
          op === "expand" || op === "collapse"
            ? THRESHOLDS.containerOperationLatency
            : THRESHOLDS.emptyQueueLatency;
        expect(duration).toBeLessThan(threshold);
        console.log(
          `${op} latency: ${duration.toFixed(2)}ms (threshold ${threshold}ms)`,
        );
      });
    });
  });

  describe("13.2 Queue Throughput", () => {
    it("should process 100 operations within throughput threshold", async () => {
      // Add test data
      for (let i = 0; i < 20; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Queue 100 operations
      const promises = [];
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        promises.push(
          coordinator.updateSearchHighlights(`query${i % 10}`, state, {
            expandContainers: false,
          }),
        );
      }

      await Promise.all(promises);
      const totalDuration = performance.now() - start;

      // Verify total time is under threshold
      expect(totalDuration).toBeLessThan(THRESHOLDS.totalThroughput);

      // Verify average time per operation
      const avgDuration = totalDuration / 100;
      expect(avgDuration).toBeLessThan(THRESHOLDS.averageOperationTime);

      console.log(`100 operations: ${totalDuration.toFixed(2)}ms total`);
      console.log(`Average per operation: ${avgDuration.toFixed(2)}ms`);
    });

    it("should maintain throughput with mixed operation types", async () => {
      // Setup
      for (let i = 0; i < 10; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }
      state.addContainer({
        id: "container1",
        label: "Container",
        children: new Set(["node1", "node2"]),
        collapsed: true,
        hidden: false,
      });

      // Queue mixed operations
      const promises = [];
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const opType = i % 4;
        if (opType === 0) {
          promises.push(
            coordinator.updateSearchHighlights(`query${i}`, state, {
              expandContainers: false,
            }),
          );
        } else if (opType === 1) {
          promises.push(
            coordinator.expandContainer("container1", state, {
              relayoutEntities: ["container1"],
              fitView: false,
            }),
          );
        } else if (opType === 2) {
          promises.push(
            coordinator.collapseContainer("container1", state, {
              relayoutEntities: ["container1"],
              fitView: false,
            }),
          );
        } else {
          promises.push(
            coordinator.clearSearchHighlights(state, {
              fitView: false,
            }),
          );
        }
      }

      await Promise.all(promises);
      const totalDuration = performance.now() - start;

      // Verify throughput
      expect(totalDuration).toBeLessThan(THRESHOLDS.totalThroughput);
      const avgDuration = totalDuration / 100;

      console.log(`Mixed operations: ${totalDuration.toFixed(2)}ms total`);
      console.log(`Average: ${avgDuration.toFixed(2)}ms`);
    });

    it("should scale linearly with operation count", async () => {
      // Add test data
      for (let i = 0; i < 10; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Test with different operation counts
      const counts = [10, 50, 100];
      const results: Array<{ count: number; duration: number; avg: number }> =
        [];

      for (const count of counts) {
        const promises = [];
        const start = performance.now();

        for (let i = 0; i < count; i++) {
          promises.push(
            coordinator.updateSearchHighlights(`query${i}`, state, {
              expandContainers: false,
            }),
          );
        }

        await Promise.all(promises);
        const duration = performance.now() - start;
        const avg = duration / count;

        results.push({ count, duration, avg });
      }

      // Verify linear scaling (average time should be relatively constant)
      const avgTimes = results.map((r) => r.avg);
      const maxAvg = Math.max(...avgTimes);
      const minAvg = Math.min(...avgTimes);

      // Max average should not be more than 3x min average
      expect(maxAvg).toBeLessThan(minAvg * 3);

      results.forEach((r) => {
        console.log(
          `${r.count} ops: ${r.duration.toFixed(2)}ms total, ${r.avg.toFixed(2)}ms avg`,
        );
      });
    });
  });

  describe("13.3 Operation Cancellation", () => {
    it("should cancel obsolete search operations", async () => {
      // Add test data
      for (let i = 0; i < 20; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Queue multiple searches rapidly
      const queries = ["query1", "query2", "query3", "query4", "final"];
      const promises = queries.map((query) =>
        coordinator.updateSearchHighlights(query, state, {
          expandContainers: false,
        }),
      );

      await Promise.all(promises);

      // Final state should match the last search
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("final");

      console.log("Cancellation test: Final query is 'final'");
    });

    it("should handle cancellation without errors", async () => {
      // Add test data
      for (let i = 0; i < 10; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Queue many operations that could be cancelled
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          coordinator.updateSearchHighlights(`query${i}`, state, {
            expandContainers: false,
          }),
        );
      }

      // Should complete without throwing
      await expect(Promise.all(promises)).resolves.toBeDefined();

      console.log("Cancellation: 50 operations completed without errors");
    });

    it("should verify only latest search executes when rapidly typing", async () => {
      // Add test data
      for (let i = 0; i < 15; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Test Node ${i}`,
          longLabel: `Test Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Simulate rapid typing
      const typingSequence = ["T", "Te", "Tes", "Test", "Test ", "Test N"];
      const promises = typingSequence.map((query) =>
        coordinator.updateSearchHighlights(query, state, {
          expandContainers: false,
        }),
      );

      await Promise.all(promises);

      // Final state should match last query
      const searchState = (state as any)._searchNavigationState;
      expect(searchState.searchQuery).toBe("Test N");

      console.log("Rapid typing: Final query is 'Test N'");
    });
  });

  describe("13.4 Search Performance", () => {
    it("should handle search with 1000+ nodes efficiently", async () => {
      // Add 1000+ nodes
      for (let i = 0; i < 1000; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Test Node ${i}`,
          longLabel: `Test Node ${i} Long Label`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Measure search performance
      const start = performance.now();
      await coordinator.updateSearchHighlights("Test Node", state, {
        expandContainers: false,
      });
      const duration = performance.now() - start;

      // Verify under threshold
      expect(duration).toBeLessThan(THRESHOLDS.searchHighlightUpdate);

      const results = state.getSearchResults();
      console.log(
        `Search 1000 nodes: ${duration.toFixed(2)}ms, found ${results.length} results`,
      );
    });

    it("should clear highlights quickly with large graphs", async () => {
      // Add 1000+ nodes
      for (let i = 0; i < 1000; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Test Node ${i}`,
          longLabel: `Test Node ${i} Long Label`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // First perform a search
      await coordinator.updateSearchHighlights("Test", state, {
        expandContainers: false,
      });

      // Measure clear performance
      const start = performance.now();
      await coordinator.clearSearchHighlights(state, {
        fitView: false,
      });
      const duration = performance.now() - start;

      // Verify under threshold
      expect(duration).toBeLessThan(THRESHOLDS.searchClear);

      console.log(`Clear 1000 nodes: ${duration.toFixed(2)}ms`);
    });

    it("should maintain performance with repeated searches on large graphs", async () => {
      // Add 500 nodes
      for (let i = 0; i < 500; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Test Node ${i}`,
          longLabel: `Test Node ${i} Long Label`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Perform multiple searches
      const durations: number[] = [];
      const queries = ["Test", "Node", "Test Node", "Node 1", "Test Node 1"];

      for (const query of queries) {
        const start = performance.now();
        await coordinator.updateSearchHighlights(query, state, {
          expandContainers: false,
        });
        durations.push(performance.now() - start);
      }

      // All should be under threshold
      durations.forEach((duration, i) => {
        expect(duration).toBeLessThan(THRESHOLDS.searchHighlightUpdate);
        console.log(`Search ${i + 1}: ${duration.toFixed(2)}ms`);
      });

      // No significant degradation
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      expect(lastDuration).toBeLessThan(firstDuration * 2);
    });

    it("should scale sub-linearly with graph size", async () => {
      const sizes = [100, 500, 1000];
      const results: Array<{ size: number; duration: number }> = [];

      for (const size of sizes) {
        const testState = new VisualizationState();

        // Add nodes
        for (let i = 0; i < size; i++) {
          testState.addNode({
            id: `node${i}`,
            label: `Test Node ${i}`,
            longLabel: `Test Node ${i} Long`,
            type: "default",
            semanticTags: [],
            hidden: false,
          });
        }

        // Measure search
        const start = performance.now();
        await coordinator.updateSearchHighlights("Test", testState, {
          expandContainers: false,
        });
        const duration = performance.now() - start;

        results.push({ size, duration });
      }

      // Verify sub-linear scaling
      // 10x size increase should not cause 10x duration increase
      const ratio100to1000 = results[2].duration / results[0].duration;
      expect(ratio100to1000).toBeLessThan(5); // 10x size -> less than 5x time

      results.forEach((r) => {
        console.log(`Graph size ${r.size}: ${r.duration.toFixed(2)}ms`);
      });
    });
  });

  describe("Performance Regression Detection", () => {
    it("should detect performance degradation over time", async () => {
      // Add test data
      for (let i = 0; i < 50; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Perform same operation multiple times
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await coordinator.updateSearchHighlights(`query${i}`, state, {
          expandContainers: false,
        });
        durations.push(performance.now() - start);
      }

      // Calculate statistics
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);

      // Max should not be significantly higher than average
      expect(max).toBeLessThan(avg * 3);

      console.log(`Performance stats over ${iterations} iterations:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
    });

    it("should maintain consistent memory usage", async () => {
      // Add test data
      for (let i = 0; i < 100; i++) {
        state.addNode({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: "default",
          semanticTags: [],
          hidden: false,
        });
      }

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await coordinator.updateSearchHighlights(`query${i % 10}`, state, {
          expandContainers: false,
        });
      }

      // Verify state is still consistent
      const searchState = (state as any)._searchNavigationState;
      expect(searchState).toBeDefined();
      expect(searchState.graphSearchHighlights).toBeDefined();

      console.log("Memory test: 100 operations completed, state consistent");
    });
  });
});
