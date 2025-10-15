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
  useUpdateNodeInternals,
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
import {
  createAutoFitOptions,
  createFitViewOptions,
  AutoFitScenarios,
} from "../utils/autoFitUtils.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { hscopeLogger } from "../utils/logger.js";
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

  /** Expand all containers atomically (or specific containers if IDs provided) */
  expandAll: (containerIds?: string[]) => Promise<void>;

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

  /** Force ReactFlow component to remount (clears all internal state including edge handles) */
  forceReactFlowRemount: () => void;

  /** Show popup for a specific node */
  showNodePopup: (nodeId: string) => void;
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

  /** Initial edge style */
  initialEdgeStyle?: "bezier" | "straight" | "smoothstep";

  /** Initial edge width */
  initialEdgeWidth?: number;

  /** Initial edge dashed setting */
  initialEdgeDashed?: boolean;

  /** Initial node padding */
  initialNodePadding?: number;

  /** Initial node font size */
  initialNodeFontSize?: number;

  /** Initial container border width */
  initialContainerBorderWidth?: number;

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
 * with v1.0.0 architecture components.
 */
interface HydroscopeCoreState {
  /** v1.0.0 VisualizationState instance for graph operations */
  visualizationState: VisualizationState | null;

  /** v1.0.0 AsyncCoordinator for managing async operations */
  asyncCoordinator: AsyncCoordinator | null;

  /** ReactFlow data for rendering */
  reactFlowData: ReactFlowData;

  /** Error state */
  error: Error | null;

  /** Loading state */
  isLoading: boolean;

  /** Whether to enable auto-fit (disabled during drag operations) */
  autoFitEnabled: boolean;

  /** Active popup nodes (nodeId -> popupNodeId mapping) */
  activePopups: Map<string, string>;
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
      readOnly = false,
      initialLayoutAlgorithm = DEFAULT_ELK_ALGORITHM,
      initialColorPalette,
      initialEdgeStyle = "bezier",
      initialEdgeWidth = 2,
      initialEdgeDashed = false,
      initialNodePadding = 8,
      initialNodeFontSize = 12,
      initialContainerBorderWidth = 2,
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
    const updateNodeInternals = useUpdateNodeInternals();

    // State management
    const [state, setState] = useState<HydroscopeCoreState>({
      visualizationState: null,
      asyncCoordinator: null,
      reactFlowData: { nodes: [], edges: [] },
      error: null,
      isLoading: true,
      autoFitEnabled: autoFitEnabled,
      activePopups: new Map(),
    });

    // EXPERIMENT: ReactFlow reset key to force re-render on container operations
    const [reactFlowResetKey, setReactFlowResetKey] = useState(0);
    const [isRemountingReactFlow, setIsRemountingReactFlow] = useState(false);

    // Refs for core instances
    const reactFlowBridgeRef = useRef<ReactFlowBridge | null>(null);
    const elkBridgeRef = useRef<ELKBridge | null>(null);
    const interactionHandlerRef = useRef<InteractionHandler | null>(null);
    const jsonParserRef = useRef<JSONParser | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const prevNodeCountRef = useRef<number>(0);
    const dimensionResetTimeoutRef = useRef<number | null>(null);
    const lastDimensionResetRef = useRef<number>(0);
    const recentContainerExpansionsRef = useRef<Set<string>>(new Set());
    const isRemountingRef = useRef<boolean>(false);
    const savedViewportRef = useRef<{
      x: number;
      y: number;
      zoom: number;
    } | null>(null);

    // Set ReactFlow instance in AsyncCoordinator for direct fitView operations
    useEffect(() => {
      if (reactFlowInstance && state.asyncCoordinator) {
        state.asyncCoordinator.setReactFlowInstance(reactFlowInstance);
        state.asyncCoordinator.setUpdateNodeInternals(updateNodeInternals);

        // Set up container expansion tracking callbacks
        state.asyncCoordinator.setContainerExpansionCallbacks(
          (containerId) => {
            // Mark container as being expanded
            recentContainerExpansionsRef.current.add(containerId);
          },
          (containerId) => {
            // Clear the tracking after expansion completes
            recentContainerExpansionsRef.current.delete(containerId);
          },
        );
      }
    }, [reactFlowInstance, updateNodeInternals, state.asyncCoordinator]);

    // Cleanup dimension reset timeout on unmount
    useEffect(() => {
      return () => {
        if (dimensionResetTimeoutRef.current) {
          clearTimeout(dimensionResetTimeoutRef.current);
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
          edgeStyle: initialEdgeStyle || "bezier",
          edgeWidth: initialEdgeWidth || 2,
          edgeDashed: initialEdgeDashed || false,
          nodePadding: initialNodePadding || 8,
          nodeFontSize: initialNodeFontSize || 12,
          containerBorderWidth: initialContainerBorderWidth || 2,
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

            setState((prev) => {
              // Preserve existing popup nodes when updating ReactFlow data
              const existingPopupNodes = prev.reactFlowData.nodes.filter(
                (n) => n.type === "popup",
              );
              const newNodes = [...reactFlowData.nodes, ...existingPopupNodes];

              return {
                ...prev,
                reactFlowData: {
                  ...reactFlowData,
                  nodes: newNodes,
                },
              };
            });
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

        // Pass bridge instances to AsyncCoordinator for direct imperative operations
        asyncCoordinator.setBridgeInstances(
          reactFlowBridgeRef.current,
          elkBridgeRef.current,
        );

        // CRITICAL FIX: Set React state setter for direct imperative updates
        asyncCoordinator.setReactStateSetter(setState);

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

    /**
     * Apply container click handler override to InteractionHandler
     * This ensures manual container clicks work properly through AsyncCoordinator
     */
    const applyContainerClickOverride = useCallback(
      (interactionHandler: any) => {
        if (!interactionHandler) return;

        // Override the container click handler to use AsyncCoordinator's synchronous methods
        // CRITICAL FIX: Use direct method override to bypass debouncing and prevent double-click issues

        interactionHandler.handleContainerClick = async (
          containerId: string,
          _position?: { x: number; y: number },
        ) => {
          // Skip container interactions in readOnly mode
          if (readOnly) {
            return;
          }

          // CRITICAL FIX: Prevent double-click by checking if we're already processing this container
          const processingKey = `container-${containerId}`;
          if (interactionHandler._processingContainers?.has(processingKey)) {
            // Silently ignore duplicate clicks while processing - this is expected behavior
            return;
          }

          // Mark container as being processed
          if (!interactionHandler._processingContainers) {
            interactionHandler._processingContainers = new Set();
          }
          interactionHandler._processingContainers.add(processingKey);

          try {
            // Validate container exists
            if (!containerId || !containerId.trim()) {
              console.warn(
                "[HydroscopeCore] Invalid container ID:",
                containerId,
              );
              return;
            }

            // Get the current VisualizationState
            const currentVisualizationState = state.visualizationState;
            if (!currentVisualizationState) {
              console.warn(
                "[HydroscopeCore] No VisualizationState available for container interaction",
              );
              return;
            }

            // Get container state before the click
            const container =
              currentVisualizationState.getContainer(containerId);
            if (!container) {
              console.warn(
                "[HydroscopeCore] Container not found:",
                containerId,
              );
              return;
            }

            const wasCollapsed = Boolean(container.collapsed);

            // Use AsyncCoordinator's synchronous container methods
            if (state.asyncCoordinator) {
              let reactFlowData;

              if (wasCollapsed) {
                // Synchronous expand - when it returns, the complete pipeline is done
                // Container expansion tracking is handled by AsyncCoordinator callbacks
                reactFlowData = await state.asyncCoordinator.expandContainer(
                  containerId,
                  currentVisualizationState,
                  {
                    relayoutEntities: undefined, // Full layout to let ELK recalculate positions
                    ...createFitViewOptions(
                      createAutoFitOptions(
                        AutoFitScenarios.CONTAINER_OPERATION,
                        state.autoFitEnabled,
                      ),
                    ),
                  },
                );
                // Call callback after synchronous operation completes
                onContainerExpand?.(containerId, currentVisualizationState);
              } else {
                // Synchronous collapse - when it returns, the complete pipeline is done
                reactFlowData = await state.asyncCoordinator.collapseContainer(
                  containerId,
                  currentVisualizationState,
                  {
                    relayoutEntities: undefined, // Full layout to let ELK recalculate positions
                    ...createFitViewOptions(
                      createAutoFitOptions(
                        AutoFitScenarios.CONTAINER_OPERATION,
                        state.autoFitEnabled,
                      ),
                    ),
                  },
                );
                // Call callback after synchronous operation completes
                onContainerCollapse?.(containerId, currentVisualizationState);
              }

              // At this point, the ENTIRE pipeline is complete:
              // - State change applied
              // - Layout calculated
              // - ReactFlow data generated and updated
              // - FitView triggered (if enabled)

              // Notify parent component of visualization state change
              onVisualizationStateChange?.(currentVisualizationState);

              hscopeLogger.log(
                "orchestrator",
                `[HydroscopeCore] Container ${wasCollapsed ? "expand" : "collapse"} operation completed`,
                { containerId, reactFlowData },
              );
            } else {
              console.error(
                "[HydroscopeCore] AsyncCoordinator not available for container interaction",
              );
            }
          } catch (error) {
            console.error(
              "[HydroscopeCore] Error in AsyncCoordinator container operation:",
              error,
            );
            handleError(error as Error, "container interaction");
          } finally {
            // Always remove the processing flag
            interactionHandler._processingContainers?.delete(processingKey);
          }
        };
      },
      [
        readOnly,
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        onContainerExpand,
        onContainerCollapse,
        onVisualizationStateChange,
        handleError,
      ],
    );

    /**
     * Unified data processing pipeline using AsyncCoordinator
     * This delegates all data processing logic to AsyncCoordinator for consistency
     */
    const processDataPipeline = useCallback(
      async (
        newData: HydroscopeData,
        reason: "initial_load" | "file_load" | "hierarchy_change" | "remount",
      ) => {
        if (
          !state.visualizationState ||
          !state.asyncCoordinator ||
          !jsonParserRef.current
        ) {
          console.warn(
            `[HydroscopeCore] Cannot process data: missing core instances`,
          );
          return;
        }

        try {
          // Mark this data as being processed
          processedDataRef.current = newData;
          setState((prev) => ({
            ...prev,
            isLoading: true,
            error: null,
            autoFitEnabled: true,
          }));

          // Update the interaction handler for the current state
          if (state.asyncCoordinator) {
            interactionHandlerRef.current = new InteractionHandler(
              state.visualizationState,
              state.asyncCoordinator,
            );

            // CRITICAL FIX: Apply container click override for manual container clicks
            applyContainerClickOverride(interactionHandlerRef.current);

            // CRITICAL FIX: Update AsyncCoordinator's InteractionHandler reference
            state.asyncCoordinator.setInteractionHandler(
              interactionHandlerRef.current,
            );
          }

          // Delegate to AsyncCoordinator's unified pipeline
          const reactFlowData = await state.asyncCoordinator.processDataChange(
            newData,
            state.visualizationState,
            jsonParserRef.current,
            reason,
            {
              ...createFitViewOptions(
                createAutoFitOptions(
                  reason === "initial_load"
                    ? AutoFitScenarios.INITIAL_LOAD
                    : reason === "remount"
                      ? AutoFitScenarios.STYLE_CHANGE // No fitView for remounts
                      : AutoFitScenarios.FILE_LOAD,
                  state.autoFitEnabled,
                ),
              ),
              validateData: validateData, // Pass validation function
              onVisualizationStateChange: onVisualizationStateChange, // Pass state change callback
            },
          );

          setState((prev) => ({
            ...prev,
            isLoading: false,
          }));

          return reactFlowData;
        } catch (error) {
          console.error(
            `[HydroscopeCore] Data processing failed for ${reason}:`,
            error,
          );

          // Enhanced error handling
          const errorMessage =
            error instanceof Error ? error.message : "Unknown pipeline error";

          const enhancedError = new Error(
            `Failed to process ${reason}: ${errorMessage}. The data may be invalid or the layout engine encountered an error.`,
          );
          enhancedError.stack =
            error instanceof Error ? error.stack : undefined;

          setState((prev) => ({
            ...prev,
            error: enhancedError,
            isLoading: false,
          }));

          onError?.(enhancedError);
        }
      },
      [
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        validateData,
        onVisualizationStateChange,
        onError,
        applyContainerClickOverride,
      ],
    );

    // Unified data processing effect - handles initial load, file load, and hierarchy changes
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

      // Determine the reason for data processing
      const isRemounting = isRemountingRef.current;
      const isInitialLoad = processedDataRef.current === null;
      const isHierarchyChange =
        processedDataRef.current !== null &&
        processedDataRef.current !== data &&
        dataString !== lastDataString;

      const reason = isRemounting
        ? "remount"
        : isInitialLoad
          ? "initial_load"
          : isHierarchyChange
            ? "hierarchy_change"
            : "file_load";

      // Clear remounting flag after determining reason
      if (isRemountingRef.current) {
        isRemountingRef.current = false;
      }

      // Use unified pipeline for ALL data processing - this includes smart collapse logic
      processDataPipeline(data, reason);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, processDataPipeline]);

    // Update autoFitEnabled when prop changes
    useEffect(() => {
      setState((prev) => ({ ...prev, autoFitEnabled: autoFitEnabled }));
    }, [autoFitEnabled]); // Remove state.autoFitEnabled from deps to avoid infinite loops

    // Manual ReactFlow data update method removed - replaced by AsyncCoordinator.executeLayoutAndRenderPipeline
    // All data updates now go through the unified orchestration pipeline for consistency

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

          // Use AsyncCoordinator's synchronous pipeline for layout algorithm change
          const executeLayoutChange = async () => {
            try {
              await state.asyncCoordinator!.executeLayoutAndRenderPipeline(
                state.visualizationState!,
                {
                  relayoutEntities: undefined, // Full layout for algorithm change
                  ...createFitViewOptions(
                    createAutoFitOptions(
                      AutoFitScenarios.LAYOUT_ALGORITHM_CHANGE,
                      state.autoFitEnabled,
                    ),
                  ),
                },
              );
            } catch (error) {
              console.error(
                `[HydroscopeCore] ❌ Error during layout recalculation:`,
                error,
              );
              handleError(error as Error, "layout algorithm change");
            }
          };

          executeLayoutChange();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleCollapseAll = useCallback(
      withAsyncResizeObserverErrorSuppression(async () => {
        if (
          !state.visualizationState ||
          !state.asyncCoordinator ||
          !elkBridgeRef.current
        ) {
          console.warn(
            "[HydroscopeCore] Cannot collapse all - missing dependencies",
          );
          return;
        }

        try {
          // Use AsyncCoordinator's synchronous collapseAllContainers method
          // When it returns, the complete pipeline is done (state change + layout + render + fitView)
          const reactFlowData =
            await state.asyncCoordinator.collapseAllContainers(
              state.visualizationState,
              {
                relayoutEntities: undefined, // Full layout for collapse all
                ...createFitViewOptions(
                  createAutoFitOptions(
                    AutoFitScenarios.CONTAINER_OPERATION,
                    state.autoFitEnabled,
                  ),
                ),
              },
            );

          // At this point, the ENTIRE pipeline is complete:
          // - All containers collapsed
          // - Layout calculated
          // - ReactFlow data generated and updated
          // - FitView triggered (if enabled)

          // Notify parent component of visualization state change AFTER a short delay
          // This ensures post-render callbacks (fitView) complete before triggering React re-renders
          const currentState = state.visualizationState;
          setTimeout(() => {
            onVisualizationStateChange?.(currentState);
          }, 0);

          // Call success callback
          onCollapseAll?.(currentState);

          hscopeLogger.log(
            "orchestrator",
            "[HydroscopeCore] Collapse all operation completed",
            {
              reactFlowData,
            },
          );
        } catch (error) {
          console.error(
            "[HydroscopeCore] Error in collapseAll operation:",
            error,
          );
          handleError(error as Error, "bulk collapse operation");
        }
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        onVisualizationStateChange,
        onCollapseAll,
        handleError,
      ],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleExpandAll = useCallback(
      withAsyncResizeObserverErrorSuppression(
        async (containerIds?: string[]) => {
          if (
            !state.visualizationState ||
            !state.asyncCoordinator ||
            !elkBridgeRef.current
          ) {
            console.warn(
              "[HydroscopeCore] Cannot expand all - missing dependencies",
            );
            return;
          }

          try {
            // Use AsyncCoordinator's synchronous expandAllContainers method
            // When it returns, the complete pipeline is done (state change + layout + render + fitView)
            // Can pass containerIds to expand only specific containers (e.g., for search)
            const reactFlowData =
              await state.asyncCoordinator.expandAllContainers(
                state.visualizationState,
                containerIds, // Pass container IDs if provided
                {
                  relayoutEntities: undefined, // Full layout for expand all
                  ...createFitViewOptions(
                    createAutoFitOptions(
                      AutoFitScenarios.CONTAINER_OPERATION,
                      state.autoFitEnabled,
                    ),
                  ),
                },
              );

            // At this point, the ENTIRE pipeline is complete:
            // - All containers expanded
            // - Layout calculated
            // - ReactFlow data generated and updated
            // - FitView triggered (if enabled)

            // Notify parent component of visualization state change AFTER a short delay
            // This ensures post-render callbacks (fitView) complete before triggering React re-renders
            const currentState = state.visualizationState;
            setTimeout(() => {
              onVisualizationStateChange?.(currentState);
            }, 0);

            // Call success callback
            onExpandAll?.(currentState);

            hscopeLogger.log(
              "orchestrator",
              "[HydroscopeCore] Expand all operation completed",
              {
                reactFlowData,
              },
            );
          } catch (error) {
            console.error(
              "[HydroscopeCore] Error in expandAll operation:",
              error,
            );
            handleError(error as Error, "bulk expand operation");
          }
        },
      ),
      [
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        onVisualizationStateChange,
        onExpandAll,
        handleError,
      ],
    );

    // Individual container operations with atomic state management and error handling
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleCollapse = useCallback(
      withAsyncResizeObserverErrorSuppression(async (containerId: string) => {
        if (
          !state.visualizationState ||
          !state.asyncCoordinator ||
          !elkBridgeRef.current
        ) {
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

        try {
          // Use AsyncCoordinator's synchronous collapseContainer method
          // When it returns, the complete pipeline is done (state change + layout + render + fitView)
          const reactFlowData = await state.asyncCoordinator.collapseContainer(
            containerId,
            state.visualizationState,
            {
              relayoutEntities: undefined, // Full layout to let ELK recalculate positions
              ...createFitViewOptions(
                createAutoFitOptions(
                  AutoFitScenarios.CONTAINER_OPERATION,
                  state.autoFitEnabled,
                ),
              ),
            },
          );

          // At this point, the ENTIRE pipeline is complete:
          // - Container collapsed
          // - Layout calculated
          // - ReactFlow data generated and updated
          // - FitView triggered (if enabled)

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            return newKey;
          });

          // Call success callback
          onContainerCollapse?.(containerId, state.visualizationState);

          hscopeLogger.log(
            "orchestrator",
            `[HydroscopeCore] Container collapse operation completed`,
            { containerId, reactFlowData },
          );
        } catch (error) {
          console.error(
            `[HydroscopeCore] Error collapsing container ${containerId}:`,
            error,
          );
          handleError(error as Error, `collapse container ${containerId}`);
        }
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        handleError,
        onContainerCollapse,
      ],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleExpand = useCallback(
      withAsyncResizeObserverErrorSuppression(async (containerId: string) => {
        if (
          !state.visualizationState ||
          !state.asyncCoordinator ||
          !elkBridgeRef.current
        ) {
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

        try {
          // Use AsyncCoordinator's synchronous expandContainer method
          // When it returns, the complete pipeline is done (state change + layout + render + fitView)
          // Container expansion tracking is handled by AsyncCoordinator callbacks
          const reactFlowData = await state.asyncCoordinator.expandContainer(
            containerId,
            state.visualizationState,
            {
              relayoutEntities: undefined, // Full layout to let ELK recalculate positions
              ...createFitViewOptions(
                createAutoFitOptions(
                  AutoFitScenarios.CONTAINER_OPERATION,
                  state.autoFitEnabled,
                ),
              ),
            },
          );

          // At this point, the ENTIRE pipeline is complete:
          // - Container expanded
          // - Layout calculated
          // - ReactFlow data generated and updated
          // - FitView triggered (if enabled)

          // EXPERIMENT: Force ReactFlow reset to work around floating edge bug
          setReactFlowResetKey((prev) => {
            const newKey = prev + 1;
            return newKey;
          });

          // Call success callback
          onContainerExpand?.(containerId, state.visualizationState);

          hscopeLogger.log(
            "orchestrator",
            `[HydroscopeCore] Container expand operation completed`,
            { containerId, reactFlowData },
          );
        } catch (error) {
          console.error(
            `[HydroscopeCore] Error expanding container ${containerId}:`,
            error,
          );
          handleError(error as Error, `expand container ${containerId}`);
        }
      }),
      [
        state.visualizationState,
        state.asyncCoordinator,
        state.autoFitEnabled,
        handleError,
        onContainerExpand,
      ],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
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

          // Use AsyncCoordinator's unified render config update pipeline
          const scenario = updates.layoutAlgorithm
            ? AutoFitScenarios.LAYOUT_ALGORITHM_CHANGE
            : AutoFitScenarios.STYLE_CHANGE;
          const autoFitOptions = createAutoFitOptions(scenario, autoFitEnabled); // Use prop directly instead of state
          const fitViewOptions = createFitViewOptions(autoFitOptions);

          await state.asyncCoordinator.updateRenderConfig(
            state.visualizationState,
            updates,
            {
              ...fitViewOptions,
              relayoutEntities: updates.layoutAlgorithm ? undefined : [], // Full layout for algorithm changes, render-only for visual changes
            },
          );

          // Notify parent component of the change
          onRenderConfigChange?.(updates);

          // ReactFlow reset is not needed for edge style changes - they're just CSS changes
          // Only reset ReactFlow for changes that require component re-initialization
          // Edge style, color palette, and other visual changes don't need a full reset
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
        autoFitEnabled,
        onRenderConfigChange,
        handleError,
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

    // Handle popup close
    const handlePopupClose = useCallback((nodeId: string) => {
      setState((prev) => {
        const newActivePopups = new Map(prev.activePopups);
        const popupId = newActivePopups.get(nodeId);

        if (popupId) {
          const updatedNodes = prev.reactFlowData.nodes.filter(
            (n) => n.id !== popupId,
          );
          newActivePopups.delete(nodeId);

          return {
            ...prev,
            activePopups: newActivePopups,
            reactFlowData: {
              ...prev.reactFlowData,
              nodes: updatedNodes,
            },
          };
        }

        return prev;
      });
    }, []);

    // Handle popup toggle for nodes
    const handleNodePopupToggle = useCallback(
      (nodeId: string, node: Node) => {
        setState((prev) => {
          const newActivePopups = new Map(prev.activePopups);
          const existingPopupId = newActivePopups.get(nodeId);

          hscopeLogger.log(
            "orchestrator",
            "[HydroscopeCore] Popup toggle state:",
            {
              existingPopupId,
              currentNodes: prev.reactFlowData.nodes.length,
            },
          );

          let updatedNodes = [...prev.reactFlowData.nodes];

          if (existingPopupId) {
            hscopeLogger.log(
              "orchestrator",
              "[HydroscopeCore] Removing existing popup:",
              existingPopupId,
            );
            // Remove existing popup
            updatedNodes = updatedNodes.filter((n) => n.id !== existingPopupId);
            newActivePopups.delete(nodeId);
          } else {
            // Add new popup
            const popupId = `popup-${nodeId}`;
            hscopeLogger.log(
              "orchestrator",
              "[HydroscopeCore] Creating new popup:",
              popupId,
            );

            const popupNode = {
              id: popupId,
              type: "popup",
              position: { ...node.position }, // Same position as original node
              data: {
                label: String(node.data.longLabel || node.data.label || nodeId),
                longLabel: String(node.data.longLabel || ""),
                nodeType: "popup",
                originalNodeType: String(
                  node.data.nodeType || node.type || "default",
                ),
                colorPalette: String(
                  node.data.colorPalette || DEFAULT_COLOR_PALETTE,
                ),
                onClose: (_popupNodeId: string) => handlePopupClose(nodeId),
              },
              // Set parent to same container as original node
              parentId: node.parentId,
              extent: node.extent || undefined,
              // Higher z-index to appear above original node
              zIndex: 1000,
            };

            updatedNodes.push(popupNode);
            newActivePopups.set(nodeId, popupId);
          }

          hscopeLogger.log("orchestrator", "[HydroscopeCore] Updated state:", {
            newActivePopupsSize: newActivePopups.size,
            updatedNodesLength: updatedNodes.length,
            popupNodes: updatedNodes
              .filter((n) => n.type === "popup")
              .map((n) => ({ id: n.id, type: n.type })),
          });

          return {
            ...prev,
            activePopups: newActivePopups,
            reactFlowData: {
              ...prev.reactFlowData,
              nodes: updatedNodes,
            },
          };
        });
      },
      [handlePopupClose],
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
        forceReactFlowRemount: () => {
          hscopeLogger.log(
            "orchestrator",
            "🔄 [HydroscopeCore] Forcing ReactFlow remount by incrementing reset key",
          );
          setReactFlowResetKey((prev) => prev + 1);
        },
        showNodePopup: (nodeId: string) => {
          hscopeLogger.log(
            "orchestrator",
            `ℹ️ [HydroscopeCore] Showing popup for node ${nodeId}`,
          );
          const node = state.reactFlowData.nodes.find((n) => n.id === nodeId);
          if (node) {
            handleNodePopupToggle(nodeId, node as Node);
          }
        },
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
        state.reactFlowData.nodes,
        handleNodePopupToggle,
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
            // Handle container clicks directly through InteractionHandler
            if (!readOnly && interactionHandlerRef.current) {
              interactionHandlerRef.current.handleContainerClick(node.id);
            }
          } else {
            // Handle regular node clicks - show popup if node has longLabel
            const shouldShowPopup =
              !readOnly &&
              node.data &&
              node.data.longLabel &&
              node.data.longLabel !== node.data.label;

            if (shouldShowPopup) {
              handleNodePopupToggle(node.id, node);
            }
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
      [handleNodePopupToggle, onNodeClick, readOnly, state.visualizationState],
    );

    // Close popups when containers are collapsed (original nodes might be hidden)
    useEffect(() => {
      if (state.activePopups.size > 0) {
        setState((prev) => {
          const visibleNodeIds = new Set(
            prev.reactFlowData.nodes
              .filter((n) => n.type !== "popup")
              .map((n) => n.id),
          );

          const newActivePopups = new Map();
          let updatedNodes = [...prev.reactFlowData.nodes];
          let hasChanges = false;

          // Remove popups for nodes that are no longer visible
          for (const [nodeId, popupId] of prev.activePopups) {
            if (visibleNodeIds.has(nodeId)) {
              newActivePopups.set(nodeId, popupId);
            } else {
              // Remove popup node
              updatedNodes = updatedNodes.filter((n) => n.id !== popupId);
              hasChanges = true;
            }
          }

          if (hasChanges) {
            return {
              ...prev,
              activePopups: newActivePopups,
              reactFlowData: {
                ...prev.reactFlowData,
                nodes: updatedNodes,
              },
            };
          }

          return prev;
        });
      }
    }, [state.activePopups]); // Remove nodes dependency to avoid infinite loop

    // Handle node changes (including drag operations)
    const handleNodesChange = useCallback(
      (changes: NodeChange[]) => {
        if (readOnly) {
          return;
        }

        try {
          // Check if this includes dimension changes - if so, save viewport BEFORE applying changes
          const hasDimensionChanges = changes.some(
            (change) => change.type === "dimensions",
          );
          if (
            hasDimensionChanges &&
            reactFlowInstance &&
            !savedViewportRef.current
          ) {
            savedViewportRef.current = reactFlowInstance.getViewport();
            hscopeLogger.log(
              "orchestrator",
              "[HydroscopeCore] 💾 Saved viewport before dimension changes:",
              savedViewportRef.current,
            );
          }

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

          // Check if this is a dimension change (node resize)
          const dimensionChanges = changes.filter(
            (change) => change.type === "dimensions",
          );

          if (dimensionChanges.length > 0) {
            hscopeLogger.log(
              "orchestrator",
              `[HydroscopeCore] 📏 Dimension changes detected for ${dimensionChanges.length} nodes`,
              dimensionChanges.map((c) => c.id),
            );

            // Deterministic logic: Check if there are pending callbacks (like fitView)
            // If yes: this is a major change (initial load or container expansion) - trigger callbacks
            // If no: this is a minor change (node label click) - preserve viewport
            const hasPendingCallbacks =
              state.asyncCoordinator?.hasPendingCallbacks() || false;

            hscopeLogger.log(
              "orchestrator",
              `[HydroscopeCore] 📏 Checking pending callbacks: ${hasPendingCallbacks}`,
            );

            if (hasPendingCallbacks) {
              // Major change: initial load or container expansion - trigger fitView
              hscopeLogger.log(
                "orchestrator",
                "[HydroscopeCore] 📏 Major change detected (pending callbacks) - calling notifyRenderComplete",
              );
              state.asyncCoordinator?.notifyRenderComplete();
            } else {
              // Minor change: node label expansion - preserve viewport
              hscopeLogger.log(
                "orchestrator",
                "[HydroscopeCore] 📏 Minor change detected (no pending callbacks) - preserving viewport",
              );
              // Debounce dimension resets to prevent ResizeObserver loops
              const now = Date.now();
              const timeSinceLastReset = now - lastDimensionResetRef.current;

              // Only reset if it's been at least 200ms since the last reset
              // This prevents ResizeObserver loops from rapid dimension changes
              if (timeSinceLastReset > 200) {
                // Clear any pending timeout
                if (dimensionResetTimeoutRef.current) {
                  clearTimeout(dimensionResetTimeoutRef.current);
                }

                // Schedule the reset with longer debounce
                dimensionResetTimeoutRef.current = setTimeout(() => {
                  if (reactFlowInstance) {
                    // Capture viewport before remount
                    const viewport = reactFlowInstance.getViewport();
                    hscopeLogger.log(
                      "orchestrator",
                      "[HydroscopeCore] 📸 Captured viewport before remount:",
                      viewport,
                    );

                    // Reset ReactFlow to fix edge positions
                    // Mark that we're remounting to prevent fitView on the subsequent data reload
                    isRemountingRef.current = true;

                    // Hide ReactFlow immediately before remount
                    setIsRemountingReactFlow(true);

                    // Wait a tick for opacity to apply, then remount
                    requestAnimationFrame(() => {
                      setReactFlowResetKey((prev) => prev + 1);

                      // Restore viewport after remount completes
                      // Use multiple RAF to ensure ReactFlow has fully rendered
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            hscopeLogger.log(
                              "orchestrator",
                              "[HydroscopeCore] 📸 Restoring viewport after remount:",
                              viewport,
                            );
                            reactFlowInstance.setViewport(viewport, {
                              duration: 0,
                            });
                            // Wait one more frame before showing to ensure viewport is applied
                            requestAnimationFrame(() => {
                              setIsRemountingReactFlow(false);
                            });
                          });
                        });
                      });
                    });

                    lastDimensionResetRef.current = Date.now();
                  }
                }, 100) as unknown as number; // 100ms debounce to prevent loops
              } else {
                hscopeLogger.log(
                  "orchestrator",
                  `[HydroscopeCore] 📏 Skipping reset - too soon (${timeSinceLastReset}ms since last reset)`,
                );
              }
            }
          }
        } catch (error) {
          console.error("[HydroscopeCore] Error handling node changes:", error);
          handleError(error as Error, "node changes");
        }
      },
      [readOnly, reactFlowInstance, state.asyncCoordinator, handleError],
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

          // Note: We don't call notifyRenderComplete here because edge changes
          // don't affect node dimensions, which is what fitView needs to wait for
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
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            opacity: isRemountingReactFlow ? 0 : 1,
            transition: isRemountingReactFlow
              ? "opacity 0.05s ease-out"
              : "opacity 0.15s ease-in",
          }}
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
