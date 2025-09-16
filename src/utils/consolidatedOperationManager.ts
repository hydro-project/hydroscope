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
    
    // Batching for ReactFlow operations
    private batchTimeoutId: number | NodeJS.Timeout | null = null;
    private pendingReactFlowOps: ReactFlowUpdateOperation[] = [];
    
    // AutoFit coordination
    private pendingAutoFit: AutoFitRequest | null = null;
    private autoFitTimer: number | NodeJS.Timeout | null = null;
    private lastDataMutationTime = 0;
    
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
        autoFitDelayMs: 300, // Delay after layout before autofit
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

        // Update stats
        this.operationStats.total++;
        this.operationStats.inLastSecond++;
        this.operationStats.lastOperation = Date.now();

        // Check circuit breaker
        if (this.operationStats.inLastSecond > this.config.circuitBreakerLimit) {
            this.operationStats.circuitBreakerTripped = true;
            hscopeLogger.warn('op', `circuit breaker tripped: ${this.operationStats.inLastSecond} ops/sec`);
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
        
        hscopeLogger.log('op', `queued ${operation.type} id=${operation.id} queue=${this.operationQueue.length}`);
        
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
        if (this.isProcessingQueue || this.operationQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.operationQueue.length > 0) {
                const operation = this.operationQueue.shift()!;
                this.currentOperation = operation;

                hscopeLogger.log('op', `executing ${operation.type} id=${operation.id}`);

                try {
                    if (operation.type === 'layout' || operation.type === 'search-expansion' || operation.type === 'container-toggle') {
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

                    hscopeLogger.log('op', `completed ${operation.type} id=${operation.id}`);
                } catch (error) {
                    console.error(`[ConsolidatedOperationManager] Error executing ${operation.type}:`, error);
                }

                this.currentOperation = null;
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Schedule batched processing of ReactFlow operations
     */
    private scheduleBatchProcessing(): void {
        if (this.batchTimeoutId !== null) {
            return;
        }

        const scheduleFunction = typeof window !== 'undefined' && window.requestAnimationFrame
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

        // Schedule autofit after ReactFlow updates
        this.scheduleAutoFitIfPending();
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

        this.autoFitTimer = setTimeout(() => {
            if (!this.pendingAutoFit) return;

            const { fitFn, options, reason } = this.pendingAutoFit;
            this.pendingAutoFit = null;

            hscopeLogger.log('fit', `executing autofit reason=${reason}`);
            
            try {
                fitFn(options);
            } catch (error) {
                console.error('[ConsolidatedOperationManager] AutoFit failed:', error);
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