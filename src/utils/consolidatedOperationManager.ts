/**
 * @fileoverview Consolidated Operation Manager
 *
 * This replaces both GlobalLayoutLock and GlobalReactFlowOperationManager with a unified system that:
 * 1. Coordinates all layout and ReactFlow operations
 * 2. Prevents ResizeObserver loops through proper batching
 * 3. Ensures autofit happens at the right time after layout changes
 * 4. Provides clear operation lifecycle hooks
 */

import { hscopeLogger } from './logger';

export interface ReactFlowData {
  nodes: any[];
  edges: any[];
}

export interface OperationBase {
  id: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  reason?: string;
  type: 'layout' | 'reactflow-update' | 'search-expansion' | 'container-toggle' | 'style-change';
}

export interface LayoutOperation extends OperationBase {
  type: 'layout';
  operation: () => Promise<void>;
  triggerAutoFit?: boolean; // Whether to trigger autofit after completion
}

export interface ReactFlowUpdateOperation extends OperationBase {
  type: 'reactflow-update';
  operation: () => void;
}

export interface SearchExpansionOperation extends OperationBase {
  type: 'search-expansion';
  operation: () => Promise<void>;
  triggerAutoFit: true; // Search expansions always need autofit
}

export interface ContainerToggleOperation extends OperationBase {
  type: 'container-toggle';
  operation: () => Promise<void>;
  triggerAutoFit: true; // Container toggles always need autofit
}

export interface StyleChangeOperation extends OperationBase {
  type: 'style-change';
  operation: () => void;
  triggerAutoFit?: boolean;
}

export type Operation =
  | LayoutOperation
  | ReactFlowUpdateOperation
  | SearchExpansionOperation
  | ContainerToggleOperation
  | StyleChangeOperation;

interface OperationStats {
  total: number;
  inLastSecond: number;
  lastReset: number;
  circuitBreakerTripped: boolean;
  lastOperation: number;
}

interface AutoFitRequest {
  fitFn: (opts?: any) => void;
  options?: any;
  reason: string;
  timestamp: number;
}

class ConsolidatedOperationManager {
  private static instance: ConsolidatedOperationManager | null = null;

  // Operation queue and processing
  private operationQueue: Operation[] = [];
  private isProcessingQueue = false;
  private currentOperation: Operation | null = null;

  // Search expansion exclusivity
  private isSearchExpansionActive = false;

  // Batching for ReactFlow operations
  private batchTimeoutId: number | NodeJS.Timeout | null = null;
  private pendingReactFlowOps: ReactFlowUpdateOperation[] = [];

  // AutoFit coordination
  private pendingAutoFit: AutoFitRequest | null = null;
  private autoFitTimer: number | NodeJS.Timeout | null = null;
  private lastDataMutationTime = 0;

  // ReactFlow acknowledgment coordination
  private reactFlowAcknowledgmentCallbacks: (() => void)[] = [];

  // Circuit breaker and throttling
  private operationStats: OperationStats = {
    total: 0,
    inLastSecond: 0,
    lastReset: Date.now(),
    circuitBreakerTripped: false,
    lastOperation: 0,
  };

  // Configuration
  private readonly config = {
    batchDelayMs: 16, // ~60fps batching for ReactFlow ops
    throttleMinInterval: 50, // Minimum interval between operations
    circuitBreakerLimit: 30, // Max operations per second
    circuitBreakerResetMs: 1000,
    autoFitDelayMs: 500, // Delay after layout before autofit (increased for ReactFlow stability)
    maxLockDuration: 10000, // Max time for any single operation
  };

  private constructor() {
    hscopeLogger.log('op', 'ConsolidatedOperationManager initialized');

    // Reset stats periodically
    setInterval(() => {
      const now = Date.now();
      if (now - this.operationStats.lastReset > this.config.circuitBreakerResetMs) {
        this.operationStats.inLastSecond = 0;
        this.operationStats.lastReset = now;
        if (this.operationStats.circuitBreakerTripped) {
          this.operationStats.circuitBreakerTripped = false;
          hscopeLogger.log('op', 'circuit breaker reset');
        }
      }
    }, this.config.circuitBreakerResetMs);
  }

  public static getInstance(): ConsolidatedOperationManager {
    if (!ConsolidatedOperationManager.instance) {
      ConsolidatedOperationManager.instance = new ConsolidatedOperationManager();
    }
    return ConsolidatedOperationManager.instance;
  }

  /**
   * Queue a layout operation (ELK layout, container operations, etc.)
   */
  public async queueLayoutOperation(
    operationId: string,
    callback: () => Promise<void>,
    options: {
      priority?: 'high' | 'normal' | 'low';
      reason?: string;
      triggerAutoFit?: boolean;
      force?: boolean;
    } = {}
  ): Promise<boolean> {
    // CRITICAL: If we're already inside an operation, execute immediately to maintain atomicity
    // This prevents double-queuing which breaks the atomic nature of search expansion
    if (this.isInsideOperation()) {
      // CIRCUIT BREAKER: Prevent infinite recursion by limiting nested layout operations
      const currentOpType = this.currentOperation?.type;
      if (currentOpType === 'search-expansion' || currentOpType === 'container-toggle') {
        hscopeLogger.log('op', `executing immediately (inside ${currentOpType}) ${operationId}`);
        try {
          await callback();
          hscopeLogger.log('op', `completed immediately ${operationId}`);
          return true;
        } catch (error) {
          console.error(
            `[ConsolidatedOperationManager] Error executing immediate operation ${operationId}:`,
            error
          );
          return false;
        }
      } else {
        // Prevent infinite recursion - don't execute layout inside layout
        console.warn(
          `[ConsolidatedOperationManager] Preventing recursive layout operation ${operationId} inside ${currentOpType}`
        );
        return false;
      }
    }

    const operation: LayoutOperation = {
      id: operationId,
      type: 'layout',
      timestamp: Date.now(),
      priority: options.priority || 'normal',
      reason: options.reason,
      operation: callback,
      triggerAutoFit: options.triggerAutoFit ?? true, // Default to true for layout ops
    };

    return this.queueOperation(operation, options.force);
  }

  /**
   * Queue a ReactFlow data update
   */
  public queueReactFlowUpdate(
    setter: (data: ReactFlowData | null) => void,
    data: ReactFlowData | null,
    layoutId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const operation: ReactFlowUpdateOperation = {
      id: `reactflow-${layoutId}-${Date.now()}`,
      type: 'reactflow-update',
      timestamp: Date.now(),
      priority,
      reason: `ReactFlow update for ${layoutId}`,
      operation: () => {
        hscopeLogger.log('layout', `setData op layout=${layoutId}`);
        setter(data);
        this.lastDataMutationTime = Date.now();
      },
    };

    this.queueOperation(operation);
    return operation.id;
  }

  /**
   * Queue a search expansion operation
   */
  public async queueSearchExpansion(
    operationId: string,
    callback: () => Promise<void>,
    priority: 'high' | 'normal' | 'low' = 'high'
  ): Promise<boolean> {
    const operation: SearchExpansionOperation = {
      id: operationId,
      type: 'search-expansion',
      timestamp: Date.now(),
      priority,
      reason: 'Search expansion',
      operation: callback,
      triggerAutoFit: true,
    };

    return this.queueOperation(operation);
  }

  /**
   * Queue a container toggle operation
   */
  public async queueContainerToggle(
    operationId: string,
    callback: () => Promise<void>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<boolean> {
    const operation: ContainerToggleOperation = {
      id: operationId,
      type: 'container-toggle',
      timestamp: Date.now(),
      priority,
      reason: 'Container toggle',
      operation: callback,
      triggerAutoFit: true,
    };

    return this.queueOperation(operation);
  }

  /**
   * Request autofit (will be executed after current operations complete)
   */
  public requestAutoFit(
    fitFn: (opts?: any) => void,
    options?: any,
    reason: string = 'manual-request'
  ): void {
    this.pendingAutoFit = {
      fitFn,
      options,
      reason,
      timestamp: Date.now(),
    };

    this.scheduleAutoFitIfPending();
  }

  /**
   * Core operation queuing logic
   */
  private async queueOperation(operation: Operation, force: boolean = false): Promise<boolean> {
    if (this.operationStats.circuitBreakerTripped && !force) {
      hscopeLogger.warn('op', `operation blocked by circuit breaker: ${operation.id}`);
      return false;
    }

    // CRITICAL: Block non-search operations during search expansion
    if (this.isSearchExpansionActive && operation.type !== 'search-expansion' && !force) {
      hscopeLogger.log('op', `operation blocked by active search expansion: ${operation.id}`);
      return false;
    }

    // Update stats
    this.operationStats.total++;
    this.operationStats.inLastSecond++;
    this.operationStats.lastOperation = Date.now();

    // Check circuit breaker
    if (this.operationStats.inLastSecond > this.config.circuitBreakerLimit) {
      this.operationStats.circuitBreakerTripped = true;
      hscopeLogger.warn(
        'op',
        `circuit breaker tripped: ${this.operationStats.inLastSecond} ops/sec`
      );
      return false;
    }

    // For ReactFlow updates, use batching
    if (operation.type === 'reactflow-update') {
      this.pendingReactFlowOps.push(operation as ReactFlowUpdateOperation);
      this.scheduleBatchProcessing();
      return true;
    }

    // For other operations, add to main queue
    this.operationQueue.push(operation);
    this.sortQueue();

    hscopeLogger.log(
      'op',
      `queued ${operation.type} id=${operation.id} queue=${this.operationQueue.length}`
    );

    this.processQueue();
    return true;
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue(): void {
    this.operationQueue.sort((a, b) => {
      const priorityWeight = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process the main operation queue
   */
  private async processQueue(): Promise<void> {
    const initialQueueLength = this.operationQueue.length;
    const initialIsProcessing = this.isProcessingQueue;

    console.error(
      `[ConsolidatedOperationManager] processQueue called: isProcessing=${initialIsProcessing}, queueLength=${initialQueueLength}`
    );
    console.error(
      `[ConsolidatedOperationManager] queue contents:`,
      this.operationQueue.map(op => `${op.type}:${op.id}`)
    );

    if (initialIsProcessing) {
      console.error(`[ConsolidatedOperationManager] processQueue early return: already processing`);
      return;
    }

    if (initialQueueLength === 0) {
      console.error(`[ConsolidatedOperationManager] processQueue early return: queue empty`);
      return;
    }

    // Double-check queue length after logging
    const currentQueueLength = this.operationQueue.length;
    if (currentQueueLength === 0) {
      console.error(
        `[ConsolidatedOperationManager] RACE CONDITION: queue was ${initialQueueLength} but now ${currentQueueLength}`
      );
      return;
    }

    this.isProcessingQueue = true;
    console.error(
      `[ConsolidatedOperationManager] processQueue starting with ${this.operationQueue.length} operations`
    );

    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift()!;
        this.currentOperation = operation;

        console.error(
          `[ConsolidatedOperationManager] executing ${operation.type} id=${operation.id}`
        );
        hscopeLogger.log('op', `executing ${operation.type} id=${operation.id}`);

        try {
          if (operation.type === 'search-expansion') {
            // CRITICAL: Set search expansion flag to block other operations
            this.isSearchExpansionActive = true;
            try {
              await (operation as SearchExpansionOperation).operation();
            } finally {
              // Always clear the flag, even if operation fails
              this.isSearchExpansionActive = false;
            }

            // Trigger autofit if requested
            if ('triggerAutoFit' in operation && operation.triggerAutoFit) {
              this.scheduleAutoFitIfPending();
            }
          } else if (operation.type === 'layout' || operation.type === 'container-toggle') {
            await (operation as LayoutOperation).operation();

            // Trigger autofit if requested
            if ('triggerAutoFit' in operation && operation.triggerAutoFit) {
              this.scheduleAutoFitIfPending();
            }
          } else if (operation.type === 'style-change') {
            (operation as StyleChangeOperation).operation();

            if ('triggerAutoFit' in operation && operation.triggerAutoFit) {
              this.scheduleAutoFitIfPending();
            }
          }

          console.error(
            `[ConsolidatedOperationManager] completed ${operation.type} id=${operation.id}`
          );
          hscopeLogger.log('op', `completed ${operation.type} id=${operation.id}`);
        } catch (error) {
          console.error(`[ConsolidatedOperationManager] Error executing ${operation.type}:`, error);
        }

        this.currentOperation = null;
      }
      console.error(
        `[ConsolidatedOperationManager] processQueue finished, queue now has ${this.operationQueue.length} operations`
      );
    } finally {
      this.isProcessingQueue = false;
      console.error(
        `[ConsolidatedOperationManager] processQueue finally block, isProcessingQueue set to false`
      );
    }
  }

  /**
   * Schedule batched processing of ReactFlow operations
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimeoutId !== null) {
      return;
    }

    const scheduleFunction =
      typeof window !== 'undefined' && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (callback: () => void) => setTimeout(callback, this.config.batchDelayMs);

    this.batchTimeoutId = scheduleFunction(() => {
      this.batchTimeoutId = null;
      this.processBatchedReactFlowOps();
    });
  }

  /**
   * Process batched ReactFlow operations
   */
  private processBatchedReactFlowOps(): void {
    if (this.pendingReactFlowOps.length === 0) {
      return;
    }

    const ops = [...this.pendingReactFlowOps];
    this.pendingReactFlowOps = [];

    hscopeLogger.log('op', `processing ReactFlow batch size=${ops.length}`);

    // Execute all batched operations
    for (const op of ops) {
      try {
        op.operation();
      } catch (error) {
        console.error(`[ConsolidatedOperationManager] Error in batched ReactFlow op:`, error);
      }
    }

    // CRITICAL: Wait for ReactFlow to process the data before acknowledging
    // Use multiple animation frames and a timeout to ensure ReactFlow has had time to initialize nodes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Add an additional timeout to give ReactFlow more time to measure nodes
        setTimeout(() => {
          // Execute all pending acknowledgment callbacks
          const callbacks = [...this.reactFlowAcknowledgmentCallbacks];
          this.reactFlowAcknowledgmentCallbacks = [];

          for (const callback of callbacks) {
            try {
              callback();
            } catch (error) {
              console.error(
                '[ConsolidatedOperationManager] Error in ReactFlow acknowledgment callback:',
                error
              );
            }
          }
        }, 50); // Additional 50ms delay for ReactFlow node measurement
      });
    });

    // Schedule autofit after ReactFlow updates
    this.scheduleAutoFitIfPending();
  }

  /**
   * Wait for ReactFlow to acknowledge data processing
   */
  private waitForReactFlowAcknowledgment(): Promise<void> {
    return new Promise(resolve => {
      // If there are no pending ReactFlow operations, resolve immediately
      if (this.pendingReactFlowOps.length === 0) {
        resolve();
        return;
      }

      // Add callback to be executed after ReactFlow batch processing
      this.reactFlowAcknowledgmentCallbacks.push(resolve);
    });
  }

  /**
   * Schedule autofit if there's a pending request
   */
  private scheduleAutoFitIfPending(): void {
    if (!this.pendingAutoFit) return;

    if (this.autoFitTimer) {
      clearTimeout(this.autoFitTimer as any);
    }

    const now = Date.now();
    const elapsed = now - this.lastDataMutationTime;
    const remaining = Math.max(this.config.autoFitDelayMs - elapsed, 0);

    this.autoFitTimer = setTimeout(async () => {
      if (!this.pendingAutoFit) return;

      const { fitFn, options, reason } = this.pendingAutoFit;
      this.pendingAutoFit = null;

      // CRITICAL: Wait for ReactFlow to process data before autofit
      // This prevents "measured" property errors
      await this.waitForReactFlowAcknowledgment();

      hscopeLogger.log('fit', `executing autofit reason=${reason}`);

      try {
        fitFn(options);
      } catch (error) {
        // CRITICAL FIX: Handle ReactFlow measurement errors gracefully
        if (error instanceof Error && error.message.includes('measured')) {
          console.warn(
            '[ConsolidatedOperationManager] AutoFit failed due to ReactFlow measurement issue, retrying in 100ms:',
            error.message
          );
          // Retry after a short delay to allow ReactFlow to initialize
          setTimeout(() => {
            try {
              fitFn(options);
            } catch (retryError) {
              console.error(
                '[ConsolidatedOperationManager] AutoFit retry also failed:',
                retryError
              );
            }
          }, 100);
        } else {
          console.error('[ConsolidatedOperationManager] AutoFit failed:', error);
        }
      }
    }, remaining);
  }

  /**
   * Get current operation status
   */
  public getStatus() {
    return {
      isProcessing: this.isProcessingQueue,
      currentOperation: this.currentOperation?.id || null,
      queueLength: this.operationQueue.length,
      pendingReactFlowOps: this.pendingReactFlowOps.length,
      pendingAutoFit: !!this.pendingAutoFit,
      stats: { ...this.operationStats },
    };
  }

  /**
   * Check if we're currently inside an operation (to avoid double-queuing)
   */
  public isInsideOperation(): boolean {
    return this.currentOperation !== null;
  }

  /**
   * Emergency disable (for testing/debugging)
   */
  public emergencyStop(): void {
    this.operationQueue = [];
    this.pendingReactFlowOps = [];
    this.isProcessingQueue = false;
    this.currentOperation = null;

    if (this.batchTimeoutId) {
      if (typeof this.batchTimeoutId === 'number' && typeof window !== 'undefined') {
        window.cancelAnimationFrame(this.batchTimeoutId);
      } else {
        clearTimeout(this.batchTimeoutId as NodeJS.Timeout);
      }
      this.batchTimeoutId = null;
    }

    if (this.autoFitTimer) {
      clearTimeout(this.autoFitTimer as any);
      this.autoFitTimer = null;
    }

    hscopeLogger.warn('op', 'emergency stop - all operations cleared');
  }

  /**
   * Clear all operations (for testing)
   */
  public clearAll(): void {
    this.emergencyStop();
    this.operationStats = {
      total: 0,
      inLastSecond: 0,
      lastReset: Date.now(),
      circuitBreakerTripped: false,
      lastOperation: 0,
    };
  }
}

// Export singleton instance
export const consolidatedOperationManager = ConsolidatedOperationManager.getInstance();
