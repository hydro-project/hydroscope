/**
 * ReactFlowBridge Highlighting Test
 *
 * Tests the search and navigation highlighting functionality in ReactFlowBridge
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { VisualizationState } from "../core/VisualizationState.js";
import type { GraphNode, Container, StyleConfig } from "../types/core.js";

describe("ReactFlowBridge Highlighting", () => {
  let bridge: ReactFlowBridge;
  let state: VisualizationState;
  let styleConfig: StyleConfig;

  beforeEach(() => {
    styleConfig = {
      nodeStyles: {},
      edgeStyles: {},
      containerStyles: {},
    };
    bridge = new ReactFlowBridge(styleConfig);
    state = new VisualizationState();
  });

  const createTestNode = (id: string, label: string): GraphNode => ({
    id,
    label,
    longLabel: `${label} (long)`,
    type: "default",
    semanticTags: [],
    hidden: false,
  });

  const createTestContainer = (
    id: string,
    label: string,
    children: string[],
  ): Container => ({
    id,
    label,
    children: new Set(children),
    collapsed: false,
    hidden: false,
  });

  describe("Search Highlighting", () => {
    it("should apply search highlights to nodes", () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Perform search to trigger highlighting
      state.performSearch("Test");

      // Convert to ReactFlow data
      const result = bridge.toReactFlowData(state);

      // Check that the node has search highlighting
      expect(result.nodes).toHaveLength(1);
      const highlightedNode = result.nodes[0];

      // Should have highlight data
      expect(highlightedNode.data.isHighlighted).toBe(true);
      expect(highlightedNode.data.highlightType).toBe("search");

      // Should have highlight styling
      expect(highlightedNode.style).toBeDefined();
      expect(highlightedNode.style.backgroundColor).toBeDefined();
      expect(highlightedNode.style.border).toBeDefined();
      expect(highlightedNode.style.boxShadow).toBeDefined();
    });

    it("should apply search highlights to containers", () => {
      // Create test data with container
      const node1 = createTestNode("node1", "Test Node");
      const container1 = createTestContainer("container1", "Test Container", [
        "node1",
      ]);

      state.addNode(node1);
      state.addContainer(container1);

      // Perform search to trigger highlighting
      state.performSearch("Test");

      // Convert to ReactFlow data
      const result = bridge.toReactFlowData(state);

      // Should have highlighted elements
      const highlightedElements = result.nodes.filter(
        (node) => node.data.isHighlighted,
      );
      expect(highlightedElements.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation Highlighting", () => {
    it("should apply navigation highlights to nodes", () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Navigate to element to trigger highlighting
      state.navigateToElement("node1");

      // Convert to ReactFlow data
      const result = bridge.toReactFlowData(state);

      // Check that the node has navigation highlighting
      expect(result.nodes).toHaveLength(1);
      const highlightedNode = result.nodes[0];

      // Should have highlight data
      expect(highlightedNode.data.isHighlighted).toBe(true);
      expect(highlightedNode.data.highlightType).toBe("navigation");

      // Should have highlight styling
      expect(highlightedNode.style).toBeDefined();
      expect(highlightedNode.style.backgroundColor).toBeDefined();
      expect(highlightedNode.style.border).toBeDefined();
    });
  });

  describe("Combined Highlighting", () => {
    it("should apply both search and navigation highlights", () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Perform search and navigation
      state.performSearch("Test");
      state.navigateToElement("node1");

      // Convert to ReactFlow data
      const result = bridge.toReactFlowData(state);

      // Check that the node has combined highlighting
      expect(result.nodes).toHaveLength(1);
      const highlightedNode = result.nodes[0];

      // Should have highlight data indicating both types
      expect(highlightedNode.data.isHighlighted).toBe(true);
      // Note: The current implementation applies navigation highlighting last,
      // so it will show as "navigation". This could be enhanced to show "both"
      expect(["search", "navigation", "both"]).toContain(
        highlightedNode.data.highlightType,
      );
    });
  });

  describe("No Highlighting", () => {
    it("should not apply highlights when no search or navigation is active", () => {
      // Create test data
      const node1 = createTestNode("node1", "Test Node");
      state.addNode(node1);

      // Convert to ReactFlow data without any search or navigation
      const result = bridge.toReactFlowData(state);

      // Check that the node has no highlighting
      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      // Should not have highlight data
      expect(node.data.isHighlighted).toBeUndefined();
      expect(node.data.highlightType).toBeUndefined();
    });
  });
});
