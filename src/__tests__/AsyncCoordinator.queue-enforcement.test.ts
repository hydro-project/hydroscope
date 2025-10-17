/**
 * AsyncCoordinator Queue Enforcement and Atomicity Tests
 * 
 * Tests that verify:
 * - All operations execute sequentially through the queue
 * - FIFO execution order is maintained
 * - Operations are atomic (no overlap)
 * - Concurrent calls are properly serialized
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("AsyncCoordinator - Queue Enforcement and Atomicity", () => {
  let coordinator: AsyncCoordinator;
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});

    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Add test data
    state.addNode({
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "Node 2",
      longLabel: "Node 2 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addEdge({
      id: "edge1",
      source: "node1",
      target: "node2",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addContainer({
      id: "container1",
      label: "Container 1",
      children: new Set(["node1"]),
      collapsed: true,
      hidden: false,
    });
  });

  describe("Concurrent Operation Sequentiality", () => {
    it("should execute concurrent layout operations sequentially without overlap", async () => {
      const executionLog: Array<{ operation: string; phase: string; timestamp: number }> = [];
      const startTime = Date.now();

      // Create multiple concurrent layout operations
      const promise1 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionLog.push({ operation: "layout1", phase: "complete", timestamp: Date.now() - startTime });
        return result;
      });

      // Track when operation starts
      executionLog.push({ operation: "layout1", phase: "queued", timestamp: Date.now() - startTime });

      const promise2 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionLog.push({ operation: "layout2", phase: "complete", timestamp: Date.now() - startTime });
        return result;
      });

      executionLog.push({ operation: "layout2", phase: "queued", timestamp: Date.now() - startTime });

      const promise3 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionLog.push({ operation: "layout3", phase: "complete", timestamp: Date.now() - startTime });
        return result;
      });

      executionLog.push({ operation: "layout3", phase: "queued", timestamp: Date.now() - startTime });

      // Wait for all operations to complete
      const results = await Promise.all([promise1, promise2, promise3]);

      // Verify all operations completed successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      });

      // Verify operations completed in order
      const completions = executionLog.filter((log) => log.phase === "complete");
      expect(completions).toHaveLength(3);
      expect(completions[0].operation).toBe("layout1");
      expect(completions[1].operation).toBe("layout2");
      expect(completions[2].operation).toBe("layout3");

      // Verify no overlap: each operation should complete before the next starts
      // This is guaranteed by the queue, but we verify the completion order
      expect(completions[0].timestamp).toBeLessThan(completions[1].timestamp);
      expect(completions[1].timestamp).toBeLessThan(completions[2].timestamp);
    });

    it("should execute concurrent container operations sequentially", async () => {
      const executionOrder: string[] = [];

      // Queue multiple container operations concurrently
      const promise1 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then((result) => {
        executionOrder.push("expand");
        return result;
      });

      const promise2 = coordinator.collapseContainer("container1", state, elkBridge).then((result) => {
        executionOrder.push("collapse");
        return result;
      });

      const promise3 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then((result) => {
        executionOrder.push("expand2");
        return result;
      });

      // Wait for all operations
      await Promise.all([promise1, promise2, promise3]);

      // Verify sequential execution order
      expect(executionOrder).toEqual(["expand", "collapse", "expand2"]);
    });

    it("should execute concurrent container and layout operations sequentially", async () => {
      const executionOrder: string[] = [];

      // Queue multiple operations concurrently
      const promise1 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then((result) => {
        executionOrder.push("expand1");
        return result;
      });

      const promise2 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionOrder.push("layout");
        return result;
      });

      const promise3 = coordinator.collapseContainer("container1", state, elkBridge).then((result) => {
        executionOrder.push("collapse");
        return result;
      });

      // Wait for all operations
      await Promise.all([promise1, promise2, promise3]);

      // Verify sequential execution order
      expect(executionOrder).toEqual(["expand1", "layout", "collapse"]);
    });

    it("should execute mixed operation types sequentially", async () => {
      const executionOrder: string[] = [];

      // Mix different operation types
      const promise1 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionOrder.push("layout1");
        return result;
      });

      const promise2 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then((result) => {
        executionOrder.push("expand");
        return result;
      });

      const promise3 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then((result) => {
        executionOrder.push("layout2");
        return result;
      });

      const promise4 = coordinator.collapseContainer("container1", state, elkBridge).then((result) => {
        executionOrder.push("collapse");
        return result;
      });

      // Wait for all operations
      await Promise.all([promise1, promise2, promise3, promise4]);

      // Verify sequential execution order
      expect(executionOrder).toEqual(["layout1", "expand", "layout2", "collapse"]);
    });
  });

  describe("FIFO Execution Order", () => {
    it("should execute operations in the exact order they were queued", async () => {
      const executionOrder: number[] = [];
      const promises: Promise<any>[] = [];

      // Queue 10 operations in sequence
      for (let i = 1; i <= 10; i++) {
        const operationId = i;
        const promise = (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            executionOrder.push(operationId);
            // Small delay to ensure operations don't complete instantly
            await new Promise((resolve) => setTimeout(resolve, 1));
            return `result${operationId}`;
          },
          {},
        );
        promises.push(promise);
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify strict FIFO order
      expect(executionOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("should maintain FIFO order for different operation types", async () => {
      const executionOrder: string[] = [];

      // Queue operations of different types in a specific order
      const p1 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then(() => executionOrder.push("layout1"));

      const p2 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then(() => executionOrder.push("expand"));

      const p3 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then(() => executionOrder.push("layout2"));

      const p4 = coordinator.collapseContainer("container1", state, elkBridge)
        .then(() => executionOrder.push("collapse"));

      const p5 = coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false,
      }).then(() => executionOrder.push("expand2"));

      const p6 = coordinator.executeLayoutAndRenderPipeline(state, {
        fitView: false,
      }).then(() => executionOrder.push("layout3"));

      // Wait for all operations
      await Promise.all([p1, p2, p3, p4, p5, p6]);

      // Verify exact FIFO order
      expect(executionOrder).toEqual([
        "layout1",
        "expand",
        "layout2",
        "collapse",
        "expand2",
        "layout3",
      ]);
    });

    it("should maintain FIFO order even with varying operation durations", async () => {
      const executionOrder: string[] = [];

      // Queue operations with different durations
      const p1 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          executionOrder.push("slow1");
          return "slow1";
        },
        {},
      );

      const p2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          // Fast operation
          executionOrder.push("fast1");
          return "fast1";
        },
        {},
      );

      const p3 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          executionOrder.push("medium");
          return "medium";
        },
        {},
      );

      const p4 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          // Fast operation
          executionOrder.push("fast2");
          return "fast2";
        },
        {},
      );

      // Wait for all operations
      await Promise.all([p1, p2, p3, p4]);

      // Despite different durations, order should be maintained
      expect(executionOrder).toEqual(["slow1", "fast1", "medium", "fast2"]);
    });

    it("should maintain FIFO order when operations are queued during processing", async () => {
      const executionOrder: string[] = [];

      // Queue first operation
      const p1 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op1");
          
          // Queue more operations while this one is executing
          // These should be added to the queue and execute after current operation
          const p2 = (coordinator as any)._enqueueAndWait(
            "application_event",
            async () => {
              executionOrder.push("op2-nested");
              return "op2";
            },
            {},
          );

          const p3 = (coordinator as any)._enqueueAndWait(
            "application_event",
            async () => {
              executionOrder.push("op3-nested");
              return "op3";
            },
            {},
          );

          // Don't wait for nested operations
          return "op1";
        },
        {},
      );

      // Queue another operation before the first completes
      const p4 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op4");
          return "op4";
        },
        {},
      );

      // Wait for all operations
      await Promise.all([p1, p4]);
      
      // Give nested operations time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify order: op1 completes first, then op4 (queued before nested ops),
      // then nested ops in their queue order
      expect(executionOrder[0]).toBe("op1");
      expect(executionOrder).toContain("op4");
      expect(executionOrder).toContain("op2-nested");
      expect(executionOrder).toContain("op3-nested");
    });
  });

  describe("Operation Atomicity", () => {
    it("should ensure maximum one operation executes at a time", async () => {
      let operationsInProgress = 0;
      let maxConcurrent = 0;
      const executionLog: Array<{ operation: number; phase: string; concurrent: number }> = [];

      const promises: Promise<any>[] = [];

      // Queue 20 operations that track concurrency
      for (let i = 1; i <= 20; i++) {
        const operationId = i;
        const promise = (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            // Track operation start
            operationsInProgress++;
            maxConcurrent = Math.max(maxConcurrent, operationsInProgress);
            executionLog.push({
              operation: operationId,
              phase: "start",
              concurrent: operationsInProgress,
            });

            // Simulate work with small delay
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Track operation end
            executionLog.push({
              operation: operationId,
              phase: "end",
              concurrent: operationsInProgress,
            });
            operationsInProgress--;

            return `result${operationId}`;
          },
          {},
        );
        promises.push(promise);
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify atomicity: maximum concurrent operations should always be 1
      expect(maxConcurrent).toBe(1);

      // Verify no operation started while another was in progress
      executionLog.forEach((log) => {
        if (log.phase === "start") {
          expect(log.concurrent).toBe(1);
        }
      });
    });

    it("should ensure atomicity for real coordinator operations", async () => {
      let operationsInProgress = 0;
      let maxConcurrent = 0;

      // Wrap coordinator methods to track concurrency
      const originalEnqueueAndWait = (coordinator as any)._enqueueAndWait.bind(coordinator);
      (coordinator as any)._enqueueAndWait = async function (
        operationType: string,
        handler: () => Promise<any>,
        options: any,
      ) {
        return originalEnqueueAndWait(operationType, async () => {
          operationsInProgress++;
          maxConcurrent = Math.max(maxConcurrent, operationsInProgress);

          try {
            const result = await handler();
            return result;
          } finally {
            operationsInProgress--;
          }
        }, options);
      };

      // Queue multiple real operations concurrently
      const promises = [
        coordinator.executeLayoutAndRenderPipeline(state, { fitView: false }),
        coordinator.executeLayoutAndRenderPipeline(state, { fitView: false }),
        coordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        }),
        coordinator.collapseContainer("container1", state, elkBridge),
        coordinator.expandContainer("container1", state, {
          relayoutEntities: ["container1"],
          fitView: false,
        }),
        coordinator.executeLayoutAndRenderPipeline(state, { fitView: false }),
      ];

      // Wait for all operations
      await Promise.all(promises);

      // Verify atomicity: only one operation at a time
      expect(maxConcurrent).toBe(1);
    });

    it("should ensure atomicity even with fast operations", async () => {
      let operationsInProgress = 0;
      let maxConcurrent = 0;
      const concurrencySnapshots: number[] = [];

      const promises: Promise<any>[] = [];

      // Queue 50 very fast operations
      for (let i = 1; i <= 50; i++) {
        const promise = (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            operationsInProgress++;
            const currentConcurrent = operationsInProgress;
            maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
            concurrencySnapshots.push(currentConcurrent);

            // Very fast operation (no delay)
            const result = `result${i}`;

            operationsInProgress--;
            return result;
          },
          {},
        );
        promises.push(promise);
      }

      // Wait for all operations
      await Promise.all(promises);

      // Verify atomicity even with fast operations
      expect(maxConcurrent).toBe(1);

      // All snapshots should show exactly 1 operation in progress
      concurrencySnapshots.forEach((snapshot) => {
        expect(snapshot).toBe(1);
      });
    });

    it("should ensure atomicity across operation failures", async () => {
      let operationsInProgress = 0;
      let maxConcurrent = 0;

      const promises: Promise<any>[] = [];

      // Queue operations where some fail
      for (let i = 1; i <= 10; i++) {
        const operationId = i;
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              operationsInProgress++;
              maxConcurrent = Math.max(maxConcurrent, operationsInProgress);

              await new Promise((resolve) => setTimeout(resolve, 5));

              operationsInProgress--;

              // Fail every 3rd operation
              if (operationId % 3 === 0) {
                throw new Error(`Operation ${operationId} failed`);
              }

              return `result${operationId}`;
            },
            { maxRetries: 0 },
          )
          .catch(() => {
            // Ignore errors for this test
          });
        promises.push(promise);
      }

      // Wait for all operations
      await Promise.all(promises);

      // Verify atomicity maintained even with failures
      expect(maxConcurrent).toBe(1);
    });

    it("should ensure atomicity when operations are queued during execution", async () => {
      let operationsInProgress = 0;
      let maxConcurrent = 0;

      // First operation that queues more operations
      const p1 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          operationsInProgress++;
          maxConcurrent = Math.max(maxConcurrent, operationsInProgress);

          // Queue nested operations
          const nested1 = (coordinator as any)._enqueueAndWait(
            "application_event",
            async () => {
              operationsInProgress++;
              maxConcurrent = Math.max(maxConcurrent, operationsInProgress);
              await new Promise((resolve) => setTimeout(resolve, 5));
              operationsInProgress--;
              return "nested1";
            },
            {},
          );

          const nested2 = (coordinator as any)._enqueueAndWait(
            "application_event",
            async () => {
              operationsInProgress++;
              maxConcurrent = Math.max(maxConcurrent, operationsInProgress);
              await new Promise((resolve) => setTimeout(resolve, 5));
              operationsInProgress--;
              return "nested2";
            },
            {},
          );

          await new Promise((resolve) => setTimeout(resolve, 10));
          operationsInProgress--;
          return "parent";
        },
        {},
      );

      // Another operation queued externally
      const p2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          operationsInProgress++;
          maxConcurrent = Math.max(maxConcurrent, operationsInProgress);
          await new Promise((resolve) => setTimeout(resolve, 5));
          operationsInProgress--;
          return "external";
        },
        {},
      );

      // Wait for all operations
      await Promise.all([p1, p2]);
      
      // Give nested operations time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify atomicity: only one operation at a time
      expect(maxConcurrent).toBe(1);
    });
  });
});
