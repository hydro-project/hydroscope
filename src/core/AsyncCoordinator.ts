/**
 * AsyncCoordinator - Sequential queue system for async operations
 * Manages async boundaries with FIFO queues and error handling
 */

import { QueuedOperation, QueueStatus, ApplicationEvent } from '../types/core'

export interface QueueOptions {
  timeout?: number
  maxRetries?: number
}

export class AsyncCoordinator {
  private queue: QueuedOperation[] = []
  private processing = false
  private completedOperations: QueuedOperation[] = []
  private failedOperations: QueuedOperation[] = []
  private processingTimes: number[] = []
  private currentOperation?: QueuedOperation
  private operationIdCounter = 0

  /**
   * Queue an operation for sequential processing
   */
  queueOperation<T>(
    type: QueuedOperation['type'], 
    operation: () => Promise<T>, 
    options: QueueOptions = {}
  ): string {
    const id = `op_${++this.operationIdCounter}`
    
    const queuedOp: QueuedOperation<T> = {
      id,
      type,
      operation,
      timeout: options.timeout,
      retryCount: 0,
      maxRetries: options.maxRetries || 0,
      createdAt: Date.now()
    }
    
    this.queue.push(queuedOp)
    return id
  }

  /**
   * Process all queued operations sequentially
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }
    
    this.processing = true
    
    try {
      while (this.queue.length > 0) {
        const operation = this.queue.shift()!
        await this.processOperation(operation)
      }
    } finally {
      this.processing = false
      this.currentOperation = undefined
    }
  }

  /**
   * Process a single operation with retry logic and timeout handling
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    this.currentOperation = operation
    operation.startedAt = Date.now()
    
    while (operation.retryCount <= operation.maxRetries) {
      try {
        const result = await this.executeWithTimeout(operation)
        
        // Operation succeeded
        operation.completedAt = Date.now()
        this.completedOperations.push(operation)
        this.recordProcessingTime(operation)
        return
        
      } catch (error) {
        operation.error = error as Error
        operation.retryCount++
        
        // If we've exhausted retries, mark as failed
        if (operation.retryCount > operation.maxRetries) {
          operation.completedAt = Date.now()
          this.failedOperations.push(operation)
          this.recordProcessingTime(operation)
          return
        }
        
        // Otherwise, retry after a brief delay
        await new Promise(resolve => setTimeout(resolve, 100 * operation.retryCount))
      }
    }
  }

  /**
   * Execute operation with timeout if specified
   */
  private async executeWithTimeout(operation: QueuedOperation): Promise<any> {
    if (!operation.timeout) {
      return await operation.operation()
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation ${operation.id} timed out after ${operation.timeout}ms`))
      }, operation.timeout)
      
      operation.operation()
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * Record processing time for statistics
   */
  private recordProcessingTime(operation: QueuedOperation): void {
    if (operation.startedAt && operation.completedAt) {
      const processingTime = operation.completedAt - operation.startedAt
      this.processingTimes.push(processingTime)
      
      // Keep only last 100 processing times for rolling average
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift()
      }
    }
  }

  /**
   * Get current queue status and statistics
   */
  getQueueStatus(): QueueStatus {
    const totalProcessed = this.completedOperations.length + this.failedOperations.length
    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0
    
    return {
      pending: this.queue.length,
      processing: this.processing ? 1 : 0,
      completed: this.completedOperations.length,
      failed: this.failedOperations.length,
      totalProcessed,
      currentOperation: this.currentOperation,
      averageProcessingTime,
      errors: this.failedOperations.map(op => op.error!).filter(Boolean)
    }
  }

  /**
   * Clear all queued operations
   */
  clearQueue(): void {
    this.queue = []
  }

  /**
   * Clear all statistics and completed operations
   */
  clearHistory(): void {
    this.completedOperations = []
    this.failedOperations = []
    this.processingTimes = []
  }

  /**
   * Get all completed operations
   */
  getCompletedOperations(): ReadonlyArray<QueuedOperation> {
    return [...this.completedOperations]
  }

  /**
   * Get all failed operations
   */
  getFailedOperations(): ReadonlyArray<QueuedOperation> {
    return [...this.failedOperations]
  }

  /**
   * Check if queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length
  }

  // ELK-specific async operations
  
  /**
   * Queue ELK layout operation with proper sequencing
   */
  async queueELKLayout(
    state: any, // VisualizationState - using any to avoid circular dependency
    config: any, // LayoutConfig
    options: QueueOptions = {}
  ): Promise<void> {
    const operation = async () => {
      // Import ELKBridge dynamically to avoid circular dependency
      const { ELKBridge } = await import('../bridges/ELKBridge.js')
      
      try {
        // Create ELK bridge with config
        const elkBridge = new ELKBridge(config)
        
        // Set layout phase to indicate processing
        state.setLayoutPhase('laying_out')
        
        // Convert to ELK format
        const elkGraph = elkBridge.toELKGraph(state)
        
        // Simulate ELK processing (in real implementation, this would call actual ELK)
        // For now, we'll just apply the layout directly
        elkBridge.applyELKResults(state, elkGraph)
        
        // Increment layout count for smart collapse logic
        state.incrementLayoutCount()
        
        return 'layout_complete'
      } catch (error) {
        state.setLayoutPhase('error')
        throw error
      }
    }
    
    // Queue the operation and wait for it to complete
    const operationId = this.queueOperation('elk_layout', operation, {
      timeout: options.timeout || 10000, // 10 second default timeout
      maxRetries: options.maxRetries || 1
    })
    
    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue()
    }
    
    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(op => op.id === operationId)
    const failedOp = this.failedOperations.find(op => op.id === operationId)
    
    if (failedOp) {
      throw failedOp.error || new Error('ELK layout operation failed')
    }
    
    if (!completedOp) {
      throw new Error('ELK layout operation not found')
    }
  }

  /**
   * Cancel ELK operation if it's still queued
   */
  cancelELKOperation(operationId: string): boolean {
    const index = this.queue.findIndex(op => op.id === operationId && op.type === 'elk_layout')
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Get status of ELK operations
   */
  getELKOperationStatus(): {
    queued: number
    processing: boolean
    lastCompleted?: QueuedOperation
    lastFailed?: QueuedOperation
  } {
    const elkOps = this.queue.filter(op => op.type === 'elk_layout')
    const currentELK = this.currentOperation?.type === 'elk_layout'
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find(op => op.type === 'elk_layout')
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find(op => op.type === 'elk_layout')
    
    return {
      queued: elkOps.length,
      processing: currentELK,
      lastCompleted,
      lastFailed
    }
  }

  // ReactFlow-specific async operations
  
  /**
   * Queue ReactFlow render operation with proper sequencing
   */
  async queueReactFlowRender(
    state: any, // VisualizationState - using any to avoid circular dependency
    options: QueueOptions = {}
  ): Promise<any> { // ReactFlowData
    const operation = async () => {
      // Import ReactFlowBridge dynamically to avoid circular dependency
      const { ReactFlowBridge } = await import('../bridges/ReactFlowBridge.js')
      
      try {
        // Create ReactFlow bridge with default style config
        const reactFlowBridge = new ReactFlowBridge({})
        
        // Set layout phase to indicate rendering
        state.setLayoutPhase('rendering')
        
        // Convert to ReactFlow format
        const reactFlowData = reactFlowBridge.toReactFlowData(state)
        
        // Set layout phase to displayed
        state.setLayoutPhase('displayed')
        
        return reactFlowData
      } catch (error) {
        state.setLayoutPhase('error')
        throw error
      }
    }
    
    // Queue the operation and wait for it to complete
    const operationId = this.queueOperation('reactflow_render', operation, {
      timeout: options.timeout || 5000, // 5 second default timeout
      maxRetries: options.maxRetries || 1
    })
    
    // Process the queue if not already processing
    if (!this.processing) {
      await this.processQueue()
    }
    
    // Check if our operation completed successfully
    const completedOp = this.completedOperations.find(op => op.id === operationId)
    const failedOp = this.failedOperations.find(op => op.id === operationId)
    
    if (failedOp) {
      throw failedOp.error || new Error('ReactFlow render operation failed')
    }
    
    if (!completedOp) {
      throw new Error('ReactFlow render operation not found')
    }
    
    // Return the ReactFlow data from the completed operation
    return completedOp
  }

  /**
   * Cancel ReactFlow operation if it's still queued
   */
  cancelReactFlowOperation(operationId: string): boolean {
    const index = this.queue.findIndex(op => op.id === operationId && op.type === 'reactflow_render')
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Get status of ReactFlow operations
   */
  getReactFlowOperationStatus(): {
    queued: number
    processing: boolean
    lastCompleted?: QueuedOperation
    lastFailed?: QueuedOperation
  } {
    const reactFlowOps = this.queue.filter(op => op.type === 'reactflow_render')
    const currentReactFlow = this.currentOperation?.type === 'reactflow_render'
    const lastCompleted = [...this.completedOperations]
      .reverse()
      .find(op => op.type === 'reactflow_render')
    const lastFailed = [...this.failedOperations]
      .reverse()
      .find(op => op.type === 'reactflow_render')
    
    return {
      queued: reactFlowOps.length,
      processing: currentReactFlow,
      lastCompleted,
      lastFailed
    }
  }
}