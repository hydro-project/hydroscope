/**
 * Style Update Operations Tests
 *
 * Tests that verify:
 * - updateColorPalette queues operations correctly
 * - updateEdgeStyle queues operations correctly
 * - updateLayoutAlgorithm queues operations correctly
 * - toggleFullNodeLabels queues operations correctly
 * - All style operations execute sequentially without race conditions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("AsyncCoordinator - Style Update Operations", () => {
  let coordinator: AsyncCoordinator;
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});

    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Add minimal test data
    state.addNode({
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });
  });

  describe("updateColorPalette", () => {
    it("should update color palette through queue", async () => {
      // Initial palette (default is "Set3")
      const initialPalette = state.getColorPalette();
      expect(initialPalette).toBe("Set3");

      // Update palette
      await coordinator.updateColorPalette("dark", state, { fitView: false });

      // Verify palette was updated
      expect(state.getColorPalette()).toBe("dark");
    });

    it("should handle multiple palette updates sequentially", async () => {
      // Queue multiple updates
      const promises = [
        coordinator.updateColorPalette("dark", state, { fitView: false }),
        coordinator.updateColorPalette("light", state, { fitView: false }),
        coordinator.updateColorPalette("custom", state, { fitView: false }),
      ];

      // All should complete without errors
      await Promise.all(promises);

      // Final state should match last update
      expect(state.getColorPalette()).toBe("custom");
    });
  });

  describe("updateEdgeStyle", () => {
    it("should update edge style through queue", async () => {
      // Initial edge style
      expect(state.getEdgeStyle()).toBe("bezier");

      // Update edge style
      await coordinator.updateEdgeStyle("straight", state, { fitView: false });

      // Verify edge style was updated
      expect(state.getEdgeStyle()).toBe("straight");
    });

    it("should handle multiple edge style updates sequentially", async () => {
      // Queue multiple updates
      await coordinator.updateEdgeStyle("straight", state, { fitView: false });
      await coordinator.updateEdgeStyle("smoothstep", state, {
        fitView: false,
      });

      // Final state should match last update
      expect(state.getEdgeStyle()).toBe("smoothstep");
    });
  });

  describe("updateLayoutAlgorithm", () => {
    it("should update layout algorithm through queue", async () => {
      // Initial algorithm
      expect(state.getLayoutAlgorithm()).toBe("mrtree");

      // Update algorithm
      await coordinator.updateLayoutAlgorithm("layered", state, {
        fitView: false,
      });

      // Verify algorithm was updated
      expect(state.getLayoutAlgorithm()).toBe("layered");
    });
  });

  describe("toggleFullNodeLabels", () => {
    it("should toggle full node labels through queue", async () => {
      // Toggle on
      await coordinator.toggleFullNodeLabels(true, state, { fitView: false });

      // Verify render config was updated
      const config = state.getRenderConfig();
      expect(config.showFullNodeLabels).toBe(true);

      // Toggle off
      await coordinator.toggleFullNodeLabels(false, state, { fitView: false });

      // Verify render config was updated
      const config2 = state.getRenderConfig();
      expect(config2.showFullNodeLabels).toBe(false);
    });
  });

  describe("Concurrent Style Operations", () => {
    it("should handle concurrent style operations without race conditions", async () => {
      // Fire multiple style operations concurrently
      await Promise.all([
        coordinator.updateColorPalette("dark", state, { fitView: false }),
        coordinator.updateEdgeStyle("straight", state, { fitView: false }),
        coordinator.toggleFullNodeLabels(true, state, { fitView: false }),
      ]);

      // All operations should complete successfully
      expect(state.getColorPalette()).toBe("dark");
      expect(state.getEdgeStyle()).toBe("straight");
      expect(state.getRenderConfig().showFullNodeLabels).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when state is missing", async () => {
      await expect(
        coordinator.updateColorPalette("dark", null as any, { fitView: false }),
      ).rejects.toThrow("VisualizationState is required");
    });

    it("should throw error when state is undefined", async () => {
      await expect(
        coordinator.updateEdgeStyle("straight", undefined as any, {
          fitView: false,
        }),
      ).rejects.toThrow("VisualizationState is required");
    });
  });
});
