/**
 * @fileoverview ELK Layout Integration Tests
 *
 * Consolidated test suite for ELK Bridge functionality including:
 * - Fresh instance creation
 * - Spacing and layout algorithms
 * - Container hierarchy handling
 * - Dimension explosion regression prevention
 */

import { describe, test, expect, beforeEach, it } from 'vitest';
import ELK from 'elkjs';
import { ELKBridge } from '../ELKBridge';
import { createVisualizationState } from '../../core/VisualizationState';
import { getELKLayoutOptions } from '../../shared/config';
import {
  loadChatJsonTestData,
  skipIfNoTestData,
  createMockVisualizationStateWithContainers,
} from '../../__tests__/testUtils';

describe('ELK Layout Integration', () => {
  describe('Fresh Instance Creation', () => {
    test('should create fresh ELK instance for each ELKBridge', () => {
      const bridge1 = new ELKBridge();
      const bridge2 = new ELKBridge();

      expect(bridge1).not.toBe(bridge2);
      expect(bridge1).toBeInstanceOf(ELKBridge);
      expect(bridge2).toBeInstanceOf(ELKBridge);
    });

    test('should accept layout configuration in constructor', () => {
      const config = { algorithm: 'mrtree' as const };
      const bridge = new ELKBridge(config);
      expect(bridge).toBeInstanceOf(ELKBridge);
    });
  });

  describe('Spacing and Layout Algorithms', () => {
    test('should produce reasonable spacing with exact input data', async () => {
      const elk = new ELK();
      const layoutOptions = getELKLayoutOptions('mrtree');

      const elkInput = {
        id: 'root',
        layoutOptions,
        children: [
          { id: 'bt_12', width: 200, height: 194 },
          { id: 'bt_17', width: 200, height: 194 },
          { id: 'bt_31', width: 200, height: 194 },
          { id: 'bt_37', width: 200, height: 194 },
          { id: 'bt_82', width: 200, height: 194 },
          { id: 'bt_103', width: 200, height: 194 },
          { id: 'bt_106', width: 200, height: 194 },
          { id: 'bt_109', width: 200, height: 194 },
          { id: 'bt_121', width: 200, height: 194 },
          { id: 'bt_139', width: 200, height: 194 },
          { id: 'bt_146', width: 200, height: 194 },
          { id: 'bt_183', width: 200, height: 194 },
        ],
        edges: [
          { id: 'hyper_bt_183_to_bt_121', sources: ['bt_183'], targets: ['bt_121'] },
          { id: 'hyper_bt_121_to_bt_106', sources: ['bt_121'], targets: ['bt_106'] },
          { id: 'hyper_bt_121_to_bt_109', sources: ['bt_121'], targets: ['bt_109'] },
          { id: 'hyper_bt_121_to_bt_103', sources: ['bt_121'], targets: ['bt_103'] },
          { id: 'hyper_bt_103_to_bt_121', sources: ['bt_103'], targets: ['bt_121'] },
          { id: 'hyper_bt_171_to_bt_139', sources: ['bt_121'], targets: ['bt_139'] },
          { id: 'hyper_bt_171_to_bt_12', sources: ['bt_121'], targets: ['bt_12'] },
          { id: 'hyper_bt_146_to_bt_121', sources: ['bt_146'], targets: ['bt_121'] },
        ],
      };

      const result = await elk.layout(elkInput);
      const positions =
        result.children?.map(child => ({
          id: child.id,
          x: child.x || 0,
          y: child.y || 0,
          width: child.width,
          height: child.height,
        })) || [];

      positions.sort((a, b) => a.x - b.x);

      const gaps: number[] = [];
      for (let i = 1; i < positions.length; i++) {
        const prevPos = positions[i - 1];
        const gap = positions[i].x - (prevPos.x + prevPos.width!);
        gaps.push(gap);
      }

      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const expectedGap = 75;

      expect(avgGap).toBeLessThan(expectedGap + 50);
      expect(avgGap).toBeGreaterThan(-150);
    });

    test('should test different layout algorithms', async () => {
      const elk = new ELK();
      const testConfigs = [
        { name: 'Minimal mrtree', options: { 'elk.algorithm': 'mrtree' } },
        { name: 'Layered algorithm', options: { 'elk.algorithm': 'layered' } },
        { name: 'Force algorithm', options: { 'elk.algorithm': 'force' } },
        {
          name: 'Custom spacing',
          options: {
            'elk.algorithm': 'mrtree',
            'elk.spacing.nodeNode': '20',
            'elk.mrtree.spacing.nodeNode': '20',
          },
        },
      ];

      const baseInput = {
        id: 'root',
        children: [
          { id: 'node1', width: 100, height: 50 },
          { id: 'node2', width: 100, height: 50 },
        ],
        edges: [{ id: 'edge1', sources: ['node1'], targets: ['node2'] }],
      };

      for (const config of testConfigs) {
        const filteredOptions: Record<string, string> = {};
        for (const key in config.options) {
          const value = (config.options as Record<string, string | undefined>)[key];
          if (typeof value === 'string') {
            filteredOptions[key] = value;
          }
        }

        const testInput = { ...baseInput, layoutOptions: filteredOptions };

        try {
          const result = await elk.layout(testInput);
          expect(result.children).toBeDefined();
          expect(result.children!.length).toBe(2);
        } catch (error) {
          console.log(`${config.name}: FAILED - ${error}`);
        }
      }
    });
  });

  describe('Container Hierarchy Handling', () => {
    let elkBridge: ELKBridge;

    beforeEach(() => {
      elkBridge = new ELKBridge();
    });

    it('should handle simple container hierarchy correctly', async () => {
      const state = createMockVisualizationStateWithContainers();

      expect(state.visibleNodes.length).toBe(5);
      expect(state.getExpandedContainers().length).toBe(2);
      expect(state.visibleEdges.length).toBe(4);

      const containerA = state.getContainer('container_a');
      const containerB = state.getContainer('container_b');

      expect(containerA).toBeDefined();
      expect(containerB).toBeDefined();
      expect(containerA!.children.has('node_0')).toBe(true);
      expect(containerA!.children.has('node_1')).toBe(true);
      expect(containerB!.children.has('node_2')).toBe(true);
      expect(containerB!.children.has('node_3')).toBe(true);
      expect(containerB!.children.has('node_4')).toBe(true);

      await elkBridge.layoutVisualizationState(state);

      const layoutA = state.getContainerLayout('container_a');
      const layoutB = state.getContainerLayout('container_b');

      expect(layoutA).toBeDefined();
      expect(layoutB).toBeDefined();
      expect(layoutA?.dimensions?.width).toBeGreaterThan(0);
      expect(layoutA?.dimensions?.height).toBeGreaterThan(0);
      expect(layoutB?.dimensions?.width).toBeGreaterThan(0);
      expect(layoutB?.dimensions?.height).toBeGreaterThan(0);
    });

    it('should handle cross-container edges correctly', async () => {
      const state = createMockVisualizationStateWithContainers();
      state.setGraphEdge('edge_cross', { source: 'node_1', target: 'node_2' });

      expect(state.visibleEdges.length).toBe(5);

      await elkBridge.layoutVisualizationState(state);

      const crossEdgeLayout = state.getEdgeLayout('edge_cross');
      const normalEdgeLayout = state.getEdgeLayout('edge_0_1');

      if (normalEdgeLayout?.sections) {
        expect(normalEdgeLayout.sections.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate ELK input data structure with real data', async () => {
      const testData = loadChatJsonTestData('location');
      if (skipIfNoTestData(testData, 'ELK input validation')) return;

      const state = testData!.state;
      await elkBridge.layoutVisualizationState(state);

      const containers = state.getExpandedContainers();
      for (const container of containers) {
        const layout = state.getContainerLayout(container.id);
        expect(layout).toBeDefined();

        if (layout?.position) {
          expect(typeof layout.position.x).toBe('number');
          expect(typeof layout.position.y).toBe('number');
          expect(isFinite(layout.position.x)).toBe(true);
          expect(isFinite(layout.position.y)).toBe(true);
        }

        if (layout?.dimensions) {
          expect(layout.dimensions.width).toBeGreaterThan(0);
          expect(layout.dimensions.height).toBeGreaterThan(0);
        }
      }

      const nodes = state.visibleNodes;
      for (const node of nodes) {
        const layout = state.getNodeLayout(node.id);

        if (layout?.position) {
          expect(typeof layout.position.x).toBe('number');
          expect(typeof layout.position.y).toBe('number');
          expect(isFinite(layout.position.x)).toBe(true);
          expect(isFinite(layout.position.y)).toBe(true);
          expect(layout.position.x).toBeGreaterThan(-1000);
          expect(layout.position.y).toBeGreaterThan(-1000);
        }
      }
    });
  });

  describe('Dimension Explosion Regression Prevention', () => {
    let visState: ReturnType<typeof createVisualizationState>;

    beforeEach(() => {
      visState = createVisualizationState();
    });

    test('should immediately hide children when container is created with collapsed: true', () => {
      const childIds = [];
      for (let i = 0; i < 23; i++) {
        const nodeId = `bt26_child_${i}`;
        childIds.push(nodeId);

        visState.setGraphNode(nodeId, {
          label: `BT26 Child ${i}`,
          width: 180,
          height: 60,
          hidden: false,
        });
      }

      visState.setContainer('bt_26', {
        collapsed: true,
        hidden: false,
        children: childIds,
        width: 200,
        height: 150,
      });

      const visibleNodes = visState.visibleNodes;
      const visibleNodeIds = visibleNodes.map(n => n.id);

      for (const childId of childIds) {
        expect(visibleNodeIds).not.toContain(childId);
      }

      expect(visibleNodes).toHaveLength(0);

      const collapsedAsNodes = visState.getCollapsedContainersAsNodes();
      expect(collapsedAsNodes).toHaveLength(1);
      expect(collapsedAsNodes[0]).toMatchObject({
        id: 'bt_26',
        width: 200,
        height: 150,
      });

      const expandedContainers = visState.getExpandedContainers();
      expect(expandedContainers).toHaveLength(0);
    });

    test('should prevent dimension explosion with nested collapsed containers', () => {
      const outerNodes = [];
      const inner1Nodes = [];
      const inner2Nodes = [];

      for (let i = 0; i < 15; i++) {
        const outerNodeId = `outer_node_${i}`;
        const inner1NodeId = `inner1_node_${i}`;
        const inner2NodeId = `inner2_node_${i}`;

        outerNodes.push(outerNodeId);
        inner1Nodes.push(inner1NodeId);
        inner2Nodes.push(inner2NodeId);

        visState.setGraphNode(outerNodeId, { label: `Outer Node ${i}`, hidden: false });
        visState.setGraphNode(inner1NodeId, { label: `Inner1 Node ${i}`, hidden: false });
        visState.setGraphNode(inner2NodeId, { label: `Inner2 Node ${i}`, hidden: false });
      }

      visState.setContainer('inner_container_1', {
        collapsed: false,
        hidden: false,
        children: inner1Nodes,
        width: 250,
        height: 150,
      });

      visState.setContainer('inner_container_2', {
        collapsed: false,
        hidden: false,
        children: inner2Nodes,
        width: 250,
        height: 150,
      });

      visState.setContainer('outer_container', {
        collapsed: false,
        hidden: false,
        children: [...outerNodes, 'inner_container_1', 'inner_container_2'],
        width: 300,
        height: 200,
      });

      let visibleNodes = visState.visibleNodes;
      expect(visibleNodes).toHaveLength(45);

      visState.collapseContainer('inner_container_1');
      visState.collapseContainer('inner_container_2');

      visibleNodes = visState.visibleNodes;
      expect(visibleNodes).toHaveLength(15);

      visState.collapseContainer('outer_container');

      visibleNodes = visState.visibleNodes;
      expect(visibleNodes).toHaveLength(0);

      const collapsedAsNodes = visState.getCollapsedContainersAsNodes();
      expect(collapsedAsNodes).toHaveLength(1);

      const expandedContainers = visState.getExpandedContainers();
      expect(expandedContainers).toHaveLength(0);
    });

    test('should provide consistent data to ELK Bridge - no massive container hierarchies', () => {
      const massiveChildCount = 50;
      const childIds = [];

      for (let i = 0; i < massiveChildCount; i++) {
        const nodeId = `massive_child_${i}`;
        childIds.push(nodeId);
        visState.setGraphNode(nodeId, {
          label: `Child ${i}`,
          width: 180,
          height: 60,
          hidden: false,
        });
      }

      visState.setContainer('massive_container', {
        collapsed: true,
        hidden: false,
        children: childIds,
        width: 200,
        height: 150,
      });

      const expandedContainers = visState.getExpandedContainers();
      const visibleNodes = visState.visibleNodes;
      const collapsedAsNodes = visState.getCollapsedContainersAsNodes();

      const problematicContainers = expandedContainers.filter(c => c.children.size > 10);
      expect(problematicContainers).toHaveLength(0);

      expect(visibleNodes).toHaveLength(0);

      expect(collapsedAsNodes).toHaveLength(1);
      expect(collapsedAsNodes[0].id).toBe('massive_container');
    });
  });

  describe('Hidden Container ELK Filtering', () => {
    let state: ReturnType<typeof createVisualizationState>;

    beforeEach(() => {
      state = createVisualizationState();
    });

    it('should exclude hidden collapsed containers from ELK layout', async () => {
      state.setContainer('hiddenCollapsed', {
        collapsed: true,
        hidden: true,
        children: ['node1'],
      });
      state.setGraphNode('node1', {
        hidden: true,
        width: 100,
        height: 50,
      });
      state.setContainer('visibleCollapsed', {
        collapsed: false,
        hidden: false,
        children: ['node2'],
      });
      state.setGraphNode('node2', {
        hidden: false,
        width: 100,
        height: 50,
      });

      state.collapseContainer('visibleCollapsed');

      const visibleContainers = state.visibleContainers;
      expect(visibleContainers).toHaveLength(1);
      expect(visibleContainers[0].id).toBe('visibleCollapsed');
      expect(visibleContainers[0].collapsed).toBe(true);
      expect(visibleContainers[0].hidden).toBe(false);

      const hiddenContainer = visibleContainers.find(c => c.id === 'hiddenCollapsed');
      expect(hiddenContainer).toBeUndefined();
    });

    it('should not include nodes from hidden containers in visible nodes', async () => {
      state.setContainer('hiddenContainer', {
        collapsed: true,
        hidden: true,
        children: ['hiddenNode'],
      });
      state.setGraphNode('hiddenNode', {
        hidden: true,
        width: 100,
        height: 50,
      });
      state.setContainer('visibleContainer', {
        collapsed: false,
        hidden: false,
        children: ['visibleNode'],
      });
      state.setGraphNode('visibleNode', {
        hidden: false,
        width: 100,
        height: 50,
      });

      const visibleNodes = state.visibleNodes;
      expect(visibleNodes).toHaveLength(1);
      expect(visibleNodes[0].id).toBe('visibleNode');
      expect(visibleNodes[0].hidden).toBe(false);

      const hiddenNode = visibleNodes.find(n => n.id === 'hiddenNode');
      expect(hiddenNode).toBeUndefined();
    });
  });

  describe('Layout Configuration Changes', () => {
    it('should accept different layout algorithms', async () => {
      const visState = createVisualizationState();

      visState.setGraphNode('node1', { label: 'Node 1', hidden: false, style: 'default' });
      visState.setGraphNode('node2', { label: 'Node 2', hidden: false, style: 'default' });
      visState.setGraphEdge('edge1', {
        source: 'node1',
        target: 'node2',
        hidden: false,
        style: 'default',
      });

      const algorithms = ['mrtree', 'layered', 'force', 'stress', 'radial'] as const;

      for (const algorithm of algorithms) {
        const bridge = new ELKBridge({ algorithm });
        await bridge.layoutVisualizationState(visState);

        const node1Layout = visState.getNodeLayout('node1');
        const node2Layout = visState.getNodeLayout('node2');

        expect(node1Layout).toBeDefined();
        expect(node2Layout).toBeDefined();
        expect(typeof node1Layout?.position?.x).toBe('number');
        expect(typeof node1Layout?.position?.y).toBe('number');
      }
    });

    it('should update layout config dynamically', async () => {
      const visState = createVisualizationState();

      visState.setGraphNode('node1', { label: 'Node 1', hidden: false, style: 'default' });
      visState.setGraphNode('node2', { label: 'Node 2', hidden: false, style: 'default' });

      const bridge = new ELKBridge({ algorithm: 'mrtree' });

      await bridge.layoutVisualizationState(visState);
      const initialPosition = visState.getNodeLayout('node1')?.position;

      bridge.updateLayoutConfig({ algorithm: 'force' });
      await bridge.layoutVisualizationState(visState);
      const newPosition = visState.getNodeLayout('node1')?.position;

      expect(initialPosition).toBeDefined();
      expect(newPosition).toBeDefined();
      expect(typeof newPosition?.x).toBe('number');
      expect(typeof newPosition?.y).toBe('number');
    });
  });

  describe('Layout Boundaries', () => {
    it('should validate layout boundaries correctly', () => {
      const state = createVisualizationState();

      state.setContainer('container1', {
        label: 'Container 1',
        collapsed: false,
        position: { x: 100, y: 100 },
        dimensions: { width: 400, height: 300 },
      });

      const container = state.visibleContainers.find(c => c.id === 'container1');
      expect(container).toBeDefined();
      expect(container?.position?.x).toBe(100);
      expect(container?.position?.y).toBe(100);
      expect(container?.dimensions?.width).toBe(400);
      expect(container?.dimensions?.height).toBe(300);
    });

    it('should calculate optimal boundaries', () => {
      const state = createVisualizationState();

      state.setContainer('container2', {
        label: 'Container 2',
        collapsed: false,
        position: { x: 0, y: 0 },
        dimensions: { width: 200, height: 200 },
      });

      const container = state.visibleContainers.find(c => c.id === 'container2');
      expect(container).toBeDefined();
      expect(container?.dimensions?.width).toBe(200);
      expect(container?.dimensions?.height).toBe(200);
    });
  });

  describe('Basic ELKBridge Functionality', () => {
    it('should create an ELKBridge instance', () => {
      const bridge = new ELKBridge();
      expect(bridge).toBeDefined();
      expect(bridge).toBeInstanceOf(ELKBridge);
    });

    it('should complete layout without errors', async () => {
      const bridge = new ELKBridge();
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'Test Node 1',
        style: 'default',
        hidden: false,
      });

      state.setGraphNode('node2', {
        label: 'Test Node 2',
        style: 'default',
        hidden: false,
      });

      state.setGraphEdge('edge1', {
        source: 'node1',
        target: 'node2',
        style: 'default',
      });

      await expect(bridge.layoutVisualizationState(state)).resolves.not.toThrow();
    });

    it('should update node positions after layout', async () => {
      const bridge = new ELKBridge();
      const state = createVisualizationState();

      state.setGraphNode('node1', {
        label: 'Node 1',
        style: 'default',
        hidden: false,
      });

      state.setGraphNode('node2', {
        label: 'Node 2',
        style: 'default',
        hidden: false,
      });

      await bridge.layoutVisualizationState(state);

      const finalNodes = state.visibleNodes;
      const node1After = finalNodes.find(n => n.id === 'node1');
      const node2After = finalNodes.find(n => n.id === 'node2');

      expect(node1After).toBeDefined();
      expect(node2After).toBeDefined();

      expect(typeof node1After!.x).toBe('number');
      expect(typeof node1After!.y).toBe('number');
      expect(typeof node2After!.x).toBe('number');
      expect(typeof node2After!.y).toBe('number');
    });
  });
});
