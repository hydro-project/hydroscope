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
  useNodesInitialized,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { edgeTypes } from "./edges/index.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import { JSONParser } from "../utils/JSONParser.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

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
      enableCollapse = true, // eslint-disable-line @typescript-eslint/no-unused-vars -- kept for future extensibility
      readOnly = false,
      initialLayoutAlgorithm = "layered",
      initialColorPalette,
      autoFitEnabled = true,
      onNodeClick,
      onContainerCollapse,
      onContainerExpand,
      onCollapseAll,
      onExpandAll,
      onVisualizationStateChange,
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
        console.log("[HydroscopeCore] Initializing core instances");

        // Create VisualizationState
        const visualizationState = new VisualizationState();

        // Create AsyncCoordinator
        const asyncCoordinator = new AsyncCoordinator();

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
        console.log("[HydroscopeCore] Creating JSONParser");
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

        console.log("[HydroscopeCore] Core instances initialized successfully");
      } catch (error) {
        console.error("[HydroscopeCore] Initialization error:", error);
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isLoading: false,
        }));
      }
    }, [initialLayoutAlgorithm]);

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
      console.log("[HydroscopeCore] Data parsing check:", {
        hasData: !!data,
        sameData: processedDataRef.current === data,
      });

      if (processedDataRef.current === data) {
        console.log("[HydroscopeCore] Skipping re-parse: same data");
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
          console.log(
            "[HydroscopeCore] Parsing data and updating visualization state",
          );

          // Validate data structure first
          validateData(data);

          // Parse JSON data into a new VisualizationState
          const parseResult = await jsonParserRef.current!.parseData(data);

          console.log("[HydroscopeCore] Data parsed successfully", {
            nodes: parseResult.stats.nodeCount,
            edges: parseResult.stats.edgeCount,
            containers: parseResult.stats.containerCount,
            warnings: parseResult.warnings.length,
            processingTime: parseResult.stats.processingTime,
          });

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
                console.log(
                  "[HydroscopeCore] Container interaction disabled in readOnly mode",
                );
                return;
              }

              try {
                console.log(
                  "[HydroscopeCore] Container interaction: starting AsyncCoordinator atomic pipeline for",
                  containerId,
                );

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
                console.log("[HydroscopeCore] Container state before click:", {
                  containerId,
                  wasCollapsed,
                });

                // Use AsyncCoordinator's atomic pipeline: State Change -> Layout -> ReactFlow
                if (state.asyncCoordinator) {
                  // Step 1: Queue container state change through AsyncCoordinator
                  const eventType = wasCollapsed
                    ? "container_expand"
                    : "container_collapse";
                  console.log(
                    `[HydroscopeCore] Queuing ${eventType} event through AsyncCoordinator`,
                  );

                  await state.asyncCoordinator.queueApplicationEvent({
                    type: eventType,
                    payload: {
                      containerId,
                      state: singleVisualizationState,
                      triggerValidation: false, // We'll handle ReactFlow update separately
                    },
                    timestamp: Date.now(),
                  });

                  // Step 2: RESET and Queue layout update
                  console.log(
                    "[HydroscopeCore] Clearing caches and queuing ELK layout through AsyncCoordinator",
                  );
                  // Clear ReactFlow caches first to reset parent relationships
                  // ReactFlowBridge is now stateless - no caches to clear

                  await state.asyncCoordinator.queueELKLayout(
                    singleVisualizationState,
                    elkBridgeRef.current!,
                  );

                  // Step 3: Update ReactFlow data
                  console.log(
                    "[HydroscopeCore] Updating ReactFlow data after atomic pipeline",
                  );
                  await updateReactFlowDataWithState(singleVisualizationState);

                  // Verify state change occurred
                  const containerAfter =
                    singleVisualizationState.getContainer(containerId);
                  const isCollapsedAfter = Boolean(containerAfter?.collapsed);
                  console.log(
                    "[HydroscopeCore] Container state after atomic pipeline:",
                    {
                      containerId,
                      wasCollapsed,
                      isCollapsedAfter,
                      stateChanged: wasCollapsed !== isCollapsedAfter,
                    },
                  );

                  // Call our callbacks based on the new state
                  if (wasCollapsed && !isCollapsedAfter) {
                    console.log(
                      "[HydroscopeCore] Calling onContainerExpand callback",
                    );
                    onContainerExpand?.(containerId, singleVisualizationState);
                  } else if (!wasCollapsed && isCollapsedAfter) {
                    console.log(
                      "[HydroscopeCore] Calling onContainerCollapse callback",
                    );
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

                  // Trigger auto-fit after container interaction completes
                  console.log(
                    "[HydroscopeCore] Setting shouldFitView=true after container interaction",
                  );
                  setState((prev) => ({ ...prev, shouldFitView: true }));

                  console.log(
                    "[HydroscopeCore] AsyncCoordinator atomic pipeline complete",
                  );
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
                console.log(
                  "[HydroscopeCore] Container operations often recover automatically, not showing error dialog",
                );
                // Don't show error dialog for container operations as they often recover automatically
              }
            };
          }

          // Atomic pipeline step 2: Trigger layout through AsyncCoordinator
          console.log(
            "[HydroscopeCore] Starting atomic pipeline: state change -> layout -> render",
          );
          if (state.asyncCoordinator) {
            try {
              console.log(
                "[HydroscopeCore] Pipeline step 2: Clearing caches and queuing ELK layout",
              );
              // Clear caches first to ensure fresh state
              // ReactFlowBridge is now stateless - no caches to clear

              await state.asyncCoordinator.queueELKLayout(
                singleVisualizationState,
                elkBridgeRef.current!,
              );
              console.log(
                "[HydroscopeCore] Pipeline step 2 complete: Layout queued and processed",
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
          console.log(
            "[HydroscopeCore] Pipeline step 3: Generating ReactFlow data",
          );
          await updateReactFlowDataWithState(singleVisualizationState);
          console.log(
            "[HydroscopeCore] Atomic pipeline complete: state -> layout -> render",
          );

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
    }, [data, state.visualizationState, state.asyncCoordinator, readOnly]);

    // Handle fit view when shouldFitView changes
    useEffect(() => {
      if (state.shouldFitView && reactFlowInstance) {
        // Only auto-fit if autoFitEnabled is true
        if (state.autoFitEnabled) {
          console.log(
            "[HydroscopeCore] 🔄 Triggering auto-fit (AutoFit enabled)",
          );

          // Use requestAnimationFrame to ensure ReactFlow has rendered
          requestAnimationFrame(() => {
            reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
          });
        } else {
          console.log(
            "[HydroscopeCore] 🔄 Skipping auto-fit (AutoFit disabled)",
          );
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
        console.log("[HydroscopeCore] 🔄 updateReactFlowDataWithState called");

        // Skip updates during drag operations to prevent jumping
        if (isDraggingRef.current) {
          console.log(
            "[HydroscopeCore] 🔄 Skipping ReactFlow update during drag operation",
          );
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
          console.log(
            "[HydroscopeCore] Updating ReactFlow data with specific state",
          );

          // ReactFlowBridge is now stateless - no caches to clear

          // Log container states before generating ReactFlow data
          const containers = visualizationState.visibleContainers;
          console.log(
            "[HydroscopeCore] Container states before ReactFlow generation:",
            containers.map((c) => ({
              id: c.id,
              collapsed: c.collapsed,
              childrenCount: c.children.size,
            })),
          );

          // Generate ReactFlow data with interaction handlers
          console.log("[HydroscopeCore] 🔄 Calling toReactFlowData on bridge");
          const newData = reactFlowBridgeRef.current.toReactFlowData(
            visualizationState,
            interactionHandlerRef.current,
          );
          console.log(
            "[HydroscopeCore] 🔄 Bridge returned data with",
            newData.nodes.length,
            "nodes",
          );

          // Log the generated ReactFlow nodes to see their types and states
          console.log(
            "[HydroscopeCore] Generated ReactFlow nodes:",
            newData.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              nodeType: n.data?.nodeType,
              collapsed: n.data?.collapsed,
              hasOnClick: !!n.data?.onClick,
            })),
          );

          setState((prev) => ({
            ...prev,
            reactFlowData: newData,
          }));

          // Auto-fit is now handled by the shouldFitView mechanism
          // This prevents jumping during updates while still allowing controlled auto-fit
          console.log(
            "[HydroscopeCore] 🔄 ReactFlow data updated - auto-fit handled by shouldFitView mechanism",
          );

          console.log(
            "[HydroscopeCore] ReactFlow data updated with specific state",
            {
              nodeCount: newData.nodes.length,
              edgeCount: newData.edges.length,
            },
          );
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
      [state.autoFitEnabled],
    );

    // Bulk operations with atomic state management and error handling
    const handleCollapseAll = useCallback(async () => {
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
        state.visualizationState.visibleContainers.forEach((container: any) => {
          initialContainerStates.set(container.id, container.collapsed);
        });

        console.log(
          "[HydroscopeCore] Starting collapseAll operation through AsyncCoordinator",
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
        console.log("[HydroscopeCore] Queuing ELK layout after collapseAll");
        // ReactFlowBridge is now stateless - no caches to clear

        await state.asyncCoordinator.queueELKLayout(
          state.visualizationState,
          elkBridgeRef.current!,
        );

        // Step 3: Single coordinated re-render
        console.log(
          "[HydroscopeCore] Updating ReactFlow data after collapseAll atomic pipeline",
        );
        await updateReactFlowDataWithState(state.visualizationState);

        console.log("[HydroscopeCore] CollapseAll atomic pipeline complete");

        // Call success callback
        onCollapseAll?.(state.visualizationState);
      } catch (error) {
        console.error(
          "[HydroscopeCore] Error in collapseAll operation, attempting rollback:",
          error,
        );

        // Attempt rollback to initial state
        try {
          console.log("[HydroscopeCore] Rolling back collapseAll operation");
          for (const [containerId, wasCollapsed] of initialContainerStates) {
            const container =
              state.visualizationState.getContainer(containerId);
            if (container && container.collapsed !== wasCollapsed) {
              if (wasCollapsed) {
                state.visualizationState.collapseContainer(containerId);
              } else {
                state.visualizationState.expandContainer(containerId);
              }
            }
          }

          // Re-render after rollback
          await updateReactFlowDataWithState(state.visualizationState);
          console.log("[HydroscopeCore] CollapseAll rollback completed");

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
    }, [
      state.visualizationState,
      state.asyncCoordinator,
      updateReactFlowDataWithState,
      handleError,
    ]);

    const handleExpandAll = useCallback(async () => {
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
        state.visualizationState.visibleContainers.forEach((container: any) => {
          initialContainerStates.set(container.id, container.collapsed);
        });

        console.log(
          "[HydroscopeCore] Starting expandAll operation through AsyncCoordinator",
        );

        // Trigger fit view for layout operations
        setState((prev) => ({ ...prev, shouldFitView: true }));

        // Step 1: Atomic bulk state changes through AsyncCoordinator
        await state.asyncCoordinator.expandAllContainers(
          state.visualizationState,
          {
            triggerLayout: false, // Don't trigger layout for individual containers
          },
        );

        // Step 2: Single coordinated re-layout after all state changes
        console.log("[HydroscopeCore] Queuing ELK layout after expandAll");
        // ReactFlowBridge is now stateless - no caches to clear

        await state.asyncCoordinator.queueELKLayout(
          state.visualizationState,
          elkBridgeRef.current!,
        );

        // Step 3: Single coordinated re-render
        console.log(
          "[HydroscopeCore] Updating ReactFlow data after expandAll atomic pipeline",
        );
        await updateReactFlowDataWithState(state.visualizationState);

        console.log("[HydroscopeCore] ExpandAll atomic pipeline complete");

        // Call success callback
        onExpandAll?.(state.visualizationState);
      } catch (error) {
        console.error(
          "[HydroscopeCore] Error in expandAll operation, attempting rollback:",
          error,
        );

        // Attempt rollback to initial state
        try {
          console.log("[HydroscopeCore] Rolling back expandAll operation");
          for (const [containerId, wasCollapsed] of initialContainerStates) {
            const container =
              state.visualizationState.getContainer(containerId);
            if (container && container.collapsed !== wasCollapsed) {
              if (wasCollapsed) {
                state.visualizationState.collapseContainer(containerId);
              } else {
                state.visualizationState.expandContainer(containerId);
              }
            }
          }

          // Re-render after rollback
          await updateReactFlowDataWithState(state.visualizationState);
          console.log("[HydroscopeCore] ExpandAll rollback completed");

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
    }, [
      state.visualizationState,
      state.asyncCoordinator,
      updateReactFlowDataWithState,
      handleError,
    ]);

    // Individual container operations with atomic state management and error handling
    const handleCollapse = useCallback(
      async (containerId: string) => {
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
          console.log(
            `[HydroscopeCore] Container ${containerId} is already collapsed`,
          );
          return;
        }

        const initialCollapsed = container.collapsed;
        try {
          console.log(
            `[HydroscopeCore] Starting collapse operation for container ${containerId}`,
          );

          // Step 1: Update container state
          state.visualizationState.collapseContainer(containerId);

          // Step 2: Queue layout update through AsyncCoordinator
          await state.asyncCoordinator.queueELKLayout(
            state.visualizationState,
            elkBridgeRef.current!,
          );

          // Step 3: Update ReactFlow data
          await updateReactFlowDataWithState(state.visualizationState);

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            console.log(
              `[HydroscopeCore] 🔄 EXPERIMENT: ReactFlow reset key changed from ${prev} to ${newKey} after container COLLAPSE`,
            );
            return newKey;
          });

          // Step 4: Trigger fit view for individual container operations
          setState((prev) => ({ ...prev, shouldFitView: true }));

          console.log(
            `[HydroscopeCore] Collapse operation complete for container ${containerId}`,
          );

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
              state.visualizationState.expandContainer(containerId);
              await updateReactFlowDataWithState(state.visualizationState);
            }
          } catch (rollbackError) {
            console.error(
              `[HydroscopeCore] Rollback failed for container ${containerId}:`,
              rollbackError,
            );
          }

          handleError(error as Error, `collapse container ${containerId}`);
        }
      },
      [
        state.visualizationState,
        state.asyncCoordinator,
        updateReactFlowDataWithState,
        handleError,
        onContainerCollapse,
      ],
    );

    const handleExpand = useCallback(
      async (containerId: string) => {
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
          console.log(
            `[HydroscopeCore] Container ${containerId} is already expanded`,
          );
          return;
        }

        const initialCollapsed = container.collapsed;
        try {
          console.log(
            `[HydroscopeCore] Starting expand operation for container ${containerId}`,
          );

          // Step 1: Update container state
          state.visualizationState.expandContainer(containerId);

          // Step 2: Queue layout update through AsyncCoordinator
          await state.asyncCoordinator.queueELKLayout(
            state.visualizationState,
            elkBridgeRef.current!,
          );

          // Step 3: Update ReactFlow data
          await updateReactFlowDataWithState(state.visualizationState);

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            console.log(
              `[HydroscopeCore] 🔄 EXPERIMENT: ReactFlow reset key changed from ${prev} to ${newKey} after container EXPAND`,
            );
            return newKey;
          });

          // Step 4: Trigger fit view for individual container operations
          setState((prev) => ({ ...prev, shouldFitView: true }));

          console.log(
            `[HydroscopeCore] Expand operation complete for container ${containerId}`,
          );

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
              state.visualizationState.collapseContainer(containerId);
              await updateReactFlowDataWithState(state.visualizationState);
            }
          } catch (rollbackError) {
            console.error(
              `[HydroscopeCore] Rollback failed for container ${containerId}:`,
              rollbackError,
            );
          }

          handleError(error as Error, `expand container ${containerId}`);
        }
      },
      [
        state.visualizationState,
        state.asyncCoordinator,
        updateReactFlowDataWithState,
        handleError,
        onContainerExpand,
      ],
    );

    const handleToggle = useCallback(
      async (containerId: string) => {
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

        console.log(
          `[HydroscopeCore] Toggling container ${containerId} from ${container.collapsed ? "collapsed" : "expanded"}`,
        );

        if (container.collapsed) {
          await handleExpand(containerId);
        } else {
          await handleCollapse(containerId);
        }
      },
      [state.visualizationState, handleExpand, handleCollapse],
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
          console.log(
            `[HydroscopeCore] Starting navigation to element ${elementId}`,
          );

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

          console.log(
            `[HydroscopeCore] Navigation to element ${elementId} completed successfully`,
          );
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
          console.log("[HydroscopeCore] fitView called via imperative handle");
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
      }),
      [
        readOnly,
        handleCollapseAll,
        handleExpandAll,
        handleCollapse,
        handleExpand,
        handleToggle,
        handleNavigateToElement,
        reactFlowInstance,
      ],
    );

    // Handle node clicks
    const handleNodeClick = useCallback(
      (event: React.MouseEvent, node: Node) => {
        try {
          console.log("[HydroscopeCore] Node clicked:", node.id);
          console.log("[HydroscopeCore] Node type:", node.type);
          console.log("[HydroscopeCore] Node data:", {
            nodeType: node.data?.nodeType,
            collapsed: node.data?.collapsed,
            hasOnClick: !!node.data?.onClick,
          });

          // Validate node data
          if (!node || !node.id) {
            console.warn("[HydroscopeCore] Invalid node clicked:", node);
            return;
          }

          // Check if this is a container node
          if (node.data && node.data.nodeType === "container") {
            console.log("[HydroscopeCore] Container node clicked:", node.id);

            // Call the container onClick handler if it exists (this will handle the state update and callbacks)
            if (node.data.onClick && typeof node.data.onClick === "function") {
              console.log("[HydroscopeCore] Calling container onClick handler");
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
      [
        onNodeClick,
        onContainerCollapse,
        onContainerExpand,
        state.visualizationState,
      ],
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
      (_event: React.MouseEvent, node: Node) => {
        if (readOnly) return;

        try {
          console.log(
            "[HydroscopeCore] Node drag start:",
            node.id,
            "- entering drag mode",
          );
          isDraggingRef.current = true;

          // Disable auto-fit during drag to respect user's manual positioning
          // Don't trigger a state update here to avoid re-renders during drag start
          console.log(
            "[HydroscopeCore] Drag mode active - preventing layout updates",
          );
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
          console.log(
            "[HydroscopeCore] Node drag stop:",
            node.id,
            "final position:",
            node.position,
          );
          isDraggingRef.current = false;

          // Keep auto-fit enabled but don't trigger automatic fit view
          // This allows ReactFlow's fit button to still work
          console.log(
            "[HydroscopeCore] Drag completed - ReactFlow fit button remains functional",
          );

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
            console.log(
              "[HydroscopeCore] AutoFit enabled - triggering fit view after drag completion",
            );
            setState((prev) => ({ ...prev, shouldFitView: true }));
          } else {
            console.log(
              "[HydroscopeCore] AutoFit disabled - no fit view after drag",
            );
          }
        } catch (error) {
          console.error("[HydroscopeCore] Error handling drag stop:", error);
          handleError(error as Error, "drag stop");
        }
      },
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
      console.log("[HydroscopeCore] Retrying after error");
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

    console.log(
      "[HydroscopeCore] Rendering ReactFlow with",
      state.reactFlowData.nodes.length,
      "nodes",
    );
    console.log(
      "[HydroscopeCore] Node types:",
      state.reactFlowData.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        nodeType: n.data?.nodeType,
      })),
    );

    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          position: "relative",
          pointerEvents: "auto",
        }}
        onClick={() => console.log("[HydroscopeCore] Container div clicked")}
      >
        <ReactFlow
          key={reactFlowResetKey} // EXPERIMENT: Force ReactFlow reset on container operations
          nodes={state.reactFlowData.nodes as Node[]}
          edges={state.reactFlowData.edges as any[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={() =>
            console.log(
              `[HydroscopeCore] 🔄 EXPERIMENT: ReactFlow initialized with key=${reactFlowResetKey}`,
            )
          }
          onNodeClick={readOnly ? undefined : handleNodeClick}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onNodeDragStart={readOnly ? undefined : handleNodeDragStart}
          onNodeDrag={readOnly ? undefined : handleNodeDrag}
          onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
          onPaneClick={
            readOnly
              ? undefined
              : () =>
                  console.log(
                    "[HydroscopeCore] Pane clicked - ReactFlow is receiving events",
                  )
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
