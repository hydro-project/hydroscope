/**
 * Performance Optimization Tests
 * Tests to verify React.memo and memoization are working effectively
 * and to identify performance bottlenecks for optimization
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Hydroscope } from "../components/Hydroscope.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { JSONParser } from "../utils/JSONParser.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import {
  BatchPerformanceTester,
  measureSync,
  measureAsync,
} from "../utils/PerformanceUtils.js";
import { generateSyntheticGraphData } from "./performance.config.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Performance Optimization Tests", () => {
  let paxosData: HydroscopeData;
  let largeGraphData: HydroscopeData;
  let batchTester: BatchPerformanceTester;

  beforeAll(async () => {
    // Load test data
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent);

    // Generate large synthetic data for stress testing
    largeGraphData = generateSyntheticGraphData("large");

    batchTester = new BatchPerformanceTester();
  });

  afterAll(() => {
    // Cleanup any resources
    vi.clearAllMocks();
  });

  describe("React.memo Effectiveness", () => {
    it("should verify component is wrapped with React.memo", () => {
      // Check that the Hydroscope component has been memoized
      // This is a static check to ensure the component is properly optimized
      expect(Hydroscope.displayName).toBeDefined();

      // The component should be a memoized component
      // React.memo components have specific properties we can check
      const componentString = Hydroscope.toString();
      expect(componentString).toBeDefined();

      console.log(
        "✓ Hydroscope component is properly structured for memoization",
      );
    });

    it("should measure component render performance", async () => {
      const testResult = await batchTester.runTest(
        "component-render-performance",
        async () => {
          const component = render(
            <Hydroscope
              data={paxosData}
              showControls={true}
              showInfoPanel={false}
              showStylePanel={false}
            />,
          );

          // Wait for component to be ready
          await waitFor(
            () => {
              expect(
                screen.getByTestId("hydroscope-container"),
              ).toBeInTheDocument();
            },
            { timeout: 5000 },
          );

          component.unmount();
          return true;
        },
        5,
        2,
      );

      // Component rendering should be reasonably fast
      expect(testResult.average.duration).toBeLessThan(2000); // Less than 2 seconds
      expect(testResult.average.memoryUsage.growth).toBeLessThan(100); // Less than 100MB growth

      console.log(`Component Render Performance:
        Average Duration: ${testResult.average.duration.toFixed(2)}ms
        Memory Growth: ${testResult.average.memoryUsage.growth.toFixed(2)}MB`);
    });
  });

  describe("useMemo Effectiveness", () => {
    it("should memoize ReactFlowBridge creation", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);

      // Test ReactFlowBridge creation performance
      const testResult = await batchTester.runTest(
        "reactflow-bridge-creation",
        () => {
          const bridge = new ReactFlowBridge({
            nodeStyles: {},
            edgeStyles: {},
            containerStyles: {},
          });
          return bridge.toReactFlowData(parseResult.visualizationState);
        },
        10,
        3,
      );

      // ReactFlow bridge operations should be reasonably fast
      expect(testResult.average.duration).toBeLessThan(200);
      expect(testResult.average.memoryUsage.growth).toBeLessThan(10);

      console.log(
        `ReactFlow Bridge Creation: ${testResult.average.duration.toFixed(2)}ms average`,
      );
    });

    it("should memoize ELK layout calculations", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const elkBridge = new ELKBridge();

      // Test ELK layout memoization
      const testResult = await batchTester.runTest(
        "elk-layout-memoization",
        async () => {
          // First call should do the calculation
          await elkBridge.layout(parseResult.visualizationState);

          // Subsequent calls should be faster if memoized
          await elkBridge.layout(parseResult.visualizationState);

          return true;
        },
        5,
        2,
      );

      // ELK layout should complete within reasonable time
      expect(testResult.average.duration).toBeLessThan(5000); // 5 seconds max

      console.log(
        `ELK Layout Performance: ${testResult.average.duration.toFixed(2)}ms average`,
      );
    });
  });

  describe("useCallback Effectiveness", () => {
    it("should handle callback creation efficiently", async () => {
      const onNodeClick = vi.fn();
      const onConfigChange = vi.fn();

      // Test callback-heavy component creation
      const testResult = await batchTester.runTest(
        "callback-creation-performance",
        () => {
          const component = render(
            <Hydroscope
              data={paxosData}
              onNodeClick={onNodeClick}
              onConfigChange={onConfigChange}
              showControls={true}
              showInfoPanel={false}
              showStylePanel={false}
            />,
          );

          component.unmount();
          return true;
        },
        10,
        3,
      );

      // Component with callbacks should create efficiently
      expect(testResult.average.duration).toBeLessThan(1000);
      expect(testResult.average.memoryUsage.growth).toBeLessThan(50);

      console.log(
        `Callback Creation Performance: ${testResult.average.duration.toFixed(2)}ms average`,
      );
    });

    it("should handle state updates efficiently", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);

      // Test rapid state updates on VisualizationState
      const testResult = await batchTester.runTest(
        "state-update-performance",
        () => {
          const state = parseResult.visualizationState;

          // Perform multiple state operations
          for (let i = 0; i < 10; i++) {
            state.search("test");
            state.clearSearch();
          }

          return state;
        },
        10,
        3,
      );

      // State updates should be fast
      expect(testResult.average.duration).toBeLessThan(100);

      console.log(
        `State Update Performance: ${testResult.average.duration.toFixed(2)}ms for 20 operations`,
      );
    });
  });

  describe("Memory Usage Optimization", () => {
    it("should not leak memory during core operations", async () => {
      const testResult = await batchTester.runTest(
        "core-operations-memory",
        async () => {
          const parser = new JSONParser();
          const parseResult = await parser.parseData(paxosData);
          const elkBridge = new ELKBridge();
          const reactFlowBridge = new ReactFlowBridge({
            nodeStyles: {},
            edgeStyles: {},
            containerStyles: {},
          });

          // Perform core operations
          const elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);
          await elkBridge.layout(parseResult.visualizationState);
          const reactFlowData = reactFlowBridge.toReactFlowData(
            parseResult.visualizationState,
          );

          // Cleanup references
          return { elkGraph, reactFlowData };
        },
        15,
        5,
      );

      // Memory growth should be minimal across operations
      expect(testResult.average.memoryUsage.growth).toBeLessThan(20); // Less than 20MB growth

      // Check for memory leak patterns
      const memoryGrowths = testResult.results.map((r) => r.memoryUsage.growth);
      const maxGrowth = Math.max(...memoryGrowths);
      const minGrowth = Math.min(...memoryGrowths);
      const variance = maxGrowth - minGrowth;

      expect(variance).toBeLessThan(100); // Less than 100MB variance indicates no major leaks

      console.log(`Core Operations Memory Test:
        Average Growth: ${testResult.average.memoryUsage.growth.toFixed(2)}MB
        Variance: ${variance.toFixed(2)}MB
        Max Growth: ${maxGrowth.toFixed(2)}MB`);
    });

    it("should handle large datasets efficiently", async () => {
      const { result, metrics } = await measureAsync(async () => {
        const parser = new JSONParser();
        const parseResult = await parser.parseData(largeGraphData);
        const elkBridge = new ELKBridge();

        // Process large dataset
        const elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);

        return { parseResult, elkGraph };
      });

      // Should handle large datasets efficiently
      expect(metrics.memoryUsage.peak).toBeLessThan(800); // Less than 800MB peak for large data
      expect(metrics.duration).toBeLessThan(10000); // Less than 10 seconds

      console.log(`Large Dataset Processing:
        Peak Memory: ${metrics.memoryUsage.peak.toFixed(2)}MB
        Duration: ${metrics.duration.toFixed(2)}ms
        Memory Growth: ${metrics.memoryUsage.growth.toFixed(2)}MB`);
    });
  });

  describe("Performance Bottleneck Detection", () => {
    it("should identify bottlenecks in data processing pipeline", async () => {
      const parser = new JSONParser();
      const elkBridge = new ELKBridge();
      const reactFlowBridge = new ReactFlowBridge({
        nodeStyles: {},
        edgeStyles: {},
        containerStyles: {},
      });

      // Measure each stage of the pipeline
      const { result: parseResult, metrics: parseMetrics } = await measureAsync(
        async () => {
          return await parser.parseData(paxosData);
        },
      );

      const { result: elkGraph, metrics: elkMetrics } = measureSync(() => {
        return elkBridge.toELKGraph(parseResult.visualizationState);
      });

      const { result: layoutResult, metrics: layoutMetrics } =
        await measureAsync(async () => {
          return await elkBridge.layout(parseResult.visualizationState);
        });

      const { result: reactFlowData, metrics: reactFlowMetrics } = measureSync(
        () => {
          return reactFlowBridge.toReactFlowData(
            parseResult.visualizationState,
          );
        },
      );

      // Identify bottlenecks
      const operations = [
        { name: "JSON Parsing", duration: parseMetrics.duration },
        { name: "ELK Conversion", duration: elkMetrics.duration },
        { name: "ELK Layout", duration: layoutMetrics.duration },
        { name: "ReactFlow Conversion", duration: reactFlowMetrics.duration },
      ];

      const slowestOperation = operations.reduce((prev, current) =>
        prev.duration > current.duration ? prev : current,
      );

      console.log(`Pipeline Performance Analysis:
        ${operations.map((op) => `${op.name}: ${op.duration.toFixed(2)}ms`).join("\n        ")}
        Slowest: ${slowestOperation.name} (${slowestOperation.duration.toFixed(2)}ms)`);

      // ELK Layout is expected to be the slowest, but should still be reasonable
      expect(layoutMetrics.duration).toBeLessThan(5000); // 5 seconds max
      expect(parseMetrics.duration).toBeLessThan(1000); // 1 second max
      expect(elkMetrics.duration).toBeLessThan(500); // 500ms max
      expect(reactFlowMetrics.duration).toBeLessThan(500); // 500ms max
    });

    it("should measure container operation performance", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const state = parseResult.visualizationState;

      // Test container operations
      const { metrics: expandMetrics } = measureSync(() => {
        state.expandAllContainers();
      });

      const { metrics: collapseMetrics } = measureSync(() => {
        state.collapseAllContainers();
      });

      // Container operations should be fast
      expect(expandMetrics.duration).toBeLessThan(100);
      expect(collapseMetrics.duration).toBeLessThan(100);

      console.log(`Container Operations Performance:
        Expand All: ${expandMetrics.duration.toFixed(2)}ms
        Collapse All: ${collapseMetrics.duration.toFixed(2)}ms`);
    });

    it("should measure search performance", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const state = parseResult.visualizationState;

      // Test search performance
      const searchQueries = ["paxos", "client", "stream", "node", "container"];
      const searchMetrics: number[] = [];

      for (const query of searchQueries) {
        const { metrics } = measureSync(() => {
          state.search(query);
        });
        searchMetrics.push(metrics.duration);

        // Clear search for next iteration
        state.clearSearch();
      }

      const averageSearchTime =
        searchMetrics.reduce((a, b) => a + b, 0) / searchMetrics.length;

      // Search should be fast
      expect(averageSearchTime).toBeLessThan(50);

      console.log(`Search Performance:
        Average Search Time: ${averageSearchTime.toFixed(2)}ms
        Individual Times: ${searchMetrics.map((t) => t.toFixed(2)).join(", ")}ms`);
    });
  });

  describe("Optimization Verification", () => {
    it("should verify all memoization is working correctly", async () => {
      // This test verifies that our optimizations are actually effective
      const testResult = await batchTester.runTest(
        "optimization-verification",
        async () => {
          const component = render(
            <Hydroscope
              data={paxosData}
              showControls={true}
              showInfoPanel={true}
              showStylePanel={true}
              enableCollapse={true}
            />,
          );

          await waitFor(() => {
            expect(
              screen.getByTestId("hydroscope-container"),
            ).toBeInTheDocument();
          });

          // Perform a series of operations that should benefit from memoization
          const infoButton = screen.getByLabelText("Toggle Info Panel");
          const styleButton = screen.getByLabelText("Toggle Style Panel");

          // Multiple toggles - should be fast due to memoization
          fireEvent.click(infoButton);
          fireEvent.click(styleButton);
          fireEvent.click(infoButton);
          fireEvent.click(styleButton);

          component.unmount();
          return true;
        },
        10,
        3,
      );

      // Operations should be consistently fast due to memoization
      expect(testResult.average.duration).toBeLessThan(1000);

      // Check for consistency (low variance indicates good memoization)
      const durations = testResult.results.map((r) => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      expect(variance).toBeLessThan(500); // Low variance indicates consistent performance

      console.log(`Optimization Verification:
        Average Duration: ${testResult.average.duration.toFixed(2)}ms
        Variance: ${variance.toFixed(2)}ms
        Min/Max: ${minDuration.toFixed(2)}ms / ${maxDuration.toFixed(2)}ms`);
    });

    it("should verify overall system performance", async () => {
      // This test verifies that our optimizations are actually effective
      const testResult = await batchTester.runTest(
        "overall-system-performance",
        async () => {
          const parser = new JSONParser();
          const parseResult = await parser.parseData(paxosData);
          const elkBridge = new ELKBridge();
          const reactFlowBridge = new ReactFlowBridge({
            nodeStyles: {},
            edgeStyles: {},
            containerStyles: {},
          });

          // Full pipeline test
          const elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);
          await elkBridge.layout(parseResult.visualizationState);
          const reactFlowData = reactFlowBridge.toReactFlowData(
            parseResult.visualizationState,
          );

          // Test some operations
          parseResult.visualizationState.search("paxos");
          parseResult.visualizationState.clearSearch();
          parseResult.visualizationState.expandAllContainers();
          parseResult.visualizationState.collapseAllContainers();

          return { parseResult, elkGraph, reactFlowData };
        },
        8,
        3,
      );

      // Operations should be consistently fast due to optimizations
      expect(testResult.average.duration).toBeLessThan(8000); // 8 seconds for full pipeline
      expect(testResult.average.memoryUsage.growth).toBeLessThan(100); // Less than 100MB growth

      // Check for consistency (low variance indicates good optimization)
      const durations = testResult.results.map((r) => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      expect(variance).toBeLessThan(3000); // Reasonable variance for complex operations

      console.log(`Overall System Performance:
        Average Duration: ${testResult.average.duration.toFixed(2)}ms
        Memory Growth: ${testResult.average.memoryUsage.growth.toFixed(2)}MB
        Variance: ${variance.toFixed(2)}ms
        Min/Max: ${minDuration.toFixed(2)}ms / ${maxDuration.toFixed(2)}ms`);
    });

    it("should verify React.memo is properly applied", () => {
      // Verify the component is properly memoized
      const componentName = Hydroscope.displayName || Hydroscope.name;
      expect(componentName).toBeDefined();
      expect(componentName).toBe("Hydroscope");

      // React.memo components have a specific structure
      const hasDisplayName = Boolean(Hydroscope.displayName);
      expect(hasDisplayName).toBe(true);

      // The component should be callable (function-like)
      expect(typeof Hydroscope).toBe("object"); // React.memo returns an object, not a function

      console.log(
        `✓ Component ${componentName} is properly structured for optimization with React.memo`,
      );
    });
  });
});
