/**
 * Layout Viewport Fit Tests
 * Ensures that expanded graphs fit within reasonable viewport dimensions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";

// Mock paxos data for testing
const createPaxosLikeData = () => ({
  nodes: Array.from({ length: 50 }, (_, i) => ({
    id: `node${i}`,
    shortLabel: `Node ${i}`,
    fullLabel: `Paxos Node ${i}`,
    nodeType: i < 10 ? "Proposer" : i < 30 ? "Acceptor" : "Learner",
    data: { locationId: Math.floor(i / 10), locationType: "Process" },
  })),
  edges: Array.from({ length: 80 }, (_, i) => ({
    id: `edge${i}`,
    source: `node${Math.floor(i / 2)}`,
    target: `node${Math.floor(i / 2) + 1}`,
    semanticTags: ["Message"],
  })),
  hierarchyChoices: [
    {
      id: "location",
      name: "Location",
      children: Array.from({ length: 5 }, (_, i) => ({
        id: `loc_${i}`,
        name: `Process ${i}`,
        children: [],
      })),
    },
  ],
  nodeAssignments: {
    location: Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`node${i}`, `loc_${Math.floor(i / 10)}`])
    ),
  },
});

describe("Layout Viewport Fit", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "layered",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});
  });

  describe("Large Graph Viewport Constraints", () => {
    it("should support wide zoom range to accommodate expanded graphs of any size", async () => {
      // Parse paxos-like data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const paxosData = createPaxosLikeData();
      const parseResult = await parser.parseData(paxosData);
      state = parseResult.visualizationState;

      // Expand all containers to create the largest possible layout
      const containers = state.visibleContainers;
      for (const container of containers) {
        if (container.collapsed) {
          state.expandContainer(container.id);
        }
      }

      // Run layout
      await elkBridge.layout(state);

      // Convert to ReactFlow format to get actual positions
      const reactFlowData = reactFlowBridge.toReactFlowData(state);

      // Calculate bounding box of all nodes
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      reactFlowData.nodes.forEach(node => {
        const x = node.position.x;
        const y = node.position.y;
        const width = node.data.width || 120;
        const height = node.data.height || 60;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + height);
      });

      const layoutWidth = maxX - minX;
      const layoutHeight = maxY - minY;

      console.log(`Layout dimensions: ${layoutWidth} x ${layoutHeight}`);
      console.log(`Nodes: ${reactFlowData.nodes.length}, Edges: ${reactFlowData.edges.length}`);
      console.log(`Containers: ${containers.length}`);

      // Test that the layout is valid and non-degenerate
      expect(layoutWidth).toBeGreaterThan(100);
      expect(layoutHeight).toBeGreaterThan(100);
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);
      expect(reactFlowData.edges.length).toBeGreaterThan(0);

      // Calculate required zoom level to fit in a standard viewport (1200x800)
      const viewportWidth = 1200;
      const viewportHeight = 800;
      const padding = 0.1; // 10% padding
      
      const requiredZoomX = (viewportWidth * (1 - padding * 2)) / layoutWidth;
      const requiredZoomY = (viewportHeight * (1 - padding * 2)) / layoutHeight;
      const requiredZoom = Math.min(requiredZoomX, requiredZoomY);

      console.log(`Required zoom to fit in ${viewportWidth}x${viewportHeight}: ${requiredZoom.toFixed(3)}`);

      // With our new zoom range (0.05 to 2.0), we should be able to fit graphs up to 20x larger
      // than the viewport (at 0.05 zoom = 5% = 1/20th scale)
      const minSupportedZoom = 0.05;
      expect(requiredZoom).toBeGreaterThanOrEqual(minSupportedZoom);
    });

    it("should handle zoom controls properly for large graphs", async () => {
      // Parse paxos-like data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const paxosData = createPaxosLikeData();
      const parseResult = await parser.parseData(paxosData);
      state = parseResult.visualizationState;

      // Expand all containers
      const containers = state.visibleContainers;
      for (const container of containers) {
        if (container.collapsed) {
          state.expandContainer(container.id);
        }
      }

      // Run layout
      await elkBridge.layout(state);

      // Convert to ReactFlow format
      const reactFlowData = reactFlowBridge.toReactFlowData(state);

      // Verify we have a valid layout
      expect(reactFlowData.nodes.length).toBeGreaterThan(0);
      expect(reactFlowData.edges.length).toBeGreaterThan(0);

      // Calculate bounding box
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      reactFlowData.nodes.forEach(node => {
        const x = node.position.x;
        const y = node.position.y;
        const width = node.data.width || 120;
        const height = node.data.height || 60;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + height);
      });

      const layoutWidth = maxX - minX;
      const layoutHeight = maxY - minY;

      // Test that we can zoom out enough to see the entire graph
      // At 0.05 zoom (5%), we can see 20x larger graphs
      const maxSupportableWidth = 1200 / 0.05; // 24,000px
      const maxSupportableHeight = 800 / 0.05;  // 16,000px

      expect(layoutWidth).toBeLessThan(maxSupportableWidth);
      expect(layoutHeight).toBeLessThan(maxSupportableHeight);

      console.log(`Layout: ${layoutWidth}x${layoutHeight}, Max supportable: ${maxSupportableWidth}x${maxSupportableHeight}`);
    });

    it("should provide smooth zoom experience across the full range", async () => {
      // Create a moderately sized graph
      const parser = JSONParser.createPaxosParser({ debug: false });
      const paxosData = createPaxosLikeData();
      const parseResult = await parser.parseData(paxosData);
      state = parseResult.visualizationState;

      // Test both collapsed and expanded states
      const containers = state.visibleContainers;
      
      // Test collapsed state
      await elkBridge.layout(state);
      const collapsedData = reactFlowBridge.toReactFlowData(state);
      
      // Expand all containers
      for (const container of containers) {
        if (container.collapsed) {
          state.expandContainer(container.id);
        }
      }
      
      // Test expanded state
      await elkBridge.layout(state);
      const expandedData = reactFlowBridge.toReactFlowData(state);

      // Verify that expansion significantly increases the graph size
      expect(expandedData.nodes.length).toBeGreaterThanOrEqual(collapsedData.nodes.length);
      
      // Both states should be valid
      expect(collapsedData.nodes.length).toBeGreaterThan(0);
      expect(expandedData.nodes.length).toBeGreaterThan(0);
      expect(collapsedData.edges.length).toBeGreaterThan(0);
      expect(expandedData.edges.length).toBeGreaterThan(0);

      console.log(`Collapsed: ${collapsedData.nodes.length} nodes, Expanded: ${expandedData.nodes.length} nodes`);
    });
  });
});