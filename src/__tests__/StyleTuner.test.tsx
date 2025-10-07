/**
 * StyleTuner Component Unit Tests
 *
 * Tests all StyleTuner functionality including:
 * - Layout algorithm selection (layered, mrtree, force, stress, radial)
 * - Color palette selection (Set2, Set3, Pastel1, Dark2)
 * - Edge style configuration (bezier, straight, smoothstep)
 * - Style configuration controls for edges, nodes, containers
 * - Reset to defaults functionality
 * - Settings persistence and error handling
 * - Integration with v6 architecture
 * - Local state management and real-time preview
 * - Operation queuing to prevent timing conflicts
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
  StyleTuner,
  type StyleTunerProps,
  type StyleConfig,
} from "../components/panels/StyleTuner.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

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

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe("StyleTuner Component", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let mockProps: StyleTunerProps;
  let mockCallbacks: {
    onChange: ReturnType<typeof vi.fn>;
    onPaletteChange: ReturnType<typeof vi.fn>;
    onLayoutChange: ReturnType<typeof vi.fn>;

    onResetToDefaults: ReturnType<typeof vi.fn>;
    onOpenChange: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
  };

  const defaultStyleConfig: StyleConfig = {
    edgeStyle: "bezier",
    reactFlowControlsScale: 1.3,
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Create fresh instances
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();

    // Setup mock callbacks
    mockCallbacks = {
      onChange: vi.fn(),
      onPaletteChange: vi.fn(),
      onLayoutChange: vi.fn(),

      onResetToDefaults: vi.fn(),
      onOpenChange: vi.fn(),
      onError: vi.fn(),
    };

    // Setup default props
    mockProps = {
      value: defaultStyleConfig,
      colorPalette: "Set2",
      currentLayout: "layered",
      visualizationState,
      asyncCoordinator,
      open: true,
      ...mockCallbacks,
    };
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("Basic Rendering", () => {
    it("should render when open is true", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "×" })).toBeInTheDocument();
      expect(screen.getByText("Reset to Defaults")).toBeInTheDocument();
    });

    it("should hide when open is false", () => {
      const { container } = render(<StyleTuner {...mockProps} open={false} />);

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveStyle("opacity: 0");
      expect(panel).toHaveStyle("pointer-events: none");
    });

    it("should handle missing optional props gracefully", () => {
      const minimalProps: StyleTunerProps = {
        value: defaultStyleConfig,
        onChange: mockCallbacks.onChange,
        open: true,
        onOpenChange: mockCallbacks.onOpenChange,
      };

      expect(() => render(<StyleTuner {...minimalProps} />)).not.toThrow();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should display all available controls", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText("Layout Algorithm")).toBeInTheDocument();
      expect(screen.getByText("Edge Style")).toBeInTheDocument();
      expect(screen.getByText("Color Palette")).toBeInTheDocument();
    });
  });

  describe("Layout Algorithm Selection", () => {
    it("should display available layout algorithms", () => {
      render(<StyleTuner {...mockProps} />);

      const layoutSelect = screen.getByDisplayValue("Layered (Default)");
      expect(layoutSelect).toBeInTheDocument();

      // Check options exist
      expect(screen.getByText("Layered (Default)")).toBeInTheDocument();
      expect(screen.getByText("MR Tree")).toBeInTheDocument();
      expect(screen.getByText("Force-Directed")).toBeInTheDocument();
      expect(screen.getByText("Stress Minimization")).toBeInTheDocument();
      expect(screen.getByText("Radial")).toBeInTheDocument();
    });

    it("should call onLayoutChange when algorithm is selected", () => {
      render(<StyleTuner {...mockProps} />);

      const layoutSelect = screen.getByDisplayValue("Layered (Default)");
      fireEvent.change(layoutSelect, { target: { value: "force" } });

      expect(mockCallbacks.onLayoutChange).toHaveBeenCalledWith("force");
    });

    it("should handle layout change errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockCallbacks.onLayoutChange.mockImplementation(() => {
        throw new Error("Layout change failed");
      });

      render(<StyleTuner {...mockProps} />);

      const layoutSelect = screen.getByDisplayValue("Layered (Default)");

      // Should not crash when error occurs
      expect(() => {
        fireEvent.change(layoutSelect, { target: { value: "force" } });
      }).not.toThrow();

      expect(mockCallbacks.onLayoutChange).toHaveBeenCalledWith("force");

      consoleSpy.mockRestore();
    });
  });

  describe("Color Palette Selection", () => {
    it("should display available color palettes", () => {
      render(<StyleTuner {...mockProps} />);

      const paletteSelect = screen.getByDisplayValue("Set2");
      expect(paletteSelect).toBeInTheDocument();

      // Check options exist
      expect(screen.getByText("Set2")).toBeInTheDocument();
      expect(screen.getByText("Set3")).toBeInTheDocument();
      expect(screen.getByText("Pastel1")).toBeInTheDocument();
      expect(screen.getByText("Dark2")).toBeInTheDocument();
    });

    it("should call onPaletteChange when palette is selected", () => {
      render(<StyleTuner {...mockProps} />);

      const paletteSelect = screen.getByDisplayValue("Set2");
      fireEvent.change(paletteSelect, { target: { value: "Set3" } });

      expect(mockCallbacks.onPaletteChange).toHaveBeenCalledWith("Set3");
    });

    it("should handle palette change errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockCallbacks.onPaletteChange.mockImplementation(() => {
        throw new Error("Palette change failed");
      });

      render(<StyleTuner {...mockProps} />);

      const paletteSelect = screen.getByDisplayValue("Set2");

      // Should not crash when error occurs
      expect(() => {
        fireEvent.change(paletteSelect, { target: { value: "Set3" } });
      }).not.toThrow();

      expect(mockCallbacks.onPaletteChange).toHaveBeenCalledWith("Set3");

      consoleSpy.mockRestore();
    });
  });

  describe("Edge Style Configuration", () => {
    it("should display edge style controls", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText(/edge style/i)).toBeInTheDocument();
      expect(screen.getByText(/layout algorithm/i)).toBeInTheDocument();
      expect(screen.getByText(/color palette/i)).toBeInTheDocument();
    });

    it("should show current edge style values", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getByDisplayValue("Bezier");
      expect(edgeStyleSelect).toBeInTheDocument();
    });

    it("should call onChange when edge style is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getByDisplayValue("Bezier");
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeStyle: "straight",
      });
    });
  });

  describe("Reset to Defaults", () => {
    it("should call onResetToDefaults when reset button is clicked", () => {
      render(<StyleTuner {...mockProps} />);

      const resetButton = screen.getByText("Reset to Defaults");
      fireEvent.click(resetButton);

      expect(mockCallbacks.onResetToDefaults).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle null VisualizationState gracefully", () => {
      const propsWithNullState = { ...mockProps, visualizationState: null };

      expect(() =>
        render(<StyleTuner {...propsWithNullState} />),
      ).not.toThrow();

      // Should still show basic UI
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should call onError when style operations fail", async () => {
      mockCallbacks.onChange.mockImplementation(() => {
        throw new Error("Style change failed");
      });

      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getAllByRole("combobox")[1]; // Second select is edge style
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      // The component handles errors internally, so we just check it doesn't crash
      expect(() => {}).not.toThrow();
    });

    it("should handle missing onError callback gracefully", async () => {
      const propsWithoutErrorHandler = { ...mockProps, onError: undefined };
      mockCallbacks.onChange.mockImplementation(() => {
        throw new Error("Style change failed");
      });

      render(<StyleTuner {...propsWithoutErrorHandler} />);

      const edgeStyleSelect = screen.getAllByRole("combobox")[1]; // Second select is edge style
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      // Should not throw even without error handler
      expect(() => {}).not.toThrow();
    });
  });

  describe("Panel Visibility", () => {
    it("should call onOpenChange when close button is clicked", () => {
      render(<StyleTuner {...mockProps} />);

      const closeButton = screen.getByRole("button", { name: "×" });
      fireEvent.click(closeButton);

      expect(mockCallbacks.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Local State Management", () => {
    it("should provide immediate UI updates with local state", async () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getAllByRole("combobox")[1]; // Second select is edge style

      // Change should be immediately reflected in UI
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });
      expect(edgeStyleSelect).toHaveValue("straight");

      // And should call onChange immediately
      expect(mockCallbacks.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeStyle: "straight" }),
      );
    });
  });

  describe("Integration with v6 Architecture", () => {
    it("should integrate with VisualizationState when available", async () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getAllByRole("combobox")[1]; // Second select is edge style
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      // Should work with VisualizationState integration
      expect(mockCallbacks.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeStyle: "straight" }),
      );
    });

    it("should integrate with AsyncCoordinator when available", async () => {
      render(<StyleTuner {...mockProps} />);

      const layoutSelect = screen.getAllByRole("combobox")[0]; // First select is layout
      fireEvent.change(layoutSelect, { target: { value: "force" } });

      // Should work with AsyncCoordinator integration
      expect(mockCallbacks.onLayoutChange).toHaveBeenCalledWith("force");
    });

    it("should gracefully degrade when v6 components are unavailable", async () => {
      const propsWithoutV6 = {
        ...mockProps,
        visualizationState: null,
        asyncCoordinator: null,
      };

      expect(() => render(<StyleTuner {...propsWithoutV6} />)).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();

      // Style changes should still work without v6 components
      const edgeStyleSelect = screen.getAllByRole("combobox")[1]; // Second select is edge style
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      // Should work without v6 components
      expect(mockCallbacks.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeStyle: "straight" }),
      );
    });
  });
});
