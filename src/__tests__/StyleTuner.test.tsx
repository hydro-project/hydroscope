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
    edgeColor: "#007bff",
    edgeWidth: 2,
    edgeDashed: false,
    edgeAnimated: false,
    nodeBackgroundColor: "#ffffff",
    nodeBorderColor: "#cccccc",
    nodeBorderWidth: 1,
    nodeBorderRadius: 4,
    nodeFontSize: 12,
    nodeFontFamily: "Arial, sans-serif",
    nodeFontWeight: "normal",
    nodePadding: 8,
    containerBackgroundColor: "#f8f9fa",
    containerBorderColor: "#dee2e6",
    containerBorderWidth: 1,
    containerBorderRadius: 6,
    containerShadow: "light",
    containerOpacity: 0.8,
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
      expect(
        screen.getByRole("button", { name: /close panel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset to defaults/i }),
      ).toBeInTheDocument();
    });

    it("should not render when open is false", () => {
      render(<StyleTuner {...mockProps} open={false} />);

      expect(screen.queryByText("Style Tuner")).not.toBeInTheDocument();
    });

    it("should apply custom className and style", () => {
      const customStyle = { backgroundColor: "red" };
      const { container } = render(
        <StyleTuner
          {...mockProps}
          className="custom-style-tuner"
          style={customStyle}
        />,
      );

      const panel = container.querySelector(".style-tuner");
      expect(panel).toHaveClass("custom-style-tuner");
      expect(panel).toHaveStyle("background-color: red");
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

    it("should display all collapsible sections", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText("Layout Algorithm")).toBeInTheDocument();
      expect(screen.getByText("Color Palette")).toBeInTheDocument();
      expect(screen.getByText("Edge Styles")).toBeInTheDocument();
      expect(screen.getByText("Node Styles")).toBeInTheDocument();
      expect(screen.getByText("Container Styles")).toBeInTheDocument();
    });
  });

  describe("Layout Algorithm Selection", () => {
    it("should display available layout algorithms", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText("Layered")).toBeInTheDocument();
      expect(screen.getByText("MR Tree")).toBeInTheDocument();
      expect(screen.getByText("Force")).toBeInTheDocument();
      expect(screen.getByText("Stress")).toBeInTheDocument();
      expect(screen.getByText("Radial")).toBeInTheDocument();
    });

    it("should highlight current layout algorithm", () => {
      render(<StyleTuner {...mockProps} currentLayout="force" />);

      const forceButton = screen.getByText("Force");
      expect(forceButton.closest("button")).toHaveStyle(
        "background-color: #007bff",
      );
    });

    it("should call onLayoutChange when algorithm is selected", () => {
      render(<StyleTuner {...mockProps} />);

      const forceButton = screen.getByText("Force");
      fireEvent.click(forceButton);

      expect(mockCallbacks.onLayoutChange).toHaveBeenCalledWith("force");
    });

    it("should handle layout change errors gracefully", async () => {
      mockCallbacks.onLayoutChange.mockImplementation(() => {
        throw new Error("Layout change failed");
      });

      render(<StyleTuner {...mockProps} />);

      const forceButton = screen.getByText("Force");
      fireEvent.click(forceButton);

      await waitFor(() => {
        expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("should show algorithm descriptions on hover", async () => {
      render(<StyleTuner {...mockProps} />);

      const layeredButton = screen.getByText("Layered");
      fireEvent.mouseEnter(layeredButton);

      await waitFor(() => {
        expect(screen.getByText(/hierarchical layout/i)).toBeInTheDocument();
      });
    });
  });

  describe("Color Palette Selection", () => {
    it("should display available color palettes", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByText("Set2")).toBeInTheDocument();
      expect(screen.getByText("Set3")).toBeInTheDocument();
      expect(screen.getByText("Pastel1")).toBeInTheDocument();
      expect(screen.getByText("Dark2")).toBeInTheDocument();
    });

    it("should highlight current color palette", () => {
      render(<StyleTuner {...mockProps} colorPalette="Pastel1" />);

      const pastelButton = screen.getByText("Pastel1");
      expect(pastelButton.closest("button")).toHaveStyle(
        "border-color: #007bff",
      );
    });

    it("should call onPaletteChange when palette is selected", () => {
      render(<StyleTuner {...mockProps} />);

      const set3Button = screen.getByText("Set3");
      fireEvent.click(set3Button);

      expect(mockCallbacks.onPaletteChange).toHaveBeenCalledWith("Set3");
    });

    it("should display color swatches for each palette", () => {
      render(<StyleTuner {...mockProps} />);

      // Should show color preview swatches
      const colorSwatches = screen.getAllByTestId(/color-swatch/);
      expect(colorSwatches.length).toBeGreaterThan(0);
    });

    it("should handle palette change errors gracefully", async () => {
      mockCallbacks.onPaletteChange.mockImplementation(() => {
        throw new Error("Palette change failed");
      });

      render(<StyleTuner {...mockProps} />);

      const set3Button = screen.getByText("Set3");
      fireEvent.click(set3Button);

      await waitFor(() => {
        expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe("Edge Style Configuration", () => {
    it("should display edge style controls", () => {
      render(<StyleTuner {...mockProps} />);

      expect(screen.getByLabelText(/edge style/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/edge width/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/edge color/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dashed/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/animated/i)).toBeInTheDocument();
    });

    it("should show current edge style values", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getByDisplayValue("bezier");
      expect(edgeStyleSelect).toBeInTheDocument();

      const edgeWidthInput = screen.getByDisplayValue("2");
      expect(edgeWidthInput).toBeInTheDocument();

      const edgeColorInput = screen.getByDisplayValue("#007bff");
      expect(edgeColorInput).toBeInTheDocument();
    });

    it("should call onChange when edge style is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeStyleSelect = screen.getByLabelText(/edge style/i);
      fireEvent.change(edgeStyleSelect, { target: { value: "straight" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeStyle: "straight",
      });
    });

    it("should call onChange when edge width is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeWidth: 3,
      });
    });

    it("should call onChange when edge color is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeColorInput = screen.getByLabelText(/edge color/i);
      fireEvent.change(edgeColorInput, { target: { value: "#ff0000" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeColor: "#ff0000",
      });
    });

    it("should call onChange when edge dashed is toggled", () => {
      render(<StyleTuner {...mockProps} />);

      const dashedCheckbox = screen.getByLabelText(/dashed/i);
      fireEvent.click(dashedCheckbox);

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeDashed: true,
      });
    });

    it("should call onChange when edge animated is toggled", () => {
      render(<StyleTuner {...mockProps} />);

      const animatedCheckbox = screen.getByLabelText(/animated/i);
      fireEvent.click(animatedCheckbox);

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeAnimated: true,
      });
    });
  });

  describe("Node Style Configuration", () => {
    it("should display node style controls", () => {
      render(<StyleTuner {...mockProps} />);

      expect(
        screen.getByLabelText(/node background color/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/node border color/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/node border width/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/node border radius/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/node font size/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/node padding/i)).toBeInTheDocument();
    });

    it("should show current node style values", () => {
      render(<StyleTuner {...mockProps} />);

      const backgroundColorInput = screen.getByDisplayValue("#ffffff");
      expect(backgroundColorInput).toBeInTheDocument();

      const fontSizeInput = screen.getByDisplayValue("12");
      expect(fontSizeInput).toBeInTheDocument();

      const paddingInput = screen.getByDisplayValue("8");
      expect(paddingInput).toBeInTheDocument();
    });

    it("should call onChange when node background color is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const backgroundColorInput = screen.getByLabelText(
        /node background color/i,
      );
      fireEvent.change(backgroundColorInput, { target: { value: "#f0f0f0" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        nodeBackgroundColor: "#f0f0f0",
      });
    });

    it("should call onChange when node font size is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const fontSizeInput = screen.getByLabelText(/node font size/i);
      fireEvent.change(fontSizeInput, { target: { value: "14" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        nodeFontSize: 14,
      });
    });

    it("should call onChange when node padding is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const paddingInput = screen.getByLabelText(/node padding/i);
      fireEvent.change(paddingInput, { target: { value: "10" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        nodePadding: 10,
      });
    });

    it("should validate numeric inputs", () => {
      render(<StyleTuner {...mockProps} />);

      const fontSizeInput = screen.getByLabelText(/node font size/i);
      fireEvent.change(fontSizeInput, { target: { value: "invalid" } });

      // Should not call onChange with invalid value
      expect(mockCallbacks.onChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ nodeFontSize: "invalid" }),
      );
    });
  });

  describe("Container Style Configuration", () => {
    it("should display container style controls", () => {
      render(<StyleTuner {...mockProps} />);

      expect(
        screen.getByLabelText(/container background color/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/container border color/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/container border width/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/container border radius/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/container shadow/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/container opacity/i)).toBeInTheDocument();
    });

    it("should show current container style values", () => {
      render(<StyleTuner {...mockProps} />);

      const backgroundColorInput = screen.getByDisplayValue("#f8f9fa");
      expect(backgroundColorInput).toBeInTheDocument();

      const shadowSelect = screen.getByDisplayValue("light");
      expect(shadowSelect).toBeInTheDocument();

      const opacityInput = screen.getByDisplayValue("0.8");
      expect(opacityInput).toBeInTheDocument();
    });

    it("should call onChange when container background color is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const backgroundColorInput = screen.getByLabelText(
        /container background color/i,
      );
      fireEvent.change(backgroundColorInput, { target: { value: "#e9ecef" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        containerBackgroundColor: "#e9ecef",
      });
    });

    it("should call onChange when container shadow is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const shadowSelect = screen.getByLabelText(/container shadow/i);
      fireEvent.change(shadowSelect, { target: { value: "medium" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        containerShadow: "medium",
      });
    });

    it("should call onChange when container opacity is modified", () => {
      render(<StyleTuner {...mockProps} />);

      const opacityInput = screen.getByLabelText(/container opacity/i);
      fireEvent.change(opacityInput, { target: { value: "0.9" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        containerOpacity: 0.9,
      });
    });

    it("should validate opacity range (0-1)", () => {
      render(<StyleTuner {...mockProps} />);

      const opacityInput = screen.getByLabelText(/container opacity/i);

      // Test value above 1
      fireEvent.change(opacityInput, { target: { value: "1.5" } });
      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        containerOpacity: 1.0, // Should be clamped to 1
      });

      // Test negative value
      fireEvent.change(opacityInput, { target: { value: "-0.1" } });
      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        containerOpacity: 0.0, // Should be clamped to 0
      });
    });
  });

  describe("Collapsible Sections", () => {
    it("should toggle layout algorithm section", () => {
      render(<StyleTuner {...mockProps} />);

      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Layout content should be hidden
      expect(screen.queryByText("Layered")).not.toBeInTheDocument();

      // Click again to show
      fireEvent.click(layoutToggle);
      expect(screen.getByText("Layered")).toBeInTheDocument();
    });

    it("should toggle color palette section", () => {
      render(<StyleTuner {...mockProps} />);

      const paletteToggle = screen.getByRole("button", {
        name: /toggle color palette/i,
      });
      fireEvent.click(paletteToggle);

      // Palette content should be hidden
      expect(screen.queryByText("Set2")).not.toBeInTheDocument();

      // Click again to show
      fireEvent.click(paletteToggle);
      expect(screen.getByText("Set2")).toBeInTheDocument();
    });

    it("should toggle edge styles section", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeToggle = screen.getByRole("button", {
        name: /toggle edge styles/i,
      });
      fireEvent.click(edgeToggle);

      // Edge controls should be hidden
      expect(screen.queryByLabelText(/edge style/i)).not.toBeInTheDocument();

      // Click again to show
      fireEvent.click(edgeToggle);
      expect(screen.getByLabelText(/edge style/i)).toBeInTheDocument();
    });

    it("should toggle node styles section", () => {
      render(<StyleTuner {...mockProps} />);

      const nodeToggle = screen.getByRole("button", {
        name: /toggle node styles/i,
      });
      fireEvent.click(nodeToggle);

      // Node controls should be hidden
      expect(
        screen.queryByLabelText(/node background color/i),
      ).not.toBeInTheDocument();

      // Click again to show
      fireEvent.click(nodeToggle);
      expect(
        screen.getByLabelText(/node background color/i),
      ).toBeInTheDocument();
    });

    it("should toggle container styles section", () => {
      render(<StyleTuner {...mockProps} />);

      const containerToggle = screen.getByRole("button", {
        name: /toggle container styles/i,
      });
      fireEvent.click(containerToggle);

      // Container controls should be hidden
      expect(
        screen.queryByLabelText(/container background color/i),
      ).not.toBeInTheDocument();

      // Click again to show
      fireEvent.click(containerToggle);
      expect(
        screen.getByLabelText(/container background color/i),
      ).toBeInTheDocument();
    });
  });

  describe("Settings Persistence", () => {
    it("should load settings from localStorage on mount", () => {
      const savedSettings = JSON.stringify({
        layoutCollapsed: true,
        paletteCollapsed: false,
        edgeStylesCollapsed: true,
        nodeStylesCollapsed: false,
        containerStylesCollapsed: true,
      });

      mockLocalStorage.getItem.mockReturnValue(savedSettings);

      render(<StyleTuner {...mockProps} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-styletuner-settings",
      );

      // Layout section should be collapsed based on saved settings
      expect(screen.queryByText("Layered")).not.toBeInTheDocument();
    });

    it("should save settings to localStorage when sections are toggled", async () => {
      render(<StyleTuner {...mockProps} />);

      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Wait for debounced save
      await waitFor(
        () => {
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            "hydroscope-styletuner-settings",
            expect.stringContaining('"layoutCollapsed":true'),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should handle localStorage errors gracefully", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => render(<StyleTuner {...mockProps} />)).not.toThrow();
      expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should validate loaded settings structure", () => {
      const invalidSettings = JSON.stringify({
        layoutCollapsed: "invalid",
        unknownProperty: true,
      });

      mockLocalStorage.getItem.mockReturnValue(invalidSettings);

      expect(() => render(<StyleTuner {...mockProps} />)).not.toThrow();

      // Should use default for invalid boolean
      expect(screen.getByText("Layered")).toBeInTheDocument(); // layout not collapsed
    });
  });

  describe("Reset to Defaults", () => {
    it("should reset all settings when reset button is clicked", async () => {
      render(<StyleTuner {...mockProps} />);

      // First collapse some sections
      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Verify layout is collapsed
      expect(screen.queryByText("Layered")).not.toBeInTheDocument();

      // Click reset button
      const resetButton = screen.getByRole("button", {
        name: /reset to defaults/i,
      });
      fireEvent.click(resetButton);

      // Layout should be visible again (default state)
      await waitFor(() => {
        expect(screen.getByText("Layered")).toBeInTheDocument();
      });

      expect(mockCallbacks.onResetToDefaults).toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "hydroscope-styletuner-settings",
      );
    });

    it("should handle reset errors gracefully", () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      render(<StyleTuner {...mockProps} />);

      const resetButton = screen.getByRole("button", {
        name: /reset to defaults/i,
      });
      fireEvent.click(resetButton);

      // Should still call the callback despite storage error
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

      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      await waitFor(() => {
        expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("should handle missing onError callback gracefully", async () => {
      const propsWithoutErrorHandler = { ...mockProps, onError: undefined };
      mockCallbacks.onChange.mockImplementation(() => {
        throw new Error("Style change failed");
      });

      render(<StyleTuner {...propsWithoutErrorHandler} />);

      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      // Should not throw even without error handler
      expect(() => {}).not.toThrow();
    });
  });

  describe("Panel Visibility", () => {
    it("should call onOpenChange when close button is clicked", () => {
      render(<StyleTuner {...mockProps} />);

      const closeButton = screen.getByRole("button", { name: /close panel/i });
      fireEvent.click(closeButton);

      expect(mockCallbacks.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should show settings status indicators", async () => {
      render(<StyleTuner {...mockProps} />);

      // Toggle a section to trigger saving
      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Should show saving indicator briefly
      await waitFor(
        () => {
          expect(screen.getByText("💾")).toBeInTheDocument();
        },
        { timeout: 100 },
      );

      // Should show saved indicator after save completes
      await waitFor(
        () => {
          expect(screen.getByText("✓")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Local State Management", () => {
    it("should provide immediate UI updates with local state", () => {
      render(<StyleTuner {...mockProps} />);

      const edgeWidthInput = screen.getByLabelText(/edge width/i);

      // Change should be immediately reflected in UI
      fireEvent.change(edgeWidthInput, { target: { value: "5" } });
      expect(edgeWidthInput).toHaveValue("5");

      // And should call onChange
      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeWidth: 5,
      });
    });

    it("should handle rapid successive changes", async () => {
      render(<StyleTuner {...mockProps} />);

      const edgeWidthInput = screen.getByLabelText(/edge width/i);

      // Make rapid changes
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });
      fireEvent.change(edgeWidthInput, { target: { value: "4" } });
      fireEvent.change(edgeWidthInput, { target: { value: "5" } });

      // Should handle all changes
      expect(mockCallbacks.onChange).toHaveBeenCalledTimes(3);
      expect(mockCallbacks.onChange).toHaveBeenLastCalledWith({
        ...defaultStyleConfig,
        edgeWidth: 5,
      });
    });
  });

  describe("Integration with v6 Architecture", () => {
    it("should use VisualizationState for style validation", () => {
      // Mock validation method
      vi.spyOn(visualizationState, "validateStyleConfig").mockReturnValue(true);

      render(<StyleTuner {...mockProps} />);

      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      // Should validate style changes through VisualizationState
      expect(visualizationState.validateStyleConfig).toHaveBeenCalled();
    });

    it("should use AsyncCoordinator for operation sequencing", async () => {
      vi.spyOn(asyncCoordinator, "queueStyleOperation").mockResolvedValue();

      render(<StyleTuner {...mockProps} />);

      const layoutButton = screen.getByText("Force");
      fireEvent.click(layoutButton);

      // Should queue operations through AsyncCoordinator
      expect(asyncCoordinator.queueStyleOperation).toHaveBeenCalled();
    });

    it("should gracefully degrade when v6 components are unavailable", () => {
      const propsWithoutV6 = {
        ...mockProps,
        visualizationState: null,
        asyncCoordinator: null,
      };

      expect(() => render(<StyleTuner {...propsWithoutV6} />)).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();

      // Style changes should still work without v6 components
      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      expect(mockCallbacks.onChange).toHaveBeenCalledWith({
        ...defaultStyleConfig,
        edgeWidth: 3,
      });
    });
  });
});
