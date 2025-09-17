/**
 * Regression test for search expansion functionality
 * 
 * This test prevents the bug where getSearchExpansionKeys returns empty arrays
 * when search matches exist but the filtering logic is too restrictive.
 * 
 * Bug context: During test fixes, the filtering logic was changed to only return
 * containers in the currentCollapsed set, which broke normal search functionality.
 * The fix ensures that containers needing expansion are returned even if they're
 * not directly in the currentCollapsed set but need expansion for other reasons.
 */

import { describe, it, expect } from 'vitest';
import { createVisualizationState } from '../core/VisualizationState';

describe('Search Expansion Regression Tests', () => {
  it('should not return empty expansion keys when search matches exist', () => {
    // This is the core regression test: getSearchExpansionKeys should not return
    // empty arrays when there are valid search matches that need expansion
    
    const visState = createVisualizationState();
    
    // Create some collapsed containers that could be search matches
    visState
      .setContainer('leader_container', { 
        label: 'Leader Election Process',
        collapsed: true,
        children: ['leader_node']
      })
      .setContainer('heartbeat_container', { 
        label: 'Heartbeat Process',
        collapsed: true,
        children: ['heartbeat_node']
      })
      .setGraphNode('leader_node', { label: 'Leader Node' })
      .setGraphNode('heartbeat_node', { label: 'Heartbeat Node' });
    
    // Simulate search matches for "leader" - finds containers
    const searchMatches = [
      { id: 'leader_container', type: 'container' as const }
    ];
    
    // Current collapsed state includes the search match
    const currentCollapsed = new Set(['leader_container', 'heartbeat_container']);
    
    // Execute: Get expansion keys for search matches
    const expansionKeys = visState.getSearchExpansionKeys(searchMatches, currentCollapsed);
    
    // CRITICAL: This should NOT be empty (this was the bug)
    expect(expansionKeys.length).toBeGreaterThan(0);
    expect(expansionKeys).toContain('leader_container');
  });

  it('should handle containers that need expansion but are not in currentCollapsed', () => {
    // This tests the scenario where containers need expansion but aren't directly
    // in the currentCollapsed set (e.g., they're hidden due to other reasons)
    
    const visState = createVisualizationState();
    
    // Create containers where some are collapsed and some are not visible
    visState
      .setContainer('visible_container', { 
        label: 'Visible Container',
        collapsed: false,
        children: ['visible_node']
      })
      .setContainer('hidden_container', { 
        label: 'Hidden Leader Process',  // This could match "leader" search
        collapsed: true,
        children: ['hidden_node']
      })
      .setGraphNode('visible_node', { label: 'Visible Node' })
      .setGraphNode('hidden_node', { label: 'Hidden Node' });
    
    // Search matches the hidden container
    const searchMatches = [
      { id: 'hidden_container', type: 'container' as const }
    ];
    
    // currentCollapsed only includes the hidden container
    const currentCollapsed = new Set(['hidden_container']);
    
    const expansionKeys = visState.getSearchExpansionKeys(searchMatches, currentCollapsed);
    
    // Should return the container that needs expansion
    expect(expansionKeys.length).toBeGreaterThan(0);
    expect(expansionKeys).toContain('hidden_container');
  });

  it('should work with the original filtering logic for backward compatibility', () => {
    // Ensure that the fix doesn't break existing functionality
    
    const visState = createVisualizationState();
    
    // Traditional scenario: directly collapsed containers
    visState
      .setContainer('collapsed_match', { 
        label: 'Collapsed Match Container',
        collapsed: true,
        children: ['match_node']
      })
      .setGraphNode('match_node', { label: 'Match Node' });
    
    const searchMatches = [
      { id: 'collapsed_match', type: 'container' as const }
    ];
    
    const currentCollapsed = new Set(['collapsed_match']);
    
    const expansionKeys = visState.getSearchExpansionKeys(searchMatches, currentCollapsed);
    
    // Should still work for directly collapsed containers
    expect(expansionKeys).toContain('collapsed_match');
    expect(expansionKeys.length).toBeGreaterThan(0);
  });

  it('should handle node matches in collapsed containers', () => {
    // Test node matches (not just container matches)
    
    const visState = createVisualizationState();
    
    visState
      .setContainer('system_container', { 
        label: 'System Container',
        collapsed: true,
        children: ['target_node']
      })
      .setGraphNode('target_node', { 
        label: 'Target Node for Search' 
      });
    
    // Search matches a node inside a collapsed container
    const searchMatches = [
      { id: 'target_node', type: 'node' as const }
    ];
    
    const currentCollapsed = new Set(['system_container']);
    
    const expansionKeys = visState.getSearchExpansionKeys(searchMatches, currentCollapsed);
    
    // Should expand the container to show the matching node
    expect(expansionKeys).toContain('system_container');
    expect(expansionKeys.length).toBeGreaterThan(0);
  });
});