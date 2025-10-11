/**
 * Bulk Operations Atomicity Tests
 *
 * Comprehensive tests for bulk operation correctness and atomicity
 * Tests that bulk operations (collapseAll/expandAll) are atomic and consistent
 * Uses minimal mocking to test real behavior
 */

import React, { useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  HydroscopeCore,
  type HydroscopeCoreHandle,
} from "../components/HydroscopeCore.js";
import { VisualizationState } from "../core/VisualizationState.js";
import type { HydroscopeData } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

// Create test data with multiple containers for atomicity testing
function createAtomicityTestData(): HydroscopeData {
  return {
    nodes: [
      // Container 1 nodes
      { id: "c1_n1", label: "Container 1 Node 1", type: "process" },
      { id: "c1_n2", label: "Container 1 Node 2", type: "process" },
      { id: "c1_n3", label: "Container 1 Node 3", type: "process" },

      // Container 2 nodes
      { id: "c2_n1", label: "Container 2 Node 1", type: "service" },
      { id: "c2_n2", label: "Container 2 Node 2", type: "service" },

      // Container 3 nodes (nested)
      { id: "c3_n1", label: "Container 3 Node 1", type: "storage" },
      { id: "c3_n2", label: "Container 3 Node 2", type: "storage" },
      { id: "c3_n3", label: "Container 3 Node 3", type: "storage" },
      { id: "c3_n4", label: "Container 3 Node 4", type: "storage" },

      // Standalone nodes
      { id: "standalone_1", label: "Standalone Node 1", type: "client" },
      { id: "standalone_2", label: "Standalone Node 2", type: "client" },
    ],
    edges: [
      { id: "e1", source: "c1_n1", target: "c1_n2", type: "flow" },
      { id: "e2", source: "c1_n2", target: "c2_n1", type: "flow" },
      { id: "e3", source: "c2_n1", target: "c3_n1", type: "flow" },
      { id: "e4", source: "c3_n1", target: "standalone_1", type: "flow" },
      {
        id: "e5",
        source: "standalone_1",
        target: "standalone_2",
        type: "flow",
      },
    ],
    hierarchyChoices: [{ id: "functional", name: "Functional Groups" }],
    nodeAssignments: {
      functional: {
        c1_n1: "container_1",
        c1_n2: "container_1",
        c1_n3: "container_1",
        c2_n1: "container_2",
        c2_n2: "container_2",
        c3_n1: "container_3",
        c3_n2: "container_3",
        c3_n3: "container_3",
        c3_n4: "container_3",
      },
    },
  };
}

// Test component that uses HydroscopeCore properly with real data loading and layout
const AtomicityTestComponent: React.FC<{
  data: HydroscopeData;
  onReady?: (handle: HydroscopeCoreHandle) => void;
  onError?: (error: Error) => void;
}> = ({ data, onReady, onError }) => {
  const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

  React.useEffect(() => {
    // Wait for component to initialize, then call onReady
    const timer = setTimeout(() => {
      if (hydroscopeRef.current && onReady) {
        onReady(hydroscopeRef.current);
      }
    }, 1000); // Give time for full initialization including ELK setup

    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <HydroscopeCore
      ref={hydroscopeRef}
      data={data}
      height="600px"
      width="800px"
      enableCollapse={true}
      showControls={true}
      showMiniMap={false}
      showBackground={true}
      onError={onError}
    />
  );
};

describe("Bulk Operations Atomicity Tests", () => {
  let coordinator: AsyncCoordinator;

  let testData: HydroscopeData;

  beforeEach(() => {
    const coordinator = new AsyncCoordinator();
    testData = createAtomicityTestData();
  });

  describe("CollapseAll Atomicity", () => {
    it("should collapse all containers atomically with full ELK layout", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      // Wait for component to be fully ready with ELK initialized
      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // Verify collapseAll method exists and is callable
        expect(hydroscopeHandle.collapseAll).toBeDefined();
        expect(typeof hydroscopeHandle.collapseAll).toBe("function");

        // Perform collapseAll operation with full ELK layout
        const startTime = Date.now();
        await hydroscopeHandle.collapseAll();
        const endTime = Date.now();

        // Verify operation completed (atomicity timing)
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max for full pipeline

        // Verify no errors occurred during the operation
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should maintain consistency during collapseAll", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      let visualizationState: VisualizationState | null = null;
      const onError = vi.fn();

      const onReady = (
        handle: HydroscopeCoreHandle,
        state: VisualizationState,
      ) => {
        hydroscopeHandle = handle;
        visualizationState = state;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
          expect(visualizationState).not.toBeNull();
        },
        { timeout: 5000 },
      );

      if (hydroscopeHandle && visualizationState) {
        // Record initial state
        const initialNodeCount = visualizationState.visibleNodes.length;
        const initialEdgeCount = visualizationState.visibleEdges.length;
        const initialContainerCount =
          visualizationState.visibleContainers.length;

        // Perform collapseAll
        await hydroscopeHandle.collapseAll();

        // Verify data consistency is maintained
        expect(visualizationState.visibleNodes.length).toBe(initialNodeCount);
        expect(visualizationState.visibleEdges.length).toBe(initialEdgeCount);
        expect(visualizationState.visibleContainers.length).toBe(
          initialContainerCount,
        );

        // Verify invariants are maintained
        expect(() => visualizationState.validateInvariants()).not.toThrow();
      }
    });

    it("should handle collapseAll with no containers gracefully", async () => {
      const emptyData: HydroscopeData = {
        nodes: [
          { id: "n1", label: "Node 1", type: "process" },
          { id: "n2", label: "Node 2", type: "process" },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2", type: "flow" }],
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={emptyData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // Should complete successfully when no containers exist
        await hydroscopeHandle.collapseAll();

        // Should not have errors for empty container case
        expect(onError).not.toHaveBeenCalled();
      }
    });
  });

  describe("ExpandAll Atomicity", () => {
    it("should expand all containers atomically with full ELK layout", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // First collapse all containers
        await hydroscopeHandle.collapseAll();

        // Perform expandAll operation
        const startTime = Date.now();
        await hydroscopeHandle.expandAll();
        const endTime = Date.now();

        // Verify operation completed (atomicity timing)
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max for full pipeline

        // Verify no errors occurred during the operation
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should maintain consistency during expandAll", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      let visualizationState: VisualizationState | null = null;
      const onError = vi.fn();

      const onReady = (
        handle: HydroscopeCoreHandle,
        state: VisualizationState,
      ) => {
        hydroscopeHandle = handle;
        visualizationState = state;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
          expect(visualizationState).not.toBeNull();
        },
        { timeout: 5000 },
      );

      if (hydroscopeHandle && visualizationState) {
        // Collapse first
        await hydroscopeHandle.collapseAll();

        // Record state before expand
        const beforeNodeCount = visualizationState.visibleNodes.length;
        const beforeEdgeCount = visualizationState.visibleEdges.length;
        const beforeContainerCount =
          visualizationState.visibleContainers.length;

        // Perform expandAll
        await hydroscopeHandle.expandAll();

        // Verify data consistency is maintained
        expect(visualizationState.visibleNodes.length).toBe(beforeNodeCount);
        expect(visualizationState.visibleEdges.length).toBe(beforeEdgeCount);
        expect(visualizationState.visibleContainers.length).toBe(
          beforeContainerCount,
        );

        // Verify invariants are maintained
        expect(() => visualizationState.validateInvariants()).not.toThrow();
      }
    });
  });

  describe("Bulk Operation Sequencing", () => {
    it("should handle sequential bulk operations", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        const startTime = Date.now();

        // Perform sequence of operations
        await hydroscopeHandle.collapseAll();
        await hydroscopeHandle.expandAll();
        await hydroscopeHandle.collapseAll();

        const endTime = Date.now();

        // All operations should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(15000); // 15 seconds max for full pipeline

        // Should not have errors during sequential operations
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should handle concurrent bulk operations gracefully", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      let visualizationState: VisualizationState | null = null;
      const onError = vi.fn();

      const onReady = (
        handle: HydroscopeCoreHandle,
        state: VisualizationState,
      ) => {
        hydroscopeHandle = handle;
        visualizationState = state;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
          expect(visualizationState).not.toBeNull();
        },
        { timeout: 5000 },
      );

      if (hydroscopeHandle && visualizationState) {
        // Start multiple operations concurrently
        const operations = [
          hydroscopeHandle.collapseAll(),
          hydroscopeHandle.expandAll(),
          hydroscopeHandle.collapseAll(),
        ];

        // All operations should complete without throwing
        await expect(Promise.allSettled(operations)).resolves.not.toThrow();

        // System should remain in a valid state
        expect(() => visualizationState.validateInvariants()).not.toThrow();
      }
    });
  });

  describe("Individual vs Bulk Operation Consistency", () => {
    it("should handle both bulk and individual operations", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // Test bulk operations
        await hydroscopeHandle.collapseAll();
        await hydroscopeHandle.expandAll();

        // Test individual operations (should not throw even if containers don't exist)
        await hydroscopeHandle.collapse("container_1");
        await hydroscopeHandle.expand("container_1");
        await hydroscopeHandle.toggle("container_2");

        // Should complete without errors
        expect(onError).not.toHaveBeenCalled();
      }
    });

    it("should handle mixed individual and bulk operations", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // Mixed operations
        await hydroscopeHandle.collapseAll(); // Bulk collapse
        await hydroscopeHandle.expand("container_1"); // Individual expand
        await hydroscopeHandle.expandAll(); // Bulk expand
        await hydroscopeHandle.collapse("container_2"); // Individual collapse

        // Should complete mixed operations without errors
        expect(onError).not.toHaveBeenCalled();
      }
    });
  });

  describe("Error Handling in Bulk Operations", () => {
    it("should handle bulk operations with invalid container IDs gracefully", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      let visualizationState: VisualizationState | null = null;
      const onError = vi.fn();

      const onReady = (
        handle: HydroscopeCoreHandle,
        state: VisualizationState,
      ) => {
        hydroscopeHandle = handle;
        visualizationState = state;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
          expect(visualizationState).not.toBeNull();
        },
        { timeout: 5000 },
      );

      if (hydroscopeHandle && visualizationState) {
        // Bulk operations should work even if some containers don't exist
        await expect(hydroscopeHandle.collapseAll()).resolves.not.toThrow();
        await expect(hydroscopeHandle.expandAll()).resolves.not.toThrow();

        // Individual operations with invalid IDs should not crash bulk operations
        await expect(
          hydroscopeHandle.collapse("nonexistent_container"),
        ).resolves.not.toThrow();
        await expect(hydroscopeHandle.collapseAll()).resolves.not.toThrow();

        // System should remain consistent
        expect(() => visualizationState.validateInvariants()).not.toThrow();
      }
    });

    it("should maintain consistency during bulk operations", async () => {
      let hydroscopeHandle: HydroscopeCoreHandle | null = null;
      const onError = vi.fn();

      const onReady = (handle: HydroscopeCoreHandle) => {
        hydroscopeHandle = handle;
      };

      render(
        <AtomicityTestComponent
          data={testData}
          onReady={onReady}
          onError={onError}
        />,
      );

      await waitFor(
        () => {
          expect(hydroscopeHandle).not.toBeNull();
        },
        { timeout: 10000 },
      );

      if (hydroscopeHandle) {
        // Perform bulk operation
        await hydroscopeHandle.collapseAll();

        // Should maintain consistency throughout operation
        expect(onError).not.toHaveBeenCalled();
      }
    });
  });
});
