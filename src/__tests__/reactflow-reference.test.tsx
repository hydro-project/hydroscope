/**
 * ReactFlow Reference Test
 * 
 * This test creates a reference implementation of ReactFlow controls
 * to measure exact styling and positioning properties.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

// Create a reference ReactFlow Controls component based on actual ReactFlow styling
const ReferenceReactFlowControls = () => {
  return (
    <div 
      data-testid="reference-reactflow-controls"
      className="react-flow__controls"
      style={{
        position: "absolute",
        bottom: "10px",
        left: "10px", 
        zIndex: 4,
        display: "flex",
        flexDirection: "column",
        boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 4px",
        borderRadius: "2px",
        width: "26px", // Container should be same width as buttons
        backgroundColor: "white", // Container background
      }}
    >
      <button 
        data-testid="ref-zoom-in"
        className="react-flow__controls-button"
        style={{
          alignItems: "center",
          background: "#fefefe",
          border: "none",
          borderBottom: "1px solid #b1b1b7",
          color: "#555",
          cursor: "pointer", 
          display: "flex",
          height: "26px",
          justifyContent: "center",
          padding: "4px",
          userSelect: "none",
          width: "26px",
          fontSize: "12px",
        }}
      >
        +
      </button>
      <button 
        data-testid="ref-zoom-out"
        className="react-flow__controls-button"
        style={{
          alignItems: "center",
          background: "#fefefe", 
          border: "none",
          borderBottom: "1px solid #b1b1b7",
          color: "#555",
          cursor: "pointer",
          display: "flex", 
          height: "26px",
          justifyContent: "center",
          padding: "4px",
          userSelect: "none",
          width: "26px",
          fontSize: "12px",
        }}
      >
        -
      </button>
      <button 
        data-testid="ref-fit-view"
        className="react-flow__controls-button"
        style={{
          alignItems: "center",
          background: "#fefefe",
          border: "none", 
          borderBottom: "1px solid #b1b1b7",
          color: "#555",
          cursor: "pointer",
          display: "flex",
          height: "26px", 
          justifyContent: "center",
          padding: "4px",
          userSelect: "none",
          width: "26px",
          fontSize: "12px",
        }}
      >
        ⛶
      </button>
      <button 
        data-testid="ref-lock"
        className="react-flow__controls-button"
        style={{
          alignItems: "center",
          background: "#fefefe",
          border: "none",
          color: "#555", 
          cursor: "pointer",
          display: "flex",
          height: "26px",
          justifyContent: "center",
          padding: "4px",
          userSelect: "none", 
          width: "26px",
          fontSize: "12px",
        }}
      >
        🔒
      </button>
    </div>
  );
};

describe("ReactFlow Reference Measurements", () => {
  it("should measure reference ReactFlow controls for exact styling", () => {
    render(
      <div style={{ width: "800px", height: "600px", position: "relative", backgroundColor: "#f5f5f5" }}>
        <ReferenceReactFlowControls />
      </div>
    );

    const controls = screen.getByTestId("reference-reactflow-controls");
    const controlsStyle = window.getComputedStyle(controls);
    const controlsRect = controls.getBoundingClientRect();
    
    // Measure container
    const containerMeasurements = {
      position: controlsStyle.position,
      bottom: controlsStyle.bottom,
      left: controlsStyle.left,
      zIndex: controlsStyle.zIndex,
      display: controlsStyle.display,
      flexDirection: controlsStyle.flexDirection,
      boxShadow: controlsStyle.boxShadow,
      borderRadius: controlsStyle.borderRadius,
      width: controlsRect.width,
      height: controlsRect.height,
    };
    
    console.log("📏 REFERENCE ReactFlow Controls Container:");
    console.log(JSON.stringify(containerMeasurements, null, 2));
    
    // Measure button
    const button = screen.getByTestId("ref-zoom-in");
    const buttonStyle = window.getComputedStyle(button);
    const buttonRect = button.getBoundingClientRect();
    
    const buttonMeasurements = {
      width: buttonStyle.width,
      height: buttonStyle.height,
      background: buttonStyle.background,
      backgroundColor: buttonStyle.backgroundColor,
      border: buttonStyle.border,
      borderBottom: buttonStyle.borderBottom,
      color: buttonStyle.color,
      fontSize: buttonStyle.fontSize,
      padding: buttonStyle.padding,
      actualWidth: buttonRect.width,
      actualHeight: buttonRect.height,
    };
    
    console.log("🔘 REFERENCE ReactFlow Button:");
    console.log(JSON.stringify(buttonMeasurements, null, 2));
    
    // Calculate exact positioning for custom controls
    const customControlsPosition = {
      // Custom controls should be positioned above ReactFlow controls
      // ReactFlow controls: bottom: 10px, height: ~104px (4 buttons × 26px)
      // So custom controls should be at: 10px + 104px + gap = 124px + gap
      recommendedBottom: controlsRect.height + 10 + 10, // controls height + ReactFlow bottom + gap
      alignedLeft: controlsStyle.left, // Same as ReactFlow
      alignedZIndex: parseInt(controlsStyle.zIndex) + 1, // Higher than ReactFlow
    };
    
    console.log("🎯 RECOMMENDED Custom Controls Position:");
    console.log(JSON.stringify(customControlsPosition, null, 2));
    
    // Verify measurements
    expect(controlsRect.width).toBe(26); // Should be 26px wide
    expect(controlsRect.height).toBe(104); // Should be 4 × 26px = 104px tall
    expect(buttonRect.width).toBe(26); // Button should be 26px wide
    expect(buttonRect.height).toBe(26); // Button should be 26px tall
  });
  
  it("should create exact ReactFlow button styling template", () => {
    render(
      <div style={{ width: "800px", height: "600px", position: "relative" }}>
        <ReferenceReactFlowControls />
      </div>
    );

    const button = screen.getByTestId("ref-zoom-in");
    const style = window.getComputedStyle(button);
    
    // Extract exact styling for template
    const exactButtonStyle = {
      alignItems: style.alignItems,
      background: style.background,
      backgroundColor: style.backgroundColor,
      border: style.border,
      borderBottom: style.borderBottom,
      color: style.color,
      cursor: style.cursor,
      display: style.display,
      height: style.height,
      justifyContent: style.justifyContent,
      padding: style.padding,
      userSelect: style.userSelect,
      width: style.width,
      fontSize: style.fontSize,
      margin: style.margin,
      borderRadius: style.borderRadius,
    };
    
    console.log("📋 EXACT ReactFlow Button Style Template:");
    console.log("const reactFlowButtonStyle = " + JSON.stringify(exactButtonStyle, null, 2) + ";");
    
    // This gives us the exact template to copy
    expect(style.width).toBe("26px");
    expect(style.height).toBe("26px");
    expect(style.backgroundColor).toBe("rgb(254, 254, 254)"); // #fefefe
    expect(style.color).toBe("rgb(85, 85, 85)"); // #555
  });
});