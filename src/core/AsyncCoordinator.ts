/**
 * AsyncCoordinator - Sequential queue system for async operations
 * Manages async boundaries with FIFO queues and error handling
 */

import { QueuedOperation, QueueStatus, ApplicationEvent } from "../types/core";

export interface QueueOptions {
  timeout?: number;
  maxRetries?: number;
}

export class AsyncCoordinator {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private completedOperations: QueuedOperation[] = [];
  private failedOperations: QueuedOperation[] = [];
  private processingTimes: number[] = [];
  private currentOperation?: QueuedOperation;
  private operationIdCounter = 0;

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
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    this.currentOperation = operation;
    operation.startedAt = Date.now();

    while (operation.retryCount <= operation.maxRetries) {
      try {
        const result = await this.executeWithTimeout(operation);

        // Operation succeeded
        operation.completedAt = Date.now();
        this.completedOperations.push(operation);
        this.recordProcessingTime(operation);
        return;
      } catch (error) {
        operation.error = error as Error;
        operation.retryCount++;

        // If we've exhausted retries, mark as failed
        if (operation.retryCount > operation.maxRetries) {
          operation.completedAt = Date.now();
          this.failedOperations.push(operation);
          this.recordProcessingTime(operation);
          return;
        }

        // Otherwise, retry after a brief delay
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
      return await operation.operation();
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
   */
  clearQueue(): void {
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

  // ELK-specific async operations

  /**
   * Queue ELK layout operation with proper sequencing
   */
  async queueELKLayout(
    state: any, // VisualizationState - using any to avoid circular dependency
    elkBridge: any, // ELKBridge instance
    options: QueueOptions = {},
  ): Promise<void> {
    const operation = async () => {
      try {
        // Set layout phase to indicate processing
        state.setLayoutPhase("laying_out");

        // Call real ELK layout calculation
        await elkBridge.layout(state);

        // Increment layout count for smart collapse logic
        state.incrementLayoutCount();

        return "layout_complete";
      } catch (error) {
        state.setLayoutPhase("error");
        throw error;
      }
    };

    // Queue the operation and wait for it to complete
    const operationId = this.queueOperation("elk_layout", operation, {
      timeout: options.timeout || 10000, // 10 second default timeout
      maxRetries: options.maxRetries || 1,
    });

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(
      (op) => op.id === operationId,
    );
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (failedOp) {
      throw failedOp.error || new Error("ELK layout operation failed");
    }

    if (!completedOp) {
      throw new Error("ELK layout operation not found");
    }
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
   * Queue ReactFlow render operation with proper sequencing
   */
  async queueReactFlowRender(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: QueueOptions = {},
  ): Promise<any> {
    // ReactFlowData
    const operation = async () => {
      // Import ReactFlowBridge dynamically to avoid circular dependency
      const { ReactFlowBridge } = await import("../bridges/ReactFlowBridge.js");

      try {
        // Create ReactFlow bridge with default style config
        const reactFlowBridge = new ReactFlowBridge({});

        // Set layout phase to indicate rendering
        state.setLayoutPhase("rendering");

        // Convert to ReactFlow format
        const reactFlowData = reactFlowBridge.toReactFlowData(state);

        // Set layout phase to displayed
        state.setLayoutPhase("displayed");

        return reactFlowData;
      } catch (error) {
        state.setLayoutPhase("error");
        throw error;
      }
    };

    // Queue the operation and wait for it to complete
    const operationId = this.queueOperation("reactflow_render", operation, {
      timeout: options.timeout || 5000, // 5 second default timeout
      maxRetries: options.maxRetries || 1,
    });

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(
      (op) => op.id === operationId,
    );
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (failedOp) {
      throw failedOp.error || new Error("ReactFlow render operation failed");
    }

    if (!completedOp) {
      throw new Error("ReactFlow render operation not found");
    }

    // Return the ReactFlow data from the completed operation
    return completedOp;
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
   * Queue application event with proper prioritization
   */
  queueApplicationEvent(
    event: ApplicationEvent,
    options: QueueOptions = {},
  ): string {
    const operation = async () => {
      // Process the application event based on its type
      await this.processApplicationEvent(event);
      return "event_processed";
    };

    // Determine priority based on event type
    const priority = this.getEventPriority(event.type);

    // Queue the operation with priority handling
    const operationId = this.queueOperation("application_event", operation, {
      timeout: options.timeout || 5000, // 5 second default timeout
      maxRetries: options.maxRetries || 1,
    });

    // Insert operation at appropriate position based on priority
    if (priority === "high") {
      this.prioritizeOperation(operationId);
    }

    return operationId;
  }

  /**
   * Process application event and wait for completion
   */
  async processApplicationEventAndWait(
    event: ApplicationEvent,
    options: QueueOptions = {},
  ): Promise<void> {
    const operationId = this.queueApplicationEvent(event, options);

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(
      (op) => op.id === operationId,
    );
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (failedOp) {
      throw failedOp.error || new Error("Application event processing failed");
    }

    if (!completedOp) {
      throw new Error("Application event operation not found");
    }
  }

  /**
   * Process individual application event
   */
  private async processApplicationEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    switch (event.type) {
      case "container_expand":
        await this.handleContainerExpandEvent(event);
        break;
      case "container_collapse":
        await this.handleContainerCollapseEvent(event);
        break;
      case "search":
        await this.handleSearchEvent(event);
        break;
      case "layout_config_change":
        await this.handleLayoutConfigChangeEvent(event);
        break;
      default:
        throw new Error(`Unknown application event type: ${event.type}`);
    }
  }

  /**
   * Handle container expand event
   */
  private async handleContainerExpandEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { containerId, state } = event.payload;

    if (!containerId || !state) {
      throw new Error("Container expand event missing required payload");
    }

    // Expand the container in the state
    state.expandContainer(containerId);

    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle container collapse event
   */
  private async handleContainerCollapseEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { containerId, state, triggerValidation } = event.payload;

    if (!containerId || !state) {
      throw new Error("Container collapse event missing required payload");
    }

    console.log(
      `[AsyncCoordinator] 🔄 Processing container collapse event for ${containerId}`,
    );

    // Collapse the container in the state
    state.collapseContainer(containerId);

    // Trigger ReactFlow validation if requested
    if (triggerValidation) {
      console.log(
        `[AsyncCoordinator] 🔍 Triggering ReactFlow validation after container ${containerId} collapse event`,
      );
      try {
        // Import ReactFlowBridge dynamically to avoid circular dependency
        const { ReactFlowBridge } = await import(
          "../bridges/ReactFlowBridge.js"
        );
        const reactFlowBridge = new ReactFlowBridge({});

        // Run validation by calling toReactFlowData
        const reactFlowData = reactFlowBridge.toReactFlowData(state);
        console.log(
          `[AsyncCoordinator] ✅ ReactFlow validation completed after container ${containerId} collapse event`,
        );
      } catch (error) {
        console.error(
          `[AsyncCoordinator] ❌ ReactFlow validation failed after container ${containerId} collapse event:`,
          error,
        );
        // Don't throw - validation failure shouldn't break the collapse operation
      }
    }

    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle search event
   */
  private async handleSearchEvent(event: ApplicationEvent): Promise<void> {
    const { query, state } = event.payload;

    if (!state) {
      throw new Error("Search event missing required payload");
    }

    // Perform search in the state
    const results = state.search(query || "");

    // Expand containers containing search results if needed
    if (event.payload.expandContainers && results.length > 0) {
      for (const result of results) {
        if (result.type === "node") {
          // Find containers that contain this node and expand them
          const containers = state.getContainersForNode
            ? state.getContainersForNode(result.id)
            : [];
          for (const container of containers) {
            if (container.collapsed) {
              state.expandContainer(container.id);
            }
          }
        }
      }
    }

    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle layout config change event
   */
  private async handleLayoutConfigChangeEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { config, state } = event.payload;

    if (!config || !state) {
      throw new Error("Layout config change event missing required payload");
    }

    // Store the new configuration in the state (if supported)
    // The actual layout update should be triggered separately
    // Note: This is a simplified implementation - in practice, we'd store config in state
  }

  /**
   * Get event priority for queue ordering
   */
  private getEventPriority(
    eventType: ApplicationEvent["type"],
  ): "high" | "normal" | "low" {
    switch (eventType) {
      case "container_expand":
      case "container_collapse":
        return "high"; // User interactions should be prioritized
      case "search":
        return "normal";
      case "layout_config_change":
        return "low"; // Configuration changes can wait
      default:
        return "normal";
    }
  }

  /**
   * Move operation to front of queue for high priority
   */
  private prioritizeOperation(operationId: string): void {
    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index > 0) {
      const operation = this.queue.splice(index, 1)[0];
      this.queue.unshift(operation);
    }
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
  cancelApplicationEventsByType(eventType: ApplicationEvent["type"]): number {
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
   * Expand container through async coordination with proper sequencing
   */
  async expandContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    const event: ApplicationEvent = {
      type: "container_expand",
      payload: {
        containerId,
        state,
        triggerLayout: options.triggerLayout !== false,
        layoutConfig: options.layoutConfig || {},
      },
      timestamp: Date.now(),
    };

    // Queue the container expand event
    const operationId = this.queueApplicationEvent(event, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(
      (op) => op.id === operationId,
    );
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (failedOp) {
      throw failedOp.error || new Error("Container expand operation failed");
    }

    if (!completedOp) {
      throw new Error("Container expand operation not found");
    }

    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed
  }

  /**
   * Collapse container through async coordination with proper sequencing
   */
  async collapseContainer(
    containerId: string,
    state: any, // VisualizationState
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
      triggerValidation?: boolean; // New option to trigger ReactFlow validation
    } = {},
  ): Promise<void> {
    const event: ApplicationEvent = {
      type: "container_collapse",
      payload: {
        containerId,
        state,
        triggerLayout: options.triggerLayout !== false,
        layoutConfig: options.layoutConfig || {},
        triggerValidation: options.triggerValidation,
      },
      timestamp: Date.now(),
    };

    // Queue the container collapse event
    const operationId = this.queueApplicationEvent(event, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(
      (op) => op.id === operationId,
    );
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (failedOp) {
      throw failedOp.error || new Error("Container collapse operation failed");
    }

    if (!completedOp) {
      throw new Error("Container collapse operation not found");
    }

    // Trigger ReactFlow validation after container collapse if requested
    if (options.triggerValidation) {
      console.log(
        `[AsyncCoordinator] 🔍 Triggering ReactFlow validation after container ${containerId} collapse`,
      );
      try {
        await this.queueReactFlowRender(state, {
          timeout: options.timeout,
          maxRetries: options.maxRetries,
        });
        console.log(
          `[AsyncCoordinator] ✅ ReactFlow validation completed after container ${containerId} collapse`,
        );
      } catch (error) {
        console.error(
          `[AsyncCoordinator] ❌ ReactFlow validation failed after container ${containerId} collapse:`,
          error,
        );
        // Don't throw - validation failure shouldn't break the collapse operation
      }
    }

    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed
  }

  /**
   * Expand all containers through async coordination with proper sequencing
   */
  async expandAllContainers(
    state: any, // VisualizationState
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    // Get all collapsed containers
    const collapsedContainers = state.visibleContainers.filter(
      (container: any) => container.collapsed,
    );

    // Expand each container sequentially
    for (const container of collapsedContainers) {
      await this.expandContainer(container.id, state, {
        ...options,
        triggerLayout: false, // Don't trigger layout for each individual container
      });
    }

    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed after bulk operations
  }

  /**
   * Collapse all containers through async coordination with proper sequencing
   */
  async collapseAllContainers(
    state: any, // VisualizationState
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
      triggerValidation?: boolean; // New option to trigger ReactFlow validation
    } = {},
  ): Promise<void> {
    // Get all expanded containers
    const expandedContainers = state.visibleContainers.filter(
      (container: any) => !container.collapsed,
    );

    console.log(
      `[AsyncCoordinator] 🔄 Collapsing ${expandedContainers.length} containers`,
    );

    // Collapse each container sequentially
    for (const container of expandedContainers) {
      await this.collapseContainer(container.id, state, {
        ...options,
        triggerLayout: false, // Don't trigger layout for each individual container
      });
    }

    // Trigger ReactFlow validation after all containers are collapsed
    if (options.triggerValidation !== false) {
      console.log(
        `[AsyncCoordinator] 🔍 Triggering ReactFlow validation after container collapse`,
      );
      try {
        await this.queueReactFlowRender(state, {
          timeout: options.timeout,
          maxRetries: options.maxRetries,
        });
        console.log(
          `[AsyncCoordinator] ✅ ReactFlow validation completed after container collapse`,
        );
      } catch (error) {
        console.error(
          `[AsyncCoordinator] ❌ ReactFlow validation failed after container collapse:`,
          error,
        );
        // Don't throw - validation failure shouldn't break the collapse operation
      }
    }

    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed after bulk operations
  }

  /**
   * Handle container operation error recovery
   */
  async recoverFromContainerOperationError(
    operationId: string,
    state: any, // VisualizationState
    recoveryAction: "retry" | "rollback" | "skip" = "retry",
  ): Promise<void> {
    const failedOp = this.failedOperations.find((op) => op.id === operationId);

    if (!failedOp) {
      throw new Error(`Failed operation ${operationId} not found`);
    }

    switch (recoveryAction) {
      case "retry":
        // Re-queue the failed operation with increased retry count
        const retryOperation = async () => {
          return await failedOp.operation();
        };

        this.queueOperation(failedOp.type, retryOperation, {
          timeout: failedOp.timeout,
          maxRetries: (failedOp.maxRetries || 0) + 1,
        });

        await this.processQueue();
        break;

      case "rollback":
        // Attempt to rollback the state change (implementation depends on the specific operation)
        // This is a simplified implementation - in practice, we'd need operation-specific rollback logic
        console.warn(`Rollback not implemented for operation ${operationId}`);
        break;

      case "skip":
        // Simply remove the failed operation from the failed list and continue
        this.failedOperations = this.failedOperations.filter(
          (op) => op.id !== operationId,
        );
        break;

      default:
        throw new Error(`Unknown recovery action: ${recoveryAction}`);
    }
  }

  /**
   * Get container operation status and statistics
   */
  getContainerOperationStatus(): {
    expandOperations: {
      queued: number;
      processing: boolean;
      completed: number;
      failed: number;
    };
    collapseOperations: {
      queued: number;
      processing: boolean;
      completed: number;
      failed: number;
    };
    bulkOperations: {
      queued: number;
      processing: boolean;
      completed: number;
      failed: number;
    };
    lastError?: Error;
  } {
    // Filter operations by container operation types
    const expandOps = [
      ...this.queue,
      ...this.completedOperations,
      ...this.failedOperations,
    ].filter((op) => op.type === "application_event");

    const collapseOps = expandOps; // Simplified - in practice we'd need to check event payload
    const bulkOps = expandOps; // Simplified - in practice we'd need to check for bulk operations

    const lastError =
      this.failedOperations.length > 0
        ? this.failedOperations[this.failedOperations.length - 1].error
        : undefined;

    return {
      expandOperations: {
        queued: this.queue.filter((op) => op.type === "application_event")
          .length,
        processing: this.currentOperation?.type === "application_event",
        completed: this.completedOperations.filter(
          (op) => op.type === "application_event",
        ).length,
        failed: this.failedOperations.filter(
          (op) => op.type === "application_event",
        ).length,
      },
      collapseOperations: {
        queued: 0, // Simplified
        processing: false,
        completed: 0,
        failed: 0,
      },
      bulkOperations: {
        queued: 0, // Simplified
        processing: false,
        completed: 0,
        failed: 0,
      },
      lastError,
    };
  }
}
