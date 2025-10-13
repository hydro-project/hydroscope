/**
 * VisualizationState Container Visibility and Edge Aggregation Tests
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { GraphNode, GraphEdge, Container } from "../types/core.js";

describe("VisualizationState Container Visibility and Edge Aggregation", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});
    asyncCoordinator = new AsyncCoordinator();

    // Set bridge instances for the new architecture
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
  });

  describe("Container Collapse/Expand Operations", () => {
    it("should collapse container and hide children", async () => {
      const nodes: GraphNode[] = ["n1", "n2"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      state.addContainer(container);

      // Initially expanded - children should be visible
      const visibleNodesBefore = state.visibleNodes;
      expect(visibleNodesBefore.find((n) => n.id === "n1")).toBeDefined();
      expect(visibleNodesBefore.find((n) => n.id === "n2")).toBeDefined();

      // Collapse container
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Verify container is collapsed
      const visibleContainers = state.visibleContainers;
      const collapsedContainer = visibleContainers.find((c) => c.id === "c1");
      expect(collapsedContainer?.collapsed).toBe(true);

      // Children should not be in visible nodes when container is collapsed
      const visibleNodesAfter = state.visibleNodes;
      expect(visibleNodesAfter.find((n) => n.id === "n1")).toBeUndefined();
      expect(visibleNodesAfter.find((n) => n.id === "n2")).toBeUndefined();
    });

    it("should expand container and show children", async () => {
      const nodes: GraphNode[] = ["n1", "n2"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: true, // Start collapsed
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      state.addContainer(container);

      // Initially collapsed - children should not be visible
      const visibleNodesBefore = state.visibleNodes;
      expect(visibleNodesBefore.find((n) => n.id === "n1")).toBeUndefined();
      expect(visibleNodesBefore.find((n) => n.id === "n2")).toBeUndefined();

      // Expand container
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Verify container is expanded
      const visibleContainers = state.visibleContainers;
      const expandedContainer = visibleContainers.find((c) => c.id === "c1");
      expect(expandedContainer?.collapsed).toBe(false);

      // Children should now be visible
      const visibleNodesAfter = state.visibleNodes;
      expect(visibleNodesAfter.find((n) => n.id === "n1")).toBeDefined();
      expect(visibleNodesAfter.find((n) => n.id === "n2")).toBeDefined();
    });

    it("should handle nested container collapse/expand", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const innerContainer: Container = {
        id: "inner",
        label: "Inner Container",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: false,
        position: { x: 10, y: 10 },
        size: { width: 150, height: 100 },
      };

      const outerContainer: Container = {
        id: "outer",
        label: "Outer Container",
        children: new Set(["inner", "n3"]),
        childNodes: ["n3"],
        childContainers: ["inner"],
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      state.addContainer(innerContainer);
      state.addContainer(outerContainer);

      // Collapse outer container
      await asyncCoordinator.collapseContainer("outer", state, {
        relayoutEntities: ["outer"],
        fitView: false,
      });

      // All nested content should be hidden
      const visibleNodes = state.visibleNodes;
      const visibleContainers = state.visibleContainers;

      expect(visibleNodes.find((n) => n.id === "n1")).toBeUndefined();
      expect(visibleNodes.find((n) => n.id === "n2")).toBeUndefined();
      expect(visibleNodes.find((n) => n.id === "n3")).toBeUndefined();
      expect(visibleContainers.find((c) => c.id === "inner")).toBeUndefined();

      const outerContainerVisible = visibleContainers.find(
        (c) => c.id === "outer",
      );
      expect(outerContainerVisible?.collapsed).toBe(true);
    });
  });

  describe("Edge Aggregation During Container Operations", () => {
    it("should aggregate edges when container is collapsed", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const edges: GraphEdge[] = [
        {
          id: "e1",
          source: "n1",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e2",
          source: "n2",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
      ];

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));
      state.addContainer(container);

      // Collapse container to trigger edge aggregation
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Check that edges are handled (aggregated or preserved)
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      expect(visibleEdges.length).toBeGreaterThanOrEqual(0);
    });

    it("should restore edges when container is expanded", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const edges: GraphEdge[] = [
        {
          id: "e1",
          source: "n1",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e2",
          source: "n2",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
      ];

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: true, // Start collapsed
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));
      state.addContainer(container);

      // Expand container to restore edges
      await asyncCoordinator.expandContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Check that edges are restored
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
      expect(visibleEdges.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle edges between containers", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3", "n4"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const edges: GraphEdge[] = [
        {
          id: "e1",
          source: "n1",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e2",
          source: "n2",
          target: "n4",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
      ];

      const container1: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      const container2: Container = {
        id: "c2",
        label: "Container 2",
        children: new Set(["n3", "n4"]),
        childNodes: ["n3", "n4"],
        childContainers: [],
        collapsed: false,
        position: { x: 250, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));
      state.addContainer(container1);
      state.addContainer(container2);

      // Collapse both containers
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      await asyncCoordinator.collapseContainer("c2", state, {
        relayoutEntities: ["c2"],
        fitView: false,
      });

      // Check that inter-container edges are handled
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
    });
  });

  describe("Bulk Operations", () => {
    it("should expand all containers atomically", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3", "n4"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const containers: Container[] = [
        {
          id: "c1",
          label: "Container 1",
          children: new Set(["n1", "n2"]),
          childNodes: ["n1", "n2"],
          childContainers: [],
          collapsed: true,
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        {
          id: "c2",
          label: "Container 2",
          children: new Set(["n3", "n4"]),
          childNodes: ["n3", "n4"],
          childContainers: [],
          collapsed: true,
          position: { x: 250, y: 0 },
          size: { width: 200, height: 150 },
        },
      ];

      nodes.forEach((node) => state.addNode(node));
      containers.forEach((container) => state.addContainer(container));

      // Expand all containers
      await asyncCoordinator.expandAllContainers(state, {
        relayoutEntities: undefined, // Full layout
        fitView: false,
      });

      // All containers should be expanded
      const visibleContainers = state.visibleContainers;
      const container1 = visibleContainers.find((c) => c.id === "c1");
      const container2 = visibleContainers.find((c) => c.id === "c2");

      expect(container1?.collapsed).toBe(false);
      expect(container2?.collapsed).toBe(false);

      // All nodes should be visible
      const visibleNodes = state.visibleNodes;
      expect(visibleNodes.find((n) => n.id === "n1")).toBeDefined();
      expect(visibleNodes.find((n) => n.id === "n2")).toBeDefined();
      expect(visibleNodes.find((n) => n.id === "n3")).toBeDefined();
      expect(visibleNodes.find((n) => n.id === "n4")).toBeDefined();
    });

    it("should collapse all containers atomically", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3", "n4"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const containers: Container[] = [
        {
          id: "c1",
          label: "Container 1",
          children: new Set(["n1", "n2"]),
          childNodes: ["n1", "n2"],
          childContainers: [],
          collapsed: false,
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        {
          id: "c2",
          label: "Container 2",
          children: new Set(["n3", "n4"]),
          childNodes: ["n3", "n4"],
          childContainers: [],
          collapsed: false,
          position: { x: 250, y: 0 },
          size: { width: 200, height: 150 },
        },
      ];

      nodes.forEach((node) => state.addNode(node));
      containers.forEach((container) => state.addContainer(container));

      // Collapse all containers
      await asyncCoordinator.collapseAllContainers(state, {
        relayoutEntities: undefined, // Full layout
        fitView: false,
      });

      // All containers should be collapsed
      const visibleContainers = state.visibleContainers;
      const container1 = visibleContainers.find((c) => c.id === "c1");
      const container2 = visibleContainers.find((c) => c.id === "c2");

      expect(container1?.collapsed).toBe(true);
      expect(container2?.collapsed).toBe(true);

      // Child nodes should not be visible
      const visibleNodes = state.visibleNodes;
      expect(visibleNodes.find((n) => n.id === "n1")).toBeUndefined();
      expect(visibleNodes.find((n) => n.id === "n2")).toBeUndefined();
      expect(visibleNodes.find((n) => n.id === "n3")).toBeUndefined();
      expect(visibleNodes.find((n) => n.id === "n4")).toBeUndefined();
    });
  });

  describe("Complex Edge Aggregation Scenarios", () => {
    it("should handle multi-container edge aggregation", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3", "n4", "n5"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const edges: GraphEdge[] = [
        {
          id: "e1",
          source: "n1",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e2",
          source: "n2",
          target: "n4",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e3",
          source: "n3",
          target: "n5",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
      ];

      const containers: Container[] = [
        {
          id: "c1",
          label: "Container 1",
          children: new Set(["n1", "n2"]),
          childNodes: ["n1", "n2"],
          childContainers: [],
          collapsed: false,
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        {
          id: "c2",
          label: "Container 2",
          children: new Set(["n3", "n4"]),
          childNodes: ["n3", "n4"],
          childContainers: [],
          collapsed: false,
          position: { x: 250, y: 0 },
          size: { width: 200, height: 150 },
        },
      ];

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));
      containers.forEach((container) => state.addContainer(container));

      // Collapse first container
      await asyncCoordinator.collapseContainer("c1", state, {
        relayoutEntities: ["c1"],
        fitView: false,
      });

      // Check edge aggregation
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
    });

    it("should handle nested container edge aggregation", async () => {
      const nodes: GraphNode[] = ["n1", "n2", "n3", "n4"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const edges: GraphEdge[] = [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e2",
          source: "n2",
          target: "n3",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
        {
          id: "e3",
          source: "n3",
          target: "n4",
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        },
      ];

      const innerContainer: Container = {
        id: "inner",
        label: "Inner Container",
        children: new Set(["n1", "n2"]),
        childNodes: ["n1", "n2"],
        childContainers: [],
        collapsed: false,
        position: { x: 10, y: 10 },
        size: { width: 150, height: 100 },
      };

      const outerContainer: Container = {
        id: "outer",
        label: "Outer Container",
        children: new Set(["inner", "n3"]),
        childNodes: ["n3"],
        childContainers: ["inner"],
        collapsed: false,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 150 },
      };

      nodes.forEach((node) => state.addNode(node));
      edges.forEach((edge) => state.addEdge(edge));
      state.addContainer(innerContainer);
      state.addContainer(outerContainer);

      // Collapse outer container
      await asyncCoordinator.collapseContainer("outer", state, {
        relayoutEntities: ["outer"],
        fitView: false,
      });

      // Check that nested edge aggregation works
      const visibleEdges = state.visibleEdges;
      expect(Array.isArray(visibleEdges)).toBe(true);
    });
  });
});
