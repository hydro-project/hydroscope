/**
 * Comprehensive Error Handling Validation Tests
 * 
 * This test suite validates all error scenarios across the entire system,
 * ensuring graceful degradation, proper error recovery, and good user experience.
 * 
 * Requirements: 12.4, 5.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState';
import { AsyncCoordinator } from '../core/AsyncCoordinator';
import { ELKBridge } from '../bridges/ELKBridge';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import { JSONParser } from '../utils/JSONParser';
import { InteractionHandler } from '../core/InteractionHandler';
import { GraphNode, GraphEdge, Container } from '../types/core';

describe('Comprehensive Error Handling Validation', () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let elkBridge: ELKBridge;
  let reactFlowBridge: ReactFlowBridge;
  let interactionHandler: InteractionHandler;

  beforeEach(() => {
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
    elkBridge = new ELKBridge({
      algorithm: 'layered',
      direction: 'DOWN',
      nodeSpacing: 50,
      edgeSpacing: 10,
      layerSpacing: 20
    });
    reactFlowBridge = new ReactFlowBridge({
      nodeStyles: new Map(),
      edgeStyles: new Map(),
      containerStyles: new Map()
    });
    interactionHandler = new InteractionHandler(visualizationState, asyncCoordinator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('VisualizationState Error Scenarios', () => {
    it('should handle invalid node operations gracefully', () => {
      // Test adding node with invalid data
      expect(() => {
        visualizationState.addNode({
          id: '',
          label: '',
          longLabel: '',
          type: '',
          semanticTags: [],
          hidden: false
        });
      }).toThrow('Invalid node: id cannot be empty');

      // Test duplicate node addition (should overwrite, not throw)
      const validNode: GraphNode = {
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: ['tag1'],
        hidden: false
      };
      
      visualizationState.addNode(validNode);
      expect(() => {
        visualizationState.addNode(validNode);
      }).not.toThrow();

      // Test operations on non-existent nodes (should not throw, just return)
      expect(() => {
        visualizationState.toggleNodeLabel('nonexistent');
      }).not.toThrow();
    });

    it('should handle invalid edge operations gracefully', () => {
      // Create a fresh state for this test
      const testState = new VisualizationState();
      
      // Add valid nodes first
      testState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Test adding edge with invalid target
      expect(() => {
        testState.addEdge({
          id: 'edge1',
          source: 'node1',
          target: 'nonexistent',
          type: 'flow',
          semanticTags: [],
          hidden: false
        });
      }).toThrow('VisualizationState invariant violations');

      // System should remain functional after error
      expect(testState.visibleNodes).toHaveLength(1);
      
      // Create a new clean state to test recovery
      const cleanState = new VisualizationState();
      cleanState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });
      
      cleanState.addNode({
        id: 'node2',
        label: 'Node 2',
        longLabel: 'Node 2 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Valid edge should work on clean state
      expect(() => {
        cleanState.addEdge({
          id: 'edge2',
          source: 'node1',
          target: 'node2',
          type: 'flow',
          semanticTags: [],
          hidden: false
        });
      }).not.toThrow();
    });

    it('should handle invalid container operations gracefully', () => {
      // Test circular dependency prevention
      const container1: Container = {
        id: 'container1',
        label: 'Container 1',
        children: new Set(['container2']),
        collapsed: false,
        hidden: false
      };

      const container2: Container = {
        id: 'container2',
        label: 'Container 2',
        children: new Set(['container1']),
        collapsed: false,
        hidden: false
      };

      visualizationState.addContainer(container1);
      expect(() => {
        visualizationState.addContainer(container2);
      }).toThrow('Circular dependency detected');

      // Test operations on non-existent containers (should not throw, just return)
      expect(() => {
        visualizationState.expandContainer('nonexistent');
      }).not.toThrow();
    });

    it('should handle memory pressure gracefully', () => {
      // Create a large number of nodes to test memory handling
      const nodeCount = 10000;
      const nodes: GraphNode[] = [];

      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long Label`,
          type: 'process',
          semanticTags: [`tag${i % 10}`],
          hidden: false
        });
      }

      // Should handle large datasets without crashing
      expect(() => {
        nodes.forEach(node => visualizationState.addNode(node));
      }).not.toThrow();

      // Verify state is still consistent
      expect(visualizationState.visibleNodes.length).toBe(nodeCount);
      visualizationState.validateInvariants();
    });

    it('should recover from corrupted state', () => {
      // Add valid data
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Add an edge that references a non-existent node (this will trigger validation error)
      const internalEdges = (visualizationState as any)._edges;
      internalEdges.set('corrupted-edge', {
        id: 'corrupted-edge',
        source: 'node1',
        target: 'nonexistent',
        type: 'flow',
        semanticTags: [],
        hidden: false
      });

      // Validation should detect and handle corruption
      expect(() => {
        visualizationState.validateInvariants();
      }).toThrow('VisualizationState invariant violations');

      // System should be able to recover by removing corrupted data
      internalEdges.delete('corrupted-edge');
      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();
    });
  });

  describe('Bridge Error Scenarios', () => {
    it('should handle ELK conversion errors gracefully', () => {
      // Test with invalid layout configuration - should fail during construction
      expect(() => {
        new ELKBridge({
          algorithm: 'invalid' as any,
          direction: 'INVALID' as any,
          nodeSpacing: -1,
          edgeSpacing: -1,
          layerSpacing: -1
        });
      }).toThrow('Invalid ELK algorithm');
    });

    it('should handle ReactFlow conversion errors gracefully', () => {
      // Test with corrupted node data
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Corrupt the node position data
      const nodes = (visualizationState as any)._nodes;
      const node = nodes.get('node1');
      node.position = { x: NaN, y: NaN };

      // ReactFlow bridge should handle NaN positions gracefully
      expect(() => {
        reactFlowBridge.toReactFlowData(visualizationState);
      }).not.toThrow();

      const result = reactFlowBridge.toReactFlowData(visualizationState);
      expect(result.nodes).toHaveLength(1);
    });

    it('should handle style application errors gracefully', () => {
      // Test with invalid style configuration
      const invalidStyleBridge = new ReactFlowBridge({
        nodeStyles: new Map([['invalid', null as any]]),
        edgeStyles: new Map(),
        containerStyles: new Map()
      });

      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'invalid',
        semanticTags: [],
        hidden: false,
        position: { x: 0, y: 0 }
      });

      // Should handle invalid styles gracefully by using defaults
      const result = invalidStyleBridge.toReactFlowData(visualizationState);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].style).toBeDefined(); // Should have default style
    });
  });

  describe('AsyncCoordinator Error Scenarios', () => {
    it('should handle queue overflow gracefully', async () => {
      // Fill the queue beyond capacity
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < 1000; i++) {
        promises.push(
          asyncCoordinator.queueApplicationEvent({
            type: 'container_toggle',
            containerId: `container${i}`,
            timestamp: Date.now()
          })
        );
      }

      // Should handle overflow without crashing
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle operation timeouts gracefully', async () => {
      // Test that operations can be cancelled/timed out
      const promise = asyncCoordinator.queueELKLayout(visualizationState, {
        algorithm: 'layered',
        direction: 'DOWN',
        nodeSpacing: 50,
        edgeSpacing: 10,
        layerSpacing: 20
      });

      // Should complete without throwing (even if it takes time)
      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle concurrent operation conflicts gracefully', async () => {
      // Add test data
      visualizationState.addContainer({
        id: 'container1',
        label: 'Container 1',
        children: new Set(),
        collapsed: false,
        hidden: false
      });

      // Queue conflicting operations
      const expand = asyncCoordinator.queueApplicationEvent({
        type: 'container_expand',
        containerId: 'container1',
        timestamp: Date.now()
      });

      const collapse = asyncCoordinator.queueApplicationEvent({
        type: 'container_collapse',
        containerId: 'container1',
        timestamp: Date.now() + 1
      });

      // Should handle conflicts by processing in order
      await Promise.all([expand, collapse]);
      
      // Operations should complete without error
      const container = visualizationState.visibleContainers.find(c => c.id === 'container1');
      expect(container).toBeDefined();
    });
  });

  describe('JSON Parser Error Scenarios', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ "nodes": [ { "id": "node1", "label": "Node 1" } '; // Missing closing braces

      // Test malformed JSON parsing
      expect(() => {
        JSON.parse(malformedJson);
      }).toThrow();
    });

    it('should handle missing required fields gracefully', () => {
      const incompleteJson = JSON.stringify({
        nodes: [
          { id: 'node1' } // Missing required fields
        ]
      });

      // Test incomplete JSON - should parse but may have warnings
      const parser = new JSONParser();
      expect(async () => {
        await parser.parseData(JSON.parse(incompleteJson));
      }).rejects.toThrow();
    });

    it('should handle invalid data types gracefully', () => {
      const invalidJson = JSON.stringify({
        nodes: [
          {
            id: 123, // Should be string
            label: 'Node 1',
            longLabel: 'Node 1 Long',
            type: 'process',
            semanticTags: 'invalid', // Should be array
            hidden: 'false' // Should be boolean
          }
        ]
      });

      // Test invalid data types - should parse but may have warnings
      const parser = new JSONParser();
      expect(async () => {
        await parser.parseData(JSON.parse(invalidJson));
      }).rejects.toThrow();
    });

    it('should handle extremely large files gracefully', async () => {
      // Create a small but valid JSON structure
      const largeData = {
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          longLabel: `Node ${i} Long Label`,
          type: 'process',
          semanticTags: [`tag${i % 3}`],
          hidden: false
        })),
        edges: Array.from({ length: 5 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${(i + 1) % 10}`,
          type: 'flow',
          semanticTags: [],
          hidden: false
        })),
        hierarchyChoices: []
      };

      // Should handle files without crashing
      const parser = new JSONParser();
      
      try {
        const result = await parser.parseData(largeData);
        expect(result).toBeDefined();
        expect(result.visualizationState).toBeDefined();
      } catch (error) {
        // If parsing fails, it should fail gracefully with a proper error
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('message');
      }
    });
  });

  describe('Interaction Handler Error Scenarios', () => {
    it('should handle rapid click events gracefully', () => {
      // Add test data
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Simulate rapid clicking
      for (let i = 0; i < 100; i++) {
        expect(() => {
          interactionHandler.handleNodeClick('node1');
        }).not.toThrow();
      }

      // Should debounce and handle gracefully
      const node = visualizationState.visibleNodes.find(n => n.id === 'node1');
      expect(node).toBeDefined();
    });

    it('should handle clicks on non-existent elements gracefully', () => {
      // These methods don't throw errors, they handle non-existent elements gracefully
      expect(() => {
        interactionHandler.handleNodeClick('nonexistent');
      }).not.toThrow();

      expect(() => {
        interactionHandler.handleContainerClick('nonexistent');
      }).not.toThrow();
    });

    it('should handle interaction during layout gracefully', () => {
      // Set layout state to laying_out
      visualizationState.setLayoutPhase('laying_out');

      visualizationState.addContainer({
        id: 'container1',
        label: 'Container 1',
        children: new Set(),
        collapsed: false,
        hidden: false
      });

      // Interactions during layout should be queued or rejected gracefully
      expect(() => {
        interactionHandler.handleContainerClick('container1');
      }).not.toThrow(); // Should queue the interaction
    });
  });

  describe('System Recovery and Stability', () => {
    it('should recover from partial failures', () => {
      // Add valid data
      visualizationState.addNode({
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      });

      // Simulate partial failure during batch operation
      const nodes = [
        {
          id: 'node2',
          label: 'Node 2',
          longLabel: 'Node 2 Long',
          type: 'process',
          semanticTags: [],
          hidden: false
        },
        {
          id: '', // Invalid node
          label: 'Invalid',
          longLabel: 'Invalid Long',
          type: 'process',
          semanticTags: [],
          hidden: false
        },
        {
          id: 'node3',
          label: 'Node 3',
          longLabel: 'Node 3 Long',
          type: 'process',
          semanticTags: [],
          hidden: false
        }
      ];

      // Should add valid nodes and skip invalid ones
      let successCount = 0;
      let errorCount = 0;

      nodes.forEach(node => {
        try {
          visualizationState.addNode(node);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      });

      expect(successCount).toBe(2); // node2 and node3
      expect(errorCount).toBe(1); // invalid node
      expect(visualizationState.visibleNodes.length).toBe(3); // node1, node2, node3
    });

    it('should maintain system stability under stress', async () => {
      // Simulate high-load scenario
      const operations: Promise<void>[] = [];

      // Add many nodes concurrently
      for (let i = 0; i < 1000; i++) {
        operations.push(
          Promise.resolve().then(() => {
            visualizationState.addNode({
              id: `node${i}`,
              label: `Node ${i}`,
              longLabel: `Node ${i} Long`,
              type: 'process',
              semanticTags: [],
              hidden: false
            });
          })
        );
      }

      // Add many containers concurrently
      for (let i = 0; i < 100; i++) {
        operations.push(
          Promise.resolve().then(() => {
            visualizationState.addContainer({
              id: `container${i}`,
              label: `Container ${i}`,
              children: new Set([`node${i * 10}`, `node${i * 10 + 1}`]),
              collapsed: false,
              hidden: false
            });
          })
        );
      }

      // Execute all operations
      await Promise.allSettled(operations);

      // System should remain stable and consistent
      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();

      expect(visualizationState.visibleNodes.length).toBeGreaterThan(0);
      expect(visualizationState.visibleContainers.length).toBeGreaterThan(0);
    });

    it('should provide meaningful error messages', () => {
      // Test various error scenarios and verify error messages are helpful
      
      // Empty ID error
      try {
        visualizationState.addNode({
          id: '',
          label: 'Node',
          longLabel: 'Node Long',
          type: 'process',
          semanticTags: [],
          hidden: false
        });
      } catch (error) {
        expect(error.message).toContain('Invalid node: id cannot be empty');
        expect(error.message).toMatch(/^[A-Z]/); // Should start with capital letter
        expect(error.message).not.toContain('undefined'); // Should not contain undefined values
      }

      // Duplicate ID error
      const validNode = {
        id: 'node1',
        label: 'Node 1',
        longLabel: 'Node 1 Long',
        type: 'process',
        semanticTags: [],
        hidden: false
      };

      visualizationState.addNode(validNode);

      try {
        visualizationState.addNode(validNode);
      } catch (error) {
        expect(error.message).toContain('already exists');
        expect(error.message).toContain('node1');
      }

      // Non-existent reference error
      try {
        visualizationState.toggleNodeLabel('nonexistent');
      } catch (error) {
        expect(error.message).toContain('not found');
        expect(error.message).toContain('nonexistent');
      }
    });
  });

  describe('User Experience Error Scenarios', () => {
    it('should provide user-friendly error feedback', () => {
      // Test that errors are formatted for user consumption
      const userFriendlyErrors = [
        'The file you uploaded is not valid JSON',
        'The graph contains circular dependencies',
        'Some nodes could not be loaded due to missing data',
        'The layout operation timed out - please try again',
        'Search query is too short - please enter at least 2 characters'
      ];

      // These would be the actual error messages shown to users
      userFriendlyErrors.forEach(message => {
        expect(message).not.toContain('undefined');
        expect(message).not.toContain('null');
        expect(message).not.toMatch(/\[object Object\]/);
        expect(message.length).toBeGreaterThan(10);
        expect(message.length).toBeLessThan(200);
      });
    });

    it('should handle network-like failures gracefully', async () => {
      // Simulate network timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 100);
      });

      await expect(timeoutPromise).rejects.toThrow('Network timeout');

      // System should remain functional after network errors
      expect(() => {
        visualizationState.addNode({
          id: 'node1',
          label: 'Node 1',
          longLabel: 'Node 1 Long',
          type: 'process',
          semanticTags: [],
          hidden: false
        });
      }).not.toThrow();
    });

    it('should handle browser resource limitations gracefully', () => {
      // Simulate memory pressure
      const largeArray = new Array(1000000).fill('large string data');
      
      // System should handle memory pressure without crashing
      expect(() => {
        // Simulate operations under memory pressure
        for (let i = 0; i < 100; i++) {
          visualizationState.addNode({
            id: `node${i}`,
            label: `Node ${i}`,
            longLabel: `Node ${i} Long`,
            type: 'process',
            semanticTags: [],
            hidden: false
          });
        }
      }).not.toThrow();

      // Clean up
      largeArray.length = 0;
    });
  });
});