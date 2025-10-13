/**
 * ContainerControls - React components for container expand/collapse operations
 * Provides UI controls with proper state management and error handling
 *
 * Updated to use imperative container operations to avoid ResizeObserver loops
 * and coordination system cascades as per ui-operation-stability spec.
 */
import React, { useState, useCallback, useEffect } from "react";
import type { VisualizationState } from "../core/VisualizationState.js";
import type { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { Container } from "../types/core.js";
import {
  batchContainerOperationsImperatively,
  toggleContainerImperatively,
} from "../utils/containerOperationUtils.js";
export interface ContainerControlsProps {
  /** VisualizationState instance */
  visualizationState: VisualizationState;
  /** AsyncCoordinator instance for queuing operations */
  asyncCoordinator: AsyncCoordinator;
  /** Callback when container operations complete */
  onOperationComplete?: (
    operation: "expand" | "collapse",
    containerId?: string,
  ) => void;
  /** Custom styling */
  className?: string;
  /** Disable controls */
  disabled?: boolean;
  /** Show operation feedback */
  showFeedback?: boolean;
}
export interface ContainerControlsState {
  isExpanding: boolean;
  isCollapsing: boolean;
  expandingContainers: Set<string>;
  collapsingContainers: Set<string>;
  operationCount: number;
}
export const ContainerControls: React.FC<ContainerControlsProps> = ({
  visualizationState,
  asyncCoordinator,
  onOperationComplete,
  className = "",
  disabled = false,
  showFeedback = true,
}) => {
  const [state, setState] = useState<ContainerControlsState>({
    isExpanding: false,
    isCollapsing: false,
    expandingContainers: new Set(),
    collapsingContainers: new Set(),
    operationCount: 0,
  });
  // Monitor async coordinator status
  useEffect(() => {
    const checkAsyncStatus = () => {
      const containerStatus = asyncCoordinator.getContainerOperationStatus();
      setState((prevState) => ({
        ...prevState,
        isExpanding: containerStatus.expandOperations.processing,
        isCollapsing: containerStatus.collapseOperations.processing,
      }));
    };
    // Check status periodically
    const interval = setInterval(checkAsyncStatus, 100);
    return () => clearInterval(interval);
  }, [asyncCoordinator]);

  // Expand all containers
  const handleExpandAll = useCallback(async () => {
    if (disabled || state.isExpanding) return;

    setState((prevState) => ({
      ...prevState,
      isExpanding: true,
      operationCount: prevState.operationCount + 1,
    }));
    // Get all collapsed containers
    if (!visualizationState?.visibleContainers) {
      setState((prevState) => ({ ...prevState, isExpanding: false }));
      return;
    }
    const collapsedContainers = visualizationState.visibleContainers.filter(
      (container) => container.collapsed,
    );
    if (collapsedContainers.length === 0) {
      setState((prevState) => ({ ...prevState, isExpanding: false }));
      return;
    }
    // Track which containers are being expanded
    const expandingIds = new Set(collapsedContainers.map((c) => c.id));
    setState((prevState) => ({
      ...prevState,
      expandingContainers: expandingIds,
    }));

    // Use imperative batch operations to avoid coordination cascades
    const operations = collapsedContainers.map((container) => ({
      containerId: container.id,
      operation: "expand" as const,
    }));

    batchContainerOperationsImperatively({
      operations,
      visualizationState,
      debug: false,
    });

    // Trigger layout update if needed
    if (collapsedContainers.length > 0) {
      try {
        await asyncCoordinator.executeLayoutAndRenderPipeline(
          visualizationState,
          {
            relayoutEntities: collapsedContainers.map((c) => c.id),
            fitView: false,
          },
        );
      } catch (layoutError) {
        console.warn(
          "[ContainerControls] Layout update failed after expand all:",
          layoutError,
        );
      }
    }

    setState((prevState) => ({
      ...prevState,
      isExpanding: false,
      expandingContainers: new Set(),
    }));

    if (onOperationComplete) {
      onOperationComplete("expand");
    }
  }, [
    disabled,
    state.isExpanding,
    visualizationState,
    asyncCoordinator,
    onOperationComplete,
  ]);
  // Collapse all containers
  const handleCollapseAll = useCallback(async () => {
    if (disabled || state.isCollapsing) return;

    setState((prevState) => ({
      ...prevState,
      isCollapsing: true,
      operationCount: prevState.operationCount + 1,
    }));
    // Get all expanded containers
    if (!visualizationState?.visibleContainers) {
      setState((prevState) => ({ ...prevState, isCollapsing: false }));
      return;
    }
    const expandedContainers = visualizationState.visibleContainers.filter(
      (container) => !container.collapsed,
    );
    if (expandedContainers.length === 0) {
      setState((prevState) => ({ ...prevState, isCollapsing: false }));
      return;
    }
    // Track which containers are being collapsed
    const collapsingIds = new Set(expandedContainers.map((c) => c.id));
    setState((prevState) => ({
      ...prevState,
      collapsingContainers: collapsingIds,
    }));
    // Use imperative batch operations to avoid coordination cascades
    const operations = expandedContainers.map((container) => ({
      containerId: container.id,
      operation: "collapse" as const,
    }));

    batchContainerOperationsImperatively({
      operations,
      visualizationState,
      debug: false,
    });

    // Trigger layout update if needed
    if (expandedContainers.length > 0) {
      try {
        await asyncCoordinator.executeLayoutAndRenderPipeline(
          visualizationState,
          {
            relayoutEntities: expandedContainers.map((c) => c.id),
            fitView: false,
          },
        );
      } catch (layoutError) {
        console.warn(
          "[ContainerControls] Layout update failed after collapse all:",
          layoutError,
        );
      }
    }
    setState((prevState) => ({
      ...prevState,
      isCollapsing: false,
      collapsingContainers: new Set(),
    }));

    if (onOperationComplete) {
      onOperationComplete("collapse");
    }
  }, [
    disabled,
    state.isCollapsing,
    visualizationState,
    asyncCoordinator,
    onOperationComplete,
  ]);

  // Get container statistics
  const containerStats = React.useMemo(() => {
    if (!visualizationState?.visibleContainers) {
      return { total: 0, collapsed: 0, expanded: 0 };
    }
    const containers = visualizationState.visibleContainers;
    const collapsed = containers.filter((c) => c.collapsed).length;
    const expanded = containers.length - collapsed;
    return {
      total: containers.length,
      collapsed,
      expanded,
    };
  }, [visualizationState?.visibleContainers]);

  return (
    <div className={`hydroscope-container-controls ${className}`}>
      {/* Main Controls */}
      <div className="container-controls-main">
        <button
          onClick={handleExpandAll}
          disabled={
            disabled || state.isExpanding || containerStats.collapsed === 0
          }
          className={`expand-all-btn ${state.isExpanding ? "loading" : ""}`}
          title={`Expand all containers (${containerStats.collapsed} collapsed)`}
        >
          {state.isExpanding
            ? "Expanding..."
            : `Expand All (${containerStats.collapsed})`}
        </button>

        <button
          onClick={handleCollapseAll}
          disabled={
            disabled || state.isCollapsing || containerStats.expanded === 0
          }
          className={`collapse-all-btn ${state.isCollapsing ? "loading" : ""}`}
          title={`Collapse all containers (${containerStats.expanded} expanded)`}
        >
          {state.isCollapsing
            ? "Collapsing..."
            : `Collapse All (${containerStats.expanded})`}
        </button>
      </div>

      {/* Status Display */}
      {showFeedback && (
        <div className="container-controls-status">
          <div className="container-stats">
            <span className="stat">Total: {containerStats.total}</span>
            <span className="stat">Expanded: {containerStats.expanded}</span>
            <span className="stat">Collapsed: {containerStats.collapsed}</span>
          </div>

          {/* Loading States */}
          {(state.isExpanding ||
            state.isCollapsing ||
            state.expandingContainers.size > 0 ||
            state.collapsingContainers.size > 0) && (
            <div className="operation-feedback">
              {state.isExpanding && (
                <div className="feedback-item expanding">
                  Expanding all containers...
                </div>
              )}
              {state.isCollapsing && (
                <div className="feedback-item collapsing">
                  Collapsing all containers...
                </div>
              )}
              {state.expandingContainers.size > 0 && !state.isExpanding && (
                <div className="feedback-item expanding">
                  Expanding {state.expandingContainers.size} container(s)...
                </div>
              )}
              {state.collapsingContainers.size > 0 && !state.isCollapsing && (
                <div className="feedback-item collapsing">
                  Collapsing {state.collapsingContainers.size} container(s)...
                </div>
              )}
            </div>
          )}

          {/* Operation Counter */}
          {state.operationCount > 0 && (
            <div className="operation-counter">
              Operations: {state.operationCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
// Individual Container Control Component
export interface IndividualContainerControlProps {
  /** Container to control */
  container: Container;
  /** VisualizationState instance */
  visualizationState: VisualizationState;
  /** AsyncCoordinator instance */
  asyncCoordinator: AsyncCoordinator;
  /** Callback when operation completes */
  onOperationComplete?: (
    operation: "expand" | "collapse",
    containerId: string,
  ) => void;
  /** Callback for error handling */
  onError?: (error: Error, operation: string) => void;
  /** Custom styling */
  className?: string;
  /** Disable control */
  disabled?: boolean;
  /** Show loading state */
  showLoading?: boolean;
}
export const IndividualContainerControl: React.FC<
  IndividualContainerControlProps
> = ({
  container,
  visualizationState,
  asyncCoordinator,
  onOperationComplete,
  onError,
  className = "",
  disabled = false,
  showLoading = true,
}) => {
  const [isOperating, setIsOperating] = useState(false);

  const handleToggle = useCallback(async () => {
    if (disabled || isOperating) return;

    setIsOperating(true);

    // Use imperative operation to avoid coordination cascades
    toggleContainerImperatively({
      containerId: container.id,
      visualizationState,
      debounce: true, // Enable debouncing for individual controls
      debug: false,
    });

    // Trigger layout update separately if needed
    try {
      await asyncCoordinator.executeLayoutAndRenderPipeline(
        visualizationState,
        {
          relayoutEntities: [container.id],
          fitView: false,
        },
      );
    } catch (layoutError) {
      console.warn(
        `[IndividualContainerControl] Layout update failed for container ${container.id}:`,
        layoutError,
      );
    }

    if (onOperationComplete) {
      const operation = container.collapsed ? "expand" : "collapse";
      onOperationComplete(operation, container.id);
    }

    setIsOperating(false);
  }, [
    disabled,
    isOperating,
    container,
    asyncCoordinator,
    visualizationState,
    onOperationComplete,
    onError,
  ]);

  return (
    <div className={`individual-container-control ${className}`}>
      <button
        onClick={handleToggle}
        disabled={disabled || isOperating}
        className={`container-toggle-btn ${container.collapsed ? "collapsed" : "expanded"} ${isOperating ? "loading" : ""}`}
        title={`${container.collapsed ? "Expand" : "Collapse"} container: ${container.label}`}
      >
        <span className="container-label">{container.label}</span>
        <span className="toggle-icon">
          {isOperating && showLoading ? "⟳" : container.collapsed ? "▶" : "▼"}
        </span>
        <span className="child-count">({container.children.size})</span>
      </button>
    </div>
  );
};
// Hook for using container controls
export const useContainerControls = (
  visualizationState: VisualizationState,
  asyncCoordinator: AsyncCoordinator,
) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [operatingContainers, setOperatingContainers] = useState<Set<string>>(
    new Set(),
  );
  const expandAll = useCallback(async () => {
    if (isExpanding) return;

    setIsExpanding(true);

    try {
      // Get all collapsed containers
      const collapsedContainers =
        visualizationState.visibleContainers?.filter(
          (container) => container.collapsed,
        ) || [];

      if (collapsedContainers.length === 0) {
        return;
      }

      // Use imperative batch operations
      const operations = collapsedContainers.map((container) => ({
        containerId: container.id,
        operation: "expand" as const,
      }));

      batchContainerOperationsImperatively({
        operations,
        visualizationState,
        debug: false,
      });

      // Trigger layout update if needed
      if (collapsedContainers.length > 0) {
        try {
          await asyncCoordinator.executeLayoutAndRenderPipeline(
            visualizationState,
            {
              relayoutEntities: collapsedContainers.map((c) => c.id),
              fitView: false,
            },
          );
        } catch (layoutError) {
          console.warn(
            "[useContainerControls] Layout update failed after expand all:",
            layoutError,
          );
        }
      }
    } finally {
      setIsExpanding(false);
    }
  }, [isExpanding, asyncCoordinator, visualizationState]);
  const collapseAll = useCallback(async () => {
    if (isCollapsing) return;

    setIsCollapsing(true);

    try {
      // Get all expanded containers
      const expandedContainers =
        visualizationState.visibleContainers?.filter(
          (container) => !container.collapsed,
        ) || [];

      if (expandedContainers.length === 0) {
        return;
      }

      // Use imperative batch operations
      const operations = expandedContainers.map((container) => ({
        containerId: container.id,
        operation: "collapse" as const,
      }));

      batchContainerOperationsImperatively({
        operations,
        visualizationState,
        debug: false,
      });

      // Trigger layout update if needed
      if (expandedContainers.length > 0) {
        try {
          await asyncCoordinator.executeLayoutAndRenderPipeline(
            visualizationState,
            {
              relayoutEntities: expandedContainers.map((c) => c.id),
              fitView: false,
            },
          );
        } catch (layoutError) {
          console.warn(
            "[useContainerControls] Layout update failed after collapse all:",
            layoutError,
          );
        }
      }
    } finally {
      setIsCollapsing(false);
    }
  }, [isCollapsing, asyncCoordinator, visualizationState]);
  const toggleContainer = useCallback(
    async (containerId: string) => {
      if (operatingContainers.has(containerId)) return;

      setOperatingContainers((prev) => new Set([...prev, containerId]));

      try {
        // Use imperative operation to avoid coordination cascades
        toggleContainerImperatively({
          containerId,
          visualizationState,
          debounce: true,
          debug: false,
        });

        // Trigger layout update separately if needed
        try {
          await asyncCoordinator.executeLayoutAndRenderPipeline(
            visualizationState,
            {
              relayoutEntities: [containerId],
              fitView: false,
            },
          );
        } catch (layoutError) {
          console.warn(
            `[useContainerControls] Layout update failed for container ${containerId}:`,
            layoutError,
          );
        }
      } finally {
        setOperatingContainers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(containerId);
          return newSet;
        });
      }
    },
    [operatingContainers, asyncCoordinator, visualizationState],
  );
  return {
    expandAll,
    collapseAll,
    toggleContainer,
    isExpanding,
    isCollapsing,
    operatingContainers,
  };
};
