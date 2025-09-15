/**
 * @fileoverview Global ReactFlow Operation Manager
 * 
 * This module provides comprehensive control over all ReactFlow operations to prevent
 * ResizeObserver loops. It acts as a global interposition layer that:
 * 
 * 1. Batches all ReactFlow state updates using requestAnimationFrame
 * 2. Throttles rapid-fire operations to prevent DOM cascades
 * 3. Coordinates with the global layout lock for operation serialization
 * 4. Provides circuit breaker protection for excessive operations
 * 5. Enables/disables operations globally for emergency situations
 * 
 * USAGE:
 * - Replace direct setReactFlowData calls with manager.setReactFlowData()
 * - Replace direct fitView calls with manager.fitView()
 * - Use manager.withProtection() for any DOM-affecting operations
 */

import { globalLayoutLock } from './globalLayoutLock';
import { hscopeLogger } from './logger';

export interface ReactFlowData {
    nodes: any[];
    edges: any[];
}

export interface ReactFlowOperationBase {
    id: string;
    timestamp: number;
    priority: 'high' | 'normal' | 'low';
    reason?: string;
}

export interface SetDataOperation extends ReactFlowOperationBase {
    type: 'setReactFlowData';
    operation: () => void;
}

export interface FitViewOperation extends ReactFlowOperationBase {
    type: 'fitView';
    operation: () => void;
}

export interface SearchUpdateOperation extends ReactFlowOperationBase {
    type: 'searchUpdate';
    operation: () => void;
}

export interface StyleChangeOperation extends ReactFlowOperationBase {
    type: 'styleChange';
    operation: () => void;
}

export interface DataTransformOperation extends ReactFlowOperationBase {
    type: 'dataTransform';
    transformFn: (current: ReactFlowData) => ReactFlowData;
    getCurrentData: () => ReactFlowData | null;
    setter: (data: ReactFlowData) => void;
}

export type ReactFlowOperation =
    | SetDataOperation
    | FitViewOperation
    | SearchUpdateOperation
    | StyleChangeOperation
    | DataTransformOperation;

interface OperationStats {
    total: number;
    inLastSecond: number;
    lastReset: number;
    circuitBreakerTripped: boolean;
    lastOperation: number;
}

class GlobalReactFlowOperationManager {
    private static instance: GlobalReactFlowOperationManager | null = null;

    // Operation queue and batching
    private operationQueue: ReactFlowOperation[] = [];
    private batchTimeoutId: number | NodeJS.Timeout | null = null;
    private isProcessingBatch = false;
    private lastDataMutationTime = 0;
    private autoFitTimer: number | NodeJS.Timeout | null = null;
    private pendingAutoFit: { fitFn: (opts?: any) => void; options: any; reason?: string } | null = null;

    // Throttling and circuit breaker
    private operationStats: OperationStats = {
        total: 0,
        inLastSecond: 0,
        lastReset: Date.now(),
        circuitBreakerTripped: false,
        lastOperation: 0,
    };

    // Configuration
    private readonly config = {
        batchDelayMs: 16, // ~60fps batching
        throttleMinInterval: 50, // Minimum 50ms between operations
        circuitBreakerLimit: 20, // Max 20 operations per second
        circuitBreakerResetMs: 1000, // Reset circuit breaker after 1 second
        emergencyDisabled: false, // Emergency disable all operations
        fitViewMinIntervalMs: 300, // Debounce fitView
        autoFitDelayMs: 240, // Delay after last data mutation before performing auto-fit
    };

    // Operation tracking
    private activeOperations = new Map<string, boolean>();

    private constructor() {
    hscopeLogger.log('op', 'opManager init');

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

    public static getInstance(): GlobalReactFlowOperationManager {
        if (!GlobalReactFlowOperationManager.instance) {
            GlobalReactFlowOperationManager.instance = new GlobalReactFlowOperationManager();
        }
        return GlobalReactFlowOperationManager.instance;
    }

    /**
     * Queue a ReactFlow operation for batched execution
     */
    private lastFitViewTime = 0;

    private queueOperation(
        operation: (
            | Omit<SetDataOperation, 'id' | 'timestamp' | 'priority'>
            | Omit<FitViewOperation, 'id' | 'timestamp' | 'priority'>
            | Omit<SearchUpdateOperation, 'id' | 'timestamp' | 'priority'>
            | Omit<StyleChangeOperation, 'id' | 'timestamp' | 'priority'>
            | Omit<DataTransformOperation, 'id' | 'timestamp' | 'priority'>
        ) & { priority?: 'high' | 'normal' | 'low' }
    ): string {
        if (this.config.emergencyDisabled) {
            hscopeLogger.warn('op', 'operations disabled');
            return '';
        }

        const now = Date.now();

        // Update stats
        this.operationStats.total++;
        this.operationStats.inLastSecond++;
        this.operationStats.lastOperation = now;

        // Check circuit breaker
        if (this.operationStats.inLastSecond > this.config.circuitBreakerLimit) {
            if (!this.operationStats.circuitBreakerTripped) {
                this.operationStats.circuitBreakerTripped = true;
                hscopeLogger.warn('op', `circuit breaker tripped count=${this.operationStats.inLastSecond}`);
            }
            return '';
        }

        // Check throttling
        if (now - this.operationStats.lastOperation < this.config.throttleMinInterval) {
            // keep silent to avoid spam; throttling implicit
        }

        const operationId = `${operation.type}-${now}-${Math.random().toString(36).substr(2, 9)}`;

        const queuedOperation: ReactFlowOperation = {
            id: operationId,
            timestamp: now,
            priority: operation.priority || 'normal',
            ...(operation as any),
        };

        // For dataTransform we accumulate; otherwise collapse duplicates
        if (operation.type !== 'dataTransform') {
            this.operationQueue = this.operationQueue.filter(op => op.type !== operation.type);
        }

        // Add new operation
        this.operationQueue.push(queuedOperation);

        // Sort by priority and timestamp
        this.operationQueue.sort((a, b) => {
            const priorityWeight = { high: 3, normal: 2, low: 1 };
            const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.timestamp - b.timestamp;
        });

    hscopeLogger.log('op', `queue ${operation.type} id=${operationId} size=${this.operationQueue.length}`);

        // Schedule batch processing
        this.scheduleBatchProcessing();

        return operationId;
    }

    /**
     * Schedule batch processing using requestAnimationFrame
     */
    private scheduleBatchProcessing(): void {
        if (this.batchTimeoutId !== null) {
            return; // Already scheduled
        }

        // Use requestAnimationFrame if available, otherwise use setTimeout
        const scheduleFunction = typeof window !== 'undefined' && window.requestAnimationFrame
            ? window.requestAnimationFrame.bind(window)
            : (callback: () => void) => setTimeout(callback, 16); // ~60fps fallback

        this.batchTimeoutId = scheduleFunction(() => {
            this.batchTimeoutId = null;
            this.processBatch();
        });
    }

    /**
     * Process all queued operations in a single frame
     */
    private async processBatch(): Promise<void> {
        if (this.isProcessingBatch || this.operationQueue.length === 0) {
            return;
        }

        this.isProcessingBatch = true;
        const batchId = `batch-${Date.now()}`;

        try {
            const opSummary = this.operationQueue.map(o => o.type).join(', ');
            hscopeLogger.log('op', `process batch id=${batchId} size=${this.operationQueue.length} ops=[${opSummary}]`);

            // Take all operations from queue
            const operations = [...this.operationQueue];
            this.operationQueue = [];

            // Group operations by type for optimal batching
            const groupedOps = operations.reduce((groups, op) => {
                if (!groups[op.type]) groups[op.type] = [];
                groups[op.type].push(op);
                return groups;
            }, {} as Record<string, ReactFlowOperation[]>);

            // Process operations in optimal order
            const processingOrder: Array<ReactFlowOperation['type']> = ['dataTransform', 'setReactFlowData', 'searchUpdate', 'styleChange', 'fitView'];

            // Aggregate data transforms first
            const dataTransforms = groupedOps['dataTransform'] as DataTransformOperation[] | undefined;
            if (dataTransforms && dataTransforms.length) {
                const first = dataTransforms[0];
                let base = first.getCurrentData();
                if (base) {
                    const preNodeCount = base.nodes.length;
                    const preEdgeCount = base.edges.length;
                    for (const t of dataTransforms) {
                        try {
                            base = t.transformFn(base!);
                        } catch (e) {
                            console.error('[ReactFlowOperationManager] ❌ Data transform failed', e, t.reason);
                        }
                    }
                    if (base) {
                        try {
                            first.setter(base);
                            hscopeLogger.log('layout', `agg transforms count=${dataTransforms.length} nodes ${preNodeCount}->${base.nodes.length} edges ${preEdgeCount}->${base.edges.length}`);
                            this.lastDataMutationTime = Date.now();
                            this.scheduleAutoFitIfPending();
                        } catch (e) {
                            console.error('[ReactFlowOperationManager] ❌ Error applying aggregated data transform set', e);
                        }
                    }
                }
            }

            for (const opType of processingOrder.filter(t => t !== 'dataTransform')) {
                const ops = groupedOps[opType];
                if (!ops || ops.length === 0) continue;
                const opToProcess = ops[ops.length - 1];
                try {
                    hscopeLogger.log('op', `exec ${opToProcess.type} id=${opToProcess.id}`);
                    this.activeOperations.set(opToProcess.id, true);
                    await (opToProcess as any).operation();
                    hscopeLogger.log('op', `done ${opToProcess.type} id=${opToProcess.id}`);
                    if (opType === 'setReactFlowData') {
                        this.lastDataMutationTime = Date.now();
                        this.scheduleAutoFitIfPending();
                    }
                } catch (error) {
                    console.error(`[ReactFlowOperationManager] ❌ Error executing ${opToProcess.type}: ${opToProcess.id}`, error);
                } finally {
                    this.activeOperations.delete(opToProcess.id);
                }
            }

            hscopeLogger.log('op', `batch complete id=${batchId}`);

        } catch (error) {
            console.error(`[ReactFlowOperationManager] ❌ Batch processing error:`, error);
        } finally {
            this.isProcessingBatch = false;

            // If more operations were queued during processing, schedule another batch
            if (this.operationQueue.length > 0) {
                this.scheduleBatchProcessing();
            }
        }
    }

    /**
     * Safely execute a ReactFlow state update with full protection
     */
    public setReactFlowData(
        setter: (data: ReactFlowData | null) => void,
        data: ReactFlowData | null,
        layoutId: string,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): string {
        return this.queueOperation({
            type: 'setReactFlowData',
            priority,
            operation: () => {
                hscopeLogger.log('layout', `setData op layout=${layoutId}`);
                setter(data);
            },
        });
    }

    /**
     * Queue a data transformation that will be aggregated with others in the same frame.
     */
    public queueDataTransform(
        getCurrentData: () => ReactFlowData | null,
        transformFn: (data: ReactFlowData) => ReactFlowData,
        setter: (data: ReactFlowData) => void,
        reason?: string,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): string {
        return this.queueOperation({
            type: 'dataTransform',
            priority,
            transformFn,
            getCurrentData,
            setter,
            reason,
        });
    }

    /**
     * Safely execute a fitView operation with full protection
     */
    public fitView(
        fitViewFn: (options?: any) => void,
        options?: any,
        priority: 'high' | 'normal' | 'low' = 'low'
    ): string {
        const now = performance.now();
        if (now - this.lastFitViewTime < this.config.fitViewMinIntervalMs) {
            return '';
        }
        this.lastFitViewTime = now;
        return this.queueOperation({
            type: 'fitView',
            priority,
            operation: () => {
                hscopeLogger.log('fit', 'fitView exec');
                fitViewFn(options);
            },
        });
    }

    /**
     * Request an auto-fit that will occur only after data mutations settle.
     * If called repeatedly during rapid data changes, only the last will execute.
     */
    public requestAutoFit(fitFn: (opts?: any) => void, options?: any, reason?: string) {
        this.pendingAutoFit = { fitFn, options, reason };
        this.scheduleAutoFitIfPending();
    }

    private scheduleAutoFitIfPending() {
        if (!this.pendingAutoFit) return;
        const now = Date.now();
        const elapsed = now - this.lastDataMutationTime;
        if (this.autoFitTimer) {
            clearTimeout(this.autoFitTimer as any);
            this.autoFitTimer = null;
        }
        const remaining = Math.max(this.config.autoFitDelayMs - elapsed, 0);
        this.autoFitTimer = setTimeout(() => {
            if (!this.pendingAutoFit) return;
            const { fitFn, options, reason } = this.pendingAutoFit;
            this.pendingAutoFit = null;
            hscopeLogger.log('fit', `auto-fit deferred reason=${reason || 'unspecified'}`);
            this.fitView(fitFn, options, 'low');
        }, remaining);
    }

    /**
     * Safely execute a search update operation
     */
    public updateSearchHighlighting(
        updateFn: () => void,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): string {
        return this.queueOperation({
            type: 'searchUpdate',
            priority,
            operation: () => {
                hscopeLogger.log('op', 'search update');
                updateFn();
            },
        });
    }

    /**
     * Safely execute a style change operation
     */
    public updateStyles(
        updateFn: () => void,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): string {
        return this.queueOperation({
            type: 'styleChange',
            priority,
            operation: () => {
                hscopeLogger.log('op', 'style update');
                updateFn();
            },
        });
    }

    /**
     * Wrap any operation with full ResizeObserver protection
     */
    public async withProtection<T>(
        operationType: string,
        operation: () => T | Promise<T>,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const operationId = this.queueOperation({
                type: operationType as any,
                priority,
                operation: async () => {
                    try {
                        const result = await operation();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                },
            });

            if (!operationId) {
                reject(new Error('Operation was blocked (emergency disabled or circuit breaker)'));
            }
        });
    }

    /**
     * Emergency disable all operations (for critical situations)
     */
    public emergencyDisable(): void {
        this.config.emergencyDisabled = true;
        this.operationQueue = [];
        if (this.batchTimeoutId !== null) {
            // Handle both requestAnimationFrame (number) and setTimeout (Timeout)
            if (typeof this.batchTimeoutId === 'number' && typeof window !== 'undefined') {
                window.cancelAnimationFrame(this.batchTimeoutId);
            } else {
                clearTimeout(this.batchTimeoutId as NodeJS.Timeout);
            }
            this.batchTimeoutId = null;
        }
    hscopeLogger.warn('op', 'emergency disable all ops');
    }

    /**
     * Re-enable operations after emergency disable
     */
    public emergencyEnable(): void {
        this.config.emergencyDisabled = false;
        this.operationStats.circuitBreakerTripped = false;
    hscopeLogger.log('op', 'operations enabled');
    }

    /**
     * Get current operation statistics
     */
    public getStats(): OperationStats & { queueLength: number; isProcessing: boolean } {
        return {
            ...this.operationStats,
            queueLength: this.operationQueue.length,
            isProcessing: this.isProcessingBatch,
        };
    }

    /**
     * Clear all queued operations
     */
    public clearQueue(): void {
        this.operationQueue = [];
    hscopeLogger.log('op', 'queue cleared');
    }

    /**
     * Reset circuit breaker and operation stats (for testing)
     */
    public resetStats(): void {
        this.operationStats = {
            total: 0,
            inLastSecond: 0,
            lastReset: Date.now(),
            circuitBreakerTripped: false,
            lastOperation: 0,
        };
    hscopeLogger.log('op', 'stats reset');
    }
}

// Export singleton instance
export const globalReactFlowOperationManager = GlobalReactFlowOperationManager.getInstance();
