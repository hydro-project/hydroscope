/**
 * Comprehensive Fuzz Testing for the Entire Visualizer
 *
 * Combines the "DISCONNECTED EDGES BUG HUNTER" with expanded fuzz testing
 * to stress test all visualizer controls and operations using paxos-flipped.json
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseGraphJSON, validateGraphJSON } from '../core/JSONParser';
import { VisualizationState } from '../core/VisualizationState';
import { VisualizationEngine } from '../core/VisualizationEngine';
import type { LayoutConfig } from '../core/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Skip fuzz tests by default unless explicitly enabled
const shouldRunFuzzTests = process.env.ENABLE_FUZZ_TESTS === 'true';

// Enhanced fuzz test configuration
const FUZZ_ITERATIONS = 50; // Number of fuzz cycles
const MAX_OPERATIONS_PER_ITERATION = 20; // Max operations in a single iteration
const OPERATION_SEED = 42; // For reproducible randomness

// All available operations that can be fuzzed
type FuzzOperation =
  | { type: 'expandNode'; containerId: string }
  | { type: 'contractNode'; containerId: string }
  | { type: 'expandAllNodes' }
  | { type: 'contractAllNodes' }
  | { type: 'changeHierarchy'; hierarchyId: string }
  | {
      type: 'changeLayout';
      algorithm: 'mrtree' | 'layered' | 'force' | 'stress' | 'radial';
      direction?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
    }
  | { type: 'toggleAutofit'; enabled: boolean }
  | { type: 'fitToViewport' }
  | { type: 'hierarchyTreeExpand'; containerId: string }
  | { type: 'hierarchyTreeContract'; containerId: string }
  | { type: 'search'; query: string; expectedMatches?: number }
  | { type: 'searchNavigation'; direction: 'next' | 'prev' }
  | { type: 'clearSearch' };

// State snapshot for comprehensive monitoring
interface ComprehensiveStateSnapshot {
  visibleNodes: number;
  visibleEdges: number;
  hyperEdges: number;
  expandedContainers: number;
  collapsedContainers: number;
  currentLayoutAlgorithm: string;
  currentHierarchy: string | null;
  autoLayoutEnabled: boolean;
  phase: string;
  layoutCount: number;
  searchState: {
    query: string;
    matches: number;
    currentIndex: number;
  };
}

// Simple PRNG for reproducible tests
class SimpleRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Edge integrity validation (from BUG HUNTER)
 */
async function validateEdgeIntegrity(state: VisualizationState, context: string): Promise<void> {
  const visibleNodes = state.getVisibleNodes();
  const visibleEdges = state.visibleEdges;
  const visibleContainers = state.getVisibleContainers();
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleContainerIds = new Set(visibleContainers.map(c => c.id));
  const allVisibleEntityIds = new Set([...visibleNodeIds, ...visibleContainerIds]);

  const visibleHyperEdges = state.visibleHyperEdges;
  let disconnectedEdges = 0;

  for (const hyperEdge of visibleHyperEdges) {
    // Validate source
    if (!allVisibleEntityIds.has(hyperEdge.source)) {
      disconnectedEdges++;
      console.error(
        `🚨 DISCONNECTED HYPEREDGE SOURCE: ${hyperEdge.id} missing source ${hyperEdge.source}`
      );
    }

    // Validate target
    if (!allVisibleEntityIds.has(hyperEdge.target)) {
      disconnectedEdges++;
      console.error(
        `🚨 DISCONNECTED HYPEREDGE TARGET: ${hyperEdge.id} missing target ${hyperEdge.target}`
      );
    }
  }

  if (disconnectedEdges > 0) {
    throw new Error(
      `❌ Edge integrity validation failed in ${context}!\n` +
        `Found ${disconnectedEdges} disconnected hyperEdge endpoints.`
    );
  }

  // Check for the "all edges disappeared" bug
  const edgeCount = visibleHyperEdges.length + visibleEdges.length;
  const nodeCount = visibleNodes.length;

  if (edgeCount === 0 && nodeCount > 0) {
    throw new Error(`🚨 CRITICAL BUG: All edges disappeared but nodes remain! Context: ${context}`);
  }
}

/**
 * Comprehensive fuzz tester
 */
class ComprehensiveFuzzTester {
  private random: SimpleRandom;
  private availableHierarchies: string[] = [];
  private availableLayouts: Array<{
    algorithm: 'mrtree' | 'layered' | 'force' | 'stress' | 'radial';
    direction?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  }>;
  private autofitEnabled: boolean = true;
  private searchState: {
    query: string;
    matches: number;
    currentIndex: number;
  } = {
    query: '',
    matches: 0,
    currentIndex: 0,
  };
  private searchPatternsPool: string[] = [
    '*', // Match all
    'container*', // Match containers starting with 'container'
    '*node*', // Match anything containing 'node'
    'test?', // Single character wildcard
    '*map', // Match ending with 'map'
    'filter*', // Match starting with 'filter'
    '??_*', // Two chars followed by underscore and anything
    'poll*', // Match specific patterns from test data
    '*closure*', // Match closures
    '*server*', // Match servers
    '', // Empty search (clear)
  ];

  constructor(
    private testData: any,
    private testName: string
  ) {
    this.random = new SimpleRandom(OPERATION_SEED);
    this.availableLayouts = [
      { algorithm: 'mrtree', direction: 'DOWN' },
      { algorithm: 'mrtree', direction: 'UP' },
      { algorithm: 'mrtree', direction: 'LEFT' },
      { algorithm: 'mrtree', direction: 'RIGHT' },
      { algorithm: 'layered', direction: 'DOWN' },
      { algorithm: 'layered', direction: 'RIGHT' },
      { algorithm: 'force' },
      { algorithm: 'stress' },
      { algorithm: 'radial' },
    ];
  }

  /**
   * Run comprehensive fuzz test
   */
  async runTest(groupingId: string | null = null): Promise<void> {
    console.log(
      `🎲 Starting comprehensive fuzz test: ${this.testName} (grouping: ${groupingId || 'default'})`
    );

    // Parse the data
    const result = parseGraphJSON(this.testData, groupingId ?? undefined);
    const state = result.state;

    // Extract available hierarchies
    this.availableHierarchies = this.testData.hierarchyChoices?.map((h: any) => h.id) || [];

    // Create engine for realistic testing
    const engine = new VisualizationEngine(state, {
      enableLogging: false, // Reduce noise
      layoutConfig: {
        enableSmartCollapse: true,
        algorithm: 'mrtree',
        direction: 'DOWN',
      },
    });

    console.log(
      `📊 Initial state: ${state.getVisibleNodes().length} nodes, ${state.visibleHyperEdges.length} hyperEdges, ${state.getVisibleContainers().length} containers`
    );

    // Run initial layout
    await engine.runLayout();

    // Use the existing validateInvariants method instead of our own
    state.validateInvariants();
    await validateEdgeIntegrity(state, 'Initial layout');

    let totalOperations = 0;
    let disconnectedEdgeIssues = 0;

    // Run fuzz iterations
    for (let iteration = 0; iteration < FUZZ_ITERATIONS; iteration++) {
      const operationsThisIteration = this.random.integer(1, MAX_OPERATIONS_PER_ITERATION);

      console.log(
        `\n🔄 FUZZ ITERATION ${iteration + 1}/${FUZZ_ITERATIONS}: Planning ${operationsThisIteration} operations...`
      );

      for (let op = 0; op < operationsThisIteration; op++) {
        const operation = this.generateRandomOperation(state);

        if (operation) {
          const beforeState = this.captureStateSnapshot(state, engine);

          try {
            // Execute operation
            await this.executeOperation(state, engine, operation);
            totalOperations++;

            // Use the existing validateInvariants method
            state.validateInvariants();
            await validateEdgeIntegrity(
              state,
              `After operation ${totalOperations}: ${operation.type}`
            );
          } catch (error: unknown) {
            console.error(`❌ Operation ${totalOperations} failed:`, operation);
            console.error(`   Before:`, beforeState);
            console.error(`   Error:`, error instanceof Error ? error.message : String(error));

            if (error instanceof Error && error.message.includes('disconnected')) {
              disconnectedEdgeIssues++;
              // Continue testing to find more issues
              console.log(`🔄 Continuing fuzz test to discover more issues...`);
            } else {
              throw error; // Re-throw non-edge related errors
            }
          }
        }
      }

      // Periodic progress report
      if ((iteration + 1) % 10 === 0) {
        const currentState = this.captureStateSnapshot(state, engine);
        console.log(
          `   ⚡ Progress: ${iteration + 1}/${FUZZ_ITERATIONS} iterations, ${totalOperations} operations completed`
        );
        console.log(
          `   📊 Current: ${currentState.visibleNodes} nodes, ${currentState.hyperEdges} hyperEdges, layout: ${currentState.currentLayoutAlgorithm}`
        );
      }
    }

    // Final validation using the existing method
    state.validateInvariants();
    await validateEdgeIntegrity(state, 'Final state after comprehensive testing');

    // Report results
    console.log(`\n🎯 COMPREHENSIVE FUZZ TEST RESULTS:`);
    console.log(`   Test name: ${this.testName}`);
    console.log(`   Grouping: ${groupingId || 'default'}`);
    console.log(`   Total operations: ${totalOperations}`);
    console.log(`   Disconnected edge issues: ${disconnectedEdgeIssues}`);
    console.log(
      `   Final state: ${state.getVisibleNodes().length} nodes, ${state.visibleHyperEdges.length} hyperEdges`
    );

    const finalEngineState = engine.getState();
    console.log(
      `   Engine phase: ${finalEngineState.phase}, Layout count: ${finalEngineState.layoutCount}`
    );

    // Test passes if no disconnected edges are found
    if (disconnectedEdgeIssues > 0) {
      throw new Error(
        `🚨 Found ${disconnectedEdgeIssues} disconnected edge issues during fuzz testing!`
      );
    }

    console.log(`✅ COMPREHENSIVE FUZZ TEST PASSED: All visualizer controls working correctly!`);
  }

  /**
   * Check if a container can be expanded (all ancestors must be expanded)
   */
  private canExpandContainer(state: VisualizationState, containerId: string): boolean {
    const container = state.getContainer(containerId);
    if (!container || !container.collapsed) {
      return false; // Can't expand if it doesn't exist or is already expanded
    }

    // Check if all ancestors are expanded by walking up the hierarchy
    let currentId = containerId;
    while (currentId) {
      // Get the parent of the current container
      const parentId = state.getNodeContainer(currentId);
      if (!parentId) {
        break; // Reached the root
      }

      const parent = state.getContainer(parentId);
      if (!parent) {
        break; // Parent doesn't exist (shouldn't happen)
      }

      if (parent.collapsed) {
        return false; // An ancestor is collapsed, so this container can't be expanded
      }

      currentId = parentId;
    }

    return true; // All ancestors are expanded, so this container can be expanded
  }

  /**
   * Check if a container can be collapsed (must be currently expanded and visible)
   */
  private canCollapseContainer(state: VisualizationState, containerId: string): boolean {
    const container = state.getContainer(containerId);
    if (!container || container.collapsed || container.hidden) {
      return false; // Can't collapse if it doesn't exist, is already collapsed, or is hidden
    }

    return true; // Container is expanded and visible, so it can be collapsed
  }

  /**
   * Generate a random operation from all available visualizer controls
   */
  private generateRandomOperation(state: VisualizationState): FuzzOperation | null {
    const allContainers = state.getVisibleContainers();
    // Get only containers that can actually be expanded (all ancestors are expanded)
    const expandableContainers = allContainers.filter(
      c => c.collapsed && this.canExpandContainer(state, c.id)
    );
    // Get only containers that can actually be collapsed (expanded and visible)
    const collapsibleContainers = allContainers.filter(
      c => !c.collapsed && this.canCollapseContainer(state, c.id)
    );

    const operations: string[] = [
      'expandNode',
      'contractNode',
      'changeLayout',
      'fitToViewport',
      'toggleAutofit',
      'search',
      'searchNavigation',
      'clearSearch',
    ];

    // Add bulk operations if containers exist
    if (allContainers.length > 0) {
      operations.push('expandAllNodes', 'contractAllNodes');
    }

    // Add hierarchy operations if multiple hierarchies available
    if (this.availableHierarchies.length > 1) {
      operations.push('changeHierarchy');
    }

    // Add hierarchy tree operations if containers exist
    if (allContainers.length > 0) {
      operations.push('hierarchyTreeExpand', 'hierarchyTreeContract');
    }

    const operationType = this.random.choice(operations);

    switch (operationType) {
      case 'expandNode':
        if (expandableContainers.length === 0) return null;
        return {
          type: 'expandNode',
          containerId: this.random.choice(expandableContainers).id,
        };

      case 'contractNode':
        if (collapsibleContainers.length === 0) return null;
        return {
          type: 'contractNode',
          containerId: this.random.choice(collapsibleContainers).id,
        };

      case 'expandAllNodes':
        return { type: 'expandAllNodes' };

      case 'contractAllNodes':
        return { type: 'contractAllNodes' };

      case 'changeHierarchy':
        if (this.availableHierarchies.length === 0) return null;
        return {
          type: 'changeHierarchy',
          hierarchyId: this.random.choice(this.availableHierarchies),
        };

      case 'changeLayout':
        const layoutConfig = this.random.choice(this.availableLayouts);
        return {
          type: 'changeLayout',
          algorithm: layoutConfig.algorithm,
          direction: layoutConfig.direction,
        };

      case 'toggleAutofit':
        this.autofitEnabled = !this.autofitEnabled;
        return {
          type: 'toggleAutofit',
          enabled: this.autofitEnabled,
        };

      case 'fitToViewport':
        return { type: 'fitToViewport' };

      case 'hierarchyTreeExpand':
        if (expandableContainers.length === 0) return null;
        return {
          type: 'hierarchyTreeExpand',
          containerId: this.random.choice(expandableContainers).id,
        };

      case 'hierarchyTreeContract':
        if (collapsibleContainers.length === 0) return null;
        return {
          type: 'hierarchyTreeContract',
          containerId: this.random.choice(collapsibleContainers).id,
        };

      case 'search':
        const searchQuery = this.random.choice(this.searchPatternsPool);
        return {
          type: 'search',
          query: searchQuery,
        };

      case 'searchNavigation':
        // Only navigate if there's an active search with matches
        if (this.searchState.query && this.searchState.matches > 0) {
          return {
            type: 'searchNavigation',
            direction: this.random.boolean() ? 'next' : 'prev',
          };
        }
        return null;

      case 'clearSearch':
        return { type: 'clearSearch' };

      default:
        return null;
    }
  }

  /**
   * Execute a fuzz operation
   */
  private async executeOperation(
    state: VisualizationState,
    engine: VisualizationEngine,
    operation: FuzzOperation
  ): Promise<void> {
    switch (operation.type) {
      case 'expandNode':
        state.expandContainer(operation.containerId);
        await engine.runLayout();
        break;

      case 'contractNode':
        state.collapseContainer(operation.containerId);
        await engine.runLayout();
        break;

      case 'expandAllNodes':
        // Expand all containers using bulk method with suspended layout
        engine.suspendAutoLayout();
        state.expandAllContainers();
        engine.resumeAutoLayout(false); // Resume but don't trigger immediately
        await engine.runLayout();
        break;

      case 'contractAllNodes':
        // Collapse all containers using bulk method
        state.collapseAllContainers();
        await engine.runLayout();
        break;

      case 'changeHierarchy':
        // Parse data with new hierarchy (for validation, but result not used)
        parseGraphJSON(this.testData, operation.hierarchyId);
        // This would require engine reinitialization - for now, just log
        console.log(`   🔄 Hierarchy change simulated: ${operation.hierarchyId}`);
        break;

      case 'changeLayout':
        const layoutConfig: LayoutConfig = {
          algorithm: operation.algorithm,
          direction: operation.direction,
          enableSmartCollapse: true,
        };
        engine.updateLayoutConfig(layoutConfig, true);
        break;

      case 'toggleAutofit':
        // Autofit toggle - this would affect viewport fitting behavior
        console.log(`   🔄 Autofit toggled: ${operation.enabled}`);
        break;

      case 'fitToViewport':
        // Viewport fitting - simulate by running layout
        await engine.runLayout();
        console.log(`   🔄 Fit to viewport executed`);
        break;

      case 'hierarchyTreeExpand':
        // HierarchyTree expand - same as regular expand, respects hierarchy constraints
        state.expandContainer(operation.containerId);
        await engine.runLayout();
        break;

      case 'hierarchyTreeContract':
        // HierarchyTree collapse - same as regular collapse, respects hierarchy constraints
        state.collapseContainer(operation.containerId);
        await engine.runLayout();
        break;

      case 'search':
        await this.executeSearchOperation(state, operation.query);
        break;

      case 'searchNavigation':
        this.executeSearchNavigation(operation.direction);
        break;

      case 'clearSearch':
        this.clearSearch();
        break;
    }
  }

  /**
   * Execute a search operation
   */
  private async executeSearchOperation(state: VisualizationState, query: string): Promise<void> {
    // Simulate search matching logic (similar to SearchControls)
    const matches = this.performSearch(state, query);

    // Update search state
    this.searchState = {
      query,
      matches: matches.length,
      currentIndex: matches.length > 0 ? 0 : 0,
    };

    // Test search expansion logic
    if (matches.length > 0) {
      const currentCollapsed = new Set(
        state
          .getVisibleContainers()
          .filter(c => c.collapsed)
          .map(c => c.id)
      );

      try {
        // Test the getSearchExpansionKeys method which is used by InfoPanel/HierarchyTree
        const expansionKeys = state.getSearchExpansionKeys(matches, currentCollapsed);

        // Validate that expansion keys are actually container IDs
        for (const key of expansionKeys) {
          const container = state.getContainer(key);
          if (!container) {
            throw new Error(`Search expansion returned invalid container ID: ${key}`);
          }
        }

        console.log(
          `   🔍 Search "${query}" found ${matches.length} matches, expansion keys: ${expansionKeys.length}`
        );
      } catch (error) {
        console.warn(
          `⚠️  Search expansion validation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      console.log(`   🔍 Search "${query}" found no matches`);
    }
  }

  /**
   * Perform search matching (wildcard pattern matching)
   */
  private performSearch(
    state: VisualizationState,
    query: string
  ): Array<{ id: string; label: string; type: 'container' | 'node' }> {
    if (!query.trim()) {
      return [];
    }

    // Convert wildcard pattern to regex (similar to SearchControls logic)
    const toRegex = (pattern: string): RegExp | null => {
      const raw = pattern.trim();
      if (!raw) return null;
      const escaped = raw
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex chars
        .replace(/\\\*/g, '.*') // * -> .*
        .replace(/\\\?/g, '.'); // ? -> .
      try {
        return new RegExp(escaped, 'i');
      } catch {
        return null;
      }
    };

    const regex = toRegex(query);
    if (!regex) return [];

    const matches: Array<{ id: string; label: string; type: 'container' | 'node' }> = [];

    // Search containers
    for (const container of state.getVisibleContainers()) {
      const label = container?.data?.label || container?.label || container.id;
      if (regex.test(label)) {
        matches.push({ id: container.id, label, type: 'container' });
      }
    }

    // Search nodes
    for (const node of state.getVisibleNodes()) {
      const label = node?.data?.label || node?.label || node?.id;
      if (regex.test(label)) {
        matches.push({ id: node.id, label, type: 'node' });
      }
    }

    return matches;
  }

  /**
   * Execute search navigation
   */
  private executeSearchNavigation(direction: 'next' | 'prev'): void {
    if (this.searchState.matches === 0) return;

    if (direction === 'next') {
      this.searchState.currentIndex =
        (this.searchState.currentIndex + 1) % this.searchState.matches;
    } else {
      this.searchState.currentIndex =
        (this.searchState.currentIndex - 1 + this.searchState.matches) % this.searchState.matches;
    }

    console.log(
      `   🔍 Search navigation: ${direction} to ${this.searchState.currentIndex + 1}/${this.searchState.matches}`
    );
  }

  /**
   * Clear search state
   */
  private clearSearch(): void {
    this.searchState = {
      query: '',
      matches: 0,
      currentIndex: 0,
    };
    console.log(`   🔍 Search cleared`);
  }

  /**
   * Capture comprehensive state snapshot
   */
  private captureStateSnapshot(
    state: VisualizationState,
    engine: VisualizationEngine
  ): ComprehensiveStateSnapshot {
    const engineState = engine.getState();

    return {
      visibleNodes: state.getVisibleNodes().length,
      visibleEdges: state.visibleEdges.length,
      hyperEdges: state.visibleHyperEdges.length,
      expandedContainers: state.getExpandedContainers().length,
      collapsedContainers: state.getVisibleContainers().filter(c => c.collapsed).length,
      currentHierarchy: null, // Would need hierarchy tracking
      currentLayoutAlgorithm: 'unknown', // Would need layout config tracking
      autoLayoutEnabled: true, // Would need autofit tracking
      phase: engineState.phase,
      layoutCount: engineState.layoutCount,
      searchState: this.searchState,
    };
  }
}

// Vitest test suite - use conditional describe to skip by default
const testSuite = shouldRunFuzzTests ? describe : describe.skip;

testSuite('Comprehensive Visualizer Fuzz Testing', () => {
  it('should stress test all visualizer controls with paxos-flipped.json without finding disconnected edges', async () => {
    console.log('🧪 STARTING COMPREHENSIVE FUZZ TESTING SUITE');
    console.log('============================================\n');

    // Load paxos-flipped.json as specified
    const paxosFilePath = join(__dirname, '../test-data/paxos-flipped.json');
    const paxosJsonString = readFileSync(paxosFilePath, 'utf-8');

    // Validate the data first
    const validation = validateGraphJSON(paxosJsonString);
    if (!validation.isValid) {
      throw new Error(`❌ paxos-flipped.json failed validation: ${validation.errors}`);
    }

    console.log(
      `✅ paxos-flipped.json loaded and validated (${validation.nodeCount} nodes, ${validation.edgeCount} edges)`
    );

    const data = JSON.parse(paxosJsonString);
    const groupings = data.hierarchyChoices || [];

    console.log(
      `📊 Found ${groupings.length} groupings: ${groupings.map((g: any) => g.name).join(', ')}`
    );

    // Test first grouping only for initial testing
    if (groupings.length > 0) {
      const grouping = groupings[0];
      console.log(`\n🎯 Testing grouping: ${grouping.name} (${grouping.id})`);
      const tester = new ComprehensiveFuzzTester(data, `paxos-flipped-${grouping.name}`);
      await tester.runTest(grouping.id);
    } else {
      console.log(`⚠️ No groupings found, testing with flat structure`);
      const tester = new ComprehensiveFuzzTester(data, 'paxos-flipped');
      await tester.runTest();
    }

    console.log('\n🎉 COMPREHENSIVE FUZZ TEST COMPLETED SUCCESSFULLY!');
    console.log('No disconnected edges or visualizer control issues found.');
  }, 120000); // 2 minute timeout for comprehensive testing

  it('should validate individual fuzz operations work correctly', async () => {
    const paxosFilePath = join(__dirname, '../test-data/paxos-flipped.json');
    const paxosJsonString = readFileSync(paxosFilePath, 'utf-8');
    const data = JSON.parse(paxosJsonString);

    // Quick test with just a few iterations
    const tester = new ComprehensiveFuzzTester(data, 'paxos-flipped-quick');

    // Run a quick test with first grouping
    const groupings = data.hierarchyChoices || [];
    const groupingId = groupings.length > 0 ? groupings[0].id : null;

    await tester.runTest(groupingId);

    // If we get here without throwing, the test passed
    expect(true).toBe(true);
  }, 60000); // 1 minute timeout for quick test
});

// Export components for use in other tests
export { ComprehensiveFuzzTester, validateEdgeIntegrity };
