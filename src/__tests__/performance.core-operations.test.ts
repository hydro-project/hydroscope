/**
 * Core Operations Performance Tests
 * Simple end-to-end performance regression tests for critical operations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import {
  createTestNode,
  createTestContainer,
  createTestAsyncCoordinator,
} from "../utils/testData.js";
import type { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("Core Operations Performance", () => {
  let state: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;

  // Performance thresholds (in ms) - adjust based on actual performance
  const THRESHOLDS = {
    layoutAndRender: 500, // Layout + render should be fast
    containerExpand: 300, // Single container expand
    containerCollapse: 300, // Single container collapse
    bulkOperations: 1000, // Multiple operations in sequence
    searchOperation: 100, // Search should be very fast
  };

  beforeEach(async () => {
    state = new VisualizationState();
    const testSetup = await createTestAsyncCoordinator();
    asyncCoordinator = testSetup.asyncCoordinator;
  });

  it("should perform layout and render within threshold", async () => {
    // Setup: Add nodes
    for (let i = 0; i < 20; i++) {
      state.addNode(createTestNode(`node${i}`, `Node ${i}`));
    }

    // Measure
    const start = performance.now();
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });
    const duration = performance.now() - start;

    // Assert
    expect(duration).toBeLessThan(THRESHOLDS.layoutAndRender);
    console.log(`Layout+Render: ${duration.toFixed(2)}ms`);
  });

  it("should expand container within threshold", async () => {
    // Setup: Add nodes first with hidden flag for collapsed container
    const n1 = createTestNode("n1");
    const n2 = createTestNode("n2");
    const n3 = createTestNode("n3");
    n1.hidden = true;
    n2.hidden = true;
    n3.hidden = true;
    state.addNode(n1);
    state.addNode(n2);
    state.addNode(n3);

    // Then add collapsed container
    const container = createTestContainer("c1", ["n1", "n2", "n3"]);
    container.collapsed = true;
    state.addContainer(container);

    // Measure
    const start = performance.now();
    await asyncCoordinator.expandContainer("c1", state, { fitView: false });
    const duration = performance.now() - start;

    // Assert
    expect(duration).toBeLessThan(THRESHOLDS.containerExpand);
    expect(state.getContainer("c1")?.collapsed).toBe(false);
    console.log(`Container Expand: ${duration.toFixed(2)}ms`);
  });

  it("should collapse container within threshold", async () => {
    // Setup
    const container = createTestContainer("c1", ["n1", "n2", "n3"]);
    container.collapsed = false;
    state.addContainer(container);
    state.addNode(createTestNode("n1"));
    state.addNode(createTestNode("n2"));
    state.addNode(createTestNode("n3"));

    // Measure
    const start = performance.now();
    await asyncCoordinator.collapseContainer("c1", state, { fitView: false });
    const duration = performance.now() - start;

    // Assert
    expect(duration).toBeLessThan(THRESHOLDS.containerCollapse);
    expect(state.getContainer("c1")?.collapsed).toBe(true);
    console.log(`Container Collapse: ${duration.toFixed(2)}ms`);
  });

  it("should handle bulk container operations within threshold", async () => {
    // Setup: Multiple containers
    for (let i = 0; i < 5; i++) {
      const container = createTestContainer(`c${i}`, [`n${i}a`, `n${i}b`]);
      container.collapsed = false;
      state.addContainer(container);
      state.addNode(createTestNode(`n${i}a`));
      state.addNode(createTestNode(`n${i}b`));
    }

    // Measure: Collapse all then expand all
    const start = performance.now();
    await asyncCoordinator.collapseAllContainers(state, { fitView: false });
    await asyncCoordinator.expandAllContainers(state, { fitView: false });
    const duration = performance.now() - start;

    // Assert
    expect(duration).toBeLessThan(THRESHOLDS.bulkOperations);
    console.log(`Bulk Operations: ${duration.toFixed(2)}ms`);
  });

  it("should perform search operations within threshold", async () => {
    // Setup
    for (let i = 0; i < 30; i++) {
      state.addNode(createTestNode(`node${i}`, `TestNode ${i}`));
    }

    // Measure
    const start = performance.now();
    const results = state.performSearch("TestNode");
    const duration = performance.now() - start;

    // Assert
    expect(duration).toBeLessThan(THRESHOLDS.searchOperation);
    expect(results.length).toBeGreaterThan(0);
    console.log(
      `Search: ${duration.toFixed(2)}ms, found ${results.length} results`
    );
  });

  it("should maintain consistent performance across repeated operations", async () => {
    // Setup
    const container = createTestContainer("c1", ["n1", "n2"]);
    state.addContainer(container);
    state.addNode(createTestNode("n1"));
    state.addNode(createTestNode("n2"));

    // Measure multiple iterations
    const iterations = 5;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      if (i % 2 === 0) {
        await asyncCoordinator.collapseContainer("c1", state, {
          fitView: false,
        });
      } else {
        await asyncCoordinator.expandContainer("c1", state, {
          fitView: false,
        });
      }
      durations.push(performance.now() - start);
    }

    // Assert: No significant degradation (last operation shouldn't be > 3x first)
    const firstDuration = durations[0];
    const lastDuration = durations[durations.length - 1];
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    expect(lastDuration).toBeLessThan(firstDuration * 3);
    console.log(
      `Repeated operations - Avg: ${avgDuration.toFixed(2)}ms, First: ${firstDuration.toFixed(2)}ms, Last: ${lastDuration.toFixed(2)}ms`
    );
  });

  it("should scale reasonably with graph size", async () => {
    // Test with different graph sizes
    const sizes = [10, 50, 100];
    const results: Array<{ size: number; duration: number }> = [];

    for (const size of sizes) {
      const testState = new VisualizationState();

      // Add nodes
      for (let i = 0; i < size; i++) {
        testState.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }

      // Measure layout
      const start = performance.now();
      await asyncCoordinator.executeLayoutAndRenderPipeline(testState, {
        fitView: false,
      });
      const duration = performance.now() - start;

      results.push({ size, duration });
    }

    // Assert: Should scale sub-quadratically (rough check)
    // 10x size increase should not cause 100x duration increase
    const ratio10to100 = results[2].duration / results[0].duration;
    expect(ratio10to100).toBeLessThan(50); // 10x size -> less than 50x time

    results.forEach((r) => {
      console.log(`Graph size ${r.size}: ${r.duration.toFixed(2)}ms`);
    });
  });
});
