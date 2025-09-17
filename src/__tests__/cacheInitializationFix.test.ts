/**
 * Test to verify that cache initialization fix prevents React rendering issues
 * while maintaining proper parent relationship caching.
 */

import { describe, it, expect } from 'vitest';
import { createVisualizationState } from '../core/VisualizationState';

describe('Cache Initialization Fix', () => {
  it('should initialize caches proactively when data is loaded', () => {
    const state = createVisualizationState();

    // Add some data
    state.addGraphNode('node1', { label: 'Node 1' });
    state.addGraphNode('node2', { label: 'Node 2' });
    state.addContainer('container1', { label: 'Container 1', children: ['node1', 'node2'] });

    // Caches should not be initialized yet (lazy initialization)
    expect((state as any)._cacheInitialized).toBe(false);

    // Calling ensureCachesInitialized should initialize them
    state.ensureCachesInitialized();
    expect((state as any)._cacheInitialized).toBe(true);

    // Subsequent calls should be no-ops
    state.ensureCachesInitialized();
    expect((state as any)._cacheInitialized).toBe(true);
  });

  it('should invalidate caches when data changes', () => {
    const state = createVisualizationState();

    // Add initial data and initialize caches
    state.addGraphNode('node1', { label: 'Node 1' });
    state.ensureCachesInitialized();
    expect((state as any)._cacheInitialized).toBe(true);

    // Adding new data should invalidate caches
    state.addGraphNode('node2', { label: 'Node 2' });
    expect((state as any)._cacheInitialized).toBe(false);

    // Same for containers
    state.ensureCachesInitialized();
    expect((state as any)._cacheInitialized).toBe(true);

    state.addContainer('container1', { label: 'Container 1' });
    expect((state as any)._cacheInitialized).toBe(false);

    // Same for container children
    state.ensureCachesInitialized();
    expect((state as any)._cacheInitialized).toBe(true);

    state.addContainerChild('container1', 'node1');
    expect((state as any)._cacheInitialized).toBe(false);
  });

  it('should work correctly with getSearchExpansionKeys after cache initialization', () => {
    const state = createVisualizationState();

    // Build a simple hierarchy
    state.addGraphNode('node1', { label: 'Node 1' });
    state.addGraphNode('node2', { label: 'Node 2' });
    state.addContainer('parent', { label: 'Parent Container' });
    state.addContainer('child', { label: 'Child Container' });

    state.addContainerChild('parent', 'child');
    state.addContainerChild('child', 'node1');
    state.addContainerChild('child', 'node2');

    // Initialize caches proactively
    state.ensureCachesInitialized();

    // Now getSearchExpansionKeys should work without calling _initializeCaches
    const searchMatches = [{ id: 'node1', type: 'node' as const }];
    const collapsed = new Set(['parent', 'child']);

    const expansionKeys = state.getSearchExpansionKeys(searchMatches, collapsed);

    // Should expand both parent and child to show node1
    expect(expansionKeys).toContain('parent');
    expect(expansionKeys).toContain('child');
  });

  it('should warn but still work if getSearchExpansionKeys is called before cache initialization', () => {
    const state = createVisualizationState();

    // Build hierarchy but don't initialize caches
    state.addGraphNode('node1', { label: 'Node 1' });
    state.addContainer('container1', { label: 'Container 1' });
    state.addContainerChild('container1', 'node1');

    // Don't call ensureCachesInitialized()
    expect((state as any)._cacheInitialized).toBe(false);

    // Mock console.warn to capture the warning
    const originalWarn = console.warn;
    let warningMessage = '';
    console.warn = (message: string) => {
      warningMessage = message;
    };

    try {
      const searchMatches = [{ id: 'node1', type: 'node' as const }];
      const collapsed = new Set(['container1']);

      const expansionKeys = state.getSearchExpansionKeys(searchMatches, collapsed);

      // Should still work correctly
      expect(expansionKeys).toContain('container1');

      // Should have warned about the issue
      expect(warningMessage).toContain('getSearchExpansionKeys called before caches initialized');
    } finally {
      console.warn = originalWarn;
    }
  });
});
