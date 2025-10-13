/**
 * AsyncCoordinator Basic Tests
 * Focused tests for the current AsyncCoordinator API
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import type { ApplicationEvent } from "../types/core.js";

describe("AsyncCoordinator - Basic API", () => {
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
    
    // Set bridge instances for the new architecture
    coordinator.setBridgeInstances(reactFlowBridge, elkBridge);

    // Add basic test data
    state.addNode({
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addNode({
      id: "node2",
      label: "Node 2",
      longLabel: "Node 2 Long Label",
      type: "default",
      semanticTags: [],
      hidden: false,
    });

    state.addEdge({
      id: "edge1",
      source: "node1",
      target: "node2",
      type: "default",
      semanticTags: [],
      hidden: false,
    });
  });

  describe("Queue System", () => {
    it("should create empty queue on initialization", () => {
      const status = coordinator.getQueueStatus();
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);
    });

    it("should queue and process basic operations", async () => {
      const results: string[] = [];

      const op1 = () =>
        Promise.resolve().then(() => {
          results.push("op1");
          return "result1";
        });

      const op2 = () =>
        Promise.resolve().then(() => {
          results.push("op2");
          return "result2";
        });

      coordinator.queueOperation("application_event", op1);
      coordinator.queueOperation("application_event", op2);

      await coordinator.processQueue();

      expect(results).toEqual(["op1", "op2"]);
      expect(coordinator.getQueueStatus().completed).toBe(2);
    });
  });

  describe("Layout and Render Pipeline", () => {
    it("should execute layout and render pipeline", async () => {
      const reactFlowData = await coordinator.executeLayoutAndRenderPipeline(state);

      // Verify pipeline returned ReactFlow data
      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();

      // Verify layout was applied to state
      const node1 = state.getGraphNode("node1");
      expect(node1?.position).toBeDefined();
      expect(typeof node1?.position?.x).toBe("number");
      expect(typeof node1?.position?.y).toBe("number");
    });
  });

  describe("Container Operations", () => {
    beforeEach(() => {
      // Add a container for testing
      state.addContainer({
        id: "container1",
        label: "Container 1",
        children: new Set(["node1"]),
        collapsed: false, // Start expanded so we can test both expand and collapse
        hidden: false,
      });
    });

    it("should expand all containers", async () => {
      const reactFlowData = await coordinator.expandAllContainers(state, elkBridge);

      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
    });

    it("should collapse all containers", async () => {
      const reactFlowData = await coordinator.collapseAllContainers(state, elkBridge);

      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
    });

    it("should expand specific container", async () => {
      const reactFlowData = await coordinator.expandContainer("container1", state, elkBridge);

      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
    });

    it("should collapse specific container", async () => {
      const reactFlowData = await coordinator.collapseContainer("container1", state, elkBridge);

      expect(reactFlowData).toBeDefined();
      expect(reactFlowData.nodes).toBeDefined();
      expect(reactFlowData.edges).toBeDefined();
    });
  });

  describe("Application Events", () => {
    it("should process container expand events", async () => {
      // Add a test container first
      state.addContainer({
        id: "container1",
        label: "Test Container",
        collapsed: true,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        children: new Set(),
        childNodes: [],
        childContainers: []
      });

      // Use new synchronous container method with correct parameters
      const result = await coordinator.expandContainer("container1", state, {
        relayoutEntities: ["container1"],
        fitView: false
      });

      // Test that the operation completed successfully
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it("should process search events", async () => {
      // Use new synchronous search method instead of deprecated processApplicationEventAndWait
      const result = await coordinator.updateSearchResults("test", state, {
        expandContainers: false,
        fitView: false
      });

      // Test that the operation completed successfully
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle operation failures gracefully", async () => {
      const failingOp = () => Promise.reject(new Error("Test error"));

      coordinator.queueOperation("application_event", failingOp);
      await coordinator.processQueue();

      const status = coordinator.getQueueStatus();
      expect(status.failed).toBe(1);
      expect(status.errors).toHaveLength(1);
      expect(status.errors[0].message).toBe("Test error");
    });

    it("should retry failed operations", async () => {
      let attemptCount = 0;
      const flakyOp = () => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve("success");
      };

      coordinator.queueOperation("application_event", flakyOp, {
        maxRetries: 2,
      });
      await coordinator.processQueue();

      expect(attemptCount).toBe(2);
      const status = coordinator.getQueueStatus();
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
    });
  });
});
