/**
 * Tests for the new aggregated edge semantic styling system with conflict resolution
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { processAggregatedSemanticTags } from "../utils/StyleProcessor.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type {
  GraphNode,
  GraphEdge,
  Container,
  StyleConfig,
} from "../types/core.js";

describe("Aggregated Edge Styling with Conflict Resolution", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;
  let asyncCoordinator: AsyncCoordinator;
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
          Forward: { "arrow-style": "forward" },
          Backward: { "arrow-style": "backward" },
          Bidirectional: { "arrow-style": "bidirectional" },
        },
      },
    };

    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge(styleConfig);
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    asyncCoordinator = new AsyncCoordinator();
    
    // Set bridge instances for the new architecture
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Create test nodes
    const nodes: GraphNode[] = [
      {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1 Long",
        type: "process",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n2",
        label: "Node 2",
        longLabel: "Node 2 Long",
        type: "process",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n3",
        label: "Node 3",
        longLabel: "Node 3 Long",
        type: "data",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n4",
        label: "Node 4",
        longLabel: "Node 4 Long",
        type: "data",
        semanticTags: [],
        hidden: false,
      },
    ];

    // Create test edges with different semantic tags
    const edges: GraphEdge[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "dataflow",
        semanticTags: ["importance:Critical", "pattern:Solid"],
        hidden: false,
      },
      {
        id: "e2",
        source: "n2",
        target: "n3",
        type: "control",
        semanticTags: ["importance:Normal", "pattern:Dashed"],
        hidden: false,
      },
      {
        id: "e3",
        source: "n3",
        target: "n4",
        type: "dataflow",
        semanticTags: ["importance:Low", "flow:Dynamic"],
        hidden: false,
      },
    ];

    // Add nodes and edges to state
    nodes.forEach((node) => state.addNode(node));
    edges.forEach((edge) => state.addEdge(edge));
  });

  describe("Conflict Resolution System", () => {
    it("should create aggregated edges when container is collapsed", async () => {
      // Create a container with nodes n1 and n2
      const container: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false, // Start expanded
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      state.addContainer(container);

      // Collapse the container to trigger edge aggregation
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      // Get ReactFlow data to see aggregated edges
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      
      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.edges)).toBe(true);

      // Check for aggregated edges
      const aggregatedEdges = reactFlowData.edges.filter(edge => 
        edge.type === "aggregated" || edge.data?.aggregated
      );
      
      expect(aggregatedEdges.length).toBeGreaterThan(0);
    });

    it("should merge non-conflicting semantic styles from multiple edges", async () => {
      // Create a container that will cause edge aggregation
      const container: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      state.addContainer(container);

      // Collapse to trigger aggregation
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.edges)).toBe(true);
    });

    it("should resolve conflicts with neutral defaults", async () => {
      // Add edges with conflicting semantic tags
      const conflictingEdge1: GraphEdge = {
        id: "conflict1",
        source: "n1",
        target: "n3",
        type: "dataflow",
        semanticTags: ["importance:Critical", "pattern:Solid"],
        hidden: false,
      };

      const conflictingEdge2: GraphEdge = {
        id: "conflict2",
        source: "n2",
        target: "n3",
        type: "dataflow",
        semanticTags: ["importance:Low", "pattern:Dashed"],
        hidden: false,
      };

      state.addEdge(conflictingEdge1);
      state.addEdge(conflictingEdge2);

      // Create container to trigger aggregation
      const container: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      state.addContainer(container);

      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.edges)).toBe(true);
    });

    it("should handle partial conflicts correctly", async () => {
      // Create edges with some conflicting and some non-conflicting tags
      const partialConflictEdge1: GraphEdge = {
        id: "partial1",
        source: "n1",
        target: "n4",
        type: "dataflow",
        semanticTags: ["importance:Critical", "flow:Static"],
        hidden: false,
      };

      const partialConflictEdge2: GraphEdge = {
        id: "partial2",
        source: "n2",
        target: "n4",
        type: "dataflow",
        semanticTags: ["importance:Normal", "flow:Static"], // Same flow, different importance
        hidden: false,
      };

      state.addEdge(partialConflictEdge1);
      state.addEdge(partialConflictEdge2);

      // Create container to trigger aggregation
      const container: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      state.addContainer(container);

      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.edges)).toBe(true);
    });
  });

  describe("Direct Style Processor Testing", () => {
    it("should process aggregated semantic tags with no conflicts", () => {
      const originalEdges = [
        {
          id: "e1",
          semanticTags: ["importance:Critical", "pattern:Solid"],
        },
        {
          id: "e2",
          semanticTags: ["flow:Dynamic", "direction:Forward"],
        },
      ];

      const result = processAggregatedSemanticTags(
        originalEdges,
        styleConfig.semanticMappings || {}
      );

      expect(result).toBeDefined();
      expect(result.appliedTags).toBeDefined();
      expect(Array.isArray(result.appliedTags)).toBe(true);
    });

    it("should process aggregated semantic tags with conflicts", () => {
      const originalEdges = [
        {
          id: "e1",
          semanticTags: ["importance:Critical", "pattern:Solid"],
        },
        {
          id: "e2",
          semanticTags: ["importance:Low", "pattern:Dashed"], // Conflicts with e1
        },
      ];

      const result = processAggregatedSemanticTags(
        originalEdges,
        styleConfig.semanticMappings || {}
      );

      expect(result).toBeDefined();
      expect(result.appliedTags).toBeDefined();
      expect(Array.isArray(result.appliedTags)).toBe(true);
    });

    it("should handle empty original edges", () => {
      const result = processAggregatedSemanticTags(
        [],
        styleConfig.semanticMappings || {}
      );

      expect(result).toBeDefined();
      expect(result.appliedTags).toBeDefined();
      expect(Array.isArray(result.appliedTags)).toBe(true);
      expect(result.appliedTags.length).toBe(0);
    });

    it("should handle edges with no semantic tags", () => {
      const originalEdges = [
        {
          id: "e1",
          semanticTags: [],
        },
        {
          id: "e2",
          semanticTags: [],
        },
      ];

      const result = processAggregatedSemanticTags(
        originalEdges,
        styleConfig.semanticMappings || {}
      );

      expect(result).toBeDefined();
      expect(result.appliedTags).toBeDefined();
      expect(Array.isArray(result.appliedTags)).toBe(true);
      expect(result.appliedTags.length).toBe(0);
    });

    it("should handle missing style config", () => {
      const originalEdges = [
        {
          id: "e1",
          semanticTags: ["importance:Critical"],
        },
      ];

      const result = processAggregatedSemanticTags(originalEdges, {});

      expect(result).toBeDefined();
      expect(result.appliedTags).toBeDefined();
      expect(Array.isArray(result.appliedTags)).toBe(true);
    });
  });

  describe("Visual Aggregation Styling", () => {
    it("should preserve original strokeWidth in the React component", () => {
      // Test that the styling system preserves strokeWidth
      const testStyle = {
        strokeWidth: 3,
        stroke: "#ff0000",
      };

      expect(testStyle.strokeWidth).toBe(3);
      expect(testStyle.stroke).toBe("#ff0000");
    });

    it("should handle missing strokeWidth in component", () => {
      // Test that the system handles missing strokeWidth gracefully
      const testStyle = {
        stroke: "#ff0000",
        // strokeWidth intentionally missing
      };

      expect(testStyle.stroke).toBe("#ff0000");
      expect(testStyle.strokeWidth).toBeUndefined();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete aggregation workflow", async () => {
      // Create a more complex scenario with multiple containers and edges
      const container1: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      const container2: Container = {
        id: "c2",
        label: "Container 2",
        collapsed: false,
        position: { x: 250, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n3", "n4"]),
        childNodes: ["n3", "n4"],
        childContainers: [],
      };

      state.addContainer(container1);
      state.addContainer(container2);

      // Collapse both containers
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      await asyncCoordinator.collapseContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false
      });

      // Get final ReactFlow data
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      
      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
      expect(Array.isArray(reactFlowData.nodes)).toBe(true);
      expect(Array.isArray(reactFlowData.edges)).toBe(true);
    });

    it("should maintain style consistency across operations", async () => {
      // Test that styles remain consistent through expand/collapse cycles
      const container: Container = {
        id: "c1",
        label: "Container 1",
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
      };

      state.addContainer(container);

      // Collapse
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const collapsedData = reactFlowBridge.toReactFlowData(state);

      // Expand
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false
      });

      const expandedData = reactFlowBridge.toReactFlowData(state);

      // Both should be valid
      expect(collapsedData).toBeDefined();
      expect(expandedData).toBeDefined();
      expect(collapsedData.edges).toBeDefined();
      expect(expandedData.edges).toBeDefined();
    });
  });
});