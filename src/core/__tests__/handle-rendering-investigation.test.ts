/**
 * Handle Rendering Investigation
 *
 * Since handle assignment is working correctly, the issue must be in how ReactFlow
 * renders and positions handles. This test investigates:
 *
 * 1. Actual handle DOM positioning
 * 2. Handle coordinate calculations
 * 3. Edge endpoint calculations
 * 4. Coordinate system differences in rendering
 */

import { createVisualizationState } from '../VisualizationState';
import { ReactFlowBridge } from '../../bridges/ReactFlowBridge';
import { ELKBridge } from '../../bridges/ELKBridge';
import { getHandleConfig } from '../../render/handleConfig';

describe('Handle Rendering Investigation', () => {
  test('HANDLE POSITIONING: Compare calculated handle positions for different node types', async () => {
    console.log('\n=== HANDLE POSITIONING INVESTIGATION ===');

    const state = createVisualizationState();

    // Create nodes at IDENTICAL positions to isolate rendering differences
    state.addGraphNode('regular_node', {
      x: 200,
      y: 200,
      width: 120,
      height: 40,
      label: 'Regular Node',
      nodeType: 'Source',
    });

    state.addContainer('collapsed_container', {
      x: 200,
      y: 300,
      width: 120,
      height: 40, // Same width/height as regular node
      label: 'Collapsed Container',
      collapsed: true,
    });

    // Add hyperedges to both
    state.setHyperEdge('hyper_to_regular', {
      type: 'hyper',
      id: 'hyper_to_regular',
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
    const hyperEdge = reactFlowData.edges.find(e => e.id === 'hyper_to_regular')!;

    console.log('\nNode Positions:');
    console.log('Regular node:', {
      id: regularNode.id,
      position: regularNode.position,
      width: regularNode.data.width || regularNode.style?.width || 120,
      height: regularNode.data.height || regularNode.style?.height || 40,
    });
    console.log('Collapsed container:', {
      id: collapsedContainer.id,
      position: collapsedContainer.position,
      width: collapsedContainer.data.width || collapsedContainer.style?.width || 120,
      height: collapsedContainer.data.height || collapsedContainer.style?.height || 40,
    });

    console.log('\nHandle Assignments:');
    console.log('Hyperedge handles:', {
      source: hyperEdge.source,
      target: hyperEdge.target,
      sourceHandle: hyperEdge.sourceHandle,
      targetHandle: hyperEdge.targetHandle,
    });

    // Calculate expected handle positions based on ReactFlow's logic
    console.log('\n=== HANDLE POSITION CALCULATIONS ===');

    const handleConfig = getHandleConfig();
    console.log('Handle strategy:', handleConfig);

    // For discrete handles, calculate where ReactFlow should position them
    if (hyperEdge.sourceHandle && hyperEdge.targetHandle) {
      const sourceNodeWidth = regularNode.data.width || regularNode.style?.width || 120;
      const sourceNodeHeight = regularNode.data.height || regularNode.style?.height || 40;
      const targetNodeWidth =
        collapsedContainer.data.width || collapsedContainer.style?.width || 120;
      const targetNodeHeight =
        collapsedContainer.data.height || collapsedContainer.style?.height || 40;

      // Calculate handle positions based on handle IDs
      const sourceHandlePos = calculateHandlePosition(
        regularNode.position,
        sourceNodeWidth,
        sourceNodeHeight,
        hyperEdge.sourceHandle
      );

      const targetHandlePos = calculateHandlePosition(
        collapsedContainer.position,
        targetNodeWidth,
        targetNodeHeight,
        hyperEdge.targetHandle
      );

      console.log('Calculated handle positions:');
      console.log(`Source handle (${hyperEdge.sourceHandle}):`, sourceHandlePos);
      console.log(`Target handle (${hyperEdge.targetHandle}):`, targetHandlePos);

      // Calculate distance between handles
      const distance = Math.sqrt(
        Math.pow(targetHandlePos.x - sourceHandlePos.x, 2) +
          Math.pow(targetHandlePos.y - sourceHandlePos.y, 2)
      );
      console.log('Handle distance:', distance.toFixed(2), 'pixels');

      // Check if handles are reasonably aligned
      const isReasonablyAligned = distance < 500; // Reasonable connection distance
      console.log('Handles reasonably aligned:', isReasonablyAligned);

      if (!isReasonablyAligned) {
        console.log('🐛 POTENTIAL ISSUE: Handles are too far apart for visual connection');
      }
    }

    console.log('\n=== COORDINATE SYSTEM ANALYSIS ===');

    // Check if nodes are using different coordinate systems
    const regularNodeAbsX = regularNode.position.x;
    const regularNodeAbsY = regularNode.position.y;
    const containerAbsX = collapsedContainer.position.x;
    const containerAbsY = collapsedContainer.position.y;

    console.log('Coordinate system check:');
    console.log(`Regular node absolute position: (${regularNodeAbsX}, ${regularNodeAbsY})`);
    console.log(`Container absolute position: (${containerAbsX}, ${containerAbsY})`);

    // Check if there's a parent offset issue
    if (regularNode.parentId) {
      const parentNode = reactFlowData.nodes.find(n => n.id === regularNode.parentId);
      if (parentNode) {
        console.log(`Regular node parent (${regularNode.parentId}):`, parentNode.position);
        console.log('Regular node effective position:', {
          x: parentNode.position.x + regularNode.position.x,
          y: parentNode.position.y + regularNode.position.y,
        });
      }
    }

    expect(true).toBe(true);
  });

  test('HANDLE CONFIGURATION: Examine actual handle configuration differences', async () => {
    console.log('\n=== HANDLE CONFIGURATION INVESTIGATION ===');

    const state = createVisualizationState();

    // Add nodes
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

    // Convert to ReactFlow
    const reactFlowBridge = new ReactFlowBridge();
    const reactFlowData = reactFlowBridge.convertVisualizationState(state);

    const testNode = reactFlowData.nodes.find(n => n.id === 'test_node')!;
    const testContainer = reactFlowData.nodes.find(n => n.id === 'test_container')!;

    console.log('\nDetailed Node Analysis:');

    console.log('\nRegular Node (StandardNode component):');
    console.log('- Type:', testNode.type);
    console.log('- Data keys:', Object.keys(testNode.data));
    console.log('- Style keys:', testNode.style ? Object.keys(testNode.style) : 'none');
    console.log('- Has explicit dimensions in data:', {
      width: testNode.data.width !== undefined,
      height: testNode.data.height !== undefined,
    });
    console.log('- Has explicit dimensions in style:', {
      width: testNode.style?.width !== undefined,
      height: testNode.style?.height !== undefined,
    });

    console.log('\nCollapsed Container (ContainerNode component):');
    console.log('- Type:', testContainer.type);
    console.log('- Data keys:', Object.keys(testContainer.data));
    console.log('- Style keys:', testContainer.style ? Object.keys(testContainer.style) : 'none');
    console.log('- Has explicit dimensions in data:', {
      width: testContainer.data.width !== undefined,
      height: testContainer.data.height !== undefined,
    });
    console.log('- Has explicit dimensions in style:', {
      width: testContainer.style?.width !== undefined,
      height: testContainer.style?.height !== undefined,
    });

    // Check handle configuration
    const handleConfig = getHandleConfig();
    console.log('\nHandle Configuration:');
    console.log('- Strategy:', handleConfig.enableContinuousHandles ? 'continuous' : 'discrete');
    console.log('- Source handles count:', handleConfig.sourceHandles.length);
    console.log('- Target handles count:', handleConfig.targetHandles.length);

    if (handleConfig.sourceHandles.length > 0) {
      console.log(
        '- Source handle IDs:',
        handleConfig.sourceHandles.map(h => h.id)
      );
      console.log(
        '- Target handle IDs:',
        handleConfig.targetHandles.map(h => h.id)
      );

      // Check specific handle styles
      const outBottomHandle = handleConfig.sourceHandles.find(h => h.id === 'out-bottom');
      const inLeftHandle = handleConfig.targetHandles.find(h => h.id === 'in-left');

      if (outBottomHandle && inLeftHandle) {
        console.log('\nHandle Styles (used by both node types):');
        console.log('out-bottom handle style:', outBottomHandle.style);
        console.log('in-left handle style:', inLeftHandle.style);
      }
    }

    expect(true).toBe(true);
  });

  test('EDGE RENDERING: Investigate how ReactFlow calculates edge paths', async () => {
    console.log('\n=== EDGE RENDERING INVESTIGATION ===');

    const state = createVisualizationState();

    // Create a simple test case
    state.addGraphNode('source_node', {
      x: 100,
      y: 100,
      width: 120,
      height: 40,
      label: 'Source',
    });

    state.addContainer('target_container', {
      x: 300,
      y: 100,
      width: 120,
      height: 40,
      label: 'Target',
      collapsed: true,
    });

    state.setHyperEdge('test_edge', {
      type: 'hyper',
      id: 'test_edge',
      source: 'source_node',
      target: 'target_container',
      hidden: false,
    });

    // Run layout
    const elkBridge = new ELKBridge();
    await elkBridge.layoutVisualizationState(state);

    const reactFlowBridge = new ReactFlowBridge();
    const reactFlowData = reactFlowBridge.convertVisualizationState(state);

    const sourceNode = reactFlowData.nodes.find(n => n.id === 'source_node')!;
    const targetContainer = reactFlowData.nodes.find(n => n.id === 'target_container')!;
    const edge = reactFlowData.edges.find(e => e.id === 'test_edge')!;

    console.log('\nEdge Rendering Analysis:');
    console.log('Edge data:', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
    });

    // Simulate ReactFlow's edge path calculation
    console.log('\nSimulated ReactFlow Edge Path Calculation:');

    const sourcePos = sourceNode.position;
    const targetPos = targetContainer.position;
    const sourceWidth = sourceNode.data.width || sourceNode.style?.width || 120;
    const sourceHeight = sourceNode.data.height || sourceNode.style?.height || 40;
    const targetWidth = targetContainer.data.width || targetContainer.style?.width || 120;
    const targetHeight = targetContainer.data.height || targetContainer.style?.height || 40;

    // Calculate handle positions
    const sourceHandlePos = calculateHandlePosition(
      sourcePos,
      sourceWidth,
      sourceHeight,
      edge.sourceHandle!
    );
    const targetHandlePos = calculateHandlePosition(
      targetPos,
      targetWidth,
      targetHeight,
      edge.targetHandle!
    );

    console.log('Source node bounds:', {
      x: sourcePos.x,
      y: sourcePos.y,
      width: sourceWidth,
      height: sourceHeight,
      right: sourcePos.x + sourceWidth,
      bottom: sourcePos.y + sourceHeight,
    });

    console.log('Target container bounds:', {
      x: targetPos.x,
      y: targetPos.y,
      width: targetWidth,
      height: targetHeight,
      right: targetPos.x + targetWidth,
      bottom: targetPos.y + targetHeight,
    });

    console.log('Calculated edge endpoints:', {
      source: sourceHandlePos,
      target: targetHandlePos,
    });

    // Check if edge endpoints are within node bounds
    const sourceWithinBounds =
      sourceHandlePos.x >= sourcePos.x &&
      sourceHandlePos.x <= sourcePos.x + sourceWidth &&
      sourceHandlePos.y >= sourcePos.y &&
      sourceHandlePos.y <= sourcePos.y + sourceHeight;

    const targetWithinBounds =
      targetHandlePos.x >= targetPos.x &&
      targetHandlePos.x <= targetPos.x + targetWidth &&
      targetHandlePos.y >= targetPos.y &&
      targetHandlePos.y <= targetPos.y + targetHeight;

    console.log('Edge endpoint validation:', {
      sourceWithinBounds,
      targetWithinBounds,
      bothValid: sourceWithinBounds && targetWithinBounds,
    });

    if (!sourceWithinBounds || !targetWithinBounds) {
      console.log('🐛 EDGE RENDERING ISSUE DETECTED:');
      if (!sourceWithinBounds) {
        console.log(
          `  Source handle at (${sourceHandlePos.x}, ${sourceHandlePos.y}) is outside source node bounds`
        );
      }
      if (!targetWithinBounds) {
        console.log(
          `  Target handle at (${targetHandlePos.x}, ${targetHandlePos.y}) is outside target node bounds`
        );
      }
      console.log('  This would cause the edge to appear "floating" or disconnected');
    } else {
      console.log('✅ Edge endpoints are correctly positioned within node bounds');
    }

    expect(true).toBe(true);
  });
});

/**
 * Calculate the pixel position of a handle based on node position, dimensions, and handle ID
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
      // Default to center
      return { x: x + nodeWidth * 0.5, y: y + nodeHeight * 0.5 };
  }
}
