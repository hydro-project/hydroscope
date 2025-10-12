/**
 * Paxos Proposer Container Bug Test
 *
 * This test reproduces the specific bug where expanding and then collapsing
 * the "Proposer" container in paxos.json results in floating edges that are
 * not properly connected to the collapsed container.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { StyleConfig } from "../types/core.js";
import fs from "fs";
import path from "path";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("Paxos Proposer Container Bug", () => {
  let coordinator: AsyncCoordinator;

  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let jsonParser: JSONParser;

  const styleConfig: StyleConfig = {
    nodeStyles: {},
    edgeStyles: {},
    containerStyles: {
      collapsed: { background: "#f0f0f0" },
      expanded: { background: "#ffffff" },
    },
  };

  beforeEach(async () => {
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge();
    reactFlowBridge = new ReactFlowBridge(styleConfig);
    jsonParser = new JSONParser();

    // Load and parse paxos.json
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    const rawPaxosData = JSON.parse(paxosContent);

    const parseResult = await jsonParser.parseData(rawPaxosData);
    state = parseResult.visualizationState;

    // Perform initial layout
    await elkBridge.layout(state);
  });

  it("should maintain proper edge connections after expanding and collapsing Proposer container", async () => {
    // Find the Proposer container
    const proposerContainer = state.visibleContainers.find(
      (c) =>
        c.label?.toLowerCase().includes("proposer") ||
        c.id.toLowerCase().includes("proposer"),
    );

    expect(proposerContainer).toBeDefined();
    console.log(
      `Found Proposer container: ${proposerContainer!.id} (${proposerContainer!.label})`,
    );

    // Initially, the container should be collapsed (based on smart collapse)
    expect(proposerContainer!.collapsed).toBe(true);

    // Get initial aggregated edges involving the Proposer container
    const initialAggregatedEdges = state
      .getAggregatedEdges()
      .filter(
        (edge) =>
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id,
      );

    console.log(
      `Initial aggregated edges for Proposer: ${initialAggregatedEdges.length}`,
    );
    initialAggregatedEdges.forEach((edge) => {
      console.log(`  - ${edge.id}: ${edge.source} -> ${edge.target}`);
    });

    // Generate initial ReactFlow data to capture edge IDs and positions
    const initialReactFlowData = reactFlowBridge.toReactFlowData(state);
    const initialProposerEdges = initialReactFlowData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );

    console.log(
      `Initial ReactFlow edges for Proposer: ${initialProposerEdges.length}`,
    );
    initialProposerEdges.forEach((edge) => {
      console.log(
        `  - ${edge.id}: ${edge.source} -> ${edge.target} (type: ${edge.type})`,
      );
    });

    // Step 1: Expand the Proposer container
    console.log("\n=== EXPANDING PROPOSER CONTAINER ===");
    await coordinator.expandContainer(
      proposerContainer!.id,
      state,
      { fitView: false },
      coordinator,
      { fitView: false },
    );
    await elkBridge.layout(state);

    // Verify container is expanded and aggregated edges are removed
    expect(proposerContainer!.collapsed).toBe(false);
    const expandedAggregatedEdges = state
      .getAggregatedEdges()
      .filter(
        (edge) =>
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id,
      );
    expect(expandedAggregatedEdges).toHaveLength(0);

    // Generate ReactFlow data after expansion
    const expandedReactFlowData = reactFlowBridge.toReactFlowData(state);
    const expandedProposerEdges = expandedReactFlowData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );

    console.log(
      `Expanded ReactFlow edges for Proposer: ${expandedProposerEdges.length}`,
    );

    // Step 2: Collapse the Proposer container again
    console.log("\n=== COLLAPSING PROPOSER CONTAINER AGAIN ===");
    console.log(`Proposer container ID: ${proposerContainer!.id}`);
    console.log("Other collapsed containers before re-collapse:");
    state.visibleContainers
      .filter((c) => c.collapsed && c.id !== proposerContainer!.id)
      .forEach((c) => {
        console.log(`  - ${c.id} (${c.label}): collapsed=${c.collapsed}`);
      });

    await coordinator.collapseContainer(
      proposerContainer!.id,
      state,
      { fitView: false },
      coordinator,
      { fitView: false },
    );
    await elkBridge.layout(state);

    // Verify container is collapsed again
    expect(proposerContainer!.collapsed).toBe(true);

    // Get final aggregated edges
    const finalAggregatedEdges = state
      .getAggregatedEdges()
      .filter(
        (edge) =>
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id,
      );

    console.log(
      `Final aggregated edges for Proposer: ${finalAggregatedEdges.length}`,
    );
    finalAggregatedEdges.forEach((edge) => {
      console.log(`  - ${edge.id}: ${edge.source} -> ${edge.target}`);
    });

    // Generate final ReactFlow data
    const finalReactFlowData = reactFlowBridge.toReactFlowData(state);
    const finalProposerEdges = finalReactFlowData.edges.filter(
      (edge) =>
        edge.source === proposerContainer!.id ||
        edge.target === proposerContainer!.id,
    );

    console.log(
      `Final ReactFlow edges for Proposer: ${finalProposerEdges.length}`,
    );
    finalProposerEdges.forEach((edge) => {
      console.log(
        `  - ${edge.id}: ${edge.source} -> ${edge.target} (type: ${edge.type})`,
      );
    });

    // CRITICAL ASSERTIONS: Answer the specific questions about what changes between initial and final state

    // Get initial and final container nodes
    const initialProposerNode = initialReactFlowData.nodes.find(
      (n) => n.id === proposerContainer!.id,
    );
    const finalProposerNode = finalReactFlowData.nodes.find(
      (n) => n.id === proposerContainer!.id,
    );

    // Collect all data first
    const initialEdgeIds = initialProposerEdges.map((e) => e.id).sort();
    const finalEdgeIds = finalProposerEdges.map((e) => e.id).sort();

    const initialHandles = initialProposerEdges.map((e) => ({
      id: e.id,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    const finalHandles = finalProposerEdges.map((e) => ({
      id: e.id,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));

    // Create a summary object that will be shown if test fails
    const summary = {
      q1_containerIds: {
        initial: initialProposerNode?.id,
        final: finalProposerNode?.id,
      },
      q2_edgeIds: { initial: initialEdgeIds, final: finalEdgeIds },
      q3_containerTypes: {
        initial: initialProposerNode?.type,
        final: finalProposerNode?.type,
      },
      q4_edgeCount: {
        initial: initialProposerEdges.length,
        final: finalProposerEdges.length,
      },
      q4_handles: initialHandles.map((h) => {
        const final = finalHandles.find((f) => f.id === h.id);
        return {
          edgeId: h.id,
          initial: {
            sourceHandle: h.sourceHandle,
            targetHandle: h.targetHandle,
          },
          final: {
            sourceHandle: final?.sourceHandle,
            targetHandle: final?.targetHandle,
          },
          matches: final
            ? final.sourceHandle === h.sourceHandle &&
              final.targetHandle === h.targetHandle
            : false,
        };
      }),
    };

    // QUESTION 1: Is the collapsed container name passed to ReactFlow the same before and after?
    expect(summary.q1_containerIds.initial).toBe(summary.q1_containerIds.final);

    // QUESTION 2: Are the hyperedge names passed to ReactFlow the same before and after?
    expect(summary.q2_edgeIds.final).toEqual(summary.q2_edgeIds.initial);

    // QUESTION 3: Are the types of the nodes passed the same before and after?
    expect(summary.q3_containerTypes.initial).toBe(
      summary.q3_containerTypes.final,
    );

    // QUESTION 4: Are the handle names on the collapsed container the same before and after?
    summary.q4_handles.forEach((h) => {
      expect(h.matches).toBe(
        true,
        `Edge ${h.edgeId} handles changed: ${JSON.stringify(h)}`,
      );
    });

    // All checks passed - the data is consistent!

    // Additional checks
    console.log("\n=== ADDITIONAL DETAILS ===");
    console.log(
      `Container collapsed state: initial=${initialProposerNode?.data.collapsed}, final=${finalProposerNode?.data.collapsed}`,
    );
    console.log(
      `Container position: initial=(${initialProposerNode?.position.x}, ${initialProposerNode?.position.y}), final=(${finalProposerNode?.position.x}, ${finalProposerNode?.position.y})`,
    );
    console.log(
      `Edge count: initial=${initialProposerEdges.length}, final=${finalProposerEdges.length}`,
    );

    // Verify all nodes exist
    const allNodeIds = new Set(finalReactFlowData.nodes.map((n) => n.id));
    for (const edge of finalProposerEdges) {
      expect(allNodeIds.has(edge.source)).toBe(
        true,
        `Edge ${edge.id} has invalid source: ${edge.source} (not found in nodes)`,
      );
      expect(allNodeIds.has(edge.target)).toBe(
        true,
        `Edge ${edge.id} has invalid target: ${edge.target} (not found in nodes)`,
      );
    }
  });

  it("should have consistent edge endpoints after multiple expand/collapse cycles", async () => {
    // Find the Proposer container
    const proposerContainer = state.visibleContainers.find(
      (c) =>
        c.label?.toLowerCase().includes("proposer") ||
        c.id.toLowerCase().includes("proposer"),
    );

    expect(proposerContainer).toBeDefined();

    // Perform multiple expand/collapse cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n=== CYCLE ${cycle} ===`);

      // Expand
      await coordinator.expandContainer(
        proposerContainer!.id,
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );
      await elkBridge.layout(state);

      // Collapse
      await coordinator.collapseContainer(
        proposerContainer!.id,
        state,
        { fitView: false },
        coordinator,
        { fitView: false },
      );
      await elkBridge.layout(state);

      // Verify edges are still valid
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const proposerEdges = reactFlowData.edges.filter(
        (edge) =>
          edge.source === proposerContainer!.id ||
          edge.target === proposerContainer!.id,
      );

      const allNodeIds = new Set(reactFlowData.nodes.map((n) => n.id));
      for (const edge of proposerEdges) {
        expect(allNodeIds.has(edge.source)).toBe(
          true,
          `Cycle ${cycle}: Edge ${edge.id} has invalid source: ${edge.source}`,
        );
        expect(allNodeIds.has(edge.target)).toBe(
          true,
          `Cycle ${cycle}: Edge ${edge.id} has invalid target: ${edge.target}`,
        );
      }
    }
  });
});
