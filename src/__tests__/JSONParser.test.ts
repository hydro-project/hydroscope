/**
 * JSONParser Tests
 * Tests JSON parsing with VisualizationState integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";

// Test data
const simpleTestData: HydroscopeData = {
  nodes: [
    {
      id: "node1",
      shortLabel: "Node 1",
      fullLabel: "Full Node 1 Label",
      nodeType: "Transform",
      semanticTags: ["tag1", "tag2"],
    },
    {
      id: "node2",
      shortLabel: "Node 2",
      fullLabel: "Full Node 2 Label",
      nodeType: "Source",
    },
  ],
  edges: [
    {
      id: "edge1",
      source: "node1",
      target: "node2",
      edgeProperties: ["Unbounded", "TotalOrder"],
    },
  ],
  hierarchyChoices: [
    {
      id: "location",
      name: "Location",
      children: [
        { id: "container1", name: "Container 1", children: [] },
        { id: "container2", name: "Container 2", children: [] },
      ],
    },
  ],
  nodeAssignments: {
    location: {
      node1: "container1",
      node2: "container2",
    },
  },
};

const paxosLikeData: HydroscopeData = {
  nodes: [
    {
      id: "195",
      shortLabel: "cycle_sink",
      fullLabel: "cycle_sink(cycle_10)",
      nodeType: "Sink",
      data: {
        locationId: 2,
        locationType: "Cluster",
      },
    },
    {
      id: "13",
      shortLabel: "persist",
      fullLabel: "persist [state storage]",
      nodeType: "Transform",
      data: {
        locationId: 0,
        locationType: "Cluster",
      },
    },
  ],
  edges: [
    {
      id: "e0",
      source: "195",
      target: "13",
      edgeProperties: ["Unbounded", "TotalOrder"],
      semanticTags: ["Unbounded", "TotalOrder"],
    },
  ],
  hierarchyChoices: [
    {
      id: "location",
      name: "Location",
      children: [
        {
          id: "loc_0",
          name: "hydro_test::cluster::paxos::Proposer",
          children: [],
        },
        {
          id: "loc_2",
          name: "hydro_test::cluster::paxos_bench::Client",
          children: [],
        },
      ],
    },
  ],
  nodeAssignments: {
    location: {
      "195": "loc_2",
      "13": "loc_0",
    },
  },
};

describe("JSONParser", () => {
  let coordinator: AsyncCoordinator;

  let parser: JSONParser;

  beforeEach(() => {
    const coordinator = new AsyncCoordinator();
    parser = new JSONParser();
  });

  describe("Constructor and Configuration", () => {
    it("creates parser with default options", () => {
      const defaultParser = new JSONParser();
      expect(defaultParser).toBeInstanceOf(JSONParser);
    });

    it("creates parser with custom options", () => {
      const customParser = new JSONParser({
        debug: true,
        validateDuringParsing: false,
      });
      expect(customParser).toBeInstanceOf(JSONParser);
    });

    it("creates paxos-specific parser", () => {
      const paxosParser = JSONParser.createPaxosParser();
      expect(paxosParser).toBeInstanceOf(JSONParser);
    });

    it("creates paxos parser with custom options", () => {
      const paxosParser = JSONParser.createPaxosParser({
        debug: true,
        nodeTransformer: (node) => ({ type: "CustomType" }),
      });
      expect(paxosParser).toBeInstanceOf(JSONParser);
    });
  });

  describe("Hierarchy Parsing", () => {
    it("parses hierarchy choices correctly", async () => {
      const result = await parser.parseData(simpleTestData);

      expect(result.hierarchyChoices).toHaveLength(1);
      expect(result.hierarchyChoices[0]).toEqual({
        id: "location",
        name: "Location",
        children: [
          { id: "container1", name: "Container 1", children: [] },
          { id: "container2", name: "Container 2", children: [] },
        ],
      });
    });

    it("handles empty hierarchy choices", async () => {
      const dataWithoutHierarchy = { ...simpleTestData, hierarchyChoices: [] };
      const result = await parser.parseData(dataWithoutHierarchy);

      expect(result.hierarchyChoices).toHaveLength(0);
      expect(result.selectedHierarchy).toBeNull();
    });

    it("selects default hierarchy correctly", async () => {
      const result = await parser.parseData(simpleTestData);
      expect(result.selectedHierarchy).toBe("location");
    });

    it("selects first hierarchy choice as default", async () => {
      const parser = new JSONParser();
      const dataWithMultipleHierarchies = {
        ...simpleTestData,
        hierarchyChoices: [
          { id: "first", name: "First Choice", children: [] },
          { id: "second", name: "Second Choice", children: [] },
          ...simpleTestData.hierarchyChoices,
        ],
        nodeAssignments: {
          first: { node1: "first_container" },
          second: { node1: "second_container" },
          ...simpleTestData.nodeAssignments,
        },
      };

      const result = await parser.parseData(dataWithMultipleHierarchies);
      expect(result.selectedHierarchy).toBe("first"); // Should select first hierarchy choice
    });
  });

  describe("Container Creation", () => {
    it("creates containers from hierarchy", async () => {
      const result = await parser.parseData(simpleTestData);

      const container1 = result.visualizationState.getContainer("container1");
      const container2 = result.visualizationState.getContainer("container2");

      expect(container1).toBeDefined();
      expect(container1?.label).toBe("Container 1");
      expect(container1?.collapsed).toBe(false);

      expect(container2).toBeDefined();
      expect(container2?.label).toBe("Container 2");
      expect(container2?.collapsed).toBe(false);
    });

    it("handles missing containers gracefully", async () => {
      const dataWithMissingContainer = {
        ...simpleTestData,
        nodeAssignments: {
          location: {
            node1: "nonexistent_container",
            node2: "container2",
          },
        },
      };

      const result = await parser.parseData(dataWithMissingContainer);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: "container_assignment_error",
          message: expect.stringContaining("non-existent container"),
        }),
      );
    });
  });

  describe("Node Parsing", () => {
    it("parses nodes correctly", async () => {
      const result = await parser.parseData(simpleTestData);

      const node1 = result.visualizationState.getGraphNode("node1");
      const node2 = result.visualizationState.getGraphNode("node2");

      expect(node1).toBeDefined();
      expect(node1?.label).toBe("Node 1");
      expect(node1?.longLabel).toBe("Full Node 1 Label");
      expect(node1?.type).toBe("Transform");
      expect(node1?.semanticTags).toEqual(["tag1", "tag2"]);

      expect(node2).toBeDefined();
      expect(node2?.label).toBe("Node 2");
      expect(node2?.type).toBe("Source");
    });

    it("handles nodes with missing fields", async () => {
      const dataWithIncompleteNodes = {
        ...simpleTestData,
        nodes: [
          { id: "node1" }, // Missing most fields
          { shortLabel: "Node 2" }, // Missing id
        ],
        edges: [], // Remove edges to avoid validation errors
      };

      const result = await parser.parseData(dataWithIncompleteNodes);

      // Should create node with defaults
      const node1 = result.visualizationState.getGraphNode("node1");
      expect(node1).toBeDefined();
      expect(node1?.label).toBe("Node 0"); // Default label

      // Should create node with generated id
      const nodeWithGeneratedId =
        result.visualizationState.getGraphNode("node_1");
      expect(nodeWithGeneratedId).toBeDefined();
      expect(nodeWithGeneratedId?.label).toBe("Node 2");
    });

    it("applies custom node transformer", async () => {
      const customParser = new JSONParser({
        nodeTransformer: (node) => ({
          type: "CustomType",
          semanticTags: ["custom"],
        }),
      });

      const result = await customParser.parseData(simpleTestData);

      const node1 = result.visualizationState.getGraphNode("node1");
      expect(node1?.type).toBe("CustomType");
      expect(node1?.semanticTags).toContain("custom");
    });
  });

  describe("Node Assignment", () => {
    it("assigns nodes to containers correctly", async () => {
      const result = await parser.parseData(simpleTestData);

      const node1Container =
        result.visualizationState.getNodeContainer("node1");
      const node2Container =
        result.visualizationState.getNodeContainer("node2");

      expect(node1Container).toBe("container1");
      expect(node2Container).toBe("container2");
    });

    it("handles assignment to non-existent nodes", async () => {
      const dataWithBadAssignment = {
        ...simpleTestData,
        nodeAssignments: {
          location: {
            nonexistent_node: "container1",
            node2: "container2",
          },
        },
      };

      const result = await parser.parseData(dataWithBadAssignment);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: "node_assignment_error",
          message: expect.stringContaining("non-existent node"),
        }),
      );
    });
  });

  describe("Edge Parsing", () => {
    it("parses edges correctly", async () => {
      const result = await parser.parseData(simpleTestData);

      const edges = result.visualizationState.visibleEdges;
      expect(edges).toHaveLength(1);

      const edge = edges[0];
      expect(edge.id).toBe("edge1");
      expect(edge.source).toBe("node1");
      expect(edge.target).toBe("node2");
      expect(edge.semanticTags).toEqual(["Unbounded", "TotalOrder"]);
    });

    it("handles edges with missing fields", async () => {
      const dataWithIncompleteEdges = {
        ...simpleTestData,
        edges: [
          { id: "edge1", source: "node1" }, // Missing target
          { source: "node1", target: "node2" }, // Missing id
        ],
      };

      const result = await parser.parseData(dataWithIncompleteEdges);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: "edge_parsing_error",
          message: expect.stringContaining("missing source or target"),
        }),
      );

      // Should still create valid edge with generated id
      const edges = result.visualizationState.visibleEdges;
      expect(edges.length).toBeGreaterThan(0);
    });

    it("applies custom edge transformer", async () => {
      const customParser = new JSONParser({
        edgeTransformer: (edge) => ({
          type: "CustomEdgeType",
          semanticTags: ["custom_edge"],
        }),
      });

      const result = await customParser.parseData(simpleTestData);

      const edges = result.visualizationState.visibleEdges;
      const edge = edges[0];
      expect(edge.type).toBe("CustomEdgeType");
      expect(edge.semanticTags).toContain("custom_edge");
    });
  });

  describe("Paxos-specific Parsing", () => {
    it("parses paxos-like data correctly", async () => {
      const paxosParser = JSONParser.createPaxosParser();
      const result = await paxosParser.parseData(paxosLikeData);

      const node195 = result.visualizationState.getGraphNode("195");
      expect(node195?.label).toBe("cycle_sink");
      expect(node195?.longLabel).toBe("cycle_sink(cycle_10)");
      expect(node195?.type).toBe("Sink");
      expect(node195?.semanticTags).toContain("Sink");
      expect(node195?.semanticTags).toContain("Cluster");

      const edge = result.visualizationState.visibleEdges[0];
      expect(edge.semanticTags).toEqual(["Unbounded", "TotalOrder"]);
    });

    it("handles paxos data with custom transformers", async () => {
      const paxosParser = JSONParser.createPaxosParser({
        nodeTransformer: (node) => ({
          semanticTags: ["paxos_custom"],
        }),
      });

      const result = await paxosParser.parseData(paxosLikeData);

      const node = result.visualizationState.getGraphNode("195");
      expect(node?.semanticTags).toContain("paxos_custom");
    });
  });

  describe("Error Handling", () => {
    it("handles invalid hierarchy choice data", async () => {
      const invalidData = {
        ...simpleTestData,
        hierarchyChoices: [
          { name: "Missing ID" }, // Missing id
          { id: "missing_name" }, // Missing name
        ],
      };

      await expect(parser.parseData(invalidData)).rejects.toThrow();
    });

    it("handles parsing errors gracefully", async () => {
      const dataWithErrors = {
        ...simpleTestData,
        nodes: [
          null, // Invalid node
          { id: "valid_node", shortLabel: "Valid" },
        ],
        edges: [], // Remove edges to avoid validation errors
      };

      const result = await parser.parseData(dataWithErrors);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: "node_parsing_error",
        }),
      );

      // Should still parse valid nodes
      const validNode = result.visualizationState.getGraphNode("valid_node");
      expect(validNode).toBeDefined();
    });

    it("provides detailed error context", async () => {
      const dataWithErrors = {
        ...simpleTestData,
        edges: [
          { id: "bad_edge" }, // Missing source and target
        ],
      };

      const result = await parser.parseData(dataWithErrors);

      const warning = result.warnings.find(
        (w) => w.type === "edge_parsing_error",
      );
      expect(warning?.context).toHaveProperty("edgeIndex");
      expect(warning?.context).toHaveProperty("rawEdge");
    });
  });

  describe("Performance and Statistics", () => {
    it("provides parsing statistics", async () => {
      const result = await parser.parseData(simpleTestData);

      expect(result.stats).toEqual({
        nodeCount: 2,
        edgeCount: 1,
        containerCount: 2,
        processingTime: expect.any(Number),
      });

      expect(result.stats.processingTime).toBeGreaterThanOrEqual(0);
    });

    it("handles large datasets efficiently", async () => {
      // Create larger test dataset
      const largeData: HydroscopeData = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node_${i}`,
          shortLabel: `Node ${i}`,
          nodeType: "Transform",
        })),
        edges: Array.from({ length: 500 }, (_, i) => ({
          id: `edge_${i}`,
          source: `node_${i}`,
          target: `node_${i + 1}`,
        })),
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      const startTime = Date.now();
      const result = await parser.parseData(largeData);
      const endTime = Date.now();

      expect(result.stats.nodeCount).toBe(1000);
      expect(result.stats.edgeCount).toBe(500);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Debug Mode", () => {
    it("logs debug messages when enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const debugParser = new JSONParser({ debug: true });
      await debugParser.parseData(simpleTestData);

      // Check that console.log was called with debug messages
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls;
      const debugCalls = calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("[JSONParser]"),
      );
      expect(debugCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it("does not log when debug is disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const quietParser = new JSONParser({ debug: false });
      await quietParser.parseData(simpleTestData);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("[JSONParser]"),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Validation", () => {
    it("validates during parsing when enabled", async () => {
      const validatingParser = new JSONParser({ validateDuringParsing: true });

      // This should not throw if validation passes
      await expect(
        validatingParser.parseData(simpleTestData),
      ).resolves.toBeDefined();
    });

    it("skips validation when disabled", async () => {
      const nonValidatingParser = new JSONParser({
        validateDuringParsing: false,
      });

      // Should complete even with potentially invalid data
      await expect(
        nonValidatingParser.parseData(simpleTestData),
      ).resolves.toBeDefined();
    });
  });
});
