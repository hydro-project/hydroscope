/**
 * Tests for VisualizationState interaction state management
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState.js';
import { createTestContainer, createTestNode, createTestEdge } from '../utils/testData.js';

describe('VisualizationState Interaction State Management', () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  describe('Node Label Toggle State', () => {
    it('should initialize nodes with short labels by default', () => {
      const node = createTestNode('node1', 'Short Label');
      node.longLabel = 'This is a much longer label with more details';
      
      state.addNode(node);
      
      const retrievedNode = state.getGraphNode('node1');
      expect(retrievedNode?.showingLongLabel).toBeFalsy();
    });

    it('should toggle node label from short to long', () => {
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      
      state.addNode(node);
      
      state.toggleNodeLabel('node1');
      
      const retrievedNode = state.getGraphNode('node1');
      expect(retrievedNode?.showingLongLabel).toBe(true);
    });

    it('should toggle node label from long back to short', () => {
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      
      state.addNode(node);
      
      // Toggle to long
      state.toggleNodeLabel('node1');
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      
      // Toggle back to short
      state.toggleNodeLabel('node1');
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(false);
    });

    it('should handle multiple node label toggles independently', () => {
      const node1 = createTestNode('node1', 'Short1');
      node1.longLabel = 'Long Label 1';
      const node2 = createTestNode('node2', 'Short2');
      node2.longLabel = 'Long Label 2';
      
      state.addNode(node1);
      state.addNode(node2);
      
      state.toggleNodeLabel('node1');
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      expect(state.getGraphNode('node2')?.showingLongLabel).toBeFalsy();
    });

    it('should set node label state explicitly', () => {
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      
      state.addNode(node);
      
      state.setNodeLabelState('node1', true);
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      
      state.setNodeLabelState('node1', false);
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(false);
    });

    it('should handle toggle on non-existent node gracefully', () => {
      expect(() => state.toggleNodeLabel('non-existent')).not.toThrow();
    });

    it('should handle nodes without long labels', () => {
      const node = createTestNode('node1', 'Only Short Label');
      // No longLabel set
      
      state.addNode(node);
      
      state.toggleNodeLabel('node1');
      
      // Should still toggle the state even if no longLabel
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });
  });

  describe('Container Click Handling', () => {
    it('should toggle container from collapsed to expanded', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1');
      
      state.addContainer(container);
      state.addNode(node);
      
      // Start collapsed
      state.collapseContainerSystemOperation('container1');
      expect(state.getContainer('container1')?.collapsed).toBe(true);
      
      // Toggle should expand
      state.toggleContainer('container1');
      expect(state.getContainer('container1')?.collapsed).toBe(false);
    });

    it('should toggle container from expanded to collapsed', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1');
      
      state.addContainer(container);
      state.addNode(node);
      
      // Start expanded
      expect(state.getContainer('container1')?.collapsed).toBe(false);
      
      // Toggle should collapse
      state.toggleContainer('container1');
      expect(state.getContainer('container1')?.collapsed).toBe(true);
    });

    it('should handle toggle on non-existent container gracefully', () => {
      expect(() => state.toggleContainer('non-existent')).not.toThrow();
    });

    it('should disable smart collapse when user toggles container', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1');
      
      state.addContainer(container);
      state.addNode(node);
      
      expect(state.shouldRunSmartCollapse()).toBe(true);
      
      state.toggleContainer('container1');
      
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });

  describe('Interaction State Persistence', () => {
    it('should persist node label states across container operations', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      
      state.addContainer(container);
      state.addNode(node);
      
      // Toggle node label
      state.toggleNodeLabel('node1');
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      
      // Collapse and expand container
      state.collapseContainer('container1');
      state.expandContainer('container1');
      
      // Node label state should persist
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });

    it('should maintain interaction state during edge aggregation', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      const externalNode = createTestNode('external');
      const edge = createTestEdge('edge1', 'node1', 'external');
      
      state.addContainer(container);
      state.addNode(node);
      state.addNode(externalNode);
      state.addEdge(edge);
      
      // Set node to show long label
      state.toggleNodeLabel('node1');
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      
      // Collapse container (triggers edge aggregation)
      state.collapseContainerSystemOperation('container1');
      
      // Node label state should persist even though node is hidden
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });

    it('should restore interaction state when loading from saved data', () => {
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      node.showingLongLabel = true; // Simulate loaded state
      
      state.addNode(node);
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });
  });

  describe('Interaction State Queries', () => {
    it('should get all nodes showing long labels', () => {
      const node1 = createTestNode('node1', 'Short1');
      node1.longLabel = 'Long1';
      const node2 = createTestNode('node2', 'Short2');
      node2.longLabel = 'Long2';
      const node3 = createTestNode('node3', 'Short3');
      node3.longLabel = 'Long3';
      
      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      
      state.toggleNodeLabel('node1');
      state.toggleNodeLabel('node3');
      
      const longLabelNodes = state.getNodesShowingLongLabels();
      expect(longLabelNodes.length).toBe(2);
      expect(longLabelNodes.map(n => n.id)).toContain('node1');
      expect(longLabelNodes.map(n => n.id)).toContain('node3');
    });

    it('should get interaction state summary', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long';
      
      state.addContainer(container);
      state.addNode(node);
      
      state.toggleNodeLabel('node1');
      state.collapseContainer('container1');
      
      const summary = state.getInteractionStateSummary();
      expect(summary.nodesWithLongLabels).toBe(1);
      expect(summary.collapsedContainers).toBe(1);
      expect(summary.expandedContainers).toBe(0);
    });
  });

  describe('Bulk Interaction Operations', () => {
    it('should reset all node labels to short', () => {
      const node1 = createTestNode('node1', 'Short1');
      node1.longLabel = 'Long1';
      const node2 = createTestNode('node2', 'Short2');
      node2.longLabel = 'Long2';
      
      state.addNode(node1);
      state.addNode(node2);
      
      state.toggleNodeLabel('node1');
      state.toggleNodeLabel('node2');
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      expect(state.getGraphNode('node2')?.showingLongLabel).toBe(true);
      
      state.resetAllNodeLabelsToShort();
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(false);
      expect(state.getGraphNode('node2')?.showingLongLabel).toBe(false);
    });

    it('should expand all node labels to long', () => {
      const node1 = createTestNode('node1', 'Short1');
      node1.longLabel = 'Long1';
      const node2 = createTestNode('node2', 'Short2');
      node2.longLabel = 'Long2';
      
      state.addNode(node1);
      state.addNode(node2);
      
      state.expandAllNodeLabelsToLong();
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
      expect(state.getGraphNode('node2')?.showingLongLabel).toBe(true);
    });
  });

  describe('Interaction State Validation', () => {
    it('should validate interaction state consistency', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long';
      
      state.addContainer(container);
      state.addNode(node);
      
      state.toggleNodeLabel('node1');
      state.toggleContainer('container1');
      
      const validation = state.validateInteractionState();
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect interaction state inconsistencies', () => {
      const node = createTestNode('node1', 'Short');
      // Remove longLabel but set showingLongLabel to true
      delete (node as any).longLabel;
      node.showingLongLabel = true;
      
      state.addNode(node);
      
      const validation = state.validateInteractionState();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Container Operations', () => {
    it('should maintain interaction state during complex container operations', () => {
      const parentContainer = createTestContainer('parent', ['child']);
      const childContainer = createTestContainer('child', ['node1']);
      const node = createTestNode('node1', 'Short');
      node.longLabel = 'Long Label';
      
      state.addContainer(parentContainer);
      state.addContainer(childContainer);
      state.addNode(node);
      
      // Set interaction states
      state.toggleNodeLabel('node1');
      
      // Complex container operations
      state.collapseContainer('parent');
      state.expandContainer('parent');
      state.toggleContainer('child');
      
      // Interaction state should be preserved
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });

    it('should handle interaction state during search operations', () => {
      const container = createTestContainer('container1', ['node1']);
      const node = createTestNode('node1', 'searchable');
      node.longLabel = 'Long searchable label';
      
      state.addContainer(container);
      state.addNode(node);
      
      // Set node to show long label
      state.toggleNodeLabel('node1');
      
      // Collapse container
      state.collapseContainerSystemOperation('container1');
      
      // Search should expand container but preserve label state
      state.search('searchable');
      state.expandContainerForSearch('container1');
      
      expect(state.getGraphNode('node1')?.showingLongLabel).toBe(true);
    });
  });
});