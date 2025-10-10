/**
 * InteractionHandler - Handles user interactions with graph elements
 * Architectural constraints: Coordinates between VisualizationState and AsyncCoordinator
 */

import type { VisualizationState } from "./VisualizationState.js";

export interface ClickEvent {
  elementId: string;
  elementType: "node" | "container";
  timestamp: number;
  position: { x: number; y: number };
}

export interface InteractionConfig {
  debounceDelay: number;
  rapidClickThreshold: number;
  enableClickDebouncing: boolean;
}

export class InteractionHandler {
  private _visualizationState: VisualizationState;
  private _asyncCoordinator?: any; // Will be typed properly when AsyncCoordinator is implemented
  private _config: InteractionConfig;
  private _recentClicks = new Map<string, number>();
  private _pendingOperations = new Map<string, NodeJS.Timeout>();

  constructor(
    visualizationState: VisualizationState,
    asyncCoordinator?: any,
    config?: Partial<InteractionConfig>,
  ) {
    this._visualizationState = visualizationState;
    this._asyncCoordinator = asyncCoordinator;
    this._config = {
      debounceDelay: 300, // 300ms debounce
      rapidClickThreshold: 500, // 500ms threshold for rapid clicks
      enableClickDebouncing: true,
      ...config,
    };
  }

  // Main click event processing
  handleNodeClick(nodeId: string, position?: { x: number; y: number }): void {
    const clickEvent: ClickEvent = {
      elementId: nodeId,
      elementType: "node",
      timestamp: Date.now(),
      position: position || { x: 0, y: 0 },
    };

    this.processClickEvent(clickEvent);
  }

  handleContainerClick(
    containerId: string,
    position?: { x: number; y: number },
  ): void {
    const clickEvent: ClickEvent = {
      elementId: containerId,
      elementType: "container",
      timestamp: Date.now(),
      position: position || { x: 0, y: 0 },
    };

    this.processClickEvent(clickEvent);
  }

  // Core click event processing with debouncing
  processClickEvent(event: ClickEvent): void {
    if (this._config.enableClickDebouncing) {
      this._processClickEventWithDebouncing(event);
    } else {
      this._executeClickEvent(event);
    }
  }

  private _processClickEventWithDebouncing(event: ClickEvent): void {
    const key = `${event.elementType}-${event.elementId}`;

    // Cancel any pending operation for this element
    const pendingTimeout = this._pendingOperations.get(key);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      this._pendingOperations.delete(key);
    }

    // Check for rapid clicks
    const lastClickTime = this._recentClicks.get(key) || 0;
    const timeSinceLastClick = event.timestamp - lastClickTime;

    if (
      timeSinceLastClick < this._config.rapidClickThreshold &&
      lastClickTime > 0
    ) {
      // This is a rapid click - handle it immediately
      this._executeClickEvent(event);
      this._recentClicks.set(key, event.timestamp);
      return;
    }

    // For first click or clicks outside rapid threshold, debounce
    const timeout = setTimeout(() => {
      this._executeClickEvent(event);
      this._pendingOperations.delete(key);
    }, this._config.debounceDelay);

    this._pendingOperations.set(key, timeout);
    this._recentClicks.set(key, event.timestamp);
  }

  private _executeClickEvent(event: ClickEvent): void {
    try {
      if (event.elementType === "node") {
        this._handleNodeClickInternal(event);
      } else if (event.elementType === "container") {
        this._handleContainerClickInternal(event);
      }

      // Trigger layout update if needed
      this._triggerLayoutUpdateIfNeeded(event);
    } catch (error) {
      console.error("Error processing click event:", error);
    }
  }

  private _handleNodeClickInternal(event: ClickEvent): void {
    // Toggle node label between short and long
    this._visualizationState.toggleNodeLabel(event.elementId);
  }

  private _handleContainerClickInternal(event: ClickEvent): void {
    // Toggle container between collapsed and expanded
    console.log("[InteractionHandler] Toggling container:", event.elementId);
    const containerBefore = this._visualizationState.getContainer(
      event.elementId,
    );
    console.log("[InteractionHandler] Container state before toggle:", {
      id: event.elementId,
      collapsed: containerBefore?.collapsed,
      exists: !!containerBefore,
    });

    this._visualizationState._toggleContainerForCoordinator(event.elementId);

    const containerAfter = this._visualizationState.getContainer(
      event.elementId,
    );
    console.log("[InteractionHandler] Container state after toggle:", {
      id: event.elementId,
      collapsed: containerAfter?.collapsed,
      stateChanged: containerBefore?.collapsed !== containerAfter?.collapsed,
    });
  }

  private _triggerLayoutUpdateIfNeeded(event: ClickEvent): void {
    // Container clicks always need layout updates
    if (event.elementType === "container") {
      this._triggerLayoutUpdate();
    }

    // Node label changes might need layout updates if the label size changes significantly
    if (event.elementType === "node") {
      const node = this._visualizationState.getGraphNode(event.elementId);
      if (
        node &&
        node.longLabel &&
        node.longLabel.length > node.label.length * 2
      ) {
        // Significant label size change - trigger layout update
        this._triggerLayoutUpdate();
      }
    }
  }

  private _triggerLayoutUpdate(): void {
    if (this._asyncCoordinator && this._asyncCoordinator.queueLayoutUpdate) {
      // Queue layout update through AsyncCoordinator
      this._asyncCoordinator.queueLayoutUpdate();
    }
  }

  // Bulk operations
  handleBulkNodeLabelToggle(nodeIds: string[], showLongLabel: boolean): void {
    for (const nodeId of nodeIds) {
      this._visualizationState.setNodeLabelState(nodeId, showLongLabel);
    }

    // Trigger single layout update for all changes
    this._triggerLayoutUpdate();
  }

  handleBulkContainerToggle(containerIds: string[], collapsed: boolean): void {
    for (const containerId of containerIds) {
      const container = this._visualizationState.getContainer(containerId);
      if (container && container.collapsed !== collapsed) {
        if (collapsed) {
          this._visualizationState._collapseContainerForCoordinator(
            containerId,
          );
        } else {
          this._visualizationState._expandContainerForCoordinator(containerId);
        }
      }
    }

    // Trigger single layout update for all changes
    this._triggerLayoutUpdate();
  }

  // Configuration management
  updateConfig(newConfig: Partial<InteractionConfig>): void {
    this._config = { ...this._config, ...newConfig };
  }

  getConfig(): InteractionConfig {
    return { ...this._config };
  }

  // Debouncing control
  enableDebouncing(): void {
    this._config.enableClickDebouncing = true;
  }

  disableDebouncing(): void {
    this._config.enableClickDebouncing = false;
    this._clearAllPendingOperations();
  }

  private _clearAllPendingOperations(): void {
    for (const timeout of this._pendingOperations.values()) {
      clearTimeout(timeout);
    }
    this._pendingOperations.clear();
  }

  // State queries
  getPendingOperationsCount(): number {
    return this._pendingOperations.size;
  }

  getRecentClicksCount(): number {
    const now = Date.now();
    const recentThreshold = now - this._config.rapidClickThreshold;

    let count = 0;
    for (const timestamp of this._recentClicks.values()) {
      if (timestamp > recentThreshold) {
        count++;
      }
    }

    return count;
  }

  // Cleanup
  cleanup(): void {
    this._clearAllPendingOperations();
    this._recentClicks.clear();
  }

  // Event queuing through AsyncCoordinator (when available)
  queueInteractionEvent(event: ClickEvent): Promise<void> {
    if (
      this._asyncCoordinator &&
      this._asyncCoordinator.queueApplicationEvent
    ) {
      return this._asyncCoordinator.queueApplicationEvent({
        type: "interaction",
        data: event,
      });
    }

    // Fallback to synchronous processing
    this.processClickEvent(event);
    return Promise.resolve();
  }

  // Integration with search operations
  handleSearchResultClick(
    elementId: string,
    elementType: "node" | "container",
  ): void {
    if (elementType === "container") {
      // Search result clicks should expand containers
      this._visualizationState.expandContainerForSearch(elementId);
      this._triggerLayoutUpdate();
    } else {
      // For nodes, just show long label
      this._visualizationState.setNodeLabelState(elementId, true);
    }
  }
}
