/**
 * Search Integration Tests
 * Tests for search integration with container expansion and smart collapse prevention
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SearchIntegration,
  type SearchIntegrationProps,
} from "../components/SearchIntegration.js";
import { VisualizationState } from "../core/VisualizationState.js";
import type { SearchResult } from "../types/core.js";

describe("SearchIntegration Component", () => {
  let visualizationState: VisualizationState;

  const mockSearchResults: SearchResult[] = [
    {
      id: "node1",
      label: "Hidden Node",
      type: "node",
      matchIndices: [[0, 6]],
    },
    {
      id: "container1",
      label: "Collapsed Container",
      type: "container",
      matchIndices: [[0, 9]],
    },
  ];

  const defaultProps: SearchIntegrationProps = {
    visualizationState,
    onSearchResultSelect: vi.fn(),
    onContainerExpansion: vi.fn(),
    onLayoutUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a fresh VisualizationState for each test
    visualizationState = new VisualizationState();

    // Add test data
    visualizationState.addContainer({
      id: "container1",
      label: "Collapsed Container",
      children: new Set(["node1"]),
      collapsed: true,
      hidden: false,
    });

    visualizationState.addNode({
      id: "node1",
      label: "Hidden Node",
      type: "node",
      semanticTags: [],
      hidden: true, // Hidden because parent container is collapsed
    });

    defaultProps.visualizationState = visualizationState;
  });

  describe("Search Result Expansion", () => {
    it("should expand containers when search results are in collapsed containers", async () => {
      const onContainerExpansion = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onContainerExpansion={onContainerExpansion}
        />,
      );

      // Perform search that finds node in collapsed container
      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should expand the container to show the search result
        expect(onContainerExpansion).toHaveBeenCalledWith("container1");
      });
    });

    it("should expand parent containers when search result is nested", async () => {
      // First, clear existing containers and nodes
      visualizationState.clearSearch();

      // Add nested container structure - parent contains container1, container1 contains node1
      visualizationState.addContainer({
        id: "parent-container",
        label: "Parent Container",
        children: new Set(["container1"]),
        collapsed: true,
        hidden: false,
      });

      // Update container1 to be child of parent-container
      visualizationState.addContainer({
        id: "container1",
        label: "Collapsed Container",
        children: new Set(["node1"]),
        collapsed: true,
        hidden: true, // Hidden because parent is collapsed
      });

      // Update node1 to be in container1
      visualizationState.addNode({
        id: "node1",
        label: "Hidden Node",
        type: "node",
        semanticTags: [],
        hidden: true, // Hidden because containers are collapsed
      });

      const onContainerExpansion = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onContainerExpansion={onContainerExpansion}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should expand the parent container first (since it's the outermost collapsed container)
        expect(onContainerExpansion).toHaveBeenCalledWith("parent-container");
      });
    });

    it("should not expand containers that are already expanded", async () => {
      // Make container already expanded
      visualizationState.expandContainer("container1");

      const onContainerExpansion = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onContainerExpansion={onContainerExpansion}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should not call expansion for already expanded container
        expect(onContainerExpansion).not.toHaveBeenCalled();
      });
    });
  });

  describe("Smart Collapse Prevention", () => {
    it("should disable smart collapse when search expands containers", async () => {
      const onLayoutUpdate = vi.fn();
      render(
        <SearchIntegration {...defaultProps} onLayoutUpdate={onLayoutUpdate} />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should disable smart collapse for user operations
        const smartCollapseStatus = visualizationState.getSmartCollapseStatus();
        expect(smartCollapseStatus.enabled).toBe(false);
      });
    });

    it("should track containers expanded for search separately", async () => {
      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should track that container was expanded for search
        const searchExpandedContainers =
          visualizationState.getSearchExpandedContainers();
        expect(searchExpandedContainers).toContain("container1");
      });
    });

    it("should not affect containers expanded by user manually", async () => {
      // User manually expands a different container
      visualizationState.addContainer({
        id: "user-container",
        label: "User Container",
        children: new Set(["user-node"]),
        collapsed: false, // User expanded
        hidden: false,
      });

      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        const searchExpandedContainers =
          visualizationState.getSearchExpandedContainers();
        // Should only track search-expanded containers
        expect(searchExpandedContainers).toContain("container1");
        expect(searchExpandedContainers).not.toContain("user-container");
      });
    });
  });

  describe("Search Result Highlighting in Graph", () => {
    it("should highlight search results in the rendered graph", async () => {
      const onSearchResultSelect = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onSearchResultSelect={onSearchResultSelect}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should have search results with highlighting
        const searchResults = visualizationState.getSearchResults();
        expect(searchResults).toHaveLength(1);
        expect(searchResults[0].matchIndices).toEqual([[0, 6]]);
      });
    });

    it("should clear highlighting when search is cleared", async () => {
      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        expect(visualizationState.getSearchResults()).toHaveLength(1);
      });

      // Clear search
      const clearButton = screen.getByRole("button", { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(visualizationState.getSearchResults()).toHaveLength(0);
        expect(visualizationState.getSearchQuery()).toBe("");
      });
    });

    it("should update highlighting when search query changes", async () => {
      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });

      // First search
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        expect(visualizationState.getSearchResults()).toHaveLength(1);
        expect(visualizationState.getSearchResults()[0].id).toBe("node1");
      });

      // Change search
      fireEvent.change(searchInput, { target: { value: "Container" } });

      await waitFor(() => {
        expect(visualizationState.getSearchResults()).toHaveLength(1);
        expect(visualizationState.getSearchResults()[0].id).toBe("container1");
      });
    });
  });

  describe("Search Result Selection", () => {
    it("should select search result when clicked", async () => {
      const onSearchResultSelect = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onSearchResultSelect={onSearchResultSelect}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        const result = screen.getByTestId("search-result-node1");
        fireEvent.click(result);

        expect(onSearchResultSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "node1",
            label: "Hidden Node",
            type: "node",
          }),
        );
      });
    });

    it("should navigate to search result location in graph", async () => {
      const onSearchResultSelect = vi.fn();
      render(
        <SearchIntegration
          {...defaultProps}
          onSearchResultSelect={onSearchResultSelect}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        const result = screen.getByTestId("search-result-node1");
        fireEvent.click(result);

        // Should provide result selection with location information
        expect(onSearchResultSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "node1",
            type: "node",
          }),
        );
      });
    });
  });

  describe("Performance and Error Handling", () => {
    it("should handle search with no results gracefully", async () => {
      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "NonexistentTerm" } });

      await waitFor(() => {
        expect(visualizationState.getSearchResults()).toHaveLength(0);
        expect(screen.getByText("No search results")).toBeInTheDocument();
      });
    });

    it("should handle rapid search queries without errors", async () => {
      render(<SearchIntegration {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: /search/i });

      // Rapid fire search queries
      fireEvent.change(searchInput, { target: { value: "H" } });
      fireEvent.change(searchInput, { target: { value: "Hi" } });
      fireEvent.change(searchInput, { target: { value: "Hid" } });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should handle the final query correctly
        expect(visualizationState.getSearchQuery()).toBe("Hidden");
        expect(visualizationState.getSearchResults()).toHaveLength(1);
      });
    });

    it("should handle container expansion errors gracefully", async () => {
      const onContainerExpansion = vi
        .fn()
        .mockRejectedValue(new Error("Expansion failed"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(
        <SearchIntegration
          {...defaultProps}
          onContainerExpansion={onContainerExpansion}
        />,
      );

      const searchInput = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(searchInput, { target: { value: "Hidden" } });

      await waitFor(() => {
        // Should not crash on expansion error
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error expanding container"),
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
