/**
 * Integration Tests: VisualizationState + ELKBridge
 *
 * Tests the complete layout pipeline with paxos.json data
 * Verifies container expand/collapse affects ELK layout correctly
 * Tests layout configuration changes and their effects
 * Validates layout error handling and recovery
 *
 * Requirements: 7.2, 8.3
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import {
  loadPaxosTestData,
  createTestNode,
  createTestEdge,
  createTestContainer,
} from "../utils/testData.js";
import type { LayoutConfig, ELKNode } from "../types/core.js";

describe("VisualizationState + ELKBridge Integration", () => {
  let state: VisualizationState;
  let bridge: ELKBridge;
  let defaultConfig: LayoutConfig;

  beforeEach(() => {
    state = new VisualizationState();
    defaultConfig = {
      algorithm: "mrtree",
      direction: "DOWN",
      spacing: 50,
      nodeSpacing: 20,
      layerSpacing: 25,
    };
    bridge = new ELKBridge(defaultConfig);
  });

  describe("Complete Layout Pipeline with Paxos.json", () => {
    it("should process complete paxos.json layout pipeline successfully", () => {
      // Load paxos.json test data
      const paxosData = loadPaxosTestData();

      // Add all data to state
      for (const node of paxosData.nodes) {
        state.addNode(node);
      }
      for (const edge of paxosData.edges) {
        state.addEdge(edge);
      }
      for (const container of paxosData.containers) {
        state.addContainer(container);
        // Move nodes to containers
        for (const childId of container.children) {
          if (state.getGraphNode(childId)) {
            state.assignNodeToContainer(childId, container.id);
          }
        }
      }

      // Verify initial state
      expect(state.visibleNodes.length).toBeGreaterThan(0);
      expect(state.visibleEdges.length).toBeGreaterThan(0);
      expect(state.visibleContainers.length).toBeGreaterThan(0);

      // Convert to ELK format
      const elkGraph = bridge.toELKGraph(state);

      // Verify ELK graph structure
      expect(elkGraph.id).toBe("root");
      expect(elkGraph.children).toBeDefined();
      expect(elkGraph.edges).toBeDefined();
      expect(elkGraph.layoutOptions).toBeDefined();

      // Should have nodes and/or containers
      expect(elkGraph.children!.length).toBeGreaterThan(0);

      // Verify layout options are applied
      expect(elkGraph.layoutOptions!["elk.algorithm"]).toBe("mrtree");
      expect(elkGraph.layoutOptions!["elk.direction"]).toBe("DOWN");

      // Simulate ELK layout results
      const elkResult = createMockELKResult(elkGraph);

      // Apply layout results back to state
      bridge.applyLayout(state, elkResult);

      // Verify positions were applied
      for (const node of state.visibleNodes) {
        if (node.position) {
          expect(typeof node.position.x).toBe("number");
          expect(typeof node.position.y).toBe("number");
          expect(Number.isFinite(node.position.x)).toBe(true);
          expect(Number.isFinite(node.position.y)).toBe(true);
        }
      }

      for (const container of state.visibleContainers) {
        if (container.position) {
          expect(typeof container.position.x).toBe("number");
          expect(typeof container.position.y).toBe("number");
          expect(Number.isFinite(container.position.x)).toBe(true);
          expect(Number.isFinite(container.position.y)).toBe(true);
        }
      }

      // Verify layout state was updated
      expect(state.getLayoutState().phase).toBe("ready");
    });

    it("should handle empty paxos.json gracefully", () => {
      // Test with minimal data when paxos.json is not available
      const node1 = createTestNode("n1", "Test Node 1");
      const node2 = createTestNode("n2", "Test Node 2");
      const edge1 = createTestEdge("e1", "n1", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge1);

      // Convert to ELK format
      const elkGraph = bridge.toELKGraph(state);

      // Should handle minimal data correctly
      expect(elkGraph.children).toHaveLength(2);
      expect(elkGraph.edges).toHaveLength(1);

      // Apply mock layout
      const elkResult = createMockELKResult(elkGraph);
      bridge.applyLayout(state, elkResult);

      // Verify layout was applied
      expect(state.getLayoutState().phase).toBe("ready");
    });

    // Helper function to create mock ELK results
    function createMockELKResult(elkGraph: ELKNode) {
      const result: ELKNode = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: ELKNode, index: number) => ({
            id: child.id,
            x: index * 150 + 50,
            y: index * 100 + 50,
            width: child.width || 120,
            height: child.height || 60,
            children: child.children
              ? child.children.map((nestedChild: any, nestedIndex: number) => ({
                  id: nestedChild.id,
                  x: nestedIndex * 130 + 20,
                  y: nestedIndex * 80 + 20,
                  width: nestedChild.width || 120,
                  height: nestedChild.height || 60,
                }))
              : undefined,
          }),
        );
      }

      return result;
    }
  });

  describe("Container Expand/Collapse Effects on ELK Layout", () => {
    beforeEach(() => {
      // Set up test data with containers
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const container1 = createTestContainer("c1", ["n1", "n2"], "Container 1");
      const edge1 = createTestEdge("e1", "n1", "n3");
      const edge2 = createTestEdge("e2", "n2", "n3");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container1);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.addEdge(edge1);
      state.addEdge(edge2);
    });

    it("should generate different ELK graphs for expanded vs collapsed containers", () => {
      // Test expanded container
      state._expandContainerForCoordinator("c1");
      const expandedElkGraph = bridge.toELKGraph(state);

      // Should show container with nested children
      const containerNode = expandedElkGraph.children!.find(
        (child) => child.id === "c1",
      );
      expect(containerNode).toBeDefined();
      expect(containerNode!.children).toBeDefined();
      expect(containerNode!.children!.length).toBe(2); // n1 and n2

      // Should have original edges
      expect(expandedElkGraph.edges!.length).toBe(2);

      // Test collapsed container
      state._collapseContainerForCoordinator("c1");
      const collapsedElkGraph = bridge.toELKGraph(state);

      // Should show container as single node
      const collapsedContainerNode = collapsedElkGraph.children!.find(
        (child) => child.id === "c1",
      );
      expect(collapsedContainerNode).toBeDefined();
      expect(collapsedContainerNode!.children).toBeUndefined();

      // Should have aggregated edges
      const aggregatedEdges = state.getAggregatedEdges();
      expect(aggregatedEdges.length).toBeGreaterThan(0);
      expect(collapsedElkGraph.edges!.length).toBeGreaterThanOrEqual(
        aggregatedEdges.length,
      );
    });

    it("should handle container toggle operations correctly", () => {
      // Start with expanded container
      state._expandContainerForCoordinator("c1");
      let elkGraph = bridge.toELKGraph(state);
      let elkResult = createContainerMockELKResult(elkGraph);
      bridge.applyLayout(state, elkResult);

      // Verify expanded layout
      const expandedContainer = state.getContainer("c1");
      expect(expandedContainer?.collapsed).toBe(false);
      expect(expandedContainer?.position).toBeDefined();

      // Toggle to collapsed
      state._collapseContainerForCoordinator("c1");
      elkGraph = bridge.toELKGraph(state);
      elkResult = createContainerMockELKResult(elkGraph);
      bridge.applyLayout(state, elkResult);

      // Verify collapsed layout
      const collapsedContainer = state.getContainer("c1");
      expect(collapsedContainer?.collapsed).toBe(true);
      expect(collapsedContainer?.position).toBeDefined();

      // Toggle back to expanded
      state._expandContainerForCoordinator("c1");
      elkGraph = bridge.toELKGraph(state);
      elkResult = createContainerMockELKResult(elkGraph);
      bridge.applyLayout(state, elkResult);

      // Verify expanded layout again
      const reExpandedContainer = state.getContainer("c1");
      expect(reExpandedContainer?.collapsed).toBe(false);
      expect(reExpandedContainer?.position).toBeDefined();
    });

    it("should handle bulk container operations", () => {
      // Add more containers for bulk testing
      const container2 = createTestContainer("c2", ["n3"], "Container 2");
      state.addContainer(container2);
      state.assignNodeToContainer("n3", "c2");

      // Test expand all
      state._expandAllContainersForCoordinator();
      let elkGraph = bridge.toELKGraph(state);

      // All containers should be expanded
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(false);
        const elkContainer = elkGraph.children!.find(
          (child) => child.id === container.id,
        );
        expect(elkContainer?.children).toBeDefined();
      }

      // Test collapse all
      state._collapseAllContainersForCoordinator();
      elkGraph = bridge.toELKGraph(state);

      // All containers should be collapsed
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(true);
        const elkContainer = elkGraph.children!.find(
          (child) => child.id === container.id,
        );
        expect(elkContainer?.children).toBeUndefined();
      }
    });

    // Helper function for container tests
    function createContainerMockELKResult(elkGraph: ELKNode) {
      const result: ELKNode = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: ELKNode, index: number) => ({
            id: child.id,
            x: index * 150 + 50,
            y: index * 100 + 50,
            width: child.width || 120,
            height: child.height || 60,
            children: child.children
              ? child.children.map(
                  (nestedChild: ELKNode, nestedIndex: number) => ({
                    id: nestedChild.id,
                    x: nestedIndex * 130 + 20,
                    y: nestedIndex * 80 + 20,
                    width: nestedChild.width || 120,
                    height: nestedChild.height || 60,
                  }),
                )
              : undefined,
          }),
        );
      }

      return result;
    }
  });

  describe("Layout Configuration Changes and Effects", () => {
    beforeEach(() => {
      // Set up test data
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const edge1 = createTestEdge("e1", "n1", "n2");
      const edge2 = createTestEdge("e2", "n2", "n3");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(edge1);
      state.addEdge(edge2);
    });

    it("should apply algorithm changes to ELK graph", () => {
      // Test layered algorithm
      bridge.updateConfiguration({ algorithm: "layered" });
      let elkGraph = bridge.toELKGraph(state);
      expect(elkGraph.layoutOptions!["elk.algorithm"]).toBe("layered");

      // Test force algorithm
      bridge.updateConfiguration({ algorithm: "force" });
      elkGraph = bridge.toELKGraph(state);
      expect(elkGraph.layoutOptions!["elk.algorithm"]).toBe("force");

      // Test stress algorithm
      bridge.updateConfiguration({ algorithm: "stress" });
      elkGraph = bridge.toELKGraph(state);
      expect(elkGraph.layoutOptions!["elk.algorithm"]).toBe("stress");
    });

    it("should apply direction changes to ELK graph", () => {
      // Test different directions
      const directions = ["UP", "DOWN", "LEFT", "RIGHT"] as const;

      for (const direction of directions) {
        bridge.updateConfiguration({ direction });
        const elkGraph = bridge.toELKGraph(state);
        expect(elkGraph.layoutOptions!["elk.direction"]).toBe(direction);
      }
    });

    it("should apply spacing changes to ELK graph", () => {
      // Test node spacing - need to clear spacing to use nodeSpacing
      bridge.updateConfiguration({ spacing: undefined, nodeSpacing: 30 });
      let elkGraph = bridge.toELKGraph(state);
      expect(elkGraph.layoutOptions!["elk.spacing.nodeNode"]).toBe("30");

      // Test layer spacing
      bridge.updateConfiguration({ layerSpacing: 40 });
      elkGraph = bridge.toELKGraph(state);
      expect(
        elkGraph.layoutOptions!["elk.layered.spacing.nodeNodeBetweenLayers"],
      ).toBe("40");

      // Test edge spacing
      bridge.updateConfiguration({ edgeSpacing: 15 });
      elkGraph = bridge.toELKGraph(state);
      expect(elkGraph.layoutOptions!["elk.spacing.edgeNode"]).toBe("15");
    });

    it("should apply performance optimizations based on graph size", () => {
      // Create a large graph to trigger optimizations
      for (let i = 0; i < 150; i++) {
        state.addNode(createTestNode(`large_n${i}`, `Large Node ${i}`));
      }
      for (let i = 0; i < 200; i++) {
        const source = `large_n${i % 150}`;
        const target = `large_n${(i + 1) % 150}`;
        state.addEdge(createTestEdge(`large_e${i}`, source, target));
      }

      const elkGraph = bridge.toELKGraph(state);

      // Should have performance optimizations applied
      expect(elkGraph.layoutOptions!["elk.separateConnectedComponents"]).toBe(
        "true",
      );

      // Check performance hints
      const hints = bridge.getPerformanceHints();
      expect(hints).toBeDefined();
      expect(hints!.isLargeGraph).toBe(true);
      expect(hints!.nodeCount).toBeGreaterThan(100);
    });

    it("should handle custom ELK options", () => {
      const customOptions = {
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.stress.epsilon": "0.1",
      };

      bridge.updateConfiguration({ elkOptions: customOptions });
      const elkGraph = bridge.toELKGraph(state);

      expect(
        elkGraph.layoutOptions!["elk.layered.crossingMinimization.strategy"],
      ).toBe("LAYER_SWEEP");
      expect(elkGraph.layoutOptions!["elk.stress.epsilon"]).toBe("0.1");
    });

    it("should reset configuration to defaults", () => {
      // Change configuration
      bridge.updateConfiguration({
        algorithm: "force",
        direction: "LEFT",
        nodeSpacing: 100,
      });

      // Reset to defaults
      bridge.resetConfiguration();
      const elkGraph = bridge.toELKGraph(state);

      expect(elkGraph.layoutOptions!["elk.algorithm"]).toBe("mrtree");
      expect(elkGraph.layoutOptions!["elk.direction"]).toBe("DOWN");
      expect(elkGraph.layoutOptions!["elk.spacing.nodeNode"]).toBe("50");
    });
  });

  describe("Layout Error Handling and Recovery", () => {
    beforeEach(() => {
      // Set up test data
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      state.addNode(node1);
      state.addNode(node2);
    });

    it("should handle invalid ELK results gracefully", () => {
      const elkGraph = bridge.toELKGraph(state);

      // Test with invalid ELK result - missing position
      const invalidResult = {
        id: "root",
        children: [
          { id: "n1" }, // Missing x, y, width, height
        ],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow(
        "Invalid ELK layout result for element n1: missing position or dimensions",
      );

      // Verify error state
      expect(state.getLayoutState().phase).toBe("error");
    });

    it("should handle non-finite position values", () => {
      const elkGraph = bridge.toELKGraph(state);

      // Test with NaN values
      const invalidResult = {
        id: "root",
        children: [{ id: "n1", x: NaN, y: 50, width: 120, height: 60 }],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow(
        "Invalid ELK layout result for element n1: non-finite position or dimensions",
      );

      expect(state.getLayoutState().phase).toBe("error");
    });

    it("should handle negative dimensions", () => {
      const elkGraph = bridge.toELKGraph(state);

      // Test with negative dimensions
      const invalidResult = {
        id: "root",
        children: [{ id: "n1", x: 100, y: 50, width: -120, height: 60 }],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow(
        "Invalid ELK layout result for element n1: non-positive dimensions",
      );

      expect(state.getLayoutState().phase).toBe("error");
    });

    it("should recover from errors on subsequent valid layouts", () => {
      const elkGraph = bridge.toELKGraph(state);

      // First, cause an error
      const invalidResult = {
        id: "root",
        children: [{ id: "n1", x: 100, y: 50, width: 0, height: 60 }],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow();

      expect(state.getLayoutState().phase).toBe("error");

      // Then, apply a valid result
      const validResult = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 120, height: 60 },
          { id: "n2", x: 250, y: 150, width: 120, height: 60 },
        ],
      };

      bridge.applyLayout(state, validResult);

      // Should recover to ready state
      expect(state.getLayoutState().phase).toBe("ready");

      // Verify positions were applied
      const node1 = state.getGraphNode("n1");
      const node2 = state.getGraphNode("n2");
      expect(node1?.position).toEqual({ x: 100, y: 50 });
      expect(node2?.position).toEqual({ x: 250, y: 150 });
    });

    it("should ignore layout results for non-existent elements", () => {
      const elkGraph = bridge.toELKGraph(state);

      // Include result for non-existent node
      const resultWithUnknown = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 120, height: 60 },
          { id: "unknown_node", x: 250, y: 150, width: 120, height: 60 },
        ],
      };

      // Should not throw, just ignore unknown elements
      expect(() => {
        bridge.applyLayout(state, resultWithUnknown);
      }).not.toThrow();

      // Should still apply valid results
      expect(state.getLayoutState().phase).toBe("ready");
      const node1 = state.getGraphNode("n1");
      expect(node1?.position).toEqual({ x: 100, y: 50 });
    });

    it("should validate configuration changes", () => {
      // Test invalid algorithm
      expect(() => {
        bridge.updateConfiguration({ algorithm: "invalid" as any });
      }).toThrow("Invalid ELK algorithm: invalid");

      // Test invalid direction
      expect(() => {
        bridge.updateConfiguration({ direction: "INVALID" as any });
      }).toThrow("Invalid ELK direction: INVALID");

      // Test invalid spacing
      expect(() => {
        bridge.updateConfiguration({ nodeSpacing: -10 });
      }).toThrow("Node spacing must be a non-negative finite number");
    });
  });

  describe("Performance and Complexity Analysis", () => {
    it("should analyze layout complexity correctly", () => {
      // Small graph
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(createTestEdge("e1", "n1", "n2"));

      const smallAnalysis = bridge.analyzeLayoutComplexity(state);
      expect(smallAnalysis.complexity).toBe("low");
      expect(smallAnalysis.estimatedLayoutTime).toBeLessThan(500);

      // Large graph
      for (let i = 2; i < 250; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
        if (i > 2) {
          state.addEdge(createTestEdge(`e${i}`, `n${i - 1}`, `n${i}`));
        }
      }

      const largeAnalysis = bridge.analyzeLayoutComplexity(state);
      expect(largeAnalysis.complexity).toBe("high");
      expect(largeAnalysis.estimatedLayoutTime).toBeGreaterThan(1000);
      expect(largeAnalysis.recommendations.length).toBeGreaterThan(0);
    });

    it("should generate appropriate performance hints", () => {
      // Create medium-sized graph
      for (let i = 0; i < 50; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }
      for (let i = 0; i < 75; i++) {
        const source = `n${i % 50}`;
        const target = `n${(i + 1) % 50}`;
        state.addEdge(createTestEdge(`e${i}`, source, target));
      }

      // Generate ELK graph to trigger hint generation
      bridge.toELKGraph(state);

      const hints = bridge.getPerformanceHints();
      expect(hints).toBeDefined();
      expect(hints!.nodeCount).toBe(50);
      expect(hints!.edgeCount).toBe(75);
      expect(hints!.isLargeGraph).toBe(false);
    });
  });
});
