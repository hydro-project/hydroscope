/**
 * Paxos-Flipped Nested Container Hierarchy Tests
 *
 * This test suite validates the fix for nested container hierarchy issues
 * that were found in paxos-flipped.json. The fixes involved:
 * 1. VisualizationState: Fix invariant violations in nested container collapse
 * 2. ELKBridge: Add stress algorithm fallback for complex hierarchies
 * 3. Edge validation during runtime/park.rs container expansion
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { HydroscopeData } from "../types/core.js";

describe("Paxos-Flipped Nested Container Hierarchy", () => {
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

  describe("Complete Pipeline Success", () => {
    it("should process paxos-flipped.json through the entire pipeline successfully", async () => {
      console.log("🚀 Starting complete pipeline test for paxos-flipped.json");

      // Step 1: JSON Parsing
      console.log("📝 Step 1: JSON Parsing");
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      expect(parseResult.visualizationState).toBeDefined();
      expect(parseResult.stats.nodeCount).toBeGreaterThan(0);
      expect(parseResult.stats.containerCount).toBeGreaterThan(0);

      console.log(
        `   ✅ Parsed: ${parseResult.stats.nodeCount} nodes, ${parseResult.stats.containerCount} containers`,
      );

      // Step 2: VisualizationState Validation (should not throw invariant violations)
      console.log("🔍 Step 2: VisualizationState Validation");
      const visualizationState = parseResult.visualizationState;

      // This should not throw - the invariant violations are fixed
      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();

      console.log("   ✅ No invariant violations detected");

      // Step 3: ReactFlow Bridge Conversion
      console.log("🎨 Step 3: ReactFlow Bridge Conversion");
      const reactFlowBridge = new ReactFlowBridge({});
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      expect(renderData.nodes).toBeDefined();
      expect(renderData.edges).toBeDefined();
      expect(renderData.nodes.length).toBeGreaterThan(0);

      console.log(
        `   ✅ Converted: ${renderData.nodes.length} nodes, ${renderData.edges.length} edges`,
      );

      // Step 4: ELK Layout (with automatic fallback to stress algorithm)
      console.log("⚡ Step 4: ELK Layout");
      const elkBridge = new ELKBridge();

      // This should succeed with the stress algorithm fallback
      await elkBridge.layout(visualizationState);

      // Verify layout was applied
      const containersWithPositions =
        visualizationState.visibleContainers.filter((c) => c.position);

      console.log(
        `Debug: Total visible containers: ${visualizationState.visibleContainers.length}`,
      );
      console.log(
        `Debug: Containers with positions: ${containersWithPositions.length}`,
      );

      // The layout should position containers (nodes might be hidden in collapsed containers)
      expect(containersWithPositions.length).toBeGreaterThan(0);

      console.log(
        `   ✅ Layout applied: ${containersWithPositions.length} containers positioned`,
      );

      // Step 5: Final Validation
      console.log("🔍 Step 5: Final Validation");

      // All visible containers should have positions
      expect(containersWithPositions.length).toBe(
        visualizationState.visibleContainers.length,
      );

      // Positions should be valid numbers
      for (const container of containersWithPositions) {
        expect(typeof container.position!.x).toBe("number");
        expect(typeof container.position!.y).toBe("number");
        expect(isFinite(container.position!.x)).toBe(true);
        expect(isFinite(container.position!.y)).toBe(true);
      }

      console.log("   ✅ All positions are valid");

      console.log("🎉 Complete pipeline test PASSED!");
    }, 30000);

    it("should demonstrate the fix prevents the original errors", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Verify no invariant violations (Fix #1)
      let invariantError: Error | null = null;
      try {
        visualizationState.validateInvariants();
      } catch (error) {
        invariantError = error as Error;
      }

      expect(invariantError).toBeNull();
      console.log("✅ Fix #1 verified: No invariant violations");

      // Verify ELK layout succeeds (Fix #2)
      const elkBridge = new ELKBridge();
      let layoutError: Error | null = null;

      try {
        await elkBridge.layout(visualizationState);
      } catch (error) {
        layoutError = error as Error;
      }

      expect(layoutError).toBeNull();
      console.log("✅ Fix #2 verified: ELK layout succeeds");
    });

    it("should handle the complex container structure correctly", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const visualizationState = parseResult.visualizationState;

      // Should have containers
      expect(visualizationState.visibleContainers.length).toBeGreaterThan(0);

      // Check for nested containers by parent references
      const nestedContainers = visualizationState.visibleContainers.filter(
        (c) => c.parentContainer,
      );

      console.log(
        `Found ${nestedContainers.length} nested containers out of ${visualizationState.visibleContainers.length} total`,
      );

      // Check that all containers have valid parent references
      for (const container of visualizationState.visibleContainers) {
        if (container.parentContainer) {
          const parent = visualizationState.visibleContainers.find(
            (c) => c.id === container.parentContainer,
          );
          expect(parent).toBeDefined();
          console.log(
            `Container ${container.id} has valid parent ${container.parentContainer}`,
          );
        }
      }

      console.log("✅ All parent references are valid");
    });
  });

  describe("Performance and Robustness", () => {
    it("should handle paxos-flipped.json within reasonable time limits", async () => {
      const startTime = Date.now();

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      const reactFlowBridge = new ReactFlowBridge({});
      reactFlowBridge.toReactFlowData(visualizationState);

      const elkBridge = new ELKBridge();
      await elkBridge.layout(visualizationState);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`Total processing time: ${processingTime}ms`);

      // Should complete in under 10 seconds
      expect(processingTime).toBeLessThan(10000);
    }, 15000);

    it("should be deterministic - multiple runs should produce consistent results", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });

      // Run 1
      const result1 = await parser.parseData(paxosFlippedData);
      const state1 = result1.visualizationState;

      // Run 2
      const result2 = await parser.parseData(paxosFlippedData);
      const state2 = result2.visualizationState;

      // Should produce the same structure
      expect(state1.visibleNodes.length).toBe(state2.visibleNodes.length);
      expect(state1.visibleEdges.length).toBe(state2.visibleEdges.length);
      expect(state1.visibleContainers.length).toBe(
        state2.visibleContainers.length,
      );
    });
  });

  describe("Runtime/Park.rs Container Expansion", () => {
    let coordinator: AsyncCoordinator;
    let visualizationState: VisualizationState;
    let elkBridge: ELKBridge;
    let reactFlowBridge: ReactFlowBridge;

    beforeEach(async () => {
      coordinator = new AsyncCoordinator();
      elkBridge = new ELKBridge();
      reactFlowBridge = new ReactFlowBridge({});
      coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;
    });

    it("should find runtime/park.rs container in paxos-flipped.json", () => {
      const runtimeParkContainer = visualizationState.visibleContainers.find(
        (c) => c.label === "runtime/park.rs",
      );

      expect(runtimeParkContainer).toBeDefined();
      console.log(
        `Found runtime/park.rs container: ${runtimeParkContainer!.id}, collapsed: ${runtimeParkContainer!.collapsed}`,
      );
    });

    it("should expand runtime/park.rs container without invalid edge errors", async () => {
      const runtimeParkContainer = visualizationState.visibleContainers.find(
        (c) => c.label === "runtime/park.rs",
      );

      expect(runtimeParkContainer).toBeDefined();

      // Expand the container if it's collapsed
      if (runtimeParkContainer!.collapsed) {
        await coordinator.expandContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );
      }

      // Should not have collapsed state anymore
      const expandedContainer = visualizationState.visibleContainers.find(
        (c) => c.id === runtimeParkContainer!.id,
      );
      expect(expandedContainer!.collapsed).toBe(false);

      // Validate edges are still valid
      for (const edge of visualizationState.visibleEdges) {
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });

    it("should handle multiple expansion/collapse cycles with paxos-flipped data", async () => {
      const runtimeParkContainer = visualizationState.visibleContainers.find(
        (c) => c.label === "runtime/park.rs",
      );

      expect(runtimeParkContainer).toBeDefined();

      // Ensure it starts collapsed
      if (!runtimeParkContainer!.collapsed) {
        await coordinator.collapseContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );
      }

      // Perform multiple cycles
      for (let i = 0; i < 3; i++) {
        // Expand
        await coordinator.expandContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );

        // Validate edges after expansion
        for (const edge of visualizationState.visibleEdges) {
          expect(edge.source).toBeDefined();
          expect(edge.target).toBeDefined();
        }

        // Collapse
        await coordinator.collapseContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );

        // Validate edges after collapse
        for (const edge of visualizationState.visibleEdges) {
          expect(edge.source).toBeDefined();
          expect(edge.target).toBeDefined();
        }
      }

      console.log("✅ Completed 3 expand/collapse cycles without errors");
    });

    it("should render expanded runtime/park.rs container through ReactFlow bridge", async () => {
      const runtimeParkContainer = visualizationState.visibleContainers.find(
        (c) => c.label === "runtime/park.rs",
      );

      // Expand the container if it's collapsed
      if (runtimeParkContainer!.collapsed) {
        await coordinator.expandContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );
      }

      // Convert to ReactFlow data
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      expect(renderData.nodes).toBeDefined();
      expect(renderData.edges).toBeDefined();
      expect(renderData.nodes.length).toBeGreaterThan(0);

      console.log(
        `Rendered: ${renderData.nodes.length} nodes, ${renderData.edges.length} edges`,
      );
    });

    it("should maintain data integrity throughout expansion operations", async () => {
      const runtimeParkContainer = visualizationState.visibleContainers.find(
        (c) => c.label === "runtime/park.rs",
      );

      // Ensure it starts collapsed
      if (!runtimeParkContainer!.collapsed) {
        await coordinator.collapseContainer(
          runtimeParkContainer!.id,
          visualizationState,
          { fitView: false },
          coordinator,
          { fitView: false },
        );
      }

      const initialNodeCount = visualizationState.visibleNodes.length;
      const initialEdgeCount = visualizationState.visibleEdges.length;

      // Expand
      await coordinator.expandContainer(
        runtimeParkContainer!.id,
        visualizationState,
        { fitView: false },
        coordinator,
        { fitView: false },
      );

      const expandedNodeCount = visualizationState.visibleNodes.length;

      // Collapse back
      await coordinator.collapseContainer(
        runtimeParkContainer!.id,
        visualizationState,
        { fitView: false },
        coordinator,
        { fitView: false },
      );

      // Should return to initial counts
      expect(visualizationState.visibleNodes.length).toBe(initialNodeCount);
      expect(visualizationState.visibleEdges.length).toBe(initialEdgeCount);

      console.log(
        `Data integrity maintained: initial ${initialNodeCount} nodes, expanded ${expandedNodeCount} nodes, collapsed back to ${initialNodeCount} nodes`,
      );
    });
  });

  describe("ELK Layout with Nested Containers", () => {
    it("should handle initial layout without ELK errors", async () => {
      // Parse the data first
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const visualizationState = parseResult.visualizationState;

      // Get initial render data
      const reactFlowBridge = new ReactFlowBridge({});
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);

      const containerNodes = renderData.nodes.filter(
        (n) => n.data?.nodeType === "container",
      );
      const regularNodes = renderData.nodes.filter(
        (n) => n.data?.nodeType !== "container",
      );

      console.log(`Container nodes: ${containerNodes.length}`);
      console.log(`Regular nodes: ${regularNodes.length}`);

      // Attempt layout - should succeed with fallback
      const elkBridge = new ELKBridge();
      let layoutError: Error | null = null;

      try {
        await elkBridge.layout(visualizationState);
      } catch (error) {
        layoutError = error as Error;
      }

      expect(layoutError).toBeNull();
      console.log("✅ ELK layout succeeded (possibly with stress fallback)");
    }, 30000);

    it("should identify problematic container hierarchy structure", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const visualizationState = parseResult.visualizationState;

      // Analyze container hierarchy
      const rootContainers = visualizationState.visibleContainers.filter(
        (c) => !c.parentContainer,
      );
      const nestedContainers = visualizationState.visibleContainers.filter(
        (c) => c.parentContainer,
      );

      console.log(`Root containers: ${rootContainers.length}`);
      console.log(`Nested containers: ${nestedContainers.length}`);

      // Build hierarchy depth map
      const depthMap = new Map<string, number>();
      const calculateDepth = (containerId: string): number => {
        if (depthMap.has(containerId)) {
          return depthMap.get(containerId)!;
        }

        const container = visualizationState.visibleContainers.find(
          (c) => c.id === containerId,
        );
        if (!container || !container.parentContainer) {
          depthMap.set(containerId, 0);
          return 0;
        }

        const depth = 1 + calculateDepth(container.parentContainer);
        depthMap.set(containerId, depth);
        return depth;
      };

      for (const container of visualizationState.visibleContainers) {
        calculateDepth(container.id);
      }

      const maxDepth =
        depthMap.size > 0 ? Math.max(...Array.from(depthMap.values())) : 0;
      console.log(`Maximum nesting depth: ${maxDepth}`);

      // Should have some depth if there are nested containers
      if (nestedContainers.length > 0) {
        expect(maxDepth).toBeGreaterThan(0);
      }
    });
  });
});
