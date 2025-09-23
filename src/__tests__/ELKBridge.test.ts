/**
 * Tests for ELKBridge - ELK layout format conversion
 * 
 * Tests the synchronous conversion from VisualizationState to ELK graph format
 * and application of ELK layout results back to VisualizationState
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ELKBridge } from '../bridges/ELKBridge'
import { VisualizationState } from '../core/VisualizationState'
import { createTestNode, createTestEdge, createTestContainer } from '../utils/testData'

describe('ELKBridge', () => {
  let bridge: ELKBridge
  let state: VisualizationState

  beforeEach(() => {
    bridge = new ELKBridge({
      algorithm: 'layered',
      direction: 'DOWN',
      spacing: 50
    })
    state = new VisualizationState()
  })

  describe('ELK format conversion', () => {
    it('should convert empty VisualizationState to empty ELK graph', () => {
      const elkGraph = bridge.toELKGraph(state)
      
      expect(elkGraph).toEqual({
        id: 'root',
        children: [],
        edges: [],
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '50'
        }
      })
    })

    it('should convert nodes to ELK children', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      
      state.addNode(node1)
      state.addNode(node2)
      
      const elkGraph = bridge.toELKGraph(state)
      
      expect(elkGraph.children).toHaveLength(2)
      expect(elkGraph.children).toEqual([
        {
          id: 'n1',
          width: 120,
          height: 60,
          labels: [{ text: 'Node 1' }]
        },
        {
          id: 'n2', 
          width: 120,
          height: 60,
          labels: [{ text: 'Node 2' }]
        }
      ])
    })

    it('should convert edges to ELK edges', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      const edge = createTestEdge('e1', 'n1', 'n2')
      
      state.addNode(node1)
      state.addNode(node2)
      state.addEdge(edge)
      
      const elkGraph = bridge.toELKGraph(state)
      
      expect(elkGraph.edges).toHaveLength(1)
      expect(elkGraph.edges[0]).toEqual({
        id: 'e1',
        sources: ['n1'],
        targets: ['n2']
      })
    })

    it('should handle collapsed containers as single nodes', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      const container = createTestContainer('c1', ['n1', 'n2'], 'Container 1')
      
      state.addNode(node1)
      state.addNode(node2)
      state.addContainer(container)
      state.collapseContainer('c1')
      
      const elkGraph = bridge.toELKGraph(state)
      
      // Should only show the container, not the internal nodes
      expect(elkGraph.children).toHaveLength(1)
      expect(elkGraph.children[0]).toEqual({
        id: 'c1',
        width: 150,
        height: 80,
        labels: [{ text: 'Container 1' }]
      })
    })

    it('should handle expanded containers with nested structure', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      const container = createTestContainer('c1', ['n1', 'n2'], 'Container 1')
      
      state.addNode(node1)
      state.addNode(node2)
      state.addContainer(container)
      // Container is expanded by default
      
      const elkGraph = bridge.toELKGraph(state)
      
      // Should show container with children
      expect(elkGraph.children).toHaveLength(1)
      expect(elkGraph.children[0]).toEqual({
        id: 'c1',
        width: 200,
        height: 150,
        labels: [{ text: 'Container 1' }],
        children: [
          {
            id: 'n1',
            width: 120,
            height: 60,
            labels: [{ text: 'Node 1' }]
          },
          {
            id: 'n2',
            width: 120,
            height: 60,
            labels: [{ text: 'Node 2' }]
          }
        ]
      })
    })

    it('should handle aggregated edges for collapsed containers', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      const node3 = createTestNode('n3', 'Node 3')
      const container = createTestContainer('c1', ['n1', 'n2'], 'Container 1')
      const edge1 = createTestEdge('e1', 'n1', 'n3') // Internal to external
      const edge2 = createTestEdge('e2', 'n3', 'n2') // External to internal
      
      state.addNode(node1)
      state.addNode(node2)
      state.addNode(node3)
      state.addContainer(container)
      state.addEdge(edge1)
      state.addEdge(edge2)
      state.collapseContainer('c1')
      
      const elkGraph = bridge.toELKGraph(state)
      
      // Should have aggregated edges to/from container (exact count depends on implementation)
      expect(elkGraph.edges.length).toBeGreaterThanOrEqual(2)
      
      // Check that we have edges involving the container and external node
      const hasContainerToN3 = elkGraph.edges.some(edge => 
        edge.sources.includes('c1') && edge.targets.includes('n3')
      )
      const hasN3ToContainer = elkGraph.edges.some(edge => 
        edge.sources.includes('n3') && edge.targets.includes('c1')
      )
      
      expect(hasContainerToN3 || hasN3ToContainer).toBe(true)
    })

    it('should apply layout configuration', () => {
      const customBridge = new ELKBridge({
        algorithm: 'force',
        direction: 'RIGHT',
        spacing: 100
      })
      
      const node1 = createTestNode('n1', 'Node 1')
      state.addNode(node1)
      
      const elkGraph = customBridge.toELKGraph(state)
      
      expect(elkGraph.layoutOptions).toEqual({
        'elk.algorithm': 'force',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '100'
      })
    })
  })

  describe('ELK result application', () => {
    it('should apply ELK layout results to node positions', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const node2 = createTestNode('n2', 'Node 2')
      
      state.addNode(node1)
      state.addNode(node2)
      
      const elkResult = {
        id: 'root',
        children: [
          { id: 'n1', x: 100, y: 50, width: 120, height: 60 },
          { id: 'n2', x: 300, y: 150, width: 120, height: 60 }
        ]
      }
      
      bridge.applyLayout(state, elkResult)
      
      const updatedNode1 = state.getGraphNode('n1')
      const updatedNode2 = state.getGraphNode('n2')
      
      expect(updatedNode1?.position).toEqual({ x: 100, y: 50 })
      expect(updatedNode2?.position).toEqual({ x: 300, y: 150 })
    })

    it('should apply container positions and dimensions', () => {
      const container = createTestContainer('c1', [], 'Container 1')
      state.addContainer(container)
      
      const elkResult = {
        id: 'root',
        children: [
          { 
            id: 'c1', 
            x: 200, 
            y: 100, 
            width: 250, 
            height: 180,
            children: []
          }
        ]
      }
      
      bridge.applyLayout(state, elkResult)
      
      const updatedContainer = state.getContainer('c1')
      expect(updatedContainer?.position).toEqual({ x: 200, y: 100 })
      expect(updatedContainer?.dimensions).toEqual({ width: 250, height: 180 })
    })

    it('should handle nested container layout results', () => {
      const node1 = createTestNode('n1', 'Node 1')
      const container = createTestContainer('c1', ['n1'], 'Container 1')
      
      state.addNode(node1)
      state.addContainer(container)
      
      const elkResult = {
        id: 'root',
        children: [
          {
            id: 'c1',
            x: 50,
            y: 25,
            width: 200,
            height: 150,
            children: [
              { id: 'n1', x: 75, y: 50, width: 120, height: 60 }
            ]
          }
        ]
      }
      
      bridge.applyLayout(state, elkResult)
      
      const updatedContainer = state.getContainer('c1')
      const updatedNode = state.getGraphNode('n1')
      
      expect(updatedContainer?.position).toEqual({ x: 50, y: 25 })
      expect(updatedNode?.position).toEqual({ x: 75, y: 50 })
    })

    it('should handle layout validation and error cases', () => {
      const node1 = createTestNode('n1', 'Node 1')
      state.addNode(node1)
      
      // Invalid ELK result - missing required properties
      const invalidResult = {
        id: 'root',
        children: [
          { id: 'n1' } // Missing x, y, width, height
        ]
      }
      
      expect(() => {
        bridge.applyLayout(state, invalidResult)
      }).toThrow('Invalid ELK layout result')
    })

    it('should ignore layout results for non-existent nodes', () => {
      const elkResult = {
        id: 'root',
        children: [
          { id: 'nonexistent', x: 100, y: 50, width: 120, height: 60 }
        ]
      }
      
      // Should not throw, just ignore the unknown node
      expect(() => {
        bridge.applyLayout(state, elkResult)
      }).not.toThrow()
    })
  })

  describe('layout configuration management', () => {
    it('should update layout configuration', () => {
      const newConfig = {
        algorithm: 'force' as const,
        direction: 'LEFT' as const,
        spacing: 75
      }
      
      bridge.updateConfiguration(newConfig)
      
      const node1 = createTestNode('n1', 'Node 1')
      state.addNode(node1)
      
      const elkGraph = bridge.toELKGraph(state)
      
      expect(elkGraph.layoutOptions).toEqual({
        'elk.algorithm': 'force',
        'elk.direction': 'LEFT',
        'elk.spacing.nodeNode': '75'
      })
    })

    it('should validate layout configuration', () => {
      expect(() => {
        new ELKBridge({
          algorithm: 'invalid' as any,
          direction: 'DOWN',
          spacing: 50
        })
      }).toThrow('Invalid ELK algorithm')
      
      expect(() => {
        new ELKBridge({
          algorithm: 'layered',
          direction: 'INVALID' as any,
          spacing: 50
        })
      }).toThrow('Invalid ELK direction')
    })
  })
})