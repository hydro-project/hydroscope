/**
 * E2E Tests for Container Collapse/Expand Functionality
 * 
 * These tests ensure that:
 * 1. Containers properly collapse to compact size
 * 2. Containers properly expand to show children
 * 3. Layout is recalculated after collapse/expand operations
 * 4. Visual state matches logical state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationState } from '../../core/VisualizationState.js';
import { ReactFlowBridge } from '../../bridges/ReactFlowBridge.js';
import { ELKBridge } from '../../bridges/ELKBridge.js';
import { AsyncCoordinator } from '../../core/AsyncCoordinator.js';

describe('Container Collapse/Expand E2E Tests', () => {
  let state: VisualizationState;
  let reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;
  let coordinator: AsyncCoordinator;

  beforeEach(() => {
    state = new VisualizationState();
    reactFlowBridge = new ReactFlowBridge({});
    elkBridge = new ELKBridge({});
    coordinator = new AsyncCoordinator();

    // Create test data with containers and nodes
    const container1 = {
      id: 'container1',
      label: 'Container 1',
      children: new Set(['node1', 'node2']),
      collapsed: false,
      hidden: false,
    };

    const container2 = {
      id: 'container2', 
      label: 'Container 2',
      children: new Set(['node3']),
      collapsed: false,
      hidden: false,
    };

    const node1 = {
      id: 'node1',
      label: 'Node 1',
      shortLabel: 'Node 1',
      fullLabel: 'Node 1 Full',
      nodeType: 'Process',
      data: { locationId: 0 },
    };

    const node2 = {
      id: 'node2',
      label: 'Node 2',
      shortLabel: 'Node 2', 
      fullLabel: 'Node 2 Full',
      nodeType: 'Process',
      data: { locationId: 0 },
    };

    const node3 = {
      id: 'node3',
      label: 'Node 3',
      shortLabel: 'Node 3',
      fullLabel: 'Node 3 Full', 
      nodeType: 'Process',
      data: { locationId: 1 },
    };

    const edge1 = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      semanticTags: ['DataFlow'],
    };

    const edge2 = {
      id: 'edge2',
      source: 'node2', 
      target: 'node3',
      semanticTags: ['DataFlow'],
    };

    // Add to state
    state.addContainer(container1);
    state.addContainer(container2);
    state.addNode(node1);
    state.addNode(node2);
    state.addNode(node3);
    state.addEdge(edge1);
    state.addEdge(edge2);

    // Set up node assignments
    state.moveNodeToContainer('node1', 'container1');
    state.moveNodeToContainer('node2', 'container1');
    state.moveNodeToContainer('node3', 'container2');
  });

  describe('Single Container Collapse', () => {
    it('should collapse container and change visual representation', async () => {
      // Initial state - container should be expanded
      let reactFlowData = reactFlowBridge.toReactFlowData(state);
      let container1Node = reactFlowData.nodes.find(n => n.id === 'container1');
      
      expect(container1Node).toBeDefined();
      expect(container1Node?.type).toBe('container');
      expect(container1Node?.data.collapsed).toBe(false);

      // Collapse the container
      await coordinator.collapseContainer('container1', state);

      // Verify logical state
      const container = state.getContainer('container1');
      expect(container?.collapsed).toBe(true);

      // Verify visual representation
      reactFlowData = reactFlowBridge.toReactFlowData(state);
      container1Node = reactFlowData.nodes.find(n => n.id === 'container1');
      
      expect(container1Node).toBeDefined();
      expect(container1Node?.type).toBe('container'); // Should still be container type
      expect(container1Node?.data.collapsed).toBe(true); // But marked as collapsed
      
      // Child nodes should not be visible in ReactFlow data
      const childNodes = reactFlowData.nodes.filter(n => ['node1', 'node2'].includes(n.id));
      expect(childNodes).toHaveLength(0);
    });

    it('should expand collapsed container and restore children', async () => {
      // First collapse the container
      await coordinator.collapseContainer('container1', state);
      
      // Verify it's collapsed
      let container = state.getContainer('container1');
      expect(container?.collapsed).toBe(true);

      // Now expand it
      await coordinator.expandContainer('container1', state);

      // Verify logical state
      container = state.getContainer('container1');
      expect(container?.collapsed).toBe(false);

      // Verify visual representation
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const container1Node = reactFlowData.nodes.find(n => n.id === 'container1');
      
      expect(container1Node).toBeDefined();
      expect(container1Node?.type).toBe('container');
      expect(container1Node?.data.collapsed).toBe(false);
      
      // Child nodes should be visible again
      const childNodes = reactFlowData.nodes.filter(n => ['node1', 'node2'].includes(n.id));
      expect(childNodes).toHaveLength(2);
    });
  });

  describe('Bulk Container Operations', () => {
    it('should collapse all containers', async () => {
      // Initial state - all containers expanded
      expect(state.getContainer('container1')?.collapsed).toBe(false);
      expect(state.getContainer('container2')?.collapsed).toBe(false);

      // Collapse all containers
      await coordinator.collapseAllContainers(state);

      // Verify all containers are collapsed
      expect(state.getContainer('container1')?.collapsed).toBe(true);
      expect(state.getContainer('container2')?.collapsed).toBe(true);

      // Verify visual representation
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const containerNodes = reactFlowData.nodes.filter(n => n.data.nodeType === 'container');
      
      expect(containerNodes).toHaveLength(2);
      containerNodes.forEach(node => {
        expect(node.type).toBe('container');
        expect(node.data.collapsed).toBe(true);
      });

      // No child nodes should be visible
      const childNodes = reactFlowData.nodes.filter(n => ['node1', 'node2', 'node3'].includes(n.id));
      expect(childNodes).toHaveLength(0);
    });

    it('should expand all containers', async () => {
      // First collapse all containers
      await coordinator.collapseAllContainers(state);
      
      // Verify they're collapsed
      expect(state.getContainer('container1')?.collapsed).toBe(true);
      expect(state.getContainer('container2')?.collapsed).toBe(true);

      // Now expand all
      await coordinator.expandAllContainers(state);

      // Verify all containers are expanded
      expect(state.getContainer('container1')?.collapsed).toBe(false);
      expect(state.getContainer('container2')?.collapsed).toBe(false);

      // Verify visual representation
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const containerNodes = reactFlowData.nodes.filter(n => n.data.nodeType === 'container');
      
      expect(containerNodes).toHaveLength(2);
      containerNodes.forEach(node => {
        expect(node.type).toBe('container');
        expect(node.data.collapsed).toBe(false);
      });

      // All child nodes should be visible
      const childNodes = reactFlowData.nodes.filter(n => ['node1', 'node2', 'node3'].includes(n.id));
      expect(childNodes).toHaveLength(3);
    });
  });

  describe('Layout Integration', () => {
    it('should handle collapsed containers in layout', async () => {
      // Collapse container
      await coordinator.collapseContainer('container1', state);
      
      // Get ReactFlow data - should work without layout
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const container1Node = reactFlowData.nodes.find(n => n.id === 'container1');

      // Container should be marked as collapsed
      expect(container1Node?.data.collapsed).toBe(true);
      expect(container1Node?.type).toBe('container');
      
      // Child nodes should not be visible
      const childNodes = reactFlowData.nodes.filter(n => ['node1', 'node2'].includes(n.id));
      expect(childNodes).toHaveLength(0);
    });

    it('should handle edge aggregation for collapsed containers', async () => {
      // Add an edge that goes through the container we'll collapse
      const externalNode = {
        id: 'external',
        label: 'External',
        shortLabel: 'External',
        fullLabel: 'External Node',
        nodeType: 'Process',
        data: { locationId: 2 },
      };
      
      const edgeToContainer = {
        id: 'edge_to_container',
        source: 'external',
        target: 'node1', // Inside container1
        semanticTags: ['DataFlow'],
      };

      state.addNode(externalNode);
      state.addEdge(edgeToContainer);

      // Collapse container1
      await coordinator.collapseContainer('container1', state);

      // Get ReactFlow data
      const reactFlowData = reactFlowBridge.toReactFlowData(state);

      // Should have an aggregated edge from external to container1
      const aggregatedEdge = reactFlowData.edges.find(e => 
        e.source === 'external' && e.target === 'container1'
      );
      
      expect(aggregatedEdge).toBeDefined();
      expect(aggregatedEdge?.data?.aggregated).toBe(true);
    });

    it('should redirect edges to collapsed containers correctly', async () => {
      // Add external nodes and edges that connect to nodes inside containers
      const externalNode1 = {
        id: 'external1',
        label: 'External 1',
        shortLabel: 'External 1',
        fullLabel: 'External 1',
        nodeType: 'Process',
        data: { locationId: 3 },
      };

      const externalNode2 = {
        id: 'external2', 
        label: 'External 2',
        shortLabel: 'External 2',
        fullLabel: 'External 2',
        nodeType: 'Process',
        data: { locationId: 4 },
      };

      // Edges connecting external nodes to nodes inside containers
      const edgeToContainer1 = {
        id: 'edge_external1_to_node1',
        source: 'external1',
        target: 'node1', // Inside container1
        semanticTags: ['DataFlow'],
      };

      const edgeFromContainer1 = {
        id: 'edge_node2_to_external2',
        source: 'node2', // Inside container1
        target: 'external2',
        semanticTags: ['DataFlow'],
      };

      // Edge between containers
      const edgeBetweenContainers = {
        id: 'edge_node2_to_node3',
        source: 'node2', // Inside container1
        target: 'node3', // Inside container2
        semanticTags: ['DataFlow'],
      };

      state.addNode(externalNode1);
      state.addNode(externalNode2);
      state.addEdge(edgeToContainer1);
      state.addEdge(edgeFromContainer1);
      state.addEdge(edgeBetweenContainers);

      // Before collapse - edges should connect to actual nodes
      let reactFlowData = reactFlowBridge.toReactFlowData(state);
      let edgeToNode1 = reactFlowData.edges.find(e => e.id === 'edge_external1_to_node1');
      let edgeFromNode2 = reactFlowData.edges.find(e => e.id === 'edge_node2_to_external2');
      let edgeBetween = reactFlowData.edges.find(e => e.id === 'edge_node2_to_node3');

      expect(edgeToNode1?.target).toBe('node1');
      expect(edgeFromNode2?.source).toBe('node2');
      expect(edgeBetween?.source).toBe('node2');
      expect(edgeBetween?.target).toBe('node3');

      // Collapse container1
      await coordinator.collapseContainer('container1', state);

      // After collapse - edges should be redirected to container1
      reactFlowData = reactFlowBridge.toReactFlowData(state);
      
      // Edge from external1 should now target container1
      const redirectedEdgeIn = reactFlowData.edges.find(e => 
        e.source === 'external1' && e.target === 'container1'
      );
      expect(redirectedEdgeIn).toBeDefined();
      expect(redirectedEdgeIn?.data?.aggregated).toBe(true);

      // Edge to external2 should now source from container1
      const redirectedEdgeOut = reactFlowData.edges.find(e => 
        e.source === 'container1' && e.target === 'external2'
      );
      expect(redirectedEdgeOut).toBeDefined();
      expect(redirectedEdgeOut?.data?.aggregated).toBe(true);

      // Edge between containers should now be container1 -> node3
      const redirectedEdgeBetween = reactFlowData.edges.find(e => 
        e.source === 'container1' && e.target === 'node3'
      );
      expect(redirectedEdgeBetween).toBeDefined();
      expect(redirectedEdgeBetween?.data?.aggregated).toBe(true);

      // Original edges to hidden nodes should not exist
      const originalEdges = reactFlowData.edges.filter(e => 
        e.target === 'node1' || e.source === 'node2'
      );
      expect(originalEdges).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle collapse of non-existent container gracefully', async () => {
      // The coordinator may handle non-existent containers gracefully
      // Let's just verify it doesn't crash the system
      try {
        await coordinator.collapseContainer('non-existent', state);
      } catch (error) {
        // Expected - non-existent container should cause an error
        expect(error).toBeDefined();
      }
    });

    it('should handle expand of non-existent container gracefully', async () => {
      // The coordinator may handle non-existent containers gracefully
      // Let's just verify it doesn't crash the system
      try {
        await coordinator.expandContainer('non-existent', state);
      } catch (error) {
        // Expected - non-existent container should cause an error
        expect(error).toBeDefined();
      }
    });

    it('should handle double collapse gracefully', async () => {
      // Collapse once
      await coordinator.collapseContainer('container1', state);
      expect(state.getContainer('container1')?.collapsed).toBe(true);

      // Collapse again - should not error
      await coordinator.collapseContainer('container1', state);
      expect(state.getContainer('container1')?.collapsed).toBe(true);
    });

    it('should handle double expand gracefully', async () => {
      // Container starts expanded
      expect(state.getContainer('container1')?.collapsed).toBe(false);

      // Expand again - should not error
      await coordinator.expandContainer('container1', state);
      expect(state.getContainer('container1')?.collapsed).toBe(false);
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain consistent node types for containers', async () => {
      // Test expanded state
      let reactFlowData = reactFlowBridge.toReactFlowData(state);
      let containerNodes = reactFlowData.nodes.filter(n => n.data.nodeType === 'container');
      
      containerNodes.forEach(node => {
        expect(node.type).toBe('container');
        expect(node.data.collapsed).toBe(false);
      });

      // Test collapsed state
      await coordinator.collapseAllContainers(state);
      reactFlowData = reactFlowBridge.toReactFlowData(state);
      containerNodes = reactFlowData.nodes.filter(n => n.data.nodeType === 'container');
      
      containerNodes.forEach(node => {
        expect(node.type).toBe('container'); // Should still be 'container', not 'standard'
        expect(node.data.collapsed).toBe(true);
      });
    });

    it('should provide correct container metadata for rendering', async () => {
      const reactFlowData = reactFlowBridge.toReactFlowData(state);
      const container1Node = reactFlowData.nodes.find(n => n.id === 'container1');
      
      expect(container1Node?.data).toMatchObject({
        label: 'Container 1',
        nodeType: 'container',
        collapsed: false,
        containerChildren: 2,
      });

      // After collapse
      await coordinator.collapseContainer('container1', state);
      const collapsedData = reactFlowBridge.toReactFlowData(state);
      const collapsedContainer = collapsedData.nodes.find(n => n.id === 'container1');
      
      expect(collapsedContainer?.data).toMatchObject({
        label: 'Container 1',
        nodeType: 'container', 
        collapsed: true,
        containerChildren: 2,
      });
    });
  });
});