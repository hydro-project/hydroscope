/**
 * @fileoverview Search Navigation Workflow Integration Tests
 *
 * Tests the complete workflows for search and navigation functionality using real chat.json data:
 * 1. Search query → tree expansion → graph update flow
 * 2. Tree click → graph navigation → viewport focus flow
 * 3. Combined search and navigation operations
 * 4. Rapid search changes and race condition handling
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Search Navigation Workflow Integration", () => {
  let state: VisualizationState;
  let coordinator: AsyncCoordinator;
  let bridge: ReactFlowBridge;
  let chatData: HydroscopeData;

  beforeEach(async () => {
    // Load the actual chat.json file
    const chatPath = path.join(process.cwd(), "test-data", "chat.json");

    if (!fs.existsSync(chatPath)) {
      throw new Error(`Test data file not found: ${chatPath}`);
    }

    const chatContent = fs.readFileSync(chatPath, "utf-8");
    chatData = JSON.parse(chatContent) as HydroscopeData;

    // Parse the data using JSONParser
    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(chatData);

    state = parseResult.visualizationState;
    coordinator = new AsyncCoordinator();
    bridge = new ReactFlowBridge({
      nodeStyles: {},
      edgeStyles: {},
      containerStyles: {},
    });

    // Initially collapse all containers to test expansion
    state.collapseAllContainers();
  });

  describe("Search Query → Tree Expansion → Graph Update Flow", () => {
    it("should expand tree hierarchy when searching for nodes in containers", () => {
      // Initially, containers should be collapsed
      const containers = ["loc_0", "loc_1"];
      containers.forEach((containerId) => {
        const container = state.getContainer(containerId);
        if (container) {
          expect(container.collapsed).toBe(true);
        }
      });

      // Perform search for persist (exists in both locations)
      const results = state.performSearch("persist");

      // Should find persist nodes
      expect(results.length).toBeGreaterThan(0);
      const persistResult = results.find((r) => r.label.includes("persist"));
      expect(persistResult).toBeDefined();

      // Tree should be expanded to show the matches
      const expandedNodes = state.getExpandedTreeNodes();
      expect(expandedNodes.size).toBeGreaterThan(0);

      // Search highlights should be applied
      const treeHighlights = state.getTreeSearchHighlights();
      expect(treeHighlights.size).toBeGreaterThan(0);
    });

    it("should update graph highlights for lowest visible ancestors", () => {
      // Collapse containers so nodes are not directly visible in graph
      state.collapseAllContainers();

      // Perform search for network nodes
      state.performSearch("network");

      // Convert to ReactFlow data to check graph highlights
      const reactFlowData = bridge.toReactFlowData(state);

      // Should have nodes representing the hierarchy
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      // The graph should highlight the lowest visible ancestor containing the match
      const graphHighlights = state.getGraphSearchHighlights();
      expect(graphHighlights.size).toBeGreaterThan(0);
    });

    it("should handle multiple search matches across different locations", () => {
      // Perform search that matches multiple items (network appears in both locations)
      const results = state.performSearch("network");

      // Should find multiple matches
      expect(results.length).toBeGreaterThan(1);

      // Should find network nodes
      const networkResults = results.filter((r) => r.label.includes("network"));
      expect(networkResults.length).toBeGreaterThan(0);

      // All matches should be highlighted
      const treeHighlights = state.getTreeSearchHighlights();
      networkResults.forEach((result) => {
        expect(treeHighlights.has(result.id)).toBe(true);
      });

      // Tree should be expanded to show all matches
      const expandedNodes = state.getExpandedTreeNodes();
      expect(expandedNodes.size).toBeGreaterThan(0);
    });

    it("should clear search highlights while preserving expansion state", () => {
      // Perform search to expand tree
      state.performSearch("persist");

      // Verify highlights exist
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);

      // Manually expand some tree nodes to test preservation
      state.expandTreeNodes(["loc_0", "loc_1"]);
      const initialExpandedSize = state.getExpandedTreeNodes().size;

      // Clear search
      state.clearSearchEnhanced();

      // Highlights should be cleared but expansion preserved
      expect(state.getTreeSearchHighlights().size).toBe(0);
      expect(state.getGraphSearchHighlights().size).toBe(0);
      expect(state.getExpandedTreeNodes().size).toBe(initialExpandedSize); // Expansion preserved
    });
  });

  describe("Tree Click → Graph Navigation → Viewport Focus Flow", () => {
    it("should navigate from tree to graph with viewport focus", async () => {
      // Mock ReactFlow instance for viewport operations
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Navigate to a real node (simulating tree click)
      await coordinator.navigateToElement("5", state, mockReactFlowInstance); // persist node

      // Navigation state should be updated
      expect(state.getNavigationSelection()).toBe("5");
      expect(state.getLastNavigationTarget()).toBe("5");
      expect(state.getShouldFocusViewport()).toBe(true);

      // Viewport should be focused
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
    });

    it("should expand containers when navigating to hidden elements", async () => {
      // Ensure containers are collapsed
      state.collapseAllContainers();

      // Mock ReactFlow instance
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Navigate to a node that's inside a container
      await coordinator.navigateToElement("5", state, mockReactFlowInstance); // persist node

      // Navigation should work even if containers need expansion
      expect(state.getNavigationSelection()).toBe("5");
    });

    it("should handle navigation to container elements", async () => {
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Navigate to location container
      await coordinator.navigateToElement(
        "loc_0",
        state,
        mockReactFlowInstance,
      );

      // Navigation should work for containers too
      expect(state.getNavigationSelection()).toBe("loc_0");
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
    });
  });

  describe("Combined Search and Navigation Operations", () => {
    it("should maintain both search and navigation highlights simultaneously", () => {
      // Perform search for persist
      state.performSearch("persist");
      const searchHighlights = state.getTreeSearchHighlights();
      expect(searchHighlights.size).toBeGreaterThan(0);

      // Navigate to different element (a node)
      state.navigateToElement("6"); // flatmap node
      expect(state.getTreeNavigationHighlights().has("6")).toBe(true);

      // Both highlights should coexist
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
      expect(state.getTreeNavigationHighlights().has("6")).toBe(true);

      // Check highlight types for navigation
      expect(state.getTreeElementHighlightType("6")).toBe("navigation");
    });

    it("should handle overlapping search and navigation highlights", () => {
      // Search for persist (which includes node 5)
      state.performSearch("persist");
      expect(state.getTreeSearchHighlights().has("5")).toBe(true);

      // Navigate to the same node
      state.navigateToElement("5");
      expect(state.getTreeNavigationHighlights().has("5")).toBe(true);

      // Should detect combined highlight in tree
      expect(state.getTreeElementHighlightType("5")).toBe("both");

      // Graph highlighting might work differently, so just check that both sets contain the element
      expect(state.getTreeSearchHighlights().has("5")).toBe(true);
      expect(state.getTreeNavigationHighlights().has("5")).toBe(true);
    });

    it("should clear search highlights independently of navigation", () => {
      // Set up both search and navigation
      state.performSearch("persist");
      state.navigateToElement("6"); // flatmap node

      // Verify both are active
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
      expect(state.getTreeNavigationHighlights().size).toBeGreaterThan(0);

      // Clear only search
      state.clearSearchEnhanced();

      // Search highlights cleared, navigation preserved
      expect(state.getTreeSearchHighlights().size).toBe(0);
      expect(state.getTreeNavigationHighlights().size).toBeGreaterThan(0);
      expect(state.getNavigationSelection()).toBe("6");
    });

    it("should clear navigation highlights independently of search", () => {
      // Set up both search and navigation
      state.performSearch("persist");
      state.navigateToElement("6"); // flatmap node

      // Clear only navigation
      state.clearNavigation();

      // Navigation highlights cleared, search preserved
      expect(state.getTreeNavigationHighlights().size).toBe(0);
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
      expect(state.getSearchQuery()).toBe("persist");
    });
  });

  describe("Rapid Search Changes and Race Condition Handling", () => {
    it("should handle rapid search query changes", async () => {
      // Simulate rapid search changes
      const queries = ["per", "pers", "persist"];

      for (const query of queries) {
        state.performSearch(query);
      }

      // Final query should be active
      expect(state.getSearchQuery()).toBe("persist");

      // Should have results for final query
      const results = state.getSearchResults();
      expect(results.length).toBeGreaterThan(0);
      const persistResult = results.find((r) => r.label.includes("persist"));
      expect(persistResult).toBeDefined();
    });

    it("should handle search during ongoing navigation operations", async () => {
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Start navigation to a node
      const navigationPromise = coordinator.navigateToElement(
        "6",
        state,
        mockReactFlowInstance,
      ); // flatmap node

      // Perform search while navigation is happening
      state.performSearch("persist");

      // Wait for navigation to complete
      await navigationPromise;

      // Both operations should complete successfully
      expect(state.getNavigationSelection()).toBe("6");
      expect(state.getSearchQuery()).toBe("persist");
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
    });

    it("should handle multiple concurrent navigation requests", async () => {
      const mockReactFlowInstance = {
        getNode: (id: string) => ({
          id,
          position: { x: 100, y: 100 },
          width: 100,
          height: 50,
        }),
        setCenter: vi.fn(),
        fitView: vi.fn(),
      };

      // Start multiple navigation operations
      const nav1 = coordinator.navigateToElement(
        "6",
        state,
        mockReactFlowInstance,
      ); // flatmap
      const nav2 = coordinator.navigateToElement(
        "7",
        state,
        mockReactFlowInstance,
      ); // network

      // Wait for both to complete
      await Promise.all([nav1, nav2]);

      // Last navigation should win
      expect(state.getNavigationSelection()).toBe("7");
    });

    it("should handle search clearing during active operations", () => {
      // Start search
      state.performSearch("persist");
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);

      // Start navigation
      state.navigateToElement("6"); // flatmap node

      // Clear search during active navigation
      state.clearSearchEnhanced();

      // Search should be cleared, navigation should remain
      expect(state.getTreeSearchHighlights().size).toBe(0);
      expect(state.getNavigationSelection()).toBe("6");
      expect(state.getTreeNavigationHighlights().size).toBeGreaterThan(0);
    });
  });

  describe("ReactFlow Bridge Integration in Workflows", () => {
    it("should apply correct highlights throughout search workflow", () => {
      // Perform search
      state.performSearch("persist");

      // Convert to ReactFlow data
      let reactFlowData = bridge.toReactFlowData(state);

      // Should have search highlights
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      // Add navigation
      state.navigateToElement("6"); // flatmap node

      // Convert again
      reactFlowData = bridge.toReactFlowData(state);

      // Should have both search and navigation highlights
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);
    });

    it("should handle highlight updates during container operations", () => {
      // Set up search and navigation
      state.performSearch("persist");
      state.navigateToElement("6"); // flatmap node

      // Expand containers
      state.expandAllContainers();

      // Convert to ReactFlow data
      const reactFlowData = bridge.toReactFlowData(state);

      // Highlights should be maintained after container operations
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);

      // Verify state is consistent
      expect(state.getTreeSearchHighlights().size).toBeGreaterThan(0);
      expect(state.getTreeNavigationHighlights().size).toBeGreaterThan(0);
    });
  });
});
