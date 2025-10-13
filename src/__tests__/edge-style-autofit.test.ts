/**
 * Test suite for edge style changes triggering autofit
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsyncCoordinator } from '../core/AsyncCoordinator.js';
import { VisualizationState } from '../core/VisualizationState.js';
import { JSONParser } from '../utils/JSONParser.js';

// Helper function to create valid test data
function createTestData(nodeCount = 2) {
  const nodes = [];
  const edges = [];
  
  for (let i = 1; i <= nodeCount; i++) {
    nodes.push({ id: `n${i}`, label: `Node ${i}` });
    if (i > 1) {
      edges.push({ id: `e${i-1}`, source: `n${i-1}`, target: `n${i}` });
    }
  }
  
  return {
    nodes,
    edges,
    hierarchyChoices: []
  };
}

describe('Edge Style Autofit', () => {
  let asyncCoordinator: AsyncCoordinator;
  let visualizationState: VisualizationState;
  let mockReactFlowInstance: any;
  let mockSetReactState: any;

  beforeEach(() => {
    asyncCoordinator = new AsyncCoordinator();
    visualizationState = new VisualizationState();
    
    // Mock ReactFlow instance with fitView method
    mockReactFlowInstance = {
      fitView: vi.fn(),
    };
    
    // Mock React state setter
    mockSetReactState = vi.fn();
    
    // Set up AsyncCoordinator with mocks
    asyncCoordinator.setReactFlowInstance(mockReactFlowInstance);
    asyncCoordinator.setReactStateSetter(mockSetReactState);
    
    // Mock bridge instances
    const mockReactFlowBridge = {
      toReactFlowData: vi.fn().mockReturnValue({
        nodes: [
          { id: 'n1', type: 'standard', position: { x: 0, y: 0 } },
          { id: 'n2', type: 'standard', position: { x: 100, y: 100 } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' }
        ]
      })
    };
    
    const mockELKBridge = {
      layout: vi.fn().mockResolvedValue(undefined)
    };
    
    asyncCoordinator.setBridgeInstances(mockReactFlowBridge, mockELKBridge);
  });

  it('should trigger fitView when edge style changes', async () => {
    // Setup initial data
    const testData = createTestData(2);

    const parser = new JSONParser();
    await parser.parseData(testData, visualizationState);

    // Change edge style with fitView enabled
    await asyncCoordinator.updateRenderConfig(
      visualizationState,
      { edgeStyle: 'straight' },
      { fitView: true }
    );

    // Verify that React state was updated
    expect(mockSetReactState).toHaveBeenCalled();

    // Simulate React render completion to trigger post-render callbacks
    asyncCoordinator.notifyRenderComplete();

    // Verify that fitView was called
    expect(mockReactFlowInstance.fitView).toHaveBeenCalledWith({
      padding: 0.15,
      duration: 300,
      includeHiddenNodes: false,
    });
  });

  it('should trigger fitView with custom options for edge style changes', async () => {
    // Setup initial data
    const testData = createTestData(2);

    const parser = new JSONParser();
    await parser.parseData(testData, visualizationState);

    // Change edge style with custom fitView options
    await asyncCoordinator.updateRenderConfig(
      visualizationState,
      { edgeStyle: 'bezier' },
      { 
        fitView: true,
        fitViewOptions: { padding: 0.2, duration: 500 }
      }
    );

    // Verify that React state was updated
    expect(mockSetReactState).toHaveBeenCalled();

    // Simulate React render completion to trigger post-render callbacks
    asyncCoordinator.notifyRenderComplete();

    // Verify that fitView was called with custom options
    expect(mockReactFlowInstance.fitView).toHaveBeenCalledWith({
      padding: 0.2,
      duration: 500,
      includeHiddenNodes: false,
    });
  });

  it('should not trigger fitView when autoFit is globally disabled', async () => {
    // Setup initial data
    const testData = createTestData(2);

    const parser = new JSONParser();
    await parser.parseData(testData, visualizationState);

    // Simulate autoFit being disabled globally (like when user toggles the autoFit button)
    // This would normally be handled by HydroscopeCore using the autoFit utility
    await asyncCoordinator.updateRenderConfig(
      visualizationState,
      { edgeStyle: 'smoothstep' },
      { fitView: false } // This simulates the autoFit utility returning false
    );

    // Verify that React state was updated
    expect(mockSetReactState).toHaveBeenCalled();

    // Simulate React render completion
    asyncCoordinator.notifyRenderComplete();

    // Verify that fitView was NOT called
    expect(mockReactFlowInstance.fitView).not.toHaveBeenCalled();
  });

  it('should handle multiple edge style changes correctly', async () => {
    // Setup initial data
    const testData = createTestData(3);

    const parser = new JSONParser();
    await parser.parseData(testData, visualizationState);

    const edgeStyles = ['straight', 'bezier', 'smoothstep'];

    for (const edgeStyle of edgeStyles) {
      // Reset mock
      mockReactFlowInstance.fitView.mockClear();

      // Change edge style
      await asyncCoordinator.updateRenderConfig(
        visualizationState,
        { edgeStyle },
        { fitView: true }
      );

      // Simulate React render completion
      asyncCoordinator.notifyRenderComplete();

      // Verify fitView was called for each change
      expect(mockReactFlowInstance.fitView).toHaveBeenCalledTimes(1);
    }
  });

  it('should integrate correctly with autoFit utility patterns', async () => {
    // This test simulates how HydroscopeCore would use the autoFit utility
    const testData = createTestData(2);
    const parser = new JSONParser();
    await parser.parseData(testData, visualizationState);

    // Import the utility (in real usage, HydroscopeCore would do this)
    const { createAutoFitOptions, createFitViewOptions, AutoFitScenarios } = await import('../utils/autoFitUtils.js');

    // Test with autoFit enabled (user has autoFit button ON)
    const autoFitEnabled = true;
    const autoFitOptions = createAutoFitOptions(AutoFitScenarios.STYLE_CHANGE, autoFitEnabled);
    const fitViewOptions = createFitViewOptions(autoFitOptions);

    await asyncCoordinator.updateRenderConfig(
      visualizationState,
      { edgeStyle: 'bezier' },
      fitViewOptions
    );

    asyncCoordinator.notifyRenderComplete();
    expect(mockReactFlowInstance.fitView).toHaveBeenCalledTimes(1);

    // Reset and test with autoFit disabled (user has autoFit button OFF)
    mockReactFlowInstance.fitView.mockClear();
    
    const autoFitDisabled = false;
    const disabledAutoFitOptions = createAutoFitOptions(AutoFitScenarios.STYLE_CHANGE, autoFitDisabled);
    const disabledFitViewOptions = createFitViewOptions(disabledAutoFitOptions);

    await asyncCoordinator.updateRenderConfig(
      visualizationState,
      { edgeStyle: 'straight' },
      disabledFitViewOptions
    );

    asyncCoordinator.notifyRenderComplete();
    expect(mockReactFlowInstance.fitView).not.toHaveBeenCalled();
  });
});