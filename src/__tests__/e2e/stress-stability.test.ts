/**
 * Stress Testing for UI Operation Stability
 *
 * These tests validate system stability under extreme load conditions,
 * including high-frequency operations, large datasets, and concurrent
 * operations that commonly cause ResizeObserver loops and performance issues.
 *
 * Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VisualizationState } from "../../core/VisualizationState.js";
import { ReactFlowBridge } from "../../bridges/ReactFlowBridge.js";
import {
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression,
  withResizeObserverErrorSuppression,
  DebouncedOperationManager,
} from "../../utils/ResizeObserverErrorSuppression.js";
import {
  toggleContainerImperatively,
  batchContainerOperationsImperatively,
  clearContainerOperationDebouncing,
} from "../../utils/containerOperationUtils.js";
import { clearSearchImperatively } from "../../utils/searchClearUtils.js";

describe("Stress Testing for UI Operation Stability", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let performanceStartTime: number;

  beforeEach(async () => {
    performanceStartTime = performance.now();

    // Initialize components
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});

    // Set up error monitoring
    errorSpy = vi.spyOn(window, "onerror");

    // Enable ResizeObserver error suppression
    enableResizeObserverErrorSuppression();

    // Create large-scale test data for stress testing
    setupStressTestData();

    // Clear any existing operations
    clearContainerOperationDebouncing();
  });

  afterEach(() => {
    const testDuration = performance.now() - performanceStartTime;
    console.log(`Test completed in ${testDuration.toFixed(2)}ms`);

    disableResizeObserverErrorSuppression();
    clearContainerOperationDebouncing();
    errorSpy.mockRestore();
    vi.clearAllTimers();
  });

  function setupStressTestData() {
    // Create large number of containers and nodes for stress testing
    const containerCount = 50;
    const nodesPerContainer = 10;

    // Create containers
    for (let i = 0; i < containerCount; i++) {
      const container = {
        id: `stress_container_${i}`,
        label: `Stress Container ${i}`,
        children: new Set(
          Array.from(
            { length: nodesPerContainer },
            (_, j) => `stress_node_${i}_${j}`,
          ),
        ),
        collapsed: false,
        hidden: false,
      };
      state.addContainer(container);
    }

    // Create nodes
    for (let i = 0; i < containerCount; i++) {
      for (let j = 0; j < nodesPerContainer; j++) {
        const node = {
          id: `stress_node_${i}_${j}`,
          label: `Stress Node ${i}-${j}`,
          longLabel: `Stress Node ${i}-${j} Full Label`,
          type: "node",
          semanticTags: [`tag_${i % 5}`, `category_${j % 3}`],
          hidden: false,
        };
        state.addNode(node);
        state.assignNodeToContainer(node.id, `stress_container_${i}`);
      }
    }

    // Create edges between nodes (create a complex graph)
    const edgeCount = containerCount * nodesPerContainer * 2;
    for (let i = 0; i < edgeCount; i++) {
      const sourceContainer = i % containerCount;
      const sourceNode = i % nodesPerContainer;
      const targetContainer = (i + 1) % containerCount;
      const targetNode = (i + 1) % nodesPerContainer;

      const edge = {
        id: `stress_edge_${i}`,
        source: `stress_node_${sourceContainer}_${sourceNode}`,
        target: `stress_node_${targetContainer}_${targetNode}`,
        type: "edge",
        semanticTags: [`flow_${i % 10}`],
        hidden: false,
      };
      state.addEdge(edge);
    }

    console.log(
      `Created stress test data: ${containerCount} containers, ${containerCount * nodesPerContainer} nodes, ${edgeCount} edges`,
    );
  }

  describe("High-Frequency Container Operations", () => {
    it("should handle extremely rapid container toggles without ResizeObserver errors", async () => {
      // Test with very high frequency operations (every 1ms)
      const operationCount = 200;
      const containerIds = Array.from(
        { length: 50 },
        (_, i) => `stress_container_${i}`,
      );

      const rapidOperations: Promise<void>[] = [];

      for (let i = 0; i < operationCount; i++) {
        const containerId = containerIds[i % containerIds.length];

        rapidOperations.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const operation = withResizeObserverErrorSuppression(() => {
                toggleContainerImperatively({
                  containerId,
                  visualizationState: state,
                  debounce: true,
                  enablePerformanceMonitoring: false, // Disable for performance
                });
              });

              operation();
              resolve();
            }, i); // 1ms intervals
          }),
        );
      }

      const startTime = performance.now();
      await Promise.all(rapidOperations);
      const endTime = performance.now();

      console.log(
        `Completed ${operationCount} rapid operations in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );

      // Allow debounced operations to complete
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    it("should handle concurrent container operations across multiple threads", async () => {
      // Simulate concurrent operations that might occur in real applications
      const concurrentBatches = 10;
      const operationsPerBatch = 20;

      const concurrentPromises = Array.from(
        { length: concurrentBatches },
        async (_, batchIndex) => {
          const batchOperations: Promise<void>[] = [];

          for (let i = 0; i < operationsPerBatch; i++) {
            const containerId = `stress_container_${(batchIndex * operationsPerBatch + i) % 50}`;

            batchOperations.push(
              new Promise<void>((opResolve) => {
                const operation = withResizeObserverErrorSuppression(() => {
                  toggleContainerImperatively({
                    containerId,
                    visualizationState: state,
                    debounce: Math.random() > 0.5, // Random debouncing
                    enablePerformanceMonitoring: false,
                  });
                });

                operation();
                opResolve();
              }),
            );
          }

          await Promise.all(batchOperations);
        },
      );

      const startTime = performance.now();
      await Promise.all(concurrentPromises);
      const endTime = performance.now();

      console.log(
        `Completed ${concurrentBatches * operationsPerBatch} concurrent operations in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Verify no ResizeObserver errors during concurrent operations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });
  });

  describe("Large-Scale Bulk Operations", () => {
    it("should handle massive bulk container operations", async () => {
      // Test bulk operations with all 50 containers
      const allContainerIds = Array.from(
        { length: 50 },
        (_, i) => `stress_container_${i}`,
      );

      // Test multiple rounds of bulk operations
      const rounds = 5;

      for (let round = 0; round < rounds; round++) {
        console.log(`Starting bulk operation round ${round + 1}/${rounds}`);

        // Collapse all containers
        const collapseOperations = allContainerIds.map((containerId) => ({
          containerId,
          operation: "collapse" as const,
        }));

        const collapseStartTime = performance.now();
        const collapseResults = batchContainerOperationsImperatively({
          operations: collapseOperations,
          visualizationState: state,
          enablePerformanceMonitoring: true,
        });
        const collapseEndTime = performance.now();

        expect(collapseResults.success).toBe(allContainerIds.length);
        expect(collapseResults.failed).toBe(0);

        console.log(
          `Collapsed ${allContainerIds.length} containers in ${(collapseEndTime - collapseStartTime).toFixed(2)}ms`,
        );

        // Expand all containers
        const expandOperations = allContainerIds.map((containerId) => ({
          containerId,
          operation: "expand" as const,
        }));

        const expandStartTime = performance.now();
        const expandResults = batchContainerOperationsImperatively({
          operations: expandOperations,
          visualizationState: state,
          enablePerformanceMonitoring: true,
        });
        const expandEndTime = performance.now();

        expect(expandResults.success).toBe(allContainerIds.length);
        expect(expandResults.failed).toBe(0);

        console.log(
          `Expanded ${allContainerIds.length} containers in ${(expandEndTime - expandStartTime).toFixed(2)}ms`,
        );

        // Small delay between rounds
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Verify no ResizeObserver errors during bulk operations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });

    it("should handle mixed bulk operations with different patterns", async () => {
      // Test complex bulk operation patterns
      const containerIds = Array.from(
        { length: 50 },
        (_, i) => `stress_container_${i}`,
      );

      const mixedPatterns = [
        // Pattern 1: Alternating collapse/expand
        containerIds.map((containerId, index) => ({
          containerId,
          operation: (index % 2 === 0 ? "collapse" : "expand") as const,
        })),

        // Pattern 2: First half collapse, second half expand
        [
          ...containerIds.slice(0, 25).map((containerId) => ({
            containerId,
            operation: "collapse" as const,
          })),
          ...containerIds.slice(25).map((containerId) => ({
            containerId,
            operation: "expand" as const,
          })),
        ],

        // Pattern 3: Random operations
        containerIds.map((containerId) => ({
          containerId,
          operation: (Math.random() > 0.5 ? "collapse" : "expand") as const,
        })),
      ];

      for (const [patternIndex, pattern] of mixedPatterns.entries()) {
        console.log(
          `Executing mixed pattern ${patternIndex + 1}/${mixedPatterns.length}`,
        );

        const startTime = performance.now();
        const results = batchContainerOperationsImperatively({
          operations: pattern,
          visualizationState: state,
          enablePerformanceMonitoring: true,
        });
        const endTime = performance.now();

        expect(results.success).toBe(pattern.length);
        expect(results.failed).toBe(0);

        console.log(
          `Completed pattern ${patternIndex + 1} with ${pattern.length} operations in ${(endTime - startTime).toFixed(2)}ms`,
        );
      }

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });
  });

  describe("High-Frequency Search Operations", () => {
    it("should handle rapid search clearing under stress", async () => {
      // Test rapid search operations with large dataset
      const searchOperationCount = 100;
      const mockInputRef = {
        current: { value: "stress test query" } as HTMLInputElement,
      };
      const mockSetQuery = vi.fn();
      const mockSetMatches = vi.fn();
      const mockSetCurrentIndex = vi.fn();

      const rapidSearchOperations: Promise<void>[] = [];

      for (let i = 0; i < searchOperationCount; i++) {
        rapidSearchOperations.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const operation = withResizeObserverErrorSuppression(() => {
                clearSearchImperatively({
                  visualizationState: state,
                  inputRef: mockInputRef,
                  setQuery: mockSetQuery,
                  setMatches: mockSetMatches,
                  setCurrentIndex: mockSetCurrentIndex,
                  debug: false,
                });
              });

              operation();
              resolve();
            }, i * 2); // 2ms intervals
          }),
        );
      }

      const startTime = performance.now();
      await Promise.all(rapidSearchOperations);
      const endTime = performance.now();

      console.log(
        `Completed ${searchOperationCount} search operations in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );

      // Verify search operations completed
      expect(mockSetQuery).toHaveBeenCalledWith("");
      expect(mockSetMatches).toHaveBeenCalledWith([]);
      expect(mockSetCurrentIndex).toHaveBeenCalledWith(0);
    });
  });

  describe("Layout Algorithm Stress Testing", () => {
    it("should handle rapid layout algorithm changes with large datasets", async () => {
      // Test layout changes with large dataset
      const layoutChangeCount = 50;

      const layoutOperations: Promise<void>[] = [];

      for (let i = 0; i < layoutChangeCount; i++) {
        layoutOperations.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const operation = withResizeObserverErrorSuppression(() => {
                // Simulate layout algorithm change
                const algorithms = ["elk.layered", "elk.force", "elk.stress"];
                state.updateRenderConfig({
                  layoutAlgorithm: algorithms[i % algorithms.length],
                });

                // Trigger ReactFlow data generation to simulate UI update
                const reactFlowData = reactFlowBridge.toReactFlowData(state);
                expect(reactFlowData.nodes.length).toBeGreaterThan(0);

                // Simulate potential ResizeObserver error during layout
                if (i % 10 === 0) {
                  throw new Error("ResizeObserver loop limit exceeded");
                }
              });

              operation();
              resolve();
            }, i * 5); // 5ms intervals
          }),
        );
      }

      const startTime = performance.now();
      await Promise.all(layoutOperations);
      const endTime = performance.now();

      console.log(
        `Completed ${layoutChangeCount} layout changes in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });
  });

  describe("Memory and Performance Under Stress", () => {
    it("should maintain reasonable memory usage during stress operations", async () => {
      // Monitor memory usage during stress operations
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform intensive operations
      const intensiveOperations = [
        // Rapid container operations
        async () => {
          for (let i = 0; i < 100; i++) {
            toggleContainerImperatively({
              containerId: `stress_container_${i % 50}`,
              visualizationState: state,
              debounce: false,
              enablePerformanceMonitoring: false,
            });
          }
        },

        // Bulk operations
        async () => {
          const operations = Array.from({ length: 50 }, (_, i) => ({
            containerId: `stress_container_${i}`,
            operation: (i % 2 === 0 ? "collapse" : "expand") as const,
          }));

          batchContainerOperationsImperatively({
            operations,
            visualizationState: state,
            enablePerformanceMonitoring: false,
          });
        },

        // Layout changes
        async () => {
          const algorithms = ["elk.layered", "elk.force", "elk.stress"];
          for (let i = 0; i < 30; i++) {
            state.updateRenderConfig({
              layoutAlgorithm: algorithms[i % algorithms.length],
            });
            reactFlowBridge.toReactFlowData(state);
          }
        },
      ];

      const startTime = performance.now();

      // Execute all intensive operations
      await Promise.all(intensiveOperations.map((op) => op()));

      const endTime = performance.now();
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      console.log(
        `Stress operations completed in ${(endTime - startTime).toFixed(2)}ms`,
      );

      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory - initialMemory;
        console.log(
          `Memory usage increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        );

        // Memory increase should be reasonable (less than 50MB for stress test)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      }

      // Verify no ResizeObserver errors during stress operations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });

    it("should handle debounced operations efficiently under stress", async () => {
      const debouncer = new DebouncedOperationManager(20);
      let totalOperations = 0;

      // Create multiple debounced operation keys
      const operationKeys = Array.from(
        { length: 10 },
        (_, i) => `stress_key_${i}`,
      );

      // Trigger many rapid operations for each key
      const rapidOperations: Promise<void>[] = [];

      for (let keyIndex = 0; keyIndex < operationKeys.length; keyIndex++) {
        const key = operationKeys[keyIndex];

        for (let i = 0; i < 50; i++) {
          rapidOperations.push(
            new Promise<void>((resolve) => {
              setTimeout(() => {
                const debouncedOp = debouncer.debounce(key, () => {
                  totalOperations++;

                  // Simulate operation that might cause ResizeObserver error
                  const operation = withResizeObserverErrorSuppression(() => {
                    toggleContainerImperatively({
                      containerId: `stress_container_${keyIndex}`,
                      visualizationState: state,
                      enablePerformanceMonitoring: false,
                    });

                    if (Math.random() > 0.8) {
                      throw new Error("ResizeObserver loop limit exceeded");
                    }
                  });

                  operation();
                });

                debouncedOp();
                resolve();
              }, i); // Rapid firing
            }),
          );
        }
      }

      const startTime = performance.now();
      await Promise.all(rapidOperations);

      // Wait for debounced operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const endTime = performance.now();

      console.log(
        `Debounced stress test completed in ${(endTime - startTime).toFixed(2)}ms`,
      );
      console.log(
        `Total debounced operations executed: ${totalOperations} (should be ~${operationKeys.length})`,
      );

      // Verify debouncing worked (should execute roughly once per key)
      expect(totalOperations).toBeLessThanOrEqual(operationKeys.length * 2); // Allow some variance
      expect(totalOperations).toBeGreaterThan(0);

      // Cleanup
      debouncer.destroy();

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });
  });

  describe("Edge Case Stress Testing", () => {
    it("should handle edge cases that commonly cause ResizeObserver loops", async () => {
      // Test edge cases that are known to cause issues
      const edgeCases = [
        // Rapid alternating operations
        async () => {
          for (let i = 0; i < 20; i++) {
            const operation = withResizeObserverErrorSuppression(() => {
              if (i % 2 === 0) {
                toggleContainerImperatively({
                  containerId: "stress_container_0",
                  visualizationState: state,
                  forceCollapsed: true,
                });
              } else {
                toggleContainerImperatively({
                  containerId: "stress_container_0",
                  visualizationState: state,
                  forceExpanded: true,
                });
              }

              // Simulate ResizeObserver error
              throw new Error("ResizeObserver loop limit exceeded");
            });

            operation();
          }
        },

        // Mixed operations with layout changes
        async () => {
          for (let i = 0; i < 15; i++) {
            const operation = withResizeObserverErrorSuppression(() => {
              // Container operation
              toggleContainerImperatively({
                containerId: `stress_container_${i % 5}`,
                visualizationState: state,
              });

              // Layout change
              state.updateRenderConfig({
                layoutAlgorithm: i % 2 === 0 ? "elk.layered" : "elk.force",
              });

              // Search operation
              clearSearchImperatively({
                visualizationState: state,
                inputRef: { current: { value: "" } as HTMLInputElement },
                setQuery: vi.fn(),
                setMatches: vi.fn(),
                setCurrentIndex: vi.fn(),
              });

              // Simulate ResizeObserver error
              if (i % 3 === 0) {
                throw new Error(
                  "ResizeObserver loop completed with undelivered notifications",
                );
              }
            });

            operation();
          }
        },
      ];

      // Execute all edge cases
      for (const edgeCase of edgeCases) {
        await edgeCase();
      }

      // Verify no ResizeObserver errors propagated
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i),
        }),
      );
    });
  });
});
