/**
 * HydroscopeCore - Minimal visualization component
 *
 * This component provides core graph visualization and interaction functionality
 * without UI enhancements like file upload, search panels, or styling controls.
 *
 * Key Features:
 * - Parse and render JSON input data
 * - Handle node selection, expansion, and collapse operations
 * - Support drag and drop for nodes and containers (when not in readOnly mode)
 * - Manage container state and visual feedback
 * - Provide error handling for invalid JSON
 * - Integrate with VisualizationState, ReactFlowBridge, and ELKBridge through AsyncCoordinator
 * - Ensure all ReactFlow and ELK operations are coordinated through AsyncCoordinator
 *
 * Architecture:
 * - Uses existing VisualizationState for data management
 * - All operations go through AsyncCoordinator for proper sequencing
 * - Atomic state change -> re-layout -> render pipeline
 * - Error boundaries for graceful failure handling
 * - Optimized drag handling with debouncing to prevent performance issues
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes, edgeTypes } from "../render/index.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import { JSONParser } from "../utils/JSONParser.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import type { RenderConfig } from "./Hydroscope.js";
import {
  DEFAULT_COLOR_PALETTE,
  DEFAULT_ELK_ALGORITHM,
} from "../shared/config.js";
import { withAsyncResizeObserverErrorSuppression } from "../utils/ResizeObserverErrorSuppression.js";

import type {
  HydroscopeData,
  ReactFlowData,
  ReactFlowNode,
} from "../types/core.js";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Imperative handle interface for HydroscopeCore component
 *
 * Provides methods that can be called imperatively on the component instance.
 */
export interface HydroscopeCoreHandle {
  /** Collapse all containers atomically */
  collapseAll: () => Promise<void>;

  /** Expand all containers atomically */
  expandAll: () => Promise<void>;

  /** Collapse a specific container */
  collapse: (containerId: string) => Promise<void>;

  /** Expand a specific container */
  expand: (containerId: string) => Promise<void>;

  /** Toggle a specific container between collapsed and expanded */
  toggle: (containerId: string) => Promise<void>;

  /** Trigger fit view */
  fitView: () => void;

  /** Navigate to element with automatic container expansion and viewport focus */
  navigateToElement: (elementId: string) => Promise<void>;

  /** Update render configuration through AsyncCoordinator */
  updateRenderConfig: (
    updates: Partial<Required<RenderConfig> & { layoutAlgorithm: string }>,
  ) => Promise<void>;

  /** Get the AsyncCoordinator instance for external operations */
  getAsyncCoordinator: () => AsyncCoordinator | null;

  /** Get the current VisualizationState instance */
  getVisualizationState: () => VisualizationState | null;
}

/**
 * Props interface for the HydroscopeCore component
 *
 * Provides minimal configuration options for core visualization functionality
 * without any UI enhancement features.
 */
export interface HydroscopeCoreProps {
  /** JSON data to visualize */
  data: HydroscopeData;

  /** Height of the visualization container */
  height?: string | number;

  /** Width of the visualization container */
  width?: string | number;

  /** Whether to show ReactFlow controls */
  showControls?: boolean;

  /** Whether to show minimap */
  showMiniMap?: boolean;

  /** Whether to show background pattern */
  showBackground?: boolean;

  /** Enable container collapse/expand */
  enableCollapse?: boolean;

  /** Read-only mode - disables all interactions including dragging, clicking, and container operations */
  readOnly?: boolean;

  /** Initial layout algorithm */
  initialLayoutAlgorithm?: string;

  /** Initial color palette */
  initialColorPalette?: string;

  /** Whether auto-fit is enabled (controlled by parent component) */
  autoFitEnabled?: boolean;

  /** Callback when node is clicked */
  onNodeClick?: (
    event: React.MouseEvent,
    node: { id: string; data?: unknown; position?: { x: number; y: number } },
    visualizationState?: VisualizationState,
  ) => void;

  /** Callback when container is collapsed */
  onContainerCollapse?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;

  /** Callback when container is expanded */
  onContainerExpand?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;

  /** Callback when bulk collapse all operation completes */
  onCollapseAll?: (visualizationState?: VisualizationState) => void;

  /** Callback when bulk expand all operation completes */
  onExpandAll?: (visualizationState?: VisualizationState) => void;

  /** Callback when visualization state changes (for InfoPanel integration) */
  onVisualizationStateChange?: (visualizationState: VisualizationState) => void;

  /** Callback when render config changes (for AsyncCoordinator processing) */
  onRenderConfigChange?: (
    updates: Partial<Required<RenderConfig> & { layoutAlgorithm: string }>,
  ) => void;

  /** Callback when error occurs */
  onError?: (error: Error) => void;

  /** Optional custom styling */
  className?: string;

  /** Optional style overrides */
  style?: React.CSSProperties;
}

/**
 * Internal state interface for the HydroscopeCore component
 *
 * Manages all component state including data, UI state, and coordination
 * with v6 architecture components.
 */
interface HydroscopeCoreState {
  /** V6 VisualizationState instance for graph operations */
  visualizationState: VisualizationState | null;

  /** V6 AsyncCoordinator for managing async operations */
  asyncCoordinator: AsyncCoordinator | null;

  /** ReactFlow data for rendering */
  reactFlowData: ReactFlowData;

  /** Error state */
  error: Error | null;

  /** Loading state */
  isLoading: boolean;

  /** Whether to enable auto-fit (disabled during drag operations) */
  autoFitEnabled: boolean;

  /** Whether to trigger a one-time fit view on next render */
  shouldFitView: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

// ============================================================================
// Internal ReactFlow Component
// ============================================================================

/**
 * Internal component that uses ReactFlow hooks
 * This component must be wrapped in ReactFlowProvider
 */
const HydroscopeCoreInternal = forwardRef<
  HydroscopeCoreHandle,
  HydroscopeCoreProps
>(
  (
    {
      data,
      height = "100%",
      width = "100%",
      showControls = true,
      showMiniMap = true,
      showBackground = true,
      enableCollapse = true, // eslint-disable-line unused-imports/no-unused-vars -- kept for future extensibility
      readOnly = false,
      initialLayoutAlgorithm = DEFAULT_ELK_ALGORITHM,
      initialColorPalette,
      autoFitEnabled = true,
      onNodeClick,
      onContainerCollapse,
      onContainerExpand,
      onCollapseAll,
      onExpandAll,
      onVisualizationStateChange,
      onRenderConfigChange,
      onError,
      className,
      style,
    },
    ref,
  ) => {
    // ReactFlow instance for programmatic control
    const reactFlowInstance = useReactFlow();

    // State management
    const [state, setState] = useState<HydroscopeCoreState>({
      visualizationState: null,
      asyncCoordinator: null,
      reactFlowData: { nodes: [], edges: [] },
      error: null,
      isLoading: true,
      autoFitEnabled: autoFitEnabled,
      shouldFitView: false,
    });

    // EXPERIMENT: ReactFlow reset key to force re-render on container operations
    const [reactFlowResetKey, setReactFlowResetKey] = useState(0);

    // Refs for core instances
    const reactFlowBridgeRef = useRef<ReactFlowBridge | null>(null);
    const elkBridgeRef = useRef<ELKBridge | null>(null);
    const interactionHandlerRef = useRef<InteractionHandler | null>(null);
    const jsonParserRef = useRef<JSONParser | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const prevNodeCountRef = useRef<number>(0);

    // Smart fitView debouncing to prevent ResizeObserver loops while allowing initial fitView
    const fitViewTimeoutRef = useRef<number | null>(null);
    const lastFitViewTimeRef = useRef<number>(0);
    const debouncedFitView = useCallback(() => {
      const now = Date.now();
      const timeSinceLastFitView = now - lastFitViewTimeRef.current;

      // If it's been more than 500ms since last fitView, allow immediate execution
      // Otherwise, debounce to prevent rapid calls
      if (timeSinceLastFitView > 500) {
        setState((prev) => ({ ...prev, shouldFitView: true }));
        lastFitViewTimeRef.current = now;
      } else {
        // Debounce rapid calls
        if (fitViewTimeoutRef.current) {
          clearTimeout(fitViewTimeoutRef.current);
        }

        fitViewTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, shouldFitView: true }));
          lastFitViewTimeRef.current = Date.now();
          fitViewTimeoutRef.current = null;
        }, 150) as unknown as number;
      }
    }, []);

    // Cleanup debounced fitView timeout on unmount
    useEffect(() => {
      return () => {
        if (fitViewTimeoutRef.current) {
          clearTimeout(fitViewTimeoutRef.current);
          fitViewTimeoutRef.current = null;
        }
      };
    }, []);

    // Error handling helper with recovery strategies
    const handleError = useCallback(
      (error: Error, context?: string) => {
        console.error(
          `[HydroscopeCore] Error${context ? ` in ${context}` : ""}:`,
          error,
        );

        // Enhanced error message based on context
        let userFriendlyMessage = error.message;

        if (context === "data parsing") {
          userFriendlyMessage = `Failed to parse visualization data: ${error.message}. Please check that your data is in the correct format.`;
        } else if (context === "layout") {
          userFriendlyMessage = `Layout calculation failed: ${error.message}. The visualization may not display correctly.`;
        } else if (context === "ReactFlow data update") {
          userFriendlyMessage = `Failed to update visualization: ${error.message}. Try refreshing the component.`;
        } else if (
          context === "container interaction" ||
          context === "node click"
        ) {
          userFriendlyMessage = `Interaction failed: ${error.message}. The element may be in an invalid state.`;
        }

        const enhancedError = new Error(userFriendlyMessage);
        enhancedError.stack = error.stack;

        setState((prev) => ({
          ...prev,
          error: enhancedError,
          isLoading: false,
        }));
        onError?.(enhancedError);
      },
      [onError],
    );

    // Initialize core instances
    useEffect(() => {
      try {
        // Create VisualizationState
        const visualizationState = new VisualizationState();

        // Initialize render config from props
        const initialRenderConfig = {
          edgeStyle: "bezier" as const,
          edgeWidth: 2,
          edgeDashed: false,
          nodePadding: 8,
          nodeFontSize: 12,
          containerBorderWidth: 2,
          colorPalette: initialColorPalette || DEFAULT_COLOR_PALETTE,
          layoutAlgorithm: initialLayoutAlgorithm || DEFAULT_ELK_ALGORITHM,
          fitView: true,
        };
        visualizationState.updateRenderConfig(initialRenderConfig);

        // Create AsyncCoordinator
        const asyncCoordinator = new AsyncCoordinator();

        // CRITICAL FIX: Set up callback to update React state when AsyncCoordinator generates new ReactFlow data
        let updateTimeout: number | null = null;
        asyncCoordinator.onReactFlowDataUpdate = (reactFlowData: any) => {
          // Throttle updates to prevent ResizeObserver loops
          if (updateTimeout) {
            clearTimeout(updateTimeout);
          }

          updateTimeout = setTimeout(() => {
            const networkNodes = reactFlowData.nodes.filter(
              (n: any) => n.id === "0" || n.id === "8",
            );
            if (networkNodes.length > 0) {
            }

            setState((prev) => ({
              ...prev,
              reactFlowData: reactFlowData,
            }));
            updateTimeout = null;
          }, 50) as unknown as number; // 50ms throttle to prevent ResizeObserver loops
        };

        // Create bridges
        reactFlowBridgeRef.current = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {},
        });

        elkBridgeRef.current = new ELKBridge({
          algorithm: initialLayoutAlgorithm,
        });

        // Create InteractionHandler
        interactionHandlerRef.current = new InteractionHandler(
          visualizationState,
          asyncCoordinator,
        );

        // Create JSONParser

        jsonParserRef.current = new JSONParser({
          debug: false,
          validateDuringParsing: true,
        });

        setState((prev) => ({
          ...prev,
          visualizationState,
          asyncCoordinator,
          error: null,
        }));
      } catch (error) {
        console.error("[HydroscopeCore] Initialization error:", error);
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isLoading: false,
        }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Remove initialLayoutAlgorithm dependency to prevent re-initialization

    // Validate JSON data structure
    const validateData = useCallback((data: HydroscopeData): void => {
      if (!data) {
        throw new Error("Data is required");
      }

      if (typeof data !== "object") {
        throw new Error("Data must be an object");
      }

      if (!Array.isArray(data.nodes)) {
        throw new Error("Data must contain a nodes array");
      }

      if (!Array.isArray(data.edges)) {
        throw new Error("Data must contain an edges array");
      }

      if (!Array.isArray(data.hierarchyChoices)) {
        throw new Error("Data must contain a hierarchyChoices array");
      }

      if (!data.nodeAssignments || typeof data.nodeAssignments !== "object") {
        throw new Error("Data must contain a nodeAssignments object");
      }

      // Basic validation of nodes
      data.nodes.forEach((node, index) => {
        if (!node.id) {
          throw new Error(
            `Node at index ${index} is missing required 'id' field`,
          );
        }
        // Check for either label, fullLabel, or shortLabel
        if (!node.label && !node.fullLabel && !node.shortLabel) {
          throw new Error(
            `Node '${node.id}' is missing label field (expected 'label', 'fullLabel', or 'shortLabel')`,
          );
        }
      });

      // Basic validation of edges
      data.edges.forEach((edge, index) => {
        if (!edge.id) {
          throw new Error(
            `Edge at index ${index} is missing required 'id' field`,
          );
        }
        if (!edge.source) {
          throw new Error(
            `Edge '${edge.id}' is missing required 'source' field`,
          );
        }
        if (!edge.target) {
          throw new Error(
            `Edge '${edge.id}' is missing required 'target' field`,
          );
        }
      });
    }, []);

    // Track if we've already processed this data to prevent infinite loops
    const processedDataRef = useRef<HydroscopeData | null>(null);

    // Parse data and update visualization state
    useEffect(() => {
      // Only proceed if we have data and all core instances are ready
      if (
        !data ||
        !state.visualizationState ||
        !state.asyncCoordinator ||
        !jsonParserRef.current
      ) {
        return;
      }

      // Prevent re-processing the same data
      // Use JSON comparison for hierarchy changes to detect reordered hierarchyChoices
      const dataString = JSON.stringify(data);
      const lastDataString = processedDataRef.current
        ? JSON.stringify(processedDataRef.current)
        : null;

      if (processedDataRef.current === data && dataString === lastDataString) {
        return;
      }

      const parseAndRender = async () => {
        try {
          // Mark this data as being processed
          processedDataRef.current = data;
          setState((prev) => ({
            ...prev,
            isLoading: true,
            error: null,
            autoFitEnabled: true,
          }));

          // Validate data structure first
          validateData(data);

          // Parse JSON data into a new VisualizationState
          const parseResult = await jsonParserRef.current!.parseData(data);

          // Log any warnings from parsing
          if (parseResult.warnings.length > 0) {
            console.warn(
              "[HydroscopeCore] Parsing warnings:",
              parseResult.warnings,
            );
          }

          // Validate that we got some data
          if (parseResult.stats.nodeCount === 0) {
            throw new Error(
              "No valid nodes found in the data. Please check that your data contains valid node definitions.",
            );
          }

          // Warn about potential issues but don't fail
          if (parseResult.stats.edgeCount === 0) {
            console.warn(
              "[HydroscopeCore] No edges found in data - visualization will only show nodes",
            );
          }

          if (parseResult.stats.containerCount === 0) {
            console.warn(
              "[HydroscopeCore] No containers found in data - nodes will not be grouped",
            );
          }

          // Replace our visualization state with the parsed one
          // This ensures we get all the properly parsed and validated data
          // IMPORTANT: This is the ONLY VisualizationState instance we should use
          const singleVisualizationState = parseResult.visualizationState;

          setState((prev) => ({
            ...prev,
            visualizationState: singleVisualizationState,
          }));

          // Notify parent component of visualization state change (for InfoPanel integration)
          onVisualizationStateChange?.(singleVisualizationState);

          // Update the interaction handler with the SAME visualization state instance
          if (state.asyncCoordinator) {
            // Create a custom interaction handler that calls our callbacks
            interactionHandlerRef.current = new InteractionHandler(
              singleVisualizationState,
              state.asyncCoordinator,
            );

            // Override the container click handler to use AsyncCoordinator's atomic pipeline
            interactionHandlerRef.current.handleContainerClick = async (
              containerId: string,
              _position?: { x: number; y: number },
            ) => {
              // Skip container interactions in readOnly mode
              if (readOnly) {
                return;
              }

              try {
                // Validate container exists
                if (!containerId || !containerId.trim()) {
                  console.warn(
                    "[HydroscopeCore] Invalid container ID:",
                    containerId,
                  );
                  return;
                }

                // Get container state before the click
                const container =
                  singleVisualizationState.getContainer(containerId);
                if (!container) {
                  console.warn(
                    "[HydroscopeCore] Container not found:",
                    containerId,
                  );
                  return;
                }

                const wasCollapsed = Boolean(container.collapsed);

                // Use AsyncCoordinator's atomic pipeline: State Change -> Layout -> ReactFlow
                if (state.asyncCoordinator) {
                  // Step 1: Queue container state change through AsyncCoordinator
                  const eventType = wasCollapsed
                    ? "container_expand"
                    : "container_collapse";

                  await state.asyncCoordinator.queueApplicationEvent({
                    type: eventType,
                    payload: {
                      containerId,
                      state: singleVisualizationState,
                      triggerValidation: false, // We'll handle ReactFlow update separately
                    },
                    timestamp: Date.now(),
                  });

                  // Step 2: Queue layout update

                  await state.asyncCoordinator.queueELKLayout(
                    singleVisualizationState,
                    elkBridgeRef.current!,
                  );

                  // Step 3: Update ReactFlow data

                  await updateReactFlowDataWithState(singleVisualizationState);

                  // Verify state change occurred
                  const containerAfter =
                    singleVisualizationState.getContainer(containerId);
                  const isCollapsedAfter = Boolean(containerAfter?.collapsed);

                  // Call our callbacks based on the new state
                  if (wasCollapsed && !isCollapsedAfter) {
                    onContainerExpand?.(containerId, singleVisualizationState);
                  } else if (!wasCollapsed && isCollapsedAfter) {
                    onContainerCollapse?.(
                      containerId,
                      singleVisualizationState,
                    );
                  } else {
                    console.warn(
                      "[HydroscopeCore] Container state did not change as expected",
                      { wasCollapsed, isCollapsedAfter },
                    );
                  }

                  // FIXED: Trigger auto-fit AFTER layout and ReactFlow update are complete
                  // Use requestAnimationFrame to ensure ReactFlow has rendered the new layout
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      debouncedFitView();
                    });
                  });
                } else {
                  console.error(
                    "[HydroscopeCore] AsyncCoordinator not available for container interaction",
                  );
                }
              } catch (error) {
                console.error(
                  "[HydroscopeCore] Error in AsyncCoordinator container pipeline:",
                  error,
                );
                // Don't show error dialog for container operations as they often recover automatically
              }
            };
          }

          // Atomic pipeline step 2: Trigger layout through AsyncCoordinator
          if (state.asyncCoordinator) {
            try {
              // Clear caches first to ensure fresh state
              // ReactFlowBridge is now stateless - no caches to clear

              await state.asyncCoordinator.queueELKLayout(
                singleVisualizationState,
                elkBridgeRef.current!,
              );
            } catch (layoutError) {
              console.warn(
                "[HydroscopeCore] Layout failed, continuing with default positions:",
                layoutError,
              );
              // Continue with rendering even if layout fails - nodes will use default positions
            }
          }

          // Atomic pipeline step 3: Generate ReactFlow data (render)
          await updateReactFlowDataWithState(singleVisualizationState);

          setState((prev) => ({
            ...prev,
            isLoading: false,
            shouldFitView: true, // Trigger initial fit view
          }));
        } catch (error) {
          handleError(error as Error, "data parsing");
        }
      };

      parseAndRender();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, state.visualizationState, state.asyncCoordinator, readOnly]);

    // Handle fit view when shouldFitView changes with debouncing
    useEffect(() => {
      if (state.shouldFitView) {
        if (!reactFlowInstance) {
          return; // Don't reset shouldFitView, let it retry when reactFlowInstance becomes available
        }

        // Only auto-fit if autoFitEnabled is true
        if (state.autoFitEnabled) {
          // Use requestAnimationFrame to ensure ReactFlow has fully rendered
          // Reduced timeout since we have smarter debouncing at trigger level
          const fitViewTimeout = window.setTimeout(() => {
            requestAnimationFrame(() => {
              reactFlowInstance.fitView({
                padding: 0.15,
                duration: 300,
                includeHiddenNodes: false, // Only fit to visible nodes
              });
            });
          }, 50); // Reduced to 50ms since we have smarter debouncing

          // Cleanup timeout on unmount or dependency change
          return () => {
            clearTimeout(fitViewTimeout);
          };
        } else {
        }

        // Always reset the flag regardless of whether we fitted or not
        setState((prev) => ({ ...prev, shouldFitView: false }));
      }
    }, [state.shouldFitView, reactFlowInstance, state.autoFitEnabled]);

    // Update autoFitEnabled when prop changes
    useEffect(() => {
      setState((prev) => ({ ...prev, autoFitEnabled: autoFitEnabled }));
    }, [autoFitEnabled]);

    // Update ReactFlow data with a specific VisualizationState
    const updateReactFlowDataWithState = useCallback(
      async (visualizationState: VisualizationState) => {
        // Skip updates during drag operations to prevent jumping
        if (isDraggingRef.current) {
          return;
        }

        if (
          !visualizationState ||
          !reactFlowBridgeRef.current ||
          !interactionHandlerRef.current
        ) {
          console.warn(
            "[HydroscopeCore] Cannot update ReactFlow data - missing dependencies",
            {
              hasVisualizationState: !!visualizationState,
              hasReactFlowBridge: !!reactFlowBridgeRef.current,
              hasInteractionHandler: !!interactionHandlerRef.current,
            },
          );
          return;
        }

        try {
          // ReactFlowBridge is now stateless - no caches to clear

          // Log container states before generating ReactFlow data
          const _containers = visualizationState.visibleContainers;

          // Generate ReactFlow data with interaction handlers
          const newData = reactFlowBridgeRef.current.toReactFlowData(
            visualizationState,
            interactionHandlerRef.current,
          );

          // Log the generated ReactFlow nodes to see their types and states

          // CRITICAL DEBUG: Log container states in the final ReactFlow data
          const containerNodes = newData.nodes.filter(
            (n) => n.type === "container",
          );
          for (const _container of containerNodes) {
            // Container processing logic would go here if needed
          }

          // Debug: Log what data is being set in state
          const networkNodes = newData.nodes.filter(
            (n: any) => n.id === "0" || n.id === "8",
          );
          if (networkNodes.length > 0) {
          }

          setState((prev) => ({
            ...prev,
            reactFlowData: newData,
          }));

          // Auto-fit is now handled by the shouldFitView mechanism
          // This prevents jumping during updates while still allowing controlled auto-fit
        } catch (error) {
          console.error(
            "[HydroscopeCore] Error updating ReactFlow data:",
            error,
          );
          setState((prev) => ({
            ...prev,
            error: error as Error,
            isLoading: false,
          }));
        }
      },
      [],
    );

    // Track previous layout algorithm to avoid unnecessary re-layouts during initialization
    const prevLayoutAlgorithmRef = useRef<string>(initialLayoutAlgorithm);

    // Handle layout algorithm changes - must go through AsyncCoordinator
    useEffect(() => {
      const prevAlgorithm = prevLayoutAlgorithmRef.current;

      // Only trigger if the algorithm actually changed (not just a re-render)
      if (prevAlgorithm === initialLayoutAlgorithm) {
        return;
      }

      // Update the previous algorithm reference immediately to prevent re-triggers
      prevLayoutAlgorithmRef.current = initialLayoutAlgorithm;

      // Only proceed if we have all dependencies AND data has been loaded
      if (
        elkBridgeRef.current &&
        state.visualizationState &&
        state.asyncCoordinator &&
        !state.isLoading
      ) {
        // Verify that the VisualizationState has data before proceeding
        const hasData =
          state.visualizationState.visibleContainers.length > 0 ||
          state.visualizationState.visibleNodes.length > 0;

        if (!hasData) {
          return;
        }

        try {
          // Update ELKBridge configuration
          elkBridgeRef.current.updateConfiguration({
            algorithm: initialLayoutAlgorithm,
          });

          // Trigger a new layout with the updated algorithm through AsyncCoordinator
          const triggerLayoutWithNewAlgorithm = async () => {
            try {
              await state.asyncCoordinator!.queueELKLayout(
                state.visualizationState!,
                elkBridgeRef.current!,
              );

              // Update ReactFlow data after layout
              await updateReactFlowDataWithState(state.visualizationState!);

              // Trigger auto-fit after layout change
              setState((prev) => ({ ...prev, shouldFitView: true }));
            } catch (error) {
              console.error(
                `[HydroscopeCore] ❌ Error during layout recalculation:`,
                error,
              );
              handleError(error as Error, "layout algorithm change");
            }
          };

          triggerLayoutWithNewAlgorithm();
        } catch (error) {
          console.error(
            `[HydroscopeCore] ❌ Error updating layout algorithm:`,
            error,
          );
          handleError(error as Error, "layout algorithm update");
        }
      } else {
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      initialLayoutAlgorithm,
      state.visualizationState,
      state.asyncCoordinator,
      state.isLoading,
    ]);

    // Bulk operations with atomic state management and error handling
    const handleCollapseAll = useCallback(
      withAsyncResizeObserverErrorSuppression(async () => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot collapse all - missing dependencies",
          );
          return;
        }

        // Capture initial state for rollback
        const initialContainerStates = new Map();
        try {
          // Store initial container states for potential rollback
          state.visualizationState.visibleContainers.forEach(
            (container: any) => {
              initialContainerStates.set(container.id, container.collapsed);
            },
          );

          // Trigger fit view for layout operations
          setState((prev) => ({ ...prev, shouldFitView: true }));

          // Step 1: Atomic bulk state changes through AsyncCoordinator
          await state.asyncCoordinator.collapseAllContainers(
            state.visualizationState,
            {
              triggerLayout: false, // Don't trigger layout for individual containers
              triggerValidation: false, // We'll handle ReactFlow update separately
            },
          );

          // Step 2: Single coordinated re-layout after all state changes
          // ReactFlowBridge is now stateless - no caches to clear

          await state.asyncCoordinator.queueELKLayout(
            state.visualizationState,
            elkBridgeRef.current!,
          );

          // Step 3: Single coordinated re-render
          await updateReactFlowDataWithState(state.visualizationState);

          // Trigger fit view AFTER ReactFlow has rendered the collapsed layout
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              debouncedFitView();
            });
          });

          // Notify parent component of visualization state change
          onVisualizationStateChange?.(state.visualizationState);

          // Call success callback
          onCollapseAll?.(state.visualizationState);
        } catch (error) {
          console.error(
            "[HydroscopeCore] Error in collapseAll operation, attempting rollback:",
            error,
          );

          // Attempt rollback to initial state
          try {
            for (const [containerId, wasCollapsed] of initialContainerStates) {
              const container =
                state.visualizationState.getContainer(containerId);
              if (container && container.collapsed !== wasCollapsed) {
                if (wasCollapsed) {
                  await state.asyncCoordinator!.collapseContainer(
                    containerId,
                    state.visualizationState,
                    { triggerLayout: false },
                  );
                } else {
                  await state.asyncCoordinator!.expandContainer(
                    containerId,
                    state.visualizationState,
                    { triggerLayout: false },
                  );
                }
              }
            }

            // Re-render after rollback
            await updateReactFlowDataWithState(state.visualizationState);

            // Show user-friendly error message
            const rollbackError = new Error(
              `Bulk collapse operation failed and was rolled back: ${(error as Error).message}`,
            );
            handleError(rollbackError, "bulk collapse operation");
          } catch (rollbackError) {
            console.error("[HydroscopeCore] Rollback failed:", rollbackError);
            const compoundError = new Error(
              `Bulk collapse operation failed and rollback also failed. Please refresh the component. Original error: ${(error as Error).message}`,
            );
            handleError(compoundError, "bulk collapse operation");
          }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        updateReactFlowDataWithState,
        handleError,
      ],
    );

    const handleExpandAll = useCallback(
      withAsyncResizeObserverErrorSuppression(async () => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot expand all - missing dependencies",
          );
          return;
        }

        // Capture initial state for rollback
        const initialContainerStates = new Map();
        try {
          // Store initial container states for potential rollback
          state.visualizationState.visibleContainers.forEach(
            (container: any) => {
              initialContainerStates.set(container.id, container.collapsed);
            },
          );

          // Step 1: Atomic bulk state changes through AsyncCoordinator
          await state.asyncCoordinator.expandAllContainers(
            state.visualizationState,
            {
              triggerLayout: false, // Don't trigger layout for individual containers
            },
          );

          // Step 2: Single coordinated re-layout after all state changes
          // ReactFlowBridge is now stateless - no caches to clear

          await state.asyncCoordinator.queueELKLayout(
            state.visualizationState,
            elkBridgeRef.current!,
          );

          // Step 3: Single coordinated re-render
          await updateReactFlowDataWithState(state.visualizationState);

          // Trigger fit view AFTER ReactFlow has rendered the expanded layout
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              debouncedFitView();
            });
          });

          // Notify parent component of visualization state change
          onVisualizationStateChange?.(state.visualizationState);

          // Call success callback
          onExpandAll?.(state.visualizationState);
        } catch (error) {
          console.error(
            "[HydroscopeCore] Error in expandAll operation, attempting rollback:",
            error,
          );

          // Attempt rollback to initial state
          try {
            for (const [containerId, wasCollapsed] of initialContainerStates) {
              const container =
                state.visualizationState.getContainer(containerId);
              if (container && container.collapsed !== wasCollapsed) {
                if (wasCollapsed) {
                  await state.asyncCoordinator!.collapseContainer(
                    containerId,
                    state.visualizationState,
                    { triggerLayout: false },
                  );
                } else {
                  await state.asyncCoordinator!.expandContainer(
                    containerId,
                    state.visualizationState,
                    { triggerLayout: false },
                  );
                }
              }
            }

            // Re-render after rollback
            await updateReactFlowDataWithState(state.visualizationState);

            // Show user-friendly error message
            const rollbackError = new Error(
              `Bulk expand operation failed and was rolled back: ${(error as Error).message}`,
            );
            handleError(rollbackError, "bulk expand operation");
          } catch (rollbackError) {
            console.error("[HydroscopeCore] Rollback failed:", rollbackError);
            const compoundError = new Error(
              `Bulk expand operation failed and rollback also failed. Please refresh the component. Original error: ${(error as Error).message}`,
            );
            handleError(compoundError, "bulk expand operation");
          }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        updateReactFlowDataWithState,
        handleError,
      ],
    );

    // Individual container operations with atomic state management and error handling
    const handleCollapse = useCallback(
      withAsyncResizeObserverErrorSuppression(async (containerId: string) => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot collapse container - missing dependencies",
          );
          return;
        }

        const container = state.visualizationState.getContainer(containerId);
        if (!container) {
          console.warn(
            `[HydroscopeCore] Cannot collapse - container ${containerId} not found`,
          );
          return;
        }

        if (container.collapsed) {
          return;
        }

        const initialCollapsed = container.collapsed;
        try {
          // Use AsyncCoordinator's atomic collapse operation
          await state.asyncCoordinator.collapseContainer(
            containerId,
            state.visualizationState,
          );

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            return newKey;
          });

          // Step 4: Trigger fit view for individual container operations
          setState((prev) => ({ ...prev, shouldFitView: true }));

          // Call success callback
          onContainerCollapse?.(containerId, state.visualizationState);
        } catch (error) {
          console.error(
            `[HydroscopeCore] Error collapsing container ${containerId}:`,
            error,
          );

          // Attempt rollback
          try {
            if (container.collapsed !== initialCollapsed) {
              await state.asyncCoordinator.expandContainer(
                containerId,
                state.visualizationState,
                { triggerLayout: false },
              );
            }
          } catch (rollbackError) {
            console.error(
              `[HydroscopeCore] Rollback failed for container ${containerId}:`,
              rollbackError,
            );
          }

          handleError(error as Error, `collapse container ${containerId}`);
        }
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        handleError,
        onContainerCollapse,
      ],
    );

    const handleExpand = useCallback(
      withAsyncResizeObserverErrorSuppression(async (containerId: string) => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot expand container - missing dependencies",
          );
          return;
        }

        const container = state.visualizationState.getContainer(containerId);
        if (!container) {
          console.warn(
            `[HydroscopeCore] Cannot expand - container ${containerId} not found`,
          );
          return;
        }

        if (!container.collapsed) {
          return;
        }

        const initialCollapsed = container.collapsed;
        try {
          // Use AsyncCoordinator's atomic expand operation
          await state.asyncCoordinator.expandContainer(
            containerId,
            state.visualizationState,
          );

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            return newKey;
          });

          // Step 4: Trigger fit view for individual container operations
          setState((prev) => ({ ...prev, shouldFitView: true }));

          // Call success callback
          onContainerExpand?.(containerId, state.visualizationState);
        } catch (error) {
          console.error(
            `[HydroscopeCore] Error expanding container ${containerId}:`,
            error,
          );

          // Attempt rollback
          try {
            if (container.collapsed !== initialCollapsed) {
              await state.asyncCoordinator.collapseContainer(
                containerId,
                state.visualizationState,
                { triggerLayout: false },
              );
            }
          } catch (rollbackError) {
            console.error(
              `[HydroscopeCore] Rollback failed for container ${containerId}:`,
              rollbackError,
            );
          }

          handleError(error as Error, `expand container ${containerId}`);
        }
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        handleError,
        onContainerExpand,
      ],
    );

    const handleToggle = useCallback(
      withAsyncResizeObserverErrorSuppression(async (containerId: string) => {
        if (!state.visualizationState) {
          console.warn(
            "[HydroscopeCore] Cannot toggle container - missing VisualizationState",
          );
          return;
        }

        const container = state.visualizationState.getContainer(containerId);
        if (!container) {
          console.warn(
            `[HydroscopeCore] Cannot toggle - container ${containerId} not found`,
          );
          return;
        }

        if (container.collapsed) {
          await handleExpand(containerId);
        } else {
          await handleCollapse(containerId);
        }
      }),
      [state.visualizationState, handleExpand, handleCollapse],
    );

    // Handle render config updates through AsyncCoordinator
    const handleRenderConfigUpdate = useCallback(
      async (
        updates: Partial<Required<RenderConfig> & { layoutAlgorithm: string }>,
      ) => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot update render config: missing state or coordinator",
          );
          return;
        }

        try {
          // Update render config in VisualizationState
          state.visualizationState.updateRenderConfig(updates);

          // If layout algorithm changed, trigger ELK layout, otherwise just update ReactFlow data
          if (updates.layoutAlgorithm) {
            // Update ELK bridge configuration and trigger layout
            if (elkBridgeRef.current) {
              elkBridgeRef.current.updateConfiguration({
                algorithm: updates.layoutAlgorithm,
              });

              await state.asyncCoordinator.queueELKLayout(
                state.visualizationState,
                elkBridgeRef.current,
              );
            } else {
              console.error(
                `[HydroscopeCore] ❌ ELK bridge not available for layout algorithm change`,
              );
            }
          } else {
            // For non-layout changes (like edge style, color palette), use AsyncCoordinator
            const newReactFlowData =
              await state.asyncCoordinator.queueRenderConfigUpdate(
                state.visualizationState,
                updates,
              );

            // Update ReactFlow component with new data
            if (newReactFlowData) {
              setState((prev) => ({
                ...prev,
                reactFlowData: newReactFlowData,
              }));
            }
          }

          // Notify parent component of the change
          onRenderConfigChange?.(updates);

          // Only force ReactFlow reset for edge style changes that require re-initialization
          // Color palette and other visual changes don't need a full reset
          if (updates.edgeStyle) {
            setReactFlowResetKey((prev) => {
              const newKey = prev + 1;
              return newKey;
            });
          } else {
          }
        } catch (error) {
          console.error(
            "[HydroscopeCore] ❌ Error updating render config:",
            error,
          );
          handleError(error as Error, "render config update");
        }
      },
      [
        state.visualizationState,
        state.asyncCoordinator,
        onRenderConfigChange,
        handleError,
        setReactFlowResetKey,
        elkBridgeRef,
      ],
    );

    // Navigation handler for tree-to-graph navigation
    const handleNavigateToElement = useCallback(
      async (elementId: string) => {
        if (!state.visualizationState || !state.asyncCoordinator) {
          console.warn(
            "[HydroscopeCore] Cannot navigate to element - missing dependencies",
          );
          return;
        }

        try {
          // Use AsyncCoordinator's navigateToElementWithErrorHandling method which handles:
          // 1. Automatic container expansion if element is not visible
          // 2. Navigation state update in VisualizationState
          // 3. Error handling and recovery
          const result =
            state.asyncCoordinator.navigateToElementWithErrorHandling(
              elementId,
              state.visualizationState,
              reactFlowInstance,
              {
                timeout: 10000, // 10 second timeout
                maxRetries: 1,
              },
            );

          if (!result.success) {
            throw new Error("Navigation failed with error handling");
          }
        } catch (error) {
          console.error(
            `[HydroscopeCore] Error navigating to element ${elementId}:`,
            error,
          );
          handleError(error as Error);
        }
      },
      [
        state.visualizationState,
        state.asyncCoordinator,
        reactFlowInstance,
        handleError,
      ],
    );

    // Expose bulk operations through imperative handle
    useImperativeHandle(
      ref,
      () => ({
        collapseAll: readOnly
          ? async () =>
              console.warn(
                "[HydroscopeCore] collapseAll disabled in readOnly mode",
              )
          : handleCollapseAll,
        expandAll: readOnly
          ? async () =>
              console.warn(
                "[HydroscopeCore] expandAll disabled in readOnly mode",
              )
          : handleExpandAll,
        collapse: readOnly
          ? async () =>
              console.warn(
                "[HydroscopeCore] collapse disabled in readOnly mode",
              )
          : handleCollapse,
        expand: readOnly
          ? async () =>
              console.warn("[HydroscopeCore] expand disabled in readOnly mode")
          : handleExpand,
        toggle: readOnly
          ? async () =>
              console.warn("[HydroscopeCore] toggle disabled in readOnly mode")
          : handleToggle,
        fitView: () => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
          } else {
            console.warn(
              "[HydroscopeCore] ReactFlow instance not available for fitView",
            );
          }
        },
        navigateToElement: readOnly
          ? async () =>
              console.warn(
                "[HydroscopeCore] navigateToElement disabled in readOnly mode",
              )
          : handleNavigateToElement,
        updateRenderConfig: handleRenderConfigUpdate,
        getAsyncCoordinator: () => state.asyncCoordinator,
        getVisualizationState: () => state.visualizationState,
      }),
      [
        readOnly,
        handleCollapseAll,
        handleExpandAll,
        handleCollapse,
        handleExpand,
        handleToggle,
        handleNavigateToElement,
        handleRenderConfigUpdate,
        reactFlowInstance,
        state.asyncCoordinator,
        state.visualizationState,
      ],
    );

    // Handle node clicks
    const handleNodeClick = useCallback(
      (event: React.MouseEvent, node: Node) => {
        try {
          // Validate node data
          if (!node || !node.id) {
            console.warn("[HydroscopeCore] Invalid node clicked:", node);
            return;
          }

          // Check if this is a container node
          if (node.data && node.data.nodeType === "container") {
            // Call the container onClick handler if it exists (this will handle the state update and callbacks)
            if (node.data.onClick && typeof node.data.onClick === "function") {
              node.data.onClick(node.id, "container");
            }

            // Don't call the callbacks here - they're handled by the container interaction handler
            // to avoid duplicate calls and state conflicts
          }

          // Always call the general node click callback
          if (onNodeClick) {
            onNodeClick(
              event,
              {
                id: node.id,
                data: node.data,
                position: node.position,
              },
              state.visualizationState || undefined,
            );
          }
        } catch (error) {
          console.error("[HydroscopeCore] Error handling node click:", error);
          console.error("[HydroscopeCore] Error handling node click:", error);
          setState((prev) => ({
            ...prev,
            error: error as Error,
            isLoading: false,
          }));
        }
      },
      [onNodeClick, state.visualizationState],
    );

    // Handle node changes (including drag operations)
    const handleNodesChange = useCallback(
      (changes: NodeChange[]) => {
        if (readOnly) {
          return;
        }

        try {
          // Apply all changes using ReactFlow's built-in function
          // This ensures proper handling of dragging, selection, and other node states
          setState((prev) => {
            const updatedNodes = applyNodeChanges(
              changes,
              prev.reactFlowData.nodes,
            ) as ReactFlowNode[];

            return {
              ...prev,
              reactFlowData: {
                ...prev.reactFlowData,
                nodes: updatedNodes,
              },
            };
          });
        } catch (error) {
          console.error("[HydroscopeCore] Error handling node changes:", error);
          handleError(error as Error, "node changes");
        }
      },
      [readOnly, handleError],
    );

    // Handle edge changes (required for ReactFlow controls to work properly)
    const handleEdgesChange = useCallback(
      (changes: EdgeChange[]) => {
        if (readOnly) {
          return;
        }

        try {
          setState((prev) => {
            const updatedEdges = applyEdgeChanges(
              changes,
              prev.reactFlowData.edges as any,
            ) as any;

            return {
              ...prev,
              reactFlowData: {
                ...prev.reactFlowData,
                edges: updatedEdges,
              },
            };
          });
        } catch (error) {
          console.error("[HydroscopeCore] Error handling edge changes:", error);
          handleError(error as Error, "edge changes");
        }
      },
      [readOnly, handleError],
    );

    // Handle drag start
    const handleNodeDragStart = useCallback(
      (_event: React.MouseEvent, _node: Node) => {
        if (readOnly) return;

        try {
          isDraggingRef.current = true;

          // Disable auto-fit during drag to respect user's manual positioning
          // Don't trigger a state update here to avoid re-renders during drag start
        } catch (error) {
          console.error("[HydroscopeCore] Error handling drag start:", error);
        }
      },
      [readOnly],
    );

    // Handle drag (during drag) - keep minimal to avoid performance issues
    const handleNodeDrag = useCallback(
      (_event: React.MouseEvent, _node: Node) => {
        if (readOnly) return;
        // Minimal processing during drag to avoid performance issues
        // Position updates are handled by handleNodesChange
      },
      [readOnly],
    );

    // Handle drag stop
    const handleNodeDragStop = useCallback(
      (_event: React.MouseEvent, node: Node) => {
        if (readOnly) return;

        try {
          isDraggingRef.current = false;

          // Keep auto-fit enabled but don't trigger automatic fit view
          // This allows ReactFlow's fit button to still work

          // Update the visualization state with the new position
          if (state.visualizationState) {
            // Check if this is a container or regular node
            const isContainer = node.data?.nodeType === "container";

            if (isContainer) {
              // Update container position in visualization state
              const container = state.visualizationState.getContainer(node.id);
              if (container) {
                container.position = node.position;
              }
            } else {
              // Update regular node position in visualization state
              const graphNode = state.visualizationState.getGraphNode(node.id);
              if (graphNode) {
                graphNode.position = node.position;
              }
            }

            // Notify parent component of visualization state change
            onVisualizationStateChange?.(state.visualizationState);
          }

          // If AutoFit is enabled, trigger a fit view after drag completes
          // This ensures the dragged node remains visible and the view is optimally positioned
          if (state.autoFitEnabled) {
            setState((prev) => ({ ...prev, shouldFitView: true }));
          } else {
          }
        } catch (error) {
          console.error("[HydroscopeCore] Error handling drag stop:", error);
          handleError(error as Error, "drag stop");
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        readOnly,
        state.visualizationState,
        onVisualizationStateChange,
        handleError,
      ],
    );

    // Memoized container dimensions
    const containerStyle = useMemo(
      () => ({
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        ...style,
      }),
      [height, width, style],
    );

    // Retry mechanism
    const handleRetry = useCallback(() => {
      setState((prev) => ({ ...prev, error: null, isLoading: true }));
      // The useEffect will automatically re-run when error is cleared
    }, []);

    // Error state rendering
    if (state.error) {
      return (
        <div
          className={className}
          style={{
            ...containerStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            padding: "20px",
            color: "#d32f2f",
            backgroundColor: "#ffeaea",
            border: "1px solid #ffcdd2",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
            Visualization Error
          </h3>
          <p
            style={{
              margin: "0 0 15px 0",
              fontSize: "14px",
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            {state.error.message}
          </p>
          <button
            onClick={handleRetry}
            style={{
              padding: "8px 16px",
              backgroundColor: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    // Loading state rendering
    if (state.isLoading) {
      return (
        <div
          className={className}
          style={{
            ...containerStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            backgroundColor: "#f5f5f5",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid #e0e0e0",
                borderTop: "3px solid #1976d2",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 10px",
              }}
            />
            <p style={{ margin: "0", fontSize: "14px" }}>
              Loading visualization...
            </p>
          </div>
        </div>
      );
    }

    // Only log on significant changes to reduce console spam
    const nodeCount = state.reactFlowData.nodes.length;
    if (nodeCount !== prevNodeCountRef.current) {
      prevNodeCountRef.current = nodeCount;
    }

    return (
      <div
        className={className}
        data-testid="graph-container"
        style={{
          ...containerStyle,
          position: "relative",
          pointerEvents: "auto",
        }}
        onClick={() => {
          // Container div clicked
        }}
      >
        <ReactFlow
          key={reactFlowResetKey} // EXPERIMENT: Force ReactFlow reset on container operations
          nodes={state.reactFlowData.nodes as Node[]}
          edges={state.reactFlowData.edges as any[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={() => {
            // ReactFlow instance initialized
          }}
          onNodeClick={readOnly ? undefined : handleNodeClick}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onNodeDragStart={readOnly ? undefined : handleNodeDragStart}
          onNodeDrag={readOnly ? undefined : handleNodeDrag}
          onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
          onPaneClick={
            readOnly
              ? undefined
              : () => {
                  // Pane clicked
                }
          }
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.01}
          maxZoom={3}
          style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
        >
          {showBackground && <Background />}
          {showControls && (
            <>
              {/* Standard ReactFlow controls with zoom and fit view */}
              <Controls />
            </>
          )}
          {showMiniMap && <MiniMap />}
        </ReactFlow>

        {/* Node count display for e2e testing */}
        <div
          data-testid="node-count"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#666",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          {state.reactFlowData.nodes.length}
        </div>

        {/* CSS for loading spinner animation */}
        <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    );
  },
);

HydroscopeCoreInternal.displayName = "HydroscopeCoreInternal";

// ============================================================================
// Main HydroscopeCore Component
// ============================================================================

/**
 * HydroscopeCore - Minimal visualization component
 *
 * Provides core graph visualization and interaction functionality without
 * UI enhancements. Must be provided with JSON data to visualize.
 */
export const HydroscopeCore = memo(
  forwardRef<HydroscopeCoreHandle, HydroscopeCoreProps>((props, ref) => {
    return (
      <ErrorBoundary
        fallback={(_, __, retry, ___) => (
          <div
            style={{
              height:
                typeof props.height === "number"
                  ? `${props.height}px`
                  : props.height || "100%",
              width:
                typeof props.width === "number"
                  ? `${props.width}px`
                  : props.width || "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d32f2f",
              backgroundColor: "#ffeaea",
              border: "1px solid #ffcdd2",
              borderRadius: "4px",
              padding: "20px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
                Component Error
              </h3>
              <p style={{ margin: "0 0 15px 0", fontSize: "14px" }}>
                An unexpected error occurred while rendering the visualization.
              </p>
              <button
                onClick={retry}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}
      >
        <ReactFlowProvider>
          <HydroscopeCoreInternal {...props} ref={ref} />
        </ReactFlowProvider>
      </ErrorBoundary>
    );
  }),
);

HydroscopeCore.displayName = "HydroscopeCore";
