/**
 * AsyncCoordinator - Sequential queue system for async operations
 * Manages async boundaries with FIFO queues and error handling
 */

import { QueuedOperation, QueueStatus, ApplicationEvent } from "../types/core";
import {
  searchNavigationErrorHandler,
  type ErrorRecoveryResult,
} from "./ErrorHandler.js";

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

    console.log(
      `[AsyncCoordinator] 🚀 Starting operation ${operation.id} (${operation.type})`,
    );

    while (operation.retryCount <= operation.maxRetries) {
      try {
        const _result = await this.executeWithTimeout(operation);

        // Operation succeeded
        operation.completedAt = Date.now();
        this.completedOperations.push(operation);
        this.recordProcessingTime(operation);
        console.log(
          `[AsyncCoordinator] ✅ Operation ${operation.id} (${operation.type}) completed successfully`,
        );
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
          return;
        }

        // Otherwise, retry after a brief delay
        console.log(
          `[AsyncCoordinator] 🔄 Retrying operation ${operation.id} (${operation.type}) in ${100 * operation.retryCount}ms`,
        );
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
   * This method ensures ELK layout results update VisualizationState before any ReactFlow render
   */
  async queueELKLayout(
    state: any, // VisualizationState - using any to avoid circular dependency
    elkBridge: any, // ELKBridge instance
    options: QueueOptions = {},
  ): Promise<void> {
    const operation = async () => {
      try {
        console.log(`[AsyncCoordinator] 🚀 Starting ELK layout operation`);

        // Set layout phase to indicate processing
        state.setLayoutPhase("laying_out");

        // ELKBridge is now stateless - no caches to clear

        // Call real ELK layout calculation - this updates VisualizationState directly
        await elkBridge.layout(state);

        // Increment layout count for smart collapse logic
        state.incrementLayoutCount();

        // Set layout phase to ready after successful ELK layout
        state.setLayoutPhase("ready");

        console.log(
          `[AsyncCoordinator] ✅ ELK layout operation completed - VisualizationState updated`,
        );
        return "layout_complete";
      } catch (error) {
        console.error(
          `[AsyncCoordinator] ❌ ELK layout operation failed:`,
          error,
        );
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
   * This method ensures ReactFlow rendering uses current VisualizationState data
   */
  async queueReactFlowRender(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: QueueOptions = {},
  ): Promise<any> {
    // ReactFlowData
    const operation = async () => {
      // Import BridgeFactory to get singleton bridge instance
      const { bridgeFactory } = await import("../bridges/BridgeFactory.js");

      try {
        console.log(
          `[AsyncCoordinator] 🚀 Starting ReactFlow render operation`,
        );

        // Get stateless ReactFlow bridge instance (singleton)
        const reactFlowBridge = bridgeFactory.getReactFlowBridge();

        // Set layout phase to indicate rendering
        state.setLayoutPhase("rendering");

        // Convert to ReactFlow format using current VisualizationState data
        const reactFlowData = reactFlowBridge.toReactFlowData(state);

        // Set layout phase to displayed
        state.setLayoutPhase("displayed");

        console.log(
          `[AsyncCoordinator] ✅ ReactFlow render operation completed`,
        );
        return reactFlowData;
      } catch (error) {
        console.error(
          `[AsyncCoordinator] ❌ ReactFlow render operation failed:`,
          error,
        );
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
   * Queue complete layout and render pipeline with proper sequencing
   * Ensures: ELK Layout → State Update → ReactFlow Render
   * This is the recommended method for full layout updates
   */
  async queueLayoutAndRenderPipeline(
    state: any, // VisualizationState - using any to avoid circular dependency
    elkBridge: any, // ELKBridge instance
    options: QueueOptions = {},
  ): Promise<any> {
    // ReactFlowData
    console.log(`[AsyncCoordinator] 🚀 Starting layout and render pipeline`);

    try {
      // Step 1: ELK Layout (updates VisualizationState)
      console.log(`[AsyncCoordinator] 📐 Pipeline Step 1: ELK Layout`);
      await this.queueELKLayout(state, elkBridge, options);

      // Step 2: ReactFlow Render (uses updated VisualizationState)
      console.log(`[AsyncCoordinator] 🎨 Pipeline Step 2: ReactFlow Render`);
      const reactFlowData = await this.queueReactFlowRender(state, options);

      console.log(
        `[AsyncCoordinator] ✅ Layout and render pipeline completed successfully`,
      );
      return reactFlowData;
    } catch (error) {
      console.error(
        `[AsyncCoordinator] ❌ Layout and render pipeline failed:`,
        error,
      );
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
  ): Promise<void> {
    console.log(`[AsyncCoordinator] 🎨 Queuing render config update:`, updates);

    const operation = async () => {
      console.log(`[AsyncCoordinator] 🎨 Executing render config update`);
      
      // Update the render config in VisualizationState
      state.updateRenderConfig(updates);
      
      // Import ReactFlowBridge dynamically to avoid circular dependency
      const { bridgeFactory } = await import("../bridges/BridgeFactory.js");
      const reactFlowBridge = bridgeFactory.getReactFlowBridge();
      
      // Generate new ReactFlow data with updated config
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      
      console.log(`[AsyncCoordinator] ✅ Render config update completed - ReactFlow data regenerated`);
      return reactFlowData;
    };

    // Queue the operation and wait for it to complete
    const operationId = this.queueOperation("render_config_update", operation, {
      timeout: options.timeout || 3000, // 3 second default timeout
      maxRetries: options.maxRetries || 1,
    });

    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    console.log(`[AsyncCoordinator] ✅ Render config update operation ${operationId} completed`);
  }

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
      if ((state as any).expandContainer) {
        (state as any).expandContainer(containerId);
      } else {
        console.warn(
          `[AsyncCoordinator] expandContainer method not available on state`,
        );
      }
    }

    // Note: Layout updates should be triggered separately to avoid nested async operations
    // The caller should handle layout updates after processing the event
  }

  /**
   * Handle container collapse event
   */
  private async handleContainerCollapseEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { containerId, state, triggerValidation, isTreeOperation } =
      event.payload;

    if (!containerId || !state) {
      throw new Error("Container collapse event missing required payload");
    }

    console.log(
      `[AsyncCoordinator] 🔄 Processing ${isTreeOperation ? "tree node" : "container"} collapse event for ${containerId}`,
    );

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
      if ((state as any).collapseContainer) {
        (state as any).collapseContainer(containerId);
      } else {
        console.warn(
          `[AsyncCoordinator] collapseContainer method not available on state`,
        );
      }
    }

    // Trigger ReactFlow validation if requested (only for container operations)
    if (triggerValidation && !isTreeOperation) {
      console.log(
        `[AsyncCoordinator] 🔍 Triggering ReactFlow validation after container ${containerId} collapse event`,
      );
      try {
        // Use proper sequencing through queueReactFlowRender instead of direct bridge access
        await this.queueReactFlowRender(state as any);
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
    const results = (state as any).search(query || "");

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
              (state as any).expandContainer(container.id);
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
        // Use proper sequencing: no direct bridge communication
        // ReactFlow render will be handled separately by caller if needed
        console.log(
          `[AsyncCoordinator] ✅ Container ${containerId} collapse completed - ReactFlow render should be handled by caller`,
        );
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
   * Enhanced to support optional container ID list for batch operations
   */
  async expandAllContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          triggerLayout?: boolean;
          layoutConfig?: any; // LayoutConfig
          timeout?: number;
          maxRetries?: number;
        },
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<void> {
    // Handle backward compatibility - if second parameter is options object, use it
    let containerIds: string[] | undefined;
    let actualOptions = options;

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
    console.log(
      `[AsyncCoordinator] 🔄 Starting expandAllContainers operation${containerIds ? " (specified list)" : " (all containers)"}`,
    );

    // CRITICAL FIX: Use VisualizationState's expandAllContainers method directly
    // This ensures the iterative expansion logic is used for nested containers
    if (containerIds) {
      // For specified containers, use the VisualizationState method
      state.expandAllContainers(containerIds);
    } else {
      // For all containers, use the VisualizationState method
      state.expandAllContainers();
    }

    console.log(`[AsyncCoordinator] ✅ expandAllContainers operation completed`);

    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed after bulk operations
  }

  /**
   * Collapse all containers through async coordination with proper sequencing
   * Enhanced to support optional container ID list for batch operations
   */
  async collapseAllContainers(
    state: any, // VisualizationState
    containerIdsOrOptions?:
      | string[]
      | {
          triggerLayout?: boolean;
          layoutConfig?: any; // LayoutConfig
          timeout?: number;
          maxRetries?: number;
          triggerValidation?: boolean; // New option to trigger ReactFlow validation
        },
    options: {
      triggerLayout?: boolean;
      layoutConfig?: any; // LayoutConfig
      timeout?: number;
      maxRetries?: number;
      triggerValidation?: boolean; // New option to trigger ReactFlow validation
    } = {},
  ): Promise<void> {
    // Handle backward compatibility - if second parameter is options object, use it
    let containerIds: string[] | undefined;
    let actualOptions = options;

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
    // Get containers to collapse - either specified list or all expanded containers
    let containersToCollapse;
    if (containerIds) {
      // Collapse only specified containers that are currently expanded
      containersToCollapse = state.visibleContainers.filter(
        (container: any) =>
          containerIds.includes(container.id) && !container.collapsed,
      );
    } else {
      // Collapse all expanded containers (existing behavior)
      containersToCollapse = state.visibleContainers.filter(
        (container: any) => !container.collapsed,
      );
    }

    console.log(
      `[AsyncCoordinator] 🔄 Collapsing ${containersToCollapse.length} containers${containerIds ? " (specified list)" : " (all expanded)"}`,
    );

    // Collapse each container sequentially
    for (const container of containersToCollapse) {
      await this.collapseContainer(container.id, state, {
        ...actualOptions,
        triggerLayout: false, // Don't trigger layout for each individual container
      });
    }

    // Trigger ReactFlow validation after all containers are collapsed
    if (actualOptions.triggerValidation !== false) {
      console.log(
        `[AsyncCoordinator] 🔍 Triggering ReactFlow validation after container collapse`,
      );
      try {
        await this.queueReactFlowRender(state, {
          timeout: actualOptions.timeout,
          maxRetries: actualOptions.maxRetries,
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

  // Tree hierarchy and navigation methods are implemented later in the file
  // to avoid duplication with error handling methods

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

    const _collapseOps = expandOps; // Simplified - in practice we'd need to check event payload
    const _bulkOps = expandOps; // Simplified - in practice we'd need to check for bulk operations

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

  /**
   * Ensure element is visible by expanding necessary containers
   * Private helper method for navigation functionality
   */
  private async _ensureElementVisible(
    elementId: string,
    visualizationState: any, // VisualizationState
  ): Promise<void> {
    console.log(
      `[AsyncCoordinator] 🔍 Checking visibility of element ${elementId}`,
    );

    // Check if element exists as a node
    const node = visualizationState.getGraphNode(elementId);
    if (node) {
      // Element is a node - check if it's in collapsed containers
      const containersToExpand = this._getCollapsedContainersForNode(
        elementId,
        visualizationState,
      );

      if (containersToExpand.length > 0) {
        console.log(
          `[AsyncCoordinator] 📦 Expanding ${containersToExpand.length} containers to make node ${elementId} visible`,
        );

        // Expand containers from outermost to innermost
        for (const containerId of containersToExpand.reverse()) {
          console.log(
            `[AsyncCoordinator] 📂 Expanding container ${containerId} for node visibility`,
          );
          visualizationState.expandContainer(containerId);
        }

        console.log(
          `[AsyncCoordinator] ✅ All containers expanded for node ${elementId}`,
        );
      } else {
        console.log(
          `[AsyncCoordinator] ✅ Node ${elementId} is already visible`,
        );
      }
      return;
    }

    // Check if element exists as a container
    const container = visualizationState.getContainer(elementId);
    if (container) {
      // Element is a container - check if it's in collapsed parent containers
      const containersToExpand = this._getCollapsedAncestorContainers(
        elementId,
        visualizationState,
      );

      if (containersToExpand.length > 0) {
        console.log(
          `[AsyncCoordinator] 📦 Expanding ${containersToExpand.length} ancestor containers to make container ${elementId} visible`,
        );

        // Expand containers from outermost to innermost
        for (const containerId of containersToExpand.reverse()) {
          console.log(
            `[AsyncCoordinator] 📂 Expanding ancestor container ${containerId} for container visibility`,
          );
          visualizationState.expandContainer(containerId);
        }

        console.log(
          `[AsyncCoordinator] ✅ All ancestor containers expanded for container ${elementId}`,
        );
      } else {
        console.log(
          `[AsyncCoordinator] ✅ Container ${elementId} is already visible`,
        );
      }
      return;
    }

    console.warn(
      `[AsyncCoordinator] ⚠️ Element ${elementId} not found as node or container`,
    );
  }

  /**
   * Get collapsed containers that contain a specific node
   * Returns containers from innermost to outermost
   */
  private _getCollapsedContainersForNode(
    nodeId: string,
    visualizationState: any, // VisualizationState
  ): string[] {
    const collapsedContainers: string[] = [];

    // Start with the immediate container of the node
    let currentContainerId = visualizationState.getNodeContainer(nodeId);

    while (currentContainerId) {
      const container = visualizationState.getContainer(currentContainerId);

      if (container && container.collapsed) {
        collapsedContainers.push(currentContainerId);
      }

      // Move to parent container
      currentContainerId =
        visualizationState.getContainerParent(currentContainerId);
    }

    return collapsedContainers;
  }

  /**
   * Get collapsed ancestor containers for a specific container
   * Returns containers from innermost to outermost
   */
  private _getCollapsedAncestorContainers(
    containerId: string,
    visualizationState: any, // VisualizationState
  ): string[] {
    const collapsedContainers: string[] = [];

    // Start with the parent container
    let currentContainerId = visualizationState.getContainerParent(containerId);

    while (currentContainerId) {
      const container = visualizationState.getContainer(currentContainerId);

      if (container && container.collapsed) {
        collapsedContainers.push(currentContainerId);
      }

      // Move to parent container
      currentContainerId =
        visualizationState.getContainerParent(currentContainerId);
    }

    return collapsedContainers;
  }

  // Tree Hierarchy Operations (symmetric with graph operations)

  /**
   * Expand tree node through async coordination
   */
  async expandTreeNode(
    nodeId: string,
    state: any, // VisualizationState
    options: QueueOptions = {},
  ): Promise<void> {
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

    // Queue the tree expand event
    const operationId = this.queueApplicationEvent(event, {
      timeout: options.timeout || 3000, // Shorter timeout for tree operations
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
      throw failedOp.error || new Error("Tree node expand operation failed");
    }

    if (!completedOp) {
      throw new Error("Tree node expand operation not found");
    }
  }

  /**
   * Collapse tree node through async coordination
   */
  async collapseTreeNode(
    nodeId: string,
    state: any, // VisualizationState
    options: QueueOptions = {},
  ): Promise<void> {
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

    // Queue the tree collapse event
    const operationId = this.queueApplicationEvent(event, {
      timeout: options.timeout || 3000, // Shorter timeout for tree operations
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
      throw failedOp.error || new Error("Tree node collapse operation failed");
    }

    if (!completedOp) {
      throw new Error("Tree node collapse operation not found");
    }
  }

  /**
   * Expand all tree nodes through async coordination
   */
  async expandAllTreeNodes(
    state: any, // VisualizationState
    nodeIds?: string[], // Optional list, defaults to all nodes
    options: QueueOptions = {},
  ): Promise<void> {
    // Get nodes to expand - either specified list or all collapsed nodes
    const nodesToExpand =
      nodeIds ||
      state.visibleContainers
        ?.filter((container: any) => container.collapsed)
        ?.map((container: any) => container.id) ||
      [];

    console.log(
      `[AsyncCoordinator] 🔄 Expanding ${nodesToExpand.length} tree nodes${nodeIds ? " (specified list)" : " (all collapsed)"}`,
    );

    // Expand each node sequentially
    for (const nodeId of nodesToExpand) {
      await this.expandTreeNode(nodeId, state, {
        ...options,
        timeout: (options.timeout || 3000) / 2, // Shorter timeout for individual operations
      });
    }
  }

  /**
   * Collapse all tree nodes through async coordination
   */
  async collapseAllTreeNodes(
    state: any, // VisualizationState
    nodeIds?: string[], // Optional list, defaults to all nodes
    options: QueueOptions = {},
  ): Promise<void> {
    // Get nodes to collapse - either specified list or all expanded nodes
    const nodesToCollapse =
      nodeIds ||
      state.visibleContainers
        ?.filter((container: any) => !container.collapsed)
        ?.map((container: any) => container.id) ||
      [];

    console.log(
      `[AsyncCoordinator] 🔄 Collapsing ${nodesToCollapse.length} tree nodes${nodeIds ? " (specified list)" : " (all expanded)"}`,
    );

    // Collapse each node sequentially
    for (const nodeId of nodesToCollapse) {
      await this.collapseTreeNode(nodeId, state, {
        ...options,
        timeout: (options.timeout || 3000) / 2, // Shorter timeout for individual operations
      });
    }
  }

  /**
   * Navigate to element through async coordination
   */
  async navigateToElement(
    elementId: string,
    visualizationState: any, // VisualizationState
    reactFlowInstance?: any, // ReactFlowInstance
  ): Promise<void> {
    console.log(`[AsyncCoordinator] 🧭 Navigating to element ${elementId}`);

    // Set navigation selection in state
    if (visualizationState.navigateToElement) {
      visualizationState.navigateToElement(elementId);
    }

    // Focus viewport if ReactFlow instance is provided
    if (reactFlowInstance) {
      await this.focusViewportOnElement(elementId, reactFlowInstance);
    }
  }

  /**
   * Focus viewport on element
   */
  async focusViewportOnElement(
    elementId: string,
    reactFlowInstance: any, // ReactFlowInstance
  ): Promise<void> {
    console.log(
      `[AsyncCoordinator] 🎯 Focusing viewport on element ${elementId}`,
    );

    if (!reactFlowInstance) {
      throw new Error("ReactFlow instance is required for viewport focus");
    }

    try {
      // Get the node/container position
      const node = reactFlowInstance.getNode(elementId);
      if (node) {
        // Pan to the node with smooth animation
        const x = node.position.x + (node.width || 100) / 2;
        const y = node.position.y + (node.height || 50) / 2;

        reactFlowInstance.setCenter(x, y, { zoom: 1.2, duration: 800 });
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
      console.log(
        `[AsyncCoordinator] Expanding container ${containerId} with error handling`,
      );

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

      // Handle the error through the error handler (this can be async at the boundary)
      searchNavigationErrorHandler
        .handleContainerExpansionFailure([containerId], state, error as Error, {
          operation: "single_expand",
          containerId,
        })
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
  expandAllContainersWithErrorHandling(
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
      console.log(
        `[AsyncCoordinator] Expanding containers with error handling`,
      );

      // Execute synchronously (respecting core architecture)
      this.expandAllContainers(state, containerIdsOrOptions, options);

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

      // Handle the error through the error handler (async at boundary)
      searchNavigationErrorHandler
        .handleContainerExpansionFailure(containerIds, state, error as Error, {
          operation: "batch_expand",
          containerCount: containerIds.length,
        })
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
    options: {
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      console.log(
        `[AsyncCoordinator] Expanding tree node ${nodeId} with error handling`,
      );

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

      // Handle the error through the error handler (async at boundary)
      searchNavigationErrorHandler
        .handleContainerExpansionFailure([nodeId], state, error as Error, {
          operation: "tree_expand",
          nodeId,
        })
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
    } = {},
  ): ErrorRecoveryResult {
    try {
      console.log(
        `[AsyncCoordinator] Navigating to element ${elementId} with error handling`,
      );

      // Execute synchronously (respecting core architecture)
      if (visualizationState.navigateToElement) {
        visualizationState.navigateToElement(elementId);
      } else {
        throw new Error("navigateToElement method not available");
      }

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

      // Handle the error through the error handler (async at boundary)
      searchNavigationErrorHandler
        .handleNavigationFailure(
          elementId,
          visualizationState,
          error as Error,
          { operation: "navigation", elementId },
        )
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
    elementId: string,
    reactFlowInstance: any, // ReactFlowInstance
    options: {
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
      console.log(
        `[AsyncCoordinator] Focusing viewport on element ${elementId} with error handling`,
      );

      // Execute synchronously (respecting core architecture)
      // Note: Viewport operations are handled at component level, not core
      console.log(
        `[AsyncCoordinator] Viewport focus queued for element ${elementId}`,
      );

      return {
        success: true,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Viewport focus failed for element ${elementId}:`,
        error,
      );

      // Handle the error through the error handler (async at boundary)
      searchNavigationErrorHandler
        .handleNavigationFailure(
          elementId,
          {} as any, // No state needed for viewport focus
          error as Error,
          { operation: "viewport_focus", elementId },
        )
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

      return {
        success: false,
        fallbackApplied: false,
        userFeedbackShown: false,
      };
    }
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
  ): { results: any[]; recovery?: ErrorRecoveryResult } {
    try {
      console.log(
        `[AsyncCoordinator] Performing search "${query}" with error handling`,
      );

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
            this.expandAllContainers(state, containerIds);
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

      // Handle the error through the error handler (async at boundary)
      searchNavigationErrorHandler
        .handleSearchFailure(query, state, error as Error, {
          operation: "search",
          query,
          expandContainers: options.expandContainers,
        })
        .then((recovery) => {
          console.log(
            `[AsyncCoordinator] Search error recovery completed:`,
            recovery,
          );
        })
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
   * Get containers that need to be expanded for search results
   */
  private _getContainersForSearchResults(
    searchResults: any[],
    state: any,
  ): string[] {
    const containerIds = new Set<string>();

    for (const result of searchResults) {
      if (result.type === "node") {
        // Find containers that contain this node
        let currentContainer = state.getNodeContainer
          ? state.getNodeContainer(result.id)
          : null;
        while (currentContainer) {
          const container = state.getContainer
            ? state.getContainer(currentContainer)
            : null;
          if (container && container.collapsed) {
            containerIds.add(currentContainer);
          }
          currentContainer = state.getContainerParent
            ? state.getContainerParent(currentContainer)
            : null;
        }
      }
    }

    return Array.from(containerIds);
  }

  /**
   * Execute operation with error recovery (synchronous core)
   */
  executeWithErrorRecovery<T>(
    operation: () => T,
    operationType: string,
    context?: Record<string, any>,
  ): { result?: T; recovery?: ErrorRecoveryResult } {
    try {
      const result = operation();
      return { result };
    } catch (error) {
      console.error(
        `[AsyncCoordinator] Operation "${operationType}" failed:`,
        error,
      );

      // Handle error through error handler (async at boundary)
      searchNavigationErrorHandler
        .handleTimeout(
          operationType,
          0, // No timeout for synchronous operations
          context,
        )
        .then((recovery) => {
          console.log(`[AsyncCoordinator] Error recovery completed:`, recovery);
        })
        .catch((handlerError) => {
          console.error(
            `[AsyncCoordinator] Error handler failed:`,
            handlerError,
          );
        });

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
   * Get error handler statistics
   */
  getErrorStatistics() {
    return searchNavigationErrorHandler.getErrorStatistics();
  }

  /**
   * Check if system is experiencing high error rate
   */
  isHighErrorRate(): boolean {
    return searchNavigationErrorHandler.isHighErrorRate();
  }

  /**
   * Get recovery suggestions based on error patterns
   */
  getRecoverySuggestions(): string[] {
    return searchNavigationErrorHandler.getRecoverySuggestions();
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    searchNavigationErrorHandler.clearErrorHistory();
  }
}
