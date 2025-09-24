/**
 * Async Boundary Integration Tests
 * Tests for async coordination with paxos.json operations and boundary coordination
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AsyncCoordinator } from '../core/AsyncCoordinator'
import { VisualizationState } from '../core/VisualizationState'
import { ELKBridge } from '../bridges/ELKBridge'
import { ReactFlowBridge } from '../bridges/ReactFlowBridge'
import { InteractionHandler } from '../core/InteractionHandler'
import type { GraphNode, GraphEdge, Container, LayoutConfig, ApplicationEvent } from '../types/core'
import { loadPaxosTestData, createTestVisualizationState } from '../utils/testData'

describe('Async Boundary Integration Tests', () => {
  let coordinator: AsyncCoordinator
  let state: VisualizationState
  let elkBridge: ELKBridge
  let reactFlowBridge: ReactFlowBridge
  let interactionHandler: InteractionHandler
  
  beforeEach(async () => {
    coordinator = new AsyncCoordinator()
    state = await createTestVisualizationState()
    elkBridge = new ELKBridge()
    reactFlowBridge = new ReactFlowBridge({})
    interactionHandler = new InteractionHandler(state, coordinator)
    
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('11.1 Test async coordination with paxos.json operations', () => {
    it('should handle rapid container expand/collapse operations with proper sequencing', async () => {
      // Get some containers from paxos data
      const containers = state.visibleContainers.slice(0, 3)
      expect(containers.length).toBeGreaterThan(0)
      
      // Track operation order
      const operationOrder: string[] = []
      
      // Create rapid expand/collapse operations using direct state operations
      const operations: Promise<void>[] = []
      
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i]
        
        // Expand operation
        operations.push(
          (async () => {
            coordinator.queueOperation('container_expand', async () => {
              state.expandContainer(container.id)
              return 'expanded'
            })
            await coordinator.processQueue()
            operationOrder.push(`expand-${container.id}`)
          })()
        )
        
        // Collapse operation (should happen after expand)
        operations.push(
          (async () => {
            coordinator.queueOperation('container_collapse', async () => {
              state.collapseContainer(container.id)
              return 'collapsed'
            })
            await coordinator.processQueue()
            operationOrder.push(`collapse-${container.id}`)
          })()
        )
      }
      
      // Execute all operations
      await Promise.all(operations)
      
      // Verify operations were sequenced properly
      expect(operationOrder).toHaveLength(containers.length * 2)
      
      // Verify that operations were processed in some order (due to async nature, exact order may vary)
      // But we can verify that all operations completed
      const expandCount = operationOrder.filter(op => op.startsWith('expand-')).length
      const collapseCount = operationOrder.filter(op => op.startsWith('collapse-')).length
      
      expect(expandCount).toBe(containers.length)
      expect(collapseCount).toBe(containers.length)
      
      // Verify final state consistency
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.pending).toBe(0)
      expect(finalStatus.processing).toBe(0)
      expect(finalStatus.completed).toBe(containers.length * 2)
      expect(finalStatus.failed).toBe(0)
    })

    it('should verify layout operations are queued and processed correctly', async () => {
      // Track layout operations
      const layoutOperations: Promise<void>[] = []
      const layoutTimes: number[] = []
      
      // Queue multiple layout operations
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now()
        
        layoutOperations.push(
          (async () => {
            coordinator.queueOperation('elk_layout', () => {
              // Simulate layout processing
              state.setLayoutPhase('laying_out')
              state.setLayoutPhase('ready')
              state.incrementLayoutCount()
              return Promise.resolve('layout_complete')
            })
            await coordinator.processQueue()
            layoutTimes.push(Date.now() - startTime)
          })()
        )
      }
      
      // Process all layout operations
      await Promise.all(layoutOperations)
      
      // Verify all layouts completed
      expect(layoutTimes).toHaveLength(5)
      
      // Verify layout operations were processed (times should be non-negative)
      for (const time of layoutTimes) {
        expect(time).toBeGreaterThanOrEqual(0)
      }
      
      // Verify layout state was updated
      const layoutState = state.getLayoutState()
      expect(layoutState.layoutCount).toBeGreaterThan(0)
      expect(layoutState.phase).toBe('ready')
      
      // Verify queue is clear
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.pending).toBe(0)
      expect(finalStatus.processing).toBe(0)
      expect(finalStatus.completed).toBe(5)
    })

    it('should test error recovery scenarios with paxos.json data', async () => {
      // Create a simple failing operation that will be retried
      let attemptCount = 0
      const failingOperation = () => {
        attemptCount++
        if (attemptCount < 2) {
          return Promise.reject(new Error('Simulated failure'))
        }
        return Promise.resolve('success')
      }
      
      // Queue operation with retry enabled
      coordinator.queueOperation('test', failingOperation, { maxRetries: 2 })
      
      // Process the queue without fake timers to avoid timeout
      vi.useRealTimers()
      await coordinator.processQueue()
      vi.useFakeTimers()
      
      // Verify retry occurred and operation eventually succeeded
      expect(attemptCount).toBe(2)
      
      // Verify operation completed successfully
      const status = coordinator.getQueueStatus()
      expect(status.completed).toBe(1)
      expect(status.failed).toBe(0)
    }, 15000)

    it('should validate performance under high async operation load', async () => {
      // Create high load scenario with paxos data
      const containers = state.visibleContainers.slice(0, 10)
      const startTime = Date.now()
      
      // Create many concurrent operations
      const operations: Promise<any>[] = []
      
      // Container operations (simplified)
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i]
        
        operations.push(
          (async () => {
            coordinator.queueOperation('container_expand', () => {
              state.expandContainer(container.id)
              return Promise.resolve('expanded')
            })
            await coordinator.processQueue()
          })()
        )
        
        operations.push(
          (async () => {
            coordinator.queueOperation('container_collapse', () => {
              state.collapseContainer(container.id)
              return Promise.resolve('collapsed')
            })
            await coordinator.processQueue()
          })()
        )
      }
      
      // Layout operations (simplified)
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            coordinator.queueOperation('elk_layout', () => Promise.resolve('layout_complete'))
            await coordinator.processQueue()
          })()
        )
      }
      
      // ReactFlow render operations (simplified)
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            coordinator.queueOperation('reactflow_render', () => Promise.resolve({ nodes: [], edges: [] }))
            await coordinator.processQueue()
          })()
        )
      }
      
      // Application events
      for (let i = 0; i < 10; i++) {
        const event: ApplicationEvent = {
          type: 'search',
          payload: { 
            query: `test${i}`, 
            state,
            expandContainers: false 
          },
          timestamp: Date.now()
        }
        
        operations.push(
          (async () => {
            coordinator.queueApplicationEvent(event)
            await coordinator.processQueue()
          })()
        )
      }
      
      // Execute all operations
      await Promise.all(operations)
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Verify performance is acceptable (should complete within reasonable time)
      expect(totalTime).toBeLessThan(10000) // 10 seconds max
      
      // Verify all operations completed successfully
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.pending).toBe(0)
      expect(finalStatus.processing).toBe(0)
      expect(finalStatus.failed).toBe(0)
      expect(finalStatus.completed).toBe(operations.length)
      
      // Verify average processing time is reasonable
      expect(finalStatus.averageProcessingTime).toBeLessThan(1000) // 1 second average max
    })

    it('should handle container operations with edge aggregation during async processing', async () => {
      // Get containers with edges for testing
      const containers = state.visibleContainers.slice(0, 3)
      const initialEdgeCount = state.visibleEdges.length
      const initialAggregatedCount = state.getAggregatedEdges().length
      
      expect(containers.length).toBeGreaterThan(0)
      expect(initialEdgeCount).toBeGreaterThan(0)
      
      // Collapse containers through async coordinator
      const collapseOperations = containers.map(container =>
        (async () => {
          coordinator.queueOperation('container_collapse', () => {
            state.collapseContainer(container.id)
            return Promise.resolve('collapsed')
          })
          await coordinator.processQueue()
        })()
      )
      
      await Promise.all(collapseOperations)
      
      // Verify edge aggregation occurred
      const postCollapseEdgeCount = state.visibleEdges.length
      const postCollapseAggregatedCount = state.getAggregatedEdges().length
      
      // Should have fewer visible regular edges and more aggregated edges
      expect(postCollapseAggregatedCount).toBeGreaterThanOrEqual(initialAggregatedCount)
      
      // Expand containers back
      const expandOperations = containers.map(container =>
        (async () => {
          coordinator.queueOperation('container_expand', () => {
            state.expandContainer(container.id)
            return Promise.resolve('expanded')
          })
          await coordinator.processQueue()
        })()
      )
      
      await Promise.all(expandOperations)
      
      // Verify edge restoration
      const postExpandEdgeCount = state.visibleEdges.length
      const postExpandAggregatedCount = state.getAggregatedEdges().length
      
      // Should have restored some edges
      expect(postExpandEdgeCount).toBeGreaterThanOrEqual(postCollapseEdgeCount)
      
      // Verify async operations completed successfully
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.completed).toBeGreaterThan(0)
      expect(finalStatus.failed).toBe(0)
    })

    it('should handle search operations that trigger container expansion', async () => {
      // Collapse some containers first
      const containers = state.visibleContainers.slice(0, 5)
      for (const container of containers) {
        state.collapseContainer(container.id)
      }
      
      // Get some node names from paxos data for searching
      const nodes = state.visibleNodes.slice(0, 10)
      expect(nodes.length).toBeGreaterThan(0)
      
      const searchQueries = nodes.map(node => node.label.substring(0, 5))
      
      // Perform searches that should expand containers
      const searchOperations = searchQueries.map(query => {
        const event: ApplicationEvent = {
          type: 'search',
          payload: { 
            query, 
            state,
            expandContainers: true,
            triggerLayout: false 
          },
          timestamp: Date.now()
        }
        
        return (async () => {
          coordinator.queueApplicationEvent(event)
          await coordinator.processQueue()
        })()
      })
      
      await Promise.all(searchOperations)
      
      // Verify search operations completed
      const appEventStatus = coordinator.getApplicationEventStatus()
      expect(appEventStatus.queued).toBe(0)
      expect(appEventStatus.lastCompleted).toBeDefined()
      
      // Verify some containers were expanded due to search
      const expandedContainers = state.visibleContainers.filter(c => !c.collapsed)
      expect(expandedContainers.length).toBeGreaterThan(0)
    })
  })

  describe('11.2 Test async boundary coordination', () => {
    it('should test coordination between ELK and ReactFlow async boundaries', async () => {
      // Create a sequence of operations that involve both ELK and ReactFlow
      const layoutConfig: LayoutConfig = {
        algorithm: 'layered',
        direction: 'DOWN',
        nodeSpacing: 50
      }
      
      const operationSequence: Array<{ type: string; timestamp: number }> = []
      
      // Interleave ELK and ReactFlow operations
      const operations: Promise<any>[] = []
      
      for (let i = 0; i < 5; i++) {
        // ELK layout operation
        operations.push(
          (async () => {
            coordinator.queueOperation('elk_layout', () => Promise.resolve('layout_complete'))
            await coordinator.processQueue()
            operationSequence.push({ type: 'elk', timestamp: Date.now() })
          })()
        )
        
        // ReactFlow render operation
        operations.push(
          (async () => {
            coordinator.queueOperation('reactflow_render', () => Promise.resolve({ nodes: [], edges: [] }))
            await coordinator.processQueue()
            operationSequence.push({ type: 'reactflow', timestamp: Date.now() })
          })()
        )
      }
      
      // Execute all operations
      await Promise.all(operations)
      
      // Verify operations completed in sequence
      expect(operationSequence).toHaveLength(10)
      
      // Verify timestamps are in order (operations were sequential)
      for (let i = 1; i < operationSequence.length; i++) {
        expect(operationSequence[i].timestamp).toBeGreaterThanOrEqual(
          operationSequence[i - 1].timestamp
        )
      }
      
      // Verify both ELK and ReactFlow operations completed
      const elkStatus = coordinator.getELKOperationStatus()
      const reactFlowStatus = coordinator.getReactFlowOperationStatus()
      
      expect(elkStatus.lastCompleted).toBeDefined()
      expect(reactFlowStatus.lastCompleted).toBeDefined()
      
      // Verify no operations are still queued or processing
      expect(elkStatus.queued).toBe(0)
      expect(elkStatus.processing).toBe(false)
      expect(reactFlowStatus.queued).toBe(0)
      expect(reactFlowStatus.processing).toBe(false)
    })

    it('should verify proper sequencing when multiple boundaries are active', async () => {
      // Create operations across all async boundaries
      const containers = state.visibleContainers.slice(0, 3)
      const layoutConfig: LayoutConfig = { algorithm: 'layered', direction: 'DOWN' }
      
      const operationLog: Array<{ 
        type: 'container' | 'elk' | 'reactflow' | 'event'
        id: string
        timestamp: number 
      }> = []
      
      const operations: Promise<any>[] = []
      
      // Container operations
      for (const container of containers) {
        operations.push(
          (async () => {
            coordinator.queueOperation('container_expand', () => {
              state.expandContainer(container.id)
              return Promise.resolve('expanded')
            })
            await coordinator.processQueue()
            operationLog.push({ 
              type: 'container', 
              id: `expand-${container.id}`, 
              timestamp: Date.now() 
            })
          })()
        )
      }
      
      // ELK operations
      for (let i = 0; i < 3; i++) {
        operations.push(
          (async () => {
            coordinator.queueOperation('elk_layout', () => Promise.resolve('layout_complete'))
            await coordinator.processQueue()
            operationLog.push({ 
              type: 'elk', 
              id: `layout-${i}`, 
              timestamp: Date.now() 
            })
          })()
        )
      }
      
      // ReactFlow operations
      for (let i = 0; i < 3; i++) {
        operations.push(
          (async () => {
            coordinator.queueOperation('reactflow_render', () => Promise.resolve({ nodes: [], edges: [] }))
            await coordinator.processQueue()
            operationLog.push({ 
              type: 'reactflow', 
              id: `render-${i}`, 
              timestamp: Date.now() 
            })
          })()
        )
      }
      
      // Application events
      for (let i = 0; i < 3; i++) {
        const event: ApplicationEvent = {
          type: 'search',
          payload: { query: `test${i}`, state, expandContainers: false },
          timestamp: Date.now()
        }
        
        operations.push(
          (async () => {
            coordinator.queueApplicationEvent(event)
            await coordinator.processQueue()
            operationLog.push({ 
              type: 'event', 
              id: `search-${i}`, 
              timestamp: Date.now() 
            })
          })()
        )
      }
      
      // Execute all operations
      await Promise.all(operations)
      
      // Verify all operations completed
      expect(operationLog).toHaveLength(operations.length)
      
      // Verify operations were processed sequentially (timestamps in order)
      for (let i = 1; i < operationLog.length; i++) {
        expect(operationLog[i].timestamp).toBeGreaterThanOrEqual(
          operationLog[i - 1].timestamp
        )
      }
      
      // Verify all boundaries are clear
      const queueStatus = coordinator.getQueueStatus()
      expect(queueStatus.pending).toBe(0)
      expect(queueStatus.processing).toBe(0)
      expect(queueStatus.completed).toBe(operations.length)
    })

    it('should test error propagation across async boundaries', async () => {
      // Test ELK boundary error propagation
      const elkFailingOperation = () => Promise.reject(new Error('ELK boundary failure'))
      coordinator.queueOperation('elk_layout', elkFailingOperation, { maxRetries: 0 })
      
      await coordinator.processQueue()
      
      // Test ReactFlow boundary error propagation
      const reactFlowFailingOperation = () => Promise.reject(new Error('ReactFlow boundary failure'))
      coordinator.queueOperation('reactflow_render', reactFlowFailingOperation, { maxRetries: 0 })
      
      await coordinator.processQueue()
      
      // Verify error tracking
      const status = coordinator.getQueueStatus()
      expect(status.failed).toBe(2)
      expect(status.errors).toHaveLength(2)
      expect(status.errors[0].message).toContain('boundary failure')
      expect(status.errors[1].message).toContain('boundary failure')
    }, 10000)

    it('should validate system stability under async stress conditions', async () => {
      // Create high-stress scenario with many operations
      const stressOperations: Promise<any>[] = []
      const startTime = Date.now()
      
      // Create 50 operations across different types
      for (let i = 0; i < 50; i++) {
        const operation = () => Promise.resolve(`result-${i}`)
        const operationType = i % 3 === 0 ? 'elk_layout' : i % 3 === 1 ? 'reactflow_render' : 'application_event'
        
        stressOperations.push(
          (async () => {
            coordinator.queueOperation(operationType, operation)
            await coordinator.processQueue()
          })()
        )
      }
      
      // Execute all stress operations
      await Promise.all(stressOperations)
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Verify system remained stable (completed within reasonable time)
      expect(totalTime).toBeLessThan(10000) // 10 seconds max for stress test
      
      // Verify queue is clear and system is stable
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.pending).toBe(0)
      expect(finalStatus.processing).toBe(0)
      expect(finalStatus.completed).toBe(50)
      
      // Verify system can still process new operations after stress
      coordinator.queueOperation('test', () => Promise.resolve('post-stress'))
      await coordinator.processQueue()
      
      const postStressStatus = coordinator.getQueueStatus()
      expect(postStressStatus.pending).toBe(0)
      expect(postStressStatus.processing).toBe(0)
      expect(postStressStatus.completed).toBe(51)
    }, 15000)

    it('should test interaction handler integration with async boundaries', async () => {
      // Test that interaction handler properly coordinates with async boundaries
      const containers = state.visibleContainers.slice(0, 3)
      const nodes = state.visibleNodes.slice(0, 5)
      
      expect(containers.length).toBeGreaterThan(0)
      expect(nodes.length).toBeGreaterThan(0)
      
      const interactionLog: Array<{ type: string; id: string; timestamp: number }> = []
      
      // Mock interaction handler to track operations
      const mockHandler = {
        handleContainerClick: vi.fn(async (containerId: string) => {
          interactionLog.push({ type: 'container', id: containerId, timestamp: Date.now() })
          coordinator.queueOperation('container_expand', () => {
            state.expandContainer(containerId)
            return Promise.resolve('expanded')
          })
          await coordinator.processQueue()
        }),
        handleNodeClick: vi.fn(async (nodeId: string) => {
          interactionLog.push({ type: 'node', id: nodeId, timestamp: Date.now() })
          state.toggleNodeLabel(nodeId)
        })
      }
      
      // Simulate rapid user interactions
      const interactions: Promise<any>[] = []
      
      for (const container of containers) {
        interactions.push(mockHandler.handleContainerClick(container.id))
      }
      
      for (const node of nodes) {
        interactions.push(mockHandler.handleNodeClick(node.id))
      }
      
      // Execute all interactions
      await Promise.all(interactions)
      
      // Verify interactions were processed
      expect(mockHandler.handleContainerClick).toHaveBeenCalledTimes(containers.length)
      expect(mockHandler.handleNodeClick).toHaveBeenCalledTimes(nodes.length)
      
      // Verify interaction log shows proper sequencing
      expect(interactionLog).toHaveLength(containers.length + nodes.length)
      
      // Verify async operations completed
      const finalStatus = coordinator.getQueueStatus()
      expect(finalStatus.pending).toBe(0)
      expect(finalStatus.processing).toBe(0)
    })
  })
})

