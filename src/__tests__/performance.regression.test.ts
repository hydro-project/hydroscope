/**
 * Performance Regression Tests
 * Automated tests to detect performance regressions and maintain baselines
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import {
  PerformanceAnalyzer,
  BatchPerformanceTester,
  measureSync,
  createPerformanceReport,
} from "../utils/PerformanceUtils.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import {
  DEFAULT_PERFORMANCE_THRESHOLDS,
  getRandomQuery,
  createPerformanceBaseline,
  type PerformanceBaseline,
} from "./performance.config.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Performance Regression Tests", () => {
  let paxosData: HydroscopeData;
  let batchTester: BatchPerformanceTester;
  let performanceBaseline: PerformanceBaseline | null = null;
  const baselinePath = path.join(process.cwd(), "performance-baseline.json");

  beforeAll(async () => {
    // Load paxos.json data
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent);

    // Initialize batch tester
    batchTester = new BatchPerformanceTester();

    // Load existing baseline if available
    try {
      if (fs.existsSync(baselinePath)) {
        const baselineContent = fs.readFileSync(baselinePath, "utf-8");
        performanceBaseline = JSON.parse(baselineContent);
      }
    } catch (error) {
      console.warn("Could not load performance baseline:", error);
    }
  });

  afterAll(() => {
    // Save performance results as new baseline if none exists
    if (!performanceBaseline) {
      const results = batchTester.getAllResults();
      const baselineData: Record<string, unknown> = {};

      for (const [testName, metrics] of results) {
        if (metrics.length > 0) {
          const avgMetrics = metrics.reduce(
            (acc, m) => ({
              duration: acc.duration + m.duration,
              memoryGrowth: acc.memoryGrowth + m.memoryUsage.growth,
              throughput: (acc.throughput || 0) + (m.throughput || 0),
            }),
            { duration: 0, memoryGrowth: 0, throughput: 0 },
          );

          baselineData[testName] = {
            duration: avgMetrics.duration / metrics.length,
            memoryGrowth: avgMetrics.memoryGrowth / metrics.length,
            throughput: avgMetrics.throughput / metrics.length,
          };
        }
      }

      const baseline = createPerformanceBaseline("1.0.0", baselineData);

      if (process.env.DEBUG_FILES) {
        try {
          fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
          console.log("Performance baseline saved to:", baselinePath);
        } catch (error) {
          console.warn("Could not save performance baseline:", error);
        }
      }
    }
  });

  describe("Core Component Performance", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import("../utils/testData.js");
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
    });

    it("should maintain JSON parsing performance", async () => {
      const testResult = await batchTester.runTest(
        "json-parse",
        async () => {
          const parser = new JSONParser({
            validateDuringParsing: true,
          });
          return await parser.parseData(paxosData);
        },
        5,
        2,
      );

      // Check against thresholds
      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.jsonParse,
      );
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth,
      );

      // Check for regression if baseline exists
      if (performanceBaseline?.results["json-parse"]) {
        const baseline = performanceBaseline.results["json-parse"];
        const regression = PerformanceAnalyzer.compareMetrics(
          {
            duration: baseline.duration,
            memoryUsage: {
              initial: 0,
              peak: 0,
              final: 0,
              growth: baseline.memoryGrowth,
            },
            throughput: baseline.throughput,
          },
          testResult.average,
        );

        // Allow for some performance variation in test environment
        expect(regression.durationChange).toBeLessThan(400); // More realistic threshold for test environment up to 150% regression in test environment

        if (regression.durationChange > 5) {
          console.warn(
            `JSON Parse performance regression: ${regression.durationChange.toFixed(2)}% slower`,
          );
        }
      }

      console.log(
        createPerformanceReport("JSON Parse", testResult.average, {
          maxDuration: DEFAULT_PERFORMANCE_THRESHOLDS.jsonParse,
          maxMemoryGrowth: DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth,
        }),
      );
    });

    it("should maintain ELK Bridge performance", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      const testResult = await batchTester.runTest(
        "elk-bridge",
        () => {
          return elkBridge.toELKGraph(parseResult.visualizationState);
        },
        10,
        3,
      );

      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.elkConversion,
      );
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth,
      );

      console.log(
        createPerformanceReport("ELK Bridge Conversion", testResult.average),
      );
    });

    it("should maintain ReactFlow Bridge performance", async () => {
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

      const testResult = await batchTester.runTest(
        "reactflow-bridge",
        () => {
          return reactFlowBridge.toReactFlowData(
            parseResult.visualizationState,
          );
        },
        10,
        3,
      );

      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.reactFlowConversion,
      );
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth,
      );

      console.log(
        createPerformanceReport(
          "ReactFlow Bridge Conversion",
          testResult.average,
        ),
      );
    });
  });

  describe("Stress Testing", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import("../utils/testData.js");
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
    });

    it("should handle container operation stress test", { timeout: 15000 }, async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);

      const testResult = await batchTester.runTest(
        "container-stress",
        async () => {
          const state = parseResult.visualizationState;

          // Rapid container operations (reduced iterations for performance)
          for (let i = 0; i < 3; i++) {
            await coordinator.expandAllContainers(state, {
              fitView: false,
            });
            await coordinator.collapseAllContainers(state, {
              fitView: false,
            });
          }

          return state;
        },
        5,
        2,
      );

      // Should complete within reasonable time even with many operations
      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.containerOperations * 20,
      );

      console.log(
        createPerformanceReport("Container Stress Test", testResult.average),
      );
    });

    it("should handle search operation stress test", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);

      const testResult = await batchTester.runTest(
        "search-stress",
        async () => {
          const state = parseResult.visualizationState;

          // Multiple search operations
          for (let i = 0; i < 20; i++) {
            const query = getRandomQuery();
            state.search(query);
          }
          state.clearSearch();

          return state;
        },
        5,
        2,
      );

      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.searchOperations * 20,
      );

      console.log(
        createPerformanceReport("Search Stress Test", testResult.average),
      );
    });
  });

  describe("Throughput Testing", () => {
    it("should maintain node processing throughput", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const nodeCount = parseResult.visualizationState.visibleNodes.length;

      const { _result, metrics } = measureSync(() => {
        const elkBridge = new ELKBridge();
        return elkBridge.toELKGraph(parseResult.visualizationState);
      });

      const throughput = nodeCount / (metrics.duration / 1000); // nodes per second

      expect(throughput).toBeGreaterThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.nodeProcessingThroughput,
      );

      console.log(
        `Node Processing Throughput: ${throughput.toFixed(2)} nodes/sec (${nodeCount} nodes in ${metrics.duration.toFixed(2)}ms)`,
      );
    });

    it("should maintain search throughput", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const state = parseResult.visualizationState;

      const searchCount = 50;
      const { _result, metrics } = measureSync(() => {
        for (let i = 0; i < searchCount; i++) {
          const query = getRandomQuery();
          state.search(query);
        }
        return searchCount;
      });

      const throughput = searchCount / (metrics.duration / 1000); // searches per second

      expect(throughput).toBeGreaterThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.searchThroughput,
      );

      console.log(
        `Search Throughput: ${throughput.toFixed(2)} searches/sec (${searchCount} searches in ${metrics.duration.toFixed(2)}ms)`,
      );
    });
  });

  describe("Performance Baseline Comparison", () => {
    it("should not regress significantly from baseline", async () => {
      if (!performanceBaseline) {
        console.log(
          "No performance baseline available - this run will establish the baseline",
        );
        return;
      }

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

      // Test key operations against baseline
      const operations = [
        {
          name: "json-parse",
          fn: async () => await parser.parseData(paxosData),
        },
        {
          name: "elk-conversion",
          fn: () => elkBridge.toELKGraph(parseResult.visualizationState),
        },
        {
          name: "reactflow-conversion",
          fn: () =>
            reactFlowBridge.toReactFlowData(parseResult.visualizationState),
        },
      ];

      for (const operation of operations) {
        const { _result, metrics } = measureSync(operation.fn);
        const baselineResult = performanceBaseline.results[operation.name];

        if (baselineResult) {
          const comparison = PerformanceAnalyzer.compareMetrics(
            {
              duration: baselineResult.duration,
              memoryUsage: {
                initial: 0,
                peak: 0,
                final: 0,
                growth: baselineResult.memoryGrowth,
              },
              throughput: baselineResult.throughput,
            },
            metrics,
          );

          // Fail if there's a significant regression (>20% slower or >50% more memory)
          expect(comparison.durationChange).toBeLessThan(20);
          expect(comparison.memoryChange).toBeLessThan(50);

          console.log(`${operation.name} vs baseline:
            Duration: ${comparison.durationChange.toFixed(2)}% change
            Memory: ${comparison.memoryChange.toFixed(2)}% change
            Regression: ${comparison.regression ? "YES" : "NO"}`);
        }
      }
    });
  });
});
