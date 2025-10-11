/**
 * Precise reproduction of the floating hyperedge bug
 * Bug: hyperEdges not attached to collapsed containers after expand/collapse cycle
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import type { GraphNode, GraphEdge, Container } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("Floating HyperEdge Bug Reproduction", () => {
  let coordinator: AsyncCoordinator;

  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});

    // Create a realistic paxos-like scenario with Acceptor and Proposer containers
    // This mimics the structure from the real paxos.json

    // Create nodes for Acceptor container (similar to loc_1 in paxos.json)
    const acceptorNodes: GraphNode[] = [
      {
        id: "100",
        label: "Acceptor P1a Handler",
        longLabel: "Acceptor P1a Handler",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "101",
        label: "Acceptor P1b Response",
        longLabel: "Acceptor P1b Response",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "102",
        label: "Acceptor P2a Handler",
        longLabel: "Acceptor P2a Handler",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "103",
        label: "Acceptor P2b Response",
        longLabel: "Acceptor P2b Response",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ];

    // Create nodes for Proposer container (similar to loc_0 in paxos.json)
    const proposerNodes: GraphNode[] = [
      {
        id: "200",
        label: "Proposer P1a Send",
        longLabel: "Proposer P1a Send",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "201",
        label: "Proposer P1b Collect",
        longLabel: "Proposer P1b Collect",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "202",
        label: "Proposer P2a Send",
        longLabel: "Proposer P2a Send",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ];

    // Create external nodes (not in containers)
    const externalNodes: GraphNode[] = [
      {
        id: "300",
        label: "Client Request",
        longLabel: "Client Request",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "301",
        label: "Client Response",
        longLabel: "Client Response",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ];

    // Create containers
    const acceptorContainer: Container = {
      id: "loc_1",
      label: "Acceptor",
      children: new Set(["100", "101", "102", "103"]),
      collapsed: false,
      hidden: false,
    };

    const proposerContainer: Container = {
      id: "loc_0",
      label: "Proposer",
      children: new Set(["200", "201", "202"]),
      collapsed: false,
      hidden: false,
    };

    // Create edges that will form hyperedges when containers are collapsed
    const edges: GraphEdge[] = [
      // Proposer to Acceptor edges (these should become hyperedges)
      {
        id: "e1",
        source: "200",
        target: "100",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e2",
        source: "200",
        target: "102",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e3",
        source: "101",
        target: "201",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e4",
        source: "103",
        target: "201",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },

      // External to container edges
      {
        id: "e5",
        source: "300",
        target: "200",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e6",
        source: "202",
        target: "301",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },

      // Internal container edges (should not become hyperedges)
      {
        id: "e7",
        source: "100",
        target: "101",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e8",
        source: "200",
        target: "201",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
    ];

    // Add all data to state
    [...acceptorNodes, ...proposerNodes, ...externalNodes].forEach((node) =>
      state.addNode(node),
    );
    [acceptorContainer, proposerContainer].forEach((container) =>
      state.addContainer(container),
    );
    edges.forEach((edge) => state.addEdge(edge));
  });

  it("should reproduce floating hyperedge bug with exact steps", async () => {
    console.log("[FloatingBug] 🚀 Starting precise bug reproduction");

    // Step 1: Get initial state with all containers collapsed
    await coordinator.collapseAllContainers(state, { triggerLayout: false });
    const initialData = reactFlowBridge.toReactFlowData(state);

    console.log(
      `[FloatingBug] 📊 Initial state: ${initialData.nodes.length} nodes, ${initialData.edges.length} edges`,
    );

    // Find aggregated edges (these should be attached to containers)
    const initialAggregatedEdges = initialData.edges.filter(
      (e) => e.data?.aggregated === true,
    );
    console.log(
      `[FloatingBug] 🔗 Initial aggregated edges: ${initialAggregatedEdges.length}`,
    );

    // Verify we have the expected hyperedges between containers
    const expectedHyperedges = initialAggregatedEdges.filter(
      (e) =>
        (e.source === "loc_0" && e.target === "loc_1") ||
        (e.source === "loc_1" && e.target === "loc_0"),
    );
    console.log(
      `[FloatingBug] 🔗 Expected Proposer-Acceptor hyperedges: ${expectedHyperedges.length}`,
    );
    expect(expectedHyperedges.length).toBeGreaterThan(0);

    // Step 2: Expand the Acceptor container (this is where the bug occurs)
    console.log(`[FloatingBug] 📦 Expanding Acceptor container: loc_1`);

    await coordinator.expandContainer(
      "loc_1",
      state,
      { triggerLayout: false },
      coordinator,
      { triggerLayout: false },
    );
    const expandedData = reactFlowBridge.toReactFlowData(state);

    console.log(
      `[FloatingBug] 📊 After expand: ${expandedData.nodes.length} nodes, ${expandedData.edges.length} edges`,
    );

    // Verify Acceptor nodes are now visible
    const acceptorNodes = expandedData.nodes.filter((n) =>
      ["100", "101", "102", "103"].includes(n.id),
    );
    expect(acceptorNodes.length).toBe(4);

    // Step 3: Collapse the Acceptor container back
    console.log(`[FloatingBug] 📦 Collapsing Acceptor container: loc_1`);

    await coordinator.collapseContainer(
      "loc_1",
      state,
      { triggerLayout: false },
      coordinator,
      { triggerLayout: false },
    );
    const reCollapsedData = reactFlowBridge.toReactFlowData(state);

    console.log(
      `[FloatingBug] 📊 After re-collapse: ${reCollapsedData.nodes.length} nodes, ${reCollapsedData.edges.length} edges`,
    );

    // Step 4: Check for floating edges (the bug)
    const finalAggregatedEdges = reCollapsedData.edges.filter(
      (e) => e.data?.aggregated === true,
    );
    console.log(
      `[FloatingBug] 🔗 Final aggregated edges: ${finalAggregatedEdges.length}`,
    );

    // Check if any edges are "floating" (not properly attached to containers)
    const containerIds = new Set(reCollapsedData.nodes.map((n) => n.id));
    const floatingEdges = finalAggregatedEdges.filter((edge) => {
      const sourceExists = containerIds.has(edge.source);
      const targetExists = containerIds.has(edge.target);
      return !sourceExists || !targetExists;
    });

    console.log(
      `[FloatingBug] 👻 Floating edges found: ${floatingEdges.length}`,
    );
    floatingEdges.forEach((edge) => {
      console.log(
        `[FloatingBug] 👻 Floating edge: ${edge.id} (${edge.source} -> ${edge.target})`,
      );
      console.log(
        `[FloatingBug] 👻   Source exists: ${containerIds.has(edge.source)}`,
      );
      console.log(
        `[FloatingBug] 👻   Target exists: ${containerIds.has(edge.target)}`,
      );
    });

    // The bug assertion: there should be no floating edges
    expect(floatingEdges.length).toBe(0);

    // Additional check: we should still have hyperedges between containers
    const finalHyperedges = finalAggregatedEdges.filter(
      (e) =>
        (e.source === "loc_0" && e.target === "loc_1") ||
        (e.source === "loc_1" && e.target === "loc_0"),
    );
    console.log(
      `[FloatingBug] 🔗 Final Proposer-Acceptor hyperedges: ${finalHyperedges.length}`,
    );
    expect(finalHyperedges.length).toBeGreaterThan(0);

    console.log("[FloatingBug] ✅ Bug reproduction test completed");
  });

  it("should reproduce bug with multiple expand/collapse cycles", async () => {
    console.log("[FloatingBug] 🚀 Starting multiple cycle reproduction");

    // Start with all collapsed
    await coordinator.collapseAllContainers(state, { triggerLayout: false });
    const _initialData = reactFlowBridge.toReactFlowData(state);

    const collapsedContainers = state.visibleContainers.filter(
      (c) => c.collapsed,
    );
    expect(collapsedContainers.length).toBeGreaterThan(0);

    const targetContainer = collapsedContainers[0];

    // Perform multiple expand/collapse cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(
        `[FloatingBug] 🔄 Cycle ${cycle}: Expanding ${targetContainer.id}`,
      );
      await coordinator.expandContainer(
        targetContainer.id,
        state,
        { triggerLayout: false },
        coordinator,
        { triggerLayout: false },
      );

      console.log(
        `[FloatingBug] 🔄 Cycle ${cycle}: Collapsing ${targetContainer.id}`,
      );
      await coordinator.collapseContainer(
        targetContainer.id,
        state,
        { triggerLayout: false },
        coordinator,
        { triggerLayout: false },
      );

      // Check for floating edges after each cycle
      const cycleData = reactFlowBridge.toReactFlowData(state);
      const containerIds = new Set(cycleData.nodes.map((n) => n.id));
      const aggregatedEdges = cycleData.edges.filter(
        (e) => e.data?.isAggregated,
      );
      const floatingEdges = aggregatedEdges.filter((edge) => {
        return !containerIds.has(edge.source) || !containerIds.has(edge.target);
      });

      console.log(
        `[FloatingBug] 🔄 Cycle ${cycle}: Floating edges: ${floatingEdges.length}`,
      );

      if (floatingEdges.length > 0) {
        console.error(
          `[FloatingBug] ❌ Found floating edges in cycle ${cycle}:`,
          floatingEdges,
        );
        expect(floatingEdges.length).toBe(0);
      }
    }

    console.log("[FloatingBug] ✅ Multiple cycle reproduction test completed");
  });
});
