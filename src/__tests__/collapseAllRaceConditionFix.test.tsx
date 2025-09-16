/**
 * @fileoverview Test for collapse all race condition fix
 * 
 * This test verifies that the collapse all functionality doesn't create
 * duplicate layout operations that can cause race conditions and broken renders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState';
import { VisualizationEngine } from '../core/VisualizationEngine';
import { globalLayoutLock } from '../utils/globalLayoutLock';

describe('Collapse All Race Condition Fix', () => {
  let engine: VisualizationEngine;
  let visState: VisualizationState;
  let layoutSpy: any;

  beforeEach(() => {
    // Clear any existing locks
    globalLayoutLock.forceReleaseAll();
    globalLayoutLock.clearQueue();

    // Create visualization state directly
    visState = new VisualizationState();
    
    // Add nodes
    visState.setGraphNode('node1', { label: 'Node 1', hidden: false });
    visState.setGraphNode('node2', { label: 'Node 2', hidden: false });
    visState.setGraphNode('node3', { label: 'Node 3', hidden: false });
    visState.setGraphNode('node4', { label: 'Node 4', hidden: false });
    
    // Add edges
    visState.setGraphEdge('edge1', { source: 'node1', target: 'node2' });
    visState.setGraphEdge('edge2', { source: 'node2', target: 'node3' });
    
    // Add containers
    visState.setContainer('container1', { 
      label: 'Container 1', 
      collapsed: false, 
      hidden: false,
      nodes: ['node1', 'node2']
    });
    visState.setContainer('container2', { 
      label: 'Container 2', 
      collapsed: false, 
      hidden: false,
      nodes: ['node3', 'node4']
    });

    engine = new VisualizationEngine(visState);
    
    // Spy on the layout method to track how many times it's called
    layoutSpy = vi.spyOn(engine, 'runLayout');
  });

  afterEach(() => {
    layoutSpy?.mockRestore();
    globalLayoutLock.forceReleaseAll();
    globalLayoutLock.clearQueue();
  });

  it('should not trigger duplicate layouts when collapsing all containers', async () => {
    // Ensure containers are initially expanded
    const containers = visState.getVisibleContainers();
    expect(containers.length).toBeGreaterThan(0);
    expect(containers.every(c => !c.collapsed)).toBe(true);

    // Reset the spy to start counting from here
    layoutSpy.mockClear();

    // Call collapseAllContainers - this should trigger exactly one layout
    visState.collapseAllContainers();

    // Wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that layout was called exactly once
    // The old buggy behavior would call layout multiple times due to:
    // 1. collapseAllContainers() calling _resumeLayoutTriggers(true)
    // 2. handlePackAll() calling refreshLayout() afterwards
    expect(layoutSpy).toHaveBeenCalledTimes(1);

    // Verify containers are actually collapsed
    const collapsedContainers = visState.getVisibleContainers();
    expect(collapsedContainers.every(c => c.collapsed)).toBe(true);
  });

  it('should not trigger duplicate layouts when expanding all containers', async () => {
    // First collapse all containers
    visState.collapseAllContainers();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify they're collapsed
    const collapsedContainers = visState.getVisibleContainers();
    expect(collapsedContainers.every(c => c.collapsed)).toBe(true);

    // Reset the spy to start counting from here
    layoutSpy.mockClear();

    // Call expandAllContainers - this should trigger exactly one layout
    visState.expandAllContainers();

    // Wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that layout was called exactly once
    expect(layoutSpy).toHaveBeenCalledTimes(1);

    // Verify containers are actually expanded
    const expandedContainers = visState.getVisibleContainers();
    expect(expandedContainers.every(c => !c.collapsed)).toBe(true);
  });

  it('should handle rapid collapse/expand operations without race conditions', async () => {
    // Reset the spy
    layoutSpy.mockClear();

    // Perform separate collapse/expand operations with proper waits
    visState.collapseAllContainers();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    visState.expandAllContainers();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    visState.collapseAllContainers();
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have called layout exactly 3 times (once per operation)
    // The layout suspension system prevents duplicate calls within each operation
    expect(layoutSpy).toHaveBeenCalledTimes(3);

    // Final state should be collapsed
    const finalContainers = visState.getVisibleContainers();
    expect(finalContainers.every(c => c.collapsed)).toBe(true);
  });

  it('should not leave the global layout lock in a bad state', async () => {
    // Perform collapse operation
    visState.collapseAllContainers();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that the global layout lock is not stuck
    const lockStatus = globalLayoutLock.getStatus();
    expect(lockStatus.isLocked).toBe(false);
    expect(lockStatus.queueLength).toBe(0);
    expect(lockStatus.isProcessingQueue).toBe(false);
  });
});