import { describe, it, expect } from 'vitest';
import { createVisualizationState } from '../core/VisualizationState';

/**
 * Focused unit tests for getSearchExpansionKeys ensuring container matches themselves
 * are included (regression test for missing edges/nodes when searching container name).
 */

describe('VisualizationState.getSearchExpansionKeys', () => {
  function buildState() {
    const state = createVisualizationState()
      .setGraphNode('n1', { label: 'alpha' })
      .setGraphNode('n2', { label: 'beta' })
      .setGraphNode('n3', { label: 'gamma' })
      .setContainer('c_root', { children: ['n1', 'n2'], collapsed: true })
      .setContainer('c_child', { children: ['n3'], collapsed: true });

    // Make c_child a child of c_root
    state.addContainerChild('c_root', 'c_child');
    return state;
  }

  it('includes matched container itself plus ancestors', () => {
    const state = buildState();
    const matches = [{ id: 'c_child', type: 'container' as const }];
    const collapsed = new Set(['c_root', 'c_child']);

    const keys = state.getSearchExpansionKeys(matches, collapsed);

    expect(keys).toContain('c_child'); // regression: child container must be present
    // Ancestor should also be included so its subtree is visible
    expect(keys).toContain('c_root');
  });

  it('adds parent chain for node match', () => {
    const state = buildState();
    const matches = [{ id: 'n3', type: 'node' as const }];
    const collapsed = new Set(['c_root', 'c_child']);

    const keys = state.getSearchExpansionKeys(matches, collapsed);
    expect(keys).toContain('c_child');
    expect(keys).toContain('c_root');
  });

  it('returns all non-collapsed containers when no matches', () => {
    const state = buildState();
    // Mark root expanded; child collapsed
    state.setContainerState('c_root', { collapsed: false });
    const keys = state.getSearchExpansionKeys([], new Set(['c_child']));
    expect(keys).toContain('c_root');
    expect(keys).not.toContain('c_child');
  });
});
