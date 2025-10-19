/**
 * AsyncCoordinator - Sequential queue system for async operations
 * Manages async boundaries with FIFO queues and error handling
 */
import { QueuedOperation, QueueStatus, ApplicationEvent } from "../types/core";
// Removed BridgeFactory import - using direct bridge instances only
import { withResizeObserverErrorSuppression } from "../utils/ResizeObserverErrorSuppression.js";
import { hscopeLogger } from "../utils/logger.js";
import { NAVIGATION_TIMING } from "../shared/config.js";

interface ErrorRecoveryResult {
  success: boolean;
  fallbackApplied: boolean;
  userFeedbackShown: boolean;
}
export interface QueueOptions {
  timeout?: number;
  maxRetries?: number;
}
/**
 * ASYNC COORDINATOR CONTRACT:
 * - All operations MUST be sequential and deterministic
 * - NO setTimeout/setInterval for timing logic (only for timeouts wrapped in awaited Promises)
 * - ALL async method calls MUST be awaited
 * - NO fire-and-forget .then() chains (except documented cases like spotlight)
 * - Wait for actual events (like notifyViewportAnimationComplete), not durations
 */
export class AsyncCoordinator {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private completedOperations: QueuedOperation[] = [];
  private failedOperations: QueuedOperation[] = [];
  private processingTimes: number[] = [];
  private currentOperation?: QueuedOperation;
  private operationIdCounter = 0;
  private interactionHandler?: any;

  // Promise-based operation tracking for queue enforcement
  private operationPromises: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  // DEPRECATED: Callback to update HydroscopeCore's React state when ReactFlow data changes (replaced by direct state updates)
  public onReactFlowDataUpdate?: (reactFlowData: any) => void;

  // Callback for search result focus (to trigger spotlight)
  // targetZoom parameter allows calculating spotlight position for the target viewport state
  public onSearchResultFocused?: (
    elementId: string,
    targetZoom?: number,
  ) => void;

  // Direct ReactFlow instance reference for fitView operations
  private reactFlowInstance?: any;
  private updateNodeInternals?: (nodeId: string) => void;

  // Viewport animation completion tracking
  private viewportAnimationCompleteResolvers: Array<() => void> = [];
  private isViewportAnimating = false;

  // Direct React state setter for imperative updates
  private setReactState?: (updater: (prev: any) => any) => void;

  // Direct bridge instances for imperative operations
  private reactFlowBridge?: any;
  private elkBridge?: any;

  // Configuration for rendering options
  private renderOptions: { showFullNodeLabels?: boolean } = {};

  // Post-render callback queue - executed after React renders new nodes
  private postRenderCallbacks: Array<() => void | Promise<void>> = [];

  // Callbacks for tracking container expansion lifecycle
  private onContainerExpansionStart?: (containerId: string) => void;
  private onContainerExpansionComplete?: (containerId: string) => void;

  constructor(interactionHandler?: any) {
    this.interactionHandler = interactionHandler;
  }

  /**
   * Set the InteractionHandler reference after construction
   */
  setInteractionHandler(interactionHandler: any): void {
    this.interactionHandler = interactionHandler;
  }

  /**
   * Update render options (e.g., showFullNodeLabels)
   */
  setRenderOptions(options: { showFullNodeLabels?: boolean }): void {
    this.renderOptions = { ...this.renderOptions, ...options };

    // Update InteractionHandler configuration to disable node clicks when full labels are shown
    if (this.interactionHandler && this.interactionHandler.updateConfig) {
      this.interactionHandler.updateConfig({
        disableNodeClicks: options.showFullNodeLabels || false,
      });
    }
  }

  /**
   * Set the ReactFlow instance reference for direct fitView operations
   */
  setReactFlowInstance(reactFlowInstance: any): void {
    this.reactFlowInstance = reactFlowInstance;
    hscopeLogger.log(
      "coordinator",
      "🎯 AsyncCoordinator: ReactFlow instance set for direct fitView operations",
    );
  }

  /**
   * Called by HydroscopeCore when ReactFlow's onMoveEnd event fires
   * This provides deterministic notification that viewport animations have completed
   */
  notifyViewportAnimationComplete(): void {
    if (!this.isViewportAnimating) {
      // No animation was in progress, ignore this event
      return;
    }

    this.isViewportAnimating = false;
    hscopeLogger.log(
      "coordinator",
      `[AsyncCoordinator] 🎯 Viewport animation complete - resolving ${this.viewportAnimationCompleteResolvers.length} waiters`,
    );

    // Resolve all pending promises waiting for animation completion
    const resolvers = [...this.viewportAnimationCompleteResolvers];
    this.viewportAnimationCompleteResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  /**
   * Returns a promise that resolves when the next viewport animation completes
   * This is deterministic - it waits for ReactFlow's onMoveEnd event
   */
  private waitForViewportAnimationComplete(): Promise<void> {
    // Always register a resolver and wait for the animation to complete
    // Even if isViewportAnimating is false, the animation might start soon
    // The resolver will be called when notifyViewportAnimationComplete() is triggered
    return new Promise<void>((resolve) => {
      this.viewportAnimationCompleteResolvers.push(resolve);
    });
  }

  /**
   * Mark that a viewport animation is starting
   * This should be called before any setCenter or fitView operation
   */
  private markViewportAnimationStart(): void {
    this.isViewportAnimating = true;
    hscopeLogger.log(
      "coordinator",
      "[AsyncCoordinator] 🎯 Viewport animation started",
    );
  }

  setUpdateNodeInternals(updateNodeInternals: (nodeId: string) => void): void {
    this.updateNodeInternals = updateNodeInternals;
    hscopeLogger.log(
      "coordinator",
      "🎯 AsyncCoordinator: updateNodeInternals callback set",
    );
  }

  /**
   * Set callbacks for tracking container expansion lifecycle
   * Used to distinguish major container expansions from minor dimension changes
   */
  setContainerExpansionCallbacks(
    onStart: (containerId: string) => void,
    onComplete: (containerId: string) => void,
  ): void {
    this.onContainerExpansionStart = onStart;
    this.onContainerExpansionComplete = onComplete;
  }

  /**
   * Check if there are pending post-render callbacks (like fitView)
   * Used to determine if notifyRenderComplete should be called
   */
  hasPendingCallbacks(): boolean {
    const hasPending = this.postRenderCallbacks.length > 0;
    hscopeLogger.log(
      "coordinator",
      `[AsyncCoordinator] 🔍 hasPendingCallbacks: ${hasPending} (count: ${this.postRenderCallbacks.length})`,
    );
    return hasPending;
  }

  /**
   * Force ReactFlow to recalculate edge handles for all nodes
   * This is necessary when node dimensions change without node IDs changing
   */
  updateAllNodeInternals(visualizationState: any): void {
    if (!this.updateNodeInternals) {
      console.warn(
        "[AsyncCoordinator] updateNodeInternals not available - edge handles may not update correctly",
      );
      return;
    }

    hscopeLogger.log(
      "coordinator",
      "🔄 [AsyncCoordinator] Updating node internals for all visible nodes",
    );

    // Update internals for all visible nodes
    const nodeIds: string[] = [];
    for (const node of visualizationState.visibleNodes) {
      nodeIds.push(node.id);
      this.updateNodeInternals(node.id);
    }

    // Also update internals for all visible containers
    for (const container of visualizationState.visibleContainers) {
      nodeIds.push(container.id);
      this.updateNodeInternals(container.id);
    }

    hscopeLogger.log(
      "coordinator",
      `✅ [AsyncCoordinator] Updated node internals for ${nodeIds.length} nodes`,
    );
  }

  /**
   * Called by HydroscopeCore when React finishes rendering nodes
   * This is the deterministic trigger to execute post-render callbacks (like fitView)
   */
  notifyRenderComplete(): void {
    if (this.postRenderCallbacks.length === 0) {
      return;
    }

    // Execute all pending callbacks
    const callbacks = [...this.postRenderCallbacks];
    this.postRenderCallbacks = [];

    hscopeLogger.log(
      "coordinator",
      `[AsyncCoordinator] 🎯 Executing ${callbacks.length} post-render callbacks`,
    );

    callbacks.forEach((callback) => {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(
              "[AsyncCoordinator] Post-render callback error:",
              error,
            );
          });
        }
      } catch (error) {
        console.error("[AsyncCoordinator] Post-render callback error:", error);
      }
    });
  }

  /**
   * Enqueue a callback to be executed after the next React render
   */
  private enqueuePostRenderCallback(
    callback: () => void | Promise<void>,
  ): void {
    this.postRenderCallbacks.push(callback);
  }

  /**
   * Returns a promise that resolves after the next React render completes
   * Use this to sequence operations that need to wait for React state updates
   */
  private waitForNextRender(): Promise<void> {
    return new Promise((resolve) => {
      this.enqueuePostRenderCallback(() => {
        resolve();
      });
    });
  }

  /**
   * Clear all pending post-render callbacks (e.g., fitView)
   * Used when we want to prevent queued viewport changes from interfering with navigation
   */
  clearPendingFitViewCallbacks(): void {
    this.postRenderCallbacks = [];
  }

  /**
   * Set the React state setter for direct imperative state updates
   * This enables AsyncCoordinator to update React state directly instead of using callbacks
   */
  setReactStateSetter(
    setReactState: (updater: (prev: any) => any) => void,
  ): void {
    this.setReactState = setReactState;
    hscopeLogger.log(
      "coordinator",
      "🎯 AsyncCoordinator: React state setter configured for direct updates",
    );
  }

  /**
   * Set bridge instances for direct imperative operations
   * This eliminates the need for bridge factory imports and makes operations more sequential
   */
  setBridgeInstances(reactFlowBridge: any, elkBridge: any): void {
    this.reactFlowBridge = reactFlowBridge;
    this.elkBridge = elkBridge;
    hscopeLogger.log(
      "coordinator",
      "🎯 AsyncCoordinator: Bridge instances set for direct imperative operations",
    );
  }

  // DEPRECATED: FitView integration callback for React integration (replaced by direct ReactFlow calls)
  public onFitViewRequested?: (options?: {
    padding?: number;
    duration?: number;
  }) => void;

  // Pending fitView request (to be executed after React re-renders)
  public pendingFitViewRequest?: {
    padding?: number;
    duration?: number;
  } | null = null;

  // PERFORMANCE OPTIMIZATION: Stateless performance tracking (no persistent caches)
  private _lastStateSnapshot?: {
    timestamp: number;
    containerCount: number;
    nodeCount: number;
    edgeCount: number;
    layoutPhase: string;
    cacheVersion?: number;
  };
  /**
   * Queue an operation for sequential processing
   */
  queueOperation<T>(
    type: QueuedOperation["type"],
    operation: () => Promise<T>,
    options: QueueOptions = {},
  ): string {
    const id = `op_${++this.operationIdCounter}`;
    const queuedOp: QueuedOperation<T> = {
      id,
      type,
      operation,
      timeout: options.timeout,
      retryCount: 0,
      maxRetries: options.maxRetries || 0,
      createdAt: Date.now(),
    };
    this.queue.push(queuedOp);
    return id;
  }

  /**
   * Enqueue an operation and return a Promise that resolves when the operation completes
   * This is the core helper for queue-enforced execution
   *
   * @param operationType - Type of operation to enqueue
   * @param handler - Handler function that performs the actual work
   * @param options - Queue options (timeout, maxRetries)
   * @returns Promise that resolves with the operation result or rejects with an error
   */
  private async _enqueueAndWait<T>(
    operationType: QueuedOperation["type"],
    handler: () => Promise<T>,
    options: QueueOptions = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Enqueue the operation
      const operationId = this.queueOperation(operationType, handler, options);

      // Store resolver/rejecter for this operation
      this.operationPromises.set(operationId, { resolve, reject });

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue().catch((error) => {
          // If processQueue itself fails, reject the promise
          console.error("[AsyncCoordinator] Queue processing failed:", error);
          reject(error);
        });
      }
    });
  }
  /**
   * Process all queued operations sequentially
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const operation = this.queue.shift()!;
        await this.processOperation(operation);
      }
    } finally {
      this.processing = false;
      this.currentOperation = undefined;
    }
  }
  /**
   * Process a single operation with retry logic and timeout handling
   * Now includes Promise resolution/rejection for queue-enforced operations
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    this.currentOperation = operation;
    operation.startedAt = Date.now();

    // Get Promise handlers for this operation (if it was enqueued via _enqueueAndWait)
    const promiseHandlers = this.operationPromises.get(operation.id);

    while (operation.retryCount <= operation.maxRetries) {
      try {
        const result = await this.executeWithTimeout(operation);
        // Operation succeeded
        operation.completedAt = Date.now();
        operation.result = result;
        this.completedOperations.push(operation);
        this.recordProcessingTime(operation);

        // Resolve caller's Promise if it exists
        if (promiseHandlers) {
          promiseHandlers.resolve(result);
          this.operationPromises.delete(operation.id);
        }

        return;
      } catch (error) {
        operation.error = error as Error;
        operation.retryCount++;
        console.error(
          `[AsyncCoordinator] ❌ Operation ${operation.id} (${operation.type}) failed (attempt ${operation.retryCount}/${operation.maxRetries + 1}):`,
          error,
        );
        // If we've exhausted retries, mark as failed
        if (operation.retryCount > operation.maxRetries) {
          operation.completedAt = Date.now();
          this.failedOperations.push(operation);
          this.recordProcessingTime(operation);
          console.error(
            `[AsyncCoordinator] 💀 Operation ${operation.id} (${operation.type}) failed permanently after ${operation.retryCount} attempts`,
          );

          // Reject caller's Promise if it exists
          if (promiseHandlers) {
            promiseHandlers.reject(
              operation.error ||
                new Error(
                  `Operation ${operation.id} (${operation.type}) failed after ${operation.retryCount} attempts`,
                ),
            );
            this.operationPromises.delete(operation.id);
          }

          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * operation.retryCount),
        );
      }
    }
  }
  /**
   * Execute operation with timeout if specified
   */
  private async executeWithTimeout(operation: QueuedOperation): Promise<any> {
    if (!operation.timeout) {
      const result = await operation.operation();
      return result;
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Operation ${operation.id} timed out after ${operation.timeout}ms`,
          ),
        );
      }, operation.timeout);
      operation
        .operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  /**
   * Record processing time for statistics
   */
  private recordProcessingTime(operation: QueuedOperation): void {
    if (operation.startedAt && operation.completedAt) {
      const processingTime = operation.completedAt - operation.startedAt;
      this.processingTimes.push(processingTime);
      // Keep only last 100 processing times for rolling average
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift();
      }
    }
  }
  /**
   * Get current queue status and statistics
   */
  getQueueStatus(): QueueStatus {
    const totalProcessed =
      this.completedOperations.length + this.failedOperations.length;
    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) /
          this.processingTimes.length
        : 0;
    return {
      pending: this.queue.length,
      processing: this.processing ? 1 : 0,
      completed: this.completedOperations.length,
      failed: this.failedOperations.length,
      totalProcessed,
      currentOperation: this.currentOperation,
      averageProcessingTime,
      errors: this.failedOperations.map((op) => op.error!).filter(Boolean),
    };
  }
  /**
   * Clear all queued operations
   * Also rejects any pending Promises to prevent memory leaks
   */
  clearQueue(): void {
    // Reject all pending Promises for queued operations
    for (const operation of this.queue) {
      const promiseHandlers = this.operationPromises.get(operation.id);
      if (promiseHandlers) {
        promiseHandlers.reject(
          new Error(
            `Operation ${operation.id} (${operation.type}) was cancelled due to queue clear`,
          ),
        );
        this.operationPromises.delete(operation.id);
      }
    }

    this.queue = [];
  }
  /**
   * Clear all statistics and completed operations
   */
  clearHistory(): void {
    this.completedOperations = [];
    this.failedOperations = [];
    this.processingTimes = [];
  }
  /**
   * Get all completed operations
   */
  getCompletedOperations(): ReadonlyArray<QueuedOperation> {
    return [...this.completedOperations];
  }
  /**
   * Get all failed operations
   */
  getFailedOperations(): ReadonlyArray<QueuedOperation> {
    return [...this.failedOperations];
  }
  /**
   * Check if queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
  /**
   * Cancel ELK operation if it's still queued
   */
  cancelELKOperation(operationId: string): boolean {
    const index = this.queue.findIndex(
      (op) => op.id === operationId && op.type === "elk_layout",
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
  /**
   * Get status of ELK operations
   */
  getELKOperationStatus(): {
    queued: number;
    processing: boolean;
    lastCompleted?: QueuedOperation;
    lastFailed?: QueuedOperation;
  } {
    const elkOps = this.queue.filter((op) => op.type === "elk_layout");
    const currentELK = this.currentOperation?.type === "elk_layout";
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find((op) => op.type === "elk_layout");
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find((op) => op.type === "elk_layout");
    return {
      queued: elkOps.length,
      processing: currentELK,
      lastCompleted,
      lastFailed,
    };
  }
  // ReactFlow-specific async operations
  /**
   * Generate ReactFlow data synchronously (private method) - OPTIMIZED
   * This method ensures ReactFlow rendering uses current VisualizationState data
   * Removed unnecessary async wrapper for better performance
   */
  private generateReactFlowDataImperative(
    state: any, // VisualizationState - using any to avoid circular dependency
  ): any {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🎨 Starting imperative ReactFlow data generation",
      );

      // Use direct bridge instance (must be set via setBridgeInstances)
      if (!this.reactFlowBridge) {
        throw new Error(
          "ReactFlowBridge instance not available - call setBridgeInstances() first",
        );
      }

      const reactFlowBridge = this.reactFlowBridge;

      // Set layout phase to indicate rendering
      if (typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("rendering");
      }

      // Convert to ReactFlow format using current VisualizationState data
      const reactFlowData = reactFlowBridge.toReactFlowData(
        state,
        this.interactionHandler,
        this.renderOptions,
      );

      // Set layout phase to displayed
      if (typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("displayed");
      }

      // Update React state directly (imperative approach)
      // Wrap with ResizeObserver error suppression to prevent loops during re-render
      if (this.setReactState) {
        withResizeObserverErrorSuppression(() => {
          this.setReactState!((prev: any) => ({
            ...prev,
            reactFlowData: reactFlowData,
          }));
        })();
      } else if (this.onReactFlowDataUpdate) {
        this.onReactFlowDataUpdate(reactFlowData);
      }

      // Removed resize detection - just change text without resizing nodes

      const endTime = Date.now();
      hscopeLogger.log(
        "coordinator",
        `[AsyncCoordinator] ✅ Imperative ReactFlow data generation completed in ${endTime - startTime}ms`,
      );

      return reactFlowData;
    } catch (error) {
      console.error(
        `[AsyncCoordinator] ❌ Imperative ReactFlow render operation failed:`,
        error,
      );

      if (typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }
  /**
   * Unified data processing pipeline for initial load, file load, and hierarchy changes
   * This ensures consistent behavior and smart collapse logic across all scenarios
   *
   * @param newData - The new HydroscopeData to process
   * @param visualizationState - The VisualizationState instance to update
   * @param jsonParser - The JSONParser instance for data parsing
   * @param reason - The reason for data processing (for logging and debugging)
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished
   */
  async processDataChange(
    newData: any, // HydroscopeData - using any to avoid circular dependency
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    jsonParser: any, // JSONParser - using any to avoid circular dependency
    reason: "initial_load" | "file_load" | "hierarchy_change" | "remount",
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      validateData?: (data: any) => void;
      onVisualizationStateChange?: (state: any) => void;
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "process_data_change",
      () =>
        this._handleProcessDataChange(
          newData,
          visualizationState,
          jsonParser,
          reason,
          options,
        ),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for data processing pipeline
   * This method contains the actual implementation and is called by the queue system
   *
   * @param newData - The new HydroscopeData to process
   * @param visualizationState - The VisualizationState instance to update
   * @param jsonParser - The JSONParser instance for data parsing
   * @param reason - The reason for data processing (for logging and debugging)
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished
   */
  private async _handleProcessDataChange(
    newData: any, // HydroscopeData - using any to avoid circular dependency
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    jsonParser: any, // JSONParser - using any to avoid circular dependency
    reason: "initial_load" | "file_load" | "hierarchy_change" | "remount",
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      validateData?: (data: any) => void;
      onVisualizationStateChange?: (state: any) => void;
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        `🚀 AsyncCoordinator: Starting unified data processing pipeline: ${reason}`,
      );

      // Validate data structure if validator provided
      if (options.validateData) {
        options.validateData(newData);
      }

      // CRITICAL: Reset layout state for ALL data changes to enable smart collapse
      // This ensures smart collapse runs on first layout after any data change
      if (
        visualizationState &&
        typeof visualizationState.resetLayoutState === "function"
      ) {
        visualizationState.resetLayoutState();
        hscopeLogger.log(
          "coordinator",
          `🔄 AsyncCoordinator: Reset layout state for ${reason} - smart collapse will run on next layout`,
        );
      } else {
        console.warn(
          `[AsyncCoordinator] VisualizationState.resetLayoutState not available`,
        );
      }

      // Parse JSON data into the VisualizationState
      if (!jsonParser || typeof jsonParser.parseData !== "function") {
        throw new Error("JSONParser instance is required for data processing");
      }

      const parseResult = await jsonParser.parseData(
        newData,
        visualizationState,
      );

      if (!parseResult) {
        throw new Error("JSON parsing failed - no result returned");
      }

      // Log any warnings from parsing
      if (parseResult.warnings && parseResult.warnings.length > 0) {
        console.warn(
          `[AsyncCoordinator] Parsing warnings for ${reason}:`,
          parseResult.warnings,
        );
      }

      // Validate that we got some data
      if (parseResult.stats && parseResult.stats.nodeCount === 0) {
        throw new Error(
          "No valid nodes found in the data. Please check that your data contains valid node definitions.",
        );
      }

      // Warn about potential issues but don't fail
      if (parseResult.stats) {
        if (parseResult.stats.edgeCount === 0) {
          console.warn(
            `[AsyncCoordinator] No edges found in data for ${reason} - visualization will only show nodes`,
          );
        }

        if (parseResult.stats.containerCount === 0) {
          console.warn(
            `[AsyncCoordinator] No containers found in data for ${reason} - nodes will not be grouped`,
          );
        }
      }

      // Notify about visualization state change
      if (options.onVisualizationStateChange) {
        options.onVisualizationStateChange(visualizationState);
      }

      // Execute complete pipeline: layout + render + fitView
      // IMPORTANT: Call the handler directly to avoid deadlock (we're already in the queue)
      const reactFlowData = await this._handleLayoutAndRenderPipeline(
        visualizationState,
        {
          relayoutEntities: undefined, // Full layout for data changes
          fitView: options.fitView !== false, // Default to true unless explicitly disabled
          fitViewOptions: options.fitViewOptions,
        },
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        `✅ AsyncCoordinator: Unified data processing pipeline completed successfully for ${reason}`,
        {
          duration: `${duration}ms`,
          nodeCount: reactFlowData?.nodes?.length || 0,
          edgeCount: reactFlowData?.edges?.length || 0,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        `[AsyncCoordinator] Unified data processing pipeline failed for ${reason}:`,
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          reason,
          timestamp: endTime,
        },
      );

      // Set error state on VisualizationState if possible
      if (
        visualizationState &&
        typeof visualizationState.setLayoutPhase === "function"
      ) {
        visualizationState.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Process dimension changes that require ReactFlow remount
   *
   * This handles the complete sequence for operations like "Show full node labels":
   * 1. Execute layout and render pipeline with new dimensions
   * 2. Wait for React to render the new data
   * 3. Trigger ReactFlow remount callback to clear internal state
   *
   * @param visualizationState - The VisualizationState with updated dimensions
   * @param onRemount - Callback to trigger ReactFlow remount (e.g., forceReactFlowRemount)
   * @param options - Pipeline execution options
   * @returns Promise that resolves after remount is triggered
   */
  async processDimensionChangeWithRemount(
    visualizationState: any,
    onRemount: () => void,
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "dimension_change_with_remount",
      () =>
        this._handleProcessDimensionChangeWithRemount(
          visualizationState,
          onRemount,
          options,
        ),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for dimension change with remount
   * This method contains the actual implementation and is called by the queue system
   *
   * @param visualizationState - The VisualizationState with updated dimensions
   * @param onRemount - Callback to trigger ReactFlow remount (e.g., forceReactFlowRemount)
   * @param options - Pipeline execution options
   * @returns Promise that resolves after remount is triggered
   */
  private async _handleProcessDimensionChangeWithRemount(
    visualizationState: any,
    onRemount: () => void,
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    const startTime = Date.now();
    hscopeLogger.log(
      "coordinator",
      "🔄 [AsyncCoordinator] Starting dimension change with remount sequence",
    );

    try {
      // Step 1: Execute layout and render pipeline with new dimensions
      hscopeLogger.log(
        "coordinator",
        "  1️⃣ Executing layout and render pipeline",
      );
      await this.executeLayoutAndRenderPipeline(visualizationState, {
        relayoutEntities: undefined, // Full layout
        fitView: options.fitView ?? false,
        fitViewOptions: options.fitViewOptions,
      });

      // Step 2: Wait for React to render the new data
      hscopeLogger.log(
        "coordinator",
        "  2️⃣ Waiting for React render to complete",
      );
      await this.waitForNextRender();

      // Step 3: Trigger ReactFlow remount
      hscopeLogger.log("coordinator", "  3️⃣ Triggering ReactFlow remount");
      onRemount();

      const duration = Date.now() - startTime;
      hscopeLogger.log(
        "coordinator",
        `✅ [AsyncCoordinator] Dimension change with remount completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ [AsyncCoordinator] Dimension change with remount failed after ${duration}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Execute layout and render pipeline with ReactFlow remount after render completes
   *
   * This method handles the complete sequence for operations that change node dimensions
   * (like toggling "Show full node labels"):
   * 1. Execute layout and render pipeline with new bridges
   * 2. Wait for React to render the new data
   * 3. Force ReactFlow to remount with fresh data
   *
   * @param visualizationState - VisualizationState instance
   * @param forceRemountCallback - Callback to force ReactFlow remount
   * @param options - Pipeline execution options
   * @returns Promise that resolves after ReactFlow remount
   */
  async executeLayoutAndRenderWithRemount(
    visualizationState: any,
    forceRemountCallback: () => void,
    options: {
      relayoutEntities?: string[];
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "layout_and_render_with_remount",
      () =>
        this._handleExecuteLayoutAndRenderWithRemount(
          visualizationState,
          forceRemountCallback,
          options,
        ),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for layout and render pipeline with remount
   * This method contains the actual implementation and is called by the queue system
   *
   * @param visualizationState - VisualizationState instance
   * @param forceRemountCallback - Callback to force ReactFlow remount
   * @param options - Pipeline execution options
   * @returns Promise that resolves after ReactFlow remount
   */
  private async _handleExecuteLayoutAndRenderWithRemount(
    visualizationState: any,
    forceRemountCallback: () => void,
    options: {
      relayoutEntities?: string[];
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    hscopeLogger.log(
      "coordinator",
      "🔄 [AsyncCoordinator] Starting layout and render pipeline with remount",
    );

    // Step 1: Execute layout and render pipeline
    await this.executeLayoutAndRenderPipeline(visualizationState, {
      relayoutEntities: options.relayoutEntities,
      fitView: options.fitView ?? false,
      fitViewOptions: options.fitViewOptions,
    });

    hscopeLogger.log(
      "coordinator",
      "✅ [AsyncCoordinator] Pipeline complete, waiting for React render",
    );

    // Step 2: Wait for React to complete rendering the new data
    await this.waitForNextRender();

    hscopeLogger.log(
      "coordinator",
      "🔄 [AsyncCoordinator] React render complete, forcing ReactFlow remount",
    );

    // Step 3: Force ReactFlow to remount with fresh data
    forceRemountCallback();

    hscopeLogger.log(
      "coordinator",
      "✅ [AsyncCoordinator] ReactFlow remount complete",
    );
  }

  // REMOVED: Deprecated queueLayoutAndRenderPipeline method
  // This method has been replaced by executeLayoutAndRenderPipeline which provides:
  // - Better error handling with fail-fast behavior
  // - Layout entity control (relayoutEntities parameter)
  // - FitView integration
  // - Synchronous execution semantics

  /**
   * Execute synchronous layout and render pipeline with layout entity control and FitView integration
   * This is the enhanced synchronous method that replaces manual orchestration patterns
   *
   * Note: While this method appears synchronous, ELK layout is inherently async.
   * This method returns a Promise but ensures atomic execution of the complete pipeline.
   *
   * @param state - VisualizationState instance
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished (including FitView if enabled)
   */
  async executeLayoutAndRenderPipeline(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: {
      // Layout control - which entities need re-layout
      relayoutEntities?: string[]; // undefined = full layout, [] = no layout, [ids] = constrained

      // FitView control - handled internally, no callbacks needed
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };

      // Standard options
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "layout_and_render_pipeline",
      () => this._handleLayoutAndRenderPipeline(state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for layout and render pipeline
   * This method contains the actual implementation and is called by the queue system
   *
   * @param state - VisualizationState instance
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished (including FitView if enabled)
   */
  private async _handleLayoutAndRenderPipeline(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: {
      // Layout control - which entities need re-layout
      relayoutEntities?: string[]; // undefined = full layout, [] = no layout, [ids] = constrained

      // FitView control - handled internally, no callbacks needed
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };

      // Standard options
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();
    const performanceMetrics = {
      stateChangeDetection: 0,
      layoutSkipped: false,
      layoutDuration: 0,
      renderDuration: 0,
    };

    // Validate required parameters - FAIL FAST with clear messages
    if (!state) {
      throw new Error(
        "VisualizationState instance is required for layout and render pipeline",
      );
    }
    // Use the ELK bridge instance set via setBridgeInstances
    if (!this.elkBridge) {
      throw new Error(
        "ELK bridge is not available - ensure setBridgeInstances was called",
      );
    }
    const elkBridge = this.elkBridge;

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🚀 Starting optimized synchronous layout and render pipeline",
        {
          relayoutEntities: options.relayoutEntities,
          relayoutEntitiesType: typeof options.relayoutEntities,
          relayoutEntitiesIsUndefined: options.relayoutEntities === undefined,
          fitView: options.fitView,
          timestamp: startTime,
        },
      );

      // PERFORMANCE OPTIMIZATION 1: State change detection using VisualizationState's cache invalidation
      const stateDetectionStart = Date.now();
      hscopeLogger.log(
        "coordinator",
        "🎯 Checking if layout should be skipped",
        {
          relayoutEntities: options.relayoutEntities,
          relayoutEntitiesType: typeof options.relayoutEntities,
          relayoutEntitiesIsUndefined: options.relayoutEntities === undefined,
        },
      );
      const shouldSkipLayout = this._shouldSkipLayoutBasedOnStateChanges(
        state,
        options.relayoutEntities,
      );
      hscopeLogger.log(
        "coordinator",
        "🎯 Layout skip decision:",
        shouldSkipLayout,
      );
      performanceMetrics.stateChangeDetection =
        Date.now() - stateDetectionStart;

      if (shouldSkipLayout) {
        performanceMetrics.layoutSkipped = true;
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ⚡ Layout optimization: Skipping unnecessary layout based on state analysis",
          {
            stateChangeDetectionTime: `${performanceMetrics.stateChangeDetection}ms`,
          },
        );
      }

      // Step 1: Execute ELK layout if needed - FAIL FAST on errors
      const layoutStart = Date.now();
      if (
        options.relayoutEntities !== undefined &&
        options.relayoutEntities.length === 0
      ) {
        // Skip layout - relayoutEntities is empty array
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ⏭️ Skipping ELK layout - no entities to re-layout",
        );
        performanceMetrics.layoutSkipped = true;
      } else if (shouldSkipLayout) {
        // Skip layout - state hasn't changed meaningfully
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ⚡ Skipping ELK layout - no meaningful state changes detected",
        );
        performanceMetrics.layoutSkipped = true;
      } else {
        // Execute layout (async but atomic within this pipeline) - NO ERROR SUPPRESSION
        if (!this.elkBridge) {
          throw new Error("ELK bridge not available for layout execution");
        }
        hscopeLogger.log("coordinator", "🎯 Calling executeELKLayoutAsync", {
          elkBridge: !!this.elkBridge,
          elkBridgeType: typeof this.elkBridge,
          relayoutEntities: options.relayoutEntities,
        });
        await this.executeELKLayoutAsync(
          state,
          this.elkBridge,
          options.relayoutEntities,
        );
        performanceMetrics.layoutDuration = Date.now() - layoutStart;
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ ELK layout completed successfully",
          {
            layoutDuration: `${performanceMetrics.layoutDuration}ms`,
          },
        );
      }

      // Step 2: Generate ReactFlow data imperatively - FAIL FAST on errors
      const renderStart = Date.now();
      const reactFlowData = this.generateReactFlowDataImperative(state);
      performanceMetrics.renderDuration = Date.now() - renderStart;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ ReactFlow data generation completed successfully",
        {
          renderDuration: `${performanceMetrics.renderDuration}ms`,
        },
      );

      // Step 4: Update HydroscopeCore's React state directly (imperative approach)
      if (this.setReactState) {
        // Update React state with new nodes/edges
        // Wrap with ResizeObserver error suppression to prevent loops during re-render
        withResizeObserverErrorSuppression(() => {
          this.setReactState!((prev: any) => ({
            ...prev,
            reactFlowData: reactFlowData,
          }));
        })();
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ ReactFlow data updated directly (imperative)",
        );

        // If fitView is requested, enqueue it to execute AFTER React renders
        if (options.fitView) {
          const fitViewCheck = this._shouldExecuteFitView(
            options.fitViewOptions,
            reactFlowData,
          );

          if (fitViewCheck.shouldExecute) {
            this.enqueuePostRenderCallback(() => {
              if (!this.reactFlowInstance) {
                console.warn(
                  "[AsyncCoordinator] ⚠️ ReactFlow instance not available for fitView",
                );
                return;
              }

              const fitViewOptions = {
                padding: options.fitViewOptions?.padding || 0.15,
                duration: options.fitViewOptions?.duration || 300,
                includeHiddenNodes: false,
              };

              hscopeLogger.log(
                "coordinator",
                "[AsyncCoordinator] 🎯 Executing post-render fitView",
                fitViewOptions,
              );
              if (
                this.reactFlowInstance &&
                typeof this.reactFlowInstance.fitView === "function"
              ) {
                this.reactFlowInstance.fitView(fitViewOptions);
                hscopeLogger.log(
                  "coordinator",
                  "[AsyncCoordinator] ✅ FitView completed",
                );
              } else {
                hscopeLogger.log(
                  "coordinator",
                  "[AsyncCoordinator] ⚠️ ReactFlow instance not available for fitView",
                );
              }
            });
            hscopeLogger.log(
              "coordinator",
              "[AsyncCoordinator] ✅ FitView enqueued for post-render execution",
            );
          } else {
            hscopeLogger.log(
              "coordinator",
              "[AsyncCoordinator] ⏭️ Skipping FitView execution",
              {
                reason: fitViewCheck.skipReason,
              },
            );
          }
        }
      } else if (this.onReactFlowDataUpdate) {
        // Fallback to callback for backward compatibility
        this.onReactFlowDataUpdate(reactFlowData);
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ ReactFlow data update callback completed successfully (fallback)",
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // PERFORMANCE OPTIMIZATION 3: Performance logging using local variables (no persistent caches)
      this._logPipelinePerformanceMetrics(
        duration,
        performanceMetrics,
        reactFlowData,
        options,
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Optimized synchronous layout and render pipeline failed:",
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          performanceMetrics,
          options,
          timestamp: endTime,
        },
      );

      // Set error state
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Execute ELK layout asynchronously (private helper for enhanced pipeline)
   */
  private async executeELKLayoutAsync(
    state: any, // VisualizationState
    elkBridge: any, // ELKBridge instance
    relayoutEntities?: string[], // undefined = full, [] = none, [ids] = constrained
  ): Promise<void> {
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🎯 Starting ELK layout execution",
        {
          relayoutEntities,
          elkBridgeAvailable: !!elkBridge,
          stateAvailable: !!state,
          timestamp: startTime,
        },
      );

      // Set layout phase to indicate processing
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("laying_out");
      }

      // Validate ELK bridge availability
      if (!elkBridge) {
        throw new Error("ELKBridge instance is required for layout operations");
      }

      if (typeof elkBridge.layout !== "function") {
        throw new Error("ELKBridge layout method is not available");
      }

      // Execute ELK layout calculation with timeout protection
      const layoutPromise = elkBridge.layout(state, relayoutEntities);
      const timeoutMs = 15000; // 15 second timeout for layout operations

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`ELK layout operation timed out after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      });
      // Race between layout completion and timeout
      await Promise.race([layoutPromise, timeoutPromise]);

      // Increment layout count for smart collapse logic
      if (state && typeof state.incrementLayoutCount === "function") {
        state.incrementLayoutCount();
      }

      // Set layout phase to ready after successful ELK layout
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("ready");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ ELK layout completed successfully",
        {
          duration: `${duration}ms`,
          relayoutEntities,
          timestamp: endTime,
        },
      );
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error("[AsyncCoordinator] ❌ ELK layout operation failed:", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        relayoutEntities,
        elkBridgeAvailable: !!elkBridge,
        stateAvailable: !!state,
        timestamp: endTime,
      });

      // Set error state but don't prevent recovery
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Generate ReactFlow data synchronously (private helper for synchronous pipeline)
   */
  private generateReactFlowDataSync(state: any): any {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🎨 Starting ReactFlow data generation",
        {
          stateAvailable: !!state,
          timestamp: startTime,
        },
      );

      // Validate state availability
      if (!state) {
        throw new Error(
          "VisualizationState instance is required for ReactFlow data generation",
        );
      }

      // Set layout phase to indicate rendering
      if (typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("rendering");
      }

      // Get ReactFlowBridge instance (must be set via setBridgeInstances)
      if (!this.reactFlowBridge) {
        throw new Error(
          "ReactFlowBridge instance is not available - call setBridgeInstances() first",
        );
      }

      const reactFlowBridge = this.reactFlowBridge;

      if (typeof reactFlowBridge.toReactFlowData !== "function") {
        throw new Error(
          "ReactFlowBridge toReactFlowData method is not available",
        );
      }

      // Convert to ReactFlow format using current VisualizationState data
      // Type assertion: we know the actual VisualizationState implementation is compatible
      const reactFlowData = reactFlowBridge.toReactFlowData(
        state as any,
        this.interactionHandler,
        this.renderOptions,
      );

      // Validate generated data structure
      if (!reactFlowData || typeof reactFlowData !== "object") {
        throw new Error("ReactFlowBridge returned invalid data structure");
      }

      if (!Array.isArray(reactFlowData.nodes)) {
        console.warn(
          "[AsyncCoordinator] ⚠️ ReactFlow data missing nodes array, using empty array",
        );
        (reactFlowData as any).nodes = [];
      }

      if (!Array.isArray(reactFlowData.edges)) {
        console.warn(
          "[AsyncCoordinator] ⚠️ ReactFlow data missing edges array, using empty array",
        );
        (reactFlowData as any).edges = [];
      }

      // Set layout phase to displayed
      if (typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("displayed");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ ReactFlow data generation completed successfully",
        {
          duration: `${duration}ms`,
          nodesCount: reactFlowData.nodes.length,
          edgesCount: reactFlowData.edges.length,
          timestamp: endTime,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Synchronous ReactFlow render operation failed:",
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          stateAvailable: !!state,
          timestamp: endTime,
        },
      );

      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Cancel ReactFlow operation if it's still queued
   */
  cancelReactFlowOperation(operationId: string): boolean {
    const index = this.queue.findIndex(
      (op) => op.id === operationId && op.type === "reactflow_render",
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
  /**
   * Get status of ReactFlow operations
   */
  getReactFlowOperationStatus(): {
    queued: number;
    processing: boolean;
    lastCompleted?: QueuedOperation;
    lastFailed?: QueuedOperation;
  } {
    const reactFlowOps = this.queue.filter(
      (op) => op.type === "reactflow_render",
    );
    const currentReactFlow = this.currentOperation?.type === "reactflow_render";
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find((op) => op.type === "reactflow_render");
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find((op) => op.type === "reactflow_render");
    return {
      queued: reactFlowOps.length,
      processing: currentReactFlow,
      lastCompleted,
      lastFailed,
    };
  }
  // Application Event System
  /**
   * Queue render config update with ReactFlow re-render
   * This ensures render config changes are applied atomically
   */
  async queueRenderConfigUpdate(
    state: any, // VisualizationState - using any to avoid circular dependency
    updates: any, // RenderConfig updates
    options: QueueOptions = {},
  ): Promise<any> {
    // Queue-enforced execution using _enqueueAndWait pattern
    return this._enqueueAndWait(
      "render_config_update",
      async () => {
        // Update the render config in VisualizationState
        state.updateRenderConfig(updates);
        // Use direct ReactFlowBridge instance (must be set via setBridgeInstances)
        if (!this.reactFlowBridge) {
          throw new Error(
            "ReactFlowBridge instance not available - call setBridgeInstances() first",
          );
        }
        const reactFlowBridge = this.reactFlowBridge;
        // Generate new ReactFlow data with updated config
        const reactFlowData = reactFlowBridge.toReactFlowData(
          state,
          this.interactionHandler,
          this.renderOptions,
        );
        return reactFlowData;
      },
      {
        timeout: options.timeout || 3000, // 3 second default timeout
        maxRetries: options.maxRetries || 1,
      },
    );
  }
  /**
   * Process state change synchronously (private method)
   * Renamed from queueApplicationEvent to reflect synchronous nature
   */
  private processStateChange(
    event: ApplicationEvent,
    _options: QueueOptions = {},
  ): void {
    // Process the application event synchronously based on its type
    this.processApplicationEventSync(event);
  }
  // REMOVED: Deprecated processApplicationEventAndWait method
  // This method has been replaced by synchronous container and search methods:
  // - expandContainer/collapseContainer for container operations
  // - updateSearchResults for search operations
  /**
   * Process individual application event synchronously
   */
  private processApplicationEventSync(event: ApplicationEvent): void {
    switch (event.type) {
      case "container_expand":
        this.handleContainerExpandEventSync(event);
        break;
      case "container_expand_all":
        this.handleContainerExpandAllEventSync(event);
        break;
      case "container_collapse":
        this.handleContainerCollapseEventSync(event);
        break;
      case "search":
        this.handleSearchEventSync(event);
        break;
      case "layout_config_change":
        this.handleLayoutConfigChangeEventSync(event);
        break;
      default:
        throw new Error(`Unknown application event type: ${event.type}`);
    }
  }

  /**
   * Handle container expand event synchronously
   */
  private handleContainerExpandEventSync(event: ApplicationEvent): void {
    const { containerId, state, isTreeOperation } = event.payload;
    if (!containerId || !state) {
      throw new Error("Container expand event missing required payload");
    }
    if (isTreeOperation) {
      // Handle tree node expansion
      if ((state as any).expandTreeNodes) {
        (state as any).expandTreeNodes([containerId]);
      } else {
        console.warn(
          `[AsyncCoordinator] expandTreeNodes method not available on state`,
        );
      }
    } else {
      // Handle container expansion
      if ((state as any)._expandContainerForCoordinator) {
        (state as any)._expandContainerForCoordinator(containerId);
      } else {
        console.warn(
          `[AsyncCoordinator] _expandContainerForCoordinator method not available on state`,
        );
      }
    }
    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle container collapse event synchronously
   */
  private handleContainerCollapseEventSync(event: ApplicationEvent): void {
    const { containerId, state, isTreeOperation } = event.payload;
    if (!containerId || !state) {
      throw new Error("Container collapse event missing required payload");
    }
    if (isTreeOperation) {
      // Handle tree node collapse
      if ((state as any).collapseTreeNodes) {
        (state as any).collapseTreeNodes([containerId]);
      } else {
        console.warn(
          `[AsyncCoordinator] collapseTreeNodes method not available on state`,
        );
      }
    } else {
      // Handle container collapse
      if ((state as any)._collapseContainerForCoordinator) {
        (state as any)._collapseContainerForCoordinator(containerId);
      } else {
        console.warn(
          `[AsyncCoordinator] _collapseContainerForCoordinator method not available on state`,
        );
      }
    }
    // Note: ReactFlow validation and layout updates should be triggered separately
    // The caller should handle these operations after processing the event
  }

  /**
   * Handle container expand all event synchronously
   */
  private handleContainerExpandAllEventSync(event: ApplicationEvent): void {
    const { containerIds, state } = event.payload;
    if (!state) {
      throw new Error("Container expand all event missing required payload");
    }
    // Use VisualizationState's expandContainers method directly
    // This ensures the iterative expansion logic is used for nested containers
    if (containerIds) {
      // For specified containers, use the internal coordinator method
      (state as any)._expandContainersForCoordinator(containerIds);
    } else {
      // For all containers, use the internal coordinator method
      (state as any)._expandContainersForCoordinator();
    }
    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed after bulk operations
  }

  /**
   * Handle search event synchronously
   */
  private handleSearchEventSync(event: ApplicationEvent): void {
    const { query, state } = event.payload;
    if (!state) {
      throw new Error("Search event missing required payload");
    }
    // Perform search in the state
    const results = (state as any).performSearch(query || "");
    // Expand containers containing search results if needed
    if (event.payload.expandContainers && results.length > 0) {
      for (const result of results) {
        if (result.type === "node") {
          // Find containers that contain this node and expand them
          const containers = (state as any).getContainersForNode
            ? (state as any).getContainersForNode(result.id)
            : [];
          for (const container of containers) {
            if (container.collapsed) {
              (state as any)._expandContainerForCoordinator(container.id);
            }
          }
        }
      }
    }
    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle layout config change event synchronously
   */
  private handleLayoutConfigChangeEventSync(event: ApplicationEvent): void {
    const { config, state } = event.payload;
    if (!config || !state) {
      throw new Error("Layout config change event missing required payload");
    }
    // Store the new configuration in the state (if supported)
    // The actual layout update should be triggered separately
    // Note: This is a simplified implementation - in practice, we'd store config in state
  }

  /**
   * Cancel application event if it's still queued
   */
  cancelApplicationEvent(operationId: string): boolean {
    const index = this.queue.findIndex(
      (op) => op.id === operationId && op.type === "application_event",
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
  /**
   * Cancel all application events of a specific type
   */
  cancelApplicationEventsByType(_eventType: ApplicationEvent["type"]): number {
    let cancelledCount = 0;
    // Filter out operations that match the event type
    this.queue = this.queue.filter((op) => {
      if (op.type === "application_event") {
        // We need to check the event type in the operation
        // This is a simplified approach - in practice, we'd need to store event metadata
        cancelledCount++;
        return false;
      }
      return true;
    });
    return cancelledCount;
  }
  /**
   * Get status of application event operations
   */
  getApplicationEventStatus(): {
    queued: number;
    processing: boolean;
    lastCompleted?: QueuedOperation;
    lastFailed?: QueuedOperation;
    queuedByType: Record<string, number>;
  } {
    const appEventOps = this.queue.filter(
      (op) => op.type === "application_event",
    );
    const currentAppEvent = this.currentOperation?.type === "application_event";
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find((op) => op.type === "application_event");
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find((op) => op.type === "application_event");
    // Count queued operations by type (simplified - would need event metadata in practice)
    const queuedByType: Record<string, number> = {
      container_expand: 0,
      container_collapse: 0,
      search: 0,
      layout_config_change: 0,
    };
    return {
      queued: appEventOps.length,
      processing: currentAppEvent,
      lastCompleted,
      lastFailed,
      queuedByType,
    };
  }
  /**
   * Clear all application events from queue
   */
  clearApplicationEvents(): number {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((op) => op.type !== "application_event");
    return initialLength - this.queue.length;
  }
  // Container Operations Integration with Async Coordination
  /**
   * Expand container along with all collapsed ancestors
   * This prevents invariant violations when expanding nested containers
   *
   * Use this when expanding from UI interactions (tree, search, navigation)
   * where you don't know if ancestors are collapsed.
   */
  async expandContainerWithAncestors(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "expand_container_with_ancestors",
      () =>
        this._handleExpandContainerWithAncestors(containerId, state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for expand container with ancestors operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleExpandContainerWithAncestors(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Get collapsed ancestors
    const collapsedAncestors: string[] = [];
    let currentId = state.getContainerParent?.(containerId);

    while (currentId) {
      const ancestorContainer = state.getContainer?.(currentId);
      if (ancestorContainer?.collapsed) {
        collapsedAncestors.unshift(currentId); // Add to front to maintain order
      }
      currentId = state.getContainerParent?.(currentId);
    }

    // If there are collapsed ancestors, use expandContainers handler
    // which handles hierarchical ordering properly
    if (collapsedAncestors.length > 0) {
      return this._handleExpandContainers(
        state,
        [...collapsedAncestors, containerId],
        options,
      );
    } else {
      // No collapsed ancestors, use single container expand handler
      return this._handleExpandContainer(containerId, state, options);
    }
  }

  /**
   * Expand container using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   *
   * NOTE: This assumes all ancestors are already expanded. If you're not sure,
   * use expandContainerWithAncestors() instead to avoid invariant violations.
   */
  async expandContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "expand_container",
      () => this._handleExpandContainer(containerId, state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for expand container operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleExpandContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    // Notify start of container expansion
    this.onContainerExpansionStart?.(containerId);

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 📦 Starting container expand operation",
        {
          containerId,
          relayoutEntities: options.relayoutEntities,
          fitView: options.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!containerId) {
        throw new Error("Container ID is required for expand operation");
      }
      if (!state) {
        throw new Error("VisualizationState is required for expand operation");
      }

      // Use the ELK bridge instance set via setBridgeInstances
      if (!this.elkBridge) {
        throw new Error(
          "ELK bridge is not available - ensure setBridgeInstances was called",
        );
      }

      // Process state change synchronously with error handling
      try {
        const event: ApplicationEvent = {
          type: "container_expand",
          payload: {
            containerId,
            state,
            triggerLayout: false, // Layout handled by pipeline
            layoutConfig: {},
          },
          timestamp: Date.now(),
        };

        this.processStateChange(event);
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ Container state change processed successfully",
          { containerId },
        );
      } catch (stateError) {
        console.error("[AsyncCoordinator] ❌ Container state change failed:", {
          containerId,
          error: (stateError as Error).message,
          stack: (stateError as Error).stack,
        });
        throw new Error(
          `Failed to expand container ${containerId}: ${(stateError as Error).message}`,
        );
      }

      // SEQUENTIAL STEP: Determine viewport behavior based on AutoFit mode
      // In AutoFit mode, we focus on the expanded container instead of using fitView
      const renderConfig = state.getRenderConfig?.();
      const isAutoFitEnabled = renderConfig?.fitView !== false;
      const shouldFocusOnContainer =
        isAutoFitEnabled && !!this.reactFlowInstance;

      // Use enhanced pipeline for layout and render with graceful error handling
      // Call private handler directly to avoid queue deadlock
      // Disable fitView if we're going to focus on the container instead
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: options.relayoutEntities, // Pass through as-is (undefined = full layout)
        fitView: shouldFocusOnContainer ? false : options.fitView, // Disable fitView if focusing on container
        fitViewOptions: options.fitViewOptions,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
      });

      // SEQUENTIAL STEP: Focus viewport on expanded container if in AutoFit mode
      // This replaces fitView to provide a focused view on the specific container
      if (shouldFocusOnContainer) {
        try {
          // Wait for React to render the expanded container before focusing
          // Only wait if there are pending callbacks (i.e., in production with React)
          // CRITICAL: Always wait for React to render and measure the expanded container
          // The layout pipeline has updated the data, but ReactFlow needs time to:
          // 1. Render the new nodes
          // 2. Measure their actual dimensions
          // Without this wait, we'll get stale (pre-expansion) dimensions
          await this.waitForNextRender();

          // Call focusViewportOnElement directly (not through queue to avoid deadlock)
          // This ensures consistent viewport positioning behavior
          await this._handleFocusViewportOnElement(
            containerId,
            this.reactFlowInstance,
            {
              visualizationState: state,
              immediate: true, // Use immediate positioning (duration: 0) for reliability
              // ReactFlow's setCenter() is fire-and-forget with no completion callback.
              // Animated transitions (duration > 0) rely on onMoveEnd event, which only
              // fires if viewport actually moves. This causes race conditions in the queue.
              // Immediate positioning is synchronous and deterministic.
              // No zoom specified - let it auto-calculate to fit the expanded container
            },
          );
        } catch (focusError) {
          // Log but don't fail the expansion if viewport focus fails
          console.error(
            "[AsyncCoordinator] Failed to focus viewport on expanded container:",
            focusError,
          );
          console.error("Error stack:", (focusError as Error).stack);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Container expand operation completed successfully",
        {
          containerId,
          duration: `${duration}ms`,
          nodesCount: reactFlowData?.nodes?.length || 0,
          edgesCount: reactFlowData?.edges?.length || 0,
          timestamp: endTime,
        },
      );

      // Notify completion of container expansion
      this.onContainerExpansionComplete?.(containerId);

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Container expand operation failed:",
        {
          containerId,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          options,
          timestamp: endTime,
        },
      );

      // Notify completion even on error to clean up tracking
      this.onContainerExpansionComplete?.(containerId);

      throw error;
    }
  }

  /**
   * Recursively expand a container and all its descendant containers
   * Expands from outermost to innermost (by depth) in a single atomic operation
   */
  async expandContainerRecursively(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[];
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    return this._enqueueAndWait(
      "expand_container_recursive",
      () => this._handleExpandContainerRecursively(containerId, state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for recursive container expansion
   */
  private async _handleExpandContainerRecursively(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[];
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
    } = {},
  ): Promise<any> {
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "📦🔄 Starting recursive container expand",
        { containerId, timestamp: startTime },
      );

      // Collect all descendant containers with their depths
      const descendantsWithDepth: Array<{ id: string; depth: number }> = [];
      const collectDescendants = (id: string, depth: number) => {
        const cont = state.getContainer(id);
        if (!cont) return;

        for (const childId of cont.children) {
          const childContainer = state.getContainer(childId);
          if (childContainer) {
            descendantsWithDepth.push({ id: childId, depth });
            collectDescendants(childId, depth + 1);
          }
        }
      };

      collectDescendants(containerId, 1);

      // Sort by depth (shallowest first) to expand from outside in
      descendantsWithDepth.sort((a, b) => a.depth - b.depth);

      // Expand root container first
      state._expandContainerInternal(containerId);

      // Expand all descendants in depth order (shallowest first)
      // This ensures parents are expanded before their children
      for (const { id, depth } of descendantsWithDepth) {
        const container = state.getContainer(id);
        if (container && container.collapsed) {
          state._expandContainerInternal(id);
        }
      }

      // Single layout and render after all expansions
      // Call the private handler directly to avoid queue deadlock
      // (we're already inside a queued operation)
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: options.relayoutEntities,
        fitView: options.fitView,
        fitViewOptions: options.fitViewOptions,
      });

      const duration = Date.now() - startTime;
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Recursive expand completed",
        {
          containerId,
          expandedCount: descendantsWithDepth.length + 1,
          duration: `${duration}ms`,
        },
      );

      return reactFlowData;
    } catch (error) {
      console.error("[AsyncCoordinator] ❌ Recursive expand failed:", error);
      throw error;
    }
  }

  /**
   * Collapse container using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   */
  async collapseContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "collapse_container",
      () => this._handleCollapseContainer(containerId, state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for collapse container operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleCollapseContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 📦 Starting container collapse operation",
        {
          containerId,
          relayoutEntities: options.relayoutEntities,
          fitView: options.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!containerId) {
        throw new Error("Container ID is required for collapse operation");
      }
      if (!state) {
        throw new Error(
          "VisualizationState is required for collapse operation",
        );
      }

      // Use the ELK bridge instance set via setBridgeInstances
      if (!this.elkBridge) {
        throw new Error(
          "ELK bridge is not available - ensure setBridgeInstances was called",
        );
      }

      // Process state change synchronously with error handling
      try {
        const event: ApplicationEvent = {
          type: "container_collapse",
          payload: {
            containerId,
            state,
            triggerLayout: false, // Layout handled by pipeline
            layoutConfig: {},
          },
          timestamp: Date.now(),
        };

        this.processStateChange(event);
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ Container state change processed successfully",
          { containerId },
        );
      } catch (stateError) {
        console.error("[AsyncCoordinator] ❌ Container state change failed:", {
          containerId,
          error: (stateError as Error).message,
          stack: (stateError as Error).stack,
        });
        throw new Error(
          `Failed to collapse container ${containerId}: ${(stateError as Error).message}`,
        );
      }

      // SEQUENTIAL STEP: Determine viewport behavior based on AutoFit mode
      // In AutoFit mode, we focus on the collapsed container instead of using fitView
      const renderConfig = state.getRenderConfig?.();
      const isAutoFitEnabled = renderConfig?.fitView !== false;
      const shouldFocusOnContainer =
        isAutoFitEnabled && !!this.reactFlowInstance;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🔍 Collapse viewport focus check:",
        {
          containerId,
          isAutoFitEnabled,
          hasReactFlowInstance: !!this.reactFlowInstance,
          shouldFocusOnContainer,
          renderConfig,
        },
      );

      // Use enhanced pipeline for layout and render with graceful error handling
      // Call private handler directly to avoid queue deadlock
      // Disable fitView if we're going to focus on the container instead
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: options.relayoutEntities, // Pass through as-is (undefined = full layout)
        fitView: shouldFocusOnContainer ? false : options.fitView, // Disable fitView if focusing on container
        fitViewOptions: options.fitViewOptions,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
      });

      // SEQUENTIAL STEP: Focus viewport on collapsed container if in AutoFit mode
      // This replaces fitView to provide a focused view on the specific container
      if (shouldFocusOnContainer) {
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] 🎯 Focusing viewport on collapsed container (AutoFit mode)",
          { containerId },
        );

        try {
          // CRITICAL: Always wait for React to render and measure the collapsed container
          // The layout pipeline has updated the data, but ReactFlow needs time to:
          // 1. Render the updated container
          // 2. Measure its actual dimensions
          // Without this wait, we'll get stale (pre-collapse) dimensions
          await this.waitForNextRender();

          // Call focusViewportOnElement directly (not through queue to avoid deadlock)
          // This ensures consistent viewport positioning behavior
          await this._handleFocusViewportOnElement(
            containerId,
            this.reactFlowInstance,
            {
              visualizationState: state,
              immediate: true, // Use immediate positioning (duration: 0) for reliability
              // ReactFlow's setCenter() is fire-and-forget with no completion callback.
              // Animated transitions (duration > 0) rely on onMoveEnd event, which only
              // fires if viewport actually moves. This causes race conditions in the queue.
              // Immediate positioning is synchronous and deterministic.
              zoom: 1.0, // Fixed zoom for collapsed containers
            },
          );
        } catch (focusError) {
          // Log but don't fail the collapse if viewport focus fails
          console.error(
            "[AsyncCoordinator] Failed to focus viewport on collapsed container:",
            focusError,
          );
          console.error("Error stack:", (focusError as Error).stack);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Container collapse operation completed successfully",
        {
          containerId,
          duration: `${duration}ms`,
          nodesCount: reactFlowData?.nodes?.length || 0,
          edgesCount: reactFlowData?.edges?.length || 0,
          timestamp: endTime,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Container collapse operation failed:",
        {
          containerId,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          options,
          timestamp: endTime,
        },
      );

      throw error;
    }
  }
  /**
   * Expand all containers using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   */
  async expandContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          relayoutEntities?: string[]; // Layout control
          fitView?: boolean; // FitView control
          fitViewOptions?: { padding?: number; duration?: number };
          timeout?: number;
          maxRetries?: number;
          triggerLayout?: boolean; // Backward compatibility (ignored)
        },
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Handle backward compatibility - if second parameter is options object, use it
    let actualOptions = options;
    if (containerIdsOrOptions && !Array.isArray(containerIdsOrOptions)) {
      actualOptions = containerIdsOrOptions;
    }

    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "expand_containers",
      () => this._handleExpandContainers(state, containerIdsOrOptions, options),
      { timeout: actualOptions.timeout, maxRetries: actualOptions.maxRetries },
    );
  }

  /**
   * Private handler for expand all containers operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleExpandContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          relayoutEntities?: string[]; // Layout control
          fitView?: boolean; // FitView control
          fitViewOptions?: { padding?: number; duration?: number };
          timeout?: number;
          maxRetries?: number;
          triggerLayout?: boolean; // Backward compatibility (ignored)
        },
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    // Handle backward compatibility - if second parameter is options object, use it
    let containerIds: string[] | undefined;
    let actualOptions = options;

    try {
      if (containerIdsOrOptions) {
        if (Array.isArray(containerIdsOrOptions)) {
          // New signature: containerIds provided
          containerIds = containerIdsOrOptions;
        } else {
          // Old signature: options provided as second parameter
          actualOptions = containerIdsOrOptions;
          containerIds = undefined;
        }
      }

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 📦 Starting expand all containers operation",
        {
          containerIds,
          relayoutEntities: actualOptions.relayoutEntities,
          fitView: actualOptions.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!state) {
        throw new Error(
          "VisualizationState is required for expand all containers operation",
        );
      }

      // Use the ELK bridge instance set via setBridgeInstances
      if (!this.elkBridge) {
        throw new Error(
          "ELK bridge is not available - ensure setBridgeInstances was called",
        );
      }

      // Process state change synchronously with error handling
      try {
        const event: ApplicationEvent = {
          type: "container_expand_all",
          payload: {
            containerIds,
            state,
            triggerLayout: false, // Layout handled by pipeline
            layoutConfig: {},
          },
          timestamp: Date.now(),
        };

        this.processStateChange(event);
        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ Expand all containers state change processed successfully",
          {
            containerIds: containerIds?.length || "all",
          },
        );
      } catch (stateError) {
        console.error(
          "[AsyncCoordinator] ❌ Expand all containers state change failed:",
          {
            containerIds,
            error: (stateError as Error).message,
            stack: (stateError as Error).stack,
          },
        );
        throw new Error(
          `Failed to expand all containers: ${(stateError as Error).message}`,
        );
      }

      // Use enhanced pipeline for layout and render (full layout for expand all)
      // Call private handler directly to avoid queue deadlock
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: actualOptions.relayoutEntities, // undefined = full layout for expand all
        fitView: actualOptions.fitView,
        fitViewOptions: actualOptions.fitViewOptions,
        timeout: actualOptions.timeout,
        maxRetries: actualOptions.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Expand all containers operation completed successfully",
        {
          containerIds: containerIds?.length || "all",
          duration: `${duration}ms`,
          nodesCount: reactFlowData?.nodes?.length || 0,
          edgesCount: reactFlowData?.edges?.length || 0,
          timestamp: endTime,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Expand all containers operation failed:",
        {
          containerIds: Array.isArray(containerIdsOrOptions)
            ? containerIdsOrOptions
            : "all",
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          options: actualOptions,
          timestamp: endTime,
        },
      );

      throw error;
    }
  }
  /**
   * Collapse all containers using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   */
  async collapseContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          relayoutEntities?: string[]; // Layout control
          fitView?: boolean; // FitView control
          fitViewOptions?: { padding?: number; duration?: number };
          timeout?: number;
          maxRetries?: number;
          triggerLayout?: boolean; // Backward compatibility (ignored)
        },
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // Handle backward compatibility - if second parameter is options object, use it
    let actualOptions = options;
    if (containerIdsOrOptions && !Array.isArray(containerIdsOrOptions)) {
      actualOptions = containerIdsOrOptions;
    }

    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "collapse_containers",
      () =>
        this._handleCollapseContainers(state, containerIdsOrOptions, options),
      { timeout: actualOptions.timeout, maxRetries: actualOptions.maxRetries },
    );
  }

  /**
   * Private handler for collapse all containers operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleCollapseContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          relayoutEntities?: string[]; // Layout control
          fitView?: boolean; // FitView control
          fitViewOptions?: { padding?: number; duration?: number };
          timeout?: number;
          maxRetries?: number;
          triggerLayout?: boolean; // Backward compatibility (ignored)
        },
    options: {
      relayoutEntities?: string[]; // Layout control
      fitView?: boolean; // FitView control
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
      triggerLayout?: boolean; // Backward compatibility (ignored)
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    // Handle backward compatibility - if second parameter is options object, use it
    let containerIds: string[] | undefined;
    let actualOptions = options;

    try {
      if (containerIdsOrOptions) {
        if (Array.isArray(containerIdsOrOptions)) {
          // New signature: containerIds provided
          containerIds = containerIdsOrOptions;
        } else {
          // Old signature: options provided as second parameter
          actualOptions = containerIdsOrOptions;
          containerIds = undefined;
        }
      }

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 📦 Starting collapse all containers operation",
        {
          containerIds,
          relayoutEntities: actualOptions.relayoutEntities,
          fitView: actualOptions.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!state) {
        throw new Error(
          "VisualizationState is required for collapse all containers operation",
        );
      }

      // Use the ELK bridge instance set via setBridgeInstances
      if (!this.elkBridge) {
        throw new Error(
          "ELK bridge is not available - ensure setBridgeInstances was called",
        );
      }

      // Get containers to collapse - either specified list or all expanded containers
      let containersToCollapse: any[] = [];
      try {
        if (containerIds && containerIds.length > 0) {
          // Collapse only specified containers that are currently expanded
          containersToCollapse =
            state.visibleContainers?.filter(
              (container: any) =>
                containerIds!.includes(container.id) && !container.collapsed,
            ) || [];
        } else {
          // Collapse all expanded containers (existing behavior)
          containersToCollapse =
            state.visibleContainers?.filter(
              (container: any) => !container.collapsed,
            ) || [];
        }

        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] 📋 Found containers to collapse",
          {
            totalContainers: containersToCollapse.length,
            containerIds: containersToCollapse.map((c: any) => c.id),
          },
        );
      } catch (containerError) {
        console.error(
          "[AsyncCoordinator] ❌ Failed to identify containers to collapse:",
          {
            containerIds,
            error: (containerError as Error).message,
            stack: (containerError as Error).stack,
          },
        );
        throw new Error(
          `Failed to identify containers to collapse: ${(containerError as Error).message}`,
        );
      }

      // Process state changes synchronously for all containers with error handling
      const successfullyCollapsed: string[] = [];
      for (const container of containersToCollapse) {
        try {
          const event: ApplicationEvent = {
            type: "container_collapse",
            payload: {
              containerId: container.id,
              state,
              triggerLayout: false, // Layout handled by pipeline
              layoutConfig: {},
            },
            timestamp: Date.now(),
          };
          this.processStateChange(event);
          successfullyCollapsed.push(container.id);
        } catch (stateError) {
          console.warn(
            "[AsyncCoordinator] ⚠️ Failed to collapse container, continuing with others:",
            {
              containerId: container.id,
              error: (stateError as Error).message,
            },
          );
          // Continue with other containers
        }
      }

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Container state changes processed",
        {
          totalRequested: containersToCollapse.length,
          successfullyCollapsed: successfullyCollapsed.length,
          failedContainers:
            containersToCollapse.length - successfullyCollapsed.length,
        },
      );

      // Use enhanced pipeline for layout and render (full layout for collapse all)
      // Call private handler directly to avoid queue deadlock
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: actualOptions.relayoutEntities, // undefined = full layout for collapse all
        fitView: actualOptions.fitView,
        fitViewOptions: actualOptions.fitViewOptions,
        timeout: actualOptions.timeout,
        maxRetries: actualOptions.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Collapse all containers operation completed successfully",
        {
          containerIds: containerIds?.length || "all",
          collapsedCount: successfullyCollapsed.length,
          duration: `${duration}ms`,
          nodesCount: reactFlowData?.nodes?.length || 0,
          edgesCount: reactFlowData?.edges?.length || 0,
          timestamp: endTime,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        "[AsyncCoordinator] ❌ Collapse all containers operation failed:",
        {
          containerIds: Array.isArray(containerIdsOrOptions)
            ? containerIdsOrOptions
            : "all",
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          options: actualOptions,
          timestamp: endTime,
        },
      );

      throw error;
    }
  }
  /**
   * Expand tree node using synchronous state changes
   */
  expandTreeNode(
    nodeId: string,
    state: any, // VisualizationState
    _options: QueueOptions = {},
  ): void {
    const event: ApplicationEvent = {
      type: "container_expand", // Reuse container expand event type
      payload: {
        containerId: nodeId,
        state,
        triggerLayout: false, // Tree operations don't trigger layout
        isTreeOperation: true,
      },
      timestamp: Date.now(),
    };
    // Process state change synchronously
    this.processStateChange(event);
  }
  /**
   * Collapse tree node using synchronous state changes
   */
  collapseTreeNode(
    nodeId: string,
    state: any, // VisualizationState
    _options: QueueOptions = {},
  ): void {
    const event: ApplicationEvent = {
      type: "container_collapse", // Reuse container collapse event type
      payload: {
        containerId: nodeId,
        state,
        triggerLayout: false, // Tree operations don't trigger layout
        isTreeOperation: true,
      },
      timestamp: Date.now(),
    };
    // Process state change synchronously
    this.processStateChange(event);
  }
  /**
   * Expand all tree nodes using synchronous state changes
   */
  expandAllTreeNodes(
    state: any, // VisualizationState
    nodeIds?: string[], // Optional list, defaults to all nodes
    options: QueueOptions = {},
  ): void {
    // Get nodes to expand - either specified list or all collapsed nodes
    const nodesToExpand =
      nodeIds ||
      state.visibleContainers
        ?.filter((container: any) => container.collapsed)
        ?.map((container: any) => container.id) ||
      [];
    // Expand each node synchronously
    for (const nodeId of nodesToExpand) {
      this.expandTreeNode(nodeId, state, options);
    }
  }
  /**
   * Collapse all tree nodes using synchronous state changes
   */
  collapseAllTreeNodes(
    state: any, // VisualizationState
    nodeIds?: string[], // Optional list, defaults to all nodes
    options: QueueOptions = {},
  ): void {
    // Get nodes to collapse - either specified list or all expanded nodes
    const nodesToCollapse =
      nodeIds ||
      state.visibleContainers
        ?.filter((container: any) => !container.collapsed)
        ?.map((container: any) => container.id) ||
      [];
    // Collapse each node synchronously
    for (const nodeId of nodesToCollapse) {
      this.collapseTreeNode(nodeId, state, options);
    }
  }
  /**
   * Navigate to element through async coordination
   */
  async navigateToElement(
    elementId: string,
    visualizationState: any, // VisualizationState
    reactFlowInstance?: any,
  ): Promise<void> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "navigate_to_element",
      () =>
        this._handleNavigateToElement(
          elementId,
          visualizationState,
          reactFlowInstance,
        ),
      {},
    );
  }

  /**
   * Private handler for navigate to element
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleNavigateToElement(
    elementId: string,
    visualizationState: any, // VisualizationState
    reactFlowInstance?: any,
  ): Promise<void> {
    // Set navigation selection in state
    if (visualizationState.navigateToElement) {
      visualizationState.navigateToElement(elementId);
    }
    // Focus viewport if ReactFlow instance is provided
    if (reactFlowInstance) {
      await this._handleFocusViewportOnElement(elementId, reactFlowInstance);
    }
  }
  /**
   * Focus viewport on element
   */
  async focusViewportOnElement(
    elementId: string,
    reactFlowInstance: any,
    options?: {
      zoom?: number;
      duration?: number;
      visualizationState?: any;
      immediate?: boolean; // If true, snap immediately without animation
    },
  ): Promise<void> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "focus_viewport_on_element",
      () =>
        this._handleFocusViewportOnElement(
          elementId,
          reactFlowInstance,
          options,
        ),
      {},
    );
  }

  /**
   * Private handler for focus viewport on element
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleFocusViewportOnElement(
    elementId: string,
    reactFlowInstance: any,
    options?: {
      zoom?: number;
      duration?: number;
      visualizationState?: any;
      immediate?: boolean; // If true, snap immediately without animation
    },
  ): Promise<void> {
    // Use provided instance or fall back to internal instance
    const instanceToUse = reactFlowInstance || this.reactFlowInstance;

    if (!instanceToUse) {
      throw new Error("ReactFlow instance is required for viewport focus");
    }
    try {
      // No need to wait for React - the caller should use waitForNextRender() if needed
      // This method assumes React has already rendered the nodes

      // Try to get the node directly first
      let node = instanceToUse.getNode(elementId);

      // If not found and we have visualizationState, find the visible ancestor
      if (!node && options?.visualizationState) {
        const visibleElementId =
          options.visualizationState.getLowestVisibleAncestorInGraph?.(
            elementId,
          );
        if (visibleElementId) {
          node = instanceToUse.getNode(visibleElementId);
        }
      }

      if (node) {

        // Calculate absolute position by recursively walking up the entire parent chain
        let absoluteX = node.position.x;
        let absoluteY = node.position.y;

        // Recursively add all ancestor positions to get absolute coordinates
        let currentNode = node;
        while (currentNode.parentNode) {
          const parent = instanceToUse.getNode(currentNode.parentNode);
          if (parent) {
            absoluteX += parent.position.x;
            absoluteY += parent.position.y;
            currentNode = parent;
          } else {
            break;
          }
        }

        // Pan to the node with smooth animation
        // Calculate zoom level to fit the node on screen with padding
        // Require actual dimensions - fail fast if not available
        const nodeWidth = node.measured?.width || node.width;
        const nodeHeight = node.measured?.height || node.height;

        if (!nodeWidth || !nodeHeight) {
          throw new Error(
            `Cannot focus on element ${elementId}: node dimensions not available (width: ${nodeWidth}, height: ${nodeHeight}). ` +
              `Node may not be rendered yet. measured: ${JSON.stringify(node.measured)}, width: ${node.width}, height: ${node.height}`,
          );
        }

        const x = absoluteX + nodeWidth / 2;
        const y = absoluteY + nodeHeight / 2;

        // Calculate zoom to fit with padding
        // Use if options.zoom is explicitly provided, otherwise calculate zoom to fit
        let targetZoom: number;

        if (options?.zoom !== undefined) {
          // Explicit zoom provided - use it as-is (no capping for explicit values)
          targetZoom = options.zoom;
        } else {
          // Calculate zoom to fit the node with comfortable padding
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const paddingFactor = 0.8; // Use 80% of viewport (20% padding total) for better visibility

          // Node dimensions are in the graph coordinate space (unscaled)
          // Calculate what zoom would fit the node in the viewport with padding
          const zoomToFitWidth = (viewportWidth * paddingFactor) / nodeWidth;
          const zoomToFitHeight = (viewportHeight * paddingFactor) / nodeHeight;
          const zoomToFit = Math.min(zoomToFitWidth, zoomToFitHeight);

          // Cap at 1.0 for maximum zoom (don't zoom in beyond native size)
          // Allow zooming out below 1.0 for large containers
          // Also set a minimum zoom of 0.1 to prevent zooming out too far
          targetZoom = Math.max(0.1, Math.min(1.0, zoomToFit));
        }

        // Use immediate positioning (duration: 0) by default for reliability
        // Can be overridden with options.immediate = false or by providing explicit duration
        const duration =
          options?.duration !== undefined
            ? options.duration // Use explicit duration if provided
            : options?.immediate === false
              ? NAVIGATION_TIMING.VIEWPORT_ANIMATION_DURATION
              : 0; // Default to immediate for reliability

        // Mark animation start if duration > 0
        if (duration > 0) {
          this.markViewportAnimationStart();
        }

        instanceToUse.setCenter(x, y, {
          zoom: targetZoom,
          duration: duration,
        });

        // CRITICAL: Wait for viewport animation to complete before returning
        // This ensures sequential execution - the next operation won't start until this viewport change finishes
        // We ALWAYS wait if duration > 0, regardless of the flag state
        // NOTE: Waiting for animation is unreliable because ReactFlow's onMoveEnd only fires
        // if the viewport actually moves. For navigation/search, we accept this limitation
        // and trigger callbacks based on duration timeout instead.
        if (duration > 0) {
          // Mark animation start for tracking
          // Don't wait for completion - return immediately to avoid hanging
          // Callbacks should use setTimeout(callback, duration) instead of waiting for events
        }
      } else {
        console.warn(
          `[AsyncCoordinator] Element ${elementId} not found in ReactFlow`,
        );
      }
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Failed to focus viewport on ${elementId}:`,
        error,
      );
      throw error;
    }
  }
  // Error Handling and Recovery Methods
  /**
   * Execute container expansion with comprehensive error handling
   */
  expandContainerWithErrorHandling(
    containerId: string,
    state: any, // VisualizationState
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any;
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      // Execute synchronously (respecting core architecture)
      this.expandContainer(containerId, state, options);
      return {
        success: true,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Container expansion failed for ${containerId}:`,
        error,
      );
      // Log container expansion error
      console.error(
        `[AsyncCoordinator] Container expansion failed for: ${containerId}`,
        error,
      );
      return {
        success: false,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    }
  }
  /**
   * Execute batch container expansion with comprehensive error handling
   */
  expandContainersWithErrorHandling(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          triggerLayout?: boolean;
          layoutConfig?: any;
          timeout?: number;
          maxRetries?: number;
        },
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any;
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      // Execute synchronously (respecting core architecture)
      this.expandContainers(state, containerIdsOrOptions, options);
      return {
        success: true,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Batch container expansion failed:`,
        error,
      );
      // Determine which containers were being expanded
      let containerIds: string[];
      if (Array.isArray(containerIdsOrOptions)) {
        containerIds = containerIdsOrOptions;
      } else {
        // Get all collapsed containers as fallback
        containerIds = state.visibleContainers
          .filter((container: any) => container.collapsed)
          .map((container: any) => container.id);
      }
      // Log container expansion error
      console.error(
        `[AsyncCoordinator] Container expansion failed for: ${containerIds.join(", ")}`,
        error,
      );
      return {
        success: false,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    }
  }
  /**
   * Execute tree node expansion with comprehensive error handling
   */
  expandTreeNodeWithErrorHandling(
    nodeId: string,
    state: any, // VisualizationState
    _options: {
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      // Execute synchronously (respecting core architecture)
      if (state.expandTreeNodes) {
        state.expandTreeNodes([nodeId]);
      } else {
        throw new Error("expandTreeNodes method not available");
      }
      return {
        success: true,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Tree node expansion failed for ${nodeId}:`,
        error,
      );
      // Log tree expansion error
      console.error(
        `[AsyncCoordinator] Tree expansion failed for node: ${nodeId}`,
        error,
      );
      return {
        success: false,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    }
  }
  /**
   * Execute navigation with comprehensive error handling
   */
  navigateToElementWithErrorHandling(
    elementId: string,
    visualizationState: any, // VisualizationState
    reactFlowInstance?: any, // ReactFlowInstance
    options: {
      timeout?: number;
      maxRetries?: number;
      zoom?: number;
      duration?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      // Execute synchronously (respecting core architecture)
      // Note: We skip temporary highlight by default, as it's typically set later
      // by HydroscopeCore after viewport animation. However, for testing or direct
      // calls, the highlight will still be set via navigateToElement unless skipped.
      if (visualizationState.navigateToElement) {
        visualizationState.navigateToElement(elementId, {
          skipTemporaryHighlight: false, // Allow highlight to be set for testing
        });
      } else {
        throw new Error("navigateToElement method not available");
      }

      // Center the viewport on the element
      // Navigation should ALWAYS pan/zoom regardless of autofit settings
      // Don't pass a default zoom - let focusViewportOnElement calculate the best fit
      const instanceToUse = reactFlowInstance || this.reactFlowInstance;
      if (instanceToUse) {
        // Queue the viewport focus + spotlight sequence
        // Use animated transition for better UX (unlike container expand/collapse which use immediate)
        const animationDuration =
          options.duration ?? NAVIGATION_TIMING.VIEWPORT_ANIMATION_DURATION;

        // Fire-and-forget .then() is acceptable here because spotlight is a non-critical
        // visual effect that shouldn't block navigation. The core navigation functionality
        // (highlight) works even if spotlight fails.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.focusViewportOnElement(elementId, instanceToUse, {
          zoom: options.zoom, // Only use explicit zoom if provided
          duration: animationDuration,
          visualizationState: visualizationState,
        }).then(() => {
          // Trigger spotlight after animation duration
          // ReactFlow's setCenter() is fire-and-forget with no completion callback.
          // The onMoveEnd event only fires if viewport actually moves, causing hangs when
          // viewport is already at target position. Using duration-based timeout is the only
          // reliable way to trigger spotlight after animation completes.
          setTimeout(() => {
            if (this.onSearchResultFocused) {
              this.onSearchResultFocused(elementId, options.zoom);
            }
          }, animationDuration);
        })
          .catch((error) => {
            // Log viewport focus errors for debugging
            console.error(
              `[AsyncCoordinator] Failed to focus viewport on element ${elementId}:`,
              error,
            );
            // These don't block the core navigation functionality (highlight still works)
          });
      } else {
        console.warn(
          `[AsyncCoordinator] Cannot focus viewport - reactFlowInstance not available`,
        );
      }

      // Don't trigger ReactFlow data updates for navigation
      // Using spotlight overlay instead to avoid flicker

      return {
        success: true,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Navigation failed for element ${elementId}:`,
        error,
      );
      // Log navigation error
      console.error(
        `[AsyncCoordinator] Navigation failed for element: ${elementId}`,
        error,
      );
      return {
        success: false,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    }
  }
  /**
   * Execute viewport focus with comprehensive error handling
   */
  focusViewportOnElementWithErrorHandling(
    _reactFlowInstance: any, // ReactFlowInstance
    _options: {
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    // TODO: Implement actual viewport focusing logic
    // For now, just return success as this is a placeholder implementation
    return {
      success: true,
      fallbackApplied: false,
      userFeedbackShown: false,
    };
  }
  /**
   * Execute search operation with comprehensive error handling
   */
  performSearchWithErrorHandling(
    query: string,
    state: any, // VisualizationState
    options: {
      timeout?: number;
      maxRetries?: number;
      expandContainers?: boolean;
    } = {},
  ): {
    results: any[];
    recovery?: ErrorRecoveryResult;
  } {
    try {
      // Perform the search operation synchronously (respecting core architecture)
      const searchResults = state.performSearch
        ? state.performSearch(query)
        : [];
      // Optionally expand containers containing results
      if (options.expandContainers && searchResults.length > 0) {
        const containerIds = this._getContainersForSearchResults(
          searchResults,
          state,
        );
        if (containerIds.length > 0) {
          try {
            this.expandContainers(state, containerIds);
          } catch (expansionError) {
            console.warn(
              `[AsyncCoordinator] Container expansion failed during search:`,
              expansionError,
            );
            // Continue with search results even if expansion fails
          }
        }
      }
      return { results: searchResults };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Search failed for query "${query}":`,
        error,
      );
      // Log search error
      console.error(
        `[AsyncCoordinator] Search failed for query: "${query}"`,
        error,
      );
      return {
        results: [],
        recovery: {
          success: false,
          fallbackApplied: false,
          userFeedbackShown: false,
        },
      };
    }
  }

  /**
   * Update search results with highlighting and optional container expansion
   * This method handles both search highlighting and container expansion atomically
   * Returns ReactFlowData when complete pipeline is finished (including FitView if enabled)
   */
  async updateSearchResults(
    query: string,
    state: any, // VisualizationState
    options: {
      // Container expansion control - whether search triggers container expansion (requires layout)
      expandContainers?: boolean;

      // FitView control - handled internally, no callbacks needed
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };

      // Standard options
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any[]> {
    // Queue-enforced execution - ensures atomic, sequential processing
    // Returns SearchResult[] AFTER all async work (container expansion, layout, render) completes
    return this._enqueueAndWait(
      "update_search_results",
      () => this._handleUpdateSearchResults(query, state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for search update operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleUpdateSearchResults(
    query: string,
    state: any, // VisualizationState
    options: {
      // Container expansion control - whether search triggers container expansion (requires layout)
      expandContainers?: boolean;

      // FitView control - handled internally, no callbacks needed
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };

      // Standard options
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🔍 Starting search update operation",
        {
          query,
          expandContainers: options.expandContainers,
          fitView: options.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!state) {
        throw new Error("VisualizationState is required for search operations");
      }

      // Use the ELK bridge instance set via setBridgeInstances
      if (!this.elkBridge) {
        throw new Error(
          "ELK bridge is not available - ensure setBridgeInstances was called",
        );
      }

      // Step 1: Perform search in VisualizationState (synchronous) - FAIL FAST on errors
      const searchResults = state.performSearch
        ? state.performSearch(query)
        : [];

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Search completed successfully",
        {
          query,
          resultsCount: searchResults.length,
        },
      );

      // Step 2: Optionally expand containers containing search results
      if (options.expandContainers && searchResults.length > 0) {
        // Find containers that need to be expanded for search results
        const containerIds = this._getContainersForSearchResults(
          searchResults,
          state,
        );

        if (containerIds && containerIds.length > 0) {
          hscopeLogger.log(
            "coordinator",
            "[AsyncCoordinator] 📦 Expanding containers for search results",
            {
              containerIds,
              resultsCount: searchResults.length,
            },
          );

          // Expand containers synchronously - FAIL FAST on errors
          for (const containerId of containerIds) {
            if (!state._expandContainerForCoordinator) {
              throw new Error(
                `Container expansion method not available for container: ${containerId}`,
              );
            }
            state._expandContainerForCoordinator(containerId);
          }

          // Execute layout and render pipeline with container expansion
          // IMPORTANT: Call _handleLayoutAndRenderPipeline directly to avoid queue deadlock
          // We're already in a queued operation (updateSearchResults), so we can't enqueue another one
          const reactFlowData = await this._handleLayoutAndRenderPipeline(
            state,
            {
              relayoutEntities: undefined, // Full layout needed when expanding containers to avoid overlaps
              fitView: false, // Don't use fitView, we'll focus on first result instead
              timeout: options.timeout,
              maxRetries: options.maxRetries,
            },
          );

          // Focus viewport on first result to ensure it's visible
          // Use immediate positioning (no animation) to avoid conflicts with navigation
          if (searchResults.length > 0 && this.reactFlowInstance) {
            const firstResult = searchResults[0];
            const elementId = firstResult.id;

            await this._handleFocusViewportOnElement(
              elementId,
              this.reactFlowInstance,
              {
                duration: 0, // Immediate, no animation
              },
            );
          }

          const endTime = Date.now();
          const duration = endTime - startTime;

          hscopeLogger.log(
            "coordinator",
            "[AsyncCoordinator] ✅ Search update with container expansion completed successfully",
            {
              query,
              duration: `${duration}ms`,
              expandedContainers: containerIds.length,
              resultsCount: searchResults.length,
              timestamp: endTime,
            },
          );

          // Wait for React to render the expanded containers before returning
          // This ensures elements are in the DOM when caller tries to navigate
          await this.waitForNextRender();

          // Return search results after all work completes AND React has rendered
          return searchResults;
        }
      }

      // Step 3: If no container expansion needed, just update ReactFlow with search highlights - FAIL FAST
      const reactFlowData = this.generateReactFlowDataImperative(state);
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ ReactFlow data generated for search highlighting",
      );

      // Step 4: Focus on first search result with zoom 1.0 (instead of fitView)
      // Enqueue for post-render to ensure React has updated node positions
      // Focus viewport on first result to ensure it's visible
      // Use immediate positioning (no animation) to avoid conflicts with navigation
      if (searchResults.length > 0 && this.reactFlowInstance) {
        const firstResult = searchResults[0];
        const elementId = firstResult.id;

        await this._handleFocusViewportOnElement(
          elementId,
          this.reactFlowInstance,
          {
            duration: 0, // Immediate, no animation
          },
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Search update completed successfully",
        {
          query,
          duration: `${duration}ms`,
          resultsCount: searchResults.length,
          expandContainers: options.expandContainers,
          fitView: options.fitView,
          timestamp: endTime,
        },
      );

      // Wait for React to render before returning (even without expansion, search highlights need to render)
      await this.waitForNextRender();

      // Return search results after all work completes AND React has rendered
      return searchResults;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error("[AsyncCoordinator] ❌ Search update failed:", {
        query,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options,
        timestamp: endTime,
      });

      // Set error state
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Clear search results and highlights
   * This method coordinates all search clearing operations to prevent React re-render cascades
   */
  async clearSearch(
    state: any, // VisualizationState
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "clear_search",
      () => this._handleClearSearch(state, options),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for search clear operation
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleClearSearch(
    state: any, // VisualizationState
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] 🧹 Starting search clear operation",
        {
          fitView: options.fitView,
          timestamp: startTime,
        },
      );

      // Validate inputs
      if (!state) {
        throw new Error(
          "VisualizationState is required for search clear operations",
        );
      }

      // Step 1: Clear search state in VisualizationState (synchronous)
      if (typeof state.clearSearch === "function") {
        state.clearSearch();

        hscopeLogger.log(
          "coordinator",
          "[AsyncCoordinator] ✅ Search state cleared",
        );
      } else {
        throw new Error(
          "[AsyncCoordinator] VisualizationState must have clearSearch method",
        );
      }

      // Step 2: Re-render to remove search highlights (no layout needed, just styling update)
      // IMPORTANT: Call _handleLayoutAndRenderPipeline directly to avoid queue deadlock
      // We're already in a queued operation (clearSearch), so we can't enqueue another one
      const reactFlowData = await this._handleLayoutAndRenderPipeline(state, {
        relayoutEntities: [], // No layout needed, just re-render to remove highlights
        fitView: options.fitView || false, // Default to false for clear operations
        fitViewOptions: options.fitViewOptions,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ✅ Search clear completed successfully",
        {
          duration: `${duration}ms`,
          fitView: options.fitView,
          timestamp: endTime,
        },
      );

      return reactFlowData;
    } catch (error) {
      console.error(
        "[AsyncCoordinator] ❌ CLEAR SEARCH: Failed with error:",
        error,
      );
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error("[AsyncCoordinator] ❌ Search clear failed:", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options,
        timestamp: endTime,
      });

      // Set error state
      if (state && typeof state.setLayoutPhase === "function") {
        state.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Execute operation with error recovery (synchronous core)
   */
  executeWithErrorRecovery<T>(
    operation: () => T,
    operationType: string,
    context?: Record<string, any>,
  ): {
    result?: T;
    recovery?: ErrorRecoveryResult;
  } {
    try {
      const result = operation();
      return { result };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Operation "${operationType}" failed:`,
        error,
      );
      // Log operation timeout
      console.error(
        `[AsyncCoordinator] Operation "${operationType}" timed out`,
        { context },
      );
      return {
        recovery: {
          success: false,
          fallbackApplied: false,
          userFeedbackShown: false,
        },
      };
    }
  }
  /**
   * Get error handler statistics (stub implementation)
   */
  getErrorStatistics() {
    return { totalErrors: 0, errorsByType: {}, recentErrors: [] };
  }
  /**
   * Check if system is experiencing high error rate (stub implementation)
   */
  isHighErrorRate(): boolean {
    return false;
  }
  /**
   * Get recovery suggestions based on error patterns (stub implementation)
   */
  getRecoverySuggestions(): string[] {
    return [];
  }
  /**
   * Clear error history (stub implementation)
   */
  clearErrorHistory(): void {
    // No-op since we don't track errors anymore
  }
  /**
   * Queue hierarchy change operation with proper sequencing
   * This ensures hierarchy changes trigger proper re-parsing and layout updates
   */
  async queueHierarchyChange(
    groupingId: string,
    data: any, // HydroscopeData
    onDataUpdate: (updatedData: any) => void,
    options: QueueOptions = {},
  ): Promise<void> {
    // Queue-enforced execution using _enqueueAndWait pattern
    return this._enqueueAndWait(
      "hierarchy_change",
      async () => {
        // Re-parse the data with the new grouping
        // Create a deep copy to ensure reference change detection works
        const updatedData = JSON.parse(JSON.stringify(data));
        // Move the selected hierarchy to the front so it becomes the active one
        if (updatedData.hierarchyChoices) {
          const selectedChoice = updatedData.hierarchyChoices.find(
            (choice: any) => choice.id === groupingId,
          );
          const otherChoices = updatedData.hierarchyChoices.filter(
            (choice: any) => choice.id !== groupingId,
          );
          if (selectedChoice) {
            updatedData.hierarchyChoices = [selectedChoice, ...otherChoices];
          }
        }
        // Update the data through the callback
        onDataUpdate(updatedData);
        // Return void as per Promise<void> signature
        return;
      },
      {
        timeout: options.timeout || 5000, // 5 second default timeout
        maxRetries: options.maxRetries || 1,
      },
    );
  }
  /**
   * Unified render config update pipeline
   * Handles layout algorithm changes, style updates, and other configuration changes
   *
   * @param visualizationState - The VisualizationState instance to update
   * @param configUpdates - The configuration updates to apply
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished
   */
  async updateRenderConfig(
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    configUpdates: {
      layoutAlgorithm?: string;
      edgeStyle?: string;
      edgeWidth?: number;
      edgeDashed?: boolean;
      nodePadding?: number;
      nodeFontSize?: number;
      containerBorderWidth?: number;
      colorPalette?: string;
      [key: string]: any; // Allow other config properties
    },
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      relayoutEntities?: string[]; // For targeted re-layout
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "update_render_config",
      () =>
        this._handleUpdateRenderConfig(
          visualizationState,
          configUpdates,
          options,
        ),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for render config update pipeline
   * This method contains the actual implementation and is called by the queue system
   *
   * @param visualizationState - The VisualizationState instance to update
   * @param configUpdates - The configuration updates to apply
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished
   */
  private async _handleUpdateRenderConfig(
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    configUpdates: {
      layoutAlgorithm?: string;
      edgeStyle?: string;
      edgeWidth?: number;
      edgeDashed?: boolean;
      nodePadding?: number;
      nodeFontSize?: number;
      containerBorderWidth?: number;
      colorPalette?: string;
      [key: string]: any; // Allow other config properties
    },
    options: {
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      relayoutEntities?: string[]; // For targeted re-layout
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        `🚀 AsyncCoordinator: Starting render config update pipeline`,
        configUpdates,
      );

      // Apply configuration updates to VisualizationState
      if (typeof visualizationState.updateRenderConfig === "function") {
        visualizationState.updateRenderConfig(configUpdates);
        hscopeLogger.log(
          "coordinator",
          `🔧 AsyncCoordinator: Applied render config updates to VisualizationState`,
        );
      } else {
        console.warn(
          `[AsyncCoordinator] VisualizationState.updateRenderConfig not available`,
        );
      }

      // Determine if we need to re-layout based on the config changes
      const needsRelayout = this._configChangeRequiresRelayout(configUpdates);

      if (needsRelayout) {
        hscopeLogger.log(
          "coordinator",
          `🔄 AsyncCoordinator: Config change requires re-layout`,
          {
            layoutAlgorithm: configUpdates.layoutAlgorithm,
            relayoutEntities: options.relayoutEntities,
          },
        );

        // Execute complete pipeline: layout + render + fitView
        const reactFlowData = await this.executeLayoutAndRenderPipeline(
          visualizationState,
          {
            relayoutEntities: options.relayoutEntities, // Use provided entities or full layout
            fitView: options.fitView !== false, // Default to true unless explicitly disabled
            fitViewOptions: options.fitViewOptions,
          },
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        hscopeLogger.log(
          "coordinator",
          `✅ AsyncCoordinator: Render config update pipeline completed with re-layout`,
          {
            duration: `${duration}ms`,
            nodeCount: reactFlowData?.nodes?.length || 0,
            edgeCount: reactFlowData?.edges?.length || 0,
            configUpdates,
          },
        );

        return reactFlowData;
      } else {
        hscopeLogger.log(
          "coordinator",
          `🎨 AsyncCoordinator: Config change only requires re-render (no layout)`,
        );

        // Only re-render without layout using imperative method
        const reactFlowData =
          this.generateReactFlowDataImperative(visualizationState);

        // Handle fitView even when no layout is needed (e.g., for edge style changes)
        if (options.fitView) {
          const fitViewCheck = this._shouldExecuteFitView(
            options.fitViewOptions,
            reactFlowData,
          );

          if (fitViewCheck.shouldExecute) {
            this.enqueuePostRenderCallback(() => {
              if (!this.reactFlowInstance) {
                console.warn(
                  "[AsyncCoordinator] ⚠️ ReactFlow instance not available for fitView",
                );
                return;
              }

              const fitViewOptions = {
                padding: options.fitViewOptions?.padding || 0.15,
                duration: options.fitViewOptions?.duration || 300,
                includeHiddenNodes: false,
              };

              hscopeLogger.log(
                "coordinator",
                "[AsyncCoordinator] 🎯 Executing post-render fitView for config change",
                fitViewOptions,
              );

              this.reactFlowInstance.fitView(fitViewOptions);
              hscopeLogger.log(
                "coordinator",
                "[AsyncCoordinator] ✅ FitView completed for config change",
              );
            });
            hscopeLogger.log(
              "coordinator",
              "[AsyncCoordinator] ✅ FitView enqueued for post-render execution (config change)",
            );
          } else {
            hscopeLogger.log(
              "coordinator",
              "[AsyncCoordinator] ⏭️ Skipping FitView execution for config change",
              { reason: fitViewCheck.skipReason },
            );
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        hscopeLogger.log(
          "coordinator",
          `✅ AsyncCoordinator: Render config update pipeline completed with re-render only`,
          {
            duration: `${duration}ms`,
            nodeCount: reactFlowData?.nodes?.length || 0,
            edgeCount: reactFlowData?.edges?.length || 0,
            configUpdates,
            fitViewRequested: options.fitView,
          },
        );

        return reactFlowData;
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(
        `[AsyncCoordinator] Render config update pipeline failed:`,
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: `${duration}ms`,
          configUpdates,
          timestamp: endTime,
        },
      );

      // Set error state on VisualizationState if possible
      if (
        visualizationState &&
        typeof visualizationState.setLayoutPhase === "function"
      ) {
        visualizationState.setLayoutPhase("error");
      }

      throw error;
    }
  }

  /**
   * Determine if configuration changes require re-layout or just re-render
   */
  private _configChangeRequiresRelayout(configUpdates: any): boolean {
    // Layout algorithm changes always require re-layout
    if (configUpdates.layoutAlgorithm) {
      return true;
    }

    // Node/container size changes require re-layout
    if (
      configUpdates.nodePadding ||
      configUpdates.nodeFontSize ||
      configUpdates.containerBorderWidth
    ) {
      return true;
    }

    // Style-only changes (colors, edge styles) only need re-render
    return false;
  }

  /**
   * Get status of hierarchy change operations
   */
  getHierarchyChangeStatus(): {
    queued: number;
    processing: boolean;
    lastCompleted?: QueuedOperation;
    lastFailed?: QueuedOperation;
  } {
    const hierarchyOps = this.queue.filter(
      (op) => op.type === "hierarchy_change",
    );
    const currentHierarchy = this.currentOperation?.type === "hierarchy_change";
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find((op) => op.type === "hierarchy_change");
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find((op) => op.type === "hierarchy_change");
    return {
      queued: hierarchyOps.length,
      processing: currentHierarchy,
      lastCompleted,
      lastFailed,
    };
  }

  /**
   * Unified search integration pipeline
   * Handles search execution, result highlighting, and optional container expansion
   *
   * @param visualizationState - The VisualizationState instance
   * @param searchQuery - The search query to execute
   * @param options - Search and pipeline options
   * @returns Promise<ReactFlowData> when complete pipeline is finished
   */
  async executeSearchPipeline(
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    searchQuery: string | null,
    options: {
      expandContainersOnSearch?: boolean;
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // Queue-enforced execution - ensures atomic, sequential processing
    return this._enqueueAndWait(
      "execute_search_pipeline",
      () =>
        this._handleExecuteSearchPipeline(
          visualizationState,
          searchQuery,
          options,
        ),
      { timeout: options.timeout, maxRetries: options.maxRetries },
    );
  }

  /**
   * Private handler for search pipeline execution
   * This method contains the actual implementation and is called by the queue system
   */
  private async _handleExecuteSearchPipeline(
    visualizationState: any, // VisualizationState - using any to avoid circular dependency
    searchQuery: string | null,
    options: {
      expandContainersOnSearch?: boolean;
      fitView?: boolean;
      fitViewOptions?: { padding?: number; duration?: number };
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<any> {
    // ReactFlowData
    const startTime = Date.now();

    try {
      hscopeLogger.log(
        "coordinator",
        `🔍 AsyncCoordinator: Starting search pipeline`,
        {
          searchQuery,
          expandContainersOnSearch: options.expandContainersOnSearch,
        },
      );

      if (searchQuery && searchQuery.trim()) {
        // Execute search
        if (typeof visualizationState.performSearch === "function") {
          const searchResults = visualizationState.performSearch(searchQuery);
          hscopeLogger.log(
            "coordinator",
            `🔍 AsyncCoordinator: Search executed`,
            {
              query: searchQuery,
              resultCount: searchResults?.length || 0,
            },
          );

          // Expand containers if requested and search found results
          if (
            options.expandContainersOnSearch &&
            searchResults &&
            searchResults.length > 0
          ) {
            hscopeLogger.log(
              "coordinator",
              `🔍 AsyncCoordinator: Expanding containers for search results`,
            );

            // Use existing expandContainers method
            await this.expandContainers(visualizationState, {
              relayoutEntities: undefined, // Full layout after expansion
              fitView: false, // Don't fit view yet, do it after final render
            });
          }
        } else {
          console.warn(
            `[AsyncCoordinator] VisualizationState.performSearch not available`,
          );
        }
      } else {
        // Clear search
        if (typeof visualizationState.clearSearch === "function") {
          visualizationState.clearSearch();
          hscopeLogger.log(
            "coordinator",
            `🔍 AsyncCoordinator: Search cleared`,
          );
        }
      }

      // Re-render to show search highlights
      const reactFlowData = await this.executeLayoutAndRenderPipeline(
        visualizationState,
        {
          relayoutEntities: [], // No layout needed, just re-render for highlights
          fitView: options.fitView !== false, // Default to true unless explicitly disabled
          fitViewOptions: options.fitViewOptions,
        },
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      hscopeLogger.log(
        "coordinator",
        `✅ AsyncCoordinator: Search pipeline completed`,
        {
          duration: `${duration}ms`,
          searchQuery,
          nodeCount: reactFlowData?.nodes?.length || 0,
          edgeCount: reactFlowData?.edges?.length || 0,
        },
      );

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`[AsyncCoordinator] Search pipeline failed:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        searchQuery,
        timestamp: endTime,
      });

      // Set error state on VisualizationState if possible
      if (
        visualizationState &&
        typeof visualizationState.setLayoutPhase === "function"
      ) {
        visualizationState.setLayoutPhase("error");
      }

      throw error;
    }
  }

  // PERFORMANCE OPTIMIZATION METHODS (STATELESS)

  /**
   * PERFORMANCE OPTIMIZATION 1: State change detection using VisualizationState's cache invalidation
   * Uses ephemeral stack-based comparison to skip unnecessary layout when state hasn't changed
   * This is stateless - only uses local variables and VisualizationState's existing cache mechanisms
   * FAIL FAST - no error suppression
   */
  private _shouldSkipLayoutBasedOnStateChanges(
    state: any, // VisualizationState
    relayoutEntities?: string[],
  ): boolean {
    // If full layout is requested (relayoutEntities is undefined), never skip
    if (relayoutEntities === undefined) {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ⚡ State analysis: Full layout requested, cannot skip",
      );
      return false;
    }

    // If specific entities are requested for layout, never skip
    if (relayoutEntities && relayoutEntities.length > 0) {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ⚡ State analysis: Specific entities requested for layout, cannot skip",
      );
      return false;
    }

    // Use VisualizationState's existing cache invalidation mechanisms
    const currentSnapshot = this._createEphemeralStateSnapshot(state);

    // Compare with last snapshot (ephemeral, stack-based)
    const hasSignificantChanges =
      this._hasSignificantStateChanges(currentSnapshot);

    // Update last snapshot for next comparison (stateless - only in memory)
    this._lastStateSnapshot = currentSnapshot;

    if (!hasSignificantChanges) {
      hscopeLogger.log(
        "coordinator",
        "[AsyncCoordinator] ⚡ State analysis: No significant changes detected, layout can be skipped",
        {
          currentSnapshot: {
            containerCount: currentSnapshot.containerCount,
            nodeCount: currentSnapshot.nodeCount,
            layoutPhase: currentSnapshot.layoutPhase,
          },
        },
      );
      return true;
    }

    hscopeLogger.log(
      "coordinator",
      "[AsyncCoordinator] ⚡ State analysis: Significant changes detected, layout required",
      {
        currentSnapshot: {
          containerCount: currentSnapshot.containerCount,
          nodeCount: currentSnapshot.nodeCount,
          layoutPhase: currentSnapshot.layoutPhase,
        },
      },
    );
    return false;
  }

  /**
   * Create ephemeral state snapshot for comparison (no persistent storage)
   */
  private _createEphemeralStateSnapshot(state: any): {
    timestamp: number;
    containerCount: number;
    nodeCount: number;
    edgeCount: number;
    layoutPhase: string;
  } {
    return {
      timestamp: Date.now(),
      containerCount: state.visibleContainers?.length || 0,
      nodeCount: state.visibleNodes?.length || 0,
      edgeCount: state.visibleEdges?.length || 0,
      layoutPhase: state.layoutPhase || "unknown",
    };
  }

  /**
   * Compare snapshots to detect significant changes (ephemeral comparison)
   */
  private _hasSignificantStateChanges(currentSnapshot: {
    timestamp: number;
    containerCount: number;
    nodeCount: number;
    edgeCount: number;
    layoutPhase: string;
    cacheVersion?: number;
  }): boolean {
    if (!this._lastStateSnapshot) {
      // First run - always has changes
      return true;
    }

    const lastSnapshot = this._lastStateSnapshot;

    // Check cache version first (most efficient if available)
    if (
      currentSnapshot.cacheVersion !== undefined &&
      lastSnapshot.cacheVersion !== undefined
    ) {
      if (currentSnapshot.cacheVersion !== lastSnapshot.cacheVersion) {
        return true; // Cache version changed - significant change
      }
    }

    // Check structural changes
    if (
      currentSnapshot.containerCount !== lastSnapshot.containerCount ||
      currentSnapshot.nodeCount !== lastSnapshot.nodeCount ||
      currentSnapshot.edgeCount !== lastSnapshot.edgeCount
    ) {
      return true; // Structural changes detected
    }

    // Check layout phase changes
    if (currentSnapshot.layoutPhase !== lastSnapshot.layoutPhase) {
      return true; // Layout phase changed
    }

    // No significant changes detected
    return false;
  }

  /**
   * Deterministic FitView execution check - no optimizations that could cause zoom issues
   */
  private _shouldExecuteFitView(
    _fitViewOptions?: { padding?: number; duration?: number },
    reactFlowData?: any,
  ): {
    shouldExecute: boolean;
    skipReason?: string;
  } {
    // If no ReactFlow data, can't execute fitView safely
    if (!reactFlowData || !reactFlowData.nodes) {
      return {
        shouldExecute: false,
        skipReason: "No ReactFlow data available",
      };
    }

    // Check if there are any visible nodes to fit to
    const visibleNodes = reactFlowData.nodes.filter(
      (node: any) => !node.hidden,
    );
    if (visibleNodes.length === 0) {
      return {
        shouldExecute: false,
        skipReason: "No visible nodes to fit view to",
      };
    }

    // Execute with original options - no modifications
    return {
      shouldExecute: true,
    };
  }

  /**
   * PERFORMANCE OPTIMIZATION 3: Performance logging using local variables (no persistent caches)
   * All metrics are computed locally and logged immediately - no state persistence
   */
  private _logPipelinePerformanceMetrics(
    totalDuration: number,
    performanceMetrics: {
      stateChangeDetection: number;
      layoutSkipped: boolean;
      layoutDuration: number;
      renderDuration: number;
    },
    reactFlowData: any,
    options: any,
  ): void {
    const layoutEfficiency =
      performanceMetrics.layoutDuration > 0
        ? (performanceMetrics.layoutDuration / totalDuration) * 100
        : 0;

    const renderEfficiency =
      performanceMetrics.renderDuration > 0
        ? (performanceMetrics.renderDuration / totalDuration) * 100
        : 0;

    // Log performance metrics
    hscopeLogger.log(
      "coordinator",
      "[AsyncCoordinator] 📊 Pipeline Performance Metrics",
      {
        totalDuration: `${totalDuration}ms`,
        stateChangeDetection: `${performanceMetrics.stateChangeDetection}ms`,
        layoutDuration: performanceMetrics.layoutSkipped
          ? "skipped"
          : `${performanceMetrics.layoutDuration}ms`,
        renderDuration: `${performanceMetrics.renderDuration}ms`,
        layoutEfficiency: `${layoutEfficiency.toFixed(1)}%`,
        renderEfficiency: `${renderEfficiency.toFixed(1)}%`,

        // Optimization flags
        layoutSkipped: performanceMetrics.layoutSkipped,

        // Data metrics
        nodesCount: reactFlowData?.nodes?.length || 0,
        edgesCount: reactFlowData?.edges?.length || 0,

        // Configuration
        relayoutEntities: options.relayoutEntities,
        fitView: options.fitView,

        // Performance classification
        performanceClass:
          totalDuration < 100
            ? "excellent"
            : totalDuration < 300
              ? "good"
              : totalDuration < 500
                ? "acceptable"
                : totalDuration < 1000
                  ? "slow"
                  : "very-slow",

        timestamp: Date.now(),
      },
    );

    // Log performance warnings if needed
    if (totalDuration > 1000) {
      console.warn(
        "[AsyncCoordinator] ⚠️ Pipeline performance warning: Slow execution detected",
        {
          duration: `${totalDuration}ms`,
          threshold: "1000ms",
        },
      );
    }
  }

  /**
   * Helper method to get containers that need to be expanded for search results
   * This is a stateless helper that analyzes search results and returns container IDs
   */
  /**
   * Get collapsed ancestor containers that need to be expanded to show search results
   *
   * SINGLE SOURCE OF TRUTH: This method defines which containers get expanded during search.
   * It finds all collapsed ancestors of search result nodes, ensuring they become visible.
   * The expansion state (container.collapsed) is then reflected in both:
   * - The graph (via ReactFlow rendering)
   * - The tree (via HierarchyTree's derivedExpandedKeys from collapsedContainers prop)
   *
   * This ensures tree and graph stay in sync - no duplicate expansion logic needed.
   */
  private _getContainersForSearchResults(
    searchResults: any[],
    state: any,
  ): string[] {
    // Use a Map to track containers and their depth (distance from root)
    // This allows us to sort them so parents are expanded before children
    const containerDepthMap = new Map<string, number>();

    try {
      for (const result of searchResults) {
        let startContainerId: string | undefined;

        if (result.type === "node") {
          // Get the immediate parent container for this node
          startContainerId = state.getNodeContainer
            ? state.getNodeContainer(result.id)
            : undefined;
        } else if (result.type === "container") {
          // For container results, we need to expand the container itself
          // AND its parent containers to make it visible
          startContainerId = result.id;
        }

        if (startContainerId) {
          // Get all ancestor containers up to the root, tracking depth
          const ancestorChain: Array<{ id: string; depth: number }> = [];
          let currentContainerId: string | undefined = startContainerId;
          let depth = 0;

          while (currentContainerId) {
            const container = state._containers?.get(currentContainerId);
            if (!container) break;

            // Check if this container is collapsed
            if (container.collapsed) {
              ancestorChain.push({ id: currentContainerId, depth });
            }

            // Move to parent container
            currentContainerId = state.getContainerParent
              ? state.getContainerParent(currentContainerId)
              : undefined;
            depth++;
          }

          // Add to map, keeping the maximum depth for each container
          // (in case it appears in multiple chains)
          for (const { id, depth } of ancestorChain) {
            const existingDepth = containerDepthMap.get(id);
            if (existingDepth === undefined || depth > existingDepth) {
              containerDepthMap.set(id, depth);
            }
          }
        }
      }

      // Sort containers by depth (descending) so parents are expanded before children
      // Higher depth = closer to root = should be expanded first
      const sortedContainers = Array.from(containerDepthMap.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by depth descending
        .map(([id]) => id);

      return sortedContainers;
    } catch (_error) {
      return [];
    }
  }
}
