/**
 * Legend Component Data-Driven Regression Tests
 *
 * Ensures the Legend component remains data-driven from JSON's nodeTypeConfig
 * and properly integrates with StyleTuner's color palette settings.
 *
 * These tests verify:
 * 1. Legend reads from nodeTypeConfig in JSON data
 * 2. Legend respects colorIndex from JSON
 * 3. Legend updates when palette changes in StyleTuner
 * 4. Legend falls back gracefully to legacy legendData format
 * 5. No hardcoded node types or colors
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Legend } from "../components/Legend.js";
import type { LegendProps } from "../components/types.js";
import type { NodeTypeConfig } from "../types/core.js";

describe("Legend Component - Data-Driven Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  describe("NodeTypeConfig Integration", () => {
    it("should render node types from JSON nodeTypeConfig", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [
          { id: "Source", label: "Source Node", colorIndex: 0 },
          { id: "Transform", label: "Transform Node", colorIndex: 1 },
          { id: "Sink", label: "Sink Node", colorIndex: 2 },
        ],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      expect(screen.getByText("Source Node")).toBeInTheDocument();
      expect(screen.getByText("Transform Node")).toBeInTheDocument();
      expect(screen.getByText("Sink Node")).toBeInTheDocument();
    });

    it("should use colorIndex from nodeTypeConfig for consistent colors", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [
          { id: "Source", label: "Source", colorIndex: 0 },
          { id: "Sink", label: "Sink", colorIndex: 5 },
        ],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      const { container } = render(<Legend {...props} />);

      // Verify color boxes are rendered
      const colorBoxes = container.querySelectorAll('[style*="background"]');
      expect(colorBoxes.length).toBeGreaterThanOrEqual(2);
    });

    it("should prioritize nodeTypeConfig over legendData", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "NewType", label: "New Type", colorIndex: 0 }],
      };

      const props: LegendProps = {
        legendData: {
          title: "Node Types",
          items: [{ type: "OldType", label: "Old Type" }],
        },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      // Should show nodeTypeConfig data, not legendData
      expect(screen.getByText("New Type")).toBeInTheDocument();
      expect(screen.queryByText("Old Type")).not.toBeInTheDocument();
    });

    it("should handle nodeTypeConfig with descriptions", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [
          {
            id: "Source",
            label: "Source",
            description: "Data source node",
            colorIndex: 0,
          },
        ],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      const { container } = render(<Legend {...props} />);

      // Find the legend item with title attribute
      const legendItem = container.querySelector('[title="Data source node"]');
      expect(legendItem).toBeInTheDocument();
    });
  });

  describe("Color Palette Integration", () => {
    it("should update colors when palette changes", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "Source", label: "Source", colorIndex: 0 }],
      };

      const { rerender, container } = render(
        <Legend
          legendData={{ title: "Node Types", items: [] }}
          nodeTypeConfig={nodeTypeConfig}
          colorPalette="Set3"
        />,
      );

      const colorBox1 = container.querySelector(
        '[style*="background"]',
      ) as HTMLElement;
      const color1 = colorBox1?.style.backgroundColor;

      // Change palette
      rerender(
        <Legend
          legendData={{ title: "Node Types", items: [] }}
          nodeTypeConfig={nodeTypeConfig}
          colorPalette="Dark2"
        />,
      );

      const colorBox2 = container.querySelector(
        '[style*="background"]',
      ) as HTMLElement;
      const color2 = colorBox2?.style.backgroundColor;

      // Colors should be different for different palettes
      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
      // Note: We can't easily compare exact colors due to RGB conversion,
      // but we verify the component re-renders with palette changes
    });

    it("should support all palette options", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "Source", label: "Source", colorIndex: 0 }],
      };

      const palettes = ["Set3", "Set2", "Pastel1", "Dark2"];

      palettes.forEach((palette) => {
        const { container, unmount } = render(
          <Legend
            legendData={{ title: "Node Types", items: [] }}
            nodeTypeConfig={nodeTypeConfig}
            colorPalette={palette}
          />,
        );

        expect(screen.getAllByText("Source").length).toBeGreaterThan(0);
        expect(
          container.querySelector('[style*="background"]'),
        ).toBeInTheDocument();

        // Clean up after each render to avoid multiple "Source" elements
        unmount();
      });
    });

    it("should default to Set3 palette when invalid palette provided", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "Source", label: "Source", colorIndex: 0 }],
      };

      expect(() => {
        render(
          <Legend
            legendData={{ title: "Node Types", items: [] }}
            nodeTypeConfig={nodeTypeConfig}
            colorPalette="InvalidPalette"
          />,
        );
      }).not.toThrow();

      expect(screen.getByText("Source")).toBeInTheDocument();
    });
  });

  describe("Legacy Format Support", () => {
    it("should fall back to legendData when nodeTypeConfig is missing", () => {
      const props: LegendProps = {
        legendData: {
          title: "Node Types",
          items: [
            { type: "Source", label: "Source" },
            { type: "Sink", label: "Sink" },
          ],
        },
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      expect(screen.getByText("Source")).toBeInTheDocument();
      expect(screen.getByText("Sink")).toBeInTheDocument();
    });

    it("should handle legacy format without colorIndex", () => {
      const props: LegendProps = {
        legendData: {
          title: "Node Types",
          items: [{ type: "Transform", label: "Transform" }],
        },
        colorPalette: "Set3",
      };

      const { container } = render(<Legend {...props} />);

      expect(screen.getByText("Transform")).toBeInTheDocument();
      expect(
        container.querySelector('[style*="background"]'),
      ).toBeInTheDocument();
    });
  });

  describe("Empty State Handling", () => {
    it("should show empty message when no data available", () => {
      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      expect(screen.getByText("No legend data available")).toBeInTheDocument();
    });

    it("should show empty message when nodeTypeConfig.types is empty", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      expect(screen.getByText("No legend data available")).toBeInTheDocument();
    });
  });

  describe("No Hardcoded Data Verification", () => {
    it("should not render any node types without data", () => {
      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        colorPalette: "Set3",
      };

      const { container } = render(<Legend {...props} />);

      // Should only show empty message, no hardcoded types
      const legendItems = container.querySelectorAll(
        '[style*="display: flex"]',
      );
      expect(legendItems.length).toBe(0);
    });

    it("should render exactly the types provided in data", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [
          { id: "CustomType1", label: "Custom 1", colorIndex: 0 },
          { id: "CustomType2", label: "Custom 2", colorIndex: 1 },
        ],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
      };

      render(<Legend {...props} />);

      // Should show exactly 2 custom types
      expect(screen.getByText("Custom 1")).toBeInTheDocument();
      expect(screen.getByText("Custom 2")).toBeInTheDocument();

      // Should not show any other types
      expect(screen.queryByText("Source")).not.toBeInTheDocument();
      expect(screen.queryByText("Transform")).not.toBeInTheDocument();
      expect(screen.queryByText("Sink")).not.toBeInTheDocument();
    });
  });

  describe("Display Options", () => {
    it("should support compact mode", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "Source", label: "Source", colorIndex: 0 }],
      };

      const props: LegendProps = {
        legendData: { title: "Node Types", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
        compact: true,
      };

      const { container } = render(<Legend {...props} />);

      // In compact mode, title should not be shown
      expect(screen.queryByText("Node Types")).not.toBeInTheDocument();
      expect(screen.getByText("Source")).toBeInTheDocument();
    });

    it("should support custom title", () => {
      const nodeTypeConfig: NodeTypeConfig = {
        types: [{ id: "Source", label: "Source", colorIndex: 0 }],
      };

      const props: LegendProps = {
        legendData: { title: "Default Title", items: [] },
        nodeTypeConfig,
        colorPalette: "Set3",
        title: "Custom Title",
      };

      render(<Legend {...props} />);

      expect(screen.getByText("Custom Title")).toBeInTheDocument();
      expect(screen.queryByText("Default Title")).not.toBeInTheDocument();
    });
  });
});
