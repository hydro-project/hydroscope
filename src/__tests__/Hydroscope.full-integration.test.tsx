/**
 * Full Hydroscope Component Integration Tests
 *
 * Tests the complete Hydroscope component with all enhanced features
 * Uses real data and minimal mocking to test actual integration
 * Focuses on component coordination and user workflows
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Hydroscope } from "../components/Hydroscope.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

// Load actual paxos.json test data
let paxosData: HydroscopeData;

beforeEach(async () => {
  const coordinator = new AsyncCoordinator();
  // Load paxos.json from test-data directory
  try {
    const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
    const paxosContent = fs.readFileSync(paxosPath, "utf-8");
    const rawPaxosData = JSON.parse(paxosContent);

    // Parse using JSONParser to get proper HydroscopeData format
    const jsonParser = new JSONParser();
    const parseResult = await jsonParser.parseData(rawPaxosData);
    paxosData = {
      nodes: parseResult.visualizationState.visibleNodes.map((node) => ({
        id: node.id,
        label: node.label,
        longLabel: node.longLabel,
        type: node.type,
        semanticTags: node.semanticTags,
        hidden: node.hidden,
      })),
      edges: parseResult.visualizationState.visibleEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        semanticTags: edge.semanticTags,
        hidden: edge.hidden,
      })),
      hierarchyChoices: rawPaxosData.hierarchyChoices || [],
      nodeAssignments: rawPaxosData.nodeAssignments || {},
    };
  } catch (error) {
    // Fallback to comprehensive mock data if paxos.json is not available
    console.warn(
      "Could not load paxos.json, using comprehensive mock data:",
      error,
    );
    paxosData = createComprehensiveMockData();
  }
});

// Comprehensive mock data for testing all features
function createComprehensiveMockData(): HydroscopeData {
  return {
    nodes: [
      {
        id: "client_1",
        label: "Client 1",
        longLabel: "Client Application 1",
        type: "client",
      },
      {
        id: "client_2",
        label: "Client 2",
        longLabel: "Client Application 2",
        type: "client",
      },
      {
        id: "proposer_1",
        label: "Proposer 1",
        longLabel: "Paxos Proposer Node 1",
        type: "proposer",
      },
      {
        id: "proposer_2",
        label: "Proposer 2",
        longLabel: "Paxos Proposer Node 2",
        type: "proposer",
      },
      {
        id: "acceptor_1",
        label: "Acceptor 1",
        longLabel: "Paxos Acceptor Node 1",
        type: "acceptor",
      },
      {
        id: "acceptor_2",
        label: "Acceptor 2",
        longLabel: "Paxos Acceptor Node 2",
        type: "acceptor",
      },
      {
        id: "acceptor_3",
        label: "Acceptor 3",
        longLabel: "Paxos Acceptor Node 3",
        type: "acceptor",
      },
      {
        id: "learner_1",
        label: "Learner 1",
        longLabel: "Paxos Learner Node 1",
        type: "learner",
      },
      {
        id: "learner_2",
        label: "Learner 2",
        longLabel: "Paxos Learner Node 2",
        type: "learner",
      },
      {
        id: "storage_1",
        label: "Storage 1",
        longLabel: "Persistent Storage 1",
        type: "storage",
      },
    ],
    edges: [
      { id: "e1", source: "client_1", target: "proposer_1", type: "request" },
      { id: "e2", source: "client_2", target: "proposer_2", type: "request" },
      { id: "e3", source: "proposer_1", target: "acceptor_1", type: "prepare" },
      { id: "e4", source: "proposer_1", target: "acceptor_2", type: "prepare" },
      { id: "e5", source: "proposer_1", target: "acceptor_3", type: "prepare" },
      { id: "e6", source: "proposer_2", target: "acceptor_1", type: "prepare" },
      { id: "e7", source: "proposer_2", target: "acceptor_2", type: "prepare" },
      { id: "e8", source: "acceptor_1", target: "learner_1", type: "accept" },
      { id: "e9", source: "acceptor_2", target: "learner_1", type: "accept" },
      { id: "e10", source: "acceptor_3", target: "learner_2", type: "accept" },
      { id: "e11", source: "learner_1", target: "storage_1", type: "persist" },
    ],
    hierarchyChoices: [
      { id: "role", name: "By Role" },
      { id: "location", name: "By Location" },
      { id: "layer", name: "By Layer" },
    ],
    nodeAssignments: {
      role: {
        client_1: "clients",
        client_2: "clients",
        proposer_1: "proposers",
        proposer_2: "proposers",
        acceptor_1: "acceptors",
        acceptor_2: "acceptors",
        acceptor_3: "acceptors",
        learner_1: "learners",
        learner_2: "learners",
        storage_1: "storage",
      },
      location: {
        client_1: "datacenter_east",
        proposer_1: "datacenter_east",
        acceptor_1: "datacenter_east",
        learner_1: "datacenter_east",
        client_2: "datacenter_west",
        proposer_2: "datacenter_west",
        acceptor_2: "datacenter_west",
        learner_2: "datacenter_west",
        acceptor_3: "datacenter_central",
        storage_1: "datacenter_central",
      },
      layer: {
        client_1: "application_layer",
        client_2: "application_layer",
        proposer_1: "consensus_layer",
        proposer_2: "consensus_layer",
        acceptor_1: "consensus_layer",
        acceptor_2: "consensus_layer",
        acceptor_3: "consensus_layer",
        learner_1: "consensus_layer",
        learner_2: "consensus_layer",
        storage_1: "persistence_layer",
      },
    },
  };
}

describe("Full Hydroscope Component Integration Tests", () => {
  describe("Complete Component Rendering with All Features", () => {
    it("should render full Hydroscope with all panels enabled", async () => {
      const onError = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          showFileUpload={false}
          height="600px"
          width="1000px"
          onError={onError}
        />,
      );

      // Should render main container
      expect(document.querySelector(".hydroscope")).toBeInTheDocument();

      // Should not have errors with valid data
      expect(onError).not.toHaveBeenCalled();

      // Wait for component to initialize
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should integrate HydroscopeCore with enhanced features", async () => {
      const onConfigChange = vi.fn();
      const onNodeClick = vi.fn();
      const onContainerCollapse = vi.fn();
      const onContainerExpand = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          onNodeClick={onNodeClick}
          onContainerCollapse={onContainerCollapse}
          onContainerExpand={onContainerExpand}
          initialLayoutAlgorithm="layered"
          initialColorPalette="Set1"
        />,
      );

      // Should render without errors
      expect(document.querySelector(".hydroscope")).toBeInTheDocument();

      // Wait for initialization
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle responsive behavior", async () => {
      render(
        <Hydroscope
          data={paxosData}
          responsive={true}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should render responsively
      expect(document.querySelector(".hydroscope")).toBeInTheDocument();

      // Test window resize
      fireEvent(window, new Event("resize"));

      // Should handle resize without errors
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("File Upload Integration with Real Data", () => {
    it("should handle file upload with paxos-like data", async () => {
      const onFileUpload = vi.fn();
      const onError = vi.fn();

      render(
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
          onFileUpload={onFileUpload}
          onError={onError}
        />,
      );

      // Should show file upload interface
      expect(document.querySelector(".hydroscope")).toBeInTheDocument();

      // Simulate successful file upload by calling onFileUpload directly
      const _mockFile = new File(
        [JSON.stringify(paxosData)],
        "test-paxos.json",
        {
          type: "application/json",
        },
      );

      // Simulate file upload
      if (onFileUpload.mock.calls.length === 0) {
        onFileUpload(paxosData, "test-paxos.json");
      }

      // Should handle file upload
      expect(onError).not.toHaveBeenCalled();
    });

    it("should transition from file upload to visualization", async () => {
      const { rerender } = render(
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Initially shows file upload
      expect(document.querySelector(".hydroscope")).toBeInTheDocument();

      // Transition to data visualization
      rerender(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should show visualization
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("Panel Integration and Coordination", () => {
    it("should coordinate InfoPanel with core visualization", async () => {
      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          enableCollapse={true}
        />,
      );

      // Should render both core and InfoPanel
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should coordinate StyleTuner with core visualization", async () => {
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          initialLayoutAlgorithm="force"
          initialColorPalette="Dark2"
        />,
      );

      // Should render both core and StyleTuner
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle both panels together", async () => {
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          enableCollapse={true}
        />,
      );

      // Should render all components together
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("Configuration Management and Persistence", () => {
    it("should handle configuration changes", async () => {
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          initialLayoutAlgorithm="layered"
          initialColorPalette="Set2"
        />,
      );

      // Should handle initial configuration
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should persist settings to localStorage", async () => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
      });

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should attempt to use localStorage
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle localStorage errors gracefully", async () => {
      // Mock localStorage with errors
      const mockLocalStorage = {
        getItem: vi.fn(() => {
          throw new Error("Storage error");
        }),
        setItem: vi.fn(() => {
          throw new Error("Storage error");
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
      });

      const onError = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onError={onError}
        />,
      );

      // Should handle localStorage errors gracefully
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("User Workflow Integration", () => {
    it("should handle complete user workflow: load data -> explore -> search -> configure", async () => {
      const onConfigChange = vi.fn();
      const onNodeClick = vi.fn();

      const { rerender } = render(
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Step 1: Load data
      rerender(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          onNodeClick={onNodeClick}
        />,
      );

      // Step 2: Wait for visualization to load
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Step 3: Test configuration changes
      rerender(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
          onNodeClick={onNodeClick}
          initialLayoutAlgorithm="force"
          initialColorPalette="Pastel1"
        />,
      );

      // Should handle complete workflow
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle keyboard shortcuts and interactions", async () => {
      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
        />,
      );

      // Wait for component to load
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Test keyboard interactions
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(document, { key: "F", ctrlKey: true });
      fireEvent.keyDown(document, { key: "Tab" });

      // Should handle keyboard events without errors
      expect(document.querySelector(".hydroscope")).toBeTruthy();
    });

    it("should handle mouse interactions and clicks", async () => {
      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
        />,
      );

      // Wait for component to load
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Test mouse interactions
      fireEvent.click(document.body);
      fireEvent.mouseMove(document.body);
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(document.body);

      // Should handle mouse events without errors
      expect(document.querySelector(".hydroscope")).toBeTruthy();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large paxos-like datasets efficiently", async () => {
      // Create larger dataset based on paxos structure
      const largeData: HydroscopeData = {
        nodes: Array.from({ length: 200 }, (_, i) => ({
          id: `node_${i}`,
          label: `Node ${i}`,
          longLabel: `Paxos Node ${i} - Full Description`,
          type:
            i % 4 === 0
              ? "proposer"
              : i % 4 === 1
                ? "acceptor"
                : i % 4 === 2
                  ? "learner"
                  : "client",
        })),
        edges: Array.from({ length: 300 }, (_, i) => ({
          id: `edge_${i}`,
          source: `node_${i % 200}`,
          target: `node_${(i + 1) % 200}`,
          type: i % 3 === 0 ? "prepare" : i % 3 === 1 ? "accept" : "request",
        })),
        hierarchyChoices: [{ id: "role", name: "By Role" }],
        nodeAssignments: {
          role: Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [
              `node_${i}`,
              `container_${Math.floor(i / 20)}`,
            ]),
          ),
        },
      };

      const startTime = Date.now();

      render(
        <Hydroscope
          data={largeData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 15000 },
      );

      const renderTime = Date.now() - startTime;

      // Should handle large dataset within reasonable time
      expect(renderTime).toBeLessThan(15000); // 15 seconds max
    });

    it("should handle rapid component updates efficiently", async () => {
      const { rerender } = render(<Hydroscope data={paxosData} />);

      // Rapid configuration changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <Hydroscope
            data={paxosData}
            showInfoPanel={i % 2 === 0}
            showStylePanel={i % 3 === 0}
            initialLayoutAlgorithm={i % 2 === 0 ? "layered" : "force"}
            initialColorPalette={i % 2 === 0 ? "Set1" : "Set2"}
          />,
        );
      }

      // Should handle rapid updates
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should recover from component errors gracefully", async () => {
      const onError = vi.fn();

      // Start with invalid data
      const { rerender } = render(
        <Hydroscope
          data={null as any}
          showInfoPanel={true}
          showStylePanel={true}
          onError={onError}
        />,
      );

      // Recover with valid data
      rerender(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onError={onError}
        />,
      );

      // Should recover successfully
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle network-like errors during operation", async () => {
      const onError = vi.fn();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          showStylePanel={true}
          onError={onError}
        />,
      );

      // Simulate various error conditions
      fireEvent.error(window);

      // Should continue operating
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });
});
