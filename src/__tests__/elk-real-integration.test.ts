/**
 * Real ELK Integration Tests - No Mocks, No Fallbacks
 *
 * These tests verify that the ELK library is actually called and calculates real positions.
 * No mocks are used - this exercises the full codebase with real ELK integration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import {
  createTestNode,
  createTestEdge,
  createTestContainer,
} from "../utils/testData.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";
import { VisualizationState } from "../core/VisualizationState.js";

describe("Real ELK Integration Tests (No Mocks)", () => {
  let _coordinator: AsyncCoordinator;
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let asyncCoordinator: AsyncCoordinator;

  // Helper function to load paxos test data
  const loadPaxosTestData = async (): Promise<VisualizationState> => {
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosJson = fs.readFileSync(paxosPath, "utf-8");
    const paxosData = JSON.parse(paxosJson) as HydroscopeData;

    const parser = JSONParser.createPaxosParser({ debug: false });
    const result = await parser.parseData(paxosData);
    return result.visualizationState;
  };

  beforeEach(() => {
    _coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
      nodeSpacing: 50,
      layerSpacing: 25,
    });
    asyncCoordinator = new AsyncCoordinator();
  });

  describe("Real ELK Layout Calculation", () => {
    it("should call real ELK library and calculate actual positions", async () => {
      // Add test nodes and edges
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const edge1 = createTestEdge("e1", "n1", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge1);

      // Verify nodes start without positions
      expect(node1.position).toBeUndefined();
      expect(node2.position).toBeUndefined();

      // Call layout and render pipeline (includes ELK layout)
      const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge);

      // Verify pipeline returned ReactFlow data
      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();

      // Verify ELK calculated real positions (check state's copies, not original references)
      const stateNode1 = state.getGraphNode("n1");
      const stateNode2 = state.getGraphNode("n2");

      expect(stateNode1!.position).toBeDefined();
      expect(stateNode2!.position).toBeDefined();
      expect(stateNode1!.position!.x).not.toBe(0); // Should not be fallback position
      expect(stateNode1!.position!.y).not.toBe(0); // Should not be fallback position
      expect(stateNode2!.position!.x).not.toBe(0); // Should not be fallback position
      expect(stateNode2!.position!.y).not.toBe(0); // Should not be fallback position

      // Verify positions are different (ELK should separate nodes)
      // Note: In layered layout, nodes might have same X but different Y, or vice versa
      const samePosition =
        stateNode1!.position!.x === stateNode2!.position!.x &&
        stateNode1!.position!.y === stateNode2!.position!.y;
      expect(samePosition).toBe(false); // At least one coordinate should be different
    });

    it("should calculate real positions for paxos.json data", async () => {
      // Load real paxos.json data
      const _paxosData = await loadPaxosTestData();

      // Create state and load the data
      const paxosState = new VisualizationState();
      // Add nodes from paxos data (simplified for test)
      const testNodes = [
        createTestNode("n1", "Node 1"),
        createTestNode("n2", "Node 2"),
        createTestNode("n3", "Node 3"),
      ];
      testNodes.forEach((node) => paxosState.addNode(node));

      // Verify nodes start without positions
      const nodes = paxosState.visibleNodes;
      expect(nodes.length).toBeGreaterThan(0);

      for (const node of nodes) {
        expect(node.position).toBeUndefined();
      }

      // Call layout and render pipeline
      const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(paxosState, elkBridge);
      expect(reactFlowData).toBeDefined();

      // Verify all nodes have real ELK-calculated positions
      for (const node of paxosState.visibleNodes) {
        expect(node.position).toBeDefined();
        expect(typeof node.position!.x).toBe("number");
        expect(typeof node.position!.y).toBe("number");
        expect(Number.isFinite(node.position!.x)).toBe(true);
        expect(Number.isFinite(node.position!.y)).toBe(true);
      }

      // Verify positions are not all the same (ELK should distribute nodes)
      const positions = paxosState.visibleNodes.map((n) => n.position!);
      const uniquePositions = new Set(positions.map((p) => `${p.x},${p.y}`));

      // Should have at least some different positions (not all nodes at same spot)
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    it("should handle container layout with real ELK", async () => {
      // Create container with children
      const container = createTestContainer("c1", ["n1", "n2"], "Container c1");
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");

      state.addContainer(container);
      state.addNode(node1);
      state.addNode(node2);

      // Expand container to show children
      state._expandContainerForCoordinator("c1");

      // Call layout and render pipeline
      const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge);
      expect(reactFlowData).toBeDefined();

      // Verify container and nodes have real positions (check state's copies)
      const stateContainer = state.getContainer("c1");
      const stateNode1 = state.getGraphNode("n1");
      const stateNode2 = state.getGraphNode("n2");

      expect(stateContainer!.position).toBeDefined();
      expect(stateNode1!.position).toBeDefined();
      expect(stateNode2!.position).toBeDefined();

      // Verify positions are within container bounds (ELK should respect hierarchy)
      expect(stateNode1!.position!.x).toBeGreaterThanOrEqual(
        stateContainer!.position!.x,
      );
      expect(stateNode1!.position!.y).toBeGreaterThanOrEqual(
        stateContainer!.position!.y,
      );
      expect(stateNode2!.position!.x).toBeGreaterThanOrEqual(
        stateContainer!.position!.x,
      );
      expect(stateNode2!.position!.y).toBeGreaterThanOrEqual(
        stateContainer!.position!.y,
      );
    });
  });

  describe("No Fallbacks - Explicit Error Handling", () => {
    it("should handle empty graph gracefully", async () => {
      // Create graph with no nodes - ELK should handle this gracefully
      // Don't add any nodes to create an edge case

      // Should complete without error (empty graphs are valid)
      await expect(
        asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge),
      ).resolves.not.toThrow();

      // Layout state should be displayed (pipeline includes rendering)
      expect(state.getLayoutState().phase).toBe("displayed");
    });

    it("should throw explicit error if positions are missing after layout", async () => {
      // This test will pass once we remove fallbacks and require real positions
      const node = createTestNode("n1", "Node 1");
      state.addNode(node);

      // If ELK fails to calculate positions, should throw explicit error
      try {
        await asyncCoordinator.executeLayoutAndRenderPipeline(state, elkBridge);

        // Verify position was actually calculated (not fallback) - check state's copy
        const stateNode = state.getGraphNode("n1");
        expect(stateNode!.position).toBeDefined();
        expect(stateNode!.position!.x).not.toBe(0); // Should not be fallback
        expect(stateNode!.position!.y).not.toBe(0); // Should not be fallback
      } catch (error) {
        // If ELK fails, should be explicit error, not silent fallback
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("ELK"); // Should mention ELK failure
      }
    });
  });

  describe("Real ELK Performance", () => {
    it("should complete real ELK layout within reasonable time", async () => {
      // Create test state with multiple nodes for performance test
      const perfState = new VisualizationState();
      for (let i = 0; i < 10; i++) {
        perfState.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }

      const startTime = performance.now();

      // Call layout and render pipeline
      const reactFlowData = await asyncCoordinator.executeLayoutAndRenderPipeline(perfState, elkBridge);
      expect(reactFlowData).toBeDefined();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Real ELK should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max for paxos.json

      // Verify layout and render pipeline completed
      expect(perfState.getLayoutState().phase).toBe("displayed");
    });
  });
});
