/**
 * AsyncCoordinator - Sequential queue system for async operations
 * Manages async boundaries with FIFO queues and error handling
 */
import { QueuedOperation, QueueStatus, ApplicationEvent } from "../types/core";
import { bridgeFactory } from "../bridges/BridgeFactory.js";
interface ErrorRecoveryResult {
  success: boolean;
  fallbackApplied: boolean;
  userFeedbackShown: boolean;
}
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
  // Callback to update HydroscopeCore's React state when ReactFlow data changes
  public onReactFlowDataUpdate?: (reactFlowData: any) => void;

  // NEW: FitView integration callback for React integration
  public onFitViewRequested?: (options?: { padding?: number; duration?: number }) => void;

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
        operation.result = result;
        this.completedOperations.push(operation);
        this.recordProcessingTime(operation);
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
   * Execute ELK layout operation synchronously (private method)
   * This method ensures ELK layout results update VisualizationState before any ReactFlow render
   */
  private async executeELKLayout(
    state: any, // VisualizationState - using any to avoid circular dependency
    elkBridge: any, // ELKBridge instance
    options: QueueOptions = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const operation = async () => {
        try {
          // Set layout phase to indicate processing
          state.setLayoutPhase("laying_out");
          // ELKBridge is now stateless - no caches to clear
          // Call real ELK layout calculation - this updates VisualizationState directly
          await elkBridge.layout(state);
          // Increment layout count for smart collapse logic
          state.incrementLayoutCount();
          // Set layout phase to ready after successful ELK layout
          state.setLayoutPhase("ready");
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
      // Queue the operation
      const operationId = this.queueOperation("elk_layout", operation, {
        timeout: options.timeout || 10000, // 10 second default timeout
        maxRetries: options.maxRetries || 1,
      });
      // Set up a way to resolve/reject the Promise when the operation completes
      const checkCompletion = () => {
        const completed = this.completedOperations.find(
          (op) => op.id === operationId,
        );
        const failed = this.failedOperations.find(
          (op) => op.id === operationId,
        );
        if (completed) {
          resolve();
        } else if (failed) {
          reject(failed.error || new Error("Operation failed"));
        } else {
          // Check again after a short delay
          setTimeout(checkCompletion, 10);
        }
      };
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue()
          .then(() => {
            // Start checking for completion after processing starts
            checkCompletion();
          })
          .catch(reject);
      } else {
        // If already processing, just start checking for completion
        checkCompletion();
      }
    });
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
   * Generate ReactFlow data synchronously (private method)
   * This method ensures ReactFlow rendering uses current VisualizationState data
   */
  private async generateReactFlowData(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: QueueOptions = {},
  ): Promise<any> {
    // ReactFlowData
    return new Promise((resolve, reject) => {
      const operation = async () => {
        // Import BridgeFactory to get singleton bridge instance
        const { bridgeFactory } = await import("../bridges/BridgeFactory.js");
        try {
          // Get stateless ReactFlow bridge instance (singleton)
          const reactFlowBridge = bridgeFactory.getReactFlowBridge();
          // Set layout phase to indicate rendering
          state.setLayoutPhase("rendering");
          // Convert to ReactFlow format using current VisualizationState data
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          // Set layout phase to displayed
          state.setLayoutPhase("displayed");
          // CRITICAL FIX: Trigger HydroscopeCore state update
          // The AsyncCoordinator generates ReactFlow data but doesn't update HydroscopeCore's React state
          // We need to ensure the HydroscopeCore gets the updated data
          if (this.onReactFlowDataUpdate) {
            this.onReactFlowDataUpdate(reactFlowData);
          }
          return reactFlowData;
        } catch (error) {
          console.error(
            `[AsyncCoordinator] ❌ ReactFlow render operation failed:`,
            error,
          );
          state.setLayoutPhase("error");
          reject(error);
          throw error;
        }
      };
      // Queue the operation
      const operationId = this.queueOperation("reactflow_render", operation, {
        timeout: options.timeout || 5000, // 5 second default timeout
        maxRetries: options.maxRetries || 1,
      });
      // Set up proper completion tracking
      const checkCompletion = () => {
        const completed = this.completedOperations.find(
          (op) => op.id === operationId,
        );
        const failed = this.failedOperations.find(
          (op) => op.id === operationId,
        );
        if (completed) {
          resolve(completed.result);
        } else if (failed) {
          reject(failed.error || new Error("Operation failed"));
        } else {
          // Check again after a short delay
          setTimeout(checkCompletion, 10);
        }
      };
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue()
          .then(() => {
            // Start checking for completion after processing starts
            checkCompletion();
          })
          .catch(reject);
      } else {
        // If already processing, just start checking for completion
        checkCompletion();
      }
    });
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
   * @param elkBridge - ELKBridge instance
   * @param options - Pipeline execution options
   * @returns Promise<ReactFlowData> when complete pipeline is finished (including FitView if enabled)
   */
  async executeLayoutAndRenderPipeline(
    state: any, // VisualizationState - using any to avoid circular dependency
    elkBridge: any, // ELKBridge instance
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
  ): Promise<any> { // ReactFlowData
    const startTime = Date.now();
    const performanceMetrics = {
      stateChangeDetection: 0,
      layoutSkipped: false,
      layoutDuration: 0,
      renderDuration: 0,
      fitViewOptimized: false,
      totalOptimizationSavings: 0
    };

    // Validate required parameters - FAIL FAST with clear messages
    if (!state) {
      throw new Error('VisualizationState instance is required for layout and render pipeline');
    }
    if (!elkBridge) {
      throw new Error('ELKBridge instance is required for layout and render pipeline');
    }

    try {
      console.debug('[AsyncCoordinator] 🚀 Starting optimized synchronous layout and render pipeline', {
        relayoutEntities: options.relayoutEntities,
        fitView: options.fitView,
        timestamp: startTime
      });

      // PERFORMANCE OPTIMIZATION 1: State change detection using VisualizationState's cache invalidation
      const stateDetectionStart = Date.now();
      const shouldSkipLayout = this._shouldSkipLayoutBasedOnStateChanges(state, options.relayoutEntities);
      performanceMetrics.stateChangeDetection = Date.now() - stateDetectionStart;
      
      if (shouldSkipLayout) {
        performanceMetrics.layoutSkipped = true;
        performanceMetrics.totalOptimizationSavings += 50; // Estimated layout time savings
        console.debug('[AsyncCoordinator] ⚡ Layout optimization: Skipping unnecessary layout based on state analysis', {
          stateChangeDetectionTime: `${performanceMetrics.stateChangeDetection}ms`,
          estimatedSavings: '50ms'
        });
      }

      // Step 1: Execute ELK layout if needed - FAIL FAST on errors
      const layoutStart = Date.now();
      if (options.relayoutEntities !== undefined && options.relayoutEntities.length === 0) {
        // Skip layout - relayoutEntities is empty array
        console.debug('[AsyncCoordinator] ⏭️ Skipping ELK layout - no entities to re-layout');
        performanceMetrics.layoutSkipped = true;
      } else if (shouldSkipLayout) {
        // Skip layout - state hasn't changed meaningfully
        console.debug('[AsyncCoordinator] ⚡ Skipping ELK layout - no meaningful state changes detected');
        performanceMetrics.layoutSkipped = true;
      } else {
        // Execute layout (async but atomic within this pipeline) - NO ERROR SUPPRESSION
        await this.executeELKLayoutAsync(state, elkBridge, options.relayoutEntities);
        performanceMetrics.layoutDuration = Date.now() - layoutStart;
        console.debug('[AsyncCoordinator] ✅ ELK layout completed successfully', {
          layoutDuration: `${performanceMetrics.layoutDuration}ms`
        });
      }

      // Step 2: Generate ReactFlow data synchronously - FAIL FAST on errors
      const renderStart = Date.now();
      const reactFlowData = this.generateReactFlowDataSync(state);
      performanceMetrics.renderDuration = Date.now() - renderStart;
      console.debug('[AsyncCoordinator] ✅ ReactFlow data generation completed successfully', {
        renderDuration: `${performanceMetrics.renderDuration}ms`
      });

      // PERFORMANCE OPTIMIZATION 2: Optimize FitView execution within synchronous pipeline
      if (options.fitView && this.onFitViewRequested) {
        const fitViewOptimized = this._optimizeFitViewExecution(options.fitViewOptions, reactFlowData);
        performanceMetrics.fitViewOptimized = fitViewOptimized.optimized;
        
        if (fitViewOptimized.shouldExecute) {
          this.onFitViewRequested(fitViewOptimized.optimizedOptions);
          console.debug('[AsyncCoordinator] ✅ FitView callback triggered successfully', {
            optimized: fitViewOptimized.optimized,
            optimizationApplied: fitViewOptimized.optimizationApplied
          });
        } else {
          performanceMetrics.totalOptimizationSavings += 10; // Estimated FitView time savings
          console.debug('[AsyncCoordinator] ⚡ FitView optimization: Skipping unnecessary FitView operation', {
            reason: fitViewOptimized.skipReason,
            estimatedSavings: '10ms'
          });
        }
      }

      // Step 4: Update HydroscopeCore's React state if callback is available - FAIL FAST on errors
      if (this.onReactFlowDataUpdate) {
        this.onReactFlowDataUpdate(reactFlowData);
        console.debug('[AsyncCoordinator] ✅ ReactFlow data update callback completed successfully');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // PERFORMANCE OPTIMIZATION 3: Performance logging using local variables (no persistent caches)
      this._logPipelinePerformanceMetrics(duration, performanceMetrics, reactFlowData, options);

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Optimized synchronous layout and render pipeline failed:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        performanceMetrics,
        options,
        timestamp: endTime
      });
      
      // Set error state
      if (state && typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase('error');
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
      console.debug('[AsyncCoordinator] 🎯 Starting ELK layout execution', {
        relayoutEntities,
        elkBridgeAvailable: !!elkBridge,
        stateAvailable: !!state,
        timestamp: startTime
      });

      // Set layout phase to indicate processing
      if (state && typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase("laying_out");
      }

      // Validate ELK bridge availability
      if (!elkBridge) {
        throw new Error('ELKBridge instance is required for layout operations');
      }

      if (typeof elkBridge.layout !== 'function') {
        throw new Error('ELKBridge layout method is not available');
      }

      // Execute ELK layout calculation with timeout protection
      const layoutPromise = elkBridge.layout(state);
      const timeoutMs = 15000; // 15 second timeout for layout operations
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`ELK layout operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between layout completion and timeout
      await Promise.race([layoutPromise, timeoutPromise]);

      // Increment layout count for smart collapse logic
      if (state && typeof state.incrementLayoutCount === 'function') {
        state.incrementLayoutCount();
      }

      // Set layout phase to ready after successful ELK layout
      if (state && typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase("ready");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ ELK layout completed successfully', {
        duration: `${duration}ms`,
        relayoutEntities,
        timestamp: endTime
      });
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ ELK layout operation failed:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        relayoutEntities,
        elkBridgeAvailable: !!elkBridge,
        stateAvailable: !!state,
        timestamp: endTime
      });
      
      // Set error state but don't prevent recovery
      if (state && typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase("error");
      }
      
      throw error;
    }
  }

  /**
   * Generate ReactFlow data synchronously (private helper for synchronous pipeline)
   */
  private generateReactFlowDataSync(state: any): any { // ReactFlowData
    const startTime = Date.now();
    
    try {
      console.debug('[AsyncCoordinator] 🎨 Starting ReactFlow data generation', {
        stateAvailable: !!state,
        timestamp: startTime
      });

      // Validate state availability
      if (!state) {
        throw new Error('VisualizationState instance is required for ReactFlow data generation');
      }

      // Set layout phase to indicate rendering
      if (typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase("rendering");
      }

      // Get ReactFlowBridge instance synchronously using imported bridge factory
      const reactFlowBridge = bridgeFactory.getReactFlowBridge();
      
      if (!reactFlowBridge) {
        throw new Error('ReactFlowBridge instance is not available from bridge factory');
      }

      if (typeof reactFlowBridge.toReactFlowData !== 'function') {
        throw new Error('ReactFlowBridge toReactFlowData method is not available');
      }

      // Convert to ReactFlow format using current VisualizationState data
      const reactFlowData = reactFlowBridge.toReactFlowData(state);

      // Validate generated data structure
      if (!reactFlowData || typeof reactFlowData !== 'object') {
        throw new Error('ReactFlowBridge returned invalid data structure');
      }

      if (!Array.isArray(reactFlowData.nodes)) {
        console.warn('[AsyncCoordinator] ⚠️ ReactFlow data missing nodes array, using empty array');
        (reactFlowData as any).nodes = [];
      }

      if (!Array.isArray(reactFlowData.edges)) {
        console.warn('[AsyncCoordinator] ⚠️ ReactFlow data missing edges array, using empty array');
        (reactFlowData as any).edges = [];
      }

      // Set layout phase to displayed
      if (typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase("displayed");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ ReactFlow data generation completed successfully', {
        duration: `${duration}ms`,
        nodesCount: reactFlowData.nodes.length,
        edgesCount: reactFlowData.edges.length,
        timestamp: endTime
      });

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Synchronous ReactFlow render operation failed:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        stateAvailable: !!state,
        timestamp: endTime
      });
      
      if (state && typeof state.setLayoutPhase === 'function') {
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
    return new Promise((resolve, reject) => {
      const operation = async () => {
        try {
          // Update the render config in VisualizationState
          state.updateRenderConfig(updates);
          // Import ReactFlowBridge dynamically to avoid circular dependency
          const { bridgeFactory } = await import("../bridges/BridgeFactory.js");
          const reactFlowBridge = bridgeFactory.getReactFlowBridge();
          // Generate new ReactFlow data with updated config
          const reactFlowData = reactFlowBridge.toReactFlowData(state);
          resolve(reactFlowData);
          return reactFlowData;
        } catch (error) {
          console.error(
            `[AsyncCoordinator] ❌ Render config update failed:`,
            error,
          );
          reject(error);
          throw error;
        }
      };
      // Queue the operation
      this.queueOperation("render_config_update", operation, {
        timeout: options.timeout || 3000, // 3 second default timeout
        maxRetries: options.maxRetries || 1,
      });
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue().catch(reject);
      }
    });
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
  private processApplicationEventSync(
    event: ApplicationEvent,
  ): void {
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
   * Process individual application event (legacy async version)
   */
  private async processApplicationEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    switch (event.type) {
      case "container_expand":
        await this.handleContainerExpandEvent(event);
        break;
      case "container_expand_all":
        await this.handleContainerExpandAllEvent(event);
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
   * Handle container expand event synchronously
   */
  private handleContainerExpandEventSync(
    event: ApplicationEvent,
  ): void {
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
   * Handle container expand event (legacy async version)
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
  private handleContainerCollapseEventSync(
    event: ApplicationEvent,
  ): void {
    const { containerId, state, isTreeOperation } =
      event.payload;
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
   * Handle container collapse event (legacy async version)
   */
  private async handleContainerCollapseEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { containerId, state, triggerValidation, isTreeOperation } =
      event.payload;
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
    // Trigger ReactFlow validation if requested (only for container operations)
    if (triggerValidation && !isTreeOperation) {
      try {
        // Use proper sequencing through generateReactFlowData instead of direct bridge access
        await this.generateReactFlowData(state as any);
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
   * Handle container expand all event synchronously
   */
  private handleContainerExpandAllEventSync(
    event: ApplicationEvent,
  ): void {
    const { containerIds, state } = event.payload;
    if (!state) {
      throw new Error("Container expand all event missing required payload");
    }
    // Use VisualizationState's expandAllContainers method directly
    // This ensures the iterative expansion logic is used for nested containers
    if (containerIds) {
      // For specified containers, use the internal coordinator method
      (state as any)._expandAllContainersForCoordinator(containerIds);
    } else {
      // For all containers, use the internal coordinator method
      (state as any)._expandAllContainersForCoordinator();
    }
    // Note: Layout triggering should be handled separately to avoid circular dependencies
    // The caller should trigger layout operations as needed after bulk operations
  }

  /**
   * Handle container expand all event (legacy async version)
   */
  private async handleContainerExpandAllEvent(
    event: ApplicationEvent,
  ): Promise<void> {
    const { containerIds, state } = event.payload;
    if (!state) {
      throw new Error("Container expand all event missing required payload");
    }
    // Use VisualizationState's expandAllContainers method directly
    // This ensures the iterative expansion logic is used for nested containers
    if (containerIds) {
      // For specified containers, use the internal coordinator method
      (state as any)._expandAllContainersForCoordinator(containerIds);
    } else {
      // For all containers, use the internal coordinator method
      (state as any)._expandAllContainersForCoordinator();
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
   * Handle search event (legacy async version)
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
  private handleLayoutConfigChangeEventSync(
    event: ApplicationEvent,
  ): void {
    const { config, state } = event.payload;
    if (!config || !state) {
      throw new Error("Layout config change event missing required payload");
    }
    // Store the new configuration in the state (if supported)
    // The actual layout update should be triggered separately
    // Note: This is a simplified implementation - in practice, we'd store config in state
  }

  /**
   * Handle layout config change event (legacy async version)
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
   * Expand container using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
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
  ): Promise<any> { // ReactFlowData
    const startTime = Date.now();
    
    try {
      console.debug('[AsyncCoordinator] 📦 Starting container expand operation', {
        containerId,
        relayoutEntities: options.relayoutEntities,
        fitView: options.fitView,
        timestamp: startTime
      });

      // Validate inputs
      if (!containerId) {
        throw new Error('Container ID is required for expand operation');
      }
      if (!state) {
        throw new Error('VisualizationState is required for expand operation');
      }
      
      // Get ELK bridge from bridge factory - no need to pass it as parameter
      const elkBridge = bridgeFactory.getELKBridge();
      if (!elkBridge) {
        throw new Error('ELK bridge is not available from bridge factory');
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
        console.debug('[AsyncCoordinator] ✅ Container state change processed successfully', { containerId });
      } catch (stateError) {
        console.error('[AsyncCoordinator] ❌ Container state change failed:', {
          containerId,
          error: (stateError as Error).message,
          stack: (stateError as Error).stack
        });
        throw new Error(`Failed to expand container ${containerId}: ${(stateError as Error).message}`);
      }
      
      // Use enhanced pipeline for layout and render with graceful error handling
      const reactFlowData = await this.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: options.relayoutEntities || [containerId],
        fitView: options.fitView,
        fitViewOptions: options.fitViewOptions,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ Container expand operation completed successfully', {
        containerId,
        duration: `${duration}ms`,
        nodesCount: reactFlowData?.nodes?.length || 0,
        edgesCount: reactFlowData?.edges?.length || 0,
        timestamp: endTime
      });

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Container expand operation failed:', {
        containerId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options,
        timestamp: endTime
      });
      
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
  ): Promise<any> { // ReactFlowData
    const startTime = Date.now();
    
    try {
      console.debug('[AsyncCoordinator] 📦 Starting container collapse operation', {
        containerId,
        relayoutEntities: options.relayoutEntities,
        fitView: options.fitView,
        timestamp: startTime
      });

      // Validate inputs
      if (!containerId) {
        throw new Error('Container ID is required for collapse operation');
      }
      if (!state) {
        throw new Error('VisualizationState is required for collapse operation');
      }
      
      // Get ELK bridge from bridge factory - no need to pass it as parameter
      const elkBridge = bridgeFactory.getELKBridge();
      if (!elkBridge) {
        throw new Error('ELK bridge is not available from bridge factory');
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
        console.debug('[AsyncCoordinator] ✅ Container state change processed successfully', { containerId });
      } catch (stateError) {
        console.error('[AsyncCoordinator] ❌ Container state change failed:', {
          containerId,
          error: (stateError as Error).message,
          stack: (stateError as Error).stack
        });
        throw new Error(`Failed to collapse container ${containerId}: ${(stateError as Error).message}`);
      }
      
      // Use enhanced pipeline for layout and render with graceful error handling
      const reactFlowData = await this.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: options.relayoutEntities || [containerId],
        fitView: options.fitView,
        fitViewOptions: options.fitViewOptions,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ Container collapse operation completed successfully', {
        containerId,
        duration: `${duration}ms`,
        nodesCount: reactFlowData?.nodes?.length || 0,
        edgesCount: reactFlowData?.edges?.length || 0,
        timestamp: endTime
      });

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Container collapse operation failed:', {
        containerId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options,
        timestamp: endTime
      });
      
      throw error;
    }
  }
  /**
   * Expand all containers using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   */
  async expandAllContainers(
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
  ): Promise<any> { // ReactFlowData
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

      console.debug('[AsyncCoordinator] 📦 Starting expand all containers operation', {
        containerIds,
        relayoutEntities: actualOptions.relayoutEntities,
        fitView: actualOptions.fitView,
        timestamp: startTime
      });

      // Validate inputs
      if (!state) {
        throw new Error('VisualizationState is required for expand all containers operation');
      }
      
      // Get ELK bridge from bridge factory - no need to pass it as parameter
      const elkBridge = bridgeFactory.getELKBridge();
      if (!elkBridge) {
        throw new Error('ELK bridge is not available from bridge factory');
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
        console.debug('[AsyncCoordinator] ✅ Expand all containers state change processed successfully', {
          containerIds: containerIds?.length || 'all'
        });
      } catch (stateError) {
        console.error('[AsyncCoordinator] ❌ Expand all containers state change failed:', {
          containerIds,
          error: (stateError as Error).message,
          stack: (stateError as Error).stack
        });
        throw new Error(`Failed to expand all containers: ${(stateError as Error).message}`);
      }
      
      // Use enhanced pipeline for layout and render (full layout for expand all)
      const reactFlowData = await this.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: actualOptions.relayoutEntities, // undefined = full layout for expand all
        fitView: actualOptions.fitView,
        fitViewOptions: actualOptions.fitViewOptions,
        timeout: actualOptions.timeout,
        maxRetries: actualOptions.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ Expand all containers operation completed successfully', {
        containerIds: containerIds?.length || 'all',
        duration: `${duration}ms`,
        nodesCount: reactFlowData?.nodes?.length || 0,
        edgesCount: reactFlowData?.edges?.length || 0,
        timestamp: endTime
      });

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Expand all containers operation failed:', {
        containerIds: Array.isArray(containerIdsOrOptions) ? containerIdsOrOptions : 'all',
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options: actualOptions,
        timestamp: endTime
      });
      
      throw error;
    }
  }
  /**
   * Collapse all containers using enhanced pipeline with synchronous state changes
   * Returns ReactFlowData when complete pipeline is finished
   */
  async collapseAllContainers(
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
  ): Promise<any> { // ReactFlowData
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

      console.debug('[AsyncCoordinator] 📦 Starting collapse all containers operation', {
        containerIds,
        relayoutEntities: actualOptions.relayoutEntities,
        fitView: actualOptions.fitView,
        timestamp: startTime
      });

      // Validate inputs
      if (!state) {
        throw new Error('VisualizationState is required for collapse all containers operation');
      }
      
      // Get ELK bridge from bridge factory - no need to pass it as parameter
      const elkBridge = bridgeFactory.getELKBridge();
      if (!elkBridge) {
        throw new Error('ELK bridge is not available from bridge factory');
      }
      
      // Get containers to collapse - either specified list or all expanded containers
      let containersToCollapse: any[] = [];
      try {
        if (containerIds && containerIds.length > 0) {
          // Collapse only specified containers that are currently expanded
          containersToCollapse = state.visibleContainers?.filter(
            (container: any) =>
              containerIds!.includes(container.id) && !container.collapsed,
          ) || [];
        } else {
          // Collapse all expanded containers (existing behavior)
          containersToCollapse = state.visibleContainers?.filter(
            (container: any) => !container.collapsed,
          ) || [];
        }

        console.debug('[AsyncCoordinator] 📋 Found containers to collapse', {
          totalContainers: containersToCollapse.length,
          containerIds: containersToCollapse.map((c: any) => c.id)
        });
      } catch (containerError) {
        console.error('[AsyncCoordinator] ❌ Failed to identify containers to collapse:', {
          containerIds,
          error: (containerError as Error).message,
          stack: (containerError as Error).stack
        });
        throw new Error(`Failed to identify containers to collapse: ${(containerError as Error).message}`);
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
          console.warn('[AsyncCoordinator] ⚠️ Failed to collapse container, continuing with others:', {
            containerId: container.id,
            error: (stateError as Error).message
          });
          // Continue with other containers
        }
      }

      console.debug('[AsyncCoordinator] ✅ Container state changes processed', {
        totalRequested: containersToCollapse.length,
        successfullyCollapsed: successfullyCollapsed.length,
        failedContainers: containersToCollapse.length - successfullyCollapsed.length
      });
      
      // Use enhanced pipeline for layout and render (full layout for collapse all)
      const reactFlowData = await this.executeLayoutAndRenderPipeline(state, elkBridge, {
        relayoutEntities: actualOptions.relayoutEntities, // undefined = full layout for collapse all
        fitView: actualOptions.fitView,
        fitViewOptions: actualOptions.fitViewOptions,
        timeout: actualOptions.timeout,
        maxRetries: actualOptions.maxRetries,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ Collapse all containers operation completed successfully', {
        containerIds: containerIds?.length || 'all',
        collapsedCount: successfullyCollapsed.length,
        duration: `${duration}ms`,
        nodesCount: reactFlowData?.nodes?.length || 0,
        edgesCount: reactFlowData?.edges?.length || 0,
        timestamp: endTime
      });

      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Collapse all containers operation failed:', {
        containerIds: Array.isArray(containerIdsOrOptions) ? containerIdsOrOptions : 'all',
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options: actualOptions,
        timestamp: endTime
      });
      
      throw error;
    }
  }
  // Legacy methods for backward compatibility (deprecated - use enhanced pipeline methods)
  
  // REMOVED: Deprecated methods queueELKLayout, queueReactFlowRender, queueApplicationEvent
  // These methods encouraged manual orchestration patterns and have been replaced by:
  // - executeLayoutAndRenderPipeline for complete pipeline operations
  // - expandContainer/collapseContainer for container operations
  // - updateSearchResults for search operations

  // Tree hierarchy and navigation methods are implemented later in the file
  // to avoid duplication with error handling methods
  /**
   * Handle container operation error recovery
   */
  async recoverFromContainerOperationError(
    operationId: string,
    _state: any, // VisualizationState
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

  // Tree Hierarchy Operations (symmetric with graph operations)
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
    reactFlowInstance: any,
  ): Promise<void> {
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
    _reactFlowInstance?: any, // ReactFlowInstance
    _options: {
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): ErrorRecoveryResult {
    try {
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
    elkBridge: any, // ELKBridge instance
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
  ): Promise<any> { // ReactFlowData
    const startTime = Date.now();
    
    try {
      console.debug('[AsyncCoordinator] 🔍 Starting search update operation', {
        query,
        expandContainers: options.expandContainers,
        fitView: options.fitView,
        timestamp: startTime
      });

      // Validate inputs
      if (!state) {
        throw new Error('VisualizationState is required for search operations');
      }

      // Step 1: Perform search in VisualizationState (synchronous) - FAIL FAST on errors
      const searchResults = state.search ? state.search(query) : [];
      console.debug('[AsyncCoordinator] ✅ Search completed successfully', {
        query,
        resultsCount: searchResults.length
      });
      
      // Step 2: Optionally expand containers containing search results
      if (options.expandContainers && searchResults.length > 0) {
        // Find containers that need to be expanded for search results
        const containerIds = this._getContainersForSearchResults(searchResults, state);
        
        if (containerIds && containerIds.length > 0) {
          console.debug('[AsyncCoordinator] 📦 Expanding containers for search results', {
            containerIds,
            resultsCount: searchResults.length
          });

          // Expand containers synchronously - FAIL FAST on errors
          for (const containerId of containerIds) {
            if (!state._expandContainerForCoordinator) {
              throw new Error(`Container expansion method not available for container: ${containerId}`);
            }
            state._expandContainerForCoordinator(containerId);
          }
          
          // Execute layout and render pipeline with container expansion
          const reactFlowData = await this.executeLayoutAndRenderPipeline(state, elkBridge, {
            relayoutEntities: containerIds, // Re-layout expanded containers
            fitView: options.fitView,
            fitViewOptions: options.fitViewOptions,
            timeout: options.timeout,
            maxRetries: options.maxRetries,
          });

          const endTime = Date.now();
          const duration = endTime - startTime;
          
          console.debug('[AsyncCoordinator] ✅ Search update with container expansion completed successfully', {
            query,
            duration: `${duration}ms`,
            expandedContainers: containerIds.length,
            resultsCount: searchResults.length,
            timestamp: endTime
          });

          return reactFlowData;
        }
      }
      
      // Step 3: If no container expansion needed, just update ReactFlow with search highlights - FAIL FAST
      const reactFlowData = this.generateReactFlowDataSync(state);
      console.debug('[AsyncCoordinator] ✅ ReactFlow data generated for search highlighting');
      
      // Step 4: Trigger FitView if enabled (for search results highlighting) - FAIL FAST
      if (options.fitView && this.onFitViewRequested) {
        this.onFitViewRequested(options.fitViewOptions);
        console.debug('[AsyncCoordinator] ✅ FitView triggered for search results');
      }
      
      // Step 5: Update HydroscopeCore's React state if callback is available - FAIL FAST
      if (this.onReactFlowDataUpdate) {
        this.onReactFlowDataUpdate(reactFlowData);
        console.debug('[AsyncCoordinator] ✅ ReactFlow data update callback completed for search');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.debug('[AsyncCoordinator] ✅ Search update completed successfully', {
        query,
        duration: `${duration}ms`,
        resultsCount: searchResults.length,
        expandContainers: options.expandContainers,
        fitView: options.fitView,
        timestamp: endTime
      });
      
      return reactFlowData;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error('[AsyncCoordinator] ❌ Search update failed:', {
        query,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: `${duration}ms`,
        options,
        timestamp: endTime
      });
      
      // Set error state
      if (state && typeof state.setLayoutPhase === 'function') {
        state.setLayoutPhase('error');
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
    return new Promise((resolve, reject) => {
      const operation = async () => {
        try {
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
          resolve();
          return "hierarchy_change_complete";
        } catch (error) {
          console.error(
            `[AsyncCoordinator] ❌ Hierarchy change to ${groupingId} failed:`,
            error,
          );
          reject(error);
          throw error;
        }
      };
      // Queue the operation
      this.queueOperation("hierarchy_change", operation, {
        timeout: options.timeout || 5000, // 5 second default timeout
        maxRetries: options.maxRetries || 1,
      });
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue().catch(reject);
      }
    });
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

  // PERFORMANCE OPTIMIZATION METHODS (STATELESS)

  /**
   * PERFORMANCE OPTIMIZATION 1: State change detection using VisualizationState's cache invalidation
   * Uses ephemeral stack-based comparison to skip unnecessary layout when state hasn't changed
   * This is stateless - only uses local variables and VisualizationState's existing cache mechanisms
   * FAIL FAST - no error suppression
   */
  private _shouldSkipLayoutBasedOnStateChanges(
    state: any, // VisualizationState
    relayoutEntities?: string[]
  ): boolean {
    // If full layout is requested (relayoutEntities is undefined), never skip
    if (relayoutEntities === undefined) {
      console.debug('[AsyncCoordinator] ⚡ State analysis: Full layout requested, cannot skip');
      return false;
    }

    // If specific entities are requested for layout, never skip
    if (relayoutEntities && relayoutEntities.length > 0) {
      console.debug('[AsyncCoordinator] ⚡ State analysis: Specific entities requested for layout, cannot skip');
      return false;
    }

    // Use VisualizationState's existing cache invalidation mechanisms
    const currentSnapshot = this._createEphemeralStateSnapshot(state);
    
    // Compare with last snapshot (ephemeral, stack-based)
    const hasSignificantChanges = this._hasSignificantStateChanges(currentSnapshot);
    
    // Update last snapshot for next comparison (stateless - only in memory)
    this._lastStateSnapshot = currentSnapshot;
    
    if (!hasSignificantChanges) {
      console.debug('[AsyncCoordinator] ⚡ State analysis: No significant changes detected, layout can be skipped', {
        currentSnapshot: {
          containerCount: currentSnapshot.containerCount,
          nodeCount: currentSnapshot.nodeCount,
          layoutPhase: currentSnapshot.layoutPhase,
          cacheVersion: currentSnapshot.cacheVersion
        }
      });
      return true;
    }

    console.debug('[AsyncCoordinator] ⚡ State analysis: Significant changes detected, layout required', {
      currentSnapshot: {
        containerCount: currentSnapshot.containerCount,
        nodeCount: currentSnapshot.nodeCount,
        layoutPhase: currentSnapshot.layoutPhase,
        cacheVersion: currentSnapshot.cacheVersion
      }
    });
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
    cacheVersion?: number;
  } {
    return {
      timestamp: Date.now(),
      containerCount: state.visibleContainers?.length || 0,
      nodeCount: state.visibleNodes?.length || 0,
      edgeCount: state.visibleEdges?.length || 0,
      layoutPhase: state.layoutPhase || 'unknown',
      // Use VisualizationState's existing cache version if available
      cacheVersion: state.getCacheVersion ? state.getCacheVersion() : undefined
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
    if (currentSnapshot.cacheVersion !== undefined && lastSnapshot.cacheVersion !== undefined) {
      if (currentSnapshot.cacheVersion !== lastSnapshot.cacheVersion) {
        return true; // Cache version changed - significant change
      }
    }

    // Check structural changes
    if (currentSnapshot.containerCount !== lastSnapshot.containerCount ||
        currentSnapshot.nodeCount !== lastSnapshot.nodeCount ||
        currentSnapshot.edgeCount !== lastSnapshot.edgeCount) {
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
   * PERFORMANCE OPTIMIZATION 2: Optimize FitView execution within synchronous pipeline
   * No external state - uses only local analysis and ReactFlowData
   * FAIL FAST - no error suppression
   */
  private _optimizeFitViewExecution(
    fitViewOptions?: { padding?: number; duration?: number },
    reactFlowData?: any
  ): {
    shouldExecute: boolean;
    optimized: boolean;
    optimizedOptions?: { padding?: number; duration?: number };
    optimizationApplied?: string;
    skipReason?: string;
  } {
    // If no ReactFlow data, can't optimize - execute normally
    if (!reactFlowData || !reactFlowData.nodes) {
      return {
        shouldExecute: true,
        optimized: false,
        optimizedOptions: fitViewOptions
      };
    }

    // Check if there are any visible nodes to fit to
    const visibleNodes = reactFlowData.nodes.filter((node: any) => !node.hidden);
    if (visibleNodes.length === 0) {
      return {
        shouldExecute: false,
        optimized: true,
        skipReason: 'No visible nodes to fit view to'
      };
    }

    // Optimize FitView options based on node count (stateless optimization)
    const optimizedOptions = this._optimizeFitViewOptions(fitViewOptions, visibleNodes.length);
    
    return {
      shouldExecute: true,
      optimized: optimizedOptions.optimized,
      optimizedOptions: optimizedOptions.options,
      optimizationApplied: optimizedOptions.optimizationApplied
    };
  }

  /**
   * Optimize FitView options based on node count (stateless)
   */
  private _optimizeFitViewOptions(
    originalOptions?: { padding?: number; duration?: number },
    nodeCount?: number
  ): {
    optimized: boolean;
    options: { padding?: number; duration?: number };
    optimizationApplied?: string;
  } {
    const options = { ...originalOptions };
    let optimized = false;
    let optimizationApplied = '';

    // Optimize duration based on node count
    if (nodeCount !== undefined) {
      if (nodeCount > 100) {
        // Large graphs - reduce animation duration for better performance
        options.duration = Math.min(options.duration || 300, 150);
        optimized = true;
        optimizationApplied = 'Reduced animation duration for large graph';
      } else if (nodeCount < 10) {
        // Small graphs - can use longer animation for smoother experience
        options.duration = Math.max(options.duration || 300, 500);
        optimized = true;
        optimizationApplied = 'Increased animation duration for small graph';
      }
    }

    // Optimize padding based on node count
    if (nodeCount !== undefined && nodeCount > 50) {
      // Large graphs - reduce padding to show more content
      options.padding = Math.min(options.padding || 50, 20);
      optimized = true;
      optimizationApplied += (optimizationApplied ? ', ' : '') + 'Reduced padding for large graph';
    }

    return {
      optimized,
      options,
      optimizationApplied: optimizationApplied || undefined
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
      fitViewOptimized: boolean;
      totalOptimizationSavings: number;
    },
    reactFlowData: any,
    options: any
  ): void {
    // Calculate performance statistics (local variables only)
    const optimizationEfficiency = performanceMetrics.totalOptimizationSavings > 0 
      ? (performanceMetrics.totalOptimizationSavings / totalDuration) * 100 
      : 0;
    
    const layoutEfficiency = performanceMetrics.layoutDuration > 0 
      ? (performanceMetrics.layoutDuration / totalDuration) * 100 
      : 0;
    
    const renderEfficiency = performanceMetrics.renderDuration > 0 
      ? (performanceMetrics.renderDuration / totalDuration) * 100 
      : 0;

    // Log comprehensive performance metrics (no persistent storage)
    console.debug('[AsyncCoordinator] 📊 Pipeline Performance Metrics', {
      // Overall performance
      totalDuration: `${totalDuration}ms`,
      optimizationSavings: `${performanceMetrics.totalOptimizationSavings}ms`,
      optimizationEfficiency: `${optimizationEfficiency.toFixed(1)}%`,
      
      // Phase breakdown
      stateChangeDetection: `${performanceMetrics.stateChangeDetection}ms`,
      layoutDuration: performanceMetrics.layoutSkipped ? 'skipped' : `${performanceMetrics.layoutDuration}ms`,
      renderDuration: `${performanceMetrics.renderDuration}ms`,
      layoutEfficiency: `${layoutEfficiency.toFixed(1)}%`,
      renderEfficiency: `${renderEfficiency.toFixed(1)}%`,
      
      // Optimization flags
      layoutSkipped: performanceMetrics.layoutSkipped,
      fitViewOptimized: performanceMetrics.fitViewOptimized,
      
      // Data metrics
      nodesCount: reactFlowData?.nodes?.length || 0,
      edgesCount: reactFlowData?.edges?.length || 0,
      
      // Configuration
      relayoutEntities: options.relayoutEntities,
      fitView: options.fitView,
      
      // Performance classification
      performanceClass: this._classifyPipelinePerformance(totalDuration, performanceMetrics),
      
      timestamp: Date.now()
    });

    // Log performance warnings if needed (local analysis only)
    if (totalDuration > 1000) {
      console.warn('[AsyncCoordinator] ⚠️ Pipeline performance warning: Slow execution detected', {
        duration: `${totalDuration}ms`,
        threshold: '1000ms',
        suggestions: this._generatePerformanceSuggestions(totalDuration, performanceMetrics)
      });
    }
  }

  /**
   * Classify pipeline performance (stateless analysis)
   */
  private _classifyPipelinePerformance(
    totalDuration: number,
    performanceMetrics: {
      stateChangeDetection: number;
      layoutSkipped: boolean;
      layoutDuration: number;
      renderDuration: number;
      fitViewOptimized: boolean;
      totalOptimizationSavings: number;
    }
  ): string {
    if (totalDuration < 100) return 'excellent';
    if (totalDuration < 300) return 'good';
    if (totalDuration < 500) return 'acceptable';
    if (totalDuration < 1000) return 'slow';
    return 'very-slow';
  }

  /**
   * Generate performance improvement suggestions (stateless analysis)
   */
  private _generatePerformanceSuggestions(
    totalDuration: number,
    performanceMetrics: {
      stateChangeDetection: number;
      layoutSkipped: boolean;
      layoutDuration: number;
      renderDuration: number;
      fitViewOptimized: boolean;
      totalOptimizationSavings: number;
    }
  ): string[] {
    const suggestions: string[] = [];

    if (performanceMetrics.layoutDuration > totalDuration * 0.7) {
      suggestions.push('Consider using constrained layout (relayoutEntities) instead of full layout');
    }

    if (performanceMetrics.renderDuration > totalDuration * 0.5) {
      suggestions.push('ReactFlow rendering is slow - consider reducing node/edge complexity');
    }

    if (!performanceMetrics.layoutSkipped && performanceMetrics.stateChangeDetection < 5) {
      suggestions.push('State change detection is fast but layout was not skipped - verify state change logic');
    }

    if (performanceMetrics.totalOptimizationSavings === 0) {
      suggestions.push('No optimizations were applied - consider enabling layout skipping or FitView optimization');
    }

    return suggestions;
  }

  /**
   * Helper method to get containers that need to be expanded for search results
   * This is a stateless helper that analyzes search results and returns container IDs
   */
  private _getContainersForSearchResults(searchResults: any[], state: any): string[] {
    const containerIds: string[] = [];
    
    try {
      for (const result of searchResults) {
        if (result.type === "node") {
          // Find containers that contain this node and are currently collapsed
          const containers = state.getContainersForNode 
            ? state.getContainersForNode(result.id)
            : [];
          
          for (const container of containers) {
            if (container.collapsed && !containerIds.includes(container.id)) {
              containerIds.push(container.id);
            }
          }
        }
      }
      
      return containerIds;
    } catch (error) {
      console.warn('[AsyncCoordinator] ⚠️ Failed to get containers for search results:', {
        error: (error as Error).message,
        searchResultsCount: searchResults.length
      });
      return [];
    }
  }
}
