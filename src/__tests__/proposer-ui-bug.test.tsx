/**
 * Proposer container data processing test
 * Tests JSONParser and VisualizationState handling of Proposer container
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("Proposer Container Data Processing", () => {
  let _paxosData: HydroscopeData;
  let jsonParser: JSONParser;
  let parseResult: any;

  beforeEach(async () => {
    // Load the actual paxos.json file and parse it properly
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosJson = fs.readFileSync(paxosPath, "utf-8");
    const rawData = JSON.parse(paxosJson) as HydroscopeData;

    // Use JSONParser to properly process the data
    jsonParser = JSONParser.createPaxosParser({ debug: false });
    parseResult = await jsonParser.parseData(rawData);

    // Use the processed data
    _paxosData = rawData;

    console.log("[ProposerTest] 🔧 JSONParser processed data:", {
      hierarchyChoices: parseResult.hierarchyChoices.length,
      selectedHierarchy: parseResult.selectedHierarchy,
      containerCount: parseResult.stats.containerCount,
      nodeCount: parseResult.stats.nodeCount,
      edgeCount: parseResult.stats.edgeCount,
    });
  });

  it("should correctly parse and process Proposer container data", async () => {
    console.log("[ProposerTest] 🚀 Testing Proposer container data processing");

    // Verify JSONParser found the Proposer container
    const visualizationState = parseResult.visualizationState;
    expect(visualizationState).toBeTruthy();

    // Check that containers were created
    const containers = visualizationState.getAllContainers();
    console.log(
      "[ProposerTest] 🔍 Total containers created:",
      containers.length,
    );
    expect(containers.length).toBeGreaterThan(0);

    // Find the Proposer container
    const proposerContainer = containers.find(
      (c) => c.label?.includes("Proposer") || c.id === "loc_0",
    );
    console.log(
      "[ProposerTest] 🔍 Proposer container found:",
      !!proposerContainer,
    );
    expect(proposerContainer).toBeTruthy();

    if (proposerContainer) {
      console.log("[ProposerTest] 🔍 Proposer container details:", {
        id: proposerContainer.id,
        label: proposerContainer.label,
        collapsed: proposerContainer.collapsed,
        hidden: proposerContainer.hidden,
      });

      expect(proposerContainer.id).toBe("loc_0");
      expect(proposerContainer.label).toContain("Proposer");
      expect(proposerContainer.collapsed).toBe(false); // Should start expanded
    }

    // Verify nodes were assigned to containers
    const proposerNodes = visualizationState.getContainerNodes("loc_0");
    console.log(
      "[ProposerTest] 🔍 Nodes assigned to Proposer container:",
      proposerNodes.size,
    );
    expect(proposerNodes.size).toBeGreaterThan(0);

    console.log(
      "[ProposerTest] ✅ Proposer container data processing test completed",
    );
  });

  it("should handle Proposer container expand/collapse operations", async () => {
    console.log(
      "[ProposerTest] 🚀 Testing Proposer container state management",
    );

    // Create a fresh VisualizationState and AsyncCoordinator for testing
    const visualizationState = parseResult.visualizationState;
    const { createTestAsyncCoordinator } = await import("../utils/testData.js");
    const testSetup = await createTestAsyncCoordinator();
    const asyncCoordinator = testSetup.asyncCoordinator;

    // Find the Proposer container
    const proposerContainer = visualizationState
      .getAllContainers()
      .find((c) => c.id === "loc_0");
    expect(proposerContainer).toBeTruthy();

    console.log("[ProposerTest] 🔍 Initial Proposer state:", {
      collapsed: proposerContainer!.collapsed,
      hidden: proposerContainer!.hidden,
    });

    // Test collapse operation
    console.log("[ProposerTest] 🔄 Testing collapse operation");
    await asyncCoordinator.collapseContainer("loc_0", visualizationState);

    // Verify container is now collapsed
    const collapsedContainer = visualizationState.getContainer("loc_0");
    expect(collapsedContainer).toBeTruthy();
    expect(collapsedContainer!.collapsed).toBe(true);
    console.log("[ProposerTest] ✅ Container successfully collapsed");

    // Test expand operation
    console.log("[ProposerTest] 🔄 Testing expand operation");
    await asyncCoordinator.expandContainer("loc_0", visualizationState);

    // Verify container is now expanded
    const expandedContainer = visualizationState.getContainer("loc_0");
    expect(expandedContainer).toBeTruthy();
    expect(expandedContainer!.collapsed).toBe(false);
    console.log("[ProposerTest] ✅ Container successfully expanded");

    // Verify container still exists and has correct properties
    expect(expandedContainer!.id).toBe("loc_0");
    expect(expandedContainer!.label).toContain("Proposer");
    expect(expandedContainer!.hidden).toBe(false);

    console.log(
      "[ProposerTest] ✅ Proposer container state management test completed",
    );
  });
});
