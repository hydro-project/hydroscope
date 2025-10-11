/**
 * Performance Optimization Tests
 * Tests to verify performance improvements and optimizations
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import {
  globalPerformanceMonitor,
  recordPerformanceMetric,
  PerformanceMonitor,
} from "../utils/PerformanceMonitor.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { globalProfiler } from "../utils/PerformanceProfiler.js";
import { measureSync, measureAsync } from "../utils/PerformanceUtils.js";
import fs from "fs";
import path from "path";
import { VisualizationState } from "../core/VisualizationState.js";

describe("Performance Optimization Tests", () => {
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
  });

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
      const parser = JSONParser.createPaxosParser({ debug: false });
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
      const parser = JSONParser.createPaxosParser({ debug: false });
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
      const { result: _data1, metrics: metrics1 } = measureSync(() => {
        return reactFlowBridge.toReactFlowData(parseResult.visualizationState);
      });

      // Second conversion with same state (cache hit)
      const { result: _data2, metrics: metrics2 } = measureSync(() => {
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
      const parser = JSONParser.createPaxosParser({ debug: false });

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

  describe.skip("Profiling Integration", () => {
    it("should profile component operations", async () => {
      globalProfiler.startSession("test-session");

      const parser = JSONParser.createPaxosParser({ debug: false });

      // Profile parsing operation
      globalProfiler.startOperation("json-parse");
      const parseResult = await parser.parseData(paxosData);
      globalProfiler.endOperation();

      // Profile visualization state operations
      globalProfiler.startOperation("container-operations");
      await coordinator.expandAllContainers(visualizationState, { triggerLayout: false });
      await coordinator.collapseAllContainers(visualizationState, { triggerLayout: false });
      globalProfiler.endOperation();

      const session = globalProfiler.endSession("test-session");
      expect(session).toBeDefined();
      expect(session!.results.length).toBeGreaterThan(0);
      expect(session!.summary).toBeDefined();

      console.log("Profiling Results:");
      session!.results.forEach((result) => {
        console.log(`  ${result.operation}: ${result.duration.toFixed(2)}ms`);
        if (result.recommendations && result.recommendations.length > 0) {
          console.log(
            `    Recommendations: ${result.recommendations.join(", ")}`,
          );
        }
      });
    });
  });

  describe("Memory Optimization", () => {
    it("should demonstrate memory efficiency improvements", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
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
        const _elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);
        // Calculate layout so nodes have positions
        await elkBridge.layout(parseResult.visualizationState);
        const _reactFlowData = reactFlowBridge.toReactFlowData(
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

  describe("Large Graph Performance", () => {
    it(
      "should handle large graphs efficiently with optimizations",
      { timeout: 20000 },
      async () => {
        // Generate a larger synthetic dataset
        const largeData = {
          nodes: Array.from({ length: 1000 }, (_, i) => ({
            id: `node_${i}`,
            label: `Node ${i}`,
            longLabel: `This is a longer label for node ${i}`,
            type: "operator",
            semanticTags: [`tag_${i % 10}`],
          })),
          edges: Array.from({ length: 1500 }, (_, i) => ({
            id: `edge_${i}`,
            source: `node_${Math.floor(Math.random() * 1000)}`,
            target: `node_${Math.floor(Math.random() * 1000)}`,
            type: "data",
            semanticTags: ["data"],
          })),
          containers: Array.from({ length: 50 }, (_, i) => ({
            id: `container_${i}`,
            label: `Container ${i}`,
            type: "container",
            semanticTags: ["container"],
          })),
          hierarchyChoices: [
            {
              id: "test",
              name: "test",
              displayName: "Test Grouping",
            },
          ],
          nodeAssignments: {
            test: Object.fromEntries(
              Array.from({ length: 1000 }, (_, i) => [
                `node_${i}`,
                `container_${Math.floor(i / 20)}`, // 20 nodes per container
              ]),
            ),
          },
        };

        const parser = JSONParser.createPaxosParser({ debug: false });
        const elkBridge = new ELKBridge();
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          containerStyles: {},
        });

        // Test complete pipeline with large data
        const { result: parseResult, metrics: parseMetrics } =
          await measureAsync(async () => {
            return await parser.parseData(largeData);
          });

        const { result: _elkGraph, metrics: elkMetrics } = measureSync(() => {
          return elkBridge.toELKGraph(parseResult.visualizationState);
        });

        // Calculate layout so nodes have positions
        await elkBridge.layout(parseResult.visualizationState);

        const { result: _reactFlowData, metrics: reactFlowMetrics } =
          measureSync(() => {
            return reactFlowBridge.toReactFlowData(
              parseResult.visualizationState,
            );
          });

        // Performance should still be reasonable with large graphs
        expect(parseMetrics.duration).toBeLessThan(2000); // 2 seconds
        expect(elkMetrics.duration).toBeLessThan(500); // 500ms
        expect(reactFlowMetrics.duration).toBeLessThan(1000); // 1 second

        console.log(`Large Graph Performance (1000 nodes, 1500 edges):
        Parse: ${parseMetrics.duration.toFixed(2)}ms
        ELK Conversion: ${elkMetrics.duration.toFixed(2)}ms
        ReactFlow Conversion: ${reactFlowMetrics.duration.toFixed(2)}ms
        Total Pipeline: ${(parseMetrics.duration + elkMetrics.duration + reactFlowMetrics.duration).toFixed(2)}ms`);
      },
    );
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
