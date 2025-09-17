/**
 * Consolidated Debug Tests - Container States, Smart Collapse, and Handle Investigations
 *
 * This file consolidates multiple debug test files:
 * - debug-container-states.test.ts
 * - debug-smart-collapse.test.ts
 * - debugCollapsedContainers.test.ts
 * - debugSmartCollapse.test.ts
 * - debugEdge460.test.ts
 * - handle-difference-investigation.test.ts
 * - handle-dom-investigation.test.ts
 * - handle-rendering-investigation.test.ts
 */

import { describe, it, beforeEach, expect } from 'vitest';
import mockJsonData from '../../test-data/paxos-flipped.json';
import { parseGraphJSON } from '../JSONParser';
import { VisualizationState, createVisualizationState } from '../VisualizationState';
import { VisualizationEngine } from '../VisualizationEngine';
import { ReactFlowBridge } from '../../bridges/ReactFlowBridge';
import { ELKBridge } from '../../bridges/ELKBridge';
import { getHandleConfig } from '../../render/handleConfig';
import paxosFlippedData from '../../test-data/paxos-flipped.json';

describe('Debug Container States & Investigations', () => {
  describe('Container Collapse States', () => {
    it('should show container collapse and visibility states', async () => {
      const parseResult = parseGraphJSON(paxosFlippedData);
      const visState = parseResult.state;

      console.log('🔍 BEFORE COLLAPSE:');
      console.log(
        `Total containers: ${Array.from((visState as any)._collections.containers.keys()).length}`
      );
      console.log(`Visible containers: ${visState.visibleContainers.length}`);

      // Get the first 3 containers like the test does
      const containerIds = Array.from((visState as any)._collections.containers.keys()) as string[];
      const containersToCollapse = containerIds.slice(0, Math.min(3, containerIds.length));

      console.log(`📦 About to collapse: ${containersToCollapse.join(', ')}`);

      // Check their initial states
      for (const containerId of containersToCollapse) {
        const container = visState.getContainer(containerId);
        console.log(
          `Container ${containerId} BEFORE: collapsed=${container?.collapsed}, hidden=${container?.hidden}`
        );
      }

      // Collapse them
      for (const containerId of containersToCollapse) {
        console.log(`Collapsing ${containerId}...`);
        visState.setContainerState(containerId, { collapsed: true });

        const container = visState.getContainer(containerId);
        console.log(
          `Container ${containerId} AFTER: collapsed=${container?.collapsed}, hidden=${container?.hidden}`
        );
      }

      console.log('🔍 AFTER COLLAPSE:');
      console.log(`Visible containers: ${visState.visibleContainers.length}`);

      // Check which collapsed containers are in visibleContainers
      const visibleContainers = visState.visibleContainers;
      const collapsedVisibleContainers = visibleContainers.filter(c => c.collapsed);

      console.log(`Collapsed visible containers: ${collapsedVisibleContainers.length}`);
      collapsedVisibleContainers.forEach(container => {
        console.log(
          `  - ${container.id}: collapsed=${container.collapsed}, hidden=${container.hidden}`
        );
      });

      // Check if bt_81 and bt_98 are in visibleContainers
      const bt81 = visibleContainers.find(c => c.id === 'bt_81');
      const bt98 = visibleContainers.find(c => c.id === 'bt_98');
      const bt12 = visibleContainers.find(c => c.id === 'bt_12');

      console.log(
        `bt_81 in visibleContainers: ${bt81 ? `YES (collapsed=${bt81.collapsed}, hidden=${bt81.hidden})` : 'NO'}`
      );
      console.log(
        `bt_98 in visibleContainers: ${bt98 ? `YES (collapsed=${bt98.collapsed}, hidden=${bt98.hidden})` : 'NO'}`
      );
      console.log(
        `bt_12 in visibleContainers: ${bt12 ? `YES (collapsed=${bt12.collapsed}, hidden=${bt12.hidden})` : 'NO'}`
      );
    });
  });

  describe('Smart Collapse Debug', () => {
    let visState: VisualizationState;
    let engine: VisualizationEngine;

    beforeEach(() => {
      visState = createVisualizationState();
      engine = new VisualizationEngine(visState, {
        enableLogging: true,
        autoLayout: true,
        layoutConfig: {
          enableSmartCollapse: true,
          algorithm: 'mrtree',
          direction: 'DOWN',
        },
      });
    });

    it('should debug smart collapse conditions', async () => {
      // Create many children to make container naturally large
      const childNodes = [];
      for (let i = 0; i < 50; i++) {
        const childId = `child_${i}`;
        visState.setGraphNode(childId, {
          label: `Child ${i}`,
          width: 180,
          height: 60,
        });
        childNodes.push(childId);
      }

      // Create container with many children - ELK will calculate large dimensions
      visState.setContainer('large_container', {
        collapsed: false,
        hidden: false,
        children: childNodes,
      });

      console.log('[TEST] About to call engine.runLayout()');
      await engine.runLayout();
      console.log('[TEST] Layout complete, checking container state');

      const container = visState.getContainer('large_container');
      console.log(`[TEST] Container collapsed: ${container?.collapsed}`);
      console.log(`[TEST] Container dimensions: ${container?.width}x${container?.height}`);

      // With 50 children, the container should be large enough to trigger smart collapse
      expect(container?.collapsed).toBe(true);
    });

    it('should debug missing hyperedges during smart collapse', async () => {
      const result = parseGraphJSON(mockJsonData, undefined);
      const state = result.state;

      console.log('\n=== INITIAL STATE ===');
      console.log('Total nodes:', state.getVisibleNodes().length);
      console.log('Total edges:', state.getVisibleEdges().length);
      console.log('Total containers:', state.getVisibleContainers().length);
      console.log('Total hyperEdges:', state.visibleHyperEdges.length);

      const engine = new VisualizationEngine(state, {
        enableLogging: true,
        layoutConfig: {
          enableSmartCollapse: true,
          algorithm: 'mrtree',
          direction: 'DOWN',
        },
      });

      console.log('\n=== RUNNING SMART COLLAPSE VIA ENGINE ===');
      await engine.runLayout();

      console.log('\n=== POST-SMART-COLLAPSE STATE ===');
      console.log('Total hyperEdges:', state.visibleHyperEdges.length);

      const collapsedContainers = state.getVisibleContainers().filter(c => c.collapsed);
      console.log(`Collapsed containers: ${collapsedContainers.length}`);

      // Try validation - we expect this to fail now
      try {
        state.validateInvariants();
        console.log('✅ Validation passed - no missing hyperEdges!');
      } catch (error) {
        const message = (error as Error).message;
        const missingCount = (message.match(/Edge \w+ crosses collapsed container/g) || []).length;
        console.log(`❌ Validation failed - ${missingCount} missing hyperEdges`);
        const errorLines: string[] = message.split(';').slice(0, 3);
        console.log('First few errors:');
        errorLines.forEach((line: string) => console.log('  ', line.trim()));
      }
    });
  });

  describe('Collapsed Containers Analysis', () => {
    it('should debug which containers are collapsed and analyze missing hyperEdges', async () => {
      const result = parseGraphJSON(mockJsonData, undefined);
      const state = result.state;

      const engine = new VisualizationEngine(state, {
        enableLogging: false,
        layoutConfig: {
          enableSmartCollapse: true,
          algorithm: 'mrtree',
          direction: 'DOWN',
        },
      });

      await engine.runLayout();

      console.log('\n=== ANALYZING COLLAPSED CONTAINERS ===');
      const allContainers = state.getVisibleContainers();
      const collapsedContainers = allContainers.filter(c => c.collapsed);

      console.log(`Total containers: ${allContainers.length}`);
      console.log(`Collapsed containers: ${collapsedContainers.length}`);
      console.log(`Collapsed container IDs: ${collapsedContainers.map(c => c.id).join(', ')}`);

      // Analyze specific failing edges
      const failedCases = [
        { edgeId: 'e376', containerId: 'bt_25' },
        { edgeId: 'e147', containerId: 'bt_138' },
        { edgeId: 'e7', containerId: 'bt_27' },
      ];

      console.log('\n=== ANALYZING SPECIFIC FAILED CASES ===');
      for (const { edgeId, containerId } of failedCases) {
        console.log(`\n--- Case: Edge ${edgeId} vs Container ${containerId} ---`);

        const container = allContainers.find(c => c.id === containerId);
        if (!container) {
          console.log(`❌ Container ${containerId} not found!`);
          continue;
        }

        console.log(
          `Container ${containerId}: collapsed=${container.collapsed}, hidden=${container.hidden}`
        );

        const edge = state.getVisibleEdges().find(e => e.id === edgeId);
        if (!edge) {
          console.log(`❌ Edge ${edgeId} not found in visible edges!`);
          continue;
        }

        console.log(`Edge ${edgeId}: ${edge.source} -> ${edge.target}, hidden=${edge.hidden}`);

        // Find related hyperEdges
        const hyperEdges = state.visibleHyperEdges.filter(
          he =>
            he.source === containerId ||
            he.target === containerId ||
            he.source === edge.source ||
            he.target === edge.source ||
            he.source === edge.target ||
            he.target === edge.target
        );

        console.log(`Related hyperEdges: ${hyperEdges.length}`);
        hyperEdges.forEach(he => {
          console.log(`  HyperEdge ${he.id}: ${he.source} -> ${he.target}`);
        });
      }
    });
  });

  describe('Edge e460 Investigation', () => {
    it('should investigate edge e460 and its relationship to containers', async () => {
      const result = parseGraphJSON(mockJsonData, undefined);
      const state = result.state;

      const engine = new VisualizationEngine(state, {
        enableLogging: false,
        layoutConfig: {
          enableSmartCollapse: true,
          algorithm: 'mrtree',
          direction: 'DOWN',
        },
      });

      await engine.runLayout();

      console.log('\n=== INVESTIGATING EDGE e460 ===');

      // Find edge e460
      let edge460 = null;
      const allEdges = state.getVisibleEdges();
      edge460 = allEdges.find(e => e.id === 'e460');

      if (!edge460) {
        console.log('❌ Edge e460 not found in visible edges');
        const stateAny = state as any;
        for (const [id, edge] of stateAny._collections.graphEdges) {
          if (id === 'e460') {
            edge460 = edge;
            break;
          }
        }
      }

      if (edge460) {
        console.log(
          `✅ Found edge e460: ${edge460.source} -> ${edge460.target}, hidden=${edge460.hidden}`
        );

        // Check problem containers bt_29 and bt_187
        const allContainers = state.getVisibleContainers();
        const containers = [
          { id: 'bt_29', container: allContainers.find(c => c.id === 'bt_29') },
          { id: 'bt_187', container: allContainers.find(c => c.id === 'bt_187') },
        ];

        console.log('\n=== CHECKING PROBLEM CONTAINERS ===');
        for (const { id, container } of containers) {
          if (container) {
            console.log(
              `✅ Container ${id}: collapsed=${container.collapsed}, hidden=${container.hidden}`
            );
          } else {
            console.log(`❌ Container ${id}: not found in visible containers`);
          }
        }

        // Check for relevant hyperEdges
        const relevantHyperEdges = state.visibleHyperEdges.filter(he => {
          const covered = state.getCoveredEdges(he.id);
          return covered.has('e460');
        });

        console.log(`Found ${relevantHyperEdges.length} hyperEdges covering e460:`);
        for (const he of relevantHyperEdges) {
          console.log(`  ${he.id}: ${he.source} -> ${he.target}`);
        }
      } else {
        console.log('❌ Edge e460 not found anywhere!');
      }
    });
  });

  describe('Handle Connection Investigation', () => {
    it('should investigate handle assignment and positioning differences', async () => {
      console.log('\n=== HANDLE CONNECTION INVESTIGATION ===');

      const state = createVisualizationState();

      // Add a regular node and collapsed container
      state.addGraphNode('regular_node', {
        x: 100,
        y: 100,
        width: 120,
        height: 40,
        label: 'Regular Node',
        nodeType: 'Source',
      });

      state.addContainer('collapsed_container', {
        x: 300,
        y: 100,
        width: 200,
        height: 150,
        label: 'Collapsed Container',
        collapsed: true,
      });

      state.setHyperEdge('test_hyper', {
        type: 'hyper',
        id: 'test_hyper',
        source: 'regular_node',
        target: 'collapsed_container',
        hidden: false,
      });

      // Run ELK layout
      const elkBridge = new ELKBridge();
      await elkBridge.layoutVisualizationState(state);

      // Convert to ReactFlow
      const reactFlowBridge = new ReactFlowBridge();
      const reactFlowData = reactFlowBridge.convertVisualizationState(state);

      const regularNode = reactFlowData.nodes.find(n => n.id === 'regular_node')!;
      const collapsedContainer = reactFlowData.nodes.find(n => n.id === 'collapsed_container')!;
      const hyperEdge = reactFlowData.edges.find(e => e.id === 'test_hyper')!;

      console.log('\nVisualizationState data that handle assignment uses:');
      console.log('Source container:', state.getContainer('regular_node')); // Should be null
      console.log('Target container:', state.getContainer('collapsed_container')); // Should be collapsed container

      console.log('\nReactFlow node differences:');
      console.log('Regular node:', {
        id: regularNode.id,
        type: regularNode.type,
        parentId: regularNode.parentId,
        extent: regularNode.extent,
        connectable: regularNode.connectable,
      });

      console.log('Collapsed container:', {
        id: collapsedContainer.id,
        type: collapsedContainer.type,
        parentId: collapsedContainer.parentId,
        extent: collapsedContainer.extent,
        connectable: collapsedContainer.connectable,
      });

      console.log('Hyperedge handles:', {
        sourceHandle: hyperEdge.sourceHandle,
        targetHandle: hyperEdge.targetHandle,
      });

      // Calculate handle positions
      const sourcePos = calculateHandlePosition(
        regularNode.position,
        regularNode.data.width || 120,
        regularNode.data.height || 40,
        hyperEdge.sourceHandle!
      );

      const targetPos = calculateHandlePosition(
        collapsedContainer.position,
        collapsedContainer.data.width || 200,
        collapsedContainer.data.height || 150,
        hyperEdge.targetHandle!
      );

      console.log('\nCalculated handle positions:');
      console.log('Source handle position:', sourcePos);
      console.log('Target handle position:', targetPos);

      const distance = Math.sqrt(
        Math.pow(targetPos.x - sourcePos.x, 2) + Math.pow(targetPos.y - sourcePos.y, 2)
      );
      console.log('Handle distance:', distance.toFixed(2), 'pixels');

      expect(true).toBe(true);
    });

    it('should examine handle configuration and rendering differences', async () => {
      console.log('\n=== HANDLE CONFIGURATION INVESTIGATION ===');

      const state = createVisualizationState();
      state.addGraphNode('test_node', {
        x: 100,
        y: 100,
        width: 120,
        height: 40,
        label: 'Test Node',
      });

      state.addContainer('test_container', {
        x: 300,
        y: 100,
        width: 120,
        height: 40,
        label: 'Test Container',
        collapsed: true,
      });

      const reactFlowBridge = new ReactFlowBridge();
      const reactFlowData = reactFlowBridge.convertVisualizationState(state);

      const testNode = reactFlowData.nodes.find(n => n.id === 'test_node')!;
      const testContainer = reactFlowData.nodes.find(n => n.id === 'test_container')!;

      console.log('\nNode type analysis:');
      console.log('Regular node type:', testNode.type);
      console.log('Container node type:', testContainer.type);

      if (testNode.type !== testContainer.type) {
        console.log('\n🔍 KEY FINDING: Different node types!');
        console.log(
          '   ReactFlow might apply different rendering logic for "standard" vs "container" types'
        );
      }

      const handleConfig = getHandleConfig();
      console.log('\nHandle Configuration:');
      console.log('- Strategy:', handleConfig.enableContinuousHandles ? 'continuous' : 'discrete');
      console.log('- Source handles count:', handleConfig.sourceHandles.length);
      console.log('- Target handles count:', handleConfig.targetHandles.length);

      expect(true).toBe(true);
    });
  });
});

/**
 * Calculate handle position based on node position, dimensions, and handle ID
 */
function calculateHandlePosition(
  nodePosition: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
  handleId: string
): { x: number; y: number } {
  const { x, y } = nodePosition;

  switch (handleId) {
    case 'out-top':
    case 'in-top':
      return { x: x + nodeWidth * 0.5, y: y };
    case 'out-right':
    case 'in-right':
      return { x: x + nodeWidth, y: y + nodeHeight * 0.5 };
    case 'out-bottom':
    case 'in-bottom':
      return { x: x + nodeWidth * 0.5, y: y + nodeHeight };
    case 'out-left':
    case 'in-left':
      return { x: x, y: y + nodeHeight * 0.5 };
    default:
      return { x: x + nodeWidth * 0.5, y: y + nodeHeight * 0.5 };
  }
}
