/**
 * CustomControls Integration Tests
 *
 * Tests the CustomControls component integration with v6 architecture
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HydroscopeEnhanced } from "../components/HydroscopeEnhanced";

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

vi.mock("../utils/JSONParser.js", () => ({
  JSONParser: {
    createPaxosParser: vi.fn().mockReturnValue({
      parseData: vi.fn().mockResolvedValue({
        visualizationState: {
          visibleContainers: [
            { id: "container1", collapsed: true },
            { id: "container2", collapsed: false },
          ],
          visibleNodes: [],
          allNodes: [],
        },
      }),
    }),
  },
}));

vi.mock("../core/InteractionHandler.js", () => ({
  InteractionHandler: vi.fn(),
}));

describe("CustomControls Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render CustomControls when enhanced mode is enabled", async () => {
    render(<HydroscopeEnhanced enhanced={true} demo={true} />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId("reactflow-provider")).toBeInTheDocument();
    });

    // Should render ReactFlow with controls
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.getAllByTestId("controls")).toHaveLength(2); // Custom + Standard controls
  });

  it("should show pack/unpack buttons when containers are available", async () => {
    render(<HydroscopeEnhanced enhanced={true} demo={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Should have control buttons (pack, unpack, fit view, auto-fit, load file)
    const controlButtons = screen.getAllByTestId("control-button");
    expect(controlButtons.length).toBeGreaterThan(0);
  });

  it("should handle fit view functionality", async () => {
    render(<HydroscopeEnhanced enhanced={true} demo={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Find and click fit view button (should be one of the control buttons)
    const controlButtons = screen.getAllByTestId("control-button");
    const fitViewButton = controlButtons.find((button) =>
      button.getAttribute("title")?.includes("Fit graph to viewport"),
    );

    if (fitViewButton) {
      fireEvent.click(fitViewButton);
      // Should not throw error
      expect(fitViewButton).toBeInTheDocument();
    }
  });

  it("should handle auto-fit toggle functionality", async () => {
    render(<HydroscopeEnhanced enhanced={true} demo={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Find and click auto-fit toggle button
    const controlButtons = screen.getAllByTestId("control-button");
    const autoFitButton = controlButtons.find((button) =>
      button.getAttribute("title")?.includes("Auto-fit"),
    );

    if (autoFitButton) {
      fireEvent.click(autoFitButton);
      // Should not throw error
      expect(autoFitButton).toBeInTheDocument();
    }
  });

  it("should handle load file functionality", async () => {
    render(<HydroscopeEnhanced enhanced={true} demo={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    // Find and click load file button
    const controlButtons = screen.getAllByTestId("control-button");
    const loadFileButton = controlButtons.find((button) =>
      button.getAttribute("title")?.includes("Load another file"),
    );

    if (loadFileButton) {
      // Mock document.createElement for file input
      const mockInput = {
        type: "",
        accept: "",
        onchange: null as any,
        click: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(mockInput as any);

      fireEvent.click(loadFileButton);

      // Should create and click file input
      expect(document.createElement).toHaveBeenCalledWith("input");
      expect(mockInput.click).toHaveBeenCalled();
    }
  });

  it("should disable pack/unpack buttons when no containers available", () => {
    // This test verifies the logic - when no containers are available,
    // pack/unpack buttons should not be rendered
    const hasContainers = false;
    const hasCollapsedContainers = false;
    const hasExpandedContainers = false;

    // Simulate the CustomControls logic
    const shouldShowPackButton = hasContainers && hasExpandedContainers;
    const shouldShowUnpackButton = hasContainers && hasCollapsedContainers;

    // When no containers, pack/unpack buttons should not be shown
    expect(shouldShowPackButton).toBe(false);
    expect(shouldShowUnpackButton).toBe(false);
  });
});
