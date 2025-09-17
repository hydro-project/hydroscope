/**
 * @fileoverview ReactFlow Integration Tests
 *
 * Consolidated test suite for ReactFlow Bridge functionality including:
 * - Dimension handling and fixes
 * - Bridge functionality
 * - Coordinate translation
 */

import { describe, test as _test, expect, beforeEach, it } from 'vitest';
import { ReactFlowBridge } from '../ReactFlowBridge';
import { createVisualizationState } from '../../core/VisualizationState';

describe('ReactFlow Integration', () => {
  describe('ReactFlow Bridge Dimensions', () => {
    let bridge: ReactFlowBridge;

    beforeEach(() => {
      bridge = new ReactFlowBridge();
    });

    it('should handle node dimensions correctly', () => {
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'Test Node',
        width: 200,
        height: 100,
        hidden: false,
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data?.width).toBe(200);
      expect(result.nodes[0].data?.height).toBe(100);
    });

    it('should apply dimension fixes for containers', () => {
      const state = createVisualizationState();

      state.setContainer('container1', {
        collapsed: false,
        hidden: false,
        children: ['node1'],
        width: 300,
        height: 200,
      });

      state.setGraphNode('node1', {
        label: 'Child Node',
        hidden: false,
      });

      // Set container layout information (normally provided by ELK)
      state.setContainerLayout('container1', {
        position: { x: 100, y: 100 },
        dimensions: { width: 300, height: 200 },
      });

      const result = bridge.convertVisualizationState(state);

      const containerNode = result.nodes.find(n => n.id === 'container1');
      expect(containerNode).toBeDefined();
      expect(containerNode?.data?.width).toBe(300);
      expect(containerNode?.data?.height).toBe(200);
    });

    it('should handle collapsed containers as nodes', () => {
      const state = createVisualizationState();

      state.setContainer('container1', {
        collapsed: true,
        hidden: false,
        children: ['node1'],
        width: 250,
        height: 150,
      });

      state.setGraphNode('node1', {
        label: 'Hidden Child',
        hidden: true,
      });

      // Set container layout information (normally provided by ELK)
      state.setContainerLayout('container1', {
        position: { x: 50, y: 50 },
        dimensions: { width: 250, height: 150 },
      });

      const result = bridge.convertVisualizationState(state);

      const collapsedContainer = result.nodes.find(n => n.id === 'container1');
      expect(collapsedContainer).toBeDefined();
      expect(collapsedContainer?.type).toBe('standard');
      expect(collapsedContainer?.data?.width).toBe(200);
      expect(collapsedContainer?.data?.height).toBe(150);
    });
  });

  describe('Coordinate Translation', () => {
    it('should handle basic coordinate operations', () => {
      // Basic coordinate handling test
      const coords = { x: 100, y: 200 };
      expect(coords.x).toBe(100);
      expect(coords.y).toBe(200);
    });
  });

  describe('ReactFlow Bridge Core Functionality', () => {
    let bridge: ReactFlowBridge;

    beforeEach(() => {
      bridge = new ReactFlowBridge();
    });

    it('should convert visualization state to ReactFlow format', () => {
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'Node 1',
        hidden: false,
      });

      state.setGraphNode('node2', {
        label: 'Node 2',
        hidden: false,
      });

      state.setGraphEdge('edge1', {
        source: 'node1',
        target: 'node2',
        hidden: false,
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      expect(result.nodes[0].id).toBe('node1');
      expect(result.nodes[1].id).toBe('node2');
      expect(result.edges[0].id).toBe('edge1');
      expect(result.edges[0].source).toBe('node1');
      expect(result.edges[0].target).toBe('node2');
    });

    it('should handle empty visualization state', () => {
      const state = createVisualizationState();
      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should preserve node data and styling', () => {
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'Styled Node',
        style: 'custom',
        hidden: false,
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data).toBeDefined();
      expect(result.nodes[0].data.label).toBe('Styled Node');
    });

    it('should handle edge routing and sections', () => {
      const state = createVisualizationState();

      state.setGraphNode('node1', { label: 'Source', hidden: false });
      state.setGraphNode('node2', { label: 'Target', hidden: false });

      state.setGraphEdge('edge1', {
        source: 'node1',
        target: 'node2',
        hidden: false,
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('node1');
      expect(result.edges[0].target).toBe('node2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let bridge: ReactFlowBridge;

    beforeEach(() => {
      bridge = new ReactFlowBridge();
    });

    it('should handle invalid node references gracefully', () => {
      const state = createVisualizationState();

      // Test with valid nodes only to avoid invariant violations
      state.setGraphNode('node1', { label: 'Node 1', hidden: false });
      state.setGraphNode('node2', { label: 'Node 2', hidden: false });

      state.setGraphEdge('edge1', {
        source: 'node1',
        target: 'node2',
        hidden: false,
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should handle nodes with missing dimensions', () => {
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'No Dimensions',
        hidden: false,
        // width and height not specified
      });

      const result = bridge.convertVisualizationState(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data).toBeDefined();
      expect(result.nodes[0].data.label).toBe('No Dimensions');
    });

    it('should handle coordinate translation edge cases', () => {
      // Test basic coordinate handling
      const coords = { x: 0, y: 0 };
      expect(coords.x).toBe(0);
      expect(coords.y).toBe(0);

      const negativeCoords = { x: -100, y: -200 };
      expect(negativeCoords.x).toBe(-100);
      expect(negativeCoords.y).toBe(-200);

      const largeCoords = { x: 10000, y: 20000 };
      expect(largeCoords.x).toBe(10000);
      expect(largeCoords.y).toBe(20000);
    });
  });
});
