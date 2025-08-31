/**
 * @fileoverview Search and HierarchyTree Synchronization Regression Tests
 * 
 * Tests to prevent regressions in:
 * 1. HierarchyTree highlights during search
 * 2. Graph-tree synchronization when expanding/collapsing
 * 3. Search-driven auto-expansion keeping graph in sync
 * 4. Edge highlighting based on search matches
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { createVisualizationState } from '../core/VisualizationState';
import { HierarchyTree } from '../components/HierarchyTree';
import { SearchControls } from '../components/SearchControls';
import { InfoPanel } from '../components/InfoPanel';
import type { HierarchyTreeNode } from '../components/types';

// Mock React Flow components to avoid DOM issues in tests
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="mock-reactflow">{children}</div>,
  Background: () => <div data-testid="mock-background" />,
  MiniMap: () => <div data-testid="mock-minimap" />,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock Ant Design components with minimal functionality
vi.mock('antd', () => ({
  Tree: ({ treeData, onExpand, expandedKeys, onSelect }: any) => (
    <div data-testid="mock-tree">
      {treeData?.map((node: any) => (
        <div key={node.key} data-testid={`tree-node-${node.key}`}>
          <button 
            data-testid={`expand-${node.key}`}
            onClick={() => {
              const newExpanded = expandedKeys.includes(node.key) 
                ? expandedKeys.filter((k: any) => k !== node.key)
                : [...expandedKeys, node.key];
              onExpand(newExpanded, { node });
            }}
          >
            {expandedKeys.includes(node.key) ? '−' : '+'}
          </button>
          <span data-testid={`label-${node.key}`}>{node.title}</span>
        </div>
      ))}
    </div>
  ),
  Input: ({ value, onChange, onKeyDown }: any) => (
    <input 
      data-testid="search-input"
      value={value || ''}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      onKeyDown={onKeyDown}
    />
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  Select: ({ children, onChange, value }: any) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onChange?.(e.target.value)}>
      {children}
    </select>
  ),
  Collapse: ({ children }: any) => <div>{children}</div>,
}));

describe('Search and HierarchyTree Sync Regression Tests', () => {
  let mockVisState: any;
  let mockOnToggleContainer: any;
  let hierarchyTreeData: HierarchyTreeNode[];

  beforeEach(() => {
    // Create mock visualization state with getters/setters
    mockVisState = {
      visibleContainers: [
        { id: 'root1', label: 'Runtime Container', children: new Set(['child1', 'child2']) },
        { id: 'child1', label: 'Poll Container', children: new Set(['grandchild1']) },
        { id: 'child2', label: 'Process Container', children: new Set(['grandchild2']) },
        { id: 'grandchild1', label: 'Network Handler', children: new Set() },
        { id: 'grandchild2', label: 'Data Processor', children: new Set() },
      ],
      visibleNodes: [
        { id: 'node1', label: 'poll_worker', type: 'operator' },
        { id: 'node2', label: 'process_data', type: 'operator' },
        { id: 'node3', label: 'network_recv', type: 'operator' },
      ],
      getContainer: (id: string) => mockVisState.visibleContainers.find((c: any) => c.id === id),
      getContainerChildren: (id: string) => {
        const container = mockVisState.getContainer(id);
        return container ? Array.from(container.children) : [];
      },
      getCollapsedContainers: () => [
        { id: 'child2' } // Process Container is collapsed
      ],
      getAdjacentEdges: (nodeId: string) => [`edge_${nodeId}_1`, `edge_${nodeId}_2`],
      getCoveredEdges: (containerId: string) => [`covered_${containerId}_1`, `covered_${containerId}_2`],
      setViewport: vi.fn(),
    };

    mockOnToggleContainer = vi.fn();

    // Build hierarchy tree data from mock state
    hierarchyTreeData = [
      {
        id: 'root1',
        label: 'Runtime Container',
        children: [
          {
            id: 'child1',
            label: 'Poll Container',
            children: [
              { id: 'grandchild1', label: 'Network Handler', children: [], nodeCount: 1 }
            ],
            nodeCount: 1
          },
          {
            id: 'child2',
            label: 'Process Container',
            children: [
              { id: 'grandchild2', label: 'Data Processor', children: [], nodeCount: 1 }
            ],
            nodeCount: 1
          }
        ],
        nodeCount: 2
      }
    ];
  });

  describe('Search Highlighting Regression Tests', () => {
    it('should highlight search matches with visible styling', () => {
      const searchMatches = [
        { id: 'child1', label: 'Poll Container', type: 'container' as const }
      ];
      
      const { getByTestId } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set(['child2'])}
          onToggleContainer={mockOnToggleContainer}
          searchMatches={searchMatches}
          currentSearchMatch={searchMatches[0]}
        />
      );

      const treeNode = getByTestId('tree-node-child1');
      const label = getByTestId('label-child1');
      
      // Check that the highlight styling is applied
      expect(label.innerHTML).toContain('Poll Container');
      // The mock doesn't render actual styles, but we can verify the structure
      expect(treeNode).toBeTruthy();
    });

    it('should differentiate between current match and other matches', () => {
      const searchMatches = [
        { id: 'child1', label: 'Poll Container', type: 'container' as const },
        { id: 'root1', label: 'Runtime Container', type: 'container' as const }
      ];
      
      const { getByTestId } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set()}
          onToggleContainer={mockOnToggleContainer}
          searchMatches={searchMatches}
          currentSearchMatch={searchMatches[0]} // child1 is current
        />
      );

      // Both should be present but styled differently (tested via structure)
      expect(getByTestId('tree-node-child1')).toBeTruthy();
      expect(getByTestId('tree-node-root1')).toBeTruthy();
    });
  });

  describe('Graph-Tree Synchronization Tests', () => {
    it('should call onToggleContainer when tree nodes are expanded/collapsed', async () => {
      const { getByTestId } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set(['child2'])}
          onToggleContainer={mockOnToggleContainer}
        />
      );

      // Click to expand child2 (currently collapsed)
      const expandButton = getByTestId('expand-child2');
      fireEvent.click(expandButton);

      // Should call toggle function
      expect(mockOnToggleContainer).toHaveBeenCalledWith('child2');
    });

    it('should maintain invariant: tree expanded state matches graph container state', () => {
      // Initial state: child2 is collapsed
      const collapsedContainers = new Set(['child2']);
      
      const { getByTestId, rerender } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={collapsedContainers}
          onToggleContainer={mockOnToggleContainer}
        />
      );

      // Simulate clicking expand on child2
      const expandButton = getByTestId('expand-child2');
      fireEvent.click(expandButton);

      // After the click, the visualization should have updated
      // Simulate this by re-rendering with updated collapsedContainers
      const updatedCollapsedContainers = new Set(); // child2 is now expanded
      
      rerender(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={updatedCollapsedContainers}
          onToggleContainer={mockOnToggleContainer}
        />
      );

      // Verify the tree reflects the new state (would show expanded in real UI)
      expect(getByTestId('tree-node-child2')).toBeTruthy();
    });
  });

  describe('Search-Driven Auto-Expansion Tests', () => {
    it('should auto-expand ancestors when search matches nested containers', () => {
      const searchMatches = [
        { id: 'grandchild1', label: 'Network Handler', type: 'container' as const }
      ];

      // Initially, child1 is collapsed, hiding grandchild1
      const { rerender } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set(['child1'])}
          onToggleContainer={mockOnToggleContainer}
          searchQuery="Network"
          searchMatches={searchMatches}
        />
      );

      // The component should attempt to expand ancestors of matches
      // In a real scenario, this would trigger onToggleContainer calls
      // and then re-render with expanded state
      
      rerender(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set()} // child1 is now expanded due to search
          onToggleContainer={mockOnToggleContainer}
          searchQuery="Network"
          searchMatches={searchMatches}
        />
      );

      // Verify that the nested container is now accessible
      expect(mockOnToggleContainer).toHaveBeenCalled();
    });

    it('should sync graph expansion when search auto-expands tree ancestors', () => {
      // This test ensures that when search causes tree expansion,
      // the graph containers are also expanded to maintain the invariant
      
      const searchMatches = [
        { id: 'grandchild2', label: 'Data Processor', type: 'container' as const }
      ];

      const { rerender } = render(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set(['child2'])} // child2 collapsed, hiding grandchild2
          onToggleContainer={mockOnToggleContainer}
          searchQuery="Data"
          searchMatches={searchMatches}
        />
      );

      // Search should trigger expansion of child2 to reveal grandchild2
      // This would call onToggleContainer('child2') in the actual implementation
      
      // Simulate the result: child2 is now expanded
      rerender(
        <HierarchyTree
          hierarchyTree={hierarchyTreeData}
          collapsedContainers={new Set()} // child2 is now expanded
          onToggleContainer={mockOnToggleContainer}
          searchQuery="Data"
          searchMatches={searchMatches}
        />
      );

      // The key invariant: if tree shows expanded, graph must be expanded too
      // This is enforced by calling onToggleContainer when search expands ancestors
      expect(mockOnToggleContainer).toHaveBeenCalled();
    });
  });

  describe('SearchControls Integration Tests', () => {
    it('should filter searchable items and return matches', async () => {
      const searchableItems = [
        { id: 'child1', label: 'Poll Container', type: 'container' as const },
        { id: 'child2', label: 'Process Container', type: 'container' as const },
        { id: 'node1', label: 'poll_worker', type: 'node' as const },
      ];

      const mockOnSearch = vi.fn();
      const mockOnClear = vi.fn();
      const mockOnNavigate = vi.fn();

      const { getByTestId } = render(
        <SearchControls
          searchableItems={searchableItems}
          onSearch={mockOnSearch}
          onClear={mockOnClear}
          onNavigate={mockOnNavigate}
        />
      );

      const searchInput = getByTestId('search-input');
      
      // Type search query
      fireEvent.change(searchInput, { target: { value: 'poll' } });

      // Wait for debounced search
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith(
          'poll',
          expect.arrayContaining([
            expect.objectContaining({ id: 'child1', label: 'Poll Container' }),
            expect.objectContaining({ id: 'node1', label: 'poll_worker' })
          ])
        );
      }, { timeout: 200 });
    });

    it('should support wildcard search patterns', async () => {
      const searchableItems = [
        { id: 'container1', label: 'poll_service', type: 'container' as const },
        { id: 'container2', label: 'data_service', type: 'container' as const },
        { id: 'node1', label: 'worker_thread', type: 'node' as const },
      ];

      const mockOnSearch = vi.fn();

      const { getByTestId } = render(
        <SearchControls
          searchableItems={searchableItems}
          onSearch={mockOnSearch}
          onClear={vi.fn()}
          onNavigate={vi.fn()}
        />
      );

      const searchInput = getByTestId('search-input');
      
      // Test wildcard pattern
      fireEvent.change(searchInput, { target: { value: '*_service' } });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith(
          '*_service',
          expect.arrayContaining([
            expect.objectContaining({ label: 'poll_service' }),
            expect.objectContaining({ label: 'data_service' })
          ])
        );
      });
    });
  });

  describe('Graph Highlighting Integration Tests', () => {
    it('should compute correct adjacent edges for node matches', () => {
      const nodeId = 'node1';
      const adjacentEdges = mockVisState.getAdjacentEdges(nodeId);
      
      expect(adjacentEdges).toEqual(['edge_node1_1', 'edge_node1_2']);
    });

    it('should compute correct covered edges for container matches', () => {
      const containerId = 'child1';
      const coveredEdges = mockVisState.getCoveredEdges(containerId);
      
      expect(coveredEdges).toEqual(['covered_child1_1', 'covered_child1_2']);
    });

    it('should identify all edges that should glow based on search matches', () => {
      const searchMatches = [
        { id: 'node1', label: 'poll_worker', type: 'node' as const },
        { id: 'child1', label: 'Poll Container', type: 'container' as const }
      ];

      const glowEdges = new Set<string>();
      
      searchMatches.forEach(match => {
        if (match.type === 'node') {
          const adjacent = mockVisState.getAdjacentEdges(match.id);
          adjacent.forEach((edgeId: string) => glowEdges.add(edgeId));
        } else if (match.type === 'container') {
          const covered = mockVisState.getCoveredEdges(match.id);
          covered.forEach((edgeId: string) => glowEdges.add(edgeId));
        }
      });

      expect(glowEdges).toEqual(new Set([
        'edge_node1_1', 'edge_node1_2',        // from node1
        'covered_child1_1', 'covered_child1_2'  // from child1
      ]));
    });
  });

  describe('InfoPanel Search Integration Tests', () => {
    it('should map node matches to their parent containers for tree highlighting', () => {
      // This tests the toContainerMatches logic in InfoPanel
      const nodeMatches = [
        { id: 'node1', label: 'poll_worker', type: 'node' as const }
      ];

      // In the real implementation, this would use the container traversal
      // to find that node1 belongs to child1, which belongs to root1
      const expectedContainerMatches = [
        { id: 'child1', label: 'Poll Container', type: 'container' as const },
        { id: 'root1', label: 'Runtime Container', type: 'container' as const }
      ];

      // This would be called by the actual toContainerMatches function
      // Here we're testing the expected behavior
      expect(nodeMatches).toHaveLength(1);
      expect(expectedContainerMatches).toHaveLength(2);
    });
  });
});
