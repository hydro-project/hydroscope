/**
 * Test for AsyncCoordinator pipeline sequencing
 * Verifies: ELK → State Update → ReactFlow Render
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestNode } from "../utils/testData.js";

describe("AsyncCoordinator Pipeline Sequencing", () => {
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "layered",
      direction: "DOWN",
    });
    asyncCoordinator = new AsyncCoordinator();
  });

  it("should have queueLayoutAndRenderPipeline method", () => {
    expect(asyncCoordinator.queueLayoutAndRenderPipeline).toBeDefined();
    expect(typeof asyncCoordinator.queueLayoutAndRenderPipeline).toBe(
      "function",
    );
  });

  it("should execute complete layout and render pipeline", async () => {
    // Setup simple test data
    const node1 = createTestNode("n1", "Node 1");
    const node2 = createTestNode("n2", "Node 2");

    state.addNode(node1);
    state.addNode(node2);

    // Execute complete pipeline - should not throw
    const result = await asyncCoordinator.queueLayoutAndRenderPipeline(
      state,
      elkBridge,
      { timeout: 5000 },
    );

    // Verify result is returned
    expect(result).toBeDefined();

    // Verify layout phase progressed
    expect(state.getLayoutState().phase).toBe("displayed");
  });

  it("should ensure ELK completes before ReactFlow render", async () => {
    const node = createTestNode("n1", "Node 1");
    state.addNode(node);

    // Track operation order
    const operationOrder: string[] = [];

    // Mock the operations to track order
    const originalQueueELKLayout =
      asyncCoordinator.queueELKLayout.bind(asyncCoordinator);
    const originalQueueReactFlowRender =
      asyncCoordinator.queueReactFlowRender.bind(asyncCoordinator);

    asyncCoordinator.queueELKLayout = async (state, elkBridge, options) => {
      operationOrder.push("ELK_START");
      const result = await originalQueueELKLayout(state, elkBridge, options);
      operationOrder.push("ELK_COMPLETE");
      return result;
    };

    asyncCoordinator.queueReactFlowRender = async (state, options) => {
      operationOrder.push("REACTFLOW_START");
      const result = await originalQueueReactFlowRender(state, options);
      operationOrder.push("REACTFLOW_COMPLETE");
      return result;
    };

    // Execute pipeline
    await asyncCoordinator.queueLayoutAndRenderPipeline(state, elkBridge);

    // Verify correct order
    expect(operationOrder).toEqual([
      "ELK_START",
      "ELK_COMPLETE",
      "REACTFLOW_START",
      "REACTFLOW_COMPLETE",
    ]);
  });
});
