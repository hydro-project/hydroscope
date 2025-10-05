/**
 * JSONParser Integration Tests
 * Tests JSON parsing with real paxos.json data
 */

import { describe, it, expect } from "vitest";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";

describe("JSONParser Integration Tests", () => {
  describe("Chat.json Integration", () => {
    it("parses chat.json with nested backtrace hierarchy successfully", async () => {
      // Read chat.json file
      const chatPath = path.join(process.cwd(), "test-data", "chat.json");
      const chatContent = fs.readFileSync(chatPath, "utf-8");
      const chatData = JSON.parse(chatContent) as HydroscopeData;

      // Create parser with backtrace hierarchy
      const parser = new JSONParser({ 
        defaultHierarchyChoice: "backtrace",
        debug: false 
      });

      // Parse the data
      const result = await parser.parseData(chatData);

      // Verify basic structure
      expect(result.visualizationState).toBeDefined();
      expect(result.selectedHierarchy).toBe("backtrace");
      expect(result.stats.nodeCount).toBe(9);
      expect(result.stats.edgeCount).toBe(8);
      
      // Verify that nested containers were created
      expect(result.stats.containerCount).toBeGreaterThan(2);
      
      // Verify specific nested containers exist (bt_6 and bt_10 from node assignments)
      const container_bt6 = result.visualizationState.getContainer("bt_6");
      const container_bt10 = result.visualizationState.getContainer("bt_10");
      expect(container_bt6).toBeDefined();
      expect(container_bt10).toBeDefined();
      
      // Verify nodes are properly assigned to nested containers
      expect(result.visualizationState.getNodeContainer("0")).toBe("bt_6");
      expect(result.visualizationState.getNodeContainer("6")).toBe("bt_10");
      
      // Verify no warnings about missing containers
      const containerWarnings = result.warnings.filter(w => 
        w.type === "container_assignment_error" && 
        w.message.includes("non-existent container")
      );
      expect(containerWarnings).toHaveLength(0);
      
      // Verify container hierarchy is established correctly
      // bt_6 should be a child of bt_8, which should be a child of bt_2, etc.
      expect(result.visualizationState.getContainerParent("bt_6")).toBe("bt_8");
      expect(result.visualizationState.getContainerParent("bt_8")).toBe("bt_2");
      expect(result.visualizationState.getContainerParent("bt_10")).toBe("bt_7");
    });
  });

  describe("Paxos.json Integration", () => {
    it("parses paxos.json successfully", async () => {
      // Read paxos.json file
      const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
      const paxosContent = fs.readFileSync(paxosPath, "utf-8");
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;

      // Create paxos-specific parser
      const parser = JSONParser.createPaxosParser({ debug: false });

      // Parse the data
      const result = await parser.parseData(paxosData);

      // Verify basic structure
      expect(result.visualizationState).toBeDefined();
      expect(result.hierarchyChoices).toBeDefined();
      expect(result.selectedHierarchy).toBe("location");
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
      expect(result.stats.containerCount).toBeGreaterThan(0);

      // Verify specific nodes exist
      const node195 = result.visualizationState.getGraphNode("195");
      expect(node195).toBeDefined();
      expect(node195?.label).toBe("cycle_sink");
      expect(node195?.longLabel).toBe("cycle_sink(cycle_10)");

      const node13 = result.visualizationState.getGraphNode("13");
      expect(node13).toBeDefined();
      expect(node13?.label).toBe("persist");
      expect(node13?.longLabel).toBe("persist [state storage]");

      // Verify edges exist
      const edges = result.visualizationState.visibleEdges;
      expect(edges.length).toBeGreaterThan(0);

      // Verify containers exist
      const containers = result.visualizationState.visibleContainers;
      expect(containers.length).toBeGreaterThan(0);

      // Verify node assignments
      const node195Container =
        result.visualizationState.getNodeContainer("195");
      const node13Container = result.visualizationState.getNodeContainer("13");
      expect(node195Container).toBeDefined();
      expect(node13Container).toBeDefined();

      console.log("Paxos.json parsing stats:", result.stats);
      console.log("Warnings:", result.warnings.length);
    }, 30000); // 30 second timeout for large file

    it("handles paxos.json with performance requirements", async () => {
      // Read paxos.json file
      const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
      const paxosContent = fs.readFileSync(paxosPath, "utf-8");
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;

      // Create parser with performance monitoring
      const parser = JSONParser.createPaxosParser({ debug: false });

      const startTime = Date.now();
      const result = await parser.parseData(paxosData);
      const endTime = Date.now();

      // Performance requirements
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.stats.processingTime).toBeLessThan(10000);

      // Memory efficiency - should not have excessive warnings
      expect(result.warnings.length).toBeLessThan(result.stats.nodeCount * 0.1); // Less than 10% warnings

      console.log(`Paxos.json processed in ${endTime - startTime}ms`);
      console.log(
        `Nodes: ${result.stats.nodeCount}, Edges: ${result.stats.edgeCount}, Containers: ${result.stats.containerCount}`
      );
    }, 30000);
  });

  describe("Chat Test Data Integration", () => {
    it("parses chat.json successfully", async () => {
      // Read chat test file
      const chatPath = path.join(process.cwd(), "test-data", "chat.json");
      const chatContent = fs.readFileSync(chatPath, "utf-8");
      const chatData = JSON.parse(chatContent) as HydroscopeData;

      // Create parser
      const parser = new JSONParser({ debug: false });

      // Parse the data
      const result = await parser.parseData(chatData);

      // Verify structure
      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBe(9);
      expect(result.stats.edgeCount).toBe(8);
      expect(result.stats.containerCount).toBe(2);

      // Verify specific nodes exist
      const node0 = result.visualizationState.getGraphNode("0");
      const node5 = result.visualizationState.getGraphNode("5");
      expect(node0?.label).toBe("source_iter");
      expect(node0?.longLabel).toContain("source_iter");
      expect(node5?.label).toBe("persist");
      expect(node5?.longLabel).toBe("persist [state storage]");

      // Verify containers exist for location hierarchy
      const loc0 = result.visualizationState.getContainer("loc_0");
      const loc1 = result.visualizationState.getContainer("loc_1");
      expect(loc0?.label).toBe("hydro_test::cluster::chat::Clients");
      expect(loc1?.label).toBe("hydro_test::cluster::chat::Server");

      // Verify node assignments to location containers
      expect(result.visualizationState.getNodeContainer("0")).toBe("loc_0");
      expect(result.visualizationState.getNodeContainer("2")).toBe("loc_1");
    });
  });
});
