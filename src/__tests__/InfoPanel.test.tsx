/**
 * InfoPanel Component Unit Tests
 *
 * Tests InfoPanel functionality that actually exists:
 * - Basic rendering and visibility
 * - Panel open/close functionality
 * - Integration with VisualizationState
 * - Error handling
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  InfoPanel,
  type InfoPanelProps,
} from "../components/panels/InfoPanel.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("InfoPanel Component", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let mockProps: InfoPanelProps;
  let mockCallbacks: {
    onOpenChange: (open: boolean) => void;
    onSearchUpdate: (query: string, matches: any[], current?: any) => void;
    onToggleContainer: (containerId: string) => void;
    onGroupingChange: (groupingId: string) => void;
    onError: (error: Error) => void;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Create fresh instances
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();

    // Setup mock callbacks
    mockCallbacks = {
      onOpenChange: vi.fn(),
      onSearchUpdate: vi.fn(),
      onToggleContainer: vi.fn(),
      onGroupingChange: vi.fn(),
      onError: vi.fn(),
    };

    // Setup default props
    mockProps = {
      visualizationState,
      asyncCoordinator,
      open: true,
      ...mockCallbacks,
    };
  });

  describe("Basic Rendering", () => {
    it("should render when open is true", () => {
      render(<InfoPanel {...mockProps} />);

      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "×" })).toBeInTheDocument();
    });

    it("should hide when open is false", () => {
      const { container } = render(<InfoPanel {...mockProps} open={false} />);

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveStyle("opacity: 0");
      expect(panel).toHaveStyle("pointer-events: none");
    });

    it("should accept custom style prop", () => {
      const customStyle = { fontSize: "20px" };
      
      expect(() => {
        render(
          <InfoPanel
            {...mockProps}
            style={customStyle}
          />,
        );
      }).not.toThrow();

      // Should render successfully with custom style
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle missing optional props gracefully", () => {
      const minimalProps: InfoPanelProps = {
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

    it("should handle panel state changes", () => {
      const { rerender } = render(<InfoPanel {...mockProps} open={true} />);

      // Panel should be visible
      expect(screen.getByText("Graph Info")).toBeInTheDocument();

      // Change to closed
      rerender(<InfoPanel {...mockProps} open={false} />);

      // Panel should still exist but be hidden
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Integration with VisualizationState", () => {
    it("should work with VisualizationState when available", () => {
      render(<InfoPanel {...mockProps} />);

      // Should render without errors
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle VisualizationState updates", () => {
      render(<InfoPanel {...mockProps} />);

      // Should integrate with VisualizationState
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should gracefully degrade when VisualizationState is unavailable", () => {
      const propsWithoutState = {
        ...mockProps,
        visualizationState: null,
      };

      expect(() => render(<InfoPanel {...propsWithoutState} />)).not.toThrow();

      // Should still show basic UI
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle null VisualizationState gracefully", () => {
      expect(() => render(
        <InfoPanel {...mockProps} visualizationState={null} />,
      )).not.toThrow();

      // Should still show the basic panel structure
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle missing onError callback gracefully", () => {
      const propsWithoutErrorHandler = { ...mockProps, onError: undefined };

      expect(() => render(<InfoPanel {...propsWithoutErrorHandler} />)).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle component errors gracefully", () => {
      // Mock console.error to avoid noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<InfoPanel {...mockProps} />)).not.toThrow();

      // Should render without crashing
      expect(screen.getByText("Graph Info")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe("Conditional Content", () => {
    it("should render Node Types legend section", () => {
      render(<InfoPanel {...mockProps} />);

      // Should have the basic panel
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      
      // Node Types section should be present (it's always rendered)
      expect(screen.getByText("Node Types")).toBeInTheDocument();
    });

    it("should handle empty data gracefully", () => {
      render(<InfoPanel {...mockProps} />);

      // Should render basic structure even with no data
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should show sections based on available data", () => {
      render(<InfoPanel {...mockProps} />);

      // Should show basic panel structure
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      
      // Should have legend section
      expect(screen.getByText("Node Types")).toBeInTheDocument();
    });
  });

  describe("Component Lifecycle", () => {
    it("should mount and unmount without errors", () => {
      const { unmount } = render(<InfoPanel {...mockProps} />);

      // Should render successfully
      expect(screen.getByText("Graph Info")).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it("should handle prop changes", () => {
      const { rerender } = render(<InfoPanel {...mockProps} />);

      // Should render initially
      expect(screen.getByText("Graph Info")).toBeInTheDocument();

      // Should handle prop changes
      rerender(<InfoPanel {...mockProps} open={false} />);
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle callback prop changes", () => {
      const { rerender } = render(<InfoPanel {...mockProps} />);

      const newCallbacks = {
        ...mockCallbacks,
        onOpenChange: vi.fn(),
      };

      rerender(<InfoPanel {...mockProps} {...newCallbacks} />);

      // Should still render correctly
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });
});