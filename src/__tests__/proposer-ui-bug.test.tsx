/**
 * UI-level reproduction of the Proposer hyperedge bug
 * Simulates actual UI clicks on the Proposer container
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HydroscopeCore } from "../components/HydroscopeCore.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Proposer UI Bug - Exact UI Reproduction", () => {
  let paxosData: HydroscopeData;

  beforeEach(async () => {
    // Load the actual paxos.json file
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosJson = fs.readFileSync(paxosPath, "utf-8");
    paxosData = JSON.parse(paxosJson) as HydroscopeData;
  });

  it("should reproduce Proposer hyperedge bug through UI clicks", async () => {
    console.log("[ProposerUIBug] 🚀 Starting UI-level bug reproduction");

    // Track container operations
    const containerOperations: string[] = [];

    const onContainerExpand = (containerId: string) => {
      containerOperations.push(`expand:${containerId}`);
      console.log(`[ProposerUIBug] 📦 Container expanded: ${containerId}`);
    };

    const onContainerCollapse = (containerId: string) => {
      containerOperations.push(`collapse:${containerId}`);
      console.log(`[ProposerUIBug] 📦 Container collapsed: ${containerId}`);
    };

    // Render HydroscopeCore with paxos data
    render(
      <HydroscopeCore
        data={paxosData}
        onContainerExpand={onContainerExpand}
        onContainerCollapse={onContainerCollapse}
        enableAutoFit={false}
        enableInteractions={true}
      />,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId("reactflow-wrapper")).toBeInTheDocument();
    });

    console.log("[ProposerUIBug] ✅ Initial render complete");

    // Find the Proposer container node in the DOM
    // The container should be rendered as a ReactFlow node
    await waitFor(() => {
      const proposerElements = screen.getAllByText(/Proposer/i);
      expect(proposerElements.length).toBeGreaterThan(0);
    });

    console.log("[ProposerUIBug] 📦 Found Proposer container in DOM");

    // Get all container elements that might be the Proposer
    const proposerCandidates = screen.getAllByText(/Proposer/i);
    let proposerElement = null;

    // Find the clickable Proposer container
    for (const candidate of proposerCandidates) {
      const containerElement =
        candidate.closest('[data-testid*="container"]') ||
        candidate.closest('[data-id*="loc_0"]') ||
        candidate.closest(".react-flow__node");
      if (containerElement) {
        proposerElement = containerElement;
        break;
      }
    }

    expect(proposerElement).toBeTruthy();
    console.log("[ProposerUIBug] 📦 Found clickable Proposer element");

    // Step 1: Click to expand Proposer (if it's collapsed)
    console.log("[ProposerUIBug] 🖱️ Clicking to expand Proposer");
    fireEvent.click(proposerElement!);

    // Wait for expand operation to complete
    await waitFor(
      () => {
        expect(containerOperations.some((op) => op.includes("expand"))).toBe(
          true,
        );
      },
      { timeout: 5000 },
    );

    console.log("[ProposerUIBug] ✅ Proposer expand operation completed");

    // Step 2: Click to collapse Proposer again
    console.log("[ProposerUIBug] 🖱️ Clicking to collapse Proposer");
    fireEvent.click(proposerElement!);

    // Wait for collapse operation to complete
    await waitFor(
      () => {
        expect(containerOperations.some((op) => op.includes("collapse"))).toBe(
          true,
        );
      },
      { timeout: 5000 },
    );

    console.log("[ProposerUIBug] ✅ Proposer collapse operation completed");

    // Step 3: Check for floating edges in the final DOM state
    // Look for edges that reference nodes that don't exist
    await waitFor(
      () => {
        const reactFlowWrapper = screen.getByTestId("reactflow-wrapper");
        const edges = reactFlowWrapper.querySelectorAll(".react-flow__edge");
        const nodes = reactFlowWrapper.querySelectorAll(".react-flow__node");

        const nodeIds = new Set(
          Array.from(nodes).map((node) => node.getAttribute("data-id")),
        );

        console.log(
          `[ProposerUIBug] 📊 Final DOM state: ${nodes.length} nodes, ${edges.length} edges`,
        );
        console.log(`[ProposerUIBug] 📊 Node IDs:`, Array.from(nodeIds));

        // Check for floating edges
        const floatingEdges: Element[] = [];
        edges.forEach((edge) => {
          const sourceId = edge.getAttribute("data-source");
          const targetId = edge.getAttribute("data-target");

          if (sourceId && !nodeIds.has(sourceId)) {
            console.log(
              `[ProposerUIBug] 👻 Floating edge: source ${sourceId} not found`,
            );
            floatingEdges.push(edge);
          }
          if (targetId && !nodeIds.has(targetId)) {
            console.log(
              `[ProposerUIBug] 👻 Floating edge: target ${targetId} not found`,
            );
            floatingEdges.push(edge);
          }
        });

        if (floatingEdges.length > 0) {
          console.error(
            `[ProposerUIBug] ❌ BUG REPRODUCED: Found ${floatingEdges.length} floating edges in DOM`,
          );
          floatingEdges.forEach((edge, i) => {
            console.error(`[ProposerUIBug] 👻 Floating edge ${i + 1}:`, {
              source: edge.getAttribute("data-source"),
              target: edge.getAttribute("data-target"),
              id: edge.getAttribute("data-id"),
            });
          });
        } else {
          console.log("[ProposerUIBug] ✅ No floating edges found in DOM");
        }

        // The bug assertion: there should be no floating edges
        expect(floatingEdges.length).toBe(0);
      },
      { timeout: 10000 },
    );

    console.log("[ProposerUIBug] ✅ UI-level bug reproduction test completed");
    console.log(
      `[ProposerUIBug] 📊 Container operations performed:`,
      containerOperations,
    );
  });

  it("should maintain Proposer visibility after expand/collapse cycle", async () => {
    console.log("[ProposerUIBug] 🚀 Starting Proposer visibility test");

    let proposerVisible = false;

    const onContainerExpand = (containerId: string) => {
      if (containerId === "loc_0" || containerId.includes("Proposer")) {
        proposerVisible = true;
        console.log(
          `[ProposerUIBug] 👁️ Proposer became visible: ${containerId}`,
        );
      }
    };

    const onContainerCollapse = (containerId: string) => {
      if (containerId === "loc_0" || containerId.includes("Proposer")) {
        proposerVisible = false;
        console.log(
          `[ProposerUIBug] 👁️ Proposer became hidden: ${containerId}`,
        );
      }
    };

    render(
      <HydroscopeCore
        data={paxosData}
        onContainerExpand={onContainerExpand}
        onContainerCollapse={onContainerCollapse}
        enableAutoFit={false}
        enableInteractions={true}
      />,
    );

    // Wait for initial render and find Proposer
    await waitFor(() => {
      const proposerElements = screen.getAllByText(/Proposer/i);
      expect(proposerElements.length).toBeGreaterThan(0);
    });

    const proposerElement = screen
      .getAllByText(/Proposer/i)[0]
      .closest(".react-flow__node");
    expect(proposerElement).toBeTruthy();

    // Perform expand/collapse cycle
    fireEvent.click(proposerElement!);
    await waitFor(() => expect(proposerVisible).toBe(true), { timeout: 5000 });

    fireEvent.click(proposerElement!);
    await waitFor(() => expect(proposerVisible).toBe(false), { timeout: 5000 });

    // Check that Proposer container is still in the DOM after collapse
    await waitFor(() => {
      const finalProposerElements = screen.queryAllByText(/Proposer/i);
      expect(finalProposerElements.length).toBeGreaterThan(0);
      console.log(
        `[ProposerUIBug] ✅ Proposer still visible in DOM after collapse cycle`,
      );
    });

    console.log("[ProposerUIBug] ✅ Proposer visibility test completed");
  });
});
