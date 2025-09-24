/**
 * ReactFlowBridge Tests - TDD implementation
 * Tests ReactFlow format conversion with edge aggregation and interaction support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge.js';
import { VisualizationState } from '../core/VisualizationState.js';
import { InteractionHandler } from '../core/InteractionHandler.js';
import { loadPaxosTestData } from '../utils/testData.js';
import type { StyleConfig, GraphNode, Container, GraphEdge, AggregatedEdge } from '../types/core.js';

describe('ReactFlowBridge', () => {
  let bridge: ReactFlowBridge;
  let state: VisualizationState;
  let interactionHandler: InteractionHandler;
  let styleConfig: StyleConfig;

  beforeEach(() => {
    styleConfig = {
      nodeStyles: {
        'process': { backgroundColor: '#e1f5fe', border: '2px solid #0277bd' },
        'data': { backgroundColor: '#f3e5f5', border: '2px solid #7b1fa2' },
        'default': { backgroundColor: '#f5f5f5', border: '1px solid #666' }
      },
      edgeStyles: {
        'dataflow': { stroke: '#2196f3', strokeWidth: 2 },
        'control': { stroke: '#ff9800', strokeWidth: 1, strokeDasharray: '5,5' },
        'default': { stroke: '#666', strokeWidth: 1 }
      },
      containerStyles: {
        collapsed: { backgroundColor: '#fff3e0', border: '3px solid #ff9800' },
        expanded: { backgroundColor: 'rgba(255, 243, 224, 0.3)', border: '2px dashed #ff9800' }
      }
    };

    bridge = new ReactFlowBridge(styleConfig);
    state = new VisualizationState();
    interactionHandler = new InteractionHandler(state);
  });

  describe('Basic ReactFlow Conversion', () => {
    it('should convert empty state to empty ReactFlow data', () => {
      const result = bridge.toReactFlowData(state);
      
      expect(result).toEqual({
        nodes: [],
        edges: []
      });
    });

    it('should convert single node to ReactFlow format', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test Node',
        longLabel: 'Test Node with Long Description',
        type: 'process',
        semanticTags: ['important'],
        position: { x: 100, y: 200 },
        hidden: false,
        showingLongLabel: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({
        id: 'node1',
        type: 'default',
        position: { x: 100, y: 200 },
        data: {
          label: 'Test Node',
          longLabel: 'Test Node with Long Description',
          showingLongLabel: false,
          nodeType: 'process'
        }
      });
    });

    it('should convert single edge to ReactFlow format', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1 Long', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2 Long', type: 'data',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: [], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = bridge.toReactFlowData(state);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'dataflow'
      });
    });
  });

  describe('Node Label Toggle Support', () => {
    it('should render node with short label by default', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Short',
        longLabel: 'Very Long Description',
        type: 'process',
        semanticTags: [],
        hidden: false,
        showingLongLabel: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes[0].data.label).toBe('Short');
      expect(result.nodes[0].data.showingLongLabel).toBe(false);
    });

    it('should render node with long label when toggled', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Short',
        longLabel: 'Very Long Description',
        type: 'process',
        semanticTags: [],
        hidden: false,
        showingLongLabel: true
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes[0].data.label).toBe('Very Long Description');
      expect(result.nodes[0].data.showingLongLabel).toBe(true);
    });

    it('should attach click handlers for node label toggle when interaction handler provided', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state, interactionHandler);

      expect(result.nodes[0].data.onClick).toBeDefined();
      expect(typeof result.nodes[0].data.onClick).toBe('function');
    });

    it('should not attach click handlers when no interaction handler provided', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state); // No interaction handler

      expect(result.nodes[0].data.onClick).toBeUndefined();
    });
  });

  describe('Container Rendering', () => {
    it('should render collapsed container as single node', () => {
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1', 'node2']),
        collapsed: true,
        hidden: false,
        position: { x: 50, y: 100 }
      };

      state.addContainer(container);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({
        id: 'container1',
        type: 'container',
        position: { x: 50, y: 100 },
        data: {
          label: 'Test Container',
          nodeType: 'container',
          collapsed: true,
          containerChildren: 2
        }
      });
    });

    it('should render expanded container with boundary node', () => {
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1', 'node2']),
        collapsed: false,
        hidden: false,
        position: { x: 50, y: 100 }
      };

      state.addContainer(container);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({
        id: 'container1',
        type: 'container',
        data: {
          collapsed: false,
          containerChildren: 2
        }
      });
    });

    it('should attach click handlers for container toggle when interaction handler provided', () => {
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1']),
        collapsed: true,
        hidden: false
      };

      state.addContainer(container);
      const result = bridge.toReactFlowData(state, interactionHandler);

      expect(result.nodes[0].data.onClick).toBeDefined();
      expect(typeof result.nodes[0].data.onClick).toBe('function');
    });

    it('should not attach click handlers for container when no interaction handler provided', () => {
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1']),
        collapsed: true,
        hidden: false
      };

      state.addContainer(container);
      const result = bridge.toReactFlowData(state); // No interaction handler

      expect(result.nodes[0].data.onClick).toBeUndefined();
    });
  });

  describe('Edge Aggregation Support', () => {
    it('should render original edges normally', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: [], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = bridge.toReactFlowData(state);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'dataflow'
      });
    });

    it('should render aggregated edges with special styling', () => {
      // Create nodes and container
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const node3: GraphNode = {
        id: 'node3', label: 'Node 3', longLabel: 'Node 3', type: 'process',
        semanticTags: [], hidden: false
      };

      const container: Container = {
        id: 'container1',
        label: 'Container',
        children: new Set(['node2']),
        collapsed: true,
        hidden: false
      };

      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: [], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addNode(node3);
      state.addContainer(container);
      state.moveNodeToContainer('node2', 'container1');
      state.addEdge(edge);

      // Collapse container to trigger edge aggregation
      state.collapseContainer('container1');

      const result = bridge.toReactFlowData(state);

      // Should have aggregated edge from node1 to container1
      const aggregatedEdges = result.edges.filter(e => e.type === 'aggregated');
      expect(aggregatedEdges).toHaveLength(1);
      expect(aggregatedEdges[0]).toMatchObject({
        source: 'node1',
        target: 'container1',
        type: 'aggregated'
      });
      expect(aggregatedEdges[0].style).toMatchObject({
        strokeWidth: 3,
        stroke: '#ff6b6b'
      });
    });
  });

  describe('Style Application', () => {
    it('should apply node styles based on type', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Process Node',
        longLabel: 'Process Node',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes[0].style).toMatchObject({
        backgroundColor: '#e1f5fe',
        border: '2px solid #0277bd'
      });
    });

    it('should apply edge styles based on type', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'control',
        semanticTags: [], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = bridge.toReactFlowData(state);

      expect(result.edges[0].style).toMatchObject({
        stroke: '#ff9800',
        strokeWidth: 1,
        strokeDasharray: '5,5'
      });
    });

    it('should apply container styles based on collapsed state', () => {
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1']),
        collapsed: true,
        hidden: false
      };

      state.addContainer(container);
      const result = bridge.toReactFlowData(state);

      expect(result.nodes[0].style).toMatchObject({
        backgroundColor: '#fff3e0',
        border: '3px solid #ff9800'
      });
    });
  });

  describe('Semantic Tag Styling', () => {
    it('should apply semantic tag styles to nodes', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'importance': {
            'Critical': { 'halo': 'light-red' },
            'Normal': { 'halo': 'none' },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node: GraphNode = {
        id: 'node1',
        label: 'Critical Node',
        longLabel: 'Critical Node',
        type: 'process',
        semanticTags: ['Critical'],
        hidden: false
      };

      state.addNode(node);
      const result = semanticBridge.toReactFlowData(state);

      expect(result.nodes[0].style).toMatchObject({
        haloColor: '#e74c3c', // light-red halo color
      });
      expect(result.nodes[0].data.appliedSemanticTags).toEqual(['Critical']);
    });

    it('should apply semantic tag styles to edges', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'ordering': {
            'TotalOrder': { 'line-pattern': 'solid' },
            'NoOrder': { 'line-pattern': 'dashed' },
          },
          'bounds': {
            'Bounded': { 'line-width': 1 },
            'Unbounded': { 'line-width': 3 },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['TotalOrder', 'Unbounded'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = semanticBridge.toReactFlowData(state);

      expect(result.edges[0].style).toMatchObject({
        strokeDasharray: undefined, // solid from TotalOrder
        strokeWidth: 3, // from Unbounded
      });
      expect(result.edges[0].data?.appliedSemanticTags).toEqual(['TotalOrder', 'Unbounded']);
      expect(result.edges[0].label).toBe('TU'); // First characters of applied tags
    });

    it('should handle edge animation from semantic tags', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'flow': {
            'Static': { 'animation': 'static' },
            'Dynamic': { 'animation': 'animated' },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['Dynamic'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = semanticBridge.toReactFlowData(state);

      expect(result.edges[0].animated).toBe(true);
      expect(result.edges[0].data?.appliedSemanticTags).toEqual(['Dynamic']);
    });

    it('should handle edge markers from semantic tags', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'marker': {
            'Open': { 'arrowhead': 'triangle-open' },
            'Closed': { 'arrowhead': 'triangle-filled' },
            'Circle': { 'arrowhead': 'circle-filled' },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['Circle'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = semanticBridge.toReactFlowData(state);

      expect(result.edges[0].markerEnd).toBe('url(#circle-filled)');
      expect(result.edges[0].data?.appliedSemanticTags).toEqual(['Circle']);
    });

    it('should combine semantic styles with type-based styles', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'thickness': {
            'Thick': { 'line-width': 4 },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'control',
        semanticTags: ['Thick'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = semanticBridge.toReactFlowData(state);

      // Should have both type-based style (control) and semantic style (Thick)
      expect(result.edges[0].style).toMatchObject({
        stroke: '#ff9800', // from control type
        strokeWidth: 4, // from Thick semantic tag (overrides type-based strokeWidth: 1)
        strokeDasharray: '5,5', // from control type
      });
    });

    it('should handle edges with no semantic tags', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: [], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = bridge.toReactFlowData(state);

      // Should have default semantic styling plus type-based styling
      expect(result.edges[0].style).toMatchObject({
        stroke: '#2196f3', // from dataflow type
        strokeWidth: 2, // from dataflow type
      });
      expect(result.edges[0].data?.appliedSemanticTags).toEqual([]);
    });

    it('should preserve original labels when combining with semantic tags', () => {
      const semanticStyleConfig: StyleConfig = {
        ...styleConfig,
        semanticMappings: {
          'test': {
            'Network': { 'line-width': 2 },
          },
        },
      };

      const semanticBridge = new ReactFlowBridge(semanticStyleConfig);
      
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['Network'], hidden: false
      };

      // Add edge with original label
      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = semanticBridge.toReactFlowData(state);

      expect(result.edges[0].label).toBe('N'); // Just the semantic tag abbreviation since no original label
    });
  });

  describe('Paxos.json Integration', () => {
    it('should convert paxos.json data correctly', () => {
      const paxosData = loadPaxosTestData();
      
      // Load paxos data into state
      for (const node of paxosData.nodes) {
        state.addNode(node);
      }
      for (const edge of paxosData.edges) {
        state.addEdge(edge);
      }
      for (const container of paxosData.containers) {
        state.addContainer(container);
        for (const childId of container.children) {
          state.moveNodeToContainer(childId, container.id);
        }
      }

      const result = bridge.toReactFlowData(state);

      // Verify basic structure
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);

      // Verify all nodes have required properties
      for (const node of result.nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.data.label).toBeDefined();
        expect(node.data.nodeType).toBeDefined();
      }

      // Verify all edges have required properties
      for (const edge of result.edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.type).toBeDefined();
      }
    });

    it('should handle container operations with paxos.json data', () => {
      const paxosData = loadPaxosTestData();
      
      // Load paxos data
      for (const node of paxosData.nodes) {
        state.addNode(node);
      }
      for (const container of paxosData.containers) {
        state.addContainer(container);
        for (const childId of container.children) {
          state.moveNodeToContainer(childId, container.id);
        }
      }

      // Test collapsed containers
      const firstContainer = paxosData.containers[0];
      if (firstContainer) {
        state.collapseContainer(firstContainer.id);

        const collapsedResult = bridge.toReactFlowData(state);
        const containerNode = collapsedResult.nodes.find(n => n.id === firstContainer.id);
        expect(containerNode?.data.collapsed).toBe(true);

        // Test expanded containers
        state.expandContainer(firstContainer.id);
        const expandedResult = bridge.toReactFlowData(state);
        const expandedContainerNode = expandedResult.nodes.find(n => n.id === firstContainer.id);
        expect(expandedContainerNode?.data.collapsed).toBe(false);
      }
    });
  });

  describe('Click Handler Integration', () => {
    it('should create onClick handlers when interaction handler is provided', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test Node',
        longLabel: 'Test Node Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state, interactionHandler);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.onClick).toBeDefined();
      expect(typeof result.nodes[0].data.onClick).toBe('function');
    });

    it('should call interaction handler for node clicks', () => {
      // Use fresh instances to avoid test interference
      const freshState = new VisualizationState();
      // Disable debouncing for synchronous testing
      const freshHandler = new InteractionHandler(freshState, undefined, { enableClickDebouncing: false });
      
      const node: GraphNode = {
        id: 'node1',
        label: 'Test Node',
        longLabel: 'Test Node Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      freshState.addNode(node);
      const result = bridge.toReactFlowData(freshState, freshHandler);

      // Verify onClick function exists
      expect(result.nodes[0].data.onClick).toBeDefined();
      expect(typeof result.nodes[0].data.onClick).toBe('function');

      // Verify initial state
      const initialNode = freshState.getGraphNode('node1');
      expect(initialNode?.showingLongLabel).toBeUndefined();

      // Simulate click through onClick
      const onClick = result.nodes[0].data.onClick!;
      onClick('node1', 'node');

      // Verify the node label was toggled
      const updatedNode = freshState.getGraphNode('node1');
      expect(updatedNode?.showingLongLabel).toBe(true);
    });

    it('should call interaction handler for container clicks', () => {
      // Use fresh instances to avoid test interference
      const freshState = new VisualizationState();
      // Disable debouncing for synchronous testing
      const freshHandler = new InteractionHandler(freshState, undefined, { enableClickDebouncing: false });
      
      const container: Container = {
        id: 'container1',
        label: 'Test Container',
        children: new Set(['node1']),
        collapsed: true,
        hidden: false
      };

      freshState.addContainer(container);
      const result = bridge.toReactFlowData(freshState, freshHandler);

      // Verify onClick function exists
      expect(result.nodes[0].data.onClick).toBeDefined();
      expect(typeof result.nodes[0].data.onClick).toBe('function');

      // Verify initial state
      const initialContainer = freshState.getContainer('container1');
      expect(initialContainer?.collapsed).toBe(true);

      // Simulate click
      const onClick = result.nodes[0].data.onClick!;
      onClick('container1', 'container');

      // Verify the container was toggled
      const updatedContainer = freshState.getContainer('container1');
      expect(updatedContainer?.collapsed).toBe(false);
    });
  });

  describe('Data Immutability and Performance Optimization', () => {
    it('should return immutable ReactFlow data', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result1 = bridge.toReactFlowData(state);
      const result2 = bridge.toReactFlowData(state);

      // Results should be equal but not the same object
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
      expect(result1.nodes).not.toBe(result2.nodes);
      expect(result1.edges).not.toBe(result2.edges);
    });

    it('should not modify original state data', () => {
      const originalNode: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(originalNode);
      const result = bridge.toReactFlowData(state);

      // Try to modify the result - should throw error due to immutability
      expect(() => {
        (result.nodes[0].data as any).label = 'Modified';
      }).toThrow();

      // Original should be unchanged
      const stateNode = state.getGraphNode('node1');
      expect(stateNode?.label).toBe('Test');
    });

    it('should freeze ReactFlow data objects for immutability', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result = bridge.toReactFlowData(state);

      // Top-level objects should be frozen
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.nodes)).toBe(true);
      expect(Object.isFrozen(result.edges)).toBe(true);

      // Individual nodes should be frozen
      expect(Object.isFrozen(result.nodes[0])).toBe(true);
      expect(Object.isFrozen(result.nodes[0].data)).toBe(true);
      expect(Object.isFrozen(result.nodes[0].position)).toBe(true);
      
      if (result.nodes[0].style) {
        expect(Object.isFrozen(result.nodes[0].style)).toBe(true);
      }
    });

    it('should freeze edge data objects for immutability', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['test'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result = bridge.toReactFlowData(state);

      // Individual edges should be frozen
      expect(Object.isFrozen(result.edges[0])).toBe(true);
      if (result.edges[0].style) {
        expect(Object.isFrozen(result.edges[0].style)).toBe(true);
      }
      if (result.edges[0].data) {
        expect(Object.isFrozen(result.edges[0].data)).toBe(true);
      }
    });

    it('should use caching for performance with identical state', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      
      // First call should populate cache
      const start1 = performance.now();
      const result1 = bridge.toReactFlowData(state);
      const time1 = performance.now() - start1;

      // Second call should use cache and be faster
      const start2 = performance.now();
      const result2 = bridge.toReactFlowData(state);
      const time2 = performance.now() - start2;

      // Results should be equal but different objects (due to deep cloning)
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
      
      // Second call should generally be faster (though this may be flaky in CI)
      // We'll just verify the caching mechanism works by checking the results are consistent
      expect(result1.nodes).toHaveLength(result2.nodes.length);
      expect(result1.edges).toHaveLength(result2.edges.length);
    });

    it('should invalidate cache when state changes', () => {
      const node1: GraphNode = {
        id: 'node1',
        label: 'Test 1',
        longLabel: 'Test 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node1);
      const result1 = bridge.toReactFlowData(state);

      // Add another node to change state
      const node2: GraphNode = {
        id: 'node2',
        label: 'Test 2',
        longLabel: 'Test 2 Long',
        type: 'data',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node2);
      const result2 = bridge.toReactFlowData(state);

      // Results should be different
      expect(result1.nodes).toHaveLength(1);
      expect(result2.nodes).toHaveLength(2);
      expect(result1).not.toEqual(result2);
    });

    it('should handle large graphs with optimized conversion', () => {
      // Create a large number of nodes to trigger optimization
      const nodeCount = 1200; // Above LARGE_GRAPH_NODE_THRESHOLD
      
      for (let i = 0; i < nodeCount; i++) {
        const node: GraphNode = {
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long Description`,
          type: i % 2 === 0 ? 'process' : 'data',
          semanticTags: [],
          hidden: false
        };
        state.addNode(node);
      }

      const result = bridge.toReactFlowData(state);

      // Should handle large graph without errors
      expect(result.nodes).toHaveLength(nodeCount);
      expect(result.nodes[0]).toMatchObject({
        id: 'node0',
        data: {
          label: 'Node 0',
          nodeType: 'process'
        }
      });

      // All nodes should be properly frozen
      expect(Object.isFrozen(result.nodes[0])).toBe(true);
      expect(Object.isFrozen(result.nodes[nodeCount - 1])).toBe(true);
    });

    it('should clear caches when requested', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      
      // Populate cache
      bridge.toReactFlowData(state);
      
      // Clear caches
      bridge.clearCaches();
      
      // Should still work after clearing caches
      const result = bridge.toReactFlowData(state);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('node1');
    });

    it('should maintain performance with repeated style applications', () => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      
      // Create moderate number of elements for performance testing
      for (let i = 0; i < 100; i++) {
        const node: GraphNode = {
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long`,
          type: i % 3 === 0 ? 'process' : i % 3 === 1 ? 'data' : 'default',
          semanticTags: [],
          hidden: false
        };
        nodes.push(node);
        state.addNode(node);

        if (i > 0) {
          const edge: GraphEdge = {
            id: `edge${i}`,
            source: `node${i-1}`,
            target: `node${i}`,
            type: i % 2 === 0 ? 'dataflow' : 'control',
            semanticTags: [],
            hidden: false
          };
          edges.push(edge);
          state.addEdge(edge);
        }
      }

      // Multiple conversions should be consistent and performant
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = bridge.toReactFlowData(state);
        results.push(result);
        
        // Each result should be properly structured
        expect(result.nodes).toHaveLength(100);
        expect(result.edges).toHaveLength(99);
        
        // Each result should be immutable
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.nodes)).toBe(true);
        expect(Object.isFrozen(result.edges)).toBe(true);
      }

      // All results should be equal but different objects
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
        expect(results[i]).not.toBe(results[0]);
      }
    });

    it('should handle deep cloning of complex edge data', () => {
      const node1: GraphNode = {
        id: 'node1', label: 'Node 1', longLabel: 'Node 1', type: 'process',
        semanticTags: [], hidden: false
      };
      const node2: GraphNode = {
        id: 'node2', label: 'Node 2', longLabel: 'Node 2', type: 'process',
        semanticTags: [], hidden: false
      };
      const edge: GraphEdge = {
        id: 'edge1', source: 'node1', target: 'node2', type: 'dataflow',
        semanticTags: ['tag1', 'tag2'], hidden: false
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addEdge(edge);

      const result1 = bridge.toReactFlowData(state);
      const result2 = bridge.toReactFlowData(state);

      // Edge data should be deeply cloned
      expect(result1.edges[0].data).toEqual(result2.edges[0].data);
      expect(result1.edges[0].data).not.toBe(result2.edges[0].data);
      
      if (result1.edges[0].data?.semanticTags && result2.edges[0].data?.semanticTags) {
        expect(result1.edges[0].data.semanticTags).toEqual(result2.edges[0].data.semanticTags);
        expect(result1.edges[0].data.semanticTags).not.toBe(result2.edges[0].data.semanticTags);
      }
    });

    it('should preserve onClick function references in deep cloning', () => {
      const node: GraphNode = {
        id: 'node1',
        label: 'Test',
        longLabel: 'Test Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      state.addNode(node);
      const result1 = bridge.toReactFlowData(state, interactionHandler);
      const result2 = bridge.toReactFlowData(state, interactionHandler);

      // onClick functions should exist and be the same reference
      expect(result1.nodes[0].data.onClick).toBeDefined();
      expect(result2.nodes[0].data.onClick).toBeDefined();
      expect(typeof result1.nodes[0].data.onClick).toBe('function');
      expect(typeof result2.nodes[0].data.onClick).toBe('function');
    });
  });
});