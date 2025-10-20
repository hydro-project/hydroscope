/**
 * Test suite for container expansion with AutoFit viewport focusing
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

describe("Container Expansion with AutoFit", () => {
  let coordinator: AsyncCoordinator;
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let mockReactFlowInstance: any;

  beforeEach(() => {
    state = new VisualizationState();
    coordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});

    // Set bridge instances
    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Mock ReactFlow instance with setCenter for viewport focusing
    mockReactFlowInstance = {
      getNode: vi.fn((id: string) => ({
        id,
        position: { x: 100, y: 100 },
        width: 200,
        height: 100,
        parentNode: undefined,
      })),
      setCenter: vi.fn(
        (
          x: number,
          y: number,
          options?: { zoom?: number; duration?: number },
        ) => {
          // Immediate positioning (duration: 0) - no animation to wait for
          // This matches the production behavior where we use immediate: true
        },
      ),
      fitView: vi.fn(),
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    };

    coordinator.setReactFlowInstance(mockReactFlowInstance);

    // Mock render completion - in tests, we need to manually trigger this
    // The coordinator calls waitForNextRender() which enqueues a callback
    // We need to simulate React completing the render by calling notifyRenderComplete()
    // This should happen AFTER the callback is enqueued, not immediately
    const originalEnqueuePostRenderCallback =
      coordinator["enqueuePostRenderCallback"].bind(coordinator);
    coordinator["enqueuePostRenderCallback"] = (
      callback: () => void | Promise<void>,
    ) => {
      originalEnqueuePostRenderCallback(callback);
      // Defer render completion to next microtask to ensure callback is enqueued first
      queueMicrotask(() => {
        // Check if there are pending callbacks before notifying
        if (coordinator.hasPendingCallbacks()) {
          coordinator.notifyRenderComplete();
        }
      });
    };
  });

  it(
    "should focus viewport on container when expanding in AutoFit mode",
    { timeout: 3000 },
    async () => {
      // Add test nodes
      state.addNode({
        id: "node1",
        label: "Node 1",
        longLabel: "Node 1",
        type: "default",
        semanticTags: [],
        hidden: true, // Hidden because container is collapsed
      });

      state.addNode({
        id: "node2",
        label: "Node 2",
        longLabel: "Node 2",
        type: "default",
        semanticTags: [],
        hidden: true,
      });

      // Add collapsed container
      state.addContainer({
        id: "container1",
        label: "Container 1",
        longLabel: "Container 1",
        children: new Set(["node1", "node2"]),
        collapsed: true,
        hidden: false,
      });

      // Enable AutoFit mode (default is true)
      state.updateRenderConfig({ fitView: true });

      // Expand the container
      await coordinator.expandContainer("container1", state, {
        fitView: false, // Don't use fitView, we want to test viewport focusing
      });

      // Verify setCenter was called to focus on the container
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
    },
  );

  it("should NOT focus viewport when AutoFit mode is disabled", async () => {
    // Add test nodes
    state.addNode({
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1",
      type: "default",
      semanticTags: [],
      hidden: true,
    });

    // Add collapsed container
    state.addContainer({
      id: "container1",
      label: "Container 1",
      longLabel: "Container 1",
      children: new Set(["node1"]),
      collapsed: true,
      hidden: false,
    });

    // Disable AutoFit mode
    state.updateRenderConfig({ fitView: false });

    // Clear any previous calls
    mockReactFlowInstance.setCenter.mockClear();

    // Expand the container
    await coordinator.expandContainer("container1", state, {
      fitView: false,
    });

    // Verify setCenter was NOT called when AutoFit is disabled
    expect(mockReactFlowInstance.setCenter).not.toHaveBeenCalled();
  });

  it(
    "should handle viewport focus errors gracefully",
    { timeout: 3000 },
    async () => {
      // Add test node
      state.addNode({
        id: "node1",
        label: "Node 1",
        longLabel: "Node 1",
        type: "default",
        semanticTags: [],
        hidden: true,
      });

      // Add collapsed container
      state.addContainer({
        id: "container1",
        label: "Container 1",
        longLabel: "Container 1",
        children: new Set(["node1"]),
        collapsed: true,
        hidden: false,
      });

      state.updateRenderConfig({ fitView: true });

      // Make setCenter throw an error
      mockReactFlowInstance.setCenter.mockImplementation(() => {
        throw new Error("Viewport focus failed");
      });

      // Expansion should still succeed even if viewport focus fails
      await expect(
        coordinator.expandContainer("container1", state, { fitView: false }),
      ).resolves.toBeDefined();

      // Container should still be expanded
      const container = state.getContainer("container1");
      expect(container?.collapsed).toBe(false);
    },
  );

  // NOTE: Custom duration test removed because we now use immediate positioning (duration: 0)
  // for reliability. Animated viewport transitions were causing race conditions with the queue system.

  it(
    "should focus viewport on container when collapsing in AutoFit mode",
    { timeout: 3000 },
    async () => {
      // Add test nodes
      state.addNode({
        id: "node1",
        label: "Node 1",
        longLabel: "Node 1",
        type: "default",
        semanticTags: [],
        hidden: false, // Visible because container is expanded
      });

      // Add expanded container
      state.addContainer({
        id: "container1",
        label: "Container 1",
        longLabel: "Container 1",
        children: new Set(["node1"]),
        collapsed: false,
        hidden: false,
      });

      // Enable AutoFit mode
      state.updateRenderConfig({ fitView: true });

      // Clear any previous calls
      mockReactFlowInstance.setCenter.mockClear();

      // Collapse the container
      await coordinator.collapseContainer("container1", state, {
        fitView: false, // Don't use fitView, we want to test viewport focusing
      });

      // Verify setCenter was called to focus on the container
      expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
    },
  );

  it("should NOT focus viewport when collapsing with AutoFit disabled", async () => {
    // Add test node
    state.addNode({
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    // Add expanded container
    state.addContainer({
      id: "container1",
      label: "Container 1",
      longLabel: "Container 1",
      children: new Set(["node1"]),
      collapsed: false,
      hidden: false,
    });

    // Disable AutoFit mode
    state.updateRenderConfig({ fitView: false });

    // Clear any previous calls
    mockReactFlowInstance.setCenter.mockClear();

    // Collapse the container
    await coordinator.collapseContainer("container1", state, {
      fitView: false,
    });

    // Verify setCenter was NOT called when AutoFit is disabled
    expect(mockReactFlowInstance.setCenter).not.toHaveBeenCalled();
  });
});
