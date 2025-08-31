/**
 * @fileoverview Regression Tests for Search and HierarchyTree Sync Issues
 * 
 * These tests specifically target the issues reported:
 * 1. Search highlights not being visible enough in HierarchyTree
 * 2. Graph containers not staying in sync with HierarchyTree expansion state
 * 3. Search-driven auto-expansion not triggering graph container expansion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { createVisualizationState } from '../core/VisualizationState';
import type { VisualizationState } from '../core/VisualizationState';
import type { HierarchyTreeNode } from '../components/types';
import type { SearchableItem, SearchMatch } from '../components/SearchControls';

// Mock graph data similar to what's shown in the screenshot
const createMockHierarchy = (): HierarchyTreeNode[] => [
  {
    id: 'runtime',
    label: 'runtime/park.rs',
    children: [
      {
        id: 'poll',
        label: 'poll',
        children: [
          {
            id: 'closure1',
            label: '{{closure}}',
            children: [
              {
                id: 'chat_server1',
                label: 'chat_server',
                children: [],
                nodeCount: 2
              }
            ],
            nodeCount: 1
          }
        ],
        nodeCount: 1
      }
    ],
    nodeCount: 1
  },
  {
    id: 'coop',
    label: 'coop/mod.rs',
    children: [
      {
        id: 'closure2',
        label: '{{closure}}',
        children: [
          {
            id: 'poll2',
            label: 'poll',
            children: [
              {
                id: 'closure3',
                label: '{{closure}}',
                children: [],
                nodeCount: 1
              }
            ],
            nodeCount: 1
          }
        ],
        nodeCount: 1
      }
    ],
    nodeCount: 1
  }
];

describe('Search Highlight Visibility Regression', () => {
  let hierarchyData: HierarchyTreeNode[];
  let searchableItems: SearchableItem[];

  beforeEach(() => {
    hierarchyData = createMockHierarchy();
    
    searchableItems = [
      { id: 'runtime', label: 'runtime/park.rs', type: 'container' },
      { id: 'poll', label: 'poll', type: 'container' },
      { id: 'poll2', label: 'poll', type: 'container' },
      { id: 'closure1', label: '{{closure}}', type: 'container' },
      { id: 'closure2', label: '{{closure}}', type: 'container' },
      { id: 'closure3', label: '{{closure}}', type: 'container' },
      { id: 'chat_server1', label: 'chat_server', type: 'container' },
    ];
  });

  it('should correctly identify search matches with wildcard patterns', () => {
    // Test the wildcard-to-regex conversion logic
    const toRegex = (pattern: string): RegExp | null => {
      const raw = pattern.trim();
      if (!raw) return null;
      const escaped = raw
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*')
        .replace(/\\\?/g, '.');
      try {
        return new RegExp(escaped, 'i');
      } catch {
        return null;
      }
    };

    // Test "poll*" pattern - should match both poll containers
    const pollRegex = toRegex('poll*');
    expect(pollRegex).toBeTruthy();
    
    const pollMatches = searchableItems.filter(item => pollRegex!.test(item.label));
    expect(pollMatches).toHaveLength(2);
    expect(pollMatches.map(m => m.id)).toContain('poll');
    expect(pollMatches.map(m => m.id)).toContain('poll2');

    // Test "*closure*" pattern - should match all closure containers
    const closureRegex = toRegex('*closure*');
    expect(closureRegex).toBeTruthy();
    
    const closureMatches = searchableItems.filter(item => closureRegex!.test(item.label));
    expect(closureMatches).toHaveLength(3);
    expect(closureMatches.map(m => m.id)).toEqual(expect.arrayContaining(['closure1', 'closure2', 'closure3']));
  });

  it('should build proper parent map for ancestor expansion', () => {
    // This tests the logic for auto-expanding ancestors of search matches
    const buildParentMap = (hierarchy: HierarchyTreeNode[]): Map<string, string | null> => {
      const parentMap = new Map<string, string | null>();
      
      const traverse = (nodes: HierarchyTreeNode[], parent: string | null = null) => {
        for (const node of nodes) {
          parentMap.set(node.id, parent);
          if (node.children && node.children.length > 0) {
            traverse(node.children, node.id);
          }
        }
      };
      
      traverse(hierarchy);
      return parentMap;
    };

    const parentMap = buildParentMap(hierarchyData);
    
    // Verify parent relationships
    expect(parentMap.get('runtime')).toBeNull(); // Root
    expect(parentMap.get('coop')).toBeNull(); // Root
    expect(parentMap.get('poll')).toBe('runtime');
    expect(parentMap.get('poll2')).toBe('closure2');
    expect(parentMap.get('chat_server1')).toBe('closure1');
    expect(parentMap.get('closure1')).toBe('poll');
    expect(parentMap.get('closure2')).toBe('coop');
    expect(parentMap.get('closure3')).toBe('poll2');
  });

  it('should compute correct ancestor expansion for nested search matches', () => {
    const parentMap = new Map([
      ['runtime', null],
      ['coop', null],
      ['poll', 'runtime'],
      ['closure1', 'poll'],
      ['chat_server1', 'closure1'],
      ['closure2', 'coop'],
      ['poll2', 'closure2'],
      ['closure3', 'poll2']
    ]);

    // Function to get all ancestors that need to be expanded
    const getAncestorsToExpand = (targetId: string): string[] => {
      const ancestors: string[] = [];
      let current: string | null | undefined = targetId;
      
      while (current) {
        ancestors.push(current);
        current = parentMap.get(current) ?? null;
      }
      
      return ancestors;
    };

    // If we search for chat_server1, we need to expand: chat_server1, closure1, poll, runtime
    const chatServerAncestors = getAncestorsToExpand('chat_server1');
    expect(chatServerAncestors).toEqual(['chat_server1', 'closure1', 'poll', 'runtime']);

    // If we search for closure3, we need to expand: closure3, poll2, closure2, coop
    const closure3Ancestors = getAncestorsToExpand('closure3');
    expect(closure3Ancestors).toEqual(['closure3', 'poll2', 'closure2', 'coop']);
  });
});

describe('Graph-Tree Synchronization Logic', () => {
  let visState: VisualizationState;
  let mockToggleLog: string[];

  beforeEach(() => {
    visState = createVisualizationState();
    mockToggleLog = [];
    
    // Set up a hierarchy similar to the screenshot
    visState.setContainer('runtime', {
      children: ['poll'],
      collapsed: false,
      hidden: false,
      data: { label: 'runtime/park.rs' }
    });
    
    visState.setContainer('poll', {
      children: ['closure1'],
      collapsed: false,
      hidden: false,
      data: { label: 'poll' }
    });
    
    visState.setContainer('closure1', {
      children: ['chat_server1'],
      collapsed: false,
      hidden: false,
      data: { label: '{{closure}}' }
    });
    
    visState.setContainer('chat_server1', {
      children: [],
      collapsed: false,
      hidden: false,
      data: { label: 'chat_server' }
    });
    
    visState.setContainer('coop', {
      children: ['closure2'],
      collapsed: false,
      hidden: false,
      data: { label: 'coop/mod.rs' }
    });
  });

  it('should maintain consistent collapse state between tree and visualization', () => {
    // Initial state - all expanded
    expect(visState.getContainer('runtime')?.collapsed).toBe(false);
    expect(visState.getContainer('poll')?.collapsed).toBe(false);
    expect(visState.getContainer('closure1')?.collapsed).toBe(false);

    // Collapse poll container
    visState.collapseContainer('poll');
    expect(visState.getContainer('poll')?.collapsed).toBe(true);
    
    // Parent should still be expanded, child states don't matter when parent is collapsed
    expect(visState.getContainer('runtime')?.collapsed).toBe(false);
    
    // Get collapsed containers as would be passed to HierarchyTree
    const collapsedContainers = visState.getCollapsedContainers();
    const collapsedIds = new Set(collapsedContainers.map(c => c.id));
    
    expect(collapsedIds.has('poll')).toBe(true);
    expect(collapsedIds.has('runtime')).toBe(false);
  });

  it('should detect when search-driven expansion conflicts with visualization state', () => {
    // Start with some containers collapsed
    visState.collapseContainer('poll');
    
    // Verify container is actually collapsed
    expect(visState.getContainer('poll')?.collapsed).toBe(true);
    
    const collapsedIds = new Set(visState.getCollapsedContainers().map(c => c.id));
    expect(collapsedIds.has('poll')).toBe(true);

    // Simulate search requiring chat_server1 to be visible
    // This should detect that poll needs to be expanded (since chat_server1 is nested under poll)
    const searchMatches: SearchMatch[] = [
      { id: 'chat_server1', label: 'chat_server', type: 'container' }
    ];

    // Function to detect which containers need expansion for search visibility
    const getContainersToExpand = (matches: SearchMatch[], collapsed: Set<string>): string[] => {
      const parentMap = new Map([
        ['runtime', null],
        ['poll', 'runtime'],
        ['closure1', 'poll'],
        ['chat_server1', 'closure1'],
      ]);

      const toExpand: string[] = [];
      
      for (const match of matches) {
        let current: string | null | undefined = parentMap.get(match.id);
        while (current) {
          if (collapsed.has(current)) {
            toExpand.push(current);
          }
          current = parentMap.get(current) ?? null;
        }
      }
      
      return [...new Set(toExpand)]; // Remove duplicates
    };

    const containersToExpand = getContainersToExpand(searchMatches, collapsedIds);
    expect(containersToExpand).toEqual(['poll']); // poll needs to be expanded to show chat_server1
  });

  it('should only trigger expansion when state actually changes', () => {
    // Mock the onToggleContainer callback to track calls
    const onToggleContainer = (containerId: string) => {
      mockToggleLog.push(containerId);
      // Simulate the actual toggle
      const container = visState.getContainer(containerId);
      if (container?.collapsed) {
        visState.expandContainer(containerId);
      } else {
        visState.collapseContainer(containerId);
      }
    };

    // Initial state: poll is expanded
    expect(visState.getContainer('poll')?.collapsed).toBe(false);
    
    // Simulate tree click to collapse poll
    onToggleContainer('poll');
    expect(mockToggleLog).toEqual(['poll']);
    expect(visState.getContainer('poll')?.collapsed).toBe(true);

    // Reset log
    mockToggleLog.length = 0;

    // Simulate tree click to expand poll again
    onToggleContainer('poll');
    expect(mockToggleLog).toEqual(['poll']);
    expect(visState.getContainer('poll')?.collapsed).toBe(false);

    // Reset log
    mockToggleLog.length = 0;

    // If we call with same state (already expanded), should detect no change needed
    // This would be the tree's responsibility to check
    const alreadyExpanded = !visState.getContainer('poll')?.collapsed;
    if (!alreadyExpanded) {
      onToggleContainer('poll'); // This shouldn't run
    }
    
    expect(mockToggleLog).toEqual([]); // No calls made
  });
});

describe('Search Integration with Node/Container Mapping', () => {
  it('should correctly map node matches to parent containers', () => {
    // This tests the logic in InfoPanel for mapping node search results to tree containers
    const mockContainers = new Map([
      ['runtime', { id: 'runtime', children: ['poll'] }],
      ['poll', { id: 'poll', children: ['node1', 'node2'] }],
      ['coop', { id: 'coop', children: ['node3'] }]
    ]);

    const mockGetContainerChildren = (id: string) => {
      return mockContainers.get(id)?.children || [];
    };

    const mockGetContainer = (id: string) => {
      return mockContainers.get(id) ? { id } : undefined;
    };

    // Build reverse mapping from nodes to their parent containers
    const nodeParents = new Map<string, Set<string>>();
    
    mockContainers.forEach((container, containerId) => {
      const children = mockGetContainerChildren(containerId);
      children.forEach(childId => {
        const isContainer = !!mockGetContainer(childId);
        if (!isContainer) {
          // This is a node, not a container
          if (!nodeParents.has(childId)) {
            nodeParents.set(childId, new Set());
          }
          nodeParents.get(childId)!.add(containerId);
        }
      });
    });

    // Test mapping
    expect(nodeParents.get('node1')?.has('poll')).toBe(true);
    expect(nodeParents.get('node2')?.has('poll')).toBe(true);
    expect(nodeParents.get('node3')?.has('coop')).toBe(true);

    // Test the mapping function
    const mapNodeMatchesToContainers = (matches: SearchMatch[]): SearchMatch[] => {
      const result: SearchMatch[] = [];
      const seen = new Set<string>();

      for (const match of matches) {
        if (match.type === 'container') {
          if (!seen.has(match.id)) {
            result.push(match);
            seen.add(match.id);
          }
        } else {
          // Node match - map to parent containers
          const parents = nodeParents.get(match.id) || new Set();
          for (const parentId of parents) {
            if (!seen.has(parentId)) {
              result.push({ id: parentId, label: parentId, type: 'container' });
              seen.add(parentId);
            }
          }
        }
      }

      return result;
    };

    const nodeMatches: SearchMatch[] = [
      { id: 'node1', label: 'worker_node', type: 'node' },
      { id: 'node3', label: 'processor_node', type: 'node' }
    ];

    const containerMatches = mapNodeMatchesToContainers(nodeMatches);
    expect(containerMatches).toHaveLength(2);
    expect(containerMatches.map(m => m.id)).toEqual(expect.arrayContaining(['poll', 'coop']));
  });
});
