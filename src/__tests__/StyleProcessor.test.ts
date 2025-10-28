/**
 * StyleProcessor Tests - TDD implementation
 * Tests semantic tag to visual style conversion
 */

import { describe, it, expect } from "vitest";
import {
  processSemanticTags,
  validateSemanticMappings,
  VISUAL_CHANNELS,
  DEFAULT_STYLE,
  HALO_COLOR_MAPPINGS,
} from "../utils/StyleProcessor.js";
import type { StyleConfig } from "../types/core.js";

describe("StyleProcessor", () => {
  describe("processSemanticTags", () => {
    it("should return default style for empty semantic tags", () => {
      const result = processSemanticTags([]);

      expect(result).toEqual({
        style: {
          stroke: DEFAULT_STYLE.DEFAULT_STROKE_COLOR,
          strokeWidth: DEFAULT_STYLE.STROKE_WIDTH,
        },
        animated: false,
        appliedTags: [],
        markerEnd: { type: "arrowclosed" },
      });
    });

    it("should return default style when no style config provided", () => {
      const result = processSemanticTags(["Network", "Bounded"]);

      expect(result).toEqual({
        style: {
          stroke: DEFAULT_STYLE.DEFAULT_STROKE_COLOR,
          strokeWidth: DEFAULT_STYLE.STROKE_WIDTH,
        },
        animated: false,
        appliedTags: [],
        markerEnd: { type: "arrowclosed" },
      });
    });

    it("should process semantic mappings correctly", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          ordering: {
            TotalOrder: { "line-pattern": "solid" },
            NoOrder: { "line-pattern": "dashed" },
          },
          bounds: {
            Bounded: { "line-width": 1 },
            Unbounded: { "line-width": 3 },
          },
        },
      };

      const result = processSemanticTags(
        ["TotalOrder", "Bounded"],
        styleConfig,
      );

      expect(result.style).toMatchObject({
        strokeWidth: 1, // From Bounded mapping
        strokeDasharray: undefined, // From TotalOrder -> solid
      });
      expect(result.appliedTags).toEqual(["TotalOrder", "Bounded"]);
    });

    it("should handle animation semantic mapping", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          flow: {
            Static: { animation: "static" },
            Dynamic: { animation: "animated" },
          },
        },
      };

      const result = processSemanticTags(["Dynamic"], styleConfig);

      expect(result.animated).toBe(true);
      expect(result.appliedTags).toEqual(["Dynamic"]);
    });

    it("should handle line patterns correctly", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          pattern: {
            Solid: { "line-pattern": "solid" },
            Dashed: { "line-pattern": "dashed" },
            Dotted: { "line-pattern": "dotted" },
            DashDot: { "line-pattern": "dash-dot" },
          },
        },
      };

      const solidResult = processSemanticTags(["Solid"], styleConfig);
      expect(solidResult.style.strokeDasharray).toBeUndefined();

      const dashedResult = processSemanticTags(["Dashed"], styleConfig);
      expect(dashedResult.style.strokeDasharray).toBe("8,4");

      const dottedResult = processSemanticTags(["Dotted"], styleConfig);
      expect(dottedResult.style.strokeDasharray).toBe("2,2");

      const dashDotResult = processSemanticTags(["DashDot"], styleConfig);
      expect(dashDotResult.style.strokeDasharray).toBe("8,2,2,2");
    });

    it("should handle line width correctly", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          thickness: {
            Thin: { "line-width": 1 },
            Normal: { "line-width": 2 },
            Thick: { "line-width": 3 },
            ExtraThick: { "line-width": 4 },
          },
        },
      };

      const thinResult = processSemanticTags(["Thin"], styleConfig);
      expect(thinResult.style.strokeWidth).toBe(1);

      const thickResult = processSemanticTags(["Thick"], styleConfig);
      expect(thickResult.style.strokeWidth).toBe(3);
    });

    it("should handle hash-marks line style", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          style: {
            Single: { "line-style": "single" },
            HashMarks: { "line-style": "hash-marks" },
          },
        },
      };

      const hashMarksResult = processSemanticTags(["HashMarks"], styleConfig);
      expect(hashMarksResult.lineStyle).toBe("hash-marks");
      // line-style should not be in the CSS style object
      expect(hashMarksResult.style["line-style"]).toBeUndefined();
    });

    it("should handle halo colors", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          highlight: {
            Important: { halo: "light-blue" },
            Warning: { halo: "light-red" },
            Success: { halo: "light-green" },
          },
        },
      };

      const blueResult = processSemanticTags(["Important"], styleConfig);
      expect(blueResult.style.haloColor).toBe(
        HALO_COLOR_MAPPINGS["light-blue"],
      );

      const redResult = processSemanticTags(["Warning"], styleConfig);
      expect(redResult.style.haloColor).toBe(HALO_COLOR_MAPPINGS["light-red"]);
    });

    it("should handle arrowhead markers", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          marker: {
            Open: { arrowhead: "triangle-open" },
            Closed: { arrowhead: "triangle-filled" },
            Circle: { arrowhead: "circle-filled" },
            Diamond: { arrowhead: "diamond-open" },
          },
        },
      };

      const openResult = processSemanticTags(["Open"], styleConfig);
      expect(openResult.markerEnd).toEqual({ type: "arrow" });

      const closedResult = processSemanticTags(["Closed"], styleConfig);
      expect(closedResult.markerEnd).toEqual({ type: "arrowclosed" });

      const circleResult = processSemanticTags(["Circle"], styleConfig);
      expect(circleResult.markerEnd).toEqual({ type: "arrowclosed" });

      const diamondResult = processSemanticTags(["Diamond"], styleConfig);
      expect(diamondResult.markerEnd).toEqual({ type: "arrow" });
    });

    it("should handle color-token mapping (semantic colors)", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          collection: {
            Stream: { "color-token": "highlight-1" },
          },
        },
      };

      const result = processSemanticTags(["Stream"], styleConfig);
      // highlight-1 maps to a blue tone by default
      expect(result.style.stroke).toBe("#2563eb");
    });

    it("should handle waviness", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          flow: {
            Straight: { waviness: "none" },
            Wavy: { waviness: "wavy" },
          },
        },
      };

      const wavyResult = processSemanticTags(["Wavy"], styleConfig);
      expect(wavyResult.waviness).toBe(true);
      // waviness should not be in the CSS style object
      expect(wavyResult.style.waviness).toBeUndefined();
    });

    it("should combine multiple semantic mappings", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          ordering: {
            TotalOrder: { "line-pattern": "solid" },
            NoOrder: { "line-pattern": "dashed" },
          },
          bounds: {
            Bounded: { "line-width": 1 },
            Unbounded: { "line-width": 3 },
          },
          flow: {
            Static: { animation: "static" },
            Dynamic: { animation: "animated" },
          },
        },
      };

      const result = processSemanticTags(
        ["TotalOrder", "Unbounded", "Dynamic"],
        styleConfig,
      );

      expect(result.style).toMatchObject({
        strokeDasharray: undefined, // solid from TotalOrder
        strokeWidth: 3, // from Unbounded
      });
      expect(result.animated).toBe(true); // from Dynamic
      expect(result.appliedTags).toEqual([
        "TotalOrder",
        "Unbounded",
        "Dynamic",
      ]);
    });

    it("should create labels from semantic tags", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          group1: {
            Network: { "line-width": 2 },
          },
          group2: {
            Bounded: { "line-pattern": "solid" },
          },
        },
      };

      const result = processSemanticTags(["Network", "Bounded"], styleConfig);
      expect(result.label).toBe("NB"); // First characters of Network and Bounded
    });

    it("should combine original label with tag labels", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          test: {
            Network: { "line-width": 2 },
          },
        },
      };

      const result = processSemanticTags(
        ["Network"],
        styleConfig,
        "Original Label",
      );
      expect(result.label).toBe("Original Label [N]");
    });

    it("should handle node styling differently from edge styling", () => {
      const styleConfig: StyleConfig = {
        semanticMappings: {
          importance: {
            Critical: { "line-width": 3, halo: "light-red" },
          },
        },
      };

      const edgeResult = processSemanticTags(
        ["Critical"],
        styleConfig,
        undefined,
        "edge",
      );
      expect(edgeResult.style).toHaveProperty("strokeWidth", 3);
      expect(edgeResult.style).toHaveProperty("haloColor");

      const nodeResult = processSemanticTags(
        ["Critical"],
        styleConfig,
        undefined,
        "node",
      );
      expect(nodeResult.style).toHaveProperty("haloColor");
      expect(nodeResult.style).not.toHaveProperty("stroke");
    });

    it("should handle property mappings (legacy support)", () => {
      const styleConfig: StyleConfig = {
        propertyMappings: {
          Network: {
            style: { strokeWidth: 2, stroke: "#blue" },
            animated: true,
            label: "N",
          },
          Bounded: "bounded-class",
        },
      };

      const result = processSemanticTags(["Network", "Bounded"], styleConfig);

      expect(result.style).toMatchObject({
        strokeWidth: 2,
        stroke: "#blue",
        className: "bounded-class",
      });
      expect(result.animated).toBe(true);
      expect(result.appliedTags).toEqual(["Network", "Bounded"]);
    });
  });

  describe("validateSemanticMappings", () => {
    it("should return no errors for valid mappings", () => {
      const semanticMappings = {
        ordering: {
          TotalOrder: { "line-pattern": "solid" },
          NoOrder: { "line-pattern": "dashed" },
        },
        bounds: {
          Bounded: { "line-width": 1 },
          Unbounded: { "line-width": 3 },
        },
      };

      const errors = validateSemanticMappings(semanticMappings);
      expect(errors).toEqual([]);
    });

    it("should detect conflicts when same style property used in multiple groups", () => {
      const semanticMappings = {
        group1: {
          Option1: { "line-width": 1 },
        },
        group2: {
          Option2: { "line-width": 2 }, // Conflict: line-width used in both groups
        },
      };

      const errors = validateSemanticMappings(semanticMappings);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("line-width");
      expect(errors[0]).toContain("group1");
      expect(errors[0]).toContain("group2");
    });

    it("should allow same style property with different values in same group", () => {
      const semanticMappings = {
        thickness: {
          Thin: { "line-width": 1 },
          Thick: { "line-width": 3 }, // OK: same group, different values
        },
      };

      const errors = validateSemanticMappings(semanticMappings);
      expect(errors).toEqual([]);
    });

    it("should detect multiple conflicts", () => {
      const semanticMappings = {
        group1: {
          Option1: { "line-width": 1, animation: "static" },
        },
        group2: {
          Option2: { "line-width": 2, animation: "animated" }, // Two conflicts
        },
      };

      const errors = validateSemanticMappings(semanticMappings);
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.includes("line-width"))).toBe(true);
      expect(errors.some((e) => e.includes("animation"))).toBe(true);
    });
  });

  describe("VISUAL_CHANNELS", () => {
    it("should define all expected visual channels", () => {
      expect(VISUAL_CHANNELS).toHaveProperty("line-pattern");
      expect(VISUAL_CHANNELS).toHaveProperty("line-width");
      expect(VISUAL_CHANNELS).toHaveProperty("animation");
      expect(VISUAL_CHANNELS).toHaveProperty("line-style");
      expect(VISUAL_CHANNELS).toHaveProperty("halo");
      expect(VISUAL_CHANNELS).toHaveProperty("arrowhead");
      expect(VISUAL_CHANNELS).toHaveProperty("waviness");
    });

    it("should have correct options for each channel", () => {
      expect(VISUAL_CHANNELS["line-pattern"]).toEqual([
        "solid",
        "dashed",
        "dotted",
        "dash-dot",
      ]);
      expect(VISUAL_CHANNELS["line-width"]).toEqual([2, 3, 4, 5]); // Updated range for better visibility
      expect(VISUAL_CHANNELS["animation"]).toEqual(["static", "animated"]);
      expect(VISUAL_CHANNELS["line-style"]).toEqual([
        "single",
        "double",
        "hash-marks",
      ]);
      expect(VISUAL_CHANNELS["halo"]).toEqual([
        "none",
        "light-blue",
        "light-red",
        "light-green",
      ]);
      expect(VISUAL_CHANNELS["arrowhead"]).toEqual([
        "none",
        "triangle-open",
        "triangle-filled",
        "circle-filled",
        "diamond-open",
      ]);
      expect(VISUAL_CHANNELS["waviness"]).toEqual(["none", "wavy"]);
    });
  });

  describe("DEFAULT_STYLE", () => {
    it("should define default style constants", () => {
      expect(DEFAULT_STYLE.STROKE_COLOR).toBe("#666666");
      expect(DEFAULT_STYLE.STROKE_WIDTH).toBe(2);
      expect(DEFAULT_STYLE.DEFAULT_STROKE_COLOR).toBe("#999999");
    });
  });

  describe("HALO_COLOR_MAPPINGS", () => {
    it("should define halo color mappings", () => {
      expect(HALO_COLOR_MAPPINGS["light-blue"]).toBe("#4a90e2");
      expect(HALO_COLOR_MAPPINGS["light-red"]).toBe("#e74c3c");
      expect(HALO_COLOR_MAPPINGS["light-green"]).toBe("#27ae60");
    });
  });
});
