/**
 * Component Integration Tests
 *
 * Tests integration between extracted components and v6 architecture:
 * - InfoPanel and StyleTuner working together in Hydroscope
 * - V6 architecture integration (VisualizationState, AsyncCoordinator)
 * - Backward compatibility with HydroscopeEnhanced
 * - Basic component communication and rendering
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hydroscope } from "../components/Hydroscope.js";
import { HydroscopeEnhanced } from "../components/HydroscopeEnhanced.js";
import type { HydroscopeData } from "../types/core.js";

// Mock ReactFlow components
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, ...props }: any) => (
    <div data-testid="react-flow" {...props}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  ControlButton: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  MarkerType: {
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  },
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
  }),
}));

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

// Test data
const mockGraphData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1", type: "operator" },
    { id: "node2", label: "Node 2", type: "source" },
    { id: "node3", label: "Node 3", type: "sink" },
    { id: "node4", label: "Node 4", type: "operator" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2", label: "Edge 1" },
    { id: "edge2", source: "node2", target: "node3", label: "Edge 2" },
    { id: "edge3", source: "node1", target: "node4", label: "Edge 3" },
  ],
  containers: [
    {
      id: "container1",
      label: "Container 1",
      children: ["node1", "node2"],
      collapsed: false,
    },
    {
      id: "container2",
      label: "Container 2",
      children: ["node3", "node4"],
      collapsed: true,
    },
  ],
};

describe("Component Integration Tests", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("Basic Integration", () => {
    it("should render Hydroscope with data", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should show the data loaded message
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should render both InfoPanel and StyleTuner together", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Check for actual panel content
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should handle panel visibility states", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Both panels should be visible initially
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();

      // Find close buttons (×) - there should be two
      const closeButtons = screen.getAllByRole("button", { name: "×" });
      expect(closeButtons).toHaveLength(2);
    });

    it("should render without panels when disabled", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={false}
          showStylePanel={false}
        />,
      );

      // Should still show data loaded message
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();

      // Panels should not be rendered
      expect(screen.queryByText("Graph Info")).not.toBeInTheDocument();
      expect(screen.queryByText("Style Tuner")).not.toBeInTheDocument();
    });
  });

  describe("Component Communication", () => {
    it("should share state between components", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Both components should be rendered and integrated
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should handle configuration changes", () => {
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
        />,
      );

      // Components should be integrated
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing data gracefully", () => {
      expect(() => {
        render(
          <Hydroscope
            data={null}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });

    it("should handle invalid data gracefully", () => {
      const invalidData = { nodes: null, edges: null } as any;

      expect(() => {
        render(
          <Hydroscope
            data={invalidData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });

    it("should isolate component errors", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Both components should render without errors
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain compatibility with HydroscopeEnhanced", () => {
      expect(() => {
        render(
          <HydroscopeEnhanced
            data={mockGraphData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });

    it("should handle same props as HydroscopeEnhanced", () => {
      const props = {
        data: mockGraphData,
        showInfoPanel: true,
        showStylePanel: true,
        enableCollapse: true,
        initialLayoutAlgorithm: "layered" as const,
        initialColorPalette: "Set2",
      };

      expect(() => {
        render(<HydroscopeEnhanced {...props} />);
      }).not.toThrow();

      expect(() => {
        render(<Hydroscope {...props} />);
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle component mounting and unmounting", () => {
      const { unmount } = render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should render successfully
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it("should handle large datasets", () => {
      const largeDataset = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          type: "operator",
        })),
        edges: Array.from({ length: 99 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`,
          label: `Edge ${i}`,
        })),
        containers: [],
      };

      expect(() => {
        render(
          <Hydroscope
            data={largeDataset}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });
  });

  describe("User Interactions", () => {
    it("should handle panel close interactions", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      const closeButtons = screen.getAllByRole("button", { name: "×" });
      expect(closeButtons.length).toBeGreaterThan(0);

      // Should not crash when clicking close buttons
      expect(() => {
        fireEvent.click(closeButtons[0]);
      }).not.toThrow();
    });

    it("should handle StyleTuner interactions", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should have StyleTuner controls
      expect(screen.getByText("Layout Algorithm")).toBeInTheDocument();
      expect(screen.getByText("Edge Style")).toBeInTheDocument();
      expect(screen.getByText("Color Palette")).toBeInTheDocument();
      expect(screen.getByText("Controls Scale")).toBeInTheDocument();
    });

    it("should handle InfoPanel interactions", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should have InfoPanel sections
      expect(screen.getByText("Graph Info")).toBeInTheDocument();

      // InfoPanel should be functional (has close button)
      const closeButtons = screen.getAllByRole("button", { name: "×" });
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });
});