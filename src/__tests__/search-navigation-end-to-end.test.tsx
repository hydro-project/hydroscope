/**
 * @fileoverview Search Navigation End-to-End Integration Tests
 *
 * Tests the complete search and navigation workflow using the main Hydroscope component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Hydroscope } from "../components/Hydroscope.js";
import type { HydroscopeData } from "../types/core.js";

describe("Search Navigation End-to-End Integration", () => {
  let testData: HydroscopeData;

  beforeEach(() => {
    // Create realistic test data that mimics actual Hydro dataflow data
    testData = {
      nodes: [
        {
          id: "node1",
          label: "Test Node 1",
          position: { x: 0, y: 0 },
        },
        {
          id: "node2",
          label: "Search Target Node",
          position: { x: 100, y: 100 },
        },
        {
          id: "node3",
          label: "Another Node",
          position: { x: 200, y: 200 },
        },
      ],
      edges: [
        {
          id: "edge1",
          source: "node1",
          target: "node2",
          type: "default",
          semanticTags: [],
          hidden: false,
        },
      ],
      containers: [
        {
          id: "container1",
          label: "Test Container",
          children: new Set(["node1", "node2"]),
          collapsed: true,
          hidden: false,
          position: { x: 300, y: 300 },
          width: 200,
          height: 150,
        },
      ],
      aggregatedEdges: [],
    };
  });

  describe("Complete Search and Navigation Workflow", () => {
    it("should render Hydroscope with search and navigation functionality", async () => {
      render(
        <div style={{ width: "800px", height: "600px" }}>
          <Hydroscope
            data={testData}
            width="100%"
            height="100%"
            showInfoPanel={true}
          />
        </div>,
      );

      // Wait for the component to load
      await waitFor(
        () => {
          expect(screen.getByText("Test Container")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("should allow searching through the InfoPanel", async () => {
      render(
        <div style={{ width: "800px", height: "600px" }}>
          <Hydroscope
            data={testData}
            width="100%"
            height="100%"
            showInfoPanel={true}
          />
        </div>,
      );

      // Wait for initial load
      await waitFor(
        () => {
          expect(screen.getByText("Test Container")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Look for search input in the InfoPanel
      const searchInputs = screen.getAllByRole("combobox");
      expect(searchInputs.length).toBeGreaterThan(0);

      // Try to search
      const searchInput = searchInputs[0];
      fireEvent.change(searchInput, { target: { value: "Test" } });

      // Should show search results
      await waitFor(
        () => {
          const resultCountElements = screen.getAllByText(/\d+.*results?/i);
          expect(resultCountElements.length).toBeGreaterThan(0);
        },
        { timeout: 2000 },
      );
    });

    it("should allow navigation from tree to graph", async () => {
      render(
        <div style={{ width: "800px", height: "600px" }}>
          <Hydroscope
            data={testData}
            width="100%"
            height="100%"
            showInfoPanel={true}
          />
        </div>,
      );

      // Wait for initial load
      await waitFor(
        () => {
          expect(screen.getByText("Test Container")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Click on a tree item to trigger navigation
      const containerElement = screen.getByText("Test Container");
      fireEvent.click(containerElement);

      // The navigation should not crash the component
      // (We can't easily test the actual graph highlighting without a full ReactFlow setup)
      expect(containerElement).toBeInTheDocument();
    });
  });

  describe("Error Handling in Real Integration", () => {
    it("should handle malformed data gracefully", async () => {
      const malformedData = {
        nodes: [
          {
            id: "node1",
            label: "Test Node",
            // Missing position - this might cause issues
          },
        ],
        edges: [],
        containers: [],
        aggregatedEdges: [],
      } as any;

      expect(() => {
        render(
          <div style={{ width: "800px", height: "600px" }}>
            <Hydroscope
              data={malformedData}
              width="100%"
              height="100%"
              showInfoPanel={true}
            />
          </div>,
        );
      }).not.toThrow();
    });

    it("should handle empty data gracefully", async () => {
      const emptyData = {
        nodes: [],
        edges: [],
        containers: [],
        aggregatedEdges: [],
      };

      expect(() => {
        render(
          <div style={{ width: "800px", height: "600px" }}>
            <Hydroscope
              data={emptyData}
              width="100%"
              height="100%"
              showInfoPanel={true}
            />
          </div>,
        );
      }).not.toThrow();
    });
  });

  describe("Performance with Realistic Data", () => {
    it("should handle moderately sized graphs without performance issues", async () => {
      // Create a larger dataset to test performance
      const largeData: HydroscopeData = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          position: { x: i * 50, y: i * 50 },
        })),
        edges: Array.from({ length: 30 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${(i + 1) % 50}`,
          type: "default",
          semanticTags: [],
          hidden: false,
        })),
        containers: [
          {
            id: "container1",
            label: "Large Container",
            children: new Set(Array.from({ length: 25 }, (_, i) => `node${i}`)),
            collapsed: true,
            hidden: false,
            position: { x: 0, y: 0 },
            width: 400,
            height: 300,
          },
        ],
        aggregatedEdges: [],
      };

      const startTime = performance.now();

      render(
        <div style={{ width: "800px", height: "600px" }}>
          <Hydroscope
            data={largeData}
            width="100%"
            height="100%"
            showInfoPanel={true}
          />
        </div>,
      );

      // Wait for render to complete
      await waitFor(
        () => {
          expect(screen.getByText("Large Container")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (5 seconds)
      expect(renderTime).toBeLessThan(5000);
    });
  });
});
