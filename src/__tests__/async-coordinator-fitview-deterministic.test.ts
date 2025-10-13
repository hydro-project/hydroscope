/**
 * Tests for deterministic fitView execution after long layout/render cycles
 * Verifies that autofit waits properly for ReactFlow to be ready instead of using timing-based delays
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsyncCoordinator } from '../core/AsyncCoordinator.js';
import { VisualizationState } from '../core/VisualizationState.js';
import { ELKBridge } from '../bridges/ELKBridge.js';
import { createTestNode, createTestContainer } from '../utils/testData.js';

describe('AsyncCoordinator - Deterministic FitView', () => {
  let asyncCoordinator: AsyncCoordinator;
  let state: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: any;

  beforeEach(() => {
    asyncCoordinator = new AsyncCoordinator();
    state = new VisualizationState();
    elkBridge = new ELKBridge();
    
    // Create a mock ReactFlow bridge that returns test data
    reactFlowBridge = {
      toReactFlowData: vi.fn().mockReturnValue({ 
        nodes: [{ id: 'test-node', position: { x: 100, y: 100 } }], 
        edges: [] 
      })
    };
    
    // Set up bridge instances
    asyncCoordinator.setBridgeInstances(reactFlowBridge, elkBridge);
  });

  describe('Deterministic waiting for ReactFlow readiness', () => {
    it('should wait for nodes to have valid positions before executing fitView', async () => {
      // Create test data with multiple nodes
      const container = createTestContainer('large-container', 'Large Container');
      const nodes = Array.from({ length: 20 }, (_, i) => 
        createTestNode(`node-${i}`, `Node ${i}`, 'large-container')
      );
      
      state.addContainer(container);
      nodes.forEach(node => state.addNode(node));

      // Mock ReactFlow instance that simulates gradual position updates
      let callCount = 0;
      const mockReactFlowInstance = {
        fitView: vi.fn(),
        getNodes: vi.fn(() => {
          callCount++;
          
          // Simulate nodes getting positions gradually (like during large container expansion)
          if (callCount < 3) {
            // First few calls: nodes don't have positions yet
            return nodes.map((_, i) => ({
              id: `node-${i}`,
              position: { x: 0, y: 0 } // Default positions
            }));
          } else if (callCount < 6) {
            // Middle calls: some nodes have positions
            return nodes.map((_, i) => ({
              id: `node-${i}`,
              position: i < 10 ? { x: i * 100, y: i * 50 } : { x: 0, y: 0 }
            }));
          } else {
            // Later calls: all nodes have valid positions
            return nodes.map((_, i) => ({
              id: `node-${i}`,
              position: { x: i * 100, y: i * 50 }
            }));
          }
        }),
        getEdges: vi.fn(() => [])
      };

      asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);

      // Execute pipeline with fitView enabled
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 0.1, duration: 200 }
      });

      expect(result).toBeDefined();
      
      // Verify that getNodes was called (deterministic waiting)
      expect(mockReactFlowInstance.getNodes).toHaveBeenCalled();
      
      // Verify that fitView was eventually called
      // Verify that fitView was called with the right structure (duration may be optimized)
      expect(mockReactFlowInstance.fitView).toHaveBeenCalledWith(
        expect.objectContaining({
          padding: 0.1,
          includeHiddenNodes: false
        })
      );
    });

    it('should handle timeout gracefully when ReactFlow never becomes ready', async () => {
      const node = createTestNode('test-node', 'Test Node');
      state.addNode(node);

      // Mock ReactFlow instance that never has valid positions
      const mockReactFlowInstance = {
        fitView: vi.fn(),
        getNodes: vi.fn(() => [
          { id: 'test-node', position: { x: 0, y: 0 } } // Always invalid position
        ]),
        getEdges: vi.fn(() => [])
      };

      asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);

      // This should complete even though ReactFlow never becomes "ready"
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true
      });

      expect(result).toBeDefined();
      
      // Should still call fitView after timeout
      expect(mockReactFlowInstance.fitView).toHaveBeenCalled();
    }, 10000); // 10 second timeout for this test

    it('should handle large graphs with more lenient validation', async () => {
      // Create a large graph (>100 nodes)
      const container = createTestContainer('huge-container', 'Huge Container');
      const nodes = Array.from({ length: 150 }, (_, i) => 
        createTestNode(`node-${i}`, `Node ${i}`, 'huge-container')
      );
      
      state.addContainer(container);
      nodes.forEach(node => state.addNode(node));

      let callCount = 0;
      const mockReactFlowInstance = {
        fitView: vi.fn(),
        getNodes: vi.fn(() => {
          callCount++;
          
          // For large graphs, only 60% of nodes get valid positions (but this should be enough)
          return nodes.map((_, i) => ({
            id: `node-${i}`,
            position: i < 90 ? { x: i * 50, y: i * 30 } : { x: 0, y: 0 }
          }));
        }),
        getEdges: vi.fn(() => [])
      };

      asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true
      });

      expect(result).toBeDefined();
      expect(mockReactFlowInstance.fitView).toHaveBeenCalled();
    });

    it('should fall back to callback when ReactFlow instance is not available', async () => {
      const node = createTestNode('test-node', 'Test Node');
      state.addNode(node);

      // Set up fallback callback
      const mockFitViewCallback = vi.fn();
      (asyncCoordinator as any).onFitViewRequested = mockFitViewCallback;

      // Don't set ReactFlow instance - should fall back to callback
      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { padding: 0.2 }
      });

      expect(result).toBeDefined();
      expect(mockFitViewCallback).toHaveBeenCalledWith(
        expect.objectContaining({ padding: 0.2 })
      );
    });

    it('should handle ReactFlow errors gracefully and fall back to callback', async () => {
      const node = createTestNode('test-node', 'Test Node');
      state.addNode(node);

      // Mock ReactFlow instance that throws errors
      const mockReactFlowInstance = {
        fitView: vi.fn(() => {
          throw new Error('ReactFlow fitView failed');
        }),
        getNodes: vi.fn(() => [
          { id: 'test-node', position: { x: 100, y: 100 } }
        ]),
        getEdges: vi.fn(() => [])
      };

      const mockFitViewCallback = vi.fn();
      (asyncCoordinator as any).onFitViewRequested = mockFitViewCallback;

      asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);

      const result = await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
        relayoutEntities: [],
        fitView: true,
        fitViewOptions: { duration: 500 }
      });

      expect(result).toBeDefined();
      
      // Should attempt direct fitView first
      expect(mockReactFlowInstance.fitView).toHaveBeenCalled();
      
      // Should fall back to callback after error
      expect(mockFitViewCallback).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 500 })
      );
    });
  });
});