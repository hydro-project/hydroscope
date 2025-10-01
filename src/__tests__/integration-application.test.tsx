/**
 * Application Integration Tests: Complete Application with paxos.json
 *
 * Tests file upload of paxos.json through UI
 * Verifies container controls work correctly with loaded data
 * Tests search functionality with paxos.json nodes
 * Validates application performance and responsiveness
 *
 * Requirements: 7.1, 7.2, 7.4, 12.1
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { FileUpload } from "../components/FileUpload.js";
import { loadPaxosTestData } from "../utils/testData.js";
import type {
  HydroscopeData,
  ValidationError,
  ParseError,
} from "../types/core.js";

// Mock FileReader for file upload tests
class MockFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      if (this.error) {
        this.onerror?.({ target: this });
      } else {
        this.onload?.({ target: { result: this.result } });
      }
    }, 10);
  }
}

// Helper to create mock file
const createMockFile = (content: string, name: string = "paxos.json"): File => {
  const blob = new Blob([content], { type: "application/json" });
  return new File([blob], name, { type: "application/json" });
};

// Helper to setup FileReader mock
const setupFileReaderMock = (
  result: string | null,
  error: Error | null = null,
) => {
  const mockInstance = new MockFileReader();
  mockInstance.result = result;
  mockInstance.error = error;
  global.FileReader = vi
    .fn()
    .mockImplementation(() => mockInstance) as typeof FileReader;
  return mockInstance;
};

// Simple test component for file upload testing
const TestFileUpload: React.FC<{
  onDataLoaded?: (data: HydroscopeData, filename: string) => void;
  onValidationError?: (errors: ValidationError[], filename: string) => void;
  onParseError?: (error: ParseError, filename: string) => void;
}> = ({ onDataLoaded, onValidationError, onParseError }) => {
  return (
    <div data-testid="test-file-upload">
      <FileUpload
        onFileLoaded={onDataLoaded}
        onValidationError={onValidationError}
        onParseError={onParseError}
      />
    </div>
  );
};

describe("Application Integration: Complete Application with paxos.json", () => {
  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    originalFileReader = global.FileReader;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  describe("File Upload of paxos.json Through UI", () => {
    it("should successfully upload and process paxos.json file", async () => {
      const paxosData = loadPaxosTestData();
      const paxosJSON = JSON.stringify(paxosData);
      setupFileReaderMock(paxosJSON);

      const onDataLoaded = vi.fn();

      render(<TestFileUpload onDataLoaded={onDataLoaded} />);

      // Upload paxos.json file
      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(paxosJSON, "paxos.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Wait for file processing
      await waitFor(
        () => {
          expect(onDataLoaded).toHaveBeenCalledWith(
            expect.objectContaining({
              nodes: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                }),
              ]),
              edges: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  source: expect.any(String),
                  target: expect.any(String),
                }),
              ]),
            }),
            "paxos.json",
          );
        },
        { timeout: 5000 },
      );
    });

    it("should handle file upload errors gracefully", async () => {
      setupFileReaderMock("{ invalid json }");

      const onParseError = vi.fn();

      render(<TestFileUpload onParseError={onParseError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile("{ invalid json }", "invalid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should call parse error callback
      await waitFor(() => {
        expect(onParseError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "json_parse",
            message: expect.stringContaining("Invalid JSON"),
          }),
          "invalid.json",
        );
      });
    });

    it("should validate paxos.json structure", async () => {
      const invalidPaxosData = {
        nodes: [{ id: null, label: undefined }], // clearly invalid properties
        edges: [
          { id: "edge1", source: "nonexistent", target: "alsononexistent" },
        ], // invalid references
      };
      setupFileReaderMock(JSON.stringify(invalidPaxosData));

      const onValidationError = vi.fn();

      render(<TestFileUpload onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(invalidPaxosData),
        "invalid-paxos.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should call validation error callback
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalled();
      });
    });

    it("should handle large paxos.json files efficiently", async () => {
      // Create a larger dataset based on paxos structure
      const largePaxosData = {
        nodes: Array.from({ length: 500 }, (_, i) => ({
          id: `node_${i}`,
          shortLabel: `Node ${i}`,
          fullLabel: `Full Node Label ${i}`,
          nodeType: i % 3 === 0 ? "Source" : i % 3 === 1 ? "Transform" : "Sink",
        })),
        edges: Array.from({ length: 750 }, (_, i) => ({
          id: `edge_${i}`,
          source: `node_${i % 500}`,
          target: `node_${(i + 1) % 500}`,
          type: "dataflow",
        })),
        hierarchyChoices: [{ id: "location", name: "Location", children: [] }],
        nodeAssignments: {
          location: Object.fromEntries(
            Array.from({ length: 500 }, (_, i) => [
              `node_${i}`,
              `container_${Math.floor(i / 10)}`,
            ]),
          ),
        },
      };

      setupFileReaderMock(JSON.stringify(largePaxosData));

      const onDataLoaded = vi.fn();
      const startTime = Date.now();

      render(<TestFileUpload onDataLoaded={onDataLoaded} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(largePaxosData),
        "large-paxos.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(
        () => {
          expect(onDataLoaded).toHaveBeenCalled();
        },
        { timeout: 10000 },
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process large file within reasonable time (less than 5 seconds)
      expect(processingTime).toBeLessThan(5000);
    });
  });

  describe("Core Integration with VisualizationState", () => {
    it("should integrate paxos.json data with VisualizationState", async () => {
      const paxosData = loadPaxosTestData();
      const state = new VisualizationState();

      // Load nodes
      for (const node of paxosData.nodes) {
        state.addNode({
          id: node.id,
          label: node.shortLabel || node.label || node.id,
          longLabel: node.fullLabel || node.label || node.id,
          type: node.nodeType || "default",
          semanticTags: [],
          hidden: false,
          showingLongLabel: false,
        });
      }

      // Load edges
      for (const edge of paxosData.edges) {
        state.addEdge({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || "dataflow",
          semanticTags: [],
          hidden: false,
        });
      }

      // Verify data was loaded correctly
      expect(state.visibleNodes.length).toBeGreaterThan(0);
      expect(state.visibleEdges.length).toBeGreaterThan(0);

      // Test container operations
      if (paxosData.hierarchyChoices && paxosData.nodeAssignments) {
        const defaultChoice = paxosData.hierarchyChoices[0];
        if (defaultChoice && paxosData.nodeAssignments[defaultChoice.id]) {
          const assignments = paxosData.nodeAssignments[defaultChoice.id];
          const containerMap = new Map<string, Set<string>>();

          // Group nodes by container
          for (const [nodeId, containerId] of Object.entries(assignments)) {
            if (!containerMap.has(containerId)) {
              containerMap.set(containerId, new Set());
            }
            containerMap.get(containerId)!.add(nodeId);
          }

          // Create containers
          for (const [containerId, nodeIds] of containerMap) {
            state.addContainer({
              id: containerId,
              label: containerId,
              children: nodeIds,
              collapsed: true,
              hidden: false,
            });

            // Move nodes to container
            for (const nodeId of nodeIds) {
              if (state.getGraphNode(nodeId)) {
                state.assignNodeToContainer(nodeId, containerId);
              }
            }
          }

          // Test container operations
          expect(state.visibleContainers.length).toBeGreaterThan(0);

          // Test expand/collapse
          state.expandAllContainers();
          const expandedContainers = state.visibleContainers.filter(
            (c) => !c.collapsed,
          );
          expect(expandedContainers.length).toBeGreaterThan(0);

          state.collapseAllContainers();
          const collapsedContainers = state.visibleContainers.filter(
            (c) => c.collapsed,
          );
          expect(collapsedContainers.length).toBeGreaterThan(0);
        }
      }
    });

    it("should handle search operations with paxos.json data", async () => {
      const paxosData = loadPaxosTestData();
      const state = new VisualizationState();

      // Load a subset of nodes for testing
      const testNodes = paxosData.nodes.slice(0, 10);
      for (const node of testNodes) {
        state.addNode({
          id: node.id,
          label: node.shortLabel || node.label || node.id,
          longLabel: node.fullLabel || node.label || node.id,
          type: node.nodeType || "default",
          semanticTags: [],
          hidden: false,
          showingLongLabel: false,
        });
      }

      // Test search functionality
      const searchResults = state.search("persist");
      expect(Array.isArray(searchResults)).toBe(true);

      // Test search clearing
      state.clearSearch();
      // Should not throw errors
    });

    it("should handle performance with large datasets", async () => {
      const state = new VisualizationState();
      const startTime = Date.now();

      // Create large dataset
      const nodeCount = 1000;
      const edgeCount = 1500;

      // Add nodes
      for (let i = 0; i < nodeCount; i++) {
        state.addNode({
          id: `perf_node_${i}`,
          label: `Performance Node ${i}`,
          longLabel: `Full Performance Node Label ${i}`,
          type: "Transform",
          semanticTags: [],
          hidden: false,
          showingLongLabel: false,
        });
      }

      // Add edges
      for (let i = 0; i < edgeCount; i++) {
        state.addEdge({
          id: `perf_edge_${i}`,
          source: `perf_node_${i % nodeCount}`,
          target: `perf_node_${(i + 1) % nodeCount}`,
          type: "dataflow",
          semanticTags: [],
          hidden: false,
        });
      }

      const loadTime = Date.now() - startTime;

      // Should load large dataset efficiently
      expect(loadTime).toBeLessThan(2000); // 2 seconds
      expect(state.visibleNodes.length).toBe(nodeCount);
      expect(state.visibleEdges.length).toBe(edgeCount);

      // Test operations on large dataset
      const operationStartTime = Date.now();

      // Test search
      const searchResults = state.search("Performance");
      expect(searchResults.length).toBeGreaterThan(0);

      const operationTime = Date.now() - operationStartTime;
      expect(operationTime).toBeLessThan(1000); // 1 second
    });
  });
});
