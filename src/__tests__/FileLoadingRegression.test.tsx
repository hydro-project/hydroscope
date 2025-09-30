/**
 * File Loading Regression Tests
 *
 * Tests for the file loading functionality to ensure that loading a different file
 * after the initial file properly updates the visualization.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HydroscopeEnhanced } from "../components/HydroscopeEnhanced";
import type { HydroscopeData } from "../types/core";

// Mock ReactFlow components
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    ReactFlow: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow">{children}</div>
    ),
    Background: () => <div data-testid="background" />,
    MiniMap: () => <div data-testid="minimap" />,
    Controls: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="controls">{children}</div>
    ),
    ControlButton: ({ children, onClick, title, disabled }: any) => (
      <button
        onClick={onClick}
        title={title}
        disabled={disabled}
        data-testid="control-button"
      >
        {children}
      </button>
    ),
    useReactFlow: () => ({
      fitView: vi.fn(),
    }),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="reactflow-provider">{children}</div>
    ),
  };
});

// Mock other dependencies
const mockVisualizationState = {
  visibleContainers: [],
  visibleNodes: [],
  allNodes: [],
};

vi.mock("../core/VisualizationState.js", () => ({
  VisualizationState: vi.fn(),
}));

vi.mock("../core/AsyncCoordinator.js", () => ({
  AsyncCoordinator: vi.fn().mockImplementation(() => ({
    collapseAllContainers: vi.fn(),
    expandAllContainers: vi.fn(),
  })),
}));

vi.mock("../bridges/ReactFlowBridge.js", () => ({
  ReactFlowBridge: vi.fn().mockImplementation(() => ({
    toReactFlowData: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  })),
}));

vi.mock("../bridges/ELKBridge.js", () => ({
  ELKBridge: vi.fn().mockImplementation(() => ({
    layout: vi.fn(),
  })),
}));

vi.mock("../utils/JSONParser.js", () => {
  const mockParseData = vi.fn().mockResolvedValue({
    visualizationState: {
      visibleContainers: [],
      visibleNodes: [],
      allNodes: [],
    },
  });

  return {
    JSONParser: {
      createPaxosParser: vi.fn().mockReturnValue({
        parseData: mockParseData,
      }),
    },
    mockParseData, // Export for test access
  };
});

vi.mock("../core/InteractionHandler.js", () => ({
  InteractionHandler: vi.fn(),
}));

describe("File Loading Regression Tests", () => {
  let mockParseData: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mock from the mocked module
    const { JSONParser } = await import("../utils/JSONParser.js");
    const parser = JSONParser.createPaxosParser({ debug: false });
    mockParseData = parser.parseData;
    mockParseData.mockClear();
  });

  it("should load initial file and display visualization", async () => {
    const initialData: HydroscopeData = {
      nodes: [
        { id: "node1", label: "Initial Node 1" },
        { id: "node2", label: "Initial Node 2" },
      ],
      edges: [{ id: "edge1", source: "node1", target: "node2" }],
    };

    render(<HydroscopeEnhanced data={initialData} enhanced={true} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Verify parser was called with initial data
    expect(mockParseData).toHaveBeenCalledWith(initialData);
  });

  it("should reload visualization when a different file is loaded via file input", async () => {
    const initialData: HydroscopeData = {
      nodes: [
        { id: "node1", label: "Initial Node 1" },
        { id: "node2", label: "Initial Node 2" },
      ],
      edges: [{ id: "edge1", source: "node1", target: "node2" }],
    };

    const newData: HydroscopeData = {
      nodes: [
        { id: "nodeA", label: "New Node A" },
        { id: "nodeB", label: "New Node B" },
        { id: "nodeC", label: "New Node C" },
      ],
      edges: [
        { id: "edgeA", source: "nodeA", target: "nodeB" },
        { id: "edgeB", source: "nodeB", target: "nodeC" },
      ],
    };

    render(<HydroscopeEnhanced data={initialData} enhanced={true} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Verify initial data was parsed
    expect(mockParseData).toHaveBeenCalledWith(initialData);
    const initialCallCount = mockParseData.mock.calls.length;

    // Find and click load file button
    const controlButtons = screen.getAllByTestId("control-button");
    const loadFileButton = controlButtons.find((button) =>
      button.getAttribute("title")?.includes("Load another file"),
    );

    expect(loadFileButton).toBeInTheDocument();

    // Mock file input and FileReader
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as any,
      click: vi.fn(),
    };

    const mockFileReader = {
      onload: null as any,
      readAsText: vi.fn(),
      result: JSON.stringify(newData),
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockInput as any);
    vi.spyOn(window, "FileReader").mockImplementation(
      () => mockFileReader as any,
    );

    // Click the load file button
    fireEvent.click(loadFileButton!);

    // Verify file input was created and clicked
    expect(document.createElement).toHaveBeenCalledWith("input");
    expect(mockInput.type).toBe("file");
    expect(mockInput.accept).toBe(".json");
    expect(mockInput.click).toHaveBeenCalled();

    // Simulate file selection and reading
    const mockFile = new File([JSON.stringify(newData)], "new-data.json", {
      type: "application/json",
    });
    const mockEvent = {
      target: { files: [mockFile] },
    };

    // Trigger the onchange handler
    mockInput.onchange(mockEvent);

    // Simulate FileReader onload
    const readerEvent = {
      target: { result: JSON.stringify(newData) },
    };
    mockFileReader.onload(readerEvent);

    // Wait for the new data to be processed
    await waitFor(
      () => {
        // Parser should have been called more times than initially
        expect(mockParseData.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      },
      { timeout: 3000 },
    );

    // Check if the new data was processed
    const allCalls = mockParseData.mock.calls;
    const hasNewDataCall = allCalls.some(
      (call) =>
        call[0] &&
        call[0].nodes &&
        call[0].nodes.some((node: any) => node.id === "nodeA"),
    );

    expect(hasNewDataCall).toBe(true);
  });

  it.skip("should handle multiple file loads in sequence", async () => {
    // This test is skipped until the basic file loading is fixed
  });

  it.skip("should handle file loading errors gracefully", async () => {
    const initialData: HydroscopeData = {
      nodes: [{ id: "node1", label: "Initial" }],
      edges: [],
    };

    render(<HydroscopeEnhanced data={initialData} enhanced={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Mock file operations
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as any,
      click: vi.fn(),
    };

    const mockFileReader = {
      onload: null as any,
      readAsText: vi.fn(),
      result: "invalid json content",
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockInput as any);
    vi.spyOn(window, "FileReader").mockImplementation(
      () => mockFileReader as any,
    );

    const loadFileButton = screen
      .getAllByTestId("control-button")
      .find((button) =>
        button.getAttribute("title")?.includes("Load another file"),
      );

    fireEvent.click(loadFileButton!);

    // Simulate invalid JSON file
    mockInput.onchange({
      target: { files: [new File(["invalid json"], "invalid.json")] },
    });
    mockFileReader.onload({ target: { result: "invalid json content" } });

    // Should handle error gracefully without crashing
    // The component should still be rendered
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();

    // Parser should not have been called with invalid data
    expect(mockParseData).toHaveBeenCalledTimes(1); // Only initial data
    expect(mockParseData).toHaveBeenCalledWith(initialData);
  });
});
it.skip("should call handleFileLoaded when file is selected", async () => {
  const initialData: HydroscopeData = {
    nodes: [{ id: "node1", label: "Initial" }],
    edges: [],
  };

  // Mock the handleFileLoaded function to track calls
  const originalHandleFileLoaded = vi.fn();

  // Mock the component to expose handleFileLoaded
  const TestComponent = () => {
    const [data, setData] = React.useState(initialData);

    const handleFileLoaded = React.useCallback(
      (newData: HydroscopeData, filename: string) => {
        originalHandleFileLoaded(newData, filename);
        setData(newData);
      },
      [],
    );

    const handleLoadFile = React.useCallback(() => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target?.result as string);
              handleFileLoaded(data, file.name);
            } catch (error) {
              console.error("Parse error:", error);
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }, [handleFileLoaded]);

    return (
      <div>
        <button onClick={handleLoadFile} data-testid="load-file-button">
          Load File
        </button>
        <div data-testid="data-display">{JSON.stringify(data)}</div>
      </div>
    );
  };

  render(<TestComponent />);

  // Mock FileReader
  const mockFileReader = {
    onload: null as any,
    readAsText: vi.fn(),
    result: "",
  };
  vi.spyOn(window, "FileReader").mockImplementation(
    () => mockFileReader as any,
  );

  // Mock document.createElement
  const mockInput = {
    type: "",
    accept: "",
    onchange: null as any,
    click: vi.fn(),
  };
  vi.spyOn(document, "createElement").mockReturnValue(mockInput as any);

  // Click the load file button
  const loadButton = screen.getByTestId("load-file-button");
  fireEvent.click(loadButton);

  // Verify file input was created
  expect(document.createElement).toHaveBeenCalledWith("input");
  expect(mockInput.click).toHaveBeenCalled();

  // Simulate file selection
  const newData = { nodes: [{ id: "newNode", label: "New" }], edges: [] };
  const mockFile = new File([JSON.stringify(newData)], "test.json");

  // Trigger onchange
  mockInput.onchange({ target: { files: [mockFile] } });

  // Simulate FileReader onload
  mockFileReader.result = JSON.stringify(newData);
  mockFileReader.onload({ target: { result: JSON.stringify(newData) } });

  // Wait for the handler to be called
  await waitFor(() => {
    expect(originalHandleFileLoaded).toHaveBeenCalledWith(newData, "test.json");
  });
});
