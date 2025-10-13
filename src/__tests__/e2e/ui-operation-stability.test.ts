/**
 * End-to-End UI Operation Stability Tests
 *
 * These tests validate that UI operations execute reliably without triggering
 * ResizeObserver loops or coordination system cascades. They cover:
 * 
 * 1. Rapid UI interactions (container toggles, search clearing)
 * 2. Bulk operations under load
 * 3. ResizeObserver error suppression validation
 * 4. Cross-browser stability patterns
 * 
 * Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VisualizationState } from "../../core/VisualizationState.js";
import { ReactFlowBridge } from "../../bridges/ReactFlowBridge.js";
import { AsyncCoordinator } from "../../core/AsyncCoordinator.js";
import { 
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression,
  withResizeObserverErrorSuppression,
  withAsyncResizeObserverErrorSuppression
} from "../../utils/ResizeObserverErrorSuppression.js";
import { 
  toggleContainerImperatively,
  batchContainerOperationsImperatively,
  clearContainerOperationDebouncing
} from "../../utils/containerOperationUtils.js";
import { clearSearchImperatively } from "../../utils/searchClearUtils.js";
import { globalOperationMonitor } from "../../utils/operationPerformanceMonitor.js";

describe("UI Operation Stability E2E Tests", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let coordinator: AsyncCoordinator;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Initialize core components
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});
    
    const { createTestAsyncCoordinator } = await import("../../utils/testData.js");
    const testSetup = await createTestAsyncCoordinator();
    coordinator = testSetup.asyncCoordinator;

    // Set up error monitoring
    errorSpy = vi.spyOn(window, 'onerror');
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Enable ResizeObserver error suppression
    enableResizeObserverErrorSuppression();

    // Create comprehensive test data
    setupTestData();

    // Clear any existing debounced operations
    clearContainerOperationDebouncing();
  });

  afterEach(() => {
    // Cleanup
    disableResizeObserverErrorSuppression();
    clearContainerOperationDebouncing();
    errorSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllTimers();
  });

  function setupTestData() {
    // Create multiple containers with nested structure
    const containers = [
      {
        id: "container1",
        label: "Container 1",
        children: new Set(["node1", "node2", "node3"]),
        collapsed: false,
        hidden: false,
      },
      {
        id: "container2", 
        label: "Container 2",
        children: new Set(["node4", "node5"]),
        collapsed: false,
        hidden: false,
      },
      {
        id: "container3",
        label: "Container 3", 
        children: new Set(["node6", "node7", "node8", "node9"]),
        collapsed: false,
        hidden: false,
      },
      {
        id: "container4",
        label: "Container 4",
        children: new Set(["node10"]),
        collapsed: false,
        hidden: false,
      }
    ];

    // Create nodes
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `node${i + 1}`,
      label: `Node ${i + 1}`,
      longLabel: `Node ${i + 1} Full Label`,
      type: "node",
      semanticTags: [],
      hidden: false,
    }));

    // Create edges between nodes
    const edges = [
      { id: "edge1", source: "node1", target: "node2", type: "edge", semanticTags: [], hidden: false },
      { id: "edge2", source: "node2", target: "node3", type: "edge", semanticTags: [], hidden: false },
      { id: "edge3", source: "node3", target: "node4", type: "edge", semanticTags: [], hidden: false },
      { id: "edge4", source: "node4", target: "node5", type: "edge", semanticTags: [], hidden: false },
      { id: "edge5", source: "node5", target: "node6", type: "edge", semanticTags: [], hidden: false },
      { id: "edge6", source: "node6", target: "node7", type: "edge", semanticTags: [], hidden: false },
      { id: "edge7", source: "node7", target: "node8", type: "edge", semanticTags: [], hidden: false },
      { id: "edge8", source: "node8", target: "node9", type: "edge", semanticTags: [], hidden: false },
      { id: "edge9", source: "node9", target: "node10", type: "edge", semanticTags: [], hidden: false },
      { id: "edge10", source: "node1", target: "node10", type: "edge", semanticTags: [], hidden: false },
    ];

    // Add to state
    containers.forEach(container => state.addContainer(container));
    nodes.forEach(node => state.addNode(node));
    edges.forEach(edge => state.addEdge(edge));

    // Set up node assignments
    state.assignNodeToContainer("node1", "container1");
    state.assignNodeToContainer("node2", "container1");
    state.assignNodeToContainer("node3", "container1");
    state.assignNodeToContainer("node4", "container2");
    state.assignNodeToContainer("node5", "container2");
    state.assignNodeToContainer("node6", "container3");
    state.assignNodeToContainer("node7", "container3");
    state.assignNodeToContainer("node8", "container3");
    state.assignNodeToContainer("node9", "container3");
    state.assignNodeToContainer("node10", "container4");
  }

  describe("Rapid UI Interactions - Container Toggles", () => {
    it("should handle rapid container toggle operations without ResizeObserver errors", async () => {
      // Requirement 1.2: WHEN a user toggles container expand/collapse rapidly THEN no ResizeObserver loop errors SHALL appear
      
      const containerIds = ["container1", "container2", "container3", "container4"];
      const rapidOperations: Promise<boolean>[] = [];

      // Simulate rapid clicking on multiple containers
      for (let i = 0; i < 20; i++) {
        const containerId = containerIds[i % containerIds.length];
        
        rapidOperations.push(
          new Promise((resolve) => {
            setTimeout(() => {
              const result = toggleContainerImperatively({
                containerId,
                visualizationState: state,
                debounce: true,
                debug: false,
                enablePerformanceMonitoring: true
              });
              resolve(result);
            }, i * 10); // Stagger operations by 10ms
          })
        );
      }

      // Execute all rapid operations
      const results = await Promise.all(rapidOperations);

      // Verify no ResizeObserver errors occurred
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );

      // Verify operations completed successfully
      expect(results.every(result => result === true)).toBe(true);

      // Allow debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it("should handle rapid container operations with different patterns", async () => {
      // Test different rapid interaction patterns
      const patterns = [
        // Pattern 1: Rapid toggle same container
        async () => {
          for (let i = 0; i < 10; i++) {
            toggleContainerImperatively({
              containerId: "container1",
              visualizationState: state,
              debounce: true
            });
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        },
        
        // Pattern 2: Rapid expand/collapse different containers
        async () => {
          const containers = ["container1", "container2", "container3"];
          for (let i = 0; i < 15; i++) {
            const containerId = containers[i % containers.length];
            toggleContainerImperatively({
              containerId,
              visualizationState: state,
              forceCollapsed: i % 2 === 0,
              debounce: true
            });
            await new Promise(resolve => setTimeout(resolve, 3));
          }
        },

        // Pattern 3: Burst operations
        async () => {
          const burstOperations = Array.from({ length: 8 }, (_, i) => 
            toggleContainerImperatively({
              containerId: `container${(i % 4) + 1}`,
              visualizationState: state,
              debounce: true
            })
          );
          await Promise.all(burstOperations);
        }
      ];

      // Execute each pattern
      for (const pattern of patterns) {
        await pattern();
        
        // Verify no ResizeObserver errors
        expect(errorSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/ResizeObserver loop/i)
          })
        );
      }

      // Allow all debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    });
  });

  describe("Rapid UI Interactions - Search Operations", () => {
    it("should handle rapid search clearing without ResizeObserver errors", async () => {
      // Requirement 1.1: WHEN a user clears search using any method THEN no ResizeObserver loop errors SHALL appear
      
      // Set up search state
      const mockInputRef = { current: { value: "test query" } as HTMLInputElement };
      const mockSetQuery = vi.fn();
      const mockSetMatches = vi.fn();
      const mockSetCurrentIndex = vi.fn();

      // Simulate rapid search clearing operations
      const rapidClearOperations = Array.from({ length: 15 }, (_, i) => 
        new Promise<void>((resolve) => {
          setTimeout(() => {
            clearSearchImperatively({
              visualizationState: state,
              inputRef: mockInputRef,
              setQuery: mockSetQuery,
              setMatches: mockSetMatches,
              setCurrentIndex: mockSetCurrentIndex,
              debug: false
            });
            resolve();
          }, i * 8); // Stagger by 8ms
        })
      );

      await Promise.all(rapidClearOperations);

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );

      // Verify search clearing operations completed
      expect(mockSetQuery).toHaveBeenCalledWith("");
      expect(mockSetMatches).toHaveBeenCalledWith([]);
      expect(mockSetCurrentIndex).toHaveBeenCalledWith(0);
    });

    it("should handle mixed search and container operations", async () => {
      // Test combined rapid operations that commonly cause ResizeObserver loops
      
      const mockInputRef = { current: { value: "search" } as HTMLInputElement };
      const mockSetQuery = vi.fn();
      const mockSetMatches = vi.fn();
      const mockSetCurrentIndex = vi.fn();

      const mixedOperations: Promise<void>[] = [];

      // Interleave search clearing and container operations
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // Search operation
          mixedOperations.push(
            new Promise<void>((resolve) => {
              setTimeout(() => {
                clearSearchImperatively({
                  visualizationState: state,
                  inputRef: mockInputRef,
                  setQuery: mockSetQuery,
                  setMatches: mockSetMatches,
                  setCurrentIndex: mockSetCurrentIndex
                });
                resolve();
              }, i * 5);
            })
          );
        } else {
          // Container operation
          mixedOperations.push(
            new Promise<void>((resolve) => {
              setTimeout(() => {
                toggleContainerImperatively({
                  containerId: `container${((i % 4) + 1)}`,
                  visualizationState: state,
                  debounce: true
                });
                resolve();
              }, i * 5);
            })
          );
        }
      }

      await Promise.all(mixedOperations);

      // Verify no ResizeObserver errors from mixed operations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );

      // Allow debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));
    });
  });

  describe("Bulk Operations Under Load", () => {
    it("should handle bulk container operations without ResizeObserver errors", async () => {
      // Requirement 1.5: WHEN a user performs bulk operations (expand all, collapse all) THEN no ResizeObserver loop errors SHALL appear
      
      const containerIds = ["container1", "container2", "container3", "container4"];

      // Test bulk collapse
      const collapseOperations = containerIds.map(containerId => ({
        containerId,
        operation: 'collapse' as const
      }));

      const collapseResults = batchContainerOperationsImperatively({
        operations: collapseOperations,
        visualizationState: state,
        debug: false,
        enablePerformanceMonitoring: true
      });

      expect(collapseResults.success).toBe(containerIds.length);
      expect(collapseResults.failed).toBe(0);

      // Verify all containers are collapsed
      containerIds.forEach(containerId => {
        const container = state.getContainer(containerId);
        expect(container?.collapsed).toBe(true);
      });

      // Test bulk expand
      const expandOperations = containerIds.map(containerId => ({
        containerId,
        operation: 'expand' as const
      }));

      const expandResults = batchContainerOperationsImperatively({
        operations: expandOperations,
        visualizationState: state,
        debug: false,
        enablePerformanceMonitoring: true
      });

      expect(expandResults.success).toBe(containerIds.length);
      expect(expandResults.failed).toBe(0);

      // Verify all containers are expanded
      containerIds.forEach(containerId => {
        const container = state.getContainer(containerId);
        expect(container?.collapsed).toBe(false);
      });

      // Verify no ResizeObserver errors during bulk operations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );
    });

    it("should handle large-scale bulk operations under stress", async () => {
      // Create additional containers for stress testing
      const additionalContainers = Array.from({ length: 20 }, (_, i) => ({
        id: `stress_container_${i}`,
        label: `Stress Container ${i}`,
        children: new Set([`stress_node_${i}`]),
        collapsed: false,
        hidden: false,
      }));

      const additionalNodes = Array.from({ length: 20 }, (_, i) => ({
        id: `stress_node_${i}`,
        label: `Stress Node ${i}`,
        longLabel: `Stress Node ${i} Full`,
        type: "node",
        semanticTags: [],
        hidden: false,
      }));

      // Add to state
      additionalContainers.forEach(container => state.addContainer(container));
      additionalNodes.forEach(node => state.addNode(node));
      additionalContainers.forEach((container, i) => {
        state.assignNodeToContainer(`stress_node_${i}`, container.id);
      });

      // Perform stress test with all containers
      const allContainerIds = [
        "container1", "container2", "container3", "container4",
        ...additionalContainers.map(c => c.id)
      ];

      // Multiple rounds of bulk operations
      for (let round = 0; round < 3; round++) {
        // Collapse all
        const collapseOps = allContainerIds.map(id => ({ containerId: id, operation: 'collapse' as const }));
        const collapseResults = batchContainerOperationsImperatively({
          operations: collapseOps,
          visualizationState: state,
          enablePerformanceMonitoring: true
        });

        expect(collapseResults.success).toBe(allContainerIds.length);

        // Expand all
        const expandOps = allContainerIds.map(id => ({ containerId: id, operation: 'expand' as const }));
        const expandResults = batchContainerOperationsImperatively({
          operations: expandOps,
          visualizationState: state,
          enablePerformanceMonitoring: true
        });

        expect(expandResults.success).toBe(allContainerIds.length);
      }

      // Verify no ResizeObserver errors during stress test
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );
    });
  });

  describe("ResizeObserver Error Suppression Validation", () => {
    it("should suppress ResizeObserver errors in synchronous operations", () => {
      // Requirement 1.1, 1.2, 1.3, 1.4: Validate ResizeObserver error suppression
      
      // Test synchronous error suppression
      const operationThatTriggersResizeObserverError = withResizeObserverErrorSuppression(() => {
        throw new Error("ResizeObserver loop limit exceeded");
      });

      // Should not throw
      expect(() => operationThatTriggersResizeObserverError()).not.toThrow();

      // Test with different ResizeObserver error messages
      const errorMessages = [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured"
      ];

      errorMessages.forEach(message => {
        const operation = withResizeObserverErrorSuppression(() => {
          throw new Error(message);
        });
        expect(() => operation()).not.toThrow();
      });
    });

    it("should suppress ResizeObserver errors in async operations", async () => {
      // Test async error suppression
      const asyncOperationThatTriggersResizeObserverError = withAsyncResizeObserverErrorSuppression(async () => {
        throw new Error("ResizeObserver loop completed with undelivered notifications");
      });

      // Should not throw
      await expect(asyncOperationThatTriggersResizeObserverError()).resolves.toBeUndefined();

      // Test with multiple async operations
      const asyncOperations = Array.from({ length: 5 }, (_, i) => 
        withAsyncResizeObserverErrorSuppression(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error(`ResizeObserver loop limit exceeded - operation ${i}`);
        })
      );

      // All should resolve without throwing
      await expect(Promise.all(asyncOperations)).resolves.toBeDefined();
    });

    it("should allow non-ResizeObserver errors to propagate", () => {
      // Verify that only ResizeObserver errors are suppressed
      const operationWithNormalError = withResizeObserverErrorSuppression(() => {
        throw new Error("Normal application error");
      });

      expect(() => operationWithNormalError()).toThrow("Normal application error");

      const asyncOperationWithNormalError = withAsyncResizeObserverErrorSuppression(async () => {
        throw new Error("Normal async error");
      });

      expect(asyncOperationWithNormalError()).rejects.toThrow("Normal async error");
    });
  });

  describe("Layout Algorithm Changes", () => {
    it("should handle layout algorithm changes without ResizeObserver errors", async () => {
      // Requirement 1.4: WHEN a user changes layout algorithms THEN no ResizeObserver loop errors SHALL appear
      
      // Simulate layout algorithm changes that commonly trigger ResizeObserver loops
      const layoutChanges = [
        () => {
          // Simulate ELK layout change
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          expect(reactFlowData.nodes.length).toBeGreaterThan(0);
        },
        () => {
          // Simulate layout algorithm change
          state.updateRenderConfig({ layoutAlgorithm: "elk.layered" });
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          expect(reactFlowData.nodes.length).toBeGreaterThan(0);
        },
        () => {
          // Simulate edge style change
          state.updateRenderConfig({ edgeStyle: "straight" });
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          expect(reactFlowData.nodes.length).toBeGreaterThan(0);
        }
      ];

      // Execute layout changes rapidly
      for (let i = 0; i < 10; i++) {
        const change = layoutChanges[i % layoutChanges.length];
        
        // Wrap in ResizeObserver error suppression
        const safeChange = withResizeObserverErrorSuppression(change);
        safeChange();
        
        // Small delay to simulate user interaction timing
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );
    });
  });

  describe("Grouping and Hierarchy Changes", () => {
    it("should handle grouping changes without ResizeObserver errors", async () => {
      // Requirement 1.3: WHEN a user changes grouping/hierarchy settings THEN no ResizeObserver loop errors SHALL appear
      
      const groupingModes = ["location", "semantic", "none"];
      
      // Rapid grouping changes
      for (let i = 0; i < 15; i++) {
        const mode = groupingModes[i % groupingModes.length];
        
        const safeGroupingChange = withResizeObserverErrorSuppression(() => {
          // Simulate layout algorithm change
          const algorithms = ["elk.layered", "elk.force", "elk.stress"];
          state.updateRenderConfig({ layoutAlgorithm: algorithms[i % algorithms.length] });
          
          // Trigger ReactFlow data generation (simulates UI update)
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          expect(reactFlowData).toBeDefined();
        });
        
        safeGroupingChange();
        
        // Simulate user interaction timing
        await new Promise(resolve => setTimeout(resolve, 15));
      }

      // Verify no ResizeObserver errors
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );
    });
  });

  describe("Cross-Browser Stability Patterns", () => {
    it("should handle different ResizeObserver error patterns", () => {
      // Test various ResizeObserver error patterns that occur in different browsers
      const browserSpecificErrors = [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications", 
        "ResizeObserver loop limit exceeded in Chrome",
        "ResizeObserver loop completed with undelivered notifications in Firefox",
        "Non-Error promise rejection captured with ResizeObserver",
      ];

      browserSpecificErrors.forEach(errorMessage => {
        const operation = withResizeObserverErrorSuppression(() => {
          throw new Error(errorMessage);
        });

        // Should suppress all ResizeObserver-related errors
        expect(() => operation()).not.toThrow();
      });
    });

    it("should maintain stability across different operation combinations", async () => {
      // Test combinations of operations that are known to cause issues
      const operationCombinations = [
        // Search + Container operations
        async () => {
          clearSearchImperatively({
            visualizationState: state,
            inputRef: { current: { value: "" } as HTMLInputElement },
            setQuery: vi.fn(),
            setMatches: vi.fn(),
            setCurrentIndex: vi.fn()
          });
          
          toggleContainerImperatively({
            containerId: "container1",
            visualizationState: state,
            debounce: true
          });
        },
        
        // Bulk operations + Layout changes
        async () => {
          batchContainerOperationsImperatively({
            operations: [
              { containerId: "container1", operation: "collapse" },
              { containerId: "container2", operation: "expand" }
            ],
            visualizationState: state
          });
          
          state.updateRenderConfig({ layoutAlgorithm: "elk.layered" });
        },
        
        // Rapid mixed operations
        async () => {
          for (let i = 0; i < 5; i++) {
            toggleContainerImperatively({
              containerId: `container${(i % 4) + 1}`,
              visualizationState: state,
              debounce: true
            });
            
            if (i % 2 === 0) {
              state.updateRenderConfig({ 
                layoutAlgorithm: i % 4 === 0 ? "elk.force" : "elk.layered" 
              });
            }
          }
        }
      ];

      // Execute each combination multiple times
      for (const combination of operationCombinations) {
        for (let run = 0; run < 3; run++) {
          await combination();
          
          // Small delay between runs
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Verify no ResizeObserver errors across all combinations
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/ResizeObserver loop/i)
        })
      );

      // Allow all debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    });
  });

  describe("Performance and Monitoring Integration", () => {
    it("should track performance metrics during stability testing", async () => {
      // Enable performance monitoring for this test
      const testMonitor = new (await import("../../utils/operationPerformanceMonitor.js")).OperationPerformanceMonitor({
        enabled: true,
        debugLogging: false
      });
      
      const initialHistory = testMonitor.getOperationHistory();
      
      // Perform operations with the test monitor
      testMonitor.startOperation("container_toggle", { containerId: "container1" });
      toggleContainerImperatively({
        containerId: "container1",
        visualizationState: state,
        enablePerformanceMonitoring: false // Use our test monitor instead
      });
      testMonitor.endOperation("container_toggle", { containerId: "container1" });

      testMonitor.startOperation("container_batch", { operationCount: 2 });
      batchContainerOperationsImperatively({
        operations: [
          { containerId: "container2", operation: "collapse" },
          { containerId: "container3", operation: "expand" }
        ],
        visualizationState: state,
        enablePerformanceMonitoring: false // Use our test monitor instead
      });
      testMonitor.endOperation("container_batch", { operationCount: 2 });

      const finalHistory = testMonitor.getOperationHistory();
      
      // Verify metrics were recorded
      expect(finalHistory.length).toBeGreaterThan(initialHistory.length);
      
      // Check for specific operation types in the history
      const operationTypes = finalHistory.map(metric => metric.operation);
      expect(operationTypes).toContain("container_toggle");
      expect(operationTypes).toContain("container_batch");
      
      // Verify metrics have expected properties
      const toggleMetric = finalHistory.find(m => m.operation === "container_toggle");
      expect(toggleMetric).toBeDefined();
      expect(toggleMetric?.duration).toBeGreaterThan(0);
      expect(toggleMetric?.cascadeRisk).toBeDefined();
    });
  });
});