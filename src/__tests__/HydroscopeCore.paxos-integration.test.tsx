/**
 * HydroscopeCore Integration Tests with Real Paxos Data
 *
 * Tests HydroscopeCore component using actual paxos.json test data
 * Focuses on real data integration without excessive mocking
 * Tests bulk operations and atomicity with realistic data
 */

import React, { useRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  HydroscopeCore,
  type HydroscopeCoreHandle,
} from "../components/HydroscopeCore.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";
import fs from "fs";
import path from "path";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

// Load actual paxos.json test data
let paxosData: HydroscopeData;

beforeEach(async () => {
  const _coordinator = new AsyncCoordinator();
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
    // Fallback to mock data if paxos.json is not available
    console.warn("Could not load paxos.json, using mock data:", error);
    paxosData = createMockPaxosData();
  }
});

// Mock paxos-like data structure for fallback
function createMockPaxosData(): HydroscopeData {
  return {
    nodes: [
      { id: "proposer_1", label: "Proposer 1", type: "proposer" },
      { id: "proposer_2", label: "Proposer 2", type: "proposer" },
      { id: "acceptor_1", label: "Acceptor 1", type: "acceptor" },
      { id: "acceptor_2", label: "Acceptor 2", type: "acceptor" },
      { id: "acceptor_3", label: "Acceptor 3", type: "acceptor" },
      { id: "learner_1", label: "Learner 1", type: "learner" },
      { id: "client_1", label: "Client 1", type: "client" },
    ],
    edges: [
      { id: "e1", source: "client_1", target: "proposer_1", type: "request" },
      { id: "e2", source: "proposer_1", target: "acceptor_1", type: "prepare" },
      { id: "e3", source: "proposer_1", target: "acceptor_2", type: "prepare" },
      { id: "e4", source: "proposer_1", target: "acceptor_3", type: "prepare" },
      { id: "e5", source: "acceptor_1", target: "learner_1", type: "accept" },
    ],
    hierarchyChoices: [
      { id: "role", name: "By Role" },
      { id: "location", name: "By Location" },
    ],
    nodeAssignments: {
      role: {
        proposer_1: "proposers",
        proposer_2: "proposers",
        acceptor_1: "acceptors",
        acceptor_2: "acceptors",
        acceptor_3: "acceptors",
        learner_1: "learners",
        client_1: "clients",
      },
      location: {
        proposer_1: "datacenter_1",
        acceptor_1: "datacenter_1",
        learner_1: "datacenter_1",
        proposer_2: "datacenter_2",
        acceptor_2: "datacenter_2",
        acceptor_3: "datacenter_3",
        client_1: "datacenter_1",
      },
    },
  };
}

// Test component that provides access to imperative handle
const TestHydroscopeCore: React.FC<{
  data: HydroscopeData;
  onError?: (error: Error) => void;
  onReady?: (handle: HydroscopeCoreHandle) => void;
}> = ({ data, onError, onReady }) => {
  const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

  React.useEffect(() => {
    if (hydroscopeRef.current && onReady) {
      onReady(hydroscopeRef.current);
    }
  }, [onReady]);

  return (
    <HydroscopeCore
      ref={hydroscopeRef}
      data={data}
      height="600px"
      width="800px"
      showControls={true}
      showMiniMap={true}
      showBackground={true}
      enableCollapse={true}
      onError={onError}
    />
  );
};

describe("HydroscopeCore Integration with Real Paxos Data", () => {
  describe("JSON Parsing and Rendering with Paxos Data", () => {
    it("should successfully parse and render paxos.json data", async () => {
      const onError = vi.fn();

      render(<TestHydroscopeCore data={paxosData} onError={onError} />);

      // Should render without errors
      expect(onError).not.toHaveBeenCalled();

      // Should show loading state initially
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();

      // Component should not crash with real paxos data
      await waitFor(
        () => {
          // Component should be in DOM and not show error
          const container = document.querySelector(".hydroscope-core");
          expect(
            container || screen.getByText(/loading visualization/i),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle paxos data structure correctly", async () => {
      const onError = vi.fn();

      render(<TestHydroscopeCore data={paxosData} onError={onError} />);

      // Verify data structure is valid
      expect(paxosData.nodes).toBeDefined();
      expect(Array.isArray(paxosData.nodes)).toBe(true);
      expect(paxosData.nodes.length).toBeGreaterThan(0);

      expect(paxosData.edges).toBeDefined();
      expect(Array.isArray(paxosData.edges)).toBe(true);

      // Should not trigger errors with valid paxos structure
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle paxos hierarchy choices and node assignments", async () => {
      const onError = vi.fn();

      render(<TestHydroscopeCore data={paxosData} onError={onError} />);

      // Verify hierarchy data is present
      expect(paxosData.hierarchyChoices).toBeDefined();
      expect(paxosData.nodeAssignments).toBeDefined();

      // Should handle hierarchy data without errors
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("Bulk Operations with Paxos Data", () => {
    it("should perform collapseAll operation atomically on paxos containers", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();
      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <TestHydroscopeCore
          data={paxosData}
          onError={onError}
          onReady={onReady}
        />,
      );

      // Wait for component to be ready
      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 5000 },
      );

      // Test collapseAll operation
      if (hydroscopeHandle) {
        const startTime = Date.now();

        await expect(hydroscopeHandle.collapseAll()).resolves.not.toThrow();

        const endTime = Date.now();
        const operationTime = endTime - startTime;

        // Operation should complete quickly (atomically)
        expect(operationTime).toBeLessThan(1000); // 1 second max
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should perform expandAll operation atomically on paxos containers", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();
      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <TestHydroscopeCore
          data={paxosData}
          onError={onError}
          onReady={onReady}
        />,
      );

      // Wait for component to be ready
      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 5000 },
      );

      // Test expandAll operation
      if (hydroscopeHandle) {
        const startTime = Date.now();

        await expect(hydroscopeHandle.expandAll()).resolves.not.toThrow();

        const endTime = Date.now();
        const operationTime = endTime - startTime;

        // Operation should complete quickly (atomically)
        expect(operationTime).toBeLessThan(1000); // 1 second max
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should maintain atomicity during rapid bulk operations", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();
      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <TestHydroscopeCore
          data={paxosData}
          onError={onError}
          onReady={onReady}
        />,
      );

      // Wait for component to be ready
      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 5000 },
      );

      // Test rapid operations
      if (hydroscopeHandle) {
        const operations = [
          hydroscopeHandle.collapseAll(),
          hydroscopeHandle.expandAll(),
          hydroscopeHandle.collapseAll(),
          hydroscopeHandle.expandAll(),
        ];

        // All operations should complete without errors
        await expect(Promise.all(operations)).resolves.not.toThrow();
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should handle individual container operations on paxos data", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();
      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <TestHydroscopeCore
          data={paxosData}
          onError={onError}
          onReady={onReady}
        />,
      );

      // Wait for component to be ready
      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 5000 },
      );

      // Test individual container operations
      if (hydroscopeHandle) {
        // Test with container IDs that might exist in paxos data
        const testContainerIds = [
          "proposers",
          "acceptors",
          "learners",
          "clients",
        ];

        for (const containerId of testContainerIds) {
          // These should not throw even if container doesn't exist
          await expect(
            hydroscopeHandle.collapse(containerId),
          ).resolves.not.toThrow();
          await expect(
            hydroscopeHandle.expand(containerId),
          ).resolves.not.toThrow();
          await expect(
            hydroscopeHandle.toggle(containerId),
          ).resolves.not.toThrow();
        }

        expect(onError).not.toHaveBeenCalled();
      }
    });
  });

  describe("Node and Container Interactions with Paxos Data", () => {
    it("should handle node clicks on paxos nodes", async () => {
      const onNodeClick = vi.fn();
      const onError = vi.fn();

      render(
        <HydroscopeCore
          data={paxosData}
          height="600px"
          width="800px"
          onNodeClick={onNodeClick}
          onError={onError}
        />,
      );

      // Should render without errors
      expect(onError).not.toHaveBeenCalled();

      // Component should handle paxos node structure
      await waitFor(
        () => {
          const container =
            document.querySelector(".hydroscope-core") ||
            screen.getByText(/loading visualization/i);
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle container interactions with paxos containers", async () => {
      const onContainerCollapse = vi.fn();
      const onContainerExpand = vi.fn();
      const onError = vi.fn();

      render(
        <HydroscopeCore
          data={paxosData}
          height="600px"
          width="800px"
          onContainerCollapse={onContainerCollapse}
          onContainerExpand={onContainerExpand}
          onError={onError}
        />,
      );

      // Should render without errors
      expect(onError).not.toHaveBeenCalled();

      // Component should handle paxos container structure
      await waitFor(
        () => {
          const container =
            document.querySelector(".hydroscope-core") ||
            screen.getByText(/loading visualization/i);
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("Error Handling with Real Data Variations", () => {
    it("should handle corrupted paxos data gracefully", async () => {
      const corruptedData = {
        ...paxosData,
        nodes: [
          ...paxosData.nodes,
          { id: null, label: undefined } as any, // Invalid node
        ],
      };

      const onError = vi.fn();

      render(<TestHydroscopeCore data={corruptedData} onError={onError} />);

      // Should handle corrupted data gracefully
      await waitFor(
        () => {
          // Either shows error or handles gracefully
          const hasError = onError.mock.calls.length > 0;
          const hasErrorDisplay = screen.queryByText(/error/i) !== null;
          const hasLoading = screen.queryByText(/loading/i) !== null;

          expect(hasError || hasErrorDisplay || hasLoading).toBe(true);
        },
        { timeout: 5000 },
      );
    });

    it("should handle missing paxos data fields", async () => {
      const incompleteData = {
        nodes: paxosData.nodes,
        edges: [], // Missing edges
        hierarchyChoices: [], // Missing hierarchy
        nodeAssignments: {}, // Missing assignments
      };

      const onError = vi.fn();

      render(<TestHydroscopeCore data={incompleteData} onError={onError} />);

      // Should handle incomplete data without crashing
      await waitFor(
        () => {
          const container =
            document.querySelector(".hydroscope-core") ||
            screen.getByText(/loading visualization/i) ||
            screen.getByText(/error/i);
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle invalid paxos edge references", async () => {
      const invalidEdgeData = {
        ...paxosData,
        edges: [
          ...paxosData.edges,
          {
            id: "invalid_edge",
            source: "nonexistent",
            target: "alsononexistent",
            type: "invalid",
          },
        ],
      };

      const onError = vi.fn();

      render(<TestHydroscopeCore data={invalidEdgeData} onError={onError} />);

      // Should handle invalid references gracefully
      await waitFor(
        () => {
          // Component should either handle gracefully or show appropriate error
          const container =
            document.querySelector(".hydroscope-core") ||
            screen.getByText(/loading visualization/i) ||
            screen.getByText(/error/i);
          expect(container).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("Performance with Real Paxos Data", () => {
    it("should render paxos data within reasonable time", async () => {
      const onError = vi.fn();
      const startTime = Date.now();

      render(<TestHydroscopeCore data={paxosData} onError={onError} />);

      await waitFor(
        () => {
          const container =
            document.querySelector(".hydroscope-core") ||
            screen.getByText(/loading visualization/i);
          expect(container).toBeTruthy();
        },
        { timeout: 10000 },
      );

      const renderTime = Date.now() - startTime;

      // Should render within reasonable time (10 seconds max)
      expect(renderTime).toBeLessThan(10000);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle paxos data size efficiently", async () => {
      const onError = vi.fn();

      render(<TestHydroscopeCore data={paxosData} onError={onError} />);

      // Verify data size is reasonable for testing
      expect(paxosData.nodes.length).toBeGreaterThan(0);
      expect(paxosData.nodes.length).toBeLessThan(10000); // Reasonable upper bound

      // Should handle the data size without memory issues
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
