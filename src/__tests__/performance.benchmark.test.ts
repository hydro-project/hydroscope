/**
 * Performance Benchmarks for Hydroscope Core Components
 * Tests performance with paxos.json data and provides regression testing
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import fs from "fs";
import path from "path";

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  JSON_PARSE: 500, // JSON parsing should complete within 500ms
  VISUALIZATION_STATE_LOAD: 200, // Loading data into VisualizationState
  ELK_CONVERSION: 100, // Converting to ELK format
  ELK_LAYOUT: 2000, // ELK layout processing (most expensive)
  REACTFLOW_CONVERSION: 210, // Converting to ReactFlow format (increased for test environment)
  CONTAINER_OPERATIONS: 50, // Container expand/collapse operations
  SEARCH_OPERATIONS: 100, // Search operations
  MEMORY_USAGE_MB: 100, // Maximum memory usage in MB
};

// Memory monitoring utilities
interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  timestamp: number;
}

class PerformanceMonitor {
  private memorySnapshots: MemorySnapshot[] = [];
  private startTime: number = 0;
  private gcEnabled: boolean = false;

  constructor() {
    // Enable garbage collection if available
    if (global.gc) {
      this.gcEnabled = true;
    }
  }

  startTiming(): void {
    this.startTime = performance.now();
    this.takeMemorySnapshot();
  }

  endTiming(): number {
    const duration = performance.now() - this.startTime;
    this.takeMemorySnapshot();
    return duration;
  }

  takeMemorySnapshot(): void {
    const memUsage = process.memoryUsage();
    this.memorySnapshots.push({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      timestamp: performance.now(),
    });
  }

  getMemoryStats() {
    if (this.memorySnapshots.length < 2) {
      return { peak: 0, growth: 0, snapshots: this.memorySnapshots };
    }

    const peak = Math.max(...this.memorySnapshots.map((s) => s.heapUsed));
    const initial = this.memorySnapshots[0].heapUsed;
    const final =
      this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed;
    const growth = final - initial;

    return {
      peak: peak / 1024 / 1024, // Convert to MB
      growth: growth / 1024 / 1024, // Convert to MB
      snapshots: this.memorySnapshots,
    };
  }

  forceGC(): void {
    if (this.gcEnabled && global.gc) {
      global.gc();
    }
  }

  reset(): void {
    this.memorySnapshots = [];
    this.startTime = 0;
  }
}

describe("Performance Benchmarks", () => {
  let paxosData: any;
  let monitor: PerformanceMonitor;
  let visualizationState: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeAll(async () => {
    // Load paxos.json data
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosContent);

    // Initialize performance monitor
    monitor = new PerformanceMonitor();

    // Initialize components
    elkBridge = new ELKBridge({
      algorithm: "layered",
      direction: "DOWN",
      nodeSpacing: 20,
      layerSpacing: 25,
    });

    reactFlowBridge = new ReactFlowBridge({
      nodeStyles: {},
      edgeStyles: {},
      containerStyles: {},
    });

    asyncCoordinator = new AsyncCoordinator();
  });

  afterAll(() => {
    // Clean up
    monitor.forceGC();
  });

  describe("JSON Parsing Performance", () => {
    it("should parse paxos.json within performance threshold", async () => {
      monitor.reset();
      monitor.startTiming();

      const parser = new JSONParser({
        defaultHierarchyChoice: "location",
        validateDuringParsing: true,
      });

      const result = await parser.parseData(paxosData);
      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      // Performance assertions
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.JSON_PARSE);
      expect(memoryStats.peak).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB,
      );

      // Functional assertions
      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);

      console.log(`JSON Parse Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.JSON_PARSE}ms)
        Memory Peak: ${memoryStats.peak.toFixed(2)}MB (threshold: ${PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB}MB)
        Nodes: ${result.stats.nodeCount}
        Edges: ${result.stats.edgeCount}
        Containers: ${result.stats.containerCount}`);

      visualizationState = result.visualizationState;
    });
  });

  describe("VisualizationState Performance", () => {
    it("should load data efficiently", async () => {
      monitor.reset();
      monitor.startTiming();

      const state = new VisualizationState();
      const parser = new JSONParser();
      const result = await parser.parseData(paxosData);

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.VISUALIZATION_STATE_LOAD,
      );
      expect(memoryStats.peak).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB,
      );

      console.log(`VisualizationState Load Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.VISUALIZATION_STATE_LOAD}ms)
        Memory Peak: ${memoryStats.peak.toFixed(2)}MB`);
    });

    it("should perform container operations efficiently", async () => {
      if (!visualizationState) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        visualizationState = result.visualizationState;
      }

      monitor.reset();
      monitor.startTiming();

      // Test expand all operation
      visualizationState.expandAllContainers();

      // Test collapse all operation
      visualizationState.collapseAllContainers();

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.CONTAINER_OPERATIONS,
      );

      console.log(`Container Operations Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.CONTAINER_OPERATIONS}ms)
        Memory Growth: ${memoryStats.growth.toFixed(2)}MB`);
    });

    it("should perform search operations efficiently", async () => {
      if (!visualizationState) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        visualizationState = result.visualizationState;
      }

      monitor.reset();
      monitor.startTiming();

      // Test search operations
      const searchResults1 = visualizationState.search("paxos");
      const searchResults2 = visualizationState.search("client");
      const searchResults3 = visualizationState.search("stream");

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATIONS);
      expect(
        searchResults1.length + searchResults2.length + searchResults3.length,
      ).toBeGreaterThan(0);

      console.log(`Search Operations Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.SEARCH_OPERATIONS}ms)
        Results found: ${searchResults1.length + searchResults2.length + searchResults3.length}
        Memory Growth: ${memoryStats.growth.toFixed(2)}MB`);
    });
  });

  describe("ELK Bridge Performance", () => {
    it("should convert to ELK format efficiently", async () => {
      if (!visualizationState) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        visualizationState = result.visualizationState;
      }

      monitor.reset();
      monitor.startTiming();

      const elkGraph = elkBridge.toELKGraph(visualizationState);

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ELK_CONVERSION);
      expect(elkGraph).toBeDefined();
      expect(elkGraph.children).toBeDefined();

      console.log(`ELK Conversion Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.ELK_CONVERSION}ms)
        Memory Peak: ${memoryStats.peak.toFixed(2)}MB
        ELK Nodes: ${elkGraph.children?.length || 0}`);
    });

    it("should handle layout configuration updates efficiently", async () => {
      monitor.reset();
      monitor.startTiming();

      // Test multiple configuration updates
      elkBridge.updateConfiguration({ algorithm: "force" });
      elkBridge.updateConfiguration({ direction: "RIGHT" });
      elkBridge.updateConfiguration({ nodeSpacing: 30 });

      const duration = monitor.endTiming();

      expect(duration).toBeLessThan(50); // Should be very fast

      console.log(`ELK Config Update Performance:
        Duration: ${duration.toFixed(2)}ms`);
    });
  });

  describe("ReactFlow Bridge Performance", () => {
    it("should convert to ReactFlow format efficiently", async () => {
      if (!visualizationState) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        visualizationState = result.visualizationState;
      }

      // Calculate layout so nodes have positions
      await elkBridge.layout(visualizationState);

      monitor.reset();
      monitor.startTiming();

      // Calculate layout so nodes have positions

      await elkBridge.layout(visualizationState);

      const reactFlowData = reactFlowBridge.toReactFlowData(visualizationState);

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.REACTFLOW_CONVERSION,
      );
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      console.log(`ReactFlow Conversion Performance:
        Duration: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.REACTFLOW_CONVERSION}ms)
        Memory Peak: ${memoryStats.peak.toFixed(2)}MB
        ReactFlow Nodes: ${reactFlowData.nodes.length}
        ReactFlow Edges: ${reactFlowData.edges.length}`);
    });

    it("should handle style application efficiently", async () => {
      if (!visualizationState) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        visualizationState = result.visualizationState;
      }

      // Calculate layout so nodes have positions
      await elkBridge.layout(visualizationState);

      monitor.reset();
      monitor.startTiming();

      // Calculate layout so nodes have positions

      await elkBridge.layout(visualizationState);

      const reactFlowData = reactFlowBridge.toReactFlowData(visualizationState);

      // Apply styles multiple times to test caching
      reactFlowBridge.applyNodeStyles(reactFlowData.nodes);
      reactFlowBridge.applyEdgeStyles(reactFlowData.edges);

      const duration = monitor.endTiming();

      expect(duration).toBeLessThan(100); // Should be fast due to caching

      console.log(`Style Application Performance:
        Duration: ${duration.toFixed(2)}ms`);
    });
  });

  describe("End-to-End Pipeline Performance", () => {
    it("should process complete pipeline efficiently", async () => {
      monitor.reset();
      monitor.startTiming();

      // Complete pipeline: Parse -> Load -> Layout -> Render
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const state = parseResult.visualizationState;

      const elkGraph = elkBridge.toELKGraph(state);
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);
      const reactFlowData = reactFlowBridge.toReactFlowData(state);

      const duration = monitor.endTiming();
      const memoryStats = monitor.getMemoryStats();

      // Total pipeline should complete within reasonable time
      const totalThreshold =
        PERFORMANCE_THRESHOLDS.JSON_PARSE +
        PERFORMANCE_THRESHOLDS.ELK_CONVERSION +
        PERFORMANCE_THRESHOLDS.REACTFLOW_CONVERSION;

      expect(duration).toBeLessThan(totalThreshold);
      expect(memoryStats.peak).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB * 1.5,
      );

      console.log(`End-to-End Pipeline Performance:
        Total Duration: ${duration.toFixed(2)}ms (threshold: ${totalThreshold}ms)
        Memory Peak: ${memoryStats.peak.toFixed(2)}MB
        Pipeline Steps: Parse -> ELK -> ReactFlow
        Final Nodes: ${reactFlowData.nodes.length}
        Final Edges: ${reactFlowData.edges.length}`);
    });
  });

  describe("Memory Usage Analysis", () => {
    it("should not have significant memory leaks", async () => {
      monitor.reset();
      monitor.forceGC(); // Start with clean slate

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations that could cause leaks
      for (let i = 0; i < 10; i++) {
        const parser = new JSONParser();
        const result = await parser.parseData(paxosData);
        const state = result.visualizationState;

        state.expandAllContainers();
        state.collapseAllContainers();
        state.search("test");
        state.clearSearch();

        const elkGraph = elkBridge.toELKGraph(state);
        // Calculate layout so nodes have positions
        await elkBridge.layout(state);
        const reactFlowData = reactFlowBridge.toReactFlowData(state);

        // Clear caches periodically
        if (i % 3 === 0) {
          reactFlowBridge.clearCaches();
        }
      }

      monitor.forceGC(); // Force cleanup
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

      // Memory growth should be reasonable (less than 50MB for 10 iterations)
      expect(memoryGrowth).toBeLessThan(50);

      console.log(`Memory Leak Analysis:
        Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Growth: ${memoryGrowth.toFixed(2)}MB (should be < 50MB)`);
    });
  });

  describe("Performance Regression Tests", () => {
    it("should maintain performance baselines", async () => {
      const results = {
        jsonParse: 0,
        elkConversion: 0,
        reactFlowConversion: 0,
        containerOps: 0,
        searchOps: 0,
      };

      // JSON Parse
      monitor.reset();
      monitor.startTiming();
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      results.jsonParse = monitor.endTiming();

      // ELK Conversion
      monitor.reset();
      monitor.startTiming();
      const elkGraph = elkBridge.toELKGraph(parseResult.visualizationState);
      results.elkConversion = monitor.endTiming();

      // ReactFlow Conversion
      // Calculate layout so nodes have positions
      await elkBridge.layout(parseResult.visualizationState);
      monitor.reset();
      monitor.startTiming();
      const reactFlowData = reactFlowBridge.toReactFlowData(
        parseResult.visualizationState,
      );
      results.reactFlowConversion = monitor.endTiming();

      // Container Operations
      monitor.reset();
      monitor.startTiming();
      parseResult.visualizationState.expandAllContainers();
      parseResult.visualizationState.collapseAllContainers();
      results.containerOps = monitor.endTiming();

      // Search Operations
      monitor.reset();
      monitor.startTiming();
      parseResult.visualizationState.search("paxos");
      results.searchOps = monitor.endTiming();

      // Assert all operations meet thresholds
      expect(results.jsonParse).toBeLessThan(PERFORMANCE_THRESHOLDS.JSON_PARSE);
      expect(results.elkConversion).toBeLessThan(
        PERFORMANCE_THRESHOLDS.ELK_CONVERSION,
      );
      expect(results.reactFlowConversion).toBeLessThan(
        PERFORMANCE_THRESHOLDS.REACTFLOW_CONVERSION,
      );
      expect(results.containerOps).toBeLessThan(
        PERFORMANCE_THRESHOLDS.CONTAINER_OPERATIONS,
      );
      expect(results.searchOps).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SEARCH_OPERATIONS,
      );

      console.log(`Performance Regression Test Results:
        JSON Parse: ${results.jsonParse.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.JSON_PARSE}ms
        ELK Conversion: ${results.elkConversion.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.ELK_CONVERSION}ms
        ReactFlow Conversion: ${results.reactFlowConversion.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.REACTFLOW_CONVERSION}ms
        Container Ops: ${results.containerOps.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.CONTAINER_OPERATIONS}ms
        Search Ops: ${results.searchOps.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.SEARCH_OPERATIONS}ms`);
    });
  });
});
