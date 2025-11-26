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
  describe("Simple Cluster Integration", () => {
    it("parses simple_cluster.json with nested backtrace hierarchy successfully", async () => {
      // Read simple_cluster.json file
      const chatPath = path.join(
        process.cwd(),
        "test-data",
        "simple_cluster.json",
      );
      const chatContent = fs.readFileSync(chatPath, "utf-8");
      const chatData = JSON.parse(chatContent) as HydroscopeData;

      // Create parser (will use first hierarchy choice from JSON)
      const parser = new JSONParser({
        debug: false,
      });

      // Parse the data
      const result = await parser.parseData(chatData);

      // Verify basic structure
      expect(result.visualizationState).toBeDefined();
      expect(result.selectedHierarchy).toBe("location"); // First hierarchy choice in simple_cluster.json
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);

      // Verify that location containers were created
      expect(result.stats.containerCount).toBeGreaterThan(0);

      // Verify containers exist
      const containers = result.visualizationState.getAllContainers();
      expect(containers.length).toBeGreaterThan(0);

      // Verify nodes are properly assigned to location containers
      const nodes = result.visualizationState.getAllNodes();
      expect(nodes.length).toBeGreaterThan(0);

      // Verify no warnings about missing containers
      const containerWarnings = result.warnings.filter(
        (w) =>
          w.type === "container_assignment_error" &&
          w.message.includes("non-existent container"),
      );
      expect(containerWarnings).toHaveLength(0);

      // Verify location hierarchy is flat (no parent-child relationships between containers)
      expect(
        result.visualizationState.getContainerParent("loc_0"),
      ).toBeUndefined();
      expect(
        result.visualizationState.getContainerParent("loc_1"),
      ).toBeUndefined();
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
      expect(node195?.label).toBe("crosssingleton");
      expect(node195?.longLabel).toContain("crosssingleton");

      const node13 = result.visualizationState.getGraphNode("13");
      expect(node13).toBeDefined();
      expect(node13?.label).toBe("cycle_source");
      expect(node13?.longLabel).toContain("cycle_source");

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
        `Nodes: ${result.stats.nodeCount}, Edges: ${result.stats.edgeCount}, Containers: ${result.stats.containerCount}`,
      );
    }, 30000);
  });

  describe("Simple Cluster Test Data Integration", () => {
    it("parses simple_cluster.json successfully", async () => {
      // Read simple_cluster test file
      const chatPath = path.join(
        process.cwd(),
        "test-data",
        "simple_cluster.json",
      );
      const chatContent = fs.readFileSync(chatPath, "utf-8");
      const chatData = JSON.parse(chatContent) as HydroscopeData;

      // Create parser
      const parser = new JSONParser({ debug: false });

      // Parse the data
      const result = await parser.parseData(chatData);

      // Verify structure
      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
      expect(result.stats.containerCount).toBeGreaterThan(0);

      // Verify specific nodes exist
      const node0 = result.visualizationState.getGraphNode("0");
      const node5 = result.visualizationState.getGraphNode("5");
      expect(node0?.label).toBe("source_stream");
      expect(node0?.longLabel).toContain("source_stream");
      expect(node5?.label).toBe("source_iter");
      expect(node5?.longLabel).toContain("source_iter");

      // Verify containers exist for location hierarchy
      const containers = result.visualizationState.getAllContainers();
      expect(containers.length).toBeGreaterThan(0);

      // Verify node assignments to location containers
      const nodes = result.visualizationState.getAllNodes();
      expect(nodes.length).toBeGreaterThan(0);
    });
  });
});
