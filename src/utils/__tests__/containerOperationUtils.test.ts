/**
 * @fileoverview Container Operation Utilities Tests
 *
 * Tests for imperative container operation functions that prevent
 * ResizeObserver loops and coordination cascades.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleContainerImperatively,
  expandContainerImperatively,
  collapseContainerImperatively,
  batchContainerOperationsImperatively,
  clearContainerOperationDebouncing,
  CONTAINER_OPERATION_PATTERN,
} from "../containerOperationUtils.js";

// Mock VisualizationState
const createMockVisualizationState = () => {
  const containers = new Map();

  return {
    getContainer: vi.fn((id: string) => containers.get(id)),
    _expandContainerForCoordinator: vi.fn((id: string) => {
      const container = containers.get(id);
      if (container) {
        container.collapsed = false;
      }
    }),
    _collapseContainerForCoordinator: vi.fn((id: string) => {
      const container = containers.get(id);
      if (container) {
        container.collapsed = true;
      }
    }),
    // Helper to add containers for testing
    _addTestContainer: (id: string, collapsed: boolean = false) => {
      containers.set(id, { id, collapsed });
    },
  } as any;
};

describe("Container Operation Utilities", () => {
  let mockVisualizationState: any;

  beforeEach(() => {
    mockVisualizationState = createMockVisualizationState();
    vi.clearAllMocks();
    clearContainerOperationDebouncing(); // Clear any pending operations
  });

  describe("toggleContainerImperatively", () => {
    it("should expand a collapsed container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", true);

      // Execute
      const result = toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result).toBe(true);
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });

    it("should collapse an expanded container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", false);

      // Execute
      const result = toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result).toBe(true);
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });

    it("should force expand when forceExpanded is true", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", false);

      // Execute
      const result = toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
        forceExpanded: true,
      });

      // Verify - should not call anything since already expanded
      expect(result).toBe(true);
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).not.toHaveBeenCalled();
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });

    it("should force collapse when forceCollapsed is true", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", false);

      // Execute
      const result = toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
        forceCollapsed: true,
      });

      // Verify
      expect(result).toBe(true);
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
    });

    it("should return false for missing container", () => {
      // Execute
      const result = toggleContainerImperatively({
        containerId: "nonexistent",
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result).toBe(false);
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).not.toHaveBeenCalled();
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });

    it("should return false for missing visualization state", () => {
      // Execute
      const result = toggleContainerImperatively({
        containerId: "container1",
      });

      // Verify
      expect(result).toBe(false);
    });

    it("should handle debouncing", (done) => {
      // Setup
      mockVisualizationState._addTestContainer("container1", true);

      // Execute multiple rapid calls
      toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
        debounce: true,
      });

      toggleContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
        debounce: true,
      });

      // Should not be called immediately
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).not.toHaveBeenCalled();

      // Wait for debounce
      setTimeout(() => {
        expect(
          mockVisualizationState._expandContainerForCoordinator,
        ).toHaveBeenCalledTimes(1);
        done();
      }, 200);
    });
  });

  describe("expandContainerImperatively", () => {
    it("should expand a collapsed container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", true);

      // Execute
      const result = expandContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result).toBe(true);
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
    });

    it("should skip already expanded container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", false);

      // Execute
      const result = expandContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify - should not call anything since already expanded
      expect(result).toBe(true);
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });
  });

  describe("collapseContainerImperatively", () => {
    it("should collapse an expanded container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", false);

      // Execute
      const result = collapseContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result).toBe(true);
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
    });

    it("should skip already collapsed container", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", true);

      // Execute
      const result = collapseContainerImperatively({
        containerId: "container1",
        visualizationState: mockVisualizationState,
      });

      // Verify - should not call anything since already collapsed
      expect(result).toBe(true);
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).not.toHaveBeenCalled();
    });
  });

  describe("batchContainerOperationsImperatively", () => {
    it("should execute multiple operations", () => {
      // Setup
      mockVisualizationState._addTestContainer("container1", true);
      mockVisualizationState._addTestContainer("container2", false);
      mockVisualizationState._addTestContainer("container3", true);

      // Execute
      const result = batchContainerOperationsImperatively({
        operations: [
          { containerId: "container1", operation: "expand" },
          { containerId: "container2", operation: "collapse" },
          { containerId: "container3", operation: "toggle" },
        ],
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).toHaveBeenCalledWith("container1");
      expect(
        mockVisualizationState._collapseContainerForCoordinator,
      ).toHaveBeenCalledWith("container2");
      expect(
        mockVisualizationState._expandContainerForCoordinator,
      ).toHaveBeenCalledWith("container3");
    });

    it("should handle missing containers gracefully", () => {
      // Execute
      const result = batchContainerOperationsImperatively({
        operations: [{ containerId: "nonexistent", operation: "expand" }],
        visualizationState: mockVisualizationState,
      });

      // Verify
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it("should handle missing visualization state", () => {
      // Execute
      const result = batchContainerOperationsImperatively({
        operations: [{ containerId: "container1", operation: "expand" }],
      });

      // Verify
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain("VisualizationState is required");
    });
  });

  describe("CONTAINER_OPERATION_PATTERN", () => {
    it("should provide guidance for safe operations", () => {
      expect(CONTAINER_OPERATION_PATTERN.DO).toContain(
        "Use _expandContainerForCoordinator() and _collapseContainerForCoordinator() for direct state changes",
      );
      expect(CONTAINER_OPERATION_PATTERN.DONT).toContain(
        "Call AsyncCoordinator.expandContainer() or AsyncCoordinator.collapseContainer() during UI interactions",
      );
    });
  });
});
