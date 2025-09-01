/**
 * Handle DOM Investigation
 * 
 * Since our data fix didn't work, the issue must be in how ReactFlow
 * actually renders and positions handles in the DOM. This test investigates
 * the actual handle positioning logic that ReactFlow uses internally.
 */

import { createVisualizationState } from '../VisualizationState';
import { ReactFlowBridge } from '../../bridges/ReactFlowBridge';
import { ELKBridge } from '../../bridges/ELKBridge';

describe('Handle DOM Investigation', () => {

  test('HANDLE POSITIONING: Investigate ReactFlow internal handle positioning logic', async () => {
    console.log('\n=== HANDLE DOM INVESTIGATION ===');

    const state = createVisualizationState();

    // Create identical nodes at same position to isolate the issue
    state.addGraphNode('regular_node', {
      x: 200, y: 200, width: 120, height: 40,
      label: 'Regular Node'
    });

    state.addContainer('collapsed_container', {
      x: 200, y: 300, width: 120, height: 40, // Same dimensions
      label: 'Collapsed Container',
      collapsed: true
    });

    state.setHyperEdge('test_hyper', {
      type: 'hyper',
      id: 'test_hyper',
      source: 'regular_node',
      target: 'collapsed_container',
      hidden: false
    });

    // Run layout
    const elkBridge = new ELKBridge();
    await elkBridge.layoutVisualizationState(state);

    const reactFlowBridge = new ReactFlowBridge();
    const reactFlowData = reactFlowBridge.convertVisualizationState(state);

    const regularNode = reactFlowData.nodes.find(n => n.id === 'regular_node')!;
    const collapsedContainer = reactFlowData.nodes.find(n => n.id === 'collapsed_container')!;
    const edge = reactFlowData.edges.find(e => e.id === 'test_hyper')!;

    console.log('\n=== REACTFLOW INTERNAL HANDLE POSITIONING SIMULATION ===');
    
    // Simulate how ReactFlow calculates handle positions internally
    // This is based on ReactFlow's source code logic
    
    console.log('Regular Node:');
    console.log('  Position:', regularNode.position);
    console.log('  Data dimensions:', { width: regularNode.data.width, height: regularNode.data.height });
    console.log('  Style dimensions:', { width: regularNode.style?.width, height: regularNode.style?.height });
    console.log('  ParentId:', regularNode.parentId);
    console.log('  Type:', regularNode.type);

    console.log('\nCollapsed Container:');
    console.log('  Position:', collapsedContainer.position);
    console.log('  Data dimensions:', { width: collapsedContainer.data.width, height: collapsedContainer.data.height });
    console.log('  Style dimensions:', { width: collapsedContainer.style?.width, height: collapsedContainer.style?.height });
    console.log('  ParentId:', collapsedContainer.parentId);
    console.log('  Type:', collapsedContainer.type);

    console.log('\nEdge Handle Assignment:');
    console.log('  Source handle:', edge.sourceHandle);
    console.log('  Target handle:', edge.targetHandle);

    // Calculate expected handle positions using ReactFlow's logic
    const regularNodeWidth = regularNode.data.width || regularNode.style?.width || 120;
    const regularNodeHeight = regularNode.data.height || regularNode.style?.height || 40;
    const containerWidth = collapsedContainer.data.width || collapsedContainer.style?.width || 120;
    const containerHeight = collapsedContainer.data.height || collapsedContainer.style?.height || 40;

    // ReactFlow handle position calculation (simplified)
    const sourceHandlePos = calculateReactFlowHandlePosition(
      regularNode.position,
      regularNodeWidth,
      regularNodeHeight,
      edge.sourceHandle!,
  // regularNode.parentId (removed extra argument)
    );

    const targetHandlePos = calculateReactFlowHandlePosition(
      collapsedContainer.position,
      containerWidth,
      containerHeight,
      edge.targetHandle!,
  // collapsedContainer.parentId (removed extra argument)
    );

    console.log('\n=== CALCULATED HANDLE POSITIONS ===');
    console.log('Source handle position (regular node):', sourceHandlePos);
    console.log('Target handle position (collapsed container):', targetHandlePos);

    // Calculate distance and alignment
    const distance = Math.sqrt(
      Math.pow(targetHandlePos.x - sourceHandlePos.x, 2) +
      Math.pow(targetHandlePos.y - sourceHandlePos.y, 2)
    );

    console.log('Handle distance:', distance.toFixed(2), 'pixels');

    // Check for potential coordinate system issues
    console.log('\n=== COORDINATE SYSTEM ANALYSIS ===');
    
    if (regularNode.parentId) {
      const parentNode = reactFlowData.nodes.find(n => n.id === regularNode.parentId);
      if (parentNode) {
        console.log('Regular node has parent:', parentNode.id);
        console.log('Parent position:', parentNode.position);
        console.log('Regular node relative position:', regularNode.position);
        console.log('Regular node absolute position:', {
          x: parentNode.position.x + regularNode.position.x,
          y: parentNode.position.y + regularNode.position.y
        });
      }
    } else {
      console.log('Regular node has no parent (absolute positioning)');
    }

    if (collapsedContainer.parentId) {
      console.log('Collapsed container has parent:', collapsedContainer.parentId);
    } else {
      console.log('Collapsed container has no parent (absolute positioning)');
    }

    // The key insight: Check if ReactFlow treats these differently
    console.log('\n=== REACTFLOW RENDERING DIFFERENCES ===');
    
    // Check if the issue is in how ReactFlow interprets the node data
    const regularNodeEffectiveWidth = getEffectiveNodeWidth(regularNode);
    const regularNodeEffectiveHeight = getEffectiveNodeHeight(regularNode);
    const containerEffectiveWidth = getEffectiveNodeWidth(collapsedContainer);
    const containerEffectiveHeight = getEffectiveNodeHeight(collapsedContainer);

    console.log('Effective dimensions (what ReactFlow actually uses):');
    console.log('  Regular node:', { width: regularNodeEffectiveWidth, height: regularNodeEffectiveHeight });
    console.log('  Collapsed container:', { width: containerEffectiveWidth, height: containerEffectiveHeight });

    // Recalculate with effective dimensions
    const effectiveSourcePos = calculateReactFlowHandlePosition(
      regularNode.position,
      regularNodeEffectiveWidth,
      regularNodeEffectiveHeight,
      edge.sourceHandle!,
  // regularNode.parentId (removed extra argument)
    );

    const effectiveTargetPos = calculateReactFlowHandlePosition(
      collapsedContainer.position,
      containerEffectiveWidth,
      containerEffectiveHeight,
      edge.targetHandle!,
  // collapsedContainer.parentId (removed extra argument)
    );

    console.log('\nHandle positions with effective dimensions:');
    console.log('  Source (effective):', effectiveSourcePos);
    console.log('  Target (effective):', effectiveTargetPos);

    const effectiveDistance = Math.sqrt(
      Math.pow(effectiveTargetPos.x - effectiveSourcePos.x, 2) +
      Math.pow(effectiveTargetPos.y - effectiveSourcePos.y, 2)
    );

    console.log('  Effective distance:', effectiveDistance.toFixed(2), 'pixels');

    // Check if there's a significant difference
    const positionDifference = {
      source: {
        x: Math.abs(sourceHandlePos.x - effectiveSourcePos.x),
        y: Math.abs(sourceHandlePos.y - effectiveSourcePos.y)
      },
      target: {
        x: Math.abs(targetHandlePos.x - effectiveTargetPos.x),
        y: Math.abs(targetHandlePos.y - effectiveTargetPos.y)
      }
    };

    console.log('\nPosition differences:');
    console.log('  Source handle difference:', positionDifference.source);
    console.log('  Target handle difference:', positionDifference.target);

    const significantDifference = (
      positionDifference.source.x > 5 || positionDifference.source.y > 5 ||
      positionDifference.target.x > 5 || positionDifference.target.y > 5
    );

    if (significantDifference) {
      console.log('🐛 SIGNIFICANT POSITION DIFFERENCE DETECTED!');
      console.log('   This suggests ReactFlow is using different dimension sources for different node types');
    } else {
      console.log('✅ No significant position differences - issue must be elsewhere');
    }

    expect(true).toBe(true);
  });

  test('HANDLE STYLES: Compare actual handle CSS styles between node types', async () => {
    console.log('\n=== HANDLE STYLES INVESTIGATION ===');

    // This test examines if different node types result in different handle styles
    const state = createVisualizationState();

    state.addGraphNode('test_node', {
      x: 100, y: 100, width: 120, height: 40,
      label: 'Test Node'
    });

    state.addContainer('test_container', {
      x: 300, y: 100, width: 120, height: 40,
      label: 'Test Container',
      collapsed: true
    });

    const reactFlowBridge = new ReactFlowBridge();
    const reactFlowData = reactFlowBridge.convertVisualizationState(state);

    const testNode = reactFlowData.nodes.find(n => n.id === 'test_node')!;
    const testContainer = reactFlowData.nodes.find(n => n.id === 'test_container')!;

    console.log('\n=== NODE TYPE ANALYSIS ===');
    console.log('Regular node type:', testNode.type);
    console.log('Container node type:', testContainer.type);

    // Check if ReactFlow applies different CSS classes or styles based on node type
    console.log('\n=== POTENTIAL REACTFLOW INTERNAL DIFFERENCES ===');
    console.log('Regular node properties that might affect handle rendering:');
    console.log('  - type:', testNode.type);
    console.log('  - parentId:', testNode.parentId);
    console.log('  - extent:', testNode.extent);
    console.log('  - connectable:', testNode.connectable);

    console.log('\nContainer node properties that might affect handle rendering:');
    console.log('  - type:', testContainer.type);
    console.log('  - parentId:', testContainer.parentId);
    console.log('  - extent:', testContainer.extent);
    console.log('  - connectable:', testContainer.connectable);

    // The key insight: ReactFlow might treat 'standard' vs 'container' types differently
    if (testNode.type !== testContainer.type) {
      console.log('\n🔍 KEY FINDING: Different node types!');
      console.log('   ReactFlow might apply different rendering logic for "standard" vs "container" types');
      console.log('   This could affect handle positioning, CSS classes, or DOM structure');
    }

    expect(true).toBe(true);
  });
});

/**
 * Calculate handle position as ReactFlow would internally
 */
function calculateReactFlowHandlePosition(
  nodePosition: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
  handleId: string,
): { x: number; y: number } {
  const { x, y } = nodePosition;

  // ReactFlow handle positioning logic
  let handleX: number, handleY: number;

  switch (handleId) {
    case 'out-top':
    case 'in-top':
      handleX = x + nodeWidth * 0.5;
      handleY = y;
      break;
    
    case 'out-right':
    case 'in-right':
      handleX = x + nodeWidth;
      handleY = y + nodeHeight * 0.5;
      break;
    
    case 'out-bottom':
    case 'in-bottom':
      handleX = x + nodeWidth * 0.5;
      handleY = y + nodeHeight;
      break;
    
    case 'out-left':
    case 'in-left':
      handleX = x;
      handleY = y + nodeHeight * 0.5;
      break;
    
    default:
      handleX = x + nodeWidth * 0.5;
      handleY = y + nodeHeight * 0.5;
  }

  // Note: If parentId exists, ReactFlow uses relative positioning
  // But for handle calculations, it should still work the same way
  
  return { x: handleX, y: handleY };
}

/**
 * Get the effective width that ReactFlow would actually use
 */
function getEffectiveNodeWidth(node: any): number {
  // ReactFlow priority: style.width > data.width > default
  return node.style?.width || node.data?.width || 120;
}

/**
 * Get the effective height that ReactFlow would actually use
 */
function getEffectiveNodeHeight(node: any): number {
  // ReactFlow priority: style.height > data.height > default
  return node.style?.height || node.data?.height || 40;
}