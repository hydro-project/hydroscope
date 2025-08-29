/**
 * Test for label toggle functionality in HydroscopeMini
 */

import { describe, it, expect } from 'vitest';
import { VisualizationState } from '../core/VisualizationState';

describe('Node Label Toggle', () => {
  it('should toggle between shortLabel and fullLabel when node is clicked', () => {
    // Create a test visualization state
    const state = new VisualizationState();
    
    // Add a node with both short and full labels
    state.addGraphNode('test-node', {
      label: 'Short',
      shortLabel: 'Short',
      fullLabel: 'This is the full expanded label text',
      x: 100,
      y: 100
    });
    
    // Verify initial state
    const initialNode = state.getGraphNode('test-node');
    expect(initialNode).toBeDefined();
    expect(initialNode.label).toBe('Short');
    expect(initialNode.shortLabel).toBe('Short');
    expect(initialNode.fullLabel).toBe('This is the full expanded label text');
    
    // Simulate the label toggle logic (first click - should show full label)
    const currentLabel = initialNode.label || initialNode.shortLabel;
    const isShowingShort = currentLabel === initialNode.shortLabel;
    const hasDistinctLabels = !!(initialNode.fullLabel && initialNode.shortLabel && initialNode.fullLabel !== initialNode.shortLabel);
    
    // Should be able to toggle since labels are distinct
    expect(hasDistinctLabels).toBe(true);
    
    const newLabel = isShowingShort ? initialNode.fullLabel : initialNode.shortLabel;
    
    // Update the node with the new label
    state.updateNode('test-node', { label: newLabel });
    
    // Verify the label was toggled
    const updatedNode = state.getGraphNode('test-node');
    expect(updatedNode.label).toBe('This is the full expanded label text');
    
    // Simulate second click (should show short label again)
    const currentLabel2 = updatedNode.label || updatedNode.shortLabel;
    const isShowingShort2 = currentLabel2 === updatedNode.shortLabel;
    const newLabel2 = isShowingShort2 ? updatedNode.fullLabel : updatedNode.shortLabel;
    
    state.updateNode('test-node', { label: newLabel2 });
    
    // Verify it toggled back
    const finalNode = state.getGraphNode('test-node');
    expect(finalNode.label).toBe('Short');
  });

  it('should not toggle if node has no fullLabel different from shortLabel', () => {
    // Create a test visualization state
    const state = new VisualizationState();
    
    // Add a node with only shortLabel
    state.addGraphNode('test-node-short-only', {
      label: 'Short Only',
      shortLabel: 'Short Only',
      x: 100,
      y: 100
    });
    
    const node = state.getGraphNode('test-node-short-only');
    expect(node).toBeDefined();
    expect(node.label).toBe('Short Only');
    
    // The VisualizationState derives fullLabel from other fields when not provided
    // In this case, fullLabel will be derived from label, which is the same as shortLabel
    expect(node.fullLabel).toBe('Short Only');
    expect(node.shortLabel).toBe('Short Only');
    
    // Since fullLabel and shortLabel are the same, the toggle logic should recognize
    // this as not having meaningful different labels to toggle between
    const hasDistinctLabels = !!(node.fullLabel && node.shortLabel && node.fullLabel !== node.shortLabel);
    expect(hasDistinctLabels).toBe(false);
  });

  it('should handle nodes with only fullLabel', () => {
    const state = new VisualizationState();
    
    // Add a node with only fullLabel (edge case)
    state.addGraphNode('test-node-full-only', {
      fullLabel: 'Full Label Only',
      x: 100,
      y: 100
    });
    
    const node = state.getGraphNode('test-node-full-only');
    expect(node).toBeDefined();
    
    // Based on the VisualizationState.addGraphNode logic:
    // shortLabel should default to label or id if not provided
    // In this case, fullLabel exists but shortLabel should be derived
    expect(node.fullLabel).toBe('Full Label Only');
    expect(node.shortLabel).toBeDefined(); // Should be derived
  });
});
