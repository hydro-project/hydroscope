/**
 * @fileoverview E2E test for floating edges issue
 *
 * This test reproduces the floating edges problem where edges don't connect
 * properly to collapsed containers, and validates the fix.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge";
import { ELKBridge } from "../bridges/ELKBridge";
import { JSONParser } from "../utils/JSONParser";
import type { HydroscopeData } from "../types/core";
import fs from "fs";
import path from "path";

describe("Floating Edges E2E Test", () => {
  let testData: HydroscopeData;
  let visualizationState: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;

  beforeEach(async () => {
    // Load real paxos.json test data
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    testData = JSON.parse(paxosContent) as HydroscopeData;

    // Initialize components
    const parser = JSONParser.createPaxosParser({ debug: true });
    const parseResult = await parser.parseData(testData);
    visualizationState = parseResult.visualizationState;

    reactFlowBridge = new ReactFlowBridge({
      nodeStyles: {},
      edgeStyles: {},
      semanticMappings: {},
      propertyMappings: {},
    });

    elkBridge = new ELKBridge({});
  });

  test("should reproduce floating edges issue", async () => {
    console.log("\n🧪 [E2E Test] Starting floating edges reproduction test");

    // Step 1: Verify initial state
    console.log("📊 Initial state:");
    console.log(`  - Visible nodes: ${visualizationState.visibleNodes.length}`);
    console.log(
      `  - Visible containers: ${visualizationState.visibleContainers.length}`
    );
    console.log(`  - Visible edges: ${visualizationState.visibleEdges.length}`);

    expect(visualizationState.visibleNodes.length).toBeGreaterThan(0);
    expect(visualizationState.visibleContainers.length).toBeGreaterThan(0);
    expect(visualizationState.visibleEdges.length).toBeGreaterThan(0);

    // Step 2: Collapse containers to trigger the issue
    console.log("\n🔄 Collapsing containers...");
    const containers = Array.from(visualizationState.visibleContainers);
    for (const container of containers) {
      if (!container.collapsed) {
        console.log(`  - Collapsing container: ${container.id}`);
        visualizationState.collapseContainer(container.id);
      }
    }

    // Verify containers are collapsed
    const collapsedContainers = Array.from(
      visualizationState.visibleContainers
    ).filter((c) => c.collapsed);
    console.log(`📦 Collapsed containers: ${collapsedContainers.length}`);
    expect(collapsedContainers.length).toBeGreaterThan(0);

    // Step 3: Run ELK layout
    console.log("\n🎯 Running ELK layout...");
    await elkBridge.layout(visualizationState);

    // Step 4: Convert to ReactFlow format
    console.log("\n🔄 Converting to ReactFlow format...");
    const reactFlowData = reactFlowBridge.toReactFlowData(visualizationState);

    console.log("📊 ReactFlow data:");
    console.log(`  - Nodes: ${reactFlowData.nodes.length}`);
    console.log(`  - Edges: ${reactFlowData.edges.length}`);

    // Step 5: Validate edge connections
    console.log("\n🔍 Validating edge connections...");

    const nodeIds = new Set(reactFlowData.nodes.map((n) => n.id));
    const floatingEdges: string[] = [];
    const edgesWithHandles: string[] = [];
    const edgesWithoutHandles: string[] = [];

    for (const edge of reactFlowData.edges) {
      console.log(`🔗 Edge ${edge.id}: ${edge.source} -> ${edge.target}`);
      console.log(`   - Source exists: ${nodeIds.has(edge.source)}`);
      console.log(`   - Target exists: ${nodeIds.has(edge.target)}`);
      console.log(`   - Source handle: ${edge.sourceHandle || "NONE"}`);
      console.log(`   - Target handle: ${edge.targetHandle || "NONE"}`);

      // Check for floating edges (missing endpoints)
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        floatingEdges.push(edge.id);
      }

      // Check for handle assignment
      if (edge.sourceHandle && edge.targetHandle) {
        edgesWithHandles.push(edge.id);
      } else {
        edgesWithoutHandles.push(edge.id);
      }
    }

    // Step 6: Report results
    console.log("\n📋 Test Results:");
    console.log(
      `  - Floating edges (missing endpoints): ${floatingEdges.length}`
    );
    console.log(`  - Edges with handles: ${edgesWithHandles.length}`);
    console.log(`  - Edges without handles: ${edgesWithoutHandles.length}`);

    if (floatingEdges.length > 0) {
      console.log(`❌ FLOATING EDGES DETECTED: ${floatingEdges.join(", ")}`);
    }

    if (edgesWithoutHandles.length > 0) {
      console.log(
        `⚠️  EDGES WITHOUT HANDLES: ${edgesWithoutHandles.join(", ")}`
      );
    }

    // Step 7: Validate node structure
    console.log("\n🔍 Validating node structure...");
    const containerNodes = reactFlowData.nodes.filter(
      (n) => n.type === "container" || n.data.collapsed
    );
    const standardNodes = reactFlowData.nodes.filter(
      (n) => n.type === "standard" || n.type === "node"
    );

    console.log(`📦 Container nodes: ${containerNodes.length}`);
    console.log(`🔵 Standard nodes: ${standardNodes.length}`);

    for (const node of containerNodes) {
      console.log(`📦 Container ${node.id}:`);
      console.log(`   - Type: ${node.type}`);
      console.log(`   - Collapsed: ${node.data.collapsed}`);
      console.log(`   - Position: (${node.position.x}, ${node.position.y})`);
      console.log(
        `   - Dimensions: ${node.style?.width}x${node.style?.height}`
      );
    }

    // Assertions for the test
    expect(reactFlowData.nodes.length).toBeGreaterThan(0);
    expect(reactFlowData.edges.length).toBeGreaterThan(0);

    // The main assertion: no floating edges should exist
    if (floatingEdges.length > 0) {
      console.error(`❌ FLOATING EDGES DETECTED: ${floatingEdges.join(", ")}`);
      console.error(
        "This indicates edges are trying to connect to non-existent nodes"
      );
    }
    expect(floatingEdges).toHaveLength(0);

    // All edges should have proper handle assignments when using discrete strategy
    if (edgesWithoutHandles.length > 0) {
      console.error(
        `❌ EDGES WITHOUT HANDLES: ${edgesWithoutHandles.join(", ")}`
      );
      console.error("This indicates smart handle selection is not working");
    }
    expect(edgesWithoutHandles).toHaveLength(0);

    console.log("\n✅ E2E Test completed successfully!");

    // The main assertion: no floating edges should exist
    expect(floatingEdges).toHaveLength(0);
  });

  test("should validate handle configuration", async () => {
    console.log("\n🧪 [E2E Test] Validating handle configuration");

    // Import and check handle configuration
    const { getHandleConfig, CURRENT_HANDLE_STRATEGY } = await import(
      "../render/handleConfig"
    );

    console.log(`🎯 Current handle strategy: ${CURRENT_HANDLE_STRATEGY}`);

    const config = getHandleConfig();
    console.log("🔧 Handle configuration:");
    console.log(
      `  - Enable continuous handles: ${config.enableContinuousHandles}`
    );
    console.log(`  - Source handles: ${config.sourceHandles.length}`);
    console.log(`  - Target handles: ${config.targetHandles.length}`);

    if (CURRENT_HANDLE_STRATEGY === "discrete") {
      expect(config.sourceHandles.length).toBeGreaterThan(0);
      expect(config.targetHandles.length).toBeGreaterThan(0);
      expect(config.enableContinuousHandles).toBe(false);

      // Validate handle IDs
      const sourceHandleIds = config.sourceHandles.map((h) => h.id);
      const targetHandleIds = config.targetHandles.map((h) => h.id);

      console.log(`  - Source handle IDs: ${sourceHandleIds.join(", ")}`);
      console.log(`  - Target handle IDs: ${targetHandleIds.join(", ")}`);

      expect(sourceHandleIds).toContain("out-top");
      expect(sourceHandleIds).toContain("out-right");
      expect(sourceHandleIds).toContain("out-bottom");
      expect(sourceHandleIds).toContain("out-left");

      expect(targetHandleIds).toContain("in-top");
      expect(targetHandleIds).toContain("in-right");
      expect(targetHandleIds).toContain("in-bottom");
      expect(targetHandleIds).toContain("in-left");
    }

    console.log("✅ Handle configuration validation passed!");
  });

  test("should validate ReactFlowBridge smart handle selection", async () => {
    console.log(
      "\n🧪 [E2E Test] Testing ReactFlowBridge smart handle selection"
    );

    // Test the bridge's smart handle selection with real paxos data
    const reactFlowData = reactFlowBridge.toReactFlowData(visualizationState);

    console.log(
      `📊 ReactFlow data: ${reactFlowData.nodes.length} nodes, ${reactFlowData.edges.length} edges`
    );

    // Check if any edges have handles assigned
    const edgesWithHandles = reactFlowData.edges.filter(
      (e) => e.sourceHandle && e.targetHandle
    );
    const edgesWithoutHandles = reactFlowData.edges.filter(
      (e) => !e.sourceHandle || !e.targetHandle
    );

    console.log(`🔗 Edges with handles: ${edgesWithHandles.length}`);
    console.log(`⚠️  Edges without handles: ${edgesWithoutHandles.length}`);

    // Log a few examples
    if (edgesWithHandles.length > 0) {
      console.log("✅ Example edges with handles:");
      edgesWithHandles.slice(0, 3).forEach((edge) => {
        console.log(
          `   - ${edge.id}: ${edge.source}[${edge.sourceHandle}] -> ${edge.target}[${edge.targetHandle}]`
        );
      });
    }

    if (edgesWithoutHandles.length > 0) {
      console.log("❌ Example edges without handles:");
      edgesWithoutHandles.slice(0, 3).forEach((edge) => {
        console.log(
          `   - ${edge.id}: ${edge.source}[${edge.sourceHandle || "NONE"}] -> ${edge.target}[${edge.targetHandle || "NONE"}]`
        );
      });
    }

    // The key test: if we're using discrete handles, all edges should have handles
    const { CURRENT_HANDLE_STRATEGY } = await import("../render/handleConfig");
    if (CURRENT_HANDLE_STRATEGY === "discrete") {
      expect(edgesWithoutHandles.length).toBe(0);
    }

    console.log("✅ Smart handle selection test completed!");
  });
});
