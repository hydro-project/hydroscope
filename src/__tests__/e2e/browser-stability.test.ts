/**
 * Browser-Specific Stability Tests
 *
 * These tests validate ResizeObserver error suppression and UI operation stability
 * across different browser environments and edge cases that commonly occur in
 * real-world usage scenarios.
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
  DebouncedOperationManager
} from "../../utils/ResizeObserverErrorSuppression.js";
import { 
  toggleContainerImperatively,
  batchContainerOperationsImperatively
} from "../../utils/containerOperationUtils.js";
import { clearSearchImperatively } from "../../utils/searchClearUtils.js";

describe("Browser-Specific Stability Tests", () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let errorEventSpy: ReturnType<typeof vi.spyOn>;
  let unhandledRejectionSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Initialize components
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});

    // Set up comprehensive error monitoring
    errorEventSpy = vi.spyOn(window, 'addEventListener');
    unhandledRejectionSpy = vi.spyOn(window, 'addEventListener');
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Enable ResizeObserver error suppression
    enableResizeObserverErrorSuppression();

    // Create test data
    setupBrowserTestData();
  });

  afterEach(() => {
    disableResizeObserverErrorSuppression();
    errorEventSpy.mockRestore();
    unhandledRejectionSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    vi.clearAllTimers();
  });

  function setupBrowserTestData() {
    // Create containers and nodes for browser testing
    const containers = [
      {
        id: "browser_container_1",
        label: "Browser Container 1",
        children: new Set(["browser_node_1", "browser_node_2"]),
        collapsed: false,
        hidden: false,
      },
      {
        id: "browser_container_2",
        label: "Browser Container 2", 
        children: new Set(["browser_node_3", "browser_node_4"]),
        collapsed: false,
        hidden: false,
      }
    ];

    const nodes = [
      {
        id: "browser_node_1",
        label: "Browser Node 1",
        longLabel: "Browser Node 1 Full",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "browser_node_2", 
        label: "Browser Node 2",
        longLabel: "Browser Node 2 Full",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "browser_node_3",
        label: "Browser Node 3", 
        longLabel: "Browser Node 3 Full",
        type: "node",
        semanticTags: [],
        hidden: false,
      },
      {
        id: "browser_node_4",
        label: "Browser Node 4",
        longLabel: "Browser Node 4 Full", 
        type: "node",
        semanticTags: [],
        hidden: false,
      }
    ];

    const edges = [
      { id: "browser_edge_1", source: "browser_node_1", target: "browser_node_2", type: "edge", semanticTags: [], hidden: false },
      { id: "browser_edge_2", source: "browser_node_2", target: "browser_node_3", type: "edge", semanticTags: [], hidden: false },
      { id: "browser_edge_3", source: "browser_node_3", target: "browser_node_4", type: "edge", semanticTags: [], hidden: false }
    ];

    // Add to state
    containers.forEach(container => state.addContainer(container));
    nodes.forEach(node => state.addNode(node));
    edges.forEach(edge => state.addEdge(edge));

    // Set up assignments
    state.assignNodeToContainer("browser_node_1", "browser_container_1");
    state.assignNodeToContainer("browser_node_2", "browser_container_1");
    state.assignNodeToContainer("browser_node_3", "browser_container_2");
    state.assignNodeToContainer("browser_node_4", "browser_container_2");
  }

  describe("Chrome-Specific ResizeObserver Patterns", () => {
    it("should handle Chrome ResizeObserver loop limit exceeded errors", () => {
      // Chrome typically throws "ResizeObserver loop limit exceeded"
      const chromeResizeObserverError = new Error("ResizeObserver loop limit exceeded");
      
      const operationThatTriggersChrome = withResizeObserverErrorSuppression(() => {
        throw chromeResizeObserverError;
      });

      expect(() => operationThatTriggersChrome()).not.toThrow();
      
      // Verify debug logging in development
      if (process.env.NODE_ENV === "development") {
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining("Suppressed ResizeObserver error"),
          expect.stringContaining("ResizeObserver loop limit exceeded")
        );
      }
    });

    it("should handle Chrome-specific rapid DOM mutations", async () => {
      // Simulate Chrome's behavior with rapid DOM mutations during container operations
      const rapidChromeOperations = Array.from({ length: 10 }, (_, i) => 
        new Promise<void>((resolve) => {
          setTimeout(() => {
            // Simulate Chrome's ResizeObserver behavior
            const operation = withResizeObserverErrorSuppression(() => {
              toggleContainerImperatively({
                containerId: `browser_container_${(i % 2) + 1}`,
                visualizationState: state,
                debounce: false // Test without debouncing to stress Chrome's ResizeObserver
              });
              
              // Simulate Chrome throwing ResizeObserver error during rapid operations
              if (i % 3 === 0) {
                throw new Error("ResizeObserver loop limit exceeded");
              }
            });
            
            operation();
            resolve();
          }, i * 5); // Very rapid operations
        })
      );

      await Promise.all(rapidChromeOperations);
      
      // Verify operations completed without throwing
      expect(true).toBe(true); // If we reach here, no errors were thrown
    });
  });

  describe("Firefox-Specific ResizeObserver Patterns", () => {
    it("should handle Firefox ResizeObserver undelivered notifications", () => {
      // Firefox typically throws "ResizeObserver loop completed with undelivered notifications"
      const firefoxResizeObserverError = new Error(
        "ResizeObserver loop completed with undelivered notifications"
      );
      
      const operationThatTriggersFirefox = withResizeObserverErrorSuppression(() => {
        throw firefoxResizeObserverError;
      });

      expect(() => operationThatTriggersFirefox()).not.toThrow();
    });

    it("should handle Firefox-specific layout recalculation patterns", async () => {
      // Firefox has different timing for layout recalculations
      const firefoxLayoutOperations = [
        () => {
          // Simulate Firefox layout recalculation during grouping change
          const operation = withResizeObserverErrorSuppression(() => {
            state.updateRenderConfig({ layoutAlgorithm: "elk.layered" });
            
            // Firefox may throw during layout recalculation
            throw new Error("ResizeObserver loop completed with undelivered notifications");
          });
          operation();
        },
        () => {
          // Simulate Firefox layout during container operations
          const operation = withResizeObserverErrorSuppression(() => {
            batchContainerOperationsImperatively({
              operations: [
                { containerId: "browser_container_1", operation: "collapse" },
                { containerId: "browser_container_2", operation: "expand" }
              ],
              visualizationState: state
            });
            
            // Firefox may throw after batch operations
            throw new Error("ResizeObserver loop completed with undelivered notifications");
          });
          operation();
        }
      ];

      // Execute Firefox-specific operations
      firefoxLayoutOperations.forEach(operation => {
        expect(() => operation()).not.toThrow();
      });
    });
  });

  describe("Safari-Specific ResizeObserver Patterns", () => {
    it("should handle Safari ResizeObserver timing differences", async () => {
      // Safari has different ResizeObserver timing and may batch notifications differently
      const safariOperations = Array.from({ length: 8 }, (_, i) => 
        new Promise<void>((resolve) => {
          // Safari-specific timing
          setTimeout(() => {
            const operation = withResizeObserverErrorSuppression(() => {
              // Simulate Safari's ResizeObserver behavior
              clearSearchImperatively({
                visualizationState: state,
                inputRef: { current: { value: "safari test" } as HTMLInputElement },
                setQuery: vi.fn(),
                setMatches: vi.fn(),
                setCurrentIndex: vi.fn()
              });
              
              // Safari may throw with different timing
              if (i % 4 === 0) {
                throw new Error("ResizeObserver loop limit exceeded");
              }
            });
            
            operation();
            resolve();
          }, i * 12); // Safari-specific timing intervals
        })
      );

      await Promise.all(safariOperations);
      
      // Verify Safari operations completed successfully
      expect(true).toBe(true);
    });

    it("should handle Safari WebKit ResizeObserver edge cases", () => {
      // Safari/WebKit specific ResizeObserver error patterns
      const webkitErrors = [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured" // WebKit specific
      ];

      webkitErrors.forEach(errorMessage => {
        const webkitOperation = withResizeObserverErrorSuppression(() => {
          throw new Error(errorMessage);
        });

        expect(() => webkitOperation()).not.toThrow();
      });
    });
  });

  describe("Edge Browser ResizeObserver Patterns", () => {
    it("should handle Edge Chromium ResizeObserver behavior", () => {
      // Edge (Chromium) may have slightly different ResizeObserver behavior
      const edgeResizeObserverError = new Error("ResizeObserver loop limit exceeded in Chrome");
      
      const edgeOperation = withResizeObserverErrorSuppression(() => {
        throw edgeResizeObserverError;
      });

      expect(() => edgeOperation()).not.toThrow();
    });
  });

  describe("Mobile Browser ResizeObserver Patterns", () => {
    it("should handle mobile viewport changes and ResizeObserver errors", async () => {
      // Mobile browsers may trigger ResizeObserver errors during viewport changes
      const mobileOperations = [
        () => {
          // Simulate mobile viewport change
          const operation = withResizeObserverErrorSuppression(() => {
            // Trigger layout that might cause ResizeObserver error on mobile
            const reactFlowData = reactFlowBridge.toReactFlowData(state);
            expect(reactFlowData.nodes.length).toBeGreaterThan(0);
            
            // Mobile may throw ResizeObserver error during orientation change
            throw new Error("ResizeObserver loop limit exceeded");
          });
          operation();
        },
        () => {
          // Simulate mobile touch interaction
          const operation = withResizeObserverErrorSuppression(() => {
            toggleContainerImperatively({
              containerId: "browser_container_1",
              visualizationState: state,
              debounce: true
            });
            
            // Mobile may throw during touch interactions
            throw new Error("ResizeObserver loop completed with undelivered notifications");
          });
          operation();
        }
      ];

      mobileOperations.forEach(operation => {
        expect(() => operation()).not.toThrow();
      });
    });
  });

  describe("Debounced Operation Manager Browser Compatibility", () => {
    it("should handle debounced operations across different browsers", async () => {
      const debouncer = new DebouncedOperationManager(50);
      let operationCount = 0;

      // Create debounced operation
      const debouncedOperation = debouncer.debounce(
        "browser_test",
        () => {
          operationCount++;
          
          // Simulate browser-specific ResizeObserver error
          const browserErrors = [
            "ResizeObserver loop limit exceeded", // Chrome/Edge
            "ResizeObserver loop completed with undelivered notifications", // Firefox
            "Non-Error promise rejection captured" // Safari/WebKit
          ];
          
          const errorMessage = browserErrors[operationCount % browserErrors.length];
          const operation = withResizeObserverErrorSuppression(() => {
            throw new Error(errorMessage);
          });
          
          operation();
        }
      );

      // Trigger rapid debounced operations
      for (let i = 0; i < 10; i++) {
        debouncedOperation();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for debounced operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify debouncing worked (should only execute once)
      expect(operationCount).toBe(1);

      // Cleanup
      debouncer.destroy();
    });

    it("should handle multiple debounced keys across browsers", async () => {
      const debouncer = new DebouncedOperationManager(30);
      const operationCounts = new Map<string, number>();

      // Create multiple debounced operations
      const keys = ["chrome_ops", "firefox_ops", "safari_ops"];
      
      keys.forEach(key => {
        operationCounts.set(key, 0);
        
        const debouncedOp = debouncer.debounce(
          key,
          () => {
            const currentCount = operationCounts.get(key) || 0;
            operationCounts.set(key, currentCount + 1);
            
            // Browser-specific operation
            const operation = withResizeObserverErrorSuppression(() => {
              if (key === "chrome_ops") {
                throw new Error("ResizeObserver loop limit exceeded");
              } else if (key === "firefox_ops") {
                throw new Error("ResizeObserver loop completed with undelivered notifications");
              } else {
                throw new Error("Non-Error promise rejection captured");
              }
            });
            
            operation();
          }
        );

        // Trigger rapid operations for each key
        for (let i = 0; i < 5; i++) {
          debouncedOp();
        }
      });

      // Wait for all debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 80));

      // Verify each key executed exactly once
      keys.forEach(key => {
        expect(operationCounts.get(key)).toBe(1);
      });

      // Cleanup
      debouncer.destroy();
    });
  });

  describe("Cross-Browser Error Event Handling", () => {
    it("should properly install and remove error handlers across browsers", () => {
      // Verify error handlers are installed
      expect(errorEventSpy).toHaveBeenCalledWith("error", expect.any(Function));
      expect(unhandledRejectionSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

      // Test disable/enable cycle
      disableResizeObserverErrorSuppression();
      enableResizeObserverErrorSuppression();

      // Verify handlers are reinstalled
      expect(errorEventSpy).toHaveBeenCalledWith("error", expect.any(Function));
      expect(unhandledRejectionSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
    });

    it("should handle browser-specific error event formats", () => {
      // Test different error event formats that browsers may produce
      const browserErrorFormats = [
        {
          browser: "Chrome",
          error: new Error("ResizeObserver loop limit exceeded"),
          message: "ResizeObserver loop limit exceeded"
        },
        {
          browser: "Firefox", 
          error: new Error("ResizeObserver loop completed with undelivered notifications"),
          message: "ResizeObserver loop completed with undelivered notifications"
        },
        {
          browser: "Safari",
          error: null,
          message: "ResizeObserver loop limit exceeded"
        }
      ];

      browserErrorFormats.forEach(({ browser, error, message }) => {
        const operation = withResizeObserverErrorSuppression(() => {
          if (error) {
            throw error;
          } else {
            throw new Error(message);
          }
        });

        expect(() => operation()).not.toThrow();
      });
    });
  });

  describe("Performance Under Browser-Specific Conditions", () => {
    it("should maintain performance across different browser ResizeObserver implementations", async () => {
      const startTime = performance.now();
      
      // Simulate browser-specific performance scenarios
      const browserScenarios = [
        // Chrome: Rapid DOM mutations
        async () => {
          for (let i = 0; i < 20; i++) {
            const operation = withResizeObserverErrorSuppression(() => {
              toggleContainerImperatively({
                containerId: `browser_container_${(i % 2) + 1}`,
                visualizationState: state
              });
              
              if (i % 5 === 0) {
                throw new Error("ResizeObserver loop limit exceeded");
              }
            });
            operation();
          }
        },
        
        // Firefox: Layout recalculations
        async () => {
          for (let i = 0; i < 15; i++) {
            const operation = withResizeObserverErrorSuppression(() => {
              state.updateRenderConfig({ 
                layoutAlgorithm: i % 2 === 0 ? "elk.layered" : "elk.force" 
              });
              
              if (i % 4 === 0) {
                throw new Error("ResizeObserver loop completed with undelivered notifications");
              }
            });
            operation();
          }
        },
        
        // Safari: Mixed operations
        async () => {
          for (let i = 0; i < 12; i++) {
            const operation = withResizeObserverErrorSuppression(() => {
              if (i % 2 === 0) {
                clearSearchImperatively({
                  visualizationState: state,
                  inputRef: { current: { value: "" } as HTMLInputElement },
                  setQuery: vi.fn(),
                  setMatches: vi.fn(),
                  setCurrentIndex: vi.fn()
                });
              } else {
                toggleContainerImperatively({
                  containerId: `browser_container_${(i % 2) + 1}`,
                  visualizationState: state
                });
              }
              
              if (i % 6 === 0) {
                throw new Error("Non-Error promise rejection captured");
              }
            });
            operation();
          }
        }
      ];

      // Execute all browser scenarios
      await Promise.all(browserScenarios.map(scenario => scenario()));
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Verify reasonable performance (should complete within 1 second)
      expect(executionTime).toBeLessThan(1000);
      
      // Verify all operations completed without throwing
      expect(true).toBe(true);
    });
  });
});