/**
 * AsyncCoordinator Tests
 * Tests for sequential queue system for async operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AsyncCoordinator } from '../core/AsyncCoordinator'
import { QueuedOperation, QueueStatus, ApplicationEvent } from '../types/core'

describe('AsyncCoordinator', () => {
  let coordinator: AsyncCoordinator
  
  beforeEach(() => {
    coordinator = new AsyncCoordinator()
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Sequential Queue System', () => {
    it('should create empty queue on initialization', () => {
      const status = coordinator.getQueueStatus()
      
      expect(status.pending).toBe(0)
      expect(status.processing).toBe(0)
      expect(status.completed).toBe(0)
      expect(status.failed).toBe(0)
      expect(status.totalProcessed).toBe(0)
      expect(status.currentOperation).toBeUndefined()
      expect(status.averageProcessingTime).toBe(0)
      expect(status.errors).toHaveLength(0)
    })

    it('should queue operations in FIFO order', async () => {
      const results: string[] = []
      
      const op1 = () => Promise.resolve().then(() => { results.push('op1'); return 'result1' })
      const op2 = () => Promise.resolve().then(() => { results.push('op2'); return 'result2' })
      const op3 = () => Promise.resolve().then(() => { results.push('op3'); return 'result3' })
      
      coordinator.queueOperation('test', op1)
      coordinator.queueOperation('test', op2)
      coordinator.queueOperation('test', op3)
      
      const status = coordinator.getQueueStatus()
      expect(status.pending).toBe(3)
      
      // Process all operations
      await coordinator.processQueue()
      
      expect(results).toEqual(['op1', 'op2', 'op3'])
      expect(coordinator.getQueueStatus().completed).toBe(3)
    })

    it('should process operations sequentially, not in parallel', async () => {
      const executionOrder: string[] = []
      let op1Resolve: () => void
      let op2Resolve: () => void
      
      const op1 = () => new Promise<string>((resolve) => {
        executionOrder.push('op1-start')
        op1Resolve = () => {
          executionOrder.push('op1-end')
          resolve('result1')
        }
      })
      
      const op2 = () => new Promise<string>((resolve) => {
        executionOrder.push('op2-start')
        op2Resolve = () => {
          executionOrder.push('op2-end')
          resolve('result2')
        }
      })
      
      coordinator.queueOperation('test', op1)
      coordinator.queueOperation('test', op2)
      
      // Start processing
      const processPromise = coordinator.processQueue()
      
      // Allow first operation to start
      await vi.runOnlyPendingTimersAsync()
      expect(executionOrder).toEqual(['op1-start'])
      
      // Complete first operation
      op1Resolve!()
      await vi.runOnlyPendingTimersAsync()
      
      // Second operation should now start
      expect(executionOrder).toEqual(['op1-start', 'op1-end', 'op2-start'])
      
      // Complete second operation
      op2Resolve!()
      await processPromise
      
      expect(executionOrder).toEqual(['op1-start', 'op1-end', 'op2-start', 'op2-end'])
    })

    it('should handle operation errors and continue processing', async () => {
      const results: string[] = []
      
      const op1 = () => Promise.resolve().then(() => { results.push('op1'); return 'result1' })
      const op2 = () => Promise.reject(new Error('Operation failed'))
      const op3 = () => Promise.resolve().then(() => { results.push('op3'); return 'result3' })
      
      coordinator.queueOperation('test', op1)
      coordinator.queueOperation('test', op2)
      coordinator.queueOperation('test', op3)
      
      await coordinator.processQueue()
      
      expect(results).toEqual(['op1', 'op3'])
      
      const status = coordinator.getQueueStatus()
      expect(status.completed).toBe(2)
      expect(status.failed).toBe(1)
      expect(status.errors).toHaveLength(1)
      expect(status.errors[0].message).toBe('Operation failed')
    })

    it('should implement retry logic for failed operations', async () => {
      let attemptCount = 0
      const failingOp = () => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject(new Error(`Attempt ${attemptCount} failed`))
        }
        return Promise.resolve('success')
      }
      
      coordinator.queueOperation('test', failingOp, { maxRetries: 3 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      expect(attemptCount).toBe(3)
      const status = coordinator.getQueueStatus()
      expect(status.completed).toBe(1)
      expect(status.failed).toBe(0)
    })

    it('should fail operation after max retries exceeded', async () => {
      let attemptCount = 0
      const alwaysFailingOp = () => {
        attemptCount++
        return Promise.reject(new Error(`Attempt ${attemptCount} failed`))
      }
      
      coordinator.queueOperation('test', alwaysFailingOp, { maxRetries: 2 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      expect(attemptCount).toBe(3) // Initial attempt + 2 retries
      const status = coordinator.getQueueStatus()
      expect(status.completed).toBe(0)
      expect(status.failed).toBe(1)
    })

    it('should handle operation timeouts', async () => {
      const longRunningOp = () => new Promise(resolve => {
        setTimeout(() => resolve('result'), 2000)
      })
      
      coordinator.queueOperation('test', longRunningOp, { timeout: 100 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      const status = coordinator.getQueueStatus()
      expect(status.failed).toBe(1)
      expect(status.errors[0].message).toContain('timed out')
    })

    it('should track processing statistics', async () => {
      const fastOp = () => new Promise(resolve => setTimeout(() => resolve('fast'), 10))
      const slowOp = () => new Promise(resolve => setTimeout(() => resolve('slow'), 50))
      
      coordinator.queueOperation('test', fastOp)
      coordinator.queueOperation('test', slowOp)
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      const status = coordinator.getQueueStatus()
      expect(status.completed).toBe(2)
      expect(status.totalProcessed).toBe(2)
      expect(status.averageProcessingTime).toBeGreaterThan(0)
    })

    it('should allow clearing the queue', () => {
      coordinator.queueOperation('test', () => Promise.resolve('result1'))
      coordinator.queueOperation('test', () => Promise.resolve('result2'))
      
      expect(coordinator.getQueueStatus().pending).toBe(2)
      
      coordinator.clearQueue()
      
      expect(coordinator.getQueueStatus().pending).toBe(0)
    })

    it('should provide current operation information during processing', async () => {
      let operationStarted = false
      let resolveOp: () => void
      
      const op = () => new Promise<string>((resolve) => {
        operationStarted = true
        resolveOp = () => resolve('result')
      })
      
      coordinator.queueOperation('test', op)
      
      const processPromise = coordinator.processQueue()
      
      // Wait for operation to start
      await vi.runOnlyPendingTimersAsync()
      
      if (operationStarted) {
        const status = coordinator.getQueueStatus()
        expect(status.processing).toBe(1)
        expect(status.currentOperation).toBeDefined()
        expect(status.currentOperation?.type).toBe('test')
      }
      
      resolveOp!()
      await processPromise
    })
  })

  describe('Queue Status Monitoring', () => {
    it('should provide accurate queue metrics', async () => {
      // Add some operations
      coordinator.queueOperation('test', () => Promise.resolve('1'))
      coordinator.queueOperation('test', () => Promise.resolve('2'))
      coordinator.queueOperation('test', () => Promise.reject(new Error('fail')))
      
      let status = coordinator.getQueueStatus()
      expect(status.pending).toBe(3)
      expect(status.processing).toBe(0)
      expect(status.completed).toBe(0)
      expect(status.failed).toBe(0)
      
      await coordinator.processQueue()
      
      status = coordinator.getQueueStatus()
      expect(status.pending).toBe(0)
      expect(status.processing).toBe(0)
      expect(status.completed).toBe(2)
      expect(status.failed).toBe(1)
      expect(status.totalProcessed).toBe(3)
    })
  })

  describe('ELK Async Operations', () => {
    let mockState: any
    let mockConfig: any

    beforeEach(() => {
      mockState = {
        setLayoutPhase: vi.fn(),
        incrementLayoutCount: vi.fn(),
        visibleNodes: [],
        visibleContainers: [],
        visibleEdges: [],
        getAggregatedEdges: () => [],
        getGraphNode: () => null,
        getContainer: () => null
      }
      
      mockConfig = {
        algorithm: 'layered',
        direction: 'DOWN'
      }
    })

    it('should queue ELK layout operations with proper sequencing', async () => {
      // Execute operations sequentially
      await coordinator.queueELKLayout(mockState, mockConfig)
      await coordinator.queueELKLayout(mockState, mockConfig)
      
      const finalStatus = coordinator.getELKOperationStatus()
      expect(finalStatus.queued).toBe(0)
      expect(finalStatus.processing).toBe(false)
      expect(finalStatus.lastCompleted).toBeDefined()
      
      // Verify state methods were called
      expect(mockState.setLayoutPhase).toHaveBeenCalledWith('laying_out')
      expect(mockState.incrementLayoutCount).toHaveBeenCalled()
    })

    it('should handle ELK operation cancellation', () => {
      coordinator.queueOperation('elk_layout', () => Promise.resolve('test'))
      coordinator.queueOperation('elk_layout', () => Promise.resolve('test'))
      
      expect(coordinator.getELKOperationStatus().queued).toBe(2)
      
      // Cancel operations (we need to access the operation IDs)
      const queuedOps = coordinator['queue'].filter(op => op.type === 'elk_layout')
      const cancelled = coordinator.cancelELKOperation(queuedOps[0].id)
      
      expect(cancelled).toBe(true)
      expect(coordinator.getELKOperationStatus().queued).toBe(1)
    })

    it('should handle ELK operation timeouts', async () => {
      // Create a mock that will timeout
      const slowOperation = () => new Promise(resolve => {
        setTimeout(() => resolve('slow result'), 200)
      })
      
      coordinator.queueOperation('elk_layout', slowOperation, { timeout: 50 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      const status = coordinator.getELKOperationStatus()
      expect(status.lastFailed).toBeDefined()
      expect(status.lastFailed?.error?.message).toContain('timed out')
    })

    it('should handle ELK operation errors and set error state', async () => {
      // Create a simple failing operation
      const failingOperation = () => Promise.reject(new Error('Layout processing failed'))
      
      coordinator.queueOperation('elk_layout', failingOperation)
      
      await coordinator.processQueue()
      
      const status = coordinator.getELKOperationStatus()
      expect(status.lastFailed).toBeDefined()
      expect(status.lastFailed?.error?.message).toBe('Layout processing failed')
    })

    it('should provide ELK operation status tracking', async () => {
      // Initially no operations
      let status = coordinator.getELKOperationStatus()
      expect(status.queued).toBe(0)
      expect(status.processing).toBe(false)
      expect(status.lastCompleted).toBeUndefined()
      
      // Execute first operation
      await coordinator.queueELKLayout(mockState, mockConfig)
      
      status = coordinator.getELKOperationStatus()
      expect(status.queued).toBe(0)
      expect(status.lastCompleted).toBeDefined()
      expect(status.lastCompleted?.type).toBe('elk_layout')
      
      // Execute second operation
      await coordinator.queueELKLayout(mockState, mockConfig)
      
      status = coordinator.getELKOperationStatus()
      expect(status.queued).toBe(0)
      expect(status.lastCompleted).toBeDefined()
    })

    it('should retry failed ELK operations', async () => {
      let attemptCount = 0
      const flakyState = {
        ...mockState,
        setLayoutPhase: vi.fn((phase) => {
          if (phase === 'laying_out') {
            attemptCount++
            if (attemptCount < 2) {
              throw new Error('Temporary failure')
            }
          }
        })
      }
      
      const retryPromise = coordinator.queueELKLayout(flakyState, mockConfig, { maxRetries: 2 })
      
      // Advance timers to handle retry delays
      await vi.runAllTimersAsync()
      await retryPromise
      
      expect(attemptCount).toBe(2)
      expect(flakyState.incrementLayoutCount).toHaveBeenCalled()
      
      const status = coordinator.getELKOperationStatus()
      expect(status.lastCompleted).toBeDefined()
    })
  })

  describe('ReactFlow Async Operations', () => {
    let mockState: any

    beforeEach(() => {
      mockState = {
        setLayoutPhase: vi.fn(),
        getLayoutState: vi.fn(() => ({ phase: 'ready', layoutCount: 1, lastUpdate: Date.now() })),
        visibleNodes: [],
        visibleContainers: [],
        visibleEdges: [],
        getAggregatedEdges: () => []
      }
    })

    it('should queue ReactFlow render operations with proper sequencing', async () => {
      // Execute operations sequentially
      await coordinator.queueReactFlowRender(mockState)
      await coordinator.queueReactFlowRender(mockState)
      
      const finalStatus = coordinator.getReactFlowOperationStatus()
      expect(finalStatus.queued).toBe(0)
      expect(finalStatus.processing).toBe(false)
      expect(finalStatus.lastCompleted).toBeDefined()
      
      // Verify state methods were called
      expect(mockState.setLayoutPhase).toHaveBeenCalledWith('rendering')
      expect(mockState.setLayoutPhase).toHaveBeenCalledWith('displayed')
    })

    it('should handle ReactFlow operation cancellation', () => {
      coordinator.queueOperation('reactflow_render', () => Promise.resolve('test'))
      coordinator.queueOperation('reactflow_render', () => Promise.resolve('test'))
      
      expect(coordinator.getReactFlowOperationStatus().queued).toBe(2)
      
      // Cancel operations (we need to access the operation IDs)
      const queuedOps = coordinator['queue'].filter(op => op.type === 'reactflow_render')
      const cancelled = coordinator.cancelReactFlowOperation(queuedOps[0].id)
      
      expect(cancelled).toBe(true)
      expect(coordinator.getReactFlowOperationStatus().queued).toBe(1)
    })

    it('should handle ReactFlow operation timeouts', async () => {
      // Create a mock that will timeout
      const slowOperation = () => new Promise(resolve => {
        setTimeout(() => resolve('slow result'), 200)
      })
      
      coordinator.queueOperation('reactflow_render', slowOperation, { timeout: 50 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      const status = coordinator.getReactFlowOperationStatus()
      expect(status.lastFailed).toBeDefined()
      expect(status.lastFailed?.error?.message).toContain('timed out')
    })

    it('should handle ReactFlow operation errors and set error state', async () => {
      // Create a simple failing operation
      const failingOperation = () => Promise.reject(new Error('Render processing failed'))
      
      coordinator.queueOperation('reactflow_render', failingOperation)
      
      await coordinator.processQueue()
      
      const status = coordinator.getReactFlowOperationStatus()
      expect(status.lastFailed).toBeDefined()
      expect(status.lastFailed?.error?.message).toBe('Render processing failed')
    })

    it('should provide ReactFlow operation status tracking', async () => {
      // Initially no operations
      let status = coordinator.getReactFlowOperationStatus()
      expect(status.queued).toBe(0)
      expect(status.processing).toBe(false)
      expect(status.lastCompleted).toBeUndefined()
      
      // Execute operation
      await coordinator.queueReactFlowRender(mockState)
      
      status = coordinator.getReactFlowOperationStatus()
      expect(status.queued).toBe(0)
      expect(status.lastCompleted).toBeDefined()
      expect(status.lastCompleted?.type).toBe('reactflow_render')
    })

    it('should retry failed ReactFlow operations', async () => {
      let attemptCount = 0
      const failingOperation = () => {
        attemptCount++
        if (attemptCount < 2) {
          return Promise.reject(new Error('Temporary render failure'))
        }
        return Promise.resolve('success')
      }
      
      coordinator.queueOperation('reactflow_render', failingOperation, { maxRetries: 2 })
      
      const processPromise = coordinator.processQueue()
      await vi.runAllTimersAsync()
      await processPromise
      
      expect(attemptCount).toBe(2)
      
      const status = coordinator.getReactFlowOperationStatus()
      expect(status.lastCompleted).toBeDefined()
    })

    it('should return ReactFlow data from completed operations', async () => {
      const result = await coordinator.queueReactFlowRender(mockState)
      
      // The result should be the completed operation, which contains the ReactFlow data
      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.type).toBe('reactflow_render')
      expect(result.completedAt).toBeDefined()
    })
  })
})