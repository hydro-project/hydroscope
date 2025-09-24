/**
 * VisualizationState Paxos.json Integration Tests
 * Tests comprehensive data loading, parsing, and operations with real paxos.json data
 */

import { describe, it, expect } from 'vitest';
import { VisualizationState } from '../core/VisualizationState.js';
import { JSONParser } from '../utils/JSONParser.js';
import type { HydroscopeData } from '../types/core.js';
import fs from 'fs';
import path from 'path';

describe('VisualizationState Paxos.json Integration Tests', () => {
  describe('5.1 Test paxos.json data loading and parsing', () => {
    it('should load paxos.json and verify all nodes are created', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser with paxos-specific configuration
      const parser = JSONParser.createPaxosParser({
        debug: false,
        validateDuringParsing: true
      });

      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Verify node count matches paxos.json
      expect(result.stats.nodeCount).toBe(543);
      expect(state.visibleNodes.length).toBe(543);

      // Verify all nodes have required properties
      const nodes = state.visibleNodes;
      for (const node of nodes) {
        expect(node.id).toBeDefined();
        expect(node.label).toBeDefined();
        expect(node.longLabel).toBeDefined();
        expect(node.type).toBeDefined();
        expect(Array.isArray(node.semanticTags)).toBe(true);
        expect(typeof node.hidden).toBe('boolean');
        expect(typeof node.showingLongLabel).toBe('boolean');
      }

      // Verify specific nodes from paxos.json exist
      const node195 = state.getGraphNode('195');
      expect(node195).toBeDefined();
      expect(node195?.label).toBe('cycle_sink');
      expect(node195?.longLabel).toBe('cycle_sink(cycle_10)');
      expect(node195?.type).toBe('Sink');

      // Verify semantic tags are extracted correctly
      expect(node195?.semanticTags).toContain('Sink');
      expect(node195?.semanticTags).toContain('Cluster'); // from data.locationType
    }, 30000);

    it('should load paxos.json and verify all edges are created', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Verify edge count matches paxos.json
      expect(result.stats.edgeCount).toBe(581);
      expect(state.visibleEdges.length).toBe(581);

      // Verify all edges have required properties
      const edges = state.visibleEdges;
      for (const edge of edges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.type).toBeDefined();
        expect(Array.isArray(edge.semanticTags)).toBe(true);
        expect(typeof edge.hidden).toBe('boolean');
      }

      // Verify specific edge from paxos.json exists
      const edge0 = state.getGraphEdge('e0');
      expect(edge0).toBeDefined();
      expect(edge0?.source).toBe('0');
      expect(edge0?.target).toBe('1');

      // Verify semantic tags are extracted correctly from edgeProperties
      expect(edge0?.semanticTags).toContain('Unbounded');
      expect(edge0?.semanticTags).toContain('TotalOrder');
    }, 30000);

    it('should ignore style information and only use semantic tags', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Check that edges don't contain style information
      const edges = state.visibleEdges;
      for (const edge of edges) {
        // Verify edge object doesn't have style properties
        expect((edge as any).style).toBeUndefined();
        expect((edge as any).color).toBeUndefined();
        expect((edge as any).animation).toBeUndefined();
        expect((edge as any).arrowhead).toBeUndefined();
        expect((edge as any).linePattern).toBeUndefined();
        
        // Verify only semantic information is preserved
        expect(edge.semanticTags).toBeDefined();
        expect(Array.isArray(edge.semanticTags)).toBe(true);
      }

      // Check specific edge that has style in paxos.json
      const edge0 = state.getGraphEdge('e0');
      expect(edge0).toBeDefined();
      
      // Verify style is ignored
      expect((edge0 as any).style).toBeUndefined();
      
      // Verify semantic tags are preserved
      expect(edge0?.semanticTags).toContain('Unbounded');
      expect(edge0?.semanticTags).toContain('TotalOrder');
    }, 30000);

    it('should validate container hierarchy matches expected structure', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Verify container count matches hierarchy choices
      expect(result.stats.containerCount).toBe(5); // 5 location containers
      expect(state.visibleContainers.length).toBe(5);

      // Verify expected containers exist
      const expectedContainers = [
        'loc_0', // hydro_test::cluster::paxos::Proposer
        'loc_1', // hydro_test::cluster::paxos::Acceptor
        'loc_2', // hydro_test::cluster::paxos_bench::Client
        'loc_3', // hydro_test::cluster::paxos_bench::Aggregator
        'loc_4'  // hydro_test::cluster::kv_replica::Replica
      ];

      for (const containerId of expectedContainers) {
        const container = state.getContainer(containerId);
        expect(container).toBeDefined();
        expect(container?.id).toBe(containerId);
        expect(container?.label).toBeDefined();
        expect(container?.children.size).toBeGreaterThan(0);
      }

      // Verify all nodes are assigned to containers
      const allNodes = state.visibleNodes;
      let assignedNodeCount = 0;
      
      for (const container of state.visibleContainers) {
        assignedNodeCount += container.children.size;
      }
      
      expect(assignedNodeCount).toBe(allNodes.length);
    }, 30000);

    it('should test search functionality with paxos.json node names', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Test search for common node types
      const sinkResults = state.search('sink');
      expect(sinkResults.length).toBeGreaterThan(0);
      
      // Verify search results contain expected nodes
      const sinkNodeIds = sinkResults.map(r => r.id);
      expect(sinkNodeIds).toContain('195'); // cycle_sink node
      
      // Test search for specific labels
      const persistResults = state.search('persist');
      expect(persistResults.length).toBeGreaterThan(0);
      
      // Test search for node labels (search works on labels, not types)
      const mapResults = state.search('map');
      expect(mapResults.length).toBeGreaterThan(0);
      
      // Test search for node types by searching labels that contain type names
      const sinkTypeResults = state.search('sink');
      expect(sinkTypeResults.length).toBeGreaterThan(0);
      
      // Verify search results have proper structure
      for (const result of sinkResults) {
        expect(result.id).toBeDefined();
        expect(result.label).toBeDefined();
        expect(result.type).toBeOneOf(['node', 'container']);
        expect(Array.isArray(result.matchIndices)).toBe(true);
      }

      // Test search clearing
      state.clearSearch();
      expect(state.getSearchResults()).toHaveLength(0);
      expect(state.getSearchQuery()).toBe('');
    }, 30000);

    it('should verify performance with paxos.json data size', async () => {
      const startTime = Date.now();
      
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;
      
      const parseTime = Date.now() - startTime;
      
      // Verify parsing completes within reasonable time (should be under 1 second)
      expect(parseTime).toBeLessThan(1000);
      expect(result.stats.processingTime).toBeLessThan(1000);
      
      // Test search performance
      const searchStartTime = Date.now();
      const searchResults = state.search('map');
      const searchTime = Date.now() - searchStartTime;
      
      // Search should be fast even with large dataset
      expect(searchTime).toBeLessThan(100);
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Test container operations performance
      const containerOpStartTime = Date.now();
      state.collapseAllContainers();
      state.expandAllContainers();
      const containerOpTime = Date.now() - containerOpStartTime;
      
      // Container operations should be fast
      expect(containerOpTime).toBeLessThan(200);
      
      // Verify state consistency after operations
      state.validateInvariants();
    }, 30000);
  });

  describe('5.2 Test container operations with paxos.json', () => {
    it('should test expand/collapse operations on paxos.json containers', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Verify initial state - containers should be expanded by default
      const containers = state.visibleContainers;
      expect(containers.length).toBe(5);
      
      for (const container of containers) {
        expect(container.collapsed).toBe(false); // Should start expanded
        expect(container.children.size).toBeGreaterThan(0);
      }

      // Test individual container collapse
      const firstContainer = containers[0];
      const initialChildCount = firstContainer.children.size;
      
      state.collapseContainer(firstContainer.id);
      
      const collapsedContainer = state.getContainer(firstContainer.id);
      expect(collapsedContainer?.collapsed).toBe(true);
      expect(collapsedContainer?.children.size).toBe(initialChildCount); // Children still tracked

      // Test individual container expand
      state.expandContainer(firstContainer.id);
      
      const expandedContainer = state.getContainer(firstContainer.id);
      expect(expandedContainer?.collapsed).toBe(false);
      expect(expandedContainer?.children.size).toBe(initialChildCount);

      // Test bulk collapse all
      state.collapseAllContainers();
      
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(true);
      }

      // Test bulk expand all
      state.expandAllContainers();
      
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(false);
      }

      // Verify state consistency after all operations
      state.validateInvariants();
    }, 30000);

    it('should verify container state consistency after bulk operations', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Record initial state
      const initialNodeCount = state.visibleNodes.length;
      const initialEdgeCount = state.visibleEdges.length;
      const initialContainerCount = state.visibleContainers.length;

      // Perform multiple bulk operations
      state.collapseAllContainers();
      state.expandAllContainers();
      state.collapseAllContainers();
      state.expandAllContainers();

      // Verify counts remain consistent
      expect(state.visibleNodes.length).toBe(initialNodeCount);
      expect(state.visibleEdges.length).toBe(initialEdgeCount);
      expect(state.visibleContainers.length).toBe(initialContainerCount);

      // Verify all containers are in expected final state (expanded)
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(false);
        expect(container.children.size).toBeGreaterThan(0);
      }

      // Verify all nodes are still assigned to containers
      let totalAssignedNodes = 0;
      for (const container of state.visibleContainers) {
        totalAssignedNodes += container.children.size;
      }
      expect(totalAssignedNodes).toBe(initialNodeCount);

      // Verify invariants are maintained
      state.validateInvariants();
    }, 30000);

    it('should test search expansion scenarios with paxos.json', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Collapse all containers first
      state.collapseAllContainers();
      
      // Verify all containers are collapsed
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(true);
      }

      // Perform search that should find nodes in collapsed containers
      const searchResults = state.search('persist');
      expect(searchResults.length).toBeGreaterThan(0);

      // Verify search results contain nodes from different containers
      const resultContainers = new Set<string>();
      for (const result of searchResults) {
        if (result.type === 'node') {
          const nodeContainer = state.getNodeContainer(result.id);
          if (nodeContainer) {
            resultContainers.add(nodeContainer);
          }
        }
      }
      
      // Should find nodes across multiple containers
      expect(resultContainers.size).toBeGreaterThan(0);

      // Clear search and verify state
      state.clearSearch();
      expect(state.getSearchResults()).toHaveLength(0);

      // Verify containers remain in their collapsed state after search
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(true);
      }

      // Verify invariants
      state.validateInvariants();
    }, 30000);

    it('should validate layout state tracking during container operations', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Check initial layout state
      const initialLayoutState = state.getLayoutState();
      expect(initialLayoutState.phase).toBeDefined();
      expect(initialLayoutState.layoutCount).toBeDefined();
      expect(initialLayoutState.lastUpdate).toBeDefined();

      // Perform container operations and check layout state updates
      const initialLastUpdate = initialLayoutState.lastUpdate;
      state.collapseAllContainers();
      
      const afterCollapseState = state.getLayoutState();
      // Layout state should be updated (allow for same timestamp due to fast operations)
      expect(afterCollapseState.lastUpdate).toBeGreaterThanOrEqual(initialLastUpdate);

      // Perform expand operations
      const collapseLastUpdate = afterCollapseState.lastUpdate;
      state.expandAllContainers();
      
      const afterExpandState = state.getLayoutState();
      // Layout state should be updated (allow for same timestamp due to fast operations)
      expect(afterExpandState.lastUpdate).toBeGreaterThanOrEqual(collapseLastUpdate);

      // Verify layout count tracking (should increment with operations)
      expect(afterExpandState.layoutCount).toBeGreaterThanOrEqual(initialLayoutState.layoutCount);

      // Test smart collapse prevention logic
      const isFirstLayout = state.isFirstLayout();
      expect(typeof isFirstLayout).toBe('boolean');

      // Verify invariants
      state.validateInvariants();
    }, 30000);

    it('should handle edge aggregation during container operations', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      // Record initial edge state
      const initialEdges = state.visibleEdges;
      const initialEdgeCount = initialEdges.length;

      // Collapse all containers - this should trigger edge aggregation
      state.collapseAllContainers();

      // Verify edges are still present (may be aggregated)
      const collapsedEdges = state.visibleEdges;
      expect(collapsedEdges.length).toBeGreaterThan(0);

      // Expand all containers - this should restore original edges
      state.expandAllContainers();

      // Verify edge count is restored
      const expandedEdges = state.visibleEdges;
      expect(expandedEdges.length).toBe(initialEdgeCount);

      // Verify edge consistency
      for (const edge of expandedEdges) {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(typeof edge.hidden).toBe('boolean');
      }

      // Verify invariants
      state.validateInvariants();
    }, 30000);

    it('should handle rapid container operations without conflicts', async () => {
      // Load paxos.json test data
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;
      
      // Create parser
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosData);
      const state = result.visualizationState;

      const containers = state.visibleContainers;
      expect(containers.length).toBe(5);

      // Perform rapid individual container operations
      for (let i = 0; i < 3; i++) {
        for (const container of containers) {
          state.collapseContainer(container.id);
          state.expandContainer(container.id);
        }
      }

      // Verify final state is consistent
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(false); // Should end expanded
        expect(container.children.size).toBeGreaterThan(0);
      }

      // Perform rapid bulk operations
      for (let i = 0; i < 5; i++) {
        state.collapseAllContainers();
        state.expandAllContainers();
      }

      // Verify final state after rapid operations
      for (const container of state.visibleContainers) {
        expect(container.collapsed).toBe(false);
      }

      // Verify data integrity
      const finalNodeCount = state.visibleNodes.length;
      const finalEdgeCount = state.visibleEdges.length;
      expect(finalNodeCount).toBe(543);
      expect(finalEdgeCount).toBe(581);

      // Verify invariants
      state.validateInvariants();
    }, 30000);
  });
});