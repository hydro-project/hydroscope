/**
 * Exact reproduction of the Proposer hyperedge bug
 * Scenario: Load paxos.json, expand Proposer, collapse it, check hyperedges
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Proposer HyperEdge Bug - Exact Reproduction", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let paxosData: any;

  beforeEach(async () => {
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});

    // Load the actual paxos.json file
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosJson = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosJson) as HydroscopeData;

    // Parse and load the data using JSONParser
    const parser = JSONParser.createPaxosParser({ debug: false });
    const result = await parser.parseData(paxosData);

    // Use the parsed visualization state
    state = result.visualizationState;

    console.log(
      `[ProposerBug] 📊 Loaded paxos.json: ${state.visibleNodes.length} nodes, ${state.visibleEdges.length} edges, ${state.visibleContainers.length} containers`,
    );
  });

  it("should reproduce the exact Proposer hyperedge bug", () => {
    console.log("[ProposerBug] 🚀 Starting exact Proposer bug reproduction");

    // Step 1: Find the Proposer container (loc_0)
    const proposerContainer = state.visibleContainers.find(
      (c) => c.id === "loc_0" || c.label.includes("Proposer"),
    );

    expect(proposerContainer).toBeDefined();
    console.log(
      `[ProposerBug] 📦 Found Proposer container: ${proposerContainer!.id} - ${proposerContainer!.label}`,
    );

    // Step 2: Ensure Proposer is initially collapsed
    if (!proposerContainer!.collapsed) {
      state._collapseContainerForCoordinator(proposerContainer!.id);
    }

    // Get initial state with Proposer collapsed
    const initialData = reactFlowBridge.toReactFlowData(state);
    console.log(
      `[ProposerBug] 📊 Initial state: ${initialData.nodes.length} nodes, ${initialData.edges.length} edges`,
    );

    // Find edges connected to Proposer container
    const proposerEdges = initialData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );
    console.log(
      `[ProposerBug] 🔗 Initial edges connected to Proposer: ${proposerEdges.length}`,
    );
    proposerEdges.forEach((edge) => {
      console.log(
        `[ProposerBug] 🔗   Edge: ${edge.id} (${edge.source} -> ${edge.target}) ${edge.data?.isAggregated ? "[AGGREGATED]" : ""}`,
      );
    });

    // Step 3: Expand the Proposer container (simulate click)
    console.log(
      `[ProposerBug] 📦 Expanding Proposer container: ${proposerContainer!.id}`,
    );
    state._expandContainerForCoordinator(proposerContainer!.id);

    const expandedData = reactFlowBridge.toReactFlowData(state);
    console.log(
      `[ProposerBug] 📊 After expand: ${expandedData.nodes.length} nodes, ${expandedData.edges.length} edges`,
    );

    // Step 4: Collapse the Proposer container again
    console.log(
      `[ProposerBug] 📦 Collapsing Proposer container: ${proposerContainer!.id}`,
    );
    state._collapseContainerForCoordinator(proposerContainer!.id);

    const reCollapsedData = reactFlowBridge.toReactFlowData(state);
    console.log(
      `[ProposerBug] 📊 After re-collapse: ${reCollapsedData.nodes.length} nodes, ${reCollapsedData.edges.length} edges`,
    );

    // Step 5: Check if Proposer container still exists in the final data
    const finalProposerNode = reCollapsedData.nodes.find(
      (n) => n.id === proposerContainer!.id,
    );
    console.log(
      `[ProposerBug] 📦 Proposer container exists in final data: ${!!finalProposerNode}`,
    );

    // Step 6: Find edges that should be connected to Proposer
    const finalProposerEdges = reCollapsedData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );
    console.log(
      `[ProposerBug] 🔗 Final edges connected to Proposer: ${finalProposerEdges.length}`,
    );
    finalProposerEdges.forEach((edge) => {
      console.log(
        `[ProposerBug] 🔗   Edge: ${edge.id} (${edge.source} -> ${edge.target}) ${edge.data?.isAggregated ? "[AGGREGATED]" : ""}`,
      );
    });

    // Step 7: Find floating edges (edges that reference Proposer but Proposer doesn't exist)
    const allNodeIds = new Set(reCollapsedData.nodes.map((n) => n.id));
    const floatingEdges = reCollapsedData.edges.filter((edge) => {
      const sourceIsProposer = edge.source === proposerContainer!.id;
      const targetIsProposer = edge.target === proposerContainer!.id;
      const proposerExists = allNodeIds.has(proposerContainer!.id);

      return (sourceIsProposer || targetIsProposer) && !proposerExists;
    });

    console.log(
      `[ProposerBug] 👻 Floating edges referencing missing Proposer: ${floatingEdges.length}`,
    );
    floatingEdges.forEach((edge) => {
      console.log(
        `[ProposerBug] 👻   Floating edge: ${edge.id} (${edge.source} -> ${edge.target})`,
      );
    });

    // Step 8: The bug assertion
    if (floatingEdges.length > 0) {
      console.error(
        `[ProposerBug] ❌ BUG REPRODUCED: Found ${floatingEdges.length} floating edges referencing missing Proposer container`,
      );

      // Additional debugging
      console.log(
        `[ProposerBug] 🔍 All final nodes:`,
        reCollapsedData.nodes.map((n) => `${n.id}:${n.type}`),
      );
      console.log(
        `[ProposerBug] 🔍 All final edges:`,
        reCollapsedData.edges.map((e) => `${e.id}(${e.source}->${e.target})`),
      );

      expect(floatingEdges.length).toBe(0);
    } else {
      console.log(
        "[ProposerBug] ✅ No floating edges found - bug may be fixed",
      );
    }

    // Step 9: Consistency check - edge count should be the same
    expect(finalProposerEdges.length).toBe(proposerEdges.length);

    console.log("[ProposerBug] ✅ Proposer bug reproduction test completed");
  });

  it("should maintain Proposer edge consistency across multiple cycles", () => {
    console.log("[ProposerBug] 🚀 Starting multiple cycle test for Proposer");

    const proposerContainer = state.visibleContainers.find(
      (c) => c.id === "loc_0" || c.label.includes("Proposer"),
    );
    expect(proposerContainer).toBeDefined();

    // Ensure initial collapsed state
    if (!proposerContainer!.collapsed) {
      state._collapseContainerForCoordinator(proposerContainer!.id);
    }

    const initialData = reactFlowBridge.toReactFlowData(state);
    const initialProposerEdges = initialData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );

    // Perform multiple expand/collapse cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`[ProposerBug] 🔄 Cycle ${cycle}: Expanding Proposer`);
      state._expandContainerForCoordinator(proposerContainer!.id);

      console.log(`[ProposerBug] 🔄 Cycle ${cycle}: Collapsing Proposer`);
      state._collapseContainerForCoordinator(proposerContainer!.id);

      // Check consistency after each cycle
      const cycleData = reactFlowBridge.toReactFlowData(state);
      const allNodeIds = new Set(cycleData.nodes.map((n) => n.id));
      const proposerExists = allNodeIds.has(proposerContainer!.id);
      const cycleProposerEdges = cycleData.edges.filter(
        (edge) =>
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id,
      );

      console.log(
        `[ProposerBug] 🔄 Cycle ${cycle}: Proposer exists: ${proposerExists}, edges: ${cycleProposerEdges.length}`,
      );

      // Check for floating edges
      const floatingEdges = cycleData.edges.filter((edge) => {
        const referencesProposer =
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id;
        return referencesProposer && !proposerExists;
      });

      if (floatingEdges.length > 0) {
        console.error(
          `[ProposerBug] ❌ Cycle ${cycle}: Found ${floatingEdges.length} floating edges`,
        );
        expect(floatingEdges.length).toBe(0);
      }

      // Edge count should be consistent
      expect(cycleProposerEdges.length).toBe(initialProposerEdges.length);
    }

    console.log("[ProposerBug] ✅ Multiple cycle test completed");
  });
});
