/**
 * @fileoverview Search Navigation InfoPanel Performance Test
 *
 * This test was moved from search-navigation-end-to-end.test.tsx because
 * it was timing out in CI (>5s). It tests searching through the InfoPanel.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Hydroscope } from "../../components/Hydroscope.js";
import type { HydroscopeData } from "../../types/core.js";

describe("Search Navigation InfoPanel Performance", () => {
  let testData: HydroscopeData;

  beforeEach(() => {
    // Create realistic test data that mimics actual Hydro dataflow data
    testData = {
      nodes: [
        {
          id: "node1",
          label: "Test Node 1",
          shortLabel: "Test Node 1",
          fullLabel: "Test Node 1 Full",
          nodeType: "operator",
          position: { x: 0, y: 0 },
        },
        {
          id: "node2",
          label: "Search Target Node",
          shortLabel: "Search Target Node",
          fullLabel: "Search Target Node Full",
          nodeType: "operator",
          position: { x: 100, y: 100 },
        },
        {
          id: "node3",
          label: "Another Node",
          shortLabel: "Another Node",
          fullLabel: "Another Node Full",
          nodeType: "operator",
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
      hierarchyChoices: [
        {
          id: "location",
          name: "Location",
          children: [
            {
              id: "container1",
              name: "Test Container",
              children: [],
            },
            {
              id: "container2",
              name: "Large Container",
              children: [],
            },
          ],
        },
      ],
      nodeAssignments: {
        location: {
          node1: "container1",
          node2: "container1",
          node3: "container2",
        },
      },
    };
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
});
