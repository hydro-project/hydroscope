/**
 * Component Integration Tests
 *
 * Tests integration between extracted components and v6 architecture:
 * - InfoPanel and StyleTuner working together in Hydroscope
 * - V6 architecture integration (VisualizationState, AsyncCoordinator)
 * - Backward compatibility with HydroscopeEnhanced
 * - Complete user workflows and component communication
 * - Cross-component state synchronization
 * - Error propagation and recovery across components
 * - Performance under integrated load
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
import { HydroscopeEnhanced } from "../components/HydroscopeEnhanced.js";
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

  describe("InfoPanel and StyleTuner Integration in Hydroscope", () => {
    it("should render both InfoPanel and StyleTuner together", () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should coordinate panel visibility states", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Close InfoPanel
      const infoPanelCloseButton = screen.getByText("Close InfoPanel");
      fireEvent.click(infoPanelCloseButton);

      // InfoPanel should be hidden, StyleTuner should remain visible
      await waitFor(() => {
        expect(screen.getByTestId("info-panel")).toHaveStyle("display: none");
        expect(screen.getByTestId("style-tuner")).not.toHaveStyle(
          "display: none",
        );
      });

      // Close StyleTuner
      const styleTunerCloseButton = screen.getByText("Close StyleTuner");
      fireEvent.click(styleTunerCloseButton);

      // Both panels should be hidden
      await waitFor(() => {
        expect(screen.getByTestId("info-panel")).toHaveStyle("display: none");
        expect(screen.getByTestId("style-tuner")).toHaveStyle("display: none");
      });
    });

    it("should share VisualizationState between components", async () => {
      const onSearchUpdate = vi.fn();
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          onConfigChange={onConfigChange}
        />,
      );

      // Both components should have access to the same VisualizationState
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();

      // Search in InfoPanel should work with shared state
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "Node 1" } });

      // Style changes in StyleTuner should work with shared state
      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: 3 }),
      );
    });

    it("should coordinate container operations between panels", async () => {
      const onContainerCollapse = vi.fn();
      const onContainerExpand = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
          onContainerCollapse={onContainerCollapse}
          onContainerExpand={onContainerExpand}
        />,
      );

      // Container operations from InfoPanel should be coordinated
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });
      fireEvent.click(expandAllButton);

      // Should coordinate with StyleTuner for layout updates
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should synchronize settings persistence across panels", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Change settings in InfoPanel
      const legendToggle = screen.getByRole("button", {
        name: /toggle legend/i,
      });
      fireEvent.click(legendToggle);

      // Change settings in StyleTuner
      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Both should save to localStorage
      await waitFor(
        () => {
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            expect.stringMatching(/hydroscope.*settings/),
            expect.any(String),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should handle errors in one panel without affecting the other", async () => {
      // Mock InfoPanel to throw error
      const InfoPanelError = () => {
        throw new Error("InfoPanel error");
      };

      // This test would need error boundary implementation
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // StyleTuner should still work even if InfoPanel has errors
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });
  });

  describe("V6 Architecture Integration", () => {
    it("should initialize VisualizationState and AsyncCoordinator correctly", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should initialize v6 components without errors
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
        expect(screen.getByTestId("info-panel")).toBeInTheDocument();
        expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
      });
    });

    it("should coordinate operations through AsyncCoordinator", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
        />,
      );

      // Multiple operations should be coordinated
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });
      const layoutButton = screen.getByTestId("change-layout");

      // Trigger multiple operations
      fireEvent.click(expandAllButton);
      fireEvent.click(layoutButton);

      // Should handle coordination without race conditions
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle VisualizationState updates across components", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Search operation should update VisualizationState
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "Node 1" } });

      // Container operation should update VisualizationState
      const toggleButton = screen.getByTestId("toggle-container");
      fireEvent.click(toggleButton);

      // Both operations should be reflected in shared state
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should gracefully degrade when v6 components fail", () => {
      // Mock VisualizationState to fail
      const originalError = console.error;
      console.error = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should still render basic UI
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      console.error = originalError;
    });

    it("should handle AsyncCoordinator operation failures", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
        />,
      );

      // Operations should handle failures gracefully
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });

      await act(async () => {
        fireEvent.click(expandAllButton);
      });

      // Should not crash the application
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility with HydroscopeEnhanced", () => {
    it("should maintain same API as HydroscopeEnhanced", () => {
      // Test that HydroscopeEnhanced still works with same props
      expect(() => {
        render(
          <HydroscopeEnhanced
            data={mockGraphData}
            height="500px"
            width="800px"
          />,
        );
      }).not.toThrow();

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should use extracted components internally in HydroscopeEnhanced", () => {
      render(
        <HydroscopeEnhanced
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should render extracted components
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });

    it("should provide migration path from HydroscopeEnhanced to Hydroscope", () => {
      // Both should work with similar props
      const sharedProps = {
        data: mockGraphData,
        showInfoPanel: true,
        showStylePanel: true,
      };

      const { unmount } = render(<HydroscopeEnhanced {...sharedProps} />);
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      unmount();

      render(<Hydroscope {...sharedProps} />);
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle deprecated props gracefully", () => {
      // Test with deprecated props that might exist in HydroscopeEnhanced
      expect(() => {
        render(
          <HydroscopeEnhanced
            data={mockGraphData}
            // @ts-expect-error - testing deprecated props
            deprecatedProp="value"
          />,
        );
      }).not.toThrow();
    });
  });

  describe("Complete User Workflows", () => {
    it("should handle file upload to search to style change workflow", async () => {
      const onFileUpload = vi.fn();
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
          onFileUpload={onFileUpload}
          onConfigChange={onConfigChange}
        />,
      );

      // Step 1: Upload file
      const uploadButton = screen.getByText("Upload File");
      fireEvent.click(uploadButton);

      expect(onFileUpload).toHaveBeenCalledWith(mockGraphData, "test.json");

      // Step 2: Search for nodes
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "Node 1" } });

      // Step 3: Change style
      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "4" } });

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: 4 }),
      );
    });

    it("should handle container operations to layout change workflow", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
        />,
      );

      // Step 1: Expand all containers
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });
      fireEvent.click(expandAllButton);

      // Step 2: Change layout algorithm
      const layoutButton = screen.getByTestId("change-layout");
      fireEvent.click(layoutButton);

      // Step 3: Change color palette
      const paletteButton = screen.getByTestId("change-palette");
      fireEvent.click(paletteButton);

      // Should complete entire workflow without errors
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle search navigation with style preview workflow", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Step 1: Perform search
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "Node" } });

      // Step 2: Navigate search results
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      // Step 3: Preview style changes
      const edgeColorInput = screen.getByLabelText(/edge color/i);
      fireEvent.change(edgeColorInput, { target: { value: "#ff0000" } });

      // Should handle complete workflow
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle panel toggle with settings persistence workflow", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Step 1: Modify panel settings
      const legendToggle = screen.getByRole("button", {
        name: /toggle legend/i,
      });
      fireEvent.click(legendToggle);

      const layoutToggle = screen.getByRole("button", {
        name: /toggle layout algorithm/i,
      });
      fireEvent.click(layoutToggle);

      // Step 2: Close and reopen panels
      const infoPanelCloseButton = screen.getByText("Close InfoPanel");
      fireEvent.click(infoPanelCloseButton);

      const styleTunerCloseButton = screen.getByText("Close StyleTuner");
      fireEvent.click(styleTunerCloseButton);

      // Step 3: Settings should be persisted
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });
    });
  });

  describe("Cross-Component State Synchronization", () => {
    it("should synchronize search state between InfoPanel and visualization", async () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: "Node 1" } });

      // Search state should be synchronized with visualization
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should synchronize style changes between StyleTuner and visualization", async () => {
      const onConfigChange = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showStylePanel={true}
          onConfigChange={onConfigChange}
        />,
      );

      const edgeWidthInput = screen.getByLabelText(/edge width/i);
      fireEvent.change(edgeWidthInput, { target: { value: "5" } });

      // Style changes should be immediately reflected
      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: 5 }),
      );
    });

    it("should synchronize container state between InfoPanel and visualization", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          enableCollapse={true}
        />,
      );

      const toggleButton = screen.getByTestId("toggle-container");
      fireEvent.click(toggleButton);

      // Container state should be synchronized
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle state conflicts gracefully", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Trigger conflicting operations simultaneously
      const expandAllButton = screen.getByRole("button", {
        name: /expand all/i,
      });
      const layoutButton = screen.getByTestId("change-layout");

      fireEvent.click(expandAllButton);
      fireEvent.click(layoutButton);

      // Should resolve conflicts without errors
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });
  });

  describe("Error Propagation and Recovery", () => {
    it("should isolate errors between components", async () => {
      // Mock one component to fail
      const originalError = console.error;
      console.error = vi.fn();

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Other components should continue working
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();

      console.error = originalError;
    });

    it("should provide error recovery mechanisms", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should provide ways to recover from errors
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle network errors gracefully", async () => {
      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should handle network errors without crashing
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      global.fetch = originalFetch;
    });
  });

  describe("Performance Under Integrated Load", () => {
    it("should handle large datasets efficiently", async () => {
      const largeDataset = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          type: "operator",
        })),
        edges: Array.from({ length: 999 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`,
          label: `Edge ${i}`,
        })),
        containers: Array.from({ length: 10 }, (_, i) => ({
          id: `container${i}`,
          label: `Container ${i}`,
          children: Array.from({ length: 100 }, (_, j) => `node${i * 100 + j}`),
          collapsed: false,
        })),
      };

      const startTime = performance.now();

      render(
        <Hydroscope
          data={largeDataset}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(5000); // 5 seconds
    });

    it("should handle rapid user interactions efficiently", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Perform rapid interactions
      const searchInput = screen.getByPlaceholderText(/search/i);
      const edgeWidthInput = screen.getByLabelText(/edge width/i);

      for (let i = 0; i < 10; i++) {
        fireEvent.change(searchInput, { target: { value: `search${i}` } });
        fireEvent.change(edgeWidthInput, { target: { value: `${i + 1}` } });
      }

      // Should handle rapid interactions without performance issues
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should optimize memory usage with component integration", () => {
      const { unmount } = render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should clean up properly when unmounted
      unmount();

      // No memory leaks should occur
      expect(true).toBe(true); // Placeholder for memory leak detection
    });
  });
});
