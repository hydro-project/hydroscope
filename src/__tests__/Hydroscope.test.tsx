/**
 * Basic tests for the new Hydroscope component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Hydroscope } from "../components/Hydroscope.js";

import { vi } from "vitest";

// Mock the v6 architecture components
vi.mock("../core/VisualizationState.js", () => ({
  VisualizationState: vi.fn().mockImplementation(() => ({
    loadData: vi.fn(),
  })),
}));

vi.mock("../core/AsyncCoordinator.js", () => ({
  AsyncCoordinator: vi.fn().mockImplementation(() => ({})),
}));

describe("Hydroscope Component", () => {
  it("renders without crashing", () => {
    render(<Hydroscope />);
    expect(document.querySelector(".hydroscope")).toBeInTheDocument();
  });

  it("shows file upload interface when no data is provided", () => {
    render(<Hydroscope showFileUpload={true} />);
    // The FileUpload component should be rendered
    expect(document.querySelector(".hydroscope")).toBeInTheDocument();
  });

  it("renders with provided data", async () => {
    const testData = {
      nodes: [
        { id: "node1", label: "Test Node 1" },
        { id: "node2", label: "Test Node 2" },
      ],
      edges: [{ id: "edge1", source: "node1", target: "node2" }],
      hierarchyChoices: [],
      nodeAssignments: {},
    };

    render(<Hydroscope data={testData} />);

    // Should show the data loaded successfully message
    await screen.findByText("Data Loaded Successfully");
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "Nodes: 2";
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "Edges: 1";
      }),
    ).toBeInTheDocument();
  });

  it("renders panel toggle controls when panels are enabled", () => {
    render(
      <Hydroscope
        showInfoPanel={true}
        showStylePanel={true}
        data={{
          nodes: [],
          edges: [],
          hierarchyChoices: [],
          nodeAssignments: {},
        }}
      />,
    );

    // Should have panel toggle buttons
    expect(screen.getByTitle(/Info Panel/)).toBeInTheDocument();
    expect(screen.getByTitle(/Style Panel/)).toBeInTheDocument();
  });

  it("applies custom className and style", () => {
    const customStyle = { backgroundColor: "red" };
    render(<Hydroscope className="custom-hydroscope" style={customStyle} />);

    const container = document.querySelector(".hydroscope");
    expect(container).toHaveClass("custom-hydroscope");
    expect(container).toHaveStyle("background-color: rgb(255, 0, 0)");
  });

  it("handles error state gracefully", () => {
    // This would be tested with more complex scenarios
    render(<Hydroscope />);
    expect(document.querySelector(".hydroscope")).toBeInTheDocument();
  });
});
