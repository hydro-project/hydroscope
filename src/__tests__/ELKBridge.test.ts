/**
 * Tests for ELKBridge - ELK layout format conversion
 *
 * Tests the synchronous conversion from VisualizationState to ELK graph format
 * and application of ELK layout results back to VisualizationState
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge";
import { VisualizationState } from "../core/VisualizationState";
import {
  createTestNode,
  createTestEdge,
  createTestContainer,
} from "../utils/testData";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("ELKBridge", () => {
  let bridge: ELKBridge;
  let state: VisualizationState;

  beforeEach(() => {
    bridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
      spacing: 50,
    });
    state = new VisualizationState();
  });

  describe("ELK format conversion", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import(
        "../utils/testData.js"
      );
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
    });

    it("should convert empty VisualizationState to empty ELK graph", () => {
      const elkGraph = bridge.toELKGraph(state);

      expect(elkGraph.id).toBe("root");
      expect(elkGraph.children).toEqual([]);
      expect(elkGraph.edges).toEqual([]);
      expect(elkGraph.layoutOptions["elk.algorithm"]).toBe("mrtree");
      expect(elkGraph.layoutOptions["elk.direction"]).toBe("DOWN");
      expect(elkGraph.layoutOptions["elk.spacing.nodeNode"]).toBe("50"); // Default spacing
    });

    it("should convert nodes to ELK children", () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");

      state.addNode(node1);
      state.addNode(node2);

      const elkGraph = bridge.toELKGraph(state);

      expect(elkGraph.children).toHaveLength(2);
      expect(elkGraph.children![0].id).toBe("n1");
      expect(elkGraph.children![0].width).toBe(120);
      expect(elkGraph.children![0].height).toBe(60);
      expect(elkGraph.children![0].layoutOptions).toBeDefined();

      expect(elkGraph.children![1].id).toBe("n2");
      expect(elkGraph.children![1].width).toBe(120);
      expect(elkGraph.children![1].height).toBe(60);
      expect(elkGraph.children![1].layoutOptions).toBeDefined();
    });

    it("should convert edges to ELK edges", () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const edge = createTestEdge("e1", "n1", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const elkGraph = bridge.toELKGraph(state);

      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.edges![0]).toEqual({
        id: "e1",
        sources: ["n1"],
        targets: ["n2"],
      });
    });

    it("should handle collapsed containers as single nodes", async () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const container = createTestContainer("c1", ["n1", "n2"], "Container c1");

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container);
      await coordinator.collapseContainer(
        "c1",
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );

      const elkGraph = bridge.toELKGraph(state);

      // Should only show the container, not the internal nodes
      expect(elkGraph.children).toHaveLength(1);
      expect(elkGraph.children![0].id).toBe("c1");
      expect(elkGraph.children![0].width).toBe(200); // COLLAPSED_CONTAINER_WIDTH from config
      expect(elkGraph.children![0].height).toBe(150); // COLLAPSED_CONTAINER_HEIGHT from config
      expect(elkGraph.children![0].layoutOptions).toBeDefined();
    });

    it("should handle expanded containers with nested structure", () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const container = createTestContainer("c1", ["n1", "n2"], "Container c1");

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container);
      // Container is expanded by default

      const elkGraph = bridge.toELKGraph(state);

      // Should show container with children
      expect(elkGraph.children).toHaveLength(1);
      const elkContainer = elkGraph.children![0];
      expect(elkContainer.id).toBe("c1");
      // ELK will determine container size automatically - width/height should be undefined
      expect(elkContainer.width).toBeUndefined();
      expect(elkContainer.height).toBeUndefined();
      expect(elkContainer.children).toHaveLength(2);
      expect(elkContainer.layoutOptions).toBeDefined();

      expect(elkContainer.children![0].id).toBe("n1");
      expect(elkContainer.children![0].width).toBe(120);
      expect(elkContainer.children![0].height).toBe(60);
      expect(elkContainer.children![0].layoutOptions).toBeDefined();

      expect(elkContainer.children![1].id).toBe("n2");
      expect(elkContainer.children![1].width).toBe(120);
      expect(elkContainer.children![1].height).toBe(60);
      expect(elkContainer.children![1].layoutOptions).toBeDefined();
    });

    it("should handle aggregated edges for collapsed containers", async () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const container = createTestContainer("c1", ["n1", "n2"], "Container c1");
      const edge1 = createTestEdge("e1", "n1", "n3"); // Internal to external
      const edge2 = createTestEdge("e2", "n3", "n2"); // External to internal

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.addEdge(edge1);
      state.addEdge(edge2);
      await coordinator.collapseContainer(
        "c1",
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );

      const elkGraph = bridge.toELKGraph(state);

      // Should have aggregated edges to/from container (exact count depends on implementation)
      expect(elkGraph.edges!.length).toBeGreaterThanOrEqual(2);

      // Check that we have edges involving the container and external node
      const hasContainerToN3 = elkGraph.edges!.some(
        (edge) => edge.sources.includes("c1") && edge.targets.includes("n3"),
      );
      const hasN3ToContainer = elkGraph.edges!.some(
        (edge) => edge.sources.includes("n3") && edge.targets.includes("c1"),
      );

      expect(hasContainerToN3 || hasN3ToContainer).toBe(true);
    });

    it("should apply layout configuration", () => {
      const customBridge = new ELKBridge({
        algorithm: "force",
        direction: "RIGHT",
        spacing: 100,
      });

      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const elkGraph = customBridge.toELKGraph(state);

      expect(elkGraph.layoutOptions["elk.algorithm"]).toBe("force");
      expect(elkGraph.layoutOptions["elk.direction"]).toBe("RIGHT");
      expect(elkGraph.layoutOptions["elk.spacing.nodeNode"]).toBe("100");
    });
  });

  describe("ELK result application", () => {
    it("should apply ELK layout results to node positions", () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");

      state.addNode(node1);
      state.addNode(node2);

      const elkResult = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 120, height: 60 },
          { id: "n2", x: 300, y: 150, width: 120, height: 60 },
        ],
      };

      bridge.applyLayout(state, elkResult);

      const updatedNode1 = state.getGraphNode("n1");
      const updatedNode2 = state.getGraphNode("n2");

      expect(updatedNode1?.position).toEqual({ x: 100, y: 50 });
      expect(updatedNode2?.position).toEqual({ x: 300, y: 150 });
    });

    it("should apply container positions and dimensions", () => {
      const container = createTestContainer("c1", [], "Container c1");
      state.addContainer(container);

      const elkResult = {
        id: "root",
        children: [
          {
            id: "c1",
            x: 200,
            y: 100,
            width: 250,
            height: 180,
            children: [],
          },
        ],
      };

      bridge.applyLayout(state, elkResult);

      const updatedContainer = state.getContainer("c1");
      expect(updatedContainer?.position).toEqual({ x: 200, y: 100 });
      expect(updatedContainer?.dimensions).toEqual({ width: 250, height: 180 });
    });

    it("should handle nested container layout results", () => {
      const node1 = createTestNode("n1", "Node 1");
      const container = createTestContainer("c1", ["n1"], "Container c1");

      state.addNode(node1);
      state.addContainer(container);

      const elkResult = {
        id: "root",
        children: [
          {
            id: "c1",
            x: 50,
            y: 25,
            width: 200,
            height: 150,
            children: [{ id: "n1", x: 75, y: 50, width: 120, height: 60 }],
          },
        ],
      };

      bridge.applyLayout(state, elkResult);

      const updatedContainer = state.getContainer("c1");
      const updatedNode = state.getGraphNode("n1");

      expect(updatedContainer?.position).toEqual({ x: 50, y: 25 });
      expect(updatedNode?.position).toEqual({ x: 75, y: 50 });
    });

    it("should handle layout validation and error cases", () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      // Invalid ELK result - missing required properties
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
    });

    it("should validate non-finite position values", () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const invalidResult = {
        id: "root",
        children: [{ id: "n1", x: NaN, y: 50, width: 120, height: 60 }],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow(
        "Invalid ELK layout result for element n1: non-finite position or dimensions",
      );
    });

    it("should validate positive dimensions", () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const invalidResult = {
        id: "root",
        children: [{ id: "n1", x: 100, y: 50, width: -120, height: 60 }],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow(
        "Invalid ELK layout result for element n1: non-positive dimensions",
      );
    });

    it("should update layout state on successful application", () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const elkResult = {
        id: "root",
        children: [{ id: "n1", x: 100, y: 50, width: 120, height: 60 }],
      };

      bridge.applyLayout(state, elkResult);

      expect(state.getLayoutState().phase).toBe("ready");
    });

    it("should update layout state to error on failure", () => {
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const invalidResult = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 0, height: 60 }, // Invalid width
        ],
      };

      expect(() => {
        bridge.applyLayout(state, invalidResult);
      }).toThrow();

      expect(state.getLayoutState().phase).toBe("error");
    });

    it("should ignore layout results for non-existent nodes", () => {
      const elkResult = {
        id: "root",
        children: [
          { id: "nonexistent", x: 100, y: 50, width: 120, height: 60 },
        ],
      };

      // Should not throw, just ignore the unknown node
      expect(() => {
        bridge.applyLayout(state, elkResult);
      }).not.toThrow();
    });

    it("should handle complex layout results with paxos.json-like data", () => {
      // Create a more complex graph structure similar to paxos.json
      const nodes = [
        createTestNode("proposer1", "Proposer 1"),
        createTestNode("acceptor1", "Acceptor 1"),
        createTestNode("acceptor2", "Acceptor 2"),
        createTestNode("learner1", "Learner 1"),
      ];

      const container = createTestContainer(
        "paxos_cluster",
        ["proposer1", "acceptor1", "acceptor2"],
        "Paxos Cluster",
      );

      nodes.forEach((node) => state.addNode(node));
      state.addNode(createTestNode("learner1", "Learner 1"));
      state.addContainer(container);

      // Simulate ELK layout result with nested structure
      const elkResult = {
        id: "root",
        children: [
          {
            id: "paxos_cluster",
            x: 50,
            y: 25,
            width: 300,
            height: 200,
            children: [
              { id: "proposer1", x: 75, y: 50, width: 120, height: 60 },
              { id: "acceptor1", x: 75, y: 120, width: 120, height: 60 },
              { id: "acceptor2", x: 205, y: 120, width: 120, height: 60 },
            ],
          },
          { id: "learner1", x: 400, y: 100, width: 120, height: 60 },
        ],
      };

      bridge.applyLayout(state, elkResult);

      // Verify container position
      const updatedContainer = state.getContainer("paxos_cluster");
      expect(updatedContainer?.position).toEqual({ x: 50, y: 25 });
      expect(updatedContainer?.dimensions).toEqual({ width: 300, height: 200 });

      // Verify nested node positions
      const proposer = state.getGraphNode("proposer1");
      const acceptor1 = state.getGraphNode("acceptor1");
      const acceptor2 = state.getGraphNode("acceptor2");
      const learner = state.getGraphNode("learner1");

      expect(proposer?.position).toEqual({ x: 75, y: 50 });
      expect(acceptor1?.position).toEqual({ x: 75, y: 120 });
      expect(acceptor2?.position).toEqual({ x: 205, y: 120 });
      expect(learner?.position).toEqual({ x: 400, y: 100 });

      // Verify layout state
      expect(state.getLayoutState().phase).toBe("ready");
    });
  });

  describe("layout configuration management", () => {
    it("should update layout configuration", () => {
      const newConfig = {
        algorithm: "force" as const,
        direction: "LEFT" as const,
        spacing: 75,
      };

      bridge.updateConfiguration(newConfig);

      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const elkGraph = bridge.toELKGraph(state);

      expect(elkGraph.layoutOptions["elk.algorithm"]).toBe("force");
      expect(elkGraph.layoutOptions["elk.direction"]).toBe("LEFT");
      expect(elkGraph.layoutOptions["elk.spacing.nodeNode"]).toBe("75");
    });

    it("should validate layout configuration", () => {
      expect(() => {
        new ELKBridge({
          algorithm: "invalid" as "layered",
          direction: "DOWN",
          spacing: 50,
        });
      }).toThrow("Invalid ELK algorithm: invalid");

      expect(() => {
        new ELKBridge({
          algorithm: "mrtree",
          direction: "INVALID" as "DOWN",
          spacing: 50,
        });
      }).toThrow("Invalid ELK direction: INVALID");
    });

    it("should validate numeric configuration values", () => {
      expect(() => {
        new ELKBridge({ spacing: -10 });
      }).toThrow("Spacing must be a non-negative finite number");

      expect(() => {
        new ELKBridge({ nodeSpacing: NaN });
      }).toThrow("Node spacing must be a non-negative finite number");

      expect(() => {
        new ELKBridge({ aspectRatio: 0 });
      }).toThrow("Aspect ratio must be a positive finite number");

      expect(() => {
        new ELKBridge({ nodeSize: { width: -10, height: 50 } });
      }).toThrow("Node width must be a positive finite number");
    });

    it("should get current configuration", () => {
      const config = {
        algorithm: "stress" as const,
        direction: "UP" as const,
        spacing: 60,
        nodeSpacing: 25,
        compactLayout: true,
      };

      const customBridge = new ELKBridge(config);
      const retrievedConfig = customBridge.getConfiguration();

      expect(retrievedConfig.algorithm).toBe("stress");
      expect(retrievedConfig.direction).toBe("UP");
      expect(retrievedConfig.spacing).toBe(60);
      expect(retrievedConfig.nodeSpacing).toBe(25);
      expect(retrievedConfig.compactLayout).toBe(true);
    });

    it("should reset configuration to defaults", () => {
      bridge.updateConfiguration({
        algorithm: "force",
        direction: "LEFT",
        spacing: 100,
        compactLayout: true,
      });

      bridge.resetConfiguration();
      const config = bridge.getConfiguration();

      expect(config.algorithm).toBe("mrtree");
      expect(config.direction).toBe("DOWN");
      expect(config.nodeSpacing).toBe(50);
      expect(config.compactLayout).toBe(false);
    });

    it("should handle advanced configuration options", () => {
      const advancedConfig = {
        algorithm: "mrtree" as const,
        nodeSpacing: 30,
        layerSpacing: 40,
        edgeSpacing: 15,
        portSpacing: 12,
        separateConnectedComponents: true,
        mergeEdges: true,
        aspectRatio: 2.0,
        containerPadding: 25,
        hierarchicalLayout: true,
        compactLayout: true,
        elkOptions: {
          "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
          "elk.stress.epsilon": "0.1",
        },
      };

      const customBridge = new ELKBridge(advancedConfig);
      const node1 = createTestNode("n1", "Node 1");
      state.addNode(node1);

      const elkGraph = customBridge.toELKGraph(state);

      expect(elkGraph.layoutOptions["elk.spacing.nodeNode"]).toBe("30");
      expect(
        elkGraph.layoutOptions["elk.layered.spacing.nodeNodeBetweenLayers"],
      ).toBe("40");
      expect(elkGraph.layoutOptions["elk.spacing.edgeNode"]).toBe("15");
      expect(elkGraph.layoutOptions["elk.spacing.portPort"]).toBe("12");
      expect(elkGraph.layoutOptions["elk.separateConnectedComponents"]).toBe(
        "true",
      );
      expect(elkGraph.layoutOptions["elk.aspectRatio"]).toBe("2");
      expect(elkGraph.layoutOptions["elk.hierarchyHandling"]).toBe(
        "INCLUDE_CHILDREN",
      );
      expect(
        elkGraph.layoutOptions["elk.layered.crossingMinimization.strategy"],
      ).toBe("LAYER_SWEEP");
      expect(elkGraph.layoutOptions["elk.stress.epsilon"]).toBe("0.1");
    });
  });

  describe("performance optimization", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(() => {
      coordinator = new AsyncCoordinator();
      const elkBridge = new ELKBridge({
        algorithm: "mrtree",
        direction: "DOWN",
      });
      const reactFlowBridge = new ReactFlowBridge({});
      coordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    });

    it("should generate performance hints for small graphs", () => {
      const nodes = [
        createTestNode("n1", "Node 1"),
        createTestNode("n2", "Node 2"),
      ];
      const edges = [createTestEdge("e1", "n1", "n2")];

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));

      bridge.toELKGraph(state); // This generates performance hints
      const hints = bridge.getPerformanceHints();

      expect(hints).toBeDefined();
      expect(hints!.nodeCount).toBe(2);
      expect(hints!.edgeCount).toBe(1);
      expect(hints!.containerCount).toBe(0);
      expect(hints!.isLargeGraph).toBe(false);
    });

    it("should generate performance hints for large graphs", () => {
      // Create a large graph
      for (let i = 0; i < 150; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }
      for (let i = 0; i < 250; i++) {
        const source = `n${i % 150}`;
        const target = `n${(i + 1) % 150}`;
        state.addEdge(createTestEdge(`e${i}`, source, target));
      }

      bridge.toELKGraph(state);
      const hints = bridge.getPerformanceHints();

      expect(hints).toBeDefined();
      expect(hints!.nodeCount).toBe(150);
      expect(hints!.edgeCount).toBe(250);
      expect(hints!.isLargeGraph).toBe(true);
      expect(hints!.recommendedAlgorithm).toBeDefined();
    });

    it("should apply performance optimizations for large graphs", () => {
      // Create a large graph with containers
      for (let i = 0; i < 120; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }
      for (let i = 0; i < 15; i++) {
        const children = [`n${i * 8}`, `n${i * 8 + 1}`, `n${i * 8 + 2}`];
        state.addContainer(
          createTestContainer(`c${i}`, children, `Container ${i}`),
        );
      }

      const elkGraph = bridge.toELKGraph(state);

      // Should have performance optimizations applied
      expect(elkGraph.layoutOptions["elk.separateConnectedComponents"]).toBe(
        "true",
      );
      expect(elkGraph.layoutOptions["elk.spacing.componentComponent"]).toBe(
        "20",
      );
      expect(elkGraph.layoutOptions["elk.hierarchyHandling"]).toBe(
        "INCLUDE_CHILDREN",
      );
    });

    it("should analyze layout complexity", () => {
      // Small graph
      state.addNode(createTestNode("n1", "Node 1"));
      state.addNode(createTestNode("n2", "Node 2"));
      state.addEdge(createTestEdge("e1", "n1", "n2"));

      const smallAnalysis = bridge.analyzeLayoutComplexity(state);
      expect(smallAnalysis.complexity).toBe("low");
      expect(smallAnalysis.estimatedLayoutTime).toBeLessThan(200);

      // Large graph
      for (let i = 2; i < 300; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }
      for (let i = 2; i < 299; i++) {
        // Avoid creating edge to non-existent node
        state.addEdge(createTestEdge(`e${i}`, `n${i}`, `n${i + 1}`));
      }

      const largeAnalysis = bridge.analyzeLayoutComplexity(state);
      expect(largeAnalysis.complexity).toBe("high");
      expect(largeAnalysis.estimatedLayoutTime).toBeGreaterThan(1000);
      expect(largeAnalysis.recommendations).toContain(
        "Enable separate connected components",
      );
    });

    it("should calculate consistent node sizes regardless of labels", () => {
      const shortLabelNode = createTestNode("n1", "Short");
      const longLabelNode = createTestNode(
        "n2",
        "This is a very long label that should affect sizing",
      );
      longLabelNode.showingLongLabel = true;

      state.addNode(shortLabelNode);
      state.addNode(longLabelNode);

      const elkGraph = bridge.toELKGraph(state);

      // Find the nodes in the ELK graph
      const shortNode = elkGraph.children!.find((child) => child.id === "n1");
      const longNode = elkGraph.children!.find((child) => child.id === "n2");

      expect(shortNode?.width).toBeDefined();
      expect(longNode?.width).toBeDefined();
      // Nodes should have consistent sizes to avoid layout instability
      expect(longNode!.width).toBe(shortNode!.width);
      expect(longNode!.width).toBe(120);
      expect(shortNode!.width).toBe(120);
    });

    it("should calculate optimal container sizes", async () => {
      const nodes = [
        createTestNode("n1", "Node 1"),
        createTestNode("n2", "Node 2"),
        createTestNode("n3", "Node 3"),
      ];
      nodes.forEach((node) => state.addNode(node));

      const smallContainer = createTestContainer(
        "c1",
        ["n1"],
        "Small Container",
      );
      const largeContainer = createTestContainer(
        "c2",
        ["n2", "n3"],
        "Large Container",
      );

      state.addContainer(smallContainer);
      state.addContainer(largeContainer);

      // Test collapsed containers
      await coordinator.collapseContainer(
        "c1",
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );
      await coordinator.collapseContainer(
        "c2",
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );

      const elkGraph = bridge.toELKGraph(state);

      const smallContainerNode = elkGraph.children!.find(
        (child) => child.id === "c1",
      );
      const largeContainerNode = elkGraph.children!.find(
        (child) => child.id === "c2",
      );

      expect(smallContainerNode?.width).toBeDefined();
      expect(largeContainerNode?.width).toBeDefined();
      // Container with more children should be larger
      expect(largeContainerNode!.height).toBeGreaterThanOrEqual(
        smallContainerNode!.height,
      );
    });

    it("should handle layout options for semantic tags", () => {
      const importantNode = createTestNode("n1", "Important Node");
      importantNode.semanticTags = ["important"];

      const centralNode = createTestNode("n2", "Central Node");
      centralNode.semanticTags = ["central"];

      state.addNode(importantNode);
      state.addNode(centralNode);

      const elkGraph = bridge.toELKGraph(state);

      const importantELKNode = elkGraph.children!.find(
        (child) => child.id === "n1",
      );
      const centralELKNode = elkGraph.children!.find(
        (child) => child.id === "n2",
      );

      expect(importantELKNode?.layoutOptions?.["elk.priority"]).toBe("10");
      expect(
        centralELKNode?.layoutOptions?.[
          "elk.layered.layering.nodePromotion.strategy"
        ],
      ).toBe("NONE");
    });

    it("should clear performance hints when configuration is updated", () => {
      state.addNode(createTestNode("n1", "Node 1"));

      bridge.toELKGraph(state); // Generate hints
      expect(bridge.getPerformanceHints()).toBeDefined();

      bridge.updateConfiguration({ algorithm: "force" });
      expect(bridge.getPerformanceHints()).toBeUndefined();
    });
  });

  describe("smart collapse integration", () => {
    it("should run smart collapse before layout on first layout", async () => {
      // Create containers with different child counts
      const smallContainer = createTestContainer(
        "small",
        ["node1", "node2"],
        "Container small",
      );
      const largeContainer = createTestContainer(
        "large",
        [
          "node3",
          "node4",
          "node5",
          "node6",
          "node7",
          "node8",
          "node9",
          "node10",
        ],
        "Container large",
      );

      // Add test nodes
      for (let i = 1; i <= 10; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.addContainer(smallContainer);
      state.addContainer(largeContainer);

      // Initially both containers should be expanded
      expect(state.getContainer("small")?.collapsed).toBe(false);
      expect(state.getContainer("large")?.collapsed).toBe(false);
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Run layout - this should trigger smart collapse
      await bridge.layout(state);

      // Small container (2 children) should remain expanded
      expect(state.getContainer("small")?.collapsed).toBe(false);

      // Large container (8 children > 7 threshold) should be collapsed by smart collapse
      expect(state.getContainer("large")?.collapsed).toBe(true);

      // Layout count should be incremented
      expect(state.isFirstLayout()).toBe(false);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it("should not run smart collapse when disabled", async () => {
      const largeContainer = createTestContainer(
        "large",
        [
          "node1",
          "node2",
          "node3",
          "node4",
          "node5",
          "node6",
          "node7",
          "node8",
        ],
        "Container large",
      );

      for (let i = 1; i <= 8; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.addContainer(largeContainer);
      state.disableSmartCollapseForUserOperations();

      expect(state.shouldRunSmartCollapse()).toBe(false);

      await bridge.layout(state);

      // Container should remain expanded
      expect(state.getContainer("large")?.collapsed).toBe(false);
    });

    it("should not run smart collapse after first layout", async () => {
      const largeContainer = createTestContainer(
        "large",
        ["node1", "node2", "node3", "node4", "node5"],
        "Container large",
      );

      for (let i = 1; i <= 5; i++) {
        state.addNode(createTestNode(`node${i}`));
      }

      state.addContainer(largeContainer);

      // Run first layout
      await bridge.layout(state);
      expect(state.isFirstLayout()).toBe(false);

      // Add another container
      const anotherLargeContainer = createTestContainer(
        "another",
        ["node6", "node7", "node8", "node9", "node10"],
        "Container another",
      );
      for (let i = 6; i <= 10; i++) {
        state.addNode(createTestNode(`node${i}`));
      }
      state.addContainer(anotherLargeContainer);

      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Run second layout
      await bridge.layout(state);

      // New container should remain expanded (no smart collapse on second layout)
      expect(state.getContainer("another")?.collapsed).toBe(false);
    });
  });
});
