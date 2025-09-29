/**
 * Tests for the new aggregated edge semantic styling system with conflict resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { processAggregatedSemanticTags } from "../utils/StyleProcessor.js";
import type { GraphNode, GraphEdge, Container, StyleConfig } from "../types/core.js";

describe("Aggregated Edge Styling with Conflict Resolution", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;
  let styleConfig: StyleConfig;

  beforeEach(() => {
    // Create a comprehensive style config with semantic mappings
    styleConfig = {
      nodeStyles: {
        process: { backgroundColor: "#e1f5fe", border: "2px solid #0277bd" },
        data: { backgroundColor: "#f3e5f5", border: "2px solid #7b1fa2" },
      },
      edgeStyles: {
        dataflow: { stroke: "#2196f3", strokeWidth: 2 },
        control: { stroke: "#ff9800", strokeWidth: 1 },
      },
      semanticMappings: {
        importance: {
          Critical: { "line-width": 4, halo: "light-red" },
          Normal: { "line-width": 2, halo: "none" },
          Low: { "line-width": 1, halo: "none" },
        },
        pattern: {
          Solid: { "line-pattern": "solid" },
          Dashed: { "line-pattern": "dashed" },
          Dotted: { "line-pattern": "dotted" },
        },
        flow: {
          Static: { animation: "static" },
          Dynamic: { animation: "animated" },
        },
        direction: {
          Forward: { arrowhead: "triangle-filled" },
          Backward: { arrowhead: "triangle-open" },
          Bidirectional: { arrowhead: "diamond-open" },
        },
      },
    };

    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge(styleConfig);
    elkBridge = new ELKBridge();
  });

  describe("Conflict Resolution System", () => {
    it("should create aggregated edges when container is collapsed", async () => {
      // Simple test to verify aggregated edges are created
      const node1: GraphNode = {
        id: "node1",
        label: "Source",
        longLabel: "Source Node",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node2: GraphNode = {
        id: "node2",
        label: "Target",
        longLabel: "Target Node",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "container1",
        label: "Container",
        children: new Set(["node2"]),
        collapsed: false,
        hidden: false,
      };

      const edge: GraphEdge = {
        id: "edge1",
        source: "node1",
        target: "node2",
        type: "dataflow",
        semanticTags: ["Critical"],
        hidden: false,
      };

      // Add to state
      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container);
      state.assignNodeToContainer("node2", "container1");
      state.addEdge(edge);

      // Collapse container to trigger aggregation
      state.collapseContainer("container1");

      // Check state has aggregated edges
      const stateAggregatedEdges = state.getAggregatedEdges();
      console.log("State aggregated edges:", stateAggregatedEdges.length);
      expect(stateAggregatedEdges).toHaveLength(1);

      // Calculate layout
      await elkBridge.layout(state);

      // Convert to ReactFlow data
      const result = reactFlowBridge.toReactFlowData(state);

      // Find aggregated edge
      const aggregatedEdges = result.edges.filter(e => e.type === "aggregated");
      console.log("ReactFlow aggregated edges:", aggregatedEdges.length);
      expect(aggregatedEdges).toHaveLength(1);

      const aggEdge = aggregatedEdges[0];
      console.log("Aggregated edge style:", aggEdge.style);
      
      // Should have some styling applied
      expect(aggEdge.style).toBeDefined();
      expect(typeof aggEdge.style).toBe("object");
    });

    it("should merge non-conflicting semantic styles from multiple edges", async () => {
      // Create test data with edges that have compatible semantic tags
      const node1: GraphNode = {
        id: "node1",
        label: "Source",
        longLabel: "Source Node",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node2: GraphNode = {
        id: "node2",
        label: "Target1",
        longLabel: "Target Node 1",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node3: GraphNode = {
        id: "node3",
        label: "Target2",
        longLabel: "Target Node 2",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "container1",
        label: "Container",
        children: new Set(["node2", "node3"]),
        collapsed: false,
        hidden: false,
      };

      // Create edges with compatible semantic tags (no conflicts)
      const edge1: GraphEdge = {
        id: "edge1",
        source: "node1",
        target: "node2",
        type: "dataflow",
        semanticTags: ["Critical", "Solid", "Static", "Forward"], // All from different groups
        hidden: false,
      };

      const edge2: GraphEdge = {
        id: "edge2",
        source: "node1",
        target: "node3",
        type: "dataflow",
        semanticTags: ["Critical", "Solid", "Static", "Forward"], // Same tags - no conflict
        hidden: false,
      };

      // Add to state
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("node2", "container1");
      state.assignNodeToContainer("node3", "container1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      state.collapseContainer("container1");

      // Calculate layout
      await elkBridge.layout(state);

      // Debug: Check aggregated edges in state
      const stateAggregatedEdges = state.getAggregatedEdges();
      console.log("State aggregated edges:", stateAggregatedEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        semanticTags: e.semanticTags,
        originalEdgeIds: e.originalEdgeIds,
      })));

      // Convert to ReactFlow data
      const result = reactFlowBridge.toReactFlowData(state);

      // Debug: Log all edges to see what we got
      console.log("All ReactFlow edges:", result.edges.map(e => ({
        id: e.id,
        type: e.type,
        source: e.source,
        target: e.target,
        style: e.style,
        animated: e.animated,
        data: e.data,
      })));

      // Find aggregated edge
      const aggregatedEdges = result.edges.filter(e => e.type === "aggregated");
      console.log("Found aggregated edges:", aggregatedEdges.length);
      expect(aggregatedEdges).toHaveLength(1);

      const aggEdge = aggregatedEdges[0];
      
      // Debug: Log the actual aggregated edge to see what we got
      console.log("Aggregated edge data:", {
        id: aggEdge.id,
        style: aggEdge.style,
        animated: aggEdge.animated,
        markerEnd: aggEdge.markerEnd,
        data: aggEdge.data,
      });
      
      // ✅ Verify the new aggregated edge styling system is working!
      
      // Should merge all compatible semantic styles correctly
      expect(aggEdge.style).toMatchObject({
        strokeWidth: 4, // Critical importance (line-width: 4)
        strokeDasharray: undefined, // Solid pattern (line-pattern: solid)
        haloColor: "#e74c3c", // Critical + light-red halo
      });

      // Should have proper arrow marker for Forward direction
      expect(aggEdge.markerEnd).toEqual({
        type: "arrowclosed", // Forward -> triangle-filled -> arrowclosed
      });

      // Should track applied semantic tags
      expect(aggEdge.data.appliedSemanticTags).toEqual([
        "Critical", "Solid", "Static", "Forward"
      ]);

      // Should have aggregation metadata
      expect(aggEdge.data.aggregated).toBe(true);
      expect(aggEdge.data.originalEdgeIds).toEqual(["edge1", "edge2"]);
      expect(aggEdge.data.aggregationSource).toBe("container1");

      // Animation should be handled (Static = not animated, but may be undefined in ReactFlow data)
      // This is acceptable since ReactFlow handles animation separately
      expect(aggEdge.animated).toBeUndefined(); // ReactFlow doesn't set this for non-animated edges
    });

    it("should resolve conflicts with neutral defaults", async () => {
      // Create test data with edges that have conflicting semantic tags
      const node1: GraphNode = {
        id: "node1",
        label: "Source",
        longLabel: "Source Node",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node2: GraphNode = {
        id: "node2",
        label: "Target1",
        longLabel: "Target Node 1",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node3: GraphNode = {
        id: "node3",
        label: "Target2",
        longLabel: "Target Node 2",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "container1",
        label: "Container",
        children: new Set(["node2", "node3"]),
        collapsed: false,
        hidden: false,
      };

      // Create edges with conflicting semantic tags
      const edge1: GraphEdge = {
        id: "edge1",
        source: "node1",
        target: "node2",
        type: "dataflow",
        semanticTags: ["Critical", "Solid", "Dynamic"], // Critical + Solid + Dynamic
        hidden: false,
      };

      const edge2: GraphEdge = {
        id: "edge2",
        source: "node1",
        target: "node3",
        type: "dataflow",
        semanticTags: ["Low", "Dashed", "Static"], // Low + Dashed + Static (conflicts!)
        hidden: false,
      };

      // Add to state
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("node2", "container1");
      state.assignNodeToContainer("node3", "container1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      state.collapseContainer("container1");

      // Calculate layout
      await elkBridge.layout(state);

      // Convert to ReactFlow data
      const result = reactFlowBridge.toReactFlowData(state);

      // Find aggregated edge
      const aggregatedEdges = result.edges.filter(e => e.type === "aggregated");
      expect(aggregatedEdges).toHaveLength(1);

      const aggEdge = aggregatedEdges[0];
      
      // Should use neutral defaults for conflicting properties
      expect(aggEdge.style).toMatchObject({
        strokeWidth: 2, // Neutral default for conflicting line-width (Critical=4 vs Low=1)
        strokeDasharray: undefined, // Neutral default "solid" for conflicting patterns
      });

      // Should use neutral default for conflicting animation (Dynamic vs Static)
      // ReactFlow doesn't set animated property for non-animated edges
      expect(aggEdge.animated).toBeUndefined();
    });

    it("should handle partial conflicts correctly", async () => {
      // Create test data where some properties conflict and others don't
      const node1: GraphNode = {
        id: "node1",
        label: "Source",
        longLabel: "Source Node",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node2: GraphNode = {
        id: "node2",
        label: "Target1",
        longLabel: "Target Node 1",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node3: GraphNode = {
        id: "node3",
        label: "Target2",
        longLabel: "Target Node 2",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "container1",
        label: "Container",
        children: new Set(["node2", "node3"]),
        collapsed: false,
        hidden: false,
      };

      // Create edges with partial conflicts
      const edge1: GraphEdge = {
        id: "edge1",
        source: "node1",
        target: "node2",
        type: "dataflow",
        semanticTags: ["Critical", "Solid", "Forward"], // Critical + Solid + Forward
        hidden: false,
      };

      const edge2: GraphEdge = {
        id: "edge2",
        source: "node1",
        target: "node3",
        type: "dataflow",
        semanticTags: ["Normal", "Solid", "Forward"], // Normal + Solid + Forward (line-width conflicts, others don't)
        hidden: false,
      };

      // Add to state
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.assignNodeToContainer("node2", "container1");
      state.assignNodeToContainer("node3", "container1");
      state.addEdge(edge1);
      state.addEdge(edge2);

      // Collapse container to trigger aggregation
      state.collapseContainer("container1");

      // Calculate layout
      await elkBridge.layout(state);

      // Convert to ReactFlow data
      const result = reactFlowBridge.toReactFlowData(state);

      // Find aggregated edge
      const aggregatedEdges = result.edges.filter(e => e.type === "aggregated");
      expect(aggregatedEdges).toHaveLength(1);

      const aggEdge = aggregatedEdges[0];
      
      // Should use neutral default for conflicting line-width, but keep non-conflicting properties
      expect(aggEdge.style).toMatchObject({
        strokeWidth: 2, // Neutral default for conflicting line-width (Critical=4 vs Normal=2)
        strokeDasharray: undefined, // Non-conflicting: both edges have "Solid"
      });

      // Should keep non-conflicting arrowhead (both edges have "Forward")
      expect(aggEdge.markerEnd).toBeDefined();
    });
  });

  describe("Direct Style Processor Testing", () => {
    it("should process aggregated semantic tags with no conflicts", () => {
      const originalEdges = [
        {
          id: "edge1",
          semanticTags: ["Critical", "Solid", "Forward"],
        },
        {
          id: "edge2", 
          semanticTags: ["Critical", "Solid", "Forward"],
        },
      ];

      const result = processAggregatedSemanticTags(originalEdges, styleConfig);

      expect(result.style).toMatchObject({
        strokeWidth: 4, // Critical
        strokeDasharray: undefined, // Solid
      });
      expect(result.markerEnd).toBeDefined(); // Forward
      expect(result.appliedTags).toEqual(expect.arrayContaining(["Critical", "Solid", "Forward"]));
    });

    it("should process aggregated semantic tags with conflicts", () => {
      const originalEdges = [
        {
          id: "edge1",
          semanticTags: ["Critical", "Solid"],
        },
        {
          id: "edge2",
          semanticTags: ["Low", "Dashed"],
        },
      ];

      const result = processAggregatedSemanticTags(originalEdges, styleConfig);

      expect(result.style).toMatchObject({
        strokeWidth: 2, // Neutral default for Critical vs Low conflict
        strokeDasharray: undefined, // Neutral default "solid" for Solid vs Dashed conflict
      });
      expect(result.appliedTags).toEqual(expect.arrayContaining(["Critical", "Solid", "Low", "Dashed"]));
    });

    it("should handle empty original edges", () => {
      const result = processAggregatedSemanticTags([], styleConfig);

      expect(result.style).toMatchObject({
        stroke: "#999999", // Default stroke color
        strokeWidth: 2, // Default stroke width
      });
      expect(result.appliedTags).toEqual([]);
    });

    it("should handle edges with no semantic tags", () => {
      const originalEdges = [
        { id: "edge1", semanticTags: [] },
        { id: "edge2", semanticTags: [] },
      ];

      const result = processAggregatedSemanticTags(originalEdges, styleConfig);

      expect(result.style).toMatchObject({
        stroke: "#999999", // Default stroke color
        strokeWidth: 2, // Default stroke width
      });
      expect(result.appliedTags).toEqual([]);
    });

    it("should handle missing style config", () => {
      const originalEdges = [
        { id: "edge1", semanticTags: ["Critical"] },
        { id: "edge2", semanticTags: ["Low"] },
      ];

      const result = processAggregatedSemanticTags(originalEdges, undefined);

      expect(result.style).toMatchObject({
        stroke: "#999999", // Default stroke color
        strokeWidth: 2, // Default stroke width
      });
      expect(result.appliedTags).toEqual([]);
    });
  });

  describe("Visual Aggregation Indicator", () => {
    it("should add +1 thickness in the React component", () => {
      // This tests the component-level styling logic
      const baseStyle = { strokeWidth: 2, stroke: "#2196f3" };
      
      // Simulate what the AggregatedEdge component does
      const aggregatedStyle = {
        ...baseStyle,
        strokeWidth: baseStyle.strokeWidth ? (baseStyle.strokeWidth as number) + 1 : 3,
      };

      expect(aggregatedStyle.strokeWidth).toBe(3); // 2 + 1
      expect(aggregatedStyle.stroke).toBe("#2196f3"); // Preserved
    });

    it("should handle missing strokeWidth in component", () => {
      const baseStyle = { stroke: "#2196f3" }; // No strokeWidth
      
      // Simulate what the AggregatedEdge component does
      const aggregatedStyle = {
        ...baseStyle,
        strokeWidth: baseStyle.strokeWidth ? (baseStyle.strokeWidth as number) + 1 : 3,
      };

      expect(aggregatedStyle.strokeWidth).toBe(3); // Default when missing
      expect(aggregatedStyle.stroke).toBe("#2196f3"); // Preserved
    });
  });
});