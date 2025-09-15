/**
 * @fileoverview Global Layout Lock
 * 
 * Ensures only one layout operation can happen across the entire application at any time.
 * This prevents race conditions where multiple components try to trigger layouts simultaneously.
 */

import { layoutContentionMetrics } from './layoutContentionMetrics';
import { hscopeLogger } from './logger';

interface LayoutRequest {
    operationId: string;
    force: boolean;
    callback: () => Promise<void>;
    resolve: (success: boolean) => void;
    reject: (error: Error) => void;
    priority?: 'high' | 'normal' | 'low'; // For operation prioritization
    operationType?: 'layout' | 'search-expansion' | 'reactflow-update'; // For dependency management
}

class GlobalLayoutLock {
    private static instance: GlobalLayoutLock | null = null;
    private currentOperationId: string | null = null;
    private lockStartTime: number = 0;
    private readonly maxLockDuration = 10000; // 10 seconds max lock duration

    // Queue for sequential processing of layout requests
    private requestQueue: LayoutRequest[] = [];
    private isProcessingQueue = false;

    static getInstance(): GlobalLayoutLock {
        if (!GlobalLayoutLock.instance) {
            GlobalLayoutLock.instance = new GlobalLayoutLock();
        }
        return GlobalLayoutLock.instance;
    }

    /**
     * Queue a layout operation for sequential execution
     * @param operationId Unique identifier for this operation
     * @param force Whether to force acquisition (breaks existing locks)
     * @param callback The layout operation to execute
     * @returns Promise that resolves when the operation completes
     */
    async queueLayoutOperation(
        operationId: string,
        callback: () => Promise<void>,
        force: boolean = false
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const request: LayoutRequest = {
                operationId,
                force,
                callback,
                resolve,
                reject
            };

            this.requestQueue.push(request);
            hscopeLogger.log('lock', `queued ${operationId} (queue size: ${this.requestQueue.length})`);

            // Process queue immediately without batching delay
            this.processQueueSequentially();
        });
    }



    /**
     * Process queued requests sequentially without batching
     */
    private async processQueueSequentially(): Promise<void> {
        if (this.isProcessingQueue) {
            return; // Already processing
        }

        this.isProcessingQueue = true;
        hscopeLogger.log('lock', `starting queue processing with ${this.requestQueue.length} requests`);

        try {
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                if (!request) break;

                try {
                    await this.executeRequest(request);
                } catch (error) {
                    hscopeLogger.error('lock', `queue processing error for ${request.operationId}: ${error}`);
                    // Continue processing other requests even if one fails
                }
            }
        } finally {
            this.isProcessingQueue = false;
            hscopeLogger.log('lock', `queue processing completed`);
        }
    }



    /**
     * Extract operation type from operationId for better batching
     */
    private getOperationType(operationId: string): string {
        // Extract the base operation type (e.g., "selective-layout" from "selective-layout-123")
        const match = operationId.match(/^([a-zA-Z-]+)/);
        return match ? match[1] : operationId;
    }

    /**
     * Check if an operation type conflicts with layout operations
     */
    private isConflictingWithLayout(operationType: string): boolean {
        // Search expansion operations conflict with layout operations
        // because they modify VisualizationState during ELK processing
        return operationType === 'search-expansion' && this.isLayoutInProgress();
    }

    /**
     * Check if a layout operation is currently in progress
     */
    private isLayoutInProgress(): boolean {
        if (!this.currentOperationId) return false;
        const currentType = this.getOperationType(this.currentOperationId);
        return currentType === 'layout' || currentType.includes('layout');
    }

    /**
     * Execute a single layout request sequentially
     */
    private async executeRequest(request: LayoutRequest): Promise<void> {
        const requestStartTime = Date.now();

        hscopeLogger.log('lock', `executing request ${request.operationId} (force: ${request.force})`);

        try {
            // Acquire lock for this individual request
            const lockAcquired = this.acquireImmediate(request.operationId, request.force);

            if (!lockAcquired) {
                hscopeLogger.warn('lock', `request ${request.operationId} failed to acquire lock`);
                request.resolve(false);
                return;
            }

            // Execute the callback
            await request.callback();

            const requestDuration = Date.now() - requestStartTime;
            hscopeLogger.log('lock', `request ${request.operationId} completed successfully in ${requestDuration}ms`);
            request.resolve(true);

        } catch (error) {
            hscopeLogger.error('lock', `request ${request.operationId} failed: ${error}`);
            request.reject(error as Error);
        } finally {
            this.release(request.operationId);
        }
    }

    /**
     * Immediate lock acquisition (internal use)
     * @param operationId Unique identifier for this operation
     * @param force Whether to force acquisition (breaks existing locks)
     * @returns true if lock acquired, false if blocked
     */
    private acquireImmediate(operationId: string, force: boolean = false): boolean {
        const now = Date.now();

        // Check if current lock has expired
        if (this.currentOperationId && (now - this.lockStartTime) > this.maxLockDuration) {
            console.warn(`[GlobalLayoutLock] 🔓 Expired lock detected (${this.currentOperationId}), releasing automatically`);
            this.release(this.currentOperationId);
        }

        // If lock is available or force is true, acquire it
        if (!this.currentOperationId || force) {
            if (this.currentOperationId && force) {
                console.warn(`[GlobalLayoutLock] 🚨 Force-acquiring lock from ${this.currentOperationId} by ${operationId}`);
            }

            this.currentOperationId = operationId;
            this.lockStartTime = now;
            hscopeLogger.log('lock', `acquired ${operationId}`);
            layoutContentionMetrics.recordAcquire(operationId, force);
            return true;
        }

        // Lock is held by another operation
        hscopeLogger.warn('lock', `blocked ${operationId} (held by ${this.currentOperationId})`);
        layoutContentionMetrics.recordBlocked(operationId, this.currentOperationId);
        return false;
    }

    /**
     * Legacy method for backward compatibility - now queues the operation
     * @param operationId Unique identifier for this operation
     * @param force Whether to force acquisition (breaks existing locks)
     * @returns true if lock acquired, false if blocked
     */
    acquire(operationId: string, force: boolean = false): boolean {
        // For backward compatibility, we'll try immediate acquisition
        // New code should use queueLayoutOperation instead
        hscopeLogger.warn('lock', `${operationId} using deprecated acquire() - consider migrating to queueLayoutOperation()`);
        return this.acquireImmediate(operationId, force);
    }

    /**
     * Convenience method for simple layout operations that don't need complex batching
     * @param operationId Unique identifier for this operation
     * @param layoutCallback The layout operation to execute
     * @param force Whether to force acquisition (breaks existing locks)
     * @returns Promise that resolves when the operation completes
     */
    async executeLayoutOperation(
        operationId: string,
        layoutCallback: () => Promise<void>,
        force: boolean = false
    ): Promise<boolean> {
        return this.queueLayoutOperation(operationId, layoutCallback, force);
    }

    /**
     * Release the global layout lock
     * @param operationId The operation that owns the lock
     * @returns true if successfully released, false if not owned by this operation
     */
    release(operationId: string): boolean {
        if (this.currentOperationId === operationId) {
            const duration = Date.now() - this.lockStartTime;
            hscopeLogger.log('lock', `released ${operationId} hold=${duration}ms`);
            layoutContentionMetrics.recordRelease(operationId, duration);
            this.currentOperationId = null;
            this.lockStartTime = 0;
            return true;
        }

        if (this.currentOperationId) {
            hscopeLogger.warn('lock', `release attempted by ${operationId} but held by ${this.currentOperationId}`);
        }
        return false;
    }

    /**
     * Check if a specific operation holds the lock
     */
    isHeldBy(operationId: string): boolean {
        return this.currentOperationId === operationId;
    }

    /**
     * Get current lock status including queue information
     */
    getStatus() {
        return {
            isLocked: !!this.currentOperationId,
            currentOperationId: this.currentOperationId,
            lockDuration: this.currentOperationId ? Date.now() - this.lockStartTime : 0,
            queueLength: this.requestQueue.length,
            isProcessingQueue: this.isProcessingQueue
        };
    }

    /**
     * Get detailed queue information for debugging
     */
    getQueueInfo() {
        return {
            queueLength: this.requestQueue.length,
            queuedOperations: this.requestQueue.map(req => ({
                operationId: req.operationId,
                force: req.force,
                type: this.getOperationType(req.operationId)
            })),
            isProcessingQueue: this.isProcessingQueue
        };
    }

    /**
     * Force release all locks (emergency use only)
     */
    forceReleaseAll(): void {
        if (this.currentOperationId) {
            console.warn(`[GlobalLayoutLock] 🚨 Force releasing all locks (was held by ${this.currentOperationId})`);
            this.currentOperationId = null;
            this.lockStartTime = 0;
        }
    }

    /**
     * Clear the entire queue and reject all pending requests (emergency use only)
     */
    clearQueue(): void {
        const queueLength = this.requestQueue.length;
        if (queueLength > 0) {
            console.warn(`[GlobalLayoutLock] 🚨 Clearing queue with ${queueLength} pending requests`);

            // Reject all queued requests
            const requests = this.requestQueue.splice(0);
            requests.forEach(request => {
                request.reject(new Error('Queue cleared - operation cancelled'));
            });
        }

        this.isProcessingQueue = false;
    }
}

export const globalLayoutLock = GlobalLayoutLock.getInstance();
