/**
 * Tests for InteractionHandler click event processing
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  InteractionHandler,
  type ClickEvent,
} from "../core/InteractionHandler.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { createTestContainer, createTestNode } from "../utils/testData.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("InteractionHandler Click Event Processing", () => {
  let coordinator: AsyncCoordinator;

  let handler: InteractionHandler;
  let state: VisualizationState;
  let mockAsyncCoordinator: any;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    coordinator = new AsyncCoordinator();
    state = new VisualizationState();
    mockAsyncCoordinator = {
      queueLayoutUpdate: vi.fn(),
      queueApplicationEvent: vi.fn().mockResolvedValue(undefined),
    };
    // Disable debouncing by default for most tests
    handler = new InteractionHandler(state, mockAsyncCoordinator, {
      enableClickDebouncing: false,
    });
  });

  afterEach(() => {
    handler.cleanup();
    vi.clearAllTimers();
  });

  describe("Node Click Handling", () => {
    it("should toggle node label on click", () => {
      const node = createTestNode("node1", "Short Label");
      node.longLabel = "Long Label";
      state.addNode(node);

      handler.handleNodeClick("node1");

      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
    });

    it("should handle node click with position", () => {
      const node = createTestNode("node1", "Short Label");
      state.addNode(node);

      const position = { x: 100, y: 200 };
      handler.handleNodeClick("node1", position);

      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
    });

    it("should handle click on non-existent node gracefully", () => {
      expect(() => handler.handleNodeClick("non-existent")).not.toThrow();
    });

    it("should trigger layout update for significant label changes", () => {
      const node = createTestNode("node1", "Short");
      node.longLabel =
        "This is a very long label that is much longer than the short one";
      state.addNode(node);

      handler.handleNodeClick("node1");

      expect(mockAsyncCoordinator.queueLayoutUpdate).toHaveBeenCalled();
    });

    it("should not trigger layout update for minor label changes", () => {
      const node = createTestNode("node1", "Short Label");
      node.longLabel = "Short Label+";
      state.addNode(node);

      handler.handleNodeClick("node1");

      expect(mockAsyncCoordinator.queueLayoutUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Container Click Handling", () => {
    it("should toggle container from expanded to collapsed", () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");
      state.addContainer(container);
      state.addNode(node);

      expect(state.getContainer("container1")?.collapsed).toBe(false);

      handler.handleContainerClick("container1");

      expect(state.getContainer("container1")?.collapsed).toBe(true);
    });

    it("should toggle container from collapsed to expanded", () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");
      state.addContainer(container);
      state.addNode(node);

      // Start collapsed
      state.collapseContainerSystemOperation("container1");
      expect(state.getContainer("container1")?.collapsed).toBe(true);

      handler.handleContainerClick("container1");

      expect(state.getContainer("container1")?.collapsed).toBe(false);
    });

    it("should always trigger layout update for container clicks", () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");
      state.addContainer(container);
      state.addNode(node);

      handler.handleContainerClick("container1");

      expect(mockAsyncCoordinator.queueLayoutUpdate).toHaveBeenCalled();
    });

    it("should handle click on non-existent container gracefully", () => {
      expect(() => handler.handleContainerClick("non-existent")).not.toThrow();
    });
  });

  describe("Click Debouncing", () => {
    let debouncingHandler: InteractionHandler;

    beforeEach(() => {
      vi.useFakeTimers();
      // Create handler with debouncing enabled for these tests
      debouncingHandler = new InteractionHandler(state, mockAsyncCoordinator, {
        enableClickDebouncing: true,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      debouncingHandler.cleanup();
    });

    it("should debounce rapid clicks by default", () => {
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      // Check initial state
      expect(state.getGraphNode("node1")?.showingLongLabel).toBeFalsy();

      // Create events with different timestamps to avoid rapid click logic
      const baseTime = Date.now();
      const event1: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        timestamp: baseTime,
        position: { x: 0, y: 0 },
      };
      const event2: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        timestamp: baseTime + 600, // Outside rapid click threshold
        position: { x: 0, y: 0 },
      };
      const event3: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        timestamp: baseTime + 1200, // Outside rapid click threshold
        position: { x: 0, y: 0 },
      };

      // Process events - each should be debounced
      debouncingHandler.processClickEvent(event1);
      expect(debouncingHandler.getPendingOperationsCount()).toBe(1);

      debouncingHandler.processClickEvent(event2);
      expect(debouncingHandler.getPendingOperationsCount()).toBe(1); // Should still be 1 (replaced)

      debouncingHandler.processClickEvent(event3);
      expect(debouncingHandler.getPendingOperationsCount()).toBe(1); // Should still be 1 (replaced)

      // Should not have processed any clicks yet due to debouncing
      expect(state.getGraphNode("node1")?.showingLongLabel).toBeFalsy();

      // Fast forward past debounce delay
      vi.advanceTimersByTime(350);

      // Should have processed only one click (the last debounced one)
      // Starting from false, one toggle makes it true
      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
      expect(debouncingHandler.getPendingOperationsCount()).toBe(0);
    });

    it("should handle rapid clicks within threshold immediately", () => {
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      // First click - this will be debounced
      debouncingHandler.handleNodeClick("node1");

      // Wait a short time (less than rapid click threshold)
      vi.advanceTimersByTime(100);

      // Second click within threshold - should be processed immediately
      debouncingHandler.handleNodeClick("node1");

      // The second click should have been processed immediately due to rapid click logic
      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
    });

    it("should allow disabling debouncing", () => {
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      handler.disableDebouncing();
      handler.handleNodeClick("node1");

      // Should process immediately without debouncing
      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
    });

    it("should track pending operations count", () => {
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      expect(debouncingHandler.getPendingOperationsCount()).toBe(0);

      debouncingHandler.handleNodeClick("node1");
      expect(debouncingHandler.getPendingOperationsCount()).toBe(1);

      vi.advanceTimersByTime(350);
      expect(debouncingHandler.getPendingOperationsCount()).toBe(0);
    });
  });

  describe("Configuration Management", () => {
    it("should use default configuration", () => {
      // Create a handler with default config for this test
      const defaultHandler = new InteractionHandler(
        state,
        mockAsyncCoordinator,
      );
      const config = defaultHandler.getConfig();
      expect(config.debounceDelay).toBe(300);
      expect(config.rapidClickThreshold).toBe(500);
      expect(config.enableClickDebouncing).toBe(true);
      defaultHandler.cleanup();
    });

    it("should accept custom configuration", () => {
      const customHandler = new InteractionHandler(
        state,
        mockAsyncCoordinator,
        {
          debounceDelay: 500,
          rapidClickThreshold: 200,
        },
      );

      const config = customHandler.getConfig();
      expect(config.debounceDelay).toBe(500);
      expect(config.rapidClickThreshold).toBe(200);
      expect(config.enableClickDebouncing).toBe(true);

      customHandler.cleanup();
    });

    it("should update configuration", () => {
      handler.updateConfig({
        debounceDelay: 400,
        enableClickDebouncing: false,
      });

      const config = handler.getConfig();
      expect(config.debounceDelay).toBe(400);
      expect(config.enableClickDebouncing).toBe(false);
      expect(config.rapidClickThreshold).toBe(500); // Unchanged
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk node label toggle", () => {
      const node1 = createTestNode("node1", "Short1");
      const node2 = createTestNode("node2", "Short2");
      state.addNode(node1);
      state.addNode(node2);

      handler.handleBulkNodeLabelToggle(["node1", "node2"], true);

      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
      expect(state.getGraphNode("node2")?.showingLongLabel).toBe(true);
      expect(mockAsyncCoordinator.queueLayoutUpdate).toHaveBeenCalledTimes(1);
    });

    it("should handle bulk container toggle", () => {
      const container1 = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const container2 = createTestContainer(
        "container2",
        ["node2"],
        "Container container2",
      );
      const node1 = createTestNode("node1");
      const node2 = createTestNode("node2");

      state.addContainer(container1);
      state.addContainer(container2);
      state.addNode(node1);
      state.addNode(node2);

      handler.handleBulkContainerToggle(["container1", "container2"], true);

      expect(state.getContainer("container1")?.collapsed).toBe(true);
      expect(state.getContainer("container2")?.collapsed).toBe(true);
      expect(mockAsyncCoordinator.queueLayoutUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Queuing", () => {
    it("should queue events through AsyncCoordinator when available", async () => {
      const event: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        timestamp: Date.now(),
        position: { x: 0, y: 0 },
      };

      await handler.queueInteractionEvent(event);

      expect(mockAsyncCoordinator.queueApplicationEvent).toHaveBeenCalledWith({
        type: "interaction",
        data: event,
      });
    });

    it("should fallback to synchronous processing without AsyncCoordinator", async () => {
      const handlerWithoutAsync = new InteractionHandler(state, undefined, {
        enableClickDebouncing: false,
      });
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      const event: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        timestamp: Date.now(),
        position: { x: 0, y: 0 },
      };

      await handlerWithoutAsync.queueInteractionEvent(event);

      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
      handlerWithoutAsync.cleanup();
    });
  });

  describe("Search Integration", () => {
    it("should expand containers for search result clicks", () => {
      const container = createTestContainer(
        "container1",
        ["node1"],
        "Container container1",
      );
      const node = createTestNode("node1");
      state.addContainer(container);
      state.addNode(node);

      // Start collapsed
      state.collapseContainerSystemOperation("container1");
      expect(state.getContainer("container1")?.collapsed).toBe(true);

      handler.handleSearchResultClick("container1", "container");

      expect(state.getContainer("container1")?.collapsed).toBe(false);
      expect(mockAsyncCoordinator.queueLayoutUpdate).toHaveBeenCalled();
    });

    it("should show long labels for search result node clicks", () => {
      const node = createTestNode("node1", "Short");
      node.longLabel = "Long Label";
      state.addNode(node);

      handler.handleSearchResultClick("node1", "node");

      expect(state.getGraphNode("node1")?.showingLongLabel).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully during click processing", () => {
      // Mock a method to throw an error
      const originalToggle = state.toggleNodeLabel;
      state.toggleNodeLabel = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => handler.handleNodeClick("node1")).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error processing click event:",
        expect.any(Error),
      );

      // Restore
      state.toggleNodeLabel = originalToggle;
      consoleSpy.mockRestore();
    });
  });

  describe("State Queries", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should track recent clicks count", () => {
      // Use debouncing handler for this test since it tracks clicks
      const trackingHandler = new InteractionHandler(
        state,
        mockAsyncCoordinator,
        {
          enableClickDebouncing: true,
        },
      );
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      expect(trackingHandler.getRecentClicksCount()).toBe(0);

      trackingHandler.handleNodeClick("node1");
      expect(trackingHandler.getRecentClicksCount()).toBe(1);

      // Advance time beyond rapid click threshold
      vi.advanceTimersByTime(600);
      expect(trackingHandler.getRecentClicksCount()).toBe(0);

      trackingHandler.cleanup();
    });
  });

  describe("Cleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should cleanup pending operations and recent clicks", () => {
      // Use debouncing handler for this test since it tracks operations
      const cleanupHandler = new InteractionHandler(
        state,
        mockAsyncCoordinator,
        {
          enableClickDebouncing: true,
        },
      );
      const node = createTestNode("node1", "Short");
      state.addNode(node);

      cleanupHandler.handleNodeClick("node1");
      expect(cleanupHandler.getPendingOperationsCount()).toBe(1);
      expect(cleanupHandler.getRecentClicksCount()).toBe(1);

      cleanupHandler.cleanup();

      expect(cleanupHandler.getPendingOperationsCount()).toBe(0);
      expect(cleanupHandler.getRecentClicksCount()).toBe(0);
    });
  });
});
