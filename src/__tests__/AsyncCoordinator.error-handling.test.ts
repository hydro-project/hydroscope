/**
 * AsyncCoordinator Error Handling and Promise Rejection Tests
 *
 * Tests that verify:
 * - Timeout errors propagate to callers
 * - Retry exhaustion errors propagate to callers
 * - Failed operations don't block subsequent operations
 * - operationPromises Map is cleaned up after errors
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("AsyncCoordinator - Error Handling and Promise Rejection", () => {
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
  });

  describe("Timeout Error Propagation", () => {
    it("should propagate timeout errors to callers", async () => {
      // Queue an operation that will timeout
      const promise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          // Simulate a long-running operation
          await new Promise((resolve) => setTimeout(resolve, 200));
          return "should_not_complete";
        },
        { timeout: 50 }, // Timeout before operation completes
      );

      // Verify the promise rejects with a timeout error
      await expect(promise).rejects.toThrow(/timed out after 50ms/);
    });

    it("should propagate timeout errors for multiple concurrent operations", async () => {
      const promises = [
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "op1";
          },
          { timeout: 50 },
        ),
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "op2";
          },
          { timeout: 50 },
        ),
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "op3";
          },
          { timeout: 50 },
        ),
      ];

      // All promises should reject with timeout errors
      for (const promise of promises) {
        await expect(promise).rejects.toThrow(/timed out/);
      }
    });

    it("should include operation details in timeout error message", async () => {
      const promise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return "result";
        },
        { timeout: 50 },
      );

      try {
        await promise;
        expect.fail("Promise should have rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("timed out");
        expect((error as Error).message).toContain("50ms");
      }
    });

    it("should allow subsequent operations to proceed after timeout", async () => {
      // First operation times out
      const timeoutPromise = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "timeout_op";
          },
          { timeout: 50 },
        )
        .catch(() => "timeout_caught");

      // Second operation should succeed
      const successPromise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          return "success_op";
        },
        {},
      );

      const results = await Promise.all([timeoutPromise, successPromise]);

      expect(results[0]).toBe("timeout_caught");
      expect(results[1]).toBe("success_op");
    });
  });

  describe("Retry Exhaustion Error Propagation", () => {
    it("should propagate errors after retry exhaustion", async () => {
      let attemptCount = 0;

      const promise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          attemptCount++;
          throw new Error(`Attempt ${attemptCount} failed`);
        },
        { maxRetries: 2 }, // Will try 3 times total (initial + 2 retries)
      );

      await expect(promise).rejects.toThrow(/Attempt 3 failed/);
      expect(attemptCount).toBe(3);
    });

    it("should propagate retry exhaustion for multiple operations", async () => {
      const attemptCounts = [0, 0, 0];

      const promises = [
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            attemptCounts[0]++;
            throw new Error(`Op1 attempt ${attemptCounts[0]} failed`);
          },
          { maxRetries: 1 },
        ),
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            attemptCounts[1]++;
            throw new Error(`Op2 attempt ${attemptCounts[1]} failed`);
          },
          { maxRetries: 1 },
        ),
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            attemptCounts[2]++;
            throw new Error(`Op3 attempt ${attemptCounts[2]} failed`);
          },
          { maxRetries: 1 },
        ),
      ];

      // All should reject after retries
      for (let i = 0; i < promises.length; i++) {
        await expect(promises[i]).rejects.toThrow(/failed/);
        expect(attemptCounts[i]).toBe(2); // Initial + 1 retry
      }
    });

    it("should include error details in retry exhaustion rejection", async () => {
      const promise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          throw new Error("Operation failed with specific error");
        },
        { maxRetries: 2 },
      );

      try {
        await promise;
        expect.fail("Promise should have rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Operation failed with specific error",
        );
      }
    });

    it("should allow subsequent operations after retry exhaustion", async () => {
      let failCount = 0;

      // First operation fails after retries
      const failPromise = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            failCount++;
            throw new Error("Always fails");
          },
          { maxRetries: 1 },
        )
        .catch(() => "fail_caught");

      // Second operation should succeed
      const successPromise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          return "success";
        },
        {},
      );

      const results = await Promise.all([failPromise, successPromise]);

      expect(results[0]).toBe("fail_caught");
      expect(results[1]).toBe("success");
      expect(failCount).toBe(2); // Initial + 1 retry
    });
  });

  describe("Failed Operations Don't Block Queue", () => {
    it("should process subsequent operations after a failure", async () => {
      const executionOrder: string[] = [];

      // Queue operations where some fail
      const p1 = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            executionOrder.push("op1");
            throw new Error("Op1 failed");
          },
          { maxRetries: 0 },
        )
        .catch(() => {
          // Ignore error
        });

      const p2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op2");
          return "op2_success";
        },
        {},
      );

      const p3 = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            executionOrder.push("op3");
            throw new Error("Op3 failed");
          },
          { maxRetries: 0 },
        )
        .catch(() => {
          // Ignore error
        });

      const p4 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op4");
          return "op4_success";
        },
        {},
      );

      await Promise.all([p1, p2, p3, p4]);

      // Verify all operations executed in order despite failures
      // The operations execute in FIFO order
      expect(executionOrder).toEqual(["op1", "op2", "op3", "op4"]);
    });

    it("should continue processing queue after timeout", async () => {
      const executionOrder: string[] = [];

      const p1 = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            executionOrder.push("op1_start");
            await new Promise((resolve) => setTimeout(resolve, 200));
            executionOrder.push("op1_complete");
            return "op1";
          },
          { timeout: 50 },
        )
        .catch(() => {
          // Ignore timeout error
        });

      const p2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op2");
          return "op2";
        },
        {},
      );

      const p3 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push("op3");
          return "op3";
        },
        {},
      );

      await Promise.all([p1, p2, p3]);

      // Verify queue continued after timeout
      expect(executionOrder).toContain("op1_start");
      expect(executionOrder).toContain("op2");
      expect(executionOrder).toContain("op3");

      // Verify order: op1 starts (but times out), then subsequent ops execute
      const op1StartIndex = executionOrder.indexOf("op1_start");
      const op2Index = executionOrder.indexOf("op2");
      const op3Index = executionOrder.indexOf("op3");

      expect(op1StartIndex).toBeLessThan(op2Index);
      expect(op2Index).toBeLessThan(op3Index);

      // op1_complete should not be in the log since it timed out
      expect(executionOrder).not.toContain("op1_complete");
    });

    it("should handle mix of successful and failed operations", async () => {
      const results: Array<{ status: string; value?: string }> = [];

      const promises = [];

      for (let i = 1; i <= 10; i++) {
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              // Fail every 3rd operation
              if (i % 3 === 0) {
                throw new Error(`Operation ${i} failed`);
              }
              return `success_${i}`;
            },
            { maxRetries: 0 },
          )
          .then((value: string) => {
            results.push({ status: "success", value });
          })
          .catch(() => {
            results.push({ status: "failed" });
          });

        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify all operations completed (either success or failure)
      expect(results).toHaveLength(10);

      // Verify correct number of successes and failures
      const successes = results.filter((r) => r.status === "success");
      const failures = results.filter((r) => r.status === "failed");

      expect(successes).toHaveLength(7); // 1,2,4,5,7,8,10
      expect(failures).toHaveLength(3); // 3,6,9
    });

    it("should maintain queue integrity after multiple failures", async () => {
      const executionOrder: number[] = [];

      // Queue 20 operations where half fail
      const promises = [];
      for (let i = 1; i <= 20; i++) {
        const operationId = i;
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              executionOrder.push(operationId);
              if (operationId % 2 === 0) {
                throw new Error(`Operation ${operationId} failed`);
              }
              return `result_${operationId}`;
            },
            { maxRetries: 0 },
          )
          .catch(() => {
            // Ignore errors
          });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify all operations executed in order
      expect(executionOrder).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      ]);
    });
  });

  describe("operationPromises Map Cleanup", () => {
    it("should clean up operationPromises Map after successful operation", async () => {
      // Access private operationPromises Map
      const promisesMap = (coordinator as any).operationPromises;

      // Verify map is initially empty
      expect(promisesMap.size).toBe(0);

      // Queue an operation
      const promise = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          // Map should have entry while operation is queued/processing
          return "success";
        },
        {},
      );

      // Wait for operation to complete
      await promise;

      // Verify map is cleaned up after completion
      expect(promisesMap.size).toBe(0);
    });

    it("should clean up operationPromises Map after timeout", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      const promise = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "should_timeout";
          },
          { timeout: 50 },
        )
        .catch(() => {
          // Ignore error
        });

      await promise;

      // Verify map is cleaned up after timeout
      expect(promisesMap.size).toBe(0);
    });

    it("should clean up operationPromises Map after retry exhaustion", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      const promise = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            throw new Error("Always fails");
          },
          { maxRetries: 2 },
        )
        .catch(() => {
          // Ignore error
        });

      await promise;

      // Verify map is cleaned up after failure
      expect(promisesMap.size).toBe(0);
    });

    it("should clean up operationPromises Map for multiple operations", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      // Queue multiple operations
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        const promise = (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            return `result_${i}`;
          },
          {},
        );
        promises.push(promise);
      }

      // Wait for all operations
      await Promise.all(promises);

      // Verify map is completely cleaned up
      expect(promisesMap.size).toBe(0);
    });

    it("should clean up operationPromises Map for mixed success/failure operations", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      const promises = [];

      // Mix of successful and failed operations
      for (let i = 1; i <= 10; i++) {
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              if (i % 3 === 0) {
                throw new Error(`Operation ${i} failed`);
              }
              return `result_${i}`;
            },
            { maxRetries: 0 },
          )
          .catch(() => {
            // Ignore errors
          });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify map is completely cleaned up
      expect(promisesMap.size).toBe(0);
    });

    it("should clean up operationPromises Map when queue is cleared", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      // Queue multiple slow operations
      const promises = [];
      for (let i = 1; i <= 5; i++) {
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              return `result_${i}`;
            },
            {},
          )
          .catch(() => {
            // Operations will be cancelled
          });
        promises.push(promise);
      }

      // Give time for first operation to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Clear the queue
      coordinator.clearQueue();

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify map is cleaned up (except possibly the currently processing operation)
      // The map should be empty or have at most 1 entry (the processing operation)
      expect(promisesMap.size).toBeLessThanOrEqual(1);
    });

    it("should not leak memory with many operations", async () => {
      const promisesMap = (coordinator as any).operationPromises;

      expect(promisesMap.size).toBe(0);

      // Queue and complete many operations
      for (let batch = 0; batch < 5; batch++) {
        const promises = [];
        for (let i = 1; i <= 20; i++) {
          const promise = (coordinator as any)._enqueueAndWait(
            "application_event",
            async () => {
              return `batch_${batch}_op_${i}`;
            },
            {},
          );
          promises.push(promise);
        }

        await Promise.all(promises);

        // Verify map is cleaned up after each batch
        expect(promisesMap.size).toBe(0);
      }

      // Final verification
      expect(promisesMap.size).toBe(0);
    });
  });

  describe("Error Recovery and Queue Status", () => {
    it("should track failed operations in queue status", async () => {
      // Queue operations that will fail
      const promises = [];
      for (let i = 1; i <= 3; i++) {
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              throw new Error(`Operation ${i} failed`);
            },
            { maxRetries: 0 },
          )
          .catch(() => {
            // Ignore errors
          });
        promises.push(promise);
      }

      await Promise.all(promises);

      const status = coordinator.getQueueStatus();

      // Verify failed operations are tracked
      expect(status.failed).toBe(3);
      expect(status.errors).toHaveLength(3);
      expect(status.errors[0].message).toContain("Operation 1 failed");
      expect(status.errors[1].message).toContain("Operation 2 failed");
      expect(status.errors[2].message).toContain("Operation 3 failed");
    });

    it("should track both successful and failed operations", async () => {
      const promises = [];

      // Mix of successful and failed operations
      for (let i = 1; i <= 10; i++) {
        const promise = (coordinator as any)
          ._enqueueAndWait(
            "application_event",
            async () => {
              if (i % 2 === 0) {
                throw new Error(`Operation ${i} failed`);
              }
              return `success_${i}`;
            },
            { maxRetries: 0 },
          )
          .catch(() => {
            // Ignore errors
          });
        promises.push(promise);
      }

      await Promise.all(promises);

      const status = coordinator.getQueueStatus();

      expect(status.completed).toBe(5); // Odd numbers succeeded
      expect(status.failed).toBe(5); // Even numbers failed
      expect(status.totalProcessed).toBe(10);
    });

    it("should provide error details in failed operations", async () => {
      await (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            throw new Error("Specific error message");
          },
          { maxRetries: 0 },
        )
        .catch(() => {
          // Ignore error
        });

      const failedOps = coordinator.getFailedOperations();

      expect(failedOps).toHaveLength(1);
      expect(failedOps[0].error).toBeDefined();
      expect(failedOps[0].error?.message).toBe("Specific error message");
      expect(failedOps[0].type).toBe("application_event");
    });
  });
});
