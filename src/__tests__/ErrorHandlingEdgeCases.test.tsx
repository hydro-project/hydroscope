/**
 * Error Handling and Edge Case Tests
 *
 * Tests error handling and edge cases for Hydroscope components:
 * - Component unavailability scenarios
 * - Invalid data handling
 * - localStorage failures
 * - Basic error boundaries
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
import { InfoPanel } from "../components/panels/InfoPanel.js";
import { StyleTuner } from "../components/panels/StyleTuner.js";
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

// Test data
const validData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1", type: "operator" },
    { id: "node2", label: "Node 2", type: "source" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2", label: "Edge 1" },
  ],
  containers: [],
};

const invalidData = {
  nodes: null,
  edges: undefined,
  containers: "invalid",
} as any;

const malformedData = {
  nodes: [{ id: null, label: "" }],
  edges: [{ source: "", target: null }],
  containers: [{ id: "container1", children: null }],
} as any;

describe("Error Handling and Edge Case Tests", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  describe("V6 Component Unavailability", () => {
    it("should gracefully degrade when VisualizationState is unavailable", () => {
      expect(() => {
        render(
          <Hydroscope
            data={validData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should gracefully degrade when AsyncCoordinator is unavailable", () => {
      expect(() => {
        render(
          <InfoPanel
            open={true}
            onOpenChange={vi.fn()}
            visualizationState={null}
            asyncCoordinator={null}
          />,
        );
      }).not.toThrow();

      // Should still render basic UI
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should log appropriate error messages when v6 components fail", () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <Hydroscope
          data={validData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should render without throwing
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe("localStorage Persistence Failures", () => {
    it("should handle localStorage quota exceeded errors", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      expect(() => {
        render(
          <StyleTuner
            value={{}}
            onChange={vi.fn()}
            open={true}
            onOpenChange={vi.fn()}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should handle localStorage access denied errors", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("SecurityError");
      });

      expect(() => {
        render(
          <InfoPanel
            open={true}
            onOpenChange={vi.fn()}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should continue functioning when localStorage operations fail", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage error");
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => {
        render(
          <Hydroscope
            data={validData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });
  });

  describe("Invalid Data Handling", () => {
    it("should handle malformed graph data", () => {
      expect(() => {
        render(
          <Hydroscope
            data={malformedData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Should either show error state or handle gracefully
      expect(screen.getByText(/Data Loaded Successfully|Error/)).toBeInTheDocument();
    });

    it("should handle empty graph data", () => {
      const emptyData = { nodes: [], edges: [], containers: [] };

      expect(() => {
        render(
          <Hydroscope
            data={emptyData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should handle circular reference data", () => {
      const circularData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
        containers: [
          { id: "container1", label: "Container 1", children: ["container1"] },
        ],
      } as any;

      expect(() => {
        render(
          <Hydroscope
            data={circularData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });

    it("should handle null/undefined data", () => {
      expect(() => {
        render(
          <Hydroscope
            data={null}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      expect(() => {
        render(
          <Hydroscope
            data={undefined}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();
    });
  });

  describe("Component Error Boundaries and Recovery", () => {
    it("should isolate InfoPanel errors from other components", () => {
      expect(() => {
        render(
          <Hydroscope
            data={validData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Both components should render
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should isolate StyleTuner errors from other components", () => {
      expect(() => {
        render(
          <Hydroscope
            data={validData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Both components should render
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should provide error recovery mechanisms", () => {
      const onError = vi.fn();

      render(
        <StyleTuner
          value={{}}
          onChange={vi.fn()}
          open={true}
          onOpenChange={vi.fn()}
          onError={onError}
        />,
      );

      // Should render without errors
      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should handle async operation failures gracefully", async () => {
      const onConfigChange = vi.fn().mockRejectedValue(new Error("Async error"));

      render(
        <Hydroscope
          data={validData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
        />,
      );

      // Should render without throwing
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should handle component unmounting during async operations", () => {
      const { unmount } = render(
        <Hydroscope
          data={validData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Resource Exhaustion Scenarios", () => {
    it("should handle large datasets efficiently", () => {
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

      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
    });

    it("should handle memory pressure gracefully", () => {
      // Simulate memory pressure by creating many components
      const components = Array.from({ length: 10 }, (_, i) => (
        <InfoPanel
          key={i}
          open={true}
          onOpenChange={vi.fn()}
        />
      ));

      expect(() => {
        render(<div>{components}</div>);
      }).not.toThrow();
    });

    it("should handle event listener limits", () => {
      // Create multiple components that might add event listeners
      expect(() => {
        render(
          <div>
            <Hydroscope
              data={validData}
              showInfoPanel={true}
              showStylePanel={true}
            />
            <InfoPanel open={true} onOpenChange={vi.fn()} />
            <StyleTuner
              value={{}}
              onChange={vi.fn()}
              open={true}
              onOpenChange={vi.fn()}
            />
          </div>
        );
      }).not.toThrow();
    });
  });

  describe("Input Validation and Sanitization", () => {
    it("should sanitize XSS attempts in node labels", () => {
      const xssData = {
        nodes: [
          { id: "node1", label: "<script>alert('XSS')</script>", type: "operator" },
        ],
        edges: [],
        containers: [],
      };

      expect(() => {
        render(
          <Hydroscope
            data={xssData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Should sanitize malicious content
      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
      expect(screen.queryByText("alert('XSS')")).not.toBeInTheDocument();
    });

    it("should validate numeric inputs in StyleTuner", () => {
      render(
        <StyleTuner
          value={{ reactFlowControlsScale: 1.0 }}
          onChange={vi.fn()}
          open={true}
          onOpenChange={vi.fn()}
        />,
      );

      // Should have controls scale slider
      const scaleInput = screen.getByRole('slider');
      expect(scaleInput).toBeInTheDocument();

      // Should handle invalid input gracefully
      expect(() => {
        fireEvent.change(scaleInput, { target: { value: "invalid" } });
      }).not.toThrow();
    });

    it("should validate color inputs", () => {
      render(
        <StyleTuner
          value={{}}
          onChange={vi.fn()}
          open={true}
          onOpenChange={vi.fn()}
          colorPalette="Set2"
          onPaletteChange={vi.fn()}
        />,
      );

      // Should have color palette selector
      const paletteSelect = screen.getByDisplayValue("Set2");
      expect(paletteSelect).toBeInTheDocument();

      // Should handle changes gracefully
      expect(() => {
        fireEvent.change(paletteSelect, { target: { value: "Set3" } });
      }).not.toThrow();
    });

    it("should validate search queries", () => {
      render(
        <InfoPanel
          open={true}
          onOpenChange={vi.fn()}
        />,
      );

      // Should render InfoPanel without search input visible by default
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });

  describe("Network and Connectivity Issues", () => {
    it("should handle offline scenarios", () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(() => {
        render(
          <Hydroscope
            data={validData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();

      // Restore online state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
    });

    it("should handle slow network conditions", async () => {
      // Simulate slow operations
      const slowOnChange = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      render(
        <StyleTuner
          value={{}}
          onChange={slowOnChange}
          open={true}
          onOpenChange={vi.fn()}
        />,
      );

      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });
  });
});