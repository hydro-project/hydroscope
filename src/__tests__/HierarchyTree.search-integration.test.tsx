/**
 * @fileoverview HierarchyTree Search Integration Tests
 *
 * Tests for the enhanced HierarchyTree component with search integration functionality.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HierarchyTree } from "../components/HierarchyTree";
import { VisualizationState } from "../core/VisualizationState";
import type { SearchResult } from "../types/core";

describe("HierarchyTree Search Integration", () => {
  let visualizationState: VisualizationState;
  let mockOnToggleContainer: ReturnType<typeof vi.fn>;
  let mockOnElementNavigation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    visualizationState = new VisualizationState();
    mockOnToggleContainer = vi.fn();
    mockOnElementNavigation = vi.fn();

    // Set up test data
    visualizationState.addContainer({
      id: "container1",
      label: "Container 1",
      children: new Set<string>(),
      collapsed: false,
      hidden: false,
      position: { x: 0, y: 0 },
      dimensions: { width: 200, height: 150 },
    });

    visualizationState.addContainer({
      id: "container2",
      label: "Container 2",
      children: new Set<string>(),
      collapsed: true,
      hidden: false,
      position: { x: 0, y: 200 },
      dimensions: { width: 200, height: 150 },
    });

    visualizationState.addNode({
      id: "node1",
      label: "Test Node",
      position: { x: 50, y: 50 },
      size: { width: 100, height: 40 },
    });

    visualizationState.addNode({
      id: "node2",
      label: "Search Node",
      position: { x: 50, y: 250 },
      size: { width: 100, height: 40 },
      hidden: true, // Hidden because it will be in a collapsed container
    });

    // Set up container relationships
    visualizationState.assignNodeToContainer("node1", "container1");
    visualizationState.assignNodeToContainer("node2", "container2");
  });

  it("should render without search results", () => {
    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
      />,
    );

    expect(screen.getByText("Container 1")).toBeInTheDocument();
    expect(screen.getByText("Container 2")).toBeInTheDocument();
  });

  it("should highlight search results in tree", () => {
    const searchResults: SearchResult[] = [
      {
        id: "node1",
        label: "Test Node",
        type: "node",
        matchIndices: [[0, 4]], // "Test"
      },
      {
        id: "container2",
        label: "Container 2",
        type: "container",
        matchIndices: [[0, 9]], // "Container"
      },
    ];

    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
        searchQuery="test"
        searchResults={searchResults}
      />,
    );

    // Container 2 should be highlighted as a direct match
    const container2Element = screen.getByText("Container 2");
    expect(container2Element.closest("div")).toHaveStyle({
      backgroundColor: expect.stringContaining("#fbbf24"), // SEARCH_HIGHLIGHT_COLORS.backgroundColor
    });
  });

  it("should show current search result with different highlighting", () => {
    const searchResults: SearchResult[] = [
      {
        id: "node1",
        label: "Test Node",
        type: "node",
        matchIndices: [[0, 4]],
      },
    ];

    const currentSearchResult: SearchResult = searchResults[0];

    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
        searchQuery="test"
        searchResults={searchResults}
        currentSearchResult={currentSearchResult}
      />,
    );

    // Should render without errors and show current result highlighting
    expect(screen.getByText("Container 1")).toBeInTheDocument();
  });

  it("should handle navigation clicks for nodes", () => {
    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
      />,
    );

    // Click on Container 1 to test container navigation
    const container1Element = screen.getByText("Container 1");
    fireEvent.click(container1Element);

    expect(mockOnElementNavigation).toHaveBeenCalledWith(
      "container1",
      "container",
    );
  });

  it("should handle navigation clicks for containers", () => {
    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
      />,
    );

    // Click on a container
    const containerElement = screen.getByText("Container 1");
    fireEvent.click(containerElement);

    expect(mockOnElementNavigation).toHaveBeenCalledWith(
      "container1",
      "container",
    );
  });

  it("should show collapsed ancestor highlighting", () => {
    const searchResults: SearchResult[] = [
      {
        id: "node2", // This node is in container2 which is collapsed
        label: "Search Node",
        type: "node",
        matchIndices: [[0, 6]], // "Search"
      },
    ];

    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set(["container2"])}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
        searchQuery="search"
        searchResults={searchResults}
      />,
    );

    // Container 2 should show subtle highlighting since it contains a collapsed match
    const container2Element = screen.getByText("Container 2");
    expect(container2Element.closest("div")).toHaveStyle({
      backgroundColor: expect.stringContaining("20"), // Should have opacity suffix for subtle highlight
    });
  });

  it("should handle empty search results gracefully", () => {
    render(
      <HierarchyTree
        visualizationState={visualizationState}
        collapsedContainers={new Set()}
        onToggleContainer={mockOnToggleContainer}
        onElementNavigation={mockOnElementNavigation}
        searchQuery="nonexistent"
        searchResults={[]}
      />,
    );

    // Should render normally without highlighting
    expect(screen.getByText("Container 1")).toBeInTheDocument();
    expect(screen.getByText("Container 2")).toBeInTheDocument();
  });
});
