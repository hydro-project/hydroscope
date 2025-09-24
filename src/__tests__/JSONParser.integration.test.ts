/**
 * JSONParser Integration Tests
 * Tests JSON parsing with real paxos.json data
 */

import { describe, it, expect } from 'vitest';
import { JSONParser } from '../utils/JSONParser.js';
import type { HydroscopeData } from '../types/core.js';
import fs from 'fs';
import path from 'path';

describe('JSONParser Integration Tests', () => {
  describe('Paxos.json Integration', () => {
    it('parses paxos.json successfully', async () => {
      // Read paxos.json file
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;

      // Create paxos-specific parser
      const parser = JSONParser.createPaxosParser({ debug: false });

      // Parse the data
      const result = await parser.parseData(paxosData);

      // Verify basic structure
      expect(result.visualizationState).toBeDefined();
      expect(result.hierarchyChoices).toBeDefined();
      expect(result.selectedHierarchy).toBe('location');
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
      expect(result.stats.containerCount).toBeGreaterThan(0);

      // Verify specific nodes exist
      const node195 = result.visualizationState.getGraphNode('195');
      expect(node195).toBeDefined();
      expect(node195?.label).toBe('cycle_sink');
      expect(node195?.longLabel).toBe('cycle_sink(cycle_10)');

      const node13 = result.visualizationState.getGraphNode('13');
      expect(node13).toBeDefined();
      expect(node13?.label).toBe('persist');
      expect(node13?.longLabel).toBe('persist [state storage]');

      // Verify edges exist
      const edges = result.visualizationState.visibleEdges;
      expect(edges.length).toBeGreaterThan(0);

      // Verify containers exist
      const containers = result.visualizationState.visibleContainers;
      expect(containers.length).toBeGreaterThan(0);

      // Verify node assignments
      const node195Container = result.visualizationState.getNodeContainer('195');
      const node13Container = result.visualizationState.getNodeContainer('13');
      expect(node195Container).toBeDefined();
      expect(node13Container).toBeDefined();

      console.log('Paxos.json parsing stats:', result.stats);
      console.log('Warnings:', result.warnings.length);
    }, 30000); // 30 second timeout for large file

    it('handles paxos.json with performance requirements', async () => {
      // Read paxos.json file
      const paxosPath = path.join(process.cwd(), 'test-data', 'paxos.json');
      const paxosContent = fs.readFileSync(paxosPath, 'utf-8');
      const paxosData = JSON.parse(paxosContent) as HydroscopeData;

      // Create parser with performance monitoring
      const parser = JSONParser.createPaxosParser({ debug: false });

      const startTime = Date.now();
      const result = await parser.parseData(paxosData);
      const endTime = Date.now();

      // Performance requirements
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.stats.processingTime).toBeLessThan(10000);

      // Memory efficiency - should not have excessive warnings
      expect(result.warnings.length).toBeLessThan(result.stats.nodeCount * 0.1); // Less than 10% warnings

      console.log(`Paxos.json processed in ${endTime - startTime}ms`);
      console.log(`Nodes: ${result.stats.nodeCount}, Edges: ${result.stats.edgeCount}, Containers: ${result.stats.containerCount}`);
    }, 30000);
  });

  describe('Simple Test Data Integration', () => {
    it('parses simple-collapsed-test.json successfully', async () => {
      // Read simple test file
      const simplePath = path.join(process.cwd(), 'test-data', 'simple-collapsed-test.json');
      const simpleContent = fs.readFileSync(simplePath, 'utf-8');
      const simpleData = JSON.parse(simpleContent) as HydroscopeData;

      // Create parser
      const parser = new JSONParser({ debug: false });

      // Parse the data
      const result = await parser.parseData(simpleData);

      // Verify structure
      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBe(2);
      expect(result.stats.edgeCount).toBe(2);
      expect(result.stats.containerCount).toBe(2);

      // Verify nodes
      const node1 = result.visualizationState.getGraphNode('node1');
      const node2 = result.visualizationState.getGraphNode('node2');
      expect(node1?.label).toBe('Node 1');
      expect(node2?.label).toBe('Node 2');

      // Verify containers
      const containerA = result.visualizationState.getContainer('container_a');
      const containerB = result.visualizationState.getContainer('container_b');
      expect(containerA?.label).toBe('Container A');
      expect(containerB?.label).toBe('Container B');

      // Verify assignments
      expect(result.visualizationState.getNodeContainer('node1')).toBe('container_a');
      expect(result.visualizationState.getNodeContainer('node2')).toBe('container_b');
    });
  });
});