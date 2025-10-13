/**
 * @fileoverview Tests for Operation Performance Monitor
 *
 * Tests the performance monitoring utilities for imperative UI operations,
 * including cascade detection and performance tracking.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  OperationPerformanceMonitor,
  globalOperationMonitor,
  monitorOperation,
  monitorAsyncOperation,
  recordCoordinatorCall,
  recordDOMUpdate,
  measureOperationPerformance,
  measureAsyncOperationPerformance,
  type OperationType,
  type OperationMetrics,
  type CascadeDetection,
} from "../operationPerformanceMonitor.js";

describe("OperationPerformanceMonitor", () => {
  let monitor: OperationPerformanceMonitor;

  beforeEach(() => {
    monitor = new OperationPerformanceMonitor({
      enabled: true,
      trackCascades: true,
      cascadeDetectionWindow: 1000,
      maxCascadeOperations: 3,
      debugLogging: false,
      alertOnCascades: false,
    });
  });

  afterEach(() => {
    monitor.clear();
    vi.clearAllMocks();
  });

  describe("Basic Operation Monitoring", () => {
    it("should start and end operation monitoring", () => {
      const operation: OperationType = "container_toggle";

      monitor.startOperation(operation, { containerId: "test-container" });

      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait for 10ms
      }

      const metrics = monitor.endOperation(operation, { success: true });

      expect(metrics).toBeDefined();
      expect(metrics!.operation).toBe(operation);
      expect(metrics!.duration).toBeGreaterThan(0);
      expect(metrics!.cascadeRisk).toBeDefined();
      expect(metrics!.coordinatorCalls).toBe(0);
      expect(metrics!.domUpdates).toBe(0);
    });

    it("should record coordinator calls", () => {
      const operation: OperationType = "container_expand";

      monitor.startOperation(operation);
      monitor.recordCoordinatorCall();
      monitor.recordCoordinatorCall();
      const metrics = monitor.endOperation(operation);

      expect(metrics!.coordinatorCalls).toBe(2);
    });

    it("should record DOM updates", () => {
      const operation: OperationType = "panel_toggle";

      monitor.startOperation(operation);
      monitor.recordDOMUpdate();
      const metrics = monitor.endOperation(operation);

      expect(metrics!.domUpdates).toBe(1);
    });

    it("should calculate cascade risk correctly", () => {
      // Container operations with coordinator calls should be high risk
      monitor.startOperation("container_toggle");
      monitor.recordCoordinatorCall();
      const containerMetrics = monitor.endOperation("container_toggle");
      expect(containerMetrics!.cascadeRisk).toBe("high");

      // Panel operations should be low risk
      monitor.startOperation("panel_toggle");
      const panelMetrics = monitor.endOperation("panel_toggle");
      expect(panelMetrics!.cascadeRisk).toBe("low");

      // Layout operations should be medium risk
      monitor.startOperation("style_layout");
      const layoutMetrics = monitor.endOperation("style_layout");
      expect(layoutMetrics!.cascadeRisk).toBe("medium");
    });
  });

  describe("Cascade Detection", () => {
    it("should detect cascades when operations exceed threshold", () => {
      const operations: OperationType[] = [
        "container_toggle",
        "container_expand",
        "container_collapse",
        "panel_toggle",
      ];

      // Perform operations rapidly
      operations.forEach((op) => {
        monitor.startOperation(op);
        monitor.endOperation(op);
      });

      const cascadeDetection = monitor.getCascadeDetection();
      expect(cascadeDetection.detected).toBe(true);
      expect(cascadeDetection.cascadeCount).toBe(4);
      expect(cascadeDetection.operations).toHaveLength(4);
      expect(cascadeDetection.recommendations).toContain(
        "Consider batching multiple operations together",
      );
    });

    it("should not detect cascades when operations are below threshold", () => {
      monitor.startOperation("container_toggle");
      monitor.endOperation("container_toggle");

      const cascadeDetection = monitor.getCascadeDetection();
      expect(cascadeDetection.detected).toBe(false);
      expect(cascadeDetection.cascadeCount).toBe(1);
    });

    it("should provide specific recommendations based on operation types", () => {
      // Trigger cascade with container operations
      ["container_toggle", "container_expand", "container_collapse"].forEach(
        (op) => {
          monitor.startOperation(op as OperationType);
          monitor.endOperation(op as OperationType);
        },
      );

      const cascadeDetection = monitor.getCascadeDetection();
      expect(cascadeDetection.recommendations).toContain(
        "Use batchContainerOperationsImperatively() for multiple container operations",
      );
    });
  });

  describe("Operation History", () => {
    it("should maintain operation history", () => {
      monitor.startOperation("container_toggle");
      monitor.endOperation("container_toggle");

      monitor.startOperation("panel_expand");
      monitor.endOperation("panel_expand");

      const allHistory = monitor.getOperationHistory();
      expect(allHistory).toHaveLength(2);

      const containerHistory = monitor.getOperationHistory("container_toggle");
      expect(containerHistory).toHaveLength(1);
      expect(containerHistory[0].operation).toBe("container_toggle");
    });

    it("should limit history size", () => {
      // Create more than 100 operations
      for (let i = 0; i < 105; i++) {
        monitor.startOperation("panel_toggle");
        monitor.endOperation("panel_toggle");
      }

      const history = monitor.getOperationHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Performance Report Generation", () => {
    it("should generate comprehensive performance report", () => {
      // Create some operations with cascade
      [
        "container_toggle",
        "container_expand",
        "container_collapse",
        "panel_toggle",
      ].forEach((op) => {
        monitor.startOperation(op as OperationType);
        monitor.endOperation(op as OperationType);
      });

      const report = monitor.generateOperationReport();

      expect(report).toContain("Operation Performance Report");
      expect(report).toContain("Cascade Detection");
      expect(report).toContain("Recent Operations");
      expect(report).toContain("Cascade Detected");
      expect(report).toContain("container_toggle");
    });

    it("should show no cascades when none detected", () => {
      monitor.startOperation("panel_toggle");
      monitor.endOperation("panel_toggle");

      const report = monitor.generateOperationReport();
      expect(report).toContain("No cascades detected");
    });
  });
});

describe("Global Operation Monitor", () => {
  let originalConfig: any;

  beforeEach(() => {
    // Enable monitoring for tests
    originalConfig = (globalOperationMonitor as any).config;
    (globalOperationMonitor as any).config = {
      ...originalConfig,
      enabled: true,
    };
    globalOperationMonitor.clear();
  });

  afterEach(() => {
    globalOperationMonitor.clear();
    // Restore original config
    (globalOperationMonitor as any).config = originalConfig;
  });

  it("should be available as global instance", () => {
    expect(globalOperationMonitor).toBeDefined();
    expect(globalOperationMonitor).toBeInstanceOf(OperationPerformanceMonitor);
  });

  it("should work with recordCoordinatorCall and recordDOMUpdate", () => {
    globalOperationMonitor.startOperation("container_toggle");
    recordCoordinatorCall();
    recordDOMUpdate();
    const metrics = globalOperationMonitor.endOperation("container_toggle");

    expect(metrics).toBeDefined();
    expect(metrics!.coordinatorCalls).toBe(1);
    expect(metrics!.domUpdates).toBe(1);
  });
});

describe("Utility Functions", () => {
  let originalConfig: any;

  beforeEach(() => {
    // Enable monitoring for tests
    originalConfig = (globalOperationMonitor as any).config;
    (globalOperationMonitor as any).config = {
      ...originalConfig,
      enabled: true,
    };
    globalOperationMonitor.clear();
  });

  afterEach(() => {
    globalOperationMonitor.clear();
    // Restore original config
    (globalOperationMonitor as any).config = originalConfig;
  });

  describe("monitorOperation", () => {
    it("should monitor synchronous operations", () => {
      const testFn = vi.fn(() => "test result");

      const result = monitorOperation("panel_toggle", testFn, { test: true });

      expect(result).toBe("test result");
      expect(testFn).toHaveBeenCalledOnce();

      const history =
        globalOperationMonitor.getOperationHistory("panel_toggle");
      expect(history).toHaveLength(1);
      expect(history[0].metadata).toEqual({ test: true });
    });

    it("should handle errors in monitored operations", () => {
      const testFn = vi.fn(() => {
        throw new Error("Test error");
      });

      expect(() => {
        monitorOperation("panel_toggle", testFn);
      }).toThrow("Test error");

      const history =
        globalOperationMonitor.getOperationHistory("panel_toggle");
      expect(history).toHaveLength(1);
      expect(history[0].metadata?.error).toBe("Test error");
    });
  });

  describe("monitorAsyncOperation", () => {
    it("should monitor asynchronous operations", async () => {
      const testFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      });

      const result = await monitorAsyncOperation("style_layout", testFn, {
        async: true,
      });

      expect(result).toBe("async result");
      expect(testFn).toHaveBeenCalledOnce();

      const history =
        globalOperationMonitor.getOperationHistory("style_layout");
      expect(history).toHaveLength(1);
      expect(history[0].metadata).toEqual({ async: true });
    });

    it("should handle errors in async monitored operations", async () => {
      const testFn = vi.fn(async () => {
        throw new Error("Async test error");
      });

      await expect(
        monitorAsyncOperation("style_layout", testFn),
      ).rejects.toThrow("Async test error");

      const history =
        globalOperationMonitor.getOperationHistory("style_layout");
      expect(history).toHaveLength(1);
      expect(history[0].metadata?.error).toBe("Async test error");
    });
  });

  describe("measureOperationPerformance", () => {
    it("should measure and return operation metrics", () => {
      const testFn = vi.fn(() => "measured result");

      const { result, metrics } = measureOperationPerformance(
        "container_batch",
        testFn,
        { measure: true },
      );

      expect(result).toBe("measured result");
      expect(metrics).toBeDefined();
      expect(metrics!.operation).toBe("container_batch");
      expect(metrics!.metadata).toEqual({ measure: true });
    });
  });

  describe("measureAsyncOperationPerformance", () => {
    it("should measure and return async operation metrics", async () => {
      const testFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "async measured result";
      });

      const { result, metrics } = await measureAsyncOperationPerformance(
        "style_batch",
        testFn,
        { asyncMeasure: true },
      );

      expect(result).toBe("async measured result");
      expect(metrics).toBeDefined();
      expect(metrics!.operation).toBe("style_batch");
      expect(metrics!.duration).toBeGreaterThan(0);
      expect(metrics!.metadata).toEqual({ asyncMeasure: true });
    });
  });
});

describe("Performance Thresholds", () => {
  let monitor: OperationPerformanceMonitor;
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    monitor = new OperationPerformanceMonitor({
      enabled: true,
      thresholds: {
        container_toggle: {
          maxDuration: 1,
          maxMemoryGrowth: 0.1,
          maxCoordinatorCalls: 0,
        },
      },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    monitor.clear();
  });

  it("should alert when thresholds are exceeded", () => {
    monitor.startOperation("container_toggle");

    // Simulate work that exceeds thresholds
    const startTime = Date.now();
    while (Date.now() - startTime < 10) {
      // Busy wait to exceed duration threshold
    }

    monitor.recordCoordinatorCall(); // Exceed coordinator call threshold
    monitor.endOperation("container_toggle");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Operation Performance Alert"),
      expect.arrayContaining([
        expect.stringContaining("Duration"),
        expect.stringContaining("Coordinator calls"),
      ]),
    );
  });
});

describe("Disabled Monitoring", () => {
  let monitor: OperationPerformanceMonitor;

  beforeEach(() => {
    monitor = new OperationPerformanceMonitor({ enabled: false });
  });

  it("should not record metrics when disabled", () => {
    monitor.startOperation("container_toggle");
    const metrics = monitor.endOperation("container_toggle");

    expect(metrics).toBeNull();
    expect(monitor.getOperationHistory()).toHaveLength(0);
  });

  it("should not detect cascades when disabled", () => {
    monitor.startOperation("container_toggle");
    monitor.endOperation("container_toggle");

    const cascadeDetection = monitor.getCascadeDetection();
    expect(cascadeDetection.detected).toBe(false);
    expect(cascadeDetection.cascadeCount).toBe(0);
  });
});
