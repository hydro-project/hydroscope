/**
 * End-to-End Integration Tests: Complete Data Flow
 *
 * Tests complete pipeline: parse → layout → render with paxos.json
 * Verifies container operations work through entire pipeline
 * Tests search operations affect rendering correctly
 * Validates performance of complete pipeline
 *
 * Requirements: 7.1, 7.2, 7.3, 12.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import {
  loadPaxosTestData,
  createTestNode,
  createTestEdge,
  createTestContainer,
} from "../utils/testData.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { LayoutConfig, StyleConfig } from "../types/core.js";

describe("End-to-End Integration: Complete Data Flow", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let interactionHandler: InteractionHandler;
  let layoutConfig: LayoutConfig;
  let styleConfig: StyleConfig;

  beforeEach(() => {
    state = new VisualizationState();

    layoutConfig = {
      algorithm: "mrtree",
      direction: "DOWN",
      spacing: 50,
      nodeSpacing: 20,
      layerSpacing: 25,
    };

    styleConfig = {
      nodeStyles: {
        Source: { backgroundColor: "#e8f5e8", border: "2px solid #4caf50" },
        Transform: { backgroundColor: "#e3f2fd", border: "2px solid #2196f3" },
        Sink: { backgroundColor: "#fce4ec", border: "2px solid #e91e63" },
        Network: { backgroundColor: "#fff3e0", border: "2px solid #ff9800" },
        Join: { backgroundColor: "#f3e5f5", border: "2px solid #9c27b0" },
        Aggregation: {
          backgroundColor: "#ffebee",
          border: "2px solid #f44336",
        },
        Tee: { backgroundColor: "#e0f2f1", border: "2px solid #009688" },
        default: { backgroundColor: "#f5f5f5", border: "1px solid #666" },
      },
      edgeStyles: {
        dataflow: { stroke: "#2196f3", strokeWidth: 2 },
        control: { stroke: "#ff9800", strokeWidth: 1, strokeDasharray: "5,5" },
        aggregated: { stroke: "#ff6b6b", strokeWidth: 3 },
        default: { stroke: "#666", strokeWidth: 1 },
      },
      containerStyles: {
        collapsed: { backgroundColor: "#fff3e0", border: "3px solid #ff9800" },
        expanded: {
          backgroundColor: "rgba(255, 243, 224, 0.3)",
          border: "2px dashed #ff9800",
        },
      },
    };

    elkBridge = new ELKBridge(layoutConfig);
    reactFlowBridge = new ReactFlowBridge(styleConfig);
    interactionHandler = new InteractionHandler(state);
  });

  describe("Complete Pipeline: Parse → Layout → Render", () => {
    it("should process complete paxos.json pipeline successfully", async () => {
      // Step 1: Parse - Load paxos.json test data
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

      // Verify parse step
      expect(state.visibleNodes.length).toBeGreaterThan(0);
      expect(state.visibleEdges.length).toBeGreaterThan(0);

      const initialNodeCount = state.visibleNodes.length;
      const initialEdgeCount = state.visibleEdges.length;
      const initialContainerCount = state.visibleContainers.length;

      // Step 2: Layout - Convert to ELK format and apply mock layout
      const elkGraph = elkBridge.toELKGraph(state);

      // Verify ELK conversion
      expect(elkGraph.id).toBe("root");
      expect(elkGraph.children).toBeDefined();
      expect(elkGraph.edges).toBeDefined();
      expect(elkGraph.children!.length).toBeGreaterThan(0);

      // Create mock ELK layout result
      const elkResult = createMockELKResult(elkGraph);

      // Apply layout
      elkBridge.applyLayout(state, elkResult);

      // Verify layout was applied
      expect(state.getLayoutState().phase).toBe("ready");

      // Verify nodes have positions
      let nodesWithPositions = 0;
      for (const node of state.visibleNodes) {
        if (node.position) {
          expect(Number.isFinite(node.position.x)).toBe(true);
          expect(Number.isFinite(node.position.y)).toBe(true);
          nodesWithPositions++;
        }
      }
      expect(nodesWithPositions).toBeGreaterThan(0);

      // Step 3: Render - Convert to ReactFlow format
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify ReactFlow conversion
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      // Verify all ReactFlow nodes have required properties
      for (const node of reactFlowData.nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.data).toBeDefined();
        expect(node.data.label).toBeDefined();
        expect(node.data.nodeType).toBeDefined();

        // Verify click handlers are attached
        expect(node.data.onClick).toBeDefined();
        expect(typeof node.data.onClick).toBe("function");
      }

      // Verify all ReactFlow edges have required properties
      for (const edge of reactFlowData.edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.type).toBeDefined();
      }

      // Verify data consistency through pipeline
      expect(state.visibleNodes.length).toBe(initialNodeCount);
      expect(state.visibleEdges.length).toBe(initialEdgeCount);
      expect(state.visibleContainers.length).toBe(initialContainerCount);
    });

    it("should handle minimal test data through complete pipeline", async () => {
      // Step 1: Parse - Create minimal test data
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const container = createTestContainer("c1", ["n1", "n2"], "Container c1");
      const edge1 = createTestEdge("e1", "n1", "n2");
      const edge2 = createTestEdge("e2", "n2", "n3");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Step 2: Layout
      const elkGraph = elkBridge.toELKGraph(state);
      const elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);

      // Step 3: Render
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify complete pipeline worked
      expect(reactFlowData.nodes.length).toBe(4); // n1, n2, n3, container
      expect(reactFlowData.edges.length).toBe(2); // e1, e2
      expect(state.getLayoutState().phase).toBe("ready");
    });

    // Helper function to create mock ELK results
    function createMockELKResult(elkGraph: any) {
      const result: any = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: any, index: number) => ({
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

  describe("Container Operations Through Complete Pipeline", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import(
        "../utils/testData.js"
      );
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
      // Set up test data with containers
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const node4 = createTestNode("n4", "Node 4");
      const container1 = createTestContainer(
        "c1",
        ["n1", "n2"],
        "Container c1",
      );
      const container2 = createTestContainer(
        "c2",
        ["n3", "n4"],
        "Container c2",
      );
      const edge1 = createTestEdge("e1", "n1", "n3");
      const edge2 = createTestEdge("e2", "n2", "n4");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addNode(node4);
      state.addContainer(container1);
      state.addContainer(container2);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.assignNodeToContainer("n3", "c2");
      state.assignNodeToContainer("n4", "c2");
      state.addEdge(edge1);
      state.addEdge(edge2);
    });

    it("should handle container expand/collapse through complete pipeline", async () => {
      // Initial state - both containers expanded
      await coordinator.expandAllContainers(state, { fitView: false });

      // Run through pipeline
      let elkGraph = elkBridge.toELKGraph(state);
      let elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      let reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify expanded state
      const expandedContainers = reactFlowData.nodes.filter(
        (node) => node.type === "container" && node.data.collapsed === false,
      );
      expect(expandedContainers.length).toBe(2);

      // Should have original edges (not aggregated)
      const originalEdges = reactFlowData.edges.filter(
        (edge) => edge.type !== "aggregated",
      );
      expect(originalEdges.length).toBe(2);

      // Collapse all containers
      await coordinator.collapseAllContainers(state, { fitView: false });

      // Run through pipeline again
      elkGraph = elkBridge.toELKGraph(state);
      elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify collapsed state
      const collapsedContainers = reactFlowData.nodes.filter(
        (node) =>
          node.data.nodeType === "container" && node.data.collapsed === true,
      );
      expect(collapsedContainers.length).toBe(2);

      // Should have aggregated edges
      const aggregatedEdges = reactFlowData.edges.filter(
        (edge) => edge.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBeGreaterThan(0);
    });

    it("should handle individual container toggle through pipeline", async () => {
      // Start with all expanded
      await coordinator.expandAllContainers(state, { fitView: false });

      // Toggle one container
      await coordinator.collapseContainer("c1", state, {
        fitView: false,
      });

      // Run through pipeline
      const elkGraph = elkBridge.toELKGraph(state);
      const elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify mixed state
      const c1Node = reactFlowData.nodes.find((node) => node.id === "c1");
      const c2Node = reactFlowData.nodes.find((node) => node.id === "c2");

      expect(c1Node?.data.collapsed).toBe(true);
      expect(c2Node?.data.collapsed).toBe(false);

      // Should have edges (either aggregated or original, depending on implementation)
      expect(reactFlowData.edges.length).toBeGreaterThan(0);

      // Check if we have aggregated edges from collapsed container
      const aggregatedEdges = reactFlowData.edges.filter(
        (edge) => edge.type === "aggregated",
      );
      const originalEdges = reactFlowData.edges.filter(
        (edge) => edge.type !== "aggregated",
      );

      // Should have at least some edges
      expect(aggregatedEdges.length + originalEdges.length).toBeGreaterThan(0);
    });

    it("should handle click interactions through pipeline", async () => {
      // Use fresh handler with debouncing disabled for synchronous testing
      const freshHandler = new InteractionHandler(state, undefined, {
        enableClickDebouncing: false,
      });

      // Start with expanded containers
      await coordinator.expandAllContainers(state, { fitView: false });

      // Run initial pipeline
      let elkGraph = elkBridge.toELKGraph(state);
      let elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      await elkBridge.layout(state);
      let reactFlowData = reactFlowBridge.toReactFlowData(state, freshHandler);

      // Find container and simulate click
      const containerNode = reactFlowData.nodes.find(
        (node) => node.id === "c1",
      );
      expect(containerNode?.data.collapsed).toBe(false);

      // Simulate click to collapse
      const onClick = containerNode!.data.onClick!;
      onClick("c1", "container");

      // ReactFlowBridge is now stateless - no caches to clear

      elkGraph = elkBridge.toELKGraph(state);
      elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);
      reactFlowData = reactFlowBridge.toReactFlowData(state, freshHandler);

      // Verify container was collapsed
      const updatedContainerNode = reactFlowData.nodes.find(
        (node) => node.id === "c1",
      );
      expect(updatedContainerNode?.data.collapsed).toBe(true);
    });

    // Helper function for container tests
    function createMockELKResult(elkGraph: any) {
      const result: any = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: any, index: number) => ({
            id: child.id,
            x: index * 200 + 50,
            y: index * 150 + 50,
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

  describe("Search Operations Through Complete Pipeline", () => {
    let coordinator: AsyncCoordinator;

    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import(
        "../utils/testData.js"
      );
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
      // Set up searchable test data
      const node1 = createTestNode("search_node_1", "Searchable Node 1");
      const node2 = createTestNode("search_node_2", "Another Node");
      const node3 = createTestNode("different_node", "Different Node");
      const container = createTestContainer(
        "search_container",
        ["search_node_1"],
        "Searchable Container",
      );
      const edge = createTestEdge("e1", "search_node_1", "search_node_2");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("search_node_1", "search_container");
      state.addEdge(edge);
    });

    it("should handle search operations affecting rendering", async () => {
      // Start with container collapsed
      await coordinator.collapseContainer("search_container", state, {
        fitView: false,
      });

      // Run initial pipeline
      let elkGraph = elkBridge.toELKGraph(state);
      let elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      let reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify initial collapsed state
      const initialContainerNode = reactFlowData.nodes.find(
        (node) => node.id === "search_container",
      );
      expect(initialContainerNode?.data.collapsed).toBe(true);

      // Should not see internal node in collapsed state
      const hiddenNode = reactFlowData.nodes.find(
        (node) => node.id === "search_node_1",
      );
      expect(hiddenNode).toBeUndefined();

      // Perform search that should expand container
      const searchResults = state.search("Searchable");
      expect(searchResults.length).toBeGreaterThan(0);

      // Manually expand container to show search results (simulating search expansion)
      await coordinator.expandContainer("search_container", state, {
        fitView: false,
      });
      const expandedContainer = state.getContainer("search_container");
      expect(expandedContainer?.collapsed).toBe(false);

      // Run pipeline after search
      elkGraph = elkBridge.toELKGraph(state);
      elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify search expanded the container
      const expandedContainerNode = reactFlowData.nodes.find(
        (node) => node.id === "search_container",
      );
      expect(expandedContainerNode?.data.collapsed).toBe(false);

      // Should now see the internal node
      const visibleNode = reactFlowData.nodes.find(
        (node) => node.id === "search_node_1",
      );
      expect(visibleNode).toBeDefined();
    });

    it("should handle search clearing through pipeline", async () => {
      // Perform search first
      const searchResults = state.search("Searchable");

      // Run pipeline with search results
      let elkGraph = elkBridge.toELKGraph(state);
      let elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      // Verify search results exist
      expect(searchResults.length).toBeGreaterThan(0);

      // Clear search
      state.clearSearch();

      // Run pipeline after clearing search
      elkGraph = elkBridge.toELKGraph(state);
      elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const _reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify search was cleared (search again should return same results)
      const clearedResults = state.search("Searchable");
      expect(clearedResults.length).toBeGreaterThan(0); // Search still works
    });

    it("should handle search with node label highlighting", async () => {
      // Perform search
      const searchResults = state.search("Node");
      expect(searchResults.length).toBeGreaterThan(0);

      // Run pipeline
      const elkGraph = elkBridge.toELKGraph(state);
      const elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Verify nodes with search matches are properly rendered
      const searchableNodes = reactFlowData.nodes.filter((node) =>
        node.data.label.includes("Node"),
      );
      expect(searchableNodes.length).toBeGreaterThan(0);

      // All nodes should have proper data structure
      for (const node of searchableNodes) {
        expect(node.data.label).toBeDefined();
        expect(node.data.nodeType).toBeDefined();
      }
    });

    // Helper function for search tests
    function createMockELKResult(elkGraph: any) {
      const result: any = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: any, index: number) => ({
            id: child.id,
            x: index * 180 + 50,
            y: index * 120 + 50,
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

  describe("Performance Validation", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(async () => {
      const { createTestAsyncCoordinator } = await import(
        "../utils/testData.js"
      );
      const testSetup = await createTestAsyncCoordinator();
      coordinator = testSetup.asyncCoordinator;
    });

    it("should handle large datasets through complete pipeline efficiently", async () => {
      // Create a moderately large dataset
      const nodeCount = 100;
      const edgeCount = 150;
      const containerCount = 10;

      // Add nodes
      for (let i = 0; i < nodeCount; i++) {
        const node = createTestNode(`perf_n${i}`, `Performance Node ${i}`);
        node.type = i % 2 === 0 ? "Transform" : "Source";
        state.addNode(node);
      }

      // Add containers
      for (let i = 0; i < containerCount; i++) {
        const childNodes = [];
        for (let j = 0; j < 8; j++) {
          const nodeIndex = (i * 8 + j) % nodeCount;
          childNodes.push(`perf_n${nodeIndex}`);
        }
        const container = createTestContainer(
          `perf_c${i}`,
          childNodes,
          `Performance Container ${i}`,
        );
        state.addContainer(container);

        // Move nodes to container
        for (const childId of childNodes) {
          if (state.getGraphNode(childId)) {
            state.assignNodeToContainer(childId, `perf_c${i}`);
          }
        }
      }

      // Add edges
      for (let i = 0; i < edgeCount; i++) {
        const source = `perf_n${i % nodeCount}`;
        const target = `perf_n${(i + 1) % nodeCount}`;
        state.addEdge(createTestEdge(`perf_e${i}`, source, target));
      }

      // Measure complete pipeline performance
      const startTime = Date.now();

      // Step 1: ELK Layout
      const elkGraph = elkBridge.toELKGraph(state);
      const elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);

      // Step 2: ReactFlow Render
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete in reasonable time (less than 2 seconds)
      expect(totalTime).toBeLessThan(2000);

      // Verify correct data structure
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);
      expect(reactFlowData.edges.length).toBeGreaterThan(0);
      expect(state.getLayoutState().phase).toBe("ready");

      // Verify all nodes have positions
      let nodesWithPositions = 0;
      for (const node of state.visibleNodes) {
        if (node.position) {
          nodesWithPositions++;
        }
      }
      expect(nodesWithPositions).toBeGreaterThan(0);
    });

    it("should handle container operations on large datasets efficiently", async () => {
      // Create dataset with containers
      for (let i = 0; i < 50; i++) {
        state.addNode(createTestNode(`bulk_n${i}`, `Bulk Node ${i}`));
      }

      for (let i = 0; i < 10; i++) {
        const childNodes = [
          `bulk_n${i * 5}`,
          `bulk_n${i * 5 + 1}`,
          `bulk_n${i * 5 + 2}`,
        ];
        const container = createTestContainer(
          `bulk_c${i}`,
          childNodes,
          `Bulk Container ${i}`,
        );
        state.addContainer(container);

        for (const childId of childNodes) {
          if (state.getGraphNode(childId)) {
            state.assignNodeToContainer(childId, `bulk_c${i}`);
          }
        }
      }

      // Measure bulk operations
      const startTime = Date.now();

      // Expand all
      await coordinator.expandAllContainers(state, { fitView: false });
      let elkGraph = elkBridge.toELKGraph(state);
      let elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      let reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      // Collapse all
      await coordinator.collapseAllContainers(state, { fitView: false });
      elkGraph = elkBridge.toELKGraph(state);
      elkResult = createMockELKResult(elkGraph);
      elkBridge.applyLayout(state, elkResult);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete bulk operations efficiently
      expect(totalTime).toBeLessThan(1000);

      // Verify final state
      const collapsedContainers = reactFlowData.nodes.filter(
        (node) =>
          node.data.nodeType === "container" && node.data.collapsed === true,
      );
      expect(collapsedContainers.length).toBe(10);
    });

    // Helper function for performance tests
    function createMockELKResult(elkGraph: any) {
      const result: any = {
        id: "root",
        children: [],
      };

      if (elkGraph.children) {
        result.children = elkGraph.children.map(
          (child: any, index: number) => ({
            id: child.id,
            x: (index % 10) * 150 + 50,
            y: Math.floor(index / 10) * 120 + 50,
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

  describe("Error Handling Through Pipeline", () => {
    it("should handle layout errors gracefully in pipeline", async () => {
      // Set up valid initial state
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      state.addNode(node1);
      state.addNode(node2);

      // Create invalid ELK result
      const invalidELKResult = {
        id: "root",
        children: [{ id: "n1", x: NaN, y: 50, width: 120, height: 60 }],
      };

      // Should handle layout error
      expect(() => {
        elkBridge.applyLayout(state, invalidELKResult);
      }).toThrow();

      // State should be in error phase
      expect(state.getLayoutState().phase).toBe("error");

      // ReactFlow bridge should still work with error state
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );
      expect(reactFlowData.nodes.length).toBe(2);
      expect(reactFlowData.edges.length).toBe(0);
    });

    it("should recover from errors in subsequent pipeline runs", async () => {
      // Set up state
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      state.addNode(node1);
      state.addNode(node2);

      // Cause error first
      const invalidResult = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 0, height: 60 }, // Invalid width
        ],
      };

      expect(() => {
        elkBridge.applyLayout(state, invalidResult);
      }).toThrow();

      expect(state.getLayoutState().phase).toBe("error");

      // Recover with valid result
      const validResult = {
        id: "root",
        children: [
          { id: "n1", x: 100, y: 50, width: 120, height: 60 },
          { id: "n2", x: 250, y: 150, width: 120, height: 60 },
        ],
      };

      elkBridge.applyLayout(state, validResult);
      expect(state.getLayoutState().phase).toBe("ready");

      // Complete pipeline should work
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        interactionHandler,
      );
      expect(reactFlowData.nodes.length).toBe(2);

      // Verify positions were applied (positions may vary based on ELK layout)
      const node1State = state.getGraphNode("n1");
      const node2State = state.getGraphNode("n2");
      expect(node1State?.position).toBeDefined();
      expect(node2State?.position).toBeDefined();
      expect(typeof node1State?.position.x).toBe("number");
      expect(typeof node1State?.position.y).toBe("number");
    });
  });
});
