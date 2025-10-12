/**
 * Test AsyncCoordinator operations with detailed logging
 * This will help us see what's failing in the pipeline
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("AsyncCoordinator Debug", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();

    // Create test data with collapsed containers
    const nodes = [
      {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n2",
        label: "Node 2",
        longLabel: "Node 2",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "n3",
        label: "Node 3",
        longLabel: "Node 3",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
    ];

    const edges = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "e2",
        source: "n2",
        target: "n3",
        type: "edge",
        semanticTags: [],
        hidden: false,
      },
    ];

    const containers = [
      {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        collapsed: true,
        hidden: false,
      },
    ];

    // Add all data to state
    for (const node of nodes) {
      state.addNode(node);
    }
    for (const container of containers) {
      state.addContainer(container);
    }
    for (const edge of edges) {
      state.addEdge(edge);
    }
  });

  describe("Container Operations Through AsyncCoordinator", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should expand container through AsyncCoordinator", () => {
      console.log("[AsyncDebug] 🚀 Starting container expand test");

      // Get initial state
      const initialContainer = state.visibleContainers.find(
        (c) => c.id === "c1",
      );
      expect(initialContainer?.collapsed).toBe(true);

      // Expand through direct state operation
      state._expandContainerForCoordinator("c1");

      // Check final state
      const finalContainer = state.visibleContainers.find((c) => c.id === "c1");
      expect(finalContainer?.collapsed).toBe(false);

      console.log("[AsyncDebug] ✅ Container expand test completed");
    });

    it("should collapse container through AsyncCoordinator", () => {
      console.log("[AsyncDebug] 🚀 Starting container collapse test");

      // First expand the container
      state._expandContainerForCoordinator("c1");
      expect(
        state.visibleContainers.find((c) => c.id === "c1")?.collapsed,
      ).toBe(false);

      // Collapse through direct state operation
      state.collapseContainerSystemOperation("c1");

      // Check final state
      const finalContainer = state.visibleContainers.find((c) => c.id === "c1");
      expect(finalContainer?.collapsed).toBe(true);

      console.log("[AsyncDebug] ✅ Container collapse test completed");
    });

    it("should handle expand/collapse cycle through AsyncCoordinator", () => {
      console.log("[AsyncDebug] 🚀 Starting expand/collapse cycle test");

      // Initial state - collapsed
      expect(
        state.visibleContainers.find((c) => c.id === "c1")?.collapsed,
      ).toBe(true);

      // Expand through direct state operation
      state._expandContainerForCoordinator("c1");
      expect(
        state.visibleContainers.find((c) => c.id === "c1")?.collapsed,
      ).toBe(false);

      // Collapse through direct state operation
      state.collapseContainerSystemOperation("c1");
      expect(
        state.visibleContainers.find((c) => c.id === "c1")?.collapsed,
      ).toBe(true);

      console.log("[AsyncDebug] ✅ Expand/collapse cycle test completed");
    });

    it("should handle ReactFlow render operations", async () => {
      console.log("[AsyncDebug] 🚀 Starting ReactFlow render test");

      try {
        const reactFlowData = await coordinator.queueReactFlowRender(state);
        expect(reactFlowData).toBeDefined();
        console.log(
          "[AsyncDebug] ✅ ReactFlow render test completed successfully",
        );
      } catch (error) {
        console.error("[AsyncDebug] ❌ ReactFlow render test failed:", error);
        throw error;
      }
    });

    it("should show queue status and errors", () => {
      console.log("[AsyncDebug] 🚀 Starting queue status test");

      // Get initial status
      const initialStatus = coordinator.getQueueStatus();
      console.log("[AsyncDebug] 📊 Initial queue status:", initialStatus);

      // Perform some operations
      state._expandContainerForCoordinator("c1");
      state.collapseContainerSystemOperation("c1");

      // Get final status
      const finalStatus = coordinator.getQueueStatus();
      console.log("[AsyncDebug] 📊 Final queue status:", finalStatus);

      // Check for errors
      if (finalStatus.errors.length > 0) {
        console.error(
          "[AsyncDebug] ❌ Found errors in queue:",
          finalStatus.errors,
        );
      }

      console.log("[AsyncDebug] ✅ Queue status test completed");
    });
  });
});
