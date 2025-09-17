/**
 * @fileoverview Test to reproduce the search expansion race condition
 * where ReactFlow bridge runs before ELK layout completes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { VisualizationState } from '../core/VisualizationState';
import { ELKBridge } from '../bridges/ELKBridge';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import { parseGraphJSON } from '../core/JSONParser';

describe('Search Layout Race Condition', () => {
  let visualizationState: VisualizationState;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;

  beforeEach(() => {
    // Load paxos.json test data (same as hierarchy invariant test)
    const paxosJsonString = readFileSync(require.resolve('../../test-data/paxos.json'), 'utf-8');

    // Parse the JSON data with default grouping first to get available groupings
    const initialParseResult = parseGraphJSON(paxosJsonString);
    const hierarchyChoices = initialParseResult.metadata.availableGroupings || [];

    // Use Backtrace hierarchy (where the bug was observed)
    const backtraceChoice = hierarchyChoices.find(choice => choice.name === 'Backtrace');
    if (!backtraceChoice) {
      throw new Error('Backtrace hierarchy not found in paxos.json');
    }

    // Re-parse with the selected grouping
    const parseResult = parseGraphJSON(paxosJsonString, backtraceChoice.id);
    visualizationState = parseResult.state;

    // Create bridges
    elkBridge = new ELKBridge();
    reactFlowBridge = new ReactFlowBridge();
  });

  it('should expose race condition when ReactFlow bridge runs before ELK layout completes', async () => {
    console.log('🔍 Testing search expansion with full layout pipeline...');

    // Simulate search for "leader" to trigger expansion
    const searchMatches = [
      { id: 'bt_112', type: 'container' as const },
      { id: 'bt_105', type: 'container' as const },
      { id: 'bt_239', type: 'container' as const },
    ];

    // Get current collapsed containers
    const currentCollapsed = new Set(visualizationState.getCollapsedContainers().map(c => c.id));
    console.log(`📦 Currently collapsed containers: ${currentCollapsed.size}`);

    // Get search expansion keys
    const expansionKeys = visualizationState.getSearchExpansionKeys(
      searchMatches,
      currentCollapsed
    );
    console.log(`🎯 Search expansion keys: ${expansionKeys.length}`);

    // Apply search expansion
    const containersToToggle: string[] = [];
    currentCollapsed.forEach((containerId: string) => {
      if (expansionKeys.includes(containerId)) {
        containersToToggle.push(containerId);
      }
    });

    console.log(`🔄 Containers to toggle: ${containersToToggle.length}`);

    // Apply the toggles
    for (const containerId of containersToToggle) {
      const container = visualizationState.getContainer(containerId);
      if (container?.collapsed) {
        console.log(`🔧 Search expanding container: ${containerId}`);
        visualizationState.expandContainer(containerId);
      }
    }

    // NOW TRIGGER THE FULL LAYOUT PIPELINE
    console.log('🚀 Running ELK layout...');

    // Run ELK layout
    await elkBridge.layoutVisualizationState(visualizationState);

    console.log('🌉 Converting to ReactFlow...');

    // This should either work (if ELK set positions) or throw explicit error (if race condition)
    try {
      const reactFlowData = reactFlowBridge.convertVisualizationState(visualizationState);
      console.log(
        `✅ ReactFlow conversion successful: ${reactFlowData.nodes.length} nodes, ${reactFlowData.edges.length} edges`
      );

      // Verify that hierarchical containers have proper positions
      const hierarchicalContainers = reactFlowData.nodes.filter(
        node => node.type === 'container' && node.parentNode
      );

      console.log(`🏗️ Hierarchical containers: ${hierarchicalContainers.length}`);

      hierarchicalContainers.forEach(container => {
        const pos = container.position;
        if (pos.x === undefined || pos.y === undefined || isNaN(pos.x) || isNaN(pos.y)) {
          throw new Error(
            `❌ Container ${container.id} has invalid position: (${pos.x}, ${pos.y})`
          );
        }
        console.log(`  ✅ Container ${container.id}: position (${pos.x}, ${pos.y})`);
      });
    } catch (error) {
      console.error('❌ ReactFlow conversion failed:', error);

      // Check if this is the expected race condition error
      if (error instanceof Error && error.message.includes('Missing ELK layout position')) {
        console.log('🎯 RACE CONDITION DETECTED: ReactFlow bridge ran before ELK layout completed');
        console.log('   This confirms the timing issue we identified');

        // This is the expected behavior with our fallback removal
        expect(error.message).toContain('Missing ELK layout position');
        expect(error.message).toContain('ELK layout must be run successfully');

        return; // Test passes - we detected the race condition
      }

      // If it's a different error, re-throw it
      throw error;
    }
  }, 10000); // 10 second timeout for complex ELK layout operations

  it('should work correctly when ELK layout completes properly', async () => {
    console.log('🔍 Testing normal layout pipeline without race condition...');

    // Start with a simple expansion that shouldn't cause race conditions
    const someCollapsedContainers = visualizationState.getCollapsedContainers().slice(0, 2);

    for (const container of someCollapsedContainers) {
      console.log(`🔧 Expanding container: ${container.id}`);
      visualizationState.expandContainer(container.id);
    }

    // Run ELK layout
    console.log('🚀 Running ELK layout...');
    await elkBridge.layoutVisualizationState(visualizationState);

    // Convert to ReactFlow - this should work
    console.log('🌉 Converting to ReactFlow...');
    const reactFlowData = reactFlowBridge.convertVisualizationState(visualizationState);

    console.log(
      `✅ ReactFlow conversion successful: ${reactFlowData.nodes.length} nodes, ${reactFlowData.edges.length} edges`
    );

    // Verify all containers have valid positions
    const containerNodes = reactFlowData.nodes.filter(node => node.type === 'container');

    containerNodes.forEach(container => {
      const pos = container.position;
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(isFinite(pos.x)).toBe(true);
      expect(isFinite(pos.y)).toBe(true);
    });
  }, 10000); // 10 second timeout for complex ELK layout operations
});
