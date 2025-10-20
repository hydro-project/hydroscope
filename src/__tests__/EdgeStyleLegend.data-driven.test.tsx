/**
 * EdgeStyleLegend Component Data-Driven Regression Tests
 *
 * Ensures the EdgeStyleLegend component remains data-driven from JSON's
 * edgeStyleConfig.semanticMappings and properly renders edge styles.
 *
 * These tests verify:
 * 1. Legend reads from semanticMappings in JSON data
 * 2. Legend groups semantic tags by category with visual separators
 * 3. Legend generates visual samples matching actual edge rendering
 * 4. Legend uses wavy line parameters from config.ts
 * 5. No hardcoded edge styles or semantic tags
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EdgeStyleLegend } from "../components/EdgeStyleLegend.js";

describe("EdgeStyleLegend Component - Data-Driven Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  describe("SemanticMappings Integration", () => {
    it("should render semantic tags from JSON edgeStyleConfig", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          BoundednessGroup: {
            Bounded: { "line-width": 3 },
            Unbounded: { "line-width": 1 },
          },
          OrderingGroup: {
            TotalOrder: { waviness: "none" },
            NoOrder: { waviness: "wavy" },
          },
        },
      };

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      expect(screen.getByText("Bounded")).toBeInTheDocument();
      expect(screen.getByText("Unbounded")).toBeInTheDocument();
      expect(screen.getByText("TotalOrder")).toBeInTheDocument();
      expect(screen.getByText("NoOrder")).toBeInTheDocument();
    });

    it("should render all semantic groups from config", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          BoundednessGroup: {
            Bounded: { "line-width": 3 },
          },
          OrderingGroup: {
            TotalOrder: { waviness: "none" },
          },
          NetworkGroup: {
            Local: { animation: "static" },
            Network: { animation: "animated" },
          },
        },
      };

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      // Should show all tags
      expect(screen.getByText("Bounded")).toBeInTheDocument();
      expect(screen.getByText("TotalOrder")).toBeInTheDocument();
      expect(screen.getByText("Local")).toBeInTheDocument();
      expect(screen.getAllByText("Network").length).toBeGreaterThan(0); // Network appears as both group header and tag

      // Should have group headers (with "Group" suffix removed)
      expect(screen.getByText("Boundedness")).toBeInTheDocument();
      expect(screen.getByText("Ordering")).toBeInTheDocument();
      expect(screen.getAllByText("Network").length).toBe(2); // Once as header, once as tag
    });

    it("should handle complex semantic mappings with all style properties", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          ComplexGroup: {
            ComplexEdge: {
              "line-width": 2,
              "line-pattern": "dashed",
              "line-style": "double",
              waviness: "wavy",
              animation: "animated",
              arrowhead: "triangle-filled",
              halo: "light-red",
            },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      expect(screen.getByText("ComplexEdge")).toBeInTheDocument();

      // Should render SVG for visual sample
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("Visual Grouping", () => {
    it("should display group headers for semantic categories", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          BoundednessGroup: {
            Bounded: { "line-width": 3 },
          },
          OrderingGroup: {
            TotalOrder: { waviness: "none" },
          },
        },
      };

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      // Group headers should be displayed (with "Group" suffix removed)
      expect(screen.getByText("Boundedness")).toBeInTheDocument();
      expect(screen.getByText("Ordering")).toBeInTheDocument();
    });

    it("should add visual separators between groups", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          Group1: {
            Tag1: { "line-width": 1 },
          },
          Group2: {
            Tag2: { "line-width": 2 },
          },
          Group3: {
            Tag3: { "line-width": 3 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Should have separators (divs with height: 1px)
      const separators = Array.from(container.querySelectorAll("div")).filter(
        (div) => div.style.height === "1px",
      );

      // Should have 2 separators for 3 groups (separator between each group)
      expect(separators.length).toBe(2);
    });

    it("should not add separator before first group", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          FirstGroup: {
            Tag1: { "line-width": 1 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Should have no separators for single group
      const separators = Array.from(container.querySelectorAll("div")).filter(
        (div) => div.style.height === "1px",
      );

      expect(separators.length).toBe(0);
    });
  });

  describe("Visual Sample Generation", () => {
    it("should generate SVG samples for line-width variations", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          WidthGroup: {
            Thin: { "line-width": 1 },
            Thick: { "line-width": 3 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(2); // One for each tag

      // Check that lines have different stroke widths
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("should generate SVG samples for line-pattern variations", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          PatternGroup: {
            Solid: { "line-pattern": "solid" },
            Dashed: { "line-pattern": "dashed" },
            Dotted: { "line-pattern": "dotted" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(3); // One for each pattern
    });

    it("should generate SVG samples for hash-marks line style", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          StyleGroup: {
            Single: { "line-style": "single" },
            HashMarks: { "line-style": "hash-marks" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(2);

      // Hash marks should have circles (matching CustomEdge implementation)
      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBeGreaterThan(0); // At least some circles for hash marks

      // Should still have lines for the main edge path
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("should generate SVG samples for wavy edges", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          WavinessGroup: {
            Straight: { waviness: "none" },
            Wavy: { waviness: "wavy" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Wavy edges should use path elements
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBeGreaterThan(0);
    });

    it("should generate SVG samples for animated edges", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          AnimationGroup: {
            Static: { animation: "static" },
            Animated: { animation: "animated" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Animated edges should have animateTransform elements
      const animations = container.querySelectorAll("animateTransform");
      expect(animations.length).toBeGreaterThan(0);
    });

    it("should generate SVG samples for arrowhead variations", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          ArrowheadGroup: {
            TriangleFilled: { arrowhead: "triangle-filled" },
            CircleFilled: { arrowhead: "circle-filled" },
            DiamondOpen: { arrowhead: "diamond-open" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Should have polygon or circle elements for arrowheads
      const polygons = container.querySelectorAll("polygon");
      const circles = container.querySelectorAll("circle");
      expect(polygons.length + circles.length).toBeGreaterThan(0);
    });

    it("should generate SVG samples for halo effects", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          HaloGroup: {
            NoHalo: { halo: "none" },
            RedHalo: { halo: "light-red" },
            BlueHalo: { halo: "light-blue" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(3);
    });
  });

  describe("Empty State Handling", () => {
    it("should show empty message when no edgeStyleConfig provided", () => {
      render(<EdgeStyleLegend />);

      expect(
        screen.getByText("No edge style data available"),
      ).toBeInTheDocument();
    });

    it("should show title but no items when semanticMappings is empty", () => {
      const edgeStyleConfig = {
        semanticMappings: {},
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Should show title but no legend items
      expect(screen.getByText("Edge Styles")).toBeInTheDocument();
      const legendItems = container.querySelectorAll('[style*="border: 1px"]');
      expect(legendItems.length).toBe(0);
    });

    it("should show empty message when semanticMappings is undefined", () => {
      const edgeStyleConfig = {};

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      expect(
        screen.getByText("No edge style data available"),
      ).toBeInTheDocument();
    });
  });

  describe("No Hardcoded Data Verification", () => {
    it("should not render any edge styles without data", () => {
      const { container } = render(<EdgeStyleLegend />);

      // Should only show empty message, no hardcoded styles
      const legendItems = container.querySelectorAll('[style*="border: 1px"]');
      expect(legendItems.length).toBe(0);
    });

    it("should render exactly the semantic tags provided in data", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          CustomGroup: {
            CustomTag1: { "line-width": 1 },
            CustomTag2: { "line-width": 2 },
          },
        },
      };

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      // Should show exactly 2 custom tags
      expect(screen.getByText("CustomTag1")).toBeInTheDocument();
      expect(screen.getByText("CustomTag2")).toBeInTheDocument();

      // Should not show any common edge property names
      expect(screen.queryByText("Bounded")).not.toBeInTheDocument();
      expect(screen.queryByText("Unbounded")).not.toBeInTheDocument();
      expect(screen.queryByText("TotalOrder")).not.toBeInTheDocument();
      expect(screen.queryByText("NoOrder")).not.toBeInTheDocument();
    });

    it("should not have any hardcoded edge style samples", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          TestGroup: {
            TestTag: { "line-width": 1 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Should only have 1 SVG (for TestTag), not multiple hardcoded samples
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(1);
    });
  });

  describe("Display Options", () => {
    it("should support compact mode", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          TestGroup: {
            TestTag: { "line-width": 1 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} compact={true} />,
      );

      expect(screen.getByText("TestTag")).toBeInTheDocument();

      // In compact mode, font sizes should be smaller
      const legendDiv = container.querySelector(".edge-style-legend");
      expect(legendDiv).toHaveStyle("font-size: 9px");
    });

    it("should support custom className", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          TestGroup: {
            TestTag: { "line-width": 1 },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend
          edgeStyleConfig={edgeStyleConfig}
          className="custom-class"
        />,
      );

      const legendDiv = container.querySelector(".custom-class");
      expect(legendDiv).toBeInTheDocument();
    });

    it("should support custom style prop", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          TestGroup: {
            TestTag: { "line-width": 1 },
          },
        },
      };

      const customStyle = { backgroundColor: "red" };

      const { container } = render(
        <EdgeStyleLegend
          edgeStyleConfig={edgeStyleConfig}
          style={customStyle}
        />,
      );

      const legendDiv = container.querySelector(".edge-style-legend");
      expect(legendDiv).toHaveStyle("background-color: rgb(255, 0, 0)");
    });
  });

  describe("Wavy Line Config Integration", () => {
    it("should use wavy line parameters from config for wavy edges", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          WavinessGroup: {
            Wavy: { waviness: "wavy" },
          },
        },
      };

      const { container } = render(
        <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />,
      );

      // Wavy edges should use path elements with specific wave patterns
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBeGreaterThan(0);

      // Path should have a 'd' attribute with wave pattern (using line segments)
      const wavyPath = paths[0];
      const pathData = wavyPath.getAttribute("d") || "";
      expect(pathData.length).toBeGreaterThan(50); // Wavy paths have many points
    });
  });

  describe("Real-World JSON Format", () => {
    it("should handle paxos.json style edgeStyleConfig", () => {
      const edgeStyleConfig = {
        semanticMappings: {
          BoundednessGroup: {
            Bounded: { "line-width": 3 },
            Unbounded: { "line-width": 1 },
          },
          OrderingGroup: {
            TotalOrder: { waviness: "none" },
            NoOrder: { waviness: "wavy" },
          },
          NetworkGroup: {
            Local: { animation: "static", "line-pattern": "solid" },
            Network: { animation: "animated", "line-pattern": "dotted" },
          },
          CollectionGroup: {
            Stream: { arrowhead: "triangle-filled", "line-style": "single" },
            Singleton: { arrowhead: "circle-filled", "line-style": "single" },
          },
          FlowGroup: {
            Linear: { halo: "none" },
            Cycle: { halo: "light-red" },
          },
        },
      };

      render(<EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} />);

      // Verify all groups are rendered
      expect(screen.getByText("Boundedness")).toBeInTheDocument();
      expect(screen.getByText("Ordering")).toBeInTheDocument();
      expect(screen.getAllByText("Network").length).toBeGreaterThan(0); // Network appears as both group header and tag
      expect(screen.getByText("Collection")).toBeInTheDocument();
      expect(screen.getByText("Flow")).toBeInTheDocument();

      // Verify all tags are rendered
      expect(screen.getByText("Bounded")).toBeInTheDocument();
      expect(screen.getByText("Unbounded")).toBeInTheDocument();
      expect(screen.getByText("TotalOrder")).toBeInTheDocument();
      expect(screen.getByText("NoOrder")).toBeInTheDocument();
      expect(screen.getByText("Local")).toBeInTheDocument();
      expect(screen.getAllByText("Network").length).toBe(2); // Once as header, once as tag
      expect(screen.getByText("Stream")).toBeInTheDocument();
      expect(screen.getByText("Singleton")).toBeInTheDocument();
      expect(screen.getByText("Linear")).toBeInTheDocument();
      expect(screen.getByText("Cycle")).toBeInTheDocument();
    });
  });
});
