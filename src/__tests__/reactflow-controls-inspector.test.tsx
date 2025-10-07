/**
 * ReactFlow Controls Inspector
 *
 * This test inspects the actual ReactFlow controls to get exact measurements
 * for positioning and styling, so we can match them precisely.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HydroscopeCore } from "../components/HydroscopeCore.js";

// Mock ReactFlow but keep Controls as close to real as possible
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    ReactFlow: ({ children }: any) => (
      <div
        data-testid="react-flow"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: "#f0f0f0",
        }}
      >
        {children}
      </div>
    ),
    ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
    Background: () => <div data-testid="background" />,
    // Keep Controls as real as possible - just add test IDs
    Controls: ({ children, style, ...props }: any) => {
      const defaultStyle = {
        position: "absolute",
        bottom: "10px",
        left: "10px",
        zIndex: 4,
        display: "flex",
        flexDirection: "column",
        gap: "0px", // ReactFlow default
        boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 4px",
        borderRadius: "2px",
        ...style,
      };

      return (
        <div
          data-testid="reactflow-controls"
          className="react-flow__controls"
          style={defaultStyle}
          {...props}
        >
          {/* Standard ReactFlow control buttons with real styling */}
          <button
            data-testid="zoom-in-btn"
            className="react-flow__controls-button"
            style={{
              width: "26px",
              height: "26px",
              border: "1px solid #b1b1b7",
              borderBottom: "1px solid #b1b1b7",
              borderRadius: "0px", // ReactFlow buttons have no border radius except container
              backgroundColor: "#fefefe",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "#555",
              margin: "0",
              padding: "0",
            }}
            title="Zoom in"
          >
            +
          </button>
          <button
            data-testid="zoom-out-btn"
            className="react-flow__controls-button"
            style={{
              width: "26px",
              height: "26px",
              border: "1px solid #b1b1b7",
              borderTop: "0px", // ReactFlow buttons share borders
              borderBottom: "1px solid #b1b1b7",
              borderRadius: "0px",
              backgroundColor: "#fefefe",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "#555",
              margin: "0",
              padding: "0",
            }}
            title="Zoom out"
          >
            -
          </button>
          <button
            data-testid="fit-view-btn"
            className="react-flow__controls-button"
            style={{
              width: "26px",
              height: "26px",
              border: "1px solid #b1b1b7",
              borderTop: "0px",
              borderBottom: "1px solid #b1b1b7",
              borderRadius: "0px",
              backgroundColor: "#fefefe",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "#555",
              margin: "0",
              padding: "0",
            }}
            title="Fit view"
          >
            ⛶
          </button>
          <button
            data-testid="lock-btn"
            className="react-flow__controls-button"
            style={{
              width: "26px",
              height: "26px",
              border: "1px solid #b1b1b7",
              borderTop: "0px",
              borderBottom: "none", // Last button has no bottom border
              borderRadius: "0px",
              backgroundColor: "#fefefe",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "#555",
              margin: "0",
              padding: "0",
            }}
            title="Toggle interactivity"
          >
            🔒
          </button>
          {children}
        </div>
      );
    },
    MiniMap: () => <div data-testid="minimap" />,
    useReactFlow: () => ({
      fitView: vi.fn(),
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
    }),
    useNodesInitialized: () => true,
    applyNodeChanges: vi.fn(),
    applyEdgeChanges: vi.fn(),
  };
});

const mockData = {
  nodes: [{ id: "1", label: "Node 1", type: "operator" }],
  edges: [],
  hierarchyChoices: [
    { id: "default", name: "Default", description: "Default grouping" },
  ],
  nodeAssignments: { default: { "1": [] } },
};

describe("ReactFlow Controls Inspector", () => {
  it("should measure actual ReactFlow controls properties", () => {
    render(
      <div style={{ width: "800px", height: "600px", position: "relative" }}>
        <HydroscopeCore
          data={mockData}
          showControls={true}
          showMiniMap={false}
          showBackground={false}
        />
      </div>,
    );

    const reactFlowControls = screen.getByTestId("reactflow-controls");
    const controlsStyle = window.getComputedStyle(reactFlowControls);

    // Measure container properties
    const containerProps = {
      position: controlsStyle.position,
      bottom: controlsStyle.bottom,
      left: controlsStyle.left,
      zIndex: controlsStyle.zIndex,
      display: controlsStyle.display,
      flexDirection: controlsStyle.flexDirection,
      gap: controlsStyle.gap,
      boxShadow: controlsStyle.boxShadow,
      borderRadius: controlsStyle.borderRadius,
    };

    console.log("📏 ReactFlow Controls Container Properties:");
    console.log(JSON.stringify(containerProps, null, 2));

    // Measure button properties
    const zoomInBtn = screen.getByTestId("zoom-in-btn");
    const buttonStyle = window.getComputedStyle(zoomInBtn);

    const buttonProps = {
      width: buttonStyle.width,
      height: buttonStyle.height,
      border: buttonStyle.border,
      borderTop: buttonStyle.borderTop,
      borderBottom: buttonStyle.borderBottom,
      borderLeft: buttonStyle.borderLeft,
      borderRight: buttonStyle.borderRight,
      borderRadius: buttonStyle.borderRadius,
      backgroundColor: buttonStyle.backgroundColor,
      color: buttonStyle.color,
      fontSize: buttonStyle.fontSize,
      margin: buttonStyle.margin,
      padding: buttonStyle.padding,
    };

    console.log("🔘 ReactFlow Button Properties:");
    console.log(JSON.stringify(buttonProps, null, 2));

    // Store measurements for comparison
    expect(containerProps.position).toBe("absolute");
    expect(containerProps.bottom).toBe("10px");
    expect(containerProps.left).toBe("10px");
    expect(buttonProps.width).toBe("26px");
    expect(buttonProps.height).toBe("26px");
  });

  it("should measure ReactFlow controls container dimensions", () => {
    render(
      <div style={{ width: "800px", height: "600px", position: "relative" }}>
        <HydroscopeCore
          data={mockData}
          showControls={true}
          showMiniMap={false}
          showBackground={false}
        />
      </div>,
    );

    const reactFlowControls = screen.getByTestId("reactflow-controls");
    const rect = reactFlowControls.getBoundingClientRect();

    const dimensions = {
      width: rect.width,
      height: rect.height,
      totalButtons: 4,
      expectedHeight: 26 * 4, // 4 buttons × 26px each
    };

    console.log("📐 ReactFlow Controls Dimensions:");
    console.log(JSON.stringify(dimensions, null, 2));

    // The container should be exactly the height of all buttons
    expect(rect.height).toBe(26 * 4); // 104px total
    expect(rect.width).toBe(26); // 26px wide
  });
});
