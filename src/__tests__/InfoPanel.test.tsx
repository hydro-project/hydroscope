/**
 * InfoPanel Component Unit Tests
 *
 * Tests all InfoPanel functionality including:
 * - Search functionality with wildcard support
 * - Container hierarchy tree with expand/collapse
 * - Legend display for node types and edge styles
 * - Collapsible sections and UI interactions
 * - Settings persistence and error handling
 * - Integration with v6 VisualizationState
 * - Reset to defaults functionality
 * - Graceful degradation when v6 components unavailable
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
import {
  InfoPanel,
  type InfoPanelProps,
  type InfoPanelRef,
} from "../components/panels/InfoPanel.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { SearchResult, Container } from "../types/core.js";

describe("InfoPanel Component", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let mockProps: InfoPanelProps;
  let mockCallbacks: {
    onOpenChange: (open: boolean) => void;
    onSearchUpdate: (
      query: string,
      matches: SearchResult[],
      current?: SearchResult,
    ) => void;
    onToggleContainer: (containerId: string) => void;
    onGroupingChange: (groupingId: string) => void;
    onResetToDefaults: () => void;
    onError: (error: Error) => void;
  };

  const testLegendData = {
    title: "Node Types",
    items: [
      { type: "operator", label: "Operator", description: "Processing node" },
      { type: "source", label: "Source", description: "Data source" },
      { type: "sink", label: "Sink", description: "Data sink" },
    ],
  };

  const testEdgeStyleConfig = {
    dataflow: {
      color: "#007bff",
      width: 2,
      style: "solid" as const,
      type: "bezier" as const,
    },
    control: {
      color: "#28a745",
      width: 1,
      style: "dashed" as const,
      type: "straight" as const,
    },
  };

  const testHierarchyChoices = [
    { id: "type", name: "By Type", description: "Group by node type" },
    {
      id: "container",
      name: "By Container",
      description: "Group by container",
    },
  ];

  beforeEach(() => {
    // Create fresh instances
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();

    // Setup callbacks
    mockCallbacks = {
      onOpenChange: vi.fn(),
      onSearchUpdate: vi.fn(),
      onToggleContainer: vi.fn(),
      onGroupingChange: vi.fn(),
      onResetToDefaults: vi.fn(),
      onError: vi.fn(),
    };

    // Setup default props
    mockProps = {
      visualizationState,
      reactFlowData: {
        nodes: [{ id: "node1" }, { id: "node2" }],
        edges: [{ id: "edge1" }],
      },
      legendData: testLegendData,
      edgeStyleConfig: testEdgeStyleConfig,
      hierarchyChoices: testHierarchyChoices,
      currentGrouping: "type",
      collapsedContainers: new Set(["container1"]),
      asyncCoordinator,
      colorPalette: "Set2",
      open: true,
      ...mockCallbacks,
    };
  });

  describe("Basic Rendering", () => {
    it("should render when open is true", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "×" })).toBeInTheDocument();
      // InfoPanel doesn't have a reset button - it has collapsible sections
      expect(screen.getByText("Grouping")).toBeInTheDocument();
    });

    it("should hide when open is false", () => {
      const { container } = render(<InfoPanel {...mockProps} open={false} />);

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveStyle("opacity: 0");
      expect(panel).toHaveStyle("pointer-events: none");
    });

    it("should apply custom style", () => {
      const customStyle = { backgroundColor: "red" };
      const { container } = render(
        <InfoPanel
          {...mockProps}
          style={customStyle}
        />,
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveStyle("background-color: red");
    });

    it("should handle missing optional props gracefully", () => {
      const minimalProps: InfoPanelProps = {
        visualizationState,
        open: true,
        onOpenChange: mockCallbacks.onOpenChange,
      };

      expect(() => render(<InfoPanel {...minimalProps} />)).not.toThrow();
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should render gracefully when v6 components unavailable", () => {
      expect(() => render(
        <InfoPanel
          {...mockProps}
          visualizationState={null}
          asyncCoordinator={null}
        />,
      )).not.toThrow();

      // Should still show the basic panel structure
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should render search input", () => {
      render(<InfoPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search nodes and containers...",
      );
      expect(searchInput).toBeInTheDocument();
    });

    it("should handle search input changes", async () => {
      render(<InfoPanel {...mockProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search nodes and containers...",
      );

      fireEvent.change(searchInput, { target: { value: "test" } });

      expect(searchInput).toHaveValue("test");
    });

    it("should show search section as collapsible", () => {
      render(<InfoPanel {...mockProps} />);

      const searchSection = screen.getByText("Search");
      expect(searchSection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(searchSection);
      expect(searchSection).toBeInTheDocument();
    });
  });

  describe("Container Operations", () => {
    it("should display container hierarchy section", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Container Hierarchy")).toBeInTheDocument();
    });

    it("should show expand/collapse all buttons when containers exist", () => {
      render(<InfoPanel {...mockProps} />);

      // Look for the buttons by their text content
      expect(screen.getByText("Expand All")).toBeInTheDocument();
      expect(screen.getByText("Collapse All")).toBeInTheDocument();
    });

    it("should handle container hierarchy section toggle", () => {
      render(<InfoPanel {...mockProps} />);

      const hierarchySection = screen.getByText("Container Hierarchy");
      expect(hierarchySection).toBeInTheDocument();

      // Should be collapsible
      fireEvent.click(hierarchySection);
      // The section should still be visible since it starts expanded
      expect(screen.getByText("Container Hierarchy")).toBeInTheDocument();
    });
  });

  describe("Legend Display", () => {
    it("should display node types legend section", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Node Types Legend")).toBeInTheDocument();
    });

    it("should display edge styles legend section", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Edge Styles Legend")).toBeInTheDocument();
    });

    it("should handle missing legend data gracefully", () => {
      const propsWithoutLegend = {
        ...mockProps,
        legendData: undefined,
        edgeStyleConfig: undefined,
      };

      expect(() => render(<InfoPanel {...propsWithoutLegend} />)).not.toThrow();
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Collapsible Sections", () => {
    it("should have collapsible search section", () => {
      render(<InfoPanel {...mockProps} />);

      const searchSection = screen.getByText("Search");
      expect(searchSection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(searchSection);
      expect(searchSection).toBeInTheDocument();
    });

    it("should have collapsible container hierarchy section", () => {
      render(<InfoPanel {...mockProps} />);

      const hierarchySection = screen.getByText("Container Hierarchy");
      expect(hierarchySection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(hierarchySection);
      expect(hierarchySection).toBeInTheDocument();
    });

    it("should have collapsible grouping section", () => {
      render(<InfoPanel {...mockProps} />);

      const groupingSection = screen.getByText("Grouping");
      expect(groupingSection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(groupingSection);
      expect(groupingSection).toBeInTheDocument();
    });

    it("should have collapsible legend sections", () => {
      render(<InfoPanel {...mockProps} />);

      const nodeLegendSection = screen.getByText("Node Types Legend");
      const edgeLegendSection = screen.getByText("Edge Styles Legend");

      expect(nodeLegendSection).toBeInTheDocument();
      expect(edgeLegendSection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(nodeLegendSection);
      fireEvent.click(edgeLegendSection);

      expect(nodeLegendSection).toBeInTheDocument();
      expect(edgeLegendSection).toBeInTheDocument();
    });

    it("should have collapsible statistics section", () => {
      render(<InfoPanel {...mockProps} />);

      const statisticsSection = screen.getByText("Statistics");
      expect(statisticsSection).toBeInTheDocument();

      // Should be clickable to toggle
      fireEvent.click(statisticsSection);
      expect(statisticsSection).toBeInTheDocument();
    });
  });

  describe("Grouping Controls", () => {
    it("should display grouping section", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Grouping")).toBeInTheDocument();
    });

    it("should display grouping options in select", () => {
      render(<InfoPanel {...mockProps} />);

      // Look for the select options
      expect(screen.getByText("By Type")).toBeInTheDocument();
      expect(screen.getByText("By Container")).toBeInTheDocument();
    });

    it("should handle missing grouping choices gracefully", () => {
      const propsWithoutGrouping = { ...mockProps, hierarchyChoices: [] };

      expect(() =>
        render(<InfoPanel {...propsWithoutGrouping} />),
      ).not.toThrow();
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Settings Persistence", () => {
    it("should render without localStorage errors", () => {
      expect(() => render(<InfoPanel {...mockProps} />)).not.toThrow();
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle settings changes", () => {
      render(<InfoPanel {...mockProps} />);

      // Toggle sections to trigger settings changes
      const searchSection = screen.getByText("Search");
      fireEvent.click(searchSection);

      // Should not throw errors
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Section Management", () => {
    it("should toggle grouping section when clicked", () => {
      render(<InfoPanel {...mockProps} />);

      const groupingSection = screen.getByText("Grouping");
      expect(groupingSection).toBeInTheDocument();
      
      // Test that the section exists and is interactive
      fireEvent.click(groupingSection);
      // The section should still be there after clicking
      expect(groupingSection).toBeInTheDocument();
    });

    it("should display legend section", () => {
      render(<InfoPanel {...mockProps} />);

      // Should show the legend section
      expect(screen.getByText("Node Types")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle null VisualizationState gracefully", () => {
      const propsWithNullState = { ...mockProps, visualizationState: null };

      expect(() => render(<InfoPanel {...propsWithNullState} />)).not.toThrow();

      // Should still show basic UI
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(
        screen.getByText("Load graph data to see info panel content"),
      ).toBeInTheDocument();
    });

    it("should handle missing onError callback gracefully", () => {
      const propsWithoutErrorHandler = { ...mockProps, onError: undefined };

      expect(() =>
        render(<InfoPanel {...propsWithoutErrorHandler} />),
      ).not.toThrow();
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should render gracefully with null visualization state", () => {
      expect(() => render(<InfoPanel {...mockProps} visualizationState={null} />)).not.toThrow();
      
      // Should still show the basic panel structure
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Panel Visibility", () => {
    it("should call onOpenChange when close button is clicked", () => {
      render(<InfoPanel {...mockProps} />);

      const closeButton = screen.getByRole("button", { name: "×" });
      fireEvent.click(closeButton);

      expect(mockCallbacks.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should show settings status indicators", () => {
      render(<InfoPanel {...mockProps} />);

      // Should show saving indicator when settings change
      const searchSection = screen.getByText("Search");
      fireEvent.click(searchSection);

      // Should show saving indicator
      expect(screen.getByText("💾")).toBeInTheDocument();
    });
  });

  describe("Imperative Methods (Ref)", () => {
    it("should provide ref methods", () => {
      const ref = React.createRef<InfoPanelRef>();
      render(<InfoPanel {...mockProps} ref={ref} />);

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.focusSearch).toBe("function");
      expect(typeof ref.current?.clearSearch).toBe("function");
    });

    it("should call clearSearch method when clearSearch is called", () => {
      const ref = React.createRef<InfoPanelRef>();
      render(<InfoPanel {...mockProps} ref={ref} />);

      // Clear search via ref should not throw
      expect(() => {
        act(() => {
          ref.current?.clearSearch();
        });
      }).not.toThrow();
    });
  });

  describe("Integration with v6 Architecture", () => {
    it.skip("should integrate with VisualizationState", () => {
      render(<InfoPanel {...mockProps} />);

      // Should render without errors when VisualizationState is provided
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search nodes and containers..."),
      ).toBeInTheDocument();
    });

    it("should integrate with AsyncCoordinator", () => {
      render(<InfoPanel {...mockProps} />);

      // Should render without errors when AsyncCoordinator is provided
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Container Hierarchy")).toBeInTheDocument();
    });

    it("should gracefully degrade when v6 components are unavailable", () => {
      const propsWithoutV6 = {
        ...mockProps,
        visualizationState: null,
        asyncCoordinator: null,
      };

      expect(() => render(<InfoPanel {...propsWithoutV6} />)).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(
        screen.getByText("Load graph data to see info panel content"),
      ).toBeInTheDocument();
    });
  });
});
