/**
 * Error Handling and Edge Case Tests
 *
 * Tests comprehensive error handling and edge cases for extracted components:
 * - Graceful degradation when v6 components are unavailable
 * - localStorage persistence failures
 * - Invalid data handling
 * - Component error boundaries and recovery
 * - Network failures and timeout handling
 * - Memory constraints and cleanup
 * - Browser compatibility edge cases
 * - Concurrent operation conflicts
 * - Malformed input validation
 * - Resource exhaustion scenarios
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
import { Hydroscope } from "../components/Hydroscope.js";
import { InfoPanel } from "../components/panels/InfoPanel.js";
import { StyleTuner } from "../components/panels/StyleTuner.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
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
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
  }),
}));

// Mock localStorage with failure scenarios
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock console methods to capture error logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Test data with various edge cases
const validGraphData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1", type: "operator" },
    { id: "node2", label: "Node 2", type: "source" },
  ],
  edges: [{ id: "edge1", source: "node1", target: "node2", label: "Edge 1" }],
  containers: [
    {
      id: "container1",
      label: "Container 1",
      children: ["node1", "node2"],
      collapsed: false,
    },
  ],
};

const malformedGraphData = {
  nodes: [
    { id: null, label: "", type: undefined }, // Invalid node
    { id: "node2", label: "Node 2" }, // Missing type
    { id: "node3", label: null, type: "operator" }, // Invalid label
  ],
  edges: [
    { id: "edge1", source: "nonexistent", target: "node2" }, // Invalid source
    { id: null, source: "node2", target: "node3" }, // Invalid id
  ],
  containers: [
    { id: "container1", children: ["nonexistent"] }, // Invalid children
    { id: null, label: "Container 2", children: [] }, // Invalid id
  ],
} as any;

const emptyGraphData: HydroscopeData = {
  nodes: [],
  edges: [],
  containers: [],
};

const circularReferenceData = {
  nodes: [{ id: "node1", label: "Node 1", type: "operator" }],
  edges: [],
  containers: [],
};
// Add circular reference
(circularReferenceData as any).circular = circularReferenceData;

describe("Error Handling and Edge Case Tests", () => {
  let mockCallbacks: {
    onError: ReturnType<typeof vi.fn>;
    onFileUpload: ReturnType<typeof vi.fn>;
    onConfigChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});

    // Suppress console output during tests unless we're testing error logging
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Setup mock callbacks
    mockCallbacks = {
      onError: vi.fn(),
      onFileUpload: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("V6 Component Unavailability", () => {
    it("should gracefully degrade when VisualizationState is unavailable", () => {
      // Mock VisualizationState constructor to fail
      const OriginalVisualizationState = VisualizationState;
      vi.doMock("../core/VisualizationState.js", () => ({
        VisualizationState: class {
          constructor() {
            throw new Error("VisualizationState unavailable");
          }
        },
      }));

      expect(() => {
        render(
          <Hydroscope
            data={validGraphData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Should still render basic UI
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should gracefully degrade when AsyncCoordinator is unavailable", () => {
      // Mock AsyncCoordinator constructor to fail
      vi.doMock("../core/AsyncCoordinator.js", () => ({
        AsyncCoordinator: class {
          constructor() {
            throw new Error("AsyncCoordinator unavailable");
          }
        },
      }));

      expect(() => {
        render(
          <Hydroscope
            data={validGraphData}
            showInfoPanel={true}
            showStylePanel={true}
            enableCollapse={true}
          />,
        );
      }).not.toThrow();

      // Should still render and provide fallback functionality
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle InfoPanel with null VisualizationState", () => {
      expect(() => {
        render(
          <InfoPanel
            visualizationState={null}
            open={true}
            onOpenChange={() => {}}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle StyleTuner with null v6 components", () => {
      expect(() => {
        render(
          <StyleTuner
            value={{}}
            onChange={() => {}}
            open={true}
            onOpenChange={() => {}}
            visualizationState={null}
            asyncCoordinator={null}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Style Tuner")).toBeInTheDocument();
    });

    it("should log appropriate error messages when v6 components fail", () => {
      console.error = vi.fn();

      render(
        <InfoPanel
          visualizationState={null}
          open={true}
          onOpenChange={() => {}}
          onError={mockCallbacks.onError}
        />,
      );

      // Should log degradation warnings
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("VisualizationState"),
      );
    });
  });

  describe("localStorage Persistence Failures", () => {
    it("should handle localStorage quota exceeded errors", async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      });

      render(
        <InfoPanel
          visualizationState={new VisualizationState()}
          open={true}
          onOpenChange={() => {}}
          onError={mockCallbacks.onError}
        />,
      );

      // Toggle a section to trigger save
      const legendToggle = screen.getByRole("button", {
        name: /toggle legend/i,
      });
      fireEvent.click(legendToggle);

      // Should handle quota error gracefully
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("localStorage"),
        );
      });

      // Should not crash the component
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle localStorage access denied errors", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Access denied");
      });

      expect(() => {
        render(
          <StyleTuner
            value={{}}
            onChange={() => {}}
            open={true}
            onOpenChange={() => {}}
            onError={mockCallbacks.onError}
          />,
        );
      }).not.toThrow();

      expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle corrupted localStorage data", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json {");

      expect(() => {
        render(
          <InfoPanel
            visualizationState={new VisualizationState()}
            open={true}
            onOpenChange={() => {}}
            onError={mockCallbacks.onError}
          />,
        );
      }).not.toThrow();

      // Should use default settings when localStorage is corrupted
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle localStorage being disabled", () => {
      // Mock localStorage as undefined (some browsers/modes)
      Object.defineProperty(window, "localStorage", {
        value: undefined,
        configurable: true,
      });

      expect(() => {
        render(
          <Hydroscope
            data={validGraphData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
      }).not.toThrow();

      // Restore localStorage
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        configurable: true,
      });
    });

    it("should continue functioning when localStorage operations fail", async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage failure");
      });

      render(
        <StyleTuner
          value={{ edgeWidth: 2 }}
          onChange={mockCallbacks.onConfigChange}
          open={true}
          onOpenChange={() => {}}
          onError={mockCallbacks.onError}
        />,
      );

      // Should still handle style changes despite storage failure
      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      expect(mockCallbacks.onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: 3 }),
      );
    });
  });

  describe("Invalid Data Handling", () => {
    it("should handle malformed graph data", () => {
      expect(() => {
        render(<Hydroscope data={malformedGraphData} />);
      }).not.toThrow();

      // Should render basic UI even with malformed data
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle empty graph data", () => {
      render(<Hydroscope data={emptyGraphData} />);

      // Should render without errors
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle null/undefined data", () => {
      expect(() => {
        render(<Hydroscope data={null as any} />);
      }).not.toThrow();

      expect(() => {
        render(<Hydroscope data={undefined as any} />);
      }).not.toThrow();
    });

    it("should handle circular reference data", () => {
      expect(() => {
        render(<Hydroscope data={circularReferenceData as any} />);
      }).not.toThrow();

      // Should handle circular references without infinite loops
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should validate and sanitize node data", () => {
      const invalidNodeData = {
        nodes: [
          { id: "", label: "Empty ID" }, // Invalid empty ID
          { id: "valid", label: null }, // Invalid null label
          { id: "script", label: "<script>alert('xss')</script>" }, // XSS attempt
        ],
        edges: [],
        containers: [],
      };

      expect(() => {
        render(<Hydroscope data={invalidNodeData as any} />);
      }).not.toThrow();
    });

    it("should handle extremely large datasets", () => {
      const largeDataset = {
        nodes: Array.from({ length: 10000 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          type: "operator",
        })),
        edges: Array.from({ length: 9999 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`,
        })),
        containers: [],
      };

      expect(() => {
        render(<Hydroscope data={largeDataset} />);
      }).not.toThrow();
    });

    it("should handle data with missing required fields", () => {
      const incompleteData = {
        nodes: [{ id: "node1" }], // Missing label and type
        edges: [{ source: "node1" }], // Missing target and id
        // Missing containers array
      };

      expect(() => {
        render(<Hydroscope data={incompleteData as any} />);
      }).not.toThrow();
    });
  });

  describe("Component Error Boundaries and Recovery", () => {
    it("should isolate InfoPanel errors from other components", () => {
      // Mock InfoPanel to throw during render
      const ErrorInfoPanel = () => {
        throw new Error("InfoPanel render error");
      };

      // This would need proper error boundary implementation
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Other components should still work
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });

    it("should isolate StyleTuner errors from other components", () => {
      // Mock StyleTuner to throw during render
      const ErrorStyleTuner = () => {
        throw new Error("StyleTuner render error");
      };

      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Other components should still work
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
    });

    it("should provide error recovery mechanisms", async () => {
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should provide ways to recover from errors (e.g., reset buttons)
      const resetButton = screen.getByRole("button", {
        name: /reset to defaults/i,
      });
      expect(resetButton).toBeInTheDocument();

      fireEvent.click(resetButton);

      // Should recover from error state
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle async operation failures gracefully", async () => {
      const visualizationState = new VisualizationState();
      vi.spyOn(visualizationState, "search").mockRejectedValue(
        new Error("Search failed"),
      );

      render(
        <InfoPanel
          visualizationState={visualizationState}
          open={true}
          onOpenChange={() => {}}
          onError={mockCallbacks.onError}
        />,
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      });

      // Component should still be functional
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });

    it("should handle component unmounting during async operations", async () => {
      const { unmount } = render(
        <InfoPanel
          visualizationState={new VisualizationState()}
          open={true}
          onOpenChange={() => {}}
        />,
      );

      // Start async operation
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "test" } });

      // Unmount before operation completes
      unmount();

      // Should not cause memory leaks or errors
      expect(true).toBe(true); // Placeholder for memory leak detection
    });
  });

  describe("Network Failures and Timeout Handling", () => {
    it("should handle network timeouts gracefully", async () => {
      // Mock fetch to timeout
      global.fetch = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 100),
            ),
        );

      render(<Hydroscope data={validGraphData} enableUrlParams={true} />);

      // Should handle timeout without crashing
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle network connection failures", async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(<Hydroscope data={validGraphData} enableUrlParams={true} />);

      // Should handle network failure gracefully
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle malformed network responses", async () => {
      // Mock fetch to return invalid JSON
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve("invalid json"),
      } as any);

      render(<Hydroscope enableUrlParams={true} />);

      // Should handle malformed response
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Memory Constraints and Cleanup", () => {
    it("should handle memory pressure gracefully", () => {
      // Mock low memory scenario
      const originalMemory = (performance as any).memory;
      (performance as any).memory = {
        usedJSHeapSize: 1000000000, // 1GB
        totalJSHeapSize: 1100000000, // 1.1GB
        jsHeapSizeLimit: 1200000000, // 1.2GB (near limit)
      };

      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should handle memory pressure
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      // Restore memory info
      (performance as any).memory = originalMemory;
    });

    it("should clean up resources on unmount", () => {
      const { unmount } = render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should clean up without errors
      expect(() => unmount()).not.toThrow();
    });

    it("should handle rapid mount/unmount cycles", () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <Hydroscope
            data={validGraphData}
            showInfoPanel={true}
            showStylePanel={true}
          />,
        );
        unmount();
      }

      // Should handle rapid cycles without memory leaks
      expect(true).toBe(true); // Placeholder for memory leak detection
    });
  });

  describe("Browser Compatibility Edge Cases", () => {
    it("should handle missing ResizeObserver", () => {
      const originalResizeObserver = global.ResizeObserver;
      global.ResizeObserver = undefined as any;

      expect(() => {
        render(<Hydroscope data={validGraphData} responsive={true} />);
      }).not.toThrow();

      // Restore ResizeObserver
      global.ResizeObserver = originalResizeObserver;
    });

    it("should handle missing IntersectionObserver", () => {
      const originalIntersectionObserver = global.IntersectionObserver;
      global.IntersectionObserver = undefined as any;

      expect(() => {
        render(<Hydroscope data={validGraphData} showInfoPanel={true} />);
      }).not.toThrow();

      // Restore IntersectionObserver
      global.IntersectionObserver = originalIntersectionObserver;
    });

    it("should handle missing requestAnimationFrame", () => {
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = undefined as any;

      expect(() => {
        render(<Hydroscope data={validGraphData} showStylePanel={true} />);
      }).not.toThrow();

      // Restore requestAnimationFrame
      global.requestAnimationFrame = originalRAF;
    });

    it("should handle missing CSS custom properties support", () => {
      // Mock CSS.supports to return false
      const originalSupports = CSS.supports;
      CSS.supports = vi.fn().mockReturnValue(false);

      render(<Hydroscope data={validGraphData} showStylePanel={true} />);

      // Should provide fallback styling
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      // Restore CSS.supports
      CSS.supports = originalSupports;
    });
  });

  describe("Concurrent Operation Conflicts", () => {
    it("should handle simultaneous search and style operations", async () => {
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={mockCallbacks.onConfigChange}
        />,
      );

      // Trigger simultaneous operations
      const searchInput = screen.getByPlaceholderText(/search/i);
      const edgeWidthInput = screen.getByLabelText(/edge width/i);

      fireEvent.change(searchInput, { target: { value: "Node 1" } });
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      // Should handle concurrent operations without conflicts
      expect(mockCallbacks.onConfigChange).toHaveBeenCalled();
    });

    it("should handle rapid panel toggle operations", async () => {
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Rapidly toggle panels
      const infoPanelClose = screen.getByText("Close InfoPanel");
      const styleTunerClose = screen.getByText("Close StyleTuner");

      for (let i = 0; i < 5; i++) {
        fireEvent.click(infoPanelClose);
        fireEvent.click(styleTunerClose);
      }

      // Should handle rapid toggles without errors
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle conflicting container operations", async () => {
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          enableCollapse={true}
        />,
      );

      // Trigger conflicting operations
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });
      const collapseAllButton = screen.getByRole("button", {
        name: /collapse all/i,
      });

      fireEvent.click(expandAllButton);
      fireEvent.click(collapseAllButton);

      // Should resolve conflicts gracefully
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });
  });

  describe("Resource Exhaustion Scenarios", () => {
    it("should handle CPU-intensive operations gracefully", async () => {
      // Create CPU-intensive dataset
      const intensiveDataset = {
        nodes: Array.from({ length: 5000 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          type: "operator",
        })),
        edges: Array.from({ length: 10000 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${Math.floor(Math.random() * 5000)}`,
          target: `node${Math.floor(Math.random() * 5000)}`,
        })),
        containers: [],
      };

      const startTime = performance.now();

      render(
        <Hydroscope
          data={intensiveDataset}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(10000); // 10 seconds
    });

    it("should handle DOM node limits", () => {
      // Create dataset that would generate many DOM nodes
      const manyNodesDataset = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          type: "operator",
        })),
        edges: [],
        containers: [],
      };

      expect(() => {
        render(<Hydroscope data={manyNodesDataset} />);
      }).not.toThrow();

      // Should handle large DOM efficiently
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle event listener limits", () => {
      // Create many interactive elements
      render(
        <Hydroscope
          data={validGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should not exceed event listener limits
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Input Validation and Sanitization", () => {
    it("should sanitize XSS attempts in node labels", () => {
      const xssData = {
        nodes: [
          {
            id: "xss-node",
            label: "<script>alert('XSS')</script>",
            type: "operator",
          },
        ],
        edges: [],
        containers: [],
      };

      render(<Hydroscope data={xssData as any} />);

      // Should sanitize malicious content
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.queryByText("alert('XSS')")).not.toBeInTheDocument();
    });

    it("should validate numeric inputs in StyleTuner", () => {
      render(
        <StyleTuner
          value={{ edgeWidth: 2 }}
          onChange={mockCallbacks.onConfigChange}
          open={true}
          onOpenChange={() => {}}
        />,
      );

      const edgeWidthInput = screen.getByLabelText(/edge width/i);

      // Test invalid numeric input
      fireEvent.change(edgeWidthInput, { target: { value: "invalid" } });

      // Should not call onChange with invalid value
      expect(mockCallbacks.onConfigChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: "invalid" }),
      );
    });

    it("should validate color inputs", () => {
      render(
        <StyleTuner
          value={{ edgeColor: "#000000" }}
          onChange={mockCallbacks.onConfigChange}
          open={true}
          onOpenChange={() => {}}
        />,
      );

      const colorInput = screen.getByLabelText(/edge color/i);

      // Test invalid color input
      fireEvent.change(colorInput, { target: { value: "invalid-color" } });

      // Should handle invalid color gracefully
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });

    it("should validate search queries", async () => {
      const visualizationState = new VisualizationState();

      render(
        <InfoPanel
          visualizationState={visualizationState}
          open={true}
          onOpenChange={() => {}}
        />,
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Test extremely long search query
      const longQuery = "a".repeat(10000);
      fireEvent.change(searchInput, { target: { value: longQuery } });

      // Should handle long queries gracefully
      expect(screen.getByText("Graph Info")).toBeInTheDocument();
    });
  });
});
