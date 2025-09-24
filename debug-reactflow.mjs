/**
 * Direct test of ReactFlowBridge functionality
 * Bypassing the test framework to see if the issue is there
 */

import { readFileSync } from 'fs';

console.log('=== Direct ReactFlowBridge Test ===');

// First, let's see what's actually in the file
const fileContent = readFileSync('./src/bridges/ReactFlowBridge.ts', 'utf-8');
console.log('File contains debugTest method:', fileContent.includes('debugTest'));
console.log('File contains onClick:', fileContent.includes('onClick'));

import { ReactFlowBridge } from './src/bridges/ReactFlowBridge2.ts';
import { VisualizationState } from './src/core/VisualizationState.js';
import { InteractionHandler } from './src/core/InteractionHandler.js';

// Create instances
const styleConfig = {
  nodeStyles: {
    'process': { backgroundColor: '#e1f5fe', border: '2px solid #0277bd' }
  },
  edgeStyles: {},
  containerStyles: {}
};

const bridge = new ReactFlowBridge(styleConfig);
const state = new VisualizationState();
const interactionHandler = new InteractionHandler(state);

console.log('✓ Instances created');
console.log('Debug test result:', bridge.debugTest());

// Add a test node
const node = {
  id: 'node1',
  label: 'Test Node',
  longLabel: 'Test Node Long',
  type: 'process',
  semanticTags: [],
  hidden: false
};

state.addNode(node);
console.log('✓ Node added');

// Test without interaction handler
const resultWithoutHandler = bridge.toReactFlowData(state);
console.log('Result without handler:', {
  nodeCount: resultWithoutHandler.nodes.length,
  hasOnClick: 'onClick' in resultWithoutHandler.nodes[0]?.data || false,
  onClickValue: resultWithoutHandler.nodes[0]?.data?.onClick
});

// Test with interaction handler
console.log('InteractionHandler exists:', !!interactionHandler);
console.log('InteractionHandler type:', typeof interactionHandler);
console.log('handleNodeClick exists:', typeof interactionHandler.handleNodeClick);

const resultWithHandler = bridge.toReactFlowData(state, interactionHandler);
console.log('Result with handler:', {
  nodeCount: resultWithHandler.nodes.length,
  hasOnClick: 'onClick' in resultWithHandler.nodes[0]?.data || false,
  onClickValue: resultWithHandler.nodes[0]?.data?.onClick,
  onClickType: typeof resultWithHandler.nodes[0]?.data?.onClick
});

// Test the onClick function if it exists
if (resultWithHandler.nodes[0]?.data?.onClick) {
  console.log('✓ onClick function exists - testing it');
  try {
    resultWithHandler.nodes[0].data.onClick('node1', 'node');
    console.log('✓ onClick function executed successfully');
  } catch (error) {
    console.log('✗ onClick function failed:', error.message);
  }
} else {
  console.log('✗ onClick function does not exist');
}

console.log('=== Test Complete ===');