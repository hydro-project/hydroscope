/**
 * Integration Tests: VisualizationState + ReactFlowBridge
 *
 * Tests the complete rendering pipeline with paxos.json data
 * Verifies container states render correctly (collapsed vs expanded)
 * Tests style application with paxos.json semantic tags
 * Validates render data immutability
 *
 * Requirements: 7.3, 4.2, 4.3
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import {
  loadPaxosTestData,
  createTestNode,
  createTestEdge,
  createTestContainer,
} from "../utils/testData.js";
import type { StyleConfig, ReactFlowNode, RawNodeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("VisualizationState + ReactFlowBridge Integration", () => {
  let state: VisualizationState;
  let bridge: ReactFlowBridge;
  let elkBridge: ELKBridge;
  let interactionHandler: InteractionHandler;
  let styleConfig: StyleConfig;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "layered",
      direction: "DOWN",
      spacing: 50,
      nodeSpacing: 20,
      layerSpacing: 25,
    });

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

    bridge = new ReactFlowBridge(styleConfig);
    interactionHandler = new InteractionHandler(state);
  });

  describe("Complete Rendering Pipeline with Paxos.json", () => {
    it("should process complete paxos.json rendering pipeline successfully", async () => {
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

      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      // Convert to ReactFlow format
      const reactFlowData = bridge.toReactFlowData(state);

      // Verify ReactFlow data structure
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.nodes)).toBe(true);
      expect(Array.isArray(reactFlowData.edges)).toBe(true);

      // Should have nodes
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      // Verify all nodes have required ReactFlow properties
      for (const node of reactFlowData.nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.data).toBeDefined();
        expect(node.data.label).toBeDefined();
        expect(node.data.nodeType).toBeDefined();

        // Verify position is valid
        expect(typeof node.position.x).toBe("number");
        expect(typeof node.position.y).toBe("number");
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }

      // Verify all edges have required ReactFlow properties
      for (const edge of reactFlowData.edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.type).toBeDefined();
      }

      // Verify styles are applied
      const styledNodes = reactFlowData.nodes.filter((node) => node.style);
      expect(styledNodes.length).toBeGreaterThan(0);
    });

    it("should handle empty paxos.json gracefully", async () => {
      // Test with minimal data when paxos.json is not available
      const node1 = createTestNode("n1", "Test Node 1");
      const node2 = createTestNode("n2", "Test Node 2");
      const edge1 = createTestEdge("e1", "n1", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge1);

      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      // Convert to ReactFlow format
      const reactFlowData = bridge.toReactFlowData(state);

      // Should handle minimal data correctly
      expect(reactFlowData.nodes).toHaveLength(2);
      expect(reactFlowData.edges).toHaveLength(1);

      // Verify node structure
      expect(reactFlowData.nodes[0].id).toBe("n1");
      expect(reactFlowData.nodes[0].data.label).toBe("Test Node 1");
      expect(reactFlowData.nodes[1].id).toBe("n2");
      expect(reactFlowData.nodes[1].data.label).toBe("Test Node 2");

      // Verify edge structure
      expect(reactFlowData.edges[0].id).toBe("e1");
      expect(reactFlowData.edges[0].source).toBe("n1");
      expect(reactFlowData.edges[0].target).toBe("n2");
    });

    it("should handle paxos.json node types and apply correct styles", async () => {
      // Load real paxos.json data
      const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
      const paxosContent = fs.readFileSync(paxosPath, "utf-8");
      const rawPaxosData = JSON.parse(paxosContent);

      // Convert raw paxos data to test format
      const paxosNodes = rawPaxosData.nodes
        .slice(0, 20)
        .map((node: RawNodeData) => ({
          id: node.id,
          label: node.shortLabel || node.label || `Node ${node.id}`,
          longLabel:
            node.fullLabel || node.longLabel || node.label || `Node ${node.id}`,
          type: node.nodeType || node.type || "node",
          semanticTags: node.semanticTags || [],
          hidden: false,
        }));

      // Add nodes to state
      for (const node of paxosNodes) {
        state.addNode(node);
      }

      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      // Convert to ReactFlow format
      const reactFlowData = bridge.toReactFlowData(state);

      // Check that different node types get different styles
      const nodesByType = new Map<string, ReactFlowNode[]>();
      for (const node of reactFlowData.nodes) {
        const nodeType = node.data.nodeType;
        if (!nodesByType.has(nodeType)) {
          nodesByType.set(nodeType, []);
        }
        nodesByType.get(nodeType)!.push(node);
      }

      // Should have multiple node types from paxos.json
      expect(nodesByType.size).toBeGreaterThan(1);

      // Verify different types have different styles
      const stylesByType = new Map<string, Record<string, string | number>>();
      for (const [nodeType, nodes] of nodesByType) {
        if (nodes.length > 0 && nodes[0].style) {
          stylesByType.set(nodeType, nodes[0].style);
        }
      }

      // Should have styles for different types
      expect(stylesByType.size).toBeGreaterThan(0);
    });
  });

  describe("Container State Rendering", () => {
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

    it("should render collapsed containers correctly", async () => {
      // Collapse the container
      state.collapseContainer("c1");

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Should have container node and external node
      expect(reactFlowData.nodes.length).toBe(2); // container + n3

      // Find container node
      const containerNode = reactFlowData.nodes.find(
        (node) => node.id === "c1",
      );
      expect(containerNode).toBeDefined();
      expect(containerNode!.type).toBe("standard"); // Collapsed containers use 'standard' type for edge connections
      expect(containerNode!.data.collapsed).toBe(true);
      expect(containerNode!.data.containerChildren).toBe(2);
      expect(containerNode!.data.label).toBe("Container 1");

      // Should have collapsed container style
      expect(containerNode!.style).toMatchObject(
        styleConfig.containerStyles!.collapsed,
      );

      // Should have aggregated edges
      const aggregatedEdges = reactFlowData.edges.filter(
        (edge) => edge.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBeGreaterThan(0);
    });

    it("should render expanded containers correctly", async () => {
      // Ensure container is expanded
      state.expandContainer("c1");

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Should have all nodes visible
      expect(reactFlowData.nodes.length).toBe(4); // n1, n2, n3, container boundary

      // Find container node
      const containerNode = reactFlowData.nodes.find(
        (node) => node.id === "c1",
      );
      expect(containerNode).toBeDefined();
      expect(containerNode!.type).toBe("container");
      expect(containerNode!.data.collapsed).toBe(false);
      expect(containerNode!.data.containerChildren).toBe(2);

      // Should have expanded container style
      expect(containerNode!.style).toMatchObject(
        styleConfig.containerStyles!.expanded,
      );

      // Should have original edges (not aggregated)
      const originalEdges = reactFlowData.edges.filter(
        (edge) => edge.type !== "aggregated",
      );
      expect(originalEdges.length).toBe(2); // e1 and e2
    });

    it("should handle container toggle operations", async () => {
      // Start expanded
      state.expandContainer("c1");
      await elkBridge.layout(state);
      let reactFlowData = bridge.toReactFlowData(state);
      let containerNode = reactFlowData.nodes.find((node) => node.id === "c1");
      expect(containerNode!.data.collapsed).toBe(false);

      // Toggle to collapsed
      state.collapseContainer("c1");
      await elkBridge.layout(state);
      reactFlowData = bridge.toReactFlowData(state);

      bridge.toReactFlowData(state);
      containerNode = reactFlowData.nodes.find((node) => node.id === "c1");
      expect(containerNode!.data.collapsed).toBe(true);

      // Toggle back to expanded
      state.expandContainer("c1");
      await elkBridge.layout(state);
      reactFlowData = bridge.toReactFlowData(state);
      containerNode = reactFlowData.nodes.find((node) => node.id === "c1");
      expect(containerNode!.data.collapsed).toBe(false);
    });

    it("should handle bulk container operations", async () => {
      // Add another container
      const container2 = createTestContainer("c2", ["n3"], "Container 2");
      state.addContainer(container2);
      state.assignNodeToContainer("n3", "c2");

      // Expand all
      state.expandAllContainers();
      await elkBridge.layout(state);
      let reactFlowData = bridge.toReactFlowData(state);

      const expandedContainers = reactFlowData.nodes.filter(
        (node) => node.type === "container" && node.data.collapsed === false,
      );
      expect(expandedContainers.length).toBe(2);

      // Collapse all
      state.collapseAllContainers();
      await elkBridge.layout(state);
      reactFlowData = bridge.toReactFlowData(state);

      const collapsedContainers = reactFlowData.nodes.filter(
        (node) =>
          node.data.nodeType === "container" && node.data.collapsed === true,
      );
      expect(collapsedContainers.length).toBe(2);
    });
  });

  describe("Style Application with Semantic Tags", () => {
    it("should apply node styles based on type", async () => {
      // Create nodes with different types from paxos.json
      const sourceNode = createTestNode("source1", "Source Node");
      sourceNode.type = "Source";

      const transformNode = createTestNode("transform1", "Transform Node");
      transformNode.type = "Transform";

      const sinkNode = createTestNode("sink1", "Sink Node");
      sinkNode.type = "Sink";

      state.addNode(sourceNode);
      state.addNode(transformNode);
      state.addNode(sinkNode);

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Find nodes by type and verify styles
      const sourceReactNode = reactFlowData.nodes.find(
        (n) => n.id === "source1",
      );
      const transformReactNode = reactFlowData.nodes.find(
        (n) => n.id === "transform1",
      );
      const sinkReactNode = reactFlowData.nodes.find((n) => n.id === "sink1");

      expect(sourceReactNode!.style).toMatchObject(
        styleConfig.nodeStyles!["Source"],
      );
      expect(transformReactNode!.style).toMatchObject(
        styleConfig.nodeStyles!["Transform"],
      );
      expect(sinkReactNode!.style).toMatchObject(
        styleConfig.nodeStyles!["Sink"],
      );
    });

    it("should apply edge styles based on type", async () => {
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");

      const dataflowEdge = createTestEdge("e1", "n1", "n2");
      dataflowEdge.type = "dataflow";

      const controlEdge = createTestEdge("e2", "n2", "n3");
      controlEdge.type = "control";

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addEdge(dataflowEdge);
      state.addEdge(controlEdge);

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Find edges by type and verify styles
      const dataflowReactEdge = reactFlowData.edges.find((e) => e.id === "e1");
      const controlReactEdge = reactFlowData.edges.find((e) => e.id === "e2");

      expect(dataflowReactEdge!.style).toMatchObject(
        styleConfig.edgeStyles!["dataflow"],
      );
      expect(controlReactEdge!.style).toMatchObject(
        styleConfig.edgeStyles!["control"],
      );
    });

    it("should apply aggregated edge styles", async () => {
      // Set up container with edges that will be aggregated
      const node1 = createTestNode("n1", "Node 1");
      const node2 = createTestNode("n2", "Node 2");
      const node3 = createTestNode("n3", "Node 3");
      const container = createTestContainer("c1", ["n1", "n2"], "Container");
      const edge = createTestEdge("e1", "n1", "n3");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.addEdge(edge);

      // Collapse container to trigger edge aggregation
      state.collapseContainer("c1");

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Find aggregated edges
      const aggregatedEdges = reactFlowData.edges.filter(
        (e) => e.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      // Verify aggregated edge style - with new semantic styling system
      for (const aggEdge of aggregatedEdges) {
        expect(aggEdge.style).toMatchObject({
          strokeWidth: 2, // Default thickness (component adds +1 when rendering)
          stroke: "#999999", // Default stroke color for unstyled edges
        });
      }
    });

    it("should handle semantic tags on paxos.json nodes", async () => {
      // Load paxos.json data which may have semantic tags
      const paxosData = loadPaxosTestData();

      // Add nodes with semantic tags
      for (const node of paxosData.nodes) {
        if (node.semanticTags && node.semanticTags.length > 0) {
          state.addNode(node);
        }
      }

      if (state.visibleNodes.length > 0) {
        // Calculate layout so nodes have positions

        await elkBridge.layout(state);

        const reactFlowData = bridge.toReactFlowData(state);

        // Verify nodes with semantic tags are processed
        for (const node of reactFlowData.nodes) {
          expect(node.data.semanticTags).toBeDefined();
          if (node.data.semanticTags && node.data.semanticTags.length > 0) {
            // Should have applied semantic tags data
            expect(Array.isArray(node.data.semanticTags)).toBe(true);
          }
        }
      }
    });
  });

  describe("Interaction Handler Integration", () => {
    it("should attach click handlers when interaction handler provided", async () => {
      const node = createTestNode("n1", "Test Node");
      const container = createTestContainer("c1", ["n1"], "Test Container");

      state.addNode(node);
      state.addContainer(container);

      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      // Convert with interaction handler
      const reactFlowData = bridge.toReactFlowData(state, interactionHandler);

      // All nodes should have onClick handlers
      for (const reactNode of reactFlowData.nodes) {
        expect(reactNode.data.onClick).toBeDefined();
        expect(typeof reactNode.data.onClick).toBe("function");
      }
    });

    it("should not attach click handlers when no interaction handler provided", async () => {
      const node = createTestNode("n1", "Test Node");
      const container = createTestContainer("c1", ["n1"], "Test Container");

      state.addNode(node);
      state.addContainer(container);

      // Convert without interaction handler
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // No nodes should have onClick handlers
      for (const reactNode of reactFlowData.nodes) {
        expect(reactNode.data.onClick).toBeUndefined();
      }
    });

    it("should handle node label toggle through click handlers", async () => {
      // Use fresh state and handler to avoid test interference
      const freshState = new VisualizationState();
      // Disable debouncing for synchronous testing
      const freshHandler = new InteractionHandler(freshState, undefined, {
        enableClickDebouncing: false,
      });

      const node = createTestNode("n1", "Short");
      node.longLabel = "Very Long Label";

      freshState.addNode(node);

      // Calculate layout so nodes have positions
      await elkBridge.layout(freshState);

      // Convert with interaction handler
      const reactFlowData = bridge.toReactFlowData(freshState, freshHandler);

      // Initial state should show short label
      const reactNode = reactFlowData.nodes.find((n) => n.id === "n1");
      expect(reactNode!.data.label).toBe("Short");
      expect(reactNode!.data.showingLongLabel).toBeUndefined();

      // Verify initial state in VisualizationState
      const initialStateNode = freshState.getGraphNode("n1");
      expect(initialStateNode?.showingLongLabel).toBeUndefined();

      // Simulate click to toggle label
      const onClick = reactNode!.data.onClick!;
      onClick("n1", "node");

      // Check state after click
      const stateNodeAfterClick = freshState.getGraphNode("n1");
      expect(stateNodeAfterClick?.showingLongLabel).toBe(true);

      // Clear cache to ensure fresh conversion
      bridge.clearCaches();

      // Get updated ReactFlow data
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const updatedReactFlowData = bridge.toReactFlowData(
        freshState,
        freshHandler,
      );
      const updatedReactNode = updatedReactFlowData.nodes.find(
        (n) => n.id === "n1",
      );

      expect(updatedReactNode!.data.label).toBe("Very Long Label");
      expect(updatedReactNode!.data.showingLongLabel).toBe(true);
    });

    it("should handle container toggle through click handlers", async () => {
      // Use fresh state and handler to avoid test interference
      const freshState = new VisualizationState();
      // Disable debouncing for synchronous testing
      const freshHandler = new InteractionHandler(freshState, undefined, {
        enableClickDebouncing: false,
      });

      const container = createTestContainer("c1", ["n1"], "Test Container");
      const node = createTestNode("n1", "Node 1");

      freshState.addNode(node);
      freshState.addContainer(container);
      freshState.assignNodeToContainer("n1", "c1");

      // Start with expanded container
      freshState.expandContainer("c1");

      // Calculate layout so nodes have positions
      await elkBridge.layout(freshState);

      // Convert with interaction handler
      const reactFlowData = bridge.toReactFlowData(freshState, freshHandler);

      // Initial state should be expanded
      const containerNode = reactFlowData.nodes.find((n) => n.id === "c1");
      expect(containerNode!.data.collapsed).toBe(false);

      // Simulate click to toggle container
      const onClick = containerNode!.data.onClick!;
      onClick("c1", "container");

      // Get updated ReactFlow data
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const updatedReactFlowData = bridge.toReactFlowData(
        freshState,
        freshHandler,
      );
      const updatedContainerNode = updatedReactFlowData.nodes.find(
        (n) => n.id === "c1",
      );

      expect(updatedContainerNode!.data.collapsed).toBe(true);
    });
  });

  describe("Render Data Immutability", () => {
    it("should return immutable ReactFlow data", async () => {
      const node = createTestNode("n1", "Test Node");
      const edge = createTestEdge("e1", "n1", "n1"); // Self-loop for simplicity

      state.addNode(node);
      state.addEdge(edge);

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const result1 = bridge.toReactFlowData(state);
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const result2 = bridge.toReactFlowData(state);

      // Results should be equal but not the same object
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
      expect(result1.nodes).not.toBe(result2.nodes);
      expect(result1.edges).not.toBe(result2.edges);
    });

    it("should freeze ReactFlow data objects", async () => {
      const node = createTestNode("n1", "Test Node");
      const edge = createTestEdge("e1", "n1", "n1");

      state.addNode(node);
      state.addEdge(edge);

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const result = bridge.toReactFlowData(state);

      // Top-level objects should be frozen
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.nodes)).toBe(true);
      expect(Object.isFrozen(result.edges)).toBe(true);

      // Individual nodes should be frozen
      expect(Object.isFrozen(result.nodes[0])).toBe(true);
      expect(Object.isFrozen(result.nodes[0].data)).toBe(true);
      expect(Object.isFrozen(result.nodes[0].position)).toBe(true);

      if (result.nodes[0].style) {
        expect(Object.isFrozen(result.nodes[0].style)).toBe(true);
      }

      // Individual edges should be frozen
      expect(Object.isFrozen(result.edges[0])).toBe(true);
      if (result.edges[0].style) {
        expect(Object.isFrozen(result.edges[0].style)).toBe(true);
      }
    });

    it("should not modify original state data", async () => {
      const originalNode = createTestNode("n1", "Original Label");
      state.addNode(originalNode);

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const result = bridge.toReactFlowData(state);

      // Try to modify the result - should throw error due to immutability
      expect(() => {
        (result.nodes[0].data as Record<string, unknown>).label = "Modified";
      }).toThrow();

      // Original should be unchanged
      const stateNode = state.getGraphNode("n1");
      expect(stateNode?.label).toBe("Original Label");
    });

    it("should handle performance optimizations with large datasets", async () => {
      // Create a moderately large dataset
      for (let i = 0; i < 100; i++) {
        state.addNode(createTestNode(`n${i}`, `Node ${i}`));
      }
      for (let i = 0; i < 150; i++) {
        const source = `n${i % 100}`;
        const target = `n${(i + 1) % 100}`;
        state.addEdge(createTestEdge(`e${i}`, source, target));
      }

      // Should handle large dataset efficiently
      const startTime = Date.now();
      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const result = bridge.toReactFlowData(state);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should have correct number of elements
      expect(result.nodes.length).toBe(100);
      expect(result.edges.length).toBe(150);

      // All elements should be properly formatted
      for (const node of result.nodes) {
        expect(node.id).toBeDefined();
        expect(node.data.label).toBeDefined();
      }
      for (const edge of result.edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });

    it("should clear caches when needed", async () => {
      const node = createTestNode("n1", "Test Node");
      state.addNode(node);

      // Generate result to populate cache
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const result1 = bridge.toReactFlowData(state);

      // Clear caches
      bridge.clearCaches();

      // Generate result again
      // Calculate layout so nodes have positions
      await elkBridge.layout(state);

      const result2 = bridge.toReactFlowData(state);

      // Results should be equal but cache should have been cleared
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
    });
  });

  describe("Edge Aggregation Rendering", () => {
    it("should render aggregated edges with proper data", async () => {
      // Set up scenario that creates aggregated edges
      const node1 = createTestNode("n1", "Internal Node 1");
      const node2 = createTestNode("n2", "Internal Node 2");
      const node3 = createTestNode("n3", "External Node");
      const container = createTestContainer("c1", ["n1", "n2"], "Container");
      const edge1 = createTestEdge("e1", "n1", "n3");
      const edge2 = createTestEdge("e2", "n3", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      state.collapseContainer("c1");

      // Calculate layout so nodes have positions

      await elkBridge.layout(state);

      const reactFlowData = bridge.toReactFlowData(state);

      // Should have aggregated edges
      const aggregatedEdges = reactFlowData.edges.filter(
        (e) => e.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      // Verify aggregated edge properties
      for (const aggEdge of aggregatedEdges) {
        expect(aggEdge.data).toBeDefined();
        expect(aggEdge.data!.aggregated).toBe(true);
        expect(aggEdge.data!.originalEdgeIds).toBeDefined();
        expect(Array.isArray(aggEdge.data!.originalEdgeIds)).toBe(true);
        expect(aggEdge.data!.aggregationSource).toBeDefined();
      }
    });

    it("should restore original edges when container is expanded", async () => {
      // Set up aggregated scenario
      const node1 = createTestNode("n1", "Internal Node 1");
      const node2 = createTestNode("n2", "Internal Node 2");
      const node3 = createTestNode("n3", "External Node");
      const container = createTestContainer("c1", ["n1", "n2"], "Container");
      const edge1 = createTestEdge("e1", "n1", "n3");
      const edge2 = createTestEdge("e2", "n3", "n2");

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("n1", "c1");
      state.assignNodeToContainer("n2", "c1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Start collapsed
      state.collapseContainer("c1");
      await elkBridge.layout(state);
      let reactFlowData = bridge.toReactFlowData(state);

      // Should have aggregated edges
      let aggregatedEdges = reactFlowData.edges.filter(
        (e) => e.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBeGreaterThan(0);

      // Expand container
      state.expandContainer("c1");
      await elkBridge.layout(state);
      reactFlowData = bridge.toReactFlowData(state);

      // Should have original edges back
      const originalEdges = reactFlowData.edges.filter(
        (e) => e.type !== "aggregated",
      );
      expect(originalEdges.length).toBe(2); // e1 and e2

      // Should not have aggregated edges
      aggregatedEdges = reactFlowData.edges.filter(
        (e) => e.type === "aggregated",
      );
      expect(aggregatedEdges.length).toBe(0);
    });
  });
});
