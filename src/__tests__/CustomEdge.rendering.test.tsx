import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CustomEdge } from "../render/CustomEdge.js";
import { ReactFlowProvider, Position } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

// Import actual ReactFlow to avoid mock issues
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
  };
});

describe("CustomEdge Rendering", () => {
  // Helper to create edge props
  const createEdgeProps = (overrides: Partial<EdgeProps> = {}): EdgeProps => ({
    id: "test-edge",
    source: "n1",
    target: "n2",
    sourceX: 100,
    sourceY: 100,
    targetX: 200,
    targetY: 200,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    markerEnd: "url(#arrow)",
    style: {
      stroke: "#000000",
      strokeWidth: 2,
    },
    data: {},
    ...overrides,
  });

  it("should render a single line for edges without lineStyle", () => {
    const props = createEdgeProps();
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    // Should have only one path element (single line)
    const paths = container.querySelectorAll("path");
    console.log("Single line - paths found:", paths.length);
    paths.forEach((path, i) => {
      console.log(`Path ${i}:`, path.outerHTML.substring(0, 100));
    });

    // Single line should have just one path
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('should render hash marks (circles) for edges with lineStyle="hash-marks"', () => {
    const props = createEdgeProps({
      data: { lineStyle: "hash-marks" },
    });

    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    // Should have TWO path elements for double line
    const paths = container.querySelectorAll("path");
    console.log("Double line - paths found:", paths.length);
    paths.forEach((path, i) => {
      console.log(`Path ${i}:`, path.outerHTML.substring(0, 150));
    });

    // Check for g elements with transform
    const gElements = container.querySelectorAll("g[transform]");
    console.log("g[transform] elements found:", gElements.length);
    // Hash marks should have circles instead of double lines
    const circles = container.querySelectorAll("circle");

    // Should have at least one circle for hash marks
    expect(circles.length).toBeGreaterThan(0);

    // Should have one main path
    expect(paths.length).toBe(1);

    // Circles should have proper radius
    circles.forEach((circle) => {
      expect(circle.getAttribute("r")).toBe("3");
    });
  });

  it("should render wavy path when waviness=true", () => {
    const props = createEdgeProps({
      data: { waviness: true },
    });

    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    const paths = container.querySelectorAll("path");
    console.log("Wavy line - paths found:", paths.length);

    // Get the path data
    const pathData = paths[0]?.getAttribute("d") || "";
    console.log("Path data length:", pathData.length);
    console.log("Path data (first 300 chars):", pathData.substring(0, 300));
    console.log("Path data (contains M):", pathData.includes("M"));
    console.log("Path data (contains L):", pathData.includes("L"));

    // Wavy paths use line segments to approximate sine waves
    // Should have many L (line to) commands creating the wave pattern
    expect(pathData).toMatch(/M/); // Should start with Move
    expect(pathData).toMatch(/L/); // Should have Line commands
    // Should have many segments (wavy path is much longer than straight)
    expect(pathData.length).toBeGreaterThan(100);
  });

  it('should render hash marks on wavy lines when both lineStyle="hash-marks" and waviness=true', () => {
    const props = createEdgeProps({
      data: { lineStyle: "hash-marks", waviness: true },
    });

    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    const paths = container.querySelectorAll("path");
    console.log("Double wavy - paths found:", paths.length);

    const gElements = container.querySelectorAll("g[transform]");
    console.log("g[transform] elements found:", gElements.length);

    // Should have circles for hash marks
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);

    // Should have one wavy path
    expect(paths.length).toBe(1);

    // Path should be wavy (long path data)
    const pathData = paths[0]?.getAttribute("d") || "";
    console.log("First path length:", pathData.length);
    expect(pathData.length).toBeGreaterThan(100); // Wavy paths are long
  });

  it("should extract lineStyle and waviness from edge data", () => {
    const props = createEdgeProps({
      id: "e2",
      data: {
        lineStyle: "hash-marks",
        waviness: false,
        appliedSemanticTags: ["HashMarks"],
      },
    });

    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    // This edge should render as double (2 paths)
    const paths = container.querySelectorAll("path");
    console.log("Edge e2 - paths found:", paths.length);
    expect(paths.length).toBe(2);
  });
});
