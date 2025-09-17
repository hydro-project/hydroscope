/**
 * @fileoverview Hierarchy Invariant Regression Tests
 *
 * Tests to ensure that the VisualizationState API maintains the critical invariant:
 * "If a container is visible, all its parents must be visible and it must be properly nested"
 *
 * This invariant should NEVER be violated, regardless of how containers are expanded/collapsed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
// import { createVisualizationState } from '../__tests__/testUtils';
import { parseGraphJSON } from '../core/JSONParser';

describe('Hierarchy Invariant Regression Tests', () => {
  let visualizationState: any;
  let hierarchyChoices: any[];

  beforeEach(async () => {
    // Load paxos.json test data (same as search tests)
    const paxosJsonString = readFileSync(require.resolve('../test-data/paxos.json'), 'utf-8');

    // Parse the JSON data with default grouping first to get available groupings
    const initialParseResult = parseGraphJSON(paxosJsonString);
    hierarchyChoices = initialParseResult.metadata.availableGroupings || [];

    // Use Backtrace hierarchy (where the bug was observed)
    const backtraceChoice = hierarchyChoices.find(choice => choice.name === 'Backtrace');
    expect(backtraceChoice).toBeDefined();

    // Re-parse with the selected grouping
    const parseResult = parseGraphJSON(paxosJsonString, backtraceChoice!.id);
    visualizationState = parseResult.state;

    // Set up a realistic collapsed state by collapsing most containers
    // Keep only top-level containers expanded for testing
    const allContainers = Array.from(visualizationState.visibleContainers);
    const topLevelContainers = visualizationState.getTopLevelContainers();
    const topLevelIds = new Set(topLevelContainers.map(c => c.id));

    console.log(
      `📦 Collapsing ${allContainers.length - topLevelContainers.length} containers, keeping ${topLevelContainers.length} top-level expanded`
    );

    // Collapse all non-top-level containers to create a realistic starting state
    for (const container of allContainers) {
      if (!topLevelIds.has(container.id)) {
        visualizationState.collapseContainer(container.id);
      }
    }
  });

  /**
   * Core hierarchy invariant: If a container is visible, all its ancestors must be visible
   */
  function validateHierarchyInvariant(state: any, context: string): void {
    const visibleContainers = Array.from(state.visibleContainers);

    console.log(
      `🔍 [${context}] Validating hierarchy invariant for ${visibleContainers.length} visible containers`
    );

    for (const container of visibleContainers) {
      // Check that all ancestors are visible
      let currentId = container.id;
      let depth = 0;
      const ancestorPath: string[] = [];

      while (currentId && depth < 10) {
        // Prevent infinite loops
        const parent = state.getContainerParent(currentId);

        if (parent) {
          ancestorPath.push(parent);
          const parentContainer = state.getContainer(parent);

          if (!parentContainer) {
            throw new Error(
              `❌ [${context}] Container ${container.id} has parent ${parent} that doesn't exist`
            );
          }

          if (parentContainer.hidden) {
            throw new Error(
              `❌ [${context}] Container ${container.id} is visible but ancestor ${parent} is hidden`
            );
          }

          if (parentContainer.collapsed) {
            throw new Error(
              `❌ [${context}] Container ${container.id} is visible but ancestor ${parent} is collapsed`
            );
          }

          // Check that parent is also in visibleContainers
          const parentIsVisible = visibleContainers.some(c => c.id === parent);
          if (!parentIsVisible) {
            throw new Error(
              `❌ [${context}] Container ${container.id} is visible but ancestor ${parent} is not in visibleContainers`
            );
          }
        }

        currentId = parent;
        depth++;
      }

      if (ancestorPath.length > 0) {
        console.log(
          `  ✅ Container ${container.id} has valid ancestor path: ${ancestorPath.reverse().join(' -> ')} -> ${container.id}`
        );
      } else {
        console.log(`  ✅ Container ${container.id} is a root container (no ancestors)`);
      }
    }

    console.log(`✅ [${context}] Hierarchy invariant validated successfully`);
  }

  it('should maintain hierarchy invariant in initial state', () => {
    validateHierarchyInvariant(visualizationState, 'Initial State');
  });

  it('should maintain hierarchy invariant during manual container expansion', () => {
    // Get some collapsed containers
    const collapsedContainers = visualizationState.getCollapsedContainers();
    expect(collapsedContainers.length).toBeGreaterThan(0);

    // Manually expand a few containers using the proper API
    const containersToExpand = collapsedContainers.slice(0, 3);

    for (const container of containersToExpand) {
      console.log(`🔧 Manually expanding container: ${container.id}`);
      visualizationState.expandContainer(container.id);

      // Validate invariant after each expansion
      validateHierarchyInvariant(visualizationState, `After expanding ${container.id}`);
    }
  });

  it('should maintain hierarchy invariant during manual container collapse', () => {
    // Get some expanded containers
    const expandedContainers = visualizationState.getExpandedContainers();
    expect(expandedContainers.length).toBeGreaterThan(0);

    // Manually collapse a few containers using the proper API
    const containersToCollapse = expandedContainers.slice(0, 2);

    for (const container of containersToCollapse) {
      console.log(`🔧 Manually collapsing container: ${container.id}`);
      visualizationState.collapseContainer(container.id);

      // Validate invariant after each collapse
      validateHierarchyInvariant(visualizationState, `After collapsing ${container.id}`);
    }
  });

  it('should maintain hierarchy invariant during search expansion', () => {
    console.log('🔍 Testing hierarchy invariant during search expansion...');

    // Simulate search for "leader" (same as the bug scenario)
    const searchMatches = [
      { id: 'bt_112', type: 'container' as const }, // leader_election
      { id: 'bt_105', type: 'container' as const }, // p_leader_heartbeat
      { id: 'bt_239', type: 'container' as const }, // leader_election
    ];

    // Get current collapsed containers
    const currentCollapsed = new Set(
      visualizationState.getCollapsedContainers().map((c: any) => c.id)
    );

    console.log(`📦 Currently collapsed containers: ${currentCollapsed.size}`);

    // Get search expansion keys (this is what the search system uses)
    const expansionKeys = visualizationState.getSearchExpansionKeys(
      searchMatches,
      currentCollapsed
    );

    console.log(`🎯 Search expansion keys: ${expansionKeys.length}`);
    console.log(`   Keys: ${expansionKeys.join(', ')}`);

    // Apply search expansion using the same logic as HierarchyTree
    const containersToToggle: string[] = [];
    currentCollapsed.forEach((containerId: string) => {
      if (expansionKeys.includes(containerId)) {
        containersToToggle.push(containerId);
      }
    });

    console.log(`🔄 Containers to toggle: ${containersToToggle.length}`);

    // Apply the toggles using the same API as the real search expansion
    for (const containerId of containersToToggle) {
      const container = visualizationState.getContainer(containerId);
      if (container?.collapsed) {
        console.log(`🔧 Search expanding container: ${containerId}`);
        visualizationState.expandContainer(containerId);
      }
    }

    // CRITICAL: Validate hierarchy invariant after search expansion
    validateHierarchyInvariant(visualizationState, 'After Search Expansion');
  });

  it('should maintain hierarchy invariant during complex search scenarios', () => {
    console.log('🔍 Testing hierarchy invariant during complex search scenarios...');

    // Test multiple search operations in sequence
    const searchScenarios = [
      {
        name: 'Search for "leader"',
        matches: [
          { id: 'bt_112', type: 'container' as const },
          { id: 'bt_105', type: 'container' as const },
          { id: 'bt_239', type: 'container' as const },
        ],
      },
      {
        name: 'Search for "sequence"',
        matches: [
          { id: 'bt_205', type: 'container' as const }, // sequence_payload
          { id: 'bt_54', type: 'container' as const }, // sequence_payload
        ],
      },
      {
        name: 'Clear search (no matches)',
        matches: [],
      },
    ];

    for (const scenario of searchScenarios) {
      console.log(`\n🎯 Testing scenario: ${scenario.name}`);

      const currentCollapsed = new Set(
        visualizationState.getCollapsedContainers().map((c: any) => c.id)
      );
      const expansionKeys = visualizationState.getSearchExpansionKeys(
        scenario.matches,
        currentCollapsed
      );

      // Apply expansion/collapse based on search results
      const allContainers = Array.from(visualizationState.visibleContainers);

      // CRITICAL FIX: Process operations in correct order to maintain hierarchy invariant
      // 1. First, do all collapses (to avoid expanding containers whose ancestors will be collapsed)
      for (const container of allContainers) {
        const shouldBeExpanded = expansionKeys.includes(container.id);
        const isCurrentlyExpanded = !currentCollapsed.has(container.id);

        if (!shouldBeExpanded && isCurrentlyExpanded) {
          console.log(`  🔧 Collapsing: ${container.id}`);
          visualizationState.collapseContainer(container.id);
        }
      }

      // 2. Then, do all expansions (after all collapses are complete)
      for (const container of allContainers) {
        const shouldBeExpanded = expansionKeys.includes(container.id);
        const isCurrentlyExpanded = !currentCollapsed.has(container.id);

        if (shouldBeExpanded && !isCurrentlyExpanded) {
          // Double-check that this container can still be expanded (no collapsed ancestors)
          let canExpand = true;
          let current = visualizationState.getContainerParent(container.id);
          while (current) {
            const parentContainer = visualizationState.getContainer(current);
            if (parentContainer?.collapsed) {
              console.log(
                `  ⚠️  Skipping expansion of ${container.id} - ancestor ${current} is collapsed`
              );
              canExpand = false;
              break;
            }
            current = visualizationState.getContainerParent(current);
          }

          if (canExpand) {
            console.log(`  🔧 Expanding: ${container.id}`);
            visualizationState.expandContainer(container.id);
          }
        }
      }

      // Validate invariant after each scenario
      validateHierarchyInvariant(visualizationState, `After ${scenario.name}`);
    }
  });
});
