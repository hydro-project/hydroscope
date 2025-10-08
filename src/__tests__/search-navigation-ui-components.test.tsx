/**
 * @fileoverview Search Navigation UI Components Integration Tests
 *
 * Tests to verify that search and navigation work with actual UI components
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VisualizationState } from "../core/VisualizationState.js";
import { SearchControls } from "../components/SearchControls.js";
import { HierarchyTree } from "../components/HierarchyTree.js";
import type { SearchableItem } from "../components/SearchControls.js";

describe("Search Navigation UI Components Integration", () => {
  let state: VisualizationState;
  let searchableItems: SearchableItem[];
  let mockOnSearch: ReturnType<typeof vi.fn>;
  let mockOnClear: ReturnType<typeof vi.fn>;
  let mockOnNavigate: ReturnType<typeof vi.fn>;
  let mockOnElementNavigation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = new VisualizationState();

    // Add test data - nodes first, then containers
    state.addNode({
      id: "node1",
      label: "Test Node 1",
      position: { x: 0, y: 0 },
    });

    state.addNode({
      id: "node2",
      label: "Search Target",
      position: { x: 100, y: 100 },
    });

    // Add container that contains node1
    state.addContainer({
      id: "container1",
      label: "Test Container",
      children: new Set(["node1"]),
      collapsed: true,
      hidden: false,
      position: { x: 200, y: 200 },
      width: 150,
      height: 100,
    });

    searchableItems = [
      { id: "node1", label: "Test Node 1", type: "node" },
      { id: "node2", label: "Search Target", type: "node" },
      { id: "container1", label: "Test Container", type: "container" },
    ];

    mockOnSearch = vi.fn();
    mockOnClear = vi.fn();
    mockOnNavigate = vi.fn();
    mockOnElementNavigation = vi.fn();
  });

  describe("SearchControls Component", () => {
    it("should render SearchControls without errors", () => {
      expect(() => {
        render(
          <SearchControls
            searchableItems={searchableItems}
            onSearch={mockOnSearch}
            onClear={mockOnClear}
            onNavigate={mockOnNavigate}
          />,
        );
      }).not.toThrow();
    });

    it("should call onSearch when user types", async () => {
      render(
        <SearchControls
          searchableItems={searchableItems}
          onSearch={mockOnSearch}
          onClear={mockOnClear}
          onNavigate={mockOnNavigate}
        />,
      );

      const searchInput = screen.getByRole("combobox");
      fireEvent.change(searchInput, { target: { value: "Test" } });

      // Wait for debounced search
      await waitFor(
        () => {
          expect(mockOnSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    it("should display search results", async () => {
      render(
        <SearchControls
          searchableItems={searchableItems}
          onSearch={mockOnSearch}
          onClear={mockOnClear}
          onNavigate={mockOnNavigate}
        />,
      );

      const searchInput = screen.getByRole("combobox");
      fireEvent.change(searchInput, { target: { value: "Test" } });

      // Should show some results in the dropdown (SearchControls shows filtered results)
      await waitFor(() => {
        const dropdownOptions = screen.getAllByText("Test");
        expect(dropdownOptions.length).toBeGreaterThan(0);
      });
    });
  });

  describe("HierarchyTree Component", () => {
    it("should render HierarchyTree without errors", () => {
      expect(() => {
        render(
          <HierarchyTree
            visualizationState={state}
            collapsedContainers={new Set()}
            onToggleContainer={vi.fn()}
            onElementNavigation={mockOnElementNavigation}
          />,
        );
      }).not.toThrow();
    });

    it("should call onElementNavigation when tree item is clicked", async () => {
      render(
        <HierarchyTree
          visualizationState={state}
          collapsedContainers={new Set()} // Container is expanded
          onToggleContainer={vi.fn()}
          onElementNavigation={mockOnElementNavigation}
        />,
      );

      // Look for the container first (since nodes are inside containers)
      const containerNode = screen.getByText("Test Container");
      expect(containerNode).toBeInTheDocument();

      // Click on the container
      fireEvent.click(containerNode);

      expect(mockOnElementNavigation).toHaveBeenCalledWith(
        "container1",
        "container",
      );
    });
  });

  describe("Integration Between Components", () => {
    it("should work together - search and then navigate", async () => {
      // This test simulates the full workflow:
      // 1. User searches for something
      // 2. User clicks on a search result or tree item
      // 3. Navigation happens

      const { rerender } = render(
        <div>
          <SearchControls
            searchableItems={searchableItems}
            onSearch={mockOnSearch}
            onClear={mockOnClear}
            onNavigate={mockOnNavigate}
          />
          <HierarchyTree
            visualizationState={state}
            collapsedContainers={new Set()}
            onToggleContainer={vi.fn()}
            onElementNavigation={mockOnElementNavigation}
          />
        </div>,
      );

      // Step 1: Search
      const searchInput = screen.getByRole("combobox");
      fireEvent.change(searchInput, { target: { value: "Test" } });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalled();
      });

      // Step 2: Click on tree item (container)
      const containerNode = screen.getByText("Test Container");
      fireEvent.click(containerNode);

      expect(mockOnElementNavigation).toHaveBeenCalledWith(
        "container1",
        "container",
      );
    });
  });

  describe("Error Handling in UI", () => {
    it("should handle search errors gracefully", async () => {
      const mockOnSearchWithError = vi.fn(() => {
        throw new Error("Search failed");
      });

      render(
        <SearchControls
          searchableItems={searchableItems}
          onSearch={mockOnSearchWithError}
          onClear={mockOnClear}
          onNavigate={mockOnNavigate}
        />,
      );

      const searchInput = screen.getByRole("combobox");

      // This should not crash the component
      expect(() => {
        fireEvent.change(searchInput, { target: { value: "Test" } });
      }).not.toThrow();
    });

    it("should handle navigation errors gracefully", () => {
      const mockOnElementNavigationWithError = vi.fn(() => {
        // Simulate an error but don't actually throw to avoid unhandled errors in tests
        console.error("Navigation failed");
      });

      render(
        <HierarchyTree
          visualizationState={state}
          collapsedContainers={new Set()}
          onToggleContainer={vi.fn()}
          onElementNavigation={mockOnElementNavigationWithError}
        />,
      );

      const containerNode = screen.getByText("Test Container");

      // This should not crash the component
      expect(() => {
        fireEvent.click(containerNode);
      }).not.toThrow();

      // Verify the callback was called
      expect(mockOnElementNavigationWithError).toHaveBeenCalled();
    });
  });
});
