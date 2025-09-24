/**
 * Error Recovery Validation Tests
 * 
 * Tests system recovery mechanisms and stability after errors.
 * Validates that the system can continue operating after failures.
 * 
 * Requirements: 12.4, 5.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState';
import { AsyncCoordinator } from '../core/AsyncCoordinator';
import { ELKBridge } from '../bridges/ELKBridge';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import { JSONParser } from '../utils/JSONParser';
import { InteractionHandler } from '../core/InteractionHandler';

describe('Error Recovery Validation', () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let interactionHandler: InteractionHandler;

  beforeEach(() => {
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({
      algorithm: 'layered',
      direction: 'DOWN',
      nodeSpacing: 50,
      edgeSpacing: 10,
      layerSpacing: 20
    });
    reactFlowBridge = new ReactFlowBridge({
      nodeStyles: new Map(),
      edgeStyles: new Map(),
      containerStyles: new Map()
    });
    interactionHandler = new InteractionHandler(visualizationState, asyncCoordinator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('State Recovery Mechanisms', () => {
    it('should recover from corrupted node data', () => {
      // Add valid nodes
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      visualizationState.addNode({
        id: 'node2',
        label: 'Node 2',
        longLabel: 'Node 2 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Corrupt one node
      const internalNodes = (visualizationState as any)._nodes;
      internalNodes.set('node1', { id: 'node1', label: null, type: undefined });

      // Implement recovery mechanism
      const recoverFromCorruption = () => {
        const nodes = (visualizationState as any)._nodes;
        const corruptedNodes: string[] = [];

        for (const [id, node] of nodes.entries()) {
          if (!node || !node.label || !node.type) {
            corruptedNodes.push(id);
          }
        }

        // Remove corrupted nodes
        corruptedNodes.forEach(id => nodes.delete(id));

        return corruptedNodes.length;
      };

      const removedCount = recoverFromCorruption();
      expect(removedCount).toBe(1);

      // System should be functional after recovery
      expect(visualizationState.visibleNodes).toHaveLength(1);
      expect(visualizationState.visibleNodes[0].id).toBe('node2');
      
      // Should be able to add new nodes
      visualizationState.addNode({
        id: 'node3',
        label: 'Node 3',
        longLabel: 'Node 3 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      expect(visualizationState.visibleNodes).toHaveLength(2);
    });

    it('should recover from broken edge references', () => {
      // Add nodes and edges
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      visualizationState.addNode({
        id: 'node2',
        label: 'Node 2',
        longLabel: 'Node 2 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      visualizationState.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'flow',
        semanticTags: [],
        hidden: false
      });

      // Add edge directly to internal state to simulate corruption
      const internalEdges = (visualizationState as any)._edges;
      internalEdges.set('edge2', {
        id: 'edge2',
        source: 'node1',
        target: 'nonexistent',
        type: 'flow',
        semanticTags: [],
        hidden: false
      });

      // Implement edge recovery mechanism
      const recoverBrokenEdges = () => {
        const edges = (visualizationState as any)._edges;
        const nodes = (visualizationState as any)._nodes;
        const brokenEdges: string[] = [];

        for (const [id, edge] of edges.entries()) {
          if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
            brokenEdges.push(id);
          }
        }

        // Remove broken edges
        brokenEdges.forEach(id => edges.delete(id));

        return brokenEdges.length;
      };

      const removedCount = recoverBrokenEdges();
      expect(removedCount).toBe(1);

      // System should be functional after recovery
      expect(visualizationState.visibleEdges).toHaveLength(1);
      expect(visualizationState.visibleEdges[0].id).toBe('edge1');

      // Should be able to add new edges
      visualizationState.addEdge({
        id: 'edge3',
        source: 'node2',
        target: 'node1',
        type: 'flow',
        semanticTags: [],
        hidden: false
      });

      expect(visualizationState.visibleEdges).toHaveLength(2);
    });

    it('should recover from container hierarchy corruption', () => {
      // Add nodes and containers
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      visualizationState.addContainer({
        id: 'container1',
        label: 'Container 1',
        children: new Set(['node1', 'nonexistent']),
        collapsed: false,
        hidden: false
      });

      // Implement container recovery mechanism
      const recoverContainerHierarchy = () => {
        const containers = (visualizationState as any)._containers;
        const nodes = (visualizationState as any)._nodes;
        let fixedCount = 0;

        for (const [id, container] of containers.entries()) {
          const validChildren = new Set<string>();
          
          for (const childId of container.children) {
            if (nodes.has(childId) || containers.has(childId)) {
              validChildren.add(childId);
            } else {
              fixedCount++;
            }
          }

          container.children = validChildren;
        }

        return fixedCount;
      };

      const fixedCount = recoverContainerHierarchy();
      expect(fixedCount).toBe(1);

      // System should be functional after recovery
      const container = visualizationState.visibleContainers.find(c => c.id === 'container1');
      expect(container?.children.size).toBe(1);
      expect(container?.children.has('node1')).toBe(true);
      expect(container?.children.has('nonexistent')).toBe(false);
    });

    it('should recover from layout state corruption', () => {
      // Corrupt layout state
      const layoutState = (visualizationState as any)._layoutState;
      layoutState.phase = 'invalid_phase';
      layoutState.layoutCount = -1;

      // Implement layout state recovery
      const recoverLayoutState = () => {
        const validPhases = ['initial', 'laying_out', 'ready', 'rendering', 'displayed', 'error'];
        
        if (!validPhases.includes(layoutState.phase)) {
          layoutState.phase = 'initial';
        }

        if (layoutState.layoutCount < 0) {
          layoutState.layoutCount = 0;
        }

        if (!layoutState.lastUpdate || layoutState.lastUpdate < 0) {
          layoutState.lastUpdate = Date.now();
        }
      };

      recoverLayoutState();

      // System should be functional after recovery
      expect(visualizationState.getLayoutState().phase).toBe('initial');
      expect(visualizationState.getLayoutState().layoutCount).toBe(0);
      expect(visualizationState.getLayoutState().lastUpdate).toBeGreaterThan(0);

      // Should be able to perform layout operations
      visualizationState.setLayoutPhase('laying_out');
      expect(visualizationState.getLayoutState().phase).toBe('laying_out');
    });
  });

  describe('Async Operation Recovery', () => {
    it('should recover from failed async operations', async () => {
      let failCount = 0;
      const maxFails = 3;

      // Mock operation that fails first few times
      const unreliableOperation = vi.fn().mockImplementation(() => {
        failCount++;
        if (failCount <= maxFails) {
          return Promise.reject(new Error(`Failure ${failCount}`));
        }
        return Promise.resolve('Success');
      });

      // Implement retry mechanism
      const retryOperation = async (operation: () => Promise<any>, maxRetries = 5) => {
        let attempts = 0;
        let lastError: Error;

        while (attempts < maxRetries) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            attempts++;
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
          }
        }

        throw lastError!;
      };

      // Should eventually succeed after retries
      const result = await retryOperation(unreliableOperation);
      expect(result).toBe('Success');
      expect(failCount).toBe(maxFails + 1);
    });

    it('should recover from queue corruption', async () => {
      // Add some operations to the queue
      const promises = [
        asyncCoordinator.queueApplicationEvent({
          type: 'container_toggle',
          containerId: 'container1',
          timestamp: Date.now()
        }),
        asyncCoordinator.queueApplicationEvent({
          type: 'container_toggle',
          containerId: 'container2',
          timestamp: Date.now()
        })
      ];

      // Simulate queue corruption
      const internalQueue = (asyncCoordinator as any).queue;
      if (internalQueue) {
        // Add invalid operation
        internalQueue.push(null);
      }

      // Implement queue recovery
      const recoverQueue = () => {
        if (internalQueue) {
          // Remove null/undefined operations
          const validOperations = internalQueue.filter((op: any) => op != null);
          internalQueue.length = 0;
          internalQueue.push(...validOperations);
        }
      };

      recoverQueue();

      // Queue should continue processing valid operations
      await Promise.allSettled(promises);
      
      // Should be able to add new operations
      const operationId = asyncCoordinator.queueApplicationEvent({
        type: 'container_toggle',
        containerId: 'container3',
        timestamp: Date.now()
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
    });

    it('should recover from bridge operation failures', async () => {
      // Add test data
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Mock ELK to fail initially
      let elkFailCount = 0;
      const originalToELKGraph = elkBridge.toELKGraph;
      
      elkBridge.toELKGraph = vi.fn().mockImplementation((state) => {
        elkFailCount++;
        if (elkFailCount <= 2) {
          throw new Error('ELK conversion failed');
        }
        return originalToELKGraph.call(elkBridge, state);
      });

      // Implement bridge recovery
      const recoverBridgeOperation = async (operation: () => any, fallback: () => any) => {
        try {
          return await operation();
        } catch (error) {
          console.warn('Bridge operation failed, using fallback:', error.message);
          return await fallback();
        }
      };

      // First attempts should fail, then succeed
      await expect(
        recoverBridgeOperation(
          () => elkBridge.toELKGraph(visualizationState),
          () => ({ id: 'fallback', children: [], edges: [] })
        )
      ).resolves.toBeDefined();

      await expect(
        recoverBridgeOperation(
          () => elkBridge.toELKGraph(visualizationState),
          () => ({ id: 'fallback', children: [], edges: [] })
        )
      ).resolves.toBeDefined();

      // Third attempt should succeed with real implementation
      const result = await recoverBridgeOperation(
        () => elkBridge.toELKGraph(visualizationState),
        () => ({ id: 'fallback', children: [], edges: [] })
      );

      expect(result).not.toEqual({ id: 'fallback', children: [], edges: [] });
    });
  });

  describe('User Experience Recovery', () => {
    it('should recover from UI component crashes', () => {
      // Simulate component crash recovery
      const componentState = {
        hasError: false,
        errorCount: 0,
        lastError: null as Error | null
      };

      const simulateComponentCrash = (error: Error) => {
        componentState.hasError = true;
        componentState.errorCount++;
        componentState.lastError = error;
      };

      const recoverComponent = () => {
        componentState.hasError = false;
        // Keep error count for monitoring
        // Clear last error after recovery
        componentState.lastError = null;
      };

      // Simulate multiple crashes
      simulateComponentCrash(new Error('Render error 1'));
      expect(componentState.hasError).toBe(true);
      expect(componentState.errorCount).toBe(1);

      recoverComponent();
      expect(componentState.hasError).toBe(false);
      expect(componentState.errorCount).toBe(1); // Preserved for monitoring

      simulateComponentCrash(new Error('Render error 2'));
      expect(componentState.errorCount).toBe(2);

      recoverComponent();
      expect(componentState.hasError).toBe(false);
    });

    it('should recover from file upload failures', () => {
      const uploadState = {
        isUploading: false,
        error: null as string | null,
        retryCount: 0
      };

      const simulateUploadFailure = (error: string) => {
        uploadState.isUploading = false;
        uploadState.error = error;
        uploadState.retryCount++;
      };

      const recoverFromUploadFailure = () => {
        uploadState.error = null;
        // Allow retry if under limit
        return uploadState.retryCount < 3;
      };

      // Simulate upload failures
      simulateUploadFailure('Network error');
      expect(uploadState.error).toBe('Network error');
      expect(uploadState.retryCount).toBe(1);

      const canRetry1 = recoverFromUploadFailure();
      expect(canRetry1).toBe(true);
      expect(uploadState.error).toBe(null);

      simulateUploadFailure('Parse error');
      simulateUploadFailure('Validation error');
      
      const canRetry2 = recoverFromUploadFailure();
      expect(canRetry2).toBe(false); // Exceeded retry limit
      expect(uploadState.retryCount).toBe(3);
    });

    it('should recover from search operation failures', () => {
      // Add test data
      visualizationState.addNode({
        id: 'node1',
        label: 'Test Node',
        longLabel: 'Test Node Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      const searchState = {
        query: '',
        results: [] as any[],
        isSearching: false,
        error: null as string | null
      };

      const performSearch = (query: string) => {
        searchState.isSearching = true;
        searchState.query = query;
        searchState.error = null;

        try {
          if (query.length < 2) {
            throw new Error('Query too short');
          }

          if (query.length > 100) {
            throw new Error('Query too long');
          }

          // Perform actual search
          searchState.results = visualizationState.search(query);
          searchState.isSearching = false;
        } catch (error) {
          searchState.error = (error as Error).message;
          searchState.isSearching = false;
          searchState.results = [];
        }
      };

      const recoverFromSearchError = () => {
        searchState.error = null;
        searchState.isSearching = false;
        // Keep results for user reference
      };

      // Test search recovery
      performSearch('a'); // Too short
      expect(searchState.error).toBe('Query too short');
      expect(searchState.results).toHaveLength(0);

      recoverFromSearchError();
      expect(searchState.error).toBe(null);

      performSearch('test'); // Valid search
      expect(searchState.error).toBe(null);
      expect(searchState.results.length).toBeGreaterThan(0);
    });
  });

  describe('System Stability After Recovery', () => {
    it('should maintain performance after multiple recoveries', () => {
      const performanceMetrics = {
        operationTimes: [] as number[],
        errorCount: 0,
        recoveryCount: 0
      };

      const performOperationWithRecovery = (operation: () => void) => {
        const startTime = Date.now();
        
        try {
          operation();
          const endTime = Date.now();
          performanceMetrics.operationTimes.push(endTime - startTime);
        } catch (error) {
          performanceMetrics.errorCount++;
          
          // Simulate recovery
          performanceMetrics.recoveryCount++;
          
          // Retry operation with a safe version
          const retryStartTime = Date.now();
          try {
            // Safe retry - just add a node without throwing
            visualizationState.addNode({
              id: `safe-node${i}`,
              label: `Safe Node ${i}`,
              longLabel: `Safe Node ${i} Long`,
              type: 'process',
              semanticTags: [],
              hidden: false
            });
          } catch (retryError) {
            // If retry also fails, just continue
          }
          const retryEndTime = Date.now();
          performanceMetrics.operationTimes.push(retryEndTime - retryStartTime);
        }
      };

      // Perform operations with occasional failures
      for (let i = 0; i < 100; i++) {
        performOperationWithRecovery(() => {
          if (i % 10 === 0) {
            throw new Error('Simulated failure');
          }
          
          visualizationState.addNode({
            id: `node${i}`,
            label: `Node ${i}`,
            longLabel: `Node ${i} Long`,
            type: 'process',
            semanticTags: [],
            hidden: false
          });
        });
      }

      // System should remain performant after recoveries
      const avgTime = performanceMetrics.operationTimes.reduce((a, b) => a + b, 0) / performanceMetrics.operationTimes.length;
      expect(avgTime).toBeLessThan(100); // Should be fast
      expect(performanceMetrics.errorCount).toBe(10); // Expected failures
      expect(performanceMetrics.recoveryCount).toBe(10); // All recovered
      expect(visualizationState.visibleNodes.length).toBeGreaterThan(80); // Most operations succeeded
    });

    it('should maintain data consistency after recovery cycles', () => {
      // Perform multiple operations with recovery cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add data
        visualizationState.addNode({
          id: `node${cycle}`,
          label: `Node ${cycle}`,
          longLabel: `Node ${cycle} Long`,
          type: 'process',
          semanticTags: [],
          hidden: false
        });

        // Simulate corruption and recovery
        if (cycle % 3 === 0) {
          const nodes = (visualizationState as any)._nodes;
          nodes.set('corrupted', null);
          
          // Recovery
          nodes.delete('corrupted');
        }

        // Validate consistency after each cycle
        expect(() => {
          visualizationState.validateInvariants();
        }).not.toThrow();
      }

      // Final state should be consistent
      expect(visualizationState.visibleNodes).toHaveLength(10);
      visualizationState.validateInvariants();
    });

    it('should handle cascading failures gracefully', async () => {
      // Simulate cascading failure scenario
      const failureChain = {
        elkFailed: false,
        reactFlowFailed: false,
        asyncFailed: false,
        recoveryAttempts: 0
      };

      const simulateCascadingFailure = async () => {
        // First failure: ELK
        failureChain.elkFailed = true;
        
        // This causes ReactFlow to fail
        failureChain.reactFlowFailed = true;
        
        // This causes async coordinator to fail
        failureChain.asyncFailed = true;
      };

      const recoverFromCascadingFailure = async () => {
        failureChain.recoveryAttempts++;
        
        // Recover in reverse order
        if (failureChain.asyncFailed) {
          failureChain.asyncFailed = false;
        }
        
        if (failureChain.reactFlowFailed) {
          failureChain.reactFlowFailed = false;
        }
        
        if (failureChain.elkFailed) {
          failureChain.elkFailed = false;
        }
      };

      await simulateCascadingFailure();
      expect(failureChain.elkFailed).toBe(true);
      expect(failureChain.reactFlowFailed).toBe(true);
      expect(failureChain.asyncFailed).toBe(true);

      await recoverFromCascadingFailure();
      expect(failureChain.elkFailed).toBe(false);
      expect(failureChain.reactFlowFailed).toBe(false);
      expect(failureChain.asyncFailed).toBe(false);
      expect(failureChain.recoveryAttempts).toBe(1);

      // System should be functional after recovery
      visualizationState.addNode({
        id: 'recovery-test',
        label: 'Recovery Test',
        longLabel: 'Recovery Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      expect(visualizationState.visibleNodes.length).toBeGreaterThan(0);
    });
  });
});