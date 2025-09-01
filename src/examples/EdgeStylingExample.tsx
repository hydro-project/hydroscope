/**
 * Edge Styling Integration Example
 *
 * This example demonstrates how to use the new edge styling system with JSON data
 * that includes edgeStyleConfig from the Rust/Hydro side.
 */

import { parseGraphJSON, createRenderConfig, FlowGraph, VisualizationEngine } from '../index';

// Example JSON data with edge style configuration (as would come from Hydro)
const exampleHydroJSON = {
  nodes: [
    { id: 'node1', label: 'Source', type: 'standard', position: { x: 0, y: 0 } },
    { id: 'node2', label: 'Transform', type: 'standard', position: { x: 200, y: 0 } },
    { id: 'node3', label: 'Sink', type: 'standard', position: { x: 400, y: 0 } },
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      semanticTags: ['Network', 'Bounded'], // Semantic properties from Hydro
      label: 'data flow',
    },
    {
      id: 'edge2',
      source: 'node2',
      target: 'node3',
      semanticTags: ['Cycle', 'Unbounded'], // Different semantic properties
      label: 'feedback',
    },
  ],
  // Edge style configuration from Hydro's JSON output
  edgeStyleConfig: {
    propertyMappings: {
      Network: { styleTag: 'edge_style_3_alt' }, // animated
      Cycle: { styleTag: 'edge_style_4' }, // double-line/dash-dot
      Bounded: { styleTag: 'edge_style_2' }, // thin
      Unbounded: { styleTag: 'edge_style_2_alt' }, // thick
    },
    combinationRules: {
      priority: ['Cycle', 'Network', 'Bounded', 'Unbounded'],
      description: 'Cycle edges have highest priority, then Network, then data flow properties',
    },
  },
};

/**
 * Example usage showing complete edge styling integration
 */
export function EdgeStylingExample() {
  // Step 1: Parse the JSON data with edge style configuration
  const parseResult = parseGraphJSON(exampleHydroJSON);

  // Step 2: Create a RenderConfig that includes the edge style configuration
  const renderConfig = createRenderConfig(parseResult, {
    fitView: true,
    enableMiniMap: true,
    enableControls: true,
  });

  // Step 3: Use FlowGraph with the edge-aware configuration
  return (
    <div style={{ height: '600px', width: '100%' }}>
      <h2>Edge Styling Example</h2>
      <p>This example shows edges with different semantic properties from Hydro:</p>
      <ul>
        <li>
          <strong>Network + Bounded</strong>: Blue dashed, animated
        </li>
        <li>
          <strong>Cycle + Unbounded</strong>: Red dashed (Cycle takes priority)
        </li>
      </ul>

      <FlowGraph
        visualizationState={parseResult.state}
        config={renderConfig} // This now includes edgeStyleConfig
      />
    </div>
  );
}

/**
 * Advanced example showing manual edge style configuration
 */
export function AdvancedEdgeStylingExample() {
  const parseResult = parseGraphJSON(exampleHydroJSON);

  // Override or extend the edge style configuration
  const customRenderConfig = createRenderConfig(parseResult, {
    fitView: true,
    enableMiniMap: true,
    enableControls: true,
    // Override with custom edge style config
    edgeStyleConfig: {
      ...parseResult.metadata.edgeStyleConfig,
      propertyMappings: {
        ...parseResult.metadata.edgeStyleConfig?.propertyMappings,
        // Add custom style tag for specific properties
        CustomProperty: { styleTag: 'edge_style_5' },
      },
    },
  });

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <h2>Advanced Edge Styling</h2>
      <p>Shows how to extend or override edge style configuration.</p>

      <FlowGraph visualizationState={parseResult.state} config={customRenderConfig} />
    </div>
  );
}

/**
 * Example showing edge style statistics and debugging
 */
export async function EdgeStylingDebugExample() {
  const parseResult = parseGraphJSON(exampleHydroJSON);
  const renderConfig = createRenderConfig(parseResult);

  // Create visualization engine for layout
  const engine = new VisualizationEngine(parseResult.state);
  await engine.runLayout();

  // Get edge style statistics for debugging
  const { getEdgeStyleStats } = await import('../bridges/EdgeConverter');
  const stats = getEdgeStyleStats(
    Array.from(parseResult.state.visibleEdges),
    renderConfig.edgeStyleConfig
  );

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <h2>Edge Styling Debug Information</h2>
      <div style={{ marginBottom: '20px', padding: '10px', background: '#f5f5f5' }}>
        <h3>Edge Statistics:</h3>
        <ul>
          <li>Total edges: {stats.totalEdges}</li>
          <li>Property counts: {JSON.stringify(stats.propertyCounts, null, 2)}</li>
          <li>Unmapped properties: {stats.unmappedProperties.join(', ') || 'None'}</li>
        </ul>
      </div>

      <FlowGraph visualizationState={parseResult.state} config={renderConfig} />
    </div>
  );
}

export default EdgeStylingExample;
