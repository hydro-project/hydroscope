import { describe, it, expect, beforeEach } from 'vitest'
import { VisualizationState } from '../core/VisualizationState.js'
import type { GraphNode, GraphEdge, Container } from '../types/core.js'

describe('VisualizationState Container Visibility and Edge Aggregation', () => {
  let state: VisualizationState

  beforeEach(() => {
    state = new VisualizationState()
  })

  describe('Container Collapse/Expand Operations', () => {
    it('should collapse container and hide children', () => {
      const nodes = ['n1', 'n2'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      nodes.forEach(node => state.addNode(node))
      state.addContainer(container)

      // Initially expanded - children should be visible
      expect(state.getGraphNode('n1')?.hidden).toBe(false)
      expect(state.getGraphNode('n2')?.hidden).toBe(false)
      expect(state.getContainer('c1')?.collapsed).toBe(false)

      // Collapse container
      state.collapseContainer('c1')

      // Children should be hidden, container should be collapsed
      expect(state.getGraphNode('n1')?.hidden).toBe(true)
      expect(state.getGraphNode('n2')?.hidden).toBe(true)
      expect(state.getContainer('c1')?.collapsed).toBe(true)
    })

    it('should expand container and show children', () => {
      const nodes = ['n1', 'n2'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: true, // Start collapsed
        hidden: false
      }

      nodes.forEach(node => state.addNode(node))
      state.addContainer(container)

      // Initially collapsed - children should be hidden
      expect(state.getGraphNode('n1')?.hidden).toBe(true)
      expect(state.getGraphNode('n2')?.hidden).toBe(true)
      expect(state.getContainer('c1')?.collapsed).toBe(true)

      // Expand container
      state.expandContainer('c1')

      // Children should be visible, container should be expanded
      expect(state.getGraphNode('n1')?.hidden).toBe(false)
      expect(state.getGraphNode('n2')?.hidden).toBe(false)
      expect(state.getContainer('c1')?.collapsed).toBe(false)
    })

    it('should handle nested container collapse/expand', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: [],
        hidden: false
      }

      const childContainer: Container = {
        id: 'child',
        label: 'Child Container',
        children: new Set(['n1']),
        collapsed: false,
        hidden: false
      }

      const parentContainer: Container = {
        id: 'parent',
        label: 'Parent Container',
        children: new Set(['child']),
        collapsed: false,
        hidden: false
      }

      state.addNode(node)
      state.addContainer(childContainer)
      state.addContainer(parentContainer)

      // Collapse parent - should hide child container and its contents
      state.collapseContainer('parent')

      expect(state.getContainer('parent')?.collapsed).toBe(true)
      expect(state.getContainer('child')?.hidden).toBe(true)
      expect(state.getContainer('child')?.collapsed).toBe(true)
      expect(state.getGraphNode('n1')?.hidden).toBe(true)
    })
  })

  describe('Edge Aggregation During Container Operations', () => {
    it('should aggregate edges when container is collapsed', () => {
      // Create nodes
      const nodes = ['n1', 'n2', 'n3'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      // Create container with n1, n2 inside
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      // Create edges: n3 -> n1, n3 -> n2
      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'n3',
          target: 'n1',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        },
        {
          id: 'e2',
          source: 'n3',
          target: 'n2',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        }
      ]

      nodes.forEach(node => state.addNode(node))
      state.addContainer(container)
      edges.forEach(edge => state.addEdge(edge))

      // Initially expanded - original edges should be visible
      expect(state.getGraphEdge('e1')?.hidden).toBe(false)
      expect(state.getGraphEdge('e2')?.hidden).toBe(false)
      expect(state.getAggregatedEdges()).toHaveLength(0)

      // Collapse container - edges should be aggregated
      state.collapseContainer('c1')

      // Original edges should be hidden
      expect(state.getGraphEdge('e1')?.hidden).toBe(true)
      expect(state.getGraphEdge('e2')?.hidden).toBe(true)

      // Should have aggregated edge from n3 to c1
      const aggregatedEdges = state.getAggregatedEdges()
      expect(aggregatedEdges).toHaveLength(1)
      expect(aggregatedEdges[0].source).toBe('n3')
      expect(aggregatedEdges[0].target).toBe('c1')
      expect(aggregatedEdges[0].originalEdgeIds).toEqual(['e1', 'e2'])
      expect(aggregatedEdges[0].aggregationSource).toBe('c1')
    })

    it('should restore edges when container is expanded', () => {
      // Create nodes
      const nodes = ['n1', 'n2', 'n3'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      // Create container with n1, n2 inside
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: true, // Start collapsed
        hidden: false
      }

      // Create edges: n3 -> n1, n3 -> n2
      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'n3',
          target: 'n1',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        },
        {
          id: 'e2',
          source: 'n3',
          target: 'n2',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        }
      ]

      nodes.forEach(node => state.addNode(node))
      state.addContainer(container)
      edges.forEach(edge => state.addEdge(edge))

      // Container starts collapsed - should have aggregated edges
      expect(state.getAggregatedEdges()).toHaveLength(1)

      // Expand container - should restore original edges
      state.expandContainer('c1')

      // Original edges should be visible again
      expect(state.getGraphEdge('e1')?.hidden).toBe(false)
      expect(state.getGraphEdge('e2')?.hidden).toBe(false)

      // Aggregated edges should be removed
      expect(state.getAggregatedEdges()).toHaveLength(0)
    })

    it('should handle edges between containers', () => {
      // Create nodes
      const nodes = ['n1', 'n2', 'n3', 'n4'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      // Create containers
      const container1: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      const container2: Container = {
        id: 'c2',
        label: 'Container 2',
        children: new Set(['n3', 'n4']),
        collapsed: false,
        hidden: false
      }

      // Create edges between containers: n1 -> n3, n2 -> n4
      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n3',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n4',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        }
      ]

      nodes.forEach(node => state.addNode(node))
      state.addContainer(container1)
      state.addContainer(container2)
      edges.forEach(edge => state.addEdge(edge))

      // Collapse both containers
      state.collapseContainer('c1')
      state.collapseContainer('c2')

      // Should have aggregated edge from c1 to c2
      const aggregatedEdges = state.getAggregatedEdges()
      expect(aggregatedEdges).toHaveLength(1)
      expect(aggregatedEdges[0].source).toBe('c1')
      expect(aggregatedEdges[0].target).toBe('c2')
      expect(aggregatedEdges[0].originalEdgeIds).toEqual(['e1', 'e2'])
    })
  })

  describe('Bulk Operations', () => {
    it('should expand all containers atomically', () => {
      const nodes = ['n1', 'n2', 'n3', 'n4'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const containers: Container[] = [
        {
          id: 'c1',
          label: 'Container 1',
          children: new Set(['n1', 'n2']),
          collapsed: true,
          hidden: false
        },
        {
          id: 'c2',
          label: 'Container 2',
          children: new Set(['n3', 'n4']),
          collapsed: true,
          hidden: false
        }
      ]

      nodes.forEach(node => state.addNode(node))
      containers.forEach(container => state.addContainer(container))

      // All containers should be collapsed initially
      expect(state.getContainer('c1')?.collapsed).toBe(true)
      expect(state.getContainer('c2')?.collapsed).toBe(true)

      // Expand all containers
      state.expandAllContainers()

      // All containers should be expanded
      expect(state.getContainer('c1')?.collapsed).toBe(false)
      expect(state.getContainer('c2')?.collapsed).toBe(false)

      // All nodes should be visible
      nodes.forEach(node => {
        expect(state.getGraphNode(node.id)?.hidden).toBe(false)
      })
    })

    it('should collapse all containers atomically', () => {
      const nodes = ['n1', 'n2', 'n3', 'n4'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const containers: Container[] = [
        {
          id: 'c1',
          label: 'Container 1',
          children: new Set(['n1', 'n2']),
          collapsed: false,
          hidden: false
        },
        {
          id: 'c2',
          label: 'Container 2',
          children: new Set(['n3', 'n4']),
          collapsed: false,
          hidden: false
        }
      ]

      nodes.forEach(node => state.addNode(node))
      containers.forEach(container => state.addContainer(container))

      // All containers should be expanded initially
      expect(state.getContainer('c1')?.collapsed).toBe(false)
      expect(state.getContainer('c2')?.collapsed).toBe(false)

      // Collapse all containers
      state.collapseAllContainers()

      // All containers should be collapsed
      expect(state.getContainer('c1')?.collapsed).toBe(true)
      expect(state.getContainer('c2')?.collapsed).toBe(true)

      // All nodes should be hidden
      nodes.forEach(node => {
        expect(state.getGraphNode(node.id)?.hidden).toBe(true)
      })
    })
  })

  describe('Complex Edge Aggregation Scenarios', () => {
    it('should handle multi-container edge aggregation', () => {
      // Create a complex scenario with multiple containers and cross-container edges
      const nodes = ['n1', 'n2', 'n3', 'n4', 'n5'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const containers: Container[] = [
        {
          id: 'c1',
          label: 'Container 1',
          children: new Set(['n1', 'n2']),
          collapsed: false,
          hidden: false
        },
        {
          id: 'c2',
          label: 'Container 2',
          children: new Set(['n3', 'n4']),
          collapsed: false,
          hidden: false
        }
      ]

      // Complex edge pattern: n5 -> n1, n5 -> n3, n1 -> n4, n2 -> n3
      const edges: GraphEdge[] = [
        { id: 'e1', source: 'n5', target: 'n1', type: 'dataflow', semanticTags: [], hidden: false },
        { id: 'e2', source: 'n5', target: 'n3', type: 'dataflow', semanticTags: [], hidden: false },
        { id: 'e3', source: 'n1', target: 'n4', type: 'dataflow', semanticTags: [], hidden: false },
        { id: 'e4', source: 'n2', target: 'n3', type: 'dataflow', semanticTags: [], hidden: false }
      ]

      nodes.forEach(node => state.addNode(node))
      containers.forEach(container => state.addContainer(container))
      edges.forEach(edge => state.addEdge(edge))

      // Collapse c1 only
      state.collapseContainer('c1')

      const aggregatedEdges = state.getAggregatedEdges()
      
      // Should have aggregated edges:
      // - n5 -> c1 (from e1: n5 -> n1)
      // - c1 -> n4 (from e3: n1 -> n4)  
      // - c1 -> n3 (from e4: n2 -> n3)
      expect(aggregatedEdges).toHaveLength(3)
      
      // Check specific aggregations
      const n5ToC1 = aggregatedEdges.find(e => e.source === 'n5' && e.target === 'c1')
      expect(n5ToC1).toBeDefined()
      expect(n5ToC1?.originalEdgeIds).toEqual(['e1'])

      const c1ToN4 = aggregatedEdges.find(e => e.source === 'c1' && e.target === 'n4')
      expect(c1ToN4).toBeDefined()
      expect(c1ToN4?.originalEdgeIds).toEqual(['e3'])

      const c1ToN3 = aggregatedEdges.find(e => e.source === 'c1' && e.target === 'n3')
      expect(c1ToN3).toBeDefined()
      expect(c1ToN3?.originalEdgeIds).toEqual(['e4'])
    })

    it('should handle nested container edge aggregation', () => {
      const nodes = ['n1', 'n2', 'n3'].map(id => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: 'process',
        semanticTags: [],
        hidden: false
      }))

      const childContainer: Container = {
        id: 'child',
        label: 'Child Container',
        children: new Set(['n1']),
        collapsed: false,
        hidden: false
      }

      const parentContainer: Container = {
        id: 'parent',
        label: 'Parent Container',
        children: new Set(['child', 'n2']),
        collapsed: false,
        hidden: false
      }

      // Edge from outside to inside nested container: n3 -> n1
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n3',
        target: 'n1',
        type: 'dataflow',
        semanticTags: [],
        hidden: false
      }

      nodes.forEach(node => state.addNode(node))
      state.addContainer(childContainer)
      state.addContainer(parentContainer)
      state.addEdge(edge)

      // Collapse parent container
      state.collapseContainer('parent')

      // Should aggregate edge from n3 to parent container
      const aggregatedEdges = state.getAggregatedEdges()
      expect(aggregatedEdges).toHaveLength(1)
      expect(aggregatedEdges[0].source).toBe('n3')
      expect(aggregatedEdges[0].target).toBe('parent')
      expect(aggregatedEdges[0].originalEdgeIds).toEqual(['e1'])
    })
  })
})