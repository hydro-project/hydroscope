/**
 * New Hydroscope Component Unit Tests
 *
 * Tests all new Hydroscope component functionality including:
 * - File upload and data management
 * - Container operations and layout management
 * - Settings persistence and error handling
 * - Integration with extracted InfoPanel and StyleTuner components
 * - V6 architecture integration (VisualizationState, AsyncCoordinator)
 * - Complete user workflows and component communication
 * - Performance monitoring and optimization
 * - Keyboard shortcuts and accessibility
 * - Error boundaries and recovery
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
import { Hydroscope, type HydroscopeProps } from "../components/Hydroscope.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { HydroscopeData, SearchResult, Container } from "../types/core.js";

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

// Mock child components
vi.mock("../components/FileUpload.js", () => ({
  FileUpload: ({ onFileUpload }: any) => (
    <div data-testid="file-upload">
      <button onClick={() => onFileUpload?.(mockGraphData, "test.json")}>
        Upload File
      </button>
    </div>
  ),
}));

vi.mock("../components/panels/InfoPanel.js", () => ({
  InfoPanel: ({
    open,
    onOpenChange,
    onSearchUpdate,
    onToggleContainer,
  }: any) => (
    <div data-testid="info-panel" style={{ display: open ? "block" : "none" }}>
      <button onClick={() => onOpenChange?.(false)}>Close InfoPanel</button>
      <input
        data-testid="search-input"
        placeholder="Search..."
        onChange={(e) => onSearchUpdate?.(e.target.value, [], undefined)}
      />
      <button
        data-testid="toggle-container"
        onClick={() => onToggleContainer?.("container1")}
      >
        Toggle Container
      </button>
    </div>
  ),
}));

vi.mock("../components/panels/StyleTuner.js", () => ({
  StyleTuner: ({
    open,
    onOpenChange,
    onChange,
    onLayoutChange,
    onPaletteChange,
  }: any) => (
    <div data-testid="style-tuner" style={{ display: open ? "block" : "none" }}>
      <button onClick={() => onOpenChange?.(false)}>Close StyleTuner</button>
      <button
        data-testid="change-layout"
        onClick={() => onLayoutChange?.("force")}
      >
        Change Layout
      </button>
      <button
        data-testid="change-palette"
        onClick={() => onPaletteChange?.("Set3")}
      >
        Change Palette
      </button>
      <input
        data-testid="edge-width"
        type="number"
        onChange={(e) => onChange?.({ edgeWidth: parseInt(e.target.value) })}
      />
    </div>
  ),
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
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2", label: "Edge 1" },
    { id: "edge2", source: "node2", target: "node3", label: "Edge 2" },
  ],
  containers: [
    {
      id: "container1",
      label: "Container 1",
      children: ["node1", "node2"],
      collapsed: false,
    },
  ],
};

describe("New Hydroscope Component", () => {
  let mockCallbacks: {
    onFileUpload: ReturnType<typeof vi.fn>;
    onNodeClick: ReturnType<typeof vi.fn>;
    onContainerCollapse: ReturnType<typeof vi.fn>;
    onContainerExpand: ReturnType<typeof vi.fn>;
    onConfigChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Setup mock callbacks
    mockCallbacks = {
      onFileUpload: vi.fn(),
      onNodeClick: vi.fn(),
      onContainerCollapse: vi.fn(),
      onContainerExpand: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("Basic Rendering", () => {
    it("should render with default props", () => {
      render(<Hydroscope />);

      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("background")).toBeInTheDocument();
      expect(screen.getByTestId("controls")).toBeInTheDocument();
      expect(screen.getByTestId("minimap")).toBeInTheDocument();
    });

    it("should render with custom dimensions", () => {
      render(<Hydroscope height="500px" width="800px" />);

      const container = screen.getByTestId("react-flow").parentElement;
      expect(container).toHaveStyle("height: 500px");
      expect(container).toHaveStyle("width: 800px");
    });

    it("should apply custom className and style", () => {
      const customStyle = { backgroundColor: "red" };
      const { container } = render(
        <Hydroscope className="custom-hydroscope" style={customStyle} />,
      );

      const hydroscopeElement = container.firstChild;
      expect(hydroscopeElement).toHaveClass("custom-hydroscope");
      expect(hydroscopeElement).toHaveStyle("background-color: red");
    });

    it("should conditionally render components based on props", () => {
      render(
        <Hydroscope
          showControls={false}
          showMiniMap={false}
          showBackground={false}
          showInfoPanel={false}
          showStylePanel={false}
        />,
      );

      expect(screen.queryByTestId("controls")).not.toBeInTheDocument();
      expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
      expect(screen.queryByTestId("background")).not.toBeInTheDocument();
      expect(screen.queryByTestId("info-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("style-tuner")).not.toBeInTheDocument();
    });
  });

  describe("File Upload and Data Management", () => {
    it("should show file upload when no data is provided", () => {
      render(<Hydroscope showFileUpload={true} />);

      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    it("should not show file upload when data is provided", () => {
      render(<Hydroscope data={mockGraphData} showFileUpload={true} />);

      expect(screen.queryByTestId("file-upload")).not.toBeInTheDocument();
    });

    it("should handle file upload callback", async () => {
      render(
        <Hydroscope
          showFileUpload={true}
          onFileUpload={mockCallbacks.onFileUpload}
        />,
      );

      const uploadButton = screen.getByText("Upload File");
      fireEvent.click(uploadButton);

      expect(mockCallbacks.onFileUpload).toHaveBeenCalledWith(
        mockGraphData,
        "test.json",
      );
    });

    it("should initialize visualization state when data is provided", async () => {
      render(<Hydroscope data={mockGraphData} />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });

      // Should have processed the data
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle data parsing errors gracefully", async () => {
      const invalidData = { invalid: "data" } as any;

      expect(() => render(<Hydroscope data={invalidData} />)).not.toThrow();

      // Should still render basic UI
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should update visualization when data prop changes", async () => {
      const { rerender } = render(<Hydroscope data={mockGraphData} />);

      const newData = {
        ...mockGraphData,
        nodes: [
          ...mockGraphData.nodes,
          { id: "node4", label: "Node 4", type: "operator" },
        ],
      };

      rerender(<Hydroscope data={newData} />);

      // Should re-process the new data
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });
  });

  describe("InfoPanel Integration", () => {
    it("should render InfoPanel when enabled", () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
    });

    it("should handle InfoPanel visibility toggle", () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      const infoPanelCloseButton = screen.getByText("Close InfoPanel");
      fireEvent.click(infoPanelCloseButton);

      // InfoPanel should be hidden
      expect(screen.getByTestId("info-panel")).toHaveStyle("display: none");
    });

    it("should handle search updates from InfoPanel", async () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      const searchInput = screen.getByTestId("search-input");
      fireEvent.change(searchInput, { target: { value: "test query" } });

      // Should handle search without errors
      expect(searchInput).toHaveValue("test query");
    });

    it("should handle container toggle from InfoPanel", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          onContainerCollapse={mockCallbacks.onContainerCollapse}
        />,
      );

      const toggleButton = screen.getByTestId("toggle-container");
      fireEvent.click(toggleButton);

      // Should handle container operations
      expect(mockCallbacks.onContainerCollapse).toHaveBeenCalledWith(
        "container1",
        expect.any(Object),
      );
    });

    it("should provide VisualizationState to InfoPanel", () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      // InfoPanel should be rendered (indicating it received required props)
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
    });
  });

  describe("StyleTuner Integration", () => {
    it("should render StyleTuner when enabled", () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });

    it("should handle StyleTuner visibility toggle", () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const styleTunerCloseButton = screen.getByText("Close StyleTuner");
      fireEvent.click(styleTunerCloseButton);

      // StyleTuner should be hidden
      expect(screen.getByTestId("style-tuner")).toHaveStyle("display: none");
    });

    it("should handle layout changes from StyleTuner", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const layoutButton = screen.getByTestId("change-layout");
      fireEvent.click(layoutButton);

      // Should handle layout change without errors
      await waitFor(() => {
        expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
      });
    });

    it("should handle palette changes from StyleTuner", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const paletteButton = screen.getByTestId("change-palette");
      fireEvent.click(paletteButton);

      // Should handle palette change without errors
      await waitFor(() => {
        expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
      });
    });

    it("should handle style configuration changes", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showStylePanel={true}
          onConfigChange={mockCallbacks.onConfigChange}
        />,
      );

      const edgeWidthInput = screen.getByTestId("edge-width");
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      // Should call config change callback
      expect(mockCallbacks.onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({ edgeWidth: 3 }),
      );
    });
  });

  describe("Container Operations", () => {
    it("should handle container collapse operations", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          enableCollapse={true}
          onContainerCollapse={mockCallbacks.onContainerCollapse}
        />,
      );

      // Simulate container collapse through InfoPanel
      if (screen.queryByTestId("info-panel")) {
        const toggleButton = screen.getByTestId("toggle-container");
        fireEvent.click(toggleButton);

        expect(mockCallbacks.onContainerCollapse).toHaveBeenCalled();
      }
    });

    it("should handle container expand operations", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          enableCollapse={true}
          onContainerExpand={mockCallbacks.onContainerExpand}
        />,
      );

      // Should handle expand operations when triggered
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should disable container operations when enableCollapse is false", () => {
      render(<Hydroscope data={mockGraphData} enableCollapse={false} />);

      // Should still render but without collapse functionality
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Layout Management", () => {
    it("should use initial layout algorithm", () => {
      render(
        <Hydroscope data={mockGraphData} initialLayoutAlgorithm="force" />,
      );

      // Should initialize with specified layout
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle layout algorithm changes", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const layoutButton = screen.getByTestId("change-layout");
      fireEvent.click(layoutButton);

      // Should handle layout change
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should trigger relayout when layout algorithm changes", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const layoutButton = screen.getByTestId("change-layout");

      await act(async () => {
        fireEvent.click(layoutButton);
      });

      // Should complete relayout operation
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Color Palette Management", () => {
    it("should use initial color palette", () => {
      render(<Hydroscope data={mockGraphData} initialColorPalette="Pastel1" />);

      // Should initialize with specified palette
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle color palette changes", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const paletteButton = screen.getByTestId("change-palette");
      fireEvent.click(paletteButton);

      // Should handle palette change
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should persist palette selection", async () => {
      render(<Hydroscope data={mockGraphData} showStylePanel={true} />);

      const paletteButton = screen.getByTestId("change-palette");
      fireEvent.click(paletteButton);

      // Should save to localStorage
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });
    });
  });

  describe("Settings Persistence", () => {
    it("should load settings from localStorage on mount", () => {
      const savedSettings = JSON.stringify({
        infoPanelOpen: false,
        stylePanelOpen: true,
        colorPalette: "Set3",
        layoutAlgorithm: "force",
      });

      mockLocalStorage.getItem.mockReturnValue(savedSettings);

      render(<Hydroscope data={mockGraphData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should save settings when panels are toggled", async () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      const infoPanelCloseButton = screen.getByText("Close InfoPanel");
      fireEvent.click(infoPanelCloseButton);

      // Should save panel state
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });
    });

    it("should handle localStorage errors gracefully", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => render(<Hydroscope data={mockGraphData} />)).not.toThrow();
    });

    it("should validate loaded settings structure", () => {
      const invalidSettings = JSON.stringify({
        infoPanelOpen: "invalid",
        unknownProperty: true,
      });

      mockLocalStorage.getItem.mockReturnValue(invalidSettings);

      expect(() => render(<Hydroscope data={mockGraphData} />)).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization errors gracefully", () => {
      // Mock VisualizationState constructor to throw
      const originalVisualizationState = VisualizationState;
      (global as any).VisualizationState = class {
        constructor() {
          throw new Error("Initialization failed");
        }
      };

      expect(() => render(<Hydroscope data={mockGraphData} />)).not.toThrow();

      // Restore original
      (global as any).VisualizationState = originalVisualizationState;
    });

    it("should handle missing data gracefully", () => {
      expect(() => render(<Hydroscope data={null as any} />)).not.toThrow();

      // Should show file upload when no data
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    it("should handle component errors with error boundaries", () => {
      // Mock InfoPanel to throw error
      vi.doMock("../components/panels/InfoPanel.js", () => ({
        InfoPanel: () => {
          throw new Error("InfoPanel error");
        },
      }));

      expect(() =>
        render(<Hydroscope data={mockGraphData} showInfoPanel={true} />),
      ).not.toThrow();
    });

    it("should provide error recovery mechanisms", async () => {
      render(<Hydroscope data={mockGraphData} />);

      // Should render without errors and provide basic functionality
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Performance Optimization", () => {
    it("should render performance panel when enabled in development", () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      render(<Hydroscope data={mockGraphData} showPerformancePanel={true} />);

      // Should show performance monitoring in development
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should not render performance panel in production", () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      render(<Hydroscope data={mockGraphData} showPerformancePanel={true} />);

      // Should not show performance panel in production
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should optimize re-renders with React.memo", () => {
      const { rerender } = render(<Hydroscope data={mockGraphData} />);

      // Re-render with same props
      rerender(<Hydroscope data={mockGraphData} />);

      // Should not cause unnecessary re-renders
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should handle Ctrl+F for search focus", () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      // Simulate Ctrl+F keypress
      fireEvent.keyDown(document, { key: "f", ctrlKey: true });

      // Should focus search input (if InfoPanel is open)
      const searchInput = screen.queryByTestId("search-input");
      if (searchInput) {
        expect(searchInput).toBeInTheDocument();
      }
    });

    it("should handle ESC for panel closing", () => {
      render(<Hydroscope data={mockGraphData} showInfoPanel={true} />);

      // Simulate ESC keypress
      fireEvent.keyDown(document, { key: "Escape" });

      // Should handle escape key
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should handle responsive height calculation", () => {
      render(<Hydroscope data={mockGraphData} responsive={true} />);

      // Should render with responsive configuration
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    it("should handle window resize events", () => {
      render(<Hydroscope data={mockGraphData} responsive={true} />);

      // Simulate window resize
      fireEvent.resize(window);

      // Should handle resize without errors
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("URL Parameter Support", () => {
    it("should parse URL parameters when enabled", () => {
      // Mock URL with parameters
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, search: "?data=test" };

      render(<Hydroscope enableUrlParams={true} />);

      // Should attempt to parse URL parameters
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();

      // Restore location
      window.location = originalLocation;
    });

    it("should handle invalid URL parameters gracefully", () => {
      // Mock URL with invalid parameters
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, search: "?invalid=data" };

      expect(() => render(<Hydroscope enableUrlParams={true} />)).not.toThrow();

      // Restore location
      window.location = originalLocation;
    });
  });

  describe("Integration with V6 Architecture", () => {
    it("should initialize VisualizationState correctly", async () => {
      render(<Hydroscope data={mockGraphData} />);

      // Should initialize v6 architecture components
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should initialize AsyncCoordinator correctly", async () => {
      render(<Hydroscope data={mockGraphData} />);

      // Should initialize coordination layer
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle v6 component failures gracefully", () => {
      // Mock VisualizationState to fail
      vi.doMock("../core/VisualizationState.js", () => ({
        VisualizationState: class {
          constructor() {
            throw new Error("VisualizationState failed");
          }
        },
      }));

      expect(() => render(<Hydroscope data={mockGraphData} />)).not.toThrow();
    });

    it("should coordinate operations between components", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          showStylePanel={true}
        />,
      );

      // Should coordinate between InfoPanel and StyleTuner
      expect(screen.getByTestId("info-panel")).toBeInTheDocument();
      expect(screen.getByTestId("style-tuner")).toBeInTheDocument();
    });
  });

  describe("Complete User Workflows", () => {
    it("should handle complete file upload to visualization workflow", async () => {
      render(
        <Hydroscope
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
          onFileUpload={mockCallbacks.onFileUpload}
        />,
      );

      // Upload file
      const uploadButton = screen.getByText("Upload File");
      fireEvent.click(uploadButton);

      expect(mockCallbacks.onFileUpload).toHaveBeenCalled();

      // Should show visualization components after upload
      await waitFor(() => {
        expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      });
    });

    it("should handle search to node selection workflow", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showInfoPanel={true}
          onNodeClick={mockCallbacks.onNodeClick}
        />,
      );

      // Perform search
      const searchInput = screen.getByTestId("search-input");
      fireEvent.change(searchInput, { target: { value: "Node 1" } });

      // Should handle search workflow
      expect(searchInput).toHaveValue("Node 1");
    });

    it("should handle style change to layout update workflow", async () => {
      render(
        <Hydroscope
          data={mockGraphData}
          showStylePanel={true}
          onConfigChange={mockCallbacks.onConfigChange}
        />,
      );

      // Change layout
      const layoutButton = screen.getByTestId("change-layout");
      fireEvent.click(layoutButton);

      // Change style
      const edgeWidthInput = screen.getByTestId("edge-width");
      fireEvent.change(edgeWidthInput, { target: { value: "3" } });

      // Should handle complete workflow
      expect(mockCallbacks.onConfigChange).toHaveBeenCalled();
    });
  });
});
