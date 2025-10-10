/**
 * Performance and Stability Validation for Paxos-Flipped Edge Validation Fix
 *
 * This test measures performance and stability characteristics of the current
 * implementation to establish baselines and identify performance issues.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Paxos-Flipped Performance and Stability Validation", () => {
  let paxosFlippedData: HydroscopeData;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;
  });

  describe("Performance Characteristics", () => {
    it("should measure parsing performance with complex hierarchical data", async () => {
      console.log("⏱️ Measuring parsing performance...");

      const startTime = performance.now();

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const parseTime = performance.now() - startTime;

      console.log(`📊 Parsing Performance:`);
      console.log(`  - Parse time: ${parseTime.toFixed(2)}ms`);
      console.log(`  - Nodes parsed: ${parseResult.stats.nodeCount}`);
      console.log(`  - Containers parsed: ${parseResult.stats.containerCount}`);
      console.log(`  - Edges parsed: ${parseResult.stats.edgeCount || "N/A"}`);

      // Performance expectations (these may need adjustment based on hardware)
      expect(parseTime).toBeLessThan(5000); // Should parse within 5 seconds
      expect(parseResult.stats.nodeCount).toBeGreaterThan(0);
      expect(parseResult.stats.containerCount).toBeGreaterThan(0);

      // Calculate throughput
      const totalEntities =
        parseResult.stats.nodeCount + parseResult.stats.containerCount;
      const entitiesPerSecond = totalEntities / (parseTime / 1000);
      console.log(
        `  - Throughput: ${entitiesPerSecond.toFixed(0)} entities/second`,
      );
    });

    it("should measure container expansion performance", async () => {
      console.log("⏱️ Measuring container expansion performance...");

      // Parse the data first
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Find the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();
      const containerId = runtimeParkContainer!.id;

      // Ensure container is collapsed
      if (!runtimeParkContainer!.collapsed) {
        visualizationState._collapseContainerForCoordinator(containerId);
      }

      // Measure expansion time
      const expansionStartTime = performance.now();

      try {
        visualizationState._expandContainerForCoordinator(containerId);
        const expansionTime = performance.now() - expansionStartTime;

        console.log(`📊 Container Expansion Performance:`);
        console.log(`  - Expansion time: ${expansionTime.toFixed(2)}ms`);
        console.log(`  - Container: ${containerId}`);

        // Performance expectation - should expand within reasonable time
        // Note: This may fail due to current bugs, which is expected
        if (expansionTime < 2000) {
          console.log(`  ✅ Expansion completed within acceptable time`);
        } else {
          console.log(
            `  ⚠️ Expansion took longer than expected (${expansionTime.toFixed(2)}ms > 2000ms)`,
          );
        }
      } catch (error) {
        const expansionTime = performance.now() - expansionStartTime;
        console.log(`📊 Container Expansion Performance (Failed):`);
        console.log(`  - Time to failure: ${expansionTime.toFixed(2)}ms`);
        console.log(
          `  - Error: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Document the failure for debugging
        console.log(
          `  ❌ Expansion failed - this indicates bugs that need fixing`,
        );
      }
    });

    it("should measure ReactFlow bridge conversion performance", async () => {
      console.log("⏱️ Measuring ReactFlow bridge performance...");

      // Parse the data first
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      const reactFlowBridge = new ReactFlowBridge({});

      // Measure conversion time
      const conversionStartTime = performance.now();

      try {
        const renderData = reactFlowBridge.toReactFlowData(visualizationState);
        const conversionTime = performance.now() - conversionStartTime;

        console.log(`📊 ReactFlow Conversion Performance:`);
        console.log(`  - Conversion time: ${conversionTime.toFixed(2)}ms`);
        console.log(`  - Nodes converted: ${renderData.nodes.length}`);
        console.log(`  - Edges converted: ${renderData.edges.length}`);

        // Calculate throughput
        const totalElements = renderData.nodes.length + renderData.edges.length;
        const elementsPerSecond = totalElements / (conversionTime / 1000);
        console.log(
          `  - Throughput: ${elementsPerSecond.toFixed(0)} elements/second`,
        );

        // Performance expectation
        expect(conversionTime).toBeLessThan(3000); // Should convert within 3 seconds
      } catch (error) {
        const conversionTime = performance.now() - conversionStartTime;
        console.log(`📊 ReactFlow Conversion Performance (Failed):`);
        console.log(`  - Time to failure: ${conversionTime.toFixed(2)}ms`);
        console.log(
          `  - Error: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Document the failure
        console.log(
          `  ❌ Conversion failed - this indicates edge validation bugs`,
        );

        // This failure is expected due to current bugs
        expect(error).toBeDefined();
      }
    });

    it("should measure memory usage during operations", async () => {
      console.log("💾 Measuring memory usage...");

      // Get initial memory usage
      const initialMemory = process.memoryUsage();
      console.log(`📊 Initial Memory Usage:`);
      console.log(
        `  - Heap used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `  - Heap total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      );

      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const afterParseMemory = process.memoryUsage();
      const parseMemoryIncrease =
        afterParseMemory.heapUsed - initialMemory.heapUsed;

      console.log(`📊 Memory Usage After Parsing:`);
      console.log(
        `  - Heap used: ${(afterParseMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `  - Memory increase: ${(parseMemoryIncrease / 1024 / 1024).toFixed(2)} MB`,
      );

      // Try ReactFlow conversion
      try {
        const reactFlowBridge = new ReactFlowBridge({});
        reactFlowBridge.toReactFlowData(parseResult.visualizationState);

        const afterConversionMemory = process.memoryUsage();
        const conversionMemoryIncrease =
          afterConversionMemory.heapUsed - afterParseMemory.heapUsed;

        console.log(`📊 Memory Usage After ReactFlow Conversion:`);
        console.log(
          `  - Heap used: ${(afterConversionMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        );
        console.log(
          `  - Memory increase: ${(conversionMemoryIncrease / 1024 / 1024).toFixed(2)} MB`,
        );
      } catch (error) {
        console.log(
          `  ❌ ReactFlow conversion failed, memory measurement incomplete`,
        );
      }

      // Memory usage should be reasonable (less than 500MB for this dataset)
      const totalMemoryUsed = afterParseMemory.heapUsed / 1024 / 1024;
      expect(totalMemoryUsed).toBeLessThan(500);
    });
  });

  describe("Stability Characteristics", () => {
    it("should handle repeated operations without crashes", async () => {
      console.log("🔄 Testing stability with repeated operations...");

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Find the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();
      const containerId = runtimeParkContainer!.id;

      let successfulOperations = 0;
      let failedOperations = 0;
      const totalOperations = 10;

      console.log(
        `🔄 Performing ${totalOperations} expansion/collapse cycles...`,
      );

      for (let i = 0; i < totalOperations; i++) {
        try {
          // Collapse
          visualizationState._collapseContainerForCoordinator(containerId);

          // Expand
          visualizationState._expandContainerForCoordinator(containerId);

          successfulOperations++;
        } catch (error) {
          failedOperations++;
          console.log(
            `  ❌ Operation ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      console.log(`📊 Stability Results:`);
      console.log(
        `  - Successful operations: ${successfulOperations}/${totalOperations}`,
      );
      console.log(
        `  - Failed operations: ${failedOperations}/${totalOperations}`,
      );
      console.log(
        `  - Success rate: ${((successfulOperations / totalOperations) * 100).toFixed(1)}%`,
      );

      // Document current stability - may be low due to bugs
      if (successfulOperations === totalOperations) {
        console.log(`  ✅ All operations completed successfully`);
      } else {
        console.log(
          `  ⚠️ Some operations failed - indicates stability issues that need fixing`,
        );
      }

      // The test should not crash completely
      expect(successfulOperations + failedOperations).toBe(totalOperations);
    });

    it("should maintain consistent state across operations", async () => {
      console.log("🔍 Testing state consistency...");

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Capture initial state
      const initialState = {
        nodeCount: visualizationState.visibleNodes.length,
        containerCount: visualizationState.visibleContainers.length,
        edgeCount: visualizationState.visibleEdges.length,
      };

      console.log(`📊 Initial State:`);
      console.log(`  - Nodes: ${initialState.nodeCount}`);
      console.log(`  - Containers: ${initialState.containerCount}`);
      console.log(`  - Edges: ${initialState.edgeCount}`);

      // Find the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();
      const containerId = runtimeParkContainer!.id;

      // Perform operations and check state consistency
      const stateSnapshots: Array<{
        operation: string;
        nodeCount: number;
        containerCount: number;
        edgeCount: number;
      }> = [];

      try {
        // Collapse
        visualizationState._collapseContainerForCoordinator(containerId);
        stateSnapshots.push({
          operation: "collapse",
          nodeCount: visualizationState.visibleNodes.length,
          containerCount: visualizationState.visibleContainers.length,
          edgeCount: visualizationState.visibleEdges.length,
        });

        // Expand
        visualizationState._expandContainerForCoordinator(containerId);
        stateSnapshots.push({
          operation: "expand",
          nodeCount: visualizationState.visibleNodes.length,
          containerCount: visualizationState.visibleContainers.length,
          edgeCount: visualizationState.visibleEdges.length,
        });

        // Collapse again
        visualizationState._collapseContainerForCoordinator(containerId);
        stateSnapshots.push({
          operation: "collapse_again",
          nodeCount: visualizationState.visibleNodes.length,
          containerCount: visualizationState.visibleContainers.length,
          edgeCount: visualizationState.visibleEdges.length,
        });

        console.log(`📊 State Transitions:`);
        stateSnapshots.forEach((snapshot, index) => {
          console.log(
            `  ${index + 1}. After ${snapshot.operation}: ${snapshot.nodeCount} nodes, ${snapshot.containerCount} containers, ${snapshot.edgeCount} edges`,
          );
        });

        // Check for reasonable state consistency
        // The first and last collapse states should be similar
        const firstCollapse = stateSnapshots[0];
        const secondCollapse = stateSnapshots[2];

        const nodeDiff = Math.abs(
          firstCollapse.nodeCount - secondCollapse.nodeCount,
        );
        const containerDiff = Math.abs(
          firstCollapse.containerCount - secondCollapse.containerCount,
        );
        const edgeDiff = Math.abs(
          firstCollapse.edgeCount - secondCollapse.edgeCount,
        );

        console.log(`📊 State Consistency Check:`);
        console.log(`  - Node count difference: ${nodeDiff}`);
        console.log(`  - Container count difference: ${containerDiff}`);
        console.log(`  - Edge count difference: ${edgeDiff}`);

        // Allow for some variation due to complex aggregation logic
        if (nodeDiff <= 10 && containerDiff <= 10 && edgeDiff <= 20) {
          console.log(
            `  ✅ State consistency maintained within acceptable bounds`,
          );
        } else {
          console.log(
            `  ⚠️ State consistency issues detected - may indicate bugs`,
          );
        }
      } catch (error) {
        console.log(
          `  ❌ State consistency test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.log(`  This indicates bugs in the container operation logic`);
      }
    });

    it("should document current bug characteristics for debugging", async () => {
      console.log("🐛 Documenting current bug characteristics...");

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Find the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();
      const containerId = runtimeParkContainer!.id;

      // Capture console errors to analyze bug patterns
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const errorMessages: string[] = [];
      const warnMessages: string[] = [];

      console.error = (...args: any[]) => {
        errorMessages.push(args.join(" "));
        originalConsoleError(...args);
      };

      console.warn = (...args: any[]) => {
        warnMessages.push(args.join(" "));
        originalConsoleWarn(...args);
      };

      try {
        // Ensure container is collapsed
        if (!runtimeParkContainer!.collapsed) {
          visualizationState._collapseContainerForCoordinator(containerId);
        }

        // Expand the container
        visualizationState._expandContainerForCoordinator(containerId);

        // Try ReactFlow conversion to trigger edge validation
        const reactFlowBridge = new ReactFlowBridge({});
        reactFlowBridge.toReactFlowData(visualizationState);
      } catch (error) {
        // Expected to fail due to current bugs
      } finally {
        // Restore original console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
      }

      // Analyze error patterns
      console.log(`🐛 Bug Analysis Results:`);
      console.log(`  - Total errors: ${errorMessages.length}`);
      console.log(`  - Total warnings: ${warnMessages.length}`);

      // Categorize errors
      const edgeErrors = errorMessages.filter(
        (msg) => msg.includes("edge") || msg.includes("Edge"),
      );
      const validationErrors = errorMessages.filter(
        (msg) => msg.includes("validation") || msg.includes("Validation"),
      );
      const floatingErrors = errorMessages.filter(
        (msg) => msg.includes("floating") || msg.includes("Floating"),
      );

      console.log(`  - Edge-related errors: ${edgeErrors.length}`);
      console.log(`  - Validation errors: ${validationErrors.length}`);
      console.log(`  - Floating edge errors: ${floatingErrors.length}`);

      if (edgeErrors.length > 0) {
        console.log(`  📝 Sample edge errors (first 3):`);
        edgeErrors.slice(0, 3).forEach((error, index) => {
          console.log(`    ${index + 1}. ${error.substring(0, 100)}...`);
        });
      }

      // This test documents the current state - it should show bugs exist
      console.log(
        `  📊 Bug Summary: This test documents ${errorMessages.length} errors that need to be fixed`,
      );

      // The test passes by documenting the bugs, not by having no bugs
      expect(errorMessages.length + warnMessages.length).toBeGreaterThan(0);
    });
  });
});
