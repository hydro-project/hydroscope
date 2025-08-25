/**
 * Edge Styling Integration Test
 * 
 * Tests the complete pipeline from JSON with edgeStyleConfig to rendered ReactFlow edges
 */

import {
  parseGraphJSON,
  createRenderConfig,
  FlowGraph,
  VisualizationEngine
} from '../index';
import { convertEdgesToReactFlow } from '../bridges/EdgeConverter';

describe('Edge Styling Integration', () => {
  const testJSON = {
    nodes: [
      { id: 'n1', label: 'Node 1', type: 'standard' },
      { id: 'n2', label: 'Node 2', type: 'standard' }
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        semanticTags: ['Network', 'Bounded'],
        label: 'test edge'
      }
    ],
    edgeStyleConfig: {
      // Map semantic properties to visual style tags only (no raw style objects)
      propertyMappings: {
        // Network implies animation in our style tag system
        'Network': { styleTag: 'edge_style_3_alt' },
        // Bounded implies a width/thinness tag
        'Bounded': { styleTag: 'edge_style_2' }
      },
      combinationRules: {
        priority: ['Network', 'Bounded'],
        description: 'Network has priority over Bounded'
      }
    }
  };

  test('parseGraphJSON extracts edgeStyleConfig correctly', () => {
    const parseResult = parseGraphJSON(testJSON);
    
    expect(parseResult.metadata.edgeStyleConfig).toBeDefined();
    expect(parseResult.metadata.edgeStyleConfig.propertyMappings).toBeDefined();
    expect(parseResult.metadata.edgeStyleConfig.propertyMappings['Network']).toBeDefined();
  expect(parseResult.metadata.edgeStyleConfig.propertyMappings['Network'].styleTag).toBe('edge_style_3_alt');
  });

  test('createRenderConfig includes edgeStyleConfig', () => {
    const parseResult = parseGraphJSON(testJSON);
    const renderConfig = createRenderConfig(parseResult, { fitView: true });
    
    expect(renderConfig.edgeStyleConfig).toBeDefined();
    expect(renderConfig.edgeStyleConfig).toBe(parseResult.metadata.edgeStyleConfig);
    expect(renderConfig.fitView).toBe(true);
  });

  test('EdgeBridge processes edge properties correctly', () => {
    const parseResult = parseGraphJSON(testJSON);
    const edges = Array.from(parseResult.state.visibleEdges);
    
    const reactFlowEdges = convertEdgesToReactFlow(edges, {
      edgeStyleConfig: parseResult.metadata.edgeStyleConfig,
      showPropertyLabels: true,
      enableAnimations: true
    });
    
    expect(reactFlowEdges).toHaveLength(1);
    
    const edge = reactFlowEdges[0];
    expect(edge.id).toBe('e1');
    expect(edge.type).toBe('standard'); // Now using standard edges instead of floating
  expect(edge.animated).toBe(true); // Network style tag implies animation
    expect(edge.data?.edgeProperties).toContain('Network');
    expect(edge.data?.edgeProperties).toContain('Bounded');
  });

  test('Edge priority system works correctly', () => {
    const parseResult = parseGraphJSON(testJSON);
    const edges = Array.from(parseResult.state.visibleEdges);
    
    // Network should have priority over Bounded according to the combinationRules
    const reactFlowEdges = convertEdgesToReactFlow(edges, {
      edgeStyleConfig: parseResult.metadata.edgeStyleConfig
    });
    
    const edge = reactFlowEdges[0];
    expect(edge.animated).toBe(true); // Network animation
  });

  test('Standard edges have handle properties for proper connection', () => {
    const parseResult = parseGraphJSON(testJSON);
    const edges = Array.from(parseResult.state.visibleEdges);
    
    const reactFlowEdges = convertEdgesToReactFlow(edges, {
      edgeStyleConfig: parseResult.metadata.edgeStyleConfig
    });
    
    const edge = reactFlowEdges[0];
    expect(edge.sourceHandle).toBeDefined(); // Standard edges have handles
    expect(edge.targetHandle).toBeDefined();
    expect(edge.type).toBe('standard'); // Now using standard edges
  });

  test('Edge labels are created correctly', () => {
    const parseResult = parseGraphJSON(testJSON);
    const edges = Array.from(parseResult.state.visibleEdges);
    
    const reactFlowEdges = convertEdgesToReactFlow(edges, {
      edgeStyleConfig: parseResult.metadata.edgeStyleConfig,
      showPropertyLabels: true
    });
    
    const edge = reactFlowEdges[0];
    // Should combine original label with property abbreviations
    expect(edge.label).toContain('test edge');
    expect(edge.label).toMatch(/\[.*\]/); // Should contain property abbreviations in brackets
  });

  test('ReactFlowBridge integration with EdgeBridge', async () => {
    const parseResult = parseGraphJSON(testJSON);
    const renderConfig = createRenderConfig(parseResult);
    
    // Run layout first
    const engine = new VisualizationEngine(parseResult.state);
    await engine.runLayout();
    
    // Test ReactFlowBridge with edge style config
    const { ReactFlowBridge } = await import('../bridges/ReactFlowBridge');
    const bridge = new ReactFlowBridge();
    bridge.setEdgeStyleConfig(renderConfig.edgeStyleConfig);
    
    const reactFlowData = bridge.convertVisualizationState(parseResult.state);
    
    expect(reactFlowData.edges).toHaveLength(1);
    const edge = reactFlowData.edges[0];
    expect(edge.type).toBe('standard'); // Now using standard edges
    expect(edge.animated).toBe(true);
  });
});

// Export for use in other tests if needed
export const EdgeStylingIntegrationTestSuite = 'Edge Styling Integration';
