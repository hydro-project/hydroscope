/**
 * ContainerControls - React components for container expand/collapse operations
 * Provides UI controls with proper state management and error handling
 */
import React, { useState, useCallback, useEffect } from "react";
import type { VisualizationState } from "../core/VisualizationState.js";
import type { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { Container } from "../types/core.js";
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
  /** Callback for error handling */
  onError?: (error: Error, operation: string) => void;
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
  lastError?: Error;
  operationCount: number;
}
export const ContainerControls: React.FC<ContainerControlsProps> = ({
  visualizationState,
  asyncCoordinator,
  onOperationComplete,
  onError,
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
      const _status = asyncCoordinator.getQueueStatus();
      const containerStatus = asyncCoordinator.getContainerOperationStatus();
      setState((prevState) => ({
        ...prevState,
        isExpanding: containerStatus.expandOperations.processing,
        isCollapsing: containerStatus.collapseOperations.processing,
        lastError: containerStatus.lastError,
      }));
    };
    // Check status periodically
    const interval = setInterval(checkAsyncStatus, 100);
    return () => clearInterval(interval);
  }, [asyncCoordinator]);
  // Error handling helper
  const handleError = useCallback(
    (error: Error, operation: string) => {
      setState((prevState) => ({
        ...prevState,
        lastError: error,
      }));
      if (onError) {
        onError(error, operation);
      } else {
        console.error(`[ContainerControls] Error in ${operation}:`, error);
      }
    },
    [onError],
  );
  // Expand all containers
  const handleExpandAll = useCallback(async () => {
    if (disabled || state.isExpanding) return;
    try {
      setState((prevState) => ({
        ...prevState,
        isExpanding: true,
        lastError: undefined,
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
      // Use AsyncCoordinator for proper sequencing
      await asyncCoordinator.expandAllContainers(visualizationState, {
        triggerLayout: true,
      });
      setState((prevState) => ({
        ...prevState,
        isExpanding: false,
        expandingContainers: new Set(),
      }));
      if (onOperationComplete) {
        onOperationComplete("expand");
      }
    } catch (error) {
      setState((prevState) => ({
        ...prevState,
        isExpanding: false,
        expandingContainers: new Set(),
      }));
      handleError(error as Error, "expand all");
    }
  }, [
    disabled,
    state.isExpanding,
    visualizationState,
    asyncCoordinator,
    onOperationComplete,
    handleError,
  ]);
  // Collapse all containers
  const handleCollapseAll = useCallback(async () => {
    if (disabled || state.isCollapsing) return;
    try {
      setState((prevState) => ({
        ...prevState,
        isCollapsing: true,
        lastError: undefined,
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
      // Use AsyncCoordinator for proper sequencing
      await asyncCoordinator.collapseAllContainers(visualizationState, {
        triggerLayout: true,
      });
      setState((prevState) => ({
        ...prevState,
        isCollapsing: false,
        collapsingContainers: new Set(),
      }));
      if (onOperationComplete) {
        onOperationComplete("collapse");
      }
    } catch (error) {
      setState((prevState) => ({
        ...prevState,
        isCollapsing: false,
        collapsingContainers: new Set(),
      }));
      handleError(error as Error, "collapse all");
    }
  }, [
    disabled,
    state.isCollapsing,
    visualizationState,
    asyncCoordinator,
    onOperationComplete,
    handleError,
  ]);
  // Expand specific container
  const _handleExpandContainer = useCallback(
    async (containerId: string) => {
      if (disabled || state.expandingContainers.has(containerId)) return;
      try {
        setState((prevState) => ({
          ...prevState,
          expandingContainers: new Set([
            ...prevState.expandingContainers,
            containerId,
          ]),
          lastError: undefined,
          operationCount: prevState.operationCount + 1,
        }));
        await asyncCoordinator.expandContainer(
          containerId,
          visualizationState,
          {
            triggerLayout: true,
          },
        );
        setState((prevState) => {
          const newExpandingContainers = new Set(prevState.expandingContainers);
          newExpandingContainers.delete(containerId);
          return {
            ...prevState,
            expandingContainers: newExpandingContainers,
          };
        });
        if (onOperationComplete) {
          onOperationComplete("expand", containerId);
        }
      } catch (error) {
        setState((prevState) => {
          const newExpandingContainers = new Set(prevState.expandingContainers);
          newExpandingContainers.delete(containerId);
          return {
            ...prevState,
            expandingContainers: newExpandingContainers,
          };
        });
        handleError(error as Error, `expand container ${containerId}`);
      }
    },
    [
      disabled,
      state.expandingContainers,
      asyncCoordinator,
      visualizationState,
      onOperationComplete,
      handleError,
    ],
  );
  // Collapse specific container
  const _handleCollapseContainer = useCallback(
    async (containerId: string) => {
      if (disabled || state.collapsingContainers.has(containerId)) return;
      try {
        setState((prevState) => ({
          ...prevState,
          collapsingContainers: new Set([
            ...prevState.collapsingContainers,
            containerId,
          ]),
          lastError: undefined,
          operationCount: prevState.operationCount + 1,
        }));
        await asyncCoordinator.collapseContainer(
          containerId,
          visualizationState,
          {
            triggerLayout: true,
          },
        );
        setState((prevState) => {
          const newCollapsingContainers = new Set(
            prevState.collapsingContainers,
          );
          newCollapsingContainers.delete(containerId);
          return {
            ...prevState,
            collapsingContainers: newCollapsingContainers,
          };
        });
        if (onOperationComplete) {
          onOperationComplete("collapse", containerId);
        }
      } catch (error) {
        setState((prevState) => {
          const newCollapsingContainers = new Set(
            prevState.collapsingContainers,
          );
          newCollapsingContainers.delete(containerId);
          return {
            ...prevState,
            collapsingContainers: newCollapsingContainers,
          };
        });
        handleError(error as Error, `collapse container ${containerId}`);
      }
    },
    [
      disabled,
      state.collapsingContainers,
      asyncCoordinator,
      visualizationState,
      onOperationComplete,
      handleError,
    ],
  );
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
  // Clear error
  const clearError = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      lastError: undefined,
    }));
  }, []);
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

          {/* Error Display */}
          {state.lastError && (
            <div className="error-feedback">
              <div className="error-message">
                Error: {state.lastError.message}
              </div>
              <button onClick={clearError} className="clear-error-btn">
                ×
              </button>
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
  const [error, setError] = useState<Error | null>(null);
  const handleToggle = useCallback(async () => {
    if (disabled || isOperating) return;
    try {
      setIsOperating(true);
      setError(null);
      if (container.collapsed) {
        await asyncCoordinator.expandContainer(
          container.id,
          visualizationState,
          {
            triggerLayout: true,
          },
        );
        if (onOperationComplete) {
          onOperationComplete("expand", container.id);
        }
      } else {
        await asyncCoordinator.collapseContainer(
          container.id,
          visualizationState,
          {
            triggerLayout: true,
          },
        );
        if (onOperationComplete) {
          onOperationComplete("collapse", container.id);
        }
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      if (onError) {
        onError(error, `toggle container ${container.id}`);
      }
    } finally {
      setIsOperating(false);
    }
  }, [
    disabled,
    isOperating,
    container,
    asyncCoordinator,
    visualizationState,
    onOperationComplete,
    onError,
  ]);
  const clearError = useCallback(() => {
    setError(null);
  }, []);
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

      {error && (
        <div className="individual-error">
          <span className="error-text">{error.message}</span>
          <button onClick={clearError} className="clear-error-btn">
            ×
          </button>
        </div>
      )}
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
  const [lastError, setLastError] = useState<Error | null>(null);
  const expandAll = useCallback(async () => {
    if (isExpanding) return;
    try {
      setIsExpanding(true);
      setLastError(null);
      await asyncCoordinator.expandAllContainers(visualizationState);
    } catch (error) {
      setLastError(error as Error);
      throw error;
    } finally {
      setIsExpanding(false);
    }
  }, [isExpanding, asyncCoordinator, visualizationState]);
  const collapseAll = useCallback(async () => {
    if (isCollapsing) return;
    try {
      setIsCollapsing(true);
      setLastError(null);
      await asyncCoordinator.collapseAllContainers(visualizationState);
    } catch (error) {
      setLastError(error as Error);
      throw error;
    } finally {
      setIsCollapsing(false);
    }
  }, [isCollapsing, asyncCoordinator, visualizationState]);
  const toggleContainer = useCallback(
    async (containerId: string) => {
      if (operatingContainers.has(containerId)) return;
      try {
        setOperatingContainers((prev) => new Set([...prev, containerId]));
        setLastError(null);
        const container = visualizationState.getContainer(containerId);
        if (!container) {
          throw new Error(`Container ${containerId} not found`);
        }
        if (container.collapsed) {
          await asyncCoordinator.expandContainer(
            containerId,
            visualizationState,
          );
        } else {
          await asyncCoordinator.collapseContainer(
            containerId,
            visualizationState,
          );
        }
      } catch (error) {
        setLastError(error as Error);
        throw error;
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
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);
  return {
    expandAll,
    collapseAll,
    toggleContainer,
    isExpanding,
    isCollapsing,
    operatingContainers,
    lastError,
    clearError,
  };
};
