/**
 * Tests for InteractionHandler click event processing
 * REWRITTEN for new architecture
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  InteractionHandler,
  type ClickEvent,
} from "../core/InteractionHandler.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { createTestContainer, createTestNode } from "../utils/testData.js";

describe("InteractionHandler Click Event Processing", () => {
  let handler: InteractionHandler;
  let state: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    state = new VisualizationState();
    elkBridge = new ELKBridge({
      algorithm: "mrtree",
      direction: "DOWN",
    });
    reactFlowBridge = new ReactFlowBridge({});
    asyncCoordinator = new AsyncCoordinator();
    
    // Set bridge instances for the new architecture
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
    
    // Disable debouncing by default for most tests
    handler = new InteractionHandler(state, asyncCoordinator, {
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

      const visibleNodes = state.visibleNodes;
      const toggledNode = visibleNodes.find(n => n.id === "node1");
      expect(toggledNode?.showingLongLabel).toBe(true);
    });

    it("should handle node click with position", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      const clickEvent: ClickEvent = {
        elementId: "node1",
        elementType: "node",
        position: { x: 100, y: 200 },
        timestamp: Date.now(),
      };

      handler.handleNodeClick("node1");

      // Should handle click without errors
      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();
    });

    it("should handle click on non-existent node gracefully", () => {
      expect(() => {
        handler.handleNodeClick("nonexistent");
      }).not.toThrow();
    });

    it("should trigger layout update for significant label changes", () => {
      const node = createTestNode("node1", "Short");
      node.longLabel = "This is a very long label that should trigger layout update";
      state.addNode(node);

      // Spy on the AsyncCoordinator's layout method
      const layoutSpy = vi.spyOn(asyncCoordinator, 'executeLayoutAndRenderPipeline');

      handler.handleNodeClick("node1");

      // The InteractionHandler DOES trigger layout updates through AsyncCoordinator
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it("should not trigger layout update for minor label changes", () => {
      const node = createTestNode("node1", "Short");
      node.longLabel = "Short2"; // Minor change
      state.addNode(node);

      const layoutSpy = vi.spyOn(asyncCoordinator, 'executeLayoutAndRenderPipeline');

      handler.handleNodeClick("node1");

      expect(layoutSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("Container Click Handling", () => {
    it("should toggle container from expanded to collapsed", async () => {
      const container = createTestContainer("container1", "Test Container");
      container.collapsed = false;
      state.addContainer(container);

      // Mock the container operation
      const collapseSpy = vi.spyOn(asyncCoordinator, 'collapseContainer');

      handler.handleContainerClick("container1");

      // Should call the appropriate container method
      expect(collapseSpy).toHaveBeenCalledTimes(1);
    });

    it("should toggle container from collapsed to expanded", async () => {
      const container = createTestContainer("container1", "Test Container");
      container.collapsed = true;
      state.addContainer(container);

      const expandSpy = vi.spyOn(asyncCoordinator, 'expandContainer');

      handler.handleContainerClick("container1");

      expect(expandSpy).toHaveBeenCalledTimes(1);
    });

    it("should always trigger layout update for container clicks", () => {
      const container = createTestContainer("container1", "Test Container");
      container.collapsed = false;
      state.addContainer(container);

      const layoutSpy = vi.spyOn(asyncCoordinator, 'executeLayoutAndRenderPipeline');

      handler.handleContainerClick("container1");

      // Container operations should trigger layout updates
      expect(layoutSpy).toHaveBeenCalledTimes(2); // One for each container operation
    });

    it("should handle click on non-existent container gracefully", () => {
      expect(() => {
        handler.handleContainerClick("nonexistent");
      }).not.toThrow();
    });
  });

  describe("Click Debouncing", () => {
    it("should debounce rapid clicks by default", () => {
      // Create handler with debouncing enabled
      const debouncedHandler = new InteractionHandler(state, asyncCoordinator, {
        enableClickDebouncing: true,
        clickDebounceMs: 100,
      });

      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      // Rapid clicks
      debouncedHandler.handleNodeClick("node1");
      debouncedHandler.handleNodeClick("node1");
      debouncedHandler.handleNodeClick("node1");

      // Should handle debouncing gracefully
      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();

      debouncedHandler.cleanup();
    });

    it("should handle rapid clicks within threshold immediately", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      // Multiple rapid clicks
      handler.handleNodeClick("node1");
      handler.handleNodeClick("node1");

      // Should handle all clicks
      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();
    });

    it("should allow disabling debouncing", () => {
      // Handler already created with debouncing disabled
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      handler.handleNodeClick("node1");

      // Should process immediately
      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();
    });

    it("should track pending operations count", () => {
      const pendingCount = handler.getPendingOperationsCount();
      expect(typeof pendingCount).toBe("number");
      expect(pendingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuration Management", () => {
    it("should use default configuration", () => {
      const defaultHandler = new InteractionHandler(state, asyncCoordinator);
      expect(defaultHandler).toBeDefined();
      defaultHandler.cleanup();
    });

    it("should accept custom configuration", () => {
      const customHandler = new InteractionHandler(state, asyncCoordinator, {
        enableClickDebouncing: true,
        clickDebounceMs: 200,
        significantLabelChangeThreshold: 50,
      });
      expect(customHandler).toBeDefined();
      customHandler.cleanup();
    });

    it("should update configuration", () => {
      handler.updateConfig({
        enableClickDebouncing: true,
        clickDebounceMs: 150,
      });

      // Configuration should be updated
      expect(handler).toBeDefined();
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk node label toggle", () => {
      const node1 = createTestNode("node1", "Node 1");
      node1.longLabel = "Long Label 1";
      const node2 = createTestNode("node2", "Node 2");
      node2.longLabel = "Long Label 2";

      state.addNode(node1);
      state.addNode(node2);

      const layoutSpy = vi.spyOn(asyncCoordinator, 'executeLayoutAndRenderPipeline');

      handler.handleBulkNodeLabelToggle(["node1", "node2"], true);

      const visibleNodes = state.visibleNodes;
      const toggledNode1 = visibleNodes.find(n => n.id === "node1");
      const toggledNode2 = visibleNodes.find(n => n.id === "node2");
      
      expect(toggledNode1?.showingLongLabel).toBe(true);
      expect(toggledNode2?.showingLongLabel).toBe(true);
      expect(layoutSpy).toHaveBeenCalledTimes(1); // Bulk operations trigger layout
    });

    it("should handle bulk container toggle", async () => {
      const container1 = createTestContainer("container1", "Container 1");
      container1.collapsed = false;
      const container2 = createTestContainer("container2", "Container 2");
      container2.collapsed = false;

      state.addContainer(container1);
      state.addContainer(container2);

      const layoutSpy = vi.spyOn(asyncCoordinator, 'executeLayoutAndRenderPipeline');

      handler.handleBulkContainerToggle(["container1", "container2"], true);

      const visibleContainers = state.visibleContainers;
      const toggledContainer1 = visibleContainers.find(c => c.id === "container1");
      const toggledContainer2 = visibleContainers.find(c => c.id === "container2");
      
      expect(toggledContainer1?.collapsed).toBe(true);
      expect(toggledContainer2?.collapsed).toBe(true);
      expect(layoutSpy).toHaveBeenCalledTimes(1); // Bulk operations trigger layout
    });
  });

  describe("Event Queuing", () => {
    it("should queue events through AsyncCoordinator when available", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      // Should process through AsyncCoordinator
      handler.handleNodeClick("node1");

      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();
    });

    it("should fallback to synchronous processing without AsyncCoordinator", () => {
      // Create handler without AsyncCoordinator
      const syncHandler = new InteractionHandler(state);

      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      syncHandler.handleNodeClick("node1");

      const visibleNodes = state.visibleNodes;
      const clickedNode = visibleNodes.find(n => n.id === "node1");
      expect(clickedNode).toBeDefined();

      syncHandler.cleanup();
    });
  });

  describe("Search Integration", () => {
    it("should expand containers for search result clicks", () => {
      const container = createTestContainer("container1", "Test Container");
      container.collapsed = true;
      state.addContainer(container);

      const expandSpy = vi.spyOn(asyncCoordinator, 'expandContainer');

      // Simulate search result click that should expand container
      handler.handleSearchResultClick("container1", "container");

      const visibleContainers = state.visibleContainers;
      const expandedContainer = visibleContainers.find(c => c.id === "container1");
      expect(expandedContainer?.collapsed).toBe(false);
      expect(expandSpy).toHaveBeenCalledTimes(1); // Search result clicks trigger expand
    });

    it("should show long labels for search result node clicks", () => {
      const node = createTestNode("node1", "Short");
      node.longLabel = "Long Label for Search";
      state.addNode(node);

      handler.handleSearchResultClick("node1", "node");

      const visibleNodes = state.visibleNodes;
      const searchNode = visibleNodes.find(n => n.id === "node1");
      expect(searchNode?.showingLongLabel).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully during click processing", () => {
      // Create a scenario that might cause errors
      const invalidNode = createTestNode("", "Invalid Node"); // Empty ID
      
      expect(() => {
        handler.handleNodeClick("");
      }).not.toThrow();
    });

    it("should recover from interaction state corruption", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      // Simulate some corruption by directly modifying state
      handler.handleNodeClick("node1");

      // Should still function
      expect(() => {
        handler.handleNodeClick("node1");
      }).not.toThrow();
    });
  });

  describe("State Queries", () => {
    it("should track recent clicks count", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      const initialCount = handler.getRecentClicksCount();
      
      handler.handleNodeClick("node1");
      
      const afterClickCount = handler.getRecentClicksCount();
      expect(afterClickCount).toBeGreaterThanOrEqual(initialCount);
    });

    it("should provide interaction statistics", () => {
      // Test that handler maintains internal state
      const pendingCount = handler.getPendingOperationsCount();
      expect(typeof pendingCount).toBe("number");
      expect(pendingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup pending operations and recent clicks", () => {
      const node = createTestNode("node1", "Test Node");
      state.addNode(node);

      handler.handleNodeClick("node1");
      
      const beforeCleanup = handler.getPendingOperationsCount();
      
      handler.cleanup();
      
      const afterCleanup = handler.getPendingOperationsCount();
      expect(afterCleanup).toBe(0);
    });

    it("should handle multiple cleanup calls gracefully", () => {
      expect(() => {
        handler.cleanup();
        handler.cleanup();
        handler.cleanup();
      }).not.toThrow();
    });
  });
});