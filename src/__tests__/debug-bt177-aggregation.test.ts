/**
 * Debug test for bt_177 aggregation bug
 * This test specifically hunts for the edge aggregation bug where we create
 * aggregated edges that reference hidden containers like bt_177
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";

describe("Debug bt_177 Aggregation", () => {
  let _coordinator: AsyncCoordinator;

  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;

  beforeEach(async () => {
    const _coordinator = new AsyncCoordinator();
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    // Parse the data
    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(paxosFlippedData);
    visualizationState = parseResult.visualizationState;
  });

  it("should trace edge creation and resolution for bt_177", () => {
    console.log("\n🔍 DEBUGGING bt_177 AGGREGATION BUG");

    // Check if bt_177 exists and what container it's in
    const bt177Container = visualizationState.getContainer("bt_177");
    console.log(`bt_177 container exists: ${!!bt177Container}`);

    if (bt177Container) {
      console.log(
        `bt_177 container hidden: ${bt177Container.hidden}, collapsed: ${bt177Container.collapsed}`,
      );

      // Find the parent hierarchy
      let currentContainer = bt177Container;
      const hierarchy = [currentContainer.id];
      while (currentContainer) {
        const parentId = visualizationState.getContainerParent(
          currentContainer.id,
        );
        if (parentId) {
          const parent = visualizationState.getContainer(parentId);
          if (parent) {
            hierarchy.unshift(parent.id);
            console.log(
              `Parent ${parent.id}: hidden=${parent.hidden}, collapsed=${parent.collapsed}`,
            );
            currentContainer = parent;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      console.log(`bt_177 hierarchy: ${hierarchy.join(" -> ")}`);
    }

    // Perform smart collapse to trigger the bug
    console.log("\n🔄 Performing smart collapse...");
    visualizationState.performSmartCollapse();

    // Check for aggregated edges that reference bt_177
    const aggregatedEdges = visualizationState.getAggregatedEdges();
    console.log(`Total aggregated edges: ${aggregatedEdges.length}`);

    const bt177Edges = aggregatedEdges.filter(
      (edge: any) => edge.source === "bt_177" || edge.target === "bt_177",
    );

    console.log(`Aggregated edges referencing bt_177: ${bt177Edges.length}`);

    for (const edge of bt177Edges) {
      console.error(
        `🚨 PROBLEMATIC EDGE: ${edge.id} (${edge.source} -> ${edge.target})`,
      );
      console.error(`  Aggregation source: ${edge.aggregationSource}`);
      console.error(`  Original edges: ${edge.originalEdgeIds.join(", ")}`);

      // Check if bt_177 container is visible
      const bt177ContainerAfter = visualizationState.getContainer("bt_177");
      if (bt177ContainerAfter) {
        console.error(
          `  bt_177 container hidden: ${bt177ContainerAfter.hidden}`,
        );
      }
    }

    // This should not happen - we should never create aggregated edges that reference hidden nodes
    expect(bt177Edges.length).toBe(0);
  });

  it("should not create aggregated edges referencing hidden containers during ELK layout", async () => {
    console.log("\n🔍 TESTING ELK LAYOUT WITH bt_177");

    // Perform smart collapse
    visualizationState.performSmartCollapse();

    // Check aggregated edges before ELK
    const aggregatedEdges = visualizationState.getAggregatedEdges();
    const problematicEdges = aggregatedEdges.filter((edge: any) => {
      // Check if source or target references a hidden container
      const sourceContainer = visualizationState.getContainer(edge.source);
      const targetContainer = visualizationState.getContainer(edge.target);

      const sourceHidden = sourceContainer && sourceContainer.hidden;
      const targetHidden = targetContainer && targetContainer.hidden;

      return sourceHidden || targetHidden;
    });

    console.log(
      `Problematic aggregated edges before ELK: ${problematicEdges.length}`,
    );

    for (const edge of problematicEdges) {
      console.error(
        `🚨 HIDDEN REFERENCE: ${edge.id} (${edge.source} -> ${edge.target})`,
      );

      const sourceContainer = visualizationState.getContainer(edge.source);
      const targetContainer = visualizationState.getContainer(edge.target);

      if (sourceContainer)
        console.error(
          `  Source container ${edge.source} hidden: ${sourceContainer.hidden}`,
        );
      if (targetContainer)
        console.error(
          `  Target container ${edge.target} hidden: ${targetContainer.hidden}`,
        );
    }

    // This should be 0 - we should never have aggregated edges referencing hidden entities
    expect(problematicEdges.length).toBe(0);

    // Try ELK layout - this should not fail with "Referenced shape does not exist"
    const elkBridge = new ELKBridge();
    let layoutError = null;

    try {
      await elkBridge.layout(visualizationState);
      console.log("✅ ELK layout succeeded");
    } catch (error) {
      layoutError = error;
      console.error("❌ ELK layout failed:", error);
    }

    expect(layoutError).toBeNull();
  });
});
