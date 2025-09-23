import { describe, it, expect, beforeEach } from 'vitest'
import { VisualizationState } from '../core/VisualizationState.js'
import type { GraphNode, GraphEdge, Container } from '../types/core.js'

describe('VisualizationState CRUD Operations', () => {
  let state: VisualizationState

  beforeEach(() => {
    state = new VisualizationState()
  })

  describe('Node CRUD Operations', () => {
    it('should add a node successfully', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addNode(node)
      
      const retrievedNode = state.getGraphNode('n1')
      expect(retrievedNode).toEqual(node)
    })

    it('should remove a node successfully', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addNode(node)
      state.removeNode('n1')
      
      const retrievedNode = state.getGraphNode('n1')
      expect(retrievedNode).toBeUndefined()
    })

    it('should update a node successfully', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addNode(node)
      
      const updatedNode: GraphNode = {
        ...node,
        label: 'Updated Node 1',
        semanticTags: ['tag1', 'tag2']
      }
      
      state.updateNode('n1', updatedNode)
      
      const retrievedNode = state.getGraphNode('n1')
      expect(retrievedNode?.label).toBe('Updated Node 1')
      expect(retrievedNode?.semanticTags).toEqual(['tag1', 'tag2'])
    })

    it('should validate node data on add', () => {
      const invalidNode = {
        id: '',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      } as GraphNode

      expect(() => state.addNode(invalidNode)).toThrow(/invalid.*id/i)
    })

    it('should validate node data on update', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addNode(node)

      const invalidUpdate = {
        ...node,
        label: ''
      }

      expect(() => state.updateNode('n1', invalidUpdate)).toThrow(/invalid.*label/i)
    })

    it('should handle non-existent node removal gracefully', () => {
      expect(() => state.removeNode('nonexistent')).not.toThrow()
    })

    it('should handle non-existent node update gracefully', () => {
      const node: GraphNode = {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      }

      expect(() => state.updateNode('nonexistent', node)).not.toThrow()
    })
  })

  describe('Edge CRUD Operations', () => {
    beforeEach(() => {
      // Add nodes for edge testing
      state.addNode({
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 Long Label',
        type: 'process',
        semanticTags: [],
        hidden: false
      })
      state.addNode({
        id: 'n2',
        label: 'Node 2',
        longLabel: 'Node 2 Long Label',
        type: 'process',
        semanticTags: [],
        hidden: false
      })
    })

    it('should add an edge successfully', () => {
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addEdge(edge)
      
      const retrievedEdge = state.getGraphEdge('e1')
      expect(retrievedEdge).toEqual(edge)
    })

    it('should remove an edge successfully', () => {
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addEdge(edge)
      state.removeEdge('e1')
      
      const retrievedEdge = state.getGraphEdge('e1')
      expect(retrievedEdge).toBeUndefined()
    })

    it('should update an edge successfully', () => {
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addEdge(edge)
      
      const updatedEdge: GraphEdge = {
        ...edge,
        type: 'control',
        semanticTags: ['tag1', 'tag2']
      }
      
      state.updateEdge('e1', updatedEdge)
      
      const retrievedEdge = state.getGraphEdge('e1')
      expect(retrievedEdge?.type).toBe('control')
      expect(retrievedEdge?.semanticTags).toEqual(['tag1', 'tag2'])
    })

    it('should validate edge data on add', () => {
      const invalidEdge = {
        id: '',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      } as GraphEdge

      expect(() => state.addEdge(invalidEdge)).toThrow(/invalid.*id/i)
    })

    it('should validate edge data on update', () => {
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      }

      state.addEdge(edge)

      const invalidUpdate = {
        ...edge,
        source: ''
      }

      expect(() => state.updateEdge('e1', invalidUpdate)).toThrow(/invalid.*source/i)
    })

    it('should handle non-existent edge removal gracefully', () => {
      expect(() => state.removeEdge('nonexistent')).not.toThrow()
    })

    it('should handle non-existent edge update gracefully', () => {
      const edge: GraphEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'dataflow',
        semanticTags: ['tag1'],
        hidden: false
      }

      expect(() => state.updateEdge('nonexistent', edge)).not.toThrow()
    })
  })

  describe('Container CRUD Operations', () => {
    it('should add a container successfully', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)
      
      const retrievedContainer = state.getContainer('c1')
      expect(retrievedContainer).toEqual(container)
    })

    it('should remove a container successfully', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)
      state.removeContainer('c1')
      
      const retrievedContainer = state.getContainer('c1')
      expect(retrievedContainer).toBeUndefined()
    })

    it('should update a container successfully', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)
      
      const updatedContainer: Container = {
        ...container,
        label: 'Updated Container 1',
        collapsed: true
      }
      
      state.updateContainer('c1', updatedContainer)
      
      const retrievedContainer = state.getContainer('c1')
      expect(retrievedContainer?.label).toBe('Updated Container 1')
      expect(retrievedContainer?.collapsed).toBe(true)
    })

    it('should validate container data on add', () => {
      const invalidContainer = {
        id: '',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      } as Container

      expect(() => state.addContainer(invalidContainer)).toThrow(/invalid.*id/i)
    })

    it('should validate container data on update', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)

      const invalidUpdate = {
        ...container,
        label: ''
      }

      expect(() => state.updateContainer('c1', invalidUpdate)).toThrow(/invalid.*label/i)
    })

    it('should handle non-existent container removal gracefully', () => {
      expect(() => state.removeContainer('nonexistent')).not.toThrow()
    })

    it('should handle non-existent container update gracefully', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      expect(() => state.updateContainer('nonexistent', container)).not.toThrow()
    })

    it('should update node-container mapping when adding container', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)
      
      expect(state.getNodeContainer('n1')).toBe('c1')
      expect(state.getNodeContainer('n2')).toBe('c1')
    })

    it('should clean up node-container mapping when removing container', () => {
      const container: Container = {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1', 'n2']),
        collapsed: false,
        hidden: false
      }

      state.addContainer(container)
      state.removeContainer('c1')
      
      expect(state.getNodeContainer('n1')).toBeUndefined()
      expect(state.getNodeContainer('n2')).toBeUndefined()
    })
  })

  describe('Error Cases and Edge Conditions', () => {
    describe('Node Error Cases', () => {
      it('should handle null/undefined node gracefully', () => {
        expect(() => state.addNode(null as any)).toThrow()
        expect(() => state.addNode(undefined as any)).toThrow()
      })

      it('should handle node with null/undefined properties', () => {
        expect(() => state.addNode({
          id: 'n1',
          label: null as any,
          longLabel: 'Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*label/i)
      })

      it('should handle node with empty semantic tags array', () => {
        const node: GraphNode = {
          id: 'n1',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        }

        expect(() => state.addNode(node)).not.toThrow()
        expect(state.getGraphNode('n1')?.semanticTags).toEqual([])
      })

      it('should handle node with whitespace-only id/label', () => {
        expect(() => state.addNode({
          id: '   ',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*id/i)

        expect(() => state.addNode({
          id: 'n1',
          label: '   ',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*label/i)
      })

      it('should handle duplicate node ids by overwriting', () => {
        const node1: GraphNode = {
          id: 'n1',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: ['tag1'],
          hidden: false
        }

        const node2: GraphNode = {
          id: 'n1',
          label: 'Node 1 Updated',
          longLabel: 'Node 1 Updated Long Label',
          type: 'process',
          semanticTags: ['tag2'],
          hidden: false
        }

        state.addNode(node1)
        state.addNode(node2)

        const retrieved = state.getGraphNode('n1')
        expect(retrieved?.label).toBe('Node 1 Updated')
        expect(retrieved?.semanticTags).toEqual(['tag2'])
      })
    })

    describe('Edge Error Cases', () => {
      it('should handle null/undefined edge gracefully', () => {
        expect(() => state.addEdge(null as any)).toThrow()
        expect(() => state.addEdge(undefined as any)).toThrow()
      })

      it('should handle edge with null/undefined properties', () => {
        expect(() => state.addEdge({
          id: 'e1',
          source: null as any,
          target: 'n2',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*source/i)

        expect(() => state.addEdge({
          id: 'e1',
          source: 'n1',
          target: null as any,
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*target/i)
      })

      it('should handle edge with whitespace-only source/target', () => {
        expect(() => state.addEdge({
          id: 'e1',
          source: '   ',
          target: 'n2',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*source/i)

        expect(() => state.addEdge({
          id: 'e1',
          source: 'n1',
          target: '   ',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        })).toThrow(/invalid.*target/i)
      })

      it('should handle self-referencing edges', () => {
        state.addNode({
          id: 'n1',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })

        const selfEdge: GraphEdge = {
          id: 'e1',
          source: 'n1',
          target: 'n1',
          type: 'dataflow',
          semanticTags: [],
          hidden: false
        }

        expect(() => state.addEdge(selfEdge)).not.toThrow()
        expect(state.getGraphEdge('e1')?.source).toBe('n1')
        expect(state.getGraphEdge('e1')?.target).toBe('n1')
      })

      it('should handle duplicate edge ids by overwriting', () => {
        state.addNode({
          id: 'n1',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })
        state.addNode({
          id: 'n2',
          label: 'Node 2',
          longLabel: 'Node 2 Long Label',
          type: 'process',
          semanticTags: [],
          hidden: false
        })

        const edge1: GraphEdge = {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          type: 'dataflow',
          semanticTags: ['tag1'],
          hidden: false
        }

        const edge2: GraphEdge = {
          id: 'e1',
          source: 'n2',
          target: 'n1',
          type: 'control',
          semanticTags: ['tag2'],
          hidden: false
        }

        state.addEdge(edge1)
        state.addEdge(edge2)

        const retrieved = state.getGraphEdge('e1')
        expect(retrieved?.source).toBe('n2')
        expect(retrieved?.target).toBe('n1')
        expect(retrieved?.type).toBe('control')
        expect(retrieved?.semanticTags).toEqual(['tag2'])
      })
    })

    describe('Container Error Cases', () => {
      it('should handle null/undefined container gracefully', () => {
        expect(() => state.addContainer(null as any)).toThrow()
        expect(() => state.addContainer(undefined as any)).toThrow()
      })

      it('should handle container with null/undefined properties', () => {
        expect(() => state.addContainer({
          id: 'c1',
          label: null as any,
          children: new Set(),
          collapsed: false,
          hidden: false
        })).toThrow(/invalid.*label/i)
      })

      it('should handle container with empty children set', () => {
        const container: Container = {
          id: 'c1',
          label: 'Container 1',
          children: new Set(),
          collapsed: false,
          hidden: false
        }

        expect(() => state.addContainer(container)).not.toThrow()
        expect(state.getContainer('c1')?.children.size).toBe(0)
      })

      it('should handle container with non-existent children', () => {
        const container: Container = {
          id: 'c1',
          label: 'Container 1',
          children: new Set(['nonexistent1', 'nonexistent2']),
          collapsed: false,
          hidden: false
        }

        expect(() => state.addContainer(container)).not.toThrow()
        expect(state.getNodeContainer('nonexistent1')).toBe('c1')
        expect(state.getNodeContainer('nonexistent2')).toBe('c1')
      })

      it('should handle duplicate container ids by overwriting', () => {
        const container1: Container = {
          id: 'c1',
          label: 'Container 1',
          children: new Set(['n1']),
          collapsed: false,
          hidden: false
        }

        const container2: Container = {
          id: 'c1',
          label: 'Container 1 Updated',
          children: new Set(['n2']),
          collapsed: true,
          hidden: true
        }

        state.addContainer(container1)
        state.addContainer(container2)

        const retrieved = state.getContainer('c1')
        expect(retrieved?.label).toBe('Container 1 Updated')
        expect(retrieved?.collapsed).toBe(true)
        expect(retrieved?.hidden).toBe(true)
        expect(retrieved?.children.has('n2')).toBe(true)
        expect(retrieved?.children.has('n1')).toBe(false)

        // Check node-container mappings were updated
        expect(state.getNodeContainer('n1')).toBeUndefined()
        expect(state.getNodeContainer('n2')).toBe('c1')
      })
    })

    describe('Concurrent Operations', () => {
      it('should handle rapid sequential operations', () => {
        // Add many nodes rapidly
        for (let i = 0; i < 100; i++) {
          state.addNode({
            id: `n${i}`,
            label: `Node ${i}`,
            longLabel: `Node ${i} Long Label`,
            type: 'process',
            semanticTags: [`tag${i}`],
            hidden: false
          })
        }

        // Verify all nodes were added
        for (let i = 0; i < 100; i++) {
          expect(state.getGraphNode(`n${i}`)).toBeDefined()
        }

        // Remove all nodes rapidly
        for (let i = 0; i < 100; i++) {
          state.removeNode(`n${i}`)
        }

        // Verify all nodes were removed
        for (let i = 0; i < 100; i++) {
          expect(state.getGraphNode(`n${i}`)).toBeUndefined()
        }
      })

      it('should handle mixed operations on same entities', () => {
        const node: GraphNode = {
          id: 'n1',
          label: 'Node 1',
          longLabel: 'Node 1 Long Label',
          type: 'process',
          semanticTags: ['tag1'],
          hidden: false
        }

        // Add, update, remove, add again
        state.addNode(node)
        expect(state.getGraphNode('n1')).toBeDefined()

        state.updateNode('n1', { ...node, label: 'Updated' })
        expect(state.getGraphNode('n1')?.label).toBe('Updated')

        state.removeNode('n1')
        expect(state.getGraphNode('n1')).toBeUndefined()

        state.addNode(node)
        expect(state.getGraphNode('n1')?.label).toBe('Node 1')
      })
    })
  })
})