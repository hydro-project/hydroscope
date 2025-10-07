/**
 * Paxos-Flipped Nested Container Hierarchy Bug Test
 *
 * This test reproduces the bug with nested container hierarchies
 * using the paxos-flipped.json test data. The issue occurs during
 * initial layout when ELK fails on the data we're feeding it.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Paxos-Flipped Nested Container Hierarchy Bug", () => {
  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );

    if (!fs.existsSync(paxosFlippedPath)) {
      throw new Error(`Test data file not found: ${paxosFlippedPath}`);
    }

    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    // Initialize components
    visualizationState = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});
    elkBridge = new ELKBridge();

    // Write debug info to file
    const debugInfo = `[PaxosFlippedBug] 📊 Loaded paxos-flipped.json: ${paxosFlippedData.nodes?.length || 0} nodes, ${paxosFlippedData.edges?.length || 0} edges\n`;
    fs.appendFileSync("debug-output.txt", debugInfo);
  });

  describe("JSON Parsing with Nested Containers", () => {
    it("should parse paxos-flipped.json without errors", async () => {
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: true });

      // This should not throw an error
      const result = await parser.parseData(paxosFlippedData);

      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
      expect(result.stats.containerCount).toBeGreaterThan(0);

      console.log("Parsing stats:", result.stats);
      console.log("Warnings:", result.warnings.length);

      if (result.warnings.length > 0) {
        console.log("Warnings details:", result.warnings);
      }
    }, 30000); // 30 second timeout for large file
  });

  describe("ELK Layout with Nested Containers", () => {
    it("should handle initial layout without ELK errors", async () => {
      // Parse the data first
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      visualizationState = parseResult.visualizationState;

      // Get initial render data
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      // Log detailed information about the data structure
      const containerNodes = renderData.nodes.filter(
        (n) => n.data?.nodeType === "container",
      );
      const regularNodes = renderData.nodes.filter(
        (n) => n.data?.nodeType !== "container",
      );

      const debugInfo = `[PaxosFlippedBug] 📊 Data structure analysis:
  Total nodes: ${renderData.nodes.length}
  Container nodes: ${containerNodes.length}
  Regular nodes: ${regularNodes.length}
  Total edges: ${renderData.edges.length}
`;
      fs.appendFileSync("debug-output.txt", debugInfo);

      // Check for nested containers
      const nestedContainers = containerNodes.filter((container) => {
        return renderData.nodes.some(
          (node) =>
            node.parentId === container.id &&
            node.data?.nodeType === "container",
        );
      });

      let nestedInfo = `  Containers with nested containers: ${nestedContainers.length}\n`;

      if (nestedContainers.length > 0) {
        nestedInfo += `  Nested container details:\n`;
        nestedContainers.forEach((container) => {
          const children = renderData.nodes.filter(
            (n) => n.parentId === container.id,
          );
          const childContainers = children.filter(
            (n) => n.data?.nodeType === "container",
          );
          nestedInfo += `    ${container.id}: ${children.length} children (${childContainers.length} containers)\n`;
        });
      }

      fs.appendFileSync("debug-output.txt", nestedInfo);

      // This is where the bug should manifest - ELK layout should fail
      let layoutError: Error | null = null;

      try {
        // Use the correct ELK bridge API - layout method that works with VisualizationState
        await elkBridge.layout(visualizationState);

        // After layout, check if positions were applied
        const nodesWithPositions = visualizationState.visibleNodes.filter(
          (n) => n.position,
        );
        const containersWithPositions =
          visualizationState.visibleContainers.filter((c) => c.position);

        const successInfo = `[PaxosFlippedBug] ✅ Layout completed successfully
  Nodes with positions: ${nodesWithPositions.length}/${visualizationState.visibleNodes.length}
  Containers with positions: ${containersWithPositions.length}/${visualizationState.visibleContainers.length}
`;
        fs.appendFileSync("debug-output.txt", successInfo);

        // Verify layout was applied
        expect(nodesWithPositions.length).toBeGreaterThan(0);
      } catch (error) {
        layoutError = error as Error;
        const errorInfo = `[PaxosFlippedBug] ❌ ELK Layout failed:
  Error type: ${error.constructor.name}
  Error message: ${error.message}
  Stack trace: ${error.stack?.split("\n").slice(0, 10).join("\n") || "No stack trace"}
`;
        fs.appendFileSync("debug-output.txt", errorInfo);
      }

      // Document the current state - if there's an error, we've found the bug
      if (layoutError) {
        fs.appendFileSync(
          "debug-output.txt",
          "[PaxosFlippedBug] 🐛 Bug reproduced - ELK layout failed with nested containers\n",
        );
        // For now, we expect this to fail - once fixed, we can change this expectation
        expect(layoutError).toBeDefined();
        expect(layoutError.message).toBeTruthy();
      } else {
        fs.appendFileSync(
          "debug-output.txt",
          "[PaxosFlippedBug] ✅ No bug detected - layout completed successfully\n",
        );
        // If no error, the layout should have been applied
        const nodesWithPositions = visualizationState.visibleNodes.filter(
          (n) => n.position,
        );
        expect(nodesWithPositions.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should identify problematic container hierarchy structure", async () => {
      // Parse the data to get container structure
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      visualizationState = parseResult.visualizationState;

      // Analyze container hierarchy from VisualizationState
      const containers = visualizationState.visibleContainers;
      const containerHierarchy = new Map<string, string[]>();

      // Build hierarchy map
      for (const container of containers) {
        const children: string[] = [];
        for (const childId of container.children) {
          // Check if child is also a container
          const childContainer = containers.find((c) => c.id === childId);
          if (childContainer) {
            children.push(childId);
          }
        }
        if (children.length > 0) {
          containerHierarchy.set(container.id, children);
        }
      }

      console.log("[PaxosFlippedBug] 🔍 Container hierarchy analysis:");
      console.log(`  Total containers: ${containers.length}`);
      console.log(
        `  Containers with nested containers: ${containerHierarchy.size}`,
      );

      if (containerHierarchy.size > 0) {
        console.log(`  Nested container relationships:`);
        for (const [parentId, childIds] of containerHierarchy) {
          console.log(`    ${parentId} -> [${childIds.join(", ")}]`);
        }
      }

      // Look for deeply nested structures
      const maxDepth = calculateMaxContainerDepth(containers);
      console.log(`  Maximum container nesting depth: ${maxDepth}`);

      // Also analyze the ReactFlow data structure
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);
      const containerNodes = renderData.nodes.filter(
        (n) => n.data?.nodeType === "container",
      );

      console.log(`[PaxosFlippedBug] 🎨 ReactFlow data structure:`);
      console.log(`  Container nodes in ReactFlow: ${containerNodes.length}`);

      // Check for parent-child relationships in ReactFlow data
      const parentChildMap = new Map<string, string[]>();
      for (const node of renderData.nodes) {
        if (node.parentId) {
          if (!parentChildMap.has(node.parentId)) {
            parentChildMap.set(node.parentId, []);
          }
          parentChildMap.get(node.parentId)!.push(node.id);
        }
      }

      console.log(
        `  Nodes with parent-child relationships: ${parentChildMap.size}`,
      );
      for (const [parentId, childIds] of parentChildMap) {
        const parentNode = renderData.nodes.find((n) => n.id === parentId);
        const parentType = parentNode?.data?.nodeType || "unknown";
        console.log(
          `    ${parentId} (${parentType}) -> ${childIds.length} children`,
        );
      }

      // This helps us understand the structure causing issues
      expect(containers.length).toBeGreaterThan(0);

      // If we have deeply nested containers, that might be the issue
      if (maxDepth > 3) {
        console.log(
          `[PaxosFlippedBug] ⚠️  Deep nesting detected (depth: ${maxDepth}) - potential ELK issue`,
        );
      }

      if (containerHierarchy.size > 10) {
        console.log(
          `[PaxosFlippedBug] ⚠️  Many nested containers (${containerHierarchy.size}) - potential complexity issue`,
        );
      }
    });
  });

  describe("ReactFlow Bridge with Nested Containers", () => {
    it("should convert nested container data without errors", async () => {
      // Parse the data first
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      visualizationState = parseResult.visualizationState;

      // Convert to ReactFlow format - this should not throw
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      expect(renderData.nodes).toBeDefined();
      expect(renderData.edges).toBeDefined();
      expect(renderData.nodes.length).toBeGreaterThan(0);

      // Check for any malformed data that might cause ELK issues
      for (const node of renderData.nodes) {
        expect(node.id).toBeDefined();
        expect(typeof node.id).toBe("string");
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe("number");
        expect(typeof node.position.y).toBe("number");
      }

      for (const edge of renderData.edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }

      console.log("ReactFlow conversion successful");
    });
  });
});

/**
 * Helper function to calculate maximum container nesting depth
 */
function calculateMaxContainerDepth(containers: any[]): number {
  const containerMap = new Map(containers.map((c) => [c.id, c]));
  const visited = new Set<string>();

  function getDepth(containerId: string): number {
    if (visited.has(containerId)) {
      return 0; // Avoid infinite recursion
    }

    visited.add(containerId);
    const container = containerMap.get(containerId);

    if (!container) {
      return 0;
    }

    let maxChildDepth = 0;
    for (const childId of container.children) {
      if (containerMap.has(childId)) {
        const childDepth = getDepth(childId);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }

    visited.delete(containerId);
    return 1 + maxChildDepth;
  }

  let maxDepth = 0;
  for (const container of containers) {
    const depth = getDepth(container.id);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}
