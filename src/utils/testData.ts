/**
 * Test data utilities for paxos.json and other test scenarios
 * Provides consistent test data throughout development
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import type { GraphNode, GraphEdge, Container } from '../types/core.js'

export interface TestGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  containers: Container[]
}

export function loadPaxosTestData(): TestGraphData {
  try {
    const paxosPath = join(process.cwd(), 'test-data', 'paxos.json')
    const rawData = readFileSync(paxosPath, 'utf-8')
    const paxosData = JSON.parse(rawData)
    
    return convertToTestData(paxosData)
  } catch (error) {
    console.warn('Could not load paxos.json, using minimal test data')
    return getMinimalTestData()
  }
}

function convertToTestData(rawData: any): TestGraphData {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const containers: Container[] = []

  // Convert nodes
  if (rawData.nodes) {
    for (const node of rawData.nodes) {
      nodes.push({
        id: node.id || `node_${nodes.length}`,
        label: node.label || node.name || `Node ${nodes.length}`,
        longLabel: node.longLabel || node.label || node.name || `Node ${nodes.length}`,
        type: node.type || 'node',
        semanticTags: node.semanticTags || [],
        hidden: false
      })
    }
  }

  // Convert edges
  if (rawData.edges) {
    for (const edge of rawData.edges) {
      edges.push({
        id: edge.id || `edge_${edges.length}`,
        source: edge.source || edge.from,
        target: edge.target || edge.to,
        type: edge.type || 'edge',
        semanticTags: edge.semanticTags || [],
        hidden: false
      })
    }
  }

  // Convert containers
  if (rawData.containers) {
    for (const container of rawData.containers) {
      containers.push({
        id: container.id || `container_${containers.length}`,
        label: container.label || container.name || `Container ${containers.length}`,
        children: new Set(container.children || []),
        collapsed: container.collapsed || false,
        hidden: false
      })
    }
  }

  return { nodes, edges, containers }
}

export function getMinimalTestData(): TestGraphData {
  return {
    nodes: [
      {
        id: 'n1',
        label: 'Node 1',
        longLabel: 'Node 1 (Full Label)',
        type: 'node',
        semanticTags: [],
        hidden: false
      },
      {
        id: 'n2',
        label: 'Node 2',
        longLabel: 'Node 2 (Full Label)',
        type: 'node',
        semanticTags: [],
        hidden: false
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'edge',
        semanticTags: [],
        hidden: false
      }
    ],
    containers: [
      {
        id: 'c1',
        label: 'Container 1',
        children: new Set(['n1']),
        collapsed: false,
        hidden: false
      }
    ]
  }
}

export function createTestVisualizationState() {
  const { VisualizationState } = require('../core/VisualizationState.js')
  const state = new VisualizationState()
  const testData = loadPaxosTestData()
  
  // Add test data to state
  for (const node of testData.nodes) {
    state.addNode(node)
  }
  
  for (const container of testData.containers) {
    state.addContainer(container)
  }
  
  for (const edge of testData.edges) {
    state.addEdge(edge)
  }
  
  return state
}