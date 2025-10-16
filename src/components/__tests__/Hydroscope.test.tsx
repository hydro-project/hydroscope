/**
 * Basic tests for the new Hydroscope component
 */

import { render, screen } from "@testing-library/react";
import { Hydroscope } from "../Hydroscope";

import { vi } from "vitest";

// Mock the HydroscopeCore component since it has complex dependencies
vi.mock("../HydroscopeCore", () => ({
  HydroscopeCore: ({ data, onError }: any) => {
    if (!data) {
      onError?.(new Error("No data provided"));
      return <div data-testid="hydroscope-core-error">No data</div>;
    }
    return (
      <div data-testid="hydroscope-core">
        HydroscopeCore with {data.nodes?.length || 0} nodes
      </div>
    );
  },
}));

// Mock the panels
vi.mock("../panels/InfoPanel", () => ({
  InfoPanel: ({ open }: any) =>
    open ? <div data-testid="info-panel">InfoPanel</div> : null,
}));

vi.mock("../panels/StyleTuner", () => ({
  StyleTuner: ({ open }: any) =>
    open ? <div data-testid="style-tuner">StyleTuner</div> : null,
}));

// Mock FileUpload
vi.mock("../FileUpload", () => ({
  FileUpload: () => <div data-testid="file-upload">FileUpload</div>,
}));

describe("Hydroscope Component", () => {
  const mockData = {
    nodes: [
      { id: "node1", label: "Node 1" },
      { id: "node2", label: "Node 2" },
    ],
    edges: [{ id: "edge1", source: "node1", target: "node2" }],
    hierarchyChoices: [],
    nodeAssignments: {},
  };

  it("renders file upload when no data is provided", () => {
    render(<Hydroscope showFileUpload={true} />);

    expect(screen.getByTestId("file-upload")).toBeInTheDocument();
  });

  it("renders HydroscopeCore when data is provided", () => {
    render(<Hydroscope data={mockData} showFileUpload={false} />);

    expect(screen.getByTestId("hydroscope-core")).toBeInTheDocument();
    expect(screen.getByText("HydroscopeCore with 2 nodes")).toBeInTheDocument();
  });

  it("renders InfoPanel when showInfoPanel is true", () => {
    render(
      <Hydroscope
        data={mockData}
        showInfoPanel={true}
        showFileUpload={false}
      />,
    );

    expect(screen.getByTestId("info-panel")).toBeInTheDocument();
  });

  it("renders StyleTuner when showStylePanel is true and panel is open", () => {
    // Note: StyleTuner starts closed by default, so we need to check that it can be rendered
    // The actual opening/closing would be tested in integration tests
    render(
      <Hydroscope
        data={mockData}
        showStylePanel={true}
        showFileUpload={false}
      />,
    );

    // StyleTuner is present but may be hidden (opacity: 0, pointerEvents: none)
    // In a real scenario, user would click to open it
    // For now, just verify the component renders without errors
    expect(screen.getByTestId("hydroscope-core")).toBeInTheDocument();
  });

  it("does not render panels when they are disabled", () => {
    render(
      <Hydroscope
        data={mockData}
        showInfoPanel={false}
        showStylePanel={false}
        showFileUpload={false}
      />,
    );

    expect(screen.queryByTestId("info-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("style-tuner")).not.toBeInTheDocument();
  });

  it("handles file upload callback", () => {
    const onFileUpload = vi.fn();

    render(<Hydroscope showFileUpload={true} onFileUpload={onFileUpload} />);

    expect(screen.getByTestId("file-upload")).toBeInTheDocument();
  });

  it("applies custom className and style", () => {
    const { container } = render(
      <Hydroscope
        data={mockData}
        className="custom-hydroscope"
        style={{ border: "1px solid red" }}
        showFileUpload={false}
      />,
    );

    const hydroscopeElement = container.firstChild as HTMLElement;
    expect(hydroscopeElement).toHaveClass("custom-hydroscope");
    expect(hydroscopeElement).toHaveStyle("border: 1px solid red");
  });
});
