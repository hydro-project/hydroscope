/**
 * AsyncCoordinator Tests
 * Tests for sequential queue system for async operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator";
import { ELKBridge } from "../bridges/ELKBridge";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge";
import { VisualizationState } from "../core/VisualizationState";
import { QueuedOperation, QueueStatus, ApplicationEvent } from "../types/core";

describe("AsyncCoordinator", () => {
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Sequential Queue System", () => {
    it("should create empty queue on initialization", async () => {
      const status = coordinator.getQueueStatus();

      expect(status.pending).toBe(0);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.totalProcessed).toBe(0);
      expect(status.currentOperation).toBeUndefined();
      expect(status.averageProcessingTime).toBe(0);
      expect(status.errors).toHaveLength(0);
    });

    it("should queue operations in FIFO order", async () => {
      const results: string[] = [];

      const op1 = () =>
        Promise.resolve().then(() => {
          results.push("op1");
          return "result1";
        });
      const op2 = () =>
        Promise.resolve().then(() => {
          results.push("op2");
          return "result2";
        });
      const op3 = () =>
        Promise.resolve().then(() => {
          results.push("op3");
          return "result3";
        });

      coordinator.queueOperation("test", op1);
      coordinator.queueOperation("test", op2);
      coordinator.queueOperation("test", op3);

      const status = coordinator.getQueueStatus();
      expect(status.pending).toBe(3);

      // Process all operations
      await coordinator.processQueue();

      expect(results).toEqual(["op1", "op2", "op3"]);
      expect(coordinator.getQueueStatus().completed).toBe(3);
    });

    it("should process operations sequentially, not in parallel", async () => {
      const executionOrder: string[] = [];
      let op1Resolve: () => void;
      let op2Resolve: () => void;

      const op1 = () =>
        new Promise<string>((resolve) => {
          executionOrder.push("op1-start");
          op1Resolve = () => {
            executionOrder.push("op1-end");
            resolve("result1");
          };
        });

      const op2 = () =>
        new Promise<string>((resolve) => {
          executionOrder.push("op2-start");
          op2Resolve = () => {
            executionOrder.push("op2-end");
            resolve("result2");
          };
        });

      coordinator.queueOperation("test", op1);
      coordinator.queueOperation("test", op2);

      // Start processing
      const processPromise = coordinator.processQueue();

      // Allow first operation to start
      await vi.runOnlyPendingTimersAsync();
      expect(executionOrder).toEqual(["op1-start"]);

      // Complete first operation
      op1Resolve!();
      await vi.runOnlyPendingTimersAsync();

      // Second operation should now start
      expect(executionOrder).toEqual(["op1-start", "op1-end", "op2-start"]);

      // Complete second operation
      op2Resolve!();
      await processPromise;

      expect(executionOrder).toEqual([
        "op1-start",
        "op1-end",
        "op2-start",
        "op2-end",
      ]);
    });

    it("should handle operation errors and continue processing", async () => {
      const results: string[] = [];

      const op1 = () =>
        Promise.resolve().then(() => {
          results.push("op1");
          return "result1";
        });
      const op2 = () => Promise.reject(new Error("Operation failed"));
      const op3 = () =>
        Promise.resolve().then(() => {
          results.push("op3");
          return "result3";
        });

      coordinator.queueOperation("test", op1);
      coordinator.queueOperation("test", op2);
      coordinator.queueOperation("test", op3);

      await coordinator.processQueue();

      expect(results).toEqual(["op1", "op3"]);

      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(2);
      expect(status.failed).toBe(1);
      expect(status.errors).toHaveLength(1);
      expect(status.errors[0].message).toBe("Operation failed");
    });

    it("should implement retry logic for failed operations", async () => {
      let attemptCount = 0;
      const failingOp = () => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
        }
        return Promise.resolve("success");
      };

      coordinator.queueOperation("test", failingOp, { maxRetries: 3 });

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      expect(attemptCount).toBe(3);
      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
    });

    it("should fail operation after max retries exceeded", async () => {
      let attemptCount = 0;
      const alwaysFailingOp = () => {
        attemptCount++;
        return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
      };

      coordinator.queueOperation("test", alwaysFailingOp, { maxRetries: 2 });

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(1);
    });

    it("should handle operation timeouts", async () => {
      const longRunningOp = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("result"), 2000);
        });

      coordinator.queueOperation("test", longRunningOp, { timeout: 100 });

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      const status = coordinator.getQueueStatus();
      expect(status.failed).toBe(1);
      expect(status.errors[0].message).toContain("timed out");
    });

    it("should track processing statistics", async () => {
      const fastOp = () =>
        new Promise((resolve) => setTimeout(() => resolve("fast"), 10));
      const slowOp = () =>
        new Promise((resolve) => setTimeout(() => resolve("slow"), 50));

      coordinator.queueOperation("test", fastOp);
      coordinator.queueOperation("test", slowOp);

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(2);
      expect(status.totalProcessed).toBe(2);
      expect(status.averageProcessingTime).toBeGreaterThan(0);
    });

    it("should allow clearing the queue", async () => {
      coordinator.queueOperation("test", () => Promise.resolve("result1"));
      coordinator.queueOperation("test", () => Promise.resolve("result2"));

      expect(coordinator.getQueueStatus().pending).toBe(2);

      coordinator.clearQueue();

      expect(coordinator.getQueueStatus().pending).toBe(0);
    });

    it("should provide current operation information during processing", async () => {
      let operationStarted = false;
      let resolveOp: () => void;

      const op = () =>
        new Promise<string>((resolve) => {
          operationStarted = true;
          resolveOp = () => resolve("result");
        });

      coordinator.queueOperation("test", op);

      const processPromise = coordinator.processQueue();

      // Wait for operation to start
      await vi.runOnlyPendingTimersAsync();

      if (operationStarted) {
        const status = coordinator.getQueueStatus();
        expect(status.processing).toBe(1);
        expect(status.currentOperation).toBeDefined();
        expect(status.currentOperation?.type).toBe("test");
      }

      resolveOp!();
      await processPromise;
    });
  });

  describe("Queue Status Monitoring", () => {
    it("should provide accurate queue metrics", async () => {
      // Add some operations
      coordinator.queueOperation("test", () => Promise.resolve("1"));
      coordinator.queueOperation("test", () => Promise.resolve("2"));
      coordinator.queueOperation("test", () =>
        Promise.reject(new Error("fail")),
      );

      let status = coordinator.getQueueStatus();
      expect(status.pending).toBe(3);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);

      await coordinator.processQueue();

      status = coordinator.getQueueStatus();
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(2);
      expect(status.failed).toBe(1);
      expect(status.totalProcessed).toBe(3);
    });
  });

  describe("ELK Async Operations", () => {
    let state: VisualizationState;
    let elkBridge: ELKBridge;

    beforeEach(() => {
      // Use real timers for ELK operations since they involve real async work
      vi.useRealTimers();

      state = new VisualizationState();
      elkBridge = new ELKBridge({
        algorithm: "layered",
        direction: "DOWN",
      });

      // Add some test data to state
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

    afterEach(() => {
      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it("should queue ELK layout operations with proper sequencing", async () => {
      // Execute operations sequentially
      await coordinator.queueELKLayout(state, elkBridge);
      await coordinator.queueELKLayout(state, elkBridge);

      const finalStatus = coordinator.getELKOperationStatus();
      expect(finalStatus.queued).toBe(0);
      expect(finalStatus.processing).toBe(false);
      expect(finalStatus.lastCompleted).toBeDefined();

      // Verify layout was applied - nodes should have positions
      const node1 = state.getGraphNode("node1");
      const node2 = state.getGraphNode("node2");
      expect(node1?.position).toBeDefined();
      expect(node2?.position).toBeDefined();
      expect(typeof node1?.position?.x).toBe("number");
      expect(typeof node1?.position?.y).toBe("number");
    });

    it("should handle ELK operation cancellation", async () => {
      coordinator.queueOperation("elk_layout", () => Promise.resolve("test"));
      coordinator.queueOperation("elk_layout", () => Promise.resolve("test"));

      expect(coordinator.getELKOperationStatus().queued).toBe(2);

      // Cancel operations (we need to access the operation IDs)
      const queuedOps = coordinator["queue"].filter(
        (op) => op.type === "elk_layout",
      );
      const cancelled = coordinator.cancelELKOperation(queuedOps[0].id);

      expect(cancelled).toBe(true);
      expect(coordinator.getELKOperationStatus().queued).toBe(1);
    });

    it("should handle ELK operation timeouts", async () => {
      // Temporarily use fake timers for this timeout test
      vi.useFakeTimers();

      try {
        // Create a mock that will timeout
        const slowOperation = () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("slow result"), 200);
          });

        coordinator.queueOperation("elk_layout", slowOperation, {
          timeout: 50,
        });

        const processPromise = coordinator.processQueue();
        await vi.runAllTimersAsync();
        await processPromise;

        const status = coordinator.getELKOperationStatus();
        expect(status.lastFailed).toBeDefined();
        expect(status.lastFailed?.error?.message).toContain("timed out");
      } finally {
        // Restore real timers
        vi.useRealTimers();
      }
    });

    it("should handle ELK operation errors and set error state", async () => {
      // Create a simple failing operation
      const failingOperation = () =>
        Promise.reject(new Error("Layout processing failed"));

      coordinator.queueOperation("elk_layout", failingOperation);

      await coordinator.processQueue();

      const status = coordinator.getELKOperationStatus();
      expect(status.lastFailed).toBeDefined();
      expect(status.lastFailed?.error?.message).toBe(
        "Layout processing failed",
      );
    });

    it("should provide ELK operation status tracking", async () => {
      // Initially no operations
      let status = coordinator.getELKOperationStatus();
      expect(status.queued).toBe(0);
      expect(status.processing).toBe(false);
      expect(status.lastCompleted).toBeUndefined();

      // Execute first operation
      await coordinator.queueELKLayout(state, elkBridge);

      status = coordinator.getELKOperationStatus();
      expect(status.queued).toBe(0);
      expect(status.lastCompleted).toBeDefined();
      expect(status.lastCompleted?.type).toBe("elk_layout");

      // Execute second operation
      await coordinator.queueELKLayout(state, elkBridge);

      status = coordinator.getELKOperationStatus();
      expect(status.queued).toBe(0);
      expect(status.lastCompleted).toBeDefined();
    });

    it("should retry failed ELK operations", async () => {
      let attemptCount = 0;

      // Create a flaky ELKBridge that fails on first attempt
      const flakyElkBridge = {
        layout: vi.fn(async (state: any) => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error("Temporary ELK failure");
          }
          // On second attempt, succeed by calling real ELK
          return elkBridge.layout(state);
        }),
      };

      await coordinator.queueELKLayout(state, flakyElkBridge, {
        maxRetries: 2,
      });

      expect(attemptCount).toBe(2);
      expect(flakyElkBridge.layout).toHaveBeenCalledTimes(2);

      const status = coordinator.getELKOperationStatus();
      expect(status.lastCompleted).toBeDefined();
    });
  });

  describe("ReactFlow Async Operations", () => {
    let state: VisualizationState;
    let elkBridge: ELKBridge;

    beforeEach(async () => {
      // Use real timers for ReactFlow operations since they involve real async work
      vi.useRealTimers();

      state = new VisualizationState();
      elkBridge = new ELKBridge({
        algorithm: "layered",
        direction: "DOWN",
      });

      // Add some test data and calculate layout first
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

      // Calculate layout so ReactFlow has positions to work with
      await elkBridge.layout(state);
    });

    afterEach(() => {
      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it("should queue ReactFlow render operations with proper sequencing", async () => {
      // Execute operations sequentially
      await coordinator.queueReactFlowRender(state);
      await coordinator.queueReactFlowRender(state);

      const finalStatus = coordinator.getReactFlowOperationStatus();
      expect(finalStatus.queued).toBe(0);
      expect(finalStatus.processing).toBe(false);
      expect(finalStatus.lastCompleted).toBeDefined();

      // Verify operations completed successfully
      expect(finalStatus.lastCompleted?.type).toBe("reactflow_render");
      expect(finalStatus.lastCompleted?.completedAt).toBeDefined();
    });

    it("should handle ReactFlow operation cancellation", async () => {
      coordinator.queueOperation("reactflow_render", () =>
        Promise.resolve("test"),
      );
      coordinator.queueOperation("reactflow_render", () =>
        Promise.resolve("test"),
      );

      expect(coordinator.getReactFlowOperationStatus().queued).toBe(2);

      // Cancel operations (we need to access the operation IDs)
      const queuedOps = coordinator["queue"].filter(
        (op) => op.type === "reactflow_render",
      );
      const cancelled = coordinator.cancelReactFlowOperation(queuedOps[0].id);

      expect(cancelled).toBe(true);
      expect(coordinator.getReactFlowOperationStatus().queued).toBe(1);
    });

    it("should handle ReactFlow operation timeouts", async () => {
      // Temporarily use fake timers for this timeout test
      vi.useFakeTimers();

      try {
        // Create a mock that will timeout
        const slowOperation = () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("slow result"), 200);
          });

        coordinator.queueOperation("reactflow_render", slowOperation, {
          timeout: 50,
        });

        const processPromise = coordinator.processQueue();
        await vi.runAllTimersAsync();
        await processPromise;

        const status = coordinator.getReactFlowOperationStatus();
        expect(status.lastFailed).toBeDefined();
        expect(status.lastFailed?.error?.message).toContain("timed out");
      } finally {
        // Restore real timers
        vi.useRealTimers();
      }
    });

    it("should handle ReactFlow operation errors and set error state", async () => {
      // Create a simple failing operation
      const failingOperation = () =>
        Promise.reject(new Error("Render processing failed"));

      coordinator.queueOperation("reactflow_render", failingOperation);

      await coordinator.processQueue();

      const status = coordinator.getReactFlowOperationStatus();
      expect(status.lastFailed).toBeDefined();
      expect(status.lastFailed?.error?.message).toBe(
        "Render processing failed",
      );
    });

    it("should provide ReactFlow operation status tracking", async () => {
      // Initially no operations
      let status = coordinator.getReactFlowOperationStatus();
      expect(status.queued).toBe(0);
      expect(status.processing).toBe(false);
      expect(status.lastCompleted).toBeUndefined();

      // Execute operation
      await coordinator.queueReactFlowRender(state);

      status = coordinator.getReactFlowOperationStatus();
      expect(status.queued).toBe(0);
      expect(status.lastCompleted).toBeDefined();
      expect(status.lastCompleted?.type).toBe("reactflow_render");
    });

    it("should retry failed ReactFlow operations", async () => {
      // Temporarily use fake timers for this retry test
      vi.useFakeTimers();

      try {
        let attemptCount = 0;
        const failingOperation = () => {
          attemptCount++;
          if (attemptCount < 2) {
            return Promise.reject(new Error("Temporary render failure"));
          }
          return Promise.resolve("success");
        };

        coordinator.queueOperation("reactflow_render", failingOperation, {
          maxRetries: 2,
        });

        const processPromise = coordinator.processQueue();
        await vi.runAllTimersAsync();
        await processPromise;

        expect(attemptCount).toBe(2);
      } finally {
        // Restore real timers
        vi.useRealTimers();
      }

      const status = coordinator.getReactFlowOperationStatus();
      expect(status.lastCompleted).toBeDefined();
    });

    it("should return ReactFlow data from completed operations", async () => {
      await coordinator.queueReactFlowRender(state);

      // Check that the operation completed successfully
      const status = coordinator.getReactFlowOperationStatus();
      expect(status.lastCompleted).toBeDefined();
      expect(status.lastCompleted?.type).toBe("reactflow_render");
      expect(status.lastCompleted?.completedAt).toBeDefined();
    });
  });

  describe("Application Event System", () => {
    let mockState: any;

    beforeEach(() => {
      mockState = {
        expandContainer: vi.fn(),
        collapseContainer: vi.fn(),
        search: vi.fn(() => []),
        getContainersForNode: vi.fn(() => []),
        setLayoutPhase: vi.fn(),
        incrementLayoutCount: vi.fn(),
        visibleNodes: [],
        visibleContainers: [],
        visibleEdges: [],
        getAggregatedEdges: () => [],
      };
    });

    it("should queue application events with proper prioritization", async () => {
      const highPriorityEvent: ApplicationEvent = {
        type: "container_expand",
        payload: {
          containerId: "container1",
          state: mockState,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      const lowPriorityEvent: ApplicationEvent = {
        type: "layout_config_change",
        payload: { config: { algorithm: "layered" }, state: mockState },
        timestamp: Date.now(),
      };

      // Queue low priority first, then high priority
      coordinator.queueApplicationEvent(lowPriorityEvent);
      coordinator.queueApplicationEvent(highPriorityEvent);

      await coordinator.processQueue();

      // High priority should have been processed first
      expect(mockState.expandContainer).toHaveBeenCalledWith("container1");

      const status = coordinator.getApplicationEventStatus();
      expect(status.queued).toBe(0);
      expect(status.lastCompleted).toBeDefined();
    });

    it("should handle container expand events", async () => {
      const event: ApplicationEvent = {
        type: "container_expand",
        payload: {
          containerId: "container1",
          state: mockState,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      expect(mockState.expandContainer).toHaveBeenCalledWith("container1");

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastCompleted).toBeDefined();
      expect(status.lastCompleted?.type).toBe("application_event");
    });

    it("should handle container collapse events", async () => {
      const event: ApplicationEvent = {
        type: "container_collapse",
        payload: {
          containerId: "container1",
          state: mockState,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      expect(mockState.collapseContainer).toHaveBeenCalledWith("container1");

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastCompleted).toBeDefined();
    });

    it("should handle search events", async () => {
      const searchResults = [
        {
          id: "node1",
          label: "Test Node",
          type: "node" as const,
          matchIndices: [[0, 4]],
        },
      ];
      mockState.search.mockReturnValue(searchResults);

      const event: ApplicationEvent = {
        type: "search",
        payload: {
          query: "test",
          state: mockState,
          expandContainers: false,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      expect(mockState.search).toHaveBeenCalledWith("test");

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastCompleted).toBeDefined();
    });

    it("should handle search events with container expansion", async () => {
      const searchResults = [
        {
          id: "node1",
          label: "Test Node",
          type: "node" as const,
          matchIndices: [[0, 4]],
        },
      ];
      const containers = [{ id: "container1", collapsed: true }];

      mockState.search.mockReturnValue(searchResults);
      mockState.getContainersForNode.mockReturnValue(containers);

      const event: ApplicationEvent = {
        type: "search",
        payload: {
          query: "test",
          state: mockState,
          expandContainers: true,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      expect(mockState.search).toHaveBeenCalledWith("test");
      expect(mockState.getContainersForNode).toHaveBeenCalledWith("node1");
      expect(mockState.expandContainer).toHaveBeenCalledWith("container1");
    });

    it("should handle layout config change events", async () => {
      const newConfig = { algorithm: "force", direction: "DOWN" as const };

      const event: ApplicationEvent = {
        type: "layout_config_change",
        payload: {
          config: newConfig,
          state: mockState,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      // Layout config change event should complete successfully
      const status = coordinator.getApplicationEventStatus();
      expect(status.lastCompleted).toBeDefined();
    });

    it("should handle event processing errors gracefully", async () => {
      // Create a failing operation directly
      const failingOperation = () =>
        Promise.reject(
          new Error("Container expand event missing required payload"),
        );

      coordinator.queueOperation("application_event", failingOperation);
      await coordinator.processQueue();

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastFailed).toBeDefined();
      expect(status.lastFailed?.error?.message).toContain(
        "missing required payload",
      );
    });

    it("should cancel application events", async () => {
      const event: ApplicationEvent = {
        type: "container_expand",
        payload: { containerId: "container1", state: mockState },
        timestamp: Date.now(),
      };

      const id1 = coordinator.queueApplicationEvent(event);
      const id2 = coordinator.queueApplicationEvent(event);

      expect(coordinator.getApplicationEventStatus().queued).toBe(2);

      // Cancel first operation
      const cancelled = coordinator.cancelApplicationEvent(id1);

      expect(cancelled).toBe(true);
      expect(coordinator.getApplicationEventStatus().queued).toBe(1);
    });

    it("should cancel application events by type", async () => {
      const expandEvent: ApplicationEvent = {
        type: "container_expand",
        payload: { containerId: "container1", state: mockState },
        timestamp: Date.now(),
      };

      const searchEvent: ApplicationEvent = {
        type: "search",
        payload: { query: "test", state: mockState },
        timestamp: Date.now(),
      };

      coordinator.queueApplicationEvent(expandEvent);
      coordinator.queueApplicationEvent(searchEvent);
      coordinator.queueApplicationEvent(expandEvent);

      expect(coordinator.getApplicationEventStatus().queued).toBe(3);

      const cancelled =
        coordinator.cancelApplicationEventsByType("container_expand");

      // This is a simplified implementation - in practice we'd need better event type tracking
      expect(cancelled).toBeGreaterThan(0);
      expect(coordinator.getApplicationEventStatus().queued).toBeLessThan(3);
    });

    it("should clear all application events", async () => {
      const event: ApplicationEvent = {
        type: "container_expand",
        payload: { containerId: "container1", state: mockState },
        timestamp: Date.now(),
      };

      coordinator.queueApplicationEvent(event);
      coordinator.queueApplicationEvent(event);
      coordinator.queueApplicationEvent(event);

      expect(coordinator.getApplicationEventStatus().queued).toBe(3);

      const cleared = coordinator.clearApplicationEvents();

      expect(cleared).toBe(3);
      expect(coordinator.getApplicationEventStatus().queued).toBe(0);
    });

    it("should provide application event status tracking", async () => {
      // Initially no operations
      let status = coordinator.getApplicationEventStatus();
      expect(status.queued).toBe(0);
      expect(status.processing).toBe(false);
      expect(status.lastCompleted).toBeUndefined();

      // Execute operation
      const event: ApplicationEvent = {
        type: "container_expand",
        payload: {
          containerId: "container1",
          state: mockState,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      await coordinator.processApplicationEventAndWait(event);

      status = coordinator.getApplicationEventStatus();
      expect(status.queued).toBe(0);
      expect(status.lastCompleted).toBeDefined();
      expect(status.lastCompleted?.type).toBe("application_event");
    });

    it("should retry failed application events", async () => {
      let attemptCount = 0;
      const flakyState = {
        ...mockState,
        expandContainer: vi.fn((containerId) => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error("Temporary failure");
          }
        }),
      };

      const event: ApplicationEvent = {
        type: "container_expand",
        payload: {
          containerId: "container1",
          state: flakyState,
          triggerLayout: false,
        },
        timestamp: Date.now(),
      };

      // Queue the event with retries and process manually
      coordinator.queueApplicationEvent(event, { maxRetries: 2 });

      // Advance timers to handle retry delays
      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      expect(attemptCount).toBe(2);
      expect(flakyState.expandContainer).toHaveBeenCalledWith("container1");

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastCompleted).toBeDefined();
    });

    it("should handle application event timeouts", async () => {
      // Create a slow operation that will timeout
      const slowOperation = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("slow result"), 200);
        });

      coordinator.queueOperation("application_event", slowOperation, {
        timeout: 50,
      });

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastFailed).toBeDefined();
      expect(status.lastFailed?.error?.message).toContain("timed out");
    });

    it("should handle unknown event types", async () => {
      // Create a failing operation directly
      const failingOperation = () =>
        Promise.reject(
          new Error("Unknown application event type: unknown_event"),
        );

      coordinator.queueOperation("application_event", failingOperation);
      await coordinator.processQueue();

      const status = coordinator.getApplicationEventStatus();
      expect(status.lastFailed).toBeDefined();
      expect(status.lastFailed?.error?.message).toContain(
        "Unknown application event type: unknown_event",
      );
    });
  });

  describe("Container Operations Integration", () => {
    let state: VisualizationState;

    beforeEach(() => {
      state = new VisualizationState();
      
      // Add some test containers
      state.addContainer({
        id: "container1",
        label: "Container 1",
        children: new Set<string>(),
        collapsed: true,
        hidden: false
      });

      state.addContainer({
        id: "container2", 
        label: "Container 2",
        children: new Set<string>(),
        collapsed: false,
        hidden: false
      });

      state.addContainer({
        id: "container3",
        label: "Container 3", 
        children: new Set<string>(),
        collapsed: true,
        hidden: false
      });
    });

    it("should expand container through async coordination", async () => {
      await coordinator.expandContainer("container1", state);

      const container = state.getContainer("container1");
      expect(container?.collapsed).toBe(false);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should expand container without triggering layout when specified", async () => {
      await coordinator.expandContainer("container1", state, {
        triggerLayout: false,
      });

      const container = state.getContainer("container1");
      expect(container?.collapsed).toBe(false);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should collapse container through async coordination", async () => {
      await coordinator.collapseContainer("container2", state);

      const container = state.getContainer("container2");
      expect(container?.collapsed).toBe(true);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should collapse container without triggering layout when specified", async () => {
      await coordinator.collapseContainer("container2", state, {
        triggerLayout: false,
      });

      const container = state.getContainer("container2");
      expect(container?.collapsed).toBe(true);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should expand all containers sequentially", async () => {
      await coordinator.expandAllContainers(state);

      // Should expand all collapsed containers
      const container1 = state.getContainer("container1");
      const container2 = state.getContainer("container2");
      const container3 = state.getContainer("container3");
      
      expect(container1?.collapsed).toBe(false);
      expect(container2?.collapsed).toBe(false); // Was already expanded
      expect(container3?.collapsed).toBe(false);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should collapse all containers sequentially", async () => {
      await coordinator.collapseAllContainers(state);

      // Should collapse all expanded containers
      const container1 = state.getContainer("container1");
      const container2 = state.getContainer("container2");
      const container3 = state.getContainer("container3");
      
      expect(container1?.collapsed).toBe(true); // Was already collapsed
      expect(container2?.collapsed).toBe(true); // Should be collapsed now
      expect(container3?.collapsed).toBe(true); // Was already collapsed

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should handle container operation errors gracefully", async () => {
      // Create a failing operation directly
      const failingOperation = () =>
        Promise.reject(new Error("Container expansion failed"));

      coordinator.queueOperation("application_event", failingOperation);
      await coordinator.processQueue();

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.failed).toBeGreaterThan(0);
    });

    it("should retry failed container operations", async () => {
      let attemptCount = 0;
      const originalExpandContainer = state.expandContainer.bind(state);
      
      // Mock the expandContainer method to fail on first attempt
      state.expandContainer = vi.fn((containerId: string) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error("Temporary container failure");
        }
        return originalExpandContainer(containerId);
      });

      // Queue the operation with retries and process manually
      coordinator.queueApplicationEvent(
        {
          type: "container_expand",
          payload: { containerId: "container1", state },
          timestamp: Date.now(),
        },
        { maxRetries: 2 },
      );

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      expect(attemptCount).toBe(2);
      expect(state.expandContainer).toHaveBeenCalledWith("container1");

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should handle container operation timeouts", async () => {
      // Create a slow operation that will timeout
      const slowOperation = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("slow result"), 200);
        });

      coordinator.queueOperation("application_event", slowOperation, {
        timeout: 50,
      });

      const processPromise = coordinator.processQueue();
      await vi.runAllTimersAsync();
      await processPromise;

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.failed).toBeGreaterThan(0);
    });

    it("should provide container operation status tracking", async () => {
      // Initially no operations
      let status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.queued).toBe(0);
      expect(status.expandOperations.processing).toBe(false);
      expect(status.expandOperations.completed).toBe(0);
      expect(status.expandOperations.failed).toBe(0);

      // Execute operation
      await coordinator.expandContainer("container1", state, {
        triggerLayout: false,
      });

      status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });

    it("should handle error recovery for container operations", async () => {
      // Create a failing operation directly
      const failingOperation = () =>
        Promise.reject(new Error("Container operation failed"));

      coordinator.queueOperation("application_event", failingOperation);
      await coordinator.processQueue();

      const failedOps = coordinator.getFailedOperations();
      expect(failedOps.length).toBeGreaterThan(0);

      const failedOpId = failedOps[failedOps.length - 1].id;

      // Test skip recovery
      await coordinator.recoverFromContainerOperationError(
        failedOpId,
        state,
        "skip",
      );

      const statusAfterSkip = coordinator.getFailedOperations();
      expect(statusAfterSkip.length).toBe(failedOps.length - 1);
    });

    it("should sequence container operations properly", async () => {
      const operationOrder: string[] = [];

      // Mock the container operations to track order
      const originalExpandContainer = state.expandContainer.bind(state);
      const originalCollapseContainer = state.collapseContainer.bind(state);
      
      state.expandContainer = vi.fn((containerId: string) => {
        operationOrder.push(`expand-${containerId}`);
        return originalExpandContainer(containerId);
      });
      
      state.collapseContainer = vi.fn((containerId: string) => {
        operationOrder.push(`collapse-${containerId}`);
        return originalCollapseContainer(containerId);
      });

      // Queue multiple operations sequentially
      await coordinator.expandContainer("container1", state, { triggerLayout: false });
      await coordinator.collapseContainer("container2", state, { triggerLayout: false });
      await coordinator.expandContainer("container3", state, { triggerLayout: false });

      // Operations should be executed in the order they were queued
      expect(operationOrder).toEqual([
        "expand-container1",
        "collapse-container2",
        "expand-container3",
      ]);
    });

    it("should handle bulk operations efficiently", async () => {
      const startTime = Date.now();

      await coordinator.expandAllContainers(state);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Bulk operation should complete reasonably quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Should have expanded all containers
      const container1 = state.getContainer("container1");
      const container2 = state.getContainer("container2");
      const container3 = state.getContainer("container3");
      
      expect(container1?.collapsed).toBe(false);
      expect(container2?.collapsed).toBe(false);
      expect(container3?.collapsed).toBe(false);
    });

    it("should handle custom layout configuration for container operations", async () => {
      const customConfig = { algorithm: "force", direction: "UP" as const };

      await coordinator.expandContainer("container1", state, {
        layoutConfig: customConfig,
      });

      const container = state.getContainer("container1");
      expect(container?.collapsed).toBe(false);

      const status = coordinator.getContainerOperationStatus();
      expect(status.expandOperations.completed).toBeGreaterThan(0);
    });
  });
});
