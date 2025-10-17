/**
 * Tests for Promise-based queue infrastructure
 * Verifies that _enqueueAndWait properly handles Promise resolution/rejection
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("AsyncCoordinator - Promise Infrastructure", () => {
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
  });

  describe("Promise Resolution", () => {
    it("should resolve Promise when operation succeeds", async () => {
      // Use the private _enqueueAndWait method via type assertion for testing
      const result = await (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          return "success";
        },
        {},
      );

      expect(result).toBe("success");
    });

    it("should resolve Promise with operation result", async () => {
      const expectedResult = { data: "test", count: 42 };

      const result = await (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          return expectedResult;
        },
        {},
      );

      expect(result).toEqual(expectedResult);
    });

    it("should handle multiple concurrent operations sequentially", async () => {
      const executionOrder: number[] = [];

      const promise1 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push(1);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "result1";
        },
        {},
      );

      const promise2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push(2);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "result2";
        },
        {},
      );

      const promise3 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          executionOrder.push(3);
          return "result3";
        },
        {},
      );

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe("Promise Rejection", () => {
    it("should reject Promise when operation fails", async () => {
      const error = new Error("Operation failed");

      await expect(
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            throw error;
          },
          { maxRetries: 0 },
        ),
      ).rejects.toThrow("Operation failed");
    });

    it("should reject Promise after retry exhaustion", async () => {
      let attemptCount = 0;

      await expect(
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            attemptCount++;
            throw new Error(`Attempt ${attemptCount} failed`);
          },
          { maxRetries: 2 },
        ),
      ).rejects.toThrow("failed");

      // Should have tried 3 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    });

    it("should reject Promise on timeout", async () => {
      await expect(
        (coordinator as any)._enqueueAndWait(
          "application_event",
          async () => {
            // Simulate long-running operation
            await new Promise((resolve) => setTimeout(resolve, 200));
            return "should not reach here";
          },
          { timeout: 50 },
        ),
      ).rejects.toThrow("timed out");
    });

    it("should not block subsequent operations after failure", async () => {
      const results: string[] = [];

      // First operation fails
      const promise1 = (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            results.push("op1-start");
            throw new Error("First operation failed");
          },
          { maxRetries: 0 },
        )
        .catch((error: Error) => {
          results.push(`error: ${error.message}`);
        });

      // Second operation succeeds
      const promise2 = (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => {
          results.push("op2-start");
          return "result2";
        },
        {},
      );

      await Promise.all([promise1, promise2]);

      // Verify both operations executed in order
      expect(results).toContain("op1-start");
      expect(results).toContain("error: First operation failed");
      expect(results).toContain("op2-start");
      expect(results.indexOf("op1-start")).toBeLessThan(
        results.indexOf("op2-start"),
      );
    });
  });

  describe("Promise Cleanup", () => {
    it("should clean up Promise handlers after success", async () => {
      await (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => "success",
        {},
      );

      // Access private operationPromises Map to verify cleanup
      const promiseMap = (coordinator as any).operationPromises;
      expect(promiseMap.size).toBe(0);
    });

    it("should clean up Promise handlers after failure", async () => {
      await (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            throw new Error("Failed");
          },
          { maxRetries: 0 },
        )
        .catch(() => {
          // Ignore error
        });

      // Access private operationPromises Map to verify cleanup
      const promiseMap = (coordinator as any).operationPromises;
      expect(promiseMap.size).toBe(0);
    });

    it("should clean up Promise handlers on queue clear", async () => {
      // Create a coordinator that won't auto-process
      const slowCoordinator = new AsyncCoordinator();

      // Queue multiple operations
      (slowCoordinator as any).queueOperation(
        "application_event",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "result1";
        },
        {},
      );

      (slowCoordinator as any).queueOperation(
        "application_event",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "result2";
        },
        {},
      );

      // Verify operations are queued
      expect(slowCoordinator.getQueueLength()).toBe(2);

      // Clear the queue
      slowCoordinator.clearQueue();

      // Queue should be empty
      expect(slowCoordinator.getQueueLength()).toBe(0);
    });
  });

  describe("Queue Status Integration", () => {
    it("should track completed operations", async () => {
      await (coordinator as any)._enqueueAndWait(
        "application_event",
        async () => "success",
        {},
      );

      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
    });

    it("should track failed operations", async () => {
      await (coordinator as any)
        ._enqueueAndWait(
          "application_event",
          async () => {
            throw new Error("Failed");
          },
          { maxRetries: 0 },
        )
        .catch(() => {
          // Ignore error
        });

      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(1);
    });
  });
});
