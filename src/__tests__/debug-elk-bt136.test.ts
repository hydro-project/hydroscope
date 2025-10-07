/**
 * Debug test to understand ELK conversion issues with bt_136
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Debug ELK bt_136", () => {
  let visualizationState: VisualizationState;

  beforeEach(async () => {
    // Load and parse paxos-flipped.json
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    const paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(paxosFlippedData);
    visualizationState = parseResult.visualizationState;

    // Expand runtime/park.rs container to trigger the issue
    const containers = visualizationState.visibleContainers;
    const runtimeParkContainer = containers.find(
      (container) =>
        container.id.includes("runtime/park.rs") ||
        container.label.includes("runtime/park.rs") ||
        container.id.includes("park.rs") ||
        container.label.includes("park.rs"),
    );

    if (runtimeParkContainer) {
      visualizationState.expandContainer(runtimeParkContainer.id);
    }
  });

  it("should show what aggregated edges exist and what containers are visible", () => {
    // Check aggregated edges
    const aggregatedEdges = visualizationState.getAggregatedEdges();
    const bt136Edges = aggregatedEdges.filter(
      (edge) => edge.source === "bt_136" || edge.target === "bt_136",
    );

    // Check container visibility
    const allContainers = visualizationState.getAllContainers();
    const visibleContainers = visualizationState.visibleContainers;

    const bt136Container = visualizationState.getContainer("bt_136");
    const bt136Visible = visibleContainers.find((c) => c.id === "bt_136");

    // Check if bt_136 is a root container
    const bt136Parent = visualizationState.getContainerParent("bt_136");
    const isRoot = !bt136Parent;

    throw new Error(
      `ELK DEBUG: aggregatedEdges=${aggregatedEdges.length}, bt136Edges=${bt136Edges.length}, allContainers=${allContainers.length}, visibleContainers=${visibleContainers.length}, bt136Exists=${!!bt136Container}, bt136Visible=${!!bt136Visible}, bt136IsRoot=${isRoot}, bt136Parent=${bt136Parent}`,
    );
  });
});
