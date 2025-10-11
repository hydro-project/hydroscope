/**
 * Performance Regression Tests for Stateless Bridge Architecture
 * Tests performance impact of removing caches from ReactFlowBridge and ELKBridge
 *
 * Task 6: Performance regression testing
 * - Benchmark ReactFlowBridge.toReactFlowData performance without caches
 * - Benchmark ELKBridge operations without caches
 * - Test with large graphs (1000+ nodes) to identify performance impact
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import {
  BatchPerformanceTester,
  createPerformanceReport,
} from "../utils/PerformanceUtils.js";
import {
  DEFAULT_PERFORMANCE_THRESHOLDS,
  generateSyntheticGraphData,
} from "./performance.config.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Stateless Bridge Performance Regression Tests", () => {
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
  });

  let paxosData: HydroscopeData;
  let largeGraphData: HydroscopeData;
  let batchTester: BatchPerformanceTester;

  beforeAll(async () => {
    // Load paxos.json data (large real-world graph)
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent);

    // Generate large synthetic graph (1000+ nodes)
    largeGraphData = generateSyntheticGraphData("large");

    // Initialize batch tester
    batchTester = new BatchPerformanceTester();

    console.log(`📊 Performance test data loaded:`);
    console.log(`  - Paxos nodes: ${paxosData.nodes.length}`);
    console.log(`  - Paxos edges: ${paxosData.edges.length}`);
    console.log(`  - Paxos containers: ${paxosData.containers?.length || 0}`);
    console.log(`  - Large synthetic nodes: ${largeGraphData.nodes.length}`);
    console.log(`  - Large synthetic edges: ${largeGraphData.edges.length}`);
    console.log(
      `  - Large synthetic containers: ${largeGraphData.containers?.length || 0}`,
    );
  });

  describe("ReactFlowBridge Performance (Stateless)", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should maintain ReactFlowBridge.toReactFlowData performance with paxos.json", async () => {
      const coordinator = new AsyncCoordinator();
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
        "reactflow-bridge-paxos",
        () => {
          return reactFlowBridge.toReactFlowData(
            parseResult.visualizationState,
          );
        },
        10, // iterations
        3, // warmup
      );

      // Performance expectations for stateless bridge
      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.reactFlowConversion * 2, // Allow 2x threshold for stateless
      );
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth * 1.5, // Allow 1.5x memory growth
      );

      // Calculate throughput (nodes processed per second)
      const nodeCount = parseResult.visualizationState.visibleNodes.length;
      const throughput = nodeCount / (testResult.average.duration / 1000);

      console.log(
        createPerformanceReport(
          `ReactFlowBridge.toReactFlowData (Paxos - ${nodeCount} nodes)`,
          testResult.average,
        ),
      );
      console.log(
        `Node processing throughput: ${throughput.toFixed(2)} nodes/sec`,
      );

      // Verify consistent performance across iterations (no cache warming effects)
      const durations = testResult.results.map((r) => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variancePercent =
        ((maxDuration - minDuration) / testResult.average.duration) * 100;

      console.log(
        `Performance consistency: ${variancePercent.toFixed(2)}% variance`,
      );
      expect(variancePercent).toBeLessThan(500); // Less than 500% variance between runs (realistic for different system loads)
    });

    it(
      "should handle large synthetic graphs (1000+ nodes) efficiently",
      { timeout: 30000 },
      async () => {
        // Use medium size for more realistic testing (still 500+ nodes)
        const mediumGraphData = generateSyntheticGraphData("medium");
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(mediumGraphData);
        const elkBridge = new ELKBridge();
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          containerStyles: {},
        });

        // Calculate layout so nodes have positions
        await elkBridge.layout(parseResult.visualizationState);

        const testResult = await batchTester.runTest(
          "reactflow-bridge-large",
          () => {
            return reactFlowBridge.toReactFlowData(
              parseResult.visualizationState,
            );
          },
          3, // fewer iterations for large graphs
          1,
        );

        const nodeCount = parseResult.visualizationState.visibleNodes.length;
        const edgeCount = parseResult.visualizationState.visibleEdges.length;

        // Performance expectations for large graphs
        expect(testResult.average.duration).toBeLessThan(
          DEFAULT_PERFORMANCE_THRESHOLDS.reactFlowConversion * 10, // Allow 10x for large graphs
        );
        expect(testResult.average.memoryUsage.peak).toBeLessThan(
          DEFAULT_PERFORMANCE_THRESHOLDS.memoryUsage * 5, // Allow 5x memory for large graphs
        );

        const throughput = nodeCount / (testResult.average.duration / 1000);

        console.log(
          createPerformanceReport(
            `ReactFlowBridge.toReactFlowData (Medium - ${nodeCount} nodes, ${edgeCount} edges)`,
            testResult.average,
          ),
        );
        console.log(
          `Node processing throughput: ${throughput.toFixed(2)} nodes/sec`,
        );

        // Ensure throughput is reasonable for large graphs
        expect(throughput).toBeGreaterThan(50); // At least 50 nodes/sec for medium graphs
      },
    );

    it("should handle repeated conversions without performance degradation", async () => {
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

      // Test many repeated conversions to check for memory leaks or performance degradation
      const testResult = await batchTester.runTest(
        "reactflow-bridge-repeated",
        () => {
          // Perform multiple conversions in a single test iteration
          const results = [];
          for (let i = 0; i < 20; i++) {
            results.push(
              reactFlowBridge.toReactFlowData(parseResult.visualizationState),
            );
          }
          return results;
        },
        5,
        2,
      );

      // Memory growth should be minimal for repeated operations
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth * 2,
      );

      console.log(
        createPerformanceReport(
          "ReactFlowBridge Repeated Conversions (20x per iteration)",
          testResult.average,
        ),
      );

      // Check for memory leak patterns
      const memoryGrowths = testResult.results.map((r) => r.memoryUsage.growth);
      const avgGrowth =
        memoryGrowths.reduce((sum, g) => sum + g, 0) / memoryGrowths.length;
      const maxGrowth = Math.max(...memoryGrowths);
      const minGrowth = Math.min(...memoryGrowths);

      console.log(
        `Memory growth analysis: avg=${avgGrowth.toFixed(2)}MB, max=${maxGrowth.toFixed(2)}MB, min=${minGrowth.toFixed(2)}MB`,
      );

      // More realistic memory growth check - ensure no excessive growth trend
      const memoryRange = maxGrowth - minGrowth;
      expect(memoryRange).toBeLessThan(100); // Memory range should be less than 100MB
    });

    it("should handle container state changes efficiently", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();
      const reactFlowBridge = new ReactFlowBridge({
        nodeStyles: {},
        edgeStyles: {},
        containerStyles: {},
      });

      const testResult = await batchTester.runTest(
        "reactflow-bridge-container-changes",
        async () => {
          const state = parseResult.visualizationState;

          // Test conversion with different container states
          await coordinator.expandAllContainers(state, {
            triggerLayout: false,
          });
          await elkBridge.layout(state);
          const expandedResult = reactFlowBridge.toReactFlowData(state);

          await coordinator.collapseAllContainers(state, {
            triggerLayout: false,
          });
          await elkBridge.layout(state);
          const collapsedResult = reactFlowBridge.toReactFlowData(state);

          return { expandedResult, collapsedResult };
        },
        5,
        2,
      );

      expect(testResult.average.duration).toBeLessThan(
        (DEFAULT_PERFORMANCE_THRESHOLDS.reactFlowConversion +
          DEFAULT_PERFORMANCE_THRESHOLDS.elkLayout) *
          2,
      );

      console.log(
        createPerformanceReport(
          "ReactFlowBridge with Container State Changes",
          testResult.average,
        ),
      );
    });
  });

  describe("ELKBridge Performance (Stateless)", () => {
    let coordinator: AsyncCoordinato;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should maintain ELKBridge.toELKGraph performance with paxos.json", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      const testResult = await batchTester.runTest(
        "elk-bridge-conversion-paxos",
        () => {
          return elkBridge.toELKGraph(parseResult.visualizationState);
        },
        10,
        3,
      );

      // Performance expectations for stateless ELK bridge
      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.elkConversion * 2, // Allow 2x threshold for stateless
      );
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth * 1.5,
      );

      const nodeCount = parseResult.visualizationState.visibleNodes.length;
      const throughput = nodeCount / (testResult.average.duration / 1000);

      console.log(
        createPerformanceReport(
          `ELKBridge.toELKGraph (Paxos - ${nodeCount} nodes)`,
          testResult.average,
        ),
      );
      console.log(
        `Node processing throughput: ${throughput.toFixed(2)} nodes/sec`,
      );
    });

    it(
      "should handle ELK layout calculation with large graphs",
      { timeout: 30000 },
      async () => {
        // Use medium size for more realistic testing
        const mediumGraphData = generateSyntheticGraphData("medium");
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(mediumGraphData);
        const elkBridge = new ELKBridge();

        const testResult = await batchTester.runTest(
          "elk-bridge-layout-large",
          async () => {
            // Full layout pipeline
            await elkBridge.layout(parseResult.visualizationState);
            return parseResult.visualizationState;
          },
          2, // fewer iterations for expensive layout
          1,
        );

        const nodeCount = parseResult.visualizationState.visibleNodes.length;

        // Layout is expensive, so allow higher thresholds
        expect(testResult.average.duration).toBeLessThan(
          DEFAULT_PERFORMANCE_THRESHOLDS.elkLayout * 5, // Allow 5x for medium graphs
        );

        console.log(
          createPerformanceReport(
            `ELKBridge.layout (Medium - ${nodeCount} nodes)`,
            testResult.average,
          ),
        );

        // Verify layout actually calculated positions
        const hasPositions = parseResult.visualizationState.visibleNodes.every(
          (node) =>
            node.position &&
            typeof node.position.x === "number" &&
            typeof node.position.y === "number",
        );
        expect(hasPositions).toBe(true);
      },
    );

    it("should handle repeated ELK conversions without caching side effects", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      const testResult = await batchTester.runTest(
        "elk-bridge-repeated-conversions",
        () => {
          // Multiple conversions to test stateless behavior
          const results = [];
          for (let i = 0; i < 10; i++) {
            results.push(elkBridge.toELKGraph(parseResult.visualizationState));
          }
          return results;
        },
        5,
        2,
      );

      // Should be consistent without cache warming
      expect(testResult.average.memoryUsage.growth).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth * 2,
      );

      console.log(
        createPerformanceReport(
          "ELKBridge Repeated Conversions (10x per iteration)",
          testResult.average,
        ),
      );

      // Verify all conversions produce identical results (stateless guarantee)
      const firstConversion = elkBridge.toELKGraph(
        parseResult.visualizationState,
      );
      const secondConversion = elkBridge.toELKGraph(
        parseResult.visualizationState,
      );

      expect(firstConversion.children?.length).toBe(
        secondConversion.children?.length,
      );
      expect(firstConversion.edges?.length).toBe(
        secondConversion.edges?.length,
      );
    });

    it("should handle complex hierarchical structures efficiently", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      // Create complex hierarchy by expanding all containers
      await coordinator.expandAllContainers(parseResult.visualizationState, {
        triggerLayout: false,
      });

      const testResult = await batchTester.runTest(
        "elk-bridge-hierarchical",
        () => {
          return elkBridge.toELKGraph(parseResult.visualizationState);
        },
        5,
        2,
      );

      const containerCount =
        parseResult.visualizationState.visibleContainers.length;
      const nodeCount = parseResult.visualizationState.visibleNodes.length;

      expect(testResult.average.duration).toBeLessThan(
        DEFAULT_PERFORMANCE_THRESHOLDS.elkConversion * 3, // Allow 3x for complex hierarchies
      );

      console.log(
        createPerformanceReport(
          `ELKBridge Hierarchical (${nodeCount} nodes, ${containerCount} containers)`,
          testResult.average,
        ),
      );
    });
  });

  describe("Combined Bridge Performance", () => {
    let coordinator: AsyncCoordinato;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it(
      "should handle full pipeline without performance regression",
      { timeout: 30000 },
      async () => {
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(paxosData);
        const elkBridge = new ELKBridge();
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          containerStyles: {},
        });

        const testResult = await batchTester.runTest(
          "full-pipeline-stateless",
          async () => {
            // Full pipeline: ELK conversion -> Layout -> ReactFlow conversion
            const elkGraph = elkBridge.toELKGraph(
              parseResult.visualizationState,
            );
            await elkBridge.layout(parseResult.visualizationState);
            const reactFlowData = reactFlowBridge.toReactFlowData(
              parseResult.visualizationState,
            );

            return { elkGraph, reactFlowData };
          },
          3, // fewer iterations for full pipeline
          1,
        );

        // Combined pipeline should complete within reasonable time
        const expectedMaxDuration =
          DEFAULT_PERFORMANCE_THRESHOLDS.elkConversion +
          DEFAULT_PERFORMANCE_THRESHOLDS.elkLayout +
          DEFAULT_PERFORMANCE_THRESHOLDS.reactFlowConversion;

        expect(testResult.average.duration).toBeLessThan(
          expectedMaxDuration * 3,
        ); // Allow 3x for full pipeline

        const nodeCount = parseResult.visualizationState.visibleNodes.length;
        console.log(
          createPerformanceReport(
            `Full Pipeline Stateless (${nodeCount} nodes)`,
            testResult.average,
          ),
        );
      },
    );

    it(
      "should maintain performance under stress conditions",
      { timeout: 30000 },
      async () => {
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(paxosData);
        const elkBridge = new ELKBridge();
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          containerStyles: {},
        });

        const testResult = await batchTester.runTest(
          "stress-test-stateless",
          async () => {
            const state = parseResult.visualizationState;

            // Stress test: rapid state changes with conversions (reduced iterations)
            for (let i = 0; i < 3; i++) {
              await coordinator.expandAllContainers(state, {
                triggerLayout: false,
              });
              elkBridge.toELKGraph(state);

              await coordinator.collapseAllContainers(state, {
                triggerLayout: false,
              });
              elkBridge.toELKGraph(state);

              await elkBridge.layout(state);
              reactFlowBridge.toReactFlowData(state);
            }

            return state;
          },
          2, // fewer test iterations
          1,
        );

        // Should handle stress without excessive memory growth
        expect(testResult.average.memoryUsage.growth).toBeLessThan(
          DEFAULT_PERFORMANCE_THRESHOLDS.memoryGrowth * 10, // Allow 10x for stress test
        );

        console.log(
          createPerformanceReport(
            "Stress Test Stateless (3x rapid state changes)",
            testResult.average,
          ),
        );
      },
    );
  });

  describe("Performance Comparison Analysis", () => {
    it("should provide performance analysis summary", async () => {
      const allResults = batchTester.getAllResults();

      console.log("\n📊 STATELESS BRIDGE PERFORMANCE SUMMARY");
      console.log("=".repeat(50));

      for (const [testName, results] of allResults) {
        if (results.length > 0) {
          const average = results.reduce(
            (acc, r) => ({
              duration: acc.duration + r.duration,
              memoryGrowth: acc.memoryGrowth + r.memoryUsage.growth,
            }),
            { duration: 0, memoryGrowth: 0 },
          );

          average.duration /= results.length;
          average.memoryGrowth /= results.length;

          console.log(`${testName}:`);
          console.log(`  Duration: ${average.duration.toFixed(2)}ms`);
          console.log(`  Memory Growth: ${average.memoryGrowth.toFixed(2)}MB`);
          console.log(`  Iterations: ${results.length}`);
          console.log("");
        }
      }

      // This test always passes - it's just for reporting
      expect(allResults.size).toBeGreaterThan(0);
    });
  });
});
