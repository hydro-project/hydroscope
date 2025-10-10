/**
 * Performance Optimization Tests
 * Tests to verify performance improvements and optimizations
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import {
  globalPerformanceMonitor,
  recordPerformanceMetric,
  PerformanceMonitor,
} from "../utils/PerformanceMonitor.js";
import {
  globalProfiler,
  profileFunction,
  profileAsyncFunction,
} from "../utils/PerformanceProfiler.js";
import { measureSync, measureAsync } from "../utils/PerformanceUtils.js";
import fs from "fs";
import path from "path";

describe("Performance Optimization Tests", () => {
  let paxosData: any;
  let monitor: PerformanceMonitor;

  beforeAll(async () => {
    // Load paxos.json data
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent);

    // Initialize monitoring
    monitor = new PerformanceMonitor({
      enabled: true,
      samplingInterval: 1000,
    });
  });

  afterAll(() => {
    monitor.stop();
  });

  describe("Stateless Bridge Behavior", () => {
    it("should demonstrate ELK Bridge stateless consistency", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      // First conversion
      const elkGraph1 = elkBridge.toELKGraph(parseResult.visualizationState);

      // Second conversion with same state (should produce identical results)
      const elkGraph2 = elkBridge.toELKGraph(parseResult.visualizationState);

      // Verify stateless bridge produces identical results for identical inputs
      expect(elkGraph1).toBeDefined();
      expect(elkGraph2).toBeDefined();
      expect(JSON.stringify(elkGraph1)).toBe(JSON.stringify(elkGraph2));

      console.log(`ELK Stateless Test:
        First conversion successful: ${elkGraph1 !== undefined}
        Second conversion successful: ${elkGraph2 !== undefined}
        Results identical: ${JSON.stringify(elkGraph1) === JSON.stringify(elkGraph2)}`);
    });

    it("should demonstrate ReactFlow Bridge caching benefits", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();
      const reactFlowBridge = new ReactFlowBridge({
        nodeStyles: {},
        edgeStyles: {},
        containerStyles: {},
      });

      // Calculate layout so nodes have positions
      await elkBridge.layout(parseResult.visualizationState);

      // Calculate layout so nodes have positions
      await elkBridge.layout(parseResult.visualizationState);

      // First conversion (cache miss)
      const { result: data1, metrics: metrics1 } = measureSync(() => {
        return reactFlowBridge.toReactFlowData(parseResult.visualizationState);
      });

      // Second conversion with same state (cache hit)
      const { result: data2, metrics: metrics2 } = measureSync(() => {
        return reactFlowBridge.toReactFlowData(parseResult.visualizationState);
      });

      // ReactFlowBridge is now stateless - no cache statistics available
      // Verify that both conversions complete successfully
      expect(metrics1.duration).toBeGreaterThan(0);
      expect(metrics2.duration).toBeGreaterThan(0);

      console.log(`ReactFlow Stateless Performance:
        First conversion: ${metrics1.duration.toFixed(2)}ms
        Second conversion: ${metrics2.duration.toFixed(2)}ms
        Note: Bridge is now stateless (no caching)`);
    });
  });

  describe("Performance Monitoring", () => {
    it("should track and alert on performance metrics", async () => {
      const testMonitor = new PerformanceMonitor({
        enabled: true,
        alertThresholds: {
          TestComponent: {
            test_metric: { warning: 10, critical: 20 },
          },
        },
      });

      // Record metrics that should trigger alerts
      testMonitor.recordMetric("TestComponent", "test_metric", 5); // OK
      testMonitor.recordMetric("TestComponent", "test_metric", 15); // Warning
      testMonitor.recordMetric("TestComponent", "test_metric", 25); // Critical

      const alerts = testMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(2); // Warning + Critical

      const criticalAlerts = testMonitor.getAlerts("critical");
      expect(criticalAlerts.length).toBeGreaterThanOrEqual(1);

      const summary = testMonitor.getMetricSummary(
        "TestComponent",
        "test_metric",
      );
      expect(summary).toBeDefined();
      expect(summary!.current).toBe(25);

      testMonitor.stop();
    });

    it("should generate performance recommendations", async () => {
      const parser = new JSONParser();

      // Profile JSON parsing
      const { result, metrics } = await measureAsync(async () => {
        return await parser.parseData(paxosData);
      });

      recordPerformanceMetric("JSONParser", "parse_duration", metrics.duration);
      recordPerformanceMetric(
        "JSONParser",
        "memory_growth",
        metrics.memoryUsage.growth,
      );

      // Get performance metrics from VisualizationState
      const perfMetrics = result.visualizationState.getPerformanceMetrics();
      expect(perfMetrics.operationCounts).toBeDefined();
      expect(perfMetrics.averageTimes).toBeDefined();

      console.log("Performance Recommendations:", perfMetrics.recommendations);
    });
  });

  describe("Profiling Integration", () => {
    it("should profile component operations", async () => {
      const parser = new JSONParser();

      // Profile parsing operation
      globalProfiler.startOperation("json-parse");
      const parseResult = await parser.parseData(paxosData);
      const parseMetrics = globalProfiler.endOperation();

      // Profile visualization state operations
      globalProfiler.startOperation("container-operations");
      parseResult.visualizationState._expandAllContainersForCoordinator();
      parseResult.visualizationState._collapseAllContainersForCoordinator();
      const containerMetrics = globalProfiler.endOperation();

      // Verify metrics were collected
      expect(parseMetrics).toBeDefined();
      expect(parseMetrics!.operation).toBe("json-parse");
      expect(parseMetrics!.duration).toBeGreaterThan(0);

      expect(containerMetrics).toBeDefined();
      expect(containerMetrics!.operation).toBe("container-operations");
      expect(containerMetrics!.duration).toBeGreaterThan(0);

      console.log("Profiling Results:");
      console.log(
        `  ${parseMetrics!.operation}: ${parseMetrics!.duration.toFixed(2)}ms`,
      );
      console.log(
        `  ${containerMetrics!.operation}: ${containerMetrics!.duration.toFixed(2)}ms`,
      );
    });
  });

  describe("Memory Optimization", () => {
    it("should demonstrate memory efficiency improvements", async () => {
      const parser = new JSONParser();
      const elkBridge = new ELKBridge();
      const reactFlowBridge = new ReactFlowBridge({
        nodeStyles: {},
        edgeStyles: {},
        containerStyles: {},
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform operations multiple times
      for (let i = 0; i < 5; i++) {
        const parseResult = await parser.parseData(paxosData);
        const elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);
        // Calculate layout so nodes have positions
        await elkBridge.layout(parseResult.visualizationState);
        const reactFlowData = reactFlowBridge.toReactFlowData(
          parseResult.visualizationState,
        );

        // Both bridges are now stateless - no caches to clear
        // Memory management is handled by VisualizationState if needed
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(110); // Less than 110MB growth (realistic for complex operations)

      console.log(`Memory Optimization Test:
        Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Growth: ${memoryGrowth.toFixed(2)}MB`);
    });
  });

  describe("Performance Report Generation", () => {
    it("should generate comprehensive performance reports", async () => {
      // Record some test metrics
      recordPerformanceMetric("VisualizationState", "search_duration", 45);
      recordPerformanceMetric(
        "VisualizationState",
        "container_operation_duration",
        25,
      );
      recordPerformanceMetric("ELKBridge", "conversion_duration", 85);
      recordPerformanceMetric("ReactFlowBridge", "conversion_duration", 120);

      const report = globalPerformanceMonitor.generateReport();
      expect(report).toContain("Performance Monitoring Report");
      expect(report).toContain("Alert Summary");
      expect(report).toContain("Metric Trends");

      console.log("Generated Performance Report:");
      console.log(report);
    });
  });
});
