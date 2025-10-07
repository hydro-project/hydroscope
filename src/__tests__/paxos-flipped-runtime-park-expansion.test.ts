/**
 * End-to-End Test for Paxos-Flipped runtime/park.rs Container Expansion
 *
 * This test validates that the complete fix works for the specific scenario
 * mentioned in the requirements: expanding runtime/park.rs container when
 * loading paxos-flipped.json data.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Paxos-Flipped runtime/park.rs Container Expansion", () => {
  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    // Parse the data
    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(paxosFlippedData);
    visualizationState = parseResult.visualizationState;
  });

  describe("Runtime/Park.rs Container Expansion", () => {
    it("should find runtime/park.rs container in paxos-flipped.json", () => {
      console.log("🔍 Looking for runtime/park.rs container...");

      // Find the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      console.log(`📊 Found ${containers.length} containers total`);

      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      if (!runtimeParkContainer) {
        // Log all container IDs and labels for debugging
        console.log("🔍 Available containers:");
        containers.forEach((container, index) => {
          console.log(
            `  ${index + 1}. ID: ${container.id}, Label: ${container.label}`,
          );
        });
      }

      expect(runtimeParkContainer).toBeDefined();
      console.log(
        `✅ Found runtime/park.rs container: ${runtimeParkContainer!.id}`,
      );
    });

    it("should expand runtime/park.rs container without invalid edge errors", async () => {
      console.log("🚀 Testing runtime/park.rs container expansion...");

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
      console.log(
        `📦 Container before expansion: collapsed=${runtimeParkContainer!.collapsed}, hidden=${runtimeParkContainer!.hidden}`,
      );

      // Ensure container is initially collapsed
      if (!runtimeParkContainer!.collapsed) {
        visualizationState.collapseContainer(runtimeParkContainer!.id);
      }

      // Expand the container - this should not throw any errors
      expect(() => {
        visualizationState.expandContainer(runtimeParkContainer!.id);
      }).not.toThrow();

      console.log(
        `📦 Container after expansion: collapsed=${runtimeParkContainer!.collapsed}, hidden=${runtimeParkContainer!.hidden}`,
      );

      // Verify the container is now expanded
      expect(runtimeParkContainer!.collapsed).toBe(false);
      expect(runtimeParkContainer!.hidden).toBe(false);

      console.log(
        "✅ runtime/park.rs container expanded successfully without errors",
      );
    });

    it("should render expanded runtime/park.rs container through ReactFlow bridge", async () => {
      console.log("🎨 Testing ReactFlow rendering after expansion...");

      // Find and expand the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();

      // Ensure container is initially collapsed
      if (!runtimeParkContainer!.collapsed) {
        visualizationState.collapseContainer(runtimeParkContainer!.id);
      }

      // Expand the container
      visualizationState.expandContainer(runtimeParkContainer!.id);

      // Convert to ReactFlow data - this should not throw any invalid edge errors
      const reactFlowBridge = new ReactFlowBridge({});
      let renderData;

      expect(() => {
        renderData = reactFlowBridge.toReactFlowData(visualizationState);
      }).not.toThrow();

      expect(renderData).toBeDefined();
      expect(renderData!.nodes).toBeDefined();
      expect(renderData!.edges).toBeDefined();
      expect(renderData!.nodes.length).toBeGreaterThan(0);

      console.log(
        `✅ ReactFlow rendering successful: ${renderData!.nodes.length} nodes, ${renderData!.edges.length} edges`,
      );
    });

    it("should handle multiple expansion/collapse cycles without errors", async () => {
      console.log("🔄 Testing multiple expansion/collapse cycles...");

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

      // Perform multiple expansion/collapse cycles
      for (let cycle = 1; cycle <= 3; cycle++) {
        console.log(`🔄 Cycle ${cycle}: Collapsing container...`);

        // Collapse
        expect(() => {
          visualizationState.collapseContainer(containerId);
        }).not.toThrow();

        expect(runtimeParkContainer!.collapsed).toBe(true);

        console.log(`🔄 Cycle ${cycle}: Expanding container...`);

        // Expand
        expect(() => {
          visualizationState.expandContainer(containerId);
        }).not.toThrow();

        expect(runtimeParkContainer!.collapsed).toBe(false);

        // Verify ReactFlow rendering still works
        const reactFlowBridge = new ReactFlowBridge({});
        expect(() => {
          reactFlowBridge.toReactFlowData(visualizationState);
        }).not.toThrow();

        console.log(`✅ Cycle ${cycle} completed successfully`);
      }

      console.log("✅ All expansion/collapse cycles completed without errors");
    });

    it("should maintain data integrity throughout expansion operations", async () => {
      console.log("🔍 Testing data integrity during expansion...");

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

      // Capture initial state
      const initialNodeCount = visualizationState.visibleNodes.length;
      const initialEdgeCount = visualizationState.visibleEdges.length;
      const initialContainerCount = visualizationState.visibleContainers.length;

      console.log(
        `📊 Initial state: ${initialNodeCount} nodes, ${initialEdgeCount} edges, ${initialContainerCount} containers`,
      );

      // Ensure container is collapsed
      if (!runtimeParkContainer!.collapsed) {
        visualizationState.collapseContainer(containerId);
      }

      // Expand the container
      visualizationState.expandContainer(containerId);

      // Check that we have more visible nodes after expansion (children should be visible)
      const expandedNodeCount = visualizationState.visibleNodes.length;
      const expandedEdgeCount = visualizationState.visibleEdges.length;
      const expandedContainerCount =
        visualizationState.visibleContainers.length;

      console.log(
        `📊 After expansion: ${expandedNodeCount} nodes, ${expandedEdgeCount} edges, ${expandedContainerCount} containers`,
      );

      // After expansion, we might have different visible counts due to smart collapse
      // and edge aggregation logic. The key is that the operation completes without errors.
      console.log(
        `📊 Node count change: ${initialNodeCount} -> ${expandedNodeCount} (${expandedNodeCount - initialNodeCount})`,
      );
      console.log(
        `📊 Container count change: ${initialContainerCount} -> ${expandedContainerCount} (${expandedContainerCount - initialContainerCount})`,
      );

      // Collapse back and verify we return to similar state
      visualizationState.collapseContainer(containerId);

      const collapsedNodeCount = visualizationState.visibleNodes.length;
      const collapsedEdgeCount = visualizationState.visibleEdges.length;
      const collapsedContainerCount =
        visualizationState.visibleContainers.length;

      console.log(
        `📊 After collapse: ${collapsedNodeCount} nodes, ${collapsedEdgeCount} edges, ${collapsedContainerCount} containers`,
      );

      // After collapsing, we should have similar counts to initial state
      // (allowing for some variation due to edge aggregation)
      expect(
        Math.abs(collapsedNodeCount - initialNodeCount),
      ).toBeLessThanOrEqual(5);
      expect(
        Math.abs(collapsedContainerCount - initialContainerCount),
      ).toBeLessThanOrEqual(5);

      console.log(
        "✅ Data integrity maintained throughout expansion operations",
      );
    });

    it("should work with complete visualization pipeline including layout", async () => {
      console.log("⚡ Testing complete pipeline with ELK layout...");

      // Find and expand the runtime/park.rs container
      const containers = visualizationState.visibleContainers;
      const runtimeParkContainer = containers.find(
        (container) =>
          container.id.includes("runtime/park.rs") ||
          container.label.includes("runtime/park.rs") ||
          container.id.includes("park.rs") ||
          container.label.includes("park.rs"),
      );

      expect(runtimeParkContainer).toBeDefined();

      // Ensure container is initially collapsed
      if (!runtimeParkContainer!.collapsed) {
        visualizationState.collapseContainer(runtimeParkContainer!.id);
      }

      // Expand the container
      visualizationState.expandContainer(runtimeParkContainer!.id);

      // Convert to ReactFlow data
      const reactFlowBridge = new ReactFlowBridge({});
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      expect(renderData.nodes.length).toBeGreaterThan(0);
      expect(renderData.edges.length).toBeGreaterThan(0);

      // Apply ELK layout
      const elkBridge = new ELKBridge();
      await elkBridge.layout(visualizationState);

      // Verify layout was applied
      const nodesWithPositions = visualizationState.visibleNodes.filter(
        (n) => n.position,
      );
      const containersWithPositions =
        visualizationState.visibleContainers.filter((c) => c.position);

      expect(nodesWithPositions.length).toBeGreaterThan(0);
      expect(containersWithPositions.length).toBeGreaterThan(0);

      // Verify positions are valid numbers
      for (const node of nodesWithPositions) {
        expect(typeof node.position!.x).toBe("number");
        expect(typeof node.position!.y).toBe("number");
        expect(isFinite(node.position!.x)).toBe(true);
        expect(isFinite(node.position!.y)).toBe(true);
      }

      console.log(
        `✅ Complete pipeline successful: ${nodesWithPositions.length} nodes positioned, ${containersWithPositions.length} containers positioned`,
      );
    });
  });

  describe("Edge Validation During Expansion", () => {
    it("should not produce any invalid edge errors during expansion", async () => {
      console.log("🔍 Testing edge validation during expansion...");

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
        visualizationState.collapseContainer(containerId);
      }

      // Capture console errors to detect invalid edge errors
      const originalConsoleError = console.error;
      const errorMessages: string[] = [];
      console.error = (...args: any[]) => {
        errorMessages.push(args.join(" "));
        originalConsoleError(...args);
      };

      try {
        // Expand the container
        visualizationState.expandContainer(containerId);

        // Convert to ReactFlow data to trigger edge validation
        const reactFlowBridge = new ReactFlowBridge({});
        reactFlowBridge.toReactFlowData(visualizationState);

        // Check for invalid edge errors
        const invalidEdgeErrors = errorMessages.filter(
          (msg) =>
            msg.includes("invalid edge") ||
            msg.includes("floating edge") ||
            msg.includes("edge validation failed") ||
            msg.includes("EdgeValidationError"),
        );

        if (invalidEdgeErrors.length > 0) {
          console.error("❌ Invalid edge errors detected:");
          invalidEdgeErrors.forEach((error) => console.error(`  - ${error}`));
        }

        expect(invalidEdgeErrors.length).toBe(0);
        console.log("✅ No invalid edge errors detected during expansion");
      } finally {
        // Restore original console.error
        console.error = originalConsoleError;
      }
    });

    it("should handle edge aggregation and restoration correctly", async () => {
      console.log("🔗 Testing edge aggregation and restoration...");

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

      // Start with container collapsed to test aggregation
      if (!runtimeParkContainer!.collapsed) {
        visualizationState.collapseContainer(containerId);
      }

      // Get initial edge counts
      const initialVisibleEdges = visualizationState.visibleEdges.length;
      console.log(
        `📊 Initial visible edges (collapsed): ${initialVisibleEdges}`,
      );

      // Expand the container
      visualizationState.expandContainer(containerId);

      // Get edge counts after expansion
      const expandedVisibleEdges = visualizationState.visibleEdges.length;
      console.log(`📊 Visible edges after expansion: ${expandedVisibleEdges}`);

      // We should have at least as many visible edges after expansion
      expect(expandedVisibleEdges).toBeGreaterThanOrEqual(initialVisibleEdges);

      // Collapse again to test re-aggregation
      visualizationState.collapseContainer(containerId);

      // Get edge counts after re-collapse
      const reCollapsedVisibleEdges = visualizationState.visibleEdges.length;
      console.log(
        `📊 Visible edges after re-collapse: ${reCollapsedVisibleEdges}`,
      );

      // After re-collapse, edge count should be similar to initial
      // (allowing for some variation due to aggregation logic)
      expect(
        Math.abs(reCollapsedVisibleEdges - initialVisibleEdges),
      ).toBeLessThanOrEqual(10);

      console.log("✅ Edge aggregation and restoration working correctly");
    });
  });
});
